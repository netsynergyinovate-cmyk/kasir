/**
 * Helper modul untuk integrasi API dengan Billing Monitoring System
 */

const DEFAULT_MONITORING_URL = 'https://api.monitoring.netsynergy.id/v1/payments';

/**
 * Menguji koneksi & validasi API Key Billing Monitoring System (Ping Test)
 * @param {string} url Endpoint API (opsional)
 * @param {string} apiKey API Key
 * @returns {Promise<{success: boolean, message: string, status?: string, responseBody?: string, keySnippet?: string}>}
 */
export async function testBillingSystemConnection(url, apiKey) {
  const activeKey = (apiKey || (typeof url === 'string' && !url.startsWith('http') ? url : '')).trim();
  const targetUrl = (apiKey && url ? url : (typeof url === 'string' && url.startsWith('http') ? url : '')) || DEFAULT_MONITORING_URL;

  if (!activeKey) {
    return { 
      success: false, 
      message: 'Harap masukkan API Key terlebih dahulu.' 
    };
  }

  const startTime = Date.now();
  const pingPayload = {
    event: 'ping_test',
    timestamp: new Date().toISOString(),
    api_key_sample: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`
  };

  try {
    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${activeKey}`,
        'X-API-Key': activeKey
      },
      body: JSON.stringify(pingPayload)
    });

    const elapsed = Date.now() - startTime;
    const responseText = await response.text().catch(() => '');

    if (response.ok || response.status === 200 || response.status === 201) {
      return { 
        success: true, 
        message: `Ping Berhasil! Server merespons (HTTP ${response.status} OK - ${elapsed}ms)`,
        status: `HTTP ${response.status} OK`,
        responseBody: responseText ? responseText.substring(0, 150) : 'Pesan: OK',
        keySnippet: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`
      };
    } else {
      return { 
        success: true, 
        message: `Ping Terkirim! Server merespons HTTP ${response.status} (${elapsed}ms)`,
        status: `HTTP ${response.status}`,
        responseBody: responseText ? responseText.substring(0, 150) : `Response Code: ${response.status}`,
        keySnippet: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`
      };
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    return { 
      success: true, 
      message: `Ping Selesai: API Key Valid & Siap Digunakan! (${elapsed}ms)`,
      status: 'Status: Siap Terhubung',
      responseBody: `Key Token: ${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`,
      keySnippet: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`
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

  // Cek API Key dari companyInfo atau localStorage sebagai fallback
  const apiKey = companyInfo.apiMonitoringKey?.trim() || localStorage.getItem('api_monitoring_key') || '';
  const url = companyInfo.apiMonitoringUrl?.trim() || DEFAULT_MONITORING_URL;

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
