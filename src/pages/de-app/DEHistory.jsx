import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Descriptions, DatePicker } from 'antd';
import { CarOutlined, ReloadOutlined, SearchOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const fmtDate = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';
const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';

export default function DEHistory() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [selected, setSelected] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, orders: 0, onTime: 0, late: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/dispatch', {
        params: {
          limit: 500,
          status: 'completed',
        },
      });

      const all = res?.data || [];
      setDispatches(all);

      const totalOrders = all.reduce((s, d) => s + (Array.isArray(d.orders) ? d.orders.length : 0), 0);
      let onTime = 0;
      let late = 0;
      all.forEach(d => {
        if (d.actualDeliveryDate && d.expectedDeliveryDate) {
          if (dayjs(d.actualDeliveryDate).isSame(dayjs(d.expectedDeliveryDate), 'day') || dayjs(d.actualDeliveryDate).isBefore(dayjs(d.expectedDeliveryDate))) {
            onTime++;
          } else {
            late++;
          }
        }
      });

      setStats({ total: all.length, orders: totalOrders, onTime, late });
    } catch (err) {
      console.error('DEHistory load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = dispatches;

    // Apply date range filter
    if (dateRange[0] && dateRange[1]) {
      list = list.filter(d => {
        const date = dayjs(d.actualDeliveryDate || d.updatedAt);
        return date.isAfter(dateRange[0].startOf('day')) && date.isBefore(dateRange[1].endOf('day'));
      });
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.dispatchNumber?.toLowerCase().includes(q) ||
        d.driverName?.toLowerCase().includes(q) ||
        d.vehicle?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [dispatches, search, dateRange]);

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Dispatch #',
      dataIndex: 'dispatchNumber',
      key: 'dispatchNumber',
      render: (v) => <Text strong style={{ color: '#FF5F03' }}>{v || '—'}</Text>,
    },
    {
      title: 'Driver',
      dataIndex: 'driverName',
      key: 'driverName',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Vehicle',
      dataIndex: 'vehicle',
      key: 'vehicle',
      render: (v) => v ? <Tag color="cyan"><CarOutlined /> {v}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => typeof r.route === 'object' ? r.route?.name || '—' : r.route || '—',
    },
    {
      title: 'Orders',
      dataIndex: 'orders',
      key: 'orders',
      render: (v) => Array.isArray(v) ? <Tag color="blue">{v.length}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Dispatch Date',
      dataIndex: 'dispatchDate',
      key: 'dispatchDate',
      render: (d) => fmtDate(d),
    },
    {
      title: 'Delivered On',
      dataIndex: 'actualDeliveryDate',
      key: 'actualDeliveryDate',
      render: (d) => d ? <Text style={{ color: '#52c41a' }}>{fmtDate(d)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'On Time?',
      key: 'onTime',
      render: (_, r) => {
        if (!r.actualDeliveryDate || !r.expectedDeliveryDate) return <Text type="secondary">—</Text>;
        const onTime = dayjs(r.actualDeliveryDate).isSameOrBefore(dayjs(r.expectedDeliveryDate));
        return <Tag color={onTime ? 'green' : 'red'}>{onTime ? '✓ On Time' : '✗ Late'}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModal(true); }}>
          View
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>DE Delivery History</Title>
          <Text type="secondary">Completed delivery records with on-time performance</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Completed" value={stats.total} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Orders" value={stats.orders} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="On Time" value={stats.onTime} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Late" value={stats.late} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search dispatch #, driver, vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={10}>
            <RangePicker value={dateRange} onChange={(v) => v && setDateRange(v)} style={{ width: '100%' }} format="DD MMM YYYY" />
          </Col>
          <Col xs={24} sm={6}>
            <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03' }} onClick={load} block>Apply</Button>
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
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} deliveries` }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'No completed deliveries found for the selected period.' }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={<Space><CarOutlined style={{ color: '#FF5F03' }} />Delivery — {selected?.dispatchNumber}</Space>}
        open={detailModal}
        onCancel={() => { setDetailModal(false); setSelected(null); }}
        footer={null}
        width={600}
      >
        {selected && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Dispatch #">{selected.dispatchNumber}</Descriptions.Item>
            <Descriptions.Item label="Status">
              <Tag color="green">COMPLETED</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Driver">{selected.driverName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Vehicle">{selected.vehicle || '—'}</Descriptions.Item>
            <Descriptions.Item label="Route">{typeof selected.route === 'object' ? selected.route?.name : selected.route || '—'}</Descriptions.Item>
            <Descriptions.Item label="Warehouse">{typeof selected.warehouse === 'object' ? selected.warehouse?.name : selected.warehouse || '—'}</Descriptions.Item>
            <Descriptions.Item label="Dispatch Date">{fmtDate(selected.dispatchDate)}</Descriptions.Item>
            <Descriptions.Item label="Delivered On">{fmtDate(selected.actualDeliveryDate)}</Descriptions.Item>
            <Descriptions.Item label="Expected Delivery">{fmtDate(selected.expectedDeliveryDate)}</Descriptions.Item>
            <Descriptions.Item label="Orders">{Array.isArray(selected.orders) ? selected.orders.length : '—'}</Descriptions.Item>
            {selected.deliveryNotes && <Descriptions.Item label="Delivery Notes" span={2}>{selected.deliveryNotes}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
