import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Popconfirm, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import masterService from '../../services/masterService.js';

const WAREHOUSE_TYPES = [
  { value: 'main',    label: 'Main Warehouse',  color: 'blue'    },
  { value: 'branch',  label: 'Branch',          color: 'cyan'    },
  { value: 'transit', label: 'Transit',         color: 'orange'  },
  { value: 'godown',  label: 'Godown',          color: 'purple'  },
];
const STATUS_OPTIONS = [
  { value: 'active',      label: 'Active',      color: 'green'   },
  { value: 'inactive',    label: 'Inactive',    color: 'default' },
  { value: 'maintenance', label: 'Maintenance', color: 'orange'  },
];
const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry','Chandigarh',
];

const empty = () => ({
  name: '', type: 'main', address: '', city: '', state: '', pinCode: '',
  region: undefined, managerName: '', managerPhone: '', email: '',
  capacity: '', status: 'active',
});

const WarehousePage = () => {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [regionFilter, setRegionFilter] = useState(undefined);
  const [regions, setRegions] = useState([]);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  // Stats
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, maintenance: 0 });

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await masterService.getWarehouses({
        page, limit: pageSize, search, status: statusFilter, region: regionFilter,
      });
      if (res.success) {
        setWarehouses(res.data || []);
        if (res.pagination) setPagination(p => ({ ...p, current: res.pagination.currentPage, total: res.pagination.totalItems, pageSize }));
        // Compute stats from full response if possible
        const data = res.data || [];
        setStats({
          total: res.pagination?.totalItems || data.length,
          active: data.filter(w => w.status === 'active').length,
          inactive: data.filter(w => w.status === 'inactive').length,
          maintenance: data.filter(w => w.status === 'maintenance').length,
        });
      }
    } catch { setWarehouses([]); }
    finally { setLoading(false); }
  }, [search, statusFilter, regionFilter]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  useEffect(() => {
    masterService.getRegions({ limit: 200 }).then(r => {
      if (r.success) setRegions(r.data || []);
    }).catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setForm(empty()); setShowModal(true); };
  const openEdit   = (w) => { setEditing(w); setForm({ ...w, region: w.region?._id || w.region }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(empty()); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name?.trim()) { message.error('Warehouse name is required'); return; }
    setSaving(true);
    try {
      const res = editing
        ? await masterService.updateWarehouse(editing._id, form)
        : await masterService.createWarehouse(form);
      if (res.success) {
        message.success(editing ? 'Warehouse updated' : 'Warehouse created');
        closeModal();
        load(pagination.current, pagination.pageSize);
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await masterService.deleteWarehouse(id);
      if (res.success) { message.success('Warehouse deleted'); load(1, pagination.pageSize); }
    } catch (err) { message.error(err.message || 'Delete failed'); }
  };

  const columns = [
    {
      title: 'Warehouse', key: 'wh',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-1">
            <span className="font-mono text-xs text-gray-400 mr-1">{r.warehouseCode}</span>
            {r.name}
          </div>
          {(r.city || r.state) && (
            <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
              <EnvironmentOutlined style={{ fontSize: 10 }} />
              {[r.city, r.state].filter(Boolean).join(', ')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'type', width: 120,
      render: v => {
        const t = WAREHOUSE_TYPES.find(x => x.value === v);
        return <Tag color={t?.color || 'default'}>{t?.label || v}</Tag>;
      },
    },
    {
      title: 'Region', key: 'region', width: 120,
      render: (_, r) => r.region?.name || <span className="text-gray-400">—</span>,
    },
    {
      title: 'Manager', key: 'mgr', width: 160,
      render: (_, r) => r.managerName ? (
        <div>
          <div className="text-sm">{r.managerName}</div>
          {r.managerPhone && <div className="text-xs text-gray-400">{r.managerPhone}</div>}
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    { title: 'Capacity', dataIndex: 'capacity', width: 100, render: v => v || <span className="text-gray-400">—</span> },
    {
      title: 'Status', dataIndex: 'status', width: 110,
      render: v => {
        const s = STATUS_OPTIONS.find(x => x.value === v);
        return <Tag color={s?.color || 'default'} className="capitalize">{s?.label || v}</Tag>;
      },
    },
    {
      title: 'Actions', width: 90, render: (_, r) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Popconfirm title={`Delete "${r.name}"?`} okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => handleDelete(r._id)}>
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: '#fff7ed' }}>
            <WarehouseIcon size={20} style={{ color: '#FF5F03' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Warehouse Master</h1>
            <p className="text-sm text-gray-500">Manage warehouses and storage locations</p>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}
          style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Add Warehouse
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-5">
        {[
          { label: 'Total',       value: pagination.total, color: '#3b82d4' },
          { label: 'Active',      value: stats.active,     color: '#16a34a' },
          { label: 'Inactive',    value: stats.inactive,   color: '#6b7280' },
          { label: 'Maintenance', value: stats.maintenance,color: '#ea580c' },
        ].map(s => (
          <Col span={6} key={s.label}>
            <Card size="small" className="border border-gray-200">
              <Statistic title={s.label} value={s.value} valueStyle={{ color: s.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <Input
            placeholder="Search warehouse, city, manager..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-64" allowClear
          />
          <Select placeholder="All Regions" value={regionFilter} onChange={v => setRegionFilter(v)}
            allowClear className="w-40" options={regions.map(r => ({ value: r._id, label: r.name }))} />
          <Select placeholder="All Statuses" value={statusFilter} onChange={v => setStatusFilter(v)}
            allowClear className="w-40" options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))} />
          <Button icon={<ReloadOutlined />} onClick={() => load(1, pagination.pageSize)}>Refresh</Button>
        </div>

        <Table
          columns={columns} dataSource={warehouses} rowKey="_id"
          loading={loading} size="middle"
          pagination={{
            current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
            showSizeChanger: true, showTotal: t => `${t} warehouses`,
          }}
          onChange={p => load(p.current, p.pageSize)}
          locale={{ emptyText: 'No warehouses found. Click "Add Warehouse" to create one.' }}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={<span className="font-bold text-base">{editing ? 'Edit Warehouse' : 'Add Warehouse'}</span>}
        open={showModal} onCancel={closeModal} onOk={handleSave}
        okText={editing ? 'Update' : 'Create'} confirmLoading={saving}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={640} destroyOnHidden
      >
        <div className="mt-4 space-y-4">
          {/* Row 1 */}
          <Row gutter={16}>
            <Col span={16}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Warehouse Name <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Main Warehouse - Bangalore" />
            </Col>
            <Col span={8}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Type</label>
              <Select value={form.type} onChange={v => set('type', v)} className="w-full"
                options={WAREHOUSE_TYPES.map(t => ({ value: t.value, label: t.label }))} />
            </Col>
          </Row>

          {/* Row 2 */}
          <Row gutter={16}>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Region</label>
              <Select value={form.region} onChange={v => set('region', v)} allowClear placeholder="Select region" className="w-full"
                options={regions.map(r => ({ value: r._id, label: r.name }))} />
            </Col>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <Select value={form.status} onChange={v => set('status', v)} className="w-full"
                options={STATUS_OPTIONS.map(s => ({ value: s.value, label: s.label }))} />
            </Col>
          </Row>

          <Divider className="my-3" orientation="left" orientationMargin={0}>
            <span className="text-xs font-semibold text-gray-500">Address</span>
          </Divider>

          {/* Address */}
          <Input value={form.address} onChange={e => set('address', e.target.value)} placeholder="Street / Area" />
          <Row gutter={16}>
            <Col span={8}>
              <label className="text-xs font-medium text-gray-600 block mb-1">City</label>
              <Input value={form.city} onChange={e => set('city', e.target.value)} placeholder="City" />
            </Col>
            <Col span={10}>
              <label className="text-xs font-medium text-gray-600 block mb-1">State</label>
              <Select showSearch value={form.state || undefined} onChange={v => set('state', v)} placeholder="Select state"
                className="w-full" allowClear
                options={STATES.map(s => ({ value: s, label: s }))} />
            </Col>
            <Col span={6}>
              <label className="text-xs font-medium text-gray-600 block mb-1">PIN Code</label>
              <Input value={form.pinCode} onChange={e => set('pinCode', e.target.value)} placeholder="560001" maxLength={6} />
            </Col>
          </Row>

          <Divider className="my-3" orientation="left" orientationMargin={0}>
            <span className="text-xs font-semibold text-gray-500">Manager & Contact</span>
          </Divider>

          <Row gutter={16}>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Manager Name</label>
              <Input value={form.managerName} onChange={e => set('managerName', e.target.value)} placeholder="e.g. Ramesh Kumar" />
            </Col>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Manager Phone</label>
              <Input value={form.managerPhone} onChange={e => set('managerPhone', e.target.value)} placeholder="9876543210" maxLength={10} />
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Email</label>
              <Input value={form.email} onChange={e => set('email', e.target.value)} placeholder="warehouse@example.com" type="email" />
            </Col>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Capacity (sq.ft / pallets)</label>
              <Input value={form.capacity} onChange={e => set('capacity', e.target.value)} placeholder="e.g. 5000 sq.ft" />
            </Col>
          </Row>
        </div>
      </Modal>
    </div>
  );
};

export default WarehousePage;
