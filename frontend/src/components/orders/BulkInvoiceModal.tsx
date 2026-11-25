import React, { useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Download, FileText, Loader2, CheckCircle2 } from 'lucide-react';
import { Order } from '@/types';
import { useUIStore } from '@/store';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { downloadBulkInvoicesPDF, getInvoiceNumber } from '@/utils/invoice';
import { toast } from 'sonner';

interface BulkInvoiceModalProps {
  orders: Order[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getTodayDateInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function BulkInvoiceModal({
  orders,
  open,
  onOpenChange,
}: BulkInvoiceModalProps) {
  const { generatedInvoiceIds, generateBulkInvoices } = useUIStore();
  const [fromDate, setFromDate] = useState<string>(getTodayDateInput());
  const [toDate, setToDate] = useState<string>(getTodayDateInput());
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isProcessing, setIsProcessing] = useState(false);

  const matchingOrders = useMemo(() => {
    const effectiveFrom = fromDate || toDate;
    const effectiveTo = toDate || fromDate;

    return orders.filter((o) => {
      const orderTime = new Date(o.dateCreated).getTime();
      if (isNaN(orderTime)) return false;

      if (effectiveFrom) {
        const start = new Date(`${effectiveFrom}T00:00:00`).getTime();
        if (orderTime < start) return false;
      }
      if (effectiveTo) {
        const end = new Date(`${effectiveTo}T23:59:59.999`).getTime();
        if (orderTime > end) return false;
      }

      if (statusFilter === 'paid') {
        return o.status === 'processing' || o.status === 'completed' || o.status === 'dispatch';
      }
      if (statusFilter !== 'all') {
        return o.status === statusFilter;
      }
      return true;
    });
  }, [orders, fromDate, toDate, statusFilter]);

  const handleBulkGenerateAndDownload = async () => {
    if (matchingOrders.length === 0) {
      toast.error('No orders found for the selected date.');
      return;
    }

    try {
      setIsProcessing(true);
      toast.loading(`Generating & downloading ${matchingOrders.length} invoices...`, {
        id: 'bulk-invoice-download',
      });

      generateBulkInvoices(matchingOrders.map((o) => o.id));

      const effectiveFrom = fromDate || toDate;
      const effectiveTo = toDate || fromDate;
      const dateLabel =
        effectiveFrom === effectiveTo
          ? effectiveFrom
          : `${effectiveFrom || 'start'}_to_${effectiveTo || 'end'}`;
      const filename = `Lilium-Loft-Invoices-${dateLabel}.pdf`;

      await downloadBulkInvoicesPDF(matchingOrders, filename);

      toast.success(
        `Generated & downloaded ${matchingOrders.length} ${
          matchingOrders.length === 1 ? 'invoice' : 'invoices'
        }!`,
        { id: 'bulk-invoice-download' }
      );
      onOpenChange(false);
    } catch (err) {
      console.error('Bulk invoice download error:', err);
      toast.error('Failed to generate bulk invoices PDF', {
        id: 'bulk-invoice-download',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[88vh] flex flex-col p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                Bulk Date-wise Invoice Generator
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Pick a single date (same From & To) or a date range to generate & download all invoices.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-2 overflow-y-auto flex-1">
          {/* From Date, To Date & Status Filter */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>From Date</span>
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 text-xs bg-slate-50/70"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-slate-500" />
                <span>To Date</span>
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 text-xs bg-slate-50/70"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 block">
              Order Status
            </label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-50/70 h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Order Placed + Completed</SelectItem>
                <SelectItem value="processing">Order Placed Only</SelectItem>
                <SelectItem value="dispatch">Dispatched Only</SelectItem>
                <SelectItem value="completed">Completed Only</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Summary & Preview List */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-800">
                Matching Orders ({matchingOrders.length})
              </span>
              {matchingOrders.length > 0 && (
                <span className="text-slate-600 font-medium">
                  Total:{' '}
                  <strong className="text-slate-900">
                    {formatCurrency(
                      matchingOrders.reduce((sum, o) => sum + o.total, 0),
                      matchingOrders[0]?.currency
                    )}
                  </strong>
                </span>
              )}
            </div>

            {matchingOrders.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No orders found for the selected date criteria.
              </div>
            ) : (
              <div className="max-h-56 overflow-y-auto divide-y divide-slate-100 bg-white">
                {matchingOrders.map((order) => {
                  const isGenerated = generatedInvoiceIds.includes(String(order.id));
                  return (
                    <div
                      key={order.id}
                      className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">
                            #{order.orderNumber}
                          </span>
                          <span className="text-slate-600 truncate">
                            {order.customerName}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                          <span>{formatDate(order.dateCreated)}</span>
                          <span>•</span>
                          <span>{getInvoiceNumber(order)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isGenerated ? (
                          <Badge variant="success" className="text-[10px] gap-1">
                            <CheckCircle2 className="h-3 w-3" />
                            Generated
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">
                            Ready
                          </Badge>
                        )}
                        <span className="font-bold text-slate-900">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="pt-3 border-t border-slate-100 gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleBulkGenerateAndDownload}
            disabled={isProcessing || matchingOrders.length === 0}
            className="gap-1.5 text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            {isProcessing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" />
            )}
            <span>
              Generate & Download ({matchingOrders.length})
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
