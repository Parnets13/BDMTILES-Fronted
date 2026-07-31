import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Form, DatePicker, message } from 'antd';
import { UserOutlined, ReloadOutlined, SearchOutlined, PlusOutlined, EnvironmentOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService';
import userService from '../../services/userService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const dayColor = ['blue', 'cyan', 'green', 'gold', 'orange', 'purple', 'red'];

export default function SERoutePlan() {
  const [routes, setRoutes] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [routesRes, usersRes] = await Promise.all([
        masterService.getRoutes({ limit: 500 }),
        userService.getUsers({ role: 'sales_executive', limit: 100 }),
      ]);
      setRoutes(routesRes?.data || routesRes?.routes || []);
      setSalesExecs(usersRes?.data || usersRes?.users || []);
    } catch (err) {
      console.error('SERoutePlan load error:', err);
      message.error('Failed to load routes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = routes;
    if (seFilter !== 'all') {
      list = list.filter(r => {
        const seId = typeof r.assignedSE === 'object' ? r.assignedSE?._id : r.assignedSE;
        const seId2 = typeof r.salesExecutiveId === 'object' ? r.salesExecutiveId?._id : r.salesExecutiveId;
        return seId === seFilter || seId2 === seFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.code?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [routes, seFilter, search]);

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => (
        <Space>
          <div style={{ color: '#FF5F03' }}>📍</div>
          <div>
            <Text strong>{r.name}</Text>
            {r.code && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.code}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Areas Covered',
      dataIndex: 'areas',
      key: 'areas',
      render: (areas) => {
        if (Array.isArray(areas) && areas.length > 0) {
          return (
            <Space wrap>
              {areas.slice(0, 3).map((a, i) => (
                <Tag key={i} color="blue" style={{ fontSize: 11 }}>{a}</Tag>
              ))}
              {areas.length > 3 && <Tag color="default">+{areas.length - 3}</Tag>}
            </Space>
          );
        }
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Visiting Days',
      dataIndex: 'visitingDays',
      key: 'visitingDays',
      render: (days) => {
        if (Array.isArray(days) && days.length > 0) {
          return (
            <Space wrap>
              {days.map((d, i) => (
                <Tag key={i} color={dayColor[i % 7]} style={{ fontSize: 11 }}>{d}</Tag>
              ))}
            </Space>
          );
        }
        if (typeof days === 'string' && days) return <Tag color="blue">{days}</Tag>;
        return <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Assigned SE',
      key: 'se',
      render: (_, r) => {
        const se = typeof r.assignedSE === 'object' ? r.assignedSE
          : typeof r.salesExecutiveId === 'object' ? r.salesExecutiveId
          : null;
        return se ? <Tag color="orange" icon={<UserOutlined />}>{se.name}</Tag> : <Tag color="default">Unassigned</Tag>;
      },
    },
    {
      title: 'Dealers on Route',
      dataIndex: 'dealerCount',
      key: 'dealerCount',
      render: (v) => v ? <Tag color="green">{v} dealers</Tag> : <Text type="secondary">—</Text>,
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
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Route Plan</Title>
          <Text type="secondary">Sales executive route assignments and visiting schedules</Text>
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
            <Statistic
              title="Assigned Routes"
              value={routes.filter(r => r.assignedSE || r.salesExecutiveId).length}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic title="Sales Executives" value={salesExecs.length} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search route name, code..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }} placeholder="Filter by Sales Executive">
              <Option value="all">All Sales Executives</Option>
              {salesExecs.map(se => (
                <Option key={se._id} value={se._id}>{se.name}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} routes` }}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No routes found. Add routes via Masters → Routes.' }}
        />
      </Card>
    </div>
  );
}
