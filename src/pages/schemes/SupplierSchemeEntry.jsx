import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';
import SchemeRuleFields, { emptyRule } from './SchemeRuleFields.jsx';

const STATUS_COLORS = { draft: 'default', active: 'green', paused: 'orange', expired: 'gold', closed: 'red' };

const SupplierSchemeEntry = () => {
  const [schemes, setSchemes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [rule, setRule] = useState(emptyRule('supplier'));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getSupplierSchemes({ limit: 100 });
      if (response.success) setSchemes(response.data || []);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    masterService.getSuppliers({ limit: 200, status: 'active' })
      .then(response => setSuppliers(response.data || [])).catch(() => {});
  }, []);

  const reset = () => { setSupplier(null); setRemarks(''); setRule(emptyRule('supplier')); };
  const create = async () => {
    setSaving(true);
    try {
      const response = await reportService.createSupplierScheme({ ...rule, supplier, remarks });
      if (response.success) { message.success(response.message); setShowCreate(false); reset(); load(); }
    } catch (error) { message.error(error.message); }
    finally { setSaving(false); }
  };
  const changeStatus = async (record, status) => {
    try {
      const response = await reportService.updateSupplierSchemeStatus(record._id, { status });
      if (response.success) { message.success(response.message); load(); }
    } catch (error) { message.error(error.message); }
  };

  const columns = [
    { title: 'Scheme', dataIndex: 'schemeNumber', width: 190, render: (value, record) => <div><div className="font-mono text-xs text-blue-600">{value}</div><div className="font-medium">{record.schemeName}</div></div> },
    { title: 'Supplier', dataIndex: 'supplierName', width: 180 },
    { title: 'Authoritative rule', key: 'rule', render: (_, record) => <div><Tag color="blue">{record.basis?.replaceAll('_', ' ')}</Tag><div className="text-xs text-gray-500 mt-1">{record.calculationType?.replaceAll('_', ' ')} · v{record.version}</div></div> },
    { title: 'Period', key: 'period', render: (_, record) => `${new Date(record.startDate).toLocaleDateString('en-IN')} – ${new Date(record.endDate).toLocaleDateString('en-IN')}` },
    { title: 'Claims', key: 'summary', render: (_, record) => <div className="text-xs"><div>Submitted ₹{(record.settlementSummary?.submitted || 0).toLocaleString()}</div><div className="text-green-700">Posted ₹{(record.settlementSummary?.approved || 0).toLocaleString()}</div></div> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={STATUS_COLORS[value]}>{value}</Tag> },
    { title: 'Actions', render: (_, record) => <Space>
      {record.status === 'draft' && <Button size="small" type="primary" onClick={() => changeStatus(record, 'active')}>Activate</Button>}
      {record.status === 'active' && <Button size="small" onClick={() => changeStatus(record, 'paused')}>Pause</Button>}
      {record.status === 'paused' && <Button size="small" type="primary" onClick={() => changeStatus(record, 'active')}>Resume</Button>}
    </Space> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Supplier Incentive Rules</h1><p className="text-sm text-gray-500">Verified purchase, return, and payment based monetary schemes.</p></div>
        <Space><Button icon={<ReloadOutlined />} onClick={load} loading={loading} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>New rule</Button></Space>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden"><Table rowKey="_id" columns={columns} dataSource={schemes} loading={loading} scroll={{ x: 1050 }} /></div>
      <Modal title="New supplier incentive rule" open={showCreate} onCancel={() => { setShowCreate(false); reset(); }} width={900}
        okText="Create draft" onOk={create} confirmLoading={saving} destroyOnHidden>
        <div className="space-y-4 mt-4">
          <div><label className="text-xs text-gray-500 block mb-1">Supplier *</label><Select className="w-full" showSearch optionFilterProp="label" value={supplier}
            onChange={setSupplier} options={suppliers.map(row => ({ value: row._id, label: `${row.companyName} (${row.supplierCode || '—'})` }))} /></div>
          <SchemeRuleFields partyType="supplier" value={rule} onChange={setRule} />
          <div><label className="text-xs text-gray-500 block mb-1">Internal remarks</label><Input.TextArea rows={2} value={remarks} onChange={event => setRemarks(event.target.value)} /></div>
        </div>
      </Modal>
    </div>
  );
};

export default SupplierSchemeEntry;
