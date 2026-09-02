import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Modal, message, Tooltip, Row, Col, Card, Statistic, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined, CheckOutlined, CloseOutlined, DollarOutlined, ReloadOutlined, ExclamationCircleOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import dayjs from 'dayjs';

const { Option } = Select;
const { TextArea } = Input;
const { RangePicker } = DatePicker;

const CATEGORY_OPTIONS = [
  { value: 'travel', label: 'Travel' },
  { value: 'fuel', label: 'Fuel' },
  { value: 'phone', label: 'Phone' },
  { value: 'lodging', label: 'Lodging' },
  { value: 'food', label: 'Food' },
  { value: 'office', label: 'Office' },
  { value: 'loading', label: 'Loading' },
  { value: 'unloading', label: 'Unloading' },
  { value: 'vehicle_repair', label: 'Vehicle Repair' },
  { value: 'warehouse', label: 'Warehouse' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'staff_welfare', label: 'Staff Welfare' },
  { value: 'courier', label: 'Courier' },
  { value: 'miscellaneous', label: 'Miscellaneous' },
];

const STATUS_COLORS = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  reimbursed: 'blue',
  cancelled: 'default',
};

const ExpenseManagement = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, category: undefined });
  const [dateRange, setDateRange] = useState(null);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0, reimbursed: 0, pendingAmount: 0, totalApproved: 0 });
  const [employees, setEmployees] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form] = Form.useForm();

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/expenses/stats');
      if (res.success) setStats(res.data);
    } catch { /* ignore */ }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/hrms/employees', { params: { limit: 200 } });
      if (res.success) setEmployees(res.data || []);
    } catch { /* ignore */ }
  }, []);

  const fetchExpenses = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: search || undefined,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      };
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.dateFrom = dateRange[0].format('YYYY-MM-DD');
        params.dateTo = dateRange[1].format('YYYY-MM-DD');
      }
      const res = await api.get('/expenses', { params });
      if (res.success) {
        setExpenses(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch expenses');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, filters, dateRange]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);
  useEffect(() => { fetchStats(); fetchEmployees(); }, [fetchStats, fetchEmployees]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (values.expenseDate) values.expenseDate = values.expenseDate.format('YYYY-MM-DD');
      setLoading(true);
      const res = await api.post('/expenses', values);
      if (res.success) {
        message.success('Expense submitted');
        setModalOpen(false);
        form.resetFields();
        fetchExpenses();
        fetchStats();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Submit failed');
    } finally {
      setLoading(false);
    }
  };

  const openView = async record => {
    try {
      const res = await api.get(`/expenses/${record._id}`);
      if (res.success) setViewExpense(res.data);
    } catch (err) { message.error(err.message || 'Unable to load expense details'); }
  };

  const handleApprove = async (id) => {
    try {
      const res = await api.patch(`/expenses/${id}/approve`);
      if (res.success) { message.success('Approved'); fetchExpenses(); fetchStats(); }
    } catch (err) { message.error(err.message || 'Approval failed'); }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) { message.error('Reason is required'); return; }
    try {
      const res = await api.patch(`/expenses/${rejectingId}/reject`, { reason: rejectReason });
      if (res.success) {
        message.success('Rejected');
        setRejectModalOpen(false);
        setRejectingId(null);
        setRejectReason('');
        fetchExpenses();
        fetchStats();
      }
    } catch (err) { message.error(err.message || 'Reject failed'); }
  };

  const handleReimburse = async (id) => {
    try {
      const res = await api.patch(`/expenses/${id}/reimburse`, { ref: `REIMB-${Date.now()}` });
      if (res.success) { message.success('Reimbursed'); fetchExpenses(); fetchStats(); }
    } catch (err) { message.error(err.message || 'Reimburse failed'); }
  };

  const columns = [
    {
      title: 'Expense #', dataIndex: 'expenseNumber', key: 'num', width: 120,
      render: v => <span className="text-xs font-mono text-blue-600">{v}</span>,
    },
    { title: 'Employee', dataIndex: 'employeeName', key: 'emp', width: 140 },
    { title: 'Department', dataIndex: 'department', key: 'dept', width: 110 },
    {
      title: 'Category', dataIndex: 'category', key: 'cat', width: 120,
      render: v => <Tag>{v?.replace('_', ' ')}</Tag>,
    },
    {
      title: 'Amount', dataIndex: 'amount', key: 'amount', width: 100,
      render: v => <span className="text-sm font-medium">₹{(v || 0).toLocaleString()}</span>,
    },
    {
      title: 'Date', dataIndex: 'expenseDate', key: 'date', width: 100,
      render: v => v ? dayjs(v).format('DD/MM/YYYY') : '-',
    },
    {
      title: 'Description', dataIndex: 'description', key: 'desc', width: 180,
      render: v => <span className="text-xs text-gray-600 truncate block max-w-[170px]">{v || '-'}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: s => <Tag color={STATUS_COLORS[s] || 'default'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 160, fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => openView(record)} />
          </Tooltip>
          {record.status === 'pending' && (
            <>
              <Tooltip title="Approve">
                <Button type="text" size="small" style={{ color: '#52c41a' }} icon={<CheckOutlined />} onClick={() => handleApprove(record._id)} />
              </Tooltip>
              <Tooltip title="Reject">
                <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => { setRejectingId(record._id); setRejectModalOpen(true); }} />
              </Tooltip>
            </>
          )}
          {record.status === 'approved' && (
            <Tooltip title="Reimburse">
              <Button type="text" size="small" style={{ color: '#1890ff' }} icon={<DollarOutlined />} onClick={() => handleReimburse(record._id)} />
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
        <h1 className="text-2xl font-bold text-gray-800">Expense Management</h1>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Submit Expense</Button>
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Total" value={stats.total} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Approved" value={stats.approved} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Rejected" value={stats.rejected} valueStyle={{ color: '#f5222d' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Reimbursed" value={stats.reimbursed} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Pending ₹" value={stats.pendingAmount} prefix="₹" valueStyle={{ color: '#fa8c16' }} /></Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" className="text-center"><Statistic title="Total Approved ₹" value={stats.totalApproved} prefix="₹" valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search expense #, employee..."
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
          className="w-64"
          allowClear
        />
        <Select
          placeholder="Status"
          value={filters.status}
          onChange={v => { setFilters(f => ({ ...f, status: v })); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear className="w-36"
        >
          {Object.keys(STATUS_COLORS).map(s => <Option key={s} value={s}>{s}</Option>)}
        </Select>
        <Select
          placeholder="Category"
          value={filters.category}
          onChange={v => { setFilters(f => ({ ...f, category: v })); setPagination(p => ({ ...p, current: 1 })); }}
          allowClear className="w-40"
        >
          {CATEGORY_OPTIONS.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
        </Select>
        <RangePicker
          value={dateRange}
          onChange={v => { setDateRange(v); setPagination(p => ({ ...p, current: 1 })); }}
          format="DD/MM/YYYY"
        />
        <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ status: undefined, category: undefined }); setDateRange(null); }}>Reset</Button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <Table
          dataSource={expenses}
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
            showTotal: (total) => `Total ${total} expenses`,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
          }}
        />
      </div>

      <Modal title={`Expense ${viewExpense?.expenseNumber || ''}`} open={!!viewExpense} onCancel={() => setViewExpense(null)} width={760} footer={<Button onClick={() => setViewExpense(null)}>Close</Button>}>
        {viewExpense && <div className="space-y-4 mt-3 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 border rounded-lg p-4">
            <div><div className="text-xs text-gray-400">Employee</div><b>{viewExpense.employeeName || viewExpense.employee?.name || '—'}</b></div>
            <div><div className="text-xs text-gray-400">Department</div><b>{viewExpense.department || viewExpense.employee?.department || '—'}</b></div>
            <div><div className="text-xs text-gray-400">Status</div><Tag color={STATUS_COLORS[viewExpense.status]}>{viewExpense.status}</Tag></div>
            <div><div className="text-xs text-gray-400">Category</div><b className="capitalize">{viewExpense.category?.replace(/_/g, ' ')}</b></div>
            <div><div className="text-xs text-gray-400">Amount</div><b className="text-base">₹{Number(viewExpense.amount || 0).toLocaleString('en-IN')}</b></div>
            <div><div className="text-xs text-gray-400">Expense Date</div><b>{dayjs(viewExpense.expenseDate).format('DD/MM/YYYY')}</b></div>
          </div>
          <div><div className="text-xs text-gray-400">Description</div><div>{viewExpense.description || '—'}</div></div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-gray-400">Dealer Ref:</span> <b>{viewExpense.dealerRef || '—'}</b></div>
            <div><span className="text-gray-400">Trip Ref:</span> <b>{viewExpense.tripRef || '—'}</b></div>
            <div><span className="text-gray-400">Approved By:</span> <b>{viewExpense.approvedBy?.name || '—'}</b></div>
            <div><span className="text-gray-400">Approved At:</span> <b>{viewExpense.approvedAt ? dayjs(viewExpense.approvedAt).format('DD/MM/YYYY HH:mm') : '—'}</b></div>
            <div><span className="text-gray-400">Reimbursement Ref:</span> <b>{viewExpense.reimbursementRef || '—'}</b></div>
            <div><span className="text-gray-400">Reimbursed At:</span> <b>{viewExpense.reimbursementDate ? dayjs(viewExpense.reimbursementDate).format('DD/MM/YYYY HH:mm') : '—'}</b></div>
          </div>
          {(viewExpense.billUpload?.length > 0 || viewExpense.photoUpload?.length > 0) && <div>
            <div className="text-xs font-semibold text-gray-500 mb-2">Evidence</div>
            <div className="flex flex-wrap gap-2">{[...(viewExpense.billUpload || []), ...(viewExpense.photoUpload || [])].map((src, index) => <ProductImage key={`${src}-${index}`} src={src} size="xl" />)}</div>
          </div>}
          {viewExpense.rejectionReason && <div className="bg-red-50 border border-red-100 text-red-700 rounded p-3"><b>Rejection:</b> {viewExpense.rejectionReason}</div>}
          {viewExpense.remarks && <div className="bg-yellow-50 border border-yellow-100 rounded p-3"><b>Remarks:</b> {viewExpense.remarks}</div>}
        </div>}
      </Modal>

      {/* Submit Expense Modal */}
      <Modal
        title="Submit Expense"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); }}
        onOk={handleSubmit}
        okText="Submit"
        width={600}
        confirmLoading={loading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="employee" label="Employee" rules={[{ required: true }]}>
                <Select showSearch placeholder="Select employee" optionFilterProp="children" allowClear>
                  {employees.map(e => <Option key={e._id} value={e._id}>{e.name || e.employeeName}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select placeholder="Select category">
                  {CATEGORY_OPTIONS.map(c => <Option key={c.value} value={c.value}>{c.label}</Option>)}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true }]}>
                <InputNumber min={0} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="expenseDate" label="Expense Date" rules={[{ required: true }]}>
                <DatePicker className="w-full" format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description" rules={[{ required: true, message: 'Description is required' }]}>
            <TextArea rows={3} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="dealerRef" label="Dealer Reference">
                <Input placeholder="Related dealer (optional)" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="tripRef" label="Trip Reference">
                <Input placeholder="Related trip (optional)" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal
        title={<span className="flex items-center gap-2 text-red-600"><ExclamationCircleOutlined /> Reject Expense</span>}
        open={rejectModalOpen}
        onCancel={() => { setRejectModalOpen(false); setRejectingId(null); setRejectReason(''); }}
        onOk={handleReject}
        okText="Reject"
        okButtonProps={{ danger: true }}
        destroyOnHidden
      >
        <div className="py-2">
          <label className="text-sm text-gray-600 block mb-2">Reason for rejection *</label>
          <TextArea
            rows={3}
            value={rejectReason}
            onChange={e => setRejectReason(e.target.value)}
            placeholder="Enter reason for rejecting this expense..."
          />
        </div>
      </Modal>
    </div>
  );
};

export default ExpenseManagement;
