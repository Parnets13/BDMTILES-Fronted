import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Table, Button, Input, InputNumber, Select, Tag, Space, message, Tooltip, Row, Col,
  Card, Statistic, Alert, Collapse, DatePicker,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, DeleteOutlined, ReloadOutlined,
  RiseOutlined, FilterOutlined,
} from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';
import SalesOrderView from './SalesOrderView.jsx';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

const { RangePicker } = DatePicker;

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', approved: 'cyan', processing: 'orange',
  partial_dispatch: 'geekblue', dispatched: 'purple', delivered: 'green', cancelled: 'red', expired: 'volcano',
};
const PAYMENT_COLORS = { pending: 'orange', partial: 'blue', paid: 'green', overdue: 'red' };
const EMPTY_FILTERS = {
  paymentStatus: undefined,
  dateFrom: undefined,
  dateTo: undefined,
  expectedDeliveryFrom: undefined,
  expectedDeliveryTo: undefined,
  customer: undefined,
  dealerType: undefined,
  product: undefined,
  category: undefined,
  region: undefined,
  deliveryStatus: undefined,
  salesExecutive: undefined,
  branch: undefined,
  approvalStatus: undefined,
  reservationStatus: undefined,
  orderType: undefined,
  deliveryPriority: undefined,
  cancellationRequestStatus: undefined,
  tallySyncStatus: undefined,
  source: undefined,
  amountMin: undefined,
  amountMax: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

const selectOptions = (values) => values.map(value => ({
  value,
  label: value.replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()),
}));
const compactParams = params => Object.fromEntries(
  Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== '')
);

const SalesOrderDashboard = () => {
  const navigate = useNavigate();
  const { hasPermission, user, activeBranchId } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [customerInput, setCustomerInput] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [stats, setStats] = useState({});
  const [viewOrderId, setViewOrderId] = useState(null);
  const [viewOrderBranch, setViewOrderBranch] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [refreshSequence, setRefreshSequence] = useState(0);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookups, setLookups] = useState({ branches: [], dealerTypes: [], categories: [], regions: [], salesExecutives: [] });
  const [lookupAvailability, setLookupAvailability] = useState({ branches: true, dealerTypes: true, regions: true, salesExecutives: true });
  const [productOptions, setProductOptions] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const orderRequestSequence = useRef(0);
  const statsRequestSequence = useRef(0);
  const lookupRequested = useRef(false);
  const productRequestSequence = useRef(0);
  const productSearchTimer = useRef(null);

  const resetPage = useCallback(() => {
    setPagination(current => ({ ...current, current: 1 }));
  }, []);

  const updateFilters = useCallback((changes) => {
    setFilters(current => ({ ...current, ...changes }));
    resetPage();
  }, [resetPage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      resetPage();
    }, 350);
    return () => clearTimeout(timer);
  }, [searchInput, resetPage]);

  useEffect(() => {
    const committedCustomer = customerInput.trim() || undefined;
    if (filters.customer === committedCustomer) return undefined;
    const timer = setTimeout(() => {
      setFilters(current => ({ ...current, customer: committedCustomer }));
      resetPage();
    }, 350);
    return () => clearTimeout(timer);
  }, [customerInput, filters.customer, resetPage]);

  const loadStats = useCallback(async () => {
    const requestId = ++statsRequestSequence.current;
    try {
      const response = await salesService.getStats(filters.branch ? { branch: filters.branch } : undefined);
      if (requestId === statsRequestSequence.current && response.success) setStats(response.data || {});
    } catch {
      // The order table remains usable if summary cards cannot be loaded.
    }
  }, [filters.branch]);

  const fetchOrders = useCallback(async () => {
    const requestId = ++orderRequestSequence.current;
    setLoading(true);
    try {
      const params = compactParams({
        page: pagination.current || 1,
        limit: pagination.pageSize || 20,
        search,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...filters,
      });
      const response = await salesService.getOrders(params);
      if (requestId !== orderRequestSequence.current) return;
      if (response.success) {
        const data = Array.isArray(response.data) ? response.data : [];
        setOrders(data);
        setPagination(current => ({
          ...current,
          current: response.pagination?.currentPage || current.current || 1,
          pageSize: response.pagination?.itemsPerPage || current.pageSize || 20,
          total: response.pagination?.totalItems ?? data.length,
        }));
      }
    } catch (error) {
      if (requestId === orderRequestSequence.current) message.error(error.message);
    } finally {
      if (requestId === orderRequestSequence.current) setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter, filters]);

  useEffect(() => { loadStats(); }, [loadStats, refreshSequence]);
  useEffect(() => { fetchOrders(); }, [fetchOrders, refreshSequence]);
  useEffect(() => () => {
    orderRequestSequence.current += 1;
    statsRequestSequence.current += 1;
    productRequestSequence.current += 1;
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
  }, []);

  const loadLookups = useCallback(async () => {
    if (lookupRequested.current) return;
    lookupRequested.current = true;
    setLookupLoading(true);
    const assignedBranches = (user?.assignedBranches || []).filter(item => item && typeof item === 'object' && item.status !== 'inactive');
    const assignedRegions = (user?.assignedRegions || []).filter(item => item && typeof item === 'object');
    const ownExecutive = user?.role === 'sales_executive' && user?._id
      ? [{ _id: user._id, name: user.name, phone: user.phone }]
      : [];
    const canLoadBranches = hasPermission('branch.master');
    const canLoadDealerTypes = hasPermission('dealer.type');
    const canLoadRegions = hasPermission('region.master');
    const canLoadExecutives = hasPermission('dealer.assignment.manage');
    const results = await Promise.allSettled([
      canLoadBranches ? masterService.getBranches({ page: 1, limit: 200, status: 'active' }) : Promise.resolve({ success: true, data: assignedBranches }),
      canLoadDealerTypes ? masterService.getDealerTypes({ page: 1, limit: 200 }) : Promise.resolve({ success: false }),
      productService.getFilterOptions(),
      canLoadRegions ? masterService.getRegions({ page: 1, limit: 200 }) : Promise.resolve({ success: true, data: assignedRegions }),
      canLoadExecutives ? masterService.getSalesExecutives() : Promise.resolve({ success: true, data: ownExecutive }),
    ]);
    const successfulData = index => results[index].status === 'fulfilled' && results[index].value?.success
      ? results[index].value.data
      : undefined;
    const productFilters = successfulData(2) || {};
    const branches = Array.isArray(successfulData(0)) ? successfulData(0) : assignedBranches;
    const dealerTypes = Array.isArray(successfulData(1)) ? successfulData(1) : [];
    const regions = Array.isArray(successfulData(3)) ? successfulData(3) : assignedRegions;
    const salesExecutives = Array.isArray(successfulData(4)) ? successfulData(4) : ownExecutive;
    setLookups({
      branches,
      dealerTypes,
      categories: Array.isArray(productFilters.categories) ? productFilters.categories : [],
      regions,
      salesExecutives,
    });
    setLookupAvailability({
      branches: branches.length > 0 || successfulData(0) !== undefined,
      dealerTypes: dealerTypes.length > 0 || successfulData(1) !== undefined,
      regions: regions.length > 0 || successfulData(3) !== undefined,
      salesExecutives: salesExecutives.length > 0 || successfulData(4) !== undefined,
    });
    setLookupLoading(false);
  }, [hasPermission, user]);

  useEffect(() => {
    if (advancedOpen) loadLookups();
  }, [advancedOpen, loadLookups]);

  const searchProducts = useCallback((value) => {
    if (productSearchTimer.current) clearTimeout(productSearchTimer.current);
    const query = value.trim();
    if (query.length < 2) {
      productRequestSequence.current += 1;
      setProductLoading(false);
      return;
    }
    productSearchTimer.current = setTimeout(async () => {
      const requestId = ++productRequestSequence.current;
      setProductLoading(true);
      try {
        const response = await salesService.searchProducts({ q: query, page: 1, limit: 30, category: filters.category });
        if (requestId === productRequestSequence.current && response.success) {
          setProductOptions(Array.isArray(response.data) ? response.data : []);
        }
      } catch (error) {
        if (requestId === productRequestSequence.current) message.error(error.message);
      } finally {
        if (requestId === productRequestSequence.current) setProductLoading(false);
      }
    }, 350);
  }, [filters.category]);

  const refresh = () => setRefreshSequence(value => value + 1);

  const clearFilters = () => {
    orderRequestSequence.current += 1;
    setSearchInput('');
    setSearch('');
    setCustomerInput('');
    setStatusFilter('all');
    setFilters(EMPTY_FILTERS);
    setProductOptions([]);
    resetPage();
  };

  const handleDelete = async (id) => {
    try {
      const response = await salesService.deleteOrder(id);
      if (response.success) {
        message.success(response.message);
        refresh();
      }
    } catch (error) { message.error(error.message); }
  };

  const activeFilterCount = useMemo(() => {
    const nonDefaults = Object.entries(filters).filter(([key, value]) => (
      value !== undefined && value !== '' && !((key === 'sortBy' && value === 'createdAt') || (key === 'sortOrder' && value === 'desc'))
    )).length;
    return nonDefaults + (searchInput ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);
  }, [filters, searchInput, statusFilter]);

  const TABS = [
    { key: 'all', label: 'All', count: stats.total },
    { key: 'draft', label: 'Draft', count: stats.draft },
    { key: 'confirmed', label: 'Confirmed', count: stats.confirmed },
    { key: 'approved', label: 'Approved', count: stats.approved },
    { key: 'processing', label: 'Processing', count: stats.processing },
    { key: 'partial_dispatch', label: 'Part Dispatch', count: stats.partialDispatch },
    { key: 'dispatched', label: 'Dispatched', count: stats.dispatched },
    { key: 'delivered', label: 'Delivered', count: stats.delivered },
    { key: 'expired', label: 'Expired', count: stats.expired },
    { key: 'cancelled', label: 'Cancelled', count: stats.cancelled },
  ];

  const columns = [
    {
      title: 'Order #', dataIndex: 'orderNumber', width: 130,
      render: value => <span className="text-xs font-mono text-blue-600 font-semibold">{value}</span>,
    },
    { title: 'Date', dataIndex: 'orderDate', width: 95, render: value => <span className="text-xs">{value ? new Date(value).toLocaleDateString('en-IN') : '—'}</span> },
    {
      title: 'Dealer / Customer', key: 'dealer', width: 180,
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[165px]">{record.dealerName || record.customerName || '—'}</div>
          <div className="text-xs text-gray-400">{record.dealerCode || record.customerPhone || ''}</div>
        </div>
      ),
    },
    { title: 'Items', key: 'items', width: 55, render: (_, record) => <span className="text-sm">{record.items?.length || 0}</span> },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110, render: value => <span className="text-sm font-semibold">₹{Number(value || 0).toLocaleString('en-IN')}</span> },
    { title: 'Status', dataIndex: 'status', width: 115, render: status => <Tag color={STATUS_COLORS[status]}>{status?.replace(/_/g, ' ')}</Tag> },
    { title: 'Payment', dataIndex: 'paymentStatus', width: 90, render: status => <Tag color={PAYMENT_COLORS[status]}>{status}</Tag> },
    {
      // Kept from origin/master: Tally sync visibility alongside the existing
      // tallySyncStatus filter.
      title: 'Tally', dataIndex: 'tallySyncStatus', width: 90,
      render: status => (
        <Tag color={status === 'synced' ? 'green' : status === 'pending' ? 'orange' : status === 'failed' ? 'red' : 'default'}>
          {status === 'not_synced' ? 'Not Synced' : status}
        </Tag>
      ),
    },
    {
      title: 'Actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => {
            setViewOrderId(record._id);
            setViewOrderBranch(record.branch?._id || record.branch || null);
          }} /></Tooltip>
          {record.status === 'draft' && String(record.branch?._id || record.branch || '') === String(activeBranchId || '') && (
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record._id)} /></Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const dateRangeValue = (from, to) => (from || to ? [from ? dayjs(from) : null, to ? dayjs(to) : null] : null);
  const rangeChange = (fromKey, toKey) => (_, dateStrings) => updateFilters({
    [fromKey]: dateStrings?.[0] || undefined,
    [toKey]: dateStrings?.[1] || undefined,
  });

  const advancedFilters = (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
      <Input placeholder="Dealer / customer name or code" value={customerInput} onChange={event => setCustomerInput(event.target.value)} allowClear />
      <Select placeholder="Dealer type" value={filters.dealerType} onChange={value => updateFilters({ dealerType: value })} allowClear showSearch optionFilterProp="label" loading={lookupLoading} disabled={!lookupLoading && !lookupAvailability.dealerTypes} notFoundContent={lookupAvailability.dealerTypes ? undefined : 'Unavailable for your role'} options={lookups.dealerTypes.map(item => ({ value: item._id, label: item.pricingTier ? `${item.name} · ${item.pricingTier}` : item.name }))} />
      <Select placeholder="Product (type 2+ characters)" value={filters.product} onChange={value => updateFilters({ product: value })} onSearch={searchProducts} allowClear showSearch filterOption={false} loading={productLoading} notFoundContent={productLoading ? 'Searching…' : 'Type at least 2 characters'} options={productOptions.map(item => ({ value: item._id, label: `${item.itemName} (${item.productCode || 'No code'})` }))} />
      <Select placeholder="Product category" value={filters.category} onChange={value => { setProductOptions([]); updateFilters({ category: value, product: undefined }); }} allowClear showSearch optionFilterProp="label" loading={lookupLoading} options={lookups.categories.map(item => ({ value: item._id, label: item.name }))} />
      <Select placeholder="Region" value={filters.region} onChange={value => updateFilters({ region: value })} allowClear showSearch optionFilterProp="label" loading={lookupLoading} disabled={!lookupLoading && !lookupAvailability.regions} notFoundContent={lookupAvailability.regions ? undefined : 'Unavailable for your role'} options={lookups.regions.map(item => ({ value: item._id, label: item.name }))} />
      <Select placeholder="Delivery status" value={filters.deliveryStatus} onChange={value => updateFilters({ deliveryStatus: value })} allowClear options={selectOptions(['assigned', 'in_transit', 'reached', 'delivered', 'partially_delivered', 'failed', 'rescheduled', 'returned'])} />
      <Select placeholder="Sales executive" value={filters.salesExecutive} onChange={value => updateFilters({ salesExecutive: value })} allowClear showSearch optionFilterProp="label" loading={lookupLoading} disabled={!lookupLoading && !lookupAvailability.salesExecutives} notFoundContent={lookupAvailability.salesExecutives ? undefined : 'Unavailable for your role'} options={lookups.salesExecutives.map(item => ({ value: item._id, label: item.phone ? `${item.name} · ${item.phone}` : item.name }))} />
      <Select placeholder="Branch" value={filters.branch} onChange={value => updateFilters({ branch: value })} allowClear showSearch optionFilterProp="label" loading={lookupLoading} disabled={!lookupLoading && !lookupAvailability.branches} notFoundContent={lookupAvailability.branches ? undefined : 'No assigned branches available'} options={lookups.branches.map(item => ({ value: item._id, label: `${item.branchCode || 'Branch'} — ${item.name}` }))} />
      <Select placeholder="Approval status" value={filters.approvalStatus} onChange={value => updateFilters({ approvalStatus: value })} allowClear options={selectOptions(['not_required', 'pending', 'approved', 'rejected'])} />
      <Select placeholder="Reservation status" value={filters.reservationStatus} onChange={value => updateFilters({ reservationStatus: value })} allowClear options={selectOptions(['none', 'reserving', 'reserved', 'partial', 'released', 'consumed'])} />
      <Select placeholder="Order type" value={filters.orderType} onChange={value => updateFilters({ orderType: value })} allowClear options={selectOptions(['dealer', 'wholesaler', 'retail', 'distributor', 'builder', 'online', 'project'])} />
      <Select placeholder="Delivery priority" value={filters.deliveryPriority} onChange={value => updateFilters({ deliveryPriority: value })} allowClear options={selectOptions(['normal', 'urgent', 'vip'])} />
      <Select placeholder="Cancellation request" value={filters.cancellationRequestStatus} onChange={value => updateFilters({ cancellationRequestStatus: value })} allowClear options={selectOptions(['none', 'pending', 'approved', 'rejected'])} />
      <Select placeholder="Tally sync" value={filters.tallySyncStatus} onChange={value => updateFilters({ tallySyncStatus: value })} allowClear options={selectOptions(['not_synced', 'pending', 'synced', 'failed'])} />
      <Select placeholder="Source" value={filters.source} onChange={value => updateFilters({ source: value })} allowClear options={[{ value: 'quotation', label: 'Quotation conversion' }, { value: 'legacy_direct', label: 'Legacy direct' }]} />
      <RangePicker className="w-full" placeholder={['Expected delivery from', 'Expected delivery to']} value={dateRangeValue(filters.expectedDeliveryFrom, filters.expectedDeliveryTo)} onChange={rangeChange('expectedDeliveryFrom', 'expectedDeliveryTo')} />
      <InputNumber className="w-full" min={0} prefix="₹" placeholder="Minimum amount" value={filters.amountMin} onChange={value => updateFilters({ amountMin: value ?? undefined })} />
      <InputNumber className="w-full" min={0} prefix="₹" placeholder="Maximum amount" value={filters.amountMax} onChange={value => updateFilters({ amountMax: value ?? undefined })} />
      <Select placeholder="Sort by" value={filters.sortBy} onChange={value => updateFilters({ sortBy: value })} options={[
        { value: 'createdAt', label: 'Created date' }, { value: 'updatedAt', label: 'Updated date' },
        { value: 'orderDate', label: 'Order date' }, { value: 'expectedDeliveryDate', label: 'Expected delivery' },
        { value: 'orderNumber', label: 'Order number' }, { value: 'grandTotal', label: 'Amount' },
      ]} />
      <Select placeholder="Sort order" value={filters.sortOrder} onChange={value => updateFilters({ sortOrder: value })} options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]} />
    </div>
  );

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sales Order Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all dealer and retail sales orders</p>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>
          <ModuleRecycleBin module="sales_order" title="Deleted Sales Orders" onRestore={refresh} />
          {hasPermission('quotation.management') && <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => navigate('/sales-purchase/quotation-manager')}>New Quotation</Button>}
        </Space>
      </div>

      <Alert className="mb-4" type="info" showIcon message="Every Sales Order must be converted from an approved or accepted quotation." />

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={24} sm={12} lg={6}><Card size="small"><Statistic title="Today's Sales" value={`₹${Number(stats.todaySales || 0).toLocaleString('en-IN')}`} prefix={<RiseOutlined />} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Confirmed" value={stats.confirmed || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Processing" value={stats.processing || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Dispatched" value={stats.dispatched || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Delivered" value={stats.delivered || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <div className="flex flex-wrap gap-2 mb-4">
        {TABS.map(tab => {
          const isActive = statusFilter === tab.key;
          return (
            <button key={tab.key} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border flex items-center gap-1.5 ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'}`} onClick={() => { setStatusFilter(tab.key); resetPage(); }}>
              <span>{tab.label}</span>
              {tab.count != null && <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-xs ${isActive ? 'bg-white/30' : 'bg-gray-300/60 text-gray-700'}`}>{tab.count}</span>}
            </button>
          );
        })}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(220px,1.5fr)_minmax(150px,0.7fr)_minmax(260px,1fr)_auto] gap-3">
          <Input placeholder="Search order #, dealer..." prefix={<SearchOutlined className="text-gray-400" />} value={searchInput} onChange={event => setSearchInput(event.target.value)} allowClear />
          <Select placeholder="Payment status" options={selectOptions(Object.keys(PAYMENT_COLORS))} value={filters.paymentStatus} onChange={value => updateFilters({ paymentStatus: value })} allowClear />
          <RangePicker className="w-full" placeholder={['Order date from', 'Order date to']} value={dateRangeValue(filters.dateFrom, filters.dateTo)} onChange={rangeChange('dateFrom', 'dateTo')} />
          <Space wrap>
            <Button icon={<FilterOutlined />} onClick={() => setAdvancedOpen(open => !open)}>Advanced{activeFilterCount ? ` (${activeFilterCount})` : ''}</Button>
            <Button onClick={clearFilters} disabled={!activeFilterCount}>Clear Filters</Button>
          </Space>
        </div>
        <Collapse ghost className="mt-2" activeKey={advancedOpen ? ['advanced'] : []} onChange={keys => setAdvancedOpen(keys.includes('advanced'))} items={[{ key: 'advanced', label: 'Advanced server filters', children: advancedFilters }]} />
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={orders}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 1100 }}
          pagination={{
            current: pagination.current || 1,
            pageSize: pagination.pageSize || 20,
            total: pagination.total || 0,
            showSizeChanger: true,
            showTotal: (total, range) => range?.length ? `${range[0]}–${range[1]} of ${total} orders` : `${total} orders`,
          }}
          onChange={next => setPagination(current => ({
            ...current,
            current: next?.current || 1,
            pageSize: next?.pageSize || current.pageSize || 20,
          }))}
        />
      </div>

      {viewOrderId && <SalesOrderView
        orderId={viewOrderId}
        branchId={viewOrderBranch}
        readOnlyBranch={Boolean(viewOrderBranch && activeBranchId && String(viewOrderBranch) !== String(activeBranchId))}
        onClose={() => {
          setViewOrderId(null);
          setViewOrderBranch(null);
        }}
        onStatusChange={refresh}
      />}
    </div>
  );
};

export default SalesOrderDashboard;
