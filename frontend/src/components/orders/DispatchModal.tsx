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
import { Truck, AlertCircle, Loader2 } from 'lucide-react';

interface DispatchModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderNumber: string;
  initialCourierName?: string;
  initialTrackingNumber?: string;
  onConfirm: (courierName: string, trackingNumber: string, shareWhatsApp: boolean) => Promise<void>;
}

export function DispatchModal({
  open,
  onOpenChange,
  orderNumber,
  initialCourierName = '',
  initialTrackingNumber = '',
  onConfirm,
}: DispatchModalProps) {
  const [courierName, setCourierName] = useState(initialCourierName);
  const [trackingNumber, setTrackingNumber] = useState(initialTrackingNumber);
  const [shareWhatsApp, setShareWhatsApp] = useState(true);
  const [errors, setErrors] = useState<{ courier?: string; tracking?: string }>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setCourierName(initialCourierName);
      setTrackingNumber(initialTrackingNumber);
      setShareWhatsApp(true);
      setErrors({});
    }
  }, [open, initialCourierName, initialTrackingNumber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nextErrors: { courier?: string; tracking?: string } = {};
    if (!courierName.trim()) nextErrors.courier = 'Courier name is required.';
    if (!trackingNumber.trim()) nextErrors.tracking = 'Tracking number is required.';
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    try {
      await onConfirm(courierName.trim(), trackingNumber.trim(), shareWhatsApp);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-base font-bold flex items-center gap-2 text-slate-900">
            <div className="h-8 w-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
              <Truck className="h-4 w-4" />
            </div>
            <span>Dispatch Order #{orderNumber}</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            Enter the courier partner and tracking number to mark this order as Dispatched.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2 text-xs">
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Courier Name <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. DTDC, BlueDart, Delhivery, India Post"
              value={courierName}
              onChange={(e) => {
                setCourierName(e.target.value);
                if (errors.courier) setErrors((prev) => ({ ...prev, courier: undefined }));
              }}
              className={errors.courier ? 'border-red-500 focus-visible:ring-red-500' : ''}
            />
            {errors.courier && (
              <p className="text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{errors.courier}</span>
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 block">
              Tracking Number <span className="text-red-500">*</span>
            </label>
            <Input
              placeholder="e.g. AWB123456789"
              value={trackingNumber}
              onChange={(e) => {
                setTrackingNumber(e.target.value);
                if (errors.tracking) setErrors((prev) => ({ ...prev, tracking: undefined }));
              }}
              className={`font-mono ${errors.tracking ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            />
            {errors.tracking && (
              <p className="text-[11px] text-red-600 flex items-center gap-1">
                <AlertCircle className="h-3 w-3 shrink-0" />
                <span>{errors.tracking}</span>
              </p>
            )}
          </div>

          <label className="flex items-center gap-2 pt-1 cursor-pointer select-none text-xs text-slate-700">
            <input
              type="checkbox"
              checked={shareWhatsApp}
              onChange={(e) => setShareWhatsApp(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-emerald-600 cursor-pointer"
            />
            <span>Share courier details &amp; customer invoice on WhatsApp</span>
          </label>

          <DialogFooter className="pt-2 border-t border-slate-100 gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={submitting}
              className="gap-1.5 bg-red-600 hover:bg-red-700 text-white"
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Truck className="h-3.5 w-3.5" />
              )}
              <span>Confirm Dispatch</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
