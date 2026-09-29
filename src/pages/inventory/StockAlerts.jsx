import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Card, Checkbox, Col, Empty, Input, InputNumber, Modal, Row,
  Select, Space, Statistic, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ClearOutlined, EyeOutlined, FallOutlined, ReloadOutlined, SearchOutlined,
  ShopOutlined, ShoppingCartOutlined, WarningOutlined,
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import categoryService from '../../services/categoryService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import StockDetailDrawer from './StockDetailDrawer.jsx';

const BUCKETS = ['totalQty', 'availableQty', 'reservedQty', 'blockedQty', 'damagedQty', 'sampleQty', 'transitQty', 'shortQty'];
const BUCKET_LABELS = {
  totalQty: 'Total', availableQty: 'Available', reservedQty: 'Reserved', blockedQty: 'Blocked',
  damagedQty: 'Damaged', sampleQty: 'Sample', transitQty: 'Transit', shortQty: 'Short',
};
const ALERT_LEVELS = {
  out_of_stock: { label: 'Out of Stock', color: 'red' },
  critical: { label: 'Critical', color: 'volcano' },
  low_stock: { label: 'Low Stock', color: 'orange' },
  adequate: { label: 'Adequate', color: 'green' },
};
const WARNING_LABELS = {
  product_reorder_not_configured: 'Product reorder level uses branch fallback',
  product_minimum_not_configured: 'Product minimum level uses branch fallback',
  reorder_normalized_to_minimum: 'Reorder level raised to minimum level',
  negative_available_stock: 'Negative available stock requires reconciliation',
};
const SORT_OPTIONS = [
  ['severity', 'Severity'], ['available', 'Available quantity'], ['deficit', 'Deficit'],
  ['productName', 'Product name'], ['stockValue', 'Stock value'], ['lastMovementAt', 'Last movement'],
].map(([value, label]) => ({ value, label }));
const DEFAULT_FILTERS = {
  severity: [], warehouse: undefined, brand: undefined, category: undefined,
  reorderSource: undefined, hasOpenRequisition: undefined, includeAdequate: false,
  sortBy: 'severity', sortOrder: 'asc',
};
const numberText = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const cleanParams = source => Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== ''));

const SeverityTag = ({ value }) => {
  const level = ALERT_LEVELS[value] || ALERT_LEVELS.adequate;
  return <Tag color={level.color} className="font-semibold">{value === 'out_of_stock' && <WarningOutlined className="mr-1" />}{level.label}</Tag>;
};

const StockAlerts = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState({});
  const [scope, setScope] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filterOptions, setFilterOptions] = useState({});
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [showReorder, setShowReorder] = useState(false);
  const [selectedStockId, setSelectedStockId] = useState(null);
  const [breakdownRow, setBreakdownRow] = useState(null);
  const requestSequence = useRef(0);
  const optionsSequence = useRef(0);
  const pollInFlight = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const updateFilters = patch => {
    setFilters(current => ({ ...current, ...patch }));
    setPagination(current => ({ ...current, current: 1 }));
  };

  const loadAlerts = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await purchaseService.getCanonicalStockAlerts(cleanParams({
        page: pagination.current,
        limit: pagination.pageSize,
        search: debouncedSearch || undefined,
        severity: filters.severity.length ? filters.severity.join(',') : undefined,
        warehouse: filters.warehouse,
        brand: filters.brand,
        category: filters.category,
        reorderSource: filters.reorderSource,
        hasOpenRequisition: filters.hasOpenRequisition,
        includeAdequate: filters.includeAdequate,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      }));
      if (requestId !== requestSequence.current) return;
      if (response.success) {
        const data = response.data || [];
        setRows(data);
        setSummary(response.summary || {});
        setScope(response.scope || {});
        setPagination(current => ({
          ...current,
          current: response.pagination?.currentPage ?? current.current,
          pageSize: response.pagination?.itemsPerPage ?? current.pageSize,
          total: response.pagination?.totalItems ?? data.length,
        }));
      }
    } catch (loadError) {
      if (requestId === requestSequence.current) setError(loadError.message || 'Unable to load stock alerts.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [debouncedSearch, filters, pagination.current, pagination.pageSize]);

  const loadOptions = useCallback(async () => {
    const requestId = ++optionsSequence.current;
    try {
      const [stockResponse, brandResponse] = await Promise.all([
        purchaseService.getStockFilterOptions(),
        categoryService.getBrands({ limit: 200 }),
      ]);
      if (requestId !== optionsSequence.current) return;
      if (stockResponse.success) setFilterOptions(stockResponse.data || {});
      if (brandResponse.success) setBrands(brandResponse.data || []);
    } catch (loadError) {
      if (requestId === optionsSequence.current) message.error(loadError.message || 'Unable to load filters');
    }
  }, []);

  useEffect(() => { loadAlerts(); }, [loadAlerts]);
  useEffect(() => { loadOptions(); }, [loadOptions]);
  useEffect(() => {
    let timer; let cancelled = false;
    const run = async () => {
      if (cancelled || document.visibilityState !== 'visible' || pollInFlight.current) return;
      pollInFlight.current = true;
      try { await loadAlerts(); }
      finally { pollInFlight.current = false; if (!cancelled) timer = setTimeout(run, 30000); }
    };
    const foreground = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); void run(); } };
    window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground);
    timer = setTimeout(run, 30000);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); };
  }, [loadAlerts]);
  useEffect(() => {
    if (!filters.brand) { setCategories([]); return undefined; }
    let active = true;
    categoryService.getCategories(filters.brand, { limit: 200 })
      .then(response => { if (active && response.success) setCategories(response.data || []); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [filters.brand]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilters(DEFAULT_FILTERS);
    setPagination(current => ({ ...current, current: 1 }));
  };

  const openStockDashboard = (row, bucket) => {
    const params = new URLSearchParams({ tab: 'balances', product: String(row.product) });
    const warehouse = bucket?.warehouse?._id || row.warehouse?._id;
    if (warehouse) params.set('warehouse', String(warehouse));
    if (bucket) {
      params.set('shade', bucket.shade || '');
      params.set('batch', bucket.batch || '');
    }
    navigate(`/inventory/stock?${params.toString()}`);
  };

  const inspectRow = row => {
    if (row.buckets?.length === 1 && row.buckets[0].stockId) setSelectedStockId(row.buckets[0].stockId);
    else setBreakdownRow(row);
  };

  const columns = useMemo(() => [
    { title: 'Severity', dataIndex: 'severity', fixed: 'left', width: 120, render: value => <SeverityTag value={value} /> },
    {
      title: 'Product', fixed: 'left', width: 245,
      render: (_, row) => <div className="flex items-center gap-2"><ProductImage src={row.productImage} size="sm" /><div className="min-w-0"><div className="font-medium truncate">{row.productName}</div><div className="text-xs text-gray-400 font-mono">{row.productCode || 'No code'} · Base {row.unit || 'Unit'}</div><div className="text-xs text-gray-500 truncate">{[row.brand?.name, row.category?.name, row.tileSize, row.finish].filter(Boolean).join(' · ') || '—'}</div></div></div>,
    },
    { title: 'Scope', width: 160, render: (_, row) => <div className="text-xs"><div className="font-medium">{row.warehouse?.name || 'All branch warehouses'}</div><div className="text-gray-400">{row.buckets?.length || 0} exact bucket(s)</div></div> },
    ...BUCKETS.map(bucket => ({ title: BUCKET_LABELS[bucket], dataIndex: ['quantities', bucket], width: 115, align: 'right', render: (value, row) => <span className={bucket === 'availableQty' ? 'font-bold' : ''}>{numberText(value)} <small className="text-gray-400">{row.unit || 'Unit'}</small></span> })),
    {
      title: 'Threshold authority', width: 245,
      render: (_, row) => <div className="text-xs space-y-1"><div><strong>Effective:</strong> min {numberText(row.thresholds?.effectiveMinStockLevel)} / reorder {numberText(row.thresholds?.effectiveReorderLevel)}</div><div className="text-gray-500">Configured: min {numberText(row.thresholds?.configuredMinStockLevel)} / reorder {numberText(row.thresholds?.configuredReorderLevel)}</div><Space size={4} wrap><Tag color={row.thresholds?.reorderSource === 'product' ? 'blue' : 'gold'}>{row.thresholds?.reorderSource === 'product' ? 'Product reorder' : 'Branch reorder fallback'}</Tag><Tag color={row.thresholds?.minSource === 'product' ? 'blue' : 'gold'}>{row.thresholds?.minSource === 'product' ? 'Product minimum' : 'Branch minimum fallback'}</Tag></Space>{row.configurationWarnings?.length > 0 && <Tooltip title={row.configurationWarnings.map(warning => WARNING_LABELS[warning] || warning).join(' • ')}><Tag color="warning">{row.configurationWarnings.length} warning(s)</Tag></Tooltip>}</div>,
    },
    {
      title: 'Deficit / Reorder', width: 175,
      render: (_, row) => <div className="text-xs"><div>Deficit: <strong>{numberText(row.deficit)} {row.unit || 'Unit'}</strong></div><div>Suggested: <strong className="text-blue-700">{numberText(row.suggestedQuantity)} {row.unit || 'Unit'}</strong></div><div>Net after open supply: {numberText(row.netSuggestedQuantity)} {row.unit || 'Unit'}</div><div className="text-gray-500">Est. {money(row.valuation?.suggestedValue)}</div></div>,
    },
    {
      title: 'Valuation', width: 150,
      render: (_, row) => <div className="text-xs"><div>Rate {money(row.valuation?.effectiveRate)}</div><div>Total <strong>{money(row.valuation?.totalValue)}</strong></div><div>Available {money(row.valuation?.availableValue)}</div></div>,
    },
    {
      title: 'Procurement', width: 230,
      render: (_, row) => <div className="text-xs space-y-1">{row.openRequisitions?.length ? row.openRequisitions.map(pr => <div key={`${pr._id}-${pr.itemId}`}><Button type="link" size="small" className="p-0 h-auto" onClick={() => navigate(`/sales-purchase/purchase-requisition?pr=${pr._id}`)}>{pr.prNumber}</Button> <Tag>{pr.status}</Tag> · {numberText(pr.requiredQty)}</div>) : <span className="text-gray-400">No open requisition</span>}{row.openPurchaseOrders?.map(po => <div key={`${po._id}-${po.itemId}`}><Tag color={['approved', 'sent', 'partial_received'].includes(po.status) ? 'green' : 'blue'}>{po.poNumber} · {po.status}</Tag> pending {numberText(po.pendingQty)}</div>)}</div>,
    },
    { title: 'Last activity', width: 175, render: (_, row) => <div className="text-xs"><div>Movement: {dateTime(row.lastMovementAt)}</div><div>GRN: {dateTime(row.lastGRNAt)}</div><div className="text-gray-500">{row.lastReceipt?.supplierName || 'No supplier history'}</div></div> },
    {
      title: 'Actions', fixed: 'right', width: 135,
      render: (_, row) => <Space direction="vertical" size={0}><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => inspectRow(row)}>{row.buckets?.length === 1 ? 'Details' : 'Breakdown'}</Button><Button type="link" size="small" onClick={() => openStockDashboard(row)}>Stock Dashboard</Button></Space>,
    },
  ], [navigate]);

  const breakdownColumns = [
    { title: 'Warehouse', render: (_, bucket) => bucket.warehouse?.name || '—' },
    { title: 'Shade', dataIndex: 'shade', render: value => value || 'No shade' },
    { title: 'Batch', dataIndex: 'batch', render: value => value || 'No batch' },
    ...BUCKETS.map(bucket => ({ title: BUCKET_LABELS[bucket], dataIndex: ['quantities', bucket], width: 88, align: 'right', render: numberText })),
    { title: 'Value', dataIndex: ['valuation', 'totalValue'], render: money },
    { title: 'Actions', fixed: 'right', width: 145, render: (_, bucket) => <Space><Button type="link" size="small" disabled={!bucket.stockId} onClick={() => setSelectedStockId(bucket.stockId)}>Details</Button><Button type="link" size="small" onClick={() => openStockDashboard(breakdownRow, bucket)}>Dashboard</Button></Space> },
  ];

  return <div>
    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 mb-5">
      <div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><WarningOutlined className="text-orange-500 text-xl" />Stock Alerts</h1><p className="text-sm text-gray-500 mt-0.5">Server-authoritative product alerts using effective product or branch thresholds</p></div>
      <Space wrap><Button icon={<ShoppingCartOutlined />} onClick={() => setShowReorder(true)} type="primary" ghost>Reorder Guidance</Button><Button icon={<ClearOutlined />} onClick={clearFilters}>Clear</Button><Button icon={<ReloadOutlined />} onClick={loadAlerts} loading={loading}>Refresh</Button></Space>
    </div>

    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-7 gap-2 mb-4">
      {[
        ['Out of Stock', summary.outOfStock, '#dc2626', 'out_of_stock'],
        ['Critical', summary.critical, '#ea580c', 'critical'],
        ['Low Stock', summary.lowStock, '#d97706', 'low_stock'],
        ['Adequate', summary.adequate, '#16a34a', 'adequate'],
        ['Total Deficit', numberText(summary.totalDeficit), '#2563eb'],
        ['Stock Value', money(summary.totalValue), '#0f766e'],
        ['Open Reorders', summary.openReorderCount, '#7c3aed'],
      ].map(([label, value, color, severity]) => <Card key={label} size="small" className={severity ? 'cursor-pointer' : ''} onClick={() => severity && updateFilters({ severity: [severity], includeAdequate: severity === 'adequate' })}><Statistic title={<span className="text-xs">{label}</span>} value={value || 0} valueStyle={{ color, fontSize: 19 }} /></Card>)}
    </div>

    {summary.configurationWarnings?.total > 0 && <Alert className="mb-4" showIcon type="warning" message={`${summary.configurationWarnings.products} product(s) have configuration or integrity warnings`} description={<Space wrap>{Object.entries(summary.configurationWarnings.byCode || {}).map(([warning, count]) => <Tag key={warning} color={warning === 'negative_available_stock' ? 'red' : 'gold'}>{WARNING_LABELS[warning] || warning}: {count}</Tag>)}</Space>} />}
    {error && <Alert className="mb-4" type="error" showIcon message="Stock alerts could not be loaded" description={error} action={<Button size="small" onClick={loadAlerts}>Retry</Button>} />}

    <Card size="small" className="mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <Input prefix={<SearchOutlined />} placeholder="Search product name or code" allowClear value={search} onChange={event => { setSearch(event.target.value); setPagination(current => ({ ...current, current: 1 })); }} />
        <Select mode="multiple" maxTagCount="responsive" placeholder="All alert severities" allowClear value={filters.severity} onChange={value => updateFilters({ severity: value })} options={Object.entries(ALERT_LEVELS).map(([value, item]) => ({ value, label: item.label }))} />
        <Select placeholder="All warehouses" allowClear value={filters.warehouse} onChange={value => updateFilters({ warehouse: value })} options={(filterOptions.warehouses || []).filter(item => item.status === 'active').map(item => ({ value: item._id, label: item.name }))} />
        <Select placeholder="All brands" allowClear showSearch optionFilterProp="label" value={filters.brand} onChange={value => updateFilters({ brand: value, category: undefined })} options={brands.map(item => ({ value: item._id, label: item.name }))} />
        <Select placeholder="All categories" allowClear disabled={!filters.brand} showSearch optionFilterProp="label" value={filters.category} onChange={value => updateFilters({ category: value })} options={categories.map(item => ({ value: item._id, label: item.name }))} />
        <Select placeholder="Any threshold source" allowClear value={filters.reorderSource} onChange={value => updateFilters({ reorderSource: value })} options={[{ value: 'product', label: 'Product reorder level' }, { value: 'branch_fallback', label: 'Branch reorder fallback' }]} />
        <Select placeholder="Any PR state" allowClear value={filters.hasOpenRequisition} onChange={value => updateFilters({ hasOpenRequisition: value })} options={[{ value: true, label: 'Has open requisition' }, { value: false, label: 'No open requisition' }]} />
        <Select value={filters.sortBy} onChange={value => updateFilters({ sortBy: value })} options={SORT_OPTIONS} />
        <Select value={filters.sortOrder} onChange={value => updateFilters({ sortOrder: value })} options={[{ value: 'asc', label: 'Ascending' }, { value: 'desc', label: 'Descending' }]} />
        <Checkbox checked={filters.includeAdequate} onChange={event => updateFilters({ includeAdequate: event.target.checked })}>Include adequate stock</Checkbox>
      </div>
      <div className="text-xs text-gray-500 mt-3">Branch fallbacks: minimum {numberText(scope.fallbackMinStockLevel)} · reorder {numberText(scope.fallbackReorderLevel)} · minimum reorder quantity {numberText(scope.minimumReorderQuantity)}</div>
    </Card>

    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table rowKey={row => `${row.product}-${row.warehouse?._id || 'branch'}`} columns={columns} dataSource={rows} loading={loading} size="small" scroll={{ x: 2450 }} rowClassName={row => row.severity === 'out_of_stock' ? 'bg-red-50' : row.severity === 'critical' ? 'bg-orange-50' : ''} locale={{ emptyText: loading ? 'Loading…' : <Empty description="No products match the selected alert filters." /> }} pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100, 200], showTotal: total => `${total} alert products` }} onChange={next => setPagination(current => ({ ...current, current: next.current || 1, pageSize: next.pageSize || current.pageSize }))} />
    </div>

    <Modal title={breakdownRow ? `${breakdownRow.productName} — exact stock buckets` : 'Stock bucket breakdown'} open={Boolean(breakdownRow)} onCancel={() => setBreakdownRow(null)} footer={<Button onClick={() => setBreakdownRow(null)}>Close</Button>} width="min(1280px, 96vw)" destroyOnHidden>
      {breakdownRow?.buckets?.length ? <Table rowKey={bucket => bucket.stockId} size="small" columns={breakdownColumns} dataSource={breakdownRow.buckets} pagination={false} scroll={{ x: 1300 }} /> : <Alert type="info" showIcon message="No Stock rows exist for this active product" description="It is correctly shown as zero stock. Open Stock Dashboard after choosing a warehouse when stock is received." />}
    </Modal>

    <StockDetailDrawer open={Boolean(selectedStockId)} stockId={selectedStockId} onClose={() => setSelectedStockId(null)} filterOptions={filterOptions} />
    <ReorderSuggestionsModal open={showReorder} onClose={() => setShowReorder(false)} warehouse={filters.warehouse} warehouses={(filterOptions.warehouses || []).filter(item => item.status === 'active')} />
  </div>;
};

const ReorderSuggestionsModal = ({ open, onClose, warehouse, warehouses }) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('po.management');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState({});
  const [selected, setSelected] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [receivingWarehouse, setReceivingWarehouse] = useState(warehouse || undefined);
  const requestSequence = useRef(0);

  const fetchSuggestions = useCallback(async scopeWarehouse => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    try {
      const response = await purchaseService.getReorderSuggestions({ warehouse: scopeWarehouse || undefined });
      if (requestId !== requestSequence.current) return;
      if (response.success) {
        const data = response.data || [];
        setSuggestions(data);
        setSummary(response.summary || {});
        setSelected([]);
        setQuantities(Object.fromEntries(data.map(row => [String(row.product), Number(row.netSuggestedQty || row.suggestedQty || 1)])));
      }
    } catch (error) {
      if (requestId === requestSequence.current) message.error(error.message || 'Unable to load reorder guidance');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) { requestSequence.current += 1; return; }
    const initialWarehouse = warehouse || undefined;
    setReceivingWarehouse(initialWarehouse);
    fetchSuggestions(initialWarehouse);
  }, [fetchSuggestions, open, warehouse]);

  const createRequisition = async () => {
    if (!canManage) return;
    if (!receivingWarehouse) return message.error('Select the receiving warehouse');
    const selectedRows = suggestions.filter(row => selected.includes(String(row.product)));
    if (!selectedRows.length) return message.error('Select at least one suggestion');
    if (selectedRows.some(row => row.hasOpenRequisition)) return message.error('A selected product already has an open purchase requisition');
    if (selectedRows.some(row => !(Number(quantities[row.product]) > 0))) return message.error('Every selected quantity must be positive');
    setCreating(true);
    try {
      const response = await purchaseService.createPurchaseRequisition({
        source: 'reorder_suggestion', department: 'Inventory', warehouse: receivingWarehouse,
        priority: selectedRows.some(row => row.urgency === 'critical') ? 'urgent' : 'high',
        remarks: `Created from ${warehouse ? 'warehouse-scoped' : 'branch-scoped'} canonical stock alerts`,
        items: selectedRows.map(row => ({ product: row.product, requiredQty: Number(quantities[row.product]), currentStock: row.currentStock, provenance: row.provenance })),
      });
      if (response.success) {
        message.success(`${response.data.prNumber} created as a draft requisition`);
        onClose();
        navigate(`/sales-purchase/purchase-requisition?pr=${response.data._id}`, { state: { openPurchaseRequisitionId: response.data._id } });
      }
    } catch (error) { message.error(error.message || 'Unable to create purchase requisition'); }
    finally { setCreating(false); }
  };

  return <Modal title="Reorder Guidance" open={open} onCancel={onClose} width="min(1180px, 96vw)" destroyOnHidden footer={[<Button key="close" onClick={onClose}>Close</Button>, canManage && <Button key="create" type="primary" loading={creating} disabled={!selected.length || !receivingWarehouse} onClick={createRequisition}>Create Draft Purchase Requisition</Button>].filter(Boolean)}>
    <div className="space-y-4 mt-3">
      <Row gutter={[12, 12]}>{[['Suggestions', summary.total], ['Out of stock', summary.critical], ['Critical', summary.high], ['Low stock', summary.medium]].map(([label, value], index) => <Col xs={12} md={6} key={label}><Card size="small"><Statistic title={label} value={value || 0} valueStyle={index ? { color: index === 1 ? '#dc2626' : '#ea580c' } : {}} /></Card></Col>)}</Row>
      <Alert type={canManage ? 'info' : 'warning'} showIcon message={canManage ? 'Draft requisitions remain subject to the procurement approval workflow.' : 'Reorder guidance only'} description={canManage ? 'Select a receiving warehouse. Products with an open requisition are locked to prevent duplicate PRs.' : 'Purchase Order Management permission is required to raise a requisition.'} />
      {canManage && <div className="flex flex-col sm:flex-row sm:items-center gap-2"><label className="text-xs text-gray-500">Receiving warehouse *</label><Select className="w-full sm:w-72" placeholder="Select warehouse" value={receivingWarehouse} onChange={value => { setReceivingWarehouse(value); fetchSuggestions(value); }} options={warehouses.map(item => ({ value: item._id, label: item.name }))} /></div>}
      <Table
        rowKey={row => String(row.product)} size="small" loading={loading} dataSource={suggestions} scroll={{ x: 1250 }} pagination={{ pageSize: 25, showSizeChanger: false }}
        rowSelection={canManage ? { selectedRowKeys: selected, onChange: keys => setSelected(keys.map(String)), getCheckboxProps: row => ({ disabled: row.hasOpenRequisition || Number(row.netSuggestedQty) <= 0, name: row.productName }) } : undefined}
        columns={[
          { title: 'Product', width: 230, render: (_, row) => <div className="flex gap-2"><ProductImage src={row.productImage} size="xs" /><div><div className="font-medium">{row.productName}</div><div className="text-xs text-gray-400">{row.productCode} · {row.brand} · {row.tileSize}</div></div></div> },
          { title: 'Current', dataIndex: 'currentStock', width: 90, align: 'right', render: value => <strong>{numberText(value)}</strong> },
          { title: 'Thresholds', width: 175, render: (_, row) => <div className="text-xs">Reorder {numberText(row.reorderLevel)}<br />Min {numberText(row.minimumStockLevel)} · {row.reorderLevelSource === 'product' ? 'product' : 'branch fallback'}</div> },
          { title: 'Deficit', dataIndex: 'deficit', width: 90, align: 'right', render: numberText },
          { title: 'Suggested', width: 135, render: (_, row) => canManage ? <InputNumber size="small" min={0.0001} disabled={row.hasOpenRequisition || Number(row.netSuggestedQty) <= 0} value={quantities[row.product]} onChange={value => setQuantities(current => ({ ...current, [row.product]: value }))} /> : numberText(row.suggestedQty) },
          { title: 'Supplier / Rate', width: 190, render: (_, row) => <div className="text-xs"><div>{row.suggestedSupplierName}</div><div className="text-gray-500">{money(row.lastPurchaseRate)} · {dateTime(row.lastReceiptAt)}</div></div> },
          { title: 'Open procurement', width: 250, render: (_, row) => row.openRequisitions?.length ? row.openRequisitions.map(pr => <div key={pr._id}><Button type="link" size="small" className="p-0" onClick={() => navigate(`/sales-purchase/purchase-requisition?pr=${pr._id}`)}>{pr.prNumber}</Button><Tag>{pr.status}</Tag> {numberText(pr.requiredQty)}</div>) : row.openPurchaseOrders?.length ? row.openPurchaseOrders.map(po => <Tag key={po._id} color="blue">{po.poNumber} · {po.status}</Tag>) : <span className="text-gray-400">None</span> },
          { title: 'Urgency', dataIndex: 'urgency', width: 90, render: value => <Tag color={{ critical: 'red', high: 'orange', medium: 'blue' }[value]}>{value}</Tag> },
        ]}
        locale={{ emptyText: <Empty description="All active products are adequately stocked." /> }}
      />
    </div>
  </Modal>;
};

export default StockAlerts;
