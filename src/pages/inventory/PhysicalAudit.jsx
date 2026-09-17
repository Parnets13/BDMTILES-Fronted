import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Empty, Input, InputNumber, Modal, Row,
  Select, Space, Statistic, Table, Tag, Tooltip, message,
} from 'antd';
import {
  AuditOutlined, CheckOutlined, EyeOutlined, PlusOutlined, PrinterOutlined,
  ReloadOutlined, SaveOutlined, SendOutlined, StopOutlined, UndoOutlined, WarningOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import masterService from '../../services/masterService.js';
import purchaseService from '../../services/purchaseService.js';
import { createIdempotencyKey } from '../../config/api.js';

const STATUS_COLORS = { draft: 'default', submitted: 'blue', approved: 'green', rejected: 'red', reversed: 'purple' };
const CLASS_COLORS = { not_counted: 'default', matched: 'green', short: 'red', excess: 'orange' };
const qty = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
const round6 = (value) => Math.round((Number(value) + Number.EPSILON) * 1e6) / 1e6;
const actor = (value) => value?.name || value?.email || '—';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));

export default function PhysicalAudit() {
  const { hasPermission } = useAuth();
  const [rows, setRows] = useState([]); const [stats, setStats] = useState({}); const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ search: '', status: undefined, warehouse: undefined, page: 1, limit: 20 });
  const [pagination, setPagination] = useState({}); const [loading, setLoading] = useState(false); const [actionLoading, setActionLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false); const [createForm, setCreateForm] = useState({ warehouse: undefined, scope: 'full_warehouse', stockIds: [], remarks: '' });
  const [scopeStock, setScopeStock] = useState([]); const [scopeLoading, setScopeLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false); const [mode, setMode] = useState('view'); const [document, setDocument] = useState(null);
  const [counts, setCounts] = useState({}); const [countRemarks, setCountRemarks] = useState('');
  const createIntent = useRef({ key: '', fingerprint: '' });

  const canCreate = hasPermission('stock.audit.create'); const canCount = hasPermission('stock.audit.count');
  const canSubmit = hasPermission('stock.audit.submit'); const canApprove = hasPermission('stock.audit.approve'); const canReverse = hasPermission('stock.audit.reverse');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([purchaseService.getPhysicalAudits(filters), purchaseService.getPhysicalAuditStats({ warehouse: filters.warehouse })]);
      setRows(list.data || []); setPagination(list.pagination || {}); setStats(summary.data?.byStatus || {});
    } catch (error) { message.error(error.message || 'Unable to load physical audits.'); }
    finally { setLoading(false); }
  }, [filters]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { masterService.getWarehouses({ limit: 100, status: 'active' }).then((response) => setWarehouses(response.data || [])).catch(() => {}); }, []);

  const loadScopeStock = async (warehouse) => {
    setScopeStock([]); if (!warehouse) return;
    setScopeLoading(true);
    try {
      const first = await purchaseService.getStockDashboard({ warehouse, page: 1, limit: 200 });
      const totalPages = Number(first.pagination?.totalPages || 1);
      const rest = totalPages > 1 ? await Promise.all(Array.from({ length: totalPages - 1 }, (_, index) => purchaseService.getStockDashboard({ warehouse, page: index + 2, limit: 200 }))) : [];
      if (rest.some((response) => !response.success)) throw new Error('Could not load the complete warehouse scope.');
      setScopeStock([...(first.data || []), ...rest.flatMap((response) => response.data || [])]);
    } catch (error) { message.error(error.message || 'Unable to load warehouse stock.'); }
    finally { setScopeLoading(false); }
  };
  const stockChoices = scopeStock.map((stock) => ({ value: stock._id, label: `${stock.product?.productCode || '—'} · ${stock.product?.itemName || stock.product} · ${stock.shade || 'No shade'} · ${stock.batch || 'No batch'}` }));
  const warehouseChoices = warehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }));

  const resetCreate = () => { setCreateForm({ warehouse: undefined, scope: 'full_warehouse', stockIds: [], remarks: '' }); setScopeStock([]); createIntent.current = { key: '', fingerprint: '' }; };
  const openCreate = () => { resetCreate(); createIntent.current.key = createIdempotencyKey(); setCreateOpen(true); };
  const closeCreate = () => { setCreateOpen(false); resetCreate(); };
  const createAudit = async () => {
    if (!createForm.warehouse) return message.warning('Select a warehouse.');
    if (createForm.scope !== 'full_warehouse' && !createForm.stockIds.length) return message.warning('Select at least one stock bucket for cycle/spot count.');
    setActionLoading(true);
    try {
      const body = { warehouse: createForm.warehouse, scope: createForm.scope, scopeFilters: createForm.scope === 'full_warehouse' ? {} : { stockIds: createForm.stockIds }, remarks: createForm.remarks };
      const fingerprint = JSON.stringify(body);
      if (createIntent.current.fingerprint && createIntent.current.fingerprint !== fingerprint) createIntent.current = { key: createIdempotencyKey(), fingerprint };
      if (!createIntent.current.key) createIntent.current.key = createIdempotencyKey();
      createIntent.current.fingerprint = fingerprint;
      const response = await purchaseService.createPhysicalAudit(body, createIntent.current.key);
      createIntent.current = { key: '', fingerprint: '' };
      message.success('Count sheet created. No stock has been posted.'); setCreateOpen(false); resetCreate(); await load(); await openDocument(response.data, 'count');
    } catch (error) { message.error(error.message); }
    finally { setActionLoading(false); }
  };
  const openDocument = async (record, nextMode = 'view') => {
    setActionLoading(true);
    try {
      const response = await purchaseService.getPhysicalAudit(record._id); const detail = response.data;
      setDocument(detail); setCounts(Object.fromEntries((detail.lines || []).map((line) => [line._id, line.physicalCount ?? null]))); setCountRemarks(detail.remarks || '');
      setMode(nextMode); setDetailOpen(true);
    } catch (error) { message.error(error.message); }
    finally { setActionLoading(false); }
  };
  const saveCounts = async ({ refresh = true, propagate = false } = {}) => {
    const recountIds = new Set((document?.lines || []).filter((line) => line.recountRequired).map((line) => line._id));
    const entries = Object.entries(counts).filter(([lineId, value]) => value !== null && value !== '' && value !== undefined && (document?.status !== 'submitted' || recountIds.has(lineId)));
    if (!entries.length) {
      const error = new Error('Enter at least one count.');
      message.warning(error.message);
      if (propagate) throw error;
      return null;
    }
    setActionLoading(true);
    try {
      const response = await purchaseService.savePhysicalAuditCounts(document._id, { counts: entries.map(([lineId, physicalCount]) => ({ lineId, physicalCount })), remarks: countRemarks });
      message.success(response.data?.status === 'draft' && document.status === 'submitted' ? 'Audit reopened and recount saved. Submit the refreshed sheet again.' : 'Counts saved. Stock remains unchanged until approval.');
      if (refresh) { await openDocument(response.data, 'count'); await load(); }
      return response.data;
    } catch (error) { message.error(error.message); if (propagate) throw error; return null; }
    finally { setActionLoading(false); }
  };
  const submit = async () => {
    setActionLoading(true);
    try {
      if (canCount) await saveCounts({ refresh: false, propagate: true });
      const response = await purchaseService.submitPhysicalAudit(document._id); message.success(response.message || 'Submitted; no stock posted.');
      setDetailOpen(false); await load();
    } catch (error) {
      const conflict = error.details?.recountLineIds?.length ? ` ${error.details.recountLineIds.length} line(s) require recount.` : '';
      message.error(`${error.message || 'Unable to submit.'}${conflict}`); if (document?._id) await openDocument(document, 'count');
    } finally { setActionLoading(false); }
  };
  const action = (record, kind) => {
    let remarks = '';
    Modal.confirm({
      title: `${kind[0].toUpperCase()}${kind.slice(1)} ${record.auditNumber}`,
      content: <div><p className="mb-2">{kind === 'approve' ? 'Approval rechecks every stock snapshot and journal tail, then posts all count variances atomically.' : kind === 'reject' ? 'Rejection posts no stock movement.' : 'Reversal appends exact inverse movements; originals remain immutable.'}</p><Input.TextArea placeholder={kind === 'reverse' ? 'Required reversal reason' : 'Review remarks'} onChange={(event) => { remarks = event.target.value; }}/></div>,
      okText: kind, okButtonProps: { danger: kind !== 'approve' },
      onOk: async () => {
        if (kind === 'reverse' && !remarks.trim()) throw new Error('A reversal reason is required.');
        setActionLoading(true);
        try {
          const methods = { approve: () => purchaseService.approvePhysicalAudit(record._id, { remarks }), reject: () => purchaseService.rejectPhysicalAudit(record._id, { remarks }), reverse: () => purchaseService.reversePhysicalAudit(record._id, { reason: remarks }) };
          const response = await methods[kind](); message.success(response.message); await load();
        } catch (error) { message.error(error.message); throw error; }
        finally { setActionLoading(false); }
      },
    });
  };

  const currentLines = document?.lines || [];
  const classified = useMemo(() => currentLines.reduce((result, line) => ({ ...result, [line.classification]: (result[line.classification] || 0) + 1 }), {}), [currentLines]);
  const varianceFor = (line) => {
    const value = counts[line._id]; if (value === null || value === '' || value === undefined) return null;
    const factor = Number(line.conversionFactor || 1); return round6(Number(value) * factor - Number(line.expectedPhysicalOnPremise || 0));
  };
  const print = () => {
    if (!document) return; const popup = window.open('', '_blank'); if (!popup) return message.warning('Allow pop-ups to print the count sheet.');
    const warehouse = document.warehouse?.name || document.warehouse;
    popup.document.write(`<html><head><title>${escapeHtml(document.auditNumber)}</title><style>body{font:12px Arial;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:5px;text-align:left}th{background:#f5f5f5}.warn{color:#b42318;font-weight:bold}</style></head><body><h2>Physical Audit ${escapeHtml(document.auditNumber)}</h2><p>${escapeHtml(warehouse)} · ${escapeHtml(document.scope)} · Baseline ${escapeHtml(new Date(document.baselineAt).toLocaleString('en-IN'))}</p><table><tr><th>Product</th><th>Shade / Batch</th><th>Owned</th><th>Transit</th><th>On-premise</th><th>Available</th><th>Reserved / Blocked / Damaged / Sample</th><th>Count</th><th>Variance</th></tr>${currentLines.map((line) => `<tr><td>${escapeHtml(`${line.product?.productCode || ''} ${line.product?.itemName || line.product}`)}</td><td>${escapeHtml(`${line.shade || '—'} / ${line.batch || '—'}`)}</td><td>${qty(line.expectedOwnedTotal)}</td><td>${qty(line.transitQty)}</td><td>${qty(line.expectedPhysicalOnPremise)}</td><td>${qty(line.baselineSnapshot?.availableQty)}</td><td>${qty(line.baselineSnapshot?.reservedQty)} / ${qty(line.baselineSnapshot?.blockedQty)} / ${qty(line.baselineSnapshot?.damagedQty)} / ${qty(line.baselineSnapshot?.sampleQty)}</td><td>${line.physicalCount ?? ''}</td><td class="${line.recountRequired ? 'warn' : ''}">${line.recountRequired ? 'RECOUNT' : qty(line.variance)}</td></tr>`).join('')}</table><p>Submission freezes this sheet. Approval—not submission—posts stock.</p></body></html>`);
    popup.document.close(); setTimeout(() => { popup.print(); popup.close(); }, 300);
  };

  const listColumns = [
    { title: 'Audit', dataIndex: 'auditNumber', render: (value, record) => <Button type="link" className="p-0" onClick={() => openDocument(record)}>{value}</Button> },
    { title: 'Status', dataIndex: 'status', width: 105, render: (value) => <Tag color={STATUS_COLORS[value]}>{value?.toUpperCase()}</Tag> },
    { title: 'Warehouse', dataIndex: 'warehouse', render: (value) => value?.name || value },
    { title: 'Scope', dataIndex: 'scope', render: (value) => value?.replaceAll('_', ' ') },
    { title: 'Lines', dataIndex: 'lines', width: 70, render: (value) => value?.length || 0 },
    { title: 'M / S / E', render: (_, row) => `${row.matchedCount || 0} / ${row.shortCount || 0} / ${row.excessCount || 0}` },
    { title: 'Variance', dataIndex: 'totalVariance', render: (value) => <span className={Number(value) < 0 ? 'text-red-600' : Number(value) > 0 ? 'text-orange-600' : ''}>{Number(value) > 0 ? '+' : ''}{qty(value)}</span> },
    { title: 'Maker', dataIndex: 'createdBy', render: actor },
    { title: 'Actions', fixed: 'right', width: 250, render: (_, record) => <Space wrap>
      <Tooltip title="Open durable count sheet"><Button size="small" icon={<EyeOutlined />} onClick={() => openDocument(record)} /></Tooltip>
      {record.status === 'draft' && canCount && <Button size="small" icon={<AuditOutlined />} onClick={() => openDocument(record, 'count')}>Count</Button>}
      {record.status === 'draft' && canSubmit && <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => openDocument(record, 'count')}>Submit</Button>}
      {record.status === 'submitted' && canCount && record.lines?.some((line) => line.recountRequired) && <Button size="small" danger icon={<WarningOutlined />} onClick={() => openDocument(record, 'count')}>Recount</Button>}
      {record.status === 'submitted' && canApprove && <><Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => action(record, 'approve')}>Approve</Button><Button size="small" danger icon={<StopOutlined />} onClick={() => action(record, 'reject')}>Reject</Button></>}
      {record.status === 'approved' && canReverse && <Button size="small" danger icon={<UndoOutlined />} onClick={() => action(record, 'reverse')}>Reverse</Button>}
    </Space> },
  ];
  const countColumns = [
    { title: 'Product / exact bucket', width: 240, render: (_, line) => <div><div className="font-medium">{line.product?.itemName || line.product}</div><div className="text-xs font-mono text-gray-500">{line.product?.productCode || ''} · {line.shade || '—'} · {line.batch || '—'}</div></div> },
    { title: 'Baseline', width: 235, render: (_, line) => <div className="text-xs leading-5"><div><b>Owned {qty(line.expectedOwnedTotal)}</b> − transit {qty(line.transitQty)} = <b>{qty(line.expectedPhysicalOnPremise)} on-premise</b></div><div>Available {qty(line.baselineSnapshot?.availableQty)} · Reserved {qty(line.baselineSnapshot?.reservedQty)}</div><div>Blocked {qty(line.baselineSnapshot?.blockedQty)} · Damaged {qty(line.baselineSnapshot?.damagedQty)} · Sample {qty(line.baselineSnapshot?.sampleQty)}</div></div> },
    { title: 'Physical count', width: 185, render: (_, line) => mode === 'count' ? <Space.Compact block><InputNumber disabled={!canCount || (document?.status === 'submitted' && !line.recountRequired)} stringMode min="0" precision={6} value={counts[line._id]} onChange={(value) => setCounts((current) => ({ ...current, [line._id]: value }))} className="w-full"/><Button disabled>{line.enteredUnit || line.baseUnit}</Button></Space.Compact> : `${qty(line.physicalCount)} ${line.enteredUnit}` },
    { title: 'Variance preview', width: 125, render: (_, line) => { const value = mode === 'count' ? varianceFor(line) : line.variance; return value === null ? 'Not counted' : <Tag color={value === 0 ? 'green' : value < 0 ? 'red' : 'orange'}>{value > 0 ? '+' : ''}{qty(value)} {line.baseUnit}</Tag>; } },
    { title: 'Classification', width: 120, render: (_, line) => <Space direction="vertical" size={2}><Tag color={CLASS_COLORS[line.classification]}>{line.classification?.replace('_', ' ')}</Tag>{line.recountRequired && <Tag icon={<WarningOutlined />} color="red">RECOUNT REQUIRED</Tag>}</Space> },
    { title: 'Journal / movement', width: 250, render: (_, line) => <div className="text-[11px] break-all"><div>Submission tail: {line.submissionJournalTail?.operationKey || 'No prior movement'}</div><div>Posted: {line.movement || 'Not posted'}</div><div>{line.operationKey || ''}</div>{line.reversalMovement && <div>Reversed by {line.reversalMovement}</div>}</div> },
  ];

  return <div className="space-y-4">
    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3"><div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><AuditOutlined className="text-orange-500"/>Physical Stock Audits</h1><p className="text-sm text-gray-500">Durable count sheets use owned total minus transit as physical on-premise. Submission never posts stock.</p></div><Space><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>{canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New audit</Button>}</Space></div>
    <Alert type="info" showIcon message="Journal-tail protection" description="If stock moves after baseline or submission, affected lines are marked recount required and approval returns a conflict instead of silently rebasing."/>
    <Row gutter={[12, 12]}>{['draft', 'submitted', 'approved', 'rejected', 'reversed'].map((status) => <Col xs={12} sm={8} lg={4} key={status}><Card size="small"><Statistic title={status.toUpperCase()} value={stats[status]?.count || 0} valueStyle={{ fontSize: 20 }}/></Card></Col>)}</Row>
    <Card size="small"><Space wrap><Input allowClear placeholder="Audit number" value={filters.search} onChange={(event) => setFilters((value) => ({ ...value, search: event.target.value, page: 1 }))}/><Select allowClear placeholder="Warehouse" value={filters.warehouse} options={warehouseChoices} onChange={(warehouse) => setFilters((value) => ({ ...value, warehouse, page: 1 }))}/><Select allowClear placeholder="Status" value={filters.status} options={Object.keys(STATUS_COLORS).map((status) => ({ value: status, label: status.toUpperCase() }))} onChange={(status) => setFilters((value) => ({ ...value, status, page: 1 }))}/></Space></Card>
    <Card bodyStyle={{ padding: 0 }}><Table rowKey="_id" columns={listColumns} dataSource={rows} loading={loading || actionLoading} scroll={{ x: 1150 }} pagination={{ current: pagination.currentPage, pageSize: pagination.itemsPerPage || 20, total: pagination.totalItems, showSizeChanger: true }} onChange={(page) => setFilters((value) => ({ ...value, page: page.current, limit: page.pageSize }))} locale={{ emptyText: <Empty description="No physical audits"/> }}/></Card>

    <Modal open={createOpen} onCancel={closeCreate} onOk={createAudit} confirmLoading={actionLoading} okText="Create count sheet" title="Create physical audit" width={760}>
      <Alert className="mb-4" type="warning" showIcon message="Creating a sheet records a baseline only; it does not post stock."/>
      <Row gutter={[12, 12]}><Col xs={24} md={12}><label className="text-sm font-medium">Warehouse *</label><Select className="w-full" value={createForm.warehouse} options={warehouseChoices} onChange={(warehouse) => { setCreateForm((value) => ({ ...value, warehouse, stockIds: [] })); loadScopeStock(warehouse); }}/></Col><Col xs={24} md={12}><label className="text-sm font-medium">Scope *</label><Select className="w-full" value={createForm.scope} options={[{ value: 'full_warehouse', label: 'Full warehouse (all lines required)' }, { value: 'cycle_count', label: 'Cycle count' }, { value: 'spot_check', label: 'Spot check' }]} onChange={(scope) => setCreateForm((value) => ({ ...value, scope, stockIds: [] }))}/></Col>{createForm.scope !== 'full_warehouse' && <Col span={24}><label className="text-sm font-medium">Exact stock buckets *</label><Select mode="multiple" loading={scopeLoading} maxTagCount="responsive" className="w-full" value={createForm.stockIds} options={stockChoices} onChange={(stockIds) => setCreateForm((value) => ({ ...value, stockIds }))} placeholder="Select products/shade/batch buckets"/></Col>}<Col span={24}><label className="text-sm font-medium">Audit note</label><Input.TextArea rows={2} value={createForm.remarks} onChange={(event) => setCreateForm((value) => ({ ...value, remarks: event.target.value }))}/></Col></Row>
    </Modal>

    <Modal open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width="min(1500px, 97vw)" destroyOnHidden title={`${document?.auditNumber || ''} · ${mode === 'count' ? 'Count sheet' : 'Audit details'}`}>
      {document && <><Descriptions size="small" bordered column={{ xs: 1, md: 4 }} className="mb-3"><Descriptions.Item label="Status"><Tag color={STATUS_COLORS[document.status]}>{document.status}</Tag></Descriptions.Item><Descriptions.Item label="Warehouse">{document.warehouse?.name || document.warehouse}</Descriptions.Item><Descriptions.Item label="Scope">{document.scope?.replaceAll('_', ' ')}</Descriptions.Item><Descriptions.Item label="Baseline">{new Date(document.baselineAt).toLocaleString('en-IN')}</Descriptions.Item><Descriptions.Item label="Maker">{actor(document.createdBy)}</Descriptions.Item><Descriptions.Item label="Submitter">{actor(document.submittedBy)}</Descriptions.Item><Descriptions.Item label="Approver">{actor(document.approvedBy)}</Descriptions.Item><Descriptions.Item label="Posting version">{document.postingVersion || 0}</Descriptions.Item></Descriptions>
      {document.status === 'submitted' && <Alert className="mb-3" type="warning" showIcon message="Awaiting approval. Counts are frozen and stock is not posted."/>}
      {currentLines.some((line) => line.recountRequired) && <Alert className="mb-3" type="error" showIcon message="Recount required" description="Explicitly recount highlighted lines. Saving a new count acknowledges the conflict and captures a fresh baseline for those lines."/>}
      <Row gutter={[8, 8]} className="mb-3">{['matched', 'short', 'excess', 'not_counted'].map((key) => <Col xs={12} md={6} key={key}><Card size="small"><Statistic title={key.replace('_', ' ').toUpperCase()} value={classified[key] || 0} valueStyle={{ fontSize: 18 }}/></Card></Col>)}</Row>
      <Table rowKey="_id" columns={countColumns} dataSource={currentLines} size="small" pagination={{ pageSize: 50, showSizeChanger: false }} scroll={{ x: 1200, y: 460 }}/>
      <div className="mt-3"><label className="text-sm font-medium">Count note</label><Input.TextArea disabled={mode !== 'count'} rows={2} value={countRemarks} onChange={(event) => setCountRemarks(event.target.value)}/></div>
      <div className="mt-3 flex flex-col sm:flex-row justify-between gap-2"><Button icon={<PrinterOutlined />} onClick={print}>Print</Button><Space wrap><Button onClick={() => setDetailOpen(false)}>Close</Button>{mode === 'count' && ((document.status === 'draft' && canCount) || (document.status === 'submitted' && canCount && currentLines.some((line) => line.recountRequired))) && <Button icon={<SaveOutlined />} loading={actionLoading} onClick={() => saveCounts()}>Save {document.status === 'submitted' ? 'recount & reopen' : 'counts'}</Button>}{mode === 'count' && document.status === 'draft' && canSubmit && <Button type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={submit}>Save & submit</Button>}</Space></div></>}
    </Modal>
  </div>;
}
