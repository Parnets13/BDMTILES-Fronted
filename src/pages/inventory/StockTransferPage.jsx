import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, InputNumber, Row, Col, Card, Statistic, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, CarOutlined, SwapOutlined, InboxOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const STATUS_COLORS = {
  requested: 'orange', approved: 'blue', dispatched: 'cyan', in_transit: 'geekblue',
  received: 'lime', completed: 'green', rejected: 'red', cancelled: 'default',
};

const StockTransferPage = () => {
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => { api.get('/stock-transfers/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/stock-transfers', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setTransfers(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchTransfers(); }, [fetchTransfers]);

  const openView = async record => {
    try {
      const res = await api.get(`/stock-transfers/${record._id}`);
      if (res.success) setViewRecord(res.data);
    } catch (err) { message.error(err.message); }
  };

  const handleAction = async (id, action, body = {}) => {
    try {
      let res;
      if (action === 'approve' || action === 'reject') res = await api.patch(`/stock-transfers/${id}/approve`, { action, ...body });
      else if (action === 'dispatch') res = await api.patch(`/stock-transfers/${id}/dispatch`, body);
      else if (action === 'receive') res = await api.patch(`/stock-transfers/${id}/receive`, body);
      else if (action === 'cancel') res = await api.patch(`/stock-transfers/${id}/cancel`);
      if (res?.success) { message.success(res.message); fetchTransfers(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Transfer #', dataIndex: 'transferNumber', width: 120, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'transferDate', width: 90, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'From', dataIndex: 'fromWarehouseName', width: 130, render: v => <span className="text-xs font-medium">{v}</span> },
    { title: 'To', dataIndex: 'toWarehouseName', width: 130, render: v => <span className="text-xs font-medium">{v}</span> },
    { title: 'Items', dataIndex: 'totalItems', width: 55 },
    { title: 'Qty', dataIndex: 'totalRequestedQty', width: 60 },
    { title: 'Priority', dataIndex: 'priority', width: 80, render: v => <Tag color={v === 'urgent' ? 'orange' : v === 'critical' ? 'red' : 'default'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLORS[s]}>{s.replace('_', ' ')}</Tag> },
    { title: 'Actions', width: 150, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => openView(r)} /></Tooltip>
        {r.status === 'requested' && <>
          <Tooltip title="Approve"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleAction(r._id, 'approve')} /></Tooltip>
          <Tooltip title="Reject"><Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500" onClick={() => handleAction(r._id, 'reject', { remarks: 'Rejected' })} /></Tooltip>
        </>}
        {r.status === 'approved' && <Tooltip title="Dispatch"><Button type="text" size="small" icon={<CarOutlined />} className="text-cyan-600" onClick={() => handleAction(r._id, 'dispatch')} /></Tooltip>}
        {r.status === 'in_transit' && <Tooltip title="Receive"><Button type="text" size="small" icon={<InboxOutlined />} className="text-green-600" onClick={() => handleAction(r._id, 'receive')} /></Tooltip>}
        {!['completed', 'cancelled', 'rejected'].includes(r.status) && <Tooltip title="Cancel"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleAction(r._id, 'cancel')} /></Tooltip>}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Stock Transfers</h1>
          <p className="text-sm text-gray-500 mt-0.5">Warehouse-to-warehouse stock transfer management</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Transfer Request</Button>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<SwapOutlined />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Requested" value={stats.requested || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="In Transit" value={stats.inTransit || 0} valueStyle={{ color: '#2f54eb' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Completed" value={stats.completed || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Rejected" value={stats.rejected || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search transfer #, warehouse..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace('_', ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={transfers} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      <CreateTransferModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { fetchTransfers(); loadStats(); }} />

      {viewRecord && (
        <Modal open title={`Transfer ${viewRecord.transferNumber}`} onCancel={() => setViewRecord(null)} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>} width={700}>
          <div className="space-y-3 text-sm mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded border"><div className="text-xs text-gray-400 uppercase font-semibold mb-1">From</div><div className="font-bold">{viewRecord.fromWarehouseName}</div></div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="text-xs text-gray-400 uppercase font-semibold mb-1">To</div><div className="font-bold">{viewRecord.toWarehouseName}</div></div>
            </div>
            <div className="flex gap-3 text-xs">
              <Tag color={STATUS_COLORS[viewRecord.status]}>{viewRecord.status.replace('_', ' ')}</Tag>
              <span>Priority: <Tag color={viewRecord.priority === 'urgent' ? 'orange' : viewRecord.priority === 'critical' ? 'red' : 'default'}>{viewRecord.priority}</Tag></span>
              <span>Date: {new Date(viewRecord.transferDate).toLocaleDateString('en-IN')}</span>
            </div>
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-50"><tr>{['#','Product','Shade','Requested','Dispatched','Received','Short'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
              <tbody>{viewRecord.items?.map((item, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-400">{i+1}</td>
                  <td className="px-2 py-1.5"><div className="flex items-center gap-1"><ProductImage src={item.productImage || item.product?.images?.[0] || item.images?.[0]} size="xs" /><div><div className="font-medium">{item.productName}</div><div className="text-[9px] text-gray-400">{item.productCode}</div></div></div></td>
                  <td className="px-2 py-1.5">{item.shade || '—'}</td>
                  <td className="px-2 py-1.5 font-medium">{item.requestedQty} {item.unit}</td>
                  <td className="px-2 py-1.5">{item.dispatchedQty || '—'}</td>
                  <td className="px-2 py-1.5">{item.receivedQty || '—'}</td>
                  <td className="px-2 py-1.5 text-red-500">{item.shortQty > 0 ? item.shortQty : '—'}</td>
                </tr>
              ))}</tbody>
            </table>
            {viewRecord.reason && <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Reason: {viewRecord.reason}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// CREATE TRANSFER REQUEST MODAL
// ═══════════════════════════════════════════════
const CreateTransferModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [destinationWarehouses, setDestinationWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [form, setForm] = useState({ fromWarehouse: '', toWarehouse: '', priority: 'normal', reason: '', remarks: '' });
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (open) {
      Promise.all([
        api.get('/masters/warehouses', { params: { limit: 200, status: 'active' } }),
        api.get('/stock-transfers/destinations'),
      ]).then(([sourceResponse, destinationResponse]) => {
        if (sourceResponse.success) setWarehouses(sourceResponse.data || []);
        if (destinationResponse.success) setDestinationWarehouses(destinationResponse.data || []);
      }).catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (productSearch.length >= 2) {
      const timer = setTimeout(() => {
        api.get('/products', { params: { search: productSearch, limit: 20, status: 'active' } }).then(r => {
          if (r.success) setProducts(r.data || []);
        }).catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    } else { setProducts([]); }
  }, [productSearch]);

  const addProduct = (p) => {
    if (items.find(i => i.product === p._id)) { message.warning('Already added'); return; }
    setItems(prev => [...prev, { product: p._id, productCode: p.productCode, productName: p.itemName, productImage: p.images?.[0] || '', shade: '', batch: '', requestedQty: 1, unit: p.unit || 'Box' }]);
    setProductSearch(''); setProducts([]);
  };

  const handleSubmit = async () => {
    if (!form.fromWarehouse) { message.error('Select source warehouse'); return; }
    if (!form.toWarehouse) { message.error('Select destination warehouse'); return; }
    if (form.fromWarehouse === form.toWarehouse) { message.error('Source and destination cannot be same'); return; }
    if (items.length === 0) { message.error('Add at least one product'); return; }

    setLoading(true);
    try {
      const res = await api.post('/stock-transfers', { ...form, items });
      if (res.success) { message.success(res.message); onSuccess?.(); handleClose(); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClose = () => {
    setForm({ fromWarehouse: '', toWarehouse: '', priority: 'normal', reason: '', remarks: '' });
    setItems([]); onClose();
  };

  return (
    <Modal title="New Stock Transfer Request" open={open} onCancel={handleClose} width={800} footer={null} destroyOnHidden>
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Warehouse *</label>
            <Select className="w-full" size="large" value={form.fromWarehouse || undefined} placeholder="Source..."
              onChange={v => setForm(f => ({ ...f, fromWarehouse: v }))}
              options={warehouses.map(w => ({ value: w._id, label: w.name }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Warehouse *</label>
            <Select className="w-full" size="large" value={form.toWarehouse || undefined} placeholder="Destination..."
              onChange={v => setForm(f => ({ ...f, toWarehouse: v }))}
              options={destinationWarehouses
                .filter(w => w._id !== form.fromWarehouse)
                .map(w => ({
                  value: w._id,
                  label: `${w.name} — ${w.branch?.branchCode || w.branch?.name || 'Branch'}`,
                }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Priority</label>
            <Select className="w-full" size="large" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
              options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }, { value: 'critical', label: 'Critical' }]} />
          </div>
        </div>

        <div>
          <label className="text-xs text-gray-500 block mb-1">Reason for Transfer</label>
          <Input value={form.reason} onChange={e => setForm(f => ({ ...f, reason: e.target.value }))} placeholder="e.g. Low stock at destination, dealer demand" />
        </div>

        {/* Product search */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Add Products *</label>
          <div className="relative">
            <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Search product by name or code..." prefix={<SearchOutlined className="text-gray-400" />} />
            {products.length > 0 && (
              <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {products.filter(p => !items.some(i => i.product === p._id)).map(p => (
                  <div key={p._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50 flex items-center gap-2" onClick={() => addProduct(p)}>
                    <ProductImage src={p.images?.[0]} size="sm" />
                    <div className="flex-1"><div className="text-sm font-medium">{p.itemName}</div><div className="text-[10px] text-gray-400">{p.productCode}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Items table */}
        {items.length > 0 && (
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead className="bg-blue-50"><tr>{['Product','Shade','Batch','Qty','Unit',''].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
            <tbody>{items.map((item, idx) => (
              <tr key={idx} className="border-t border-gray-100">
                <td className="px-2 py-1.5"><div className="flex items-center gap-1"><ProductImage src={item.productImage || item.product?.images?.[0] || item.images?.[0]} size="sm" /><div><div className="font-medium">{item.productName}</div><div className="text-[9px] text-gray-400">{item.productCode}</div></div></div></td>
                <td className="px-2 py-1.5"><Input size="small" value={item.shade} onChange={e => { const n = [...items]; n[idx].shade = e.target.value; setItems(n); }} placeholder="—" className="w-16" /></td>
                <td className="px-2 py-1.5"><Input size="small" value={item.batch} onChange={e => { const n = [...items]; n[idx].batch = e.target.value; setItems(n); }} placeholder="—" className="w-16" /></td>
                <td className="px-2 py-1.5"><InputNumber size="small" min={1} value={item.requestedQty} onChange={v => { const n = [...items]; n[idx].requestedQty = v || 1; setItems(n); }} className="w-16" /></td>
                <td className="px-2 py-1.5 text-gray-500">{item.unit}</td>
                <td className="px-2 py-1.5"><Button type="text" size="small" danger onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))}>✕</Button></td>
              </tr>
            ))}</tbody>
          </table>
        )}

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<SwapOutlined />}>Create Transfer Request</Button>
        </div>
      </div>
    </Modal>
  );
};

export default StockTransferPage;
