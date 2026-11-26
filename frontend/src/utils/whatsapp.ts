import { Order, OrderStatus } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { downloadCustomerInvoicePDF, downloadPackingSlipPDF, getInvoiceNumber } from '@/utils/invoice';

export function formatWhatsAppPhone(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function buildOrderWhatsAppMessage(
  order: Order,
  override?: {
    status?: OrderStatus;
    courierName?: string;
    trackingNumber?: string;
  }
): string {
  const status = override?.status ?? order.status;
  const courierName = override?.courierName ?? order.courierName;
  const trackingNumber = override?.trackingNumber ?? order.trackingNumber;
  const customerName =
    `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim() ||
    order.customerName ||
    'Customer';
  const invoiceNo = getInvoiceNumber(order);
  const totalFormatted = formatCurrency(order.total, order.currency);

  if (status === 'in-processing') {
    return [
      `Hi ${customerName},`,
      `Your order *#${order.orderNumber}* from *Lilium & Loft Crochet Studio* is now *Processing*!`,
      `*Invoice No:* ${invoiceNo}`,
      `*Order Total:* ${totalFormatted}`,
      'We are carefully crafting and preparing your order. We will notify you once it is dispatched!',
    ].join('\n');
  }

  if (status === 'dispatch') {
    const lines = [
      `Hi ${customerName},`,
      `Great news! Your order *#${order.orderNumber}* from *Lilium & Loft Crochet Studio* has been *Dispatched*.`,
    ];
    if (courierName) lines.push(`*Courier:* ${courierName}`);
    if (trackingNumber) lines.push(`*Tracking Number:* ${trackingNumber}`);
    lines.push(`*Invoice No:* ${invoiceNo}`);
    lines.push(`*Order Total:* ${totalFormatted}`);
    lines.push('We have attached your invoice PDF. Thank you for shopping with us!');
    return lines.join('\n');
  }

  if (status === 'out-for-delivery') {
    const lines = [
      `Hi ${customerName},`,
      `Your order *#${order.orderNumber}* from *Lilium & Loft Crochet Studio* is *Out for Delivery*!`,
    ];
    if (courierName) lines.push(`*Courier:* ${courierName}`);
    if (trackingNumber) lines.push(`*Tracking Number:* ${trackingNumber}`);
    lines.push(`*Invoice No:* ${invoiceNo}`);
    lines.push(`*Order Total:* ${totalFormatted}`);
    lines.push('Our delivery partner will reach you soon!');
    return lines.join('\n');
  }

  if (status === 'completed') {
    return [
      `Hi ${customerName},`,
      `Your order *#${order.orderNumber}* from *Lilium & Loft Crochet Studio* has been *Delivered*!`,
      `*Invoice No:* ${invoiceNo}`,
      `*Order Total:* ${totalFormatted}`,
      'We have attached your invoice PDF. Thank you for shopping with us!',
    ].join('\n');
  }

  return [
    `Hi ${customerName},`,
    `Thank you for your order *#${order.orderNumber}* with *Lilium & Loft Crochet Studio*!`,
    `*Invoice No:* ${invoiceNo}`,
    `*Order Total:* ${totalFormatted}`,
    'We have attached your invoice PDF and will notify you once your order is dispatched.',
  ].join('\n');
}

export async function shareOrderOnWhatsApp(
  order: Order,
  options?: {
    status?: OrderStatus;
    courierName?: string;
    trackingNumber?: string;
    downloadPdf?: boolean;
  }
): Promise<void> {
  if (options?.downloadPdf !== false) {
    const targetStatus = options?.status ?? order.status;
    if (targetStatus === 'completed') {
      await downloadPackingSlipPDF(order);
    } else {
      await downloadCustomerInvoicePDF(order);
    }
  }

  const rawPhone = order.billing?.phone || order.shipping?.phone;
  const phone = formatWhatsAppPhone(rawPhone);
  const text = encodeURIComponent(buildOrderWhatsAppMessage(order, options));
  const url = phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;

  window.open(url, '_blank', 'noopener,noreferrer');
}
