import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Divider, Empty, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Statistic, Table, Tag, Tooltip, message,
} from 'antd';
import {
  CheckOutlined, EyeOutlined, PlusOutlined, ReloadOutlined, SaveOutlined,
  SearchOutlined, SendOutlined, StopOutlined, UndoOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import purchaseService from '../../services/purchaseService.js';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import { createIdempotencyKey } from '../../config/api.js';

const OPERATIONS = [
  ['add', 'Add received outside the system'], ['found', 'Found stock'], ['opening_correction', 'Opening correction'],
  ['remove', 'Remove stock'], ['loss', 'Record loss'], ['reclassify_damaged', 'Available → damaged'],
  ['restore_damaged', 'Damaged → available'], ['reclassify_blocked', 'Available → blocked'],
  ['release_blocked', 'Blocked → available'], ['issue_sample', 'Available → sample'],
  ['return_sample', 'Sample → available'], ['scrap', 'Scrap classified stock'],
].map(([value, label]) => ({ value, label }));
const SCRAP_SOURCES = [
  { value: 'damagedQty', label: 'Damaged' }, { value: 'blockedQty', label: 'Blocked' }, { value: 'sampleQty', label: 'Sample' },
];
const STATUS_COLORS = { draft: 'default', submitted: 'blue', approved: 'green', rejected: 'red', reversed: 'purple' };
const emptyLine = () => ({ key: `${Date.now()}-${Math.random()}`, product: '', productRecord: null, warehouse: '', shade: '', batch: '', operation: 'add', scrapSource: '', quantity: '', unit: '' });
const quantity = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
const actorName = (actor) => actor?.name || actor?.email || '—';

const vectorPreview = (line) => {
  const q = Number(line.quantity || 0); const operation = line.operation; const rows = [];
  const add = (bucket, delta) => rows.push([bucket, delta]);
  if (['add', 'found', 'opening_correction'].includes(operation)) { add('Total', q); add('Available', q); }
  else if (['remove', 'loss'].includes(operation)) { add('Total', -q); add('Available', -q); }
  else if (operation === 'reclassify_damaged') { add('Available', -q); add('Damaged', q); }
  else if (operation === 'restore_damaged') { add('Damaged', -q); add('Available', q); }
  else if (operation === 'reclassify_blocked') { add('Available', -q); add('Blocked', q); }
  else if (operation === 'release_blocked') { add('Blocked', -q); add('Available', q); }
  else if (operation === 'issue_sample') { add('Available', -q); add('Sample', q); }
  else if (operation === 'return_sample') { add('Sample', -q); add('Available', q); }
  else if (operation === 'scrap') { add('Total', -q); add((line.scrapSource || 'Classified').replace('Qty', ''), -q); }
  return rows;
};

export default function StockAdjustmentPage() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState([]); const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false); const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState({ search: '', status: undefined, page: 1, limit: 20 });
  const [pagination, setPagination] = useState({ currentPage: 1, totalItems: 0, itemsPerPage: 20 });
  const [warehouses, setWarehouses] = useState([]); const [productOptions, setProductOptions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false); const [mode, setMode] = useState('view');
  const [document, setDocument] = useState(null); const [reason, setReason] = useState(''); const [remarks, setRemarks] = useState('');
  const [lines, setLines] = useState([emptyLine()]); const searchSequence = useRef(0);
  const createIntent = useRef({ key: '', fingerprint: '' });

  const canCreate = hasPermission('stock.adjustment.create') || hasPermission('stock.adjustment');
  const canSubmit = hasPermission('stock.adjustment.submit') || hasPermission('stock.adjustment');
  const canApprove = hasPermission('stock.adjustment.approve'); const canReverse = hasPermission('stock.adjustment.reverse');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([purchaseService.getStockAdjustments(filters), purchaseService.getStockAdjustmentStats()]);
      setRows(list.data || []); setPagination(list.pagination || {}); setStats(summary.data?.byStatus || {});
    } catch (error) { message.error(error.message || 'Unable to load stock adjustments.'); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { masterService.getWarehouses({ limit: 100, status: 'active' }).then((res) => setWarehouses(res.data || [])).catch(() => {}); }, []);

  const searchProducts = async (value) => {
    if (!value || value.trim().length < 2) return;
    const sequence = ++searchSequence.current;
    try { const response = await productService.getProducts({ search: value, status: 'active', limit: 20 }); if (sequence === searchSequence.current) setProductOptions(response.data || []); }
    catch { if (sequence === searchSequence.current) setProductOptions([]); }
  };
  const productChoices = productOptions.map((product) => ({ value: product._id, label: `${product.productCode || '—'} · ${product.itemName}`, product }));
  const warehouseChoices = warehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }));

  const discardCreateIntent = () => { createIntent.current = { key: '', fingerprint: '' }; };
  const closeModal = () => { if (mode === 'create') discardCreateIntent(); setModalOpen(false); };
  const openCreate = () => { setMode('create'); setDocument(null); setReason(''); setRemarks(''); setLines([emptyLine()]); createIntent.current = { key: createIdempotencyKey(), fingerprint: '' }; setModalOpen(true); };
  const openDocument = async (record, nextMode = 'view') => {
    setActionLoading(true);
    try {
      const response = await purchaseService.getStockAdjustment(record._id);
      const detail = response.data; setDocument(detail); setMode(nextMode); setReason(detail.reason || ''); setRemarks(detail.remarks || '');
      setLines((detail.lines || []).map((line) => ({ key: line._id, _id: line._id, product: line.product?._id || line.product, productRecord: line.product, warehouse: line.warehouse?._id || line.warehouse, shade: line.shade || '', batch: line.batch || '', operation: line.operation, scrapSource: line.scrapSource || '', quantity: line.enteredQuantity, unit: line.enteredUnit })));
      setModalOpen(true);
    } catch (error) { message.error(error.message); }
    finally { setActionLoading(false); }
  };
  const updateLine = (key, patch) => setLines((current) => current.map((line) => line.key === key ? { ...line, ...patch } : line));
  const chooseProduct = (key, productId, option) => {
    const product = option?.product || productOptions.find((item) => item._id === productId);
    updateLine(key, { product: productId, productRecord: product, unit: product?.unit || product?.inventoryBaseUom || 'Unit' });
  };
  const conversionText = (line) => {
    const product = line.productRecord; const entered = line.unit || product?.unit; const conversion = product?.uomConversions?.filter((row) => row.uom === entered).sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
    const factor = Number(conversion?.toBaseFactor || 1); const base = product?.inventoryBaseUom || entered || 'Unit';
    return `${quantity(line.quantity)} ${entered || 'Unit'} = ${quantity(Number(line.quantity || 0) * factor)} ${base} (v${conversion?.version || product?.inventoryUomVersion || 1})`;
  };
  const validate = () => {
    if (reason.trim().length < 5) return 'Enter a reason of at least 5 characters.';
    if (!lines.length || lines.length > 200) return 'Use 1 to 200 lines.';
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]; if (!line.product || !line.warehouse || !(Number(line.quantity) > 0)) return `Line ${index + 1} requires product, warehouse, and positive quantity.`;
      if (line.operation === 'scrap' && !line.scrapSource) return `Line ${index + 1} requires a scrap source bucket.`;
    }
    return '';
  };
  const payload = () => ({ reason: reason.trim(), remarks: remarks.trim(), lines: lines.map((line) => ({
    ...(line._id ? { _id: line._id } : {}), product: line.product, warehouse: line.warehouse, shade: line.shade.trim(), batch: line.batch.trim(),
    operation: line.operation, scrapSource: line.scrapSource, quantity: line.quantity, unit: line.unit || line.productRecord?.unit || 'Unit',
  })) });
  const save = async (submitAfter = false) => {
    const problem = validate(); if (problem) return message.warning(problem);
    setActionLoading(true);
    try {
      const body = payload();
      const fingerprint = JSON.stringify(body);
      if (mode !== 'edit' && createIntent.current.fingerprint && createIntent.current.fingerprint !== fingerprint) createIntent.current = { key: createIdempotencyKey(), fingerprint };
      if (mode !== 'edit' && !createIntent.current.key) createIntent.current = { key: createIdempotencyKey(), fingerprint };
      if (mode !== 'edit') createIntent.current.fingerprint = fingerprint;
      const response = mode === 'edit' ? await purchaseService.updateStockAdjustment(document._id, body) : await purchaseService.createStockAdjustment(body, createIntent.current.key);
      let saved = response.data;
      if (mode !== 'edit') {
        discardCreateIntent();
        // Retain the committed draft before attempting the second request. If submission
        // fails, retry edits/submission target this document instead of creating a duplicate.
        setDocument(saved); setMode('edit');
      }
      if (submitAfter) {
        try { saved = (await purchaseService.submitStockAdjustment(saved._id)).data; }
        catch (submitError) {
          try {
            const latest = (await purchaseService.getStockAdjustment(saved._id)).data;
            setDocument(latest);
            if (latest.status === 'submitted') saved = latest;
            else throw submitError;
          } catch (verificationError) {
            if (verificationError === submitError) throw submitError;
            throw submitError;
          }
        }
      }
      message.success(submitAfter ? 'Submitted for independent approval; stock is not posted yet.' : 'Draft saved.');
      setModalOpen(false); await load(); return saved;
    } catch (error) { message.error(error.message || 'Unable to save adjustment. The saved draft remains open for a safe retry.'); }
    finally { setActionLoading(false); }
  };
  const act = async (record, action) => {
    const labels = { submit: 'Submit this adjustment for independent approval? No stock posts until approval.', approve: 'Approve and post all stock movements atomically?', reject: 'Reject without posting stock?', reverse: 'Append exact inverse movements? Original movements remain immutable.' };
    let value = '';
    Modal.confirm({ title: `${action[0].toUpperCase()}${action.slice(1)} ${record.adjustmentNumber}`, content: <Input.TextArea autoFocus placeholder={action === 'reverse' ? 'Required reversal reason' : 'Review remarks (optional)'} onChange={(event) => { value = event.target.value; }} />, okText: action, okButtonProps: { danger: ['reject', 'reverse'].includes(action) }, onOk: async () => {
      if (action === 'reverse' && !value.trim()) throw new Error('A reversal reason is required.');
      setActionLoading(true);
      try {
        const methods = { submit: () => purchaseService.submitStockAdjustment(record._id), approve: () => purchaseService.approveStockAdjustment(record._id, { remarks: value }), reject: () => purchaseService.rejectStockAdjustment(record._id, { remarks: value }), reverse: () => purchaseService.reverseStockAdjustment(record._id, { reason: value }) };
        const response = await methods[action](); message.success(response.message || labels[action]); await load();
      } catch (error) { message.error(error.message); throw error; }
      finally { setActionLoading(false); }
    } });
  };

  const columns = [
    { title: 'Number', dataIndex: 'adjustmentNumber', render: (value, record) => <Button type="link" className="p-0" onClick={() => openDocument(record)}>{value}</Button> },
    { title: 'Status', dataIndex: 'status', width: 105, render: (value) => <Tag color={STATUS_COLORS[value]}>{value?.toUpperCase()}</Tag> },
    { title: 'Reason', dataIndex: 'reason', ellipsis: true },
    { title: 'Lines', dataIndex: 'lines', width: 70, render: (value) => value?.length || 0 },
    { title: 'Value impact', dataIndex: 'totalValueImpact', width: 130, render: (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}` },
    { title: 'Maker', dataIndex: 'createdBy', render: actorName },
    { title: 'Created', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('en-IN') },
    { title: 'Actions', key: 'actions', fixed: 'right', width: 230, render: (_, record) => <Space wrap>
      <Tooltip title="View source and movement details"><Button size="small" icon={<EyeOutlined />} onClick={() => openDocument(record)} /></Tooltip>
      {record.status === 'draft' && canCreate && <Button size="small" onClick={() => openDocument(record, 'edit')}>Edit</Button>}
      {record.status === 'draft' && canSubmit && <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => act(record, 'submit')}>Submit</Button>}
      {record.status === 'submitted' && canApprove && <><Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => act(record, 'approve')}>Approve</Button><Button size="small" danger icon={<StopOutlined />} onClick={() => act(record, 'reject')}>Reject</Button></>}
      {record.status === 'approved' && canReverse && <Button size="small" danger icon={<UndoOutlined />} onClick={() => act(record, 'reverse')}>Reverse</Button>}
    </Space> },
  ];

  const lineColumns = [
    { title: 'Product *', width: 255, render: (_, line) => mode === 'view' ? <Space><ProductImage src={line.productRecord?.images?.[0]} size="sm"/><span>{line.productRecord?.productCode} · {line.productRecord?.itemName || line.product}</span></Space> : <Select showSearch filterOption={false} onSearch={searchProducts} onChange={(value, option) => chooseProduct(line.key, value, option)} value={line.product || undefined} options={productChoices} placeholder="Search code/name" className="w-full" /> },
    { title: 'Warehouse *', width: 180, render: (_, line) => mode === 'view' ? (warehouses.find((w) => w._id === line.warehouse)?.name || line.warehouse) : <Select value={line.warehouse || undefined} options={warehouseChoices} onChange={(warehouse) => updateLine(line.key, { warehouse })} className="w-full" /> },
    { title: 'Shade / batch', width: 160, render: (_, line) => mode === 'view' ? `${line.shade || '—'} / ${line.batch || '—'}` : <Space.Compact block><Input value={line.shade} placeholder="Shade" onChange={(event) => updateLine(line.key, { shade: event.target.value })}/><Input value={line.batch} placeholder="Batch" onChange={(event) => updateLine(line.key, { batch: event.target.value })}/></Space.Compact> },
    { title: 'Operation *', width: 210, render: (_, line) => mode === 'view' ? OPERATIONS.find((item) => item.value === line.operation)?.label : <Space direction="vertical" size={4} className="w-full"><Select value={line.operation} options={OPERATIONS} onChange={(operation) => updateLine(line.key, { operation, scrapSource: operation === 'scrap' ? line.scrapSource : '' })} className="w-full" />{line.operation === 'scrap' && <Select value={line.scrapSource || undefined} options={SCRAP_SOURCES} placeholder="Source bucket" onChange={(scrapSource) => updateLine(line.key, { scrapSource })} className="w-full" />}</Space> },
    { title: 'Quantity / UOM *', width: 180, render: (_, line) => mode === 'view' ? `${quantity(line.quantity)} ${line.unit}` : <Space.Compact block><InputNumber stringMode min="0.000001" precision={6} value={line.quantity || undefined} onChange={(value) => updateLine(line.key, { quantity: value ?? '' })} className="w-full"/><Select value={line.unit || undefined} onChange={(unit) => updateLine(line.key, { unit })} options={(line.productRecord?.uomConversions || [{ uom: line.productRecord?.unit || 'Unit' }]).map((row) => ({ value: row.uom, label: row.uom }))} className="w-28"/></Space.Compact> },
    { title: 'Server vector preview', width: 220, render: (_, line) => <div><Space wrap size={2}>{vectorPreview(line).map(([bucket, delta]) => <Tag key={bucket} color={delta < 0 ? 'red' : 'green'}>{bucket} {delta > 0 ? '+' : ''}{quantity(delta)}</Tag>)}</Space><div className="text-[11px] text-gray-500 mt-1">{conversionText(line)}</div></div> },
    ...(mode === 'view' ? [{ title: 'Movement source', width: 220, render: (_, line) => <div className="text-xs"><div>Movement: {line.movement || 'Not posted'}</div><div className="font-mono break-all">{line.operationKey || '—'}</div>{line.reversalMovement && <div>Reversal: {line.reversalMovement}</div>}</div> }] : [{ title: '', width: 45, render: (_, line) => <Popconfirm title="Remove line?" onConfirm={() => setLines((current) => current.filter((item) => item.key !== line.key))}><Button danger size="small">×</Button></Popconfirm> }]),
  ];

  const totalStats = useMemo(() => ['draft', 'submitted', 'approved', 'rejected', 'reversed'].map((status) => ({ status, count: stats[status]?.count || 0 })), [stats]);
  return <div className="space-y-4">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-800">Stock Adjustments</h1><p className="text-sm text-gray-500">Durable maker-checker documents. Submit freezes lines; only an independent approver posts immutable movements.</p></div><Space><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>{canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New adjustment</Button>}</Space></div>
    <Alert showIcon type="info" message="Reserved, transit, and short quantities cannot be changed manually. All deltas are generated server-side after UOM conversion." />
    <Row gutter={[12, 12]}>{totalStats.map(({ status, count }) => <Col xs={12} sm={8} lg={4} key={status}><Card size="small"><Statistic title={status.toUpperCase()} value={count} valueStyle={{ fontSize: 20 }}/></Card></Col>)}</Row>
    <Card size="small"><Space wrap><Input allowClear prefix={<SearchOutlined />} placeholder="Number or reason" value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value, page: 1 }))}/><Select allowClear placeholder="Status" value={filters.status} options={Object.keys(STATUS_COLORS).map((status) => ({ value: status, label: status.toUpperCase() }))} onChange={(status) => setFilters((value) => ({ ...value, status, page: 1 }))}/></Space></Card>
    <Card bodyStyle={{ padding: 0 }}><Table rowKey="_id" columns={columns} dataSource={rows} loading={loading || actionLoading} scroll={{ x: 1200 }} pagination={{ current: pagination.currentPage, pageSize: pagination.itemsPerPage || 20, total: pagination.totalItems, showSizeChanger: true }} onChange={(page) => setFilters((value) => ({ ...value, page: page.current, limit: page.pageSize }))} locale={{ emptyText: <Empty description="No stock adjustments"/> }}/></Card>

    <Modal open={modalOpen} onCancel={closeModal} width="min(1500px, 96vw)" footer={null} destroyOnHidden title={mode === 'create' ? 'New stock adjustment' : `${document?.adjustmentNumber || ''} · ${mode === 'edit' ? 'Edit draft' : 'Details'}`}>
      {document && <Descriptions size="small" bordered column={{ xs: 1, md: 3 }} className="mb-4"><Descriptions.Item label="Status"><Tag color={STATUS_COLORS[document.status]}>{document.status}</Tag></Descriptions.Item><Descriptions.Item label="Maker">{actorName(document.createdBy)}</Descriptions.Item><Descriptions.Item label="Submitter">{actorName(document.submittedBy)}</Descriptions.Item><Descriptions.Item label="Approver">{actorName(document.approvedBy)}</Descriptions.Item><Descriptions.Item label="Posting version">{document.postingVersion || 0}</Descriptions.Item><Descriptions.Item label="Approval request">{document.approvalRequest?.requestNumber || '—'}</Descriptions.Item></Descriptions>}
      {document?.status === 'submitted' && <Alert className="mb-4" type="warning" showIcon message="Awaiting independent approval — no stock has been posted."/>}
      <Row gutter={12}><Col xs={24} md={12}><label className="text-sm font-medium">Reason *</label><Input.TextArea rows={2} disabled={mode === 'view'} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={1000}/></Col><Col xs={24} md={12}><label className="text-sm font-medium">Remarks</label><Input.TextArea rows={2} disabled={mode === 'view'} value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength={4000}/></Col></Row>
      <Divider orientation="left">Lines ({lines.length}/200)</Divider>
      <Table rowKey="key" columns={lineColumns} dataSource={lines} pagination={false} scroll={{ x: 1250, y: 430 }} size="small"/>
      {mode !== 'view' && <div className="mt-3 flex flex-col sm:flex-row justify-between gap-2"><Button icon={<PlusOutlined />} disabled={lines.length >= 200} onClick={() => setLines((current) => [...current, emptyLine()])}>Add line</Button><Space wrap><Button onClick={closeModal}>Cancel</Button><Button icon={<SaveOutlined />} loading={actionLoading} onClick={() => save(false)}>Save draft</Button>{canSubmit && <Button type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={() => save(true)}>Save & submit</Button>}</Space></div>}
    </Modal>
  </div>;
}
