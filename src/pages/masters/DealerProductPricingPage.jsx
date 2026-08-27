import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Form, Input,
  InputNumber, Modal, Popconfirm, Radio, Row, Select, Space, Statistic, Switch,
  Table, Tabs, Tag, Tooltip, message,
} from 'antd';
import {
  CheckCircleOutlined, DeleteOutlined, EditOutlined, HistoryOutlined,
  PercentageOutlined, PlayCircleOutlined, ReloadOutlined, SearchOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import dealerPricingService from '../../services/dealerPricingService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';

const RATE_METHODS = [
  { value: 'percentage', label: 'Percentage discount' },
  { value: 'flat', label: 'Flat discount' },
  { value: 'fixed', label: 'Fixed rate' },
];
const CHANGE_TYPES = [
  { value: 'increase_percent', label: 'Increase by %' },
  { value: 'decrease_percent', label: 'Decrease by %' },
  { value: 'increase_flat', label: 'Increase by flat amount' },
  { value: 'decrease_flat', label: 'Decrease by flat amount' },
  { value: 'set_value', label: 'Set exact value' },
];
const SCOPE_OPTIONS = [
  { value: 'dealer_type', label: 'Dealer Type' },
  { value: 'dealer', label: 'Individual Dealer' },
  { value: 'walk_in', label: 'Walk-in Retail' },
];

const idOf = (value) => value?._id || value || undefined;
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateText = (value) => value ? dayjs(value).format('DD MMM YYYY') : '—';
const listOf = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  return response?.data?.rows || response?.data?.items || response?.data?.results || [];
};
const paginationOf = (response, page, limit) => {
  const source = response?.pagination || response?.data?.pagination || {};
  return {
    current: source.currentPage || source.page || page,
    pageSize: source.pageSize || source.itemsPerPage || source.limit || limit,
    total: source.totalItems || source.total || 0,
  };
};
const activeType = (item) => item?.isActive !== false && item?.status !== 'inactive';
const rowProduct = (row) => row.product && typeof row.product === 'object' ? row.product : row;
const rowProductId = (row) => idOf(row.product) || row.productId || row._id;
const rowOverride = (row) => {
  const override = row.override || row.targetOverride || row.applicableOverride;
  return override && typeof override === 'object' ? override : null;
};
const normalizeCatalogRow = (row) => ({
  ...row,
  override: row.override || row.targetOverride || row.applicableOverride || null,
  effectiveRate: row.effectiveRate ?? row.finalEffectiveRate ?? row.rate,
  belowMinimum: Boolean(row.belowMinimum ?? row.minimumWarning),
});
const pricingSnapshotText = (snapshot) => {
  if (!snapshot) return 'Tier rate';
  if (snapshot.isActive === false) return 'Inactive';
  if (snapshot.customRate != null) return money(snapshot.customRate);
  if (Number(snapshot.discountPercent || 0) > 0) return `${snapshot.discountPercent}% off tier`;
  if (Number(snapshot.discountFlat || 0) > 0) return `${money(snapshot.discountFlat)} off tier`;
  return 'Tier rate';
};

const DealerProductPricingPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialScope = SCOPE_OPTIONS.some((option) => option.value === searchParams.get('scope'))
    ? searchParams.get('scope') : 'dealer_type';
  const [scope, setScope] = useState(initialScope);
  const [dealerTypes, setDealerTypes] = useState([]);
  const [dealerType, setDealerType] = useState(searchParams.get('dealerType') || undefined);
  const [dealers, setDealers] = useState([]);
  const [dealer, setDealer] = useState(searchParams.get('dealer') || undefined);
  const [dealerSearch, setDealerSearch] = useState('');
  const [filters, setFilters] = useState({
    search: searchParams.get('product') || '', brand: undefined, category: undefined,
    subcategory: undefined, quantity: 1,
  });
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });
  const [rows, setRows] = useState([]);
  const [selectedProductIds, setSelectedProductIds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 24, total: 0 });
  const [activeTab, setActiveTab] = useState('pricing');
  const [editRow, setEditRow] = useState(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm] = Form.useForm();
  const editMethod = Form.useWatch('method', editForm);

  const [bulkForm] = Form.useForm();
  const [bulkPreview, setBulkPreview] = useState([]);
  const [bulkSummary, setBulkSummary] = useState({});
  const [previewing, setPreviewing] = useState(false);
  const [applying, setApplying] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [confirmedBulkPayload, setConfirmedBulkPayload] = useState(null);
  const catalogRequest = useRef(0);
  const applyImmediately = Form.useWatch('applyImmediately', bulkForm);

  const [schedules, setSchedules] = useState([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [schedulePagination, setSchedulePagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPagination, setHistoryPagination] = useState({ current: 1, pageSize: 25, total: 0 });

  const target = useMemo(() => ({
    scope,
    ...(scope === 'dealer_type' && dealerType ? { dealerType } : {}),
    ...(scope === 'dealer' && dealer ? { dealer } : {}),
  }), [scope, dealerType, dealer]);
  const targetReady = scope === 'walk_in' || (scope === 'dealer_type' ? Boolean(dealerType) : Boolean(dealer));
  const selectedDealer = dealers.find((item) => item._id === dealer);
  const selectedType = dealerTypes.find((item) => item._id === dealerType);
  const targetLabel = scope === 'walk_in'
    ? 'Walk-in Retail'
    : scope === 'dealer_type'
      ? selectedType?.name || 'Select a Dealer Type'
      : selectedDealer?.businessName || 'Select an Individual Dealer';
  const targetTier = scope === 'walk_in'
    ? 'retailRate'
    : scope === 'dealer_type'
      ? selectedType?.pricingTier
      : selectedDealer?.dealerType?.pricingTier;

  useEffect(() => {
    Promise.all([
      masterService.getDealerTypes({ limit: 200 }),
      productService.getFilterOptions(),
    ]).then(([typesResponse, filtersResponse]) => {
      if (typesResponse.success) {
        const types = (typesResponse.data || []).filter(activeType);
        setDealerTypes(types);
        setDealerType((current) => current || types[0]?._id);
      }
      if (filtersResponse.success) setFilterOptions(filtersResponse.data || { brands: [], categories: [], subcategories: [] });
    }).catch((error) => message.error(error.message || 'Failed to load pricing filters'));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      masterService.getDealers({ limit: 100, status: 'active', search: dealerSearch || undefined })
        .then((response) => { if (response.success) setDealers(response.data || []); })
        .catch(() => {});
    }, dealerSearch ? 250 : 0);
    return () => clearTimeout(timer);
  }, [dealerSearch]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('scope', scope);
    if (dealerType && scope === 'dealer_type') params.set('dealerType', dealerType);
    if (dealer && scope === 'dealer') params.set('dealer', dealer);
    if (filters.search) params.set('product', filters.search);
    setSearchParams(params, { replace: true });
  }, [scope, dealerType, dealer, filters.search, setSearchParams]);

  const catalogParams = useCallback((page = pagination.current, limit = pagination.pageSize) => ({
    ...target,
    search: filters.search || undefined,
    brand: filters.brand,
    category: filters.category,
    subcategory: filters.subcategory,
    quantity: filters.quantity || 1,
    page,
    limit,
  }), [target, filters, pagination.current, pagination.pageSize]);

  const loadCatalog = useCallback(async (page = 1, limit = pagination.pageSize) => {
    if (!targetReady) { setRows([]); setPagination((current) => ({ ...current, current: 1, total: 0 })); return; }
    const requestId = ++catalogRequest.current;
    setLoading(true);
    try {
      const response = await dealerPricingService.getCatalog(catalogParams(page, limit));
      if (requestId !== catalogRequest.current) return;
      if (response.success) {
        setRows(listOf(response).map(normalizeCatalogRow));
        setPagination(paginationOf(response, page, limit));
        setSelectedProductIds([]);
      }
    } catch (error) {
      if (requestId === catalogRequest.current) message.error(error.message || 'Failed to load pricing catalog');
    }
    finally { if (requestId === catalogRequest.current) setLoading(false); }
  }, [targetReady, catalogParams, pagination.pageSize]);

  useEffect(() => {
    if (activeTab !== 'pricing' && activeTab !== 'bulk' && activeTab !== 'history') return undefined;
    const timer = setTimeout(() => loadCatalog(1, pagination.pageSize), filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [scope, dealerType, dealer, filters, activeTab]);

  const loadSchedules = useCallback(async (page = 1, limit = schedulePagination.pageSize) => {
    setScheduleLoading(true);
    try {
      const response = await dealerPricingService.getSchedules({ ...target, page, limit });
      if (response.success) {
        setSchedules(listOf(response));
        setSchedulePagination(paginationOf(response, page, limit));
      }
    } catch (error) { message.error(error.message || 'Failed to load scheduled changes'); }
    finally { setScheduleLoading(false); }
  }, [target, schedulePagination.pageSize]);

  const loadHistory = useCallback(async (page = 1, limit = historyPagination.pageSize) => {
    setHistoryLoading(true);
    try {
      const response = await dealerPricingService.getHistory({ ...target, page, limit });
      if (response.success) {
        setHistory(listOf(response));
        setHistoryPagination(paginationOf(response, page, limit));
      }
    } catch (error) { message.error(error.message || 'Failed to load pricing history'); }
    finally { setHistoryLoading(false); }
  }, [target, historyPagination.pageSize]);

  useEffect(() => {
    if (activeTab === 'schedules') loadSchedules();
    if (activeTab === 'history') loadHistory(1, historyPagination.pageSize);
  }, [activeTab, target]);

  const resetFilters = () => setFilters({ search: '', brand: undefined, category: undefined, subcategory: undefined, quantity: 1 });
  const changeScope = (nextScope) => {
    catalogRequest.current += 1;
    setLoading(false);
    setScope(nextScope);
    setRows([]);
    setSelectedProductIds([]);
    setBulkPreview([]);
    setConfirmedBulkPayload(null);
  };

  const openEdit = (row) => {
    const override = rowOverride(row) || {};
    const method = override.customRate != null ? 'fixed' : Number(override.discountFlat || 0) > 0 ? 'flat' : 'percentage';
    setEditRow(row);
    editForm.resetFields();
    editForm.setFieldsValue({
      method,
      value: method === 'fixed' ? override.customRate : method === 'flat' ? override.discountFlat : override.discountPercent || 0,
      schemeDiscount: override.schemeDiscount || 0,
      minQty: override.minQty || 0,
      slabs: override.slabs || [],
      validFrom: override.validFrom ? dayjs(override.validFrom) : null,
      validTo: override.validTo ? dayjs(override.validTo) : null,
      remarks: override.remarks || '',
      reason: '',
      isActive: override.isActive !== false,
    });
    setEditOpen(true);
  };

  const validateSlabs = (slabs = []) => {
    const ordered = [...slabs].sort((a, b) => Number(a.minQty || 0) - Number(b.minQty || 0));
    for (let index = 0; index < ordered.length; index += 1) {
      const slab = ordered[index];
      const min = Number(slab.minQty || 0);
      const max = Number(slab.maxQty || 0);
      if (max > 0 && max < min) throw new Error('Each slab maximum must be at least its minimum');
      if (index > 0) {
        const previousMax = Number(ordered[index - 1].maxQty || 0);
        if (previousMax === 0 || min <= previousMax) throw new Error('Quantity slabs cannot overlap');
      }
    }
    return ordered;
  };

  const saveOverride = async () => {
    try {
      const values = await editForm.validateFields();
      const slabs = validateSlabs(values.slabs || []);
      setSaving(true);
      const product = rowProduct(editRow);
      const override = rowOverride(editRow);
      const payload = {
        ...target,
        target,
        product: rowProductId(editRow),
        productCode: product.productCode || editRow.productCode,
        productName: product.itemName || editRow.productName,
        customRate: values.method === 'fixed' ? Number(values.value) : null,
        discountPercent: values.method === 'percentage' ? Number(values.value || 0) : 0,
        discountFlat: values.method === 'flat' ? Number(values.value || 0) : 0,
        schemeDiscount: Number(values.schemeDiscount || 0),
        minQty: Number(values.minQty || 0),
        slabs: slabs.map((slab) => ({
          minQty: Number(slab.minQty || 0), maxQty: Number(slab.maxQty || 0),
          rate: Number(slab.rate || 0), discountPercent: Number(slab.discountPercent || 0),
        })),
        validFrom: values.validFrom?.startOf('day').toISOString() || undefined,
        validTo: values.validTo?.endOf('day').toISOString() || null,
        remarks: values.remarks || '',
        reason: values.reason.trim(),
        isActive: values.isActive !== false,
      };
      const response = override?._id
        ? await dealerPricingService.update(override._id, payload)
        : await dealerPricingService.create(payload);
      if (response.success) {
        message.success(override?._id ? 'Pricing override updated' : 'Pricing override created');
        setEditOpen(false);
        loadCatalog(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save pricing override');
    } finally { setSaving(false); }
  };

  const removeOverride = async (row) => {
    try {
      const response = await dealerPricingService.remove(rowOverride(row)._id);
      if (response.success) { message.success('Pricing override removed'); loadCatalog(pagination.current, pagination.pageSize); }
    } catch (error) { message.error(error.message || 'Failed to remove pricing override'); }
  };

  const buildBulkPayload = async () => {
    const values = await bulkForm.validateFields();
    const filtersPayload = { search: filters.search || undefined, brand: filters.brand, category: filters.category, subcategory: filters.subcategory };
    const validity = values.validity?.length === 2 ? {
      from: values.validity[0].startOf('day').toISOString(),
      to: values.validity[1].endOf('day').toISOString(),
    } : undefined;
    const effectiveDate = values.applyImmediately !== false ? undefined : values.effectiveDate?.startOf('day').toISOString();
    return {
      target,
      ...target,
      ...(selectedProductIds.length ? { productIds: selectedProductIds } : { filters: filtersPayload, ...filtersPayload }),
      changeType: values.changeType,
      changeValue: Number(values.changeValue || 0),
      quantity: Number(values.quantity || filters.quantity || 1),
      reason: values.reason.trim(),
      notes: values.notes || '',
      applyImmediately: values.applyImmediately !== false,
      effectiveDate,
      applyAt: effectiveDate,
      validity,
      validFrom: validity?.from,
      validTo: validity?.to,
    };
  };

  const previewBulk = async () => {
    if (!targetReady) { message.warning('Select a pricing target first'); return; }
    setPreviewing(true);
    try {
      const payload = await buildBulkPayload();
      const response = await dealerPricingService.previewBulk(payload);
      if (response.success) {
        const previewRows = listOf(response);
        setBulkPreview(previewRows);
        setBulkSummary(response.data?.summary || response.summary || {});
        const exactIds = previewRows.map(rowProductId).filter(Boolean);
        setConfirmedBulkPayload({
          ...payload,
          ...(exactIds.length ? { productIds: exactIds, filters: undefined } : {}),
          expectedRates: previewRows.map((row) => ({
            product: rowProductId(row), oldRate: row.oldRate, newRate: row.newRate,
          })),
        });
        if (!previewRows.length) message.info('No products match the selected target and filters');
        else setConfirmBulk(true);
      }
    } catch (error) {
      const validationResponse = error.response?.data;
      const validationRows = listOf(validationResponse);
      if (validationRows.length) {
        const payload = await buildBulkPayload();
        setBulkPreview(validationRows);
        setBulkSummary(validationResponse?.data?.summary || validationResponse?.summary || {});
        const exactIds = validationRows.map(rowProductId).filter(Boolean);
        setConfirmedBulkPayload({
          ...payload,
          ...(exactIds.length ? { productIds: exactIds, filters: undefined } : {}),
          expectedRates: validationRows.map((row) => ({
            product: rowProductId(row), oldRate: row.oldRate, newRate: row.newRate,
          })),
        });
        setConfirmBulk(true);
      } else if (!error.errorFields) message.error(error.message || 'Bulk preview failed');
    } finally { setPreviewing(false); }
  };

  const applyBulk = async () => {
    setApplying(true);
    try {
      const payload = confirmedBulkPayload || await buildBulkPayload();
      const response = await dealerPricingService.applyBulk(payload);
      if (response.success) {
        message.success(response.message || (payload.applyImmediately ? 'Bulk pricing applied' : 'Pricing change scheduled'));
        setConfirmBulk(false);
        setBulkPreview([]);
        setConfirmedBulkPayload(null);
        setSelectedProductIds([]);
        loadCatalog(1, pagination.pageSize);
        if (!payload.applyImmediately) loadSchedules();
      }
    } catch (error) { message.error(error.message || 'Bulk pricing update failed'); }
    finally { setApplying(false); }
  };

  const cancelSchedule = async (id) => {
    try {
      const response = await dealerPricingService.cancelSchedule(id);
      if (response.success) { message.success('Scheduled change cancelled'); loadSchedules(); }
    } catch (error) { message.error(error.message || 'Failed to cancel schedule'); }
  };

  const runDueSchedules = async () => {
    setScheduleLoading(true);
    try {
      const response = await dealerPricingService.applyDueSchedules();
      if (response.success) { message.success(response.message || 'Due schedules applied'); loadSchedules(); }
    } catch (error) { message.error(error.message || 'Failed to apply due schedules'); setScheduleLoading(false); }
  };

  const pricingColumns = [
    {
      title: 'Product', width: 260, fixed: 'left', render: (_, row) => {
        const product = rowProduct(row);
        return <div><div className="font-semibold text-sm">{product.itemName || row.productName || '—'}</div><div className="text-[11px] text-gray-400">{product.productCode || row.productCode || ''} · {product.brand?.name || row.brand?.name || ''}</div><div className="text-[10px] text-gray-400">{product.category?.name || row.category?.name || ''}{product.subcategory?.name || row.subcategory?.name ? ` → ${product.subcategory?.name || row.subcategory?.name}` : ''}</div></div>;
      },
    },
    { title: 'Configured tier / base', width: 170, render: (_, row) => <div><div className="font-medium">{money(row.configuredRate ?? row.tierRate ?? row.baseRate)}</div><div className="text-[10px] text-gray-400">{row.rateField || targetTier || 'Base rate'} · Base {money(row.baseRate)}</div></div> },
    { title: 'Override', width: 150, render: (_, row) => {
      const override = rowOverride(row);
      if (!override) return <Tag>None</Tag>;
      if (override.isActive === false) return <Tag color="red">Inactive</Tag>;
      if (override.customRate != null) return <Tag color="purple">Fixed {money(override.customRate)}</Tag>;
      if (override.discountPercent) return <Tag color="blue">{override.discountPercent}% off</Tag>;
      if (override.discountFlat) return <Tag color="cyan">{money(override.discountFlat)} off</Tag>;
      return <Tag color="default">Configured</Tag>;
    } },
    { title: 'Effective', width: 130, render: (_, row) => <div><span className={`font-bold ${row.belowMinimum ? 'text-red-600' : 'text-green-700'}`}>{money(row.effectiveRate)}</span><div className="text-[10px] text-gray-400">Qty {filters.quantity || 1}</div></div> },
    { title: 'Minimum sell', width: 115, render: (_, row) => <span className={row.belowMinimum ? 'font-semibold text-red-600' : ''}>{money(row.minimumSellingRate)}</span> },
    { title: 'Source / validation', width: 190, render: (_, row) => <div><Tag color={rowOverride(row) ? 'purple' : 'blue'}>{row.source || 'Configured tier'}</Tag>{row.belowMinimum && <div className="text-[11px] text-red-600 mt-1"><WarningOutlined /> Below minimum</div>}</div> },
    { title: 'Validity', width: 160, render: (_, row) => { const override = rowOverride(row); return <span className="text-xs">{override ? `${dateText(override.validFrom)} – ${override.validTo ? dateText(override.validTo) : 'No expiry'}` : 'Inherited / ongoing'}</span>; } },
    { title: 'Actions', width: 100, fixed: 'right', render: (_, row) => <Space><Tooltip title="Configure override"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} /></Tooltip>{rowOverride(row)?._id && <Popconfirm title="Remove this override?" onConfirm={() => removeOverride(row)}><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Popconfirm>}</Space> },
  ];

  const bulkColumns = [
    { title: 'Product', width: 240, render: (_, row) => <div><div className="font-medium">{row.productName || row.product?.itemName || row.itemName || '—'}</div><div className="text-xs text-gray-400">{row.productCode || row.product?.productCode || ''}</div></div> },
    { title: 'Old rate', width: 110, render: (_, row) => money(row.oldRate ?? row.effectiveRate ?? row.currentRate) },
    { title: 'New rate', width: 110, render: (_, row) => <strong className={row.belowMinimum ? 'text-red-600' : 'text-green-700'}>{money(row.newRate ?? row.proposedRate)}</strong> },
    { title: 'Minimum', width: 110, render: (_, row) => money(row.minimumSellingRate) },
    { title: 'Validation', width: 170, render: (_, row) => row.belowMinimum ? <Tag color="red"><WarningOutlined /> Below minimum</Tag> : <Tag color="green"><CheckCircleOutlined /> Valid</Tag> },
  ];

  const historyColumns = [
    { title: 'When', width: 145, render: (_, row) => <span className="text-xs">{dateText(row.createdAt || row.changedAt || row.appliedAt)}</span> },
    { title: 'Product', width: 220, render: (_, row) => <div><div className="font-medium text-sm">{row.productName || row.product?.itemName || 'Bulk operation'}</div><div className="text-xs text-gray-400">{row.productCode || row.product?.productCode || ''}</div></div> },
    { title: 'Change', width: 190, render: (_, row) => <span>{row.changeType || row.action || 'Updated'} {row.changeValue != null ? `(${row.changeValue})` : ''}</span> },
    { title: 'Old → New', width: 210, render: (_, row) => <span>{pricingSnapshotText(row.before)} → <strong>{pricingSnapshotText(row.after)}</strong></span> },
    { title: 'Reason / notes', width: 240, render: (_, row) => <div><div>{row.reason || '—'}</div><div className="text-xs text-gray-400">{row.notes || row.remarks || ''}</div></div> },
    { title: 'Changed by', width: 150, render: (_, row) => row.performedBy?.name || row.changedBy?.name || row.createdBy?.name || row.userName || 'System' },
  ];

  const schedulesColumns = [
    { title: 'Effective date', width: 140, render: (_, row) => dateText(row.applyAt || row.effectiveDate || row.scheduledFor) },
    { title: 'Target', width: 180, render: (_, row) => row.targetLabel || row.dealerType?.name || row.dealer?.businessName || (row.scope === 'walk_in' ? 'Walk-in Retail' : row.scope) || targetLabel },
    { title: 'Change', width: 180, render: (_, row) => `${row.changeType || '—'} ${row.changeValue ?? ''}` },
    { title: 'Products', width: 100, render: (_, row) => row.affectedCount ?? row.products?.length ?? row.productIds?.length ?? row.productsCount ?? 0 },
    { title: 'Reason', width: 220, render: (_, row) => <div>{row.reason || '—'}<div className="text-xs text-gray-400">{row.notes || ''}</div></div> },
    { title: 'Status', width: 100, render: (_, row) => <Tag color={row.status === 'applied' ? 'green' : row.status === 'cancelled' ? 'red' : row.status === 'failed' ? 'volcano' : 'blue'}>{row.status || 'pending'}</Tag> },
    { title: 'Action', width: 90, render: (_, row) => row.status === 'pending' ? <Popconfirm title="Cancel this scheduled change?" onConfirm={() => cancelSchedule(row._id)}><Button danger type="text" size="small">Cancel</Button></Popconfirm> : null },
  ];

  const pricingGrid = (
    <Table
      rowKey={(row) => rowProductId(row)} columns={pricingColumns} dataSource={rows}
      loading={loading} size="small" scroll={{ x: 1250 }}
      rowSelection={{ selectedRowKeys: selectedProductIds, onChange: setSelectedProductIds, preserveSelectedRowKeys: true }}
      pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['12', '24', '48', '96'], showTotal: (total) => `${total} products` }}
      onChange={(next) => loadCatalog(next.current, next.pageSize)}
      locale={{ emptyText: targetReady ? 'No active products match these filters.' : 'Select a pricing target to view products.' }}
    />
  );

  const targetSelector = (
    <Card size="small" className="mb-4">
      <Row gutter={[16, 12]} align="middle">
        <Col xs={24} lg={9}>
          <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Pricing target scope</div>
          <Radio.Group optionType="button" buttonStyle="solid" value={scope} onChange={(event) => changeScope(event.target.value)} options={SCOPE_OPTIONS} />
        </Col>
        {scope === 'dealer_type' && <Col xs={24} sm={12} lg={7}><div className="text-xs text-gray-500 mb-1">Active Dealer Type</div><Select className="w-full" value={dealerType} onChange={(value) => { catalogRequest.current += 1; setDealerType(value); }} showSearch optionFilterProp="label" options={dealerTypes.map((item) => ({ value: item._id, label: `${item.name} · ${item.pricingTier}` }))} placeholder="Select dealer type" /></Col>}
        {scope === 'dealer' && <Col xs={24} sm={12} lg={7}><div className="text-xs text-gray-500 mb-1">Search registered dealer</div><Select className="w-full" value={dealer} onChange={(value) => { catalogRequest.current += 1; setDealer(value); }} onSearch={setDealerSearch} showSearch filterOption={false} allowClear options={dealers.map((item) => ({ value: item._id, label: `${item.businessName} (${item.dealerCode || 'No code'})` }))} placeholder="Name, code, or phone" /></Col>}
        <Col xs={24} sm={12} lg={8}>
          <Alert type={targetReady ? 'info' : 'warning'} showIcon message={targetLabel} description={targetReady ? `Configured pricing tier: ${targetTier || 'Not configured'}` : 'Choose a target before viewing or changing prices.'} />
        </Col>
      </Row>
    </Card>
  );

  const filterBar = (
    <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-6 gap-2">
        <Input prefix={<SearchOutlined />} placeholder="Product name or code" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} allowClear />
        <Select placeholder="All brands" value={filters.brand} onChange={(value) => setFilters((current) => ({ ...current, brand: value, category: undefined, subcategory: undefined }))} allowClear showSearch optionFilterProp="label" options={(filterOptions.brands || []).map((item) => ({ value: item._id, label: item.name }))} />
        <Select placeholder="All categories" value={filters.category} onChange={(value) => setFilters((current) => ({ ...current, category: value, subcategory: undefined }))} allowClear showSearch optionFilterProp="label" options={(filterOptions.categories || []).filter((item) => !filters.brand || idOf(item.brand) === filters.brand).map((item) => ({ value: item._id, label: item.name }))} />
        <Select placeholder="All subcategories" value={filters.subcategory} onChange={(value) => setFilters((current) => ({ ...current, subcategory: value }))} allowClear showSearch optionFilterProp="label" options={(filterOptions.subcategories || []).filter((item) => !filters.category || idOf(item.category) === filters.category).map((item) => ({ value: item._id, label: item.name }))} />
        <InputNumber min={1} value={filters.quantity} onChange={(value) => setFilters((current) => ({ ...current, quantity: value || 1 }))} addonBefore="Qty" className="w-full" />
        <Space><Button onClick={resetFilters}>Clear</Button><Button icon={<ReloadOutlined />} onClick={() => loadCatalog(pagination.current, pagination.pageSize)} loading={loading}>Refresh</Button></Space>
      </div>
    </div>
  );

  const tabItems = [
    { key: 'pricing', label: 'Product Pricing', children: <>{filterBar}<div className="bg-white border border-gray-200 rounded-lg overflow-hidden">{pricingGrid}</div></> },
    { key: 'bulk', label: 'Bulk Operations', children: <Row gutter={[16, 16]}><Col xs={24} xl={8}><Card title="Prepare bulk change" size="small"><Form form={bulkForm} layout="vertical" initialValues={{ changeType: 'increase_percent', changeValue: 0, quantity: 1, applyImmediately: true }}><Form.Item name="changeType" label="Change type" rules={[{ required: true }]}><Select options={CHANGE_TYPES} /></Form.Item><Form.Item name="changeValue" label="Change value" rules={[{ required: true, message: 'Enter a change value' }]}><InputNumber min={0} className="w-full" prefix={Form.useWatch('changeType', bulkForm)?.includes('percent') ? undefined : '₹'} suffix={Form.useWatch('changeType', bulkForm)?.includes('percent') ? '%' : undefined} /></Form.Item><Form.Item name="quantity" label="Preview quantity"><InputNumber min={1} className="w-full" /></Form.Item><Form.Item name="reason" label="Reason" rules={[{ required: true, whitespace: true }]}><Input placeholder="Required audit reason" /></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea rows={2} /></Form.Item><Form.Item name="validity" label="Optional validity"><DatePicker.RangePicker className="w-full" /></Form.Item><Form.Item name="applyImmediately" label="Apply immediately" valuePropName="checked"><Switch /></Form.Item>{applyImmediately === false && <Form.Item name="effectiveDate" label="Effective date" rules={[{ required: true }]}><DatePicker className="w-full" disabledDate={(date) => !date || date.isBefore(dayjs().add(1, 'day'), 'day')} /></Form.Item>}<Alert className="mb-3" type="info" showIcon message={selectedProductIds.length ? `${selectedProductIds.length} selected product(s)` : 'All products matching current hierarchy filters'} /><Button type="primary" block icon={<SearchOutlined />} onClick={previewBulk} loading={previewing} disabled={!targetReady}>Preview exact changes</Button></Form></Card></Col><Col xs={24} xl={16}><Card title="Products in scope" size="small">{filterBar}{pricingGrid}</Card></Col></Row> },
    { key: 'schedules', label: 'Scheduled Changes', children: <Card size="small" title="Pending and completed schedules" extra={<Space><Button icon={<PlayCircleOutlined />} onClick={runDueSchedules} loading={scheduleLoading}>Apply due schedules</Button><Button icon={<ReloadOutlined />} onClick={loadSchedules}>Refresh</Button></Space>}><Table rowKey="_id" columns={schedulesColumns} dataSource={schedules} loading={scheduleLoading} size="small" scroll={{ x: 1050 }} pagination={{ ...schedulePagination, showSizeChanger: true }} onChange={(next) => loadSchedules(next.current, next.pageSize)} /></Card> },
    { key: 'history', label: 'Price History / Validation', children: <><Row gutter={[12, 12]} className="mb-3"><Col xs={24} md={8}><Card size="small"><Statistic title="Catalog validation warnings" value={rows.filter((row) => row.belowMinimum).length} valueStyle={{ color: rows.some((row) => row.belowMinimum) ? '#dc2626' : '#16a34a' }} prefix={<WarningOutlined />} /></Card></Col><Col xs={24} md={16}><Alert type={rows.some((row) => row.belowMinimum) ? 'warning' : 'success'} showIcon message={rows.some((row) => row.belowMinimum) ? 'Some effective prices are below minimum selling rate' : 'No minimum-rate violations on the loaded catalog page'} description="Validation uses the server-resolved effective rate for the selected target and quantity." /></Col></Row>{filterBar}{rows.some((row) => row.belowMinimum) && <Card size="small" title="Current validation warnings" className="mb-3"><Table rowKey={(row) => `warning-${rowProductId(row)}`} columns={pricingColumns.filter((column) => column.title !== 'Actions')} dataSource={rows.filter((row) => row.belowMinimum)} pagination={false} size="small" scroll={{ x: 1100 }} /></Card>}<Card size="small" title="Pricing change history" extra={<Button icon={<ReloadOutlined />} onClick={() => loadHistory(historyPagination.current, historyPagination.pageSize)}>Refresh</Button>}><Table rowKey={(row) => row._id || `${rowProductId(row)}-${row.createdAt}`} columns={historyColumns} dataSource={history} loading={historyLoading} size="small" scroll={{ x: 1150 }} pagination={{ ...historyPagination, showSizeChanger: true }} onChange={(next) => loadHistory(next.current, next.pageSize)} /></Card></> },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><PercentageOutlined className="text-orange-500" />Dealer Product Pricing</h1><p className="text-sm text-gray-500">Server-resolved product pricing for every configured Dealer Type, individual dealer, and walk-in retail.</p></div>
        <Tag color="blue" className="px-3 py-1">{targetLabel}{targetTier ? ` · ${targetTier}` : ''}</Tag>
      </div>
      {targetSelector}
      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      <Modal title={`Configure pricing · ${rowProduct(editRow || {}).itemName || editRow?.productName || ''}`} open={editOpen} onCancel={() => setEditOpen(false)} onOk={saveOverride} confirmLoading={saving} width={780} destroyOnHidden>
        <Descriptions size="small" bordered column={{ xs: 1, sm: 3 }} className="mb-4" items={[
          { key: 'target', label: 'Target', children: targetLabel },
          { key: 'tier', label: 'Tier / base', children: `${editRow?.rateField || targetTier || 'Base'} · ${money(editRow?.baseRate)}` },
          { key: 'effective', label: 'Current effective', children: money(editRow?.effectiveRate) },
        ]} />
        <Form form={editForm} layout="vertical">
          <Row gutter={12}><Col xs={24} md={8}><Form.Item name="method" label="Override method" rules={[{ required: true }]}><Select options={RATE_METHODS} /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="value" label={editMethod === 'fixed' ? 'Fixed rate' : editMethod === 'flat' ? 'Flat discount' : 'Discount percentage'} rules={[{ required: true }]}><InputNumber min={0} max={editMethod === 'percentage' ? 100 : undefined} prefix={editMethod === 'percentage' ? undefined : '₹'} suffix={editMethod === 'percentage' ? '%' : undefined} className="w-full" /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="schemeDiscount" label="Scheme discount"><InputNumber min={0} prefix="₹" className="w-full" /></Form.Item></Col></Row>
          <Row gutter={12}><Col xs={24} md={8}><Form.Item name="minQty" label="Minimum quantity"><InputNumber min={0} className="w-full" /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="validFrom" label="Valid from"><DatePicker className="w-full" /></Form.Item></Col><Col xs={24} md={8}><Form.Item name="validTo" label="Valid until" dependencies={['validFrom']} rules={[({ getFieldValue }) => ({ validator(_, value) { const from = getFieldValue('validFrom'); return !value || !from || !value.isBefore(from, 'day') ? Promise.resolve() : Promise.reject(new Error('Must be after Valid from')); } })]}><DatePicker className="w-full" /></Form.Item></Col></Row>
          <Divider orientation="left">Quantity slabs</Divider>
          <Form.List name="slabs">{(fields, { add, remove }) => <><Space className="mb-2"><Button size="small" onClick={() => add({ minQty: 1, maxQty: 0, rate: 0, discountPercent: 0 })}>Add slab</Button><span className="text-xs text-gray-400">Use either an exact rate or a discount percentage per slab.</span></Space>{fields.map(({ key, name, ...rest }) => <Row gutter={8} key={key} align="middle"><Col xs={12} md={5}><Form.Item {...rest} name={[name, 'minQty']} label="Min"><InputNumber min={1} className="w-full" /></Form.Item></Col><Col xs={12} md={5}><Form.Item {...rest} name={[name, 'maxQty']} label="Max (0 = none)"><InputNumber min={0} className="w-full" /></Form.Item></Col><Col xs={10} md={5}><Form.Item {...rest} name={[name, 'rate']} label="Rate"><InputNumber min={0} prefix="₹" className="w-full" /></Form.Item></Col><Col xs={10} md={5}><Form.Item {...rest} name={[name, 'discountPercent']} label="Discount %"><InputNumber min={0} max={100} className="w-full" /></Form.Item></Col><Col xs={4} md={4}><Button danger type="text" icon={<DeleteOutlined />} onClick={() => remove(name)} /></Col></Row>)}</>}</Form.List>
          <Form.Item name="reason" label="Audit reason" rules={[{ required: true, whitespace: true, message: 'Enter a fresh reason for this change' }]}><Input placeholder="Why is this pricing being changed?" /></Form.Item><Form.Item name="remarks" label="Pricing remarks"><Input.TextArea rows={2} /></Form.Item><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Confirm bulk pricing change" open={confirmBulk} onCancel={() => setConfirmBulk(false)} onOk={applyBulk} okText={applyImmediately === false ? 'Confirm schedule' : 'Confirm and apply'} confirmLoading={applying} width="min(1100px, 96vw)" destroyOnHidden>
        <Alert type={bulkPreview.some((row) => row.belowMinimum) ? 'warning' : 'info'} showIcon className="mb-3" message={`${bulkPreview.length} exact product row(s) will be affected`} description={`${bulkPreview.filter((row) => row.belowMinimum).length} row(s) are below minimum selling rate. Review every old/new rate before confirmation.`} />
        {Object.keys(bulkSummary).length > 0 && <Descriptions size="small" bordered className="mb-3" items={Object.entries(bulkSummary).slice(0, 6).map(([key, value]) => ({ key, label: key.replace(/([A-Z])/g, ' $1'), children: String(value) }))} />}
        <Table rowKey={(row) => rowProductId(row)} columns={bulkColumns} dataSource={bulkPreview} pagination={{ pageSize: 10 }} size="small" scroll={{ x: 760 }} />
      </Modal>
    </div>
  );
};

export default DealerProductPricingPage;
