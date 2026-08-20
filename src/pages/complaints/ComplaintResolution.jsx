import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber, Checkbox
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined, CheckOutlined, WarningOutlined
} from '@ant-design/icons';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';

const CATEGORY_COLORS = {
  damaged_goods: 'red', wrong_product: 'orange', quality_issue: 'volcano',
  short_delivery: 'gold', billing_error: 'blue', delivery_delay: 'purple', other: 'default',
};
const PRIORITY_COLORS = { low: 'default', medium: 'blue', high: 'orange', critical: 'red' };
const STATUS_COLORS = {
  open: 'red', acknowledged: 'orange', in_progress: 'blue',
  resolved: 'green', closed: 'default', rejected: 'volcano',
};

const ComplaintResolution = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  // Resolution modal
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveForm, setResolveForm] = useState({ action: '', notes: '', closeComplaint: false, creditNoteAmount: 0 });
  const [resolveLoading, setResolveLoading] = useState(false);

  // View modal
  const [viewComplaint, setViewComplaint] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20, search, status: statusFilter, priority: priorityFilter };
      const [listRes, statsRes] = await Promise.all([
        crmService.getComplaints(params),
        crmService.getComplaintStats(),
      ]);
      if (listRes.success) {
        setComplaints(listRes.data || []);
        const pg = listRes.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, statusFilter, priorityFilter]);

  useEffect(() => { load(1); }, [load]);

  const openResolve = (c) => {
    setResolveModal(c);
    setResolveForm({ action: '', notes: '', closeComplaint: false, creditNoteAmount: 0 });
  };

  const submitResolve = async () => {
    if (!resolveForm.action.trim()) { message.error('Enter resolution action'); return; }
    setResolveLoading(true);
    try {
      const res = await crmService.resolveComplaint(resolveModal._id, resolveForm);
      if (res.success) {
        message.success('Resolution recorded');
        setResolveModal(null);
        load(1);
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setResolveLoading(false); }
  };

  const rset = (k, v) => setResolveForm(f => ({ ...f, [k]: v }));

  const columns = [
    { title: 'Complaint No.', dataIndex: 'complaintNumber', width: 130, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Dealer', dataIndex: 'dealerName',
      render: (v, r) => <div><div className="font-medium">{v || '—'}</div><div className="text-xs text-gray-400">{r.orderNumber || ''}</div></div>,
    },
    {
      title: 'Category', dataIndex: 'category',
      render: v => <Tag color={CATEGORY_COLORS[v] || 'default'} className="text-xs capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Priority', dataIndex: 'priority', width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'} className="capitalize">{v}</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Raised', dataIndex: 'createdAt', width: 100,
      render: v => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: 'Actions', width: 170,
      render: (_, r) => (
        <Space size="small">
          {!['resolved', 'closed', 'rejected'].includes(r.status) && (
            <Button size="small" type="primary" icon={<CheckOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => openResolve(r)}>
              Resolve
            </Button>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewComplaint(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Complaint Resolution</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and resolve dealer complaints</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Open', stats.open || 0, '#f5222d'],
          ['In Progress', stats.inProgress || 0, '#1890ff'],
          ['Resolved', stats.resolved || 0, '#52c41a'],
          ['Critical', stats.critical || 0, '#f5222d'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by complaint no., dealer…"
            prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Filter by status" allowClear value={statusFilter}
            onChange={setStatusFilter} className="w-44"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Select placeholder="Priority" allowClear value={priorityFilter}
            onChange={setPriorityFilter} className="w-36"
            options={Object.keys(PRIORITY_COLORS).map(p => ({ value: p, label: p }))} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={complaints} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          rowClassName={r => r.priority === 'critical' && !['resolved','closed'].includes(r.status) ? 'bg-red-50' : ''}
          locale={{ emptyText: 'No complaints found.' }}
        />
      </div>

      {/* Resolve Modal */}
      <Modal
        title={<span className="font-bold">Resolve Complaint — {resolveModal?.complaintNumber}</span>}
        open={!!resolveModal}
        onCancel={() => setResolveModal(null)}
        onOk={submitResolve}
        okText="Submit Resolution"
        confirmLoading={resolveLoading}
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
        destroyOnHidden
      >
        <Divider />
        {resolveModal && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="font-medium">{resolveModal.dealerName} — {resolveModal.category?.replace(/_/g, ' ')}</div>
              <div className="text-gray-500 mt-1">{resolveModal.description}</div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Resolution Action *</label>
              <Input.TextArea rows={3} value={resolveForm.action}
                onChange={e => rset('action', e.target.value)}
                placeholder="What action was taken to resolve this complaint?" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Internal Notes</label>
              <Input.TextArea rows={2} value={resolveForm.notes}
                onChange={e => rset('notes', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Credit Note Amount (₹) — if applicable</label>
              <InputNumber
                value={resolveForm.creditNoteAmount}
                onChange={v => rset('creditNoteAmount', v || 0)}
                prefix="₹" className="w-48" min={0} />
            </div>
            <Checkbox checked={resolveForm.closeComplaint}
              onChange={e => rset('closeComplaint', e.target.checked)}>
              Mark as <strong>Closed</strong> (no further action needed)
            </Checkbox>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal
        title={<span className="font-bold">{viewComplaint?.complaintNumber}</span>}
        open={!!viewComplaint}
        onCancel={() => setViewComplaint(null)}
        footer={[<Button key="c" onClick={() => setViewComplaint(null)}>Close</Button>]}
        width={520}
      >
        {viewComplaint && (
          <div className="space-y-2 text-sm">
            {[
              ['Dealer', viewComplaint.dealerName],
              ['Order No.', viewComplaint.orderNumber || '—'],
              ['Category', viewComplaint.category?.replace(/_/g, ' ')],
              ['Priority', viewComplaint.priority],
              ['Status', viewComplaint.status],
              ['Description', viewComplaint.description],
              ['Resolution Notes', viewComplaint.resolutionNotes || '—'],
              ['Credit Note', viewComplaint.creditNoteIssued ? `₹${viewComplaint.creditNoteAmount}` : 'Not issued'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ComplaintResolution;
