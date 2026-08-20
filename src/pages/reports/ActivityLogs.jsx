import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, ClearOutlined,
  UserOutlined, ClockCircleOutlined, AuditOutlined
} from '@ant-design/icons';
import api from '../../config/api.js';

const ACTION_COLORS = {
  create: 'green', update: 'blue', delete: 'red', restore: 'cyan',
  permanent_delete: 'volcano', view: 'default', download: 'purple',
  login: 'geekblue', logout: 'default', access: 'default',
  approve: 'green', reject: 'red', status_change: 'orange', bulk_update: 'magenta',
};

const MODULE_OPTIONS = [
  'product', 'sales_order', 'purchase', 'purchase_return', 'sales_return',
  'payment', 'hrms', 'master', 'category', 'user', 'auth', 'pricing',
  'quotation', 'ledger', 'cheque', 'voucher', 'dispatch', 'lead',
  'complaint', 'approval', 'scheme', 'stock', 'supplier_invoice', 'recycle_bin',
];

const ACTION_OPTIONS = [
  'create', 'update', 'delete', 'restore', 'permanent_delete',
  'approve', 'reject', 'status_change', 'bulk_update', 'login', 'logout', 'download',
];

const ActivityLogs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, todayCount: 0, byAction: [], byModule: [] });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 });
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState(undefined);
  const [moduleFilter, setModuleFilter] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [cleanupModal, setCleanupModal] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(60);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const loadStats = () => {
    api.get('/system/activity-logs/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/activity-logs', {
        params: {
          page: pagination.current, limit: pagination.pageSize,
          search, action: actionFilter, module: moduleFilter, dateFrom, dateTo,
        },
      });
      if (res.success) {
        setLogs(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, actionFilter, moduleFilter, dateFrom, dateTo]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const handleCleanup = async () => {
    setCleanupLoading(true);
    try {
      const res = await api.post('/system/activity-logs/cleanup', { olderThanDays: cleanupDays });
      if (res.success) { message.success(res.message); setCleanupModal(false); fetchLogs(); loadStats(); }
    } catch (err) { message.error(err.message); }
    finally { setCleanupLoading(false); }
  };

  const columns = [
    { title: 'Time', dataIndex: 'timestamp', width: 130,
      render: v => (
        <div>
          <div className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</div>
          <div className="text-[10px] text-gray-400">{new Date(v).toLocaleTimeString('en-IN')}</div>
        </div>
      )},
    { title: 'User', key: 'user', width: 130,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium">{r.userName || '—'}</div>
          <div className="text-[10px] text-gray-400">{r.userRole || ''}</div>
        </div>
      )},
    { title: 'Action', dataIndex: 'action', width: 110,
      render: v => <Tag color={ACTION_COLORS[v] || 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Module', dataIndex: 'module', width: 120,
      render: v => <Tag className="text-[10px]">{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Record', key: 'record', width: 160,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-blue-600">{r.recordTitle || '—'}</div>
          {r.recordModel && <div className="text-[10px] text-gray-400">{r.recordModel}</div>}
        </div>
      )},
    { title: 'Description', dataIndex: 'description', width: 250,
      render: v => <span className="text-xs text-gray-600">{v || '—'}</span> },
    { title: 'IP', dataIndex: 'ipAddress', width: 110,
      render: v => <span className="text-[10px] font-mono text-gray-400">{v || '—'}</span> },
    { title: 'Device', dataIndex: 'device', width: 70,
      render: v => <span className="text-[10px]">{v || 'web'}</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Activity Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete audit trail — who did what, when, from where. Auto-deletes after 60 days.</p>
        </div>
        <Space>
          <Button icon={<ClearOutlined />} danger onClick={() => setCleanupModal(true)}>Manual Cleanup</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchLogs(); loadStats(); }}>Refresh</Button>
        </Space>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Logs" value={stats.total || 0} prefix={<AuditOutlined />} valueStyle={{fontSize:16}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Today" value={stats.todayCount || 0} prefix={<ClockCircleOutlined />} valueStyle={{fontSize:16, color:'#1890ff'}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Retention" value="60 days" valueStyle={{fontSize:14}} /></Card></Col>
        <Col span={12}>
          <Card size="small">
            <div className="text-[10px] text-gray-400 mb-1">Top Actions</div>
            <div className="flex flex-wrap gap-1">
              {(stats.byAction || []).slice(0, 6).map(a => (
                <Tag key={a._id} color={ACTION_COLORS[a._id] || 'default'} className="text-[9px]">
                  {a._id}: {a.count}
                </Tag>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input placeholder="Search user, description, record..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
            className="w-56" allowClear />
          <Select placeholder="Action" allowClear value={actionFilter} onChange={v => setActionFilter(v)} className="w-36"
            options={ACTION_OPTIONS.map(a => ({value:a, label:a.replace(/_/g,' ')}))} />
          <Select placeholder="Module" allowClear value={moduleFilter} onChange={v => setModuleFilter(v)} className="w-40"
            options={MODULE_OPTIONS.map(m => ({value:m, label:m.replace(/_/g,' ')}))} />
          <div><label className="text-[10px] text-gray-400 block">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-32" /></div>
          <div><label className="text-[10px] text-gray-400 block">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-32" /></div>
          <Button onClick={() => { setSearch(''); setActionFilter(undefined); setModuleFilter(undefined); setDateFrom(''); setDateTo(''); }}>Clear</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={logs} rowKey="_id" loading={loading}
          size="small" scroll={{ x: 1200 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} logs` }}
          onChange={pag => setPagination(p => ({...p, current: pag.current, pageSize: pag.pageSize}))} />
      </div>

      {/* Cleanup Modal */}
      <Modal title="Manual Log Cleanup" open={cleanupModal} onCancel={() => setCleanupModal(false)}
        onOk={handleCleanup} confirmLoading={cleanupLoading} okText="Run Cleanup" okButtonProps={{ danger: true }}>
        <div className="space-y-3 mt-4">
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            This will permanently delete all activity logs older than the specified days. Default auto-delete is 60 days.
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Delete logs older than (days)</label>
            <InputNumber min={1} max={365} value={cleanupDays} onChange={v => setCleanupDays(v || 60)} className="w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ActivityLogs;
