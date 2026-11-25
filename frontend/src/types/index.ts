export type ProductType = 'simple' | 'variable' | 'grouped' | 'external';
export type ProductStatus = 'publish' | 'draft' | 'pending' | 'private';
export type StockStatus = 'instock' | 'outofstock' | 'onbackorder';

export interface ProductImage {
  id: string;
  src: string;
  alt: string;
}

export interface ProductAttribute {
  id: string;
  name: string;
  options: string[];
  visible: boolean;
  variation: boolean;
}

export interface ProductVariation {
  id: string;
  sku: string;
  price: number;
  regularPrice: number;
  salePrice?: number;
  stockQuantity: number;
  stockStatus: StockStatus;
  attributes: Record<string, string>; // e.g. { "Size": "M", "Color": "Red" }
  image?: string;
}

export interface ProductCategory {
  id: string;
  /** WooCommerce category id; this is what product create/update sends. */
  wooId: number;
  name: string;
  slug: string;
  description?: string;
  count: number;
  image?: string;
}

export interface ProductTag {
  id: string;
  name: string;
  slug: string;
  count: number;
}

export interface Product {
  id: string;
  /** WooCommerce product id; order line items refer to products by this. */
  wooId: number;
  name: string;
  slug: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  /** undefined when WooCommerce has no price for the product (e.g. a draft). */
  price?: number;
  regularPrice?: number;
  salePrice?: number;
  manageStock: boolean;
  stockQuantity: number;
  stockStatus: StockStatus;
  categories: string[];
  tags: string[];
  images: ProductImage[];
  shortDescription: string;
  description: string;
  attributes: ProductAttribute[];
  variations: ProductVariation[];
  createdAt: string;
  updatedAt: string;
  featured?: boolean;
  /** The product's own low-stock level; undefined means the store-wide WooCommerce setting applies. */
  lowStockAmount?: number;
  /** Units sold over the product's lifetime, as counted by WooCommerce. */
  totalSales: number;
  /** Lifetime revenue from completed and processing orders. */
  revenue: number;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'on-hold'
  | 'dispatch'
  | 'completed'
  | 'cancelled'
  | 'refunded'
  | 'failed';

export interface OrderItem {
  id: string;
  productId: string;
  name: string;
  sku: string;
  /** Unit price before discounts (line subtotal / quantity). */
  price: number;
  quantity: number;
  /** Line total before discounts, as WooCommerce reports it. */
  subtotal: number;
  /** Line total after discounts. */
  total: number;
  image?: string;
  variationId?: string;
  attributes?: Record<string, string>;
}

export interface Address {
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  email?: string;
  phone?: string;
}

export interface OrderNote {
  id: string;
  content: string;
  date: string;
  author: string;
  isCustomerNote: boolean;
}

export interface OrderRefund {
  id: string;
  amount: number;
  reason: string;
  date: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  currency: string;
  status: OrderStatus;
  dateCreated: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  billing: Address;
  shipping: Address;
  items: OrderItem[];
  paymentMethod: string;
  paymentMethodTitle: string;
  transactionId: string;
  /** When WooCommerce recorded the payment; undefined if it has not been paid. */
  datePaid?: string;
  /** Sum of the line subtotals reported by WooCommerce. */
  subtotal?: number;
  shippingTotal: number;
  discountTotal: number;
  taxTotal: number;
  total: number;
  /** Refunded so far, as WooCommerce reports it on the order. */
  refundedTotal: number;
  courierName?: string;
  trackingNumber?: string;
  dispatchedAt?: string;
  notes: OrderNote[];
  refunds: OrderRefund[];
}

export interface Customer {
  id: string;
  /** WooCommerce customer id; orders refer to customers by this (0 for guests). */
  wooId: number;
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  registeredDate: string;
  totalOrders: number;
  totalSpent: number;
  billing: Address;
  shipping: Address;
  notes?: string;
}

export type CouponDiscountType = 'percent' | 'fixed_cart' | 'fixed_product';

export interface Coupon {
  id: string;
  code: string;
  discountType: CouponDiscountType;
  amount: number;
  description: string;
  expiryDate?: string;
  usageCount: number;
  usageLimit?: number;
  individualUse: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
  excludeSaleItems: boolean;
  status: 'active' | 'expired' | 'draft';
}

export interface ShippingMethod {
  id: string;
  /** WooCommerce method type, e.g. flat_rate, free_shipping, local_pickup. */
  type: string;
  title: string;
  /** null when the method has no cost setting. */
  cost: number | null;
  enabled: boolean;
  /** undefined when WooCommerce does not report one for this method. */
  taxStatus?: 'taxable' | 'none';
}

export interface ShippingZone {
  id: string;
  name: string;
  regions: string[];
  methods: ShippingMethod[];
}

export interface PaymentGateway {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  methodTitle: string;
  methodDescription: string;
  instructions?: string;
  testMode?: boolean;
}

export interface Transaction {
  id: string;
  orderId: string;
  orderNumber: string;
  customerName: string;
  amount: number;
  currency: string;
  status: 'completed' | 'pending' | 'failed' | 'refunded';
  paymentMethod: string;
  date: string;
  transactionReference: string;
}
