import React from 'react';
import { useLocation, Link } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { useProductStore, useOrderStore, useCustomerStore } from '@/store';

const routeNameMap: Record<string, string> = {
  products: 'Products',
  new: 'Create Product',
  edit: 'Edit Product',
  categories: 'Categories',
  orders: 'Orders',
  gst: 'GST',
  customers: 'Customers',
  inventory: 'Inventory',
  coupons: 'Coupons',
  reports: 'Reports',
  shipping: 'Shipping',
  payments: 'Payments',
  settings: 'Settings',
};

export function Breadcrumbs() {
  const location = useLocation();
  const pathnames = location.pathname.split('/').filter((x) => x);
  const products = useProductStore((st) => st.products);
  const orders = useOrderStore((st) => st.orders);
  const customers = useCustomerStore((st) => st.customers);

  /** What a record's page is called: its real name, never the app's internal id. */
  const recordName = (kind: string, id: string): string | null => {
    if (kind === 'products') return products.find((p) => p.id === id)?.name ?? null;
    if (kind === 'orders') {
      const o = orders.find((x) => x.id === id);
      return o ? `Order ${o.orderNumber}` : null;
    }
    if (kind === 'customers') {
      const c = customers.find((x) => x.id === id);
      return c ? `${c.firstName} ${c.lastName}`.trim() || c.email : null;
    }
    return null;
  };

  if (pathnames.length === 0) {
    return (
      <div className="flex items-center text-xs text-slate-500 mb-4">
        <Home className="h-3.5 w-3.5 mr-1 text-slate-400" />
        <span className="font-medium text-slate-700">Dashboard</span>
      </div>
    );
  }

  return (
    <nav className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-slate-500 mb-4 py-0.5">
      <Link
        to="/"
        className="flex items-center hover:text-red-600 transition-colors text-slate-400"
      >
        <Home className="h-3.5 w-3.5 mr-1" />
        <span>Dashboard</span>
      </Link>
      {pathnames.map((value, index) => {
        const to = `/${pathnames.slice(0, index + 1).join('/')}`;
        const isLast = index === pathnames.length - 1;
        const isRecordId = /^\d+$/.test(value) && index > 0;
        // A record's name appears once it has loaded; until then the segment is left out.
        const name = isRecordId ? recordName(pathnames[index - 1], value) : routeNameMap[value] || value;
        if (name === null) return null;

        return (
          <React.Fragment key={to}>
            <ChevronRight className="h-3 w-3 text-slate-300" />
            {isLast ? (
              <span className="font-semibold text-slate-800 capitalize truncate max-w-[14rem] sm:max-w-md">{name}</span>
            ) : (
              <Link to={to} className="hover:text-red-600 transition-colors capitalize truncate max-w-[8rem] sm:max-w-xs">
                {name}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}

