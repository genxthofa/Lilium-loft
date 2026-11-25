import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Search,
  Filter,
  Download,
  Eye,
  Printer,
  CheckCircle,
  Clock,
  AlertTriangle,
  RotateCcw,
  XCircle,
  ChevronRight,
  X,
  FileText,
  Loader2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FilterModal } from '@/components/ui/filter-modal';
import { InvoiceModal } from '@/components/orders/InvoiceModal';
import { OrderDetailModal } from '@/components/orders/OrderDetailModal';
import { BulkInvoiceModal } from '@/components/orders/BulkInvoiceModal';
import { printInvoice, downloadInvoicePDF, getInvoiceNumber } from '@/utils/invoice';
import { useOrderStore, useUIStore } from '@/store';
import { toast } from 'sonner';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { Order, OrderStatus } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { exportToCSV } from '@/utils/csv';

export function OrdersListPage() {
  const navigate = useNavigate();
  const { orders } = useOrderStore();
  const { generatedInvoiceIds, generateInvoice } = useUIStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  // Same rolling window the dashboard uses, so the two can be compared directly.
  const [period, setPeriod] = useState<string>('today');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo, setCustomTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedInvoiceOrder, setSelectedInvoiceOrder] = useState<Order | null>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<Order | null>(null);
  const [orderModalOpen, setOrderModalOpen] = useState(false);
  const [bulkInvoiceOpen, setBulkInvoiceOpen] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState<string | number | null>(null);
  const pageSize = 10;

  const handleGenerateInvoice = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    generateInvoice(order.id);
    const invNo = getInvoiceNumber(order);
    toast.success(`Invoice ${invNo} generated for order #${order.orderNumber}`);
    setSelectedInvoiceOrder(order);
    setInvoiceModalOpen(true);
  };

  const handleOpenInvoice = (order: Order, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedInvoiceOrder(order);
    setInvoiceModalOpen(true);
  };

  const handleDirectPrint = (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    printInvoice(order);
  };

  const handleDirectDownload = async (order: Order, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDownloadingOrderId(order.id);
      toast.loading(`Downloading Invoice for order #${order.orderNumber}...`, {
        id: `download-${order.id}`,
      });
      await downloadInvoicePDF(order);
      toast.success(`Invoice for order #${order.orderNumber} downloaded!`, {
        id: `download-${order.id}`,
      });
    } catch (err) {
      console.error('Failed to download invoice:', err);
      toast.error('Failed to download invoice PDF', { id: `download-${order.id}` });
    } finally {
      setDownloadingOrderId(null);
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm.trim() ||
    selectedStatus !== 'all' ||
    (period === 'custom' ? Boolean(customFrom || customTo) : period !== 'today')
  );

  const activeFilterCount =
    (selectedStatus !== 'all' ? 1 : 0) +
    (period !== 'today' ? 1 : 0) +
    (searchTerm.trim() ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedStatus('all');
    setPeriod('today');
    setCustomFrom('');
    setCustomTo('');
    setCurrentPage(1);
  };

  // Status Counts
  const counts = useMemo(() => {
    return {
      all: orders.length,
      processing: orders.filter((o) => o.status === 'processing').length,
      dispatch: orders.filter((o) => o.status === 'dispatch').length,
      completed: orders.filter((o) => o.status === 'completed').length,
      onHold: orders.filter((o) => o.status === 'on-hold').length,
      pending: orders.filter((o) => o.status === 'pending').length,
      failed: orders.filter((o) => o.status === 'failed').length,
      refunded: orders.filter((o) => o.status === 'refunded').length,
      cancelled: orders.filter((o) => o.status === 'cancelled').length,
    };
  }, [orders]);



  // Filtered orders
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const matchesSearch =
        o.orderNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.customerEmail.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesStatus =
        selectedStatus === 'all' || o.status === selectedStatus;

      let matchesPeriod = true;
      if (period === 'today') {
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        matchesPeriod = new Date(o.dateCreated).getTime() >= startOfToday.getTime();
      } else if (period === 'custom') {
        const orderTime = new Date(o.dateCreated).getTime();
        if (customFrom) {
          const fromTime = new Date(`${customFrom}T00:00:00`).getTime();
          if (orderTime < fromTime) matchesPeriod = false;
        }
        if (customTo) {
          const toTime = new Date(`${customTo}T23:59:59.999`).getTime();
          if (orderTime > toTime) matchesPeriod = false;
        }
      } else if (period !== 'all') {
        matchesPeriod = new Date(o.dateCreated).getTime() >= Date.now() - Number(period) * 86_400_000;
      }

      return matchesSearch && matchesStatus && matchesPeriod;
    });
  }, [orders, searchTerm, selectedStatus, period, customFrom, customTo]);

  const totalPages = Math.ceil(filteredOrders.length / pageSize);
  const paginatedOrders = filteredOrders.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
        return <Badge variant="success">Completed</Badge>;
      case 'processing':
        return <Badge variant="info">Order Placed</Badge>;
      case 'dispatch':
        return <Badge variant="purple">Dispatched</Badge>;
      case 'on-hold':
        return <Badge variant="warning">On-Hold</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pending Payment</Badge>;
      case 'refunded':
        return <Badge variant="purple">Refunded</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Cancelled</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleExport = () => {
    exportToCSV(
      orders.map((o) => ({
        OrderNumber: o.orderNumber,
        Customer: o.customerName,
        Email: o.customerEmail,
        Status: o.status,
        Date: o.dateCreated,
        ItemsCount: o.items.length,
        Total: o.total,
        Currency: o.currency,
        DatePaid: o.datePaid ?? '',
        PaymentMethod: o.paymentMethodTitle,
        TransactionID: o.transactionId,
      })),
      'woocommerce-orders'
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Orders
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Monitor, inspect, fulfill and process customer purchases and refunds.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setBulkInvoiceOpen(true)}
            className="flex-1 sm:flex-none gap-1.5 bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
          >
            <FileText className="h-4 w-4" />
            <span>Bulk Invoices</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            className="flex-1 sm:flex-none gap-1.5 bg-white text-slate-700"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </Button>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {[
          { key: 'all', label: 'All Orders', count: counts.all },
          { key: 'processing', label: 'Order Placed', count: counts.processing },
          { key: 'dispatch', label: 'Dispatched', count: counts.dispatch },
          { key: 'completed', label: 'Completed', count: counts.completed },
          { key: 'on-hold', label: 'On-Hold', count: counts.onHold },
          { key: 'pending', label: 'Pending', count: counts.pending },
          { key: 'failed', label: 'Failed', count: counts.failed },
          { key: 'refunded', label: 'Refunded', count: counts.refunded },
          { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
        ].map((tab) => {
          const isActive = selectedStatus === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedStatus(tab.key);
                setCurrentPage(1);
              }}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-red-600 text-white shadow-sm'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>



      {/* Search & Secondary Filter */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Mobile & Tablet: Search + Filter button + Clear button */}
          <div className="flex lg:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search orders, customers, or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 bg-slate-50/50 text-xs sm:text-sm h-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant={activeFilterCount > 0 ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilterModalOpen(true)}
              className={`h-9 px-3 gap-1.5 shrink-0 ${
                activeFilterCount > 0
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-white text-slate-700 border-slate-200'
              }`}
            >
              <Filter className="h-4 w-4" />
              <span className="text-xs font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600 text-[10px] font-bold">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="h-9 px-2 text-slate-500 hover:text-red-600 hover:bg-red-50 shrink-0"
                title="Clear all filters"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Desktop View: Full Search & Dropdowns */}
          <div className="hidden lg:flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by order number (#1001), customer name, or email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 bg-slate-50/50"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setCurrentPage(1);
                  }}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="w-48">
              <Select
                value={selectedStatus}
                onValueChange={(val) => {
                  setSelectedStatus(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="bg-slate-50/50">
                  <SelectValue placeholder="Status filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="processing">Order Placed</SelectItem>
                  <SelectItem value="dispatch">Dispatched</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="on-hold">On-Hold</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={period}
                onValueChange={(val) => {
                  setPeriod(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="bg-slate-50/50 w-36">
                  <SelectValue placeholder="Period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                  <SelectItem value="90">Last 90 days</SelectItem>
                  <SelectItem value="all">All time</SelectItem>
                  <SelectItem value="custom">Custom range</SelectItem>
                </SelectContent>
              </Select>

              {period === 'custom' && (
                <div className="flex items-center gap-1.5 bg-slate-50/80 p-1 rounded-md border border-slate-200">
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-8 text-xs w-32 bg-white"
                    placeholder="Start date"
                    title="From Date"
                  />
                  <span className="text-slate-400 text-xs">to</span>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-8 text-xs w-32 bg-white"
                    placeholder="End date"
                    title="To Date"
                  />
                </div>
              )}

              {hasActiveFilters && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleClearFilters}
                  className="h-10 px-3 text-xs text-slate-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50 shrink-0 gap-1"
                  title="Clear all filters"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Clear</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mobile/Tablet Filter Modal */}
      <FilterModal
        open={filterModalOpen}
        onOpenChange={setFilterModalOpen}
        title="Filter Orders"
        activeCount={activeFilterCount}
        onClear={handleClearFilters}
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Order #, customer name, email..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Order Status</label>
            <Select
              value={selectedStatus}
              onValueChange={(val) => {
                setSelectedStatus(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="processing">Order Placed</SelectItem>
                <SelectItem value="dispatch">Dispatched</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="on-hold">On-Hold</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Date Period</label>
            <Select
              value={period}
              onValueChange={(val) => {
                setPeriod(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All time" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="7">Last 7 days</SelectItem>
                <SelectItem value="30">Last 30 days</SelectItem>
                <SelectItem value="90">Last 90 days</SelectItem>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="custom">Custom range</SelectItem>
              </SelectContent>
            </Select>

            {period === 'custom' && (
              <div className="grid grid-cols-2 gap-2 mt-2.5">
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">From Date</label>
                  <Input
                    type="date"
                    value={customFrom}
                    onChange={(e) => {
                      setCustomFrom(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-slate-500 block mb-1">To Date</label>
                  <Input
                    type="date"
                    value={customTo}
                    onChange={(e) => {
                      setCustomTo(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </FilterModal>

      {/* Orders Table */}
      <Card>
        <CardContent className="p-0">
          {filteredOrders.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={ShoppingCart}
                title="No orders found"
                description="No customer orders match your current filter criteria."
              />
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card View (< lg) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-slate-50/40">
                {paginatedOrders.map((order) => (
                  <div
                    key={order.id}
                    onClick={() => {
                      setSelectedOrderForModal(order);
                      setOrderModalOpen(true);
                    }}
                    className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:border-slate-300 hover:shadow cursor-pointer transition-all space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-sm">
                          #{order.orderNumber}
                        </span>
                        <span className="text-slate-300">•</span>
                        <span className="text-xs text-slate-500">
                          {formatDate(order.dateCreated)}
                        </span>
                      </div>
                      {getStatusBadge(order.status)}
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <span className="font-medium text-slate-800 block">{order.customerName}</span>
                        <span className="text-[11px] text-slate-400 block truncate max-w-[200px]">
                          {order.customerEmail}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900 block">
                          {formatCurrency(order.total, order.currency)}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-2 border-t border-slate-100">
                      <span className="text-slate-400">
                        Payment: <span className="text-slate-700 font-medium">{order.paymentMethodTitle || 'Standard'}</span>
                      </span>
                      <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        {generatedInvoiceIds.includes(String(order.id)) ? (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => handleOpenInvoice(order, e)}
                              className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                              title="View Invoice"
                              aria-label="View Invoice"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => handleDirectPrint(order, e)}
                              className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                              title="Print Invoice"
                              aria-label="Print Invoice"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={(e) => handleDirectDownload(order, e)}
                              disabled={downloadingOrderId === order.id}
                              className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                              title="Download PDF"
                              aria-label="Download PDF"
                            >
                              {downloadingOrderId === order.id ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Download className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={(e) => handleGenerateInvoice(order, e)}
                            className="h-7 px-2.5 gap-1 text-[11px] bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                          >
                            <FileText className="h-3 w-3" />
                            <span>Generate</span>
                          </Button>
                        )}
                        <span
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="flex items-center gap-0.5 text-red-600 font-medium ml-1 cursor-pointer"
                        >
                          Details <ChevronRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (lg and above) */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-24">Order</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Items</TableHead>
                      <TableHead>Payment Method</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-center w-36">Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedOrders.map((order) => (
                      <TableRow
                        key={order.id}
                        onClick={() => {
                          setSelectedOrderForModal(order);
                          setOrderModalOpen(true);
                        }}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <TableCell className="font-bold text-slate-900 font-mono">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(order.dateCreated)}
                        </TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                        <TableCell>
                          <div className="font-medium text-slate-800 text-xs">
                            {order.customerName}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {order.customerEmail}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {order.items.length}{' '}
                          {order.items.length === 1 ? 'item' : 'items'}
                        </TableCell>
                        <TableCell className="text-xs text-slate-600">
                          {order.paymentMethodTitle}
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatCurrency(order.total, order.currency)}
                        </TableCell>
                        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {generatedInvoiceIds.includes(String(order.id)) ? (
                              <>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => handleOpenInvoice(order, e)}
                                  className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                                  title="View Invoice"
                                  aria-label="View Invoice"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => handleDirectPrint(order, e)}
                                  className="h-7 w-7 text-slate-600 hover:text-slate-900 hover:bg-slate-100 hover:border-slate-300"
                                  title="Print Invoice"
                                  aria-label="Print Invoice"
                                >
                                  <Printer className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={(e) => handleDirectDownload(order, e)}
                                  disabled={downloadingOrderId === order.id}
                                  className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200"
                                  title="Direct Download PDF"
                                  aria-label="Download PDF"
                                >
                                  {downloadingOrderId === order.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Download className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => handleGenerateInvoice(order, e)}
                                className="h-7 px-3 gap-1.5 text-xs bg-white text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              >
                                <FileText className="h-3.5 w-3.5" />
                                <span>Generate</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredOrders.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      {/* Official Lilium & Loft Tax Invoice Modal */}
      <InvoiceModal
        order={selectedInvoiceOrder}
        open={invoiceModalOpen}
        onOpenChange={setInvoiceModalOpen}
      />

      {/* Order Quick View / Detail Modal */}
      <OrderDetailModal
        order={selectedOrderForModal}
        open={orderModalOpen}
        onOpenChange={setOrderModalOpen}
        onViewInvoice={(order) => handleOpenInvoice(order)}
      />

      {/* Bulk Date-wise Invoice Modal */}
      <BulkInvoiceModal
        orders={orders}
        open={bulkInvoiceOpen}
        onOpenChange={setBulkInvoiceOpen}
      />
    </div>
  );
}

