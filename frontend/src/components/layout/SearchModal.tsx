import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useUIStore, useProductStore, useOrderStore, useCustomerStore } from '@/store';
import { Search, Package, ShoppingCart, Users, ArrowRight } from 'lucide-react';
import { formatCurrency, formatMoney } from '@/utils/formatters';
import { initials } from '@/utils/initials';

export function SearchModal() {
  const { searchOpen, setSearchOpen } = useUIStore();
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const products = useProductStore((s) => s.products);
  const orders = useOrderStore((s) => s.orders);
  const customers = useCustomerStore((s) => s.customers);

  // Keyboard shortcut listener Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(!searchOpen);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen, setSearchOpen]);

  const filteredProducts = query.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(query.toLowerCase()) ||
            p.sku.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 4)
    : [];

  const filteredOrders = query.trim()
    ? orders
        .filter(
          (o) =>
            o.orderNumber.toLowerCase().includes(query.toLowerCase()) ||
            o.customerName.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 4)
    : [];

  const filteredCustomers = query.trim()
    ? customers
        .filter(
          (c) =>
            `${c.firstName} ${c.lastName}`.toLowerCase().includes(query.toLowerCase()) ||
            c.email.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, 3)
    : [];

  const handleSelect = (path: string) => {
    setSearchOpen(false);
    setQuery('');
    navigate(path);
  };

  return (
    <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-slate-200">
        <div className="flex items-center px-4 border-b border-slate-100">
          <Search className="h-4 w-4 text-slate-400 mr-2 shrink-0" />
          <input
            className="flex h-12 w-full bg-transparent py-3 text-sm outline-none placeholder:text-slate-400"
            placeholder="Search products, orders, customers... (Esc to close)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className="pointer-events-none hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] font-medium text-slate-500 opacity-100">
            ESC
          </kbd>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-3 space-y-4">
          {!query.trim() && (
            <div className="py-8 text-center text-xs text-slate-400">
              Type keywords to search WooCommerce store catalog, orders, and clients.
            </div>
          )}

          {query.trim() &&
            filteredProducts.length === 0 &&
            filteredOrders.length === 0 &&
            filteredCustomers.length === 0 && (
              <div className="py-8 text-center text-xs text-slate-400">
                No matching results found for "{query}".
              </div>
            )}

          {filteredProducts.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Products
              </div>
              <div className="space-y-1">
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(`/products/${p.id}`)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded bg-slate-100 overflow-hidden shrink-0 border border-slate-200">
                        {p.images[0] ? (
                          <img
                            src={p.images[0].src}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Package className="h-4 w-4 m-2 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800 group-hover:text-red-600 transition-colors">
                          {p.name}
                        </div>
                        <div className="text-xs text-slate-400">
                          {formatMoney(p.price)}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredOrders.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Orders
              </div>
              <div className="space-y-1">
                {filteredOrders.map((o) => (
                  <button
                    key={o.id}
                    onClick={() => handleSelect(`/orders/${o.id}`)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-600 shrink-0">
                        <ShoppingCart className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800 group-hover:text-red-600 transition-colors">
                          Order {o.orderNumber} - {o.customerName}
                        </div>
                        <div className="text-xs text-slate-400">
                          Status: {o.status} • Total: {formatCurrency(o.total, o.currency)}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {filteredCustomers.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
                Customers
              </div>
              <div className="space-y-1">
                {filteredCustomers.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(`/customers/${c.id}`)}
                    className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-200 overflow-hidden shrink-0">
                        <span className="h-full w-full flex items-center justify-center text-xs font-semibold text-slate-600">{initials(c.firstName, c.lastName)}</span>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-800 group-hover:text-red-600 transition-colors">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="text-xs text-slate-400">{c.email}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

