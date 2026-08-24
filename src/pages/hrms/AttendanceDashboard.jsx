import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Form, DatePicker, Card, Statistic, Row, Col, message, TimePicker } from 'antd';
import { SearchOutlined, ReloadOutlined, PlusOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const AttendanceDashboard = () => {
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({ present: 0, absent: 0, late: 0, onLeave: 0, total: 0 });

  // Mark attendance modal
  const [markModal, setMarkModal] = useState(false);
  const [markForm] = Form.useForm();
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    fetchEmployeeList();
  }, []);

  const fetchEmployeeList = async () => {
    try {
      const res = await hrmsService.getEmployees({ limit: 200, status: 'active' });
      const data = res.data || [];
      setEmployees(Array.isArray(data) ? data : []);
    } catch {}
  };

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const params = { date: selectedDate.format('YYYY-MM-DD'), search, status: statusFilter };
      const res = await hrmsService.getAttendance(params);
      const data = res.data || [];
      setAttendance(Array.isArray(data) ? data : []);

      // Calculate stats
      const records = Array.isArray(data) ? data : [];
      const present = records.filter(r => r.status === 'Present').length;
      const absent = records.filter(r => r.status === 'Absent').length;
      const late = records.filter(r => r.status === 'Late').length;
      const onLeave = records.filter(r => r.status === 'Leave' || r.status === 'On Duty').length;
      setStats({ present, absent, late, onLeave, total: records.length });
    } catch (err) { message.error(err.message || 'Failed to fetch attendance'); }
    finally { setLoading(false); }
  }, [selectedDate, search, statusFilter]);

  useEffect(() => { fetchAttendance(); }, [fetchAttendance]);

  const handleMarkAttendance = async () => {
    try {
      const values = await markForm.validateFields();
      const payload = {
        employee: values.employeeId,
        date: values.date.format('YYYY-MM-DD'),
        status: values.status,
        punchIn: values.punchIn ? values.punchIn.format('HH:mm') : null,
        punchOut: values.punchOut ? values.punchOut.format('HH:mm') : null,
      };
      const res = await hrmsService.markAttendance(payload);
      if (res.success) {
        message.success('Attendance marked successfully');
        setMarkModal(false);
        markForm.resetFields();
        fetchAttendance();
      } else {
        message.error(res.message || 'Failed');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed');
    }
  };

  const getStatusTag = (status) => {
    const map = {
      Present: { color: 'green', label: 'Present' },
      Absent: { color: 'red', label: 'Absent' },
      Late: { color: 'orange', label: 'Late' },
      Leave: { color: 'blue', label: 'On Leave' },
      'On Duty': { color: 'cyan', label: 'On Duty' },
      'Half Day': { color: 'gold', label: 'Half Day' },
      'Week Off': { color: 'default', label: 'Week Off' },
    };
    const info = map[status] || { color: 'default', label: status };
    return <Tag color={info.color}>{info.label}</Tag>;
  };

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 200,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{r.employee?.name || '-'}</div>
          <span className="text-xs text-gray-400">{r.employee?.empId || ''} · {r.employee?.department || ''}</span>
        </div>
      ),
    },
    { title: 'Department', key: 'department', width: 120, render: (_, r) => <span className="text-sm">{r.employee?.department || '-'}</span> },
    { title: 'Punch In', dataIndex: 'punchIn', key: 'punchIn', width: 100, render: v => v ? <span className="text-sm text-green-600 font-medium">{v}</span> : <span className="text-gray-400">—</span> },
    { title: 'Punch Out', dataIndex: 'punchOut', key: 'punchOut', width: 100, render: v => v ? <span className="text-sm text-red-500 font-medium">{v}</span> : <span className="text-gray-400">—</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: s => getStatusTag(s) },
    {
      title: 'Total Hours', key: 'hours', width: 100,
      render: (_, r) => {
        if (r.totalHours) return <span className="text-sm font-medium">{r.totalHours}h</span>;
        if (r.punchIn && r.punchOut) {
          const diffMs = dayjs(`2024-01-01 ${r.punchOut}`) - dayjs(`2024-01-01 ${r.punchIn}`);
          const hours = (diffMs / (1000 * 60 * 60)).toFixed(1);
          return <span className="text-sm font-medium">{hours}h</span>;
        }
        return <span className="text-gray-400">—</span>;
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Attendance Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor daily attendance & punch records</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setMarkModal(true)} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Mark Attendance
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={5}><Card size="small"><Statistic title="Total" value={stats.total} prefix={<CalendarOutlined />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Present" value={stats.present} valueStyle={{ color: '#22c55e' }} prefix={<CheckCircleOutlined />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Absent" value={stats.absent} valueStyle={{ color: '#ef4444' }} prefix={<CloseCircleOutlined />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Late" value={stats.late} valueStyle={{ color: '#f59e0b' }} prefix={<ClockCircleOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="On Leave" value={stats.onLeave} valueStyle={{ color: '#3b82f6' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <DatePicker value={selectedDate} onChange={d => setSelectedDate(d || dayjs())} format="DD/MM/YYYY" allowClear={false} className="w-40" />
          <Input placeholder="Search employee..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-60" allowClear />
          <Select placeholder="Status" options={[
            { value: 'Present', label: 'Present' }, { value: 'Absent', label: 'Absent' },
            { value: 'Late', label: 'Late' }, { value: 'Leave', label: 'On Leave' },
          ]} value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={attendance} rowKey={r => r._id || r.employeeId || Math.random()} loading={loading} size="middle" scroll={{ x: 800 }}
          pagination={{ pageSize: 50, showTotal: (t) => `${t} records` }} />
      </div>

      {/* Mark Attendance Modal */}
      <Modal title="Mark Attendance" open={markModal} onCancel={() => { setMarkModal(false); markForm.resetFields(); }}
        onOk={handleMarkAttendance} okText="Mark" okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}>
        <Form form={markForm} layout="vertical" className="mt-4">
          <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select employee' }]}>
            <Select placeholder="Select employee" showSearch optionFilterProp="label"
              options={employees.map(e => ({ value: e._id, label: `${e.name} (${e.empId || ''})` }))} />
          </Form.Item>
          <Form.Item name="date" label="Date" rules={[{ required: true }]} initialValue={dayjs()}>
            <DatePicker className="w-full" format="DD/MM/YYYY" />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true }]}>
            <Select placeholder="Select status" options={[
              { value: 'Present', label: 'Present' }, { value: 'Absent', label: 'Absent' },
              { value: 'Late', label: 'Late' }, { value: 'Half Day', label: 'Half Day' }, { value: 'Leave', label: 'On Leave' },
            ]} />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="punchIn" label="Punch In Time">
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="punchOut" label="Punch Out Time">
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default AttendanceDashboard;
