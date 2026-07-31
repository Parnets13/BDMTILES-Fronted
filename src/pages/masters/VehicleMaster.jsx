import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Popconfirm,
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { Truck } from 'lucide-react';
import masterService from '../../services/masterService.js';

const VEHICLE_TYPES = ['truck', 'mini_truck', 'tempo', 'van', 'auto', 'bike', 'other'];
const VEHICLE_TYPE_LABELS = {
  truck: 'Truck', mini_truck: 'Mini Truck', tempo: 'Tempo',
  van: 'Van', auto: 'Auto', bike: 'Bike', other: 'Other',
};
const TYPE_COLORS = {
  truck: 'blue', mini_truck: 'cyan', tempo: 'green', van: 'purple',
  auto: 'orange', bike: 'geekblue', other: 'default',
};

const empty = () => ({
  vehicleNumber: '', vehicleType: 'truck', make: '', model: '', year: '',
  capacity: '', capacityUnit: 'tons', ownerName: '', driverName: '',
  driverPhone: '', insuranceExpiry: '', fitnessExpiry: '',
  isActive: true, remarks: '',
});

const VehicleMaster = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [form, setForm] = useState(empty());
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await masterService.getVehicles({ page, limit: pageSize, search });
      if (res.success) {
        setVehicles(res.data || []);
        if (res.pagination) setPagination(p => ({ ...p, current: res.pagination.currentPage, total: res.pagination.totalItems, pageSize }));
      }
    } catch { setVehicles([]); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty()); setShowModal(true); };
  const openEdit = (v) => { setEditing(v); setForm({ ...v }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(empty()); };

  const handleSave = async () => {
    if (!form.vehicleNumber.trim()) { message.error('Vehicle number is required'); return; }
    setSaveLoading(true);
    try {
      let res;
      if (editing) {
        res = await masterService.updateVehicle(editing._id, form);
      } else {
        res = await masterService.createVehicle(form);
      }
      if (res.success) {
        message.success(editing ? 'Vehicle updated' : 'Vehicle added');
        closeModal();
        load();
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const expiringSoon = vehicles.filter(v => {
    if (!v.insuranceExpiry) return false;
    const days = (new Date(v.insuranceExpiry) - new Date()) / (1000 * 60 * 60 * 24);
    return days > 0 && days <= 30;
  }).length;

  const columns = [
    { title: '#', render: (_, __, i) => i + 1, width: 45 },
    {
      title: 'Vehicle No.', dataIndex: 'vehicleNumber',
      render: (v, r) => (
        <div>
          <div className="font-semibold font-mono text-gray-800">{v}</div>
          <div className="text-xs text-gray-400">{r.make} {r.model} {r.year ? `(${r.year})` : ''}</div>
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'vehicleType',
      render: v => <Tag color={TYPE_COLORS[v] || 'default'}>{VEHICLE_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Capacity', key: 'cap',
      render: (_, r) => r.capacity ? `${r.capacity} ${r.capacityUnit || 'tons'}` : '—',
    },
    {
      title: 'Driver', key: 'driver',
      render: (_, r) => r.driverName ? (
        <div>
          <div className="text-sm">{r.driverName}</div>
          <div className="text-xs text-gray-400">{r.driverPhone}</div>
        </div>
      ) : <span className="text-gray-400">—</span>,
    },
    {
      title: 'Insurance Expiry', dataIndex: 'insuranceExpiry',
      render: v => {
        if (!v) return '—';
        const days = Math.round((new Date(v) - new Date()) / (1000 * 60 * 60 * 24));
        const color = days < 0 ? 'red' : days <= 30 ? 'orange' : 'green';
        return <Tag color={color}>{new Date(v).toLocaleDateString('en-IN')}</Tag>;
      },
    },
    {
      title: 'Status', dataIndex: 'isActive',
      render: v => <Tag color={v !== false ? 'green' : 'default'}>{v !== false ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions', width: 110,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
          <Popconfirm title={`Delete "${r.vehicleNumber}"?`} okText="Delete" okButtonProps={{ danger: true }}
            onConfirm={async () => {
              try {
                const res = await masterService.deleteVehicle(r._id);
                if (res.success) { message.success('Vehicle deleted'); load(1, pagination.pageSize); }
              } catch (err) { message.error(err.message || 'Delete failed'); }
            }}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vehicle Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage trucks, tempos and delivery vehicles</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Vehicle
          </Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total Vehicles', vehicles.length, '#FF5F03'],
          ['Active', vehicles.filter(v => v.isActive !== false).length, '#52c41a'],
          ['Insurance Expiring (30d)', expiringSoon, expiringSoon > 0 ? '#fa8c16' : '#1890ff'],
        ].map(([t, v, c]) => (
          <Col span={8} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <Input placeholder="Search by vehicle number, driver, or make…"
          prefix={<SearchOutlined />} value={search}
          onChange={e => setSearch(e.target.value)} className="max-w-xs" />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={vehicles} rowKey="_id"
          loading={loading} size="small"
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, showTotal: t => `${t} vehicles` }}
          onChange={p => load(p.current, p.pageSize)}
          locale={{ emptyText: 'No vehicles added yet. Click "Add Vehicle" to start.' }}
        />
      </div>

      <Modal
        title={<span className="font-bold">{editing ? 'Edit Vehicle' : 'Add Vehicle'}</span>}
        open={showModal} onCancel={closeModal} onOk={handleSave}
        okText={editing ? 'Update' : 'Add'}
        confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={580} destroyOnHidden
      >
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vehicle Number *</label>
            <Input value={form.vehicleNumber}
              onChange={e => set('vehicleNumber', e.target.value.toUpperCase())} placeholder="KA01AB1234" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vehicle Type</label>
            <Select value={form.vehicleType} onChange={v => set('vehicleType', v)} className="w-full"
              options={VEHICLE_TYPES.map(t => ({ value: t, label: VEHICLE_TYPE_LABELS[t] }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Make</label>
            <Input value={form.make} onChange={e => set('make', e.target.value)} placeholder="e.g. Tata" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Model</label>
            <Input value={form.model} onChange={e => set('model', e.target.value)} placeholder="e.g. Ace" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Year</label>
            <Input value={form.year} onChange={e => set('year', e.target.value)} placeholder="2022" />
          </div>
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="text-xs text-gray-500 block mb-1">Capacity</label>
              <Input value={form.capacity} onChange={e => set('capacity', e.target.value)} />
            </div>
            <div className="w-20">
              <label className="text-xs text-gray-500 block mb-1">Unit</label>
              <Select value={form.capacityUnit} onChange={v => set('capacityUnit', v)} className="w-full"
                options={['tons','kg','boxes'].map(u => ({ value: u, label: u }))} />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Owner Name</label>
            <Input value={form.ownerName} onChange={e => set('ownerName', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Driver Name</label>
            <Input value={form.driverName} onChange={e => set('driverName', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Driver Phone</label>
            <Input value={form.driverPhone} onChange={e => set('driverPhone', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Insurance Expiry</label>
            <Input type="date" value={form.insuranceExpiry} onChange={e => set('insuranceExpiry', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Fitness Expiry</label>
            <Input type="date" value={form.fitnessExpiry} onChange={e => set('fitnessExpiry', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <Select value={form.isActive} onChange={v => set('isActive', v)} className="w-full"
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VehicleMaster;
