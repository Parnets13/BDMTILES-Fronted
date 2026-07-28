import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Card, Modal, InputNumber, Divider
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { Percent } from 'lucide-react';
import reportService from '../../services/reportService.js';

const STATUS_COLORS = { active: 'green', paused: 'orange', expired: 'default', closed: 'red' };
const SCHEME_TYPES = ['slab_discount','cashback','gift','points','target_bonus'];

const DealerSchemeSetup = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  const [form, setForm] = useState({
    schemeName: '', schemeType: 'slab_discount', applicableTo: 'all',
    startDate: '', endDate: '', description: '', termsAndConditions: '',
  });
  const [slabs, setSlabs] = useState([
    { minValue: 0, maxValue: 0, discountPercent: 0, cashbackAmount: 0, points: 0 }
  ]);

  const fetchSchemes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getDealerSchemes({ page: pagination.current, limit: pagination.pageSize, status: statusFilter });
      if (res.success) { setSchemes(res.data); setPagination(p => ({...p, total: res.pagination?.totalItems||0})); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, statusFilter]);

  useEffect(() => { fetchSchemes(); }, [fetchSchemes]);

  const handleCreate = async () => {
    if (!form.schemeName || !form.startDate || !form.endDate) { message.error('Fill required fields'); return; }
    setCreateLoading(true);
    try {
      const res = await reportService.createDealerScheme({ ...form, slabs });
      if (res.success) {
        message.success(`${res.data.schemeNumber} created!`);
        setShowCreate(false); resetForm(); fetchSchemes();
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const toggleStatus = async (record) => {
    const newStatus = record.status === 'active' ? 'paused' : 'active';
    try {
      const res = await reportService.updateDealerSchemeStatus(record._id, { status: newStatus });
      if (res.success) { message.success(`Status → ${newStatus}`); fetchSchemes(); }
    } catch (err) { message.error(err.message); }
  };

  const resetForm = () => {
    setForm({ schemeName:'', schemeType:'slab_discount', applicableTo:'all', startDate:'', endDate:'', description:'', termsAndConditions:'' });
    setSlabs([{ minValue:0, maxValue:0, discountPercent:0, cashbackAmount:0, points:0 }]);
  };

  const updateSlab = (idx, field, val) => setSlabs(prev => prev.map((s,i) => i===idx ? {...s,[field]:val} : s));

  const columns = [
    { title: 'Scheme #', dataIndex: 'schemeNumber', width: 120, render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Scheme Name', dataIndex: 'schemeName', render: v => <span className="font-medium">{v}</span> },
    { title: 'Type', dataIndex: 'schemeType', width: 130, render: v => <Tag color="blue">{v?.replace(/_/g,' ')}</Tag> },
    { title: 'Applicable To', dataIndex: 'applicableTo', width: 130, render: v => <Tag>{v?.replace(/_/g,' ')}</Tag> },
    { title: 'Period', key: 'period', width: 160, render: (_, r) => (
      <span className="text-xs">
        {r.startDate ? new Date(r.startDate).toLocaleDateString('en-IN') : '—'}{' → '}
        {r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '—'}
      </span>
    )},
    { title: 'Slabs', key: 'slabs', width: 70, render: (_, r) => <span className="text-sm">{r.slabs?.length||0}</span> },
    { title: 'Status', dataIndex: 'status', width: 90, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 110, render: (_, r) => (
      <Space size="small">
        {['active','paused'].includes(r.status) && (
          <Button size="small"
            type={r.status === 'active' ? 'default' : 'primary'}
            onClick={() => toggleStatus(r)}>
            {r.status === 'active' ? 'Pause' : 'Activate'}
          </Button>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Percent size={22} className="text-blue-600" /> Dealer Scheme Setup
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure dealer discount and incentive schemes</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Dealer Scheme</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3">
          <Select placeholder="Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({value:s, label:s}))} />
          <Button icon={<ReloadOutlined />} onClick={() => setStatusFilter(undefined)}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={schemes} rowKey="_id" loading={loading} size="middle" scroll={{x:950}}
          pagination={{...pagination, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}-${r[1]} of ${t}`}}
          onChange={pag => setPagination(p => ({...p, current:pag.current, pageSize:pag.pageSize}))} />
      </div>

      {/* Create Modal */}
      <Modal title="New Dealer Scheme" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        width={800} footer={null} destroyOnClose>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Scheme Name *</label>
              <Input value={form.schemeName} onChange={e => setForm(f => ({...f, schemeName:e.target.value}))} placeholder="e.g. Festival Discount Q3" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Scheme Type</label>
              <Select className="w-full" value={form.schemeType} onChange={v => setForm(f => ({...f, schemeType:v}))}
                options={SCHEME_TYPES.map(t => ({value:t, label:t.replace(/_/g,' ')}))} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Applicable To</label>
              <Select className="w-full" value={form.applicableTo} onChange={v => setForm(f => ({...f, applicableTo:v}))}
                options={[{value:'all',label:'All Dealers'},{value:'specific_dealers',label:'Specific Dealers'},{value:'dealer_category',label:'By Category'},{value:'dealer_type',label:'By Type'}]} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Start Date *</label>
              <Input type="date" value={form.startDate} onChange={e => setForm(f => ({...f, startDate:e.target.value}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">End Date *</label>
              <Input type="date" value={form.endDate} onChange={e => setForm(f => ({...f, endDate:e.target.value}))} /></div>
          </div>

          {/* Slabs */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Discount Slabs</label>
              <Button size="small" icon={<PlusOutlined />} onClick={() => setSlabs(s => [...s, {minValue:0, maxValue:0, discountPercent:0, cashbackAmount:0, points:0}])}>Add Slab</Button>
            </div>
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-blue-50"><tr>
                {['Min Value (₹)','Max Value (₹)','Discount %','Cashback (₹)','Points',''].map(h => (
                  <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {slabs.map((slab, idx) => (
                  <tr key={idx} className="border-t border-gray-100">
                    <td className="px-2 py-1.5"><InputNumber min={0} value={slab.minValue} onChange={v => updateSlab(idx,'minValue',v||0)} className="w-24" /></td>
                    <td className="px-2 py-1.5"><InputNumber min={0} value={slab.maxValue} onChange={v => updateSlab(idx,'maxValue',v||0)} className="w-24" /></td>
                    <td className="px-2 py-1.5"><InputNumber min={0} max={100} value={slab.discountPercent} onChange={v => updateSlab(idx,'discountPercent',v||0)} className="w-20" /></td>
                    <td className="px-2 py-1.5"><InputNumber min={0} value={slab.cashbackAmount} onChange={v => updateSlab(idx,'cashbackAmount',v||0)} className="w-22" /></td>
                    <td className="px-2 py-1.5"><InputNumber min={0} value={slab.points} onChange={v => updateSlab(idx,'points',v||0)} className="w-18" /></td>
                    <td className="px-2 py-1.5">
                      {slabs.length > 1 && <Button type="text" size="small" danger onClick={() => setSlabs(s => s.filter((_,i) => i!==idx))}>✕</Button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Description</label>
              <Input.TextArea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description:e.target.value}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Terms & Conditions</label>
              <Input.TextArea rows={2} value={form.termsAndConditions} onChange={e => setForm(f => ({...f, termsAndConditions:e.target.value}))} /></div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button type="primary" onClick={handleCreate} loading={createLoading}>Create Scheme</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DealerSchemeSetup;
