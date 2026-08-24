import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Modal, message, Tooltip, Row, Col, Card, Statistic, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, UserOutlined, TeamOutlined, ShopOutlined, ToolOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import DoubleConfirmDelete from '../../components/DoubleConfirmDelete.jsx';

const { Option } = Select;
const { TextArea } = Input;

const CUSTOMER_TYPES = [
  { value: 'retail', label: 'Retail', color: 'green' },
  { value: 'builder', label: 'Builder', color: 'orange' },
  { value: 'architect', label: 'Architect', color: 'purple' },
  { value: 'contractor', label: 'Contractor', color: 'blue' },
  { value: 'interior_designer', label: 'Interior Designer', color: 'magenta' },
];

const SOURCE_OPTIONS = [
  { value: 'walk_in', label: 'Walk In' },
  { value: 'referral', label: 'Referral' },
  { value: 'online', label: 'Online' },
  { value: 'phone', label: 'Phone' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'google_ads', label: 'Google Ads' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'exhibition', label: 'Exhibition' },
  { value: 'architect_referral', label: 'Architect Referral' },
  { value: 'other', label: 'Other' },
];

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'inactive', label: 'Inactive', color: 'orange' },
  { value: 'blocked', label: 'Blocked', color: 'red' },
];

const getTypeColor = (type) => {
  const found = CUSTOMER_TYPES.find(t => t.value === type);
  return found ? found.color : 'default';
};

const CustomerMaster = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ customerType: undefined, status: undefined });
  const [stats, setStats] = useState({ total: 0, retail: 0, builder: 0, architect: 0, contractor: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [form] = Form.useForm();
  const [customerType, setCustomerType] = useState('retail');

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/customers/stats');
      if (res.success) setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: search || undefined,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      };
      const res = await api.get('/customers', { params });
      if (res.success) {
        setCustomers(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const openModal = (customer = null) => {
    setEditingCustomer(customer);
    if (customer) {
      form.setFieldsValue(customer);
      setCustomerType(customer.customerType || 'retail');
    } else {
      form.resetFields();
      form.setFieldsValue({ customerType: 'retail', status: 'active' });
      setCustomerType('retail');
    }
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = editingCustomer
        ? await api.put(`/customers/${editingCustomer._id}`, values)
        : await api.post('/customers', values);
      if (res.success) {
        message.success(editingCustomer ? 'Customer updated' : 'Customer created');
        setModalOpen(false);
        form.resetFields();
        setEditingCustomer(null);
        fetchCustomers();
        fetchStats();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Save failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await api.delete(`/customers/${id}`);
      if (res.success) {
        message.success(res.message || 'Customer deleted');
        fetchCustomers();
        fetchStats();
      }
    } catch (err) {
      message.error(err.message || 'Delete failed');
    }
  };

  const isNonRetail = customerType && customerType !== 'retail';
  const isProjectType = ['builder', 'architect', 'contractor'].includes(customerType);

  const columns = [
    {
      title: 'Code', dataIndex: 'customerCode', key: 'code', width: 100,
      render: v => <span className="text-xs font-mono text-blue-600">{v}</span>,
    },
    {
      title: 'Name', dataIndex: 'name', key: 'name', width: 160,
      render: v => <span className="text-sm font-medium">{v}</span>,
    },
    {
      title: 'Type', dataIndex: 'customerType', key: 'type', width: 110,
      render: v => <Tag color={getTypeColor(v)}>{v?.replace('_', ' ')}</Tag>,
    },
    { title: 'Contact', dataIndex: 'contactNumber', key: 'contact', width: 120 },
    { title: 'Email', dataIndex: 'email', key: 'email', width: 160, render: v => <span className="text-xs">{v || '-'}</span> },
    { title: 'City', dataIndex: 'city', key: 'city', width: 100 },
    {
      title: 'Source', dataIndex: 'source', key: 'source', width: 110,
      render: v => v ? <Tag>{v.replace('_', ' ')}</Tag> : '-',
    },
    { title: 'Assigned SE', key: 'se', width: 120, render: (_, r) => r.assignedSalesExecutive?.name || '-' },
    {
      title: 'Outstanding', dataIndex: 'currentOutstanding', key: 'outstanding', width: 110,
      render: v => <span className={`text-sm font-medium ${(v || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(v || 0).toLocaleString()}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 80,
      render: s => <Tag color={s === 'active' ? 'green' : s === 'blocked' ? 'red' : 'orange'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          <DoubleConfirmDelete
            title="Delete Customer"
            recordName={record.name}
            onConfirm={() => handleDelete(record._id)}
            trigger={<Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>}
          />
        </Space>
      ),
    },
  ];


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Customer Master</h1>
        <Space>
          <ModuleRecycleBin module="customer" title="Deleted Customers" onRestore={fetchCustomers} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()}>Add Customer</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Total" value={stats.total} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Retail" value={stats.retail} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Builder" value={stats.builder} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Architect" value={stats.architect} valueStyle={{ color: '#722ed1' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Contractor" value={stats.contractor} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search name, phone, code..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
          className="w-64"
          allowClear
        />
        <Select
          placeholder="Customer Type"
          value={filters.customerType}
          onChange={v => { setFilters(f => ({ ...f, customerType: v })); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear
          className="w-40"
        >
          {CUSTOMER_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
        </Select>
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={v => { setFilters(f => ({ ...f, status: v })); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear
          className="w-32"
        >
          {STATUS_OPTIONS.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
        </Select>
        <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ customerType: undefined, status: undefined }); }}>Reset</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <Table
          dataSource={customers}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scroll={{ x: 1200 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} customers`,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
          }}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingCustomer(null); }}
        onOk={handleSave}
        okText={editingCustomer ? 'Update' : 'Create'}
        width={720}
        confirmLoading={loading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="customerType" label="Customer Type" rules={[{ required: true }]}>
                <Select onChange={v => setCustomerType(v)}>
                  {CUSTOMER_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="contactNumber" label="Contact Number" rules={[{ required: true, message: 'Contact is required' }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="whatsappNumber" label="WhatsApp Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="email" label="Email">
                <Input type="email" />
              </Form.Item>
            </Col>
          </Row>

          {isNonRetail && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="gstin" label="GSTIN">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="pan" label="PAN">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="billingAddress" label="Billing Address">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="deliveryAddress" label="Delivery Address">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="city" label="City">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="state" label="State">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="pinCode" label="Pin Code">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="source" label="Source">
                <Select allowClear placeholder="Select source">
                  {SOURCE_OPTIONS.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="assignedSalesExecutive" label="Assigned Sales Executive">
                <Input placeholder="SE name or ID" />
              </Form.Item>
            </Col>
          </Row>
          {isNonRetail && (
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="creditLimit" label="Credit Limit (₹)">
                  <InputNumber min={0} className="w-full" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="creditDays" label="Credit Days">
                  <InputNumber min={0} max={365} className="w-full" />
                </Form.Item>
              </Col>
            </Row>
          )}
          {isProjectType && (
            <Row gutter={16}>
              <Col span={8}>
                <Form.Item name="projectName" label="Project Name">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="projectLocation" label="Project Location">
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="projectDetails" label="Project Details">
                  <Input />
                </Form.Item>
              </Col>
            </Row>
          )}
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item name="remarks" label="Remarks">
                <TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomerMaster;
