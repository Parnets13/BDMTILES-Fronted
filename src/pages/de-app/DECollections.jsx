import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, DatePicker } from 'antd';
import { DollarOutlined, CarOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
const paymentModeColor = { cash: 'green', cheque: 'blue', online: 'cyan', neft: 'purple', rtgs: 'orange', upi: 'gold' };

export default function DECollections() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState('all');
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
      const res = await salesService.getPayments(params);
      const allPayments = res?.data || res?.payments || [];
      setPayments(allPayments);

      const totalAmt = allPayments.reduce((s, p) => s + (p.amount || 0), 0);
      setStats({
        total: allPayments.length,
        amount: totalAmt,
        pending: allPayments.filter(p => p.status === 'pending').length,
        confirmed: allPayments.filter(p => p.status === 'confirmed').length,
      });
    } catch (err) {
      console.error('DECollections load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = payments;
    if (modeFilter !== 'all') list = list.filter(p => p.paymentMode?.toLowerCase() === modeFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.paymentNumber?.toLowerCase().includes(q) ||
        p.dealerName?.toLowerCase().includes(q) ||
        p.referenceNumber?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [payments, search, modeFilter]);

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
      title: 'Payment Date',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
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
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>DE Collections</Title>
          <Text type="secondary">Payments collected on delivery by executives</Text>
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
              placeholder="Search payment #, dealer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={5}>
            <Select value={modeFilter} onChange={setModeFilter} style={{ width: '100%' }}>
              <Option value="all">All Modes</Option>
              <Option value="cash">Cash</Option>
              <Option value="cheque">Cheque</Option>
              <Option value="online">Online</Option>
              <Option value="upi">UPI</Option>
              <Option value="neft">NEFT</Option>
            </Select>
          </Col>
          <Col xs={24} sm={9}>
            <RangePicker value={dateRange} onChange={(v) => v && setDateRange(v)} style={{ width: '100%' }} format="DD MMM YYYY" />
          </Col>
          <Col xs={24} sm={2} style={{ paddingTop: 0 }}>
            <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03' }} onClick={load} block>Go</Button>
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
