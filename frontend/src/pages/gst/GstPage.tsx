import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Search,
  Eye,
  Printer,
  Download,
  Loader2,
  CheckCircle2,
  Clock,
  Receipt,
  X,
} from 'lucide-react';
import { Order, OrderStatus } from '@/types';
import { useOrderStore, useUIStore } from '@/store';
import { formatCurrency, formatDate } from '@/utils/formatters';
import {
  downloadBulkInvoicesPDF,
  downloadInvoicePDF,
  getInvoiceNumber,
  printInvoice,
} from '@/utils/invoice';
import { InvoiceModal } from '@/components/orders/InvoiceModal';
import { toast } from 'sonner';

function getOrderStatusBadge(status: OrderStatus) {
  switch (status) {
    case 'completed':
      return <Badge variant="success">Delivered</Badge>;
    case 'processing':
      return <Badge variant="info">Order Placed</Badge>;
    case 'in-processing':
      return <Badge variant="info">Processing</Badge>;
    case 'dispatch':
      return <Badge variant="purple">Dispatched</Badge>;
    case 'out-for-delivery':
      return <Badge variant="warning">Out for Delivery</Badge>;
    case 'on-hold':
      return <Badge variant="warning">On-Hold</Badge>;
    case 'pending':
      return <Badge variant="outline">Pending</Badge>;
    case 'cancelled':
      return <Badge variant="destructive">Cancelled</Badge>;
    case 'refunded':
      return <Badge variant="secondary">Refunded</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export function GstPage() {
  const { orders } = useOrderStore();
  const { generatedInvoiceIds, generateInvoice, generateBulkInvoices } = useUIStore();

  const [beforeSearch, setBeforeSearch] = useState('');
  const [afterSearch, setAfterSearch] = useState('');
  const [selectedBeforeIds, setSelectedBeforeIds] = useState<string[]>([]);
  const [selectedAfterIds, setSelectedAfterIds] = useState<string[]>([]);
  const [bulkGenerating, setBulkGenerating] = useState(false);
  const [bulkDownloading, setBulkDownloading] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | number | null>(null);

  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);

  const generatedSet = useMemo(() => new Set(generatedInvoiceIds.map(String)), [generatedInvoiceIds]);

  const { beforeOrders, afterOrders } = useMemo(() => {
    const before: Order[] = [];
    const after: Order[] = [];
    for (const o of orders) {
      if (generatedSet.has(String(o.id))) {
        after.push(o);
      } else {
        before.push(o);
      }
    }
    return { beforeOrders: before, afterOrders: after };
  }, [orders, generatedSet]);

  const filteredBefore = useMemo(() => {
    const q = beforeSearch.trim().toLowerCase();
    if (!q) return beforeOrders;
    return beforeOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q)
    );
  }, [beforeOrders, beforeSearch]);

  const filteredAfter = useMemo(() => {
    const q = afterSearch.trim().toLowerCase();
    if (!q) return afterOrders;
    return afterOrders.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        getInvoiceNumber(o).toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.customerEmail.toLowerCase().includes(q)
    );
  }, [afterOrders, afterSearch]);

  const allBeforeSelected =
    filteredBefore.length > 0 && filteredBefore.every((o) => selectedBeforeIds.includes(String(o.id)));
  const allAfterSelected =
    filteredAfter.length > 0 && filteredAfter.every((o) => selectedAfterIds.includes(String(o.id)));

  const toggleSelectBeforeAll = () => {
    if (allBeforeSelected) {
      const visible = new Set(filteredBefore.map((o) => String(o.id)));
      setSelectedBeforeIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const merged = new Set([...selectedBeforeIds, ...filteredBefore.map((o) => String(o.id))]);
      setSelectedBeforeIds(Array.from(merged));
    }
  };

  const toggleSelectAfterAll = () => {
    if (allAfterSelected) {
      const visible = new Set(filteredAfter.map((o) => String(o.id)));
      setSelectedAfterIds((prev) => prev.filter((id) => !visible.has(id)));
    } else {
      const merged = new Set([...selectedAfterIds, ...filteredAfter.map((o) => String(o.id))]);
      setSelectedAfterIds(Array.from(merged));
    }
  };

  const toggleBeforeId = (id: string) => {
    setSelectedBeforeIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleAfterId = (id: string) => {
    setSelectedAfterIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleGenerateSingle = (order: Order) => {
    generateInvoice(order.id);
    setSelectedBeforeIds((prev) => prev.filter((id) => id !== String(order.id)));
    const invNo = getInvoiceNumber(order);
    toast.success(`Invoice ${invNo} generated for order #${order.orderNumber}`);
    setSelectedInvoiceOrder(order);
    setInvoiceModalOpen(true);
  };

  const handleBulkGenerate = async () => {
    const selectedOrders = beforeOrders.filter((o) => selectedBeforeIds.includes(String(o.id)));
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one order to generate GST invoices.');
      return;
    }

    try {
      setBulkGenerating(true);
      toast.loading(`Generating ${selectedOrders.length} GST invoices...`, {
        id: 'gst-bulk-generate',
      });

      generateBulkInvoices(selectedOrders.map((o) => o.id));
      const filename = `Lilium-Loft-GST-Invoices-${selectedOrders.length}-Orders.pdf`;
      await downloadBulkInvoicesPDF(selectedOrders, filename);

      setSelectedBeforeIds([]);
      toast.success(
        `Generated & downloaded ${selectedOrders.length} ${
          selectedOrders.length === 1 ? 'invoice' : 'invoices'
        }!`,
        { id: 'gst-bulk-generate' }
      );
    } catch (err) {
      console.error('Bulk GST invoice generation failed:', err);
      toast.error('Failed to generate bulk GST invoices', { id: 'gst-bulk-generate' });
    } finally {
      setBulkGenerating(false);
    }
  };

  const handleBulkDownloadGenerated = async () => {
    const selectedOrders = afterOrders.filter((o) => selectedAfterIds.includes(String(o.id)));
    if (selectedOrders.length === 0) {
      toast.error('Please select at least one generated invoice to download.');
      return;
    }

    try {
      setBulkDownloading(true);
      toast.loading(`Downloading ${selectedOrders.length} GST invoices...`, {
        id: 'gst-bulk-download',
      });
      const filename = `Lilium-Loft-GST-Invoices-${selectedOrders.length}-Orders.pdf`;
      await downloadBulkInvoicesPDF(selectedOrders, filename);
      toast.success(`Downloaded ${selectedOrders.length} invoices!`, {
        id: 'gst-bulk-download',
      });
    } catch (err) {
      console.error('Bulk download failed:', err);
      toast.error('Failed to download selected invoices', { id: 'gst-bulk-download' });
    } finally {
      setBulkDownloading(false);
    }
  };

  const handleOpenInvoice = (order: Order) => {
    setSelectedInvoiceOrder(order);
    setInvoiceModalOpen(true);
  };

  const handleDirectDownload = async (order: Order) => {
    try {
      setDownloadingOrderId(order.id);
      toast.loading(`Downloading invoice for order #${order.orderNumber}...`, {
        id: `gst-dl-${order.id}`,
      });
      await downloadInvoicePDF(order);
      toast.success(`Invoice for order #${order.orderNumber} downloaded!`, {
        id: `gst-dl-${order.id}`,
      });
    } catch (err) {
      console.error('Failed to download invoice:', err);
      toast.error('Failed to download invoice PDF', { id: `gst-dl-${order.id}` });
    } finally {
      setDownloadingOrderId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-red-50 text-red-600 flex items-center justify-center border border-red-100 shrink-0">
              <Receipt className="h-5 w-5" />
            </span>
            <span>GST Invoices</span>
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Select orders using checkboxes to generate bulk GST invoices, or view and download generated invoices.
          </p>
        </div>
      </div>

      {/* Two Column Split: Before Generate vs After Generate */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
        {/* Left Column: Before Generate Orders */}
        <Card className="border-slate-200/90 shadow-xs overflow-hidden">
          <CardHeader className="pb-3.5 bg-slate-50/60 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-amber-50 text-amber-600 border border-amber-100 flex items-center justify-center shrink-0">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-900">
                      Before Generate Orders
                    </CardTitle>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                      {beforeOrders.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Pending GST invoice generation</p>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleBulkGenerate}
                disabled={bulkGenerating || selectedBeforeIds.length === 0}
                className="gap-1.5 bg-red-600 hover:bg-red-700 text-white shadow-xs"
              >
                {bulkGenerating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                <span>
                  Bulk Generate{selectedBeforeIds.length > 0 ? ` (${selectedBeforeIds.length})` : ''}
                </span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0 select-none px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={allBeforeSelected}
                  onChange={toggleSelectBeforeAll}
                  className="h-4 w-4 rounded border-slate-300 accent-red-600 cursor-pointer"
                />
                <span>Select All</span>
              </label>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search order #, customer..."
                  value={beforeSearch}
                  onChange={(e) => setBeforeSearch(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-white"
                />
                {beforeSearch && (
                  <button
                    type="button"
                    onClick={() => setBeforeSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredBefore.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {beforeOrders.length === 0
                    ? 'All orders already have GST invoices generated'
                    : 'No orders match your search'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {beforeOrders.length === 0
                    ? 'New orders will appear here automatically.'
                    : 'Try clearing or changing your search query.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                {filteredBefore.map((order) => {
                  const isChecked = selectedBeforeIds.includes(String(order.id));
                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleBeforeId(String(order.id))}
                      className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-red-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleBeforeId(String(order.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-slate-300 accent-red-600 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              #{order.orderNumber}
                            </span>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          <div className="text-xs font-medium text-slate-700 truncate mt-1">
                            {order.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(order.dateCreated)} • {order.items.length}{' '}
                            {order.items.length === 1 ? 'item' : 'items'}
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-3 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span className="text-sm font-bold text-slate-900 tabular-nums">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleGenerateSingle(order)}
                          className="h-8 px-3 gap-1.5 text-xs bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>Generate</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right Column: After Generate Orders */}
        <Card className="border-slate-200/90 shadow-xs overflow-hidden">
          <CardHeader className="pb-3.5 bg-slate-50/60 border-b border-slate-100 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-bold text-slate-900">
                      After Generate Orders
                    </CardTitle>
                    <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                      {afterOrders.length}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">Generated GST tax invoices</p>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkDownloadGenerated}
                disabled={bulkDownloading || selectedAfterIds.length === 0}
                className="gap-1.5 bg-white border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs"
              >
                {bulkDownloading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span>
                  Bulk Download{selectedAfterIds.length > 0 ? ` (${selectedAfterIds.length})` : ''}
                </span>
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0 select-none px-2.5 py-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 transition-colors">
                <input
                  type="checkbox"
                  checked={allAfterSelected}
                  onChange={toggleSelectAfterAll}
                  className="h-4 w-4 rounded border-slate-300 accent-red-600 cursor-pointer"
                />
                <span>Select All</span>
              </label>

              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Search order #, invoice #, customer..."
                  value={afterSearch}
                  onChange={(e) => setAfterSearch(e.target.value)}
                  className="pl-9 pr-8 h-9 text-xs sm:text-sm bg-white"
                />
                {afterSearch && (
                  <button
                    type="button"
                    onClick={() => setAfterSearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredAfter.length === 0 ? (
              <div className="py-14 px-6 text-center">
                <div className="mx-auto h-11 w-11 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mb-3">
                  <Receipt className="h-5 w-5" />
                </div>
                <p className="text-sm font-medium text-slate-700">
                  {afterOrders.length === 0
                    ? 'No GST invoices generated yet'
                    : 'No generated invoices match your search'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {afterOrders.length === 0
                    ? 'Select orders from the left column to generate invoices.'
                    : 'Try clearing or changing your search query.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 max-h-[640px] overflow-y-auto">
                {filteredAfter.map((order) => {
                  const isChecked = selectedAfterIds.includes(String(order.id));
                  const invoiceNo = getInvoiceNumber(order);
                  return (
                    <div
                      key={order.id}
                      onClick={() => toggleAfterId(String(order.id))}
                      className={`p-3.5 sm:px-4 flex items-center justify-between gap-3 cursor-pointer transition-colors ${
                        isChecked ? 'bg-red-50/60' : 'hover:bg-slate-50/80'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleAfterId(String(order.id))}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-4 w-4 rounded border-slate-300 accent-red-600 cursor-pointer shrink-0"
                        />
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-sm text-slate-900">
                              #{order.orderNumber}
                            </span>
                            <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {invoiceNo}
                            </span>
                            {getOrderStatusBadge(order.status)}
                          </div>
                          <div className="text-xs font-medium text-slate-700 truncate mt-1">
                            {order.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {formatDate(order.dateCreated)} •{' '}
                            <span className="font-semibold text-slate-600">
                              {formatCurrency(order.total, order.currency)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div
                        className="flex items-center gap-1.5 shrink-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleOpenInvoice(order)}
                          className="h-8 w-8 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                          title="View Invoice"
                          aria-label="View Invoice"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => printInvoice(order)}
                          className="h-8 w-8 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                          title="Print Invoice"
                          aria-label="Print Invoice"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => handleDirectDownload(order)}
                          disabled={downloadingOrderId === order.id}
                          className="h-8 w-8 bg-white text-red-600 border-red-200 hover:text-red-700 hover:bg-red-50"
                          title="Download PDF"
                          aria-label="Download PDF"
                        >
                          {downloadingOrderId === order.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tax Invoice Preview Modal */}
      <InvoiceModal
        order={selectedInvoiceOrder}
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
      />
    </div>
  );
}
