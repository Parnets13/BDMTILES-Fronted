import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber, Divider
} from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, SendOutlined, CheckOutlined, GiftOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = { active: 'green', expired: 'orange', claimed: 'blue', closed: 'default' };
const SCHEME_TYPES = ['quantity_discount', 'cash_incentive', 'product_scheme', 'annual_bonus'];

const SupplierSchemeEntry = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [suppliers, setSuppliers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    supplier: '', schemeName: '', schemeType: 'quantity_discount',
    startDate: '', endDate: '', totalTargetValue: 0, remarks: '',
  });
  const [schemeProducts, setSchemeProducts] = useState([
    { productName: '', targetQty: 0, incentiveRate: 0, incentiveType: 'per_unit' }
  ]);

  const [claimModal, setClaimModal] = useState(null);
  const [claimAmount, setClaimAmount] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const [settleModal, setSettleModal] = useState(null);
  const [settledAmount, setSettledAmount] = useState(0);
  const [settleLoading, setSettleLoading] = useState(false);
  const [viewScheme, setViewScheme] = useState(null);

  const loadStats = () => reportService.getSupplierSchemeStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});

  useEffect(() => {
    loadStats();
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
  }, []);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getSupplierSchemes({ page: pagination.current, limit: pagination.pageSize, search, status: statusFilter });
      if (res.success) { setSchemes(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchSchemes(); }, [fetchSchemes]);

  const handleCreate = async () => {
    if (!form.supplier || !form.schemeName || !form.startDate || !form.endDate) {
      message.error('Fill all required fields'); return;
    }
    setCreateLoading(true);
    try {
      const res = await reportService.createSupplierScheme({ ...form, products: schemeProducts });
      if (res.success) {
        message.success(`${res.data.schemeNumber} created!`);
        setShowCreate(false); resetForm(); fetchSchemes(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleClaim = async () => {
    setClaimLoading(true);
    try {
      const res = await reportService.claimSupplierScheme(claimModal._id, { claimAmount });
      if (res.success) { message.success('Claim submitted!'); setClaimModal(null); fetchSchemes(); loadStats(); }
    } catch (err) { message.error(err.message); }
    finally { setClaimLoading(false); }
  };

  const handleSettle = async () => {
    setSettleLoading(true);
    try {
      const res = await reportService.settleSupplierScheme(settleModal._id, { settledAmount });
      if (res.success) { message.success('Scheme settled!'); setSettleModal(null); fetchSchemes(); loadStats(); }
    } catch (err) { message.error(err.message); }
    finally { setSettleLoading(false); }
  };

  const resetForm = () => {
    setForm({ supplier: '', schemeName: '', schemeType: 'quantity_discount', startDate: '', endDate: '', totalTargetValue: 0, remarks: '' });
    setSchemeProducts([{ productName: '', targetQty: 0, incentiveRate: 0, incentiveType: 'per_unit' }]);
  };

  const updateProduct = (idx, field, val) => setSchemeProducts(prev => prev.map((p, i) => i === idx ? {...p, [field]: val} : p));

  const columns = [
    { title: 'Scheme #', dataIndex: 'schemeNumber', width: 120, render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Scheme Name', dataIndex: 'schemeName', render: v => <span className="font-medium">{v}</span> },
    { title: 'Supplier', dataIndex: 'supplierName', width: 160 },
    { title: 'Type', dataIndex: 'schemeType', width: 130, render: v => <Tag>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Period', key: 'period', width: 150, render: (_, r) => <span className="text-xs">{r.startDate ? new Date(r.startDate).toLocaleDateString('en-IN') : '—'} → {r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '—'}</span> },
    { title: 'Incentive Earned', dataIndex: 'totalIncentiveEarned', width: 130, render: v => <span className="font-semibold text-green-600">₹{(v||0).toLocaleString()}</span> },
    { title: 'Claim Amount', dataIndex: 'totalClaimAmount', width: 120, render: v => v ? `₹${v.toLocaleString()}` : '—' },
    { title: 'Status', dataIndex: 'status', width: 90, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 110,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500" onClick={() => setViewScheme(r)} />
          {['active','expired'].includes(r.status) && (
            <Button type="text" size="small" icon={<SendOutlined />} className="text-blue-600"
              onClick={() => { setClaimModal(r); setClaimAmount(0); }} title="Submit Claim" />
          )}
          {r.status === 'claimed' && (
            <Button type="text" size="small" icon={<CheckOutlined />} className="text-green-600"
              onClick={() => { setSettleModal(r); setSettledAmount(0); }} title="Mark Settled" />
          )}
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Schemes</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track supplier incentive schemes, submit claims, reconcile settlements</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Scheme</Button>
      </div>

      <Row gutter={16} className="mb-4">
        {[['Total', stats.total||0, '#1890ff'], ['Active', stats.active||0, '#52c41a'],
          ['Claimed', stats.claimed||0, '#fa8c16'], ['Total Earned', `₹${(stats.totalEarned||0).toLocaleString()}`, '#FF5F03']
        ].map(([t,v,c]) => <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>)}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search scheme #, name, supplier..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }} className="w-64" allowClear />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-32"
            options={Object.keys(STATUS_COLORS).map(s => ({value:s, label:s}))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={schemes} rowKey="_id" loading={loading} size="middle" scroll={{x:1100}}
          pagination={{...pagination, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}-${r[1]} of ${t}`}}
          onChange={pag => setPagination(p => ({...p, current:pag.current, pageSize:pag.pageSize}))} />
      </div>

      {/* Create Modal */}
      <Modal title="New Supplier Scheme" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        width={780} footer={null} destroyOnHidden>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-xs text-gray-500 block mb-1">Supplier *</label>
              <Select className="w-full" showSearch optionFilterProp="label" value={form.supplier||undefined}
                onChange={v => setForm(f => ({...f, supplier:v}))} placeholder="Select supplier..."
                options={suppliers.map(s => ({value:s._id, label:`${s.companyName} (${s.supplierCode})`}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Scheme Name *</label>
              <Input value={form.schemeName} onChange={e => setForm(f => ({...f, schemeName:e.target.value}))} placeholder="e.g. Q4 Volume Incentive" /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Scheme Type</label>
              <Select className="w-full" value={form.schemeType} onChange={v => setForm(f => ({...f, schemeType:v}))}
                options={SCHEME_TYPES.map(t => ({value:t, label:t.replace(/_/g,' ')}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Start Date *</label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate:e.target.value}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">End Date *</label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate:e.target.value}))} /></div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Products / Targets</label>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setSchemeProducts(p => [...p, {productName:'', targetQty:0, incentiveRate:0, incentiveType:'per_unit'}])}>Add Row</Button>
            </div>
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-50"><tr>
                {['Product Name','Target Qty','Incentive Rate','Type',''].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {schemeProducts.map((p, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-1.5"><Input value={p.productName} onChange={e => updateProduct(idx,'productName',e.target.value)} placeholder="Product name" className="w-36" /></td>
                    <td className="px-2 py-1.5"><InputNumber min={0} value={p.targetQty} onChange={v => updateProduct(idx,'targetQty',v||0)} className="w-20" /></td>
                    <td className="px-2 py-1.5"><InputNumber min={0} value={p.incentiveRate} onChange={v => updateProduct(idx,'incentiveRate',v||0)} className="w-20" /></td>
                    <td className="px-2 py-1.5">
                      <Select value={p.incentiveType} onChange={v => updateProduct(idx,'incentiveType',v)} className="w-28"
                        options={[{value:'per_unit',label:'Per Unit'},{value:'percentage',label:'%'},{value:'flat',label:'Flat'}]} />
                    </td>
                    <td className="px-2 py-1.5">
                      {schemeProducts.length > 1 && <Button type="text" size="small" danger onClick={() => setSchemeProducts(p => p.filter((_,i) => i!==idx))}>✕</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Total Target Value (₹)</label>
              <InputNumber className="w-full" min={0} value={form.totalTargetValue} onChange={v => setForm(f => ({...f, totalTargetValue:v||0}))} prefix="₹" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Remarks</label>
              <Input value={form.remarks} onChange={e => setForm(f => ({...f, remarks:e.target.value}))} /></div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button type="primary" onClick={handleCreate} loading={createLoading}>Create Scheme</Button>
          </div>
        </div>
      </Modal>

      {/* Claim Modal */}
      <Modal title={`Submit Claim — ${claimModal?.schemeNumber}`} open={!!claimModal}
        onCancel={() => setClaimModal(null)} onOk={handleClaim} confirmLoading={claimLoading} okText="Submit Claim">
        <div className="space-y-3 mt-4">
          <div className="bg-blue-50 p-3 rounded text-sm">
            <div><span className="text-gray-400">Scheme:</span> <strong>{claimModal?.schemeName}</strong></div>
            <div><span className="text-gray-400">Supplier:</span> {claimModal?.supplierName}</div>
            <div><span className="text-gray-400">Incentive Earned:</span> <strong className="text-green-600">₹{(claimModal?.totalIncentiveEarned||0).toLocaleString()}</strong></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Claim Amount (₹) *</label>
            <InputNumber className="w-full" min={0} value={claimAmount} onChange={v => setClaimAmount(v||0)} prefix="₹" size="large" /></div>
        </div>
      </Modal>

      {/* Settle Modal */}
      <Modal title={`Mark Settled — ${settleModal?.schemeNumber}`} open={!!settleModal}
        onCancel={() => setSettleModal(null)} onOk={handleSettle} confirmLoading={settleLoading} okText="Mark Settled">
        <div className="space-y-3 mt-4">
          <div className="bg-green-50 p-3 rounded text-sm">
            <div><span className="text-gray-400">Claim Submitted:</span> <strong>₹{(settleModal?.totalClaimAmount||0).toLocaleString()}</strong></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Settled Amount (₹) *</label>
            <InputNumber className="w-full" min={0} value={settledAmount} onChange={v => setSettledAmount(v||0)} prefix="₹" size="large" /></div>
        </div>
      </Modal>

      {/* View Modal */}
      {viewScheme && (
        <Modal title={`Scheme: ${viewScheme.schemeNumber}`} open onCancel={() => setViewScheme(null)}
          footer={<Button onClick={() => setViewScheme(null)}>Close</Button>} width={600}>
          <div className="space-y-2 mt-4 text-sm">
            {[['Name', viewScheme.schemeName], ['Supplier', viewScheme.supplierName],
              ['Type', viewScheme.schemeType?.replace(/_/g,' ')], ['Status', viewScheme.status],
              ['Period', `${new Date(viewScheme.startDate||Date.now()).toLocaleDateString('en-IN')} → ${new Date(viewScheme.endDate||Date.now()).toLocaleDateString('en-IN')}`],
              ['Incentive Earned', `₹${(viewScheme.totalIncentiveEarned||0).toLocaleString()}`],
              ['Claim Amount', viewScheme.totalClaimAmount ? `₹${viewScheme.totalClaimAmount.toLocaleString()}` : '—'],
              ['Settled Amount', viewScheme.claimSettledAmount ? `₹${viewScheme.claimSettledAmount.toLocaleString()}` : '—'],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
            {viewScheme.remarks && <div className="text-gray-400 text-xs mt-2">Remarks: {viewScheme.remarks}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SupplierSchemeEntry;
