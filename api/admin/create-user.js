import { randomBytes } from 'node:crypto';
import { verifySuperadmin } from '../_lib/verifySuperadmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  let auth;
  try {
    auth = await verifySuperadmin(req);
  } catch (err) {
    res.status(500).json({ error: err.message });
    return;
  }

  const { error, adminClient } = auth;
  if (error) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  const { email, password, fullName } = req.body || {};
  if (!email || !fullName) {
    res.status(400).json({ error: 'Email dan nama wajib diisi.' });
    return;
  }
  if (password && password.length < 6) {
    res.status(400).json({ error: 'Password minimal 6 karakter.' });
    return;
  }

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    // Admin login lewat Google; tanpa password dari superadmin dibuat password acak yang tak diketahui siapa pun.
    password: password || randomBytes(24).toString('hex'),
    email_confirm: true,
  });

  if (createError) {
    res.status(400).json({ error: createError.message });
    return;
  }

  const { error: insertProfileError } = await adminClient.from('admin_profiles').insert({
    id: created.user.id,
    full_name: fullName,
    email,
    role: 'admin',
  });

  if (insertProfileError) {
    await adminClient.auth.admin.deleteUser(created.user.id);
    res.status(400).json({ error: 'Gagal membuat profil admin: ' + insertProfileError.message });
    return;
  }

  res.status(200).json({ success: true, userId: created.user.id });
}
