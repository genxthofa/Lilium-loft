import { apiClient, setStoredToken, getStoredToken } from './client';
import {
  BackendPagination,
  BackendProduct,
  BackendOrder,
  BackendCustomer,
  BackendCategory,
  BackendCoupon,
  BackendDashboardSummary,
  BackendRevenuePoint,
  BackendTopProduct,
  BackendSyncLog,
  BackendOrderNote,
  BackendOrderRefund,
  BackendShippingZone,
  BackendPaymentGateway,
  BackendSettingsGroup,
  BackendSetting,
  BackendNotification,
  BackendSalesReport,
  BackendCategoryReportRow,
  BackendProductReportRow,
  BackendCustomerReportRow,
  BackendWriteSettings,
} from './types';

const json = (body: unknown) => JSON.stringify(body);

export interface LoginResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

export interface UserResponse {
  id: number;
  name: string;
  email: string;
}

// ----------------- Auth -----------------
export const authApi = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await apiClient<LoginResponse>('/auth/login', {
      method: 'POST',
      body: json({ email, password }),
    });
    setStoredToken(res.access_token);
    return res;
  },

  async me(): Promise<UserResponse> {
    return apiClient<UserResponse>('/auth/me');
  },

  async logout(): Promise<void> {
    try {
      await apiClient<void>('/auth/logout', { method: 'POST' });
    } finally {
      setStoredToken(null);
    }
  },

  isAuthenticated(): boolean {
    return Boolean(getStoredToken());
  },
};

// ----------------- Dashboard -----------------
export interface DashboardDateParams {
  days?: number | string;
  date_from?: string;
  date_to?: string;
}

export const dashboardApi = {
  async getSummary(params: number | string | DashboardDateParams = 30): Promise<BackendDashboardSummary> {
    const query = typeof params === 'object'
      ? new URLSearchParams(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
        ).toString()
      : `days=${params}`;
    return apiClient<BackendDashboardSummary>(`/dashboard/summary?${query}`);
  },

  async getRevenue(params: number | string | DashboardDateParams = 30): Promise<BackendRevenuePoint[]> {
    const query = typeof params === 'object'
      ? new URLSearchParams(
          Object.entries(params).filter(([_, v]) => v !== undefined && v !== '') as [string, string][]
        ).toString()
      : `days=${params}`;
    return apiClient<BackendRevenuePoint[]>(`/dashboard/revenue?${query}`);
  },

  async getOrdersByStatus(): Promise<Record<string, number>> {
    return apiClient<Record<string, number>>('/dashboard/orders-by-status');
  },

  async getTopProducts(): Promise<BackendTopProduct[]> {
    return apiClient<BackendTopProduct[]>('/dashboard/top-products');
  },

  async getSyncStatus(): Promise<BackendSyncLog[]> {
    return apiClient<BackendSyncLog[]>('/sync/status');
  },
};

// ----------------- Products -----------------
export interface ProductQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  stock_status?: string;
  category_id?: number;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export interface BackendTrashedProduct {
  woo_id: number;
  name: string;
  slug: string | null;
  sku: string | null;
  type: string;
  price: string | null;
  regular_price: string | null;
  sale_price: string | null;
  stock_status: string | null;
  manage_stock: boolean;
  stock_quantity: number | null;
  image_url: string | null;
  categories: string[];
  trashed_at: string | null;
  previous_status: 'publish' | 'draft' | 'pending' | 'private' | null;
}

export const productsApi = {
  async list(params: ProductQueryParams = {}): Promise<BackendPagination<BackendProduct>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.per_page) searchParams.set('per_page', String(params.per_page));
    if (params.search) searchParams.set('search', params.search);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.stock_status && params.stock_status !== 'all') searchParams.set('stock_status', params.stock_status);
    if (params.category_id) searchParams.set('category_id', String(params.category_id));
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.direction) searchParams.set('direction', params.direction);

    const query = searchParams.toString();
    return apiClient<BackendPagination<BackendProduct>>(`/products${query ? `?${query}` : ''}`);
  },

  async get(id: number | string): Promise<BackendProduct> {
    return apiClient<BackendProduct>(`/products/${id}`);
  },

  async create(payload: Record<string, unknown>): Promise<BackendProduct> {
    return apiClient<BackendProduct>('/products', { method: 'POST', body: json(payload) });
  },

  /** The WooCommerce trash, read live. */
  async trash(): Promise<{ data: BackendTrashedProduct[] }> {
    return apiClient<{ data: BackendTrashedProduct[] }>('/products/trash');
  },

  /** Takes a product out of the trash. `status` is only needed when the status it had is not known. */
  async restore(wooId: number, status?: string): Promise<unknown> {
    return apiClient(`/products/trash/${wooId}/restore`, { method: 'POST', body: json(status ? { status } : {}) });
  },

  async update(id: number | string, payload: Record<string, unknown>): Promise<BackendProduct> {
    return apiClient<BackendProduct>(`/products/${id}`, { method: 'PATCH', body: json(payload) });
  },

  async remove(id: number | string): Promise<void> {
    await apiClient<void>(`/products/${id}`, { method: 'DELETE' });
  },
};

// ----------------- Orders -----------------
export interface OrderQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
  with_items?: number;
}

export const ordersApi = {
  async list(params: OrderQueryParams = {}): Promise<BackendPagination<BackendOrder>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.per_page) searchParams.set('per_page', String(params.per_page));
    if (params.search) searchParams.set('search', params.search);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.date_from) searchParams.set('date_from', params.date_from);
    if (params.date_to) searchParams.set('date_to', params.date_to);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.direction) searchParams.set('direction', params.direction);
    searchParams.set('with_items', String(params.with_items ?? 1));

    const query = searchParams.toString();
    return apiClient<BackendPagination<BackendOrder>>(`/orders${query ? `?${query}` : ''}`);
  },

  async get(id: number | string): Promise<BackendOrder> {
    return apiClient<BackendOrder>(`/orders/${id}`);
  },

  async setStatus(
    id: number | string,
    status: string,
    dispatchInfo?: { courierName?: string; trackingNumber?: string }
  ): Promise<BackendOrder> {
    return apiClient<BackendOrder>(`/orders/${id}/status`, {
      method: 'PUT',
      body: json({
        status,
        ...(dispatchInfo?.courierName ? { courier_name: dispatchInfo.courierName } : {}),
        ...(dispatchInfo?.trackingNumber ? { tracking_number: dispatchInfo.trackingNumber } : {}),
      }),
    });
  },

  async notes(id: number | string): Promise<BackendOrderNote[]> {
    return apiClient<BackendOrderNote[]>(`/orders/${id}/notes`);
  },

  async addNote(id: number | string, note: string, customerNote: boolean): Promise<BackendOrderNote> {
    return apiClient<BackendOrderNote>(`/orders/${id}/notes`, {
      method: 'POST',
      body: json({ note, customer_note: customerNote }),
    });
  },

  async refunds(id: number | string): Promise<BackendOrderRefund[]> {
    return apiClient<BackendOrderRefund[]>(`/orders/${id}/refunds`);
  },

  async addRefund(id: number | string, amount: number, reason: string): Promise<BackendOrderRefund> {
    return apiClient<BackendOrderRefund>(`/orders/${id}/refunds`, {
      method: 'POST',
      body: json({ amount, reason }),
    });
  },
};

// ----------------- Customers -----------------
export interface CustomerQueryParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort?: string;
  direction?: 'asc' | 'desc';
}

export const customersApi = {
  async list(params: CustomerQueryParams = {}): Promise<BackendPagination<BackendCustomer>> {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.per_page) searchParams.set('per_page', String(params.per_page));
    if (params.search) searchParams.set('search', params.search);
    if (params.sort) searchParams.set('sort', params.sort);
    if (params.direction) searchParams.set('direction', params.direction);

    const query = searchParams.toString();
    return apiClient<BackendPagination<BackendCustomer>>(`/customers${query ? `?${query}` : ''}`);
  },

  async get(id: number | string): Promise<BackendCustomer> {
    return apiClient<BackendCustomer>(`/customers/${id}`);
  },

  async create(payload: Record<string, unknown>): Promise<BackendCustomer> {
    return apiClient<BackendCustomer>('/customers', { method: 'POST', body: json(payload) });
  },

  async update(id: number | string, payload: Record<string, unknown>): Promise<BackendCustomer> {
    return apiClient<BackendCustomer>(`/customers/${id}`, { method: 'PATCH', body: json(payload) });
  },

  async remove(id: number | string): Promise<void> {
    await apiClient<void>(`/customers/${id}`, { method: 'DELETE' });
  },
};

// ----------------- Categories -----------------
export const categoriesApi = {
  async list(search?: string, perPage = 100, page = 1): Promise<BackendPagination<BackendCategory>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (search) params.set('search', search);
    if (perPage) params.set('per_page', String(perPage));
    const query = params.toString();
    return apiClient<BackendPagination<BackendCategory>>(`/categories${query ? `?${query}` : ''}`);
  },

  async get(id: number | string): Promise<BackendCategory> {
    return apiClient<BackendCategory>(`/categories/${id}`);
  },

  async create(payload: Record<string, unknown>): Promise<BackendCategory> {
    return apiClient<BackendCategory>('/categories', { method: 'POST', body: json(payload) });
  },

  async update(id: number | string, payload: Record<string, unknown>): Promise<BackendCategory> {
    return apiClient<BackendCategory>(`/categories/${id}`, { method: 'PATCH', body: json(payload) });
  },

  async remove(id: number | string): Promise<void> {
    await apiClient<void>(`/categories/${id}`, { method: 'DELETE' });
  },
};

// ----------------- Coupons -----------------
export const couponsApi = {
  async list(search?: string, perPage = 100, page = 1): Promise<BackendPagination<BackendCoupon>> {
    const params = new URLSearchParams();
    params.set('page', String(page));
    if (search) params.set('search', search);
    if (perPage) params.set('per_page', String(perPage));
    const query = params.toString();
    return apiClient<BackendPagination<BackendCoupon>>(`/coupons${query ? `?${query}` : ''}`);
  },

  async get(id: number | string): Promise<BackendCoupon> {
    return apiClient<BackendCoupon>(`/coupons/${id}`);
  },

  async create(payload: Record<string, unknown>): Promise<BackendCoupon> {
    return apiClient<BackendCoupon>('/coupons', { method: 'POST', body: json(payload) });
  },

  async update(id: number | string, payload: Record<string, unknown>): Promise<BackendCoupon> {
    return apiClient<BackendCoupon>(`/coupons/${id}`, { method: 'PATCH', body: json(payload) });
  },

  async remove(id: number | string): Promise<void> {
    await apiClient<void>(`/coupons/${id}`, { method: 'DELETE' });
  },
};

// ----------------- Shipping -----------------
export const shippingApi = {
  async zones(): Promise<BackendShippingZone[]> {
    return apiClient<BackendShippingZone[]>('/shipping/zones');
  },

  async addMethod(zoneId: number | string, payload: Record<string, unknown>): Promise<void> {
    await apiClient<unknown>(`/shipping/zones/${zoneId}/methods`, { method: 'POST', body: json(payload) });
  },

  async updateMethod(
    zoneId: number | string,
    instanceId: number | string,
    payload: Record<string, unknown>
  ): Promise<void> {
    await apiClient<unknown>(`/shipping/zones/${zoneId}/methods/${instanceId}`, {
      method: 'PATCH',
      body: json(payload),
    });
  },

  async removeMethod(zoneId: number | string, instanceId: number | string): Promise<void> {
    await apiClient<void>(`/shipping/zones/${zoneId}/methods/${instanceId}`, { method: 'DELETE' });
  },
};

// ----------------- Payments -----------------
export const paymentsApi = {
  async list(): Promise<BackendPaymentGateway[]> {
    return apiClient<BackendPaymentGateway[]>('/payments');
  },

  async update(id: string, payload: Record<string, unknown>): Promise<void> {
    await apiClient<unknown>(`/payments/${id}`, { method: 'PATCH', body: json(payload) });
  },
};

// ----------------- Settings -----------------
export const settingsApi = {
  async groups(): Promise<BackendSettingsGroup[]> {
    return apiClient<BackendSettingsGroup[]>('/settings');
  },

  async group(id: string): Promise<BackendSetting[]> {
    return apiClient<BackendSetting[]>(`/settings/${id}`);
  },

  async update(groupId: string, settings: Record<string, string | boolean | string[]>): Promise<void> {
    await apiClient<unknown>(`/settings/${groupId}`, { method: 'PUT', body: json({ settings }) });
  },
};

// ----------------- Notifications -----------------
export const notificationsApi = {
  async list(): Promise<{ unread: number; data: BackendNotification[] }> {
    return apiClient<{ unread: number; data: BackendNotification[] }>('/notifications?days=30&limit=50');
  },

  async markRead(ids: string[]): Promise<void> {
    await apiClient<unknown>('/notifications/read', { method: 'POST', body: json({ ids }) });
  },

  async markAllRead(): Promise<void> {
    await apiClient<unknown>('/notifications/read', { method: 'POST', body: json({ all: true }) });
  },
};

// ----------------- Store-change switches -----------------
export const writeSettingsApi = {
  async get(): Promise<BackendWriteSettings> {
    return apiClient<BackendWriteSettings>('/write-settings');
  },

  async set(key: string, enabled: boolean): Promise<BackendWriteSettings> {
    return apiClient<BackendWriteSettings>(`/write-settings/${key}`, { method: 'PUT', body: json({ enabled }) });
  },
};

// ----------------- Import from WooCommerce -----------------
export interface StoreImportResult {
  ok: boolean;
  results: { resource: string; status: 'ok' | 'failed'; records: number; error: string | null }[];
  finished_at: string;
}

export interface ChangeCounters {
  products: number;
  orders: number;
  customers: number;
  coupons: number;
  categories: number;
}

export const syncApi = {
  /** Counters that go up whenever the backend's copy of the store data changes. Cheap to poll. */
  async changes(): Promise<ChangeCounters> {
    return apiClient<ChangeCounters>('/sync/changes');
  },

  /** Asks the backend to pull everything from WooCommerce into its database (read-only towards the store). */
  async run(): Promise<StoreImportResult> {
    return apiClient<StoreImportResult>('/sync', { method: 'POST' });
  },
};

// ----------------- Reports -----------------
export interface ReportRange {
  from: string;
  to: string;
}

const rangeQuery = (r: ReportRange, extra: Record<string, string> = {}) =>
  new URLSearchParams({ from: r.from, to: r.to, ...extra }).toString();

export const reportsApi = {
  async sales(r: ReportRange, groupBy: 'day' | 'week' | 'month'): Promise<BackendSalesReport> {
    return apiClient<BackendSalesReport>(`/reports/sales?${rangeQuery(r, { group_by: groupBy })}`);
  },

  async products(r: ReportRange): Promise<BackendProductReportRow[]> {
    return apiClient<BackendProductReportRow[]>(`/reports/products?${rangeQuery(r, { limit: '10' })}`);
  },

  async categories(r: ReportRange): Promise<BackendCategoryReportRow[]> {
    return apiClient<BackendCategoryReportRow[]>(`/reports/categories?${rangeQuery(r)}`);
  },

  async customers(r: ReportRange): Promise<BackendCustomerReportRow[]> {
    return apiClient<BackendCustomerReportRow[]>(`/reports/customers?${rangeQuery(r, { limit: '10' })}`);
  },
};
