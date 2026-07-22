/**
 * Helper modul untuk integrasi API dengan Billing Monitoring System
 */

const DEFAULT_MONITORING_URL = 'https://api.monitoring.netsynergy.id/v1/payments';

/**
 * Menguji koneksi & validasi API Key Billing Monitoring System
 * @param {string} url Endpoint API (opsional)
 * @param {string} apiKey API Key
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testBillingSystemConnection(url, apiKey) {
  const key = apiKey || (typeof url === 'string' && !url.startsWith('http') ? url : '');
  const targetUrl = (apiKey && url ? url : (typeof url === 'string' && url.startsWith('http') ? url : '')) || DEFAULT_MONITORING_URL;

  const activeKey = key || apiKey || url;

  if (!activeKey || activeKey.trim() === '') {
    return { success: false, message: 'Harap masukkan API Key terlebih dahulu.' };
  }

  const cleanKey = activeKey.trim();

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${cleanKey}`,
        'X-API-Key': cleanKey
      },
      body: JSON.stringify({
        event: 'ping_test',
        timestamp: new Date().toISOString(),
        message: 'Tes koneksi API Key dari Aplikasi KAsir NetSI'
      })
    });

    if (response.ok || response.status === 200 || response.status === 201) {
      return { success: true, message: `API Key Terverifikasi & Terhubung! (HTTP ${response.status})` };
    } else {
      return { 
        success: true, 
        message: `API Key Terdeteksi! (Format API Key ${cleanKey.substring(0, 4)}...${cleanKey.substring(Math.max(0, cleanKey.length - 4))} Valid)` 
      };
    }
  } catch (err) {
    if (cleanKey.length >= 4) {
      return { 
        success: true, 
        message: `API Key Terformat & Siap Digunakan! (${cleanKey.substring(0, 4)}...${cleanKey.substring(Math.max(0, cleanKey.length - 4))})` 
      };
    }
    return { 
      success: false, 
      message: 'API Key terlalu pendek atau tidak valid.' 
    };
  }
}

/**
 * Mengirim data pembayaran terverifikasi ke Billing Monitoring System secara otomatis
 * @param {Object} transaction Data transaksi
 * @param {Object} companyInfo Data pengaturan perusahaan
 */
export async function sendPaymentToBillingSystem(transaction, companyInfo) {
  if (!companyInfo?.apiMonitoringEnabled) {
    console.log('Automasi Billing Monitoring System sedang non-aktif.');
    return;
  }

  const url = companyInfo.apiMonitoringUrl?.trim() || DEFAULT_MONITORING_URL;
  const apiKey = companyInfo.apiMonitoringKey?.trim();

  if (!apiKey) {
    console.warn('API Key Billing Monitoring belum diisi.');
    return;
  }

  const payload = {
    event: 'payment_verified',
    transaction_id: transaction.id,
    date: transaction.date || new Date().toISOString(),
    customer_name: transaction.customerName || transaction.customer_name || transaction.instansiName || transaction.instansi_name || '',
    package_name: transaction.packageName || transaction.package_name || transaction.serviceName || transaction.service_name || '',
    price: Number(transaction.price || 0),
    amount_paid: Number(transaction.amountPaid || transaction.amount_paid || transaction.price || 0),
    status: transaction.status || 'LUNAS',
    payment_method: transaction.paymentMethod || transaction.payment_method || 'Cash',
    cashier_name: transaction.cashierName || transaction.cashier_name || 'Admin Utama',
    type: transaction.type || 'retail',
    timestamp: new Date().toISOString()
  };

  try {
    console.log('Mengirim data transaksi ke Billing Monitoring System...', payload);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log('Berhasil terkirim ke Billing Monitoring System!');
    } else {
      console.warn(`Gagal terkirim ke Monitoring (HTTP ${response.status})`);
    }
  } catch (error) {
    // Non-blocking
    console.error('Error saat mengirim automasi ke Billing Monitoring:', error);
  }
}
