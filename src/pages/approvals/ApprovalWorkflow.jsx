import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Tabs, Badge, Alert
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined, CheckSquareOutlined,
  ClockCircleOutlined, EyeOutlined, ExclamationCircleOutlined, UserOutlined,
} from '@ant-design/icons';
import crmService from '../../services/crmService.js';

const TYPE_COLORS = {
  sales_order: 'blue', quotation: 'cyan', purchase_order: 'orange', credit_limit: 'red',
  rate_override: 'purple', debit_note: 'volcano', credit_note: 'cyan',
  discount: 'geekblue', other: 'default',
};
const STATUS_COLORS = {
  pending: 'orange', approved: 'green', rejected: 'red', cancelled: 'default',
};
const PRIORITY_COLORS = { low: 'default', medium: 'blue', high: 'orange', critical: 'red' };

const ApprovalWorkflow = () => {
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [activeTab, setActiveTab] = useState('pending');

  const [approveModal, setApproveModal] = useState(null);
  const [rejectModal, setRejectModal] = useState(null);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [rejectRemarks, setRejectRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [detailId, setDetailId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const loadStats = () => {
    crmService.getApprovalStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  const fetchApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        type: typeFilter,
        status: activeTab === 'all' ? undefined : activeTab,
      };
      const res = await crmService.getApprovals(params);
      if (res.success) {
        setApprovals(res.data || []);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, typeFilter, activeTab]);

  useEffect(() => { fetchApprovals(); }, [fetchApprovals]);

  // Everything the reviewer needs to see is fetched on demand, when the modal
  // opens — the list itself stays light. The reference document (Sales Order,
  // Quotation, ...) and the dealer's live credit exposure come back together so
  // there's nothing left to click through to elsewhere.
  useEffect(() => {
    if (!detailId) { setDetail(null); setDetailError(''); return; }
    let cancelled = false;
    setDetailLoading(true);
    setDetailError('');
    crmService.getApprovalDetail(detailId)
      .then((res) => { if (!cancelled && res.success) setDetail(res.data); })
      .catch((err) => { if (!cancelled) setDetailError(err.message || 'Could not load this request.'); })
      .finally(() => { if (!cancelled) setDetailLoading(false); });
    return () => { cancelled = true; };
  }, [detailId]);

  const openApproveFromDetail = () => { setApproveModal(detail); setApproveRemarks(''); setDetailId(null); };
  const openRejectFromDetail = () => { setRejectModal(detail); setRejectRemarks(''); setDetailId(null); };

  const handleApprove = async () => {
    if (!approveModal) return;
    setActionLoading(true);
    try {
      const res = await crmService.approveRequest(approveModal._id, { remarks: approveRemarks });
      if (res.success) {
        message.success(`Request ${approveModal.requestNumber} approved`);
        setApproveModal(null); setApproveRemarks('');
        fetchApprovals(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectModal) return;
    if (!rejectRemarks) { message.error('Please provide rejection reason'); return; }
    setActionLoading(true);
    try {
      const res = await crmService.rejectRequest(rejectModal._id, { remarks: rejectRemarks });
      if (res.success) {
        message.success(`Request ${rejectModal.requestNumber} rejected`);
        setRejectModal(null); setRejectRemarks('');
        fetchApprovals(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setActionLoading(false); }
  };

  const columns = [
    { title: 'Request #', dataIndex: 'requestNumber', width: 120,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'createdAt', width: 100,
      render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '—'}</span> },
    { title: 'Type', dataIndex: 'type', width: 130,
      render: t => <Tag color={TYPE_COLORS[t] || 'default'}>{t?.replace(/_/g, ' ')}</Tag> },
    { title: 'Title', dataIndex: 'title', width: 180,
      render: v => <span className="text-sm font-medium">{v}</span> },
    { title: 'Description', dataIndex: 'description', width: 200,
      render: v => <span className="text-xs text-gray-500 truncate block max-w-[190px]">{v || '—'}</span> },
    { title: 'Ref #', dataIndex: 'referenceNumber', width: 110,
      render: v => <span className="text-xs font-mono text-gray-400">{v || '—'}</span> },
    { title: 'Requested By', dataIndex: 'requestedByName', width: 120,
      render: v => <span className="text-sm">{v || '—'}</span> },
    { title: 'Value', key: 'value', width: 150,
      render: (_, r) => (
        <div className="text-xs">
          {r.requestedValue !== undefined && <div><span className="text-gray-400">Req: </span>
            <span className="font-medium">{typeof r.requestedValue === 'number' ? `₹${r.requestedValue.toLocaleString()}` : r.requestedValue}</span>
          </div>}
          {r.currentValue !== undefined && <div><span className="text-gray-400">Curr: </span>
            <span className="font-medium text-orange-600">{typeof r.currentValue === 'number' ? `₹${r.currentValue.toLocaleString()}` : r.currentValue}</span>
          </div>}
        </div>
      )},
    { title: 'Priority', dataIndex: 'priority', width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v || '—'}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 100,
      render: s => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag> },
    { title: 'Actions', width: 140,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" className="text-blue-600"
            icon={<EyeOutlined />}
            onClick={() => setDetailId(r._id)}
            title="View detail" />
          {r.status === 'pending' ? <>
            <Button type="text" size="small" className="text-green-600"
              icon={<CheckCircleOutlined />}
              onClick={() => { setApproveModal(r); setApproveRemarks(''); }}
              title="Approve" />
            <Button type="text" size="small" className="text-red-500"
              icon={<CloseCircleOutlined />}
              onClick={() => { setRejectModal(r); setRejectRemarks(''); }}
              title="Reject" />
          </> : null}
        </Space>
      ),
    },
  ];
  const detailOnlyColumn = columns[columns.length - 1];

  const tabItems = [
    { key: 'pending',
      label: <span>Pending <Badge count={stats.pending || 0} size="small" /></span>,
      children: (
        <Table columns={columns} dataSource={approvals} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1300 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))}
          rowClassName={r => r.status === 'pending' ? 'bg-orange-50' : ''} />
      )},
    { key: 'approved', label: 'Approved',
      children: (
        <Table columns={[...columns.slice(0, -1), detailOnlyColumn]} dataSource={approvals} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1240 }}
          pagination={{ ...pagination, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      )},
    { key: 'rejected', label: 'Rejected',
      children: (
        <Table columns={[...columns.slice(0, -1), detailOnlyColumn]} dataSource={approvals} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1240 }}
          pagination={{ ...pagination, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      )},
    { key: 'all', label: 'All',
      children: (
        <Table columns={columns} dataSource={approvals} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1300 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      )},
  ];

  const money = (v) => typeof v === 'number' ? `₹${v.toLocaleString('en-IN')}` : (v ?? '—');
  const date = (v) => v ? new Date(v).toLocaleString('en-IN') : '—';

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CheckSquareOutlined className="text-green-600 text-xl" /> Approval Workflow
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve pending requests</p>
        </div>
      </div>

      {(stats.pending > 0) && (
        <Alert type="warning" showIcon className="mb-4"
          message={<span><strong>{stats.pending}</strong> requests are pending your approval</span>}
          icon={<ClockCircleOutlined />} />
      )}

      <Row gutter={[12, 12]} className="mb-4">
        {[
          ['Total', stats.total, '#1890ff'],
          ['Pending', stats.pending, '#fa8c16'],
          ['Approved', stats.approved, '#52c41a'],
          ['Rejected', stats.rejected, '#f5222d'],
        ].map(([label, val, color]) => (
          <Col key={label} span={6}>
            <Card size="small" style={{ borderColor: color + '30' }}>
              <Statistic title={label} value={val || 0} valueStyle={{ color, fontSize: 20 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search request #, title, reference..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear />
          <Select placeholder="Type" allowClear value={typeFilter} onChange={v => setTypeFilter(v)} className="w-40"
            options={Object.keys(TYPE_COLORS).map(t => ({ value: t, label: t.replace(/_/g, ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTypeFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs activeKey={activeTab} onChange={tab => { setActiveTab(tab); setPagination(p => ({ ...p, current: 1 })); }}
          items={tabItems} className="px-4 pt-2" />
      </div>

      {/* Approve Modal */}
      <Modal title={<span className="text-green-700">✅ Approve Request</span>}
        open={!!approveModal} onCancel={() => setApproveModal(null)}
        onOk={handleApprove} confirmLoading={actionLoading}
        okText="Approve" okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}>
        {approveModal && (
          <div className="space-y-3 mt-3 text-sm">
            <div className="bg-gray-50 rounded p-3 border">
              <div><span className="text-gray-400">Request: </span><strong>{approveModal.requestNumber}</strong></div>
              <div><span className="text-gray-400">Title: </span>{approveModal.title}</div>
              <div><span className="text-gray-400">Type: </span><Tag color={TYPE_COLORS[approveModal.type]}>{approveModal.type?.replace(/_/g, ' ')}</Tag></div>
              {approveModal.requestedValue !== undefined && (
                <div><span className="text-gray-400">Requested Value: </span>
                  <strong>{typeof approveModal.requestedValue === 'number' ? `₹${approveModal.requestedValue.toLocaleString()}` : approveModal.requestedValue}</strong>
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Approval Remarks (optional)</label>
              <Input.TextArea rows={2} value={approveRemarks} onChange={e => setApproveRemarks(e.target.value)}
                placeholder="Add any remarks for this approval..." />
            </div>
          </div>
        )}
      </Modal>

      {/* Detail Modal — everything about what is being asked, in one place */}
      <Modal
        title={<span>Request detail {detail ? <span className="font-mono text-sm text-gray-400 ml-2">{detail.requestNumber}</span> : null}</span>}
        open={Boolean(detailId)}
        onCancel={() => setDetailId(null)}
        width={780}
        footer={detail?.status === 'pending' ? [
          <Button key="close" onClick={() => setDetailId(null)}>Close</Button>,
          <Button key="reject" danger onClick={openRejectFromDetail}>Reject</Button>,
          <Button key="approve" type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }} onClick={openApproveFromDetail}>Approve</Button>,
        ] : [<Button key="close" onClick={() => setDetailId(null)}>Close</Button>]}
      >
        {detailLoading ? (
          <div className="py-10 text-center text-gray-400">Loading…</div>
        ) : detailError ? (
          <Alert type="error" showIcon message={detailError} />
        ) : detail ? (
          <div className="space-y-4 mt-2 text-sm">
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded p-3 border">
              <div><span className="text-gray-400">Type: </span><Tag color={TYPE_COLORS[detail.type]}>{detail.type?.replace(/_/g, ' ')}</Tag></div>
              <div><span className="text-gray-400">Status: </span><Tag color={STATUS_COLORS[detail.status]}>{detail.status}</Tag></div>
              <div><span className="text-gray-400">Priority: </span><Tag color={PRIORITY_COLORS[detail.priority]}>{detail.priority || '—'}</Tag></div>
              <div><span className="text-gray-400">Raised: </span>{date(detail.createdAt)}</div>
              <div className="col-span-2"><span className="text-gray-400">Title: </span><strong>{detail.title}</strong></div>
              {detail.description ? (
                <div className="col-span-2"><span className="text-gray-400">Description: </span>{detail.description}</div>
              ) : null}
              {detail.reason ? (
                <div className="col-span-2"><span className="text-gray-400">Reason given: </span>{detail.reason}</div>
              ) : null}
              <div>
                <span className="text-gray-400">Requested by: </span>
                <UserOutlined className="mr-1" />{detail.requestedBy?.name || detail.requestedByName || '—'}
                {detail.requestedBy?.email ? <span className="text-gray-400 text-xs ml-1">({detail.requestedBy.email})</span> : null}
              </div>
              {detail.referenceNumber ? (
                <div><span className="text-gray-400">Reference: </span><span className="font-mono">{detail.referenceNumber}</span></div>
              ) : null}
              {detail.requestedValue !== undefined && detail.requestedValue !== null ? (
                <div><span className="text-gray-400">Requested value: </span><strong>{money(detail.requestedValue)}</strong></div>
              ) : null}
              {detail.currentValue !== undefined && detail.currentValue !== null ? (
                <div><span className="text-gray-400">Current / threshold: </span><span className="text-orange-600 font-medium">{money(detail.currentValue)}</span></div>
              ) : null}
              {detail.status !== 'pending' ? (
                <>
                  <div><span className="text-gray-400">Actioned by: </span>{detail.approvedBy?.name || '—'}</div>
                  <div><span className="text-gray-400">Actioned at: </span>{date(detail.approvedAt)}</div>
                  {detail.approvalRemarks ? (
                    <div className="col-span-2"><span className="text-gray-400">Remarks: </span>{detail.approvalRemarks}</div>
                  ) : null}
                </>
              ) : null}
            </div>

            {!detail.reference && detail.referenceId ? (
              <Alert type="warning" showIcon message="The underlying document could not be found. It may have been removed." />
            ) : null}

            {detail.reference?.document ? (
              <>
                <Divider className="my-2" orientation="left" plain>
                  {detail.reference.model} · {detail.reference.document.orderNumber || detail.reference.document.quotationNumber
                    || detail.reference.document.poNumber || detail.reference.document.adjustmentNumber
                    || detail.reference.document.auditNumber || detail.reference.document.debitNoteNumber
                    || detail.reference.document.returnNumber}
                </Divider>

                <div className="grid grid-cols-2 gap-3">
                  {detail.reference.document.dealer ? (
                    <div className="col-span-2 bg-blue-50 rounded p-3 border border-blue-100">
                      <div className="font-medium">{detail.reference.document.dealer.businessName}</div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {detail.reference.document.dealer.dealerCode} · {detail.reference.document.dealer.ownerName || ''} · {detail.reference.document.dealer.mobile || ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        Credit limit: {money(detail.reference.document.dealer.creditLimit)} · Credit days: {detail.reference.document.dealer.creditDays ?? '—'}
                      </div>
                      {detail.reference.creditExposure ? (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          <ExclamationCircleOutlined className={detail.reference.creditExposure.overdueAmount > 0 ? 'text-red-500' : 'text-green-600'} />
                          <span>
                            Overdue exposure: <strong className={detail.reference.creditExposure.overdueAmount > 0 ? 'text-red-600' : 'text-green-700'}>
                              {money(detail.reference.creditExposure.overdueAmount)}
                            </strong> across {detail.reference.creditExposure.overdueCount} invoice/order(s)
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                  {detail.reference.document.customerName && !detail.reference.document.dealer ? (
                    <div className="col-span-2"><span className="text-gray-400">Customer: </span>{detail.reference.document.customerName} {detail.reference.document.customerPhone ? `· ${detail.reference.document.customerPhone}` : ''}</div>
                  ) : null}
                  {detail.reference.document.deliveryAddress ? (
                    <div className="col-span-2 text-xs text-gray-500"><span className="text-gray-400">Delivery: </span>{detail.reference.document.deliveryAddress}</div>
                  ) : null}
                </div>

                {detail.reference.document.items?.length ? (
                  <Table
                    size="small" pagination={false}
                    rowKey={(row, idx) => row._id || idx}
                    dataSource={detail.reference.document.items}
                    columns={[
                      { title: 'Product', dataIndex: 'productName', render: (v, row) => v || row.product },
                      { title: 'Qty', dataIndex: 'quantity', width: 70 },
                      { title: 'Rate', dataIndex: 'rate', width: 90, render: v => money(v) },
                      { title: 'Discount', dataIndex: 'discount', width: 90, render: v => v ? money(v) : '—' },
                      { title: 'Tax', dataIndex: 'gstAmount', width: 90, render: v => money(v) },
                      { title: 'Total', dataIndex: 'totalAmount', width: 100, render: v => <strong>{money(v)}</strong> },
                    ]}
                  />
                ) : null}

                <div className="flex justify-end">
                  <div className="w-64 text-xs space-y-1">
                    <div className="flex justify-between"><span className="text-gray-400">Subtotal</span><span>{money(detail.reference.document.subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Discount</span><span>{money(detail.reference.document.totalDiscount)}</span></div>
                    <div className="flex justify-between"><span className="text-gray-400">Tax</span><span>{money(detail.reference.document.totalTax)}</span></div>
                    <div className="flex justify-between font-semibold border-t pt-1"><span>Grand Total</span><span>{money(detail.reference.document.grandTotal)}</span></div>
                    {detail.reference.document.balanceAmount !== undefined ? (
                      <div className="flex justify-between text-orange-600"><span>Balance due</span><span>{money(detail.reference.document.balanceAmount)}</span></div>
                    ) : null}
                  </div>
                </div>

                {detail.reference.document.approvalReasons?.length ? (
                  <div className="bg-orange-50 border border-orange-100 rounded p-3 text-xs space-y-1">
                    <div className="font-medium text-orange-700">Why this needs approval</div>
                    {detail.reference.document.approvalReasons.map((reason, idx) => (
                      <div key={idx}>
                        {reason.type.replace(/_/g, ' ')} — requested {money(reason.requestedValue)}, threshold {money(reason.thresholdValue)}
                        {reason.status !== 'pending' ? <Tag className="ml-2" color={reason.status === 'approved' ? 'green' : 'red'}>{reason.status}</Tag> : null}
                      </div>
                    ))}
                  </div>
                ) : null}

                {detail.reference.document.remarks ? (
                  <div className="text-xs text-gray-500"><span className="text-gray-400">Remarks: </span>{detail.reference.document.remarks}</div>
                ) : null}
              </>
            ) : null}
          </div>
        ) : null}
      </Modal>

      {/* Reject Modal */}
      <Modal title={<span className="text-red-600">❌ Reject Request</span>}
        open={!!rejectModal} onCancel={() => setRejectModal(null)}
        onOk={handleReject} confirmLoading={actionLoading}
        okText="Reject" okButtonProps={{ danger: true }}>
        {rejectModal && (
          <div className="space-y-3 mt-3 text-sm">
            <div className="bg-red-50 rounded p-3 border border-red-100">
              <div><span className="text-gray-400">Request: </span><strong>{rejectModal.requestNumber}</strong></div>
              <div><span className="text-gray-400">Title: </span>{rejectModal.title}</div>
              <div><span className="text-gray-400">Type: </span><Tag color={TYPE_COLORS[rejectModal.type]}>{rejectModal.type?.replace(/_/g, ' ')}</Tag></div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Rejection Reason *</label>
              <Input.TextArea rows={3} value={rejectRemarks} onChange={e => setRejectRemarks(e.target.value)}
                placeholder="Please provide reason for rejection..." />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ApprovalWorkflow;
