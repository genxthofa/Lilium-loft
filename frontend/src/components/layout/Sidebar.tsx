import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  Boxes,
  TicketPercent,
  BarChart3,
  Truck,
  CreditCard,
  Settings,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  ChevronsUpDown,
  Store,
  Layers,
  PlusCircle,
  FolderTree,
  LogOut,
  ExternalLink,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { useUIStore, useBackendSyncStore } from '@/store';
import { cn } from '@/utils/cn';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

interface NavItem {
  title: string;
  href: string;
  icon: React.ElementType;
  badge?: string | number;
  subItems?: { title: string; href: string; icon?: React.ElementType }[];
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout } = useBackendSyncStore();

  const [productsOpen, setProductsOpen] = useState(
    location.pathname.startsWith('/products')
  );
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogoutConfirm = async () => {
    setLoggingOut(true);
    try {
      await logout();
      toast.success('You have been logged out.');
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
      setShowLogoutConfirm(false);
    }
  };

  const displayName = currentUser?.name ?? '';
  const displayEmail = currentUser?.email ?? '';
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const navItems: NavItem[] = [
    {
      title: 'Dashboard',
      href: '/',
      icon: LayoutDashboard,
    },
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
    },
    {
      title: 'Customers',
      href: '/customers',
      icon: Users,
    },
    {
      title: 'Inventory',
      href: '/inventory',
      icon: Boxes,
    },
    {
      title: 'Reports',
      href: '/reports',
      icon: BarChart3,
    },
    {
      title: 'Shipping',
      href: '/shipping',
      icon: Truck,
    },
    {
      title: 'Payments',
      href: '/payments',
      icon: CreditCard,
    },
    {
      title: 'Settings',
      href: '/settings',
      icon: Settings,
    },
  ];

  return (
    <aside
      className={cn(
        'hidden lg:flex flex-col bg-white border-r border-slate-200/80 h-full shrink-0 transition-all duration-300 z-30 select-none relative',
        sidebarCollapsed ? 'w-20' : 'w-64'
      )}
    >
      {/* Brand Header & Edge Collapse Toggle */}
      <div className="h-20 flex items-center justify-center px-3 border-b border-slate-100 shrink-0 relative select-none">
        <NavLink to="/" className="flex items-center justify-center w-full">
          {sidebarCollapsed ? (
            <div className="h-11 w-11 mx-auto flex items-center justify-center rounded-xl bg-white border border-slate-200/80 p-1 shadow-2xs overflow-hidden hover:border-red-200 transition-colors">
              <img
                src="/logo-flower.png"
                alt="Lilium & Loft"
                className="h-8 w-8 object-contain"
              />
            </div>
          ) : (
            <div className="flex items-center justify-center w-full py-1">
              <img
                src="/logo.png"
                alt="Lilium & Loft Crochet Studio"
                className="h-14 w-auto object-contain max-w-[215px]"
              />
            </div>
          )}
        </NavLink>

        {/* Floating Toggle Arrow on the border edge between sidebar & header */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-40 h-6 w-6 rounded-full bg-white border border-slate-200/90 shadow-xs hover:shadow-sm hover:border-slate-300 flex items-center justify-center text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all cursor-pointer"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Navigation List */}
      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasSubs = item.subItems && item.subItems.length > 0;
          const isActive =
            item.href === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.href);

          if (hasSubs && !sidebarCollapsed) {
            return (
              <div key={item.title} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setProductsOpen(!productsOpen)}
                  className={cn(
                    'w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors',
                    isActive
                      ? 'bg-red-50 text-red-600'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon className={cn('h-5 w-5', isActive ? 'text-red-600' : 'text-slate-500')} />
                    <span className="text-[15px]">{item.title}</span>
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
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                            isSubActive
                              ? 'text-red-600 bg-red-50/70 font-semibold'
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
              className={({ isActive: navActive }) => {
                const active = item.href === '/' ? location.pathname === '/' : navActive;
                return cn(
                  'flex items-center justify-between px-3 py-2.5 rounded-lg text-[15px] font-medium transition-colors group relative',
                  active
                    ? 'bg-red-50 text-red-600 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                );
              }}
              title={sidebarCollapsed ? item.title : undefined}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'h-5 w-5 shrink-0',
                    isActive ? 'text-red-600' : 'text-slate-500 group-hover:text-slate-900'
                  )}
                />
                {!sidebarCollapsed && <span className="text-[15px]">{item.title}</span>}
              </div>

              {!sidebarCollapsed && item.badge && (
                <span className="flex h-5 items-center justify-center rounded-full bg-red-100 px-2 text-xs font-bold text-red-700">
                  {item.badge}
                </span>
              )}

              {/* Tooltip for collapsed mode */}
              {sidebarCollapsed && (
                <div className="absolute left-full ml-2 hidden group-hover:flex items-center z-50 rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-md whitespace-nowrap">
                  {item.title}
                </div>
              )}
            </NavLink>
          );
        })}
      </div>

      {/* Footer / User Profile */}
      <div className="border-t border-slate-100 p-2 shrink-0 bg-slate-50/50">
        {/* User Profile Dropdown Button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                'w-full flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-white hover:shadow-xs border border-transparent hover:border-slate-200/60 transition-all outline-none group cursor-pointer',
                sidebarCollapsed ? 'justify-center' : 'justify-between'
              )}
              title={sidebarCollapsed ? `${displayName} (${displayEmail})` : undefined}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Avatar className="h-9 w-9 shrink-0 border border-red-100 bg-red-50">
                  <AvatarFallback className="bg-red-50 text-red-700 text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <div className="flex flex-col min-w-0 leading-tight">
                    <span className="text-xs font-semibold text-slate-800 truncate group-hover:text-red-700 transition-colors">
                      {displayName}
                    </span>
                    <span className="text-[11px] text-slate-500 truncate">
                      {displayEmail}
                    </span>
                  </div>
                )}
              </div>
              {!sidebarCollapsed && (
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors" />
              )}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={sidebarCollapsed ? 'right' : 'top'}
            align={sidebarCollapsed ? 'end' : 'start'}
            className="w-56 p-1.5 shadow-lg border-slate-200/80 mb-1 z-50 bg-white"
          >
            <div className="flex items-center gap-2.5 p-2 bg-slate-50/70 rounded-lg mb-1">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-red-50 text-red-600 text-xs font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 leading-tight">
                <p className="text-xs font-bold text-slate-800 truncate">
                  {displayName}
                </p>
                <p className="text-[11px] text-slate-500 truncate">{displayEmail}</p>
              </div>
            </div>

            <DropdownMenuItem
              onClick={() => navigate('/settings')}
              className="gap-2.5 text-xs font-medium cursor-pointer py-2 rounded-md hover:bg-slate-100"
            >
              <Settings className="h-3.5 w-3.5 text-slate-500" />
              <span>Settings</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="my-1" />

            <DropdownMenuItem
              onClick={() => setShowLogoutConfirm(true)}
              className="gap-2.5 text-xs font-semibold text-red-600 focus:bg-red-50 focus:text-red-700 hover:bg-red-50 hover:text-red-700 cursor-pointer py-2 rounded-md"
            >
              <LogOut className="h-3.5 w-3.5 text-red-600" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Logout Confirmation Dialog */}
      <ConfirmDialog
        open={showLogoutConfirm}
        onOpenChange={setShowLogoutConfirm}
        title="Log Out Confirmation"
        description="Are you sure you want to log out of the Lilium & Loft admin portal? You will need to sign in again to access the dashboard."
        confirmLabel="Yes, Log Out"
        cancelLabel="Cancel"
        variant="destructive"
        isLoading={loggingOut}
        onConfirm={handleLogoutConfirm}
      />
    </aside>
  );
}

