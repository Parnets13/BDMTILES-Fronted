import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Modal, Form, DatePicker, Row, Col, Card, Statistic
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

const VEHICLE_TYPES = ['Truck', 'Mini Truck', 'Tempo', 'Pickup', 'Van', 'Container', 'Trailer', 'Three Wheeler', 'Two Wheeler', 'Other'];
const OWNERSHIP_TYPES = ['Own', 'Hired', 'Contracted'];

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
      let res;
      if (editRecord) {
        res = await vehicleService.update(editRecord._id, values);
      } else {
        res = await vehicleService.create(values);
      }
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
    form.setFieldsValue(record);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    try {
      const res = await vehicleService.remove(id);
      if (res.success) { message.success('Vehicle deleted'); fetchVehicles(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Vehicle No.', dataIndex: 'vehicleNumber', width: 130,
      render: v => <span className="font-mono text-sm font-semibold text-blue-600">{v}</span> },
    { title: 'Type', dataIndex: 'vehicleType', width: 110,
      render: v => <Tag>{v || '—'}</Tag> },
    { title: 'Ownership', dataIndex: 'ownershipType', width: 100,
      render: v => <Tag color={v === 'Own' ? 'green' : v === 'Hired' ? 'orange' : 'blue'}>{v || '—'}</Tag> },
    { title: 'Driver', dataIndex: 'driverName', width: 130 },
    { title: 'Driver Phone', dataIndex: 'driverMobile', width: 120,
      render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Capacity', dataIndex: 'capacity', width: 90,
      render: v => v ? `${v} Ton` : '—' },
    { title: 'Route', dataIndex: 'assignedRoute', width: 120, render: v => v || '—' },
    { title: 'Insurance Exp', dataIndex: 'insuranceExpiry', width: 110,
      render: v => {
        if (!v) return '—';
        const d = new Date(v);
        const isExpired = d < new Date();
        return <span className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : ''}`}>{d.toLocaleDateString('en-IN')}{isExpired ? ' ⚠' : ''}</span>;
      }},
    { title: 'Fitness Exp', dataIndex: 'fitnessExpiry', width: 110,
      render: v => {
        if (!v) return '—';
        const d = new Date(v);
        const isExpired = d < new Date();
        return <span className={`text-xs ${isExpired ? 'text-red-600 font-semibold' : ''}`}>{d.toLocaleDateString('en-IN')}{isExpired ? ' ⚠' : ''}</span>;
      }},
    { title: 'Status', dataIndex: 'status', width: 80,
      render: v => <Tag color={v === 'active' ? 'green' : 'default'}>{v || 'active'}</Tag> },
    { title: 'Actions', width: 90,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)} />
          <DoubleConfirmDelete
            title="Delete Vehicle"
            recordName={r.vehicleNumber}
            onConfirm={() => handleDelete(r._id)}
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditRecord(null); form.resetFields(); setShowForm(true); }}>
          Add Vehicle
        </Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Vehicles" value={vehicles.length} prefix={<CarOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Own" value={vehicles.filter(v => v.ownershipType === 'Own').length} valueStyle={{color:'#52c41a'}} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Hired" value={vehicles.filter(v => v.ownershipType === 'Hired').length} valueStyle={{color:'#fa8c16'}} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Expired Docs" value={vehicles.filter(v => (v.insuranceExpiry && new Date(v.insuranceExpiry) < new Date()) || (v.fitnessExpiry && new Date(v.fitnessExpiry) < new Date())).length} valueStyle={{color:'#f5222d'}} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3">
          <Input placeholder="Search vehicle no, driver..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-64" allowClear />
          <Button icon={<ReloadOutlined />} onClick={fetchVehicles}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={vehicles} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1200 }} pagination={{ pageSize: 20 }} />
      </div>

      {/* Add/Edit Modal */}
      <Modal title={editRecord ? 'Edit Vehicle' : 'Add Vehicle'} open={showForm}
        onCancel={() => { setShowForm(false); setEditRecord(null); form.resetFields(); }}
        onOk={handleSubmit} confirmLoading={formLoading} width={640} destroyOnHidden>
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="vehicleNumber" label="Vehicle Number" rules={[{ required: true }]}>
              <Input placeholder="e.g. GJ01AB1234" /></Form.Item></Col>
            <Col span={8}><Form.Item name="vehicleType" label="Vehicle Type" rules={[{ required: true }]}>
              <Select placeholder="Select type" options={VEHICLE_TYPES.map(t => ({ value: t, label: t }))} /></Form.Item></Col>
            <Col span={8}><Form.Item name="ownershipType" label="Ownership">
              <Select placeholder="Select" options={OWNERSHIP_TYPES.map(t => ({ value: t, label: t }))} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="driverName" label="Driver Name"><Input placeholder="Full name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="driverMobile" label="Driver Mobile"><Input placeholder="10-digit" /></Form.Item></Col>
            <Col span={8}><Form.Item name="capacity" label="Capacity (Tons)"><Input type="number" placeholder="e.g. 5" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="insuranceExpiry" label="Insurance Expiry"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item name="fitnessExpiry" label="Fitness Expiry"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item name="pollutionExpiry" label="Pollution Expiry"><Input type="date" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="permitExpiry" label="Permit Expiry"><Input type="date" /></Form.Item></Col>
            <Col span={8}><Form.Item name="assignedRoute" label="Assigned Route"><Input placeholder="Route name" /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="Status" initialValue="active">
              <Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Form.Item></Col>
          </Row>
          <Form.Item name="remarks" label="Remarks"><Input.TextArea rows={2} placeholder="GPS device, service notes..." /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default VehicleMaster;
