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
  User,
  Mail,
  Phone,
  Calendar,
  ShoppingBag,
  MapPin,
  ExternalLink,
} from 'lucide-react';
import { Customer } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { initials } from '@/utils/initials';
import { useOrderStore } from '@/store';

interface CustomerDetailModalProps {
  customer: Customer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CustomerDetailModal({
  customer,
  open,
  onOpenChange,
}: CustomerDetailModalProps) {
  const navigate = useNavigate();
  const orders = useOrderStore((s) => s.orders);

  if (!customer) return null;

  const customerOrders = orders.filter(
    (o) =>
      (customer.wooId > 0 && o.customerId === String(customer.wooId)) ||
      (!!customer.email && o.customerEmail?.toLowerCase() === customer.email.toLowerCase())
  );

  const fullName = `${customer.firstName || ''} ${customer.lastName || ''}`.trim() || customer.username || 'Customer';

  const billingAddr = [
    customer.billing?.address1,
    customer.billing?.address2,
    customer.billing?.city,
    customer.billing?.state,
    customer.billing?.postcode,
  ].filter(Boolean).join(', ');

  const shippingAddr = [
    customer.shipping?.address1,
    customer.shipping?.address2,
    customer.shipping?.city,
    customer.shipping?.state,
    customer.shipping?.postcode,
  ].filter(Boolean).join(', ');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex items-center gap-3 pr-6">
            <div className="h-12 w-12 rounded-full bg-red-100 text-red-700 flex items-center justify-center font-bold text-base shrink-0">
              {initials(customer.firstName, customer.lastName)}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {fullName}
              </DialogTitle>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-slate-500">@{customer.username}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {customer.role || 'Customer'}
                </Badge>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Contact Info & Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-1">
          <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 space-y-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700">
              <Mail className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{customer.email || 'No email provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-700">
              <Phone className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>{customer.billing?.phone || customer.shipping?.phone || 'No phone provided'}</span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span>Registered {formatDate(customer.registeredDate)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 bg-red-50/60 rounded-xl border border-red-100 flex flex-col justify-center">
              <span className="text-[11px] text-red-600 font-medium">Total Orders</span>
              <span className="text-xl font-bold text-slate-900 mt-0.5">
                {customer.totalOrders || customerOrders.length || 0}
              </span>
            </div>
            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-100 flex flex-col justify-center">
              <span className="text-[11px] text-slate-500 font-medium">Total Spent</span>
              <span className="text-base font-bold text-slate-900 mt-0.5">
                {formatCurrency(customer.totalSpent || 0)}
              </span>
            </div>
          </div>
        </div>

        {/* Addresses */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              <span>Billing Address</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {billingAddr || 'No billing address provided.'}
            </p>
          </div>

          <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800 mb-1">
              <MapPin className="h-3.5 w-3.5 text-slate-500" />
              <span>Shipping Address</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              {shippingAddr || billingAddr || 'No shipping address provided.'}
            </p>
          </div>
        </div>

        {/* Recent Orders Preview */}
        {customerOrders.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span className="flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-slate-500" />
                <span>Orders ({customerOrders.length})</span>
              </span>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 max-h-36 overflow-y-auto">
              {customerOrders.slice(0, 5).map((o) => (
                <div key={o.id} className="p-2.5 flex items-center justify-between text-xs bg-white">
                  <div>
                    <span className="font-bold text-slate-900">#{o.orderNumber}</span>
                    <span className="text-slate-400 ml-2">{formatDate(o.dateCreated)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="capitalize px-1.5 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 font-medium">
                      {o.status}
                    </span>
                    <span className="font-bold text-slate-900">{formatCurrency(o.total, o.currency)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
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
              navigate(`/customers/${customer.id}`);
            }}
            className="gap-1 text-xs bg-red-600 hover:bg-red-700 text-white"
          >
            <span>Full Profile</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
