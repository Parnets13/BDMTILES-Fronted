import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Card, Col, Divider, Empty, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Space, Table, Tag, message,
} from 'antd';
import {
  CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  ReloadOutlined, SendOutlined, ShoppingCartOutlined, SearchOutlined,
  FileSearchOutlined, ArrowRightOutlined, InboxOutlined,
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import InlineError from '../../components/InlineError.jsx';

const PRIORITY_COLORS = { low: 'default', normal: 'blue', high: 'orange', urgent: 'red' };

const STATUS_COLORS = {
  draft: 'default', submitted: 'blue', compared: 'purple', selected: 'green',
  po_created: 'geekblue', cancelled: 'red',
};

const emptyOffer = (pr) => ({
  key: `${Date.now()}-${Math.random()}`,
  supplier: '',
  items: (pr?.items || []).map(item => ({
    requisitionItem: item._id,
    product: item.product?._id || item.product,
    productCode: item.productCode,
    productName: item.productName,
    quantity: item.requiredQty,
    unit: item.unit || 'Box',
    masterPurchaseRate: Number(item.purchaseRate || 0),
    offeredRate: Number(item.purchaseRate || 0),
    discount: 0,
    schemeDiscount: 0,
    scheme: '',
    gstPercentage: item.gstPercentage ?? 18,
  })),
  freight: 0,
  loading: 0,
  insurance: 0,
  creditDays: 0,
  paymentTerms: '',
  promisedDeliveryDate: '',
  deliveryTimeline: '',
  remarks: '',
});

const toEditorOffer = offer => ({
  ...offer,
  key: offer._id || `${Date.now()}-${Math.random()}`,
  supplier: offer.supplier?._id || offer.supplier,
  promisedDeliveryDate: offer.promisedDeliveryDate?.slice?.(0, 10) || '',
  items: (offer.items || []).map(item => ({
    ...item,
    product: item.product?._id || item.product,
    requisitionItem: item.requisitionItem?._id || item.requisitionItem,
  })),
});

const offerPayload = offer => ({
  supplier: offer.supplier,
  items: offer.items.map(item => ({
    requisitionItem: item.requisitionItem,
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
    offeredRate: Number(item.offeredRate || 0),
    discount: Number(item.discount || 0),
    schemeDiscount: Number(item.schemeDiscount || 0),
    scheme: item.scheme || '',
    gstPercentage: Number(item.gstPercentage ?? 18),
  })),
  freight: Number(offer.freight || 0),
  loading: Number(offer.loading || 0),
  insurance: Number(offer.insurance || 0),
  creditDays: Number(offer.creditDays || 0),
  paymentTerms: offer.paymentTerms || '',
  promisedDeliveryDate: offer.promisedDeliveryDate || undefined,
  deliveryTimeline: offer.deliveryTimeline || '',
  remarks: offer.remarks || '',
});

const localOfferTotal = offer => {
  const lines = offer.items.reduce((sum, item) => {
    const base = Number(item.quantity || 0) * Number(item.offeredRate || 0);
    const taxable = Math.max(0, base - Number(item.discount || 0) - Number(item.schemeDiscount || 0));
    return sum + taxable + taxable * Number(item.gstPercentage || 0) / 100;
  }, 0);
  return lines + Number(offer.freight || 0) + Number(offer.loading || 0) + Number(offer.insurance || 0);
};

const SupplierQuotationPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('po.management');
  const canApprove = hasPermission('po.approve');
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('id');
  const requestedPR = searchParams.get('purchaseRequisition');
  const shouldCreate = searchParams.get('create') === '1';

  const [quotations, setQuotations] = useState([]);
  const [approvedPRs, setApprovedPRs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorPR, setEditorPR] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectOffer, setSelectOffer] = useState(null);
  const [selectionRemarks, setSelectionRemarks] = useState('');

  // PR picker modal (the "+ New Comparison" entry point)
  const [prPickerOpen, setPrPickerOpen] = useState(false);
  const [prSearch, setPrSearch] = useState('');
  const [prPriority, setPrPriority] = useState(undefined);
  const [prStarting, setPrStarting] = useState('');
  const [listSearch, setListSearch] = useState('');
  const [refError, setRefError] = useState(null);

  const showError = useCallback((err, fallback) => {
    const text = err?.message || fallback;
    setError(text);
    message.error(text);
  }, []);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await purchaseService.getSupplierQuotations({
        page, limit: pagination.pageSize, status,
        purchaseRequisition: requestedPR || undefined,
      });
      if (res.success) {
        setQuotations(res.data || []);
        setPagination(prev => ({ ...prev, current: res.pagination?.currentPage || page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { showError(err, 'Unable to load supplier quotations'); }
    finally { setLoading(false); }
  }, [pagination.pageSize, requestedPR, showError, status]);

  const loadDetail = useCallback(async (id) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await purchaseService.getSupplierQuotation(id);
      if (res.success) setDetail(res.data);
    } catch (err) { showError(err, 'Unable to load quotation comparison'); }
    finally { setActionLoading(false); }
  }, [showError]);

  const loadReferenceData = useCallback(async () => {
    if (!canManage) return;
    setRefError(null);
    try {
      const [prRes, supplierRes, warehouseRes] = await Promise.all([
        purchaseService.getPurchaseRequisitions({ status: 'approved', limit: 100 }),
        masterService.getSuppliers({ status: 'active', limit: 100 }),
        masterService.getWarehouses({ status: 'active', limit: 100 }),
      ]);
      if (prRes.success) setApprovedPRs(prRes.data || []);
      if (supplierRes.success) setSuppliers(supplierRes.data || []);
      if (warehouseRes.success) setWarehouses(warehouseRes.data || []);
    } catch (err) {
      setRefError(err);
      showError(err, 'Unable to load PRs, suppliers, or warehouses');
    }
  }, [canManage, showError]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => { loadReferenceData(); }, [loadReferenceData]);
  useEffect(() => { if (requestedId) loadDetail(requestedId); }, [loadDetail, requestedId]);
  useEffect(() => {
    if (!canManage || !shouldCreate || !requestedPR || editor) return;
    purchaseService.getPurchaseRequisition(requestedPR).then(res => {
      if (res.success) {
        const pr = res.data;
        setEditorPR(pr);
        setEditor({ purchaseRequisition: pr._id, warehouse: pr.warehouse?._id || pr.warehouse || '', offers: [emptyOffer(pr), emptyOffer(pr)] });
      }
    }).catch(err => showError(err, 'Unable to start supplier comparison'));
  }, [canManage, editor, requestedPR, shouldCreate, showError]);

  const startCreate = async (prId) => {
    if (!canManage || !prId) return;
    setPrStarting(prId);
    try {
      const res = await purchaseService.getPurchaseRequisition(prId);
      const pr = res.data;
      setEditorPR(pr);
      setDetail(null);
      setPrPickerOpen(false);
      setEditor({ purchaseRequisition: pr._id, warehouse: pr.warehouse?._id || pr.warehouse || '', offers: [emptyOffer(pr), emptyOffer(pr)] });
    } catch (err) { showError(err, 'Unable to load purchase requisition'); }
    finally { setPrStarting(''); }
  };

  // PRs that already have a supplier quotation should be surfaced but not duplicated.
  const quotedPRIds = useMemo(
    () => new Set(quotations.map(q => String(q.purchaseRequisition?._id || q.purchaseRequisition || q.prNumber))),
    [quotations],
  );
  const prPurchaseValue = pr => (pr.items || []).reduce(
    (sum, item) => sum + Number(item.purchaseRate || 0) * Number(item.requiredQty || 0), 0,
  );
  const filteredApprovedPRs = useMemo(() => {
    const term = prSearch.trim().toLowerCase();
    return approvedPRs.filter(pr => {
      if (prPriority && pr.priority !== prPriority) return false;
      if (!term) return true;
      return [pr.prNumber, pr.department, pr.warehouseName, pr.requestedByName]
        .some(value => String(value || '').toLowerCase().includes(term));
    });
  }, [approvedPRs, prSearch, prPriority]);

  const filteredQuotations = useMemo(() => {
    const term = listSearch.trim().toLowerCase();
    if (!term) return quotations;
    return quotations.filter(row => [row.quotationNumber, row.prNumber, row.purchaseRequisition?.prNumber, row.selectedSupplier?.companyName]
      .some(value => String(value || '').toLowerCase().includes(term)));
  }, [quotations, listSearch]);

  const stats = useMemo(() => {
    const base = { total: quotations.length, draft: 0, submitted: 0, compared: 0, selected: 0, po_created: 0 };
    for (const row of quotations) if (base[row.status] !== undefined) base[row.status] += 1;
    return base;
  }, [quotations]);

  const startEdit = () => {
    if (!canManage) return;
    const pr = detail.purchaseRequisition;
    setEditorPR(pr);
    setEditor({
      id: detail._id,
      purchaseRequisition: pr?._id || pr,
      warehouse: detail.warehouse?._id || detail.warehouse,
      offers: detail.offers.map(toEditorOffer),
    });
  };

  const updateOffer = (index, field, value) => setEditor(prev => ({
    ...prev,
    offers: prev.offers.map((offer, i) => i === index ? { ...offer, [field]: value } : offer),
  }));

  // Picking a supplier auto-fills its master credit terms (creditDays / paymentTerms),
  // while leaving values the user has already edited untouched.
  const selectSupplier = (index, supplierId) => {
    setEditor(prev => ({
      ...prev,
      offers: prev.offers.map((offer, i) => {
        if (i !== index) return offer;
        const supplier = suppliers.find(s => s._id === supplierId);
        return {
          ...offer,
          supplier: supplierId,
          creditDays: supplier ? Number(supplier.creditDays ?? offer.creditDays ?? 0) : offer.creditDays,
          paymentTerms: supplier?.paymentTerms || offer.paymentTerms || '',
        };
      }),
    }));
    if (supplierId) applyPurchaseDiscounts(index, supplierId);
  };

  // Auto-fetch the mapped supplier (purchase) discount per line and apply it as the
  // baseline. The buyer may still increase the discount (better for us) up to the
  // rule's floating max; we never force it below the mapped value.
  const applyPurchaseDiscounts = async (index, supplierId) => {
    const offer = editor?.offers?.[index];
    if (!offer) return;
    try {
      const results = await Promise.all(offer.items.map(async (item) => {
        if (!item.product) return null;
        const rate = Number(item.offeredRate || item.masterPurchaseRate || 0);
        const res = await salesService.calculatePurchaseDiscount(item.product, supplierId, rate);
        return res.success ? { key: item.requisitionItem, data: res.data } : null;
      }));
      const byKey = new Map(results.filter(Boolean).map(r => [r.key, r.data]));
      setEditor(prev => ({
        ...prev,
        offers: prev.offers.map((o, i) => i !== index ? o : {
          ...o,
          items: o.items.map(item => {
            const info = byKey.get(item.requisitionItem);
            if (!info?.hasDiscount) return item;
            const rate = Number(item.offeredRate || item.masterPurchaseRate || 0);
            const qty = Number(item.quantity || 0);
            const discountValue = Math.round((rate * qty * Number(info.discountPercentage || 0) / 100) * 100) / 100;
            return {
              ...item,
              discount: discountValue,
              mappedDiscountPct: Number(info.discountPercentage || 0),
              mappedDiscountMinPct: Number(info.minDiscountPercentage ?? info.discountPercentage ?? 0),
              mappedDiscountMaxPct: Number(info.maxDiscountPercentage ?? info.discountPercentage ?? 0),
            };
          }),
        }),
      }));
    } catch { /* discount is advisory; ignore fetch failure */ }
  };

  const updateOfferItem = (offerIndex, itemIndex, field, value) => setEditor(prev => ({
    ...prev,
    offers: prev.offers.map((offer, i) => i !== offerIndex ? offer : {
      ...offer,
      items: offer.items.map((item, j) => j === itemIndex ? { ...item, [field]: value } : item),
    }),
  }));

  const addOffer = () => setEditor(prev => ({ ...prev, offers: [...prev.offers, emptyOffer(editorPR)] }));
  const removeOffer = index => setEditor(prev => ({ ...prev, offers: prev.offers.filter((_, i) => i !== index) }));

  const saveDraft = async () => {
    setError('');
    if (!editor.warehouse) return showError(null, 'Select a receiving warehouse');
    if (editor.offers.length < 2) return showError(null, 'Add complete offers from at least two suppliers');
    if (editor.offers.some(offer => !offer.supplier)) return showError(null, 'Select a supplier for every offer');
    if (new Set(editor.offers.map(offer => offer.supplier)).size !== editor.offers.length) return showError(null, 'Each offer must use a different supplier');
    if (editor.offers.some(offer => offer.items.length !== (editorPR?.items?.length || 0))) return showError(null, 'Every supplier must quote every requisition item');
    setSaving(true);
    try {
      const payload = { purchaseRequisition: editor.purchaseRequisition, warehouse: editor.warehouse, offers: editor.offers.map(offerPayload) };
      const res = editor.id
        ? await purchaseService.updateSupplierQuotation(editor.id, payload)
        : await purchaseService.createSupplierQuotation(payload);
      if (res.success) {
        message.success(res.message || 'Supplier quotation draft saved');
        setEditor(null);
        await loadDetail(res.data._id);
        await load(1);
        navigate(`/sales-purchase/supplier-quotations?id=${res.data._id}`, { replace: true });
      }
    } catch (err) { showError(err, 'Unable to save supplier quotation'); }
    finally { setSaving(false); }
  };

  const runAction = async (action) => {
    if (!detail) return;
    if (action === 'submit' && (detail.offers?.length || 0) < 2) {
      return showError(null, 'At least two complete supplier offers are required before submission');
    }
    setActionLoading(true);
    setError('');
    try {
      let res;
      if (action === 'submit') res = await purchaseService.submitSupplierQuotation(detail._id);
      if (action === 'compare') res = await purchaseService.compareSupplierQuotation(detail._id);
      if (action === 'convert') res = await purchaseService.convertSupplierQuotationToPO(detail._id);
      if (res?.success) {
        message.success(res.message || 'Action completed');
        if (action === 'convert') {
          const poId = res.data?.po?._id;
          navigate(poId ? `/sales-purchase/po-management?po=${poId}` : '/sales-purchase/po-management');
          return;
        }
        await loadDetail(detail._id);
        await load(pagination.current);
      }
    } catch (err) { showError(err, 'Supplier quotation action failed'); }
    finally { setActionLoading(false); }
  };

  const confirmSupplier = async () => {
    setActionLoading(true);
    try {
      const res = await purchaseService.selectFinalSupplier(detail._id, { offerId: selectOffer.offer, remarks: selectionRemarks });
      if (res.success) {
        message.success('Final supplier selected');
        setSelectOffer(null);
        setSelectionRemarks('');
        await loadDetail(detail._id);
        await load(pagination.current);
      }
    } catch (err) { showError(err, 'Unable to select final supplier'); }
    finally { setActionLoading(false); }
  };

  const deleteDraft = async record => {
    try {
      const res = await purchaseService.deleteSupplierQuotation(record._id);
      if (res.success) {
        message.success('Supplier quotation deleted');
        if (detail?._id === record._id) setDetail(null);
        load(1);
      }
    } catch (err) { showError(err, 'Unable to delete draft'); }
  };

  const comparison = detail?.comparison || [];
  const selectedOfferId = String(detail?.selectedOffer || '');
  // Product Master purchase rate per product, resolved from the linked PR items,
  // used as the reference/benchmark against each supplier's offered rate.
  const masterRateByProduct = useMemo(() => {
    const map = new Map();
    for (const item of detail?.purchaseRequisition?.items || []) {
      map.set(String(item.product?._id || item.product), Number(item.purchaseRate || 0));
    }
    return map;
  }, [detail]);
  const supplierOptions = suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode || 'No code'})` }));
  const usedSuppliers = useMemo(() => new Set(editor?.offers?.map(offer => offer.supplier).filter(Boolean) || []), [editor]);
  const closeEditor = () => {
    if (!editor?.id && shouldCreate) navigate('/sales-purchase/supplier-quotations', { replace: true });
    setEditor(null);
  };

  const listColumns = [
    { title: 'Quotation', dataIndex: 'quotationNumber', render: value => <span className="font-mono text-xs font-semibold">{value}</span> },
    { title: 'PR', render: (_, row) => row.prNumber || row.purchaseRequisition?.prNumber || '—' },
    { title: 'Offers', render: (_, row) => <Tag>{row.offers?.length || 0} suppliers</Tag> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={STATUS_COLORS[value]}>{value?.replace(/_/g, ' ')}</Tag> },
    { title: 'Selected Supplier', render: (_, row) => row.selectedSupplier?.companyName || '—' },
    { title: 'Created', dataIndex: 'createdAt', render: value => value ? new Date(value).toLocaleDateString('en-IN') : '—' },
    { title: 'Actions', render: (_, row) => <Space>
      <Button size="small" icon={<EyeOutlined />} onClick={() => loadDetail(row._id)}>Open</Button>
      {canManage && row.status === 'draft' && <Popconfirm title="Delete this draft?" onConfirm={() => deleteDraft(row)}>
        <Button size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>}
    </Space> },
  ];

  return <div>
    <div className="flex justify-between items-start mb-5 gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
          <ShoppingCartOutlined className="text-purple-500 text-xl" />
          Supplier Quotation Comparison
        </h1>
        <p className="text-sm text-gray-500 mt-0.5">Capture complete supplier offers, compare landed costs, and select the final supplier</p>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(pagination.current)} />
        {canManage && <Button type="primary" icon={<PlusOutlined />}
          onClick={() => { setPrSearch(''); setPrPriority(undefined); setPrPickerOpen(true); }}
          style={{ background: '#FF5F03', borderColor: '#FF5F03' }} className="rounded-lg">
          New Comparison
        </Button>}
      </Space>
    </div>

    {error && <Alert className="mb-4" type="error" showIcon closable message={error} onClose={() => setError('')} />}

    <Row gutter={16} className="mb-5">
      {[
        ['Total', stats.total, '#1890ff'],
        ['Draft', stats.draft, '#8c8c8c'],
        ['In Comparison', stats.submitted + stats.compared, '#722ed1'],
        ['Selected', stats.selected, '#52c41a'],
        ['PO Created', stats.po_created, '#13c2c2'],
      ].map(([title, value, color]) => (
        <Col flex="1" key={title}>
          <Card size="small" style={{ borderLeft: `4px solid ${color}` }}>
            <div className="text-xs text-slate-400 font-medium">{title}</div>
            <div className="text-xl font-bold" style={{ color }}>{value}</div>
          </Card>
        </Col>
      ))}
    </Row>

    <Card size="small" className="mb-4">
      <div className="flex gap-3 flex-wrap items-center">
        <Input allowClear prefix={<SearchOutlined className="text-gray-300" />} placeholder="Search quotation, PR, supplier…"
          value={listSearch} onChange={e => setListSearch(e.target.value)} className="max-w-xs" />
        <Select placeholder="Status" allowClear className="w-44" value={status} onChange={setStatus}
          options={Object.keys(STATUS_COLORS).map(value => ({ value, label: value.replace(/_/g, ' ') }))} />
        {requestedPR && <Tag color="blue" closable onClose={() => navigate('/sales-purchase/supplier-quotations', { replace: true })}>Filtered by PR</Tag>}
      </div>
    </Card>

    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table columns={listColumns} dataSource={filteredQuotations} rowKey="_id" loading={loading} size="small"
        locale={{ emptyText: canManage ? 'No supplier quotations yet. Click “New Comparison” to start.' : 'No supplier quotations.' }}
        pagination={{ ...pagination, onChange: (page, pageSize) => { setPagination(prev => ({ ...prev, pageSize })); load(page); } }} />
    </div>

    {/* PR Picker Modal — choose an approved PR directly or via filter */}
    <Modal
      title={
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF5F03] font-bold border border-orange-100 shadow-2xs">
            <FileSearchOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0">Start New Comparison</h2>
            <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">Select an approved purchase requisition to gather supplier offers</p>
          </div>
        </div>
      }
      open={prPickerOpen}
      onCancel={() => setPrPickerOpen(false)}
      width="min(1000px, calc(100vw - 32px))"
      style={{ top: 24 }}
      footer={[<Button key="close" onClick={() => setPrPickerOpen(false)} className="rounded-lg">Close</Button>]}
      destroyOnHidden
    >
      <div className="space-y-4 py-1">
        <InlineError error={refError} onRetry={loadReferenceData} />
        <div className="flex gap-3 flex-wrap items-center">
          <Input allowClear prefix={<SearchOutlined className="text-gray-300" />} size="large"
            placeholder="Search PR number, department, warehouse…" value={prSearch}
            onChange={e => setPrSearch(e.target.value)} className="flex-1 min-w-[220px] rounded-lg" />
          <Select size="large" placeholder="Priority" allowClear className="w-40" value={prPriority} onChange={setPrPriority}
            options={['low', 'normal', 'high', 'urgent'].map(p => ({ value: p, label: p.toUpperCase() }))} />
        </div>
        <div className="max-h-[calc(100vh-320px)] overflow-y-auto border border-slate-200/80 rounded-xl">
          {filteredApprovedPRs.length === 0 ? (
            <Empty className="py-10" image={<InboxOutlined className="text-4xl text-slate-300" />}
              description={approvedPRs.length ? 'No approved PRs match your filter' : 'No approved purchase requisitions available'} />
          ) : (
            <Table
              size="small" pagination={false} rowKey="_id" dataSource={filteredApprovedPRs}
              rowClassName="cursor-pointer"
              onRow={record => ({ onClick: () => quotedPRIds.has(String(record._id)) ? null : startCreate(record._id) })}
              columns={[
                { title: 'PR No.', dataIndex: 'prNumber', width: 180, render: v => <span className="font-mono text-xs font-semibold text-slate-800">{v}</span> },
                { title: 'Items', width: 80, render: (_, r) => <Tag color="blue">{r.items?.length || 0}</Tag> },
                { title: 'Est. Value', width: 130, render: (_, r) => <span className="font-semibold text-slate-700">₹{prPurchaseValue(r).toLocaleString('en-IN')}</span> },
                { title: 'Priority', dataIndex: 'priority', width: 100, render: v => <Tag color={PRIORITY_COLORS[v] || 'default'} className="capitalize">{v}</Tag> },
                { title: 'Warehouse', dataIndex: 'warehouseName', render: v => v || '—' },
                { title: 'Required By', dataIndex: 'requiredByDate', width: 120, render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
                { title: '', width: 130, render: (_, r) => quotedPRIds.has(String(r._id))
                  ? <Tag color="green">Has quotation</Tag>
                  : <Button type="primary" size="small" ghost loading={prStarting === r._id} icon={<ArrowRightOutlined />}
                      onClick={e => { e.stopPropagation(); startCreate(r._id); }}>Compare</Button> },
              ]}
            />
          )}
        </div>
      </div>
    </Modal>

    <Modal
      title={
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-purple-600 font-bold border border-purple-100 shadow-sm">
            <SendOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0">{editor?.id ? 'Edit Supplier Quotation Draft' : 'New Supplier Quotation Comparison'}</h2>
            <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">Compare offers from multiple suppliers and select the best landed cost</p>
          </div>
        </div>
      }
      open={!!editor}
      onCancel={closeEditor}
      width="min(1600px, calc(100vw - 24px))"
      centered
      footer={[
        <Button key="cancel" onClick={closeEditor} className="rounded-lg px-5">Cancel</Button>,
        <Button key="save" type="primary" loading={saving} onClick={saveDraft}
          style={{ background: '#FF5F03', borderColor: '#FF5F03' }} className="rounded-lg px-6">Save Draft</Button>,
      ]}
      destroyOnHidden
    >
      {editor && <div className="max-h-[calc(88vh-120px)] overflow-y-auto space-y-4 pr-1 py-1">
        <InlineError error={error ? { message: error } : refError} onClose={() => setError('')} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Purchase Requisition</label>
            <Input size="large" value={editorPR?.prNumber || ''} disabled className="rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Receiving Warehouse <span className="text-red-500">*</span></label>
            <Select size="large" className="w-full" showSearch optionFilterProp="label" value={editor.warehouse || undefined}
              onChange={value => setEditor(prev => ({ ...prev, warehouse: value }))}
              options={warehouses.map(w => ({ value: w._id, label: `${w.name} (${w.warehouseCode || 'No code'})` }))} />
          </div>
        </div>
        {editor.offers.map((offer, offerIndex) => (
          <div key={offer.key} className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/90 border-b border-slate-200/80">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">{offerIndex + 1}</div>
                <span className="font-bold text-slate-800 text-sm">Supplier Offer {offerIndex + 1}</span>
              </div>
              {editor.offers.length > 1 && (
                <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => removeOffer(offerIndex)}>Remove</Button>
              )}
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Supplier <span className="text-red-500">*</span></label>
                  <Select size="large" className="w-full" showSearch optionFilterProp="label" value={offer.supplier || undefined}
                    onChange={value => selectSupplier(offerIndex, value)}
                    options={supplierOptions.map(option => ({ ...option, disabled: usedSuppliers.has(option.value) && option.value !== offer.supplier }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Credit Days</label>
                  <InputNumber size="large" min={0} className="w-full" value={offer.creditDays} onChange={value => updateOffer(offerIndex, 'creditDays', value || 0)} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Promised Delivery</label>
                  <Input size="large" type="date" value={offer.promisedDeliveryDate} onChange={event => updateOffer(offerIndex, 'promisedDeliveryDate', event.target.value)} className="rounded-lg" />
                </div>
              </div>
              <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                <Table size="small" pagination={false} rowKey={(row, index) => row.requisitionItem || index} dataSource={offer.items}
                  columns={[
                    { title: 'PR Item', render: (_, item) => <div><b className="text-slate-800">{item.productName}</b><div className="text-xs text-slate-400 font-mono">{item.productCode} · {item.quantity} {item.unit}</div></div> },
                    { title: 'Master Rate', width: 110, render: (_, item) => <span className="text-slate-500 font-medium whitespace-nowrap">₹{Number(item.masterPurchaseRate || 0).toLocaleString('en-IN')}</span> },
                    { title: 'Rate ₹', width: 110, render: (_, item, itemIndex) => <InputNumber min={0} className="w-full" value={item.offeredRate} onChange={value => updateOfferItem(offerIndex, itemIndex, 'offeredRate', value || 0)} /> },
                    { title: 'Discount ₹', width: 130, render: (_, item, itemIndex) => (
                      <div>
                        <InputNumber min={0} className="w-full" value={item.discount} onChange={value => updateOfferItem(offerIndex, itemIndex, 'discount', value || 0)} />
                        {item.mappedDiscountPct > 0 && (
                          <div className="text-[10px] text-emerald-600 mt-0.5">
                            mapped {item.mappedDiscountPct}%{item.mappedDiscountMaxPct > item.mappedDiscountPct ? ` (up to ${item.mappedDiscountMaxPct}%)` : ''}
                          </div>
                        )}
                      </div>
                    ) },
                    { title: 'Scheme Disc. ₹', width: 130, render: (_, item, itemIndex) => <InputNumber min={0} className="w-full" value={item.schemeDiscount} onChange={value => updateOfferItem(offerIndex, itemIndex, 'schemeDiscount', value || 0)} /> },
                    { title: 'Scheme', width: 120, render: (_, item, itemIndex) => <Input value={item.scheme} onChange={event => updateOfferItem(offerIndex, itemIndex, 'scheme', event.target.value)} /> },
                    { title: 'GST %', width: 90, render: (_, item, itemIndex) => <InputNumber min={0} max={100} className="w-full" value={item.gstPercentage} onChange={value => updateOfferItem(offerIndex, itemIndex, 'gstPercentage', value ?? 0)} /> },
                  ]} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {['freight', 'loading', 'insurance'].map(field => (
                  <div key={field}>
                    <label className="text-xs font-semibold text-slate-700 block mb-1.5 capitalize">{field} ₹</label>
                    <InputNumber size="large" min={0} className="w-full" value={offer[field]} onChange={value => updateOffer(offerIndex, field, value || 0)} />
                  </div>
                ))}
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Payment Terms</label>
                  <Input size="large" value={offer.paymentTerms} onChange={event => updateOffer(offerIndex, 'paymentTerms', event.target.value)} className="rounded-lg" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Delivery Timeline</label>
                  <Input size="large" value={offer.deliveryTimeline} onChange={event => updateOffer(offerIndex, 'deliveryTimeline', event.target.value)} className="rounded-lg" />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                <div className="flex-1">
                  <label className="text-xs font-semibold text-slate-700 block mb-1.5">Offer Remarks</label>
                  <Input.TextArea rows={2} placeholder="Supplier offer remarks" value={offer.remarks}
                    onChange={event => updateOffer(offerIndex, 'remarks', event.target.value)} className="rounded-lg" />
                </div>
                <div className="bg-orange-50 border border-orange-200/80 rounded-xl px-4 py-3 text-right shrink-0">
                  <div className="text-xs text-slate-500 mb-0.5">Estimated Landed Total</div>
                  <div className="font-bold text-[#FF5F03] text-lg">₹{localOfferTotal(offer).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
        <Button icon={<PlusOutlined />} onClick={addOffer} className="rounded-lg">Add Supplier Offer</Button>
      </div>}
    </Modal>

    <Modal
      title={
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100 shadow-sm">
            <EyeOutlined className="text-lg" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-slate-900 font-mono">{detail?.quotationNumber || 'Supplier Quotation'}</span>
              {detail?.status && (
                <Tag color={STATUS_COLORS[detail.status]} className="px-2.5 py-0.5 text-xs font-semibold capitalize rounded-md border-0 m-0">
                  {detail.status.replace(/_/g, ' ')}
                </Tag>
              )}
            </div>
            <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">Supplier Offer Comparison · {detail?.offers?.length || 0} offers · PR: <b>{detail?.prNumber || detail?.purchaseRequisition?.prNumber}</b></p>
          </div>
        </div>
      }
      open={!!detail && !editor}
      width="min(1600px, calc(100vw - 24px))"
      centered
      onCancel={() => setDetail(null)}
      footer={[
        canManage && detail?.status === 'draft' && <Button key="edit" icon={<EditOutlined />} onClick={startEdit} className="rounded-lg">Edit Draft</Button>,
        canManage && detail?.status === 'draft' && <Button key="submit" type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={() => runAction('submit')} className="rounded-lg bg-blue-600">Submit</Button>,
        canManage && detail?.status === 'submitted' && <Button key="compare" type="primary" loading={actionLoading} onClick={() => runAction('compare')} className="rounded-lg bg-purple-600 border-0">Compare Offers</Button>,
        canManage && detail?.status === 'selected' && <Button key="convert" type="primary" icon={<ShoppingCartOutlined />} loading={actionLoading} onClick={() => runAction('convert')} className="rounded-lg bg-emerald-600 border-0">Convert to PO</Button>,
        detail?.status === 'po_created' && <Button key="open-po" type="primary" onClick={() => navigate(`/sales-purchase/po-management?po=${detail.linkedPO?._id || detail.linkedPO}`)} className="rounded-lg">Open PO</Button>,
        <Button key="close" onClick={() => setDetail(null)} className="rounded-lg">Close</Button>,
      ].filter(Boolean)}
    >
      {detail && <div className="max-h-[calc(88vh-120px)] overflow-y-auto space-y-4 pr-1 py-1">
        {detail.status !== 'draft' && <Alert type="info" showIcon message="Submitted quotation values are immutable. Server-calculated commercial values are shown below." className="rounded-xl" />}
        {(comparison.length > 0 || detail.status === 'compared') && (
          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-50/90 px-4 py-2.5 border-b border-slate-200/80 font-bold text-slate-800">
              Server Comparison &amp; Ranking
            </div>
            {comparison.length ? (
              <Table size="small" pagination={false} rowKey="offer" dataSource={comparison} columns={[
                { title: 'Rank', dataIndex: 'rank', width: 70, render: value => <Tag color={value === 1 ? 'gold' : 'default'}>#{value}</Tag> },
                { title: 'Supplier', dataIndex: 'supplierName', render: v => <b className="text-slate-800">{v}</b> },
                { title: 'Landed Total', dataIndex: 'totalLandedAmount', render: value => <b className="text-[#FF5F03]">₹{Number(value || 0).toLocaleString('en-IN')}</b> },
                { title: 'Unit Cost (Norm.)', dataIndex: 'normalizedUnitCost', render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
                { title: 'Rating', dataIndex: 'supplierRating' },
                { title: 'Credit Days', dataIndex: 'creditDays' },
                { title: 'Action', render: (_, row) => canApprove && detail.status === 'compared'
                  ? <Button size="small" type={row.rank === 1 ? 'primary' : 'default'} icon={<CheckOutlined />} onClick={() => setSelectOffer(row)} style={row.rank === 1 ? { background: '#52c41a', borderColor: '#52c41a' } : {}}>Select</Button>
                  : String(row.offer) === selectedOfferId ? <Tag color="green">Selected</Tag> : null },
              ]} />
            ) : <Empty description="Run comparison to calculate ranks" className="py-6" />}
          </div>
        )}
        <div className="text-sm font-bold text-slate-700 px-1">Supplier Offers ({(detail.offers || []).length})</div>
        {(detail.offers || []).map(offer => (
          <div key={offer._id}
            className={`border rounded-xl overflow-hidden bg-white shadow-sm ${
              String(offer._id) === selectedOfferId ? 'border-emerald-400 ring-1 ring-emerald-300' : 'border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between px-4 py-3 bg-slate-50/90 border-b border-slate-200/80">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-slate-800">{offer.supplierSnapshot?.companyName || offer.supplier?.companyName}</span>
                {offer.rank && <Tag className="m-0 rounded-md">Rank #{offer.rank}</Tag>}
                {String(offer._id) === selectedOfferId && <Tag color="green" className="m-0 rounded-md">✓ Final Supplier</Tag>}
              </div>
              <div className="font-bold text-[#FF5F03] text-base">₹{Number(offer.totalLandedAmount || 0).toLocaleString('en-IN')}</div>
            </div>
            <div className="p-0">
              <Table size="small" pagination={false} rowKey="_id" dataSource={offer.items} columns={[
                { title: 'Product', render: (_, item) => <div><b className="text-slate-800">{item.productName}</b><div className="text-xs text-slate-400 font-mono">{item.productCode || '—'}</div></div> },
                { title: 'Qty', render: (_, item) => `${item.quantity} ${item.unit}`, width: 80 },
                { title: 'Master Rate', width: 110, render: (_, item) => {
                  const master = masterRateByProduct.get(String(item.product?._id || item.product)) || 0;
                  return <span className="text-slate-500 font-medium whitespace-nowrap">₹{Number(master).toLocaleString('en-IN')}</span>;
                } },
                { title: 'Rate', dataIndex: 'offeredRate', width: 120, render: (value, item) => {
                  const master = masterRateByProduct.get(String(item.product?._id || item.product)) || 0;
                  const offered = Number(value || 0);
                  const overMaster = master > 0 && offered > master;
                  return (
                    <span className={`whitespace-nowrap font-semibold ${overMaster ? 'text-red-500' : 'text-emerald-600'}`}>
                      ₹{offered.toLocaleString('en-IN')}
                      {master > 0 && (
                        <span className="text-[10px] font-normal ml-1">
                          {overMaster ? '▲' : '▼'} vs master
                        </span>
                      )}
                    </span>
                  );
                } },
                { title: 'Discount', width: 140, render: (_, item) => `₹${Number(item.discount || 0).toLocaleString('en-IN')} + ₹${Number(item.schemeDiscount || 0).toLocaleString('en-IN')}` },
                { title: 'Taxable', dataIndex: 'taxableAmount', width: 110, render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
                { title: 'Tax', dataIndex: 'taxAmount', width: 100, render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
                { title: 'Line Total', dataIndex: 'lineTotal', width: 120, render: value => <b className="text-slate-900">₹{Number(value || 0).toLocaleString('en-IN')}</b> },
              ]} />
            </div>
            <div className="px-4 py-2.5 bg-slate-50/60 border-t border-slate-100 text-xs text-slate-500 flex flex-wrap gap-3">
              <span>Freight ₹{offer.freight || 0}</span>
              <span>·</span>
              <span>Loading ₹{offer.loading || 0}</span>
              <span>·</span>
              <span>Insurance ₹{offer.insurance || 0}</span>
              <span>·</span>
              <span>Credit {offer.creditDays || 0} days</span>
              <span>·</span>
              <span>{offer.paymentTerms || 'No payment terms'}</span>
            </div>
          </div>
        ))}
      </div>}
    </Modal>

    <Modal title={`Select ${selectOffer?.supplierName || 'final supplier'}`} open={!!selectOffer} onCancel={() => setSelectOffer(null)}
      onOk={confirmSupplier} okText="Confirm Selection" width={640} confirmLoading={actionLoading}>
      <Alert type="warning" showIcon message="Selection is final and locks the winning commercial offer for PO conversion." className="mb-3" />
      <Input.TextArea rows={3} value={selectionRemarks} onChange={event => setSelectionRemarks(event.target.value)} placeholder="Selection remarks (optional)" />
    </Modal>
  </div>;
};

export default SupplierQuotationPage;
