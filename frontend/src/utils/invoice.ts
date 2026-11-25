import { Order } from '@/types';
import { formatCurrency } from './formatters';
// @ts-ignore
import html2pdf from 'html2pdf.js';

export function formatInvoiceDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return dateString;
  }
}

export function getInvoiceNumber(order: Order): string {
  try {
    const d = new Date(order.dateCreated);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `LLC${order.orderNumber}${month}-${day}-${year}`;
  } catch {
    return `LLC${order.orderNumber}`;
  }
}

export function getInvoiceStampText(status: string): string {
  switch (status.toLowerCase()) {
    case 'completed':
    case 'processing':
    case 'dispatch':
      return 'RECEIVED';
    case 'refunded':
      return 'REFUNDED';
    case 'cancelled':
      return 'CANCELLED';
    case 'on-hold':
    case 'pending':
      return 'PENDING';
    default:
      return 'RECEIVED';
  }
}

export function formatPlainNumber(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export interface InvoiceLineItem {
  name: string;
  qty: number;
  rate: number;
  cgstPct: number;
  cgstAmt: number;
  sgstPct: number;
  sgstAmt: number;
  amount: number;
}

export interface InvoiceCalculations {
  items: InvoiceLineItem[];
  subtotal: number;
  totalCgst: number;
  totalSgst: number;
  shipping: number;
  discount: number;
  total: number;
}

export function computeInvoiceCalculations(order: Order): InvoiceCalculations {
  const items: InvoiceLineItem[] = order.items.map((item) => {
    const qty = item.quantity || 1;
    const amount = Number((item.total ?? item.price * qty).toFixed(2));
    const cgstAmt = Number((amount * 0.09).toFixed(2));
    const sgstAmt = Number((amount * 0.09).toFixed(2));
    const taxableTotal = Number((amount - cgstAmt - sgstAmt).toFixed(2));
    const rate = qty > 0 ? Number((taxableTotal / qty).toFixed(2)) : taxableTotal;
    return {
      name: item.name,
      qty,
      rate,
      cgstPct: 9,
      cgstAmt,
      sgstPct: 9,
      sgstAmt,
      amount,
    };
  });

  const subtotal = Number(
    items.reduce((sum, i) => sum + i.rate * i.qty, 0).toFixed(2)
  );
  const totalCgst = Number(items.reduce((sum, i) => sum + i.cgstAmt, 0).toFixed(2));
  const totalSgst = Number(items.reduce((sum, i) => sum + i.sgstAmt, 0).toFixed(2));

  return {
    items,
    subtotal,
    totalCgst,
    totalSgst,
    shipping: order.shippingTotal || 0,
    discount: order.discountTotal || 0,
    total: order.total || 0,
  };
}

const INVOICE_STYLES = `
  @page {
    size: A4 portrait;
    margin: 0;
  }
  .invoice-wrapper, .invoice-wrapper * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  .invoice-wrapper {
    width: 794px;
    max-width: 794px;
    min-width: 794px;
    margin: 0 auto;
    padding: 40px 42px;
    background: #ffffff;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    position: relative;
  }
  .invoice-page-break {
    page-break-after: always;
    break-after: page;
  }
  table.layout-table {
    width: 100%;
    border-collapse: collapse;
    border-spacing: 0;
    border: none;
  }
  table.layout-table td {
    padding: 0;
    border: none;
    vertical-align: top;
  }
  .invoice-title {
    font-size: 20px;
    font-weight: 800;
    letter-spacing: 0.04em;
    color: #1e293b;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .invoice-logo {
    width: 215px;
    max-width: 215px;
    height: auto;
    display: block;
  }
  .from-block {
    font-size: 12px;
    color: #334155;
    line-height: 1.65;
  }
  .from-block strong {
    font-size: 13px;
    font-weight: 700;
    color: #1e293b;
    display: block;
    margin-bottom: 5px;
  }
  .col-block {
    font-size: 12px;
    color: #334155;
    line-height: 1.65;
  }
  .col-block strong {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 5px;
  }
  table.meta-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  table.meta-table td {
    padding: 3px 0;
    vertical-align: top;
  }
  .meta-label {
    font-weight: 700;
    color: #1e293b;
    white-space: nowrap;
    padding-right: 10px;
  }
  .meta-val {
    color: #334155;
  }
  table.gst-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 22px;
    margin-bottom: 24px;
    font-size: 12px;
  }
  table.gst-table th,
  table.gst-table td {
    border: 1px solid #475569;
    padding: 8px 10px;
    color: #1e293b;
  }
  table.gst-table thead th {
    background: #ffffff;
    font-weight: 700;
    text-align: center;
    font-size: 12px;
  }
  table.gst-table thead th.text-left {
    text-align: left;
  }
  table.gst-table thead th.text-right {
    text-align: right;
  }
  table.gst-table tbody td {
    vertical-align: middle;
    background: #ffffff;
  }
  .col-num { width: 34px; text-align: center; }
  .col-desc { text-align: left; }
  .col-qty { width: 64px; text-align: right; }
  .col-rate { width: 82px; text-align: right; }
  .col-pct { width: 46px; text-align: center; }
  .col-amt { width: 68px; text-align: right; }
  .col-total-amt { width: 88px; text-align: right; }

  .stamp {
    display: inline-block;
    padding: 6px 14px;
    border: 3px solid #a87575;
    border-radius: 6px;
    color: #a87575;
    font-weight: 800;
    font-size: 17px;
    letter-spacing: 2px;
    text-transform: uppercase;
    transform: rotate(-45deg);
    opacity: 0.85;
    background: rgba(255, 255, 255, 0.9);
  }
  table.totals-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  table.totals-table td {
    padding: 5px 0;
    color: #334155;
  }
  table.totals-table td.text-right {
    text-align: right;
  }
  .grand-total-row td {
    padding-top: 10px !important;
    border-top: 1px solid #e2e8f0;
    font-size: 14px;
    font-weight: 700;
    color: #1e293b;
  }
  @media print {
    @page {
      size: A4 portrait;
      margin: 0;
    }
    html, body {
      width: 210mm !important;
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .invoice-wrapper {
      width: 210mm !important;
      max-width: 210mm !important;
      padding: 12mm 12mm !important;
      margin: 0 !important;
    }
    .stamp {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
  }
`;

export function renderInvoiceBodyHTML(order: Order, withPageBreak = false): string {
  const invoiceNo = getInvoiceNumber(order);
  const orderDate = formatInvoiceDate(order.dateCreated);
  const paymentMethod = (order.paymentMethod || order.paymentMethodTitle || 'phonepe').toLowerCase();
  const stampText = getInvoiceStampText(order.status);

  const billName = `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim() || order.customerName || 'Customer';
  const billAddr1 = order.billing?.address1 || '';
  const billAddr2 = order.billing?.address2 || '';
  const billCity = order.billing?.city || '';
  const billState = order.billing?.state || '';
  const billPostcode = order.billing?.postcode || '';
  const billPhone = order.billing?.phone || '';

  const shipName = `${order.shipping?.firstName || ''} ${order.shipping?.lastName || ''}`.trim() || billName;
  const shipAddr1 = order.shipping?.address1 || billAddr1;
  const shipAddr2 = order.shipping?.address2 || billAddr2;
  const shipCity = order.shipping?.city || billCity;
  const shipState = order.shipping?.state || billState;
  const shipPostcode = order.shipping?.postcode || billPostcode;
  const shipPhone = order.shipping?.phone || billPhone;

  const calc = computeInvoiceCalculations(order);
  const logoUrl = window.location.origin + '/logo.png';

  const itemsRows = calc.items
    .map(
      (item, idx) => `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-desc">${item.name}</td>
        <td class="col-qty">${item.qty.toFixed(2)}</td>
        <td class="col-rate">${formatPlainNumber(item.rate)}</td>
        <td class="col-pct">${item.cgstPct}%</td>
        <td class="col-amt">${formatPlainNumber(item.cgstAmt)}</td>
        <td class="col-pct">${item.sgstPct}%</td>
        <td class="col-amt">${formatPlainNumber(item.sgstAmt)}</td>
        <td class="col-total-amt">${formatPlainNumber(item.amount)}</td>
      </tr>
    `
    )
    .join('');

  return `
  <div class="invoice-wrapper${withPageBreak ? ' invoice-page-break' : ''}">
    <!-- Top Section -->
    <table class="layout-table">
      <tr>
        <td style="width: 55%; vertical-align: top;">
          <div class="invoice-title">INVOICE</div>
          <img src="${logoUrl}" alt="Lilium & Loft Crochet Studio" class="invoice-logo" width="215" />
        </td>
        <td style="width: 10%;"></td>
        <td style="width: 35%; vertical-align: top;">
          <div class="from-block">
            <strong>From</strong>
            Lilium and Loft Crochet Studio<br />
            45 (13), 2nd Cross, Venkata Nagar<br />
            605011<br />
            Pondicherry (Puducherry)<br />
            GSTIN: 34ABHPV4968N1ZQ
          </div>
        </td>
      </tr>
    </table>

    <!-- 3-Column Info -->
    <table class="layout-table" style="margin-top: 28px; margin-bottom: 24px;">
      <tr>
        <td style="width: 34%; vertical-align: top; padding-right: 14px;">
          <div class="col-block">
            <strong>Bill to</strong>
            ${billName}<br />
            ${billAddr1 ? billAddr1 + '<br />' : ''}
            ${billAddr2 ? billAddr2 + '<br />' : ''}
            ${billCity ? `${billCity} ${billPostcode}` : billPostcode}${billCity || billPostcode ? '<br />' : ''}
            ${billState ? billState + '<br />' : ''}
            ${billPhone}
          </div>
        </td>
        <td style="width: 34%; vertical-align: top; padding-right: 14px;">
          <div class="col-block">
            <strong>Ship to</strong>
            ${shipName}<br />
            ${shipAddr1 ? shipAddr1 + '<br />' : ''}
            ${shipAddr2 ? shipAddr2 + '<br />' : ''}
            ${shipCity ? `${shipCity} ${shipPostcode}` : shipPostcode}${shipCity || shipPostcode ? '<br />' : ''}
            ${shipState ? shipState + '<br />' : ''}
            ${shipPhone}
          </div>
        </td>
        <td style="width: 32%; vertical-align: top;">
          <table class="meta-table">
            <tr>
              <td class="meta-label">Invoice no:</td>
              <td class="meta-val">${invoiceNo}</td>
            </tr>
            <tr>
              <td class="meta-label">Order date:</td>
              <td class="meta-val">${orderDate}</td>
            </tr>
            <tr>
              <td class="meta-label">Payment method:</td>
              <td class="meta-val">${paymentMethod}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- GST Items Table -->
    <table class="gst-table">
      <thead>
        <tr>
          <th rowspan="2" class="col-num">#</th>
          <th rowspan="2" class="col-desc text-left">Item &amp; Description</th>
          <th rowspan="2" class="col-qty text-right">Qty</th>
          <th rowspan="2" class="col-rate text-right">Rate</th>
          <th colspan="2">CGST</th>
          <th colspan="2">SGST</th>
          <th rowspan="2" class="col-total-amt text-right">Amount</th>
        </tr>
        <tr>
          <th class="col-pct">%</th>
          <th class="col-amt text-right">Amt</th>
          <th class="col-pct">%</th>
          <th class="col-amt text-right">Amt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Bottom Section: Stamp & Totals -->
    <table class="layout-table" style="margin-top: 24px;">
      <tr>
        <td style="width: 58%; vertical-align: middle; text-align: center; padding-top: 28px;">
          <div class="stamp">${stampText}</div>
        </td>
        <td style="width: 42%; vertical-align: top;">
          <table class="totals-table">
            <tr>
              <td>Subtotal</td>
              <td class="text-right">${formatCurrency(calc.subtotal, order.currency)}</td>
            </tr>
            <tr>
              <td>Shipping</td>
              <td class="text-right">${calc.shipping > 0 ? formatCurrency(calc.shipping, order.currency) : 'Free'}</td>
            </tr>
            <tr>
              <td>CGST (9%)</td>
              <td class="text-right">${formatCurrency(calc.totalCgst, order.currency)}</td>
            </tr>
            <tr>
              <td>SGST (9%)</td>
              <td class="text-right">${formatCurrency(calc.totalSgst, order.currency)}</td>
            </tr>
            ${
              calc.discount > 0
                ? `<tr>
                    <td>Discount</td>
                    <td class="text-right">-${formatCurrency(calc.discount, order.currency)}</td>
                  </tr>`
                : ''
            }
            <tr class="grand-total-row">
              <td>Total</td>
              <td class="text-right">${formatCurrency(calc.total, order.currency)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </div>`;
}

export function generateInvoiceHTML(order: Order): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice #${order.orderNumber}</title>
  <style>${INVOICE_STYLES}</style>
</head>
<body>
  ${renderInvoiceBodyHTML(order, false)}
</body>
</html>`;
}

export function generateBulkInvoicesHTML(orders: Order[]): string {
  const pages = orders
    .map((order, idx) => renderInvoiceBodyHTML(order, idx < orders.length - 1))
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Bulk Invoices (${orders.length})</title>
  <style>${INVOICE_STYLES}</style>
</head>
<body>
  <div id="bulk-invoices-root">
    ${pages}
  </div>
</body>
</html>`;
}

export function printInvoice(order: Order): void {
  const invoiceHtml = generateInvoiceHTML(order);

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(invoiceHtml);
      w.document.close();
      w.focus();
      setTimeout(() => {
        w.print();
      }, 400);
    }
    return;
  }

  doc.open();
  doc.write(invoiceHtml);
  doc.close();

  setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);
  }, 400);
}

async function renderHtmlToPdfInIframe(
  html: string,
  targetSelector: string,
  filename: string
): Promise<void> {
  const iframe = document.createElement('iframe');
  iframe.id = 'invoice-download-frame';
  iframe.style.position = 'fixed';
  iframe.style.top = '0';
  iframe.style.left = '0';
  iframe.style.width = '794px';
  iframe.style.height = '1123px';
  iframe.style.border = '0';
  iframe.style.opacity = '0.001';
  iframe.style.pointerEvents = 'none';
  iframe.style.zIndex = '-9999';

  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentWindow?.document;
    if (!doc) throw new Error('Cannot access iframe document');

    doc.open();
    doc.write(html);
    doc.close();

    const images = Array.from(doc.querySelectorAll('img'));
    await Promise.race([
      Promise.all(
        images.map(
          (img) =>
            new Promise<void>((resolve) => {
              if (img.complete) {
                resolve();
              } else {
                img.onload = () => resolve();
                img.onerror = () => resolve();
              }
            })
        )
      ),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const targetEl = (doc.querySelector(targetSelector) as HTMLElement) || doc.body;

    const opt = {
      margin: 0,
      filename: filename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        logging: false,
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
      },
      pagebreak: { mode: ['css', 'legacy'] },
    };

    await html2pdf().set(opt).from(targetEl).save();
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
}

export async function downloadInvoicePDF(order: Order): Promise<void> {
  const invoiceNo = getInvoiceNumber(order);
  const filename = `Invoice-${invoiceNo}.pdf`;
  const html = generateInvoiceHTML(order);
  await renderHtmlToPdfInIframe(html, '.invoice-wrapper', filename);
}

export async function downloadBulkInvoicesPDF(
  orders: Order[],
  filename = 'Lilium-Loft-Bulk-Invoices.pdf'
): Promise<void> {
  if (orders.length === 0) return;
  const html = generateBulkInvoicesHTML(orders);
  await renderHtmlToPdfInIframe(html, '#bulk-invoices-root', filename);
}
