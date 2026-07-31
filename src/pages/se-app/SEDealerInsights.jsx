import React, { useState, useEffect } from 'react';
import { Table, Card, Row, Col, Statistic, Space, Button, Input, Typography, Tag, Progress, Modal, Descriptions } from 'antd';
import { ShopOutlined, RiseOutlined, ReloadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService';
import reportService from '../../services/reportService';

const { Title, Text } = Typography;

const fmtCurrency = (n) => {
  if (!n) return '₹0';
  return '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

export default function SEDealerInsights() {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [perf, setPerf] = useState([]);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedDealer, setSelectedDealer] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [dealersRes, perfRes] = await Promise.all([
        masterService.getDealers({ limit: 500, status: 'active' }),
        reportService.getDealerPerformance({ limit: 500 }).catch(() => ({ data: [] })),
      ]);
      const allDealers = dealersRes?.data || dealersRes?.dealers || [];
      const perfData = perfRes?.data || perfRes?.dealers || [];

      // Merge performance data into dealer list
      const perfMap = {};
      perfData.forEach(p => { perfMap[p.dealerId || p._id] = p; });

      const merged = allDealers.map(d => ({
        ...d,
        ...(perfMap[d._id] || {}),
        totalSales: perfMap[d._id]?.totalSales || 0,
        orderCount: perfMap[d._id]?.orderCount || 0,
        lastOrderDate: perfMap[d._id]?.lastOrderDate || null,
        outstanding: perfMap[d._id]?.outstanding || 0,
        paymentRating: perfMap[d._id]?.paymentRating || null,
      }));

      setDealers(merged);
      setPerf(perfData);
    } catch (err) {
      console.error('DealerInsights load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = dealers.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return d.name?.toLowerCase().includes(q) || d.code?.toLowerCase().includes(q) || d.city?.toLowerCase().includes(q);
  });

  // Summaries
  const totalSales = filtered.reduce((s, d) => s + (d.totalSales || 0), 0);
  const totalOutstanding = filtered.reduce((s, d) => s + (d.outstanding || 0), 0);
  const activeCount = filtered.filter(d => (d.orderCount || 0) > 0).length;

  const viewDetails = (dealer) => {
    setSelectedDealer(dealer);
    setDetailModal(true);
  };

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <Space>
          <ShopOutlined style={{ color: '#FF5F03' }} />
          <div>
            <Text strong>{r.name}</Text>
            {r.code && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.code}</Text>}
          </div>
        </Space>
      ),
    },
    { title: 'City', dataIndex: 'city', key: 'city', render: v => v || <Text type="secondary">—</Text> },
    {
      title: 'Total Sales',
      dataIndex: 'totalSales',
      key: 'totalSales',
      sorter: (a, b) => (a.totalSales || 0) - (b.totalSales || 0),
      render: (v) => <Text strong style={{ color: '#52c41a' }}>{fmtCurrency(v)}</Text>,
    },
    {
      title: 'Orders',
      dataIndex: 'orderCount',
      key: 'orderCount',
      sorter: (a, b) => (a.orderCount || 0) - (b.orderCount || 0),
      render: (v) => v ? <Tag color="blue">{v} orders</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: 'Outstanding',
      dataIndex: 'outstanding',
      key: 'outstanding',
      sorter: (a, b) => (a.outstanding || 0) - (b.outstanding || 0),
      render: (v) => v > 0 ? <Text style={{ color: '#ff4d4f' }}>{fmtCurrency(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Last Order',
      dataIndex: 'lastOrderDate',
      key: 'lastOrderDate',
      render: (d) => d ? new Date(d).toLocaleDateString('en-IN') : <Text type="secondary">Never</Text>,
    },
    {
      title: 'Payment Rating',
      dataIndex: 'paymentRating',
      key: 'paymentRating',
      render: (r) => {
        if (!r) return <Text type="secondary">—</Text>;
        const color = r >= 80 ? 'green' : r >= 50 ? 'gold' : 'red';
        return <Progress percent={r} size="small" strokeColor={color === 'green' ? '#52c41a' : color === 'gold' ? '#faad14' : '#ff4d4f'} />;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => viewDetails(r)}>View</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Dealer Insights</Title>
          <Text type="secondary">Sales performance, order history and outstanding per dealer</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Dealers" value={filtered.length} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Total Sales" value={fmtCurrency(totalSales)} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Total Outstanding" value={fmtCurrency(totalOutstanding)} valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic title="Active Dealers" value={activeCount} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <Card style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search dealer name, code, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} dealers` }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'No dealer insight data available. Ensure dealers have sales orders.' }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={<Space><ShopOutlined style={{ color: '#FF5F03' }} />{selectedDealer?.name} — Insights</Space>}
        open={detailModal}
        onCancel={() => { setDetailModal(false); setSelectedDealer(null); }}
        footer={null}
        width={600}
      >
        {selectedDealer && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Dealer Code">{selectedDealer.code || '—'}</Descriptions.Item>
            <Descriptions.Item label="City">{selectedDealer.city || '—'}</Descriptions.Item>
            <Descriptions.Item label="Phone">{selectedDealer.phone || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color={selectedDealer.status === 'active' ? 'green' : 'red'}>{selectedDealer.status?.toUpperCase() || 'ACTIVE'}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Total Sales" span={2}>
              <Text strong style={{ color: '#52c41a', fontSize: 16 }}>{fmtCurrency(selectedDealer.totalSales)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Total Orders">{selectedDealer.orderCount || 0}</Descriptions.Item>
            <Descriptions.Item label="Outstanding">
              <Text style={{ color: '#ff4d4f' }}>{fmtCurrency(selectedDealer.outstanding)}</Text>
            </Descriptions.Item>
            <Descriptions.Item label="Last Order Date" span={2}>
              {selectedDealer.lastOrderDate ? new Date(selectedDealer.lastOrderDate).toLocaleDateString('en-IN') : 'Never'}
            </Descriptions.Item>
            {selectedDealer.creditLimit && (
              <Descriptions.Item label="Credit Limit" span={2}>
                {fmtCurrency(selectedDealer.creditLimit)}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
