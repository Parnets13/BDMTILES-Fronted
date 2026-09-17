import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Button, Card, Col, Divider, Input, Modal, Row, Select, Space, Statistic, Table, Tag, Tooltip, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, FileAddOutlined, ReloadOutlined, SearchOutlined, ShoppingOutlined,
} from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_COLORS = {
  submitted: 'orange', approved: 'green', rejected: 'red', quotation_linked: 'blue', cancelled: 'default',
};
const label = value => String(value || 'unknown').replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
const date = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';

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

  const openQuotation = requestId => navigate(`/sales-purchase/quotation-manager?${new URLSearchParams({ dealerOrderRequest: requestId, create: '1' })}`);

  const handleApprove = async (record) => {
    setActionId(record._id);
    try {
      const response = await salesService.approveDealerOrderRequest(record._id, { revision: record.revision });
      if (response.success) {
        message.success(response.message || `${record.requestNumber} approved`);
        if (canCreateQuotation) openQuotation(record._id);
        else { fetchRequests(); fetchStats(); }
      }
    } catch (error) {
      message.error(error.message);
      fetchRequests(); fetchStats();
    } finally { setActionId(null); }
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
        fetchRequests(); fetchStats();
      }
    } catch (error) {
      message.error(error.message);
      fetchRequests(); fetchStats();
    } finally { setActionId(null); }
  };

  const columns = [
    { title: 'Request #', dataIndex: 'requestNumber', width: 155, render: value => <span className="font-mono text-xs font-medium text-blue-600">{value}</span> },
    { title: 'Submitted', dataIndex: 'submittedAt', width: 105, render: date },
    { title: 'Dealer', key: 'dealer', width: 190, render: (_, record) => <div><div className="max-w-[180px] truncate text-sm font-medium">{record.dealerSnapshot?.businessName || record.dealer?.businessName || '—'}</div><div className="text-xs text-gray-400">{record.dealerSnapshot?.dealerCode || record.dealer?.dealerCode || 'No code'}</div></div> },
    { title: 'Sales Executive', dataIndex: 'salesExecutiveName', width: 155, render: (value, record) => value || record.salesExecutive?.name || '—' },
    { title: 'Products', key: 'items', width: 75, align: 'center', render: (_, record) => record.items?.length || 0 },
    { title: 'Status', dataIndex: 'status', width: 130, render: status => <Tag color={STATUS_COLORS[status]}>{label(status)}</Tag> },
    { title: 'Actions', width: 165, fixed: 'right', render: (_, record) => (
      <Space size="small">
        <Tooltip title="View details"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => setViewRequest(record)} /></Tooltip>
        {canApprove && record.status === 'submitted' ? <>
          <Tooltip title={canCreateQuotation ? 'Approve and create quotation' : 'Approve request'}><Button type="text" size="small" className="text-green-600" icon={<CheckCircleOutlined />} loading={actionId === record._id} disabled={Boolean(actionId && actionId !== record._id)} onClick={() => handleApprove(record)} /></Tooltip>
          <Tooltip title="Reject"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} disabled={Boolean(actionId)} onClick={() => { setRejectRequest(record); setRejectReason(''); }} /></Tooltip>
        </> : null}
        {canCreateQuotation && record.status === 'approved' ? <Tooltip title="Create quotation"><Button type="text" size="small" className="text-blue-600" icon={<FileAddOutlined />} onClick={() => openQuotation(record._id)} /></Tooltip> : null}
      </Space>
    )},
  ];

  return <div>
    <div className="mb-5 flex items-center justify-between">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800"><ShoppingOutlined className="text-xl text-blue-600" /> Dealer Order Requests</h1><p className="mt-0.5 text-sm text-gray-500">Approve SalesApp dealer demand, then create a quotation with authoritative pricing</p></div>
    </div>

    <Row gutter={[12, 12]} className="mb-4">
      {[
        ['Total', stats.total, '#1890ff'], ['Submitted', stats.submitted, '#fa8c16'], ['Approved', stats.approved, '#52c41a'],
        ['Quotation Linked', stats.quotation_linked, '#1677ff'], ['Rejected', stats.rejected, '#f5222d'],
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
      <Table columns={columns} dataSource={requests} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1050 }} pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }} onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))} />
    </div>

    <Modal title={viewRequest ? `Request: ${viewRequest.requestNumber}` : 'Request'} open={Boolean(viewRequest)} onCancel={() => setViewRequest(null)} footer={<Button onClick={() => setViewRequest(null)}>Close</Button>} width={720}>
      {viewRequest ? <div className="mt-4 space-y-3 text-sm">
        <Alert type={viewRequest.status === 'rejected' ? 'error' : viewRequest.status === 'quotation_linked' ? 'success' : 'info'} showIcon message={label(viewRequest.status)} description={viewRequest.status === 'submitted' ? 'Waiting for web review. Approval does not create a Sales Order.' : viewRequest.status === 'approved' ? 'Ready to create a quotation.' : viewRequest.status === 'quotation_linked' ? `Linked to ${viewRequest.sourceQuotation?.quotationNumber || 'a quotation'}.` : viewRequest.rejectionReason || undefined} />
        <Row gutter={[16, 8]}>
          <Col span={12}><span className="text-gray-400">Dealer</span><div className="font-medium">{viewRequest.dealerSnapshot?.businessName || '—'}</div></Col>
          <Col span={12}><span className="text-gray-400">Sales Executive</span><div className="font-medium">{viewRequest.salesExecutiveName || viewRequest.salesExecutive?.name || '—'}</div></Col>
          <Col span={12}><span className="text-gray-400">Submitted</span><div>{date(viewRequest.submittedAt || viewRequest.createdAt)}</div></Col>
          <Col span={12}><span className="text-gray-400">Revision</span><div>{viewRequest.revision}</div></Col>
        </Row>
        <Divider className="my-3" />
        <Table size="small" pagination={false} rowKey={(item, index) => `${item.product}-${index}`} dataSource={viewRequest.items || []} columns={[
          { title: 'Product', render: (_, item) => <div><div className="font-medium">{item.productName}</div><div className="text-xs text-gray-400">{item.productCode || 'No code'}{item.tileSize ? ` · ${item.tileSize}` : ''}</div></div> },
          { title: 'Boxes', dataIndex: 'boxes', width: 90 },
          { title: 'Pieces', dataIndex: 'pieces', width: 90 },
          { title: 'Sq ft', dataIndex: 'sqft', width: 100 },
        ]} />
        {viewRequest.remarks ? <div className="rounded bg-gray-50 p-3"><span className="text-gray-400">Remarks: </span>{viewRequest.remarks}</div> : null}
      </div> : null}
    </Modal>

    <Modal title={`Reject ${rejectRequest?.requestNumber || 'request'}?`} open={Boolean(rejectRequest)} onCancel={() => { setRejectRequest(null); setRejectReason(''); }} onOk={handleReject} okText="Reject Request" okButtonProps={{ danger: true, loading: actionId === rejectRequest?._id }} destroyOnHidden>
      <p className="mb-2 text-sm text-gray-500">The Sales Executive will see this reason in the app.</p>
      <Input.TextArea rows={4} maxLength={1000} showCount value={rejectReason} onChange={event => setRejectReason(event.target.value)} placeholder="Reason for rejection" />
    </Modal>
  </div>;
};

export default DealerOrderRequests;
