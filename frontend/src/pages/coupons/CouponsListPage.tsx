import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  TicketPercent,
  Plus,
  Search,
  Calendar,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Copy,
  Filter,
  RotateCcw,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FilterModal } from '@/components/ui/filter-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useCouponStore } from '@/store';
import { Coupon, CouponDiscountType } from '@/types';
import { couponSchema, CouponFormValues } from '@/schemas';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { getErrorMessage } from '@/utils/errors';
import { useCurrencyLabel } from '@/hooks/useCurrencySymbol';
import { toast } from 'sonner';

export function CouponsListPage() {
  const currencyLabel = useCurrencyLabel();
  const { coupons, fetchCoupons, createCoupon, updateCoupon, deleteCoupon } = useCouponStore();

  useEffect(() => {
    if (coupons.length === 0) {
      fetchCoupons();
    }
  }, [fetchCoupons, coupons.length]);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponToDelete, setCouponToDelete] = useState<Coupon | null>(null);

  const hasActiveFilters = Boolean(searchTerm.trim() || selectedType !== 'all');
  const activeFilterCount = (selectedType !== 'all' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedType('all');
  };

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponSchema),
    mode: 'onChange',
    defaultValues: {
      code: '',
      discountType: 'percent',
      amount: 10,
      description: '',
      expiryDate: '',
      usageLimit: undefined,
      individualUse: false,
      minimumAmount: undefined,
      maximumAmount: undefined,
      excludeSaleItems: false,
    },
  });

  const openCreateModal = () => {
    setEditingCoupon(null);
    reset({
      code: '',
      discountType: 'percent',
      amount: 10,
      description: '',
      expiryDate: '',
      usageLimit: undefined,
      individualUse: false,
      minimumAmount: undefined,
      maximumAmount: undefined,
      excludeSaleItems: false,
    });
    setModalOpen(true);
  };

  const openEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    reset({
      code: coupon.code,
      discountType: coupon.discountType,
      amount: coupon.amount,
      description: coupon.description,
      expiryDate: coupon.expiryDate ? coupon.expiryDate.slice(0, 10) : '',
      usageLimit: coupon.usageLimit,
      individualUse: coupon.individualUse,
      minimumAmount: coupon.minimumAmount,
      maximumAmount: coupon.maximumAmount,
      excludeSaleItems: coupon.excludeSaleItems,
    });
    setModalOpen(true);
  };

  const onSubmit = async (data: CouponFormValues) => {
    try {
      if (editingCoupon) {
        await updateCoupon(editingCoupon.id, data);
        toast.success(`Coupon "${data.code}" updated.`);
      } else {
        await createCoupon(data);
        toast.success(`Coupon "${data.code}" created.`);
      }
      setModalOpen(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleDelete = async () => {
    if (!couponToDelete) return;
    try {
      await deleteCoupon(couponToDelete.id);
      toast.success(`Coupon "${couponToDelete.code}" moved to the trash.`);
      setCouponToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Coupon code "${code}" copied to clipboard!`);
  };

  const filteredCoupons = coupons.filter((c) => {
    const matchesSearch =
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = selectedType === 'all' || c.discountType === selectedType;
    return matchesSearch && matchesType;
  });

  const formatDiscount = (type: CouponDiscountType, amount: number) => {
    if (type === 'percent') return `${amount}% Off`;
    return `${formatCurrency(amount)} Off`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Coupons & Discounts
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configure promotional promo codes, cart discounts, and usage limits.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={openCreateModal}
            size="sm"
            className="flex-1 sm:flex-none gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Create Coupon</span>
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Mobile & Tablet: Search + Filter button + Clear button */}
          <div className="flex sm:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search coupons..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 bg-slate-50/50 text-xs sm:text-sm h-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant={activeFilterCount > 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterModalOpen(true)}
              className={`h-9 px-3 gap-1.5 shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                title="Clear all filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Desktop & Tablet View: Search + Discount Type Filter */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search coupons by code or campaign description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-8 bg-slate-50/50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="w-56 flex items-center gap-2">
              <Select
                value={selectedType}
                onValueChange={(val) => setSelectedType(val)}
              >
                <SelectTrigger className="bg-slate-50/50 flex-1">
                  <SelectValue placeholder="Discount Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Discount Types</SelectItem>
                  <SelectItem value="percent">Percentage (%)</SelectItem>
                  <SelectItem value="fixed_cart">Fixed Cart Amount</SelectItem>
                  <SelectItem value="fixed_product">Fixed Product Amount</SelectItem>
                </SelectContent>
              </Select>

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-10 px-3 text-xs text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 shrink-0 gap-1"
                  title="Clear all filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile/Tablet Filter Modal */}
      <FilterModal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        title="Filter Coupons"
        activeCount={activeFilterCount}
        onClear={handleClearFilters}
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by coupon code or note..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Discount Type</label>
            <Select
              value={selectedType}
              onValueChange={(val) => setSelectedType(val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Discount Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Discount Types</SelectItem>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed_cart">Fixed Cart Amount</SelectItem>
                <SelectItem value="fixed_product">Fixed Product Amount</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterModal>

      {/* Coupons Table */}
      <Card>
        <CardContent className="p-0">
          {filteredCoupons.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={TicketPercent}
                title="No promotional coupons found"
                description="Create promotional codes to incentivize repeat checkout transactions."
                actionLabel="Create First Coupon"
                onAction={openCreateModal}
              />
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card View (< lg) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-slate-50/40">
                {filteredCoupons.map((coupon) => (
                  <div
                    key={coupon.id}
                    className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:border-slate-300 transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCopyCode(coupon.code)}
                        className="group flex items-center gap-1.5 font-mono font-bold text-sm bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-md hover:bg-red-100 transition-colors"
                        title="Click to copy code"
                      >
                        <span>{coupon.code}</span>
                        <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                      </button>
                      {coupon.status === 'active' ? (
                        <Badge variant="success">Active</Badge>
                      ) : coupon.status === 'expired' ? (
                        <Badge variant="outline">Expired</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="font-bold text-slate-900 text-sm">
                          {formatDiscount(coupon.discountType, coupon.amount)}
                        </div>
                        <span className="text-[11px] text-slate-400 capitalize block">
                          {coupon.discountType.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="text-right text-xs">
                        <span className="text-slate-500 font-medium">{coupon.usageCount}</span>
                        <span className="text-slate-400"> / {coupon.usageLimit ? coupon.usageLimit : '∞'} used</span>
                      </div>
                    </div>

                    {coupon.description && (
                      <p className="text-xs text-slate-600 line-clamp-2 bg-slate-50 p-2 rounded-md">
                        {coupon.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
                      <span className="text-slate-400 text-[11px]">
                        {coupon.expiryDate ? `Expires: ${formatDate(coupon.expiryDate)}` : 'Never expires'}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditModal(coupon)}
                          className="h-7 px-2 text-xs text-slate-600 hover:text-slate-900"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" />
                          <span>Edit</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setCouponToDelete(coupon)}
                          className="h-7 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          <span>Delete</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (lg and above) */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Coupon Code</TableHead>
                      <TableHead>Discount</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Usage / Limit</TableHead>
                      <TableHead>Expiry Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCoupons.map((coupon) => (
                      <TableRow
                        key={coupon.id}
                        onClick={() => openEditModal(coupon)}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <TableCell>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyCode(coupon.code);
                            }}
                            className="group flex items-center gap-1.5 font-mono font-bold text-sm bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-md hover:bg-red-100 transition-colors"
                            title="Click to copy code"
                          >
                            <span>{coupon.code}</span>
                            <Copy className="h-3 w-3 opacity-50 group-hover:opacity-100" />
                          </button>
                        </TableCell>

                        <TableCell className="font-semibold text-slate-900">
                          {formatDiscount(coupon.discountType, coupon.amount)}
                          <span className="block text-[11px] font-normal text-slate-400 capitalize">
                            {coupon.discountType.replace('_', ' ')}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-slate-600 max-w-xs">
                          {coupon.description}
                        </TableCell>

                        <TableCell className="text-xs">
                          <span className="font-medium text-slate-800">
                            {coupon.usageCount}
                          </span>
                          <span className="text-slate-400">
                            {' '}
                            / {coupon.usageLimit ? coupon.usageLimit : '∞'}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-slate-500">
                          {coupon.expiryDate ? formatDate(coupon.expiryDate) : 'Never expires'}
                        </TableCell>

                        <TableCell>
                          {coupon.status === 'active' ? (
                            <Badge variant="success">Active</Badge>
                          ) : coupon.status === 'expired' ? (
                            <Badge variant="outline">Expired</Badge>
                          ) : (
                            <Badge variant="secondary">Draft</Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-right space-x-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditModal(coupon)}
                            className="h-8 w-8 text-slate-500 hover:text-slate-900"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setCouponToDelete(coupon)}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Coupon Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              {editingCoupon ? `Edit Coupon: ${editingCoupon.code}` : 'Create New Coupon'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Configure discount mechanics, minimum spending requirements, and restrictions.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2 text-xs">
            {/* Code */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">
                Coupon Code <span className="text-red-500">*</span>
              </label>
              <Input
                placeholder="e.g. SUMMER25, FLASH50"
                {...register('code')}
                className={`font-mono uppercase font-bold ${errors.code ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              />
              {errors.code && (
                <p className="text-red-600 text-[11px] font-medium mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{errors.code.message}</span>
                </p>
              )}
            </div>

            {/* Type & Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Discount Type</label>
                <Select
                  value={watch('discountType')}
                  onValueChange={(val: any) => setValue('discountType', val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percentage discount (%)</SelectItem>
                    <SelectItem value="fixed_cart">Fixed cart discount{currencyLabel}</SelectItem>
                    <SelectItem value="fixed_product">Fixed product discount{currencyLabel}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">
                  Coupon Amount <span className="text-red-500">*</span>
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="10"
                  {...register('amount')}
                  className={errors.amount ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {errors.amount && (
                  <p className="text-red-600 text-[11px] font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{errors.amount.message}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">
                Description
              </label>
              <Input
                placeholder="Internal memo or customer promotional tooltip"
                {...register('description')}
              />
              {errors.description && (
                <p className="text-red-600 text-[11px]">{errors.description.message}</p>
              )}
            </div>

            {/* Expiry & Usage limit */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Expiry Date</label>
                <Input type="date" {...register('expiryDate')} />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Usage Limit</label>
                <Input
                  type="number"
                  placeholder="Unlimited if empty"
                  {...register('usageLimit')}
                />
              </div>
            </div>

            {/* Restrictions */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Minimum Spend{currencyLabel}</label>
                <Input
                  type="number"
                  placeholder="0.00"
                  {...register('minimumAmount')}
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">Maximum Spend{currencyLabel}</label>
                <Input
                  type="number"
                  placeholder="No limit"
                  {...register('maximumAmount')}
                />
              </div>
            </div>

            {/* Checkbox Options */}
            <div className="space-y-2 pt-2 border-t border-slate-100">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('individualUse')}
                  className="rounded text-red-600 focus:ring-red-600"
                />
                <span className="text-slate-700 font-medium">Individual use only</span>
                <span className="text-slate-400 text-[11px]">(cannot combine with other coupons)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register('excludeSaleItems')}
                  className="rounded text-red-600 focus:ring-red-600"
                />
                <span className="text-slate-700 font-medium">Exclude sale items</span>
                <span className="text-slate-400 text-[11px]">(per-item coupons will not apply to sale goods)</span>
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {editingCoupon ? 'Save Changes' : 'Publish Coupon'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={!!couponToDelete}
        onOpenChange={(open) => !open && setCouponToDelete(null)}
        title="Delete Coupon"
        description={`Are you sure you want to permanently delete coupon "${couponToDelete?.code}"?`}
        confirmLabel="Delete Coupon"
        onConfirm={handleDelete}
      />
    </div>
  );
}

