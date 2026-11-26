import React from 'react';
import { Menu, Search, Plus, RefreshCw } from 'lucide-react';
import { useUIStore, useBackendSyncStore } from '@/store';
import { Button } from '@/components/ui/button';
import { NotificationDropdown } from './NotificationDropdown';
import { StockAlertDropdown } from './StockAlertDropdown';
import { ProfileDropdown } from './ProfileDropdown';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '@/utils/errors';
import { toast } from 'sonner';

export function TopHeader() {
  const { setMobileMenuOpen, setSearchOpen } = useUIStore();
  const { status, importFromStore, lastSynced } = useBackendSyncStore();
  const navigate = useNavigate();

  // Pulls everything from WooCommerce into the database, then reloads the screens from it.
  const handleManualSync = async () => {
    const minLoadingTime = new Promise((resolve) => setTimeout(resolve, 1500));
    useUIStore.getState().setIsManualSyncing(true);
    try {
      const [res] = await Promise.all([
        importFromStore(),
        minLoadingTime,
      ]);
      if (res.ok) {
        const total = res.results.reduce((n, r) => n + r.records, 0);
        toast.success(`Synced from WooCommerce: ${total} records.`);
      } else {
        const failed = res.results.filter((r) => r.status === 'failed');
        toast.error(
          `Sync incomplete. Failed: ${failed.map((r) => r.resource).join(', ')}. ${failed[0]?.error ?? ''}`.trim()
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Sync failed: could not reach the backend.'));
    } finally {
      useUIStore.getState().setIsManualSyncing(false);
    }
  };

  return (
    <header className="h-20 shrink-0 bg-white border-b border-slate-200/80 z-20 flex items-center justify-between px-3 sm:px-6 gap-3">
      {/* Left section: mobile hamburger & search bar moved to left */}
      <div className="flex items-center gap-2 sm:gap-3 flex-1 max-w-md min-w-0">
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="lg:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 shrink-0"
        >
          <Menu className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </button>

        <button
          onClick={() => setSearchOpen(true)}
          className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50/70 text-slate-400 hover:bg-slate-100/70 hover:border-slate-300 transition-all text-sm"
        >
          <div className="flex items-center gap-2 min-w-0">
            <Search className="h-4 w-4 text-slate-400 shrink-0" />
            <span className="text-xs sm:text-sm text-slate-500 truncate">
              Search products, orders...
            </span>
          </div>
          <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-500 shrink-0 ml-2">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Right section: Action Buttons, Notifications, Profile */}
      <div className="flex items-center gap-1 sm:gap-3 shrink-0">
        <Button
          onClick={handleManualSync}
          disabled={status === 'syncing'}
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex gap-1.5 text-xs text-slate-700 border-slate-200 hover:bg-slate-50"
          title={lastSynced ? `Last loaded: ${new Date(lastSynced).toLocaleTimeString()}. Click to import the latest from WooCommerce.` : 'Import the latest from WooCommerce'}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          <span>{status === 'connected' ? 'Sync Website' : 'Connect API'}</span>
        </Button>

        <Button
          onClick={() => navigate('/products/new')}
          size="sm"
          className="hidden sm:inline-flex gap-1.5 bg-red-600 hover:bg-red-700 text-white font-medium"
        >
          <Plus className="h-4 w-4" />
          <span>Add Product</span>
        </Button>

        <Button
          onClick={handleManualSync}
          disabled={status === 'syncing'}
          variant="ghost"
          size="icon"
          className="sm:hidden text-slate-600 hover:text-slate-900"
          title="Import the latest from WooCommerce"
        >
          <RefreshCw className={`h-5 w-5 ${status === 'syncing' ? 'animate-spin' : ''}`} />
          <span className="sr-only">Sync Website</span>
        </Button>

        <div className="h-4 w-px bg-slate-200 hidden sm:block" />

        <StockAlertDropdown />
        <NotificationDropdown />
        <ProfileDropdown />
      </div>
    </header>
  );
}
