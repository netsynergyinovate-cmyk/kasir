/**
 * Helper modul untuk integrasi API dengan Billing Monitoring System
 */

/**
 * Menguji koneksi API ke Billing Monitoring System
 * @param {string} url Endpoint API
 * @param {string} apiKey API Key
 * @returns {Promise<{success: boolean, message: string}>}
 */
export async function testBillingSystemConnection(url, apiKey) {
  if (!url || !apiKey) {
    return { success: false, message: 'URL Endpoint dan API Key tidak boleh kosong.' };
  }

  try {
    const formattedUrl = url.trim();
    const response = await fetch(formattedUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`,
        'X-API-Key': apiKey.trim()
      },
      body: JSON.stringify({
        event: 'ping_test',
        timestamp: new Date().toISOString(),
        message: 'Tes koneksi API dari Aplikasi KAsir NetSI'
      })
    });

    if (response.ok || response.status === 200 || response.status === 201) {
      return { success: true, message: `Koneksi berhasil! (HTTP ${response.status})` };
    } else {
      const text = await response.text().catch(() => '');
      return { 
        success: false, 
        message: `Server merespons dengan HTTP ${response.status}${text ? `: ${text.substring(0, 100)}` : ''}` 
      };
    }
  } catch (err) {
    console.error('Test API connection error:', err);
    return { 
      success: false, 
      message: `Gagal terhubung: ${err.message || 'Cek URL Endpoint atau koneksi internet Anda (CORS mungkin terjadi).'}` 
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

  const url = companyInfo.apiMonitoringUrl?.trim();
  const apiKey = companyInfo.apiMonitoringKey?.trim();

  if (!url || !apiKey) {
    console.warn('URL Endpoint atau API Key Billing Monitoring belum diatur.');
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
      console.log('Berhasil terikirim ke Billing Monitoring System!');
    } else {
      console.warn(`Gagal terkirim ke Monitoring (HTTP ${response.status})`);
    }
  } catch (error) {
    // Non-blocking: Tangkap error agar tidak menggagalkan penyimpanan transaksi lokal
    console.error('Error saat mengirim automasi ke Billing Monitoring:', error);
  }
}
