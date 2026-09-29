import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber, Divider, Tooltip, Alert,
  Collapse, DatePicker, Empty
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined,
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SwapOutlined, DeleteOutlined, PrinterOutlined, FileTextOutlined,
  SyncOutlined, WarningOutlined, StopOutlined, FilterOutlined, CalendarOutlined,
  HistoryOutlined, AuditOutlined, ShopOutlined, SafetyCertificateOutlined, UserOutlined,
  LockOutlined, UnlockOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';
import ProductSelectionModal from '../../components/ProductSelectionModal.jsx';
import AuthoritativeQuotationModal from './AuthoritativeQuotationModal.jsx';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import getImageUrl from '../../utils/imageUrl.js';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const STATUS_COLORS = {
  draft: 'default', pending_approval: 'orange', approved: 'cyan', sent: 'blue', accepted: 'green',
  converted: 'purple', expired: 'orange', cancelled: 'red',
  // Immutable parent record of a stock split.
  split: 'geekblue',
  // Shortfall child of a split: no stock yet, so not a firm offer.
  pending_stock: 'gold',
};
const HOLD_COLORS = {
  held: 'green', partial: 'gold', consumed: 'purple', released: 'default', expired: 'red', none: 'default',
};
const SPLIT_ROLE_LABELS = { parent: 'Original request', available: 'In stock', shortfall: 'Pending stock' };

const EMPTY_FILTERS = {
  search: '', status: undefined, dealer: '', dealerType: '', customer: '', customerType: undefined,
  approvalStatus: undefined, conversionState: undefined, converted: undefined, createdBy: '',
  dateFrom: '', dateTo: '', validityStatus: undefined, expiringWithinDays: 30, stockStatus: undefined,
  amountMin: undefined, amountMax: undefined, sortBy: 'createdAt', sortOrder: 'desc',
};
const STATUS_OPTIONS = Object.keys(STATUS_COLORS).map(value => ({ value, label: value.replace(/_/g, ' ') }));
const CUSTOMER_TYPE_OPTIONS = ['dealer', 'wholesaler', 'retail', 'distributor', 'builder'].map(value => ({ value, label: value.replace(/_/g, ' ') }));
const APPROVAL_OPTIONS = ['not_required', 'pending', 'approved', 'rejected'].map(value => ({ value, label: value.replace(/_/g, ' ') }));
const CONVERSION_OPTIONS = ['none', 'partial', 'full'].map(value => ({ value, label: value }));
const VALIDITY_OPTIONS = ['active', 'expired', 'expiring_soon', 'no_expiry'].map(value => ({ value, label: value.replace(/_/g, ' ') }));
const STOCK_OPTIONS = ['available', 'partial', 'out_of_stock', 'fully_converted'].map(value => ({ value, label: value.replace(/_/g, ' ') }));

const SORT_OPTIONS = [
  ['createdAt', 'Created'], ['updatedAt', 'Updated'], ['quotationDate', 'Quotation date'],
  ['validUntil', 'Valid until'], ['quotationNumber', 'Quotation number'], ['grandTotal', 'Grand total'],
].map(([value, label]) => ({ value, label }));
const validityPresets = () => [7, 15, 30, 45, 60, 90].map(days => ({
  label: `${days} days from today`, value: dayjs().add(days, 'day').startOf('day'),
}));
const finiteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};
const formatNumber = (value, options = {}) => finiteNumber(value).toLocaleString('en-IN', { maximumFractionDigits: 2, ...options });
const formatMoney = value => `₹${formatNumber(value)}`;
const formatDate = (value, includeTime = false) => {
  const date = dayjs(value);
  if (!value || !date.isValid()) return '—';
  return date.format(includeTime ? 'DD MMM YYYY, hh:mm A' : 'DD MMM YYYY');
};
const calendarDay = (value) => {
  if (!value) return null;
  const raw = String(value);
  const date = /^\d{4}-\d{2}-\d{2}/.test(raw) ? dayjs(raw.slice(0, 10)) : dayjs(value);
  return date.isValid() ? date.startOf('day') : null;
};
const formatCalendarDate = value => calendarDay(value)?.format('DD MMM YYYY') || '—';
const quotationIsExpired = quotation => quotation?.isExpired === true || quotation?.effectiveStatus === 'expired';
const stockReadinessFromResponse = response => response?.data?.stockReadiness || response?.data?.quotation?.stockReadiness || response?.data || null;
const liveQuotationFieldsFromResponse = response => {
  const envelope = response?.data || {};
  const quotation = envelope.quotation || {};
  return Object.fromEntries([
    'status', 'effectiveStatus', 'validUntil', 'isExpired', 'expiresInDays',
    'conversionState', 'conversionVersion', 'validity', 'conversion', 'updatedAt', 'stockQueuedAt',
  ].flatMap(key => {
    const value = quotation[key] ?? envelope[key];
    return value === undefined ? [] : [[key, value]];
  }));
};

const QueueModeBadge = ({ readiness }) => {
  if (!readiness) return null;
  const queued = readiness.queueMode === 'queued_fifo' || readiness.queued === true;
  const approvedSent = readiness.eligibilityReason === 'sent_preserving_approved_fifo';
  const label = queued ? (approvedSent ? 'Approved-sent FIFO' : 'FIFO queued') : 'Physical-only';
  const title = queued
    ? 'Competes for live stock in its preserved FIFO order.'
    : `Live physical availability only; this quotation does not consume FIFO stock (${readiness.eligibilityReason || 'not eligible'}).`;
  return <Tooltip title={title}><Tag color={queued ? 'blue' : 'default'}>{label}</Tag></Tooltip>;
};

// Stock snapshots on quotation items are historical only. Every current badge
// and conversion gate consumes the server-computed live FIFO readiness.
const computeQuotationStockStatus = (quotation) => {
  const readiness = quotation?.stockReadiness;
  if (!readiness) return { status: 'unknown', waiting: 0, ready: 0, total: quotation?.items?.length || 0 };
  const status = readiness.overallStatus === 'available'
    ? 'ready'
    : readiness.overallStatus === 'out_of_stock'
      ? 'waiting'
      : readiness.overallStatus || 'unknown';
  return {
    status,
    waiting: Number(readiness.partialItems || 0) + Number(readiness.outOfStockItems || 0),
    ready: Number(readiness.availableItems || 0),
    total: Number(readiness.totalItems || 0),
    allocatedQty: Number(readiness.totalAllocatedQty || 0),
    requiredQty: Number(readiness.totalRequiredQty || 0),
    queued: Boolean(readiness.queued),
  };
};

const QuotationStockBadge = ({ quotation }) => {
  const { status, allocatedQty, requiredQty, queued } = computeQuotationStockStatus(quotation);
  const title = queued
    ? 'FIFO allocation for conversion-eligible or approved-sent quotations'
    : `Current physical stock only (${quotation?.stockReadiness?.eligibilityReason || 'not FIFO eligible'})`;

  if (status === 'fully_converted') return (
    <Tooltip title="Every quotation quantity has been converted">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-purple-100 text-purple-800 border-purple-300">
        <span>✓</span><span>Fully Converted</span>
      </span>
    </Tooltip>
  );
  if (status === 'unknown') return (
    <Tooltip title="Current stock status could not be calculated">
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-gray-100 text-gray-500 border-gray-200">
        <span>⚪</span><span>Unknown</span>
      </span>
    </Tooltip>
  );
  if (status === 'ready') return (
    <Tooltip title={title}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-green-100 text-green-800 border-green-300">
        <span>🟢</span><span>Available</span>
      </span>
    </Tooltip>
  );
  if (status === 'partial') return (
    <Tooltip title={title}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-yellow-100 text-yellow-800 border-yellow-300">
        <span>🟡</span><span>Partial ({allocatedQty}/{requiredQty})</span>
      </span>
    </Tooltip>
  );
  return (
    <Tooltip title={title}>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium bg-red-100 text-red-800 border-red-300">
        <span>🔴</span><span>Out of Stock</span>
      </span>
    </Tooltip>
  );
};

/**
 * A hold is a real claim on stock: availableQty is moved into quotedQty, so the
 * quantity cannot be sold to anyone else and converting this quotation can no
 * longer fail on stock. Holds expire, so the countdown matters.
 */
const HoldBadge = ({ quotation }) => {
  const status = quotation?.holdStatus || 'none';
  if (status === 'none') return null;
  const expiresAt = quotation?.holdExpiresAt ? dayjs(quotation.holdExpiresAt) : null;
  const hoursLeft = expiresAt ? expiresAt.diff(dayjs(), 'hour', true) : null;
  const label = status === 'held'
    ? (hoursLeft !== null
      ? `Stock held · ${hoursLeft < 1 ? '<1h' : `${Math.floor(hoursLeft)}h`} left`
      : 'Stock held')
    : status === 'consumed' ? 'Hold used'
      : status === 'expired' ? 'Hold expired'
        : status === 'released' ? 'Hold released'
          : 'Partly held';
  const title = status === 'held'
    ? `This quotation holds real stock${expiresAt ? ` until ${expiresAt.format('DD MMM YYYY HH:mm')}` : ''}. Converting it cannot fail on stock.`
    : status === 'consumed' ? 'The hold became the Sales Order reservation.'
      : status === 'expired' ? 'The hold lapsed and the stock went back to available. The quotation is still queued.'
        : status === 'released' ? 'The hold was released; stock returned to available.'
          : 'Only part of this quotation is covered by a hold.';
  return (
    <Tooltip title={title}>
      <Tag color={HOLD_COLORS[status] || 'default'}>{label}</Tag>
    </Tooltip>
  );
};

/** The available / shortfall breakdown an approver confirms before a split. */
const SplitPlanTables = ({ plan }) => {
  if (!plan) return null;
  const columns = [
    { title: 'Product', key: 'product', render: (_, row) => (
      <div>
        <div className="text-sm font-medium">{row.productName || '—'}</div>
        <div className="text-xs text-gray-500">{row.productCode}</div>
      </div>
    ) },
    { title: 'Qty', dataIndex: 'quantity', key: 'quantity', align: 'right', width: 110,
      render: (value, row) => <span className="font-semibold">{formatNumber(value)} {row.unit}</span> },
  ];
  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 flex items-center gap-2">
          <Tag color="green">Available now</Tag>
          <span className="text-xs text-gray-500">
            Stock will be held for these quantities, so the Sales Order cannot fail.
          </span>
        </div>
        {plan.available?.length
          ? <Table size="small" rowKey="itemId" columns={columns} dataSource={plan.available} pagination={false} />
          : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing is available to hold" />}
      </div>
      {plan.willSplit && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <Tag color="gold">Pending stock</Tag>
            <span className="text-xs text-gray-500">
              Moves to a separate quotation, subject to availability. Not sent as a firm offer and no delivery date is promised.
            </span>
          </div>
          <Table size="small" rowKey="itemId" columns={columns} dataSource={plan.shortfall} pagination={false} />
        </div>
      )}
    </div>
  );
};

const QuotationManager = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedDealerOrderRequest = searchParams.get('dealerOrderRequest');
  const createFromRequest = searchParams.get('create') === '1' && Boolean(requestedDealerOrderRequest);
  // ?quotation=<id> opens that quotation's detail straight away, so converting a
  // dealer order request can hand the user directly to the result.
  const requestedQuotationId = searchParams.get('quotation');
  const { confirm, alertModal } = useConfirm();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [convertingId, setConvertingId] = useState(null);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [filterLookups, setFilterLookups] = useState({ dealers: [], dealerTypes: [], creators: [] });
  const [filterLookupsLoading, setFilterLookupsLoading] = useState(false);
  const [detailRefreshVersion, setDetailRefreshVersion] = useState(0);
  const quotationRequestSeq = useRef(0);
  const quotationRequestsInFlight = useRef(0);
  const statsRequestSeq = useRef(0);
  const listPollGeneration = useRef(0);
  const listPollInFlight = useRef(false);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  // Stock hold / split. `drifted` is set when the server answered
  // SPLIT_PLAN_CHANGED, so the modal asks for a fresh confirmation instead of
  // letting the approver commit numbers they never saw.
  const [splitState, setSplitState] = useState(null);
  const [splitBusy, setSplitBusy] = useState(false);

  useEffect(() => {
    if (createFromRequest) setShowCreate(true);
  }, [createFromRequest, requestedDealerOrderRequest]);

  // Deep link straight to one quotation's detail. Fetches by id rather than
  // waiting for the paginated list, so it works even when the quotation is not
  // on the first page.
  useEffect(() => {
    if (!requestedQuotationId) return;
    let cancelled = false;
    salesService.getQuotation(requestedQuotationId)
      .then((response) => {
        if (!cancelled && response?.success && response.data) setViewRecord(response.data);
      })
      .catch(() => {
        if (!cancelled) message.error('That quotation could not be opened.');
      });
    return () => { cancelled = true; };
  }, [requestedQuotationId]);

  const closeCreate = useCallback(() => {
    setShowCreate(false);
    if (requestedDealerOrderRequest) navigate('/sales-purchase/quotation-manager', { replace: true });
  }, [navigate, requestedDealerOrderRequest]);

  const loadStats = useCallback(async () => {
    const requestSeq = ++statsRequestSeq.current;
    try {
      const response = await salesService.getQuotationStats();
      if (requestSeq === statsRequestSeq.current && response.success) setStats(response.data || {});
    } catch {
      // Background stats refresh is best-effort; the list remains usable.
    }
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    let active = true;
    setFilterLookupsLoading(true);
    Promise.allSettled([
      masterService.getDealers({ page: 1, limit: 200, status: 'active' }),
      masterService.getDealerTypes({ page: 1, limit: 200 }),
      masterService.getSalesExecutives(),
    ]).then((results) => {
      if (!active) return;
      const rows = index => results[index].status === 'fulfilled' && results[index].value?.success
        ? results[index].value.data || []
        : [];
      setFilterLookups({ dealers: rows(0), dealerTypes: rows(1), creators: rows(2) });
    }).finally(() => { if (active) setFilterLookupsLoading(false); });
    return () => { active = false; };
  }, []);

  const updateFilter = useCallback((key, value) => {
    setFilters(current => ({ ...current, [key]: value }));
    setPagination(current => ({ ...current, current: 1 }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(EMPTY_FILTERS);
    setPagination(current => ({ ...current, current: 1 }));
  }, []);

  const fetchQuotations = useCallback(async ({ silent = false } = {}) => {
    const requestSeq = ++quotationRequestSeq.current;
    quotationRequestsInFlight.current += 1;
    if (!silent) setLoading(true);
    try {
      const activeFilters = Object.fromEntries(Object.entries(filters).filter(([, value]) => (
        value !== undefined && value !== null && value !== ''
      )));
      const res = await salesService.getQuotations({
        page: pagination.current,
        limit: pagination.pageSize,
        ...activeFilters,
      });
      if (requestSeq !== quotationRequestSeq.current) return;
      if (res.success) {
        setQuotations(res.data || []);
        setPagination(p => ({ ...p, total: finiteNumber(res.pagination?.totalItems) }));
      }
    } catch (err) {
      if (!silent && requestSeq === quotationRequestSeq.current) message.error(err.message);
    } finally {
      quotationRequestsInFlight.current = Math.max(0, quotationRequestsInFlight.current - 1);
      if (requestSeq === quotationRequestSeq.current) setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);
  useEffect(() => () => {
    quotationRequestSeq.current += 1;
    statsRequestSeq.current += 1;
    listPollGeneration.current += 1;
  }, []);
  useEffect(() => {
    const generation = ++listPollGeneration.current;
    let timer;
    const schedule = () => {
      if (generation !== listPollGeneration.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 30000);
    };
    const run = async () => {
      if (generation !== listPollGeneration.current) return;
      if (document.visibilityState !== 'visible' || listPollInFlight.current || quotationRequestsInFlight.current > 0) {
        schedule();
        return;
      }
      listPollInFlight.current = true;
      try {
        await Promise.all([fetchQuotations({ silent: true }), loadStats()]);
      } finally {
        listPollInFlight.current = false;
        schedule();
      }
    };
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      void run();
    };
    schedule();
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      listPollGeneration.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [fetchQuotations, loadStats]);

  const handleStatusChange = async (id, status) => {
    try {
      const res = await salesService.updateQuotationStatus(id, { status });
      if (res.success) { message.success(res.message || `Status updated to ${status}`); fetchQuotations(); loadStats(); }
      else { alertModal('Failed', res.message, 'error'); }
    } catch (err) { alertModal('Error', err.message, 'error'); }
  };

  // ── Stock hold and split ────────────────────────────────────────────────────

  /** Fetch the plan and open the confirmation modal. */
  const openSplitPlan = async (record, intent = 'split') => {
    setSplitBusy(true);
    try {
      // split-preview serves both intents: for a pending-stock child it evaluates
      // readiness as if approved, so a planHash exists to confirm against.
      const res = await salesService.getQuotationSplitPreview(record._id);
      const plan = res?.data;
      if (!plan) { alertModal('Unavailable', 'A stock plan could not be prepared for this quotation.', 'warning'); return; }
      if (!plan.canHold) {
        alertModal('No Stock To Hold', 'None of this quotation can be covered by stock right now.', 'warning');
        return;
      }
      setSplitState({ record, plan, intent, drifted: false });
    } catch (err) {
      // The interceptor already surfaced the reason.
      if (err?.code === 'QUOTATION_ALREADY_HELD') fetchQuotations();
    } finally { setSplitBusy(false); }
  };

  /**
   * Commit the plan. If stock moved since the preview the server answers 409
   * SPLIT_PLAN_CHANGED with a fresh plan, which we show for re-confirmation
   * rather than committing quantities the approver never saw.
   */
  const commitSplit = async () => {
    if (!splitState) return;
    const { record, plan, intent } = splitState;
    setSplitBusy(true);
    try {
      const res = intent === 'confirm'
        ? await salesService.confirmQuotationStock(record._id, plan.planHash)
        : await salesService.approveQuotationSplit(record._id, plan.planHash);
      setSplitState(null);
      fetchQuotations();
      loadStats();
      setDetailRefreshVersion(version => version + 1);
      if (intent === 'confirm') {
        alertModal('Stock Confirmed', res.message || 'Stock is now held and the quotation can be sent.', 'success');
        return;
      }
      const { available, shortfall } = res.data || {};
      alertModal(
        res.split ? 'Quotation Split' : 'Stock Held',
        res.split
          ? `${available?.quotationNumber} holds the available stock and can be converted now. `
            + `${shortfall?.quotationNumber} carries the shortfall and stays pending until stock arrives — `
            + 'it is not a firm offer and promises no delivery date.'
          : `${available?.quotationNumber} now holds stock, so converting it cannot fail. No split was needed.`,
        'success',
      );
    } catch (err) {
      // The interceptor maps response.data.details onto err.details, but this
      // endpoint returns the fresh plan as response.data.data — read both.
      const freshPlan = err?.details || err?.response?.data?.data;
      if (err?.code === 'SPLIT_PLAN_CHANGED' && freshPlan?.planHash) {
        // Re-present the recalculated plan for an explicit second confirmation.
        setSplitState({ record, plan: freshPlan, intent, drifted: true });
        return;
      }
      if (err?.code === 'INSUFFICIENT_STOCK') {
        setSplitState(null);
        fetchQuotations();
      }
    } finally { setSplitBusy(false); }
  };

  const handleReleaseHold = async (record) => {
    const ok = await confirm({
      title: 'Release stock hold?',
      content: `${record.quotationNumber} will stop guaranteeing its quantities and the stock returns to available. `
        + 'The quotation keeps its place in the queue.',
      okText: 'Release hold',
      okButtonProps: { danger: true },
    });
    if (!ok) return;
    try {
      const res = await salesService.releaseQuotationHold(record._id, 'Released from Quotation Manager');
      if (res.success) {
        message.success(res.message || 'Stock hold released.');
        fetchQuotations();
        setDetailRefreshVersion(version => version + 1);
      }
    } catch { /* reported by the interceptor */ }
  };

  const handleConvert = async (record, mode = 'full') => {
    if (!['approved', 'accepted'].includes(record.status) || record.conversionState === 'full') {
      alertModal('Conversion Not Available', 'Only approved or accepted quotations with remaining quantity can be converted.', 'warning');
      return;
    }
    if (quotationIsExpired(record)) {
      alertModal('Quotation Expired', 'Expired quotations cannot be converted. Create or approve a valid quotation first.', 'warning');
      return;
    }
    const readiness = record.stockReadiness;
    if (!readiness || (mode === 'full' ? !readiness.allStockAvailable : !readiness.anyStockAvailable)) {
      alertModal(
        'Stock Not Available',
        mode === 'full'
          ? 'All remaining quantities must be FIFO-allocated before using Convert Full. Use Convert Available Stock for quantities allocated now.'
          : 'No FIFO-allocated stock is currently available for this quotation.',
        'warning'
      );
      return;
    }
    const partialLines = (readiness.items || []).filter(item => item.status === 'partial' && Number(item.allocatedQty) > 0);
    let includePartialLines = false;
    if (mode === 'available' && partialLines.length) {
      includePartialLines = await confirm('Convert partial line quantities?', {
        content: `${partialLines.map(item => `${item.productName || item.productCode}: ${item.allocatedQty} of ${item.remainingQty}`).join('\n')}\n\nOnly currently allocated stock will become a Sales Order. Later GRN stock may have a different shade or batch.`,
        okText: 'Convert Partial Quantities',
        type: 'warning',
      });
      if (!includePartialLines) return;
    }
    const proceed = await confirm(
      mode === 'full' ? `Convert all remaining stock for ${record.quotationNumber}?` : `Convert available stock for ${record.quotationNumber}?`,
      {
        content: mode === 'full'
          ? 'Every remaining line will be converted and reserved in one Sales Order.'
          : `A Sales Order will be created only for the currently allocated ${readiness.totalAllocatedQty} units. Remaining demand stays in this quotation.`,
        okText: mode === 'full' ? 'Convert Full' : 'Convert Available Stock',
        type: 'info',
      }
    );
    if (!proceed) return;
    setConvertingId(record._id);
    try {
      const res = await salesService.convertQuotation(record._id, { mode, includePartialLines });
      if (res.success) {
        const orderNumber = res.data.salesOrder.orderNumber;
        message.success(res.idempotent ? `Sales Order ${orderNumber} was already created.` : `Sales Order ${orderNumber} created and stock reserved.`);
        setViewRecord(null);
        fetchQuotations(); loadStats();
        const viewOrders = await confirm(`Open Sales Order ${orderNumber}?`, {
          content: res.data.quotation.conversionState === 'partial'
            ? 'Remaining quotation quantities are still queued in Quotation Manager.'
            : 'The quotation is now fully converted.',
          okText: 'View Sales Orders',
          cancelText: 'Stay Here',
          type: 'info',
        });
        if (viewOrders) navigate('/sales-purchase/sales-order-dashboard');
      }
    } catch (err) {
      const code = err.response?.data?.code || err.code;
      const returnedReadiness = err.response?.data?.data?.stockReadiness || err.response?.data?.data;
      if (returnedReadiness?.overallStatus) {
        setQuotations(current => current.map(quotation => quotation._id === record._id
          ? { ...quotation, stockReadiness: returnedReadiness }
          : quotation));
      }
      if (err.status === 409 || err.response?.status === 409 || [
        'INSUFFICIENT_STOCK', 'PARTIAL_LINE_CONFIRMATION_REQUIRED',
        'QUOTATION_FULLY_CONVERTED', 'QUOTATION_NOT_ELIGIBLE',
      ].includes(code)) {
        await Promise.all([fetchQuotations({ silent: true }), loadStats()]);
        setDetailRefreshVersion(version => version + 1);
      }
      alertModal('Convert Failed', err.message, 'error');
    } finally { setConvertingId(null); }
  };

  const handleDelete = async (id) => {
    const proceed = await confirm('Delete this quotation?', { type: 'danger', okText: 'Delete', content: 'This will move the quotation to Recycle Bin.' });
    if (!proceed) return;
    try {
      const res = await salesService.deleteQuotation(id);
      if (res.success) { message.success(res.message || 'Deleted.'); fetchQuotations(); loadStats(); }
      else { alertModal('Delete Failed', res.message, 'error'); }
    } catch (err) { alertModal('Delete Failed', err.message, 'error'); }
  };

  const columns = [
    { title: 'Quotation #', dataIndex: 'quotationNumber', width: 120,
      render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'quotationDate', width: 95,
      render: v => <span className="text-xs">{formatCalendarDate(v)}</span> },
    { title: 'Valid Until', dataIndex: 'validUntil', width: 100,
      render: (v, r) => (
        <span className={`text-xs ${quotationIsExpired(r) && !['converted','cancelled'].includes(r.status) ? 'text-red-500 font-medium' : ''}`}>
          {formatCalendarDate(v)}
        </span>
      )},
    { title: 'Customer / Dealer', key: 'customer', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[170px]">{r.dealerName || r.customerName || '—'}</div>
          <div className="text-xs text-gray-400">{r.dealerCode || r.customerPhone || ''}</div>
        </div>
      )},
    { title: 'Items', key: 'items', width: 55,
      render: (_, r) => <span className="text-xs">{r.items?.length || 0}</span> },
    { title: 'Total', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="font-semibold">{formatMoney(v)}</span> },
    { title: 'Status', dataIndex: 'status', width: 110,
      render: (s, r) => {
        const effectiveStatus = r.effectiveStatus || s;
        return (
          <Space direction="vertical" size={2}>
            <Tag color={STATUS_COLORS[effectiveStatus] || STATUS_COLORS[s]}>{effectiveStatus?.replace(/_/g, ' ')}</Tag>
            {r.conversionState === 'partial' && <Tag color="purple">partially converted</Tag>}
          </Space>
        );
      }},
    {
      title: 'Stock Status', key: 'stockStatus', width: 145,
      render: (_, r) => {
        // For terminal quotations, stock status is irrelevant. A split parent is
        // terminal too: its demand now lives on its children.
        if (['converted', 'cancelled', 'split'].includes(r.status)) {
          return <span className="text-xs text-gray-300">—</span>;
        }
        return (
          <Space direction="vertical" size={2}>
            <QuotationStockBadge quotation={r} />
            <HoldBadge quotation={r} />
            {r.splitRole && r.splitRole !== 'none' && (
              <Tag color={r.splitRole === 'parent' ? 'geekblue' : r.splitRole === 'available' ? 'green' : 'gold'}>
                {SPLIT_ROLE_LABELS[r.splitRole]}
              </Tag>
            )}
            <QueueModeBadge readiness={r.stockReadiness} />
          </Space>
        );
      },
    },
    { title: 'Actions', width: 180,
      render: (_, r) => {
        const readiness = r.stockReadiness;
        const expired = quotationIsExpired(r);
        const canConvertNow = ['approved', 'accepted'].includes(r.status) && !expired && r.conversionState !== 'full';
        const holding = ['held', 'partial'].includes(r.holdStatus);
        // A hold can only be taken on a real commitment, and only once.
        const canHold = ['approved', 'accepted'].includes(r.status) && !expired
          && !holding && r.conversionState !== 'full' && readiness?.anyStockAvailable;
        return (
          <Space size="small">
            {/* View — always */}
            <Tooltip title="View / Print">
              <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600"
                onClick={() => setViewRecord(r)} />
            </Tooltip>

            {/* approved / accepted → hold stock, splitting off any shortfall */}
            {canHold && (
              <Tooltip title={readiness?.allStockAvailable
                ? 'Hold this stock so converting cannot fail'
                : 'Hold what is available and split the shortfall into its own quotation'}>
                <Button type="text" size="small" icon={<LockOutlined />} className="text-emerald-600"
                  loading={splitBusy && splitState?.record?._id === r._id}
                  onClick={() => openSplitPlan(r, 'split')} />
              </Tooltip>
            )}

            {/* pending stock → confirm once a GRN has landed */}
            {r.status === 'pending_stock' && (
              <Tooltip title="Stock has arrived — confirm and hold it, then this becomes a real offer">
                <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-emerald-600"
                  loading={splitBusy && splitState?.record?._id === r._id}
                  onClick={() => openSplitPlan(r, 'confirm')} />
              </Tooltip>
            )}

            {/* holding → give the stock back without cancelling */}
            {holding && (
              <Tooltip title="Release the stock hold (the quotation keeps its queue position)">
                <Button type="text" size="small" icon={<UnlockOutlined />} className="text-orange-500"
                  onClick={() => handleReleaseHold(r)} />
              </Tooltip>
            )}

            {/* draft → Send to customer */}
            {r.status === 'draft' && (
              <Tooltip title="Send to customer">
                <Button type="text" size="small" icon={<SendOutlined />} className="text-blue-500"
                  onClick={() => handleStatusChange(r._id, 'sent')} />
              </Tooltip>
            )}

            {/* approved → Send to customer */}
            {r.status === 'approved' && r.conversionState !== 'partial' && (
              <Tooltip title="Send to customer">
                <Button type="text" size="small" icon={<SendOutlined />} className="text-blue-500"
                  onClick={() => handleStatusChange(r._id, 'sent')} />
              </Tooltip>
            )}

            {/* sent → Mark Accepted */}
            {r.status === 'sent' && !expired && (
              <Tooltip title="Mark as Accepted by customer">
                <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600"
                  onClick={() => handleStatusChange(r._id, 'accepted')} />
              </Tooltip>
            )}

            {/* approved / accepted → one fully reserved child Sales Order */}
            {canConvertNow && readiness?.anyStockAvailable && !readiness.allStockAvailable && (
              <Tooltip title="Convert only FIFO-allocated quantities; remaining demand stays in the quotation">
                <Button type="text" size="small" icon={<WarningOutlined />} className="text-amber-600"
                  loading={convertingId === r._id}
                  disabled={Boolean(convertingId && convertingId !== r._id)}
                  onClick={() => handleConvert(r, 'available')} />
              </Tooltip>
            )}
            {canConvertNow && readiness?.allStockAvailable && (
              <Tooltip title="Convert all remaining quantities">
                <Button type="text" size="small" icon={<SwapOutlined />} className="text-purple-600"
                  loading={convertingId === r._id}
                  disabled={Boolean(convertingId && convertingId !== r._id)}
                  onClick={() => handleConvert(r, 'full')} />
              </Tooltip>
            )}
            {canConvertNow && !readiness?.anyStockAvailable && (
              <Tooltip title="No FIFO-allocated stock is currently available">
                <Button type="text" size="small" icon={<StopOutlined />} className="text-gray-400" disabled />
              </Tooltip>
            )}

            {/* draft → Delete */}
            {r.status === 'draft' && (
              <Tooltip title="Delete">
                <Button type="text" size="small" icon={<DeleteOutlined />} className="text-red-400"
                  onClick={() => handleDelete(r._id)} />
              </Tooltip>
            )}

            {/* non-terminal, non-draft → Cancel */}
            {!['converted', 'cancelled', 'draft'].includes(r.status) && (
              <Tooltip title="Cancel quotation">
                <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500"
                  onClick={() => handleStatusChange(r._id, 'cancelled')} />
              </Tooltip>
            )}
          </Space>
        );
      }},
  ];

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quotation Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create quotations for configured Dealer Types or walk-in customers, then convert to Sales Orders</p>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchQuotations(); loadStats(); }}>Refresh</Button>
          <ModuleRecycleBin module="quotation" title="Deleted Quotations" onRestore={fetchQuotations} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => {
            if (requestedDealerOrderRequest) navigate('/sales-purchase/quotation-manager', { replace: true });
            setShowCreate(true);
          }}>
            New Quotation
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={12} className="mb-4">
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<FileTextOutlined />} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Pending Approval" value={stats.pendingApproval || 0} valueStyle={{ color: '#d97706' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#0891b2' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Sent" value={stats.sent || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Accepted" value={stats.accepted || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Converted" value={stats.converted || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Expired" value={stats.expired || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Total Value" value={formatMoney(Math.round(finiteNumber(stats.totalValue)))} /></Card></Col>
      </Row>
      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Live Available" value={stats.stockReadiness?.available || 0} valueStyle={{ color: '#15803d' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Live Partial Stock" value={stats.stockReadiness?.partial || 0} valueStyle={{ color: '#d97706' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Live Out of Stock" value={stats.stockReadiness?.outOfStock || 0} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Fully Converted Qty" value={stats.stockReadiness?.fullyConverted || 0} valueStyle={{ color: '#7e22ce' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="FIFO Queued" value={stats.stockReadiness?.queued?.total || 0} valueStyle={{ color: '#2563eb' }} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Physical-only" value={stats.stockReadiness?.physicalOnly?.total || 0} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Conversion None / Partial" value={`${stats.conversionState?.none || 0} / ${stats.conversionState?.partial || 0}`} /></Card></Col>
        <Col xs={12} sm={8} lg={3}><Card size="small"><Statistic title="Conversion Full" value={stats.conversionState?.full || 0} valueStyle={{ color: '#7e22ce' }} /></Card></Col>
      </Row>

      {/* Server-backed filters */}
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <Input
            placeholder="Search quotation #, dealer, customer…"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={filters.search}
            onChange={event => updateFilter('search', event.target.value)}
            className="w-full lg:w-80"
            allowClear
          />
          <Select placeholder="Status" options={STATUS_OPTIONS} value={filters.status} onChange={value => updateFilter('status', value)} allowClear className="w-full lg:w-44" />
          <Select placeholder="Customer type" options={CUSTOMER_TYPE_OPTIONS} value={filters.customerType} onChange={value => updateFilter('customerType', value)} allowClear className="w-full lg:w-44" />
          <Select placeholder="Validity" options={VALIDITY_OPTIONS} value={filters.validityStatus} onChange={value => updateFilter('validityStatus', value)} allowClear className="w-full lg:w-44" />
          <Button onClick={clearFilters}>Clear Filters</Button>
        </div>
        <Collapse
          ghost
          className="mt-2 -mx-3"
          items={[{
            key: 'advanced',
            label: <span className="text-sm font-medium text-gray-600"><FilterOutlined className="mr-2" />Advanced filters & sorting</span>,
            children: (
              <Row gutter={[12, 12]}>
                <Col xs={24} sm={12} lg={6}>
                  <label className="mb-1 block text-xs text-gray-500">Dealer</label>
                  <Select
                    value={filters.dealer || undefined}
                    onChange={value => updateFilter('dealer', value || '')}
                    allowClear showSearch optionFilterProp="label" loading={filterLookupsLoading}
                    placeholder="Select registered dealer" className="w-full"
                    options={filterLookups.dealers
                      .filter(dealer => !filters.dealerType || String(dealer.dealerType?._id || dealer.dealerType) === String(filters.dealerType))
                      .map(dealer => ({ value: dealer._id, label: `${dealer.businessName} (${dealer.dealerCode || 'No code'})` }))}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}>
                  <label className="mb-1 block text-xs text-gray-500">Dealer type</label>
                  <Select
                    value={filters.dealerType || undefined}
                    onChange={value => {
                      const selectedDealer = filterLookups.dealers.find(dealer => dealer._id === filters.dealer);
                      const dealerMatches = !selectedDealer || String(selectedDealer.dealerType?._id || selectedDealer.dealerType) === String(value || '');
                      setFilters(current => ({ ...current, dealerType: value || '', ...(dealerMatches ? {} : { dealer: '' }) }));
                      setPagination(current => ({ ...current, current: 1 }));
                    }}
                    allowClear showSearch optionFilterProp="label" loading={filterLookupsLoading}
                    placeholder="Select dealer type" className="w-full"
                    options={filterLookups.dealerTypes.map(type => ({ value: type._id, label: type.pricingTier ? `${type.name} · ${type.pricingTier}` : type.name }))}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Customer / dealer text</label><Input value={filters.customer} onChange={event => updateFilter('customer', event.target.value)} allowClear placeholder="Name, code or phone" /></Col>
                <Col xs={24} sm={12} lg={6}>
                  <label className="mb-1 block text-xs text-gray-500">Created by</label>
                  <Select
                    value={filters.createdBy || undefined}
                    onChange={value => updateFilter('createdBy', value || '')}
                    allowClear showSearch optionFilterProp="label" loading={filterLookupsLoading}
                    placeholder="Select sales executive" className="w-full"
                    options={filterLookups.creators.map(user => ({ value: user._id, label: user.phone ? `${user.name} · ${user.phone}` : user.name }))}
                  />
                </Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Approval status</label><Select options={APPROVAL_OPTIONS} value={filters.approvalStatus} onChange={value => updateFilter('approvalStatus', value)} allowClear className="w-full" /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Conversion state</label><Select options={CONVERSION_OPTIONS} value={filters.conversionState} onChange={value => updateFilter('conversionState', value)} allowClear className="w-full" /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Has conversions</label><Select options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} value={filters.converted} onChange={value => updateFilter('converted', value)} allowClear className="w-full" /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Stock status</label><Select options={STOCK_OPTIONS} value={filters.stockStatus} onChange={value => updateFilter('stockStatus', value)} allowClear className="w-full" /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Quotation date from</label><Input type="date" value={filters.dateFrom} onChange={event => updateFilter('dateFrom', event.target.value)} /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Quotation date to</label><Input type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={event => updateFilter('dateTo', event.target.value)} /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Expiring within days</label><InputNumber min={1} max={365} precision={0} value={filters.expiringWithinDays} onChange={value => updateFilter('expiringWithinDays', value ?? 30)} className="w-full" /></Col>
                <Col xs={12} sm={6} lg={3}><label className="mb-1 block text-xs text-gray-500">Amount min</label><InputNumber min={0} value={filters.amountMin} onChange={value => updateFilter('amountMin', value)} prefix="₹" className="w-full" /></Col>
                <Col xs={12} sm={6} lg={3}><label className="mb-1 block text-xs text-gray-500">Amount max</label><InputNumber min={0} value={filters.amountMax} onChange={value => updateFilter('amountMax', value)} prefix="₹" className="w-full" /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Sort by</label><Select options={SORT_OPTIONS} value={filters.sortBy} onChange={value => updateFilter('sortBy', value)} className="w-full" /></Col>
                <Col xs={24} sm={12} lg={6}><label className="mb-1 block text-xs text-gray-500">Sort order</label><Select options={[{ value: 'desc', label: 'Descending' }, { value: 'asc', label: 'Ascending' }]} value={filters.sortOrder} onChange={value => updateFilter('sortOrder', value)} className="w-full" /></Col>
              </Row>
            ),
          }]}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={quotations} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 950 }}
          pagination={{ ...pagination, showSizeChanger: true,
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Modal */}
      <AuthoritativeQuotationModal
        open={showCreate}
        dealerOrderRequestId={createFromRequest ? requestedDealerOrderRequest : null}
        onClose={closeCreate}
        onSuccess={() => { fetchQuotations(); loadStats(); }}
      />

      {/* View / Print Modal */}
      {viewRecord && (
        <ViewQuotationModal
          quotationId={viewRecord._id}
          refreshVersion={detailRefreshVersion}
          converting={convertingId === viewRecord._id}
          onClose={() => setViewRecord(null)}
          onConvert={handleConvert}
          onQuotationUpdated={() => { fetchQuotations(); loadStats(); }}
          onStatusChange={(id, s) => { handleStatusChange(id, s); setViewRecord(null); }}
        />
      )}

      {/* Stock hold / split confirmation. Doubles as the re-confirm dialog when
          the server reports the plan changed under the approver. */}
      <Modal
        open={Boolean(splitState)}
        title={splitState?.intent === 'confirm'
          ? `Confirm stock — ${splitState?.record?.quotationNumber || ''}`
          : `Hold stock — ${splitState?.record?.quotationNumber || ''}`}
        onCancel={() => setSplitState(null)}
        onOk={commitSplit}
        confirmLoading={splitBusy}
        okText={splitState?.drifted
          ? 'Confirm the updated split'
          : splitState?.intent === 'confirm'
            ? 'Confirm and hold stock'
            : splitState?.plan?.willSplit ? 'Hold stock and split' : 'Hold stock'}
        width={720}
        destroyOnClose
      >
        {splitState && (
          <div className="space-y-4">
            {splitState.drifted && (
              <Alert
                type="warning"
                showIcon
                message="Stock changed while you were approving"
                description={
                  'The split below has been recalculated from current stock. Check the quantities and confirm again — '
                  + 'nothing has been committed yet.'
                }
              />
            )}
            {!splitState.drifted && splitState.plan.willSplit && (
              <Alert
                type="info"
                showIcon
                message="This quotation will become three records"
                description={
                  `${splitState.record.quotationNumber} is kept as the original request. `
                  + 'A new quotation holds the available stock and can be converted straight away. '
                  + 'A second one carries the shortfall and waits for stock.'
                }
              />
            )}
            {!splitState.drifted && !splitState.plan.willSplit && splitState.intent !== 'confirm' && (
              <Alert
                type="success"
                showIcon
                message="Everything is available — no split needed"
                description="Stock will be held against this quotation so converting it cannot fail."
              />
            )}
            <SplitPlanTables plan={splitState.plan} />
            <div className="rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-600">
              The hold expires after {splitState.plan.holdTtlHours}h, after which the stock returns to
              available and the quotation keeps its place in the queue. Checked{' '}
              {formatDate(splitState.plan.checkedAt, true)}.
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

// ═══════════════════════════════════════════════
// CREATE QUOTATION MODAL
// ═══════════════════════════════════════════════
// Legacy modal retained temporarily for backward-compatible reference; the manager uses AuthoritativeQuotationModal.
export const LegacyCreateQuotationModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [dealers, setDealers] = useState([]);

  const [form, setForm] = useState({
    dealer: '', customerType: 'dealer', customerName: '', customerPhone: '', customerAddress: '',
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(),
    freightCharges: 0, loadingCharges: 0, installationCharges: 0, otherCharges: 0,
    remarks: '', termsAndConditions: 'Prices are subject to change. GST extra as applicable.',
  });

  const [items, setItems] = useState([
    { product: '', productName: '', productCode: '', shade: '', batch: '',
      quantity: 1, unit: 'Box', rate: 0, discount: 0, discountType: 'flat', gstPercentage: 18 }
  ]);

  const [productSearches, setProductSearches] = useState({});
  const [productResults, setProductResults] = useState({});
  const [showProductModal, setShowProductModal] = useState(false);
  const [productPages, setProductPages] = useState({});
  const [productHasMore, setProductHasMore] = useState({});
  const [productLoading, setProductLoading] = useState({});
  // Per-row debounce timers — useRef so clearing never triggers re-render
  const productSearchTimers = useRef({});

  useEffect(() => {
    if (open) {
      // Map customerType to pricingTier for filtering dealers
      const TIER_MAP = {
        dealer: 'dealerRate', wholesaler: 'wholesaleRate', retail: 'retailRate',
        distributor: 'distributorRate', builder: 'builderRate',
      };
      const pricingTier = TIER_MAP[form.customerType] || 'dealerRate';
      masterService.getDealers({ limit: 200, status: 'active', pricingTier }).then(r => {
        if (r.success) setDealers(r.data);
      }).catch(() => {});
    }
  }, [open, form.customerType]);

  const searchProduct = (idx, val) => {
    setProductSearches(p => ({ ...p, [idx]: val }));
    setProductPages(p => ({ ...p, [idx]: 1 }));
    // Cancel previous timer for this row before scheduling new one
    clearTimeout(productSearchTimers.current[idx]);
    productSearchTimers.current[idx] = setTimeout(() => {
      setProductLoading(p => ({ ...p, [idx]: true }));
      salesService.searchProducts(val || '', 1, undefined, undefined, form.customerType || 'dealer').then(r => {
        if (r.success) {
          setProductResults(p => ({ ...p, [idx]: r.data || [] }));
          setProductHasMore(p => ({ ...p, [idx]: (r.data || []).length >= 20 }));
        }
      }).catch(() => {}).finally(() => setProductLoading(p => ({ ...p, [idx]: false })));
    }, val ? 400 : 0);
  };

  const loadMoreProducts = (idx) => {
    const page = (productPages[idx] || 1) + 1;
    const searchVal = productSearches[idx] || '';
    setProductPages(p => ({ ...p, [idx]: page }));
    setProductLoading(p => ({ ...p, [idx]: true }));
    salesService.searchProducts(searchVal.length >= 2 ? searchVal : 'a', page, undefined, undefined, form.customerType || 'dealer').then(r => {
      if (r.success) {
        setProductResults(p => ({ ...p, [idx]: [...(p[idx] || []), ...(r.data || [])] }));
        setProductHasMore(p => ({ ...p, [idx]: (r.data || []).length >= 20 }));
      }
    }).catch(() => {}).finally(() => setProductLoading(p => ({ ...p, [idx]: false })));
  };

  const handleProductDropdownScroll = (e, idx) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    if (scrollHeight - scrollTop - clientHeight < 50 && productHasMore[idx] && !productLoading[idx]) {
      loadMoreProducts(idx);
    }
  };

  const selectProduct = (idx, prod) => {
    const RATE_KEY = { dealer: 'dealerRate', wholesaler: 'wholesaleRate', retail: 'retailRate', distributor: 'distributorRate', builder: 'builderRate' };
    const baseRate = prod[RATE_KEY[form.customerType]] || prod.dealerRate || prod.mrp || 0;

    // Auto-apply discount from backend if available
    let discount = 0, discountType = 'flat', discountRuleName = '';
    if (prod.discount?.hasDiscount !== false && prod.discount) {
      discount = prod.discount.discountPercentage || 0;
      discountType = 'percentage';
      discountRuleName = prod.discount.ruleName || '';
    }

    updateItem(idx, {
      product: prod._id, productName: prod.itemName, productCode: prod.productCode,
      productImage: prod.images?.[0] || '',
      sqftPerBox: prod.sqftPerBox || null,
      rate: baseRate, unit: prod.unit || 'Box', gstPercentage: prod.gst || 18,
      discount, discountType, discountRuleName,
    });
    setProductSearches(p => ({ ...p, [idx]: prod.itemName }));
    setProductResults(p => ({ ...p, [idx]: [] }));
  };

  const updateItem = (idx, changes) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...changes } : item));
  };

  const addItem = () => setItems(prev => [...prev, {
    product: '', productName: '', productCode: '', shade: '', batch: '',
    quantity: 1, unit: 'Box', rate: 0, discount: 0, discountType: 'flat', gstPercentage: 18
  }]);

  // Handle products from ProductSelectionModal
  const handleProductsFromModal = (selectedProducts) => {
    const RATE_MAP_KEY = {
      dealer: 'dealerRate', wholesaler: 'wholesaleRate', retail: 'retailRate',
      distributor: 'distributorRate', builder: 'builderRate',
    };
    const rateField = RATE_MAP_KEY[form.customerType] || 'dealerRate';

    const newItems = selectedProducts.map(p => {
      const baseRate = p[rateField] || p.dealerRate || p.mrp || 0;
      // Auto-apply discount if available from product data
      let discount = 0, discountType = 'flat', discountRuleName = '';
      if (p.discount) {
        discount = p.discount.discountPercentage || 0;
        discountType = 'percentage';
        discountRuleName = p.discount.ruleName || '';
      }
      return {
        product: p._id, productName: p.itemName, productCode: p.productCode,
        productImage: p.images?.[0] || '',
        sqftPerBox: p.sqftPerBox || null,
        shade: '', batch: '', quantity: 1, unit: p.unit || 'Box',
        rate: baseRate, discount, discountType, discountRuleName,
        gstPercentage: p.gst || 18,
      };
    });
    setItems(prev => [...prev.filter(i => i.product), ...newItems]);
  };

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const calcTotals = () => {
    let subtotal = 0, totalTax = 0;
    items.forEach(item => {
      const base = item.quantity * item.rate;
      const disc = item.discountType === 'percentage' ? (base * item.discount) / 100 : item.discount * item.quantity;
      const taxable = base - disc;
      subtotal += taxable;
      totalTax += (taxable * item.gstPercentage) / 100;
    });
    const grand = subtotal + totalTax + (form.freightCharges || 0) + (form.loadingCharges || 0) + (form.installationCharges || 0) + (form.otherCharges || 0);
    return { subtotal, totalTax, grandTotal: grand };
  };

  const handleSubmit = async () => {
    if (!items.some(i => i.product)) { message.error('Add at least one product'); return; }
    setLoading(true);
    try {
      const res = await salesService.createQuotation({ ...form, items });
      if (res.success) {
        message.success(`${res.data.quotationNumber} created!`);
        onSuccess?.(); handleClose();
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClose = () => {
    setForm({
      dealer: '', customerType: 'dealer', customerName: '', customerPhone: '', customerAddress: '',
      quotationDate: new Date().toISOString().split('T')[0],
      validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(),
      freightCharges: 0, loadingCharges: 0, installationCharges: 0, otherCharges: 0, remarks: '',
      termsAndConditions: 'Prices are subject to change. GST extra as applicable.',
    });
    setItems([{ product: '', productName: '', productCode: '', shade: '', batch: '', quantity: 1, unit: 'Box', rate: 0, discount: 0, discountType: 'flat', gstPercentage: 18 }]);
    setProductSearches({}); setProductResults({});
    onClose();
  };

  const { subtotal, totalTax, grandTotal } = calcTotals();

  return (
    <Modal title="New Quotation" open={open} onCancel={handleClose}
      width="calc(100vw - 240px)" style={{ top: 20, marginLeft: 'auto', marginRight: 20 }}
      styles={{ body: { overflow: 'visible', padding: '24px 32px' } }}
      footer={null} closable destroyOnHidden>
      <div className="space-y-4 mt-4">
        {/* Customer Type */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Quotation For *</label>
          <div className="flex gap-2">
            {[
              { value: 'dealer', label: 'Dealer' },
              { value: 'wholesaler', label: 'Wholesaler' },
              { value: 'retail', label: 'Retail / Walk-in' },
              { value: 'distributor', label: 'Distributor' },
              { value: 'builder', label: 'Builder / Architect' },
            ].map(t => (
              <button key={t.value}
                className={`px-3 py-1.5 rounded-md text-xs font-medium border transition ${form.customerType === t.value
                  ? 'bg-[#FF5F03] text-white border-[#FF5F03]' : 'text-gray-500 border-gray-200 bg-white hover:border-gray-300'}`}
                onClick={() => setForm(f => ({ ...f, customerType: t.value, dealer: '' }))}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Customer / Dealer */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">{form.customerType === 'retail' ? 'Customer' : form.customerType || 'Dealer'} (optional)</label>
            <Select className="w-full" showSearch placeholder={`Select ${form.customerType || 'dealer'}...`} allowClear
              optionFilterProp="label" size="large"
              onChange={v => setForm(f => ({ ...f, dealer: v || '' }))}
              options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Walk-in Customer Name</label>
            <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="If not a registered customer" size="large" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Customer Phone</label>
            <Input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              placeholder="Phone number" size="large" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quotation Date</label>
            <Input type="date" value={form.quotationDate}
              onChange={e => setForm(f => ({ ...f, quotationDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Valid Until</label>
            <Input type="date" value={form.validUntil}
              onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700">Products / Items *</label>
            <Space>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowProductModal(true)}>Browse & Add Products</Button>
              <Button size="small" onClick={addItem}>+ Manual Row</Button>
            </Space>
          </div>
          <div className="border border-gray-200 rounded-lg">
            <div>
              <table className="w-full text-xs">
                <thead className="bg-blue-50">
                  <tr>
                    {['Product', 'Shade', 'Batch', 'Boxes / Qty', 'Sqft', 'Unit', 'Rate', 'Disc', 'GST%', 'Total', ''].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 relative" style={{minWidth: 220}}>
                        {item.product ? (
                          <div className="flex items-center gap-1">
                            {item.productImage && <ProductImage src={item.productImage} size="sm" />}
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-semibold truncate">{item.productName}</div>
                              <div className="text-[9px] text-gray-400">{item.productCode}{item.sqftPerBox ? <span className="ml-1 text-green-600 font-medium">· {item.sqftPerBox} sqft/box</span> : ''}{item.discountRuleName ? <span className="ml-1 text-green-600">· {item.discountRuleName}</span> : ''}</div>
                            </div>
                            <button className="text-gray-300 hover:text-red-500 text-xs shrink-0 px-1" onClick={() => { updateItem(idx, { product: '', productName: '', productCode: '', productImage: '', rate: 0, discount: 0, discountType: 'flat', discountRuleName: '' }); setProductSearches(p => ({...p, [idx]: ''})); }}>✕</button>
                          </div>
                        ) : (
                          <>
                            <Input value={productSearches[idx] ?? ''}
                              onChange={e => searchProduct(idx, e.target.value)}
                              onFocus={() => { if (!productResults[idx]?.length) searchProduct(idx, ''); }}
                              placeholder="Type to search..." size="small" />
                            {(productResults[idx] || []).length > 0 && (
                              <div className="absolute z-50 left-0 top-full mt-1 w-[380px] bg-white border rounded-lg shadow-2xl max-h-60 overflow-y-auto"
                                onScroll={e => handleProductDropdownScroll(e, idx)}>
                                {(productResults[idx] || []).filter(p => !items.some(i => i.product === p._id)).map(p => (
                                  <div key={p._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50"
                                    onClick={() => selectProduct(idx, p)}>
                                    <div className="flex justify-between items-center">
                                      <div className="flex items-center gap-2 min-w-0 flex-1">
                                        {p.images?.[0] && <img src={getImageUrl(p.images[0])} alt="" className="w-8 h-8 rounded object-cover shrink-0 border border-gray-100" />}
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-medium truncate">{p.itemName}</div>
                                          <div className="text-[10px] text-gray-400">{p.productCode}{p.brand?.name ? ` · ${p.brand.name}` : ''}{p.tileSize ? ` · ${p.tileSize}` : ''}{p.sqftPerBox ? ` · ${p.sqftPerBox} sqft/box` : ''}</div>
                                        </div>
                                      </div>
                                      <div className="text-right shrink-0 ml-2">
                                        {p.discount ? (
                                          <>
                                            <div className="text-xs font-bold text-green-600">₹{p.discount.effectiveRate}</div>
                                            <div className="text-[9px] text-gray-400 line-through">₹{p.dealerRate || p.mrp || 0}</div>
                                            <div className="text-[9px] text-green-600 font-medium">{p.discount.discountPercentage}% off</div>
                                          </>
                                        ) : (
                                          <div className="text-xs font-bold text-[#FF5F03]">₹{p.dealerRate || p.mrp || 0}</div>
                                        )}
                                        <div className={`text-[9px] ${(p.stockAvailable || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>Stock: {p.stockAvailable || 0}</div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {productLoading[idx] && <div className="px-3 py-2 text-center text-xs text-gray-400">Loading more...</div>}
                                {!productHasMore[idx] && (productResults[idx] || []).length > 0 && <div className="px-3 py-1.5 text-center text-[10px] text-gray-300">— End —</div>}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={item.shade} onChange={e => updateItem(idx, { shade: e.target.value })} className="w-18" placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={item.batch} onChange={e => updateItem(idx, { batch: e.target.value })} className="w-18" placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber
                          min={0.01} step={1}
                          value={item.quantity}
                          onChange={v => {
                            const qty = v || 1;
                            const sqft = item.sqftPerBox ? Math.round(qty * item.sqftPerBox * 100) / 100 : undefined;
                            updateItem(idx, { quantity: qty, ...(sqft !== undefined ? { sqft } : {}) });
                          }}
                          className="w-16"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        {item.sqftPerBox ? (
                          <InputNumber
                            min={0.01} step={0.5}
                            value={item.sqft ?? Math.round(item.quantity * item.sqftPerBox * 100) / 100}
                            onChange={v => {
                              const sqft = v || 0;
                              const qty = Math.ceil(sqft / item.sqftPerBox);
                              updateItem(idx, { sqft, quantity: qty });
                            }}
                            className="w-20"
                            placeholder="sqft"
                          />
                        ) : (
                          <span className="text-[10px] text-gray-300 px-1">—</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={item.unit} onChange={v => updateItem(idx, { unit: v })} className="w-20"
                          options={[{ value: 'Box', label: 'Box' }, { value: 'Pcs', label: 'Pcs' }, { value: 'Sqft', label: 'Sqft' }]} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={item.rate} onChange={v => updateItem(idx, { rate: v || 0 })} prefix="₹" className="w-24" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={item.discount} onChange={v => updateItem(idx, { discount: v || 0 })} className="w-16" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} max={28} value={item.gstPercentage} onChange={v => updateItem(idx, { gstPercentage: v || 18 })} className="w-14" />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-right">
                        {(() => {
                          const base = item.quantity * item.rate;
                          const disc = item.discountType === 'percentage' ? (base * item.discount) / 100 : item.discount * item.quantity;
                          const taxable = base - disc;
                          const gst = (taxable * item.gstPercentage) / 100;
                          return `₹${(taxable + gst).toFixed(0)}`;
                        })()}
                      </td>
                      <td className="px-2 py-1.5">
                        {items.length > 1 && (
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charges & Remarks */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Freight Charges</label>
                <InputNumber value={form.freightCharges} onChange={v => setForm(f => ({ ...f, freightCharges: v || 0 }))} prefix="₹" className="w-full" min={0} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Loading Charges</label>
                <InputNumber value={form.loadingCharges} onChange={v => setForm(f => ({ ...f, loadingCharges: v || 0 }))} prefix="₹" className="w-full" min={0} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Installation Charges</label>
                <InputNumber value={form.installationCharges} onChange={v => setForm(f => ({ ...f, installationCharges: v || 0 }))} prefix="₹" className="w-full" min={0} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Other Charges</label>
                <InputNumber value={form.otherCharges} onChange={v => setForm(f => ({ ...f, otherCharges: v || 0 }))} prefix="₹" className="w-full" min={0} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Remarks</label>
              <Input.TextArea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Terms & Conditions</label>
              <Input.TextArea rows={2} value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-end justify-end">
            <div className="w-full bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
              {items.reduce((s, i) => s + (i.discountType === 'percentage' ? (i.quantity * i.rate * i.discount / 100) : i.discount * i.quantity), 0) > 0 && (
                <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{items.reduce((s, i) => s + (i.discountType === 'percentage' ? (i.quantity * i.rate * i.discount / 100) : i.discount * i.quantity), 0).toLocaleString()}</span></div>
              )}
              <div className="flex justify-between"><span className="text-gray-500">GST</span><span>₹{totalTax.toFixed(2)}</span></div>
              {form.freightCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Freight</span><span>₹{form.freightCharges}</span></div>}
              {form.otherCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Other</span><span>₹{form.otherCharges}</span></div>}
              <Divider className="my-1" />
              <div className="flex justify-between font-bold text-base text-blue-700">
                <span>Grand Total</span><span>₹{Math.round(grandTotal).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<PlusOutlined />}>
            Create Quotation
          </Button>
        </div>
      </div>

      {/* Product Selection Modal */}
      <ProductSelectionModal
        open={showProductModal}
        onClose={() => setShowProductModal(false)}
        onAdd={handleProductsFromModal}
        customerType={form.customerType || 'dealer'}
        alreadyAdded={items.filter(i => i.product).map(i => i.product)}
      />
    </Modal>
  );
};

// ═══════════════════════════════════════════════
// VIEW / PRINT QUOTATION MODAL
// ═══════════════════════════════════════════════
const ViewQuotationModal = ({ quotationId, refreshVersion = 0, onClose, onConvert, onStatusChange, onQuotationUpdated, converting = false }) => {
  const [q, setQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stockCheck, setStockCheck] = useState(null);   // live FIFO readiness
  const [checkingStock, setCheckingStock] = useState(false);
  const [validityEditorOpen, setValidityEditorOpen] = useState(false);
  const [validityDate, setValidityDate] = useState(null);
  const [validityReason, setValidityReason] = useState('');
  const [savingValidity, setSavingValidity] = useState(false);
  const stockCheckRequestSeq = useRef(0);
  const detailRequestSeq = useRef(0);
  const detailRequestsInFlight = useRef(0);
  const detailPollGeneration = useRef(0);
  const detailPollInFlight = useRef(false);
  const printRef = useRef(null);

  const loadQuotation = useCallback(async ({ showLoading = false } = {}) => {
    const requestSeq = ++detailRequestSeq.current;
    detailRequestsInFlight.current += 1;
    if (showLoading) setLoading(true);
    try {
      const response = await salesService.getQuotation(quotationId);
      if (requestSeq !== detailRequestSeq.current) return null;
      if (response.success) {
        // Full detail is newer authority than any outstanding lightweight check.
        stockCheckRequestSeq.current += 1;
        setQ(response.data);
        setStockCheck(response.data.stockReadiness || null);
        return response.data;
      }
      return null;
    } catch (error) {
      if (requestSeq === detailRequestSeq.current) message.error(error.message);
      return null;
    } finally {
      detailRequestsInFlight.current = Math.max(0, detailRequestsInFlight.current - 1);
      if (requestSeq === detailRequestSeq.current) setLoading(false);
    }
  }, [quotationId]);

  useEffect(() => {
    loadQuotation({ showLoading: true });
    return () => {
      detailRequestSeq.current += 1;
      stockCheckRequestSeq.current += 1;
    };
  }, [loadQuotation, refreshVersion]);

  const openValidityEditor = () => {
    const currentValidity = calendarDay(q?.validUntil) || dayjs().add(30, 'day').startOf('day');
    setValidityDate(currentValidity);
    setValidityReason('');
    setValidityEditorOpen(true);
  };

  const saveValidity = async () => {
    if (!validityDate?.isValid()) { message.error('Select a valid date'); return; }
    if (!validityReason.trim()) { message.error('A reason is required'); return; }
    const quotationDate = calendarDay(q?.quotationDate);
    if (quotationDate && validityDate.startOf('day').isBefore(quotationDate)) {
      message.error('Valid until cannot be before quotation date');
      return;
    }
    if (q?.conversionState === 'partial' && !validityDate.endOf('day').isAfter(dayjs())) {
      message.error('Partially converted quotations must remain valid beyond today');
      return;
    }
    setSavingValidity(true);
    try {
      const response = await salesService.updateQuotationValidity(q._id, {
        validUntil: validityDate.format('YYYY-MM-DD'),
        reason: validityReason.trim(),
        expectedUpdatedAt: q.updatedAt,
      });
      if (response.success) {
        setValidityEditorOpen(false);
        message.success(response.message || 'Quotation validity updated');
        await loadQuotation();
        onQuotationUpdated?.();
      }
    } catch (error) {
      message.error(error.message || 'Could not update quotation validity');
      if (error?.response?.status === 409 || error?.status === 409) await loadQuotation();
    } finally { setSavingValidity(false); }
  };

  // Poll full detail for every nonterminal lifecycle state that displays live
  // stock. Settling before scheduling prevents overlap, while generations keep
  // responses from a previous quotation/context from winning.
  useEffect(() => {
    const effectiveStatus = q?.effectiveStatus || q?.status;
    if (!q || ['converted', 'cancelled', 'expired'].includes(effectiveStatus) || q.conversionState === 'full') return undefined;
    const generation = ++detailPollGeneration.current;
    let timer;
    const schedule = () => {
      if (generation !== detailPollGeneration.current) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(run, 30000);
    };
    const run = async () => {
      if (generation !== detailPollGeneration.current) return;
      if (document.visibilityState !== 'visible' || detailPollInFlight.current || detailRequestsInFlight.current > 0) {
        schedule();
        return;
      }
      detailPollInFlight.current = true;
      try {
        await loadQuotation();
      } finally {
        detailPollInFlight.current = false;
        schedule();
      }
    };
    const refreshOnFocus = () => {
      if (document.visibilityState !== 'visible') return;
      window.clearTimeout(timer);
      void run();
    };
    schedule();
    window.addEventListener('focus', refreshOnFocus);
    document.addEventListener('visibilitychange', refreshOnFocus);
    return () => {
      detailPollGeneration.current += 1;
      window.clearTimeout(timer);
      window.removeEventListener('focus', refreshOnFocus);
      document.removeEventListener('visibilitychange', refreshOnFocus);
    };
  }, [loadQuotation, q?.conversionState, q?.effectiveStatus, q?.status]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    if (!win) {
      message.error('Allow pop-ups to print this quotation.');
      return;
    }
    win.opener = null;
    win.document.write(`
      <html><head><title>Quotation - ${q.quotationNumber}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; padding:24px; color:#333; font-size:12px; }
        .header { display:flex; justify-content:space-between; border-bottom:3px solid #1890ff; padding-bottom:14px; margin-bottom:18px; }
        .co-name { font-size:22px; font-weight:bold; color:#1890ff; }
        .co-sub { font-size:10px; color:#888; margin-top:3px; }
        .qt-title { font-size:18px; font-weight:bold; text-align:right; }
        .qt-meta { text-align:right; font-size:10px; color:#666; margin-top:4px; }
        .info-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
        .info-box { padding:10px; border:1px solid #eee; border-radius:5px; }
        .info-box .lbl { font-size:10px; color:#888; text-transform:uppercase; }
        .info-box .val { font-size:13px; font-weight:600; margin-top:2px; }
        table { width:100%; border-collapse:collapse; margin:14px 0; }
        th { background:#f5f5f5; padding:7px 9px; text-align:left; font-size:10px; text-transform:uppercase; color:#666; border-bottom:2px solid #ddd; }
        td { padding:7px 9px; border-bottom:1px solid #f0f0f0; font-size:11px; }
        .totals { margin-left:auto; width:260px; margin-top:12px; }
        .totals .row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px; }
        .totals .grand { font-size:14px; font-weight:bold; color:#1890ff; border-top:2px solid #1890ff; padding-top:7px; margin-top:5px; }
        .terms { margin-top:20px; padding:12px; background:#f9f9f9; border-radius:5px; font-size:10px; color:#666; }
        .footer { margin-top:36px; border-top:1px solid #eee; padding-top:14px; display:flex; justify-content:space-between; }
        .sign-line { border-top:1px solid #555; width:140px; margin-top:38px; padding-top:4px; font-size:10px; color:#777; text-align:center; }
        @media print { body { padding:0; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>`);
    win.document.close();
    setTimeout(() => {
      if (!win.closed) { win.print(); win.close(); }
    }, 500);
  };

  if (loading || !q) return (
    <Modal open onCancel={onClose} footer={null} title="Loading...">
      <div className="py-8 text-center text-gray-400">Loading quotation...</div>
    </Modal>
  );

  const isExpired = quotationIsExpired(q);
  const effectiveStatus = q.effectiveStatus || q.status;
  const liveReadiness = stockCheck || q.stockReadiness;
  const checkedStockItems = stockCheck?.items || [];
  const checkedRemainingItems = checkedStockItems.filter(item => Number(item.remainingQty) > 0.0001);
  const liveQuotation = { ...q, stockReadiness: liveReadiness };
  const { status: qStockSt } = computeQuotationStockStatus(liveQuotation);
  const stockReady = qStockSt === 'ready';
  const canConvert = ['approved', 'accepted'].includes(q.status) && !isExpired && q.conversionState !== 'full';
  const canEditValidity = !['converted', 'cancelled', 'expired'].includes(q.status) && q.conversionState !== 'full';
  const validityCountdown = isExpired
    ? `Expired ${Math.abs(finiteNumber(q.expiresInDays))} day${Math.abs(finiteNumber(q.expiresInDays)) === 1 ? '' : 's'} ago`
    : q.expiresInDays == null
      ? 'No expiry configured'
      : q.expiresInDays === 0
        ? 'Expires today'
        : `${q.expiresInDays} day${q.expiresInDays === 1 ? '' : 's'} remaining`;

  return (
    <>
    <Modal
      title={
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3.5 pr-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100 shadow-2xs">
              <FileTextOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-lg font-bold text-gray-900 font-mono tracking-tight">{q.quotationNumber}</span>
                <Tag color={STATUS_COLORS[effectiveStatus] || STATUS_COLORS[q.status]} className="px-2.5 py-0.5 text-xs font-semibold capitalize rounded-md border-0 m-0">
                  {effectiveStatus?.replace(/_/g, ' ')}
                </Tag>
                {q.conversionState === 'partial' && <Tag color="purple" className="px-2 py-0.5 text-xs font-semibold rounded-md m-0">Partially Converted</Tag>}
                {q.conversionState === 'full' && <Tag color="green" className="px-2 py-0.5 text-xs font-semibold rounded-md m-0">Fully Converted</Tag>}
              </div>
              <div className="text-xs text-gray-400 font-normal mt-0.5">
                Quotation Date: {formatCalendarDate(q.quotationDate)} {q.createdBy?.name ? `• Created by ${q.createdBy.name}` : ''}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Tag color={isExpired ? 'red' : q.expiresInDays != null && q.expiresInDays <= 7 ? 'gold' : 'green'} className="px-2.5 py-1 text-xs font-medium rounded-md m-0">
              {validityCountdown}
            </Tag>
            <QuotationStockBadge quotation={liveQuotation} />
            <QueueModeBadge readiness={liveReadiness} />
          </div>
        </div>
      }
      open
      onCancel={onClose}
      width="min(1728px, calc(100vw - 24px))"
      centered
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="text-xs text-gray-400">
            {liveReadiness?.checkedAt ? `Stock checked at ${formatDate(liveReadiness.checkedAt, true)}` : ''}
          </div>
          <Space wrap size="small">
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print PDF</Button>
            {canEditValidity && <Button icon={<CalendarOutlined />} onClick={openValidityEditor}>Edit Validity</Button>}

            {/* draft → Send */}
            {q.status === 'draft' && (
              <Button icon={<SendOutlined />} onClick={() => onStatusChange(q._id, 'sent')}>
                Mark as Sent
              </Button>
            )}

            {/* approved → Send */}
            {q.status === 'approved' && q.conversionState !== 'partial' && (
              <Button icon={<SendOutlined />} onClick={() => onStatusChange(q._id, 'sent')}>
                Mark as Sent
              </Button>
            )}

            {/* sent → Mark Accepted */}
            {q.status === 'sent' && !isExpired && (
              <Button type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#16a34a', borderColor: '#16a34a' }}
                onClick={() => onStatusChange(q._id, 'accepted')}>
                Mark as Accepted
              </Button>
            )}

            {/* Create only fully reserved child orders; never create an OOS order. */}
            {canConvert && liveReadiness?.anyStockAvailable && !liveReadiness.allStockAvailable && (
              <Button type="primary" icon={<WarningOutlined />} loading={converting}
                style={{ background: '#d97706', borderColor: '#d97706' }}
                onClick={() => onConvert(liveQuotation, 'available')}>
                Convert Available Stock ({liveReadiness.totalAllocatedQty})
              </Button>
            )}
            {canConvert && liveReadiness?.allStockAvailable && (
              <Button type="primary" icon={<SwapOutlined />} loading={converting}
                onClick={() => onConvert(liveQuotation, 'full')}>
                Convert Full Remaining ({liveReadiness.totalRemainingQty})
              </Button>
            )}
            {canConvert && !liveReadiness?.anyStockAvailable && (
              <Tooltip title="Post a GRN or release stock, then re-check this quotation.">
                <Button icon={<StopOutlined />} disabled>Awaiting Stock to Convert</Button>
              </Tooltip>
            )}
            {canConvert && !liveReadiness?.allStockAvailable && (
              <Button
                icon={checkingStock ? <SyncOutlined spin /> : <SyncOutlined />}
                loading={checkingStock}
                onClick={async () => {
                  const requestSeq = ++stockCheckRequestSeq.current;
                  setCheckingStock(true);
                  try {
                    const response = await salesService.checkQuotationStock(q._id);
                    if (requestSeq === stockCheckRequestSeq.current && response.success) {
                      const readiness = stockReadinessFromResponse(response);
                      setStockCheck(readiness);
                      setQ(current => current ? {
                        ...current,
                        ...liveQuotationFieldsFromResponse(response),
                        stockReadiness: readiness,
                      } : current);
                    }
                  } catch (error) {
                    if (requestSeq === stockCheckRequestSeq.current) message.error(error.message);
                  } finally {
                    if (requestSeq === stockCheckRequestSeq.current) setCheckingStock(false);
                  }
                }}>
                Re-check Stock
              </Button>
            )}

            <Button onClick={onClose}>Close</Button>
          </Space>
        </div>
      }>
      {/* Explicit Inner Scroll Container */}
      <div className="max-h-[calc(82vh-100px)] overflow-y-auto overflow-x-hidden pr-1 space-y-4 text-sm">
        {/* Top Hero Banner */}
        <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 p-4 shadow-2xs">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Grand Total</div>
                <div className="text-2xl font-black text-blue-600">{formatMoney(q.grandTotal)}</div>
              </div>
              <div className="hidden h-10 w-px bg-slate-200 sm:block"></div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer / Dealer</div>
                <div className="text-sm font-bold text-slate-800">{q.dealerName || q.dealer?.businessName || q.customerName || '—'}</div>
                <div className="text-xs text-slate-500">{q.dealerCode || q.dealer?.dealerCode || q.customerPhone || '—'}</div>
              </div>
              <div className="hidden h-10 w-px bg-slate-200 sm:block"></div>
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Valid Through</div>
                <div className={`text-sm font-bold ${isExpired ? 'text-red-600' : 'text-slate-800'}`}>
                  {formatCalendarDate(q.validUntil)}
                </div>
                <div className="text-xs text-slate-500">{validityCountdown}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-700">Stock Availability</div>
                <div className="text-[11px] text-slate-400">
                  {liveReadiness?.checkedAt ? `Checked ${formatDate(liveReadiness.checkedAt, true)}` : 'Readiness live'}
                </div>
              </div>
              <QuotationStockBadge quotation={liveQuotation} />
            </div>
          </div>
        </div>

        {/* Stock Status Alerts */}
        {liveReadiness && (
          <Alert
            type={liveReadiness.queued ? 'info' : 'warning'}
            showIcon
            message={liveReadiness.queued
              ? (liveReadiness.eligibilityReason === 'sent_preserving_approved_fifo' ? 'Approved-sent quotation remains FIFO queued' : 'Queued FIFO readiness')
              : 'Physical-only live readiness'}
            description={`${liveReadiness.queued
              ? 'This allocation accounts for earlier eligible quotation demand.'
              : 'This quotation does not consume FIFO stock until it becomes eligible.'} Last checked ${formatDate(liveReadiness.checkedAt, true)}.`}
          />
        )}
        {canConvert && (
          <div>
            {checkingStock && !stockCheck && (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 border rounded-lg px-4 py-3">
                <SyncOutlined spin /> Checking live stock levels…
              </div>
            )}
            {!checkingStock && stockCheck && !stockReady && (
              <Alert
                type="error"
                showIcon
                className="mb-0"
                message={
                  <span className="font-semibold">
                    {stockCheck.anyStockAvailable
                      ? `Partial stock — ${checkedRemainingItems.filter(item => item.status === 'available').length} of ${checkedRemainingItems.length} remaining quotation lines fully ready`
                      : `Awaiting stock — ${checkedRemainingItems.length} remaining line${checkedRemainingItems.length !== 1 ? 's' : ''} currently have no allocatable stock`}
                  </span>
                }
                description={
                  <div className="mt-2 space-y-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {checkedRemainingItems.map((item) => (
                        <div key={item.itemId} className="flex items-center justify-between rounded-lg border border-red-200 bg-white p-2.5 text-xs shadow-2xs">
                          <div className="min-w-0 flex-1 pr-2">
                            <div className="font-semibold text-gray-800 truncate">{item.productName}</div>
                            <div className="text-[10px] text-gray-400">{item.productCode}</div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-gray-500">Need: <strong>{item.quantityRequired}</strong></span>
                            <span className={`font-semibold ${item.status === 'available' ? 'text-green-600' : item.status === 'partial' ? 'text-amber-600' : 'text-red-600'}`}>
                              Allocated: {item.allocatedQty}
                            </span>
                            {item.status === 'available'
                              ? <Tag color="green" className="m-0 rounded-full text-[10px] font-bold">Available</Tag>
                              : item.status === 'partial'
                                ? <Tag color="gold" className="m-0 rounded-full text-[10px] font-bold">Partial</Tag>
                                : <Tag color="red" className="m-0 rounded-full text-[10px] font-bold">Out of Stock</Tag>
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      👉 Raise a Purchase Order → post GRN when stock arrives → the Convert button will unlock automatically.
                    </p>
                  </div>
                }
              />
            )}
            {!checkingStock && stockCheck?.allStockAvailable && (
              <Alert
                type="success"
                showIcon
                message={<span className="font-semibold">✅ All stock arrived — you can now convert this quotation to a Sales Order</span>}
                description="Every quotation line has a complete FIFO allocation. Conversion will recheck and reserve it atomically."
              />
            )}
          </div>
        )}

        {/* Context Info Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card size="small" className="shadow-2xs border-slate-200" title={<div className="flex items-center gap-2 font-semibold text-slate-700"><ShopOutlined className="text-blue-500" /><span>Branch</span></div>}>
            <div className="font-semibold text-slate-800">{q.branch?.name || '—'} {q.branch?.branchCode ? `(${q.branch.branchCode})` : ''}</div>
            <div className="mt-1 text-xs text-slate-500 line-clamp-2">{[q.branch?.address, q.branch?.city, q.branch?.state].filter(Boolean).join(', ') || 'No branch address'}</div>
            <div className="mt-1.5 text-xs text-slate-500">{[q.branch?.phone, q.branch?.email].filter(Boolean).join(' · ') || '—'}</div>
            {q.branch?.gstin && <div className="mt-1 text-xs text-slate-400 font-mono">GSTIN: {q.branch.gstin}</div>}
          </Card>
          <Card size="small" className="shadow-2xs border-slate-200" title={<div className="flex items-center gap-2 font-semibold text-slate-700"><AuditOutlined className="text-blue-500" /><span>Audience / Customer</span></div>}>
            <div className="font-semibold text-slate-800 truncate">{q.dealerName || q.dealer?.businessName || q.customerName || '—'}</div>
            <div className="mt-1 text-xs text-slate-500">{q.dealerCode || q.dealer?.dealerCode || q.customerPhone || '—'} · <span className="font-medium text-slate-700">{q.dealerType?.name || q.dealerTypeSnapshot?.name || q.customerType || 'Walk-in'}</span></div>
            <div className="mt-1 text-xs text-slate-500">Tier: {q.dealerType?.pricingTier || q.dealerTypeSnapshot?.pricingTier || 'Retail'}</div>
            <div className="mt-1 text-xs text-slate-500 truncate">{q.dealer?.ownerName ? `Owner: ${q.dealer.ownerName} · ` : ''}{q.dealer?.mobile || q.customerPhone || ''}</div>
            <div className="mt-1 text-xs text-slate-500 truncate">{q.dealer?.address || q.customerAddress || 'No address'}</div>
            {q.dealer?.gstin && <div className="mt-1 text-xs text-slate-400 font-mono">GSTIN: {q.dealer.gstin}</div>}
          </Card>
          <Card size="small" className="shadow-2xs border-slate-200" title={<div className="flex items-center gap-2 font-semibold text-slate-700"><CalendarOutlined className="text-blue-500" /><span>Dates & Validity</span></div>}>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Quotation date</span><strong>{formatCalendarDate(q.quotationDate)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Valid through</span><strong className={isExpired ? 'text-red-600' : ''}>{formatCalendarDate(q.validUntil)}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Countdown</span><Tag color={isExpired ? 'red' : q.expiresInDays != null && q.expiresInDays <= 7 ? 'gold' : 'green'} className="m-0 text-[10px]">{validityCountdown}</Tag></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><span><Tag className="m-0 text-[10px]">{q.status}</Tag></span></div>
              <div className="flex justify-between"><span className="text-slate-500">Conversion</span><span><Tag color={q.conversionState === 'partial' ? 'purple' : q.conversionState === 'full' ? 'green' : 'default'} className="m-0 text-[10px]">{q.conversionState || 'none'}</Tag></span></div>
            </div>
          </Card>
          <Card size="small" className="shadow-2xs border-slate-200" title={<div className="flex items-center gap-2 font-semibold text-slate-700"><SafetyCertificateOutlined className="text-blue-500" /><span>Approval</span></div>}>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between"><span className="text-slate-500">Required</span><strong>{q.approvalRequired ? 'Yes' : 'No'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Status</span><Tag color={q.approvalStatus === 'approved' ? 'green' : q.approvalStatus === 'rejected' ? 'red' : 'gold'} className="m-0 text-[10px]">{q.approvalStatus || 'not_required'}</Tag></div>
              <div className="flex justify-between"><span className="text-slate-500">Approved by</span><strong>{q.approvedBy?.name || q.approvedBy?.email || '—'}</strong></div>
              <div className="flex justify-between"><span className="text-slate-500">Date</span><strong>{formatDate(q.approvalDate, true)}</strong></div>
            </div>
          </Card>
        </div>

        {/* Complete item, UOM, allocation, tax and pricing details */}
        <Card size="small" className="shadow-2xs border-slate-200" title={<div className="flex items-center justify-between font-semibold text-slate-700"><span>Quotation Items ({q.items?.length || 0})</span></div>} styles={{ body: { padding: 0 } }}>
          <div className="overflow-x-auto rounded-b-lg">
            <table className="min-w-[1200px] w-full text-xs text-left border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 font-semibold border-b border-slate-200">
                <tr>
                  {['#', 'Product', 'UOM / Quantity', 'Warehouse / Shade / Batch', 'Quoted / Converted / Remaining', 'Live Allocation', 'Rate / Pricing Source', 'Discounts', 'Tax Detail', 'Line Total'].map(header => (
                    <th key={header} className="px-3.5 py-2.5 font-semibold text-slate-700">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(q.items || []).map((item, index) => {
                  const liveStock = liveReadiness?.items?.find(stock => String(stock.itemId) === String(item._id));
                  const pricing = item.pricingSnapshot || {};
                  const remaining = Math.max(0, finiteNumber(item.quantity) - finiteNumber(item.convertedQuantity));
                  return (
                    <tr key={item._id || index} className="hover:bg-slate-50/80 transition-colors align-top">
                      <td className="px-3.5 py-3 text-slate-400">{index + 1}</td>
                      <td className="px-3.5 py-3 min-w-56">
                        <div className="flex items-start gap-2.5">
                          {(item.productImage || item.product?.images?.[0]) && <ProductImage src={item.productImage || item.product?.images?.[0]} size="xs" />}
                          <div>
                            <div className="font-semibold text-slate-800">{item.productName || item.product?.itemName || '—'}</div>
                            <div className="text-[10px] font-mono text-slate-400">{item.productCode || item.product?.productCode || 'No code'}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5">{[item.product?.brand?.name, item.product?.category?.name, item.product?.subcategory?.name, item.product?.tileSize, item.product?.finish, item.product?.colour].filter(Boolean).join(' · ') || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3.5 py-3 min-w-36">
                        <div className="font-bold text-slate-800">{formatNumber(item.quantity)} <span className="font-normal text-slate-500">{item.unit || item.product?.unit || 'unit'}</span></div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Boxes: {formatNumber(item.boxes)} · Pcs: {formatNumber(item.pieces)}</div>
                        <div className="text-[11px] text-slate-500">Sqft: {formatNumber(item.sqft)} {item.product?.sqftPerBox ? `(${formatNumber(item.product.sqftPerBox)}/box)` : ''}</div>
                      </td>
                      <td className="px-3.5 py-3 min-w-44">
                        <div className="font-medium text-slate-700">{item.warehouse?.name || item.warehouse?.warehouseCode || liveStock?.allocation?.warehouse || 'Not assigned'}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Shade: <span className="font-mono text-slate-700">{item.shade || liveStock?.allocation?.shade || '—'}</span></div>
                        <div className="text-[11px] text-slate-500">Batch: <span className="font-mono text-slate-700">{item.batch || liveStock?.allocation?.batch || '—'}</span></div>
                      </td>
                      <td className="px-3.5 py-3 min-w-36">
                        <div className="text-slate-700">{formatNumber(item.quantity)} / {formatNumber(item.convertedQuantity)} / <strong className="text-blue-700">{formatNumber(remaining)}</strong></div>
                      </td>
                      <td className="px-3.5 py-3 min-w-36">
                        <Tag color={liveStock?.status === 'available' ? 'green' : liveStock?.status === 'partial' ? 'gold' : 'red'} className="m-0 text-[10px] font-semibold">
                          {liveStock?.status?.replace(/_/g, ' ') || 'unknown'}
                        </Tag>
                        <div className="mt-1 text-[11px] font-medium text-slate-700">{formatNumber(liveStock?.allocatedQty)} / {formatNumber(liveStock?.requiredQty)} allocated</div>
                        <div className="text-[11px] text-slate-400">Short: {formatNumber(liveStock?.shortfallQty)}</div>
                      </td>
                      <td className="px-3.5 py-3 min-w-48">
                        <div className="font-bold text-emerald-700">{formatMoney(item.rate ?? pricing.effectiveRate)}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Base {formatMoney(pricing.baseRate)} · Pricing {formatMoney(pricing.pricingRate)}</div>
                        <div className="text-[11px] text-slate-400">Minimum {formatMoney(pricing.minimumSellingRate)}</div>
                        <div className="max-w-44 truncate text-[10px] text-slate-400">{pricing.sourceName || pricing.source || 'Quotation snapshot'}{pricing.requestedTier ? ` · ${pricing.requestedTier}` : ''}</div>
                        {pricing.belowMinimum && <Tag color="red" className="mt-0.5 text-[10px]">Below minimum</Tag>}
                      </td>
                      <td className="px-3.5 py-3 min-w-36">
                        <div>Line: {formatNumber(item.discount)} {item.discountType === 'percentage' ? '%' : `per ${item.unit || 'unit'}`}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">Regular: {formatMoney(pricing.regularDiscountPerUnit)}</div>
                        <div className="text-[11px] text-slate-500">Scheme: {formatMoney(item.schemeDiscount ?? pricing.schemeDiscountPerUnit)}</div>
                        {item.discountRuleName && <div className="text-[10px] text-slate-400 truncate">{item.discountRuleName}</div>}
                      </td>
                      <td className="px-3.5 py-3 min-w-40">
                        <div>Taxable: {formatMoney(item.taxableAmount)}</div>
                        <div className="text-slate-600 font-medium mt-0.5">GST {formatNumber(item.gstPercentage)}%: {formatMoney(item.gstAmount)}</div>
                        <div className="text-[10px] text-slate-400">CGST {formatMoney(item.cgst)} · SGST {formatMoney(item.sgst)}</div>
                      </td>
                      <td className="px-3.5 py-3 font-bold text-slate-900 text-right min-w-28">{formatMoney(item.totalAmount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Historical Stock Snapshot */}
        {(q.snapshotCaptured === true || q.stockSnapshotAt) && (
          <Collapse
            size="small"
            items={[{
              key: 'historical-stock-snapshot',
              label: <span className="font-semibold text-slate-700"><HistoryOutlined className="mr-2" />At quotation creation · {formatDate(q.stockSnapshotAt, true)}</span>,
              children: (
                <div className="space-y-2 text-xs">
                  <Alert type="info" showIcon message="Historical only" description="These values describe stock captured when this quotation version was saved. Live readiness above is authoritative now." />
                  {(q.items || []).map((item, index) => (
                    <div key={item._id || index} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2">
                      <span className="font-medium text-slate-700">{item.productName || item.product?.itemName || item.productCode || `Line ${index + 1}`}</span>
                      <span>Captured allocatable: <strong>{formatNumber(item.stockAtQuotation)}</strong> · {item.outOfStock ? 'Not fully available' : 'Available'}</span>
                    </div>
                  ))}
                </div>
              ),
            }]}
          />
        )}

        {/* Complete Financial Summary & Remarks Grid */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Remarks & Terms (7 Cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Card size="small" className="shadow-2xs border-slate-200" title={<span className="font-semibold text-slate-700">Remarks</span>}>
                {q.remarks ? <div className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">{q.remarks}</div> : <span className="text-xs text-slate-400">No remarks</span>}
              </Card>
              <Card size="small" className="shadow-2xs border-slate-200" title={<span className="font-semibold text-slate-700">Terms & Conditions</span>}>
                {q.termsAndConditions ? <div className="whitespace-pre-wrap text-xs text-slate-600 leading-relaxed">{q.termsAndConditions}</div> : <span className="text-xs text-slate-400">No terms recorded</span>}
              </Card>
            </div>

            {/* Ownership & Audit */}
            <Card size="small" className="shadow-2xs border-slate-200" title={<span className="font-semibold text-slate-700"><AuditOutlined className="mr-2" />Ownership & Audit</span>}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-xs">
                <div className="flex justify-between"><span className="text-slate-500">Created by</span><strong>{q.createdBy?.name || q.createdBy?.email || '—'}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Created</span><strong>{formatDate(q.createdAt, true)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Last updated</span><strong>{formatDate(q.updatedAt, true)}</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Document version</span><strong>v{q.version || 1} (val v{q.validityVersion || 0} · conv v{q.conversionVersion || 0})</strong></div>
                <div className="flex justify-between"><span className="text-slate-500">Source request</span><strong>{q.sourceDealerOrderRequest?.requestNumber || '—'}</strong></div>
              </div>
            </Card>
          </div>

          {/* Financial Summary Card (5 Cols) */}
          <div className="lg:col-span-5">
            <Card size="small" className="shadow-2xs border-slate-200 bg-slate-50/50" title={<span className="font-semibold text-slate-700">Financial Summary</span>}>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between text-slate-600"><span>Subtotal</span><span className="font-medium text-slate-800">{formatMoney(q.subtotal)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Line discount</span><span className="font-medium text-emerald-600">-{formatMoney(q.totalDiscount)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Scheme discount</span><span className="font-medium text-emerald-600">-{formatMoney(q.totalSchemeDiscount)}</span></div>
                <div className="flex justify-between text-slate-600"><span>GST / Tax</span><span className="font-medium text-slate-800">{formatMoney(q.totalTax)}</span></div>
                <Divider className="my-1.5 border-slate-200" />
                <div className="flex justify-between text-slate-600"><span>Freight charges</span><span>{formatMoney(q.freightCharges)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Loading charges</span><span>{formatMoney(q.loadingCharges)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Installation charges</span><span>{formatMoney(q.installationCharges)}</span></div>
                <div className="flex justify-between text-slate-600"><span>Other charges</span><span>{formatMoney(q.otherCharges)}</span></div>
                {finiteNumber(q.roundOff) !== 0 && <div className="flex justify-between text-slate-600"><span>Round-off</span><span>{formatMoney(q.roundOff)}</span></div>}
                <Divider className="my-1.5 border-slate-200" />
                <div className="flex justify-between rounded-lg bg-blue-50 border border-blue-100 p-3 text-sm font-bold text-blue-800">
                  <span>Grand Total</span>
                  <span className="text-base text-blue-700">{formatMoney(q.grandTotal)}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* Conversion & Validity Histories */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 pb-2">
          <Card size="small" className="shadow-2xs border-slate-200" title={<span className="font-semibold text-slate-700"><HistoryOutlined className="mr-2" />Conversion History ({(q.conversionHistory || []).length})</span>}>
            {(q.conversionHistory || []).length ? <div className="space-y-2">
              {(q.conversionHistory || []).map(entry => (
                <div key={entry._id} className="rounded-lg border border-purple-100 bg-purple-50/60 p-3 text-xs">
                  <div className="flex flex-col justify-between gap-2 sm:flex-row">
                    <div>
                      <div className="font-semibold text-purple-700">{entry.salesOrder?.orderNumber || 'Sales Order'}</div>
                      <div className="text-gray-500">{entry.mode === 'full' ? 'Full remaining conversion' : 'Available stock conversion'} · {formatNumber((entry.lines || []).reduce((sum, line) => sum + finiteNumber(line.quantity), 0))} units</div>
                      <div className="text-gray-500">Created by {entry.createdBy?.name || entry.createdBy?.email || '—'} · {formatDate(entry.createdAt, true)}</div>
                    </div>
                    <div className="sm:text-right">
                      <Tag color={entry.status === 'voided' || entry.salesOrder?.status === 'cancelled' ? 'red' : 'purple'}>{entry.status === 'voided' ? 'demand reopened' : (entry.salesOrder?.status || 'created')}</Tag>
                      <div className="text-gray-500">Approval: {entry.salesOrder?.approvalStatus || '—'} · Reservation: {entry.salesOrder?.reservationStatus || '—'}</div>
                      <div className="font-semibold text-slate-800">Order total {formatMoney(entry.salesOrder?.grandTotal)}</div>
                    </div>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 border-t border-purple-100 pt-2 sm:grid-cols-2">
                    {(entry.lines || []).map((line, index) => <div key={line._id || index} className="text-gray-600">Line {index + 1}: {formatNumber(line.quantity)} · {line.shade || 'No shade'} · {line.batch || 'No batch'}</div>)}
                  </div>
                  {entry.status === 'voided' && <Alert className="mt-2" type="warning" showIcon message={`Reversed by ${entry.reversedBy?.name || entry.reversedBy?.email || 'user'} on ${formatDate(entry.reversedAt, true)}`} description={entry.reversalReason || 'No reason recorded'} />}
                  {entry.status !== 'voided' && (entry.salesOrder?.status === 'cancelled' || entry.salesOrder?.approvalStatus === 'rejected') && (
                    <Button size="small" type="link" danger className="px-0 mt-1" onClick={() => {
                      let reason = '';
                      Modal.confirm({
                        title: 'Reopen quotation demand?',
                        content: <Input.TextArea className="mt-3" placeholder="Required audit reason" onChange={event => { reason = event.target.value; }} />,
                        okText: 'Reopen Demand', okButtonProps: { danger: true },
                        onOk: async () => {
                          if (!reason.trim()) { message.error('A reversal reason is required.'); throw new Error('Reversal reason required'); }
                          const response = await salesService.reverseQuotationConversion(q._id, entry._id, { reason: reason.trim() });
                          message.success(response.message);
                          await loadQuotation();
                          onQuotationUpdated?.();
                        },
                      });
                    }}>Reopen Demand</Button>
                  )}
                </div>
              ))}
            </div> : <div className="text-xs text-slate-400 py-2">No conversion history</div>}
          </Card>

          <Card size="small" className="shadow-2xs border-slate-200" title={<span className="font-semibold text-slate-700"><CalendarOutlined className="mr-2" />Validity History ({(q.validityHistory || []).length})</span>}>
            {(q.validityHistory || []).length ? <div className="space-y-2">
              {[...(q.validityHistory || [])].reverse().map((entry, index) => (
                <div key={entry._id || index} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5 text-xs">
                  <div className="font-semibold text-slate-700">{formatCalendarDate(entry.previousValidUntil)} → {formatCalendarDate(entry.newValidUntil)} <Tag color={entry.requeued ? 'blue' : 'default'} className="m-0 ml-1 text-[10px]">{entry.requeued ? 'FIFO requeued' : 'updated'}</Tag></div>
                  <div className="mt-1 text-slate-600">{entry.reason || 'No reason recorded'}</div>
                  <div className="mt-1 text-slate-400">{entry.changedBy?.name || entry.changedBy?.email || 'Unknown user'} · {formatDate(entry.changedAt, true)}</div>
                </div>
              ))}
            </div> : <div className="text-xs text-slate-400 py-2">No validity changes</div>}
          </Card>
        </div>
      </div>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="header">
            <div><div className="co-name">BDM TILES</div><div className="co-sub">Tiles &amp; Sanitary Ware Distributors</div></div>
            <div><div className="qt-title">QUOTATION</div>
              <div className="qt-meta"><div><strong>{q.quotationNumber}</strong></div>
                <div>Date: {formatCalendarDate(q.quotationDate)}</div>
                <div>Valid Until (inclusive): {formatCalendarDate(q.validUntil)}</div></div></div>
          </div>
          <div className="info-row">
            <div className="info-box"><div className="lbl">To</div>
              <div className="val">{q.dealerName || q.customerName}</div>
              <div style={{fontSize:'10px',color:'#666'}}>{q.dealerCode || q.customerPhone}</div></div>
            <div className="info-box"><div className="lbl">Quotation No.</div>
              <div className="val">{q.quotationNumber}</div></div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>GST%</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
            <tbody>{q.items?.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td style={{display:'flex',alignItems:'center',gap:'6px'}}>{item.productImage && <img src={getImageUrl(item.productImage)} style={{width:'24px',height:'24px',borderRadius:'3px',objectFit:'cover'}} />}<div><strong>{item.productName}</strong>{item.shade ? ` (${item.shade})` : ''}</div></td>
                <td>{item.quantity} {item.unit}</td>
                <td>{formatMoney(item.rate)}</td>
                <td>{formatNumber(item.gstPercentage)}%</td>
                <td style={{textAlign:'right'}}><strong>{formatMoney(item.totalAmount)}</strong></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="totals">
            <div className="row"><span>Subtotal</span><span>{formatMoney(q.subtotal)}</span></div>
            <div className="row"><span>GST</span><span>{formatMoney(q.totalTax)}</span></div>
            {finiteNumber(q.freightCharges) > 0 && <div className="row"><span>Freight</span><span>{formatMoney(q.freightCharges)}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>{formatMoney(q.grandTotal)}</span></div>
          </div>
          {q.termsAndConditions && <div className="terms"><strong>Terms &amp; Conditions:</strong> {q.termsAndConditions}</div>}
          <div className="footer">
            <div className="sign-line">Prepared By</div>
            <div className="sign-line">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </Modal>

    <Modal
      title="Edit quotation validity"
      open={validityEditorOpen}
      onCancel={() => !savingValidity && setValidityEditorOpen(false)}
      onOk={saveValidity}
      okText="Update Validity"
      confirmLoading={savingValidity}
      destroyOnHidden
    >
      <Alert
        className="mb-4"
        type={isExpired ? 'warning' : 'info'}
        showIcon
        message={isExpired ? 'This quotation is expired' : 'Validity dates are inclusive'}
        description={isExpired && ['approved', 'accepted'].includes(q.status)
          ? 'Extending an expired conversion-eligible quotation requeues its remaining demand behind currently valid FIFO demand.'
          : 'The quotation remains valid through the end of the selected business date.'}
      />
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs text-gray-500">Valid through *</label>
          <DatePicker
            value={validityDate}
            format="DD MMM YYYY"
            allowClear={false}
            presets={validityPresets()}
            className="w-full"
            disabledDate={(date) => {
              const quotationDay = calendarDay(q.quotationDate);
              const beforeQuotation = quotationDay && date.startOf('day').isBefore(quotationDay);
              const invalidForPartial = q.conversionState === 'partial' && !date.endOf('day').isAfter(dayjs());
              return Boolean(beforeQuotation || invalidForPartial);
            }}
            onChange={value => value && setValidityDate(value.startOf('day'))}
          />
          <div className="mt-1 text-[10px] text-gray-400">Presets extend from today by 7, 15, 30, 45, 60 or 90 days.</div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-gray-500">Reason *</label>
          <Input.TextArea value={validityReason} maxLength={1000} showCount rows={4} onChange={event => setValidityReason(event.target.value)} placeholder="Required audit reason for this validity change" />
        </div>
      </div>
    </Modal>
    </>
  );
};

export default QuotationManager;
