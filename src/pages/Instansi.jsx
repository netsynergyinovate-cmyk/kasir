import React from 'react';
import { Building2, FileText } from 'lucide-react';

const Instansi = ({ onComplete }) => {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const instansiTrx = {
      id: `INV-B2B-${Date.now()}`,
      date: formData.get('printDate') ? new Date(formData.get('printDate')).toISOString() : new Date().toISOString(),
      instansiName: formData.get('instansiName'),
      address: formData.get('address'),
      serviceName: formData.get('serviceName'),
      price: Number(formData.get('price')),
      cashierName: formData.get('cashierName') || 'Finance / Admin',
      type: 'instansi'
    };
    onComplete(instansiTrx);
    e.target.reset();
  };

  return (
    <div className="p-4 pb-32 animate-in fade-in duration-300">
      <div className="bg-gradient-to-r from-gray-800 to-gray-900 rounded-3xl p-6 text-white mb-6 shadow-lg flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Invoice Instansi</h2>
          <p className="text-gray-300 text-xs mt-1">Cetak Tagihan Format A4 (B2B)</p>
        </div>
        <Building2 size={40} className="text-gray-600 opacity-50" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 bg-white p-5 rounded-3xl shadow-sm border border-gray-100">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Tanggal Cetak</label>
            <input name="printDate" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1 ml-1">Nama Penerima/Admin</label>
            <input name="cashierName" type="text" placeholder="Nama Admin" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl outline-none text-xs" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nama Instansi / Perusahaan</label>
          <input name="instansiName" required type="text" placeholder="Misal: Dinas Pendidikan..." className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Alamat Instansi</label>
          <textarea name="address" required rows="2" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm"></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Deskripsi Layanan & Periode</label>
          <input name="serviceName" required type="text" placeholder="Misal: Dedicated Internet 100Mbps" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Tagihan (Rp)</label>
          <input name="price" required type="number" placeholder="Misal: 1500000" className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-gray-800 outline-none text-sm" />
        </div>

        <button type="submit" className="w-full bg-gray-900 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-gray-200 hover:bg-black transition-colors flex items-center justify-center gap-2">
          <FileText size={18} /> Terbitkan Invoice A4
        </button>
      </form>
    </div>
  );
};

export default Instansi;
