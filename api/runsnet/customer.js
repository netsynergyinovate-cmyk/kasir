import { verifyStaff } from '../_lib/verifySuperadmin.js';
import {
  getRunsnetSession,
  findCustomersByName,
  submitNewCustomer,
  fetchCustomerFormOptions,
  fetchProfilePrice,
} from '../_lib/runsnetClient.js';
import { buildCustomerPayload, validateCustomerForm } from '../../src/utils/runsnetCustomerForm.js';

// Digabung dari 4 endpoint terpisah (find-customer, add-customer, customer-form-options,
// customer-profile-price) ke satu file — Vercel Hobby plan cuma boleh maksimal 12 Serverless
// Function per deployment, dan project ini sudah mepet limitnya. Dipilih lewat body.action, bukan
// path terpisah, supaya tetap satu function.
async function handleFormOptions(req, res, session) {
  const { branchCode, jenis } = req.body || {};
  if (!branchCode) {
    res.status(400).json({ error: 'branchCode wajib diisi.' });
    return;
  }
  const options = await fetchCustomerFormOptions(session, branchCode, jenis || 'pppoe');
  res.status(200).json({ success: true, ...options });
}

async function handleProfilePrice(req, res, session) {
  const { profileValue } = req.body || {};
  if (!profileValue) {
    res.status(400).json({ error: 'profileValue wajib diisi.' });
    return;
  }
  const price = await fetchProfilePrice(session, profileValue);
  res.status(200).json({ success: true, price });
}

// Mendaftarkan pelanggan baru langsung ke Runsnet (form "Tambah Pelanggan" asli). PERINGATAN: efek
// samping nyata — begitu berhasil, baris pelanggan sungguhan langsung ada di Runsnet, tidak ada
// mode uji coba/pratinjau di sisi Runsnet-nya.
async function handleAddCustomer(req, res, session) {
  const form = req.body || {};
  const validationErrors = validateCustomerForm(form);
  if (validationErrors.length > 0) {
    res.status(400).json({ error: validationErrors.join(' ') });
    return;
  }
  const payload = buildCustomerPayload(form);
  const result = await submitNewCustomer(session, payload);
  res.status(200).json({ success: true, ...result });
}

// Dipakai layar sukses "Tambah Pelanggan" buat menebak Customer ID pelanggan yang baru saja
// dikirim — submitNewCustomer tidak mengembalikan Customer ID sama sekali. Caller (front-end)
// yang menangani kasus 0 atau >1 hasil (nama kembar), bukan endpoint ini.
async function handleFindCustomer(req, res, session) {
  const { name } = req.body || {};
  if (!name) {
    res.status(400).json({ error: 'name wajib diisi.' });
    return;
  }
  const matches = await findCustomersByName(session, name);
  res.status(200).json({ success: true, matches });
}

const ACTIONS = {
  'form-options': handleFormOptions,
  'profile-price': handleProfilePrice,
  'add-customer': handleAddCustomer,
  'find-customer': handleFindCustomer,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const action = ACTIONS[req.body?.action];
  if (!action) {
    res.status(400).json({ error: 'action tidak dikenali.' });
    return;
  }

  const { error, adminClient } = await verifyStaff(req);
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  try {
    const session = await getRunsnetSession(adminClient);
    await action(req, res, session);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
