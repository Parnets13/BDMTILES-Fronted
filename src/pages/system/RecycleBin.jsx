import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, UndoOutlined,
  DeleteOutlined, ClearOutlined, ExclamationCircleOutlined
} from '@ant-design/icons';
import api from '../../config/api.js';

const MODULE_COLORS = {
  product: 'blue', sales_order: 'orange', purchase: 'cyan',
  dealer: 'green', supplier: 'purple', quotation: 'geekblue',
  payment: 'gold', stock: 'volcano', hrms: 'magenta',
};

const RecycleBin = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({ total: 0, byModule: [] });
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState(undefined);

  const [cleanupModal, setCleanupModal] = useState(false);
  const [cleanupDays, setCleanupDays] = useState(30);
  const [cleanupLoading, setCleanupLoading] = useState(false);

  const loadStats = () => {
    api.get('/system/recycle-bin/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/recycle-bin', {
        params: { page: pagination.current, limit: pagination.pageSize, search, module: moduleFilter },
      });
      if (res.success) {
        setItems(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, moduleFilter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleRestore = async (id, title) => {
    Modal.confirm({
      title: 'Restore this item?',
      content: `"${title}" will be restored to its original location.`,
      okText: 'Restore',
      onOk: async () => {
        try {
          const res = await api.post(`/system/recycle-bin/${id}/restore`);
          if (res.success) { message.success(res.message); fetchItems(); loadStats(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const handlePermanentDelete = async (id, title) => {
    Modal.confirm({
      title: 'Permanently Delete?',
      icon: <ExclamationCircleOutlined className="text-red-500" />,
      content: <div>
        <p><strong>"{title}"</strong> will be permanently removed.</p>
        <p className="text-red-600 text-sm mt-2">This action CANNOT be undone.</p>
      </div>,
      okText: 'Permanently Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          const res = await api.delete(`/system/recycle-bin/${id}`);
          if (res.success) { message.success(res.message); fetchItems(); loadStats(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const handleCleanup = async () => {
    setCleanupLoading(true);
    try {
      const res = await api.post('/system/recycle-bin/cleanup', { olderThanDays: cleanupDays });
      if (res.success) {
        message.success(res.message);
        setCleanupModal(false);
        fetchItems(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setCleanupLoading(false); }
  };

  const columns = [
    { title: 'Record', key: 'record', width: 220,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium">{r.recordTitle || r.recordCode || '—'}</div>
          <div className="text-[10px] text-gray-400">{r.originalModel} · ID: {String(r.originalId).slice(-8)}</div>
        </div>
      )},
    { title: 'Module', dataIndex: 'module', width: 110,
      render: v => <Tag color={MODULE_COLORS[v] || 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Type', dataIndex: 'originalModel', width: 120,
      render: v => <span className="text-xs font-medium">{v}</span> },
    { title: 'Deleted By', dataIndex: 'deletedByName', width: 130,
      render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Deleted At', dataIndex: 'deletedAt', width: 140,
      render: v => (
        <div>
          <div className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</div>
          <div className="text-[10px] text-gray-400">{new Date(v).toLocaleTimeString('en-IN')}</div>
        </div>
      )},
    { title: 'Auto-Delete In', key: 'ttl', width: 110,
      render: (_, r) => {
        const days = Math.max(0, 30 - Math.floor((Date.now() - new Date(r.deletedAt)) / (1000 * 60 * 60 * 24)));
        return <span className={`text-xs font-medium ${days <= 5 ? 'text-red-600' : days <= 15 ? 'text-orange-500' : 'text-gray-600'}`}>{days} days</span>;
      }},
    { title: 'Reason', dataIndex: 'deleteReason', width: 150,
      render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
    { title: 'Actions', width: 140,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" type="primary" ghost icon={<UndoOutlined />}
            onClick={() => handleRestore(r._id, r.recordTitle || r.recordCode)}>Restore</Button>
          <Button size="small" danger icon={<DeleteOutlined />}
            onClick={() => handlePermanentDelete(r._id, r.recordTitle || r.recordCode)} />
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Recycle Bin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Deleted items are kept for 30 days. Restore or permanently remove.</p>
        </div>
        <Button icon={<ClearOutlined />} danger onClick={() => setCleanupModal(true)}>
          Manual Cleanup
        </Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Card size="small" className="border-red-100">
            <Statistic title="Total Deleted Items" value={stats.total || 0} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        {(stats.byModule || []).slice(0, 4).map(m => (
          <Col span={4} key={m._id}>
            <Card size="small">
              <Statistic title={m._id?.replace(/_/g, ' ') || '—'} value={m.count || 0} valueStyle={{ fontSize: 16 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search record name, code..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
            className="w-64" allowClear />
          <Select placeholder="Module" allowClear value={moduleFilter} onChange={v => setModuleFilter(v)} className="w-40"
            options={['product','sales_order','purchase','dealer','supplier','quotation','payment','hrms','stock'].map(m => ({value:m, label:m.replace(/_/g,' ')}))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setModuleFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={items} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({...p, current: pag.current, pageSize: pag.pageSize}))}
          locale={{ emptyText: <div className="py-8 text-gray-400">Recycle bin is empty. Deleted items will appear here.</div> }} />
      </div>

      {/* Cleanup Modal */}
      <Modal title="Manual Cleanup" open={cleanupModal} onCancel={() => setCleanupModal(false)}
        onOk={handleCleanup} confirmLoading={cleanupLoading} okText="Run Cleanup" okButtonProps={{ danger: true }}>
        <div className="space-y-3 mt-4">
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            This will permanently delete all recycle bin items older than the specified days. This cannot be undone.
          </div>
          <div>
            <label className="text-sm font-semibold block mb-1">Delete items older than (days)</label>
            <InputNumber min={1} max={365} value={cleanupDays} onChange={v => setCleanupDays(v || 30)} className="w-full" />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RecycleBin;
