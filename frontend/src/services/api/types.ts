export interface BackendPagination<T> {
  current_page: number;
  data: T[];
  first_page_url: string;
  from: number | null;
  last_page: number;
  last_page_url: string;
  next_page_url: string | null;
  path: string;
  per_page: number;
  prev_page_url: string | null;
  to: number | null;
  total: number;
}

/** WooCommerce address object as the backend returns it. */
export interface BackendAddress {
  first_name?: string;
  last_name?: string;
  company?: string;
  address_1?: string;
  address_2?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  email?: string;
  phone?: string;
}

export interface BackendCategory {
  id: number;
  woo_id: number;
  parent_woo_id: number;
  name: string;
  slug: string;
  description: string | null;
  products_count: number;
  image_url: string | null;
}

export interface BackendProduct {
  id: number;
  woo_id: number;
  name: string;
  slug: string;
  type: string;
  status: string;
  sku: string | null;
  price: string | null;
  regular_price: string | null;
  sale_price: string | null;
  on_sale: boolean;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  manage_stock: boolean;
  stock_quantity: number | null;
  total_sales: number;
  average_rating: string;
  rating_count: number;
  image_url: string | null;
  permalink: string | null;
  woo_created_at: string | null;
  woo_modified_at: string | null;
  categories?: BackendCategory[];
  description?: string | null;
  short_description?: string | null;
  featured?: boolean;
  /** Lifetime revenue from completed and processing orders (computed by the backend). */
  revenue?: number;
  /** The product's own low-stock level in WooCommerce; null means it uses the store-wide setting. */
  low_stock_amount?: number | null;
  gallery?: { id: number; src: string; alt: string }[];
}

export interface BackendOrderItem {
  id: number;
  order_woo_id: number;
  woo_item_id: number;
  product_woo_id: number;
  variation_woo_id: number;
  name: string;
  sku: string | null;
  quantity: number;
  subtotal: string;
  total: string;
  image_url?: string | null;
}

export interface BackendOrder {
  id: number;
  woo_id: number;
  number: string;
  status: string;
  currency: string;
  total: string;
  refunded_total?: string;
  discount_total: string;
  shipping_total: string;
  total_tax: string;
  payment_method: string | null;
  payment_method_title: string | null;
  transaction_id: string | null;
  customer_woo_id: number;
  billing_name: string | null;
  billing_email: string | null;
  billing_phone: string | null;
  billing_city: string | null;
  billing_state: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  customer_note: string | null;
  coupon_codes: string[];
  woo_created_at: string | null;
  woo_paid_at: string | null;
  woo_completed_at: string | null;
  courier_name?: string | null;
  tracking_number?: string | null;
  dispatched_at?: string | null;
  items?: BackendOrderItem[];
  billing?: BackendAddress;
  shipping?: BackendAddress;
}

export interface BackendOrderNote {
  id: number;
  author: string;
  date_created: string | null;
  note: string;
  customer_note: boolean;
}

export interface BackendOrderRefund {
  id: number;
  amount: string;
  reason: string;
  date_created: string | null;
}

export interface BackendCustomer {
  id: number;
  woo_id: number;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  role: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  orders_count: number;
  total_spent: string;
  woo_created_at: string | null;
  billing?: BackendAddress;
  shipping?: BackendAddress;
}

export interface BackendCoupon {
  id: number;
  woo_id: number;
  code: string;
  status: string | null;
  discount_type: string | null;
  amount: string;
  usage_count: number;
  usage_limit: number | null;
  free_shipping: boolean;
  expires_at: string | null;
  description?: string | null;
  individual_use?: boolean;
  minimum_amount?: string | null;
  maximum_amount?: string | null;
  exclude_sale_items?: boolean;
}

export interface BackendDashboardSummary {
  days: number;
  /** Processing + completed orders in the period, minus refunds. */
  revenue: number;
  /** Refunded on those orders (already subtracted from revenue). */
  refunded: number;
  /** Part of revenue from orders WooCommerce has a payment date for. */
  paid_revenue: number;
  /** Part of revenue from orders with no payment date yet (e.g. cash on delivery). */
  unpaid_revenue: number;
  previous_revenue: number;
  orders: number;
  previous_orders: number;
  average_order_value: number;
  awaiting_fulfilment: number;
  customers: number;
  /** Currency of the most recent order; null when there are no orders yet. */
  currency: string | null;
  /** WooCommerce's store-wide low-stock level; null until the backend has read it during an import. */
  low_stock_threshold: number | null;
  published_products: number;
  out_of_stock_products: number;
}

export interface BackendRevenuePoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface BackendTopProduct {
  /** Local product id. */
  id: number;
  product_woo_id: number;
  name: string;
  sku: string | null;
  image_url: string | null;
  total_sales: number;
  revenue: number;
}

export interface BackendSyncLog {
  id: number;
  resource: string;
  status: 'started' | 'completed' | 'failed';
  records_synced: number;
  error: string | null;
  created_at: string;
}

// ----- Store configuration (read live from WooCommerce) -----

/** A WooCommerce "setting" object: gateway/shipping-method options and settings-group entries. */
export interface BackendSetting {
  id: string;
  label: string;
  description?: string;
  type: string;
  value: string | string[] | Record<string, unknown>;
  default?: string;
  tip?: string;
  options?: Record<string, string>;
  redacted?: boolean;
}

export interface BackendSettingsGroup {
  id: string;
  label: string;
  description?: string;
}

export interface BackendShippingMethod {
  id: number;
  instance_id: number;
  title: string;
  enabled: boolean;
  method_id: string;
  method_title: string;
  settings?: Record<string, BackendSetting>;
}

export interface BackendShippingZone {
  id: number;
  name: string;
  order: number;
  locations: { code: string; type: string }[];
  methods: BackendShippingMethod[];
}

export interface BackendPaymentGateway {
  id: string;
  title: string;
  description: string;
  order: number | string;
  enabled: boolean;
  method_title: string;
  method_description: string;
  settings?: Record<string, BackendSetting>;
}

// ----- Notifications -----

export interface BackendNotification {
  id: string;
  type: 'new_order' | 'order_problem' | 'out_of_stock' | 'low_stock' | 'sync_failed' | 'write_failed';
  severity: 'info' | 'warning' | 'danger';
  title: string;
  message: string;
  resource: 'orders' | 'products' | null;
  resource_id: number | null;
  created_at: string;
  read: boolean;
}

// ----- Reports -----

export interface BackendSalesReport {
  from: string;
  to: string;
  group_by: 'day' | 'week' | 'month';
  totals: {
    orders: number;
    gross_sales: number;
    refunds: number;
    discounts: number;
    shipping: number;
    tax: number;
    items_sold: number;
    net_sales: number;
    average_order_value: number;
  };
  data: {
    period: string;
    orders: number;
    gross_sales: number;
    discounts: number;
    shipping: number;
    tax: number;
    net_sales: number;
  }[];
}

export interface BackendCategoryReportRow {
  category_woo_id: number;
  name: string;
  orders: number;
  units: number;
  revenue: number;
}

export interface BackendProductReportRow {
  product_woo_id: number;
  name: string;
  orders: number;
  units: number;
  revenue: number;
}

export interface BackendCustomerReportRow {
  email: string;
  name: string | null;
  orders: number;
  total_spent: number;
  last_order_at: string;
}

// ----- Store-change switches -----

export interface BackendWriteSwitch {
  key: string;
  label: string;
  enabled: boolean;
}

export interface BackendWriteSettings {
  /** Whether the signed-in user may flip the switches. */
  can_manage: boolean;
  master: BackendWriteSwitch;
  permanent_delete: BackendWriteSwitch;
  capabilities: (BackendWriteSwitch & { group: string })[];
}
