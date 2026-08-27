import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Modal, Form, Row, Col, Card, Statistic
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, CarOutlined
} from '@ant-design/icons';
import api from '../../config/api.js';
import DoubleConfirmDelete from '../../components/DoubleConfirmDelete.jsx';

const vehicleService = {
  getAll: (params) => api.get('/masters/vehicles', { params }),
  create: (data) => api.post('/masters/vehicles', data),
  update: (id, data) => api.put(`/masters/vehicles/${id}`, data),
  remove: (id) => api.delete(`/masters/vehicles/${id}`),
};

const VEHICLE_TYPES = [
  { value: 'truck', label: 'Truck' },
  { value: 'mini_truck', label: 'Mini Truck' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'van', label: 'Van' },
  { value: 'auto', label: 'Auto' },
  { value: 'bike', label: 'Bike' },
  { value: 'other', label: 'Other' },
];
const CAPACITY_UNITS = [
  { value: 'tons', label: 'Tons' },
  { value: 'kg', label: 'Kg' },
  { value: 'boxes', label: 'Boxes' },
];
const VEHICLE_TYPE_LABELS = Object.fromEntries(VEHICLE_TYPES.map(type => [type.value, type.label]));
const CAPACITY_UNIT_LABELS = Object.fromEntries(CAPACITY_UNITS.map(unit => [unit.value, unit.label]));
const toDateInput = value => value ? new Date(value).toISOString().slice(0, 10) : undefined;

const VehicleMaster = () => {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [formLoading, setFormLoading] = useState(false);
  const [form] = Form.useForm();

  const fetchVehicles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await vehicleService.getAll({ search, limit: 100 });
      if (res.success) setVehicles(res.data || []);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchVehicles(); }, [fetchVehicles]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setFormLoading(true);
      const res = editRecord
        ? await vehicleService.update(editRecord._id, values)
        : await vehicleService.create(values);
      if (res.success) {
        message.success(editRecord ? 'Vehicle updated' : 'Vehicle added');
        setShowForm(false); setEditRecord(null); form.resetFields();
        fetchVehicles();
      }
    } catch (err) { if (!err.errorFields) message.error(err.message); }
    finally { setFormLoading(false); }
  };

  const handleEdit = (record) => {
    setEditRecord(record);
    form.setFieldsValue({
      ...record,
      insuranceExpiry: toDateInput(record.insuranceExpiry),
      fitnessExpiry: toDateInput(record.fitnessExpiry),
      isActive: record.isActive ?? true,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await vehicleService.remove(id);
      if (res.success) { message.success('Vehicle deleted'); fetchVehicles(); }
    } catch (err) { message.error(err.message); }
  };

  const renderExpiry = value => {
    if (!value) return '—';
    const date = new Date(value);
    const isExpired = date < new Date();
    return <span className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : ''}`}>
      {date.toLocaleDateString('en-IN')}{isExpired ? ' ⚠' : ''}
    </span>;
  };

  const columns = [
    { title: 'Vehicle No.', dataIndex: 'vehicleNumber', width: 130,
      render: value => <span className="font-mono text-sm font-semibold text-blue-600">{value}</span> },
    { title: 'Type', dataIndex: 'vehicleType', width: 110,
      render: value => <Tag>{VEHICLE_TYPE_LABELS[value] || value || '—'}</Tag> },
    { title: 'Make / Model', width: 140,
      render: (_, record) => [record.make, record.model, record.year].filter(Boolean).join(' ') || '—' },
    { title: 'Owner', dataIndex: 'ownerName', width: 120, render: value => value || '—' },
    { title: 'Driver', dataIndex: 'driverName', width: 130, render: value => value || '—' },
    { title: 'Driver Phone', dataIndex: 'driverPhone', width: 120,
      render: value => <span className="text-xs">{value || '—'}</span> },
    { title: 'Capacity', width: 100,
      render: (_, record) => record.capacity ? `${record.capacity} ${CAPACITY_UNIT_LABELS[record.capacityUnit] || record.capacityUnit || ''}` : '—' },
    { title: 'Insurance Exp', dataIndex: 'insuranceExpiry', width: 110, render: renderExpiry },
    { title: 'Fitness Exp', dataIndex: 'fitnessExpiry', width: 110, render: renderExpiry },
    { title: 'Status', dataIndex: 'isActive', width: 90,
      render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Active' : 'Inactive'}</Tag> },
    { title: 'Actions', width: 90,
      render: (_, record) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          <DoubleConfirmDelete
            title="Delete Vehicle"
            recordName={record.vehicleNumber}
            onConfirm={() => handleDelete(record._id)}
            trigger={<Button type="text" size="small" danger icon={<DeleteOutlined />} />}
          />
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Vehicle Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage vehicles for dispatch — number, driver, capacity, documents</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          setEditRecord(null);
          form.resetFields();
          form.setFieldsValue({ vehicleType: 'truck', capacityUnit: 'tons', isActive: true });
          setShowForm(true);
        }}>
          Add Vehicle
        </Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Vehicles" value={vehicles.length} prefix={<CarOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={vehicles.filter(vehicle => vehicle.isActive).length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Inactive" value={vehicles.filter(vehicle => !vehicle.isActive).length} valueStyle={{ color: '#8c8c8c' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Expired Docs" value={vehicles.filter(vehicle =>
          (vehicle.insuranceExpiry && new Date(vehicle.insuranceExpiry) < new Date()) ||
          (vehicle.fitnessExpiry && new Date(vehicle.fitnessExpiry) < new Date())
        ).length} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3">
          <Input placeholder="Search vehicle no, driver, make..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={event => setSearch(event.target.value)} className="w-64" allowClear />
          <Button icon={<ReloadOutlined />} onClick={fetchVehicles}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={vehicles} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1250 }} pagination={{ pageSize: 20 }} />
      </div>

      <Modal title={editRecord ? 'Edit Vehicle' : 'Add Vehicle'} open={showForm}
        onCancel={() => { setShowForm(false); setEditRecord(null); form.resetFields(); }}
        onOk={handleSubmit} confirmLoading={formLoading} width={720} destroyOnHidden>
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="vehicleNumber" label="Vehicle Number" rules={[{ required: true }]}>
              <Input placeholder="e.g. GJ01AB1234" /></Form.Item></Col>
            <Col span={8}><Form.Item name="vehicleType" label="Vehicle Type" rules={[{ required: true }]}>
              <Select placeholder="Select type" options={VEHICLE_TYPES} /></Form.Item></Col>
            <Col span={8}><Form.Item name="ownerName" label="Owner Name"><Input placeholder="Owner name" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="make" label="Make"><Input placeholder="e.g. Tata" /></Form.Item></Col>
            <Col span={8}><Form.Item name="model" label="Model"><Input placeholder="e.g. Ace" /></Form.Item></Col>
            <Col span={8}><Form.Item name="year" label="Year"><Input placeholder="e.g. 2024" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="driverName" label="Driver Name"><Input placeholder="Full name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="driverPhone" label="Driver Phone"><Input placeholder="10-digit number" /></Form.Item></Col>
            <Col span={4}><Form.Item name="capacity" label="Capacity"><Input type="number" min="0" /></Form.Item></Col>
            <Col span={4}><Form.Item name="capacityUnit" label="Unit"><Select options={CAPACITY_UNITS} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="insuranceExpiry" label="Insurance Expiry"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item name="fitnessExpiry" label="Fitness Expiry"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item name="isActive" label="Status">
              <Select options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} placeholder="GPS device, service notes..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VehicleMaster;
