import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Tabs, Badge, Alert
} from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Users, TrendingUp, AlertTriangle, Phone } from 'lucide-react';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';

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
const SOURCE_OPTIONS = ['direct', 'referral', 'website', 'social_media', 'exhibition', 'cold_call', 'dealer', 'other'];

const LeadManagement = () => {
  const [leads, setLeads] = useState([]);
  const [dueToday, setDueToday] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [activeTab, setActiveTab] = useState('all');
  const [users, setUsers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', email: '', businessName: '', city: '',
    source: '', priority: 'medium', estimatedValue: '',
    assignedTo: '', nextFollowupDate: '', remarks: '',
  });

  const [viewLead, setViewLead] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [followupForm, setFollowupForm] = useState({ notes: '', outcome: '', nextFollowupDate: '' });
  const [followupLoading, setFollowupLoading] = useState(false);

  const [statusModal, setStatusModal] = useState(null);

  useEffect(() => {
    crmService.getLeadStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
    crmService.getDueToday().then(r => { if (r.success) setDueToday(r.data || []); }).catch(() => {});
    masterService.getDealers({ limit: 100, status: 'active' }).then(r => {
      if (r.success) setUsers(r.data || []);
    }).catch(() => {});
  }, []);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize,
        search, status: statusFilter, priority: priorityFilter,
      };
      const res = await crmService.getLeads(params);
      if (res.success) {
        setLeads(res.data || []);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter, priorityFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const handleCreate = async () => {
    if (!form.name) { message.error('Enter lead name'); return; }
    if (!form.phone) { message.error('Enter phone number'); return; }
    setCreateLoading(true);
    try {
      const res = await crmService.createLead(form);
      if (res.success) {
        message.success('Lead created');
        setShowCreate(false);
        setForm({ name: '', phone: '', email: '', businessName: '', city: '', source: '', priority: 'medium', estimatedValue: '', assignedTo: '', nextFollowupDate: '', remarks: '' });
        fetchLeads();
        crmService.getLeadStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const openView = async (leadId) => {
    setViewLoading(true);
    setViewLead({ _id: leadId });
    try {
      const res = await crmService.getLead(leadId);
      if (res.success) setViewLead(res.data);
    } catch (err) { message.error(err.message); }
    finally { setViewLoading(false); }
  };

  const handleAddFollowup = async () => {
    if (!followupForm.notes) { message.error('Enter follow-up notes'); return; }
    if (!followupForm.outcome) { message.error('Select outcome'); return; }
    setFollowupLoading(true);
    try {
      const res = await crmService.addFollowup(viewLead._id, followupForm);
      if (res.success) {
        message.success('Follow-up added');
        setFollowupForm({ notes: '', outcome: '', nextFollowupDate: '' });
        openView(viewLead._id);
        fetchLeads();
      }
    } catch (err) { message.error(err.message); }
    finally { setFollowupLoading(false); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const res = await crmService.updateLeadStatus(id, { status });
      if (res.success) {
        message.success('Status updated');
        setStatusModal(null);
        fetchLeads();
      }
    } catch (err) { message.error(err.message); }
  };

  const isOverdue = (date) => date && new Date(date) < new Date();

  const columns = [
    { title: 'Lead #', dataIndex: 'leadNumber', width: 110,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Name', key: 'name', width: 150,
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.name}</div>
          <div className="text-xs text-gray-400 flex items-center gap-1"><Phone size={10} />{r.phone}</div>
        </div>
      )},
    { title: 'Business', dataIndex: 'businessName', width: 140,
      render: v => <span className="text-sm">{v || '—'}</span> },
    { title: 'City', dataIndex: 'city', width: 90 },
    { title: 'Source', dataIndex: 'source', width: 90,
      render: v => <Tag color="default" className="text-xs">{v || '—'}</Tag> },
    { title: 'Priority', dataIndex: 'priority', width: 80,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 120,
      render: s => <Tag color={STATUS_COLORS[s] || 'default'}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Next Followup', dataIndex: 'nextFollowupDate', width: 120,
      render: v => v ? (
        <span className={`text-xs ${isOverdue(v) ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
          {new Date(v).toLocaleDateString('en-IN')}
          {isOverdue(v) && ' ⚠'}
        </span>
      ) : <span className="text-gray-300">—</span> },
    { title: 'Assigned', dataIndex: 'assignedToName', width: 120,
      render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500"
            onClick={() => openView(r._id)} />
          <Select size="small" placeholder="Status" className="w-28"
            value={undefined} onChange={v => handleStatusUpdate(r._id, v)}
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        </Space>
      )},
  ];

  const dueTodayColumns = [
    ...columns.slice(0, 7),
    { title: 'Actions', width: 80, render: (_, r) => (
      <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500" onClick={() => openView(r._id)} />
    )},
  ];

  const tabItems = [
    { key: 'all', label: 'All Leads',
      children: (
        <Table columns={columns} dataSource={leads} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      )},
    { key: 'due', label: <span>Due Today <Badge count={dueToday.length} size="small" /></span>,
      children: (
        <Table columns={dueTodayColumns} dataSource={dueToday} rowKey="_id" size="middle" scroll={{ x: 1100 }}
          pagination={{ pageSize: 20, showTotal: t => `${t} leads due today` }} />
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users size={24} className="text-blue-600" /> Lead Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage sales leads and follow-ups</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>
          New Lead
        </Button>
      </div>

      {(stats.overdueFollowups > 0) && (
        <Alert type="warning" showIcon className="mb-4"
          message={`${stats.overdueFollowups} leads have overdue follow-ups`}
          icon={<AlertTriangle size={16} />} />
      )}

      <Row gutter={[12, 12]} className="mb-4">
        {[
          ['Total', stats.total, '#1890ff'], ['New', stats.new, '#096dd9'],
          ['Contacted', stats.contacted, '#08979c'], ['Hot', stats.hot, '#f5222d'],
          ['Won', stats.won, '#52c41a'], ['Lost', stats.lost, '#cf1322'],
        ].map(([label, val, color]) => (
          <Col key={label} span={4}>
            <Card size="small"><Statistic title={label} value={val || 0} valueStyle={{ color, fontSize: 18 }} /></Card>
          </Col>
        ))}
      </Row>
      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card size="small" className="border-red-100">
            <Statistic title="Overdue Followups" value={stats.overdueFollowups || 0} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" className="border-green-100">
            <Statistic title="Pipeline Value" value={`₹${(stats.pipelineValue || 0).toLocaleString()}`} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search lead name, phone, business..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Select placeholder="Priority" allowClear value={priorityFilter} onChange={v => setPriorityFilter(v)} className="w-32"
            options={Object.keys(PRIORITY_COLORS).map(p => ({ value: p, label: p }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); setPriorityFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="px-4 pt-2" />
      </div>

      {/* Create Lead Modal */}
      <Modal title="New Lead" open={showCreate} onCancel={() => setShowCreate(false)}
        onOk={handleCreate} confirmLoading={createLoading} okText="Create Lead" width={640} destroyOnHidden>
        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Name *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Full name" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Phone *</label>
              <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit mobile" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Email</label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="Email address" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Business Name</label>
              <Input value={form.businessName} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} placeholder="Company / shop name" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">City</label>
              <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Source</label>
              <Select className="w-full" value={form.source || undefined} onChange={v => setForm(f => ({ ...f, source: v }))}
                placeholder="Select source"
                options={SOURCE_OPTIONS.map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Priority</label>
              <Select className="w-full" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
                options={Object.keys(PRIORITY_COLORS).map(p => ({ value: p, label: p }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Estimated Value (₹)</label>
              <Input type="number" value={form.estimatedValue} onChange={e => setForm(f => ({ ...f, estimatedValue: e.target.value }))} placeholder="0" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Next Followup Date</label>
              <Input type="date" value={form.nextFollowupDate} onChange={e => setForm(f => ({ ...f, nextFollowupDate: e.target.value }))} /></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} /></div>
        </div>
      </Modal>

      {/* View Lead Modal */}
      {viewLead && (
        <Modal title={`Lead: ${viewLead.name || '...'}`} open
          onCancel={() => setViewLead(null)}
          footer={<Button onClick={() => setViewLead(null)}>Close</Button>}
          width={680}>
          <div className="space-y-3 mt-3 text-sm">
            {viewLoading ? <div className="py-8 text-center text-gray-400">Loading...</div> : (
              <>
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  {[['Lead #', viewLead.leadNumber],['Name', viewLead.name],['Phone', viewLead.phone],
                    ['Email', viewLead.email || '—'],['Business', viewLead.businessName || '—'],['City', viewLead.city || '—'],
                    ['Source', viewLead.source || '—'],['Assigned To', viewLead.assignedToName || '—'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                      <span className="text-gray-400">{k}</span><span className="font-medium">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 py-1">
                  <span>Status: <Tag color={STATUS_COLORS[viewLead.status]}>{viewLead.status?.replace(/_/g, ' ')}</Tag></span>
                  <span>Priority: <Tag color={PRIORITY_COLORS[viewLead.priority]}>{viewLead.priority}</Tag></span>
                </div>
                {viewLead.followups?.length > 0 && (
                  <>
                    <Divider className="my-2">Follow-up History</Divider>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {viewLead.followups.map((f, i) => (
                        <div key={i} className="bg-gray-50 rounded px-3 py-2 text-xs border-l-2 border-blue-400">
                          <div className="flex justify-between mb-1">
                            <Tag color="blue" className="text-xs">{f.outcome?.replace(/_/g, ' ')}</Tag>
                            <span className="text-gray-400">{new Date(f.followupDate || f.createdAt).toLocaleDateString('en-IN')}</span>
                          </div>
                          <div>{f.notes}</div>
                          {f.nextFollowupDate && <div className="text-gray-400 mt-1">Next: {new Date(f.nextFollowupDate).toLocaleDateString('en-IN')}</div>}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <Divider className="my-2">Add Follow-up</Divider>
                <div className="space-y-2">
                  <div><label className="text-xs text-gray-500 block mb-1">Notes *</label>
                    <Input.TextArea rows={2} value={followupForm.notes} onChange={e => setFollowupForm(f => ({ ...f, notes: e.target.value }))} placeholder="Follow-up notes..." /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs text-gray-500 block mb-1">Outcome *</label>
                      <Select className="w-full" value={followupForm.outcome || undefined} onChange={v => setFollowupForm(f => ({ ...f, outcome: v }))}
                        placeholder="Select outcome" options={OUTCOME_OPTIONS} /></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Next Followup</label>
                      <Input type="date" value={followupForm.nextFollowupDate} onChange={e => setFollowupForm(f => ({ ...f, nextFollowupDate: e.target.value }))} /></div>
                  </div>
                  <Button type="primary" size="small" loading={followupLoading} onClick={handleAddFollowup}>
                    Add Follow-up
                  </Button>
                </div>
              </>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LeadManagement;
