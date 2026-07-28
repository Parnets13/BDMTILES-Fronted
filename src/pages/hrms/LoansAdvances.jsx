import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Form, InputNumber, Card, Statistic, Row, Col, message } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined, DollarOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const LOAN_TYPES = ['Personal Loan', 'Salary Advance', 'Emergency Loan', 'Festival Advance', 'Medical Loan'];

const LoansAdvances = () => {
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({ total: 0, active: 0, completed: 0, totalAmount: 0 });

  // Create loan modal
  const [createModal, setCreateModal] = useState(false);
  const [createForm] = Form.useForm();
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchEmployeeList();
  }, []);

  const fetchEmployeeList = async () => {
    try {
      const res = await hrmsService.getEmployees({ limit: 200, status: 'active' });
      const data = res.data?.data || res.data || [];
      setEmployees(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchLoans = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, type: typeFilter, status: statusFilter };
      const res = await hrmsService.getLoans(params);
      const data = res.data?.data || res.data || [];
      const records = Array.isArray(data) ? data : [];
      setLoans(records);

      // Stats
      const active = records.filter(r => r.status === 'active' || r.status === 'ongoing').length;
      const completed = records.filter(r => r.status === 'completed' || r.status === 'closed').length;
      const totalAmount = records.reduce((sum, r) => sum + (r.amount || 0), 0);
      setStats({ total: records.length, active, completed, totalAmount });
    } catch (err) { message.error(err.message || 'Failed to fetch loans'); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { fetchLoans(); }, [fetchLoans]);

  const handleCreateLoan = async () => {
    try {
      const values = await createForm.validateFields();
      const res = await hrmsService.createLoan(values);
      if (res.data?.success !== false) {
        message.success('Loan/Advance created successfully');
        setCreateModal(false);
        createForm.resetFields();
        fetchLoans();
      } else {
        message.error(res.data?.message || 'Failed');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || err.message || 'Failed');
    }
  };

  const getStatusTag = (status) => {
    const map = {
      active: { color: 'blue', label: 'Active' },
      ongoing: { color: 'blue', label: 'Ongoing' },
      completed: { color: 'green', label: 'Completed' },
      closed: { color: 'green', label: 'Closed' },
      pending: { color: 'orange', label: 'Pending' },
      rejected: { color: 'red', label: 'Rejected' },
    };
    const info = map[status] || { color: 'default', label: status || 'Active' };
    return <Tag color={info.color}>{info.label}</Tag>;
  };

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{r.employeeName || (r.employee?.firstName + ' ' + r.employee?.lastName) || '-'}</div>
          <span className="text-xs text-gray-400">{r.department || r.employee?.department || ''}</span>
        </div>
      ),
    },
    {
      title: 'Type', dataIndex: 'loanType', key: 'loanType', width: 140,
      render: v => <Tag color={v?.includes('Advance') ? 'purple' : 'cyan'}>{v || 'Loan'}</Tag>,
    },
    { title: 'Amount', key: 'amount', width: 110, render: (_, r) => <span className="text-sm font-medium">₹{(r.amount || 0).toLocaleString()}</span> },
    { title: 'EMI', key: 'emi', width: 90, render: (_, r) => <span className="text-sm">₹{(r.emi || r.emiAmount || 0).toLocaleString()}</span> },
    {
      title: 'Remaining', key: 'remaining', width: 110,
      render: (_, r) => <span className="text-sm text-red-500 font-medium">₹{(r.remaining || r.balance || 0).toLocaleString()}</span>,
    },
    {
      title: 'Tenure', key: 'tenure', width: 80,
      render: (_, r) => <span className="text-sm">{r.tenure || r.months || '-'} months</span>,
    },
    {
      title: 'Start Date', key: 'startDate', width: 100,
      render: (_, r) => <span className="text-sm">{r.startDate ? dayjs(r.startDate).format('DD/MM/YY') : '-'}</span>,
    },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: s => getStatusTag(s) },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Loans & Advances</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employee loans & salary advances</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModal(true)} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          New Loan / Advance
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Loans" value={stats.total} prefix={<DollarOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Completed" value={stats.completed} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Disbursed" value={`₹${stats.totalAmount.toLocaleString()}`} valueStyle={{ color: '#FF5F03' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Search employee..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-60" allowClear />
          <Select placeholder="Type" options={LOAN_TYPES.map(t => ({ value: t, label: t }))} 
            value={typeFilter} onChange={v => setTypeFilter(v)} allowClear className="w-40" />
          <Select placeholder="Status" options={[
            { value: 'active', label: 'Active' }, { value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' },
          ]} value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTypeFilter(undefined); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={loans} rowKey={r => r._id || Math.random()} loading={loading} size="middle" scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} loans/advances` }} />
      </div>

      {/* Create Loan Modal */}
      <Modal title="New Loan / Advance" open={createModal} onCancel={() => { setCreateModal(false); createForm.resetFields(); }}
        onOk={handleCreateLoan} okText="Create" okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }} width={500}>
        <Form form={createForm} layout="vertical" className="mt-4">
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select employee' }]}>
            <Select placeholder="Select employee" showSearch optionFilterProp="label"
              options={employees.map(e => ({ value: e._id, label: `${e.firstName} ${e.lastName}` }))} />
          </Form.Item>
          <Form.Item name="loanType" label="Type" rules={[{ required: true }]}>
            <Select placeholder="Select type" options={LOAN_TYPES.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                <InputNumber min={1} className="w-full" placeholder="Loan amount" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tenure" label="Tenure (Months)" rules={[{ required: true }]}>
                <InputNumber min={1} max={60} className="w-full" placeholder="No. of months" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="emi" label="EMI Amount (₹)">
            <InputNumber min={0} className="w-full" placeholder="Auto-calculated if empty" />
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
