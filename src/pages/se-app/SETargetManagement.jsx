import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Form, InputNumber, DatePicker, Progress, message } from 'antd';
import { TrophyOutlined, UserOutlined, ReloadOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import userService from '../../services/userService';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';

const statusColor = { active: 'green', completed: 'blue', expired: 'red', draft: 'default' };

export default function SETargetManagement() {
  const [targets, setTargets] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form] = Form.useForm();

  const loadSEs = async () => {
    try {
      const usersRes = await userService.getUsers({ role: 'sales_executive', limit: 100 });
      setSalesExecs(usersRes?.data || usersRes?.users || []);
    } catch (err) {
      console.error('Load SEs error:', err);
    }
  };

  const loadTargets = async () => {
    setLoading(true);
    try {
      // Target management uses a dedicated endpoint if available, else show empty state gracefully
      const res = await api.get('/targets', { params: { limit: 200 } }).catch(() => ({ data: { data: [] } }));
      setTargets(res?.data?.data || res?.data || []);
    } catch (err) {
      console.error('Load targets error:', err);
      setTargets([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSEs(); loadTargets(); }, []);

  const filtered = useMemo(() => {
    let list = targets;
    if (seFilter !== 'all') {
      list = list.filter(t => {
        const seId = typeof t.salesExecutive === 'object' ? t.salesExecutive?._id : t.salesExecutive;
        return seId === seFilter;
      });
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        (typeof t.salesExecutive === 'object' ? t.salesExecutive?.name : '')?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [targets, seFilter, search]);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (t) => {
    setEditTarget(t);
    form.setFieldsValue({
      ...t,
      salesExecutive: typeof t.salesExecutive === 'object' ? t.salesExecutive?._id : t.salesExecutive,
      period: t.startDate && t.endDate ? [dayjs(t.startDate), dayjs(t.endDate)] : undefined,
    });
    setModalOpen(true);
  };

  const saveTarget = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        startDate: values.period?.[0]?.format('YYYY-MM-DD'),
        endDate: values.period?.[1]?.format('YYYY-MM-DD'),
      };
      delete payload.period;

      if (editTarget) {
        await api.put(`/targets/${editTarget._id}`, payload).catch(() => message.warning('Target update endpoint not yet available on backend.'));
      } else {
        await api.post('/targets', payload).catch(() => message.warning('Target creation endpoint not yet available on backend.'));
      }

      setModalOpen(false);
      form.resetFields();
      loadTargets();
      message.success(editTarget ? 'Target updated' : 'Target created');
    } catch (err) {
      if (err.errorFields) return; // validation error — form shows messages
      console.error('Save target error:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTarget = async (id) => {
    try {
      await api.delete(`/targets/${id}`).catch(() => message.warning('Delete endpoint not yet available on backend.'));
      loadTargets();
      message.success('Target deleted');
    } catch (err) {
      console.error('Delete target error:', err);
    }
  };

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Sales Executive',
      key: 'se',
      render: (_, r) => {
        const se = typeof r.salesExecutive === 'object' ? r.salesExecutive : null;
        return se ? <Space><UserOutlined style={{ color: '#FF5F03' }} /><Text strong>{se.name}</Text></Space>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Title / Type',
      key: 'title',
      render: (_, r) => (
        <div>
          <Text strong>{r.title || r.targetType || '—'}</Text>
          {r.targetType && r.title && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.targetType}</Text>}
        </div>
      ),
    },
    {
      title: 'Target Amount',
      dataIndex: 'targetAmount',
      key: 'targetAmount',
      sorter: (a, b) => (a.targetAmount || 0) - (b.targetAmount || 0),
      render: (v) => <Text strong>{fmtCurrency(v)}</Text>,
    },
    {
      title: 'Achieved',
      key: 'achieved',
      render: (_, r) => {
        const pct = r.targetAmount ? Math.min(100, Math.round(((r.achievedAmount || 0) / r.targetAmount) * 100)) : 0;
        return (
          <div style={{ minWidth: 120 }}>
            <Text style={{ fontSize: 11 }}>{fmtCurrency(r.achievedAmount || 0)} ({pct}%)</Text>
            <Progress percent={pct} size="small" strokeColor={pct >= 100 ? '#52c41a' : pct >= 50 ? '#faad14' : '#ff4d4f'} showInfo={false} />
          </div>
        );
      },
    },
    {
      title: 'Period',
      key: 'period',
      render: (_, r) => (
        <Text style={{ fontSize: 12 }}>
          {r.startDate ? new Date(r.startDate).toLocaleDateString('en-IN') : '—'} →{' '}
          {r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '—'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s?.toUpperCase() || 'ACTIVE'}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" icon={<DeleteOutlined />} danger onClick={() => deleteTarget(r._id)} />
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Target Management</Title>
          <Text type="secondary">Set and monitor sales targets per executive</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTargets} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            New Target
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Targets" value={targets.length} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Active" value={targets.filter(t => !t.status || t.status === 'active').length} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic title="Sales Executives" value={salesExecs.length} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic
              title="Total Target Value"
              value={fmtCurrency(targets.reduce((s, t) => s + (t.targetAmount || 0), 0))}
              valueStyle={{ color: '#52c41a', fontSize: 16 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search targets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }} placeholder="Filter by SE">
              <Option value="all">All Executives</Option>
              {salesExecs.map(se => <Option key={se._id} value={se._id}>{se.name}</Option>)}
            </Select>
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
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} targets` }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: 'No targets set. Click "New Target" to create one.' }}
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editTarget ? 'Edit Target' : 'Create New Target'}
        open={modalOpen}
        onOk={saveTarget}
        onCancel={() => { setModalOpen(false); setEditTarget(null); form.resetFields(); }}
        confirmLoading={saving}
        okText={editTarget ? 'Update' : 'Create'}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={520}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="salesExecutive" label="Sales Executive" rules={[{ required: true }]}>
            <Select placeholder="Select SE...">
              {salesExecs.map(se => <Option key={se._id} value={se._id}>{se.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="Target Title" rules={[{ required: true }]}>
            <Input placeholder="e.g. Q3 Sales Target" />
          </Form.Item>
          <Form.Item name="targetType" label="Target Type">
            <Select placeholder="Select type">
              <Option value="sales">Sales (Amount)</Option>
              <Option value="orders">Order Count</Option>
              <Option value="visits">Dealer Visits</Option>
              <Option value="collections">Collections</Option>
            </Select>
          </Form.Item>
          <Form.Item name="targetAmount" label="Target Amount (₹)" rules={[{ required: true }]}>
            <InputNumber style={{ width: '100%' }} min={0} placeholder="500000" />
          </Form.Item>
          <Form.Item name="period" label="Target Period">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
