import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Save, ImagePlus, Trash2, Check, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { productSchema, ProductFormValues } from '@/schemas';
import { useProductStore, useCategoryStore } from '@/store';
import { ProductImage } from '@/types';
import { getErrorMessage } from '@/utils/errors';
import { useCurrencyLabel } from '@/hooks/useCurrencySymbol';
import { STICKY_COLUMN } from '@/utils/sticky';
import { toast } from 'sonner';

export function ProductFormPage() {
  const currencyLabel = useCurrencyLabel();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditing = Boolean(id);

  const { products, createProduct, updateProduct } = useProductStore();
  const categories = useCategoryStore((s) => s.categories);
  const existingProduct = isEditing ? products.find((p) => p.id === id) : null;

  // Only the images the product really has; nothing is pre-filled.
  const [images, setImages] = useState<ProductImage[]>(existingProduct?.images ?? []);
  const [newImageUrl, setNewImageUrl] = useState('');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: 'onChange',
    defaultValues: {
      name: existingProduct?.name ?? '',
      slug: existingProduct?.slug ?? '',
      sku: existingProduct?.sku ?? '',
      type: existingProduct?.type ?? 'simple',
      status: existingProduct?.status ?? 'private',
      regularPrice: existingProduct?.regularPrice,
      salePrice: existingProduct?.salePrice,
      manageStock: existingProduct?.manageStock ?? false,
      stockQuantity: existingProduct?.stockQuantity ?? 0,
      stockStatus: existingProduct?.stockStatus ?? 'instock',
      categories: existingProduct?.categories ?? [],
      shortDescription: existingProduct?.shortDescription ?? '',
      description: existingProduct?.description ?? '',
    },
  });

  // The product list may arrive after this page opens (direct link / refresh): fill the form then.
  // Only once per product: later background refreshes must never overwrite what is being edited.
  const filledFor = useRef<string | null>(existingProduct?.id ?? null);
  useEffect(() => {
    if (!existingProduct || filledFor.current === existingProduct.id) return;
    filledFor.current = existingProduct.id;
    reset({
      name: existingProduct.name,
      slug: existingProduct.slug,
      sku: existingProduct.sku,
      type: existingProduct.type,
      status: existingProduct.status,
      regularPrice: existingProduct.regularPrice,
      salePrice: existingProduct.salePrice,
      manageStock: existingProduct.manageStock,
      stockQuantity: existingProduct.stockQuantity,
      stockStatus: existingProduct.stockStatus,
      categories: existingProduct.categories,
      shortDescription: existingProduct.shortDescription,
      description: existingProduct.description,
    });
    setImages(existingProduct.images);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existingProduct?.id]);

  const productType = watch('type');
  const manageStock = watch('manageStock');
  const selectedCategories = watch('categories') || [];
  // Variable products keep their prices on variations, which are managed in WooCommerce.
  const pricesEditable = productType === 'simple';

  // Auto generate slug from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    setValue('name', name, { shouldValidate: true, shouldDirty: true });
    if (!isEditing) {
      const generatedSlug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)+/g, '');
      setValue('slug', generatedSlug, { shouldValidate: true, shouldDirty: true });
    }
  };

  const handleAddImage = () => {
    const trimmed = newImageUrl.trim();
    if (!trimmed) {
      toast.error('Please enter an image URL to add to gallery');
      imageInputRef.current?.focus();
      return;
    }

    let url = trimmed;
    if (!/^https?:\/\//i.test(url)) {
      url = 'https://' + url;
    }

    try {
      new URL(url);
    } catch {
      toast.error('Please enter a valid image URL (e.g. https://example.com/image.jpg)');
      return;
    }

    if (images.some((img) => img.src === url)) {
      toast.warning('This image is already in the gallery');
      return;
    }

    setImages((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, src: url, alt: '' },
    ]);
    setNewImageUrl('');
    toast.success('Image added to gallery');
    imageInputRef.current?.focus();
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text?.trim()) {
        setNewImageUrl(text.trim());
        toast.info('Pasted URL from clipboard');
        imageInputRef.current?.focus();
      } else {
        toast.error('Clipboard is empty');
      }
    } catch {
      toast.error('Unable to access clipboard. Please paste manually into the input.');
    }
  };

  const handleRemoveImage = (imgId: string) => {
    setImages((prev) => prev.filter((i) => i.id !== imgId));
    toast.info('Image removed from gallery');
  };

  const toggleCategory = (catName: string) => {
    const current = new Set(selectedCategories);
    if (current.has(catName)) {
      current.delete(catName);
    } else {
      current.add(catName);
    }
    setValue('categories', Array.from(current));
  };

  const onSubmit = async (data: ProductFormValues) => {
    const input = {
      name: data.name,
      slug: data.slug,
      sku: data.sku,
      type: data.type,
      status: data.status,
      regularPrice: data.regularPrice,
      salePrice: data.salePrice,
      manageStock: data.manageStock,
      stockQuantity: data.stockQuantity,
      stockStatus: data.stockStatus,
      categories: data.categories,
      shortDescription: data.shortDescription,
      description: data.description,
      images: images.map((i) => i.src),
    };

    try {
      if (isEditing && id) {
        await updateProduct(id, input);
        toast.success('Product updated successfully!');
        navigate('/products');
      } else {
        await createProduct(input);
        toast.success('Product created successfully!');
        navigate('/products');
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6 w-full pb-28 md:pb-12">
      {/* Top Header: stays at the top while the long form scrolls, so Save is always reachable */}
      <div className="md:sticky md:top-0 md:z-20 md:-mx-6 lg:-mx-8 md:px-6 lg:px-8 md:py-3 md:bg-slate-50/95 md:backdrop-blur md:border-b md:border-slate-200/70 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/products')}
            className="h-9 w-9 bg-white shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {isEditing ? `Edit: ${existingProduct?.name}` : 'Create New Product'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {isEditing
                ? 'Update specifications, pricing, stock, or variations'
                : 'Configure a new product item in your WooCommerce catalog'}
            </p>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 w-full sm:w-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/products')}
            className="flex-1 sm:flex-none bg-white"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            className="flex-1 sm:flex-none gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Save className="h-4 w-4" />
            <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Main Form: 8 cols on lg, 9 cols on xl */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            {/* General Information Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">General Information</CardTitle>
                <CardDescription className="text-xs">
                  Basic details and public presentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Product Name */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Product Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    placeholder="e.g. Minimalist Chronograph Watch"
                    {...register('name')}
                    onChange={handleNameChange}
                    className={errors.name ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  {errors.name && (
                    <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.name.message}</span>
                    </p>
                  )}
                </div>

                {/* Slug */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    URL Slug <span className="text-red-500">*</span>
                  </label>
                  <div className={`flex items-center rounded-md border ${errors.slug ? 'border-red-500' : 'border-slate-300'} bg-slate-50 px-3 text-xs text-slate-500 focus-within:ring-1 focus-within:ring-red-500 focus-within:border-red-500 overflow-x-auto transition-colors`}>
                    <span className="shrink-0 text-slate-400 select-none">store.com/product/</span>
                    <input
                      {...register('slug')}
                      placeholder="url-slug"
                      className="w-full bg-transparent py-2 pl-0.5 pr-2 text-xs font-mono text-slate-800 outline-none min-w-[120px]"
                    />
                  </div>
                  {errors.slug && (
                    <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      <span>{errors.slug.message}</span>
                    </p>
                  )}
                </div>

                {/* Short Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Short Description (Summary)
                  </label>
                  <Textarea
                    placeholder="Brief 1-2 sentence teaser shown next to the buy button..."
                    rows={2}
                    {...register('shortDescription')}
                  />
                </div>

                {/* Detailed Description */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">
                    Full Description
                  </label>
                  <Textarea
                    placeholder="Detailed specifications, materials, warranty, care instructions..."
                    rows={4}
                    {...register('description')}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing & Stock Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Pricing & Inventory</CardTitle>
                <CardDescription className="text-xs">
                  SKU, stock thresholds, and regular vs sale price
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* SKU */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      SKU Code
                    </label>
                    <Input
                      placeholder="e.g. SKU-001"
                      {...register('sku')}
                      className={errors.sku ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {errors.sku && (
                      <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.sku.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Regular Price */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Regular Price{currencyLabel} <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register('regularPrice')}
                      disabled={!pricesEditable}
                      className={errors.regularPrice ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {errors.regularPrice && (
                      <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3 shrink-0" />
                        <span>{errors.regularPrice.message}</span>
                      </p>
                    )}
                  </div>

                  {/* Sale Price */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Sale Price{currencyLabel}
                    </label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      {...register('salePrice')}
                      disabled={!pricesEditable}
                    />
                  </div>
                </div>

                {!pricesEditable && (
                  <p className="text-[11px] text-slate-500">
                    This is a {productType} product: its prices are set per variation in WooCommerce.
                  </p>
                )}

                {/* Stock Controls */}
                <div className="pt-2 border-t border-slate-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-slate-800">
                        Manage Stock Quantity
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Enable automated decrement on order placement
                      </div>
                    </div>
                    <Switch
                      checked={manageStock}
                      onCheckedChange={(val) => setValue('manageStock', val)}
                    />
                  </div>

                  {manageStock && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Stock Quantity Available
                        </label>
                        <Input
                          type="number"
                          min="0"
                          {...register('stockQuantity')}
                          className={errors.stockQuantity ? 'border-red-500 focus-visible:ring-red-500' : ''}
                        />
                        {errors.stockQuantity && (
                          <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" />
                            <span>{errors.stockQuantity.message}</span>
                          </p>
                        )}
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-slate-700">
                          Stock Status
                        </label>
                        <Select
                          value={watch('stockStatus')}
                          onValueChange={(val: any) => setValue('stockStatus', val)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="instock">In Stock</SelectItem>
                            <SelectItem value="outofstock">Out of Stock</SelectItem>
                            <SelectItem value="onbackorder">On Backorder</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Product Image Gallery */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold">Product Images & Gallery</CardTitle>
                <CardDescription className="text-xs">
                  Link public high-resolution images for catalog and store display
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Input
                        ref={imageInputRef}
                        placeholder="Paste image URL (e.g. https://example.com/photo.jpg)..."
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleAddImage();
                          }
                        }}
                        className="bg-white pr-20"
                      />
                      {typeof navigator !== 'undefined' && 'clipboard' in navigator && (
                        <button
                          type="button"
                          onClick={handlePasteClipboard}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition-colors"
                        >
                          Paste
                        </button>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleAddImage}
                      className="gap-1.5 shrink-0 bg-white hover:bg-slate-50 text-slate-700 font-medium"
                    >
                      <ImagePlus className="h-4 w-4 text-red-600" />
                      <span>Add to Gallery</span>
                    </Button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Paste a direct image URL from your WordPress Media Library, website, or CDN, then click <strong>Add to Gallery</strong> (or press Enter).
                  </p>
                </div>

                {images.length === 0 ? (
                  <div
                    onClick={() => imageInputRef.current?.focus()}
                    className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center cursor-pointer hover:border-slate-300 transition-colors bg-slate-50/50"
                  >
                    <ImagePlus className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-xs font-medium text-slate-600">No images added yet</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Paste a public image URL in the field above and click "Add to Gallery"
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    {images.map((img, idx) => (
                      <div
                        key={img.id}
                        className="group relative aspect-square rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-xs"
                      >
                        <img
                          src={img.src}
                          alt={img.alt || `Product image ${idx + 1}`}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://placehold.co/400x400/f1f5f9/94a3b8?text=Image+Failed';
                          }}
                        />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 bg-red-600 text-white text-[10px] px-1.5 py-0.5 rounded font-semibold shadow">
                            Main Image
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="absolute top-1.5 right-1.5 bg-black/60 text-white rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                          title="Remove image"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar options: 4 cols on lg, 3 cols on xl */}
          <div className={`lg:col-span-4 xl:col-span-3 space-y-6 ${STICKY_COLUMN} lg:top-24 lg:max-h-[calc(100dvh-10rem)]`}>
            {/* Publish Status Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Publish Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Status</label>
                  <Select
                    value={watch('status')}
                    onValueChange={(val: any) => setValue('status', val)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="publish">Published</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="pending">Pending Review</SelectItem>
                      <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-slate-400">
                    Private: saved in WooCommerce and visible only to store admins. Draft: not published yet.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Product Type</label>
                  <p className="text-xs text-slate-600 capitalize">{productType} product</p>
                  {!isEditing && (
                    <p className="text-[11px] text-slate-400">
                      New products are created as simple products. Variable products are set up in WooCommerce.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Categories Card */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Categories</CardTitle>
                <CardDescription className="text-xs">
                  Select matching taxonomy sections
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {categories.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2">No categories found.</p>
                ) : (
                  categories.map((cat) => {
                    const isChecked = selectedCategories.includes(cat.name);
                    return (
                      <label
                        key={cat.id}
                        onClick={() => toggleCategory(cat.name)}
                        className="flex items-center gap-2 p-2 rounded-md hover:bg-slate-50 cursor-pointer text-xs"
                      >
                        <div
                          className={`h-4 w-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                            isChecked
                              ? 'bg-red-600 border-red-600 text-white'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                        <span className="text-slate-700 font-medium">{cat.name}</span>
                      </label>
                    );
                  })
                )}
                {errors.categories && (
                  <p className="text-xs text-red-600 pt-1">
                    {errors.categories.message}
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </form>

      {/* Phones: Cancel / Save always within thumb reach at the bottom of the screen */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-30 flex gap-2 border-t border-slate-200 bg-white/95 backdrop-blur p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <Button type="button" variant="outline" onClick={() => navigate('/products')} className="flex-1 bg-white">
          Cancel
        </Button>
        <Button
          type="button"
          onClick={handleSubmit(onSubmit)}
          disabled={isSubmitting}
          className="flex-1 gap-1.5 bg-red-600 hover:bg-red-700 text-white"
        >
          <Save className="h-4 w-4" />
          <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
        </Button>
      </div>
    </div>
  );
}
