import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  AlertCircle,
  Package,
  Layers,
  CheckCircle,
  RotateCcw,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { useProductStore } from '@/store';
import { Product } from '@/types';
import { formatCurrency, formatMoney } from '@/utils/formatters';
import { isOnSale } from '@/utils/stock';
import { ProductStatusBadge } from '@/components/products/ProductStatusBadge';
import { ProductDetailModal } from '@/components/products/ProductDetailModal';
import { useStockState } from '@/hooks/useStockState';
import { getErrorMessage } from '@/utils/errors';
import { toast } from 'sonner';

export function ProductsListPage() {
  const stockOf = useStockState();
  const navigate = useNavigate();
  const { products, deleteProduct } = useProductStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStock, setSelectedStock] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<Product | null>(null);
  const [productModalOpen, setProductModalOpen] = useState(false);
  const pageSize = 10;

  const statusCounts = useMemo(() => {
    return {
      all: products.length,
      publish: products.filter((p) => p.status === 'publish').length,
      draft: products.filter((p) => p.status === 'draft').length,
      pending: products.filter((p) => p.status === 'pending').length,
      private: products.filter((p) => p.status === 'private').length,
    };
  }, [products]);

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedStatus !== 'all' ||
    selectedCategory !== 'all' ||
    selectedStock !== 'all' ||
    selectedType !== 'all'
  );

  const activeFilterCount =
    (selectedStatus !== 'all' ? 1 : 0) +
    (selectedCategory !== 'all' ? 1 : 0) +
    (selectedStock !== 'all' ? 1 : 0) +
    (selectedType !== 'all' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setSelectedCategory('all');
    setSelectedStock('all');
    setSelectedType('all');
    setCurrentPage(1);
  };

  // Delete modal state
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // Extract distinct categories
  const categoriesList = useMemo(() => {
    const set = new Set<string>();
    products.forEach((p) => p.categories.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCat =
        selectedCategory === 'all' || p.categories.includes(selectedCategory);

      const matchesStock =
        selectedStock === 'all' ||
        (selectedStock === 'instock' && stockOf(p) === 'in') ||
        (selectedStock === 'lowstock' && stockOf(p) === 'low') ||
        (selectedStock === 'outofstock' && stockOf(p) === 'out') ||
        (selectedStock === 'onbackorder' && stockOf(p) === 'backorder');

      const matchesType = selectedType === 'all' || p.type === selectedType;
      const matchesStatus = selectedStatus === 'all' || p.status === selectedStatus;

      return matchesSearch && matchesCat && matchesStock && matchesType && matchesStatus;
    });
  }, [products, searchTerm, selectedStatus, selectedCategory, selectedStock, selectedType, stockOf]);

  const totalPages = Math.ceil(filteredProducts.length / pageSize);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleDelete = async () => {
    if (!productToDelete) return;
    try {
      await deleteProduct(productToDelete.id);
      toast.success(`Product "${productToDelete.name}" moved to the trash.`);
      setProductToDelete(null);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const getStockBadge = (prod: Product) => {
    const state = stockOf(prod);
    if (state === 'out') {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (state === 'backorder') {
      return <Badge variant="warning">On Backorder</Badge>;
    }
    if (state === 'low') {
      return (
        <Badge variant="warning">
          Low Stock ({prod.stockQuantity})
        </Badge>
      );
    }
    return (
      <Badge variant="success">
        {prod.manageStock ? `In Stock (${prod.stockQuantity})` : 'In Stock'}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Products
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Manage your store inventory, pricing and catalog.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={() => navigate('/products/new')}
            size="sm"
            className="flex-1 sm:flex-none gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'All Products', count: statusCounts.all },
          { key: 'publish', label: 'Published', count: statusCounts.publish },
          { key: 'draft', label: 'Draft', count: statusCounts.draft },
          { key: 'pending', label: 'Pending', count: statusCounts.pending },
          { key: 'private', label: 'Private', count: statusCounts.private },
        ].map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedStatus(tab.key);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold leading-none ${
                  isActive ? 'bg-white text-black' : 'bg-red-600 text-white'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Mobile & Tablet: Search + Filter Button + Clear Button */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or SKU..."
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

          {/* Desktop View: Full 4-Column Filter Grid */}
          <div className="hidden lg:grid grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or SKU..."
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

            {/* Category Filter */}
            <Select
              value={selectedCategory}
              onValueChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-50/50">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesList.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Stock Status Filter */}
            <Select
              value={selectedStock}
              onValueChange={(val) => {
                setSelectedStock(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="bg-slate-50/50">
                <SelectValue placeholder="All Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Status</SelectItem>
                <SelectItem value="instock">In Stock</SelectItem>
                <SelectItem value="lowstock">Low Stock</SelectItem>
                <SelectItem value="outofstock">Out of Stock</SelectItem>
                <SelectItem value="onbackorder">On Backorder</SelectItem>
              </SelectContent>
            </Select>

            {/* Product Type Filter */}
            <div className="flex items-center gap-2">
              <Select
                value={selectedType}
                onValueChange={(val) => {
                  setSelectedType(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="bg-slate-50/50 flex-1">
                  <SelectValue placeholder="All Product Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="simple">Simple Product</SelectItem>
                  <SelectItem value="variable">Variable Product</SelectItem>
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
                  <span className="hidden xl:inline">Clear</span>
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
        title="Filter Products"
        activeCount={activeFilterCount}
        onClear={handleClearFilters}
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by name or SKU..."
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
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Category</label>
            <Select
              value={selectedCategory}
              onValueChange={(val) => {
                setSelectedCategory(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categoriesList.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Stock Status</label>
            <Select
              value={selectedStock}
              onValueChange={(val) => {
                setSelectedStock(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Stock Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Stock Status</SelectItem>
                <SelectItem value="instock">In Stock</SelectItem>
                <SelectItem value="lowstock">Low Stock</SelectItem>
                <SelectItem value="outofstock">Out of Stock</SelectItem>
                <SelectItem value="onbackorder">On Backorder</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Product Type</label>
            <Select
              value={selectedType}
              onValueChange={(val) => {
                setSelectedType(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Product Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="simple">Simple Product</SelectItem>
                <SelectItem value="variable">Variable Product</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterModal>

      {/* Product Table */}
      <Card>
        <CardContent className="p-0">
          {filteredProducts.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Package}
                title="No products found"
                description="Try modifying your search or filter options to locate your products."
                actionLabel="Add New Product"
                onAction={() => navigate('/products/new')}
              />
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card View (< lg) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-slate-50/40">
                {paginatedProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => {
                      setSelectedProductForModal(product);
                      setProductModalOpen(true);
                    }}
                    className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:border-slate-300 transition-all cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      {/* Thumbnail */}
                      <div
                        className="h-16 w-16 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0"
                      >
                        {product.images[0] ? (
                          <img
                            src={product.images[0].src}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-slate-400">
                            <Package className="h-6 w-6" />
                          </div>
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="text-left font-semibold text-sm text-slate-900 hover:text-red-600 line-clamp-2 leading-snug"
                          >
                            {product.name}
                          </span>
                          <div onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 -mr-1">
                                  <MoreVertical className="h-4 w-4 text-slate-500" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => {
                                    setSelectedProductForModal(product);
                                    setProductModalOpen(true);
                                  }}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Eye className="h-4 w-4 text-slate-500" />
                                  <span>Quick View</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => navigate(`/products/${product.id}/edit`)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Edit className="h-4 w-4 text-slate-500" />
                                  <span>Edit Product</span>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setProductToDelete(product)}
                                  className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span>Delete</span>
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          {product.sku && (
                            <span className="font-mono text-[11px] text-slate-500">
                              {product.sku}
                            </span>
                          )}
                          {product.sku && <span className="text-slate-300">•</span>}
                          {product.type === 'variable' ? (
                            <Badge variant="purple" className="text-[10px] py-0 px-1.5 h-4">
                              Variable
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-4">
                              Simple
                            </Badge>
                          )}
                          <ProductStatusBadge status={product.status} />
                        </div>

                        {product.categories.length > 0 && (
                          <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                            {product.categories.slice(0, 2).map((cat) => (
                              <Badge key={cat} variant="secondary">
                                {cat}
                              </Badge>
                            ))}
                            {product.categories.length > 2 && (
                              <span className="text-xs text-slate-400">
                                +{product.categories.length - 2} more
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-100">
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm font-bold text-slate-900">
                              {product.type === 'variable' && product.price !== undefined ? 'From ' : ''}
                              {formatMoney(product.price)}
                            </span>
                            {isOnSale(product) && (
                              <span className="text-xs text-slate-400 line-through">
                                {formatMoney(product.regularPrice)}
                              </span>
                            )}
                          </div>
                          <div>{getStockBadge(product)}</div>
                        </div>
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
                      <TableHead className="w-16">Image</TableHead>
                      <TableHead>Product Name</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Categories</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-12 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedProducts.map((product) => (
                      <TableRow
                        key={product.id}
                        onClick={() => {
                          setSelectedProductForModal(product);
                          setProductModalOpen(true);
                        }}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        {/* Thumbnail */}
                        <TableCell>
                          <div className="h-11 w-11 rounded-lg bg-slate-100 overflow-hidden border border-slate-200 shrink-0">
                            {product.images[0] ? (
                              <img
                                src={product.images[0].src}
                                alt={product.name}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="h-full w-full flex items-center justify-center text-slate-400">
                                <Package className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                        </TableCell>

                        {/* Name */}
                        <TableCell>
                          <span className="text-left font-medium text-slate-900 hover:text-red-600 transition-colors line-clamp-1">
                            {product.name}
                          </span>
                          <span className="text-[11px] text-slate-400 block mt-0.5">
                            Slug: {product.slug}
                          </span>
                        </TableCell>

                        {/* Stock */}
                        <TableCell>{getStockBadge(product)}</TableCell>

                        {/* Price */}
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {product.type === 'variable' && product.price !== undefined ? 'From ' : ''}
                            {formatMoney(product.price)}
                          </div>
                          {isOnSale(product) && (
                            <div className="text-[11px] text-slate-400 line-through">
                              {formatMoney(product.regularPrice)}
                            </div>
                          )}
                        </TableCell>

                        {/* Categories */}
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {product.categories.slice(0, 2).map((cat) => (
                              <Badge key={cat} variant="secondary">
                                {cat}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <ProductStatusBadge status={product.status} />
                        </TableCell>

                        {/* Actions Menu */}
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="h-4 w-4 text-slate-500" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedProductForModal(product);
                                  setProductModalOpen(true);
                                }}
                                className="gap-2 cursor-pointer"
                              >
                                <Eye className="h-4 w-4 text-slate-500" />
                                <span>Quick View</span>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => navigate(`/products/${product.id}/edit`)}
                                className="gap-2 cursor-pointer"
                              >
                                <Edit className="h-4 w-4 text-slate-500" />
                                <span>Edit Product</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setProductToDelete(product)}
                                className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                              >
                                <Trash2 className="h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredProducts.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        open={!!productToDelete}
        onOpenChange={(open) => !open && setProductToDelete(null)}
        title="Move product to trash"
        description={`Move "${productToDelete?.name}" to the trash in WooCommerce? It will no longer be sold or shown in your store. It can be restored from the WooCommerce trash.`}
        confirmLabel="Move to trash"
        onConfirm={handleDelete}
      />

      {/* Product Quick View / Detail Modal */}
      <ProductDetailModal
        product={selectedProductForModal}
        open={productModalOpen}
        onOpenChange={setProductModalOpen}
      />
    </div>
  );
}

