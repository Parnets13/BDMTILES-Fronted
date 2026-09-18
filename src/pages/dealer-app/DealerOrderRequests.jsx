import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import {
  Alert, Button, Card, Col, DatePicker, Divider, Empty, Input, InputNumber, Modal, Row, Select,
  Space, Spin, Statistic, Table, Tag, Timeline, Tooltip, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DeleteOutlined, EditOutlined, EyeOutlined,
  FileAddOutlined, FileDoneOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, ShoppingOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_COLORS = {
  submitted: 'orange', approved: 'green', rejected: 'red', quotation_linked: 'blue', cancelled: 'default',
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
    if (record.status === 'approved') return <span className="text-xs text-green-600">Ready to quote</span>;
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
    { title: 'Status', dataIndex: 'status', width: 130, render: status => <Tag color={STATUS_COLORS[status]}>{label(status)}</Tag> },
    { title: 'Quotation', key: 'outcome', width: 135, render: (_, record) => outcomeCell(record) },
    { title: 'Actions', width: 190, fixed: 'right', render: (_, record) => {
      const busy = Boolean(actionId);
      const mine = actionId === record._id;
      return (
        <Space size="small">
          <Tooltip title="View details"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setViewRequest(record)} /></Tooltip>

          {canApprove && EDITABLE_STATUSES.has(record.status) ? (
            <Tooltip title="Edit requested quantities"><Button type="text" size="small" icon={<EditOutlined />} disabled={busy} onClick={() => setEditRequest(record)} /></Tooltip>
          ) : null}

          {canApprove && record.status === 'submitted' ? <>
            {canCreateQuotation ? (
              <Tooltip title="Approve and create the quotation in one step">
                <Button type="text" size="small" className="text-green-600" icon={<ThunderboltOutlined />} loading={mine} disabled={busy && !mine} onClick={() => approveAndQuote(record)} />
              </Tooltip>
            ) : null}
            <Tooltip title="Approve only">
              <Button type="text" size="small" className="text-green-600" icon={<CheckCircleOutlined />} loading={mine && !canCreateQuotation} disabled={busy && !mine} onClick={() => handleApproveOnly(record)} />
            </Tooltip>
            <Tooltip title="Reject"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} disabled={busy} onClick={() => { setRejectRequest(record); setRejectReason(''); }} /></Tooltip>
          </> : null}

          {canCreateQuotation && record.status === 'approved' ? (
            <Tooltip title="Create quotation"><Button type="text" size="small" className="text-blue-600" icon={<FileAddOutlined />} disabled={busy} onClick={() => openQuotationBuilder(record._id)} /></Tooltip>
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
        ['Quotation Linked', stats.quotation_linked, '#1677ff'], ['Rejected', stats.rejected, '#f5222d'],
        ['Cancelled', stats.cancelled, '#8c8c8c'],
      ].map(([title, value, color]) => <Col xs={24} sm={12} lg={4} key={title}><Card size="small"><Statistic title={title} value={value || 0} valueStyle={{ color }} /></Card></Col>)}
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

// ── Read-only detail ─────────────────────────────────────────────────────────
const ViewRequestModal = ({ request, onClose, onOpenQuotation }) => (
  <Modal title={request ? `Request: ${request.requestNumber}` : 'Request'} open={Boolean(request)} onCancel={onClose} footer={<Button onClick={onClose}>Close</Button>} width={780}>
    {request ? <div className="mt-4 space-y-3 text-sm">
      <Alert
        type={request.status === 'rejected' ? 'error' : request.status === 'quotation_linked' ? 'success' : request.status === 'cancelled' ? 'warning' : 'info'}
        showIcon
        message={label(request.status)}
        description={
          request.status === 'submitted' ? 'Waiting for review. Approving does not create a Sales Order.'
            : request.status === 'approved' ? 'Ready to create a quotation. Products and quantities are now frozen.'
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
