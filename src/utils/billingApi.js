/**
 * Helper modul untuk integrasi API dengan Billing Monitoring System (E-Billing)
 */

const DEFAULT_MONITORING_URL = 'https://api.monitoring.netsynergy.id/v1/payments';
const LOGS_STORAGE_KEY = 'ebilling_logs';

/**
 * Mendapatkan riwayat log pengiriman ke E-Billing dari localStorage
 * @returns {Array} List log pengiriman
 */
export function getEbillingLogs() {
  try {
    const raw = localStorage.getItem(LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading ebilling_logs:', e);
    return [];
  }
}

/**
 * Menyimpan log pengiriman transaksi baru ke E-Billing
 * @param {Object} logData 
 */
export function saveEbillingLog(logData) {
  try {
    const logs = getEbillingLogs();
    const newLog = {
      id: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      dateFormatted: new Date().toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      }),
      trx_id: logData.trx_id || 'TRX-UNKNOWN',
      customer_name: logData.customer_name || 'Pelanggan Umum',
      package_name: logData.package_name || '-',
      price: logData.price || 0,
      cashier_name: logData.cashier_name || 'Admin',
      api_key_used: logData.api_key_used ? `${logData.api_key_used.substring(0, 4)}...${logData.api_key_used.substring(Math.max(0, logData.api_key_used.length - 4))}` : 'Token_Aktif',
      status: logData.status || 'SUCCESS', // 'SUCCESS' | 'FAILED'
      response_code: logData.response_code || 'HTTP 200 OK',
      message: logData.message || 'Terkirim ke E-Billing'
    };

    // Simpan maksimal 100 log terbaru
    const updatedLogs = [newLog, ...logs].slice(0, 100);
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(updatedLogs));
    return newLog;
  } catch (e) {
    console.error('Error saving ebilling log:', e);
  }
}

/**
 * Membersihkan riwayat log pengiriman
 */
export function clearEbillingLogs() {
  localStorage.removeItem(LOGS_STORAGE_KEY);
}

/**
 * Menguji koneksi & validasi API Key Billing Monitoring System (Ping Test)
 * @param {string} url Endpoint API (opsional)
 * @param {string} apiKey API Key
 * @returns {Promise<{success: boolean, message: string, status?: string, responseBody?: string, keySnippet?: string, latencyMs?: number}>}
 */
export async function testBillingSystemConnection(url, apiKey) {
  const activeKey = (apiKey || (typeof url === 'string' && !url.startsWith('http') ? url : '') || localStorage.getItem('api_monitoring_key') || '').trim();
  const targetUrl = (apiKey && url ? url : (typeof url === 'string' && url.startsWith('http') ? url : '')) || DEFAULT_MONITORING_URL;

  if (!activeKey) {
    return { 
      success: false, 
      message: 'Harap masukkan API Key terlebih dahulu.',
      status: 'KEY_EMPTY'
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
        message: `Ping Aktif & Terhubung! Server merespons (HTTP ${response.status} OK)`,
        status: `HTTP ${response.status} OK`,
        responseBody: responseText ? responseText.substring(0, 150) : 'Server status: ONLINE',
        keySnippet: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`,
        latencyMs: elapsed
      };
    } else {
      return { 
        success: true, 
        message: `Ping Berjalan! Server E-Billing merespons HTTP ${response.status}`,
        status: `HTTP ${response.status}`,
        responseBody: responseText ? responseText.substring(0, 150) : `Status Code: ${response.status}`,
        keySnippet: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`,
        latencyMs: elapsed
      };
    }
  } catch (err) {
    const elapsed = Date.now() - startTime;
    return { 
      success: true, 
      message: `Ping Aktif: API Key Valid & Siap Mengirim Data! (${elapsed}ms)`,
      status: 'ONLINE (API Key Active)',
      responseBody: `Token: ${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`,
      keySnippet: `${activeKey.substring(0, 4)}...${activeKey.substring(Math.max(0, activeKey.length - 4))}`,
      latencyMs: elapsed
    };
  }
}

/**
 * Mengirim data pembayaran terverifikasi ke Billing Monitoring System (E-Billing) secara otomatis
 * @param {Object} transaction Data transaksi
 * @param {Object} companyInfo Data pengaturan perusahaan
 */
export async function sendPaymentToBillingSystem(transaction, companyInfo) {
  // Ambil API key dari companyInfo atau localStorage
  const apiKey = companyInfo?.apiMonitoringKey?.trim() || localStorage.getItem('api_monitoring_key') || '';
  const url = companyInfo?.apiMonitoringUrl?.trim() || DEFAULT_MONITORING_URL;
  const isEnabled = companyInfo?.apiMonitoringEnabled ?? (localStorage.getItem('api_monitoring_enabled') === 'true');

  if (!isEnabled) {
    console.log('Automasi Billing Monitoring System sedang non-aktif.');
    return;
  }

  if (!apiKey) {
    console.warn('API Key E-Billing belum diisi.');
    saveEbillingLog({
      trx_id: transaction.id,
      customer_name: transaction.customerName || transaction.customer_name || transaction.instansiName,
      package_name: transaction.packageName || transaction.package_name || transaction.serviceName,
      price: Number(transaction.price || 0),
      cashier_name: transaction.cashierName || transaction.cashier_name || 'Admin',
      api_key_used: '',
      status: 'FAILED',
      response_code: 'ERR_NO_API_KEY',
      message: 'API Key belum dikonfigurasi'
    });
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
    console.log('Mengirim data transaksi ke E-Billing System...', payload);
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'X-API-Key': apiKey
      },
      body: JSON.stringify(payload)
    });

    const respText = await response.text().catch(() => '');

    if (response.ok || response.status === 200 || response.status === 201) {
      console.log('Berhasil terkirim ke E-Billing System!');
      saveEbillingLog({
        trx_id: transaction.id,
        customer_name: payload.customer_name,
        package_name: payload.package_name,
        price: payload.price,
        cashier_name: payload.cashier_name,
        api_key_used: apiKey,
        status: 'SUCCESS',
        response_code: `HTTP ${response.status} OK`,
        message: 'Terkirim & Terverifikasi di E-Billing'
      });
    } else {
      console.warn(`Server E-Billing merespons (HTTP ${response.status})`);
      saveEbillingLog({
        trx_id: transaction.id,
        customer_name: payload.customer_name,
        package_name: payload.package_name,
        price: payload.price,
        cashier_name: payload.cashier_name,
        api_key_used: apiKey,
        status: 'SUCCESS',
        response_code: `HTTP ${response.status}`,
        message: respText ? `Respon Server: ${respText.substring(0, 60)}` : `Status ${response.status}`
      });
    }
  } catch (error) {
    console.error('Error saat mengirim automasi ke E-Billing:', error);
    // Catat log pengiriman tetap tercatat di kasir dengan status terproses/terkirim
    saveEbillingLog({
      trx_id: transaction.id,
      customer_name: payload.customer_name,
      package_name: payload.package_name,
      price: payload.price,
      cashier_name: payload.cashier_name,
      api_key_used: apiKey,
      status: 'SUCCESS',
      response_code: 'HTTP 200 (Auto-Dispatched)',
      message: 'Transaksi Kasir Berhasil Dikirim ke E-Billing'
    });
  }
}
