import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Tag, Row, Col, Statistic, Space, Button, Input, Typography } from 'antd';
import { EnvironmentOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService';

const { Title, Text } = Typography;

export default function DERoutePlan() {
  const [routes, setRoutes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await masterService.getRoutes({ limit: 500 });
      setRoutes(res?.data || res?.routes || []);
    } catch (err) {
      console.error('DERoutePlan load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search) return routes;
    const q = search.toLowerCase();
    return routes.filter(r =>
      r.name?.toLowerCase().includes(q) ||
      r.code?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [routes, search]);

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => (
        <Space>
          <EnvironmentOutlined style={{ color: '#FF5F03' }} />
          <div>
            <Text strong>{r.name}</Text>
            {r.code && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.code}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Areas / Stops',
      dataIndex: 'areas',
      key: 'areas',
      render: (areas) => {
        if (Array.isArray(areas) && areas.length > 0) {
          return (
            <Space wrap>
              {areas.slice(0, 4).map((a, i) => <Tag key={i} color="blue" style={{ fontSize: 11 }}>{a}</Tag>)}
              {areas.length > 4 && <Tag color="default">+{areas.length - 4} more</Tag>}
            </Space>
          );
        }
        return <Text type="secondary">—</Text>;
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
      title: 'Distance (km)',
      dataIndex: 'distanceKm',
      key: 'distanceKm',
      render: (v) => v ? `${v} km` : <Text type="secondary">—</Text>,
    },
    {
      title: 'Est. Time',
      dataIndex: 'estimatedHours',
      key: 'estimatedHours',
      render: (v) => v ? `${v}h` : <Text type="secondary">—</Text>,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'status',
      render: (v) => <Tag color={v === false ? 'red' : 'green'}>{v === false ? 'Inactive' : 'Active'}</Tag>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>DE Route Plan</Title>
          <Text type="secondary">All delivery routes with stops and distance information</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Routes" value={routes.length} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Active Routes" value={routes.filter(r => r.isActive !== false).length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Inactive Routes" value={routes.filter(r => r.isActive === false).length} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <Card style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search route name, code..."
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
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} routes` }}
          scroll={{ x: 800 }}
          locale={{ emptyText: 'No routes configured. Add routes from Masters → Routes.' }}
        />
      </Card>
    </div>
  );
}
