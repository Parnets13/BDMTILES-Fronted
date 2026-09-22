import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert, Button, Card, Checkbox, Col, DatePicker, Divider, Empty, Input, InputNumber, Modal, Row,
  Select, Space, Spin, Statistic, Table, Tag, Timeline, Tooltip, message,
} from 'antd';
import {
  CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined,
  EyeOutlined, FileAddOutlined, FileDoneOutlined, LockOutlined, PlusOutlined, ReloadOutlined,
  SearchOutlined, ShoppingOutlined, ThunderboltOutlined, TruckOutlined,
} from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_COLORS = {
  submitted: 'orange', approved: 'green', partially_processed: 'geekblue', awaiting_dealer: 'purple',
  awaiting_stock: 'cyan', quotation_linked: 'blue', rejected: 'red', cancelled: 'default',
};
const SHORTFALL_COLORS = {
  awaiting_dealer: 'purple', needs_reconfirmation: 'volcano', accepted: 'green',
  rejected: 'red', closed: 'default', none: 'default',
};
const SHORTFALL_LABELS = {
  awaiting_dealer: 'Waiting for dealer response',
  needs_reconfirmation: 'Dealer changed the quantity — re-confirm the date',
  accepted: 'Dealer accepted',
  rejected: 'Dealer declined',
  closed: 'Settled',
};
const qtyText = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
// Processing a request is one action: it approves the demand, reserves everything in
// stock as an order, and asks the dealer about the rest. A request that was approved
// separately beforehand can still be processed from there.
const PROCESSABLE = new Set(['submitted', 'approved']);
// The list endpoint returns the raw rounds, so the open one can be read without a
// second request. A superseded round is not open: it has been replaced by a newer
// offer and must not be presented as the current one.
const openRound = (record) => {
  const rounds = record?.shortfallRounds || [];
  const last = rounds[rounds.length - 1];
  return last && last.outcome !== 'superseded' ? last : null;
};
const label = value => String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const date = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
// The request itself is editable only before a quotation exists; afterwards the
// products and quantities are frozen by the quotation contract.
const EDITABLE_STATUSES = new Set(['submitted', 'approved']);

const DealerOrderRequests = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canApprove = hasPermission('dealer.order_request.approve');
  const canCreateQuotation = hasPermission('quotation.management');
  // Committing stock and raising the order needs the same rights the server asks
  // for, so the button is not offered to someone who would only get a 403.
  const canProcessStock = canCreateQuotation
    && hasPermission('sales.order.create')
    && hasPermission('sales.order.approve');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('submitted');
  const [stats, setStats] = useState({});
  const [viewRequest, setViewRequest] = useState(null);
  const [rejectRequest, setRejectRequest] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [editRequest, setEditRequest] = useState(null);
  const [processRequest, setProcessRequest] = useState(null);
  const [reofferRequest, setReofferRequest] = useState(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await salesService.getDealerOrderRequests({
        page: pagination.current,
        limit: pagination.pageSize,
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      if (response.success) {
        setRequests(response.data || []);
        setPagination(current => ({ ...current, total: response.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  const fetchStats = useCallback(() => {
    salesService.getDealerOrderRequestStats()
      .then(response => { if (response.success) setStats(response.data || {}); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const refresh = () => { fetchRequests(); fetchStats(); };

  const openQuotationBuilder = requestId =>
    navigate(`/sales-purchase/quotation-manager?${new URLSearchParams({ dealerOrderRequest: requestId, create: '1' })}`);
  const openQuotation = quotationId =>
    navigate(`/sales-purchase/quotation-manager?${new URLSearchParams({ quotation: quotationId })}`);

  // Approve, then let the server price and build the quotation from the approved
  // lines, then hand the user straight to the result. The dealer's products and
  // quantities carry across untouched — the prefill is the approved set, and the
  // backend re-checks it against the approval fingerprint before accepting.
  const approveAndQuote = async (record) => {
    setActionId(record._id);
    try {
      const approved = await salesService.approveDealerOrderRequest(record._id, { revision: record.revision });
      if (!approved.success) throw new Error(approved.message || 'Approval failed.');

      const prefill = await salesService.getDealerOrderRequestQuotationPrefill(record._id);
      if (prefill.alreadyLinked) {
        message.info(`${record.requestNumber} already has quotation ${prefill.data?.quotation?.quotationNumber || ''}.`);
        openQuotation(prefill.data.quotation._id);
        return;
      }
      const draft = prefill.data?.quotation;
      if (!draft) throw new Error('Could not read the approved request lines.');

      const today = dayjs();
      const created = await salesService.createQuotation({
        sourceDealerOrderRequest: record._id,
        dealer: draft.dealer,
        customerType: 'dealer',
        quotationDate: today.format('YYYY-MM-DD'),
        validUntil: today.add(30, 'day').format('YYYY-MM-DD'),
        remarks: draft.remarks || '',
        items: (draft.items || []).map(item => ({
          product: item.product,
          unit: item.unit,
          quantity: Number(item.quantity),
          sqft: item.sqft || undefined,
        })),
      });
      if (!created.success) throw new Error(created.message || 'Quotation could not be created.');
      message.success(`${record.requestNumber} approved. Quotation ${created.data.quotationNumber} created.`);
      openQuotation(created.data._id);
    } catch (error) {
      // Approval may well have succeeded before the quotation step failed. That
      // leaves the request in "approved", which is a valid resting state — the
      // Create Quotation action picks it up from there.
      message.error(error.message || 'Could not complete the conversion.');
      refresh();
    } finally { setActionId(null); }
  };

  const handleApproveOnly = async (record) => {
    setActionId(record._id);
    try {
      const response = await salesService.approveDealerOrderRequest(record._id, { revision: record.revision });
      if (response.success) {
        message.success(response.message || `${record.requestNumber} approved`);
        refresh();
      }
    } catch (error) { message.error(error.message); refresh(); }
    finally { setActionId(null); }
  };

  // The stock the dealer agreed to wait for has arrived. The server re-checks it and
  // only raises the order if the reservation succeeds, so a refusal here is a normal
  // outcome rather than an error to hide.
  const confirmPendingStock = (record) => {
    Modal.confirm({
      title: `Reserve the pending quantity on ${record.requestNumber}?`,
      content: `Stock is re-checked now. If the full agreed quantity on ${record.pendingStockQuotation?.quotationNumber || 'the pending quotation'} is available it is reserved and an order is raised. If it is still short, nothing is created.`,
      okText: 'Check stock and reserve',
      onOk: async () => {
        setActionId(record._id);
        try {
          const response = await salesService.processDealerOrderPendingStock(record._id);
          if (!response.success) throw new Error(response.message || 'Could not process the pending stock.');
          message.success(response.message);
          refresh();
        } catch (error) {
          message.error(error.message || 'Could not process the pending stock.');
          refresh();
        } finally { setActionId(null); }
      },
    });
  };

  const handleReject = async () => {
    const reason = rejectReason.trim();
    if (!reason) { message.error('Enter a rejection reason'); return; }
    setActionId(rejectRequest._id);
    try {
      const response = await salesService.rejectDealerOrderRequest(rejectRequest._id, {
        revision: rejectRequest.revision,
        reason,
      });
      if (response.success) {
        message.success(response.message || `${rejectRequest.requestNumber} rejected`);
        setRejectRequest(null);
        setRejectReason('');
        refresh();
      }
    } catch (error) { message.error(error.message); refresh(); }
    finally { setActionId(null); }
  };

  const outcomeCell = (record) => {
    const orders = (record.outcomes || []).map(entry => entry.salesOrder).filter(Boolean);
    if (orders.length || record.sourceSalesOrder) {
      const list = orders.length ? orders : [record.sourceSalesOrder];
      return (
        <div className="space-y-0.5">
          {list.map(order => (
            <div key={order._id} className="font-mono text-xs font-medium text-emerald-700">
              {order.orderNumber}
              <span className="ml-1 font-sans text-[11px] text-gray-400">{money(order.grandTotal)}</span>
            </div>
          ))}
          {record.pendingStockQuotation?.quotationNumber ? (
            <div className="font-sans text-[11px] text-amber-600">+ {record.pendingStockQuotation.quotationNumber} pending stock</div>
          ) : null}
        </div>
      );
    }
    if (record.pendingStockQuotation?.quotationNumber) {
      return (
        <button
          type="button"
          className="text-left font-mono text-xs font-medium text-amber-600 hover:underline"
          onClick={() => openQuotation(record.pendingStockQuotation._id)}
        >
          {record.pendingStockQuotation.quotationNumber}
          <div className="font-sans text-[11px] text-gray-400">Pending stock</div>
        </button>
      );
    }
    if (record.sourceQuotation?.quotationNumber) {
      return (
        <button
          type="button"
          className="text-left font-mono text-xs font-medium text-blue-600 hover:underline"
          onClick={() => openQuotation(record.sourceQuotation._id)}
        >
          {record.sourceQuotation.quotationNumber}
          <div className="font-sans text-[11px] text-gray-400">{money(record.sourceQuotation.grandTotal)}</div>
        </button>
      );
    }
    if (record.status === 'rejected') return <span className="text-xs text-gray-400">Rejected</span>;
    if (record.status === 'cancelled') return <span className="text-xs text-gray-400">Withdrawn by dealer</span>;
    if (record.status === 'approved') return <span className="text-xs text-green-600">Ready to process</span>;
    return <span className="text-xs text-gray-400">—</span>;
  };

  const columns = [
    { title: 'Request #', dataIndex: 'requestNumber', width: 155, render: (value, record) => (
      <div>
        <span className="font-mono text-xs font-medium text-blue-600">{value}</span>
        {record.editHistory?.length ? <Tooltip title="Lines were adjusted after submission"><Tag color="gold" className="ml-1 text-[10px]">edited</Tag></Tooltip> : null}
      </div>
    ) },
    { title: 'Submitted', dataIndex: 'submittedAt', width: 105, render: date },
    { title: 'Dealer', key: 'dealer', width: 190, render: (_, record) => <div><div className="max-w-[180px] truncate text-sm font-medium">{record.dealerSnapshot?.businessName || record.dealer?.businessName || '—'}</div><div className="text-xs text-gray-400">{record.dealerSnapshot?.dealerCode || record.dealer?.dealerCode || 'No code'}</div></div> },
    { title: 'Sales Executive', dataIndex: 'salesExecutiveName', width: 150, render: (value, record) => value || record.salesExecutive?.name || '—' },
    { title: 'Products', key: 'items', width: 75, align: 'center', render: (_, record) => record.items?.length || 0 },
    { title: 'Status', dataIndex: 'status', width: 150, render: (status, record) => (
      <div className="space-y-1">
        <Tag color={STATUS_COLORS[status]}>{label(status)}</Tag>
        {record.shortfallStatus && !['none', 'closed'].includes(record.shortfallStatus) ? (
          <Tooltip title={SHORTFALL_LABELS[record.shortfallStatus]}>
            <Tag color={SHORTFALL_COLORS[record.shortfallStatus]} className="text-[10px]">
              {record.shortfallStatus === 'needs_reconfirmation' ? 're-confirm date' : label(record.shortfallStatus)}
            </Tag>
          </Tooltip>
        ) : null}
      </div>
    ) },
    { title: 'Order / Quotation', key: 'outcome', width: 165, render: (_, record) => outcomeCell(record) },
    { title: 'Actions', width: 215, fixed: 'right', render: (_, record) => {
      const busy = Boolean(actionId);
      const mine = actionId === record._id;
      return (
        <Space size="small">
          <Tooltip title="View details"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setViewRequest(record)} /></Tooltip>

          {canApprove && EDITABLE_STATUSES.has(record.status) ? (
            <Tooltip title="Edit requested quantities"><Button type="text" size="small" icon={<EditOutlined />} disabled={busy} onClick={() => setEditRequest(record)} /></Tooltip>
          ) : null}

          {canApprove && record.status === 'submitted' ? <>
            {/* Approve-and-quote skips the stock split, so it is only offered to
                someone who cannot process stock anyway. Everyone else uses the
                single Process action, which approves and reserves in one go. */}
            {canCreateQuotation && !canProcessStock ? (
              <Tooltip title="Approve and create the quotation in one step">
                <Button type="text" size="small" className="text-green-600" icon={<ThunderboltOutlined />} loading={mine} disabled={busy && !mine} onClick={() => approveAndQuote(record)} />
              </Tooltip>
            ) : null}
            <Tooltip title="Approve only, without reserving stock yet">
              <Button type="text" size="small" className="text-green-600" icon={<CheckCircleOutlined />} loading={mine && !canCreateQuotation} disabled={busy && !mine} onClick={() => handleApproveOnly(record)} />
            </Tooltip>
            <Tooltip title="Reject"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} disabled={busy} onClick={() => { setRejectRequest(record); setRejectReason(''); }} /></Tooltip>
          </> : null}

          {canProcessStock && PROCESSABLE.has(record.status) ? (
            <Tooltip title={record.status === 'submitted'
              ? 'Approve, reserve everything in stock as an order, and ask the dealer about the rest'
              : 'Reserve everything in stock as an order and ask the dealer about the rest'}>
              <Button type="text" size="small" className="text-emerald-600" icon={<LockOutlined />} disabled={busy} onClick={() => setProcessRequest(record)} />
            </Tooltip>
          ) : null}

          {canProcessStock && record.shortfallStatus === 'closed' && record.pendingStockQuotation?._id
            && record.pendingStockQuotation.status === 'pending_stock' ? (
              <Tooltip title="Stock has arrived — reserve the pending quantity and raise its order">
                <Button type="text" size="small" className="text-cyan-600" icon={<TruckOutlined />} loading={mine} disabled={busy && !mine} onClick={() => confirmPendingStock(record)} />
              </Tooltip>
            ) : null}

          {canApprove && record.shortfallStatus === 'needs_reconfirmation' ? (
            <Tooltip title="The dealer increased a quantity — confirm the new expected date">
              <Button type="text" size="small" className="text-orange-600" icon={<ClockCircleOutlined />} disabled={busy} onClick={() => setReofferRequest(record)} />
            </Tooltip>
          ) : null}

          {canCreateQuotation && !canProcessStock && record.status === 'approved' ? (
            <Tooltip title="Create a quotation manually"><Button type="text" size="small" className="text-blue-600" icon={<FileAddOutlined />} disabled={busy} onClick={() => openQuotationBuilder(record._id)} /></Tooltip>
          ) : null}

          {record.status === 'quotation_linked' && record.sourceQuotation?._id ? (
            <Tooltip title="Open quotation"><Button type="text" size="small" className="text-blue-600" icon={<FileDoneOutlined />} onClick={() => openQuotation(record.sourceQuotation._id)} /></Tooltip>
          ) : null}
        </Space>
      );
    } },
  ];

  return <div>
    <div className="mb-5 flex items-center justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800"><ShoppingOutlined className="text-xl text-blue-600" /> Dealer Order Requests</h1><p className="mt-0.5 text-sm text-gray-500">Review dealer demand, adjust it if needed, then convert it into a quotation with authoritative pricing</p></div>
    </div>

    <Row gutter={[12, 12]} className="mb-4">
      {[
        ['Total', stats.total, '#1890ff'], ['Submitted', stats.submitted, '#fa8c16'], ['Approved', stats.approved, '#52c41a'],
        ['Part Ordered', stats.partially_processed, '#2f54eb'], ['With Dealer', stats.awaiting_dealer, '#722ed1'],
        ['Awaiting Stock', stats.awaiting_stock, '#13c2c2'], ['Completed', stats.quotation_linked, '#1677ff'],
        ['Rejected', stats.rejected, '#f5222d'], ['Cancelled', stats.cancelled, '#8c8c8c'],
      ].map(([title, value, color]) => <Col xs={12} sm={8} lg={4} key={title}><Card size="small"><Statistic title={title} value={value || 0} valueStyle={{ color }} /></Card></Col>)}
    </Row>

    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search request, dealer or executive" prefix={<SearchOutlined className="text-gray-400" />} value={search} onChange={event => { setSearch(event.target.value); setPagination(current => ({ ...current, current: 1 })); }} className="w-72" allowClear />
        <Select placeholder="Status" allowClear value={statusFilter || undefined} onChange={value => { setStatusFilter(value || ''); setPagination(current => ({ ...current, current: 1 })); }} className="w-44" options={Object.keys(STATUS_COLORS).map(status => ({ value: status, label: label(status) }))} />
        <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter('submitted'); setPagination(current => ({ ...current, current: 1 })); fetchStats(); }}>Reset</Button>
      </div>
    </div>

    <div className="rounded-lg border border-gray-200 bg-white">
      <Table columns={columns} dataSource={requests} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1200 }} pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }} onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))} />
    </div>

    <ViewRequestModal request={viewRequest} onClose={() => setViewRequest(null)} onOpenQuotation={openQuotation} />

    <ProcessStockModal
      request={processRequest}
      onClose={() => setProcessRequest(null)}
      onDone={(response) => {
        setProcessRequest(null);
        message.success(response.message || 'Request processed.');
        refresh();
      }}
    />

    <ReofferShortfallModal
      request={reofferRequest}
      onClose={() => setReofferRequest(null)}
      onDone={(response) => {
        setReofferRequest(null);
        message.success(response.message || 'New offer sent to the dealer.');
        refresh();
      }}
    />

    <EditRequestModal
      request={editRequest}
      onClose={() => setEditRequest(null)}
      onSaved={(updated) => {
        setEditRequest(null);
        message.success(`${updated.requestNumber} updated`);
        refresh();
      }}
    />

    <Modal title={`Reject ${rejectRequest?.requestNumber || 'request'}?`} open={Boolean(rejectRequest)} onCancel={() => { setRejectRequest(null); setRejectReason(''); }} onOk={handleReject} okText="Reject Request" okButtonProps={{ danger: true, loading: actionId === rejectRequest?._id }} destroyOnHidden>
      <p className="mb-2 text-sm text-gray-500">The dealer and the Sales Executive both see this reason in their apps.</p>
      <Input.TextArea rows={4} maxLength={1000} showCount value={rejectReason} onChange={event => setRejectReason(event.target.value)} placeholder="Reason for rejection" />
    </Modal>
  </div>;
};

// ── Shortfall answers (shared by processing and re-offering) ─────────────────
//
// Every short line needs either an expected availability date or an explicit "not
// available" with a reason. The server enforces the same rule; mirroring it here
// means the user finds out before they submit rather than after.
const seedAnswers = (lines, previous = {}) => Object.fromEntries(
  lines.filter(line => Number(line.shortfallQty) > 0).map((line) => {
    const carried = previous[line.product];
    return [line.product, carried || { expectedDate: null, noEta: false, staffRemark: '' }];
  }),
);

const answersIncomplete = (lines, answers) => lines
  .filter(line => Number(line.shortfallQty) > 0)
  .some((line) => {
    const answer = answers[line.product] || {};
    if (answer.noEta) return !String(answer.staffRemark || '').trim();
    return !answer.expectedDate || answer.expectedDate.isBefore(dayjs().startOf('day'), 'day');
  });

const answersPayload = (lines, answers) => lines
  .filter(line => Number(line.shortfallQty) > 0)
  .map((line) => {
    const answer = answers[line.product] || {};
    return {
      product: line.product,
      noEta: Boolean(answer.noEta),
      ...(answer.noEta ? {} : { expectedDate: answer.expectedDate.format('YYYY-MM-DD') }),
      staffRemark: String(answer.staffRemark || '').trim(),
    };
  });

const ShortfallAnswerTable = ({ lines, answers, onChange, showReserved = true }) => {
  const update = (product, patch) => onChange({ ...answers, [product]: { ...answers[product], ...patch } });
  return (
    <Table
      size="small"
      pagination={false}
      rowKey="product"
      dataSource={lines.filter(line => Number(line.shortfallQty) > 0)}
      columns={[
        { title: 'Product', render: (_, line) => (
          <div>
            <div className="font-medium">{line.productName}</div>
            <div className="text-xs text-gray-400">{line.productCode || 'No code'}</div>
          </div>
        ) },
        { title: 'Asked', width: 80, align: 'right', render: (_, line) => <span className="text-xs">{qtyText(line.requestedQty)}</span> },
        ...(showReserved ? [{ title: 'Reserving now', width: 105, align: 'right', render: (_, line) => (
          <span className="text-xs font-medium text-emerald-700">{qtyText(line.allocatedQty)}</span>
        ) }] : []),
        { title: 'Short', width: 80, align: 'right', render: (_, line) => (
          <span className="text-xs font-semibold text-amber-600">{qtyText(line.shortfallQty)}</span>
        ) },
        { title: 'Expected by', width: 190, render: (_, line) => {
          const answer = answers[line.product] || {};
          return (
            <div className="space-y-1">
              <DatePicker
                className="w-full"
                size="small"
                format="DD/MM/YYYY"
                disabled={answer.noEta}
                value={answer.expectedDate}
                disabledDate={current => current && current.isBefore(dayjs().startOf('day'), 'day')}
                onChange={value => update(line.product, { expectedDate: value })}
                status={!answer.noEta && !answer.expectedDate ? 'error' : ''}
                placeholder="Availability date"
              />
              <Checkbox
                checked={Boolean(answer.noEta)}
                onChange={event => update(line.product, { noEta: event.target.checked, expectedDate: null })}
              >
                <span className="text-[11px]">No ETA / not available</span>
              </Checkbox>
            </div>
          );
        } },
        { title: 'Note to dealer', width: 210, render: (_, line) => {
          const answer = answers[line.product] || {};
          return (
            <Input
              size="small"
              maxLength={500}
              value={answer.staffRemark}
              onChange={event => update(line.product, { staffRemark: event.target.value })}
              placeholder={answer.noEta ? 'Required — explain why' : 'Optional'}
              status={answer.noEta && !String(answer.staffRemark || '').trim() ? 'error' : ''}
            />
          );
        } },
      ]}
    />
  );
};

// ── Process stock: reserve what is available, ask about the rest ─────────────
//
// Opening this creates the request's quotation server-side and returns the real
// FIFO split plan with a planHash. Submitting echoes that hash back; if stock moved
// in between, the server refuses and hands back a fresh plan instead of quietly
// reserving a different quantity than the one on screen.
const ProcessStockModal = ({ request, onClose, onDone }) => {
  const [plan, setPlan] = useState(null);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [offerRemark, setOfferRemark] = useState('');
  const [stale, setStale] = useState(false);
  const [failure, setFailure] = useState('');

  const load = useCallback(async (id) => {
    setLoading(true);
    setFailure('');
    try {
      const response = await salesService.getDealerOrderStockPlan(id);
      if (!response.success) throw new Error(response.message || 'Could not read the stock position.');
      setPlan(response.data.plan);
      setAnswers(seedAnswers(response.data.plan.lines));
      setStale(false);
    } catch (error) {
      setPlan(null);
      setFailure(error.message || 'Could not read the stock position.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (!request) { setPlan(null); setAnswers({}); setOfferRemark(''); setStale(false); setFailure(''); return; }
    load(request._id);
  }, [request, load]);

  const lines = plan?.lines || [];
  const shortLines = lines.filter(line => Number(line.shortfallQty) > 0);
  const incomplete = answersIncomplete(lines, answers);

  const submit = async () => {
    if (incomplete) { message.error('Give an expected date, or mark the line as not available with a reason.'); return; }
    setSubmitting(true);
    try {
      const response = await salesService.processDealerOrderRequest(request._id, {
        planHash: plan.planHash,
        shortfall: answersPayload(lines, answers),
        offerRemark: offerRemark.trim(),
      });
      if (!response.success) throw new Error(response.message || 'Could not process the request.');
      onDone(response);
    } catch (error) {
      // Stock moved between reading the plan and committing it. Show the new
      // numbers and make the user confirm them; nothing was reserved.
      const fresh = error.code === 'SPLIT_PLAN_CHANGED' ? error.details : null;
      if (fresh?.plan) {
        const next = {
          planHash: fresh.plan.planHash,
          willSplit: fresh.plan.willSplit,
          canHold: fresh.plan.canHold,
          totals: fresh.plan.totals,
          lines: fresh.lines || [],
        };
        setPlan(next);
        setAnswers(current => seedAnswers(next.lines, current));
        setStale(true);
      } else {
        setFailure(error.message || 'Could not process the request.');
      }
    } finally { setSubmitting(false); }
  };

  return (
    <Modal
      title={request ? `Process stock for ${request.requestNumber}` : 'Process stock'}
      open={Boolean(request)}
      onCancel={onClose}
      width={980}
      destroyOnHidden
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="refresh" icon={<ReloadOutlined />} disabled={loading || submitting} onClick={() => load(request._id)}>
          Re-check stock
        </Button>,
        <Button
          key="go"
          type="primary"
          loading={submitting}
          disabled={loading || !plan || (!plan.canHold && !shortLines.length) || incomplete}
          onClick={submit}
        >
          {plan?.canHold
            ? shortLines.length ? 'Reserve available & ask dealer' : 'Reserve & create order'
            : 'Ask dealer about the pending quantity'}
        </Button>,
      ]}
    >
      {loading ? <div className="py-10 text-center"><Spin /></div> : null}

      {!loading && failure ? <Alert type="error" showIcon message="Cannot process this request" description={failure} /> : null}

      {!loading && plan ? <div className="mt-2 space-y-4">
        {stale ? (
          <Alert
            type="warning"
            showIcon
            message="Stock changed while you were deciding"
            description="Nothing was reserved. These are the current numbers — check them and confirm again."
          />
        ) : null}

        <Alert
          type={plan.canHold ? (plan.willSplit ? 'warning' : 'success') : 'error'}
          showIcon
          message={plan.canHold
            ? plan.willSplit
              ? `${qtyText(plan.totals?.availableQty)} can be reserved now; ${qtyText(plan.totals?.shortfallQty)} is short`
              : 'Everything requested is available'
            : 'None of the requested quantity is available'}
          description={plan.canHold
            ? plan.willSplit
              ? 'Confirming reserves the available part and raises its Sales Order straight away — the dealer is not asked to confirm that again. The short quantity is put to them as a question, and only becomes a pending-stock quotation if they agree.'
              : 'Confirming reserves the full quantity and raises its Sales Order. There is nothing to ask the dealer.'
            : 'No Sales Order is created. The whole quantity is put to the dealer with your expected date, and only becomes a pending-stock quotation if they agree.'}
        />

        {request?.status === 'submitted' ? (
          <Alert
            type="info"
            showIcon
            message="This also approves the request"
            description="Reviewing the demand and committing stock to it is one action. The products and quantities are frozen at the same moment they are reserved."
          />
        ) : null}

        <Table
          size="small"
          pagination={false}
          rowKey="product"
          dataSource={lines}
          columns={[
            { title: 'Product', render: (_, line) => (
              <div>
                <div className="font-medium">{line.productName}</div>
                <div className="text-xs text-gray-400">{line.productCode || 'No code'}</div>
              </div>
            ) },
            { title: 'Requested', width: 100, align: 'right', render: (_, line) => `${qtyText(line.requestedQty)} ${line.unit || ''}` },
            { title: 'Available now', width: 115, align: 'right', render: (_, line) => (
              <span className={Number(line.allocatedQty) > 0 ? 'font-medium text-emerald-700' : 'text-gray-400'}>
                {qtyText(line.allocatedQty)}
              </span>
            ) },
            { title: 'Short', width: 90, align: 'right', render: (_, line) => (
              Number(line.shortfallQty) > 0
                ? <span className="font-semibold text-amber-600">{qtyText(line.shortfallQty)}</span>
                : <CheckCircleOutlined className="text-emerald-600" />
            ) },
          ]}
        />

        {shortLines.length ? <>
          <Divider className="my-2" orientation="left" plain>
            When will the short quantity be available?
          </Divider>
          <p className="-mt-2 text-xs text-gray-500">
            This is an expected date, not a delivery promise. The dealer can accept it, change the quantity, or decline.
          </p>
          <ShortfallAnswerTable lines={lines} answers={answers} onChange={setAnswers} />
          <div>
            <div className="mb-1 text-xs text-gray-500">Message to the dealer (optional)</div>
            <Input.TextArea rows={2} maxLength={1000} value={offerRemark} onChange={event => setOfferRemark(event.target.value)} />
          </div>
        </> : null}
      </div> : null}
    </Modal>
  );
};

// ── Re-confirm a date after the dealer changed the quantity ──────────────────
//
// The dealer asked for more than was offered, which can move the availability
// date, so nothing is agreed until a person confirms the new date. Lines the
// dealer declined are dropped; the rest carry forward at the quantity they asked
// for. The already-reserved Sales Order is not involved.
const ReofferShortfallModal = ({ request, onClose, onDone }) => {
  const [answers, setAnswers] = useState({});
  const [offerRemark, setOfferRemark] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const round = request ? openRound(request) : null;
  const lines = useMemo(() => (round?.lines || [])
    .filter(line => line.dealerResponse !== 'rejected')
    .map(line => ({
      product: String(line.product?._id || line.product),
      productName: line.productName,
      productCode: line.productCode,
      unit: line.unit,
      requestedQty: Number(line.requestedQty || 0),
      allocatedQty: Number(line.processedQty || 0),
      shortfallQty: line.dealerResponse === 'changed' && Number(line.dealerQty) > 0
        ? Number(line.dealerQty)
        : Number(line.shortfallQty || 0),
      previousQty: Number(line.shortfallQty || 0),
      previousDate: line.expectedDate,
      dealerRemark: line.dealerRemark || '',
      dealerResponse: line.dealerResponse,
    }))
    .filter(line => line.shortfallQty > 0), [round]);

  useEffect(() => {
    if (!request) { setAnswers({}); setOfferRemark(''); return; }
    setAnswers(seedAnswers(lines));
    setOfferRemark('');
    // lines is derived from request, so request alone is the right trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const incomplete = answersIncomplete(lines, answers);

  const submit = async () => {
    if (incomplete) { message.error('Give an expected date, or mark the line as not available with a reason.'); return; }
    setSubmitting(true);
    try {
      const response = await salesService.offerDealerOrderShortfall(request._id, {
        shortfall: answersPayload(lines, answers),
        offerRemark: offerRemark.trim(),
      });
      if (!response.success) throw new Error(response.message || 'Could not send the new offer.');
      onDone(response);
    } catch (error) { message.error(error.message || 'Could not send the new offer.'); }
    finally { setSubmitting(false); }
  };

  return (
    <Modal
      title={request ? `Re-confirm availability for ${request.requestNumber}` : 'Re-confirm availability'}
      open={Boolean(request)}
      onCancel={onClose}
      onOk={submit}
      okText="Send new offer"
      okButtonProps={{ loading: submitting, disabled: incomplete || !lines.length }}
      width={920}
      destroyOnHidden
    >
      {request ? <div className="mt-4 space-y-4">
        <Alert
          type="info"
          showIcon
          message="The dealer changed what they want from the pending quantity"
          description="Confirm when you can supply the new quantity. The Sales Order already raised for the available stock is unaffected — this only covers what is still pending."
        />

        {round?.dealerRemark ? (
          <div className="rounded bg-gray-50 p-3 text-sm"><span className="text-gray-400">Dealer said: </span>{round.dealerRemark}</div>
        ) : null}

        {!lines.length ? (
          <Empty description="The dealer declined every pending line, so there is nothing left to offer." image={Empty.PRESENTED_IMAGE_SIMPLE} />
        ) : <>
          <Table
            size="small"
            pagination={false}
            rowKey="product"
            dataSource={lines}
            columns={[
              { title: 'Product', render: (_, line) => <div className="font-medium">{line.productName}</div> },
              { title: 'Previously offered', width: 130, align: 'right', render: (_, line) => (
                <div className="text-xs text-gray-500">
                  {qtyText(line.previousQty)}
                  <div className="text-[11px] text-gray-400">{line.previousDate ? date(line.previousDate) : 'no date'}</div>
                </div>
              ) },
              { title: 'Dealer now wants', width: 130, align: 'right', render: (_, line) => (
                <span className="font-semibold text-orange-600">{qtyText(line.shortfallQty)} {line.unit}</span>
              ) },
              { title: 'Their note', render: (_, line) => <span className="text-xs text-gray-500">{line.dealerRemark || '—'}</span> },
            ]}
          />

          <Divider className="my-2" orientation="left" plain>New expected availability</Divider>
          <ShortfallAnswerTable lines={lines} answers={answers} onChange={setAnswers} showReserved={false} />

          <div>
            <div className="mb-1 text-xs text-gray-500">Message to the dealer (optional)</div>
            <Input.TextArea rows={2} maxLength={1000} value={offerRemark} onChange={event => setOfferRemark(event.target.value)} />
          </div>
        </>}
      </div> : null}
    </Modal>
  );
};

// ── Read-only detail ─────────────────────────────────────────────────────────
const ViewRequestModal = ({ request, onClose, onOpenQuotation }) => (
  <Modal title={request ? `Request: ${request.requestNumber}` : 'Request'} open={Boolean(request)} onCancel={onClose} footer={<Button onClick={onClose}>Close</Button>} width={780}>
    {request ? <div className="mt-4 space-y-3 text-sm">
      <Alert
        type={request.status === 'rejected' ? 'error' : request.status === 'quotation_linked' ? 'success' : request.status === 'cancelled' ? 'warning' : 'info'}
        showIcon
        message={label(request.status)}
        description={
          request.status === 'submitted' ? 'Waiting for review. Processing it approves the demand, reserves everything in stock as an order, and asks the dealer about the rest.'
            : request.status === 'approved' ? 'Approved but nothing is reserved yet. Process stock to reserve what is available.'
              : request.status === 'partially_processed' ? 'Part of this request is reserved and ordered. The rest is with the dealer or queued for stock.'
                : request.status === 'awaiting_dealer' ? 'Nothing could be reserved. The dealer has been asked whether they still want it.'
                  : request.status === 'awaiting_stock' ? 'Agreed with the dealer and queued for the next stock arrival. No order exists yet.'
                    : request.status === 'quotation_linked' ? `Linked to ${request.sourceQuotation?.quotationNumber || 'a quotation'}.`
                      : request.status === 'cancelled' ? request.cancellationReason || 'The dealer withdrew this request.'
                        : request.rejectionReason || undefined
        }
      />

      <Row gutter={[16, 8]}>
        <Col span={12}><span className="text-gray-400">Dealer</span><div className="font-medium">{request.dealerSnapshot?.businessName || '—'}</div></Col>
        <Col span={12}><span className="text-gray-400">Sales Executive</span><div className="font-medium">{request.salesExecutiveName || request.salesExecutive?.name || '—'}</div></Col>
        <Col span={12}><span className="text-gray-400">Submitted</span><div>{dateTime(request.submittedAt || request.createdAt)}</div></Col>
        <Col span={12}><span className="text-gray-400">Revision</span><div>{request.revision}</div></Col>
        <Col span={12}><span className="text-gray-400">Deliver to</span><div>{request.deliveryAddress || <span className="text-gray-400">Dealer's default address</span>}</div></Col>
        <Col span={12}><span className="text-gray-400">Preferred delivery</span><div>{request.expectedDeliveryDate ? date(request.expectedDeliveryDate) : <span className="text-gray-400">No preference</span>}</div></Col>
      </Row>

      <Divider className="my-3" />
      <Table size="small" pagination={false} rowKey={(item, index) => `${item.product}-${index}`} dataSource={request.items || []} columns={[
        { title: 'Product', render: (_, item) => <div><div className="font-medium">{item.productName}</div><div className="text-xs text-gray-400">{item.productCode || 'No code'}{item.tileSize ? ` · ${item.tileSize}` : ''}</div></div> },
        { title: 'Boxes', dataIndex: 'boxes', width: 90 },
        { title: 'Pieces', dataIndex: 'pieces', width: 90 },
        { title: 'Sq ft', dataIndex: 'sqft', width: 100 },
      ]} />

      {request.remarks ? <div className="rounded bg-gray-50 p-3"><span className="text-gray-400">Dealer remarks: </span>{request.remarks}</div> : null}
      {request.approvalRemarks ? <div className="rounded bg-green-50 p-3"><span className="text-gray-400">Approval note: </span>{request.approvalRemarks}</div> : null}

      {request.stockPlan?.lines?.length ? <>
        <Divider className="my-3" orientation="left" plain>Stock decision · {dateTime(request.processedAt)}</Divider>
        <Table size="small" pagination={false} rowKey={(line, index) => `${line.product}-${index}`} dataSource={request.stockPlan.lines} columns={[
          { title: 'Product', dataIndex: 'productName' },
          { title: 'Requested', width: 100, align: 'right', render: (_, line) => `${qtyText(line.requestedQty)} ${line.unit || ''}` },
          { title: 'Reserved', width: 95, align: 'right', render: (_, line) => (
            <span className={Number(line.allocatedQty) > 0 ? 'font-medium text-emerald-700' : 'text-gray-400'}>{qtyText(line.allocatedQty)}</span>
          ) },
          { title: 'Short', width: 90, align: 'right', render: (_, line) => (
            Number(line.shortfallQty) > 0
              ? <span className="font-semibold text-amber-600">{qtyText(line.shortfallQty)}</span>
              : <CheckCircleOutlined className="text-emerald-600" />
          ) },
        ]} />
      </> : null}

      {(request.outcomes || []).length ? <>
        <Divider className="my-3" orientation="left" plain>Orders raised</Divider>
        <div className="space-y-1 text-sm">
          {request.outcomes.map((entry, index) => (
            <div key={index} className="flex items-center justify-between rounded bg-emerald-50 px-3 py-2">
              <span>
                <span className="font-mono font-medium text-emerald-800">{entry.salesOrder?.orderNumber || '—'}</span>
                <span className="ml-2 text-xs text-gray-500">from {entry.quotation?.quotationNumber || 'quotation'}</span>
              </span>
              <span className="text-xs">{money(entry.salesOrder?.grandTotal)} · {label(entry.salesOrder?.status)}</span>
            </div>
          ))}
          {request.pendingStockQuotation?.quotationNumber ? (
            <div className="flex items-center justify-between rounded bg-amber-50 px-3 py-2">
              <span>
                <span className="font-mono font-medium text-amber-800">{request.pendingStockQuotation.quotationNumber}</span>
                <span className="ml-2 text-xs text-gray-500">pending stock — not an order yet</span>
              </span>
              <span className="text-xs">{money(request.pendingStockQuotation.grandTotal)}</span>
            </div>
          ) : null}
        </div>
      </> : null}

      {request.shortfallStatus && request.shortfallStatus !== 'none' ? (
        <ShortfallDetail request={request} />
      ) : null}

      {request.editHistory?.length ? <>
        <Divider className="my-3" orientation="left" plain>Changes after submission</Divider>
        <Timeline
          items={request.editHistory.map((entry, index) => ({
            key: index,
            children: (
              <div className="text-xs">
                <div className="text-gray-400">{dateTime(entry.at)} · {entry.byName || 'Staff'}{entry.reason ? ` · ${entry.reason}` : ''}</div>
                {(entry.changes || []).map((change, changeIndex) => (
                  <div key={changeIndex}>
                    {change.type === 'quantity' ? <>Changed <b>{change.productName}</b> from {change.from} to {change.to}</>
                      : change.type === 'added' ? <>Added <b>{change.productName}</b> ({change.to})</>
                        : <>Removed <b>{change.productName}</b> ({change.from})</>}
                  </div>
                ))}
              </div>
            ),
          }))}
        />
      </> : null}

      {request.sourceQuotation?._id ? (
        <Button type="primary" icon={<FileDoneOutlined />} onClick={() => { onClose(); onOpenQuotation(request.sourceQuotation._id); }}>
          Open quotation {request.sourceQuotation.quotationNumber}
        </Button>
      ) : null}
    </div> : null}
  </Modal>
);

// ── Shortfall conversation, read-only ────────────────────────────────────────
const DEALER_RESPONSE_TAGS = {
  pending: ['default', 'Waiting'],
  accepted: ['green', 'Accepted'],
  changed: ['orange', 'Changed'],
  rejected: ['red', 'Declined'],
};

const ShortfallDetail = ({ request }) => {
  const round = openRound(request)
    || (request.shortfallRounds || [])[(request.shortfallRounds || []).length - 1];
  if (!round) return null;
  return <>
    <Divider className="my-3" orientation="left" plain>
      Pending quantity · round {round.round} of {(request.shortfallRounds || []).length}
    </Divider>
    <Alert
      className="mb-3"
      type={request.shortfallStatus === 'needs_reconfirmation' ? 'warning'
        : request.shortfallStatus === 'rejected' ? 'error'
          : request.shortfallStatus === 'closed' ? 'success' : 'info'}
      showIcon
      message={SHORTFALL_LABELS[request.shortfallStatus] || label(request.shortfallStatus)}
      description={round.offerRemark || round.dealerRemark || undefined}
    />
    <Table size="small" pagination={false} rowKey={(line, index) => `${line.product}-${index}`} dataSource={round.lines || []} columns={[
      { title: 'Product', render: (_, line) => (
        <div>
          <div className="font-medium">{line.productName}</div>
          <div className="text-xs text-gray-400">already reserved: {qtyText(line.processedQty)} of {qtyText(line.requestedQty)}</div>
        </div>
      ) },
      { title: 'Pending', width: 85, align: 'right', render: (_, line) => (
        <span className="font-semibold text-amber-600">{qtyText(line.shortfallQty)}</span>
      ) },
      { title: 'Expected', width: 110, render: (_, line) => (
        line.noEta
          ? <Tag color="red" className="text-[10px]">No ETA</Tag>
          : <span className="text-xs">{line.expectedDate ? date(line.expectedDate) : '—'}</span>
      ) },
      { title: 'Our note', render: (_, line) => <span className="text-xs text-gray-500">{line.staffRemark || '—'}</span> },
      { title: 'Dealer', width: 120, render: (_, line) => {
        const [color, text] = DEALER_RESPONSE_TAGS[line.dealerResponse] || DEALER_RESPONSE_TAGS.pending;
        return (
          <div>
            <Tag color={color} className="text-[10px]">{text}</Tag>
            {line.dealerResponse === 'changed' ? <div className="text-xs font-medium text-orange-600">wants {qtyText(line.dealerQty)}</div> : null}
            {Number(line.settledQty) > 0 ? <div className="text-[11px] text-emerald-700">agreed {qtyText(line.settledQty)}</div> : null}
            {line.dealerRemark ? <div className="text-[11px] text-gray-400">{line.dealerRemark}</div> : null}
          </div>
        );
      } },
    ]} />
    {(request.shortfallRounds || []).length > 1 ? (
      <Timeline
        className="mt-3"
        items={(request.shortfallRounds || []).map((entry, index) => ({
          key: index,
          color: entry.outcome === 'superseded' ? 'gray' : entry.outcome === 'rejected' ? 'red' : entry.outcome === 'pending' ? 'blue' : 'green',
          children: (
            <div className="text-xs">
              <span className="text-gray-400">Round {entry.round} · {dateTime(entry.offeredAt)} · {entry.offeredByName || 'Staff'}</span>
              <div>{label(entry.outcome)}{entry.respondedAt ? ` · dealer answered ${dateTime(entry.respondedAt)}` : ''}</div>
            </div>
          ),
        }))}
      />
    ) : null}
  </>;
};

// ── Edit requested lines ─────────────────────────────────────────────────────
//
// A request holds demand only, so editing means quantities and which products are
// on it. Saving an already-approved request sends it back for review server-side,
// which the footer text makes explicit before the user commits.
const EditRequestModal = ({ request, onClose, onSaved }) => {
  const [lines, setLines] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState(null);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [productQuery, setProductQuery] = useState('');
  const [productOptions, setProductOptions] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!request) return;
    setLines((request.items || []).map(item => ({
      product: String(item.product?._id || item.product),
      productName: item.productName,
      productCode: item.productCode,
      quantity: Number(item.quantity),
      unit: item.unit || 'Box',
    })));
    setRemarks(request.remarks || '');
    setDeliveryAddress(request.deliveryAddress || '');
    setExpectedDeliveryDate(request.expectedDeliveryDate ? dayjs(request.expectedDeliveryDate) : null);
    setReason('');
    setProductQuery('');
    setProductOptions([]);
  }, [request]);

  const dealerId = useMemo(
    () => String(request?.dealer?._id || request?.dealer || ''),
    [request],
  );

  useEffect(() => {
    if (!request || !productQuery.trim() || !dealerId) { setProductOptions([]); return; }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      salesService.getQuotationProducts({ q: productQuery.trim(), scope: 'dealer', dealer: dealerId, limit: 20 })
        .then((response) => {
          if (cancelled) return;
          const rows = Array.isArray(response?.data) ? response.data : response?.data?.data || [];
          setProductOptions(rows);
        })
        .catch(() => { if (!cancelled) setProductOptions([]); })
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 350);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [productQuery, dealerId, request]);

  const setQuantity = (product, quantity) =>
    setLines(current => current.map(line => line.product === product ? { ...line, quantity } : line));
  const removeLine = product => setLines(current => current.filter(line => line.product !== product));
  const addProduct = (option) => {
    const id = String(option._id);
    if (lines.some(line => line.product === id)) { message.info('That product is already on the request.'); return; }
    setLines(current => [...current, {
      product: id,
      productName: option.itemName,
      productCode: option.productCode,
      quantity: 1,
      unit: option.unit || 'Box',
    }]);
    setProductQuery('');
    setProductOptions([]);
  };

  const invalid = lines.length === 0 || lines.some(line => !(Number(line.quantity) > 0));

  const save = async () => {
    if (invalid) { message.error('Every line needs a quantity greater than zero.'); return; }
    setSaving(true);
    try {
      const response = await salesService.updateDealerOrderRequest(request._id, {
        revision: request.revision,
        items: lines.map(line => ({ product: line.product, quantity: Number(line.quantity) })),
        remarks,
        deliveryAddress,
        expectedDeliveryDate: expectedDeliveryDate ? expectedDeliveryDate.format('YYYY-MM-DD') : null,
        reason: reason.trim(),
      });
      if (response.success) onSaved(response.data);
    } catch (error) { message.error(error.message || 'Could not save the changes.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal
      title={request ? `Edit ${request.requestNumber}` : 'Edit request'}
      open={Boolean(request)}
      onCancel={onClose}
      onOk={save}
      okText="Save Changes"
      okButtonProps={{ loading: saving, disabled: invalid }}
      width={720}
      destroyOnHidden
    >
      {request ? <div className="mt-4 space-y-4">
        {request.status === 'approved' ? (
          <Alert
            type="warning"
            showIcon
            message="This request is already approved"
            description="Saving changes returns it to Submitted so it can be reviewed again. That keeps the approved line set and the quotation it produces in step."
          />
        ) : null}

        <Table
          size="small"
          pagination={false}
          rowKey="product"
          dataSource={lines}
          locale={{ emptyText: <Empty description="No products left. Add at least one." image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
          columns={[
            { title: 'Product', render: (_, line) => <div><div className="font-medium">{line.productName}</div><div className="text-xs text-gray-400">{line.productCode || 'No code'}</div></div> },
            { title: 'Quantity', width: 150, render: (_, line) => (
              <InputNumber
                min={0.000001}
                step={1}
                value={line.quantity}
                onChange={value => setQuantity(line.product, value)}
                addonAfter={line.unit}
                className="w-full"
                status={Number(line.quantity) > 0 ? '' : 'error'}
              />
            ) },
            { title: '', width: 50, render: (_, line) => (
              <Tooltip title="Remove from request">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeLine(line.product)} />
              </Tooltip>
            ) },
          ]}
        />

        <div>
          <div className="mb-1 text-xs text-gray-500">Add a product</div>
          <Input
            placeholder="Search by name or code"
            prefix={<SearchOutlined className="text-gray-400" />}
            value={productQuery}
            onChange={event => setProductQuery(event.target.value)}
            allowClear
          />
          {productQuery.trim() ? (
            <div className="mt-1 max-h-52 overflow-y-auto rounded border border-gray-200">
              {searching ? <div className="p-3 text-center"><Spin size="small" /></div>
                : productOptions.length === 0 ? <div className="p-3 text-center text-xs text-gray-400">No matching products</div>
                  : productOptions.map(option => (
                    <button
                      type="button"
                      key={option._id}
                      className="flex w-full items-center justify-between border-b border-gray-100 px-3 py-2 text-left last:border-b-0 hover:bg-gray-50"
                      onClick={() => addProduct(option)}
                    >
                      <span>
                        <span className="text-sm font-medium">{option.itemName}</span>
                        <span className="block text-xs text-gray-400">{option.productCode || 'No code'}{option.tileSize ? ` · ${option.tileSize}` : ''}</span>
                      </span>
                      <PlusOutlined className="text-blue-600" />
                    </button>
                  ))}
            </div>
          ) : null}
        </div>

        <Row gutter={12}>
          <Col span={14}>
            <div className="mb-1 text-xs text-gray-500">Deliver to</div>
            <Input.TextArea rows={2} maxLength={500} value={deliveryAddress} onChange={event => setDeliveryAddress(event.target.value)} placeholder="Blank uses the dealer's default address" />
          </Col>
          <Col span={10}>
            <div className="mb-1 text-xs text-gray-500">Preferred delivery date</div>
            <DatePicker className="w-full" value={expectedDeliveryDate} onChange={setExpectedDeliveryDate} format="DD/MM/YYYY" />
          </Col>
        </Row>

        <div>
          <div className="mb-1 text-xs text-gray-500">Remarks</div>
          <Input.TextArea rows={2} maxLength={2000} value={remarks} onChange={event => setRemarks(event.target.value)} />
        </div>

        <div>
          <div className="mb-1 text-xs text-gray-500">Why are you changing this? (shown to the dealer)</div>
          <Input maxLength={500} value={reason} onChange={event => setReason(event.target.value)} placeholder="e.g. Reduced to available stock" />
        </div>
      </div> : null}
    </Modal>
  );
};

export default DealerOrderRequests;
