import { useEffect } from 'react';
import { toast } from 'sonner';
import {
  syncApi,
  getStoredToken,
  ChangeCounters,
} from '@/services/api';
import {
  useProductStore,
  useOrderStore,
  useCustomerStore,
  useCategoryStore,
  useCouponStore,
  useUIStore,
  useBackendSyncStore,
} from '@/store';
import { Order, Product, Customer, ProductCategory, Coupon } from '@/types';

/** Fast local counter polling interval (picks up webhooks / API writes in ~400ms). */
const POLL_MS = 400;
/** Background WooCommerce store import interval (guarantees sync even if webhooks are delayed/off). */
const STORE_SYNC_MS = 5000;
/** Minimum gap between store imports on tab focus to avoid overlapping bursts. */
const FOCUS_SYNC_MIN_GAP_MS = 2000;

function orderFingerprint(o: Order): string {
  return [
    o.status,
    o.total,
    o.refundedTotal,
    o.datePaid ?? '',
    o.items.length,
    o.customerName,
  ].join('|');
}

function productFingerprint(p: Product): string {
  return [
    p.name,
    p.status,
    p.price ?? '',
    p.regularPrice ?? '',
    p.salePrice ?? '',
    p.stockQuantity,
    p.stockStatus,
    p.manageStock,
    p.categories.join(','),
  ].join('|');
}

function customerFingerprint(c: Customer): string {
  return [c.firstName, c.lastName, c.email, c.totalOrders, c.totalSpent].join('|');
}

function categoryFingerprint(c: ProductCategory): string {
  return [c.name, c.slug, c.count].join('|');
}

function couponFingerprint(c: Coupon): string {
  return [c.code, c.status, c.amount, c.usageCount].join('|');
}

function summarizeChanges<T extends { id: string }>(
  prev: T[],
  next: T[],
  label: string,
  getName: (item: T) => string,
  getFingerprint: (item: T) => string
): string[] {
  const events: string[] = [];
  const prevMap = new Map(prev.map((item) => [item.id, item]));
  const nextMap = new Map(next.map((item) => [item.id, item]));

  const created: T[] = [];
  const updated: T[] = [];
  const deleted: T[] = [];

  for (const item of next) {
    const old = prevMap.get(item.id);
    if (!old) {
      created.push(item);
    } else if (getFingerprint(old) !== getFingerprint(item)) {
      updated.push(item);
    }
  }
  for (const item of prev) {
    if (!nextMap.has(item.id)) {
      deleted.push(item);
    }
  }

  if (created.length === 1) {
    events.push(`${label} Created: ${getName(created[0])}`);
  } else if (created.length > 1) {
    events.push(`${created.length} ${label}s Created`);
  }

  if (updated.length === 1) {
    events.push(`${label} Updated: ${getName(updated[0])}`);
  } else if (updated.length > 1) {
    events.push(`${updated.length} ${label}s Updated`);
  }

  if (deleted.length === 1) {
    events.push(`${label} Deleted: ${getName(deleted[0])}`);
  } else if (deleted.length > 1) {
    events.push(`${deleted.length} ${label}s Deleted`);
  }

  return events;
}

/**
 * Keeps every screen current without a manual refresh.
 *
 * Sync runs silently in the background. A live popup toast is shown ONLY when
 * an actual Create, Update, or Delete action is detected on orders, products,
 * customers, categories, or coupons.
 */
export function useLiveUpdates() {
  useEffect(() => {
    let last: ChangeCounters | null = null;
    let inFlight = false;
    let storeSyncInFlight = false;
    let lastStoreSyncAt = 0;
    let stopped = false;

    const check = async () => {
      if (stopped || inFlight || document.hidden || !getStoredToken()) return;
      inFlight = true;
      try {
        const now = await syncApi.changes();
        const previous = last;
        last = now;
        if (!previous) return;

        const changed = (k: keyof ChangeCounters) => now[k] !== previous[k];
        const jobs: Promise<unknown>[] = [];

        const productState = useProductStore.getState();
        const orderState = useOrderStore.getState();
        const customerState = useCustomerStore.getState();
        const categoryState = useCategoryStore.getState();
        const couponState = useCouponStore.getState();

        const prevProducts = productState.products;
        const prevOrders = orderState.orders;
        const prevCustomers = customerState.customers;
        const prevCategories = categoryState.categories;
        const prevCoupons = couponState.coupons;

        const productsWereLoaded = productState.loaded && prevProducts.length > 0;
        const ordersWereLoaded = orderState.loaded && prevOrders.length > 0;
        const customersWereLoaded = customerState.loaded && prevCustomers.length > 0;
        const categoriesWereLoaded = prevCategories.length > 0;
        const couponsWereLoaded = prevCoupons.length > 0;

        if (changed('products')) jobs.push(useProductStore.getState().fetchProducts({ silent: true }));
        if (changed('orders')) jobs.push(useOrderStore.getState().fetchOrders({ silent: true }));
        if (changed('customers')) jobs.push(useCustomerStore.getState().fetchCustomers({ silent: true }));
        if (changed('categories')) jobs.push(useCategoryStore.getState().fetchCategories({ silent: true }));
        if (changed('coupons')) jobs.push(useCouponStore.getState().fetchCoupons({ silent: true }));

        if (changed('products') || changed('orders')) {
          jobs.push(useBackendSyncStore.getState().refreshDashboard());
          jobs.push(useUIStore.getState().fetchNotifications());
        }

        if (jobs.length > 0) {
          await Promise.allSettled(jobs);

          if (useUIStore.getState().isManualSyncing) return;

          const events: string[] = [];
          if (ordersWereLoaded) {
            events.push(
              ...summarizeChanges(
                prevOrders,
                useOrderStore.getState().orders,
                'Order',
                (o) => `#${o.orderNumber}`,
                orderFingerprint
              )
            );
          }
          if (productsWereLoaded) {
            events.push(
              ...summarizeChanges(
                prevProducts,
                useProductStore.getState().products,
                'Product',
                (p) => p.name,
                productFingerprint
              )
            );
          }
          if (customersWereLoaded) {
            events.push(
              ...summarizeChanges(
                prevCustomers,
                useCustomerStore.getState().customers,
                'Customer',
                (c) => `${c.firstName} ${c.lastName}`.trim() || c.email,
                customerFingerprint
              )
            );
          }
          if (categoriesWereLoaded) {
            events.push(
              ...summarizeChanges(
                prevCategories,
                useCategoryStore.getState().categories,
                'Category',
                (c) => c.name,
                categoryFingerprint
              )
            );
          }
          if (couponsWereLoaded) {
            events.push(
              ...summarizeChanges(
                prevCoupons,
                useCouponStore.getState().coupons,
                'Coupon',
                (c) => c.code,
                couponFingerprint
              )
            );
          }

          if (events.length > 0) {
            toast.success(events[0], {
              id: 'live-action-popup',
              description: events.length > 1 ? events.slice(1).join(' • ') : 'Live update from store',
            });
          }
        }
      } catch {
        // Offline or a hiccup: keep the old baseline and try again on the next tick.
      } finally {
        inFlight = false;
      }
    };

    const runBackgroundStoreSync = async () => {
      if (
        stopped ||
        storeSyncInFlight ||
        document.hidden ||
        !getStoredToken() ||
        useUIStore.getState().isManualSyncing
      ) {
        return;
      }
      if (Date.now() - lastStoreSyncAt < FOCUS_SYNC_MIN_GAP_MS) {
        return;
      }
      storeSyncInFlight = true;
      lastStoreSyncAt = Date.now();
      try {
        await syncApi.run();
        await check();
      } catch {
        // Ignore transient sync errors or 409 lock conflicts during background sync.
      } finally {
        storeSyncInFlight = false;
      }
    };

    const pollTimer = window.setInterval(check, POLL_MS);
    const storeSyncTimer = window.setInterval(runBackgroundStoreSync, STORE_SYNC_MS);

    const onVisible = () => {
      if (!document.hidden) {
        check();
        runBackgroundStoreSync();
      }
    };

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onVisible);
    check();
    const initialSyncTimer = window.setTimeout(runBackgroundStoreSync, 500);

    return () => {
      stopped = true;
      window.clearInterval(pollTimer);
      window.clearInterval(storeSyncTimer);
      window.clearTimeout(initialSyncTimer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, []);
}
