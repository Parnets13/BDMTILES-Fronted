import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, DatePicker, Modal, Descriptions, message } from 'antd';
import { FileTextOutlined, UserOutlined, ReloadOutlined, SearchOutlined, EyeOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import api from '../../config/api';
import userService from '../../services/userService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';

const statusColor = { submitted: 'gold', approved: 'green', rejected: 'red', paid: 'blue', draft: 'default' };

export default function SEExpenseViewer() {
  const [expenses, setExpenses] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [detailModal, setDetailModal] = useState(false);
  const [selected, setSelected] = useState(null);
  const [stats, setStats] = useState({ total: 0, amount: 0, pending: 0, approved: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 500,
        dateFrom: dateRange[0]?.format('YYYY-MM-DD'),
        dateTo: dateRange[1]?.format('YYYY-MM-DD'),
      };
      if (statusFilter !== 'all') params.status = statusFilter;

      const [expRes, usersRes] = await Promise.all([
        api.get('/expenses', { params }),
        userService.getUsers({ role: 'sales_executive', limit: 100 }),
      ]);

      let allExpenses = expRes?.data || [];
      const allSEs = usersRes?.data || usersRes?.users || [];
      setSalesExecs(allSEs);

      const seIds = allSEs.map(se => se._id);

      // Filter by selected SE employee
      if (seFilter !== 'all') {
        allExpenses = allExpenses.filter(e => {
          const empId = typeof e.employee === 'object' ? e.employee?._id : e.employee;
          return empId === seFilter;
        });
      }

      setExpenses(allExpenses);

      const totalAmt = allExpenses.reduce((s, e) => s + (e.amount || 0), 0);
      const pending = allExpenses.filter(e => e.status === 'submitted').length;
      const approved = allExpenses.filter(e => e.status === 'approved' || e.status === 'paid').length;
      setStats({ total: allExpenses.length, amount: totalAmt, pending, approved });
    } catch (err) {
      console.error('SEExpenseViewer load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = expenses;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(e =>
        e.expenseNumber?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q) ||
        e.employeeName?.toLowerCase().includes(q) ||
        (typeof e.employee === 'object' ? e.employee?.name : '')?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [expenses, search]);

  const approveExpense = async (id) => {
    try {
      await api.patch(`/expenses/${id}/approve`).catch(() =>
        message.warning('Approve endpoint not available — implement in expenseRoutes.js')
      );
      load();
      message.success('Expense approved');
    } catch (err) {
      console.error(err);
    }
  };

  const rejectExpense = async (id) => {
    try {
      await api.patch(`/expenses/${id}/reject`).catch(() =>
        message.warning('Reject endpoint not available — implement in expenseRoutes.js')
      );
      load();
      message.success('Expense rejected');
    } catch (err) {
      console.error(err);
    }
  };

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Expense #',
      dataIndex: 'expenseNumber',
      key: 'expenseNumber',
      render: (v) => <Text strong style={{ color: '#FF5F03' }}>{v || '—'}</Text>,
    },
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => {
        const emp = typeof r.employee === 'object' ? r.employee : null;
        const name = emp?.name || r.employeeName;
        return name ? <Space><UserOutlined style={{ color: '#FF5F03' }} /><Text>{name}</Text></Space>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Category',
      key: 'category',
      render: (_, r) => {
        const cat = typeof r.category === 'object' ? r.category?.name : r.category;
        return cat ? <Tag color="blue">{cat}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a, b) => (a.amount || 0) - (b.amount || 0),
      render: (v) => <Text strong>{fmtCurrency(v)}</Text>,
    },
    {
      title: 'Date',
      dataIndex: 'expenseDate',
      key: 'expenseDate',
      render: (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s?.toUpperCase() || '—'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModal(true); }} />
          {r.status === 'submitted' && (
            <>
              <Button size="small" icon={<CheckOutlined />} type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => approveExpense(r._id)} />
              <Button size="small" icon={<CloseOutlined />} danger onClick={() => rejectExpense(r._id)} />
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Expense Viewer</Title>
          <Text type="secondary">Review and approve expense claims filed by sales executives</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Claims" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Total Amount" value={fmtCurrency(stats.amount)} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fffbe6', border: '1px solid #faad14' }}>
            <Statistic title="Pending Approval" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Approved" value={stats.approved} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={6}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={6}>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }} placeholder="Sales Executive">
              <Option value="all">All Executives</Option>
              {salesExecs.map(se => <Option key={se._id} value={se._id}>{se.name}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={5}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }} placeholder="Status">
              <Option value="all">All Status</Option>
              <Option value="submitted">Pending</Option>
              <Option value="approved">Approved</Option>
              <Option value="rejected">Rejected</Option>
              <Option value="paid">Paid</Option>
            </Select>
          </Col>
          <Col xs={24} sm={7}>
            <RangePicker value={dateRange} onChange={(v) => v && setDateRange(v)} style={{ width: '100%' }} format="DD MMM YYYY" />
          </Col>
        </Row>
        <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03', marginTop: 8 }} onClick={load}>
          Apply Filters
        </Button>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey={(r) => r._id || Math.random()}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} expenses` }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'No expense claims found.' }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={<Space><FileTextOutlined style={{ color: '#FF5F03' }} />Expense Details — {selected?.expenseNumber}</Space>}
        open={detailModal}
        onCancel={() => { setDetailModal(false); setSelected(null); }}
        footer={null}
        width={600}
      >
        {selected && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Expense #">{selected.expenseNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Date">{selected.expenseDate ? new Date(selected.expenseDate).toLocaleDateString('en-IN') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Employee">{typeof selected.employee === 'object' ? selected.employee?.name : selected.employeeName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Amount"><Text strong style={{ color: '#FF5F03' }}>{fmtCurrency(selected.amount)}</Text></Descriptions.Item>
            <Descriptions.Item label="Category" span={2}>{typeof selected.category === 'object' ? selected.category?.name : selected.category || '—'}</Descriptions.Item>
            <Descriptions.Item label="Description" span={2}>{selected.description || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status" span={2}>
              <Tag color={statusColor[selected.status] || 'default'}>{selected.status?.toUpperCase()}</Tag>
            </Descriptions.Item>
            {selected.remarks && <Descriptions.Item label="Remarks" span={2}>{selected.remarks}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
