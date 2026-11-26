import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { MainLayout } from '@/components/layout/MainLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/auth/LoginPage';

// Module Pages
import { DashboardPage } from '@/pages/dashboard/DashboardPage';
import { ProductsListPage } from '@/pages/products/ProductsListPage';
import { ProductFormPage } from '@/pages/products/ProductFormPage';
import { ProductDetailPage } from '@/pages/products/ProductDetailPage';
import { CategoriesPage } from '@/pages/products/CategoriesPage';
import { TrashPage } from '@/pages/products/TrashPage';
import { OrdersListPage } from '@/pages/orders/OrdersListPage';
import { OrderDetailPage } from '@/pages/orders/OrderDetailPage';
import { GstPage } from '@/pages/gst/GstPage';
import { CustomersListPage } from '@/pages/customers/CustomersListPage';
import { CustomerDetailPage } from '@/pages/customers/CustomerDetailPage';
import { InventoryPage } from '@/pages/inventory/InventoryPage';
import { CouponsListPage } from '@/pages/coupons/CouponsListPage';
import { ReportsPage } from '@/pages/reports/ReportsPage';
import { ShippingPage } from '@/pages/shipping/ShippingPage';
import { PaymentsPage } from '@/pages/payments/PaymentsPage';
import { SettingsPage } from '@/pages/settings/SettingsPage';

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          {/* Public Login Route */}
          <Route path="/login" element={<LoginPage />} />

          {/* Protected Admin Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<MainLayout />}>
              {/* 1. Dashboard */}
              <Route index element={<DashboardPage />} />

              {/* 2. Products */}
              <Route path="products" element={<ProductsListPage />} />
              <Route path="products/new" element={<ProductFormPage />} />
              <Route path="products/:id" element={<ProductDetailPage />} />
              <Route path="products/:id/edit" element={<ProductFormPage />} />
              <Route path="products/categories" element={<CategoriesPage />} />
              <Route path="products/trash" element={<TrashPage />} />

              {/* 3. Orders */}
              <Route path="orders" element={<OrdersListPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />

              {/* GST Invoices */}
              <Route path="gst" element={<GstPage />} />

              {/* 4. Customers */}
              <Route path="customers" element={<CustomersListPage />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />

              {/* 5. Inventory */}
              <Route path="inventory" element={<InventoryPage />} />

              {/* 6. Coupons */}
              <Route path="coupons" element={<CouponsListPage />} />

              {/* 7. Reports */}
              <Route path="reports" element={<ReportsPage />} />

              {/* 8. Shipping */}
              <Route path="shipping" element={<ShippingPage />} />

              {/* 9. Payments */}
              <Route path="payments" element={<PaymentsPage />} />

              {/* 10. Settings */}
              <Route path="settings" element={<SettingsPage />} />

              {/* Fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
        </Routes>
        <Toaster position="top-right" richColors closeButton />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
