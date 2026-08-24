import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Form, DatePicker, Card, Statistic, Row, Col, message, Popconfirm } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const LEAVE_TYPES = ['Casual Leave', 'Sick Leave', 'Earned Leave', 'Maternity Leave', 'Paternity Leave', 'Unpaid Leave', 'Compensatory Off'];

const LeaveManagement = () => {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({ total: 0, pending: 0, approved: 0, rejected: 0 });

  // Apply leave modal
  const [applyModal, setApplyModal] = useState(false);
  const [applyForm] = Form.useForm();
  const [employees, setEmployees] = useState([]);

  // Reject reason modal
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchEmployeeList();
  }, []);

  const fetchEmployeeList = async () => {
    try {
      const res = await hrmsService.getEmployees({ limit: 200, status: 'Active' });
      const data = res.data || [];
      setEmployees(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params = { search, status: statusFilter };
      const res = await hrmsService.getLeaves(params);
      const data = res.data || [];
      const records = Array.isArray(data) ? data : [];
      setLeaves(records);

      // Stats
      const pending = records.filter(r => r.status === 'Pending').length;
      const approved = records.filter(r => r.status === 'Approved').length;
      const rejected = records.filter(r => r.status === 'Rejected').length;
      setStats({ total: records.length, pending, approved, rejected });
    } catch (err) { message.error(err.message || 'Failed to fetch leaves'); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  const handleApplyLeave = async () => {
    try {
      const values = await applyForm.validateFields();
      const payload = {
        employee: values.employeeId,
        leaveType: values.leaveType,
        fromDate: values.dateRange[0].format('YYYY-MM-DD'),
        toDate: values.dateRange[1].format('YYYY-MM-DD'),
        reason: values.reason,
      };
      const res = await hrmsService.applyLeave(payload);
      if (res.success) {
        message.success('Leave applied successfully');
        setApplyModal(false);
        applyForm.resetFields();
        fetchLeaves();
      } else {
        message.error(res.message || 'Failed');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed');
    }
  };

  const handleApprove = async (id) => {
    try {
      const res = await hrmsService.approveLeave(id);
      if (res.success) {
        message.success('Leave approved');
        fetchLeaves();
      }
    } catch (err) { message.error(err.message || 'Failed'); }
  };

  const handleReject = async () => {
    try {
      const res = await hrmsService.rejectLeave(rejectingId, rejectReason);
      if (res.success) {
        message.success('Leave rejected');
        setRejectModal(false);
        setRejectingId(null);
        setRejectReason('');
        fetchLeaves();
      }
    } catch (err) { message.error(err.message || 'Failed'); }
  };

  const getStatusTag = (status) => {
    const map = {
      Pending: { color: 'orange', label: 'Pending' },
      Approved: { color: 'green', label: 'Approved' },
      Rejected: { color: 'red', label: 'Rejected' },
      Cancelled: { color: 'default', label: 'Cancelled' },
    };
    const info = map[status] || { color: 'default', label: status };
    return <Tag color={info.color}>{info.label}</Tag>;
  };

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{r.employee?.name || '-'}</div>
          <span className="text-xs text-gray-400">{r.employee?.department || ''}</span>
        </div>
      ),
    },
    { title: 'Type', dataIndex: 'leaveType', key: 'leaveType', width: 130, render: v => <span className="text-sm">{v}</span> },
    {
      title: 'From - To', key: 'dates', width: 180,
      render: (_, r) => <span className="text-sm">{r.fromDate ? dayjs(r.fromDate).format('DD/MM/YY') : '-'} → {r.toDate ? dayjs(r.toDate).format('DD/MM/YY') : '-'}</span>,
    },
    {
      title: 'Days', key: 'days', width: 60,
      render: (_, r) => {
        if (r.days) return <span className="text-sm font-medium">{r.days}</span>;
        if (r.fromDate && r.toDate) {
          const diff = dayjs(r.toDate).diff(dayjs(r.fromDate), 'day') + 1;
          return <span className="text-sm font-medium">{diff}</span>;
        }
        return '-';
      },
    },
    { title: 'Reason', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true, render: v => <span className="text-sm text-gray-600">{v || '-'}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: s => getStatusTag(s) },
    {
      title: 'Actions', key: 'actions', width: 120, fixed: 'right',
      render: (_, r) => r.status === 'Pending' ? (
        <Space size="small">
          <Popconfirm title="Approve this leave?" onConfirm={() => handleApprove(r._id)}>
            <Button type="text" size="small" icon={<CheckOutlined />} className="text-green-600" />
          </Popconfirm>
          <Button type="text" size="small" icon={<CloseOutlined />} className="text-red-500"
            onClick={() => { setRejectingId(r._id); setRejectModal(true); }} />
        </Space>
      ) : <span className="text-xs text-gray-400">—</span>,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Leave Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage leave applications & approvals</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setApplyModal(true)} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Apply Leave
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Requests" value={stats.total} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Approved" value={stats.approved} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Rejected" value={stats.rejected} valueStyle={{ color: '#ef4444' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Search employee..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-60" allowClear />
          <Select placeholder="Status" options={[
            { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'rejected', label: 'Rejected' },
          ]} value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={leaves} rowKey={r => r._id || Math.random()} loading={loading} size="middle" scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} leave requests` }} />
      </div>

      {/* Apply Leave Modal */}
      <Modal title="Apply Leave" open={applyModal} onCancel={() => { setApplyModal(false); applyForm.resetFields(); }}
        onOk={handleApplyLeave} okText="Submit" okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }} width={500}>
        <Form form={applyForm} layout="vertical" className="mt-4">
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select employee' }]}>
            <Select placeholder="Select employee" showSearch optionFilterProp="label"
              options={employees.map(e => ({ value: e._id, label: e.name }))} />
          </Form.Item>
          <Form.Item name="leaveType" label="Leave Type" rules={[{ required: true }]}>
            <Select placeholder="Select type" options={LEAVE_TYPES.map(t => ({ value: t, label: t }))} />
          </Form.Item>
          <Form.Item name="dateRange" label="From - To Date" rules={[{ required: true, message: 'Select date range' }]}>
            <DatePicker.RangePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="Reason" rules={[{ required: true }]}>
            <Input.TextArea rows={3} placeholder="Enter reason for leave" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Reason Modal */}
      <Modal title="Reject Leave" open={rejectModal} onCancel={() => { setRejectModal(false); setRejectingId(null); setRejectReason(''); }}
        onOk={handleReject} okText="Reject" okButtonProps={{ danger: true }}>
        <div className="mt-4">
          <label className="text-sm font-medium text-gray-700 mb-2 block">Reason for Rejection</label>
          <Input.TextArea rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Enter rejection reason..." />
        </div>
      </Modal>
    </div>
  );
};

export default LeaveManagement;
