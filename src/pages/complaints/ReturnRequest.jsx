import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider
} from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { PackageX } from 'lucide-react';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';

const REASON_OPTIONS = [
  { value: 'damaged', label: 'Damaged in Transit' },
  { value: 'wrong_product', label: 'Wrong Product Delivered' },
  { value: 'quality_issue', label: 'Quality Issue / Defective' },
  { value: 'short_delivery', label: 'Short Delivery' },
  { value: 'cancelled_order', label: 'Order Cancelled' },
  { value: 'other', label: 'Other' },
];

const STATUS_COLORS = {
  pending: 'orange', approved: 'green', rejected: 'red',
  pickup_scheduled: 'blue', picked_up: 'cyan', credit_issued: 'geekblue',
};

const emptyForm = () => ({
  dealer: '', orderNumber: '', reason: '', description: '',
  items: [], returnImages: [], requestedRefund: 0,
});

const ReturnRequest = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [dealers, setDealers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [viewRequest, setViewRequest] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      // Return requests share the complaints endpoint with category filter
      const res = await crmService.getComplaints({ page, limit: 20, category: 'return_request', search, status: statusFilter });
      if (res.success) {
        setRequests(res.data || []);
        const pg = res.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
    } catch { setRequests([]); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(1); }, [load]);

  useEffect(() => {
    masterService.getDealers({ limit: 200, status: 'active' }).then(r => {
      if (r.success) setDealers(r.data || []);
    }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.dealer) { message.error('Select dealer'); return; }
    if (!form.reason) { message.error('Select reason'); return; }
    if (!form.description.trim()) { message.error('Describe the issue'); return; }
    setCreateLoading(true);
    try {
      const res = await crmService.createComplaint({
        ...form, category: 'return_request', priority: 'medium',
      });
      if (res.success) {
        message.success('Return request raised');
        setShowCreate(false);
        setForm(emptyForm());
        load(1);
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setCreateLoading(false); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const columns = [
    { title: 'Request No.', dataIndex: 'complaintNumber', width: 130, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Dealer', dataIndex: 'dealerName',
      render: (v, r) => <div><div className="font-medium">{v || '—'}</div><div className="text-xs text-gray-400">{r.orderNumber || ''}</div></div>,
    },
    {
      title: 'Reason', dataIndex: 'reason',
      render: (v, r) => {
        const cat = r.category === 'return_request' ? r.description?.substring(0, 30) : v;
        const found = REASON_OPTIONS.find(o => o.value === v);
        return <Tag color="orange">{found?.label || v?.replace(/_/g, ' ') || 'Return Request'}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: v => <Tag color={STATUS_COLORS[v] || 'orange'} className="capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Raised On', dataIndex: 'createdAt', width: 100,
      render: v => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: 'Actions', width: 80,
      render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setViewRequest(r)}>View</Button>,
    },
  ];

  const pendingCount = requests.filter(r => r.status === 'pending').length;
  const approvedCount = requests.filter(r => r.status === 'approved').length;

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Return Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage dealer return and replacement requests</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            New Return Request
          </Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total Requests', requests.length + (pagination.total > 20 ? pagination.total - requests.length : 0), '#1890ff'],
          ['Pending', pendingCount, '#fa8c16'],
          ['Approved', approvedCount, '#52c41a'],
        ].map(([t, v, c]) => (
          <Col span={8} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by request no. or dealer…"
            prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Filter by status" allowClear value={statusFilter}
            onChange={setStatusFilter} className="w-44"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={requests} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          locale={{ emptyText: 'No return requests found.' }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title={<span className="font-bold">New Return Request</span>}
        open={showCreate}
        onCancel={() => { setShowCreate(false); setForm(emptyForm()); }}
        onOk={handleCreate}
        okText="Submit Request"
        confirmLoading={createLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden
        width={520}
      >
        <Divider />
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dealer *</label>
            <Select value={form.dealer} onChange={v => setF('dealer', v)} className="w-full"
              placeholder="Select dealer" showSearch
              filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
              options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Sales Order / Invoice No.</label>
            <Input value={form.orderNumber} onChange={e => setF('orderNumber', e.target.value)}
              placeholder="SO-00001 or INV-00001" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Return Reason *</label>
            <Select value={form.reason} onChange={v => setF('reason', v)} className="w-full"
              options={REASON_OPTIONS} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Description *</label>
            <Input.TextArea rows={3} value={form.description}
              onChange={e => setF('description', e.target.value)}
              placeholder="Describe the issue in detail" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Requested Refund Amount (₹)</label>
            <Input type="number" value={form.requestedRefund || ''}
              onChange={e => setF('requestedRefund', parseFloat(e.target.value) || 0)}
              className="w-48" placeholder="0" />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        title={<span className="font-bold">Return Request — {viewRequest?.complaintNumber}</span>}
        open={!!viewRequest}
        onCancel={() => setViewRequest(null)}
        footer={[<Button key="c" onClick={() => setViewRequest(null)}>Close</Button>]}
        width={500}
      >
        {viewRequest && (
          <div className="space-y-2 text-sm">
            {[
              ['Dealer', viewRequest.dealerName],
              ['Order No.', viewRequest.orderNumber || '—'],
              ['Category', viewRequest.category?.replace(/_/g, ' ')],
              ['Status', viewRequest.status],
              ['Description', viewRequest.description],
              ['Resolution', viewRequest.resolutionNotes || 'Pending'],
              ['Credit Note', viewRequest.creditNoteIssued ? `₹${viewRequest.creditNoteAmount}` : 'Not issued'],
              ['Raised On', new Date(viewRequest.createdAt).toLocaleDateString('en-IN')],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReturnRequest;
