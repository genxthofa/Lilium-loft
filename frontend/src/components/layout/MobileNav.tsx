import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Boxes,
  TicketPercent,
  BarChart3,
  // Truck,
  CreditCard,
  Settings,
  X,
  Store,
  ChevronDown,
  ChevronRight,
  Layers,
  PlusCircle,
  FolderTree,
  Trash2,
  Receipt,
} from 'lucide-react';
import { useUIStore, useOrderStore } from '@/store';
import { cn } from '@/utils/cn';
import { getRecentOrdersCount } from '@/utils/orders';

export function MobileNav() {
  const { mobileMenuOpen, setMobileMenuOpen } = useUIStore();
  const orders = useOrderStore((s) => s.orders);
  const recentOrdersCount = useMemo(() => getRecentOrdersCount(orders), [orders]);
  const location = useLocation();

  // Escape closes the menu (keyboard and screen-reader users could not dismiss it before).
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMobileMenuOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileMenuOpen, setMobileMenuOpen]);
  const [productsOpen, setProductsOpen] = useState(
    location.pathname.startsWith('/products')
  );

  if (!mobileMenuOpen) return null;

  const navItems = [
    { title: 'Dashboard', href: '/', icon: LayoutDashboard },
    {
      title: 'Products',
      href: '/products',
      icon: Package,
      subItems: [
        { title: 'All Products', href: '/products', icon: Layers },
        { title: 'Add New', href: '/products/new', icon: PlusCircle },
        { title: 'Categories', href: '/products/categories', icon: FolderTree },
        { title: 'Trash', href: '/products/trash', icon: Trash2 },
      ],
    },
    {
      title: 'Orders',
      href: '/orders',
      icon: ShoppingCart,
      badge: recentOrdersCount > 0 ? recentOrdersCount : undefined,
    },
    { title: 'GST', href: '/gst', icon: Receipt },
    { title: 'Customers', href: '/customers', icon: Users },
    { title: 'Inventory', href: '/inventory', icon: Boxes },
    { title: 'Reports', href: '/reports', icon: BarChart3 },
    // { title: 'Shipping', href: '/shipping', icon: Truck },
    { title: 'Payments', href: '/payments', icon: CreditCard },
    { title: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="fixed inset-0 z-50 lg:hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm animate-in fade-in"
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 w-72 bg-white shadow-xl flex flex-col z-50 animate-in slide-in-from-left duration-200">
        <div className="h-20 flex items-center justify-between px-4 border-b border-slate-100">
          <div className="flex items-center justify-center flex-1 py-1">
            <img
              src="/logo.png"
              alt="Lilium & Loft Crochet Studio"
              className="h-14 w-auto object-contain max-w-[200px]"
            />
          </div>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 ml-2"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const hasSubs = item.subItems && item.subItems.length > 0;
            const isActive =
              item.href === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.href);

            if (hasSubs) {
              return (
                <div key={item.title} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setProductsOpen(!productsOpen)}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors',
                      isActive
                        ? 'bg-red-50 text-red-600 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={cn('h-5 w-5', isActive ? 'text-red-600' : 'text-slate-500')} />
                      <span>{item.title}</span>
                    </div>
                    {productsOpen ? (
                      <ChevronDown className="h-4 w-4 text-slate-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400" />
                    )}
                  </button>

                  {productsOpen && (
                    <div className="pl-9 space-y-1 pt-1">
                      {item.subItems!.map((sub) => {
                        const isSubActive = location.pathname === sub.href;
                        const SubIcon = sub.icon || Layers;
                        return (
                          <NavLink
                            key={sub.title}
                            to={sub.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={cn(
                              'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                              isSubActive
                                ? 'text-red-600 bg-red-50 font-semibold'
                                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
                            )}
                          >
                            <SubIcon className="h-4 w-4" />
                            <span>{sub.title}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <NavLink
                key={item.title}
                to={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors',
                  isActive
                    ? 'bg-red-50 text-red-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn('h-5 w-5', isActive ? 'text-red-600' : 'text-slate-500')} />
                  <span>{item.title}</span>
                </div>
                {Boolean((item as { badge?: number }).badge) && Number((item as { badge?: number }).badge) > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-xs font-bold text-white">
                    {(item as { badge?: number }).badge}
                  </span>
                )}
              </NavLink>
            );
          })}
        </div>
      </div>
    </div>
  );
}
