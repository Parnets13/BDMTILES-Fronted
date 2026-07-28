import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Tabs, Badge, Alert
} from 'antd';
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { CheckSquare, XCircle, Clock } from 'lucide-react';
import crmService from '../../services/crmService.js';

const TYPE_COLORS = {
  sales_order: 'blue', purchase_order: 'orange', credit_limit: 'red',
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
    { title: 'Actions', width: 100,
      render: (_, r) => r.status === 'pending' ? (
        <Space size="small">
          <Button type="text" size="small" className="text-green-600"
            icon={<CheckCircleOutlined />}
            onClick={() => { setApproveModal(r); setApproveRemarks(''); }}
            title="Approve" />
          <Button type="text" size="small" className="text-red-500"
            icon={<CloseCircleOutlined />}
            onClick={() => { setRejectModal(r); setRejectRemarks(''); }}
            title="Reject" />
        </Space>
      ) : null,
    },
  ];

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
        <Table columns={columns.filter(c => c.title !== 'Actions')} dataSource={approvals} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1200 }}
          pagination={{ ...pagination, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      )},
    { key: 'rejected', label: 'Rejected',
      children: (
        <Table columns={columns.filter(c => c.title !== 'Actions')} dataSource={approvals} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1200 }}
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

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <CheckSquare size={24} className="text-green-600" /> Approval Workflow
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve pending requests</p>
        </div>
      </div>

      {(stats.pending > 0) && (
        <Alert type="warning" showIcon className="mb-4"
          message={<span><strong>{stats.pending}</strong> requests are pending your approval</span>}
          icon={<Clock size={16} />} />
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
