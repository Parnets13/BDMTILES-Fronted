import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Form, message } from 'antd';
import { UserOutlined, ShopOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined, EditOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService';
import userService from '../../services/userService';

const { Title, Text } = Typography;
const { Option } = Select;

export default function SEDealerAssignment() {
  const [dealers, setDealers] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [editModal, setEditModal] = useState(false);
  const [editDealer, setEditDealer] = useState(null);
  const [selectedSE, setSelectedSE] = useState(null);
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
      setStats({ total: allDealers.length, assigned, unassigned: allDealers.length - assigned, ses: allSEs.length });
    } catch (err) {
      console.error('SEDealerAssignment load error:', err);
      message.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    let list = dealers;
    if (seFilter === 'unassigned') {
      list = list.filter(d => !d.salesExecutiveId && !d.assignedSalesExecutive);
    } else if (seFilter !== 'all') {
      list = list.filter(d => {
        const seId = typeof d.salesExecutiveId === 'object' ? d.salesExecutiveId?._id : d.salesExecutiveId;
        return seId === seFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.code?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [dealers, seFilter, search]);

  // Group dealers by SE for the quick filter chips
  const seGroups = useMemo(() => {
    const map = {};
    salesExecs.forEach(se => { map[se._id] = { se, count: 0 }; });
    dealers.forEach(d => {
      const seId = typeof d.salesExecutiveId === 'object' ? d.salesExecutiveId?._id : d.salesExecutiveId;
      if (seId && map[seId]) map[seId].count++;
    });
    return Object.values(map);
  }, [salesExecs, dealers]);

  const openAssign = (dealer) => {
    const currentSE = typeof dealer.salesExecutiveId === 'object' ? dealer.salesExecutiveId?._id : dealer.salesExecutiveId;
    setEditDealer(dealer);
    setSelectedSE(currentSE || null);
    setEditModal(true);
  };

  const saveAssignment = async () => {
    if (!editDealer) return;
    setSaving(true);
    try {
      await masterService.updateDealer(editDealer._id, { salesExecutiveId: selectedSE || null });
      message.success('Dealer assignment updated');
      setEditModal(false);
      setEditDealer(null);
      load();
    } catch (err) {
      console.error('Assignment save error:', err);
      message.error('Failed to update assignment');
    } finally {
      setSaving(false);
    }
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
      title: 'Region',
      key: 'region',
      render: (_, r) => {
        const region = typeof r.regionId === 'object' ? r.regionId : null;
        return region
          ? <Space size={4}><EnvironmentOutlined style={{ color: '#52c41a' }} /><Text>{region.name}</Text></Space>
          : <Text type="secondary">—</Text>;
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
        const se = typeof r.salesExecutiveId === 'object' ? r.salesExecutiveId : null;
        return se ? <Tag color="blue" icon={<UserOutlined />}>{se.name}</Tag> : <Tag color="red">Unassigned</Tag>;
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openAssign(r)}>
          Assign
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Dealer Assignment</Title>
          <Text type="secondary">Assign dealers to sales executives — view and update dealer routing</Text>
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
            <Statistic title="Sales Executives" value={stats.ses} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
      </Row>

      {/* SE Quick Filter Chips */}
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button
          size="small"
          type={seFilter === 'all' ? 'primary' : 'default'}
          style={seFilter === 'all' ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
          onClick={() => setSeFilter('all')}
        >
          All ({dealers.length})
        </Button>
        {seGroups.map(({ se, count }) => (
          <Button
            key={se._id}
            size="small"
            type={seFilter === se._id ? 'primary' : 'default'}
            style={seFilter === se._id ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
            onClick={() => setSeFilter(se._id)}
          >
            {se.name} ({count})
          </Button>
        ))}
        <Button
          size="small"
          type={seFilter === 'unassigned' ? 'primary' : 'default'}
          danger={seFilter === 'unassigned'}
          onClick={() => setSeFilter('unassigned')}
        >
          Unassigned ({stats.unassigned})
        </Button>
      </div>

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
          scroll={{ x: 900 }}
          locale={{ emptyText: 'No dealers found.' }}
        />
      </Card>

      {/* Assign Modal */}
      <Modal
        title={`Assign SE — ${editDealer?.name}`}
        open={editModal}
        onOk={saveAssignment}
        onCancel={() => { setEditModal(false); setEditDealer(null); }}
        confirmLoading={saving}
        okText="Save Assignment"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <div style={{ marginBottom: 8 }}>
          <Text strong>Select Sales Executive</Text>
        </div>
        <Select
          value={selectedSE}
          onChange={setSelectedSE}
          style={{ width: '100%' }}
          placeholder="Choose a sales executive..."
          allowClear
        >
          {salesExecs.map(se => (
            <Option key={se._id} value={se._id}>
              <UserOutlined /> {se.name}
            </Option>
          ))}
        </Select>
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Clear selection to unassign from current SE.
        </Text>
      </Modal>
    </div>
  );
}
