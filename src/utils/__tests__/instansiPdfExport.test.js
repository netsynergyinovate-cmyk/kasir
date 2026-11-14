import { describe, it, expect, vi } from 'vitest';

vi.mock('html-to-image', () => ({ toJpeg: vi.fn(async () => 'data:image/jpeg;base64,x') }));
vi.mock('jspdf', () => ({
  jsPDF: vi.fn(function jsPDF() {
    this.addPage = vi.fn();
    this.addImage = vi.fn();
  }),
}));

const { buildInvoicePdf } = await import('../instansiPdfExport');

const page = (heightPx) => {
  const el = document.createElement('div');
  el.className = 'printable-invoice';
  Object.defineProperty(el, 'offsetWidth', { value: 794 });
  Object.defineProperty(el, 'offsetHeight', { value: heightPx });
  return el;
};

describe('buildInvoicePdf', () => {
  it('satu halaman A4 = satu halaman PDF', async () => {
    const container = document.createElement('div');
    container.append(page(1123));
    const pdf = await buildInvoicePdf(container);
    expect(pdf.addPage).not.toHaveBeenCalled();
    expect(pdf.addImage).toHaveBeenCalledTimes(1);
  });

  it('isi lebih tinggi dari A4 lanjut ke halaman berikutnya, tidak dipencet', async () => {
    const container = document.createElement('div');
    container.append(page(1123 * 1.5), page(1123));
    const pdf = await buildInvoicePdf(container);
    // halaman 1 terpotong jadi 2 halaman PDF + halaman 2 = 3 halaman
    expect(pdf.addPage).toHaveBeenCalledTimes(2);
    expect(pdf.addImage).toHaveBeenCalledTimes(3);
    const [, , , y2, , h2] = pdf.addImage.mock.calls[1];
    expect(y2).toBe(-297);
    expect(h2).toBeCloseTo(297 * 1.5, 0);
  });
});
