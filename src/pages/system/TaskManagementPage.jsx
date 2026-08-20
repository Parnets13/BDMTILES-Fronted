import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, CheckCircleOutlined, PlayCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api.js';

const STATUS_COLORS = { pending: 'orange', in_progress: 'blue', completed: 'green', cancelled: 'default', overdue: 'red' };
const PRIORITY_COLORS = { low: 'default', medium: 'blue', high: 'orange', critical: 'red' };

const TaskManagementPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);

  const loadStats = () => { api.get('/tasks/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/tasks', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setTasks(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const handleStatus = async (id, status) => {
    try {
      const res = await api.patch(`/tasks/${id}/status`, { status });
      if (res.success) { message.success(res.message); fetchTasks(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Task #', dataIndex: 'taskNumber', width: 100, render: v => <span className="text-xs font-mono text-blue-600">{v}</span> },
    { title: 'Title', dataIndex: 'title', width: 200 },
    { title: 'Assigned To', key: 'to', width: 120, render: (_, r) => r.assignedTo?.name || '—' },
    { title: 'Due Date', dataIndex: 'dueDate', width: 100, render: v => <span className={`text-xs ${new Date(v) < new Date() ? 'text-red-500 font-medium' : ''}`}>{dayjs(v).format('DD/MM/YY')}</span> },
    { title: 'Priority', dataIndex: 'priority', width: 80, render: v => <Tag color={PRIORITY_COLORS[v]}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLORS[s]}>{s.replace('_',' ')}</Tag> },
    { title: 'Actions', width: 120, render: (_, r) => (
      <Space size="small">
        {r.status === 'pending' && <Tooltip title="Start"><Button type="text" size="small" icon={<PlayCircleOutlined />} className="text-blue-600" onClick={() => handleStatus(r._id, 'in_progress')} /></Tooltip>}
        {r.status === 'in_progress' && <Tooltip title="Complete"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleStatus(r._id, 'completed')} /></Tooltip>}
        {!['completed','cancelled'].includes(r.status) && <Tooltip title="Cancel"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleStatus(r._id, 'cancelled')} /></Tooltip>}
      </Space>
    )},
  ];

  const handleCreate = async (values) => {
    try {
      const res = await api.post('/tasks', values);
      if (res.success) { message.success(res.message); setShowCreate(false); fetchTasks(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Task Management</h1><p className="text-sm text-gray-500 mt-0.5">Assign tasks, track progress, manage deadlines</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Task</Button>
      </div>
      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Pending" value={stats.pending || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="In Progress" value={stats.inProgress || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Completed" value={stats.completed || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Overdue" value={stats.overdue || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search task #, title..." prefix={<SearchOutlined className="text-gray-400" />} value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32" options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace('_',' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={tasks} rowKey="_id" loading={loading} size="middle" pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }} onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>
      <Modal title="New Task" open={showCreate} onCancel={() => setShowCreate(false)} footer={null} destroyOnHidden width={600}>
        <CreateTaskForm onSubmit={handleCreate} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
};

const CreateTaskForm = ({ onSubmit, onCancel }) => {
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', dueDate: dayjs().add(3, 'day').format('YYYY-MM-DD'), assignedTo: '', department: '' });
  const [users, setUsers] = useState([]);
  useEffect(() => { api.get('/users', { params: { limit: 100 } }).then(r => { if (r.success) setUsers(r.data || []); }).catch(() => {}); }, []);
  return (
    <div className="space-y-4 mt-4">
      <div><label className="text-xs text-gray-500 block mb-1">Title *</label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Task title" size="large" /></div>
      <div><label className="text-xs text-gray-500 block mb-1">Description</label><Input.TextArea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Assign To *</label><Select showSearch className="w-full" size="large" value={form.assignedTo || undefined} placeholder="Select..." optionFilterProp="label" onChange={v => setForm(f => ({ ...f, assignedTo: v }))} options={users.map(u => ({ value: u._id, label: u.name }))} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Priority</label><Select value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))} className="w-full" options={[{ value: 'low', label: 'Low' },{ value: 'medium', label: 'Medium' },{ value: 'high', label: 'High' },{ value: 'critical', label: 'Critical' }]} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Due Date *</label><Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} /></div>
      </div>
      <div className="flex justify-end gap-2 pt-3 border-t"><Button onClick={onCancel}>Cancel</Button><Button type="primary" onClick={() => { if (!form.title || !form.assignedTo) { message.error('Fill required fields'); return; } onSubmit(form); }}>Create Task</Button></div>
    </div>
  );
};

export default TaskManagementPage;
