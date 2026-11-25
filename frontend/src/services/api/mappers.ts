import { formatDistanceToNow } from 'date-fns';
import {
  Product,
  Order,
  Customer,
  ProductCategory,
  Coupon,
  OrderStatus,
  OrderItem,
  OrderNote,
  OrderRefund,
  Address,
  ProductStatus,
  ProductType,
  ShippingZone,
  ShippingMethod,
  PaymentGateway,
} from '@/types';
import type { NotificationItem } from '@/store';
import {
  BackendProduct,
  BackendOrder,
  BackendCustomer,
  BackendCategory,
  BackendCoupon,
  BackendAddress,
  BackendOrderNote,
  BackendOrderRefund,
  BackendShippingZone,
  BackendPaymentGateway,
  BackendNotification,
} from './types';

/** Only values the backend actually sent: missing numbers become undefined, never invented. */
const num = (v: string | number | null | undefined): number | undefined => {
  if (v === null || v === undefined || v === '') return undefined;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
};

const toAddress = (a: BackendAddress | undefined): Address => ({
  firstName: a?.first_name ?? '',
  lastName: a?.last_name ?? '',
  company: a?.company ?? '',
  address1: a?.address_1 ?? '',
  address2: a?.address_2 ?? '',
  city: a?.city ?? '',
  state: a?.state ?? '',
  postcode: a?.postcode ?? '',
  country: a?.country ?? '',
  email: a?.email ?? '',
  phone: a?.phone ?? '',
});

export function mapBackendProduct(p: BackendProduct): Product {
  const images = p.gallery?.length
    ? p.gallery.map((g) => ({ id: String(g.id), src: g.src, alt: g.alt || p.name }))
    : p.image_url
    ? [{ id: 'main', src: p.image_url, alt: p.name }]
    : [];

  return {
    id: String(p.id),
    wooId: p.woo_id,
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? '',
    type: p.type as ProductType,
    status: p.status as ProductStatus,
    price: num(p.price),
    regularPrice: num(p.regular_price) ?? num(p.price),
    salePrice: num(p.sale_price),
    manageStock: Boolean(p.manage_stock),
    // Only meaningful when manageStock is true; otherwise stockStatus is the source of truth.
    stockQuantity: p.stock_quantity ?? 0,
    stockStatus: p.stock_status,
    categories: p.categories?.map((c) => c.name) ?? [],
    tags: [],
    images,
    shortDescription: p.short_description ?? '',
    description: p.description ?? '',
    attributes: [],
    variations: [],
    createdAt: p.woo_created_at ?? '',
    updatedAt: p.woo_modified_at ?? p.woo_created_at ?? '',
    featured: Boolean(p.featured),
    lowStockAmount: p.low_stock_amount ?? undefined,
    totalSales: p.total_sales ?? 0,
    revenue: p.revenue ?? 0,
  };
}

export function mapBackendOrderNote(n: BackendOrderNote): OrderNote {
  return {
    id: String(n.id),
    content: n.note,
    date: n.date_created ?? '',
    author: n.customer_note ? 'Note to customer' : n.author,
    isCustomerNote: n.customer_note,
  };
}

export function mapBackendOrderRefund(r: BackendOrderRefund): OrderRefund {
  return {
    id: String(r.id),
    amount: num(r.amount) ?? 0,
    reason: r.reason,
    date: r.date_created ?? '',
  };
}

export function mapBackendOrder(o: BackendOrder): Order {
  const total = num(o.total) ?? 0;
  const shippingTotal = num(o.shipping_total) ?? 0;
  const discountTotal = num(o.discount_total) ?? 0;
  const taxTotal = num(o.total_tax) ?? 0;

  const items: OrderItem[] = (o.items ?? []).map((item) => {
    const lineTotal = num(item.total) ?? 0;
    const lineSubtotal = num(item.subtotal) ?? lineTotal;
    return {
      id: String(item.id),
      productId: String(item.product_woo_id),
      name: item.name,
      sku: item.sku ?? '',
      price: item.quantity > 0 ? lineSubtotal / item.quantity : lineSubtotal,
      quantity: item.quantity,
      subtotal: lineSubtotal,
      total: lineTotal,
      image: item.image_url ?? undefined,
    };
  });

  const billing = toAddress(o.billing);
  // The list columns cover the case where the full address object is not present.
  if (!o.billing) {
    const [first = '', ...rest] = (o.billing_name ?? '').split(' ');
    billing.firstName = first;
    billing.lastName = rest.join(' ');
    billing.city = o.billing_city ?? '';
    billing.state = o.billing_state ?? '';
    billing.email = o.billing_email ?? '';
    billing.phone = o.billing_phone ?? '';
  }
  const shipping = toAddress(o.shipping);

  return {
    id: String(o.id),
    orderNumber: o.number,
    currency: o.currency,
    status: o.status as OrderStatus,
    dateCreated: o.woo_created_at ?? '',
    customerId: String(o.customer_woo_id),
    customerName: o.billing_name ?? '',
    customerEmail: o.billing_email ?? '',
    billing,
    shipping,
    items,
    paymentMethod: o.payment_method ?? '',
    paymentMethodTitle: o.payment_method_title ?? '',
    transactionId: o.transaction_id ?? '',
    datePaid: o.woo_paid_at ?? undefined,
    // The sum of the line subtotals WooCommerce reports (not back-calculated from the totals).
    subtotal: items.length > 0 ? items.reduce((sum, i) => sum + i.subtotal, 0) : undefined,
    shippingTotal,
    discountTotal,
    taxTotal,
    total,
    refundedTotal: num(o.refunded_total) ?? 0,
    courierName: o.courier_name ?? undefined,
    trackingNumber: o.tracking_number ?? undefined,
    dispatchedAt: o.dispatched_at ?? undefined,
    // The customer's own checkout note comes with the order; the rest are loaded on the detail page.
    notes: o.customer_note
      ? [
          {
            id: 'customer-note',
            content: o.customer_note,
            date: o.woo_created_at ?? '',
            author: 'Customer',
            isCustomerNote: true,
          },
        ]
      : [],
    refunds: [],
  };
}

export function mapBackendCustomer(c: BackendCustomer): Customer {
  const billing = toAddress(c.billing);
  if (!c.billing) {
    billing.firstName = c.first_name ?? '';
    billing.lastName = c.last_name ?? '';
    billing.city = c.city ?? '';
    billing.state = c.state ?? '';
    billing.country = c.country ?? '';
    billing.email = c.email ?? '';
    billing.phone = c.phone ?? '';
  }

  return {
    id: String(c.id),
    wooId: c.woo_id,
    firstName: c.first_name ?? '',
    lastName: c.last_name ?? '',
    email: c.email ?? '',
    username: c.username ?? '',
    role: c.role ?? '',
    registeredDate: c.woo_created_at ?? '',
    totalOrders: c.orders_count,
    totalSpent: num(c.total_spent) ?? 0,
    billing,
    shipping: toAddress(c.shipping),
  };
}

export function mapBackendCategory(c: BackendCategory): ProductCategory {
  return {
    id: String(c.id),
    wooId: c.woo_id,
    name: c.name,
    slug: c.slug,
    description: c.description ?? undefined,
    count: c.products_count,
    image: c.image_url ?? undefined,
  };
}

export function mapBackendCoupon(c: BackendCoupon): Coupon {
  const expired = c.expires_at ? new Date(c.expires_at).getTime() < Date.now() : false;

  return {
    id: String(c.id),
    code: c.code,
    discountType: c.discount_type as Coupon['discountType'],
    amount: num(c.amount) ?? 0,
    description: c.description ?? '',
    expiryDate: c.expires_at ?? undefined,
    usageCount: c.usage_count,
    usageLimit: c.usage_limit ?? undefined,
    individualUse: Boolean(c.individual_use),
    minimumAmount: num(c.minimum_amount),
    maximumAmount: num(c.maximum_amount),
    excludeSaleItems: Boolean(c.exclude_sale_items),
    status: c.status === 'publish' ? (expired ? 'expired' : 'active') : 'draft',
  };
}

// ----- Shipping / payments -----

export function mapShippingZone(z: BackendShippingZone): ShippingZone {
  const methods: ShippingMethod[] = z.methods.map((m) => {
    const cost = num(m.settings?.cost?.value as string | undefined);
    const reported = m.settings?.tax_status?.value;
    const taxStatus = reported === 'none' || reported === 'taxable' ? reported : undefined;

    return {
      id: String(m.instance_id),
      type: m.method_id,
      title: m.settings?.title?.value ? String(m.settings.title.value) : m.title,
      cost: cost ?? null,
      enabled: m.enabled,
      taxStatus,
    };
  });

  return {
    id: String(z.id),
    name: z.name,
    // Zone 0 is WooCommerce's "everywhere else" zone and has no region list.
    regions: z.id === 0 ? ['Locations not covered by your other zones'] : z.locations.map((l) => l.code),
    methods,
  };
}

export function mapPaymentGateway(g: BackendPaymentGateway): PaymentGateway {
  const instructions = g.settings?.instructions?.value;
  const testmode = g.settings?.testmode?.value;

  return {
    id: g.id,
    title: g.title,
    description: g.description,
    enabled: g.enabled,
    methodTitle: g.method_title,
    methodDescription: g.method_description,
    instructions: typeof instructions === 'string' ? instructions : undefined,
    testMode: testmode === undefined ? undefined : testmode === 'yes',
  };
}

// ----- Notifications -----

export function mapBackendNotification(n: BackendNotification): NotificationItem {
  const type: NotificationItem['type'] =
    n.type === 'new_order' || n.type === 'order_problem'
      ? 'order'
      : n.type === 'out_of_stock' || n.type === 'low_stock'
      ? 'stock'
      : 'system';

  return {
    id: n.id,
    title: n.title,
    message: n.message,
    time: formatDistanceToNow(new Date(n.created_at), { addSuffix: true }),
    read: n.read,
    type,
    link: n.resource && n.resource_id ? `/${n.resource}/${n.resource_id}` : undefined,
  };
}
