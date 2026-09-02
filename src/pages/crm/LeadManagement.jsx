import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message, Modal, Form, InputNumber, DatePicker,
  Row, Col, Card, Statistic, Tooltip, Badge, Divider, Timeline, Checkbox
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined, TeamOutlined,
  PhoneOutlined, UserAddOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ClockCircleOutlined, FireOutlined
} from '@ant-design/icons';
import { HiOutlineUser, HiOutlinePhone, HiOutlineMail, HiOutlineLocationMarker, HiOutlineOfficeBuilding, HiOutlineClock, HiOutlineCalendar, HiOutlineCurrencyRupee, HiOutlineTag, HiOutlineClipboardList } from 'react-icons/hi';
import { BsPersonCheck, BsPersonX, BsLightning, BsChatDots } from 'react-icons/bs';
import { FiTarget, FiTrendingUp } from 'react-icons/fi';
import dayjs from 'dayjs';
import crmService from '../../services/crmService.js';
import api from '../../config/api.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { subscribeToLeadEvents } from '../../services/leadEventStream.js';

// Customer types — how the lead came to us
const CUSTOMER_TYPES = [
  { value: 'walk_in', label: 'Walk-in (Store Visit)', color: 'blue' },
  { value: 'phone_enquiry', label: 'Phone Enquiry', color: 'cyan' },
  { value: 'referral', label: 'Referral', color: 'green' },
  { value: 'online_enquiry', label: 'Online Enquiry', color: 'purple' },
  { value: 'whatsapp', label: 'WhatsApp', color: 'lime' },
  { value: 'exhibition', label: 'Exhibition', color: 'orange' },
  { value: 'architect_referral', label: 'Architect Referral', color: 'geekblue' },
  { value: 'dealer_referral', label: 'Dealer Referral', color: 'volcano' },
  { value: 'google_ads', label: 'Google Ads', color: 'red' },
  { value: 'facebook', label: 'Facebook/Instagram', color: 'magenta' },
  { value: 'existing_customer', label: 'Existing Customer', color: 'gold' },
  { value: 'other', label: 'Other', color: 'default' },
];

const PRIORITY_COLORS = { low: 'default', medium: 'blue', high: 'orange', hot: 'red' };
const STATUS_COLORS = {
  new: 'default', assigned: 'cyan', accepted: 'blue', contacted: 'geekblue',
  qualified: 'purple', proposal_sent: 'orange', negotiation: 'gold',
  site_visit: 'lime', won: 'green', lost: 'red', on_hold: 'volcano',
};
const ASSIGNMENT_COLORS = { unassigned: 'red', pending: 'orange', accepted: 'green', declined: 'volcano', reassigned: 'purple' };

const LeadManagement = () => {
  const { confirm, alertModal } = useConfirm();
  const { hasPermission, activeBranchId } = useAuth();
  const canCreate = hasPermission('lead.create');
  const canAssign = hasPermission('lead.assign');
  const canDelete = hasPermission('lead.delete');

  // Core state
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [customerTypeFilter, setCustomerTypeFilter] = useState(undefined);
  const [assignmentFilter, setAssignmentFilter] = useState(undefined);

  // SE Status panel
  const [salesExecutives, setSalesExecutives] = useState([]);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [viewLead, setViewLead] = useState(null);
  const [assignModal, setAssignModal] = useState(null); // lead to assign
  const [selectedSE, setSelectedSE] = useState('');
  const [overrideAvailability, setOverrideAvailability] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [streamState, setStreamState] = useState('connecting');

  // Polling is only used when the authenticated fetch stream is unavailable.
  const pollingRef = useRef(null);

  // ═══════════════════════════════════
  // DATA FETCHING
  // ═══════════════════════════════════

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmService.getLeads({
        page: pagination.current, limit: pagination.pageSize,
        search, status: statusFilter, customerType: customerTypeFilter,
        assignmentStatus: assignmentFilter, sortBy: 'queue',
      });
      if (res.success) {
        setLeads(res.data || []);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter, customerTypeFilter, assignmentFilter]);

  const fetchStats = async () => {
    try {
      const res = await crmService.getLeadStats();
      if (res.success) setStats(res.data || {});
    } catch {}
  };

  const fetchSEStatus = async () => {
    try {
      const res = await crmService.getSEStatus();
      if (res.success) setSalesExecutives(res.data || []);
    } catch {}
  };

  useEffect(() => { fetchLeads(); }, [fetchLeads]);
  useEffect(() => { fetchStats(); if (canAssign) fetchSEStatus(); }, [canAssign]);

  // Authenticated fetch-stream first; polling remains a safe fallback.
  useEffect(() => subscribeToLeadEvents({
    onStateChange: setStreamState,
    onEvent: ({ event, data }) => {
      if (event === 'ready') return;
      fetchLeads();
      fetchStats();
      if (canAssign) fetchSEStatus();
      if (viewLead?._id && (!data?.leadId || String(data.leadId) === String(viewLead._id))) loadLeadDetail(viewLead._id);
    },
  }), [activeBranchId, canAssign, fetchLeads, viewLead?._id]);

  useEffect(() => {
    if (streamState === 'connected') return undefined;
    pollingRef.current = setInterval(() => {
      fetchLeads();
      fetchStats();
      if (canAssign) fetchSEStatus();
    }, 20000);
    return () => clearInterval(pollingRef.current);
  }, [canAssign, fetchLeads, streamState]);

  // ═══════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════

  const handleAssign = async () => {
    if (!selectedSE || !assignModal) return;
    try {
      const res = await crmService.assignLead(assignModal._id, {
        assignedTo: selectedSE,
        expectedVersion: assignModal.assignmentVersion || 0,
        expectedCurrentAssignedTo: assignModal.assignedTo?._id || assignModal.assignedTo || null,
        overrideAvailability,
        overrideReason,
      });
      if (res.success) {
        message.success(res.message || 'Lead assigned!');
        setAssignModal(null); setSelectedSE(''); setOverrideAvailability(false); setOverrideReason('');
        fetchLeads(); fetchStats(); fetchSEStatus();
      }
    } catch (err) { alertModal('Assign Failed', err.message, 'error'); }
  };

  const handleStatusUpdate = async (id, status) => {
    try {
      const res = await crmService.updateLeadStatus(id, { status });
      if (res.success) { message.success(`Status → ${status}`); fetchLeads(); fetchStats(); }
    } catch (err) { message.error(err.message); }
  };

  const handleDelete = async (id) => {
    const proceed = await confirm('Delete this lead?', { type: 'danger', okText: 'Delete', content: 'Lead will be moved to Recycle Bin.' });
    if (!proceed) return;
    try {
      const res = await api.delete(`/leads/${id}`);
      if (res.success) { message.success(res.message); fetchLeads(); fetchStats(); }
    } catch (err) { alertModal('Delete Failed', err.message, 'error'); }
  };

  // ═══════════════════════════════════
  // TABLE COLUMNS
  // ═══════════════════════════════════

  const columns = [
    { title: 'Lead #', dataIndex: 'leadNumber', width: 90, render: v => <span className="text-xs font-mono text-blue-600">{v}</span> },
    { title: 'Customer', key: 'customer', width: 160, render: (_, r) => (
      <div>
        <div className="text-sm font-medium">{r.name}</div>
        <div className="text-[10px] text-gray-400">{r.phone} · {r.city || ''}</div>
      </div>
    )},
    { title: 'Type', dataIndex: 'customerType', width: 120, render: v => {
      const t = CUSTOMER_TYPES.find(ct => ct.value === v);
      return <Tag color={t?.color || 'default'} className="text-[9px]">{t?.label || v || '—'}</Tag>;
    }},
    { title: 'Priority', dataIndex: 'priority', width: 75, render: v => (
      <Tag color={PRIORITY_COLORS[v]} icon={v === 'hot' ? <FireOutlined /> : null}>{v}</Tag>
    )},
    { title: 'Status', dataIndex: 'status', width: 100, render: v => <Tag color={STATUS_COLORS[v]}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Assignment', key: 'assignment', width: 140, render: (_, r) => (
      <div>
        <Tag color={ASSIGNMENT_COLORS[r.assignmentStatus]} className="text-[9px]">{r.assignmentStatus}</Tag>
        {r.assignedToName && <div className="text-[10px] text-gray-500 mt-0.5">{r.assignedToName}</div>}
      </div>
    )},
    { title: 'Value', dataIndex: 'estimatedValue', width: 80, render: v => v ? <span className="text-xs font-medium">₹{v.toLocaleString()}</span> : '—' },
    { title: 'Created', dataIndex: 'createdAt', width: 85, render: v => <span className="text-[10px]">{dayjs(v).format('DD/MM/YY')}</span> },
    { title: 'Actions', width: 150, fixed: 'right', render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500" onClick={() => loadLeadDetail(r._id)} /></Tooltip>
        {canAssign && !['won', 'lost'].includes(r.status) && (
          <Tooltip title={r.assignedTo ? 'Reassign lead' : 'Assign to SE'}><Button type="text" size="small" icon={<UserAddOutlined />} className="text-orange-500" onClick={() => { setAssignModal(r); setSelectedSE(''); setOverrideAvailability(false); setOverrideReason(''); }} /></Tooltip>
        )}
        {canDelete && <Tooltip title="Delete"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleDelete(r._id)} /></Tooltip>}
      </Space>
    )},
  ];

  const loadLeadDetail = useCallback(async (id) => {
    try {
      const res = await crmService.getLead(id);
      if (res.success) setViewLead(res.data);
    } catch (err) { message.error(err.message); }
  }, []);

  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get('lead');
    if (leadId) loadLeadDetail(leadId);
  }, [activeBranchId, loadLeadDetail]);

  const selectedExecutive = salesExecutives.find(se => se._id === selectedSE);

  // ═══════════════════════════════════
  // RENDER
  // ═══════════════════════════════════

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Lead Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign leads to Sales Executives, track conversions & incentives</p>
        </div>
        <Space>
          <ModuleRecycleBin module="lead" title="Deleted Leads" onRestore={fetchLeads} />
          {canCreate && <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Lead</Button>}
        </Space>
      </div>

      {/* Stats Row */}
      <Row gutter={12} className="mb-4">
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<TeamOutlined />} /></Card></Col>
        <Col span={3}><Card size="small" className="border-red-100"><Statistic title="Unassigned" value={stats.unassigned || 0} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={3}><Card size="small" className="border-orange-100"><Statistic title="Pending Accept" value={stats.pending || 0} valueStyle={{ color: '#ea580c' }} /></Card></Col>
        <Col span={3}><Card size="small" className="border-green-100"><Statistic title="Accepted" value={stats.accepted || 0} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Won" value={stats.won || 0} valueStyle={{ color: '#059669' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Lost" value={stats.lost || 0} valueStyle={{ color: '#dc2626' }} /></Card></Col>
        <Col span={3}><Card size="small" className="border-red-200"><Statistic title="Hot Leads" value={stats.hotLeads || 0} valueStyle={{ color: '#dc2626' }} prefix={<FireOutlined />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Today" value={stats.todayLeads || 0} valueStyle={{ color: '#2563eb' }} /></Card></Col>
      </Row>

      {/* SE Availability Panel */}
      {canAssign && <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <TeamOutlined className="text-blue-500" />
          <span className="text-sm font-semibold text-gray-700">Sales Executive Status</span>
          <Badge status={streamState === 'connected' ? 'processing' : 'warning'} text={<span className="text-[10px] text-gray-400">{streamState === 'connected' ? 'Live event stream' : 'Polling fallback'}</span>} />
        </div>
        <div className="flex flex-wrap gap-2">
          {salesExecutives.map(se => (
            <div key={se._id} className={`px-3 py-1.5 rounded-lg border text-xs ${!se.canAssign ? 'bg-red-50 border-red-200' : se.pendingResponse > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
              <div className="font-medium">{se.name} <span className="uppercase text-[9px] text-gray-400">{se.availability}</span></div>
              <div className="text-[10px] text-gray-500">
                {se.activeLeads}/{se.workloadLimit} active · {se.pendingResponse} pending
                {!se.canAssign && <span className="text-red-600 ml-1 font-semibold">UNAVAILABLE</span>}
              </div>
              {se.statusReason && <div className="text-[9px] text-gray-400">{se.statusReason}</div>}
            </div>
          ))}
          {salesExecutives.length === 0 && <span className="text-gray-400 text-xs">No sales executives found</span>}
        </div>
      </div>}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search name, phone, lead #..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-56" allowClear />
          <Select placeholder="Assignment" value={assignmentFilter} onChange={v => setAssignmentFilter(v)} allowClear className="w-32"
            options={[{ value: 'unassigned', label: 'Unassigned' }, { value: 'pending', label: 'Pending Accept' }, { value: 'accepted', label: 'Accepted' }, { value: 'declined', label: 'Declined' }]} />
          <Select placeholder="Customer Type" value={customerTypeFilter} onChange={v => setCustomerTypeFilter(v)} allowClear className="w-36"
            options={CUSTOMER_TYPES} />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-28"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); setCustomerTypeFilter(undefined); setAssignmentFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={leads} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))}
          rowClassName={r => r.assignmentStatus === 'unassigned' ? 'bg-red-50/50' : r.assignmentStatus === 'pending' ? 'bg-orange-50/30' : ''} />
      </div>

      {/* ═══════════════════════════════ ASSIGN MODAL ═══════════════════════════════ */}
      <Modal title={`${assignModal?.assignedTo ? 'Reassign' : 'Assign'} Lead — ${assignModal?.leadNumber || ''}`} open={!!assignModal} onCancel={() => setAssignModal(null)}
        onOk={handleAssign} okText={assignModal?.assignedTo ? 'Reassign' : 'Assign'}
        okButtonProps={{ disabled: !selectedSE || (!!selectedExecutive && !selectedExecutive.canAssign && (!overrideAvailability || !overrideReason.trim())) }} width={500}>
        {assignModal && (
          <div className="space-y-3 mt-3">
            <div className="bg-gray-50 p-3 rounded border">
              <div className="font-medium">{assignModal.name} — {assignModal.phone}</div>
              <div className="text-xs text-gray-500">Version {assignModal.assignmentVersion || 0} · {assignModal.assignmentStatus} · Est. ₹{assignModal.estimatedValue || 0}</div>
            </div>
            <Checkbox checked={overrideAvailability} onChange={event => { setOverrideAvailability(event.target.checked); setSelectedSE(''); }}>
              Authorized availability/workload override
            </Checkbox>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Select Sales Executive *</label>
              <Select showSearch className="w-full" size="large" value={selectedSE || undefined}
                placeholder="Choose SE to assign..." optionFilterProp="label"
                onChange={v => setSelectedSE(v)}
                options={salesExecutives.map(se => ({
                  value: se._id,
                  label: `${se.name} · ${se.availability || 'offline'} · ${se.activeLeads}/${se.workloadLimit} active`,
                  disabled: !se.canAssign && !overrideAvailability,
                }))} />
            </div>
            {selectedExecutive && !selectedExecutive.canAssign && overrideAvailability && (
              <Input.TextArea value={overrideReason} onChange={event => setOverrideReason(event.target.value)}
                placeholder="Override reason is required" rows={2} />
            )}
            {selectedSE && <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">The executive must accept before the configured deadline.</div>}
          </div>
        )}
      </Modal>

      {/* ═══════════════════════════════ CREATE LEAD MODAL ═══════════════════════════════ */}
      <CreateLeadModal open={showCreate} onClose={() => setShowCreate(false)}
        onSuccess={() => { fetchLeads(); fetchStats(); }} />

      {/* ═══════════════════════════════ VIEW LEAD DETAIL ═══════════════════════════════ */}
      {viewLead && (
        <Modal title={null} open onCancel={() => setViewLead(null)} width={800}
          footer={
            <div className="flex justify-between items-center">
              <div className="text-xs text-gray-400">Created {dayjs(viewLead.createdAt).format('DD MMM YYYY, hh:mm A')} by {viewLead.createdByName || '—'}</div>
              <Button onClick={() => setViewLead(null)}>Close</Button>
            </div>
          }>
          <div className="space-y-5">
            {/* Header with lead number and status badges */}
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <div className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <span className="text-[#FF5F03]">{viewLead.leadNumber}</span>
                  <Tag color={PRIORITY_COLORS[viewLead.priority]} icon={viewLead.priority === 'hot' ? <FireOutlined /> : null}>{viewLead.priority}</Tag>
                </div>
                <div className="flex gap-2 mt-1">
                  <Tag color={STATUS_COLORS[viewLead.status]}>{viewLead.status?.replace(/_/g, ' ')}</Tag>
                  <Tag color={CUSTOMER_TYPES.find(t => t.value === viewLead.customerType)?.color}>
                    {CUSTOMER_TYPES.find(t => t.value === viewLead.customerType)?.label || viewLead.customerType}
                  </Tag>
                </div>
              </div>
              {viewLead.incentiveEligible && (
                <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-2 text-center">
                  <div className="text-[10px] text-green-600 uppercase font-semibold">Incentive</div>
                  <div className="text-lg font-bold text-green-700">₹{viewLead.incentiveAmount?.toLocaleString()}</div>
                  <div className="text-[9px] text-green-500">{viewLead.incentivePaid ? 'PAID' : 'Pending'}</div>
                </div>
              )}
            </div>

            {/* Customer Information Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
              <div className="text-xs font-semibold text-blue-700 uppercase mb-3 flex items-center gap-1"><HiOutlineUser className="text-base" /> Customer Information</div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                <div className="flex items-center gap-2 text-sm"><HiOutlineUser className="text-gray-400" /><span className="text-gray-500">Name:</span><span className="font-medium">{viewLead.name}</span></div>
                <div className="flex items-center gap-2 text-sm"><HiOutlinePhone className="text-gray-400" /><span className="text-gray-500">Phone:</span><span className="font-medium">{viewLead.phone}</span>{viewLead.alternatePhone && <span className="text-xs text-gray-400">/ {viewLead.alternatePhone}</span>}</div>
                <div className="flex items-center gap-2 text-sm"><HiOutlineMail className="text-gray-400" /><span className="text-gray-500">Email:</span><span className="font-medium">{viewLead.email || '—'}</span></div>
                <div className="flex items-center gap-2 text-sm"><HiOutlineOfficeBuilding className="text-gray-400" /><span className="text-gray-500">Business:</span><span className="font-medium">{viewLead.businessName || '—'}</span></div>
                <div className="flex items-center gap-2 text-sm"><HiOutlineLocationMarker className="text-gray-400" /><span className="text-gray-500">City:</span><span className="font-medium">{viewLead.city || '—'}{viewLead.state ? `, ${viewLead.state}` : ''}{viewLead.pinCode ? ` - ${viewLead.pinCode}` : ''}</span></div>
                <div className="flex items-center gap-2 text-sm"><HiOutlineTag className="text-gray-400" /><span className="text-gray-500">Referred By:</span><span className="font-medium">{viewLead.referredBy || '—'}</span></div>
              </div>
            </div>

            {/* Project & Interest Card */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
              <div className="text-xs font-semibold text-amber-700 uppercase mb-3 flex items-center gap-1"><FiTarget className="text-base" /> Project & Interest</div>
              <div className="grid grid-cols-3 gap-4">
                <div><div className="text-[10px] text-gray-400 uppercase">Project Type</div><div className="text-sm font-medium capitalize">{viewLead.projectType || '—'}</div></div>
                <div><div className="text-[10px] text-gray-400 uppercase">Estimated Value</div><div className="text-sm font-bold text-[#FF5F03]">₹{(viewLead.estimatedValue || 0).toLocaleString()}</div></div>
                <div><div className="text-[10px] text-gray-400 uppercase">Area (sqft)</div><div className="text-sm font-medium">{viewLead.estimatedArea || '—'} sqft</div></div>
              </div>
              {viewLead.interestedIn?.length > 0 && (
                <div className="mt-3"><span className="text-[10px] text-gray-400 uppercase">Interested In: </span>{viewLead.interestedIn.map((item, i) => <Tag key={i} className="text-[9px]">{item}</Tag>)}</div>
              )}
              {viewLead.remarks && <div className="mt-2 text-xs text-gray-600 bg-white/60 p-2 rounded italic">"{viewLead.remarks}"</div>}
            </div>

            {/* Assignment Card */}
            <div className={`rounded-xl p-4 border ${viewLead.assignmentStatus === 'accepted' ? 'bg-green-50 border-green-200' : viewLead.assignmentStatus === 'pending' ? 'bg-orange-50 border-orange-200' : viewLead.assignmentStatus === 'declined' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="text-xs font-semibold text-gray-700 uppercase mb-3 flex items-center gap-1"><BsPersonCheck className="text-base" /> Assignment Status</div>
              <div className="flex items-center gap-4">
                <Tag color={ASSIGNMENT_COLORS[viewLead.assignmentStatus]} className="text-sm px-3 py-0.5">{viewLead.assignmentStatus}</Tag>
                {viewLead.assignedTo?.name && (
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-sm">{viewLead.assignedTo.name.charAt(0)}</div>
                    <div>
                      <div className="text-sm font-medium">{viewLead.assignedTo.name}</div>
                      <div className="text-[10px] text-gray-400">{viewLead.assignedTo.phone || ''} · {viewLead.assignedTo.role}</div>
                    </div>
                  </div>
                )}
              </div>
              {viewLead.acceptedAt && <div className="text-[10px] text-green-600 mt-2 flex items-center gap-1"><HiOutlineClock /> Accepted: {dayjs(viewLead.acceptedAt).format('DD MMM YYYY, hh:mm A')}</div>}
              {viewLead.declineReason && <div className="text-[10px] text-red-600 mt-2 flex items-center gap-1"><BsPersonX /> Decline Reason: {viewLead.declineReason}</div>}
            </div>

            {/* Assignment History */}
            {viewLead.assignmentHistory?.length > 0 && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="text-xs font-semibold text-gray-700 uppercase mb-3 flex items-center gap-1"><HiOutlineClipboardList className="text-base" /> Assignment History</div>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {viewLead.assignmentHistory.map((h, i) => (
                    <div key={i} className={`flex items-center gap-3 p-2 rounded-lg text-xs ${h.response === 'accepted' ? 'bg-green-50' : h.response === 'declined' ? 'bg-red-50' : 'bg-blue-50'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] ${h.response === 'accepted' ? 'bg-green-500' : h.response === 'declined' ? 'bg-red-500' : 'bg-blue-500'}`}>
                        {h.response === 'accepted' ? '✓' : h.response === 'declined' ? '✗' : '→'}
                      </div>
                      <div className="flex-1">
                        <span className="font-medium">{h.assignedToName}</span>
                        <span className="text-gray-400 mx-1">—</span>
                        <span className={h.response === 'accepted' ? 'text-green-600' : h.response === 'declined' ? 'text-red-600' : 'text-blue-600'}>{h.response}</span>
                        {h.declineReason && <span className="text-red-400 ml-1">({h.declineReason})</span>}
                      </div>
                      <div className="text-[10px] text-gray-400 shrink-0">{dayjs(h.assignedAt).format('DD/MM HH:mm')}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Follow-ups */}
            {viewLead.followups?.length > 0 && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="text-xs font-semibold text-gray-700 uppercase mb-3 flex items-center gap-1"><BsChatDots className="text-base" /> Follow-up History ({viewLead.totalFollowups || viewLead.followups.length})</div>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {viewLead.followups.slice().reverse().map((f, i) => (
                    <div key={i} className="flex gap-3 p-2 bg-gray-50 rounded-lg">
                      <div className="w-1 rounded-full bg-blue-300 shrink-0"></div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center">
                          <Tag color={f.outcome === 'interested' ? 'green' : f.outcome === 'not_interested' ? 'red' : f.outcome === 'converted' ? 'purple' : 'blue'} className="text-[9px]">{f.outcome?.replace(/_/g, ' ')}</Tag>
                          <span className="text-[10px] text-gray-400">{dayjs(f.date).format('DD MMM YYYY')}</span>
                        </div>
                        {f.notes && <div className="text-xs text-gray-600 mt-1">{f.notes}</div>}
                        <div className="text-[10px] text-gray-400 mt-0.5">By: {f.doneByName || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Visits and immutable activity */}
            {viewLead.visits?.length > 0 && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="text-xs font-semibold text-gray-700 uppercase mb-3">Visits</div>
                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {viewLead.visits.map(visit => <div key={visit._id} className="flex justify-between text-xs bg-gray-50 rounded p-2"><span>{dayjs(visit.scheduledAt).format('DD MMM YYYY, hh:mm A')} · {visit.location?.address || 'No address'}</span><Tag>{visit.status}</Tag></div>)}
                </div>
              </div>
            )}
            {viewLead.activities?.length > 0 && (
              <div className="bg-white rounded-xl p-4 border">
                <div className="text-xs font-semibold text-gray-700 uppercase mb-3">Immutable Activity</div>
                <Timeline items={viewLead.activities.slice(0, 20).map(activity => ({ children: <div className="text-xs"><div>{activity.summary}</div><div className="text-gray-400">{dayjs(activity.createdAt).format('DD MMM, hh:mm A')} · {activity.actorName || 'System'}</div></div> }))} />
              </div>
            )}

            {/* Key Dates */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 rounded-lg p-3 text-center border">
                <HiOutlineCalendar className="text-lg text-gray-400 mx-auto" />
                <div className="text-[10px] text-gray-400 mt-1">Created</div>
                <div className="text-xs font-medium">{dayjs(viewLead.createdAt).format('DD MMM YY')}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center border">
                <HiOutlineClock className="text-lg text-gray-400 mx-auto" />
                <div className="text-[10px] text-gray-400 mt-1">Last Contact</div>
                <div className="text-xs font-medium">{viewLead.lastContactDate ? dayjs(viewLead.lastContactDate).format('DD MMM YY') : '—'}</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center border">
                <FiTrendingUp className="text-lg text-gray-400 mx-auto" />
                <div className="text-[10px] text-gray-400 mt-1">Next Follow-up</div>
                <div className="text-xs font-medium">{viewLead.nextFollowupDate ? dayjs(viewLead.nextFollowupDate).format('DD MMM YY') : '—'}</div>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// CREATE LEAD MODAL
// ═══════════════════════════════════════════════
const CreateLeadModal = ({ open, onClose, onSuccess }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.nextFollowupDate) values.nextFollowupDate = values.nextFollowupDate.format('YYYY-MM-DD');
      setLoading(true);
      const res = await crmService.createLead(values);
      if (res.success) {
        message.success(res.message || 'Lead created!');
        form.resetFields();
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed');
    } finally { setLoading(false); }
  };

  return (
    <Modal title="New Lead" open={open} onCancel={onClose} width={700} footer={null} destroyOnHidden>
      <Form form={form} layout="vertical" className="mt-4">
        <Row gutter={16}>
          <Col span={8}><Form.Item name="name" label="Customer Name" rules={[{ required: true }]}><Input placeholder="Full name" /></Form.Item></Col>
          <Col span={8}><Form.Item name="phone" label="Phone" rules={[{ required: true }]}><Input placeholder="Mobile number" /></Form.Item></Col>
          <Col span={8}><Form.Item name="customerType" label="Legacy Source Category" rules={[{ required: true }]}>
            <Select placeholder="Select category..." options={CUSTOMER_TYPES} />
          </Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}><Form.Item name="email" label="Email"><Input placeholder="Email (optional)" /></Form.Item></Col>
          <Col span={8}><Form.Item name="businessName" label="Business Name"><Input placeholder="Company/Shop" /></Form.Item></Col>
          <Col span={8}><Form.Item name="city" label="City"><Input placeholder="City" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="priority" label="Priority" initialValue="medium">
            <Select options={[{ value: 'low', label: 'Low' }, { value: 'medium', label: 'Medium' }, { value: 'high', label: 'High' }, { value: 'hot', label: '🔥 Hot' }]} />
          </Form.Item></Col>
          <Col span={6}><Form.Item name="projectType" label="Project Type" initialValue="residential">
            <Select options={[{ value: 'residential', label: 'Residential' }, { value: 'commercial', label: 'Commercial' }, { value: 'hospitality', label: 'Hospitality' }, { value: 'renovation', label: 'Renovation' }, { value: 'other', label: 'Other' }]} />
          </Form.Item></Col>
          <Col span={6}><Form.Item name="estimatedValue" label="Est. Value ₹"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
          <Col span={6}><Form.Item name="estimatedArea" label="Area (sqft)"><InputNumber min={0} className="w-full" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={6}><Form.Item name="leadSource" label="Source"><Input placeholder="Referral, campaign, organic..." /></Form.Item></Col>
          <Col span={6}><Form.Item name="leadChannel" label="Channel"><Select allowClear options={['store_visit', 'phone', 'whatsapp', 'online', 'referral', 'exhibition', 'social', 'other'].map(value => ({ value, label: value.replace(/_/g, ' ') }))} /></Form.Item></Col>
          <Col span={6}><Form.Item name="leadType" label="Lead Type"><Input placeholder="Retail, project, trade..." /></Form.Item></Col>
          <Col span={6}><Form.Item name="campaign" label="Campaign"><Input placeholder="Campaign name/code" /></Form.Item></Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}><Form.Item name="referredBy" label="Referred By"><Input placeholder="Referral name (if any)" /></Form.Item></Col>
          <Col span={12}><Form.Item name="nextFollowupDate" label="Next Follow-up"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
        </Row>
        <Form.Item name="remarks" label="Remarks / Interest"><Input.TextArea rows={2} placeholder="What are they looking for? Any specific products/brands?" /></Form.Item>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading}>Create Lead</Button>
        </div>
      </Form>
    </Modal>
  );
};

export default LeadManagement;
