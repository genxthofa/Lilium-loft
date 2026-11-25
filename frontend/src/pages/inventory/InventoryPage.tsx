import React, { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Boxes,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Plus,
  Minus,
  Edit3,
  Package,
  Filter,
  RotateCcw,
  X,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilterModal } from '@/components/ui/filter-modal';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
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
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { useProductStore } from '@/store';
import { Product } from '@/types';
import { formatMoney } from '@/utils/formatters';
import { exportToCSV } from '@/utils/csv';
import { useStockState } from '@/hooks/useStockState';
import { getErrorMessage } from '@/utils/errors';
import { toast } from 'sonner';

export function InventoryPage() {
  const stockOf = useStockState();
  const { products, adjustStock } = useProductStore();

  const [searchTerm, setSearchTerm] = useState('');
  // Opened from the stock-alert button (/inventory?filter=alerts): start on the products that need attention.
  const [searchParams] = useSearchParams();
  const [filterTab, setFilterTab] = useState<'all' | 'alerts' | 'low' | 'out' | 'in'>(
    searchParams.get('filter') === 'alerts' ? 'alerts' : 'all'
  );
  const filterParam = searchParams.get('filter');
  useEffect(() => {
    // Clicking the alert button again while already on this page switches back to the alerts view.
    if (filterParam === 'alerts') {
      setFilterTab('alerts');
      setCurrentPage(1);
    }
  }, [filterParam]);
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const pageSize = 10;

  const hasActiveFilters = Boolean(searchTerm.trim() || filterTab !== 'all');
  const activeFilterCount = (filterTab !== 'all' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterTab('all');
    setCurrentPage(1);
  };

  // Quick Adjust Modal State
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [viewProduct, setViewProduct] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const [adjustType, setAdjustType] = useState<'set' | 'add' | 'subtract'>('set');
  const [adjustAmount, setAdjustAmount] = useState<number>(0);
  const [adjustNote, setAdjustNote] = useState('');
  const [adjustError, setAdjustError] = useState('');

  // Stock Counters
  const counts = useMemo(() => {
    return {
      total: products.length,
      inStock: products.filter((p) => stockOf(p) === 'in').length,
      lowStock: products.filter((p) => stockOf(p) === 'low').length,
      outOfStock: products.filter((p) => stockOf(p) === 'out').length,
    };
  }, [products, stockOf]);

  // Filtered inventory list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesTab = true;
      if (filterTab === 'alerts') matchesTab = stockOf(p) === 'low' || stockOf(p) === 'out';
      if (filterTab === 'low') matchesTab = stockOf(p) === 'low';
      if (filterTab === 'out') matchesTab = stockOf(p) === 'out';
      if (filterTab === 'in') matchesTab = stockOf(p) === 'in';

      return matchesSearch && matchesTab;
    });
  }, [products, searchTerm, filterTab, stockOf]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const openAdjustModal = (product: Product) => {
    setSelectedProduct(product);
    setAdjustType('set');
    setAdjustAmount(product.manageStock ? (product.stockQuantity ?? 0) : 0);
    setAdjustError('');
  };

  const handleApplyAdjustment = async () => {
    if (!selectedProduct) return;
    if (adjustAmount < 0 || isNaN(adjustAmount)) {
      setAdjustError('Please enter a valid stock quantity (0 or greater).');
      return;
    }
    setAdjustError('');

    try {
      await adjustStock(selectedProduct.id, adjustAmount, adjustType);
    } catch (err) {
      toast.error(getErrorMessage(err));
      return;
    }

    const actionText =
      adjustType === 'set'
        ? `set to ${adjustAmount}`
        : adjustType === 'add'
        ? `increased by ${adjustAmount}`
        : `decreased by ${adjustAmount}`;

    toast.success(`Stock for "${selectedProduct.name}" ${actionText}.`);
    setSelectedProduct(null);
  };

  const handleExport = () => {
    exportToCSV(
      products.map((p) => ({
        SKU: p.sku,
        Name: p.name,
        StockQuantity: p.manageStock ? p.stockQuantity : '',
        StockStatus: p.stockStatus,
        Price: p.price ?? '',
        Categories: p.categories.join('; '),
      })),
      'woocommerce-inventory-audit'
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Inventory & Stock Control
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Stock levels as WooCommerce reports them, with quick stock adjustments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex-1 sm:flex-none gap-1.5 bg-white text-slate-700"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        <Card
          onClick={() => {
            setFilterTab('all');
            setCurrentPage(1);
          }}
          className={`cursor-pointer transition-all ${
            filterTab === 'all' ? 'border-red-500 ring-1 ring-red-500' : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate block">
                All Products
              </span>
              <div className="text-lg sm:text-2xl font-bold text-slate-900 mt-0.5 sm:mt-1">
                {counts.total}
              </div>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center">
              <Boxes className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterTab('in');
            setCurrentPage(1);
          }}
          className={`cursor-pointer transition-all ${
            filterTab === 'in' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate block">
                In Stock
              </span>
              <div className="text-lg sm:text-2xl font-bold text-emerald-600 mt-0.5 sm:mt-1">
                {counts.inStock}
              </div>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterTab('low');
            setCurrentPage(1);
          }}
          className={`cursor-pointer transition-all ${
            filterTab === 'low' ? 'border-amber-500 ring-1 ring-amber-500' : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate block">
                Low Stock
              </span>
              <div className="text-lg sm:text-2xl font-bold text-amber-600 mt-0.5 sm:mt-1">
                {counts.lowStock}
              </div>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>

        <Card
          onClick={() => {
            setFilterTab('out');
            setCurrentPage(1);
          }}
          className={`cursor-pointer transition-all ${
            filterTab === 'out' ? 'border-red-500 ring-1 ring-red-500' : 'hover:border-slate-300'
          }`}
        >
          <CardContent className="p-3 sm:p-4 md:p-5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate block">
                Out of Stock
              </span>
              <div className="text-lg sm:text-2xl font-bold text-red-600 mt-0.5 sm:mt-1">
                {counts.outOfStock}
              </div>
            </div>
            <div className="h-8 w-8 sm:h-10 sm:w-10 shrink-0 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <XCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Which products to list: the ones that need attention, or everything */}
      <div className="flex flex-wrap items-center gap-2">
        {[
          { key: 'alerts' as const, label: 'Needs attention', count: counts.lowStock + counts.outOfStock },
          { key: 'all' as const, label: 'All products', count: counts.total },
        ].map((tab) => {
          const active = filterTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setFilterTab(tab.key);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                active
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 rounded-full text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-700'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
        {(filterTab === 'low' || filterTab === 'out' || filterTab === 'in') && (
          <span className="text-xs text-slate-400">Filtered by the stock card you selected above.</span>
        )}
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Mobile & Tablet: Search + Filter button + Clear button */}
          <div className="flex sm:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search inventory..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 bg-slate-50/50 text-xs sm:text-sm h-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
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

          {/* Desktop & Tablet: Search with Clear Button */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search inventory by product name or SKU code..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 bg-slate-50/50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

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
        </CardContent>
      </Card>

      {/* Mobile/Tablet Filter Modal */}
      <FilterModal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        title="Filter Inventory"
        activeCount={activeFilterCount}
        onClear={handleClearFilters}
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Product name or SKU..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Stock Condition</label>
            <Select
              value={filterTab}
              onValueChange={(val: 'all' | 'alerts' | 'low' | 'out' | 'in') => {
                setFilterTab(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All inventory" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Inventory ({counts.total})</SelectItem>
                <SelectItem value="alerts">Attention Needed ({counts.lowStock + counts.outOfStock})</SelectItem>
                <SelectItem value="low">Low Stock Alert ({counts.lowStock})</SelectItem>
                <SelectItem value="out">Out of Stock ({counts.outOfStock})</SelectItem>
                <SelectItem value="in">Healthy Stock ({counts.inStock})</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterModal>

      {/* Inventory Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Boxes}
                title="No inventory records found"
                description="No products match the selected inventory condition."
              />
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card View (< lg) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-slate-50/40">
                {paginatedProducts.map((p) => {
                  const isOut = stockOf(p) === 'out';
                  const isLow = stockOf(p) === 'low';
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        setViewProduct(p);
                        setProductModalOpen(true);
                      }}
                      className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:border-slate-300 transition-all cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        {/* Thumbnail */}
                        <div className="h-14 w-14 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                          {p.images[0] ? (
                            <img
                              src={p.images[0].src}
                              alt={p.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <Package className="h-6 w-6" />
                            </div>
                          )}
                        </div>

                        {/* Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="font-semibold text-sm text-slate-900 line-clamp-1">
                                {p.name}
                              </h4>
                              {p.categories.length > 0 && (
                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                  {p.categories.join(', ')}
                                </p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAdjustModal(p);
                              }}
                              className="h-7 px-2.5 gap-1 text-xs shrink-0 bg-white text-slate-700 hover:text-red-600 hover:border-red-300"
                            >
                              <Edit3 className="h-3 w-3" />
                              <span>Adjust</span>
                            </Button>
                          </div>

                          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs">
                            <span className="font-bold text-slate-900">
                              {formatMoney(p.price)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-slate-500">Stock:</span>
                              <span
                                className={`font-bold font-mono text-xs ${
                                  isOut
                                    ? 'text-red-600'
                                    : isLow
                                    ? 'text-amber-600'
                                    : 'text-slate-900'
                                }`}
                              >
                                {p.manageStock ? (p.stockQuantity ?? 0) : 0} units
                              </span>
                            </div>
                            <div>
                              {isOut ? (
                                <Badge variant="destructive" className="text-[10px] py-0 px-1.5 h-4">Out of Stock</Badge>
                              ) : stockOf(p) === 'backorder' ? (
                                <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4">On Backorder</Badge>
                              ) : isLow ? (
                                <Badge variant="warning" className="text-[10px] py-0 px-1.5 h-4">Low Stock</Badge>
                              ) : (
                                <Badge variant="success" className="text-[10px] py-0 px-1.5 h-4">In Stock</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View (lg and above) */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">Image</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((p) => {
                      const isOut = stockOf(p) === 'out';
                      const isLow = stockOf(p) === 'low';
                      return (
                        <TableRow
                          key={p.id}
                          onClick={() => {
                            setViewProduct(p);
                            setProductModalOpen(true);
                          }}
                          className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                        >
                          <TableCell>
                            <div className="h-11 w-11 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                              {p.images[0] ? (
                                <img
                                  src={p.images[0].src}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <Package className="h-5 w-5 m-3 text-slate-400" />
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900">
                            {p.name}
                            <span className="block text-xs font-normal text-slate-400">
                              {p.categories.join(', ')}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-900">
                            {formatMoney(p.price)}
                          </TableCell>
                          <TableCell>
                            {(() => {
                              const count = p.manageStock ? (p.stockQuantity ?? 0) : 0;
                              if (isOut) {
                                return <Badge variant="destructive">Out of Stock ({count})</Badge>;
                              }
                              if (stockOf(p) === 'backorder') {
                                return <Badge variant="warning">On Backorder ({count})</Badge>;
                              }
                              if (isLow) {
                                return <Badge variant="warning">Low Stock ({count})</Badge>;
                              }
                              return <Badge variant="success">In Stock ({count})</Badge>;
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                openAdjustModal(p);
                              }}
                              className="gap-1.5 text-xs bg-white text-slate-700 hover:text-red-600 hover:border-red-300"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              <span>Adjust</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Quick Stock Adjustment Dialog */}
      {selectedProduct && (
        <Dialog
          open={!!selectedProduct}
          onOpenChange={(open) => !open && setSelectedProduct(null)}
        >
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-base font-semibold flex items-center gap-2">
                <Boxes className="h-5 w-5 text-red-600" />
                <span>Update Stock: {selectedProduct.name}</span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                Current stock: <strong className="text-slate-800">{selectedProduct.manageStock ? (selectedProduct.stockQuantity ?? 0) : 0} units</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="space-y-1.5">
                <label className="font-semibold text-slate-700">Stock Units</label>
                <Input
                  type="number"
                  min="0"
                  value={adjustAmount}
                  onChange={(e) => {
                    setAdjustAmount(Math.max(0, parseInt(e.target.value) || 0));
                    if (adjustError) setAdjustError('');
                  }}
                  className={`font-mono text-base font-semibold ${adjustError ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                />
                {adjustError && (
                  <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{adjustError}</span>
                  </p>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedProduct(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleApplyAdjustment}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Save Stock
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Product Quick View / Detail Modal */}
      <ProductDetailModal
        product={viewProduct}
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
      />
    </div>
  );
}

