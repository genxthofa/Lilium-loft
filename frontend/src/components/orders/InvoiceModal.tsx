import React, { useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Printer, Download, FileText, Loader2 } from 'lucide-react';
import { Order } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import {
  getInvoiceNumber,
  formatInvoiceDate,
  getInvoiceStampText,
  printInvoice,
  downloadInvoicePDF,
  computeInvoiceCalculations,
  formatPlainNumber,
} from '@/utils/invoice';
import { toast } from 'sonner';

interface InvoiceModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InvoiceModal({ order, open, onOpenChange }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  if (!order) return null;

  const invoiceNo = getInvoiceNumber(order);
  const orderDate = formatInvoiceDate(order.dateCreated);
  const paymentMethod = (order.paymentMethod || order.paymentMethodTitle || 'phonepe').toLowerCase();
  const stampText = getInvoiceStampText(order.status);

  const billName =
    `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim() ||
    order.customerName ||
    'Customer';
  const billAddr1 = order.billing?.address1 || '';
  const billAddr2 = order.billing?.address2 || '';
  const billCity = order.billing?.city || '';
  const billState = order.billing?.state || '';
  const billPostcode = order.billing?.postcode || '';
  const billPhone = order.billing?.phone || '';

  const shipName =
    `${order.shipping?.firstName || ''} ${order.shipping?.lastName || ''}`.trim() || billName;
  const shipAddr1 = order.shipping?.address1 || billAddr1;
  const shipAddr2 = order.shipping?.address2 || billAddr2;
  const shipCity = order.shipping?.city || billCity;
  const shipState = order.shipping?.state || billState;
  const shipPostcode = order.shipping?.postcode || billPostcode;
  const shipPhone = order.shipping?.phone || billPhone;

  const calc = computeInvoiceCalculations(order);

  const handlePrint = () => {
    printInvoice(order);
  };

  const handleDownload = async () => {
    try {
      setIsDownloading(true);
      toast.loading('Downloading invoice PDF...', { id: 'invoice-pdf-download' });
      await downloadInvoicePDF(order);
      toast.success('Invoice PDF downloaded successfully!', { id: 'invoice-pdf-download' });
    } catch (err) {
      console.error('Download PDF error:', err);
      toast.error('Failed to download invoice PDF', { id: 'invoice-pdf-download' });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[96vw] max-w-[940px] sm:max-w-[940px] md:max-w-[940px] lg:max-w-[940px] p-0 overflow-hidden bg-slate-100 max-h-[94vh] flex flex-col sm:rounded-xl border border-slate-300 shadow-2xl">
        {/* Top Actions Bar */}
        <DialogHeader className="p-3.5 sm:p-4 px-4 sm:px-6 bg-white border-b border-slate-200 flex flex-row items-center justify-between space-y-0 shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 pr-2">
            <div className="h-9 w-9 rounded-lg bg-red-50 text-red-700 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 truncate">
                  Invoice: {invoiceNo}
                </DialogTitle>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200 tracking-wide shrink-0">
                  Order #{order.orderNumber}
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5 truncate">
                Official Lilium & Loft store tax invoice
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="icon"
              onClick={handlePrint}
              className="h-8 w-8 text-slate-700 border-slate-300 hover:bg-slate-100 hover:text-slate-900"
              title="Print Invoice"
              aria-label="Print Invoice"
            >
              <Printer className="h-4 w-4 text-slate-600" />
            </Button>
            <Button
              size="icon"
              onClick={handleDownload}
              disabled={isDownloading}
              className="h-8 w-8 bg-red-600 hover:bg-red-700 text-white shadow-sm"
              title="Download PDF"
              aria-label="Download PDF"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
            </Button>
          </div>
        </DialogHeader>

        {/* Scrollable Invoice Sheet Container */}
        <div className="p-2 sm:p-5 overflow-y-auto flex-1 flex justify-center bg-slate-100/90">
          <div
            ref={invoiceRef}
            className="w-full max-w-[860px] bg-white rounded shadow-sm border border-slate-200/90 p-4 sm:p-8 text-slate-800 text-xs font-sans relative"
          >
            {/* Top Grid: Left (Invoice + Logo), Middle (spacer), Right (From) */}
            <div className="grid grid-cols-1 sm:grid-cols-[38%_30%_32%] gap-4 mb-6 items-start">
              <div className="flex flex-col gap-2.5">
                <h2 className="text-lg sm:text-xl font-extrabold tracking-wider text-slate-900 uppercase">
                  INVOICE
                </h2>
                <img
                  src="/logo.png"
                  alt="Lilium & Loft Crochet Studio"
                  className="h-12 sm:h-14 w-auto object-contain max-w-[190px] sm:max-w-[215px]"
                />
              </div>

              <div className="hidden sm:block"></div>

              <div className="text-left text-xs leading-relaxed text-slate-600 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                <strong className="block text-slate-900 font-bold mb-1 text-[12.5px]">From</strong>
                Lilium and Loft Crochet Studio<br />
                45 (13), 2nd Cross, Venkata Nagar<br />
                605011<br />
                Pondicherry (Puducherry)<br />
                GSTIN: 34ABHPV4968N1ZQ
              </div>
            </div>

            {/* 3-Column Info (Bill to, Ship to, Meta) - Exactly matching PDF layout */}
            <div className="grid grid-cols-1 sm:grid-cols-[38%_30%_32%] gap-4 mb-6 sm:mb-8 text-xs leading-relaxed">
              <div className="pb-2 sm:pb-0 border-b sm:border-b-0 border-slate-100">
                <strong className="block text-slate-900 font-bold mb-1 text-[12.5px]">Bill to</strong>
                <p className="text-slate-800 font-medium">{billName}</p>
                {billAddr1 && <p className="text-slate-600">{billAddr1}</p>}
                {billAddr2 && <p className="text-slate-600">{billAddr2}</p>}
                {(billCity || billPostcode) && (
                  <p className="text-slate-600">{billCity} {billPostcode}</p>
                )}
                {billState && <p className="text-slate-600">{billState}</p>}
                {billPhone && <p className="text-slate-600 mt-0.5">{billPhone}</p>}
              </div>

              <div className="pb-2 sm:pb-0 border-b sm:border-b-0 border-slate-100">
                <strong className="block text-slate-900 font-bold mb-1 text-[12.5px]">Ship to</strong>
                <p className="text-slate-800 font-medium">{shipName}</p>
                {shipAddr1 && <p className="text-slate-600">{shipAddr1}</p>}
                {shipAddr2 && <p className="text-slate-600">{shipAddr2}</p>}
                {(shipCity || shipPostcode) && (
                  <p className="text-slate-600">{shipCity} {shipPostcode}</p>
                )}
                {shipState && <p className="text-slate-600">{shipState}</p>}
                {shipPhone && <p className="text-slate-600 mt-0.5">{shipPhone}</p>}
              </div>

              <div className="space-y-1 text-xs pt-1 sm:pt-0">
                <div className="flex gap-1.5 justify-between sm:justify-start">
                  <span className="font-bold text-slate-900 sm:min-w-[110px]">Invoice no:</span>
                  <span className="text-slate-700 font-medium">{invoiceNo}</span>
                </div>
                <div className="flex gap-1.5 justify-between sm:justify-start">
                  <span className="font-bold text-slate-900 sm:min-w-[110px]">Order date:</span>
                  <span className="text-slate-700">{orderDate}</span>
                </div>
                <div className="flex gap-1.5 justify-between sm:justify-start">
                  <span className="font-bold text-slate-900 sm:min-w-[110px]">Payment method:</span>
                  <span className="text-slate-700 capitalize">{paymentMethod}</span>
                </div>
              </div>
            </div>

            {/* GST Items Table */}
            <div className="overflow-x-auto mt-5 -mx-1 sm:mx-0">
              <table className="w-full border-collapse text-xs min-w-[600px] border border-slate-600">
                <thead>
                  <tr className="bg-white text-slate-900 font-bold">
                    <th rowSpan={2} className="border border-slate-600 py-2 px-2 text-center w-9">#</th>
                    <th rowSpan={2} className="border border-slate-600 py-2 px-2.5 text-left">Item &amp; Description</th>
                    <th rowSpan={2} className="border border-slate-600 py-2 px-2 text-right w-16">Qty</th>
                    <th rowSpan={2} className="border border-slate-600 py-2 px-2 text-right w-24">Rate</th>
                    <th colSpan={2} className="border border-slate-600 py-1.5 px-2 text-center">CGST</th>
                    <th colSpan={2} className="border border-slate-600 py-1.5 px-2 text-center">SGST</th>
                    <th rowSpan={2} className="border border-slate-600 py-2 px-2.5 text-right w-24">Amount</th>
                  </tr>
                  <tr className="bg-white text-slate-900 font-bold">
                    <th className="border border-slate-600 py-1 px-2 text-center w-12">%</th>
                    <th className="border border-slate-600 py-1 px-2 text-right w-20">Amt</th>
                    <th className="border border-slate-600 py-1 px-2 text-center w-12">%</th>
                    <th className="border border-slate-600 py-1 px-2 text-right w-20">Amt</th>
                  </tr>
                </thead>
                <tbody>
                  {calc.items.map((item, idx) => (
                    <tr key={idx} className="text-slate-800 bg-white">
                      <td className="border border-slate-600 py-2.5 px-2 text-center">{idx + 1}</td>
                      <td className="border border-slate-600 py-2.5 px-2.5 font-medium text-slate-900">{item.name}</td>
                      <td className="border border-slate-600 py-2.5 px-2 text-right">{item.qty.toFixed(2)}</td>
                      <td className="border border-slate-600 py-2.5 px-2 text-right">{formatPlainNumber(item.rate)}</td>
                      <td className="border border-slate-600 py-2.5 px-2 text-center">{item.cgstPct}%</td>
                      <td className="border border-slate-600 py-2.5 px-2 text-right">{formatPlainNumber(item.cgstAmt)}</td>
                      <td className="border border-slate-600 py-2.5 px-2 text-center">{item.sgstPct}%</td>
                      <td className="border border-slate-600 py-2.5 px-2 text-right">{formatPlainNumber(item.sgstAmt)}</td>
                      <td className="border border-slate-600 py-2.5 px-2.5 text-right font-medium text-slate-900">{formatPlainNumber(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Bottom section with stamp and totals */}
            <div className="mt-8 flex flex-col sm:flex-row justify-between items-center sm:items-start gap-6">
              {/* Slanted Stamp */}
              <div className="w-full sm:w-[55%] flex items-center justify-center py-6 select-none pointer-events-none">
                <div className="border-[3px] border-[#a87575] text-[#a87575] font-extrabold tracking-widest text-base sm:text-lg px-4 py-1.5 rounded-md -rotate-[45deg] opacity-85 uppercase bg-white/80">
                  {stampText}
                </div>
              </div>

              {/* Totals Table */}
              <div className="w-full sm:w-[42%] space-y-1.5 text-xs">
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Subtotal</span>
                  <span>{formatCurrency(calc.subtotal, order.currency)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>Shipping</span>
                  <span>
                    {calc.shipping > 0
                      ? formatCurrency(calc.shipping, order.currency)
                      : 'Free'}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>CGST (9%)</span>
                  <span>{formatCurrency(calc.totalCgst, order.currency)}</span>
                </div>
                <div className="flex justify-between py-1 text-slate-700">
                  <span>SGST (9%)</span>
                  <span>{formatCurrency(calc.totalSgst, order.currency)}</span>
                </div>
                {calc.discount > 0 && (
                  <div className="flex justify-between py-1 text-emerald-600">
                    <span>Discount</span>
                    <span>-{formatCurrency(calc.discount, order.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2.5 mt-1 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Total</span>
                  <span className="text-base text-slate-900">
                    {formatCurrency(calc.total, order.currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
