import { describe, it, expect } from 'vitest';
import {
  cleanPhoneNumber,
  formatPaymentInvoiceMessage,
  formatDueReminderMessage,
  formatAutoPaymentConfirmedMessage,
  formatAlreadyPaidMessage,
  formatUnregisteredNumberMessage,
} from '../whatsappTemplates';

describe('whatsappTemplates helper', () => {
  describe('cleanPhoneNumber', () => {
    it('normalizes local 08xx numbers to 628xx', () => {
      expect(cleanPhoneNumber('08123456789')).toBe('628123456789');
      expect(cleanPhoneNumber('0812-3456-7890')).toBe('6281234567890');
      expect(cleanPhoneNumber('+62 812 3456 7890')).toBe('6281234567890');
    });

    it('normalizes numbers starting with 8 directly to 628', () => {
      expect(cleanPhoneNumber('8123456789')).toBe('628123456789');
    });

    it('returns empty string for null or invalid inputs', () => {
      expect(cleanPhoneNumber('')).toBe('');
      expect(cleanPhoneNumber(null)).toBe('');
      expect(cleanPhoneNumber(undefined)).toBe('');
      expect(cleanPhoneNumber('abc')).toBe('');
    });
  });

  describe('formatPaymentInvoiceMessage', () => {
    it('formats a complete professional invoice with bold markdown and details', () => {
      const trx = {
        id: 'INV-123456',
        invoiceNumber: 'INV-2026-09-001',
        customerName: 'Budi Santoso',
        packageName: '20 Mbps Home',
        amountPaid: 200000,
        paymentMethod: 'Cash',
        cashierName: 'Admin Rian',
        date: '2026-09-23T10:30:00.000Z',
      };
      const cust = {
        pppoe_id: 'budi_net',
      };
      const comp = {
        name: 'PT Net Synergy Inovate',
        phone: '0811223344',
      };

      const msg = formatPaymentInvoiceMessage(trx, cust, comp);
      expect(msg).toContain('BUKTI PEMBAYARAN RESMI');
      expect(msg).toContain('PT NET SYNERGY INOVATE');
      expect(msg).toContain('Budi Santoso');
      expect(msg).toContain('INV-2026-09-001');
      expect(msg).toContain('budi_net');
      expect(msg).toContain('20 Mbps Home');
      expect(msg).toContain('Rp 200.000');
      expect(msg).toContain('LUNAS (TERVERIFIKASI)');
      expect(msg).toContain('Admin Rian');
    });
  });

  describe('formatDueReminderMessage', () => {
    it('formats an urgent reminder with isolir warning for H-2, H-1, or today', () => {
      const cust = {
        name: 'Siti Aminah',
        package: '10 Mbps Family',
        price: 150000,
        due_date: '25',
        pppoe_id: 'siti_wifi',
      };
      const comp = { name: 'PT Net Synergy Inovate' };

      const msgH1 = formatDueReminderMessage(cust, 1, comp);
      expect(msgH1).toContain('PEMBERITAHUAN JATUH TEMPO & PERINGATAN ISOLIR');
      expect(msgH1).toContain('besok (1 hari lagi)');
      expect(msgH1).toContain('Tgl 25');
      expect(msgH1).toContain('ISOLIR OTOMATIS');

      const msgH2 = formatDueReminderMessage(cust, 2, comp);
      expect(msgH2).toContain('2 hari lagi');

      const msgToday = formatDueReminderMessage(cust, 0, comp);
      expect(msgToday).toContain('HARI INI');
    });
  });

  describe('formatAutoPaymentConfirmedMessage', () => {
    it('formats confirmation for webhook auto-verified payment', () => {
      const cust = { name: 'Ahmad' };
      const trx = {
        invoiceNumber: 'INV-WA-999',
        packageName: '50 Mbps Pro',
        amountPaid: 350000,
      };
      const comp = { name: 'PT Net Synergy Inovate' };

      const msg = formatAutoPaymentConfirmedMessage(cust, trx, comp);
      expect(msg).toContain('PEMBAYARAN OTOMATIS DIVERIFIKASI');
      expect(msg).toContain('Ahmad');
      expect(msg).toContain('INV-WA-999');
      expect(msg).toContain('Rp 350.000');
      expect(msg).toContain('AKTIF NORMAL');
    });
  });

  describe('formatAlreadyPaidMessage and formatUnregisteredNumberMessage', () => {
    it('formats already paid message correctly', () => {
      const msg = formatAlreadyPaidMessage({ name: 'Joko' }, { name: 'Net Synergy' });
      expect(msg).toContain('Joko');
      expect(msg).toContain('sudah tercatat *LUNAS*');
    });

    it('formats unregistered number message correctly', () => {
      const msg = formatUnregisteredNumberMessage('089999999', { name: 'Net Synergy' });
      expect(msg).toContain('089999999');
      expect(msg).toContain('belum terdaftar');
    });
  });
});
