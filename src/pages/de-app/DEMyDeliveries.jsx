import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Descriptions } from 'antd';
import { CarOutlined, ReloadOutlined, SearchOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusColor = { planned: 'gold', in_transit: 'blue', completed: 'green', cancelled: 'red' };

export default function DEMyDeliveries() {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [detailModal, setDetailModal] = useState(false);
  const [stats, setStats] = useState({ total: 0, inTransit: 0, completed: 0, pending: 0 });

  const load = async () => {
    setLoading(true);
    try {
      // Fetch all dispatches — in a full DE app this would filter by logged-in driver
      const res = await api.get('/dispatch', { params: { limit: 200 } });
      const all = res?.data || [];
      setDispatches(all);
      setStats({
        total: all.length,
        inTransit: all.filter(d => d.status === 'in_transit').length,
        completed: all.filter(d => d.status === 'completed').length,
        pending: all.filter(d => d.status === 'planned').length,
      });
    } catch (err) {
      console.error('DEMyDeliveries load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return dispatches;
    const q = search.toLowerCase();
    return dispatches.filter(d =>
      d.dispatchNumber?.toLowerCase().includes(q) ||
      d.driverName?.toLowerCase().includes(q) ||
      d.vehicle?.toLowerCase().includes(q)
    );
  }, [dispatches, search]);

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
      render: (_, r) => typeof r.route === 'object' ? r.route?.name || '—' : r.route || <Text type="secondary">—</Text>,
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
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : '—',
    },
    {
      title: 'Delivery Date',
      dataIndex: 'actualDeliveryDate',
      key: 'actualDeliveryDate',
      render: (d) => d ? dayjs(d).format('DD MMM YYYY') : <Text type="secondary">Pending</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s?.replace('_', ' ')?.toUpperCase() || '—'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => { setSelected(r); setDetailModal(true); }}>View</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>My Deliveries</Title>
          <Text type="secondary">All deliveries assigned to delivery executives</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fffbe6', border: '1px solid #faad14' }}>
            <Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#e6f7ff', border: '1px solid #1890ff' }}>
            <Statistic title="In Transit" value={stats.inTransit} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Completed" value={stats.completed} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <Card style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search dispatch #, driver, vehicle..."
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
          rowKey={(r) => r._id || Math.random()}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} deliveries` }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'No deliveries assigned yet.' }}
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
              <Tag color={statusColor[selected.status] || 'default'}>{selected.status?.replace('_', ' ')?.toUpperCase()}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Driver">{selected.driverName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Vehicle">{selected.vehicle || '—'}</Descriptions.Item>
            <Descriptions.Item label="Route">{typeof selected.route === 'object' ? selected.route?.name : selected.route || '—'}</Descriptions.Item>
            <Descriptions.Item label="Dispatch Date">{selected.dispatchDate ? dayjs(selected.dispatchDate).format('DD MMM YYYY') : '—'}</Descriptions.Item>
            <Descriptions.Item label="Orders">{Array.isArray(selected.orders) ? selected.orders.length : '—'}</Descriptions.Item>
            <Descriptions.Item label="Actual Delivery">{selected.actualDeliveryDate ? dayjs(selected.actualDeliveryDate).format('DD MMM YYYY') : 'Not yet'}</Descriptions.Item>
            {selected.notes && <Descriptions.Item label="Notes" span={2}>{selected.notes}</Descriptions.Item>}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
