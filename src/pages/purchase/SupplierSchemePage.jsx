import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, InputNumber, Row, Col, Card, Statistic, Tooltip, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, EditOutlined, CheckCircleOutlined, DollarOutlined, DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api.js';

const STATUS_COLORS = { active: 'green', expired: 'orange', claimed: 'blue', closed: 'default' };

const SupplierSchemePage = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => { api.get('/schemes/supplier/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/schemes/supplier', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setSchemes(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchSchemes(); }, [fetchSchemes]);

  const handleClaim = async (id) => {
    const scheme = schemes.find(s => s._id === id);
    Modal.confirm({
      title: 'Submit Claim?', content: `Claim ₹${scheme?.totalIncentiveEarned || 0} from ${scheme?.supplierName}?`,
      okText: 'Submit Claim', onOk: async () => {
        try {
          const res = await api.patch(`/schemes/supplier/${id}/claim`, { claimAmount: scheme?.totalIncentiveEarned || 0 });
          if (res.success) { message.success('Claim submitted.'); fetchSchemes(); loadStats(); }
        } catch (err) { message.error(err.message); }
      }
    });
  };

  const handleSettle = async (id) => {
    const scheme = schemes.find(s => s._id === id);
    Modal.confirm({
      title: 'Settle Scheme?', content: `Mark as settled for ₹${scheme?.totalClaimAmount || 0}?`,
      okText: 'Settle', onOk: async () => {
        try {
          const res = await api.patch(`/schemes/supplier/${id}/settle`, { settledAmount: scheme?.totalClaimAmount || 0 });
          if (res.success) { message.success('Settled.'); fetchSchemes(); loadStats(); }
        } catch (err) { message.error(err.message); }
      }
    });
  };

  const columns = [
    { title: 'Scheme #', dataIndex: 'schemeNumber', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Scheme Name', dataIndex: 'schemeName', width: 160 },
    { title: 'Supplier', dataIndex: 'supplierName', width: 140 },
    { title: 'Type', dataIndex: 'schemeType', width: 110, render: v => <Tag>{v?.replace('_', ' ')}</Tag> },
    { title: 'Period', key: 'period', width: 140, render: (_, r) => <span className="text-xs">{dayjs(r.startDate).format('DD/MM/YY')} — {dayjs(r.endDate).format('DD/MM/YY')}</span> },
    { title: 'Earned', dataIndex: 'totalIncentiveEarned', width: 90, render: v => <span className="font-medium text-green-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Claimed', dataIndex: 'totalClaimAmount', width: 90, render: v => v > 0 ? <span className="text-blue-600">₹{v.toLocaleString()}</span> : '—' },
    { title: 'Status', dataIndex: 'status', width: 80, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 130, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewRecord(r)} /></Tooltip>
        {r.status === 'active' && <Tooltip title="Submit Claim"><Button type="text" size="small" icon={<DollarOutlined />} className="text-green-600" onClick={() => handleClaim(r._id)} /></Tooltip>}
        {r.status === 'claimed' && <Tooltip title="Settle"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-purple-600" onClick={() => handleSettle(r._id)} /></Tooltip>}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Schemes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track supplier incentive schemes, achievement, claims and settlements</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Scheme</Button>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Schemes" value={stats.total || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Active" value={stats.active || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Claimed" value={stats.claimed || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Earned" value={`₹${Math.round(stats.totalEarned || 0).toLocaleString()}`} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search scheme #, name, supplier..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-28"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={schemes} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      <CreateSchemeModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { fetchSchemes(); loadStats(); }} />

      {viewRecord && (
        <Modal open title={`Scheme ${viewRecord.schemeNumber}`} onCancel={() => setViewRecord(null)} width={700} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="space-y-3 text-sm mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase font-semibold">Supplier</div><div className="font-bold">{viewRecord.supplierName}</div><div className="text-xs text-gray-500">{viewRecord.schemeType?.replace('_', ' ')} · {dayjs(viewRecord.startDate).format('DD MMM YY')} - {dayjs(viewRecord.endDate).format('DD MMM YY')}</div></div>
              <div className="bg-green-50 p-3 rounded border border-green-100"><div className="text-[10px] text-gray-400 uppercase font-semibold">Earnings</div><div className="font-bold text-lg text-green-600">₹{(viewRecord.totalIncentiveEarned || 0).toLocaleString()}</div><Tag color={STATUS_COLORS[viewRecord.status]}>{viewRecord.status}</Tag></div>
            </div>
            <div className="font-semibold text-gray-700">Products ({viewRecord.products?.length || 0})</div>
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-50"><tr>{['Product','Target Qty','Achieved','Progress','Incentive'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
              <tbody>{viewRecord.products?.map((p, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-medium">{p.productName || 'Product'}</td>
                  <td className="px-2 py-1.5">{p.targetQty}</td>
                  <td className="px-2 py-1.5 font-medium">{p.achievedQty}</td>
                  <td className="px-2 py-1.5"><Progress percent={p.targetQty > 0 ? Math.round((p.achievedQty / p.targetQty) * 100) : 0} size="small" /></td>
                  <td className="px-2 py-1.5 text-green-600">{p.incentiveType === 'per_unit' ? `₹${p.incentiveRate}/unit` : p.incentiveType === 'percentage' ? `${p.incentiveRate}%` : `₹${p.incentiveRate} flat`}</td>
                </tr>
              ))}</tbody>
            </table>
            {viewRecord.claimSubmittedDate && <div className="text-xs text-blue-600">Claim submitted: {dayjs(viewRecord.claimSubmittedDate).format('DD MMM YYYY')} · ₹{viewRecord.totalClaimAmount?.toLocaleString()}</div>}
            {viewRecord.claimSettledDate && <div className="text-xs text-green-600">Settled: {dayjs(viewRecord.claimSettledDate).format('DD MMM YYYY')} · ₹{viewRecord.claimSettledAmount?.toLocaleString()}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

// CREATE SCHEME MODAL
const CreateSchemeModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    schemeName: '', supplier: '', schemeType: 'quantity_discount',
    startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(3, 'month').format('YYYY-MM-DD'), remarks: '',
  });
  const [products, setProducts] = useState([]);

  useEffect(() => {
    if (open) { api.get('/masters/suppliers', { params: { limit: 100 } }).then(r => { if (r.success) setSuppliers(r.data || []); }).catch(() => {}); }
  }, [open]);

  const handleSubmit = async () => {
    if (!form.schemeName) { message.error('Enter scheme name'); return; }
    if (!form.supplier) { message.error('Select supplier'); return; }
    setLoading(true);
    try {
      const res = await api.post('/schemes/supplier', { ...form, products });
      if (res.success) { message.success(res.message); onSuccess?.(); handleClose(); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClose = () => {
    setForm({ schemeName: '', supplier: '', schemeType: 'quantity_discount', startDate: dayjs().format('YYYY-MM-DD'), endDate: dayjs().add(3, 'month').format('YYYY-MM-DD'), remarks: '' });
    setProducts([]); onClose();
  };

  return (
    <Modal title="New Supplier Scheme" open={open} onCancel={handleClose} width={750} footer={null} destroyOnHidden>
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">Scheme Name *</label><Input value={form.schemeName} onChange={e => setForm(f => ({ ...f, schemeName: e.target.value }))} placeholder="e.g. Q3 2026 Kajaria Target Scheme" size="large" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Supplier *</label><Select showSearch className="w-full" size="large" value={form.supplier || undefined} placeholder="Select supplier..." optionFilterProp="label"
            onChange={v => setForm(f => ({ ...f, supplier: v }))} options={suppliers.map(s => ({ value: s._id, label: s.companyName || s.supplierCode }))} /></div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="text-xs text-gray-500 block mb-1">Scheme Type</label><Select value={form.schemeType} onChange={v => setForm(f => ({ ...f, schemeType: v }))} className="w-full"
            options={[{ value: 'quantity_discount', label: 'Quantity Discount' }, { value: 'cash_incentive', label: 'Cash Incentive' }, { value: 'product_scheme', label: 'Product Scheme' }, { value: 'annual_bonus', label: 'Annual Bonus' }]} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Start Date</label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">End Date</label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
        </div>
        <div><label className="text-xs text-gray-500 block mb-1">Product Targets (optional)</label>
          <Button size="small" onClick={() => setProducts(prev => [...prev, { productName: '', targetQty: 0, achievedQty: 0, incentiveRate: 0, incentiveType: 'per_unit' }])}>+ Add Product Target</Button>
          {products.length > 0 && (
            <table className="w-full text-xs border border-gray-200 rounded mt-2">
              <thead className="bg-gray-50"><tr>{['Product Name','Target Qty','Incentive Rate','Type',''].map(h => <th key={h} className="px-2 py-1.5 text-left">{h}</th>)}</tr></thead>
              <tbody>{products.map((p, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1"><Input size="small" value={p.productName} onChange={e => { const n = [...products]; n[i].productName = e.target.value; setProducts(n); }} placeholder="Product" /></td>
                  <td className="px-2 py-1"><InputNumber size="small" min={0} value={p.targetQty} onChange={v => { const n = [...products]; n[i].targetQty = v || 0; setProducts(n); }} className="w-16" /></td>
                  <td className="px-2 py-1"><InputNumber size="small" min={0} value={p.incentiveRate} onChange={v => { const n = [...products]; n[i].incentiveRate = v || 0; setProducts(n); }} className="w-16" /></td>
                  <td className="px-2 py-1"><Select size="small" value={p.incentiveType} onChange={v => { const n = [...products]; n[i].incentiveType = v; setProducts(n); }} className="w-24"
                    options={[{ value: 'per_unit', label: '/unit' }, { value: 'percentage', label: '%' }, { value: 'flat', label: 'Flat' }]} /></td>
                  <td className="px-2 py-1"><Button type="text" size="small" danger onClick={() => setProducts(prev => prev.filter((_, idx) => idx !== i))}>✕</Button></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
        <div><label className="text-xs text-gray-500 block mb-1">Remarks</label><Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional" /></div>
        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<PlusOutlined />}>Create Scheme</Button>
        </div>
      </div>
    </Modal>
  );
};

export default SupplierSchemePage;
