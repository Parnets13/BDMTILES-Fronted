import { useCallback, useEffect, useState } from 'react';
import { Button, Card, DatePicker, Input, InputNumber, Modal, Select, Space, Switch, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import notificationService from '../../services/notificationService.js';

const ROLES = ['admin', 'sub_admin', 'sales_manager', 'purchase_manager', 'warehouse_manager', 'finance_manager', 'hr_manager', 'sales_executive', 'delivery_executive', 'picking_staff', 'sorting_staff', 'dealer'];
const MODES = [
  { value: 'all_time', label: 'All history' },
  { value: 'rolling_days', label: 'Rolling days' },
  { value: 'fixed_range', label: 'Fixed date range' },
];
const emptyPolicy = { module: 'lead', resourceKey: '*', mode: 'all_time', rollingDays: 30, startDate: null, endDate: null, exemptRoles: [], rolePolicies: [], enabled: true };

const RuleFields = ({ value, onChange, includeRole = false }) => (
  <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
    {includeRole && <Select placeholder="Role" value={value.role} options={ROLES.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))} onChange={(role) => onChange({ role })} />}
    <Select value={value.mode} options={MODES} onChange={(mode) => onChange({ mode })} />
    {value.mode === 'rolling_days' && <InputNumber className="w-full" min={1} precision={0} value={value.rollingDays} addonAfter="days" onChange={(rollingDays) => onChange({ rollingDays })} />}
    {value.mode === 'fixed_range' && <DatePicker value={value.startDate ? dayjs(value.startDate) : null} onChange={(date) => onChange({ startDate: date?.toISOString() || null })} placeholder="Start date" />}
    {value.mode === 'fixed_range' && <DatePicker value={value.endDate ? dayjs(value.endDate) : null} onChange={(date) => onChange({ endDate: date?.endOf('day').toISOString() || null })} placeholder="End date" />}
    {includeRole && <div className="flex items-center gap-2"><Switch checked={value.enabled !== false} onChange={(enabled) => onChange({ enabled })} /><span>Enabled</span></div>}
  </div>
);

const AccessPolicyPage = () => {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await notificationService.getAccessPolicies();
      setPolicies(response.data || []);
    } catch (error) {
      message.error(error.message || 'Unable to load access policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    try {
      if (!editing.module || !editing.resourceKey) return message.error('Module and resource key are required');
      await notificationService.saveAccessPolicy(editing.module, editing.resourceKey, editing);
      message.success('Access policy saved');
      setEditing(null);
      load();
    } catch (error) {
      message.error(error.message || 'Unable to save access policy');
    }
  };

  const remove = async (id) => {
    try {
      await notificationService.deleteAccessPolicy(id);
      message.success('Access policy deleted');
      load();
    } catch (error) {
      message.error(error.message || 'Unable to delete access policy');
    }
  };

  const columns = [
    { title: 'Module', dataIndex: 'module', render: (value) => <Tag>{value}</Tag> },
    { title: 'Resource', dataIndex: 'resourceKey' },
    { title: 'Default policy', render: (_, record) => record.mode === 'rolling_days' ? `Last ${record.rollingDays} days` : record.mode === 'fixed_range' ? `${new Date(record.startDate).toLocaleDateString('en-IN')} – ${new Date(record.endDate).toLocaleDateString('en-IN')}` : 'All history' },
    { title: 'Exempt roles', dataIndex: 'exemptRoles', render: (roles = []) => <Space wrap>{roles.map((role) => <Tag key={role}>{role}</Tag>)}</Space> },
    { title: 'Role overrides', dataIndex: 'rolePolicies', render: (rules = []) => rules.length },
    { title: 'Enabled', dataIndex: 'enabled', render: (enabled) => <Tag color={enabled ? 'green' : 'default'}>{enabled ? 'Yes' : 'No'}</Tag> },
    { title: '', render: (_, record) => <Space><Button icon={<EditOutlined />} onClick={() => setEditing({ ...record })} /><Button danger icon={<DeleteOutlined />} onClick={() => remove(record._id)} /></Space> },
  ];

  const updateRolePolicy = (index, patch) => setEditing((previous) => ({
    ...previous,
    rolePolicies: previous.rolePolicies.map((rule, itemIndex) => itemIndex === index ? { ...rule, ...patch } : rule),
  }));

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Historical Access Policies</h1><p className="mt-0.5 text-sm text-gray-500">Owner-only branch scopes for module and resource history</p></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({ ...emptyPolicy, rolePolicies: [] })}>New Policy</Button>
      </div>
      <Table rowKey="_id" loading={loading} dataSource={policies} columns={columns} pagination={false} />

      <Modal title="Access Policy" open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={save} width={900} okText="Save Policy" destroyOnHidden>
        {editing && <div className="space-y-4">
          <Card size="small" title="Scope">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input placeholder="Module, e.g. lead" value={editing.module} disabled={Boolean(editing._id)} onChange={(event) => setEditing((previous) => ({ ...previous, module: event.target.value }))} />
              <Input placeholder="Resource key or *" value={editing.resourceKey} disabled={Boolean(editing._id)} onChange={(event) => setEditing((previous) => ({ ...previous, resourceKey: event.target.value }))} />
              <div className="flex items-center gap-2"><Switch checked={editing.enabled} onChange={(enabled) => setEditing((previous) => ({ ...previous, enabled }))} /><span>Policy enabled</span></div>
            </div>
          </Card>
          <Card size="small" title="Default rule"><RuleFields value={editing} onChange={(patch) => setEditing((previous) => ({ ...previous, ...patch }))} /></Card>
          <Card size="small" title="Roles exempt from restriction">
            <Select className="w-full" mode="multiple" value={editing.exemptRoles} options={ROLES.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))} onChange={(exemptRoles) => setEditing((previous) => ({ ...previous, exemptRoles }))} />
          </Card>
          <Card size="small" title="Optional role-specific policies">
            <div className="space-y-3">
              {(editing.rolePolicies || []).map((rule, index) => <div key={`${rule.role}-${index}`} className="rounded border border-gray-200 p-3"><RuleFields includeRole value={rule} onChange={(patch) => updateRolePolicy(index, patch)} /><Button className="mt-2" danger type="link" onClick={() => setEditing((previous) => ({ ...previous, rolePolicies: previous.rolePolicies.filter((_, itemIndex) => itemIndex !== index) }))}>Remove override</Button></div>)}
              <Button block type="dashed" onClick={() => setEditing((previous) => ({ ...previous, rolePolicies: [...(previous.rolePolicies || []), { role: '', mode: 'all_time', rollingDays: 30, enabled: true }] }))}>Add role override</Button>
            </div>
          </Card>
        </div>}
      </Modal>
    </div>
  );
};

export default AccessPolicyPage;
