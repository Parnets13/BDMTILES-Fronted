import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Modal, Form, InputNumber, Card, Statistic, Row, Col, message, DatePicker } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined, DollarOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const LOAN_TYPES = ['Loan', 'Advance'];
const LOAN_STATUSES = ['Active', 'Completed', 'Cancelled'];

const LoansAdvances = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, totalAmount: 0 });
  const [createModal, setCreateModal] = useState(false);
  const [createForm] = Form.useForm();
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    hrmsService.getAllActiveEmployees()
      .then(res => setEmployees(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await hrmsService.getLoans({ search, type: typeFilter, status: statusFilter, limit: 100 });
      const records = Array.isArray(res.data) ? res.data : [];
      setLoans(records);
      setStats({
        total: records.length,
        active: records.filter(record => record.status === 'Active').length,
        completed: records.filter(record => record.status === 'Completed').length,
        totalAmount: records.reduce((sum, record) => sum + (record.amount || 0), 0),
      });
    } catch (err) { message.error(err.message || 'Failed to fetch loans'); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const handleCreateLoan = async () => {
    try {
      const values = await createForm.validateFields();
      const payload = {
        ...values,
        sanctionedDate: values.sanctionedDate?.format('YYYY-MM-DD'),
      };
      const res = await hrmsService.createLoan(payload);
      if (res.success) {
        message.success('Loan/Advance created successfully');
        setCreateModal(false);
        createForm.resetFields();
        fetchLoans();
      }
    } catch (err) {
      if (!err.errorFields) message.error(err.message || 'Failed');
    }
  };

  const getStatusTag = status => {
    const colors = { Active: 'blue', Completed: 'green', Cancelled: 'red' };
    return <Tag color={colors[status] || 'default'}>{status || 'Active'}</Tag>;
  };

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 180,
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{record.employee?.name || '-'}</div>
          <span className="text-xs text-gray-400">{record.employee?.empId || ''} · {record.employee?.department || ''}</span>
        </div>
      ),
    },
    { title: 'Type', dataIndex: 'type', width: 100,
      render: value => <Tag color={value === 'Advance' ? 'purple' : 'cyan'}>{value}</Tag> },
    { title: 'Amount', dataIndex: 'amount', width: 110, render: value => <span className="text-sm font-medium">₹{(value || 0).toLocaleString()}</span> },
    { title: 'EMI', dataIndex: 'emiAmount', width: 100, render: value => <span className="text-sm">₹{(value || 0).toLocaleString()}</span> },
    { title: 'Remaining', dataIndex: 'remainingAmount', width: 110,
      render: value => <span className="text-sm text-red-500 font-medium">₹{(value || 0).toLocaleString()}</span> },
    { title: 'Installments', dataIndex: 'totalInstallments', width: 100 },
    { title: 'Sanctioned', dataIndex: 'sanctionedDate', width: 105,
      render: value => value ? dayjs(value).format('DD/MM/YY') : '-' },
    { title: 'Status', dataIndex: 'status', width: 100, render: getStatusTag },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Loans & Advances</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employee loans and salary advances</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => {
          createForm.setFieldsValue({ type: 'Loan', totalInstallments: 1, sanctionedDate: dayjs() });
          setCreateModal(true);
        }} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          New Loan / Advance
        </Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Loans" value={stats.total} prefix={<DollarOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Completed" value={stats.completed} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Disbursed" value={`₹${stats.totalAmount.toLocaleString()}`} valueStyle={{ color: '#FF5F03' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Search employee, ID, department..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={event => setSearch(event.target.value)} className="w-64" allowClear />
          <Select placeholder="Type" options={LOAN_TYPES.map(type => ({ value: type, label: type }))}
            value={typeFilter} onChange={setTypeFilter} allowClear className="w-32" />
          <Select placeholder="Status" options={LOAN_STATUSES.map(status => ({ value: status, label: status }))}
            value={statusFilter} onChange={setStatusFilter} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTypeFilter(undefined); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={loans} rowKey="_id" loading={loading} size="middle" scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showTotal: total => `${total} loans/advances` }} />
      </div>

      <Modal title="New Loan / Advance" open={createModal} onCancel={() => { setCreateModal(false); createForm.resetFields(); }}
        onOk={handleCreateLoan} okText="Create" okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }} width={520}>
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item name="employee" label="Employee" rules={[{ required: true, message: 'Select employee' }]}>
            <Select placeholder="Select employee" showSearch optionFilterProp="label"
              options={employees.map(employee => ({ value: employee._id, label: `${employee.name} (${employee.empId || ''})` }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="type" label="Type" rules={[{ required: true }]}>
              <Select options={LOAN_TYPES.map(type => ({ value: type, label: type }))} />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="sanctionedDate" label="Sanctioned Date" rules={[{ required: true }]}>
              <DatePicker className="w-full" format="DD/MM/YYYY" />
            </Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}><Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
              <InputNumber min={0.01} className="w-full" placeholder="Amount" />
            </Form.Item></Col>
            <Col span={12}><Form.Item name="totalInstallments" label="Total Installments" rules={[{ required: true }]}>
              <InputNumber min={1} precision={0} className="w-full" />
            </Form.Item></Col>
          </Row>
          <Form.Item name="emiAmount" label="EMI Amount (₹) (optional)">
            <InputNumber min={0.01} className="w-full" placeholder="Enter an agreed EMI amount" />
          </Form.Item>
          <Form.Item name="reason" label="Purpose / Reason">
            <Input.TextArea rows={2} placeholder="Reason for loan/advance" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LoansAdvances;
