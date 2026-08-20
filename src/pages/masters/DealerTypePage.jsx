import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Form } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService.js';
import DoubleConfirmDelete from '../../components/DoubleConfirmDelete.jsx';

// Preset dealer types with their pricing tier mapping
const PRESET_TYPES = [
  { name: 'Dealer', pricingTier: 'dealerRate', description: 'Regular dealer with dealer pricing' },
  { name: 'Wholesaler', pricingTier: 'wholesaleRate', description: 'Wholesale buyer with wholesale pricing' },
  { name: 'Distributor', pricingTier: 'distributorRate', description: 'Area distributor with distributor pricing' },
  { name: 'Retailer', pricingTier: 'retailRate', description: 'Retail customer with retail pricing' },
  { name: 'Builder', pricingTier: 'builderRate', description: 'Builder/Architect with builder pricing' },
  { name: 'Sub-Dealer', pricingTier: 'dealerRate', description: 'Sub-dealer under a dealer' },
];

const PRICING_TIERS = [
  { value: 'dealerRate', label: 'Dealer Rate' },
  { value: 'wholesaleRate', label: 'Wholesale Rate' },
  { value: 'retailRate', label: 'Retail Rate' },
  { value: 'distributorRate', label: 'Distributor Rate' },
  { value: 'builderRate', label: 'Builder Rate' },
  { value: 'projectRate', label: 'Project Rate' },
];

const DealerTypePage = () => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customName, setCustomName] = useState('');
  const [form] = Form.useForm();

  const fetchTypes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterService.getDealerTypes({ limit: 100 });
      if (res.success) setTypes(res.data || []);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchTypes(); }, [fetchTypes]);

  // Get presets that are NOT yet created (filter out already-used names)
  const existingNames = types.map(t => t.name.toLowerCase());
  const availablePresets = PRESET_TYPES.filter(p => !existingNames.includes(p.name.toLowerCase()));

  const handlePresetChange = (value) => {
    if (value === 'other') {
      setSelectedPreset('other');
      setCustomName('');
      form.setFieldsValue({ pricingTier: 'dealerRate', description: '' });
    } else {
      const preset = PRESET_TYPES.find(p => p.name === value);
      setSelectedPreset(preset);
      setCustomName('');
      form.setFieldsValue({
        pricingTier: preset?.pricingTier || 'dealerRate',
        description: preset?.description || '',
      });
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const name = selectedPreset === 'other' ? customName : selectedPreset?.name;
      if (!name || !name.trim()) { message.error('Enter a type name'); return; }

      const data = {
        name: name.trim(),
        description: values.description || '',
        pricingTier: values.pricingTier || 'dealerRate',
      };

      setFormLoading(true);
      let res;
      if (editRecord) {
        res = await masterService.updateDealerType(editRecord._id, data);
      } else {
        res = await masterService.createDealerType(data);
      }
      if (res.success) {
        message.success(editRecord ? 'Type updated' : 'Type created');
        setShowModal(false); setEditRecord(null); setSelectedPreset(null); setCustomName('');
        form.resetFields();
        fetchTypes();
      }
    } catch (err) { if (!err.errorFields) message.error(err.message); }
    finally { setFormLoading(false); }
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    setSelectedPreset({ name: record.name });
    form.setFieldsValue({
      pricingTier: record.pricingTier || 'dealerRate',
      description: record.description || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await masterService.deleteDealerType(id);
      if (res.success) { message.success('Deleted'); fetchTypes(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Type Name', dataIndex: 'name', width: 160,
      render: v => <span className="text-sm font-semibold">{v}</span> },
    { title: 'Pricing Tier', dataIndex: 'pricingTier', width: 140,
      render: v => <Tag color="blue">{PRICING_TIERS.find(t => t.value === v)?.label || v || '—'}</Tag> },
    { title: 'Description', dataIndex: 'description', render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
    { title: 'Status', dataIndex: 'status', width: 80,
      render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v}</Tag> },
    { title: 'Actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <DoubleConfirmDelete title="Delete Type" recordName={r.name}
            onConfirm={() => handleDelete(r._id)}
            trigger={<Button type="text" size="small" danger icon={<DeleteOutlined />} />} />
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dealer Type</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage types: Dealer, Wholesaler, Distributor, Builder, etc. Each maps to a pricing tier.</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchTypes}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditRecord(null); setSelectedPreset(null); setCustomName(''); form.resetFields(); setShowModal(true); }}>
            Add Type
          </Button>
        </Space>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={types} rowKey="_id" loading={loading}
          size="middle" pagination={false} />
      </div>

      {/* Add/Edit Modal */}
      <Modal title={editRecord ? 'Edit Dealer Type' : 'Add Dealer Type'}
        open={showModal} onCancel={() => { setShowModal(false); setEditRecord(null); }}
        onOk={handleSubmit} confirmLoading={formLoading} okText={editRecord ? 'Update' : 'Create'}
        width={500} destroyOnHidden>
        <Form form={form} layout="vertical" className="mt-4">
          {/* Name — Dropdown for presets or custom */}
          {!editRecord ? (
            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">Select Type *</label>
              <Select
                className="w-full" size="large"
                placeholder="Choose a type..."
                value={selectedPreset === 'other' ? 'other' : selectedPreset?.name || undefined}
                onChange={handlePresetChange}
              >
                {availablePresets.map(p => (
                  <Select.Option key={p.name} value={p.name}>
                    {p.name} <span className="text-xs text-gray-400 ml-2">→ {PRICING_TIERS.find(t => t.value === p.pricingTier)?.label}</span>
                  </Select.Option>
                ))}
                <Select.Option value="other">
                  <span className="text-orange-600 font-medium">+ Other (Custom Name)</span>
                </Select.Option>
              </Select>

              {selectedPreset === 'other' && (
                <div className="mt-3">
                  <label className="text-xs text-gray-500 block mb-1">Custom Type Name *</label>
                  <Input value={customName} onChange={e => setCustomName(e.target.value)}
                    placeholder="Enter custom type name..." size="large" />
                </div>
              )}
            </div>
          ) : (
            <div className="mb-4">
              <label className="text-sm font-semibold block mb-2">Type Name</label>
              <Input value={editRecord?.name} disabled size="large" />
            </div>
          )}

          <Form.Item name="pricingTier" label="Pricing Tier (which rate to use for this type)" rules={[{ required: true }]}>
            <Select size="large" options={PRICING_TIERS} />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DealerTypePage;
