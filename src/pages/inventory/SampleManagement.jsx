import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Modal, message, Tooltip, Row, Col, Card, Statistic, DatePicker, Checkbox } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, RollbackOutlined, ExperimentOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;

const STATUS_OPTIONS = [
  { value: 'issued', label: 'Issued', color: 'blue' },
  { value: 'with_customer', label: 'With Customer', color: 'orange' },
  { value: 'returned', label: 'Returned', color: 'green' },
  { value: 'damaged', label: 'Damaged', color: 'red' },
  { value: 'lost', label: 'Lost', color: 'volcano' },
];

const ISSUED_TO_TYPES = [
  { value: 'dealer', label: 'Dealer' },
  { value: 'architect', label: 'Architect' },
  { value: 'builder', label: 'Builder' },
  { value: 'customer', label: 'Customer' },
  { value: 'contractor', label: 'Contractor' },
];

const getStatusColor = (status) => {
  const found = STATUS_OPTIONS.find(s => s.value === status);
  return found ? found.color : 'default';
};

const SampleManagement = () => {
  const [samples, setSamples] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({ total: 0, issued: 0, returned: 0, damaged: 0 });

  const [modalOpen, setModalOpen] = useState(false);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [returningId, setReturningId] = useState(null);
  const [returnCondition, setReturnCondition] = useState('good');
  const [returnNotes, setReturnNotes] = useState('');
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [form] = Form.useForm();

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/samples/stats');
      if (res.success) setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchSamples = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      };
      const res = await api.get('/samples', { params });
      if (res.success) {
        setSamples(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch samples');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchSamples(); }, [fetchSamples]);
  useEffect(() => { fetchStats(); }, [fetchStats]);

  const searchProducts = useCallback(async (val) => {
    if (!val || val.length < 2) { setProducts([]); return; }
    try {
      const res = await api.get('/products', { params: { search: val, limit: 20 } });
      if (res.success) setProducts(res.data || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { searchProducts(productSearch); }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, searchProducts]);

  const handleIssue = async () => {
    try {
      const values = await form.validateFields();
      if (values.expectedReturnDate) values.expectedReturnDate = values.expectedReturnDate.format('YYYY-MM-DD');
      setLoading(true);
      const res = await api.post('/samples', values);
      if (res.success) {
        message.success('Sample issued');
        setModalOpen(false);
        form.resetFields();
        fetchSamples();
        fetchStats();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Issue failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReturn = async () => {
    try {
      const res = await api.patch(`/samples/${returningId}/return`, {
        condition: returnCondition,
        damageNotes: returnCondition === 'damaged' ? returnNotes : undefined,
      });
      if (res.success) {
        message.success('Sample marked as returned');
        setReturnModalOpen(false);
        setReturningId(null);
        setReturnCondition('good');
        setReturnNotes('');
        fetchSamples();
        fetchStats();
      }
    } catch (err) {
      message.error(err.message || 'Return failed');
    }
  };

  const columns = [
    {
      title: 'Sample #', dataIndex: 'sampleNumber', key: 'num', width: 120,
      render: v => <span className="text-xs font-mono text-blue-600">{v}</span>,
    },
    { title: 'Product', dataIndex: 'productName', key: 'product', width: 160 },
    {
      title: 'Code', dataIndex: 'productCode', key: 'code', width: 100,
      render: v => <span className="text-xs font-mono">{v || '-'}</span>,
    },
    { title: 'Shade', dataIndex: 'shade', key: 'shade', width: 90 },
    { title: 'Issued To', dataIndex: 'issuedTo', key: 'issuedTo', width: 140 },
    {
      title: 'Type', dataIndex: 'issuedToType', key: 'type', width: 100,
      render: v => v ? <Tag color="geekblue">{v}</Tag> : '-',
    },
    {
      title: 'Issue Date', dataIndex: 'issueDate', key: 'issueDate', width: 100,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Expected Return', dataIndex: 'expectedReturnDate', key: 'expectedReturn', width: 120,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: s => <Tag color={getStatusColor(s)}>{s?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Deposit', dataIndex: 'depositAmount', key: 'deposit', width: 90,
      render: v => v ? `₹${v.toLocaleString()}` : '-',
    },
    {
      title: 'Actions', key: 'actions', width: 120, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          {(record.status === 'issued' || record.status === 'with_customer') && (
            <Tooltip title="Mark Returned">
              <Button
                type="text" size="small" style={{ color: '#52c41a' }}
                icon={<RollbackOutlined />}
                onClick={() => { setReturningId(record._id); setReturnModalOpen(true); }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];


  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">Sample Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Issue Sample</Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={6}>
          <Card size="small" className="text-center"><Statistic title="Total" value={stats.total} prefix={<ExperimentOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small" className="text-center"><Statistic title="Issued / Pending" value={stats.issued} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small" className="text-center"><Statistic title="Returned" value={stats.returned} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={6}>
          <Card size="small" className="text-center"><Statistic title="Damaged" value={stats.damaged} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search sample #, product, issued to..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
          className="w-72"
          allowClear
        />
        <Select
          placeholder="Status"
          value={statusFilter}
          onChange={v => { setStatusFilter(v); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear className="w-40"
        >
          {STATUS_OPTIONS.map(s => <Option key={s.value} value={s.value}>{s.label}</Option>)}
        </Select>
        <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <Table
          dataSource={samples}
          columns={columns}
          rowKey="_id"
          loading={loading}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} samples`,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
          }}
        />
      </div>

      {/* Issue Sample Modal */}
      <Modal
        title="Issue Sample"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleIssue}
        okText="Issue"
        width={640}
        confirmLoading={loading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4 max-h-[60vh] overflow-y-auto pr-2">
          <Row gutter={16}>
            <Col span={16}>
              <Form.Item name="product" label="Product" rules={[{ required: true }]}>
                <Select
                  showSearch
                  placeholder="Search product..."
                  onSearch={v => setProductSearch(v)}
                  filterOption={false}
                  notFoundContent={productSearch.length < 2 ? 'Type to search' : 'No products found'}
                >
                  {products.map(p => (
                    <Option key={p._id} value={p._id}>{p.name} {p.shade ? `- ${p.shade}` : ''}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="shade" label="Shade">
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="batch" label="Batch">
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="quantity" label="Quantity">
                <InputNumber min={1} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="warehouse" label="Warehouse">
                <Input placeholder="Warehouse name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issuedTo" label="Issued To" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="Name of person/company" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="issuedToType" label="Issued To Type" rules={[{ required: true }]}>
                <Select placeholder="Select type">
                  {ISSUED_TO_TYPES.map(t => <Option key={t.value} value={t.value}>{t.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="issuedToContact" label="Contact Number">
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expectedReturnDate" label="Expected Return Date">
                <DatePicker className="w-full" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="depositAmount" label="Deposit Amount (₹)">
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="depositCollected" valuePropName="checked" label=" ">
                <Checkbox>Deposit Collected</Checkbox>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Return Modal */}
      <Modal
        title="Mark Sample Returned"
        open={returnModalOpen}
        onCancel={() => { setReturnModalOpen(false); setReturningId(null); setReturnCondition('good'); setReturnNotes(''); }}
        onOk={handleReturn}
        okText="Confirm Return"
        destroyOnHidden
      >
        <div className="py-2 space-y-4">
          <div>
            <label className="text-sm text-gray-600 block mb-1">Condition</label>
            <Select value={returnCondition} onChange={setReturnCondition} className="w-full">
              <Option value="good">Good</Option>
              <Option value="damaged">Damaged</Option>
            </Select>
          </div>
          {returnCondition === 'damaged' && (
            <div>
              <label className="text-sm text-gray-600 block mb-1">Damage Notes</label>
              <TextArea rows={3} value={returnNotes} onChange={e => setReturnNotes(e.target.value)} placeholder="Describe the damage..." />
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SampleManagement;
