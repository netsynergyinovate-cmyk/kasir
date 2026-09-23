import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Send, Loader2, CheckCircle2, XCircle, ArrowLeft, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { validateCustomerForm, validateStepFields, SUPPORTED_BRANCHES } from '../utils/runsnetCustomerForm';
import LocationPicker from '../components/LocationPicker';

const JENIS_OPTIONS = [
  { value: 'pppoe', label: 'PPPoE' },
  { value: 'pppoe-soho', label: 'PPPoE SOHO' },
  { value: 'radio', label: 'Radio' },
  { value: 'hotspot', label: 'Hotspot' },
];

const BRANCH = SUPPORTED_BRANCHES[0]; // fase 1: hanya Kab. Muko Muko

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`;
const parseRupiahInput = (text) => Number(String(text || '').replace(/[^0-9]/g, '')) || 0;

const STEP_LABELS = ['Data', 'Lokasi', 'Paket', 'Ringkasan'];

const emptyForm = {
  jenis: 'pppoe',
  nama: '',
  username: '',
  secret: '',
  nik: '',
  npwp: '',
  kontak: '',
  email: '',
  branchCode: BRANCH.code,
  clusterValue: '',
  alamat: '',
  titikKoordinat: '',
  agent: '',
  jenisTagihan: 'Prepaid',
  profileValue: '',
  biayaBulanan: 0,
  biayaInstalasi: 0,
  tanggalSpk: new Date().toISOString().slice(0, 10),
  tanggalIsolir: '20',
};

// Registrasi pelanggan baru LANGSUNG ke Runsnet (form "Tambah Pelanggan" asli, bukan simpan lokal
// dulu). Cluster & Paket dimuat live dari Runsnet berdasarkan cabang (fase 1: hanya Kab. Muko Muko);
// Agent/Koordinator jadi isian bebas karena dropdownnya di Runsnet sendiri belum ada datanya.
//
// Dipecah jadi wizard 4 tahap (Data Pelanggan -> Lokasi -> Paket & Biaya -> Ringkasan & Akses) supaya
// field terkait dikerjakan bersama-sama dan Username/Secret Access (jarang diisi manual) gak
// tenggelam di tengah form. "Lanjut" dikunci sampai field wajib tahap itu keisi (validateStepFields);
// validateCustomerForm (semua field) tetap jadi pengaman terakhir sebelum kirim ke Runsnet.
const TambahPelangganRunsnet = ({ session }) => {
  const navigate = useNavigate();
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
  const [clusters, setClusters] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const authHeaders = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` });

  useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const { data: { session: authSession } } = await supabase.auth.getSession();
        const res = await fetch('/api/runsnet/customer-form-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
          body: JSON.stringify({ branchCode: form.branchCode, jenis: form.jenis }),
        });
        const json = await res.json();
        if (cancelled) return;
        if (res.ok) {
          setClusters(json.clusters || []);
          setProfiles(json.profiles || []);
        }
      } catch {
        // Diamkan — pengguna masih bisa isi field lain sambil dropdown kosong; error muncul saat submit.
      }
      if (!cancelled) setLoadingOptions(false);
    };
    loadOptions();
    return () => { cancelled = true; };
  }, [form.branchCode, form.jenis]);

  const [biayaAuto, setBiayaAuto] = useState(false);
  const [biayaFlash, setBiayaFlash] = useState(false);
  const [loadingPrice, setLoadingPrice] = useState(false);

  const handleProfileChange = async (e) => {
    const value = e.target.value;
    setForm((f) => ({ ...f, profileValue: value }));
    if (!value) return;
    setLoadingPrice(true);
    try {
      const { data: { session: authSession } } = await supabase.auth.getSession();
      const res = await fetch('/api/runsnet/customer-profile-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authSession?.access_token}` },
        body: JSON.stringify({ profileValue: value }),
      });
      const json = await res.json();
      if (res.ok) {
        setForm((f) => ({ ...f, biayaBulanan: json.price }));
        setBiayaAuto(json.price > 0);
        setBiayaFlash(true);
        setTimeout(() => setBiayaFlash(false), 900);
      }
    } catch {
      // Biarkan Biaya Bulanan tetap bisa diisi manual kalau auto-isi gagal.
    }
    setLoadingPrice(false);
  };

  const [coordValue, setCoordValue] = useState(null);

  const handleCoordChange = (coord) => {
    setCoordValue(coord);
    setForm((f) => ({ ...f, titikKoordinat: coord ? `${coord.lat}, ${coord.lng}` : '' }));
  };

  const handleSubmit = async () => {
    const errors = validateCustomerForm(form);
    if (errors.length > 0) {
      setResult({ success: false, message: errors.join(' ') });
      return;
    }
    if (!window.confirm(`Kirim pelanggan "${form.nama}" langsung ke Runsnet? Tindakan ini membuat data sungguhan, tidak ada mode uji coba.`)) return;

    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/runsnet/add-customer', { method: 'POST', headers: authHeaders(), body: JSON.stringify(form) });
      const json = await res.json();
      if (res.ok && json.success) {
        setResult({ success: true, message: `Pelanggan "${form.nama}" berhasil didaftarkan ke Runsnet.` });
        setForm(emptyForm);
        setStep(1);
      } else {
        setResult({ success: false, message: json.error || 'Runsnet menolak permintaan.' });
      }
    } catch (err) {
      setResult({ success: false, message: 'Gagal menghubungi server: ' + err.message });
    }
    setSubmitting(false);
  };

  const stepErrors = validateStepFields(step, form);

  return (
    <div className="p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-emerald-700 to-teal-800 rounded-3xl p-6 text-white mb-4 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Tambah Pelanggan</h2>
          <p className="text-emerald-100 text-xs mt-1">Registrasi langsung ke Runsnet — {BRANCH.label}</p>
        </div>
        <UserPlus size={40} className="text-emerald-200 opacity-50" />
      </div>

      <div className="mb-4">
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
          <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: `${((step - 1) / (STEP_LABELS.length - 1)) * 100}%` }} />
        </div>
        <div className="flex items-center justify-between">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const active = step === n;
            const done = step > n;
            return (
              <div key={label} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-black transition-all ${
                  done ? 'bg-emerald-600 text-white' : active ? 'bg-emerald-600 text-white ring-4 ring-emerald-100' : 'bg-gray-100 text-gray-400'
                }`}
                >
                  {done ? '✓' : n}
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wide ${active ? 'text-emerald-700' : 'text-gray-400'}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        {step === 1 && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Jenis</label>
                <select value={form.jenis} onChange={set('jenis')} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
                  {JENIS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Jenis Tagihan</label>
                <div className="flex bg-gray-50 border border-gray-200 rounded-xl p-1 gap-1">
                  {['Prepaid', 'Postpaid'].map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, jenisTagihan: opt }))}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all active:scale-95 ${
                        form.jenisTagihan === opt ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-500'
                      }`}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-400 -mt-2 ml-1">
              {form.jenisTagihan === 'Postpaid'
                ? 'Postpaid: isolir di tanggal tetap tiap bulan (mis. selalu tanggal 20).'
                : 'Prepaid: tanggal expired bebas ditentukan, tidak terikat tanggal tetap.'}
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Pelanggan *</label>
              <input value={form.nama} onChange={set('nama')} type="text" placeholder="Nama lengkap" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">NIK</label>
                <input value={form.nik} onChange={set('nik')} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">NPWP</label>
                <input value={form.npwp} onChange={set('npwp')} type="text" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Kontak *</label>
                <input value={form.kontak} onChange={set('kontak')} type="text" placeholder="08xxxxxxxxxx" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Email</label>
                <input value={form.email} onChange={set('email')} type="email" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
              </div>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Cabang</label>
              <div className="w-full p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-sm font-bold text-emerald-800">{BRANCH.label}</div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Cluster</label>
              <select value={form.clusterValue} onChange={set('clusterValue')} disabled={loadingOptions} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm disabled:opacity-50">
                <option value="">{loadingOptions ? 'Memuat...' : clusters.length === 0 ? 'Belum ada cluster terdaftar (boleh kosong)' : 'Pilih Cluster'}</option>
                {clusters.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Alamat *</label>
              <textarea value={form.alamat} onChange={set('alamat')} rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Titik Koordinat</label>
              <LocationPicker value={coordValue} onChange={handleCoordChange} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Agent / Koordinator (catatan internal)</label>
              <input value={form.agent} onChange={set('agent')} type="text" placeholder="Nama sales/teknisi" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
              <p className="text-[10px] text-amber-600 mt-1 ml-1">Belum ada daftar Agent resmi di Runsnet — isian ini TIDAK tersimpan ke Runsnet (dropdown Agent-nya sendiri masih kosong), cuma pengingat internal kalau nanti dicek manual.</p>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Paket (Profile) *</label>
              <select value={form.profileValue} onChange={handleProfileChange} disabled={loadingOptions} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm disabled:opacity-50">
                <option value="">{loadingOptions ? 'Memuat...' : 'Pilih Paket'}</option>
                {profiles.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
              </select>
              {form.profileValue && !loadingPrice && (
                form.biayaBulanan > 0 ? (
                  <p className="text-[11px] font-bold text-emerald-700 mt-1 ml-1">Harga: {rupiah(form.biayaBulanan)} / bulan</p>
                ) : (
                  <p className="text-[11px] font-bold text-red-600 mt-1 ml-1">
                    Runsnet balikin harga Rp 0 untuk paket ini — JANGAN kirim sebelum Biaya Bulanan diisi manual, cek harga aslinya di Runsnet dulu.
                  </p>
                )
              )}
              {form.profileValue && loadingPrice && (
                <p className="text-[11px] font-bold text-gray-400 mt-1 ml-1">Mengambil harga...</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="flex items-center gap-1.5 mb-1 ml-1">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase">Biaya Bulanan</label>
                  {loadingPrice && <Loader2 size={11} className="animate-spin text-emerald-600" />}
                  {!loadingPrice && biayaAuto && (
                    <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full">Otomatis dari paket</span>
                  )}
                </div>
                <input
                  value={rupiah(form.biayaBulanan)}
                  onChange={(e) => { setBiayaAuto(false); setForm((f) => ({ ...f, biayaBulanan: parseRupiahInput(e.target.value) })); }}
                  type="text"
                  inputMode="numeric"
                  className={`w-full p-3 border rounded-xl outline-none text-sm transition-all duration-300 ${biayaFlash ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200' : 'bg-gray-50 border-gray-200'}`}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Biaya Installasi</label>
                <input
                  value={rupiah(form.biayaInstalasi)}
                  onChange={(e) => setForm((f) => ({ ...f, biayaInstalasi: parseRupiahInput(e.target.value) }))}
                  type="text"
                  inputMode="numeric"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tanggal SPK</label>
                <input value={form.tanggalSpk} onChange={set('tanggalSpk')} type="date" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">
                  {form.jenisTagihan === 'Postpaid' ? 'Tanggal Isolir' : 'Tgl. Expired'}
                </label>
                {form.jenisTagihan === 'Postpaid' ? (
                  <select value={form.tanggalIsolir} onChange={set('tanggalIsolir')} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm">
                    <option value="00">Tidak ada Isolir</option>
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{`Tanggal ${d}`}</option>)}
                  </select>
                ) : (
                  <input value={form.tanggalIsolir} onChange={set('tanggalIsolir')} type="date" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-sm" />
                )}
              </div>
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl grid grid-cols-2 gap-3">
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Nama</span>
                <span className="text-sm font-bold text-gray-800 truncate block">{form.nama || '—'}</span>
              </div>
              <div>
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Kontak</span>
                <span className="text-sm font-bold text-gray-800 truncate block">{form.kontak || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Alamat</span>
                <span className="text-sm font-bold text-gray-800 block">{form.alamat || '—'}</span>
              </div>
              <div className="col-span-2">
                <span className="block text-[10px] font-bold text-gray-400 uppercase">Paket & Harga</span>
                <span className="text-sm font-bold text-gray-800 block">
                  {profiles.find((p) => p.value === form.profileValue)?.label || '—'} · {rupiah(form.biayaBulanan)} / bulan
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Username Access</label>
                <input value={form.username} onChange={set('username')} type="text" placeholder="Kosong = ikut Customer ID" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Secret Access</label>
                <input value={form.secret} onChange={set('secret')} type="text" placeholder="Kosong = ikut Customer ID" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
              </div>
            </div>
            <p className="text-[10px] text-gray-400 -mt-2 ml-1">
              Kosong = otomatis ikut Customer ID yang di-generate Runsnet — nilai aslinya baru kelihatan di Runsnet setelah berhasil kirim (Runsnet tidak mengembalikannya lewat respons kirim).
            </p>

            {result && (
              <div className={`p-3.5 rounded-xl text-xs font-medium flex items-center gap-2 ${result.success ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                {result.success ? <CheckCircle2 size={16} className="shrink-0" /> : <XCircle size={16} className="shrink-0" />}
                <span>{result.message}</span>
              </div>
            )}
          </>
        )}

        {step < 4 && stepErrors.length > 0 && (
          <p className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
            Lengkapi dulu: {stepErrors.join(' ')}
          </p>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-gray-100 shadow-[0_-6px_20px_rgba(15,23,42,0.05)] h-[72px] flex items-center gap-3 px-4 z-20">
        <button
          type="button"
          onClick={() => (step > 1 ? setStep((s) => s - 1) : navigate('/customers'))}
          className="shrink-0 p-3.5 bg-gray-100 text-gray-600 rounded-2xl active:scale-95 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={() => stepErrors.length === 0 && setStep((s) => s + 1)}
            disabled={stepErrors.length > 0}
            className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl shadow-[0_10px_25px_rgba(5,150,105,0.35)] transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            Lanjut
            <ArrowRight size={18} />
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-black py-3.5 rounded-2xl shadow-[0_10px_25px_rgba(5,150,105,0.35)] transition-all active:scale-95 flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            {submitting ? 'Mengirim ke Runsnet...' : 'Kirim ke Runsnet'}
          </button>
        )}
      </div>
    </div>
  );
};

export default TambahPelangganRunsnet;
