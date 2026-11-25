import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ExternalLink,
  FileText,
  Package,
  User,
  MapPin,
  CreditCard,
  Calendar,
  Truck,
} from 'lucide-react';
import { Order } from '@/types';
import { formatCurrency, formatDateTime } from '@/utils/formatters';
import { useProductStore, useUIStore } from '@/store';

interface OrderDetailModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onViewInvoice?: (order: Order) => void;
}

export function OrderDetailModal({
  order,
  open,
  onOpenChange,
  onViewInvoice,
}: OrderDetailModalProps) {
  const navigate = useNavigate();
  const products = useProductStore((s) => s.products);
  const { generatedInvoiceIds, generateInvoice } = useUIStore();

  if (!order) return null;

  const isGenerated = generatedInvoiceIds.includes(String(order.id));

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'processing':
        return <Badge variant="info">Order Placed</Badge>;
      case 'dispatch':
        return <Badge variant="purple">Dispatched</Badge>;
      case 'on-hold':
        return <Badge variant="warning">On-Hold</Badge>;
      case 'pending':
        return <Badge variant="outline">Pending</Badge>;
      case 'refunded':
        return <Badge variant="secondary">Refunded</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  const getProductImage = (item: any) => {
    if (item.image) return item.image;
    const match = products.find(
      (p) =>
        (item.productId && (String(p.id) === String(item.productId) || String(p.wooId) === String(item.productId))) ||
        (item.sku && p.sku && String(p.sku).trim() === String(item.sku).trim()) ||
        (item.name && p.name && p.name.trim().toLowerCase() === item.name.trim().toLowerCase())
    );
    return (
      match?.images?.[0]?.src ||
      (match as any)?.image_url ||
      (match as any)?.imageUrl
    );
  };

  const billName = `${order.billing?.firstName || ''} ${order.billing?.lastName || ''}`.trim() || order.customerName || '—';
  const billAddress = [
    order.billing?.address1,
    order.billing?.address2,
    order.billing?.city,
    order.billing?.state,
    order.billing?.postcode,
  ].filter(Boolean).join(', ');

  const shipName = `${order.shipping?.firstName || ''} ${order.shipping?.lastName || ''}`.trim() || billName;
  const shipAddress = [
    order.shipping?.address1,
    order.shipping?.address2,
    order.shipping?.city,
    order.shipping?.state,
    order.shipping?.postcode,
  ].filter(Boolean).join(', ') || billAddress;

  const subtotal = order.items.reduce((acc, item) => acc + (item.total || item.price * item.quantity), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2.5">
              <div>
                <DialogTitle className="text-lg font-bold text-slate-900">
                  Order #{order.orderNumber}
                </DialogTitle>
                <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                  <Calendar className="h-3 w-3" />
                  <span>{formatDateTime(order.dateCreated)}</span>
                </div>
              </div>
            </div>
            <div>{getStatusBadge(order.status)}</div>
          </div>
        </DialogHeader>

        {/* Customer & Shipping Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>Customer</span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{order.customerName || 'Guest'}</p>
            <p className="text-xs text-slate-600">{order.customerEmail || 'No email provided'}</p>
            {order.billing?.phone && (
              <p className="text-xs text-slate-500">{order.billing.phone}</p>
            )}
          </div>

          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              <span>Shipping To</span>
            </div>
            <p className="text-sm font-semibold text-slate-900">{shipName}</p>
            <p className="text-xs text-slate-600 line-clamp-2">{shipAddress || 'No address provided'}</p>
          </div>
        </div>

        {/* Ordered Items */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Ordered Items ({order.items.length})
          </h4>
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
            {order.items.map((item, idx) => {
              const img = getProductImage(item);
              const price = item.price || (item.quantity > 0 ? item.total / item.quantity : 0);
              const total = item.total || price * item.quantity;
              return (
                <div key={idx} className="p-2.5 flex items-center justify-between gap-3 bg-white hover:bg-slate-50/50">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                      {img ? (
                        <img src={img} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        <Package className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 truncate">{item.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Qty: <strong className="text-slate-800">{item.quantity}</strong> × {formatCurrency(price, order.currency)}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-900">
                      {formatCurrency(total, order.currency)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Payment & Totals */}
        <div className="bg-slate-50/70 p-3.5 rounded-xl border border-slate-100 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal, order.currency)}</span>
          </div>
          {order.shippingTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Shipping</span>
              <span>{formatCurrency(order.shippingTotal, order.currency)}</span>
            </div>
          )}
          {order.discountTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-emerald-600">
              <span>Discount</span>
              <span>-{formatCurrency(order.discountTotal, order.currency)}</span>
            </div>
          )}
          {order.taxTotal > 0 && (
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span>Tax</span>
              <span>{formatCurrency(order.taxTotal, order.currency)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-slate-600">
              <CreditCard className="h-3.5 w-3.5 text-slate-500" />
              <span className="capitalize">{order.paymentMethodTitle || order.paymentMethod || 'PhonePe'}</span>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 mr-2">Total</span>
              <span className="text-base font-bold text-slate-900">
                {formatCurrency(order.total, order.currency)}
              </span>
            </div>
          </div>
        </div>

        {(order.courierName || order.trackingNumber) && (
          <div className="bg-indigo-50/50 p-3.5 rounded-xl border border-indigo-100 space-y-1.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-950">
              <Truck className="h-3.5 w-3.5 text-indigo-600" />
              <span>Dispatch & Tracking</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {order.courierName && (
                <div>
                  <span className="text-slate-500">Courier: </span>
                  <span className="font-semibold text-slate-900">{order.courierName}</span>
                </div>
              )}
              {order.trackingNumber && (
                <div>
                  <span className="text-slate-500">Tracking: </span>
                  <span className="font-mono font-semibold text-slate-900">{order.trackingNumber}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div>
            {onViewInvoice && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!isGenerated) {
                    generateInvoice(order.id);
                  }
                  onOpenChange(false);
                  onViewInvoice(order);
                }}
                className="gap-1.5 text-xs text-slate-700 bg-white"
              >
                <FileText className="h-3.5 w-3.5 text-red-600" />
                <span>{isGenerated ? 'View Invoice' : 'Generate Invoice'}</span>
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/orders/${order.id}`);
              }}
              className="gap-1 text-xs bg-red-600 hover:bg-red-700 text-white"
            >
              <span>Full Details</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
