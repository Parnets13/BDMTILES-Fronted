import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Popconfirm, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { Map } from 'lucide-react';
import masterService from '../../services/masterService.js';
import userService from '../../services/userService.js';

const FREQ_OPTIONS = [
  { value: 'daily',       label: 'Daily',       color: 'green'   },
  { value: 'weekly',      label: 'Weekly',      color: 'blue'    },
  { value: 'fortnightly', label: 'Fortnightly', color: 'cyan'    },
  { value: 'monthly',     label: 'Monthly',     color: 'default' },
];
const DAYS = [
  { value: 'monday',    label: 'Monday'    },
  { value: 'tuesday',   label: 'Tuesday'   },
  { value: 'wednesday', label: 'Wednesday' },
  { value: 'thursday',  label: 'Thursday'  },
  { value: 'friday',    label: 'Friday'    },
  { value: 'saturday',  label: 'Saturday'  },
  { value: 'sunday',    label: 'Sunday'    },
];

const empty = () => ({
  name: '', description: '', region: undefined, assignedSE: undefined,
  citiesCovered: [], visitFrequency: 'weekly', dayOfWeek: '', status: 'active',
});

const RoutePage = () => {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [regionFilter, setRegionFilter] = useState(undefined);

  const [regions, setRegions] = useState([]);
  const [seList, setSeList] = useState([]);

  // city input
  const [cityInput, setCityInput] = useState('');

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(empty());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await masterService.getRoutes({
        page, limit: pageSize, search, status: statusFilter, region: regionFilter,
      });
      if (res.success) {
        setRoutes(res.data || []);
        if (res.pagination) setPagination(p => ({ ...p, current: res.pagination.currentPage, total: res.pagination.totalItems, pageSize }));
      }
    } catch { setRoutes([]); }
    finally { setLoading(false); }
  }, [search, statusFilter, regionFilter]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  useEffect(() => {
    Promise.all([
      masterService.getRegions({ limit: 200 }),
      userService.getUsers({ role: 'sales_executive', limit: 200, status: 'active' }),
    ]).then(([rr, ur]) => {
      if (rr.success) setRegions(rr.data || []);
      if (ur.success) setSeList(ur.data || []);
    }).catch(() => {});
  }, []);

  const openCreate = () => { setEditing(null); setForm(empty()); setCityInput(''); setShowModal(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      ...r,
      region: r.region?._id || r.region,
      assignedSE: r.assignedSE?._id || r.assignedSE,
      citiesCovered: r.citiesCovered || [],
    });
    setCityInput('');
    setShowModal(true);
  };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(empty()); setCityInput(''); };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const addCity = () => {
    const city = cityInput.trim();
    if (!city) return;
    if (form.citiesCovered.includes(city)) { message.warning('City already added'); return; }
    set('citiesCovered', [...form.citiesCovered, city]);
    setCityInput('');
  };
  const removeCity = (city) => set('citiesCovered', form.citiesCovered.filter(c => c !== city));

  const handleSave = async () => {
    if (!form.name?.trim()) { message.error('Route name is required'); return; }
    setSaving(true);
    try {
      const res = editing
        ? await masterService.updateRoute(editing._id, form)
        : await masterService.createRoute(form);
      if (res.success) {
        message.success(editing ? 'Route updated' : 'Route created');
        closeModal();
        load(pagination.current, pagination.pageSize);
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await masterService.deleteRoute(id);
      if (res.success) { message.success('Route deleted'); load(1, pagination.pageSize); }
    } catch (err) { message.error(err.message || 'Delete failed'); }
  };

  const columns = [
    {
      title: 'Route', key: 'route',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-gray-800">{r.name}</div>
          {r.description && <div className="text-xs text-gray-400">{r.description}</div>}
        </div>
      ),
    },
    {
      title: 'Region', key: 'region', width: 120,
      render: (_, r) => r.region?.name
        ? <Tag color="geekblue">{r.region.name}</Tag>
        : <span className="text-gray-400">—</span>,
    },
    {
      title: 'Sales Executive', key: 'se', width: 160,
      render: (_, r) => r.assignedSE?.name
        ? (
          <div>
            <div className="text-sm font-medium">{r.assignedSE.name}</div>
            {r.assignedSE.phone && <div className="text-xs text-gray-400">{r.assignedSE.phone}</div>}
          </div>
        ) : <span className="text-gray-400">Unassigned</span>,
    },
    {
      title: 'Cities Covered', key: 'cities', width: 200,
      render: (_, r) => r.citiesCovered?.length
        ? (
          <div className="flex flex-wrap gap-1">
            {r.citiesCovered.slice(0, 3).map(c => <Tag key={c} className="text-xs">{c}</Tag>)}
            {r.citiesCovered.length > 3 && <Tag className="text-xs">+{r.citiesCovered.length - 3}</Tag>}
          </div>
        ) : <span className="text-gray-400">—</span>,
    },
    {
      title: 'Frequency', key: 'freq', width: 130,
      render: (_, r) => {
        const f = FREQ_OPTIONS.find(x => x.value === r.visitFrequency);
        const dayLabel = r.dayOfWeek ? ` · ${r.dayOfWeek.charAt(0).toUpperCase() + r.dayOfWeek.slice(1)}` : '';
        return <Tag color={f?.color || 'default'}>{(f?.label || r.visitFrequency) + dayLabel}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: v => <Tag color={v === 'active' ? 'green' : 'default'} className="capitalize">{v}</Tag>,
    },
    {
      title: 'Actions', width: 90,
      render: (_, r) => (
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
            <Map size={20} style={{ color: '#FF5F03' }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Route Master</h1>
            <p className="text-sm text-gray-500">Manage sales visit and delivery routes</p>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreate}
          style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Add Route
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-5">
        {[
          { label: 'Total Routes', value: pagination.total,                                          color: '#3b82d4' },
          { label: 'Active',       value: routes.filter(r => r.status === 'active').length,          color: '#16a34a' },
          { label: 'With SE',      value: routes.filter(r => r.assignedSE).length,                   color: '#7c5cd8' },
          { label: 'Unassigned',   value: routes.filter(r => !r.assignedSE).length,                  color: '#ea580c' },
        ].map(s => (
          <Col span={6} key={s.label}>
            <Card size="small" className="border border-gray-200">
              <Statistic title={s.label} value={s.value} valueStyle={{ color: s.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters + Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3">
          <Input
            placeholder="Search routes..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-56" allowClear
          />
          <Select placeholder="All Regions" value={regionFilter} onChange={v => setRegionFilter(v)} allowClear
            className="w-36" options={regions.map(r => ({ value: r._id, label: r.name }))} />
          <Select placeholder="All Statuses" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear
            className="w-36" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => load(1, pagination.pageSize)}>Refresh</Button>
        </div>

        <Table
          columns={columns} dataSource={routes} rowKey="_id"
          loading={loading} size="middle"
          pagination={{
            current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
            showSizeChanger: true, showTotal: t => `${t} routes`,
          }}
          onChange={p => load(p.current, p.pageSize)}
          locale={{ emptyText: 'No routes found. Click "Add Route" to create one.' }}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={<span className="font-bold text-base">{editing ? 'Edit Route' : 'Add Route'}</span>}
        open={showModal} onCancel={closeModal} onOk={handleSave}
        okText={editing ? 'Update' : 'Create'} confirmLoading={saving}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={600} destroyOnHidden
      >
        <div className="mt-4 space-y-4">
          {/* Name + Status */}
          <Row gutter={16}>
            <Col span={16}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Route Name <span className="text-red-500">*</span></label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Bangalore North Route" />
            </Col>
            <Col span={8}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Status</label>
              <Select value={form.status} onChange={v => set('status', v)} className="w-full"
                options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            </Col>
          </Row>

          <div>
            <label className="text-xs font-medium text-gray-600 block mb-1">Description</label>
            <Input value={form.description} onChange={e => set('description', e.target.value)}
              placeholder="Optional notes about this route" />
          </div>

          <Divider className="my-3" orientation="left" orientationMargin={0}>
            <span className="text-xs font-semibold text-gray-500">Assignment</span>
          </Divider>

          <Row gutter={16}>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Region</label>
              <Select showSearch value={form.region} onChange={v => set('region', v)} allowClear
                placeholder="Select region" className="w-full"
                options={regions.map(r => ({ value: r._id, label: r.name }))} />
            </Col>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Assigned Sales Executive</label>
              <Select showSearch value={form.assignedSE} onChange={v => set('assignedSE', v)} allowClear
                placeholder="Select SE" className="w-full"
                filterOption={(input, opt) => opt?.label?.toLowerCase().includes(input.toLowerCase())}
                options={seList.map(s => ({ value: s._id, label: `${s.name}${s.phone ? ` · ${s.phone}` : ''}` }))} />
            </Col>
          </Row>

          <Divider className="my-3" orientation="left" orientationMargin={0}>
            <span className="text-xs font-semibold text-gray-500">Visit Schedule</span>
          </Divider>

          <Row gutter={16}>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Visit Frequency</label>
              <Select value={form.visitFrequency} onChange={v => set('visitFrequency', v)} className="w-full"
                options={FREQ_OPTIONS.map(f => ({ value: f.value, label: f.label }))} />
            </Col>
            <Col span={12}>
              <label className="text-xs font-medium text-gray-600 block mb-1">Day of Week</label>
              <Select value={form.dayOfWeek || undefined} onChange={v => set('dayOfWeek', v || '')} allowClear
                placeholder="Any day" className="w-full"
                options={DAYS.map(d => ({ value: d.value, label: d.label }))} />
            </Col>
          </Row>

          <Divider className="my-3" orientation="left" orientationMargin={0}>
            <span className="text-xs font-semibold text-gray-500">Cities / Areas Covered</span>
          </Divider>

          <div className="flex gap-2">
            <Input
              value={cityInput} onChange={e => setCityInput(e.target.value)}
              onPressEnter={addCity}
              placeholder="Type city/area and press Enter or Add"
              className="flex-1"
            />
            <Button onClick={addCity} type="dashed">Add</Button>
          </div>
          {form.citiesCovered.length > 0 && (
            <div className="flex flex-wrap gap-1 p-2 bg-gray-50 rounded border border-gray-200 min-h-8">
              {form.citiesCovered.map(c => (
                <Tag key={c} closable onClose={() => removeCity(c)} className="text-sm">{c}</Tag>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default RoutePage;
