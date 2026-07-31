import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Badge } from 'antd';
import { UserOutlined, ShopOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService';
import userService from '../../services/userService';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SEDealerVisits() {
  const [dealers, setDealers] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ total: 0, assigned: 0, unassigned: 0, ses: 0 });

  const load = async () => {
    setLoading(true);
    try {
      const [dealersRes, usersRes] = await Promise.all([
        masterService.getDealers({ limit: 2000 }),
        userService.getUsers({ role: 'sales_executive', limit: 100 }),
      ]);
      const allDealers = dealersRes?.data || dealersRes?.dealers || [];
      const allSEs = usersRes?.data || usersRes?.users || [];
      setDealers(allDealers);
      setSalesExecs(allSEs);

      const assigned = allDealers.filter(d => d.salesExecutiveId || d.assignedSalesExecutive).length;
      setStats({
        total: allDealers.length,
        assigned,
        unassigned: allDealers.length - assigned,
        ses: allSEs.length,
      });
    } catch (err) {
      console.error('SEDealerVisits load error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = dealers;
    if (seFilter !== 'all') {
      list = list.filter(d => {
        const seId = typeof d.salesExecutiveId === 'object' ? d.salesExecutiveId?._id : d.salesExecutiveId;
        const seId2 = typeof d.assignedSalesExecutive === 'object' ? d.assignedSalesExecutive?._id : d.assignedSalesExecutive;
        return seId === seFilter || seId2 === seFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.code?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        d.phone?.includes(q)
      );
    }
    return list;
  }, [dealers, seFilter, search]);

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
    {
      title: 'City',
      dataIndex: 'city',
      key: 'city',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Region',
      key: 'region',
      render: (_, r) => {
        const region = typeof r.regionId === 'object' ? r.regionId : null;
        return region ? (
          <Space size={4}>
            <EnvironmentOutlined style={{ color: '#52c41a' }} />
            <Text>{region.name}</Text>
          </Space>
        ) : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => {
        const route = typeof r.routeId === 'object' ? r.routeId : null;
        return route ? <Tag color="purple">{route.name}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Assigned SE',
      key: 'se',
      render: (_, r) => {
        const se = typeof r.salesExecutiveId === 'object' ? r.salesExecutiveId
          : typeof r.assignedSalesExecutive === 'object' ? r.assignedSalesExecutive
          : null;
        return se ? (
          <Tag color="blue" icon={<UserOutlined />}>{se.name}</Tag>
        ) : <Tag color="red">Unassigned</Tag>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={s === 'active' ? 'green' : 'default'}>{s?.toUpperCase() || 'ACTIVE'}</Tag>,
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Dealer Visits Log</Title>
          <Text type="secondary">Dealer roster with assigned sales executive mapping</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Dealers" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Assigned" value={stats.assigned} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Unassigned" value={stats.unassigned} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic title="Sales Execs" value={stats.ses} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search dealer name, code, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }} placeholder="Filter by Sales Executive">
              <Option value="all">All Executives</Option>
              {salesExecs.map(se => (
                <Option key={se._id} value={se._id}>{se.name}</Option>
              ))}
              <Option value="unassigned">Unassigned</Option>
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
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} dealers` }}
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No dealers found.' }}
        />
      </Card>
    </div>
  );
}
