import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Badge, Timeline
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined, PhoneOutlined, ClockCircleOutlined, CalendarOutlined
} from '@ant-design/icons';
import crmService from '../../services/crmService.js';

const STATUS_COLORS = {
  new: 'blue', contacted: 'cyan', qualified: 'green', proposal_sent: 'orange',
  negotiation: 'purple', won: 'geekblue', lost: 'red', on_hold: 'default',
};
const PRIORITY_COLORS = { low: 'default', medium: 'blue', high: 'orange', hot: 'red' };
const OUTCOME_OPTIONS = [
  { value: 'interested', label: 'Interested' },
  { value: 'not_interested', label: 'Not Interested' },
  { value: 'callback', label: 'Callback' },
  { value: 'converted', label: 'Converted' },
  { value: 'no_response', label: 'No Response' },
];

const FollowUpManager = () => {
  const [dueToday, setDueToday] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  // Follow-up modal
  const [followupModal, setFollowupModal] = useState(null); // lead obj
  const [followupForm, setFollowupForm] = useState({ outcome: '', notes: '', nextDate: '' });
  const [followupLoading, setFollowupLoading] = useState(false);

  // Lead detail drawer
  const [viewLead, setViewLead] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [todayRes, allRes] = await Promise.all([
        crmService.getDueToday(),
        crmService.getLeads({ limit: 50, status: statusFilter }),
      ]);
      if (todayRes.success) setDueToday(todayRes.data || []);
      if (allRes.success) setAllLeads(allRes.data || []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  const openFollowup = (lead) => {
    setFollowupModal(lead);
    setFollowupForm({ outcome: '', notes: '', nextDate: '' });
  };

  const submitFollowup = async () => {
    if (!followupForm.outcome) { message.error('Select outcome'); return; }
    setFollowupLoading(true);
    try {
      const res = await crmService.addFollowup(followupModal._id, followupForm);
      if (res.success) {
        message.success('Follow-up logged');
        setFollowupModal(null);
        load();
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setFollowupLoading(false); }
  };

  const fset = (k, v) => setFollowupForm(f => ({ ...f, [k]: v }));

  const filtered = allLeads.filter(l => {
    const matchSearch = !search ||
      l.name?.toLowerCase().includes(search.toLowerCase()) ||
      l.businessName?.toLowerCase().includes(search.toLowerCase()) ||
      l.phone?.includes(search);
    return matchSearch;
  });

  const overdueCount = allLeads.filter(l => l.nextFollowupDate && new Date(l.nextFollowupDate) < new Date() && !['won','lost'].includes(l.status)).length;

  const columns = [
    {
      title: 'Lead', dataIndex: 'name',
      render: (v, r) => (
        <div>
          <div className="font-medium">{v}</div>
          <div className="text-xs text-gray-400">{r.businessName}</div>
        </div>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', width: 120, render: v => <a href={`tel:${v}`}>{v}</a> },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Priority', dataIndex: 'priority', width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'} className="capitalize">{v}</Tag>,
    },
    {
      title: 'Next Follow-up', dataIndex: 'nextFollowupDate', width: 130,
      render: v => {
        if (!v) return <span className="text-gray-400">—</span>;
        const isPast = new Date(v) < new Date();
        return <Tag color={isPast ? 'red' : 'blue'}>{new Date(v).toLocaleDateString('en-IN')}</Tag>;
      },
    },
    {
      title: 'Last Contact', dataIndex: 'lastContactDate', width: 120,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
    {
      title: 'Actions', width: 160,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" type="primary"
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
            icon={<PhoneOutlined />}
            onClick={() => openFollowup(r)}>
            Log
          </Button>
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewLead(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Follow-Up Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and log follow-ups for all active leads</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
      </div>

      {/* Due today banner */}
      {dueToday.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <ClockCircleOutlined className="text-orange-500" />
            <span className="font-semibold text-orange-700">{dueToday.length} Follow-up{dueToday.length > 1 ? 's' : ''} Due Today</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {dueToday.map(l => (
              <Button key={l._id} size="small" type="primary"
                style={{ background: '#fa8c16', borderColor: '#fa8c16' }}
                icon={<PhoneOutlined />}
                onClick={() => openFollowup(l)}>
                {l.name} — {l.phone}
              </Button>
            ))}
          </div>
        </div>
      )}

      <Row gutter={16} className="mb-5">
        {[
          ['Total Active Leads', allLeads.filter(l => !['won','lost'].includes(l.status)).length, '#FF5F03'],
          ['Due Today', dueToday.length, dueToday.length > 0 ? '#fa8c16' : '#1890ff'],
          ['Overdue', overdueCount, overdueCount > 0 ? '#f5222d' : '#52c41a'],
          ['Hot Leads', allLeads.filter(l => l.priority === 'hot').length, '#f5222d'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by name, business, or phone…"
            prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Filter by status" allowClear value={statusFilter}
            onChange={setStatusFilter} className="w-44"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={filtered} rowKey="_id"
          loading={loading} size="small"
          pagination={{ pageSize: 20 }}
          rowClassName={r => r.nextFollowupDate && new Date(r.nextFollowupDate) < new Date() ? 'bg-red-50' : ''}
          locale={{ emptyText: 'No leads found.' }}
        />
      </div>

      {/* Log Follow-up Modal */}
      <Modal
        title={<span className="font-bold">Log Follow-up — {followupModal?.name}</span>}
        open={!!followupModal}
        onCancel={() => setFollowupModal(null)}
        onOk={submitFollowup}
        okText="Log Follow-up"
        confirmLoading={followupLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden
      >
        <Divider />
        {followupModal && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="font-medium">{followupModal.name} — {followupModal.businessName}</div>
              <div className="text-gray-500">{followupModal.phone} · Status: <Tag color={STATUS_COLORS[followupModal.status] || 'default'} className="text-xs">{followupModal.status}</Tag></div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Call Outcome *</label>
              <Select value={followupForm.outcome} onChange={v => fset('outcome', v)} className="w-full"
                options={OUTCOME_OPTIONS} placeholder="What was the result?" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Notes</label>
              <Input.TextArea rows={3} value={followupForm.notes}
                onChange={e => fset('notes', e.target.value)}
                placeholder="What was discussed?" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Next Follow-up Date</label>
              <Input type="date" value={followupForm.nextDate}
                onChange={e => fset('nextDate', e.target.value)} className="w-48" />
            </div>
          </div>
        )}
      </Modal>

      {/* View Lead Modal */}
      <Modal
        title={<span className="font-bold">Lead Detail — {viewLead?.name}</span>}
        open={!!viewLead}
        onCancel={() => setViewLead(null)}
        footer={[<Button key="c" onClick={() => setViewLead(null)}>Close</Button>]}
        width={560}
      >
        {viewLead && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Name', viewLead.name],
                ['Business', viewLead.businessName],
                ['Phone', viewLead.phone],
                ['Email', viewLead.email || '—'],
                ['Source', viewLead.source],
                ['Est. Value', viewLead.estimatedValue ? `₹${viewLead.estimatedValue.toLocaleString()}` : '—'],
              ].map(([k, v]) => (
                <div key={k}><span className="text-gray-400">{k}: </span><span className="font-medium">{v}</span></div>
              ))}
            </div>
            {viewLead.followupHistory?.length > 0 && (
              <>
                <Divider className="my-2" />
                <div className="font-semibold text-gray-600 mb-2">Follow-up History</div>
                <Timeline items={viewLead.followupHistory.map(fh => ({
                  children: (
                    <div>
                      <div className="font-medium capitalize">{fh.outcome?.replace(/_/g, ' ')}</div>
                      <div className="text-gray-500 text-xs">{fh.notes}</div>
                      <div className="text-gray-400 text-xs">{new Date(fh.date || fh.createdAt).toLocaleDateString('en-IN')}</div>
                    </div>
                  ),
                }))} />
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FollowUpManager;
