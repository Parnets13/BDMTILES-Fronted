import { useCallback, useEffect, useState } from 'react';
import {
  Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select,
  Space, Statistic, Table, Tag, message,
} from 'antd';
import {
  BankOutlined, DeleteOutlined, EditOutlined, PlusOutlined,
  ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATES = [
  ['29', 'Karnataka'], ['27', 'Maharashtra'], ['24', 'Gujarat'], ['33', 'Tamil Nadu'],
  ['36', 'Telangana'], ['32', 'Kerala'], ['37', 'Andhra Pradesh'], ['07', 'Delhi'],
  ['09', 'Uttar Pradesh'], ['08', 'Rajasthan'], ['23', 'Madhya Pradesh'], ['19', 'West Bengal'],
];

const initialValues = {
  status: 'active',
  fiscalYearStartMonth: 4,
  timezone: 'Asia/Kolkata',
};

const BranchPage = () => {
  const { refreshUser } = useAuth();
  const [form] = Form.useForm();
  const [branches, setBranches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(undefined);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await masterService.getBranches({ page, limit: pageSize, search, status });
      if (response.success) {
        setBranches(response.data || []);
        setPagination({
          current: response.pagination?.currentPage || page,
          pageSize,
          total: response.pagination?.totalItems || 0,
        });
      }
    } catch (error) {
      message.error(error.message || 'Failed to load branches');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  const showCreate = () => {
    setEditing(null);
    form.setFieldsValue(initialValues);
    setOpen(true);
  };

  const showEdit = async (record) => {
    setEditing(record);
    try {
      const response = await masterService.getBranch(record._id);
      const branch = response.data || record;
      form.setFieldsValue({
        ...initialValues,
        ...branch,
        fiscalYearStartMonth: branch.settings?.fiscalYearStartMonth || 4,
        timezone: branch.settings?.timezone || 'Asia/Kolkata',
        invoiceTerms: branch.settings?.invoiceTerms || '',
      });
      setOpen(true);
    } catch (error) {
      message.error(error.message || 'Failed to load branch');
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const { fiscalYearStartMonth, timezone, invoiceTerms, ...branch } = values;
      const payload = { branch: undefined, ...branch, settings: { fiscalYearStartMonth, timezone, invoiceTerms } };
      const response = editing
        ? await masterService.updateBranch(editing._id, payload)
        : await masterService.createBranch(payload);
      if (response.success) {
        message.success(editing ? 'Branch updated' : 'Branch created');
        setOpen(false);
        form.resetFields();
        await refreshUser();
        await load(editing ? pagination.current : 1, pagination.pageSize);
      }
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save branch');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      const response = await masterService.deleteBranch(id);
      if (response.success) {
        message.success('Branch deleted');
        await refreshUser();
        load(1, pagination.pageSize);
      }
    } catch (error) {
      message.error(error.message || 'Failed to delete branch');
    }
  };

  const columns = [
    {
      title: 'Branch',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-800">{record.name}</div>
          <div className="text-xs font-mono text-gray-500">{record.branchCode}</div>
        </div>
      ),
    },
    { title: 'Legal Name', dataIndex: 'legalName', render: (value) => value || '—' },
    { title: 'Location', render: (_, record) => [record.city, record.state].filter(Boolean).join(', ') || '—' },
    { title: 'GSTIN', dataIndex: 'gstin', render: (value) => value || '—' },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (value) => <Tag color={value === 'active' ? 'green' : 'default'}>{value?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions', width: 110,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EditOutlined />} onClick={() => showEdit(record)} />
          <Popconfirm title="Delete this branch?" description="Referenced branches must be deactivated instead." onConfirm={() => remove(record._id)}>
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <BankOutlined className="text-[#FF5F03] text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Branch Master</h1>
            <p className="text-sm text-gray-500">Business identities, GST details, fiscal settings, and numbering</p>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={showCreate}>Add Branch</Button>
      </div>

      <Row gutter={16} className="mb-5">
        <Col span={8}><Card size="small"><Statistic title="Total Branches" value={pagination.total} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Active on this page" value={branches.filter((item) => item.status === 'active').length} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Inactive on this page" value={branches.filter((item) => item.status === 'inactive').length} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <Input className="w-72" prefix={<SearchOutlined />} placeholder="Search name, code, GSTIN, city" value={search} onChange={(event) => setSearch(event.target.value)} allowClear />
          <Select className="w-40" placeholder="All statuses" value={status} onChange={setStatus} allowClear options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => load(1, pagination.pageSize)}>Refresh</Button>
        </div>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={branches}
          loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (total) => `${total} branches` }}
          onChange={(next) => load(next.current, next.pageSize)}
        />
      </div>

      <Modal title={editing ? 'Edit Branch' : 'Add Branch'} open={open} onCancel={() => setOpen(false)} onOk={save} confirmLoading={saving} width={760} destroyOnHidden>
        <Form form={form} layout="vertical" initialValues={initialValues} className="mt-4">
          <Row gutter={16}>
            <Col span={8}><Form.Item name="branchCode" label="Branch Code" rules={[{ required: true }]}><Input placeholder="BLR" /></Form.Item></Col>
            <Col span={16}><Form.Item name="name" label="Branch Name" rules={[{ required: true }]}><Input placeholder="Bengaluru Branch" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={16}><Form.Item name="legalName" label="Legal / Seller Name"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="status" label="Status"><Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="gstin" label="GSTIN"><Input maxLength={15} /></Form.Item></Col>
            <Col span={12}><Form.Item name="pan" label="PAN"><Input maxLength={10} /></Form.Item></Col>
          </Row>
          <Form.Item name="address" label="Address"><Input.TextArea rows={2} /></Form.Item>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
            <Col span={10}><Form.Item name="state" label="State"><Select showSearch allowClear options={STATES.map(([code, name]) => ({ value: name, label: name }))} onChange={(value) => form.setFieldValue('stateCode', STATES.find(([, name]) => name === value)?.[0] || '')} /></Form.Item></Col>
            <Col span={6}><Form.Item name="stateCode" label="State Code"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="pinCode" label="PIN Code"><Input maxLength={6} /></Form.Item></Col>
            <Col span={8}><Form.Item name="phone" label="Phone"><Input /></Form.Item></Col>
            <Col span={8}><Form.Item name="email" label="Email" rules={[{ type: 'email' }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="fiscalYearStartMonth" label="Fiscal Year Start"><Select options={[{ value: 4, label: 'April' }, { value: 1, label: 'January' }]} /></Form.Item></Col>
            <Col span={12}><Form.Item name="timezone" label="Timezone"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="invoiceTerms" label="Default Invoice Terms"><Input.TextArea rows={2} /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BranchPage;
