import { Order, OrderItem } from '@/types';
import { useProductStore } from '@/store';
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
    case 'in-processing':
    case 'dispatch':
    case 'out-for-delivery':
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
  image?: string;
  qty: number;
  rate: number;
  shipping: number;
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

function resolveOrderItemImage(item: OrderItem): string | undefined {
  if (item.image) return item.image;
  const products = useProductStore.getState().products;
  const product = products.find(
    (p) =>
      (item.productId &&
        (String(p.id) === String(item.productId) ||
          String(p.wooId) === String(item.productId))) ||
      (item.sku && p.sku && String(p.sku).trim() === String(item.sku).trim()) ||
      (item.name &&
        p.name &&
        p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
  );
  return (
    product?.images?.[0]?.src ||
    (product as unknown as { image_url?: string; imageUrl?: string })?.image_url ||
    (product as unknown as { image_url?: string; imageUrl?: string })?.imageUrl
  );
}

export function computeInvoiceCalculations(order: Order): InvoiceCalculations {
  const rawShipping = Number((order.shippingTotal || 0).toFixed(2));
  const shippingCgst = Number((rawShipping * 0.09).toFixed(2));
  const shippingSgst = Number((rawShipping * 0.09).toFixed(2));
  const taxableShipping = Number((rawShipping - shippingCgst - shippingSgst).toFixed(2));

  const items: InvoiceLineItem[] = order.items.map((item, idx) => {
    const qty = item.quantity || 1;
    const itemTotal = Number((item.total ?? item.price * qty).toFixed(2));
    const itemCgst = Number((itemTotal * 0.09).toFixed(2));
    const itemSgst = Number((itemTotal * 0.09).toFixed(2));
    const taxableTotal = Number((itemTotal - itemCgst - itemSgst).toFixed(2));
    const rate = qty > 0 ? Number((taxableTotal / qty).toFixed(2)) : taxableTotal;

    const rowShipping = idx === 0 ? taxableShipping : 0;
    const cgstAmt = idx === 0 ? Number((itemCgst + shippingCgst).toFixed(2)) : itemCgst;
    const sgstAmt = idx === 0 ? Number((itemSgst + shippingSgst).toFixed(2)) : itemSgst;
    const amount = idx === 0 ? Number((itemTotal + rawShipping).toFixed(2)) : itemTotal;

    return {
      name: item.name,
      image: resolveOrderItemImage(item),
      qty,
      rate,
      shipping: rowShipping,
      cgstPct: 9,
      cgstAmt,
      sgstPct: 9,
      sgstAmt,
      amount,
    };
  });

  const itemsTaxableSubtotal = items.reduce((sum, i) => sum + i.rate * i.qty, 0);
  const subtotal = Number((itemsTaxableSubtotal + taxableShipping).toFixed(2));
  const totalCgst = Number(items.reduce((sum, i) => sum + i.cgstAmt, 0).toFixed(2));
  const totalSgst = Number(items.reduce((sum, i) => sum + i.sgstAmt, 0).toFixed(2));

  return {
    items,
    subtotal,
    totalCgst,
    totalSgst,
    shipping: rawShipping,
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
    min-height: 1122px;
    margin: 0 auto;
    padding: 36px 42px 28px;
    background: #ffffff;
    color: #1e293b;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 12px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .invoice-main {
    width: 100%;
  }
  .invoice-footer {
    width: 100%;
    text-align: center;
    font-size: 11.5px;
    color: #334155;
    padding-top: 18px;
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
    background: #f1f5f9;
    font-weight: 700;
    text-align: center;
    font-size: 12px;
    padding: 3px 6px;
    line-height: 1.15;
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
  table.gst-table tr {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .invoice-totals-section {
    page-break-inside: avoid;
    break-inside: avoid;
  }
  .invoice-totals-next-page {
    page-break-before: always;
    break-before: page;
    padding-top: 24px;
  }
  .col-num { width: 38px; text-align: center; }
  .col-img { width: 58px; text-align: center; }
  .col-desc { text-align: left; }
  .col-qty { width: 46px; text-align: right; }
  .col-rate { width: 68px; text-align: right; }
  .col-ship { width: 62px; text-align: right; }
  .col-pct { width: 38px; text-align: center; }
  .col-amt { width: 60px; text-align: right; }
  .col-total-amt { width: 76px; text-align: right; }
  .item-thumb {
    width: 42px;
    height: 42px;
    object-fit: cover;
    border-radius: 3px;
    border: 1px solid #cbd5e1;
    display: inline-block;
    vertical-align: middle;
  }

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
      padding: 12mm 12mm 18mm !important;
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
        <td class="col-img">${
          item.image
            ? `<img src="${item.image}" alt="${item.name}" class="item-thumb" crossorigin="anonymous" />`
            : '<span style="color:#94a3b8;">—</span>'
        }</td>
        <td class="col-desc">${item.name}</td>
        <td class="col-qty">${item.qty.toFixed(2)}</td>
        <td class="col-rate">${formatPlainNumber(item.rate)}</td>
        <td class="col-ship">${formatPlainNumber(item.shipping)}</td>
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
    <div class="invoice-main">
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
          <th rowspan="2" class="col-num">S.No</th>
          <th rowspan="2" class="col-img">Image</th>
          <th rowspan="2" class="col-desc text-left">Item</th>
          <th rowspan="2" class="col-qty text-right">Qty</th>
          <th rowspan="2" class="col-rate text-right">Rate</th>
          <th rowspan="2" class="col-ship text-right">Shipping</th>
          <th colspan="2">CGST</th>
          <th colspan="2">SGST</th>
          <th rowspan="2" class="col-total-amt text-right">Amount</th>
        </tr>
        <tr>
          <th class="col-pct">%</th>
          <th class="col-amt">Amt</th>
          <th class="col-pct">%</th>
          <th class="col-amt">Amt</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Bottom Section: Stamp & Totals (moves to next page when > 3 items) -->
    ${calc.items.length > 3 ? '<div class="html2pdf__page-break"></div>' : ''}
    <div class="invoice-totals-section ${calc.items.length > 3 ? 'invoice-totals-next-page' : ''}">
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
              <td>Grand Total</td>
              <td class="text-right">${formatCurrency(calc.total, order.currency)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    </div>
    </div>
    <div class="invoice-footer">GSTIN: 34ABHPV4968N1ZQ</div>
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
  <div id="invoice-pdf-root">
    <style>${INVOICE_STYLES}</style>
    ${renderInvoiceBodyHTML(order, false)}
  </div>
</body>
</html>`;
}

export function generateBulkInvoicesHTML(orders: Order[]): string {
  const pages = orders
    .map((order, idx) => {
      const body = renderInvoiceBodyHTML(order, false);
      return idx < orders.length - 1
        ? `${body}<div class="html2pdf__page-break"></div>`
        : body;
    })
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
    <style>${INVOICE_STYLES}</style>
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
  iframe.style.height = 'auto';
  iframe.style.minHeight = '1123px';
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
        windowWidth: 794,
        scrollX: 0,
        scrollY: 0,
        backgroundColor: '#ffffff',
      },
      jsPDF: {
        unit: 'mm',
        format: 'a4',
        orientation: 'portrait' as const,
      },
      pagebreak: {
        mode: ['css', 'legacy'],
        avoid: ['.invoice-totals-section', '.gst-table tr'],
      },
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
  await renderHtmlToPdfInIframe(html, '#invoice-pdf-root', filename);
}

export async function downloadBulkInvoicesPDF(
  orders: Order[],
  filename = 'Lilium-Loft-Bulk-Invoices.pdf'
): Promise<void> {
  if (orders.length === 0) return;
  const html = generateBulkInvoicesHTML(orders);
  await renderHtmlToPdfInIframe(html, '#bulk-invoices-root', filename);
}

// ----------------- Customer (Non-GST) Invoice -----------------

export interface CustomerInvoiceLineItem {
  name: string;
  image?: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface CustomerInvoiceCalculations {
  items: CustomerInvoiceLineItem[];
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
}

export function computeCustomerInvoiceCalculations(order: Order): CustomerInvoiceCalculations {
  const items: CustomerInvoiceLineItem[] = order.items.map((item) => {
    const qty = item.quantity || 1;
    const amount = Number((item.total ?? item.price * qty).toFixed(2));
    const rate = qty > 0 ? Number((amount / qty).toFixed(2)) : amount;
    return {
      name: item.name,
      image: resolveOrderItemImage(item),
      qty,
      rate,
      amount,
    };
  });

  const subtotal = Number(items.reduce((sum, i) => sum + i.amount, 0).toFixed(2));

  return {
    items,
    subtotal,
    shipping: Number((order.shippingTotal || 0).toFixed(2)),
    discount: Number((order.discountTotal || 0).toFixed(2)),
    total: Number((order.total || 0).toFixed(2)),
  };
}

export function renderCustomerInvoiceBodyHTML(order: Order): string {
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

  const calc = computeCustomerInvoiceCalculations(order);
  const logoUrl = window.location.origin + '/logo.png';

  const itemsRows = calc.items
    .map(
      (item, idx) => `
      <tr>
        <td class="col-num">${idx + 1}</td>
        <td class="col-img">${
          item.image
            ? `<img src="${item.image}" alt="${item.name}" class="item-thumb" crossorigin="anonymous" />`
            : '<span style="color:#94a3b8;">—</span>'
        }</td>
        <td class="col-desc">${item.name}</td>
        <td class="col-qty">${item.qty.toFixed(2)}</td>
        <td class="col-rate">${formatPlainNumber(item.rate)}</td>
        <td class="col-total-amt">${formatPlainNumber(item.amount)}</td>
      </tr>
    `
    )
    .join('');

  return `
  <div class="invoice-wrapper">
    <div class="invoice-main">
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
            Pondicherry (Puducherry)
          </div>
        </td>
      </tr>
    </table>

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

    <table class="gst-table">
      <thead>
        <tr>
          <th class="col-num">S.No</th>
          <th class="col-img">Image</th>
          <th class="col-desc text-left">Item</th>
          <th class="col-qty text-right">Qty</th>
          <th class="col-rate text-right">Rate</th>
          <th class="col-total-amt text-right">Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    ${calc.items.length > 3 ? '<div class="html2pdf__page-break"></div>' : ''}
    <div class="invoice-totals-section ${calc.items.length > 3 ? 'invoice-totals-next-page' : ''}">
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
            ${
              calc.discount > 0
                ? `<tr>
                    <td>Discount</td>
                    <td class="text-right">-${formatCurrency(calc.discount, order.currency)}</td>
                  </tr>`
                : ''
            }
            <tr class="grand-total-row">
              <td>Grand Total</td>
              <td class="text-right">${formatCurrency(calc.total, order.currency)}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
    </div>
    </div>
    <div class="invoice-footer">Lilium and Loft Crochet Studio — Thank you for your order!</div>
  </div>`;
}

export function generateCustomerInvoiceHTML(order: Order): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Customer Invoice #${order.orderNumber}</title>
  <style>${INVOICE_STYLES}</style>
</head>
<body>
  <div id="customer-invoice-pdf-root">
    <style>${INVOICE_STYLES}</style>
    ${renderCustomerInvoiceBodyHTML(order)}
  </div>
</body>
</html>`;
}

export function printCustomerInvoice(order: Order): void {
  const invoiceHtml = generateCustomerInvoiceHTML(order);
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
      setTimeout(() => w.print(), 400);
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
      if (document.body.contains(iframe)) document.body.removeChild(iframe);
    }, 2000);
  }, 400);
}

export async function downloadCustomerInvoicePDF(order: Order): Promise<void> {
  const invoiceNo = getInvoiceNumber(order);
  const filename = `Customer-Invoice-${invoiceNo}.pdf`;
  const html = generateCustomerInvoiceHTML(order);
  await renderHtmlToPdfInIframe(html, '#customer-invoice-pdf-root', filename);
}

// ----------------- Packing Slip (Delivered) -----------------

export function generatePackingSlipHTML(order: Order): string {
  const d = new Date(order.dateCreated);
  const orderDate = isNaN(d.getTime())
    ? order.dateCreated
    : `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`;
  const billName = `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim() || order.customerName || 'Customer';
  const billAddr1 = order.billing?.address1 || '';
  const billCity = `${order.billing?.city || ''} ${order.billing?.postcode || ''}`.trim();
  const billState = order.billing?.state || '';
  const billEmail = order.billing?.email || order.customerEmail || '';
  const billPhone = order.billing?.phone || '';

  const shipName = `${order.shipping?.firstName || ''} ${order.shipping?.lastName || ''}`.trim() || billName;
  const shipAddr1 = order.shipping?.address1 || billAddr1;
  const shipCity = `${order.shipping?.city || ''} ${order.shipping?.postcode || ''}`.trim() || billCity;
  const shipState = order.shipping?.state || billState;
  const shipPhone = order.shipping?.phone || billPhone;

  const logoUrl = window.location.origin + '/logo.png';
  const rows = order.items
    .map((item, idx) => {
      const img = resolveOrderItemImage(item);
      return `
      <tr>
        <td style="width:52px;padding:10px 6px;border-bottom:1px solid #e2e8f0;">${idx + 1}</td>
        <td style="width:76px;padding:10px 6px;border-bottom:1px solid #e2e8f0;">
          ${img ? `<img src="${img}" alt="${item.name}" style="width:46px;height:46px;object-fit:cover;border-radius:3px;" crossorigin="anonymous" />` : '<span style="color:#94a3b8;">—</span>'}
        </td>
        <td style="width:110px;padding:10px 6px;border-bottom:1px solid #e2e8f0;">${item.sku || ''}</td>
        <td style="padding:10px 6px;border-bottom:1px solid #e2e8f0;">${item.name}</td>
        <td style="width:80px;padding:10px 6px;border-bottom:1px solid #e2e8f0;text-align:center;">${item.quantity || 1}</td>
      </tr>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Packing Slip #${order.orderNumber}</title>
</head>
<body>
  <div id="packing-slip-pdf-root" style="width:794px;min-height:1122px;padding:36px 42px;background:#ffffff;color:#1e293b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;font-size:12px;line-height:1.55;box-sizing:border-box;">
    <table style="width:100%;border-collapse:collapse;">
      <tr>
        <td style="width:58%;vertical-align:top;">
          <div style="font-size:22px;font-weight:700;margin-bottom:12px;">Packing slip</div>
          <img src="${logoUrl}" alt="Lilium & Loft" style="height:46px;width:auto;" />
        </td>
        <td style="width:42%;vertical-align:top;line-height:1.75;">
          <strong>Order No.:</strong> ${order.orderNumber}<br />
          <strong>Order Date:</strong> ${orderDate}<br />
          <strong>Shipping Method:</strong> ${order.shippingTotal > 0 ? 'Standard Shipping' : 'Free Shipping'}
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:26px;line-height:1.65;">
      <tr>
        <td style="width:33%;vertical-align:top;padding-right:12px;">
          <strong>From</strong><br />
          Lilium and Loft Crochet Studio<br />
          45 (13), 2nd Cross, Venkata Nagar<br />
          605011<br />
          Pondicherry (Puducherry)
        </td>
        <td style="width:34%;vertical-align:top;padding-right:12px;">
          <strong>Bill to</strong><br />
          ${billName}<br />
          ${billAddr1 ? billAddr1 + '<br />' : ''}
          ${billCity ? billCity + '<br />' : ''}
          ${billState ? billState + '<br />' : ''}
          <strong>Email:</strong> ${billEmail}<br />
          <strong>Phone:</strong> ${billPhone}
        </td>
        <td style="width:33%;vertical-align:top;">
          <strong>Ship to</strong><br />
          ${shipName}<br />
          ${shipAddr1 ? shipAddr1 + '<br />' : ''}
          ${shipCity ? shipCity + '<br />' : ''}
          ${shipState ? shipState + '<br />' : ''}
          ${shipPhone}
        </td>
      </tr>
    </table>

    <table style="width:100%;border-collapse:collapse;margin-top:28px;">
      <thead>
        <tr>
          <th style="width:52px;padding:8px 6px;border-bottom:1.5px solid #334155;text-align:left;font-weight:700;">S.No</th>
          <th style="width:76px;padding:8px 6px;border-bottom:1.5px solid #334155;text-align:left;font-weight:700;">Image</th>
          <th style="width:110px;padding:8px 6px;border-bottom:1.5px solid #334155;text-align:left;font-weight:700;">SKU</th>
          <th style="padding:8px 6px;border-bottom:1.5px solid #334155;text-align:left;font-weight:700;">Product</th>
          <th style="width:80px;padding:8px 6px;border-bottom:1.5px solid #334155;text-align:center;font-weight:700;">Quantity</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</body>
</html>`;
}

export async function downloadPackingSlipPDF(order: Order): Promise<void> {
  const filename = `Packing-Slip-${order.orderNumber}.pdf`;
  const html = generatePackingSlipHTML(order);
  await renderHtmlToPdfInIframe(html, '#packing-slip-pdf-root', filename);
}
