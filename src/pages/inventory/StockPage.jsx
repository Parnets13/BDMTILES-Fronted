import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, Collapse, DatePicker, Empty, Input, InputNumber, Row,
  Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ClearOutlined, EyeOutlined, PlusCircleOutlined, ReloadOutlined, SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import purchaseService from '../../services/purchaseService.js';
import categoryService from '../../services/categoryService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import StockDetailDrawer from './StockDetailDrawer.jsx';

const { RangePicker } = DatePicker;
const BUCKETS = ['totalQty', 'availableQty', 'reservedQty', 'blockedQty', 'damagedQty', 'sampleQty', 'transitQty', 'shortQty'];
const BUCKET_LABELS = {
  totalQty: 'Total', availableQty: 'Available', reservedQty: 'Reserved', blockedQty: 'Blocked',
  damagedQty: 'Damaged', sampleQty: 'Sample', transitQty: 'Transit', shortQty: 'Short',
};
const BUCKET_HELP = {
  totalQty: 'All physical stock in the exact stock bucket.', availableQty: 'Stock currently free for allocation.',
  reservedQty: 'Stock committed to demand.', blockedQty: 'Stock held from normal allocation.',
  damagedQty: 'Stock classified as damaged.', sampleQty: 'Stock assigned for samples.',
  transitQty: 'Stock currently moving between locations.', shortQty: 'Stock recorded as short.',
};
const QUANTITY_FIELDS = BUCKETS.map(value => ({ value, label: BUCKET_LABELS[value] }));
const SORT_FIELDS = [
  ['updatedAt', 'Updated'], ['createdAt', 'Created'], ['totalQty', 'Total quantity'],
  ['availableQty', 'Available quantity'], ['reservedQty', 'Reserved quantity'],
  ['damagedQty', 'Damaged quantity'], ['transitQty', 'Transit quantity'], ['shortQty', 'Short quantity'],
  ['stockValue', 'Stock value'], ['productName', 'Product name'], ['warehouseName', 'Warehouse name'],
].map(([value, label]) => ({ value, label }));
const MOVEMENT_SORT_FIELDS = [
  ['occurredAt', 'Occurred date'], ['recordedAt', 'Recorded date'], ['enteredQuantity', 'Entered quantity'],
  ...BUCKETS.map(bucket => [`deltas.${bucket}`, `${BUCKET_LABELS[bucket]} delta`]),
].map(([value, label]) => ({ value, label }));
const DEFAULT_FILTERS = {
  product: undefined, warehouse: undefined, status: [], brand: undefined, category: undefined,
  shade: undefined, batch: undefined, quantityField: 'totalQty', minQty: undefined, maxQty: undefined,
  minValue: undefined, maxValue: undefined, dates: null, sortBy: 'updatedAt', sortOrder: 'desc',
};
const DEFAULT_MOVEMENT_FILTERS = {
  movementType: [], sourceType: [], warehouse: undefined, product: undefined, shade: undefined,
  batch: undefined, direction: undefined, deltaField: 'totalQty', minDelta: undefined,
  maxDelta: undefined, actor: undefined, search: '', sourceNumber: '', dates: null,
  sortBy: 'occurredAt', sortOrder: 'desc',
};

const titleCase = value => value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '—';
const numberText = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateText = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const cleanParams = source => Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== null));

const availabilityTag = row => {
  const available = Number(row.availableQty || 0);
  const reorderLevel = Number(row.product?.reorderLevel || 0);
  if (available <= 0) return <Tag color="red">Out of stock</Tag>;
  if (available <= reorderLevel) return <Tag color="orange">Low stock</Tag>;
  return <Tag color="green">In stock</Tag>;
};

const movementClass = movement => {
  const type = movement.movementType || '';
  if (type === 'migration_opening') return { label: 'Baseline', color: 'default' };
  if (type.includes('reservation')) return { label: type.includes('release') ? 'Reservation release' : 'Reservation', color: 'blue' };
  if (type.includes('damage') || type.includes('short')) return { label: 'Reclassification', color: 'orange' };
  if (Number(movement.deltas?.totalQty || 0) > 0) return { label: 'Inbound', color: 'green' };
  if (Number(movement.deltas?.totalQty || 0) < 0) return { label: 'Outbound', color: 'red' };
  return { label: 'Reclassification', color: 'purple' };
};

const DeltaVector = ({ deltas = {} }) => (
  <div className="flex flex-wrap gap-1 max-w-[400px]">
    {BUCKETS.map(bucket => {
      const value = Number(deltas[bucket] || 0);
      if (!value) return null;
      return <Tag key={bucket} color={value > 0 ? 'green' : 'red'}>{BUCKET_LABELS[bucket]} {value > 0 ? '+' : ''}{numberText(value)}</Tag>;
    })}
    {!BUCKETS.some(bucket => Number(deltas[bucket] || 0)) && <span className="text-xs text-gray-400">No quantity change</span>}
  </div>
);

const SummaryCards = ({ summary }) => {
  const cards = [
    ['Total', summary.totalQty], ['Available', summary.availableQty], ['Reserved', summary.reservedQty],
    ['Blocked', summary.blockedQty], ['Damaged', summary.damagedQty], ['Sample', summary.sampleQty],
    ['Transit', summary.transitQty], ['Short', summary.shortQty], ['Total valuation', summary.totalValue, true],
    ['Available valuation', summary.availableValue, true], ['SKU buckets', summary.skuBuckets],
    ['Products', summary.uniqueProducts], ['Warehouses', summary.warehouseCount],
    ['In stock', summary.inStockCount], ['Low stock', summary.lowStockCount], ['Out of stock', summary.outOfStockCount],
    ['Reserved buckets', summary.reservedCount], ['Damaged buckets', summary.damagedCount],
    ['Transit buckets', summary.transitCount], ['Short buckets', summary.shortCount],
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-10 gap-2 mb-4">
      {cards.map(([label, value, currency]) => (
        <Card size="small" key={label} className="min-w-0">
          <Statistic title={<span className="text-xs">{label}</span>} value={currency ? money(value) : numberText(value)} valueStyle={{ fontSize: 16 }} />
        </Card>
      ))}
    </div>
  );
};

const StockPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilters = useMemo(() => ({
    ...DEFAULT_FILTERS,
    ...(searchParams.get('tab') === 'movements' ? {} : {
      product: searchParams.get('product') || undefined,
      warehouse: searchParams.get('warehouse') || undefined,
      shade: searchParams.has('shade') ? searchParams.get('shade') : undefined,
      batch: searchParams.has('batch') ? searchParams.get('batch') : undefined,
    }),
  }), []);

  const [activeTab, setActiveTab] = useState(searchParams.get('tab') === 'movements' ? 'movements' : 'balances');
  const [search, setSearch] = useState(searchParams.get('tab') === 'movements' ? '' : (searchParams.get('search') || ''));
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [filters, setFilters] = useState(initialFilters);
  const [stock, setStock] = useState([]);
  const [summary, setSummary] = useState({});
  const [filterOptions, setFilterOptions] = useState({});
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [selectedStockId, setSelectedStockId] = useState(null);

  const [movementFilters, setMovementFilters] = useState({
    ...DEFAULT_MOVEMENT_FILTERS,
    ...(searchParams.get('tab') === 'movements' ? {
      product: searchParams.get('product') || undefined,
      warehouse: searchParams.get('warehouse') || undefined,
      shade: searchParams.has('shade') ? searchParams.get('shade') : undefined,
      batch: searchParams.has('batch') ? searchParams.get('batch') : undefined,
      search: searchParams.get('search') || '',
    } : {}),
  });
  const [debouncedMovementSearch, setDebouncedMovementSearch] = useState(searchParams.get('tab') === 'movements' ? (searchParams.get('search') || '') : '');
  const [debouncedSourceNumber, setDebouncedSourceNumber] = useState('');
  const [movements, setMovements] = useState([]);
  const [movementSummary, setMovementSummary] = useState({});
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementSummaryLoading, setMovementSummaryLoading] = useState(false);
  const [movementError, setMovementError] = useState('');
  const [movementPagination, setMovementPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const listSequence = useRef(0);
  const summarySequence = useRef(0);
  const movementSequence = useRef(0);
  const movementSummarySequence = useRef(0);
  const optionSequence = useRef(0);
  const pollInFlight = useRef(false);
  const applyingUrl = useRef(false);
  const writtenQuery = useRef(null);
  const queryString = searchParams.toString();

  useEffect(() => {
    if (writtenQuery.current === queryString) {
      writtenQuery.current = null;
      return;
    }
    applyingUrl.current = true;
    const tab = searchParams.get('tab') === 'movements' ? 'movements' : 'balances';
    const exact = {
      product: searchParams.get('product') || undefined,
      warehouse: searchParams.get('warehouse') || undefined,
      shade: searchParams.has('shade') ? searchParams.get('shade') : undefined,
      batch: searchParams.has('batch') ? searchParams.get('batch') : undefined,
    };
    setActiveTab(tab);
    if (tab === 'movements') {
      setMovementFilters(current => ({ ...current, ...exact, search: searchParams.get('search') || '' }));
      setMovementPagination(current => ({ ...current, current: 1 }));
    } else {
      setSearch(searchParams.get('search') || '');
      setFilters(current => ({ ...current, ...exact }));
      setPagination(current => ({ ...current, current: 1 }));
    }
  }, [queryString]);

  useEffect(() => {
    if (applyingUrl.current) {
      applyingUrl.current = false;
      return;
    }
    const activeFilters = activeTab === 'movements' ? movementFilters : filters;
    const activeSearch = activeTab === 'movements' ? movementFilters.search : search;
    const next = new URLSearchParams();
    next.set('tab', activeTab);
    if (activeSearch) next.set('search', activeSearch);
    for (const key of ['product', 'warehouse', 'shade', 'batch']) {
      if (activeFilters[key] !== undefined && activeFilters[key] !== null) next.set(key, activeFilters[key]);
    }
    const nextQuery = next.toString();
    if (nextQuery !== queryString) {
      writtenQuery.current = nextQuery;
      setSearchParams(next, { replace: true });
    }
  }, [activeTab, filters.product, filters.warehouse, filters.shade, filters.batch, movementFilters.product, movementFilters.warehouse, movementFilters.shade, movementFilters.batch, movementFilters.search, queryString, search, setSearchParams]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedMovementSearch(movementFilters.search.trim()), 350);
    return () => clearTimeout(timer);
  }, [movementFilters.search]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSourceNumber(movementFilters.sourceNumber.trim()), 350);
    return () => clearTimeout(timer);
  }, [movementFilters.sourceNumber]);

  const updateFilters = patch => {
    setFilters(current => ({ ...current, ...patch }));
    setPagination(current => ({ ...current, current: 1 }));
  };
  const updateMovementFilters = patch => {
    setMovementFilters(current => ({ ...current, ...patch }));
    setMovementPagination(current => ({ ...current, current: 1 }));
  };

  const loadList = useCallback(async () => {
    const requestId = ++listSequence.current;
    setListLoading(true);
    setListError('');
    const [updatedFrom, updatedTo] = filters.dates || [];
    const params = cleanParams({
      page: pagination.current, limit: pagination.pageSize, search: debouncedSearch || undefined,
      product: filters.product, warehouse: filters.warehouse,
      status: filters.status?.length ? filters.status.join(',') : undefined,
      brand: filters.brand, category: filters.category, shade: filters.shade, batch: filters.batch,
      quantityField: filters.quantityField, minQty: filters.minQty, maxQty: filters.maxQty,
      minValue: filters.minValue, maxValue: filters.maxValue,
      updatedFrom: updatedFrom?.startOf('day').toISOString(), updatedTo: updatedTo?.endOf('day').toISOString(),
      sortBy: filters.sortBy, sortOrder: filters.sortOrder,
    });
    try {
      const response = await purchaseService.getStockDashboard(params);
      if (requestId !== listSequence.current) return;
      if (response.success) {
        const rows = response.data || [];
        setStock(rows);
        setPagination(current => ({
          ...current,
          current: response.pagination?.currentPage ?? current.current,
          pageSize: response.pagination?.itemsPerPage ?? current.pageSize,
          total: response.pagination?.totalItems ?? rows.length,
        }));
      }
    } catch (error) {
      if (requestId === listSequence.current) setListError(error.message || 'Unable to load inventory balances.');
    } finally {
      if (requestId === listSequence.current) setListLoading(false);
    }
  }, [debouncedSearch, filters, pagination.current, pagination.pageSize]);

  const loadSummary = useCallback(async () => {
    const requestId = ++summarySequence.current;
    setSummaryLoading(true);
    try {
      const response = await purchaseService.getStockSummary();
      if (requestId === summarySequence.current && response.success) setSummary(response.data || {});
    } catch (error) {
      if (requestId === summarySequence.current) message.error(error.message || 'Unable to load branch stock summary');
    } finally {
      if (requestId === summarySequence.current) setSummaryLoading(false);
    }
  }, []);

  const loadOptions = useCallback(async () => {
    const requestId = ++optionSequence.current;
    try {
      const [stockOptions, brandResponse] = await Promise.all([
        purchaseService.getStockFilterOptions(),
        categoryService.getBrands({ limit: 200 }),
      ]);
      if (requestId !== optionSequence.current) return;
      if (stockOptions.success) setFilterOptions(stockOptions.data || {});
      if (brandResponse.success) setBrands(brandResponse.data || []);
    } catch (error) {
      if (requestId === optionSequence.current) message.error(error.message || 'Unable to load stock filter options');
    }
  }, []);

  useEffect(() => {
    if (!filters.brand) { setCategories([]); return undefined; }
    let active = true;
    categoryService.getCategories(filters.brand, { limit: 200 })
      .then(response => { if (active && response.success) setCategories(response.data || []); })
      .catch(() => { if (active) setCategories([]); });
    return () => { active = false; };
  }, [filters.brand]);

  const movementFilterParams = useMemo(() => {
    const [dateFrom, dateTo] = movementFilters.dates || [];
    return cleanParams({
      movementType: movementFilters.movementType?.length ? movementFilters.movementType.join(',') : undefined,
      sourceType: movementFilters.sourceType?.length ? movementFilters.sourceType.join(',') : undefined,
      warehouse: movementFilters.warehouse, product: movementFilters.product,
      shade: movementFilters.shade, batch: movementFilters.batch,
      direction: movementFilters.direction, deltaField: movementFilters.deltaField,
      minDelta: movementFilters.minDelta, maxDelta: movementFilters.maxDelta,
      actor: movementFilters.actor, search: debouncedMovementSearch || undefined,
      sourceNumber: debouncedSourceNumber || undefined,
      dateFrom: dateFrom?.startOf('day').toISOString(), dateTo: dateTo?.endOf('day').toISOString(),
    });
  }, [debouncedMovementSearch, debouncedSourceNumber, movementFilters]);

  const loadMovements = useCallback(async () => {
    const requestId = ++movementSequence.current;
    setMovementLoading(true);
    setMovementError('');
    const params = cleanParams({
      ...movementFilterParams,
      page: movementPagination.current, limit: movementPagination.pageSize,
      sortBy: movementFilters.sortBy, sortOrder: movementFilters.sortOrder,
    });
    try {
      const response = await purchaseService.getStockMovements(params);
      if (requestId !== movementSequence.current) return;
      if (response.success) {
        const rows = response.data || [];
        setMovements(rows);
        setMovementPagination(current => ({
          ...current,
          current: response.pagination?.currentPage ?? current.current,
          pageSize: response.pagination?.itemsPerPage ?? current.pageSize,
          total: response.pagination?.totalItems ?? rows.length,
        }));
      }
    } catch (error) {
      if (requestId === movementSequence.current) setMovementError(error.message || 'Unable to load movement history.');
    } finally {
      if (requestId === movementSequence.current) setMovementLoading(false);
    }
  }, [movementFilterParams, movementFilters.sortBy, movementFilters.sortOrder, movementPagination.current, movementPagination.pageSize]);

  const loadMovementSummary = useCallback(async () => {
    const requestId = ++movementSummarySequence.current;
    setMovementSummaryLoading(true);
    try {
      const response = await purchaseService.getStockMovementSummary({ ...movementFilterParams, bucket: 'day' });
      if (requestId === movementSummarySequence.current && response.success) setMovementSummary(response.data || {});
    } catch (error) {
      if (requestId === movementSummarySequence.current) message.error(error.message || 'Unable to load movement summary');
    } finally {
      if (requestId === movementSummarySequence.current) setMovementSummaryLoading(false);
    }
  }, [movementFilterParams]);

  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => { loadSummary(); loadOptions(); }, [loadOptions, loadSummary]);
  useEffect(() => { if (activeTab === 'movements') loadMovements(); }, [activeTab, loadMovements]);
  useEffect(() => { if (activeTab === 'movements') loadMovementSummary(); }, [activeTab, loadMovementSummary]);
  useEffect(() => {
    let timer; let cancelled = false;
    const run = async () => {
      if (cancelled || document.visibilityState !== 'visible' || pollInFlight.current) return;
      pollInFlight.current = true;
      try {
        if (activeTab === 'balances') await Promise.all([loadList(), loadSummary()]);
        else await Promise.all([loadMovements(), loadMovementSummary(), loadSummary()]);
      } finally {
        pollInFlight.current = false;
        if (!cancelled) timer = setTimeout(run, 30000);
      }
    };
    const schedule = () => { clearTimeout(timer); if (!cancelled && document.visibilityState === 'visible') timer = setTimeout(run, 30000); };
    const foreground = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); void run(); } };
    window.addEventListener('focus', foreground);
    document.addEventListener('visibilitychange', foreground);
    schedule();
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); };
  }, [activeTab, loadList, loadMovementSummary, loadMovements, loadSummary]);

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilters({ ...DEFAULT_FILTERS });
    setMovementFilters({ ...DEFAULT_MOVEMENT_FILTERS });
    setDebouncedMovementSearch('');
    setDebouncedSourceNumber('');
    setPagination(current => ({ ...current, current: 1 }));
    setMovementPagination(current => ({ ...current, current: 1 }));
    writtenQuery.current = `tab=${activeTab}`;
    setSearchParams({ tab: activeTab }, { replace: true });
  };

  const refresh = async () => {
    if (activeTab === 'balances') await Promise.all([loadList(), loadSummary(), loadOptions()]);
    else await Promise.all([loadMovements(), loadMovementSummary(), loadSummary(), loadOptions()]);
  };

  const balanceColumns = [
    {
      title: 'Product', key: 'product', width: 280, fixed: 'left', render: (_, row) => {
        const product = row.product || {};
        return <div className="flex items-start gap-2"><ProductImage src={product.images?.[0] || row.productImage} size="sm" /><div className="min-w-0"><div className="font-medium text-sm">{product.itemName || row.productName || '—'}</div><div className="font-mono text-xs text-blue-700">{product.productCode || row.productCode || 'No code'}</div><div className="text-xs text-gray-500">{[product.brand?.name, product.category?.name].filter(Boolean).join(' · ') || 'No hierarchy'}</div><div className="text-xs text-gray-400">{[product.tileSize, product.thickness, product.finish, product.colour, product.grade].filter(Boolean).join(' · ') || 'No specification'}</div></div></div>;
      },
    },
    { title: 'Warehouse', key: 'warehouse', width: 175, render: (_, row) => <div className="text-xs"><div className="font-medium">{row.warehouse?.name || row.warehouseName || '—'}</div><div className="text-gray-400">{row.warehouse?.warehouseCode || 'No code'} · {titleCase(row.warehouse?.type)}</div></div> },
    { title: 'Shade / Batch', key: 'key', width: 145, render: (_, row) => <div className="text-xs"><div>Shade: {row.shade || '—'}</div><div>Batch: {row.batch || '—'}</div></div> },
    {
      title: 'UOM / Coverage', key: 'uom', width: 190, render: (_, row) => {
        const product = row.product || {};
        const baseUnit = row.baseUnit || product.inventoryBaseUom || row.unit || 'Unit';
        const commercialUnit = product.unit || 'Unit';
        const conversion = (product.uomConversions || []).find(item => item.uom === commercialUnit);
        const commercialQuantity = Number(conversion?.toBaseFactor || 0) > 0 ? Number(row.totalQty || 0) / Number(conversion.toBaseFactor) : null;
        return <div className="text-xs"><div className="font-medium">Base: {baseUnit}</div><div>Total: {numberText(row.totalQty)} {baseUnit}</div>{commercialQuantity !== null && commercialUnit !== baseUnit && <div className="text-gray-500">Commercial: {numberText(commercialQuantity)} {commercialUnit} (configured ×{numberText(conversion.toBaseFactor)})</div>}</div>;
      },
    },
    { title: 'Location', key: 'location', width: 145, render: (_, row) => <div className="text-xs"><div>Zone: {row.zone || '—'}</div><div>Rack: {row.rack || '—'}</div><div>Bin: {row.bin || '—'}</div></div> },
    ...BUCKETS.map(bucket => ({
      title: <Tooltip title={BUCKET_HELP[bucket]}><span className="cursor-help">{BUCKET_LABELS[bucket]}</span></Tooltip>,
      dataIndex: bucket, width: 120, align: 'right', render: (value, row) => <span className="font-medium">{numberText(value)} <span className="text-[10px] text-gray-400">{row.baseUnit || row.product?.inventoryBaseUom || 'Unit'}</span></span>,
    })),
    { title: 'Valuation', key: 'value', width: 170, render: (_, row) => <div className="text-xs"><div>Rate: {money(row.valuationRate)}</div><div className="font-semibold">Value: {money(row.stockValue)}</div><div className="text-gray-400">{Number(row.landingCost || 0) > 0 ? 'Landing cost' : 'Purchase rate'}</div></div> },
    { title: 'Availability', key: 'availability', width: 170, render: (_, row) => <Space size={[0, 4]} wrap>{availabilityTag(row)}{row.reservedQty > 0 && <Tag color="blue">Reserved</Tag>}{row.blockedQty > 0 && <Tag color="gold">Blocked</Tag>}{row.damagedQty > 0 && <Tag color="red">Damaged</Tag>}{row.transitQty > 0 && <Tag color="cyan">In transit</Tag>}{row.shortQty > 0 && <Tag color="volcano">Short</Tag>}</Space> },
    { title: 'Activity', key: 'activity', width: 185, render: (_, row) => <div className="text-xs"><div>GRN: {dateText(row.lastGRNDate)}</div><div>Sale: {dateText(row.lastSaleDate)}</div><div className="text-gray-400">Updated: {dateTime(row.updatedAt)}</div></div> },
    { title: 'Action', key: 'action', width: 110, fixed: 'right', render: (_, row) => <Button size="small" icon={<EyeOutlined />} onClick={() => setSelectedStockId(row._id)}>Details</Button> },
  ];

  const movementColumns = [
    { title: 'Occurred', dataIndex: 'occurredAt', width: 165, render: dateTime },
    { title: 'Movement / Phase', width: 195, render: (_, movement) => { const classification = movementClass(movement); return <div><Tag color={classification.color}>{classification.label}</Tag><div className="text-xs font-medium mt-1">{titleCase(movement.movementType)}</div><div className="text-xs text-gray-400">{titleCase(movement.phase)}</div></div>; } },
    { title: 'Product / Exact bucket', width: 265, render: (_, movement) => <div className="text-xs"><div className="font-medium">{movement.product?.itemName || '—'}</div><div className="font-mono text-blue-700">{movement.product?.productCode || 'No code'}</div><div>{movement.warehouse?.name || '—'} · Shade {movement.shade || '—'} · Batch {movement.batch || '—'}</div></div> },
    { title: 'Source', width: 190, render: (_, movement) => <div className="text-xs"><Typography.Text copyable={movement.sourceNumber ? { text: movement.sourceNumber } : false}>{movement.sourceNumber || movement.sourceId || '—'}</Typography.Text><div>{titleCase(movement.sourceType)}</div></div> },
    { title: 'Actor / Reason', width: 220, render: (_, movement) => <div className="text-xs"><div>{movement.actor?.name || movement.actor?.email || 'System'}</div><div className="text-gray-500">{movement.reason || movement.remarks || 'No reason recorded'}</div></div> },
    { title: 'Entered quantity', width: 145, render: (_, movement) => <div className="text-xs"><strong>{numberText(movement.enteredQuantity)}</strong> {movement.enteredUnit || movement.unit || 'Unit'}<div className="text-gray-400">Base: {movement.baseUnit || '—'}</div></div> },
    { title: 'Related warehouse', width: 160, render: (_, movement) => <div className="text-xs">{movement.relatedWarehouse?.name || '—'}<div className="text-gray-400">{movement.relatedWarehouse?.warehouseCode || ''}</div></div> },
    { title: 'Signed delta vector', render: (_, movement) => <DeltaVector deltas={movement.deltas} /> },
  ];

  const primaryFilters = (
    <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <Input aria-label="Search stock" placeholder="Search product, warehouse, shade or batch" prefix={<SearchOutlined />} allowClear value={search} onChange={event => { setSearch(event.target.value); setPagination(current => ({ ...current, current: 1 })); }} className="xl:col-span-2" />
        <Select aria-label="Warehouse" placeholder="Warehouse" allowClear showSearch optionFilterProp="label" value={filters.warehouse} onChange={value => updateFilters({ warehouse: value })} options={(filterOptions.warehouses || []).map(item => ({ value: item._id, label: `${item.name}${item.warehouseCode ? ` (${item.warehouseCode})` : ''}` }))} />
        <Select aria-label="Availability status" mode="multiple" maxTagCount="responsive" placeholder="Availability / bucket status" allowClear value={filters.status} onChange={value => updateFilters({ status: value })} options={(filterOptions.statuses || []).map(value => ({ value, label: titleCase(value) }))} />
        <Select aria-label="Shade" placeholder="Shade" allowClear showSearch value={filters.shade} onChange={value => updateFilters({ shade: value })} options={(filterOptions.shades || []).map(value => ({ value, label: value }))} />
        <Select aria-label="Batch" placeholder="Batch" allowClear showSearch value={filters.batch} onChange={value => updateFilters({ batch: value })} options={(filterOptions.batches || []).map(value => ({ value, label: value }))} />
      </div>
      {filters.product && <Alert className="mt-2" type="info" showIcon message="Exact product filter active" description={<span>Product ID: <Typography.Text copyable>{filters.product}</Typography.Text></span>} />}
    </div>
  );

  const advancedFilters = (
    <Collapse className="mb-3" items={[{
      key: 'advanced', label: 'Advanced inventory filters', children: (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select aria-label="Brand" placeholder="Brand" allowClear showSearch optionFilterProp="label" value={filters.brand} onChange={value => updateFilters({ brand: value, category: undefined })} options={brands.map(item => ({ value: item._id, label: item.name }))} />
          <Select aria-label="Category" placeholder={filters.brand ? 'Category' : 'Select a brand first'} disabled={!filters.brand} allowClear showSearch optionFilterProp="label" value={filters.category} onChange={value => updateFilters({ category: value })} options={categories.map(item => ({ value: item._id, label: item.name }))} />
          <Select aria-label="Quantity field" value={filters.quantityField} onChange={value => updateFilters({ quantityField: value })} options={QUANTITY_FIELDS} />
          <Space.Compact block><InputNumber stringMode aria-label="Minimum quantity" className="w-1/2" placeholder="Min qty" value={filters.minQty} onChange={value => updateFilters({ minQty: value })} /><InputNumber stringMode aria-label="Maximum quantity" className="w-1/2" placeholder="Max qty" value={filters.maxQty} onChange={value => updateFilters({ maxQty: value })} /></Space.Compact>
          <Space.Compact block><InputNumber stringMode aria-label="Minimum value" className="w-1/2" placeholder="Min value" value={filters.minValue} onChange={value => updateFilters({ minValue: value })} /><InputNumber stringMode aria-label="Maximum value" className="w-1/2" placeholder="Max value" value={filters.maxValue} onChange={value => updateFilters({ maxValue: value })} /></Space.Compact>
          <RangePicker aria-label="Updated date range" className="w-full" value={filters.dates} onChange={value => updateFilters({ dates: value })} />
          <Select aria-label="Sort inventory by" value={filters.sortBy} onChange={value => updateFilters({ sortBy: value })} options={SORT_FIELDS} />
          <Select aria-label="Inventory sort order" value={filters.sortOrder} onChange={value => updateFilters({ sortOrder: value })} options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]} />
        </div>
      ),
    }]} />
  );

  const movementFilterPanel = (
    <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-2">
        <Select aria-label="Movement type" mode="multiple" maxTagCount="responsive" placeholder="Movement type" allowClear value={movementFilters.movementType} onChange={value => updateMovementFilters({ movementType: value })} options={(filterOptions.movementTypes || []).map(value => ({ value, label: titleCase(value) }))} />
        <Select aria-label="Source type" mode="multiple" maxTagCount="responsive" placeholder="Source type" allowClear value={movementFilters.sourceType} onChange={value => updateMovementFilters({ sourceType: value })} options={(filterOptions.sourceTypes || []).map(value => ({ value, label: titleCase(value) }))} />
        <Select aria-label="Movement warehouse" placeholder="Warehouse" allowClear showSearch optionFilterProp="label" value={movementFilters.warehouse} onChange={value => updateMovementFilters({ warehouse: value })} options={(filterOptions.warehouses || []).map(item => ({ value: item._id, label: item.name }))} />
        <Input aria-label="Search movements" placeholder="Search product code/name/alias, source, shade or batch" prefix={<SearchOutlined />} allowClear value={movementFilters.search} onChange={event => updateMovementFilters({ search: event.target.value })} className="xl:col-span-2" />
        <Select aria-label="Movement shade" placeholder="Shade" allowClear showSearch value={movementFilters.shade} onChange={value => updateMovementFilters({ shade: value })} options={(filterOptions.shades || []).map(value => ({ value, label: value }))} />
        <Select aria-label="Movement batch" placeholder="Batch" allowClear showSearch value={movementFilters.batch} onChange={value => updateMovementFilters({ batch: value })} options={(filterOptions.batches || []).map(value => ({ value, label: value }))} />
        <Select aria-label="Movement direction" placeholder="Direction" allowClear value={movementFilters.direction} onChange={value => updateMovementFilters({ direction: value })} options={['inbound', 'outbound', 'all'].map(value => ({ value, label: titleCase(value) }))} />
        <Select aria-label="Delta bucket" value={movementFilters.deltaField} onChange={value => updateMovementFilters({ deltaField: value })} options={QUANTITY_FIELDS} />
        <Space.Compact block><InputNumber stringMode aria-label="Minimum delta" className="w-1/2" placeholder="Min delta" value={movementFilters.minDelta} onChange={value => updateMovementFilters({ minDelta: value })} /><InputNumber stringMode aria-label="Maximum delta" className="w-1/2" placeholder="Max delta" value={movementFilters.maxDelta} onChange={value => updateMovementFilters({ maxDelta: value })} /></Space.Compact>
        <Input aria-label="Movement actor ID" placeholder="Actor ID" allowClear value={movementFilters.actor} onChange={event => updateMovementFilters({ actor: event.target.value || undefined })} />
        <Input aria-label="Source number" placeholder="Source number" allowClear value={movementFilters.sourceNumber} onChange={event => updateMovementFilters({ sourceNumber: event.target.value })} />
        <RangePicker aria-label="Movement date range" className="w-full" value={movementFilters.dates} onChange={value => updateMovementFilters({ dates: value })} />
        <Select aria-label="Sort movements by" value={movementFilters.sortBy} onChange={value => updateMovementFilters({ sortBy: value })} options={MOVEMENT_SORT_FIELDS} />
        <Select aria-label="Movement sort order" value={movementFilters.sortOrder} onChange={value => updateMovementFilters({ sortOrder: value })} options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]} />
      </div>
      {movementFilters.product && <Alert className="mt-2" type="info" showIcon message="Exact product deep-link filter active" description={<span>Product ID: <Typography.Text copyable>{movementFilters.product}</Typography.Text></span>} />}
    </div>
  );

  const movementSummaryCards = [
    ['Inbound physical', movementSummary.inboundPhysical], ['Outbound physical', movementSummary.outboundPhysical],
    ['Net physical', movementSummary.netPhysical], ['Reservations', movementSummary.reservations],
    ['Releases', movementSummary.releases], ['Damage added', movementSummary.damageAdded],
    ['Damage removed', movementSummary.damageRemoved], ['Transit', movementSummary.transit],
    ['Returns', movementSummary.returns], ['Adjustments', movementSummary.adjustments],
    ['Physical counts', movementSummary.counts], ['Movements', movementSummary.movements],
  ];

  const balancesView = (
    <>
      {primaryFilters}
      {advancedFilters}
      {listError && <Alert className="mb-3" type="error" showIcon message="Inventory balances could not be loaded" description={listError} action={<Button size="small" onClick={loadList}>Try again</Button>} />}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={balanceColumns} dataSource={stock} rowKey="_id" loading={listLoading} size="small"
          scroll={{ x: 2650 }} locale={{ emptyText: <Empty description="No inventory balances match the selected filters." /> }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100, 200], showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} balances` }}
          onChange={next => setPagination(current => ({ ...current, current: next.current || 1, pageSize: next.pageSize || current.pageSize }))}
        />
      </div>
    </>
  );

  const movementsView = (
    <>
      <Alert className="mb-3" type="info" showIcon message="History starts from the migration opening baseline" description="The baseline is an aggregate opening position. An explicit residual is not presented as fabricated event detail; buckets without a persisted baseline are shown as baseline_missing in Stock Details." />
      {movementFilterPanel}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
        {movementSummaryCards.map(([label, value]) => <Card size="small" key={label} loading={movementSummaryLoading}><Statistic title={<span className="text-xs">{label}</span>} value={numberText(value)} valueStyle={{ fontSize: 16 }} /></Card>)}
      </div>
      <Row gutter={[12, 12]} className="mb-3">
        <Col xs={24} lg={12}><Card size="small" title="Source counts" loading={movementSummaryLoading}>{movementSummary.sourceCounts?.length ? <Space wrap>{movementSummary.sourceCounts.map(item => <Tag key={item._id || 'unknown'}>{titleCase(item._id || 'Unknown')}: {numberText(item.count)} · net {numberText(item.netPhysical)}</Tag>)}</Space> : <span className="text-sm text-gray-400">No source counts in this date range.</span>}</Card></Col>
        <Col xs={24} lg={12}><Card size="small" title="Daily trend" loading={movementSummaryLoading}><Table rowKey={item => String(item._id)} size="small" pagination={false} scroll={{ x: 440 }} dataSource={(movementSummary.trend || []).slice(-14)} columns={[{ title: 'Day', dataIndex: '_id', render: dateText }, { title: 'In', dataIndex: 'inbound', align: 'right', render: numberText }, { title: 'Out', dataIndex: 'outbound', align: 'right', render: numberText }, { title: 'Net', dataIndex: 'net', align: 'right', render: numberText }]} locale={{ emptyText: 'No trend data.' }} /></Card></Col>
      </Row>
      {movementError && <Alert className="mb-3" type="error" showIcon message="Movement history could not be loaded" description={movementError} action={<Button size="small" onClick={loadMovements}>Try again</Button>} />}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={movementColumns} dataSource={movements} rowKey="_id" loading={movementLoading} size="small"
          scroll={{ x: 1600 }} locale={{ emptyText: <Empty description="No movements match the selected filters." /> }}
          pagination={{ ...movementPagination, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100, 200], showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} movements` }}
          onChange={next => setMovementPagination(current => ({ ...current, current: next.current || 1, pageSize: next.pageSize || current.pageSize }))}
        />
      </div>
    </>
  );

  return (
    <div>
      <div className="flex flex-col xl:flex-row xl:justify-between xl:items-center gap-3 mb-4">
        <div><h1 className="text-2xl font-bold text-gray-800">Stock Dashboard</h1><p className="text-sm text-gray-500 mt-0.5">Branch-wide balances, valuation and append-only movement history</p></div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} loading={listLoading || summaryLoading || movementLoading} onClick={refresh}>Refresh</Button>
          <Button icon={<ClearOutlined />} onClick={clearFilters}>Clear Filters</Button>
          <ModuleRecycleBin module="stock" title="Deleted Stock Records" onRestore={refresh} />
          {hasPermission('stock.adjustment') && <Button icon={<PlusCircleOutlined />} onClick={() => navigate('/inventory/stock-adjustment')}>Adjust Stock</Button>}
          {hasPermission('stock.transfer') && <Button type="primary" icon={<SwapOutlined />} onClick={() => navigate('/inventory/stock-transfers')}>New Transfer Request</Button>}
        </Space>
      </div>

      <SummaryCards summary={summary} />
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'balances', label: 'Inventory Balances', children: balancesView },
        { key: 'movements', label: 'Movement History', children: movementsView },
      ]} />

      <StockDetailDrawer open={Boolean(selectedStockId)} stockId={selectedStockId} onClose={() => setSelectedStockId(null)} filterOptions={filterOptions} />
    </div>
  );
};

export default StockPage;
