import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, DatePicker } from 'antd';
import { DollarOutlined, UserOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService';
import userService from '../../services/userService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';

const paymentModeColor = { cash: 'green', cheque: 'blue', online: 'cyan', neft: 'purple', rtgs: 'orange', upi: 'gold' };

export default function SECollections() {
  const [payments, setPayments] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [stats, setStats] = useState({ total: 0, amount: 0, pending: 0, confirmed: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const params = {
        limit: 500,
        dateFrom: dateRange[0]?.format('YYYY-MM-DD'),
        dateTo: dateRange[1]?.format('YYYY-MM-DD'),
      };

      const [paymentsRes, usersRes] = await Promise.all([
        salesService.getPayments(params),
        userService.getUsers({ role: 'sales_executive', limit: 100 }),
      ]);

      const allPayments = paymentsRes?.data || paymentsRes?.payments || [];
      const allSEs = usersRes?.data || usersRes?.users || [];

      setPayments(allPayments);
      setSalesExecs(allSEs);

      const totalAmt = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      const pending = allPayments.filter(p => p.status === 'pending').length;
      const confirmed = allPayments.filter(p => p.status === 'confirmed').length;
      setStats({ total: allPayments.length, amount: totalAmt, pending, confirmed });
    } catch (err) {
      console.error('SECollections load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = payments;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.paymentNumber?.toLowerCase().includes(q) ||
        p.dealerName?.toLowerCase().includes(q) ||
        p.referenceNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [payments, search]);

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Payment #',
      dataIndex: 'paymentNumber',
      key: 'paymentNumber',
      render: (v) => <Text strong style={{ color: '#FF5F03' }}>{v || '—'}</Text>,
    },
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <div>
          <Text strong>{r.dealerName || r.dealer?.name || '—'}</Text>
          {r.dealerCode && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.dealerCode}</Text>}
        </div>
      ),
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a, b) => (a.amount || 0) - (b.amount || 0),
      render: (v) => <Text strong style={{ color: '#52c41a' }}>{fmtCurrency(v)}</Text>,
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMode',
      key: 'paymentMode',
      render: (m) => <Tag color={paymentModeColor[m?.toLowerCase()] || 'default'}>{m?.toUpperCase() || '—'}</Tag>,
    },
    {
      title: 'Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      render: (d) => d ? new Date(d).toLocaleDateString('en-IN') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => {
        const color = s === 'confirmed' ? 'green' : s === 'pending' ? 'gold' : s === 'bounced' ? 'red' : 'default';
        return <Tag color={color}>{s?.toUpperCase() || '—'}</Tag>;
      },
    },
    {
      title: 'Reference',
      dataIndex: 'referenceNumber',
      key: 'referenceNumber',
      render: (v) => <Text type="secondary">{v || '—'}</Text>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Collections</Title>
          <Text type="secondary">Dealer payments collected — filtered by date range</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Payments" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Total Amount" value={fmtCurrency(stats.amount)} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Confirmed" value={stats.confirmed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fffbe6', border: '1px solid #faad14' }}>
            <Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search payment #, dealer, reference..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10}>
            <RangePicker
              value={dateRange}
              onChange={(v) => v && setDateRange(v)}
              style={{ width: '100%' }}
              format="DD MMM YYYY"
            />
          </Col>
          <Col xs={24} sm={6}>
            <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03' }} onClick={load} block>
              Apply
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey={(r) => r._id || Math.random()}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} payments` }}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No collections found for the selected period.' }}
        />
      </Card>
    </div>
  );
}
