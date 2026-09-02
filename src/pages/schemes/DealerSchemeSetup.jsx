import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';
import SchemeRuleFields, { emptyRule } from './SchemeRuleFields.jsx';

const STATUS_COLORS = { draft: 'default', active: 'green', paused: 'orange', expired: 'gold', closed: 'red' };

const DealerSchemeSetup = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [rule, setRule] = useState(emptyRule('dealer'));
  const [scope, setScope] = useState({ applicableTo: 'all', dealers: [], dealerCategory: null, dealerType: null, description: '' });
  const [masters, setMasters] = useState({ dealers: [], categories: [], types: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getDealerSchemes({ limit: 100 });
      if (response.success) setSchemes(response.data || []);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([
      masterService.getDealers({ limit: 200, status: 'active' }),
      masterService.getDealerCategories({ limit: 200 }),
      masterService.getDealerTypes({ limit: 200 }),
    ]).then(([dealers, categories, types]) => setMasters({
      dealers: dealers.data || [], categories: categories.data || [], types: types.data || [],
    })).catch(() => {});
  }, []);

  const reset = () => {
    setRule(emptyRule('dealer'));
    setScope({ applicableTo: 'all', dealers: [], dealerCategory: null, dealerType: null, description: '' });
  };

  const create = async () => {
    setSaving(true);
    try {
      const response = await reportService.createDealerScheme({ ...rule, ...scope });
      if (response.success) {
        message.success(response.message);
        setShowCreate(false);
        reset();
        load();
      }
    } catch (error) { message.error(error.message); }
    finally { setSaving(false); }
  };

  const changeStatus = async (record, status) => {
    try {
      const response = await reportService.updateDealerSchemeStatus(record._id, { status });
      if (response.success) { message.success(response.message); load(); }
    } catch (error) { message.error(error.message); }
  };

  const columns = [
    { title: 'Scheme', dataIndex: 'schemeNumber', width: 170, render: (value, record) => <div><div className="font-mono text-xs text-blue-600">{value}</div><div className="font-medium">{record.schemeName}</div></div> },
    { title: 'Rule', key: 'rule', render: (_, record) => <div><Tag color="blue">{record.basis?.replaceAll('_', ' ')}</Tag><div className="text-xs text-gray-500 mt-1">{record.calculationType?.replaceAll('_', ' ')} · v{record.version}</div></div> },
    { title: 'Applicability', dataIndex: 'applicableTo', render: value => value?.replaceAll('_', ' ') },
    { title: 'Period', key: 'period', render: (_, record) => `${new Date(record.startDate).toLocaleDateString('en-IN')} – ${new Date(record.endDate).toLocaleDateString('en-IN')}` },
    { title: 'Submitted / posted', key: 'summary', render: (_, record) => <div className="text-xs"><div>Submitted ₹{(record.settlementSummary?.submitted || 0).toLocaleString()}</div><div className="text-green-700">Posted ₹{(record.settlementSummary?.approved || 0).toLocaleString()}</div></div> },
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
        <div><h1 className="text-2xl font-bold text-gray-800">Dealer Incentive Rules</h1><p className="text-sm text-gray-500">Branch-scoped, versioned monetary rules with authoritative settlement.</p></div>
        <Space><Button icon={<ReloadOutlined />} onClick={load} loading={loading} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>New rule</Button></Space>
      </div>
      <div className="bg-white border rounded-lg overflow-hidden"><Table rowKey="_id" columns={columns} dataSource={schemes} loading={loading} scroll={{ x: 1050 }} /></div>

      <Modal title="New dealer incentive rule" open={showCreate} onCancel={() => { setShowCreate(false); reset(); }} width={900}
        okText="Create draft" onOk={create} confirmLoading={saving} destroyOnHidden>
        <div className="space-y-4 mt-4">
          <SchemeRuleFields partyType="dealer" value={rule} onChange={setRule} />
          <div className="border-t pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 block mb-1">Applicable to</label><Select className="w-full" value={scope.applicableTo}
                onChange={applicableTo => setScope(current => ({ ...current, applicableTo }))} options={[
                  { value: 'all', label: 'All scheme-eligible dealers' },
                  { value: 'specific_dealers', label: 'Specific dealers' },
                  { value: 'dealer_category', label: 'Dealer category' },
                  { value: 'dealer_type', label: 'Dealer type' },
                ]} /></div>
              {scope.applicableTo === 'specific_dealers' && <div><label className="text-xs text-gray-500 block mb-1">Dealers *</label><Select mode="multiple" showSearch optionFilterProp="label" className="w-full" value={scope.dealers}
                onChange={dealers => setScope(current => ({ ...current, dealers }))} options={masters.dealers.map(row => ({ value: row._id, label: `${row.businessName} (${row.dealerCode || '—'})` }))} /></div>}
              {scope.applicableTo === 'dealer_category' && <div><label className="text-xs text-gray-500 block mb-1">Category *</label><Select className="w-full" value={scope.dealerCategory}
                onChange={dealerCategory => setScope(current => ({ ...current, dealerCategory }))} options={masters.categories.map(row => ({ value: row._id, label: row.name || row.categoryName }))} /></div>}
              {scope.applicableTo === 'dealer_type' && <div><label className="text-xs text-gray-500 block mb-1">Dealer type *</label><Select className="w-full" value={scope.dealerType}
                onChange={dealerType => setScope(current => ({ ...current, dealerType }))} options={masters.types.map(row => ({ value: row._id, label: row.name || row.typeName }))} /></div>}
            </div>
            <div className="mt-3"><label className="text-xs text-gray-500 block mb-1">Description</label><Input.TextArea rows={2} value={scope.description} onChange={event => setScope(current => ({ ...current, description: event.target.value }))} /></div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DealerSchemeSetup;
