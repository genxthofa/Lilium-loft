import { Order } from '@/types';

/**
 * Counts orders placed today that are still awaiting fulfillment
 * (Order Placed / Pending / On-Hold).
 */
export function getRecentOrdersCount(orders: Order[]): number {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const cutoff = startOfToday.getTime();

  return orders.filter((o) => {
    const createdAt = new Date(o.dateCreated).getTime();
    return (
      !Number.isNaN(createdAt) &&
      createdAt >= cutoff &&
      (o.status === 'processing' || o.status === 'pending' || o.status === 'on-hold')
    );
  }).length;
}
