import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, DownloadOutlined, DeleteOutlined, FileOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api.js';

const CATEGORY_COLORS = { dealer: 'blue', supplier: 'purple', employee: 'green', vehicle: 'cyan', asset: 'orange', agreement: 'geekblue', invoice: 'lime', other: 'default' };

const DocumentManagementPage = () => {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);

  const loadStats = () => { api.get('/documents/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/documents', { params: { page: pagination.current, limit: pagination.pageSize, search, category: categoryFilter } });
      if (res.success) { setDocuments(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, categoryFilter]);

  useEffect(() => { fetchDocuments(); }, [fetchDocuments]);

  const columns = [
    { title: 'Code', dataIndex: 'documentCode', width: 100, render: v => <span className="text-xs font-mono">{v}</span> },
    { title: 'Title', dataIndex: 'title', width: 200 },
    { title: 'Category', dataIndex: 'category', width: 100, render: v => <Tag color={CATEGORY_COLORS[v]}>{v}</Tag> },
    { title: 'Linked To', key: 'linked', width: 140, render: (_, r) => r.linkedEntityName || <span className="text-gray-400">—</span> },
    { title: 'Expiry', key: 'expiry', width: 100, render: (_, r) => r.hasExpiry ? <span className={`text-xs ${new Date(r.expiryDate) < new Date() ? 'text-red-500 font-bold' : ''}`}>{dayjs(r.expiryDate).format('DD/MM/YY')}</span> : '—' },
    { title: 'Downloads', dataIndex: 'downloadCount', width: 80 },
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        {r.fileUrl && <Tooltip title="Download"><Button type="text" size="small" icon={<DownloadOutlined />} className="text-blue-600" onClick={() => { window.open(r.fileUrl, '_blank'); api.patch(`/documents/${r._id}/download`); }} /></Tooltip>}
        <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={async () => { await api.delete(`/documents/${r._id}`); fetchDocuments(); loadStats(); }} /></Tooltip>
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Document Management</h1><p className="text-sm text-gray-500 mt-0.5">Centralized document store with expiry tracking and access control</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>Upload Document</Button>
      </div>
      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<FileOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Active" value={stats.active || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Expired" value={stats.expired || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Expiring Soon" value={stats.expiringSoon || 0} valueStyle={{ color: '#fa8c16' }} prefix={<WarningOutlined />} /></Card></Col>
      </Row>
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search title, file, linked..." prefix={<SearchOutlined className="text-gray-400" />} value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Category" value={categoryFilter} onChange={v => setCategoryFilter(v)} allowClear className="w-32" options={Object.keys(CATEGORY_COLORS).map(c => ({ value: c, label: c }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setCategoryFilter(undefined); }}>Reset</Button>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={documents} rowKey="_id" loading={loading} size="middle" pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }} onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>
      <Modal title="Upload Document" open={showCreate} onCancel={() => setShowCreate(false)} footer={null} destroyOnHidden width={600}>
        <UploadDocForm onSuccess={() => { setShowCreate(false); fetchDocuments(); loadStats(); }} onCancel={() => setShowCreate(false)} />
      </Modal>
    </div>
  );
};

const UploadDocForm = ({ onSuccess, onCancel }) => {
  const [form, setForm] = useState({ title: '', category: 'other', fileUrl: '', fileName: '', hasExpiry: false, expiryDate: '', linkedTo: 'none', linkedEntityName: '', accessLevel: 'internal', tags: '' });
  return (
    <div className="space-y-4 mt-4">
      <div><label className="text-xs text-gray-500 block mb-1">Title *</label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Document title" size="large" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Category</label><Select value={form.category} onChange={v => setForm(f => ({ ...f, category: v }))} className="w-full" options={Object.keys(CATEGORY_COLORS).map(c => ({ value: c, label: c }))} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Access Level</label><Select value={form.accessLevel} onChange={v => setForm(f => ({ ...f, accessLevel: v }))} className="w-full" options={[{value:'public',label:'Public'},{value:'internal',label:'Internal'},{value:'restricted',label:'Restricted'},{value:'confidential',label:'Confidential'}]} /></div>
      </div>
      <div><label className="text-xs text-gray-500 block mb-1">File URL *</label><Input value={form.fileUrl} onChange={e => setForm(f => ({ ...f, fileUrl: e.target.value }))} placeholder="https://... or /uploads/..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Linked To</label><Select value={form.linkedTo} onChange={v => setForm(f => ({ ...f, linkedTo: v }))} className="w-full" options={[{value:'none',label:'None'},{value:'dealer',label:'Dealer'},{value:'supplier',label:'Supplier'},{value:'employee',label:'Employee'},{value:'vehicle',label:'Vehicle'}]} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Entity Name</label><Input value={form.linkedEntityName} onChange={e => setForm(f => ({ ...f, linkedEntityName: e.target.value }))} placeholder="Name" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Has Expiry?</label><Select value={form.hasExpiry ? 'yes' : 'no'} onChange={v => setForm(f => ({ ...f, hasExpiry: v === 'yes' }))} className="w-full" options={[{value:'no',label:'No'},{value:'yes',label:'Yes'}]} /></div>
        {form.hasExpiry && <div><label className="text-xs text-gray-500 block mb-1">Expiry Date</label><Input type="date" value={form.expiryDate} onChange={e => setForm(f => ({ ...f, expiryDate: e.target.value }))} /></div>}
      </div>
      <div><label className="text-xs text-gray-500 block mb-1">Tags (comma separated)</label><Input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="gst, agreement, insurance" /></div>
      <div className="flex justify-end gap-2 pt-3 border-t"><Button onClick={onCancel}>Cancel</Button><Button type="primary" onClick={async () => {
        if (!form.title || !form.fileUrl) { message.error('Title and file URL required'); return; }
        const payload = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()) : [] };
        try { const res = await api.post('/documents', payload); if (res.success) { message.success('Uploaded.'); onSuccess(); } } catch (err) { message.error(err.message); }
      }}>Upload</Button></div>
    </div>
  );
};

export default DocumentManagementPage;
