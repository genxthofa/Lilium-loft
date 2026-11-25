import { create } from 'zustand';
import { toast } from 'sonner';
import {
  Product,
  ProductType,
  ProductStatus,
  StockStatus,
  Order,
  Customer,
  Coupon,
  ShippingZone,
  PaymentGateway,
  OrderStatus,
  ShippingMethod,
  ProductCategory,
  Address,
} from '@/types';
import { setDisplayCurrency } from '@/utils/formatters';
import {
  ApiError,
  authApi,
  productsApi,
  ordersApi,
  customersApi,
  categoriesApi,
  couponsApi,
  dashboardApi,
  DashboardDateParams,
  shippingApi,
  paymentsApi,
  settingsApi,
  notificationsApi,
  syncApi,
  writeSettingsApi,
  BackendWriteSettings,
  StoreImportResult,
  mapBackendProduct,
  mapBackendOrder,
  mapBackendOrderNote,
  mapBackendOrderRefund,
  mapBackendCustomer,
  mapBackendCategory,
  mapBackendCoupon,
  mapShippingZone,
  mapPaymentGateway,
  mapBackendNotification,
  BackendDashboardSummary,
  BackendRevenuePoint,
  BackendTopProduct,
  BackendSetting,
  BackendSettingsGroup,
  getStoredToken,
} from '@/services/api';

// Nothing here is cached in the browser and nothing has a built-in default:
// every list starts empty and is filled only from what the backend returns.
// Reads never raise toasts; they just leave the list empty (or as it was) and record `error`.
// Writes call the backend first and refetch afterwards; they throw so the page can show a toast.

const readError = (err: unknown, fallback: string) => (err instanceof ApiError && err.message ? err.message : fallback);

/** The biggest list we will load (pages of 100). Far beyond a normal store, but it stops a runaway loop. */
const MAX_PAGES = 100;

/**
 * Loads EVERY page of a list, so counts and totals on screen describe the whole store
 * and not just the first 100 records.
 */
async function fetchAllPages<T>(load: (page: number) => Promise<{ data: T[]; last_page: number }>): Promise<T[]> {
  const all: T[] = [];
  let page = 1;
  let last = 1;
  do {
    const res = await load(page);
    all.push(...(res.data ?? []));
    last = res.last_page ?? 1;
    page += 1;
  } while (page <= last && page <= MAX_PAGES);
  return all;
}

/** Options for the list loaders. `silent` is used by background updates: no loading flag, no error state. */
export interface FetchOptions {
  silent?: boolean;
}

/**
 * Returns the previous list itself when nothing changed, and otherwise reuses every unchanged item,
 * so a background refresh re-renders only the rows that really changed (and nothing at all if none did).
 */
function keepUnchanged<T extends { id: string }>(prev: T[], next: T[]): T[] {
  const old = new Map(prev.map((p) => [p.id, p]));
  let identical = prev.length === next.length;

  const merged = next.map((n, i) => {
    const p = old.get(n.id);
    if (p && JSON.stringify(p) === JSON.stringify(n)) {
      if (prev[i] !== p) identical = false;
      return p;
    }
    identical = false;
    return n;
  });

  return identical ? prev : merged;
}

// ================= PRODUCT STORE =================
/** What the product form collects. */
export interface ProductInput {
  name: string;
  slug?: string;
  sku: string;
  type: ProductType;
  status: ProductStatus;
  regularPrice?: number;
  salePrice?: number;
  manageStock: boolean;
  stockQuantity: number;
  stockStatus: StockStatus;
  categories: string[];
  shortDescription: string;
  description: string;
  images: string[];
}

/** Builds the request body. On update only the fields that changed are sent. */
function buildProductPayload(next: ProductInput, prev: Product | null, categories: ProductCategory[]) {
  const payload: Record<string, unknown> = {};
  const changed = <T,>(a: T, b: T | undefined) => !prev || a !== b;

  if (changed(next.name, prev?.name)) payload.name = next.name;
  if (next.slug && changed(next.slug, prev?.slug)) payload.slug = next.slug;
  if (changed(next.sku, prev?.sku)) payload.sku = next.sku;
  if (changed(next.status, prev?.status)) payload.status = next.status;
  if (changed(next.shortDescription, prev?.shortDescription)) payload.short_description = next.shortDescription;
  if (changed(next.description, prev?.description)) payload.description = next.description;

  // Variable products keep prices on their variations, which this API does not edit.
  if (next.type === 'simple') {
    if (next.regularPrice !== undefined && changed(next.regularPrice, prev?.regularPrice)) {
      payload.regular_price = String(next.regularPrice);
    }
    if (changed(next.salePrice, prev?.salePrice) && (prev || next.salePrice !== undefined)) {
      payload.sale_price = next.salePrice === undefined ? null : String(next.salePrice);
    }
  }

  if (changed(next.manageStock, prev?.manageStock)) payload.manage_stock = next.manageStock;
  if (next.manageStock && changed(next.stockQuantity, prev?.stockQuantity)) payload.stock_quantity = next.stockQuantity;
  if (changed(next.stockStatus, prev?.stockStatus)) payload.stock_status = next.stockStatus;

  const prevCats = [...(prev?.categories ?? [])].sort().join('|');
  if (!prev || [...next.categories].sort().join('|') !== prevCats) {
    payload.categories = next.categories
      .map((name) => categories.find((c) => c.name === name)?.wooId)
      .filter((id): id is number => typeof id === 'number');
  }

  const prevImages = (prev?.images ?? []).map((i) => i.src).join('|');
  if (!prev ? next.images.length > 0 : next.images.join('|') !== prevImages) {
    payload.images = next.images;
  }

  return payload;
}

interface ProductStore {
  products: Product[];
  isLoading: boolean;
  /** True once the first load has finished (so a page can tell "still loading" from "not found"). */
  loaded: boolean;
  error: string | null;
  fetchProducts: (opts?: FetchOptions) => Promise<void>;
  /** Returns the new product's id (null if the backend could not give one yet). */
  createProduct: (input: ProductInput) => Promise<string | null>;
  updateProduct: (id: string, input: ProductInput) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  adjustStock: (id: string, quantity: number, type: 'set' | 'add' | 'subtract') => Promise<void>;
}

function notifyLiveStoreSync(title: string, description: string) {
  useBackendSyncStore.getState().refreshDashboard().catch(() => {});
  useUIStore.getState().fetchNotifications().catch(() => {});
  toast.success(title, {
    id: 'live-action-popup',
    description,
  });
}

export const useProductStore = create<ProductStore>((set, get) => ({
  products: [],
  isLoading: false,
  loaded: false,
  error: null,
  fetchProducts: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const rows = await fetchAllPages((page) => productsApi.list({ per_page: 100, page }));
      const products = keepUnchanged(get().products, rows.map(mapBackendProduct));
      set(silent ? { products, loaded: true } : { products, isLoading: false, loaded: true });
    } catch (err) {
      console.warn('Failed to fetch products:', err);
      set({ loaded: true });
      if (!silent) set({ isLoading: false, error: readError(err, 'Failed to fetch products') });
    }
  },
  createProduct: async (input) => {
    const payload = buildProductPayload(input, null, useCategoryStore.getState().categories);
    const created = await productsApi.create(payload);
    await get().fetchProducts();
    notifyLiveStoreSync('Product Created', `"${input.name}" added live to store.`);
    return created?.id ? String(created.id) : null;
  },
  updateProduct: async (id, input) => {
    const prev = get().products.find((p) => p.id === id) ?? null;
    const payload = buildProductPayload(input, prev, useCategoryStore.getState().categories);
    if (Object.keys(payload).length > 0) {
      await productsApi.update(id, payload);
    }
    await get().fetchProducts();
    notifyLiveStoreSync('Product Updated', `"${input.name || prev?.name || 'Product'}" updated live.`);
  },
  deleteProduct: async (id) => {
    const prev = get().products.find((p) => p.id === id);
    await productsApi.remove(id);
    await get().fetchProducts();
    notifyLiveStoreSync('Product Deleted', `"${prev?.name || 'Product'}" removed live from store.`);
  },
  adjustStock: async (id, quantity, type) => {
    const product = get().products.find((p) => p.id === id);
    if (!product) throw new Error('Product not found.');

    let next = product.stockQuantity;
    if (type === 'set') next = quantity;
    else if (type === 'add') next += quantity;
    else next = Math.max(0, next - quantity);

    await productsApi.update(id, {
      manage_stock: true,
      stock_quantity: next,
      stock_status: next > 0 ? 'instock' : 'outofstock',
    });
    await get().fetchProducts();
    notifyLiveStoreSync('Stock Updated', `"${product.name}" stock set to ${next} units.`);
  },
}));

// ================= ORDER STORE =================
interface OrderStore {
  orders: Order[];
  isLoading: boolean;
  loaded: boolean;
  error: string | null;
  fetchOrders: (opts?: FetchOptions) => Promise<void>;
  /** Loads the notes and refunds recorded in WooCommerce for one order. */
  loadOrderDetails: (id: string) => Promise<void>;
  updateOrderStatus: (
    id: string,
    status: OrderStatus,
    dispatchInfo?: { courierName?: string; trackingNumber?: string }
  ) => Promise<void>;
  addOrderNote: (orderId: string, content: string, isCustomerNote: boolean) => Promise<void>;
  refundOrder: (orderId: string, amount: number, reason: string) => Promise<void>;
}

export const useOrderStore = create<OrderStore>((set, get) => {
  const replace = (order: Order) =>
    set({
      orders: get().orders.map((o) =>
        o.id === order.id ? { ...order, notes: o.notes, refunds: o.refunds } : o
      ),
    });

  return {
    orders: [],
    isLoading: false,
    loaded: false,
    error: null,
    fetchOrders: async ({ silent = false } = {}) => {
      if (!silent) set({ isLoading: true, error: null });
      try {
        const rows = await fetchAllPages((page) => ordersApi.list({ per_page: 100, with_items: 1, page }));
        // Notes and refunds are loaded per order; keep what is already loaded so a refresh does not blank them.
        const loaded = new Map(get().orders.map((o) => [o.id, o]));
        const orders = rows.map(mapBackendOrder).map((o) => {
          const prev = loaded.get(o.id);
          return prev ? { ...o, notes: prev.notes, refunds: prev.refunds } : o;
        });
        const merged = keepUnchanged(get().orders, orders);
        set(silent ? { orders: merged, loaded: true } : { orders: merged, isLoading: false, loaded: true });
      } catch (err) {
        console.warn('Failed to fetch orders:', err);
        set({ loaded: true });
        if (!silent) set({ isLoading: false, error: readError(err, 'Failed to fetch orders') });
      }
    },
    loadOrderDetails: async (id) => {
      try {
        const [notes, refunds] = await Promise.all([ordersApi.notes(id), ordersApi.refunds(id)]);
        set({
          orders: get().orders.map((o) => {
            if (o.id !== id) return o;
            const customerCheckoutNote = o.notes.filter((n) => n.id === 'customer-note');
            return {
              ...o,
              notes: [...customerCheckoutNote, ...notes.map(mapBackendOrderNote)],
              refunds: refunds.map(mapBackendOrderRefund),
            };
          }),
        });
      } catch (err) {
        console.warn('Failed to load order notes/refunds:', err);
      }
    },
    updateOrderStatus: async (id, status, dispatchInfo) => {
      const updated = await ordersApi.setStatus(id, status, dispatchInfo);
      const mapped = mapBackendOrder(updated);
      replace(mapped);
      await get().loadOrderDetails(id);
      notifyLiveStoreSync('Order Updated', `Order #${mapped.orderNumber} status updated live.`);
    },
    addOrderNote: async (orderId, content, isCustomerNote) => {
      await ordersApi.addNote(orderId, content, isCustomerNote);
      await get().loadOrderDetails(orderId);
    },
    refundOrder: async (orderId, amount, reason) => {
      await ordersApi.addRefund(orderId, amount, reason);
      try {
        replace(mapBackendOrder(await ordersApi.get(orderId)));
      } catch (err) {
        console.warn('Failed to refresh order after refund:', err);
      }
      await get().loadOrderDetails(orderId);
      notifyLiveStoreSync('Order Updated', `Refund processed live for order.`);
    },
  };
});

// ================= CUSTOMER STORE =================
/** What the customer forms collect. */
export interface CustomerInput {
  firstName: string;
  lastName: string;
  email?: string;
  username?: string;
  phone?: string;
  address1?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

const customerPayload = (c: CustomerInput): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    first_name: c.firstName,
    last_name: c.lastName,
  };
  if (c.email) payload.email = c.email;
  if (c.username) payload.username = c.username;
  if (c.phone !== undefined) payload.phone = c.phone;
  if (c.address1 !== undefined) payload.address_1 = c.address1;
  if (c.city !== undefined) payload.city = c.city;
  if (c.state !== undefined) payload.state = c.state;
  if (c.postcode !== undefined) payload.postcode = c.postcode;
  // The API wants a 2-letter country code; leave it out rather than send free text.
  if (c.country && /^[A-Za-z]{2}$/.test(c.country)) payload.country = c.country.toUpperCase();
  return payload;
};

interface CustomerStore {
  customers: Customer[];
  isLoading: boolean;
  loaded: boolean;
  error: string | null;
  fetchCustomers: (opts?: FetchOptions) => Promise<void>;
  createCustomer: (input: CustomerInput) => Promise<string | null>;
  updateCustomerAddress: (id: string, address: Address) => Promise<void>;
  deleteCustomer: (id: string) => Promise<void>;
}

export const useCustomerStore = create<CustomerStore>((set, get) => ({
  customers: [],
  isLoading: false,
  loaded: false,
  error: null,
  fetchCustomers: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const rows = await fetchAllPages((page) => customersApi.list({ per_page: 100, page }));
      const customers = keepUnchanged(get().customers, rows.map(mapBackendCustomer));
      set(silent ? { customers, loaded: true } : { customers, isLoading: false, loaded: true });
    } catch (err) {
      console.warn('Failed to fetch customers:', err);
      set({ loaded: true });
      if (!silent) set({ isLoading: false, error: readError(err, 'Failed to fetch customers') });
    }
  },
  createCustomer: async (input) => {
    const created = await customersApi.create(customerPayload(input));
    await get().fetchCustomers();
    return created?.id ? String(created.id) : null;
  },
  updateCustomerAddress: async (id, address) => {
    await customersApi.update(
      id,
      customerPayload({
        firstName: address.firstName,
        lastName: address.lastName,
        phone: address.phone ?? '',
        address1: address.address1,
        city: address.city,
        state: address.state,
        postcode: address.postcode,
        country: address.country,
      })
    );
    await get().fetchCustomers();
  },
  deleteCustomer: async (id) => {
    await customersApi.remove(id);
    await get().fetchCustomers();
  },
}));

// ================= CATEGORY STORE =================
interface CategoryStore {
  categories: ProductCategory[];
  isLoading: boolean;
  error: string | null;
  fetchCategories: (opts?: FetchOptions) => Promise<void>;
  createCategory: (input: { name: string; slug?: string; description?: string; image?: string }) => Promise<void>;
  /** Only the fields in `changes` are sent to WooCommerce. */
  updateCategory: (id: string, changes: { name?: string; slug?: string; description?: string; image?: string }) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
}

export const useCategoryStore = create<CategoryStore>((set, get) => ({
  categories: [],
  isLoading: false,
  error: null,
  fetchCategories: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const rows = await fetchAllPages((page) => categoriesApi.list(undefined, 100, page));
      const categories = keepUnchanged(get().categories, rows.map(mapBackendCategory));
      set(silent ? { categories } : { categories, isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch categories:', err);
      if (!silent) set({ isLoading: false, error: readError(err, 'Failed to fetch categories') });
    }
  },
  createCategory: async ({ name, slug, description, image }) => {
    const payload: Record<string, unknown> = { name };
    if (slug) payload.slug = slug;
    if (description) payload.description = description;
    if (image) payload.image = image;
    await categoriesApi.create(payload);
    await get().fetchCategories();
  },
  updateCategory: async (id, changes) => {
    await categoriesApi.update(id, changes);
    await get().fetchCategories();
  },
  deleteCategory: async (id) => {
    await categoriesApi.remove(id);
    await get().fetchCategories();
  },
}));

// ================= COUPON STORE =================
/** What the coupon form collects. */
export interface CouponInput {
  code: string;
  discountType: Coupon['discountType'];
  amount: number;
  description: string;
  expiryDate?: string;
  usageLimit?: number;
  individualUse: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
  excludeSaleItems: boolean;
}

const couponPayload = (c: CouponInput): Record<string, unknown> => ({
  code: c.code,
  discount_type: c.discountType,
  amount: String(c.amount),
  description: c.description,
  date_expires: c.expiryDate ? c.expiryDate : null,
  usage_limit: c.usageLimit ? c.usageLimit : null,
  individual_use: c.individualUse,
  minimum_amount: c.minimumAmount ? String(c.minimumAmount) : null,
  maximum_amount: c.maximumAmount ? String(c.maximumAmount) : null,
  exclude_sale_items: c.excludeSaleItems,
});

interface CouponStore {
  coupons: Coupon[];
  isLoading: boolean;
  error: string | null;
  fetchCoupons: (opts?: FetchOptions) => Promise<void>;
  createCoupon: (input: CouponInput) => Promise<void>;
  updateCoupon: (id: string, input: CouponInput) => Promise<void>;
  deleteCoupon: (id: string) => Promise<void>;
}

export const useCouponStore = create<CouponStore>((set, get) => ({
  coupons: [],
  isLoading: false,
  error: null,
  fetchCoupons: async ({ silent = false } = {}) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const rows = await fetchAllPages((page) => couponsApi.list(undefined, 100, page));
      const coupons = keepUnchanged(get().coupons, rows.map(mapBackendCoupon));
      set(silent ? { coupons } : { coupons, isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch coupons:', err);
      if (!silent) set({ isLoading: false, error: readError(err, 'Failed to fetch coupons') });
    }
  },
  createCoupon: async (input) => {
    // The form has no draft option, so a coupon created here is live, as before.
    await couponsApi.create({ ...couponPayload(input), status: 'publish' });
    await get().fetchCoupons();
  },
  updateCoupon: async (id, input) => {
    await couponsApi.update(id, couponPayload(input));
    await get().fetchCoupons();
  },
  deleteCoupon: async (id) => {
    await couponsApi.remove(id);
    await get().fetchCoupons();
  },
}));

// ================= SHIPPING & PAYMENT STORES =================
export interface ShippingMethodInput {
  type: string;
  title: string;
  cost: number;
  enabled: boolean;
  taxStatus: ShippingMethod['taxStatus'];
}

interface ShippingStore {
  shippingZones: ShippingZone[];
  isLoading: boolean;
  error: string | null;
  fetchShipping: () => Promise<void>;
  addShippingMethod: (zoneId: string, method: ShippingMethodInput) => Promise<void>;
  updateShippingMethod: (
    zoneId: string,
    methodId: string,
    updates: Partial<Pick<ShippingMethodInput, 'title' | 'cost' | 'enabled' | 'taxStatus'>>
  ) => Promise<void>;
  deleteShippingMethod: (zoneId: string, methodId: string) => Promise<void>;
}

const shippingMethodPayload = (m: Partial<ShippingMethodInput>): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  if (m.title !== undefined) payload.title = m.title;
  if (m.taxStatus !== undefined) payload.tax_status = m.taxStatus;
  if (m.enabled !== undefined) payload.enabled = m.enabled;
  if (m.cost !== undefined) payload.cost = m.cost;
  return payload;
};

export const useShippingStore = create<ShippingStore>((set, get) => ({
  shippingZones: [],
  isLoading: false,
  error: null,
  fetchShipping: async () => {
    set({ isLoading: true, error: null });
    try {
      const zones = await shippingApi.zones();
      set({ shippingZones: zones.map(mapShippingZone), isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch shipping zones:', err);
      set({ isLoading: false, error: readError(err, 'Failed to fetch shipping zones') });
    }
  },
  addShippingMethod: async (zoneId, method) => {
    // Only flat-rate methods have a cost field; free shipping and pickup do not.
    const body = shippingMethodPayload({ ...method, cost: method.type === 'flat_rate' ? method.cost : undefined });
    await shippingApi.addMethod(zoneId, { method_id: method.type, ...body });
    await get().fetchShipping();
  },
  updateShippingMethod: async (zoneId, methodId, updates) => {
    await shippingApi.updateMethod(zoneId, methodId, shippingMethodPayload(updates));
    await get().fetchShipping();
  },
  deleteShippingMethod: async (zoneId, methodId) => {
    await shippingApi.removeMethod(zoneId, methodId);
    await get().fetchShipping();
  },
}));

interface PaymentStore {
  gateways: PaymentGateway[];
  isLoading: boolean;
  error: string | null;
  fetchGateways: () => Promise<void>;
  toggleGateway: (id: string, enabled: boolean) => Promise<void>;
  updateGateway: (id: string, updates: { title: string; description: string; instructions?: string }) => Promise<void>;
}

export const usePaymentStore = create<PaymentStore>((set, get) => ({
  gateways: [],
  isLoading: false,
  error: null,
  fetchGateways: async () => {
    set({ isLoading: true, error: null });
    try {
      const gateways = await paymentsApi.list();
      set({ gateways: gateways.map(mapPaymentGateway), isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch payment gateways:', err);
      set({ isLoading: false, error: readError(err, 'Failed to fetch payment gateways') });
    }
  },
  toggleGateway: async (id, enabled) => {
    await paymentsApi.update(id, { enabled });
    await get().fetchGateways();
  },
  updateGateway: async (id, updates) => {
    const payload: Record<string, unknown> = { title: updates.title, description: updates.description };
    if (updates.instructions !== undefined) payload.instructions = updates.instructions;
    await paymentsApi.update(id, payload);
    await get().fetchGateways();
  },
}));

// ================= SETTINGS STORE =================
interface SettingsStore {
  groups: BackendSettingsGroup[];
  /** Every setting of each group that has been opened, as WooCommerce returned it. */
  settings: Record<string, BackendSetting[]>;
  isLoading: boolean;
  error: string | null;
  fetchGroups: () => Promise<void>;
  fetchGroup: (id: string) => Promise<void>;
  saveGroup: (id: string, changes: Record<string, string | boolean | string[]>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  groups: [],
  settings: {},
  isLoading: false,
  error: null,
  fetchGroups: async () => {
    set({ isLoading: true, error: null });
    try {
      set({ groups: await settingsApi.groups(), isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch settings groups:', err);
      set({ isLoading: false, error: readError(err, 'Failed to fetch settings') });
    }
  },
  fetchGroup: async (id) => {
    try {
      const rows = await settingsApi.group(id);
      set({ settings: { ...get().settings, [id]: rows } });
    } catch (err) {
      console.warn(`Failed to fetch settings group ${id}:`, err);
    }
  },
  saveGroup: async (id, changes) => {
    await settingsApi.update(id, changes);
    await get().fetchGroup(id);
  },
}));

// ================= STORE-CHANGE SWITCHES =================
interface WriteSettingsStore {
  data: BackendWriteSettings | null;
  isLoading: boolean;
  fetchSettings: () => Promise<void>;
  /** Turns one switch on or off. Throws if the backend refuses (e.g. the user may not change it). */
  setSwitch: (key: string, enabled: boolean) => Promise<void>;
}

export const useWriteSettingsStore = create<WriteSettingsStore>((set) => ({
  data: null,
  isLoading: false,
  fetchSettings: async () => {
    set({ isLoading: true });
    try {
      set({ data: await writeSettingsApi.get(), isLoading: false });
    } catch (err) {
      console.warn('Failed to fetch store-change settings:', err);
      set({ isLoading: false });
    }
  },
  setSwitch: async (key, enabled) => {
    set({ data: await writeSettingsApi.set(key, enabled) });
  },
}));

// ================= UI STORE =================
export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: 'order' | 'stock' | 'system';
  link?: string;
}

const GENERATED_INVOICES_KEY = 'lilium_generated_invoices';

function loadGeneratedInvoices(): string[] {
  try {
    const raw = localStorage.getItem(GENERATED_INVOICES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function saveGeneratedInvoices(ids: string[]) {
  try {
    localStorage.setItem(GENERATED_INVOICES_KEY, JSON.stringify(ids));
  } catch {
    // ignore quota errors
  }
}

interface UIStore {
  sidebarCollapsed: boolean;
  mobileMenuOpen: boolean;
  searchOpen: boolean;
  isManualSyncing: boolean;
  notifications: NotificationItem[];
  generatedInvoiceIds: string[];
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setMobileMenuOpen: (open: boolean) => void;
  setSearchOpen: (open: boolean) => void;
  setIsManualSyncing: (val: boolean) => void;
  generateInvoice: (orderId: string | number) => void;
  generateBulkInvoices: (orderIds: Array<string | number>) => void;
  isInvoiceGenerated: (orderId: string | number) => boolean;
  fetchNotifications: () => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
}

export const useUIStore = create<UIStore>((set, get) => ({
  sidebarCollapsed: false,
  mobileMenuOpen: false,
  searchOpen: false,
  isManualSyncing: false,
  notifications: [],
  generatedInvoiceIds: loadGeneratedInvoices(),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setIsManualSyncing: (val) => set({ isManualSyncing: val }),
  generateInvoice: (orderId) => {
    const key = String(orderId);
    const current = get().generatedInvoiceIds;
    if (!current.includes(key)) {
      const next = [...current, key];
      saveGeneratedInvoices(next);
      set({ generatedInvoiceIds: next });
    }
  },
  generateBulkInvoices: (orderIds) => {
    const current = new Set(get().generatedInvoiceIds);
    let changed = false;
    for (const id of orderIds) {
      const key = String(id);
      if (!current.has(key)) {
        current.add(key);
        changed = true;
      }
    }
    if (changed) {
      const next = Array.from(current);
      saveGeneratedInvoices(next);
      set({ generatedInvoiceIds: next });
    }
  },
  isInvoiceGenerated: (orderId) => get().generatedInvoiceIds.includes(String(orderId)),
  fetchNotifications: async () => {
    try {
      const res = await notificationsApi.list();
      const next = res.data.map(mapBackendNotification);
      if (JSON.stringify(next) !== JSON.stringify(get().notifications)) set({ notifications: next });
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  },
  markNotificationRead: async (id) => {
    set({ notifications: get().notifications.map((n) => (n.id === id ? { ...n, read: true } : n)) });
    try {
      await notificationsApi.markRead([id]);
    } catch {
      await get().fetchNotifications();
    }
  },
  markAllNotificationsRead: async () => {
    set({ notifications: get().notifications.map((n) => ({ ...n, read: true })) });
    try {
      await notificationsApi.markAllRead();
    } catch {
      await get().fetchNotifications();
    }
  },
}));

// ================= BACKEND SYNC STORE =================
export interface BackendSyncState {
  status: 'idle' | 'syncing' | 'connected' | 'offline' | 'error';
  lastSynced: string | null;
  errorMessage: string | null;
  currentUser: { id: number; name: string; email: string } | null;
  summary: BackendDashboardSummary | null;
  revenueHistory: BackendRevenuePoint[];
  topProducts: BackendTopProduct[];
  ordersByStatus: Record<string, number>;
  /** The period (in days) the dashboard numbers cover. */
  dashboardDays: number;
  syncAll: () => Promise<boolean>;
  /** Reloads only the dashboard numbers (summary, chart, top products); accepts days or custom date range params. */
  refreshDashboard: (params?: number | string | DashboardDateParams) => Promise<void>;
  /** Pulls everything from WooCommerce into the backend database, then reloads every screen from it. */
  importFromStore: () => Promise<StoreImportResult>;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
}

/** Empty every store, so nothing from a previous session can show up. */
const clearAllData = () => {
  useProductStore.setState({ products: [], error: null, loaded: false });
  useOrderStore.setState({ orders: [], error: null, loaded: false });
  useCustomerStore.setState({ customers: [], error: null, loaded: false });
  useCategoryStore.setState({ categories: [], error: null });
  useCouponStore.setState({ coupons: [], error: null });
  useShippingStore.setState({ shippingZones: [], error: null });
  usePaymentStore.setState({ gateways: [], error: null });
  useSettingsStore.setState({ groups: [], settings: {}, error: null });
  useWriteSettingsStore.setState({ data: null });
  useUIStore.setState({ notifications: [] });
  setDisplayCurrency(null);
};

export const useBackendSyncStore = create<BackendSyncState>((set, get) => ({
  status: 'idle',
  lastSynced: null,
  errorMessage: null,
  currentUser: null,
  summary: null,
  revenueHistory: [],
  topProducts: [],
  ordersByStatus: {},
  dashboardDays: 1,

  login: async (email, password) => {
    set({ status: 'syncing', errorMessage: null });
    try {
      await authApi.login(email, password);
      const user = await authApi.me();
      set({ currentUser: user });

      // When an admin signs in, ensure all store permissions are enabled by default.
      try {
        let ws = await writeSettingsApi.get();
        if (ws.can_manage) {
          const keysToEnable: string[] = [];
          if (!ws.master.enabled) keysToEnable.push(ws.master.key);
          if (!ws.permanent_delete.enabled) keysToEnable.push(ws.permanent_delete.key);
          for (const sw of ws.capabilities) {
            if (!sw.enabled) keysToEnable.push(sw.key);
          }
          for (const key of keysToEnable) {
            ws = await writeSettingsApi.set(key, true);
          }
          useWriteSettingsStore.setState({ data: ws });
        }
      } catch (err) {
        console.warn('Could not auto-enable default admin permissions:', err);
      }

      await get().syncAll();
      return true;
    } catch (err) {
      set({ status: 'error', errorMessage: readError(err, 'Login failed') });
      return false;
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // the token is cleared either way
    }
    clearAllData();
    set({
      currentUser: null,
      status: 'offline',
      summary: null,
      revenueHistory: [],
      topProducts: [],
      ordersByStatus: {},
      lastSynced: null,
    });
  },

  refreshDashboard: async (params) => {
    let queryParam: number | string | DashboardDateParams = params ?? get().dashboardDays;
    if (typeof params === 'number') {
      set({ dashboardDays: params });
    }
    try {
      const [summary, revenueHistory, ordersByStatus, topProducts] = await Promise.all([
        dashboardApi.getSummary(queryParam),
        dashboardApi.getRevenue(queryParam),
        dashboardApi.getOrdersByStatus(),
        dashboardApi.getTopProducts(),
      ]);
      const cur = get();
      const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
      const patch: Partial<BackendSyncState> = {};
      if (!same(cur.summary, summary)) {
        setDisplayCurrency(summary.currency);
        patch.summary = summary;
      }
      if (!same(cur.revenueHistory, revenueHistory ?? [])) patch.revenueHistory = revenueHistory ?? [];
      if (!same(cur.ordersByStatus, ordersByStatus ?? {})) patch.ordersByStatus = ordersByStatus ?? {};
      if (!same(cur.topProducts, topProducts ?? [])) patch.topProducts = topProducts ?? [];
      if (Object.keys(patch).length > 0) set(patch);
    } catch (err) {
      console.warn('Dashboard refresh failed:', err);
    }
  },

  importFromStore: async () => {
    set({ status: 'syncing', errorMessage: null });
    try {
      const result = await syncApi.run();
      await get().syncAll();
      return result;
    } catch (err) {
      set({
        status: get().currentUser ? 'connected' : 'offline',
        errorMessage: readError(err, 'Import from WooCommerce failed'),
      });
      throw err;
    }
  },

  syncAll: async () => {
    set({ status: 'syncing', errorMessage: null });
    try {
      if (!getStoredToken()) {
        set({ status: 'offline' });
        return false;
      }

      if (!get().currentUser) {
        try {
          set({ currentUser: await authApi.me() });
        } catch (err) {
          // Only an expired or invalid token ends the session; a network error must not log anyone out.
          if (err instanceof ApiError && err.status === 401) {
            authApi.logout().catch(() => undefined);
            clearAllData();
            set({ currentUser: null, status: 'offline' });
          } else {
            set({ status: 'offline', errorMessage: readError(err, 'Could not connect to backend API') });
          }
          return false;
        }
      }

      const [dash, ...lists] = await Promise.allSettled([
        Promise.all([
          dashboardApi.getSummary(get().dashboardDays),
          dashboardApi.getRevenue(get().dashboardDays),
          dashboardApi.getOrdersByStatus(),
          dashboardApi.getTopProducts(),
        ]),
        useProductStore.getState().fetchProducts(),
        useOrderStore.getState().fetchOrders(),
        useCustomerStore.getState().fetchCustomers(),
        useCategoryStore.getState().fetchCategories(),
        useCouponStore.getState().fetchCoupons(),
        useUIStore.getState().fetchNotifications(),
      ]);
      void lists;

      if (dash.status === 'fulfilled') {
        const [summary, revenueHistory, ordersByStatus, topProducts] = dash.value;
        setDisplayCurrency(summary.currency);
        set({ summary, revenueHistory: revenueHistory ?? [], ordersByStatus: ordersByStatus ?? {}, topProducts: topProducts ?? [] });
      } else {
        console.warn('Dashboard fetch error:', dash.reason);
        set({ summary: null, revenueHistory: [], ordersByStatus: {}, topProducts: [] });
      }

      set({ status: 'connected', lastSynced: new Date().toISOString(), errorMessage: null });
      return true;
    } catch (err) {
      console.warn('Backend sync failed:', err);
      set({ status: 'offline', errorMessage: readError(err, 'Could not connect to backend API') });
      return false;
    }
  },
}));
