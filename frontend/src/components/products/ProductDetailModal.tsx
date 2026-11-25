import React, { useState } from 'react';
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
  Edit,
  ExternalLink,
  Package,
  Layers,
  IndianRupee,
  TrendingUp,
  Tag,
  Boxes,
} from 'lucide-react';
import { Product } from '@/types';
import { formatCurrency } from '@/utils/formatters';
import { htmlToText } from '@/utils/html';
import { useStockState } from '@/hooks/useStockState';

interface ProductDetailModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDetailModal({
  product,
  open,
  onOpenChange,
}: ProductDetailModalProps) {
  const navigate = useNavigate();
  const stockOf = useStockState();
  const [activeImg, setActiveImg] = useState(0);

  if (!product) return null;

  const stockState = stockOf(product);
  const getStockBadge = () => {
    if (stockState === 'out') return <Badge variant="destructive">Out of Stock</Badge>;
    if (stockState === 'backorder') return <Badge variant="warning">On Backorder</Badge>;
    if (stockState === 'low') return <Badge variant="warning">Low Stock ({product.stockQuantity})</Badge>;
    return <Badge variant="success">In Stock ({product.stockQuantity})</Badge>;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'publish':
        return <Badge variant="success">Published</Badge>;
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'pending':
        return <Badge variant="warning">Pending Review</Badge>;
      case 'private':
        return <Badge variant="outline">Private</Badge>;
      default:
        return <Badge variant="outline" className="capitalize">{status}</Badge>;
    }
  };

  const images = product.images || [];
  const currentImage = images[activeImg]?.src || images[0]?.src;
  const descriptionText = htmlToText(product.shortDescription || product.description || 'No description provided.');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="pb-3 border-b border-slate-100">
          <div className="flex flex-wrap items-center justify-between gap-2 pr-6">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-lg font-bold text-slate-900 line-clamp-1">
                {product.name}
              </DialogTitle>
            </div>
            <div className="flex items-center gap-1.5">
              {getStatusBadge(product.status)}
              <span className="text-[11px] font-medium text-slate-500 capitalize bg-slate-100 px-2 py-0.5 rounded-full">
                {product.type}
              </span>
            </div>
          </div>
        </DialogHeader>

        {/* Product Media & Core Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-1">
          {/* Left: Image & Thumbnails */}
          <div className="space-y-2">
            <div className="aspect-square rounded-xl bg-slate-50 border border-slate-200 overflow-hidden flex items-center justify-center">
              {currentImage ? (
                <img src={currentImage} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <Package className="h-12 w-12 text-slate-300" />
              )}
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                {images.map((img, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveImg(i)}
                    className={`h-12 w-12 rounded-lg border overflow-hidden shrink-0 transition-all ${
                      activeImg === i ? 'border-red-600 ring-2 ring-red-100' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={img.src} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Quick Specs */}
          <div className="space-y-3">
            {/* Pricing */}
            <div className="p-3 bg-red-50/50 rounded-xl border border-red-100/60">
              <span className="text-xs text-red-700 font-medium block">Price</span>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl font-bold text-slate-900">
                  {formatCurrency(product.salePrice ?? product.price ?? product.regularPrice ?? 0)}
                </span>
                {product.salePrice && product.regularPrice && (
                  <span className="text-xs text-slate-400 line-through">
                    {formatCurrency(product.regularPrice)}
                  </span>
                )}
              </div>
            </div>

            {/* Inventory Status & SKU */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block mb-1">Stock Status</span>
                {getStockBadge()}
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-100">
                <span className="text-slate-500 block mb-0.5">SKU</span>
                <span className="font-mono font-semibold text-slate-800">
                  {product.sku || '—'}
                </span>
              </div>
            </div>

            {/* Categories */}
            {product.categories.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Tag className="h-3 w-3" />
                  <span>Categories</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {product.categories.map((cat, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md text-xs font-medium"
                    >
                      {cat}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Lifetime Sales Stats */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-500 block">Units Sold</span>
                <span className="text-sm font-bold text-slate-800 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  {product.totalSales || 0}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Total Revenue</span>
                <span className="text-sm font-bold text-slate-800">
                  {formatCurrency(product.revenue || 0)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Description snippet */}
        {descriptionText && (
          <div className="p-3 bg-slate-50/70 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed max-h-32 overflow-y-auto">
            <span className="font-semibold text-slate-800 block mb-1">Description</span>
            <p className="line-clamp-4">{descriptionText}</p>
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
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/products/${product.id}/edit`);
              }}
              className="gap-1.5 text-xs bg-white text-slate-700"
            >
              <Edit className="h-3.5 w-3.5 text-slate-500" />
              <span>Edit Product</span>
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                navigate(`/products/${product.id}`);
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
