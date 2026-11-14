import { toJpeg } from 'html-to-image';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';

// Merasterisasi satu elemen preview A4 (.printable-invoice) jadi satu halaman PDF A4 (210x297mm).
// Dipakai untuk "Unduh PDF" satu invoice dan untuk membangun arsip ZIP di Multipate.
// Isi yang lebih tinggi dari A4 tidak dipencet: gambar dipotong per 297mm ke halaman PDF berikutnya.
async function renderPageToPdf(pdf, pageEl, isFirstPage) {
  const dataUrl = await toJpeg(pageEl, { quality: 0.95, pixelRatio: 2, backgroundColor: '#ffffff' });
  const imgHeight = pageEl.offsetWidth ? (210 * pageEl.offsetHeight) / pageEl.offsetWidth : 297;
  for (let y = 0; y === 0 || y < imgHeight - 1; y += 297) {
    if (!isFirstPage || y > 0) pdf.addPage();
    pdf.addImage(dataUrl, 'JPEG', 0, -y, 210, imgHeight);
  }
}

// containerEl = elemen yang membungkus satu atau lebih .printable-invoice (untuk invoice multi-halaman).
export async function buildInvoicePdf(containerEl) {
  const pages = containerEl.querySelectorAll('.printable-invoice');
  const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
  const pageList = pages.length > 0 ? Array.from(pages) : [containerEl];
  for (let i = 0; i < pageList.length; i++) {
    await renderPageToPdf(pdf, pageList[i], i === 0);
  }
  return pdf;
}

const safeFilename = (text) => (text || 'invoice').replace(/[/\\?%*:|"<>\s]/g, '_');

export async function downloadInvoicePdf(containerEl, invoiceNumber, institutionName) {
  const pdf = await buildInvoicePdf(containerEl);
  pdf.save(`${safeFilename(invoiceNumber)}_${safeFilename(institutionName)}.pdf`);
}

// items: [{ el, invoiceNumber, institutionName }] — satu elemen render per invoice (dari container
// off-screen yang me-render semua invoice batch sekaligus).
export async function downloadInvoicesZip(items, onProgress) {
  const zip = new JSZip();
  for (let i = 0; i < items.length; i++) {
    const { el, invoiceNumber, institutionName } = items[i];
    onProgress?.(i + 1, items.length, institutionName);
    const pdf = await buildInvoicePdf(el);
    zip.file(`${safeFilename(invoiceNumber)}_${safeFilename(institutionName)}.pdf`, pdf.output('blob'));
  }
  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(zipBlob);
  link.download = `INVOICES_BATCH_${new Date().toISOString().slice(0, 10)}.zip`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}
