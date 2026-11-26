import React, { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Edit, Loader2, Copy } from 'lucide-react';
import { Order, OrderStatus } from '@/types';

interface EditOrderModalProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (orderId: string, payload: Record<string, unknown>) => Promise<void>;
}

export function EditOrderModal({
  order,
  open,
  onOpenChange,
  onSave,
}: EditOrderModalProps) {
  const [status, setStatus] = useState<OrderStatus>('processing');
  const [courierName, setCourierName] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [paymentMethodTitle, setPaymentMethodTitle] = useState('');
  const [transactionId, setTransactionId] = useState('');

  const [billFirstName, setBillFirstName] = useState('');
  const [billLastName, setBillLastName] = useState('');
  const [billEmail, setBillEmail] = useState('');
  const [billPhone, setBillPhone] = useState('');
  const [billAddr1, setBillAddr1] = useState('');
  const [billAddr2, setBillAddr2] = useState('');
  const [billCity, setBillCity] = useState('');
  const [billState, setBillState] = useState('');
  const [billPostcode, setBillPostcode] = useState('');
  const [billCountry, setBillCountry] = useState('IN');

  const [shipFirstName, setShipFirstName] = useState('');
  const [shipLastName, setShipLastName] = useState('');
  const [shipPhone, setShipPhone] = useState('');
  const [shipAddr1, setShipAddr1] = useState('');
  const [shipAddr2, setShipAddr2] = useState('');
  const [shipCity, setShipCity] = useState('');
  const [shipState, setShipState] = useState('');
  const [shipPostcode, setShipPostcode] = useState('');
  const [shipCountry, setShipCountry] = useState('IN');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && order) {
      setStatus(order.status);
      setCourierName(order.courierName || '');
      setTrackingNumber(order.trackingNumber || '');
      setCustomerNote(order.customerNote || '');
      setPaymentMethodTitle(order.paymentMethodTitle || '');
      setTransactionId(order.transactionId || '');

      setBillFirstName(order.billing?.firstName || '');
      setBillLastName(order.billing?.lastName || '');
      setBillEmail(order.billing?.email || order.customerEmail || '');
      setBillPhone(order.billing?.phone || '');
      setBillAddr1(order.billing?.address1 || '');
      setBillAddr2(order.billing?.address2 || '');
      setBillCity(order.billing?.city || '');
      setBillState(order.billing?.state || '');
      setBillPostcode(order.billing?.postcode || '');
      setBillCountry(order.billing?.country || 'IN');

      setShipFirstName(order.shipping?.firstName || '');
      setShipLastName(order.shipping?.lastName || '');
      setShipPhone(order.shipping?.phone || '');
      setShipAddr1(order.shipping?.address1 || '');
      setShipAddr2(order.shipping?.address2 || '');
      setShipCity(order.shipping?.city || '');
      setShipState(order.shipping?.state || '');
      setShipPostcode(order.shipping?.postcode || '');
      setShipCountry(order.shipping?.country || 'IN');
    }
  }, [open, order]);

  if (!order) return null;

  const copyBillingToShipping = () => {
    setShipFirstName(billFirstName);
    setShipLastName(billLastName);
    setShipPhone(billPhone);
    setShipAddr1(billAddr1);
    setShipAddr2(billAddr2);
    setShipCity(billCity);
    setShipState(billState);
    setShipPostcode(billPostcode);
    setShipCountry(billCountry);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave(order.id, {
        status,
        courier_name: status === 'dispatch' ? courierName.trim() : undefined,
        tracking_number: status === 'dispatch' ? trackingNumber.trim() : undefined,
        customer_note: customerNote,
        payment_method_title: paymentMethodTitle,
        transaction_id: transactionId,
        billing: {
          first_name: billFirstName,
          last_name: billLastName,
          email: billEmail,
          phone: billPhone,
          address_1: billAddr1,
          address_2: billAddr2,
          city: billCity,
          state: billState,
          postcode: billPostcode,
          country: billCountry,
        },
        shipping: {
          first_name: shipFirstName,
          last_name: shipLastName,
          phone: shipPhone,
          address_1: shipAddr1,
          address_2: shipAddr2,
          city: shipCity,
          state: shipState,
          postcode: shipPostcode,
          country: shipCountry,
        },
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-5 pb-3 border-b border-slate-100 shrink-0">
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="h-8 w-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
              <Edit className="h-4 w-4" />
            </div>
            <span>Edit Order #{order.orderNumber}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Update order status, billing &amp; shipping details, payment info, and customer note directly on WooCommerce.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          {/* General / Status / Payment */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              General &amp; Payment
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="font-medium text-slate-700">Order Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as OrderStatus)}>
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending Payment</SelectItem>
                    <SelectItem value="processing">Order Placed</SelectItem>
                    <SelectItem value="in-processing">Processing</SelectItem>
                    <SelectItem value="dispatch">Dispatched</SelectItem>
                    <SelectItem value="out-for-delivery">Out for Delivery</SelectItem>
                    <SelectItem value="on-hold">On Hold</SelectItem>
                    <SelectItem value="completed">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="refunded">Refunded</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-700">Payment Method</label>
                <Input
                  value={paymentMethodTitle}
                  onChange={(e) => setPaymentMethodTitle(e.target.value)}
                  className="h-9 text-xs"
                  placeholder="e.g. PhonePe, COD"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium text-slate-700">Transaction ID</label>
                <Input
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  className="h-9 text-xs font-mono"
                  placeholder="Optional transaction id"
                />
              </div>
            </div>

            {status === 'dispatch' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-lg bg-indigo-50/50 border border-indigo-100">
                <div className="space-y-1">
                  <label className="font-medium text-slate-700">Courier Name</label>
                  <Input
                    value={courierName}
                    onChange={(e) => setCourierName(e.target.value)}
                    className="h-9 text-xs bg-white"
                    placeholder="e.g. DTDC, BlueDart"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-medium text-slate-700">Tracking Number</label>
                  <Input
                    value={trackingNumber}
                    onChange={(e) => setTrackingNumber(e.target.value)}
                    className="h-9 text-xs font-mono bg-white"
                    placeholder="AWB / Tracking #"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1">
              <label className="font-medium text-slate-700">Customer Note</label>
              <Textarea
                rows={2}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                className="text-xs"
                placeholder="Customer provided note..."
              />
            </div>
          </div>

          {/* Billing & Shipping */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-slate-100">
            {/* Billing */}
            <div className="space-y-2.5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Billing Details
              </h4>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First Name"
                  value={billFirstName}
                  onChange={(e) => setBillFirstName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Last Name"
                  value={billLastName}
                  onChange={(e) => setBillLastName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="Email"
                  type="email"
                  value={billEmail}
                  onChange={(e) => setBillEmail(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Phone"
                  value={billPhone}
                  onChange={(e) => setBillPhone(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Input
                placeholder="Address Line 1"
                value={billAddr1}
                onChange={(e) => setBillAddr1(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Address Line 2"
                value={billAddr2}
                onChange={(e) => setBillAddr2(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="City"
                  value={billCity}
                  onChange={(e) => setBillCity(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="State"
                  value={billState}
                  onChange={(e) => setBillState(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Postcode"
                  value={billPostcode}
                  onChange={(e) => setBillPostcode(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Shipping */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Shipping Details
                </h4>
                <button
                  type="button"
                  onClick={copyBillingToShipping}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-red-600 hover:text-red-700"
                >
                  <Copy className="h-3 w-3" />
                  <span>Copy Billing</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  placeholder="First Name"
                  value={shipFirstName}
                  onChange={(e) => setShipFirstName(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Last Name"
                  value={shipLastName}
                  onChange={(e) => setShipLastName(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <Input
                placeholder="Shipping Phone"
                value={shipPhone}
                onChange={(e) => setShipPhone(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Address Line 1"
                value={shipAddr1}
                onChange={(e) => setShipAddr1(e.target.value)}
                className="h-8 text-xs"
              />
              <Input
                placeholder="Address Line 2"
                value={shipAddr2}
                onChange={(e) => setShipAddr2(e.target.value)}
                className="h-8 text-xs"
              />
              <div className="grid grid-cols-3 gap-2">
                <Input
                  placeholder="City"
                  value={shipCity}
                  onChange={(e) => setShipCity(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="State"
                  value={shipState}
                  onChange={(e) => setShipState(e.target.value)}
                  className="h-8 text-xs"
                />
                <Input
                  placeholder="Postcode"
                  value={shipPostcode}
                  onChange={(e) => setShipPostcode(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="pt-3 border-t border-slate-100 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={saving}
              className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Save Changes</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
