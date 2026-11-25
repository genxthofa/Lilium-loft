import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Search,
  Plus,
  Mail,
  ShoppingBag,
  IndianRupee,
  ChevronRight,
  ExternalLink,
  Filter,
  RotateCcw,
  X,
  AlertCircle,
  Trash2,
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FilterModal } from '@/components/ui/filter-modal';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState } from '@/components/ui/empty-state';
import { useCustomerStore } from '@/store';
import { Customer } from '@/types';
import { formatCurrency, formatDate } from '@/utils/formatters';
import { initials } from '@/utils/initials';
import { getErrorMessage } from '@/utils/errors';
import { DeleteCustomerDialog } from '@/components/customers/DeleteCustomerDialog';
import { CustomerDetailModal } from '@/components/customers/CustomerDetailModal';
import { toast } from 'sonner';

export function CustomersListPage() {
  const navigate = useNavigate();
  const { customers, createCustomer } = useCustomerStore();

  const [searchTerm, setSearchTerm] = useState('');
  const [filterActivity, setFilterActivity] = useState<'all' | 'with-orders' | 'no-orders'>('all');
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [selectedCustomerForModal, setSelectedCustomerForModal] = useState<Customer | null>(null);
  const [customerModalOpen, setCustomerModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const hasActiveFilters = Boolean(searchTerm.trim() || filterActivity !== 'all');
  const activeFilterCount = (filterActivity !== 'all' ? 1 : 0) + (searchTerm.trim() ? 1 : 0);

  const handleClearFilters = () => {
    setSearchTerm('');
    setFilterActivity('all');
    setCurrentPage(1);
  };

  // Add customer modal
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [hasValidated, setHasValidated] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState<Customer | null>(null);

  const handleCustomerFieldChange = (field: 'firstName' | 'lastName' | 'email', value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (hasValidated || formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        const trimmed = value.trim();
        if (field === 'firstName') {
          if (!trimmed) {
            next.firstName = 'First name is required';
          } else {
            delete next.firstName;
          }
        } else if (field === 'lastName') {
          if (!trimmed) {
            next.lastName = 'Last name is required';
          } else {
            delete next.lastName;
          }
        } else if (field === 'email') {
          if (!trimmed) {
            next.email = 'Email address is required';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
            next.email = 'Please enter a valid email address';
          } else {
            delete next.email;
          }
        }
        return next;
      });
    }
  };
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    phone: '',
    address1: '',
    city: '',
    state: '',
    postcode: '',
    country: '',
  });

  const filteredCustomers = useMemo(() => {
    return customers.filter((c) => {
      const full = `${c.firstName} ${c.lastName}`.toLowerCase();
      const query = searchTerm.toLowerCase();
      const matchesSearch = full.includes(query) || c.email.toLowerCase().includes(query) || c.username.toLowerCase().includes(query);
      const matchesActivity =
        filterActivity === 'all' ||
        (filterActivity === 'with-orders' && (c.totalOrders || 0) > 0) ||
        (filterActivity === 'no-orders' && (c.totalOrders || 0) === 0);

      return matchesSearch && matchesActivity;
    });
  }, [customers, searchTerm, filterActivity]);

  const totalPages = Math.ceil(filteredCustomers.length / pageSize);
  const paginatedCustomers = filteredCustomers.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    setHasValidated(true);
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim()) {
      errs.firstName = 'First name is required';
    }
    if (!formData.lastName.trim()) {
      errs.lastName = 'Last name is required';
    }
    if (!formData.email.trim()) {
      errs.email = 'Email address is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errs.email = 'Please enter a valid email address';
    }

    if (Object.keys(errs).length > 0) {
      setFormErrors(errs);
      return;
    }
    setFormErrors({});

    try {
      await createCustomer({
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim(),
        username: formData.username || undefined,
        phone: formData.phone,
        address1: formData.address1,
        city: formData.city,
        state: formData.state,
        postcode: formData.postcode,
        country: formData.country,
      });
    } catch (err) {
      toast.error(getErrorMessage(err));
      return;
    }

    toast.success(`Customer "${formData.firstName} ${formData.lastName}" registered.`);
    setAddModalOpen(false);
    setHasValidated(false);
    setFormErrors({});
    setFormData({
      firstName: '',
      lastName: '',
      email: '',
      username: '',
      phone: '',
      address1: '',
      city: '',
      state: '',
      postcode: '',
      country: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            View registered buyers, order histories, addresses, and customer profiles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
          <Button
            onClick={() => setAddModalOpen(true)}
            size="sm"
            className="flex-1 sm:flex-none gap-1.5 bg-red-600 hover:bg-red-700 text-white"
          >
            <Plus className="h-4 w-4" />
            <span>Add Customer</span>
          </Button>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="p-3 sm:p-4">
          {/* Mobile & Tablet: Search + Filter button + Clear button */}
          <div className="flex sm:hidden items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search customers..."
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

          {/* Desktop & Tablet View: Search + Activity Filter */}
          <div className="hidden sm:flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search customers by name, username or email..."
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

            <div className="w-52 flex items-center gap-2">
              <Select
                value={filterActivity}
                onValueChange={(val: 'all' | 'with-orders' | 'no-orders') => {
                  setFilterActivity(val);
                  setCurrentPage(1);
                }}
              >
                <SelectTrigger className="bg-slate-50/50 flex-1">
                  <SelectValue placeholder="Customer Activity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  <SelectItem value="with-orders">Has Ordered</SelectItem>
                  <SelectItem value="no-orders">No Orders Yet</SelectItem>
                </SelectContent>
              </Select>

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
        title="Filter Customers"
        activeCount={activeFilterCount}
        onClear={handleClearFilters}
      >
        <div className="space-y-3.5">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Search Query</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Name, username, email..."
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
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Purchase Activity</label>
            <Select
              value={filterActivity}
              onValueChange={(val: 'all' | 'with-orders' | 'no-orders') => {
                setFilterActivity(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="All Customers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Customers</SelectItem>
                <SelectItem value="with-orders">Has Ordered</SelectItem>
                <SelectItem value="no-orders">No Orders Yet</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </FilterModal>

      {/* Customers Table */}
      <Card>
        <CardContent className="p-0">
          {filteredCustomers.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title="No customers found"
                description="No buyers match your search query."
                actionLabel="Register Customer"
                onAction={() => setAddModalOpen(true)}
              />
            </div>
          ) : (
            <>
              {/* Mobile & Tablet Card View (< lg) */}
              <div className="lg:hidden p-3 sm:p-4 space-y-3 bg-slate-50/40">
                {paginatedCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => {
                      setSelectedCustomerForModal(customer);
                      setCustomerModalOpen(true);
                    }}
                    className="p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-white shadow-sm hover:border-slate-300 hover:shadow cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-11 w-11 rounded-full bg-slate-100 overflow-hidden shrink-0 border border-slate-200 flex items-center justify-center text-xs font-semibold text-slate-700">
                          {initials(customer.firstName, customer.lastName)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-semibold text-slate-900 text-sm truncate">
                            {customer.firstName} {customer.lastName}
                          </h4>
                          <p className="text-xs text-slate-400 truncate">
                            {customer.email}
                          </p>
                          {customer.username && (
                            <span className="font-mono text-[11px] text-slate-400">
                              @{customer.username}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <div className="text-sm font-bold text-slate-900">
                            {formatCurrency(customer.totalSpent)}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            <span className="inline-block px-2 py-0.5 rounded-full bg-slate-100 font-medium text-[10px] text-slate-700">
                              {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete customer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setCustomerToDelete(customer);
                          }}
                          className="h-8 w-8 text-slate-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                      <span>Joined {formatDate(customer.registeredDate)}</span>
                      <span className="flex items-center gap-0.5 text-red-600 font-medium">
                        View Profile <ChevronRight className="h-3 w-3" />
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View (lg and above) */}
              <div className="hidden lg:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-14">Avatar</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Registered</TableHead>
                      <TableHead className="text-center">Orders</TableHead>
                      <TableHead className="text-right">Total Spent</TableHead>
                      <TableHead className="w-24 text-right"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedCustomers.map((customer) => (
                      <TableRow
                        key={customer.id}
                        onClick={() => {
                          setSelectedCustomerForModal(customer);
                          setCustomerModalOpen(true);
                        }}
                        className="cursor-pointer hover:bg-slate-50/80 transition-colors"
                      >
                        <TableCell>
                          <div className="h-10 w-10 rounded-full bg-slate-200 overflow-hidden shrink-0 border border-slate-200">
                            <span className="h-full w-full flex items-center justify-center text-xs font-semibold text-slate-600">{initials(customer.firstName, customer.lastName)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-slate-900 text-sm">
                            {customer.firstName} {customer.lastName}
                          </div>
                          <div className="text-xs text-slate-400">
                            {customer.email}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-xs text-slate-500">
                          {customer.username ? `@${customer.username}` : ''}
                        </TableCell>
                        <TableCell className="text-xs text-slate-500">
                          {formatDate(customer.registeredDate)}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 font-semibold text-xs text-slate-700">
                            {customer.totalOrders}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-bold text-slate-900">
                          {formatCurrency(customer.totalSpent)}
                        </TableCell>
                        <TableCell className="text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete customer"
                            onClick={(e) => {
                              e.stopPropagation();
                              setCustomerToDelete(customer);
                            }}
                            className="h-8 w-8 text-slate-400 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <ChevronRight className="h-4 w-4 text-slate-400 inline" />
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
            totalItems={filteredCustomers.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
          />
        </CardContent>
      </Card>

      <DeleteCustomerDialog customer={customerToDelete} onClose={() => setCustomerToDelete(null)} />

      {/* Add Customer Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">
              Add New Customer
            </DialogTitle>
            <DialogDescription className="text-xs">
              Register a customer profile for offline or administrative purchases.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCustomer} noValidate className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">First Name <span className="text-red-500">*</span></label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => handleCustomerFieldChange('firstName', e.target.value)}
                  placeholder="John"
                  className={formErrors.firstName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {formErrors.firstName && (
                  <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{formErrors.firstName}</span>
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Last Name <span className="text-red-500">*</span></label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => handleCustomerFieldChange('lastName', e.target.value)}
                  placeholder="Doe"
                  className={formErrors.lastName ? 'border-red-500 focus-visible:ring-red-500' : ''}
                />
                {formErrors.lastName && (
                  <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3 shrink-0" />
                    <span>{formErrors.lastName}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Email Address <span className="text-red-500">*</span></label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => handleCustomerFieldChange('email', e.target.value)}
                placeholder="john.doe@example.com"
                className={formErrors.email ? 'border-red-500 focus-visible:ring-red-500' : ''}
              />
              {formErrors.email && (
                <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  <span>{formErrors.email}</span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">Phone</label>
                <Input
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700">City</label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="New York"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">Street Address</label>
              <Input
                value={formData.address1}
                onChange={(e) => setFormData({ ...formData, address1: e.target.value })}
                placeholder="123 Fifth Ave, Apt 4"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setAddModalOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Create Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Quick View / Detail Modal */}
      <CustomerDetailModal
        customer={selectedCustomerForModal}
        open={customerModalOpen}
        onOpenChange={setCustomerModalOpen}
      />
    </div>
  );
}

