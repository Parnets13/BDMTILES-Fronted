import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, DatePicker, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography } from 'antd';
import { UserOutlined, ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import hrmsService from '../../services/hrmsService';
import userService from '../../services/userService';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const statusColor = { present: 'green', absent: 'red', half_day: 'orange', late: 'gold', holiday: 'blue', leave: 'purple' };

export default function SEAttendanceViewer() {
  const [records, setRecords] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, late: 0 });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 200,
        dateFrom: dateRange[0]?.format('YYYY-MM-DD'),
        dateTo: dateRange[1]?.format('YYYY-MM-DD'),
      };
      if (seFilter !== 'all') params.employee = seFilter;

      const [attRes, usersRes] = await Promise.all([
        hrmsService.getAttendance(params),
        userService.getUsers({ role: 'sales_executive', limit: 100 }),
      ]);

      const rows = attRes?.data || attRes?.attendance || [];
      // Filter to only SE employees if a specific SE list is available
      const seIds = (usersRes?.data || usersRes?.users || []).map(u => u._id);
      const seRows = seFilter !== 'all'
        ? rows
        : rows.filter(r => {
            const empId = typeof r.employee === 'object' ? r.employee?._id : r.employee;
            return seIds.includes(empId) || true; // show all if no linked employee
          });

      setRecords(seRows);
      if (usersRes?.data || usersRes?.users) {
        setSalesExecs(usersRes?.data || usersRes?.users || []);
      }

      // Stats
      const present = seRows.filter(r => r.status === 'present').length;
      const absent = seRows.filter(r => r.status === 'absent').length;
      const late = seRows.filter(r => r.status === 'late').length;
      setStats({ total: seRows.length, present, absent, late });
    } catch (err) {
      console.error('SE Attendance fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [seFilter, dateRange]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: '#', key: 'idx',
      render: (_, __, i) => i + 1,
      width: 50,
    },
    {
      title: 'Employee',
      dataIndex: 'employee',
      key: 'employee',
      render: (emp) => (
        <Space>
          <UserOutlined style={{ color: '#FF5F03' }} />
          <Text strong>{emp?.name || emp?.employeeId || '—'}</Text>
        </Space>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'date',
      key: 'date',
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s?.replace('_', ' ')?.toUpperCase() || '—'}</Tag>,
    },
    {
      title: 'Check In',
      dataIndex: 'checkIn',
      key: 'checkIn',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Check Out',
      dataIndex: 'checkOut',
      key: 'checkOut',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Working Hours',
      dataIndex: 'workingHours',
      key: 'workingHours',
      render: (v) => v ? `${v}h` : <Text type="secondary">—</Text>,
    },
    {
      title: 'Remarks',
      dataIndex: 'remarks',
      key: 'remarks',
      render: (v) => <Text type="secondary">{v || '—'}</Text>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Attendance Viewer</Title>
          <Text type="secondary">Monitor sales executive attendance records</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Records" value={stats.total} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Present" value={stats.present} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Absent" value={stats.absent} prefix={<CloseCircleOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fffbe6', border: '1px solid #faad14' }}>
            <Statistic title="Late" value={stats.late} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} sm={8}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Sales Executive</Text>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }} placeholder="All Executives">
              <Option value="all">All Executives</Option>
              {salesExecs.map(se => (
                <Option key={se._id} value={se._id}>{se.name}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={10}>
            <Text strong style={{ display: 'block', marginBottom: 4 }}>Date Range</Text>
            <RangePicker
              value={dateRange}
              onChange={(v) => v && setDateRange(v)}
              style={{ width: '100%' }}
              format="DD MMM YYYY"
            />
          </Col>
          <Col xs={24} sm={6} style={{ paddingTop: 22 }}>
            <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03' }} onClick={fetchData} block>
              Apply Filters
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={records}
          rowKey={(r) => r._id || Math.random()}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} records` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'No attendance records found for the selected filters.' }}
        />
      </Card>
    </div>
  );
}
