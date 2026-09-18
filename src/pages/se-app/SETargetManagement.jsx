import React, { useState, useEffect, useMemo } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Form, InputNumber, DatePicker, Progress, message, Tooltip, Popconfirm, Alert } from 'antd';
import { UserOutlined, ReloadOutlined, SearchOutlined, PlusOutlined, EditOutlined, DeleteOutlined, PauseCircleOutlined, PlayCircleOutlined, LockOutlined } from '@ant-design/icons';
import userService from '../../services/userService';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const fmtCurrency = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const fmtCount = (n) => Number(n || 0).toLocaleString('en-IN');

/** Targets are measured in rupees or in a plain count, depending on the metric. */
const fmtValue = (value, unit) => (unit === 'count' ? fmtCount(value) : fmtCurrency(value));

const statusColor = {
  active: 'green',
  completed: 'blue',
  expired: 'red',
  paused: 'orange',
  closed: 'default',
  scheduled: 'purple',
};

const METRIC_FALLBACK = [
  { value: 'sales', label: 'Sales Value', unit: 'currency' },
  { value: 'orders', label: 'Order Count', unit: 'count' },
  { value: 'visits', label: 'Dealer Visits', unit: 'count' },
  { value: 'collections', label: 'Collections', unit: 'currency' },
];

const PERIODS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'half_yearly', label: 'Half Yearly' },
  { value: 'annual', label: 'Annual' },
  { value: 'one_time', label: 'One Time' },
];

/**
 * The axios instance's response interceptor already unwraps to `response.data`
 * and raises a global toast for every failure, so handlers here only add inline
 * context and success feedback.
 */
const apiMessage = (err, fallback) => err?.message || fallback;

export default function SETargetManagement() {
  const [targets, setTargets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [metrics, setMetrics] = useState(METRIC_FALLBACK);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [seFilter, setSeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [form] = Form.useForm();

  const formMetric = Form.useWatch('targetMetric', form) || 'sales';
  const formUnit = useMemo(
    () => metrics.find((m) => m.value === formMetric)?.unit || 'currency',
    [metrics, formMetric],
  );

  const loadSEs = async () => {
    try {
      const usersRes = await userService.getUsers({ role: 'sales_executive', limit: 100 });
      setSalesExecs(usersRes?.data || usersRes?.users || []);
    } catch {
      // The interceptor has already told the user; the SE dropdown simply stays empty.
    }
  };

  const loadMeta = async () => {
    try {
      const res = await api.get('/targets/meta');
      const list = res?.data?.metrics;
      if (Array.isArray(list) && list.length) {
        setMetrics(list.map((m) => ({ value: m.value, label: m.label, unit: m.unit })));
      }
    } catch {
      // Labels are cosmetic — fall back to the local list rather than blocking the page.
      setMetrics(METRIC_FALLBACK);
    }
  };

  const loadTargets = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.get('/targets');
      setTargets(res?.data || []);
      setSummary(res?.summary || null);
    } catch (err) {
      setTargets([]);
      setSummary(null);
      setLoadError(apiMessage(err, 'Could not load targets.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSEs(); loadMeta(); loadTargets(); }, []);

  const filtered = useMemo(() => {
    let list = targets;
    if (seFilter !== 'all') {
      list = list.filter((t) => String(t.salesExecutive?._id || '') === seFilter);
    }
    if (statusFilter !== 'all') {
      list = list.filter((t) => t.status === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((t) =>
        t.title?.toLowerCase().includes(q) ||
        t.incentiveCode?.toLowerCase().includes(q) ||
        t.salesExecutive?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [targets, seFilter, statusFilter, search]);

  const openCreate = () => {
    setEditTarget(null);
    form.resetFields();
    form.setFieldsValue({ targetMetric: 'sales', period: 'monthly' });
    setModalOpen(true);
  };

  const openEdit = (t) => {
    setEditTarget(t);
    form.setFieldsValue({
      salesExecutive: t.salesExecutive?._id,
      title: t.title,
      targetMetric: t.targetMetric || 'sales',
      targetValue: t.targetValue,
      bonusOnTarget: t.bonusOnTarget || 0,
      period: t.period || 'monthly',
      range: t.startDate && t.endDate ? [dayjs(t.startDate), dayjs(t.endDate)] : undefined,
      notes: t.notes,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditTarget(null);
    form.resetFields();
  };

  const saveTarget = async () => {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return; // the form renders its own field errors
    }

    const payload = {
      salesExecutive: values.salesExecutive,
      title: values.title,
      targetMetric: values.targetMetric,
      targetValue: values.targetValue,
      bonusOnTarget: values.bonusOnTarget || 0,
      period: values.period,
      startDate: values.range?.[0]?.format('YYYY-MM-DD'),
      endDate: values.range?.[1]?.format('YYYY-MM-DD'),
      notes: values.notes || '',
    };

    setSaving(true);
    try {
      if (editTarget) {
        await api.put(`/targets/${editTarget._id}`, payload);
        message.success('Target updated. The executive sees the new figure immediately.');
      } else {
        await api.post('/targets', payload);
        message.success('Target created and live on the executive app.');
      }
      closeModal();
      loadTargets();
    } catch {
      // Left open so the user can correct the form; the interceptor shows the reason.
    } finally {
      setSaving(false);
    }
  };

  const setStatus = async (row, status) => {
    try {
      await api.patch(`/targets/${row._id}/status`, { status });
      message.success(`Target ${status}.`);
      loadTargets();
    } catch { /* reported by the interceptor */ }
  };

  const deleteTarget = async (row) => {
    try {
      await api.delete(`/targets/${row._id}`);
      message.success('Target deleted.');
      loadTargets();
    } catch { /* reported by the interceptor */ }
  };

  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => i + 1, width: 55 },
    {
      title: 'Sales Executive',
      key: 'se',
      render: (_, r) => (r.salesExecutive ? (
        <Space>
          <UserOutlined style={{ color: '#FF5F03' }} />
          <Text strong>{r.salesExecutive.name}</Text>
        </Space>
      ) : <Text type="secondary">—</Text>),
    },
    {
      title: 'Target',
      key: 'title',
      render: (_, r) => (
        <div>
          <Text strong>{r.title}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
            {r.metricLabel} · {r.incentiveCode}
          </Text>
        </div>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'targetValue',
      key: 'targetValue',
      sorter: (a, b) => (a.targetValue || 0) - (b.targetValue || 0),
      render: (v, r) => <Text strong>{fmtValue(v, r.unit)}</Text>,
    },
    {
      title: 'Achieved',
      key: 'achieved',
      sorter: (a, b) => (a.progressPercent || 0) - (b.progressPercent || 0),
      render: (_, r) => {
        const pct = Math.min(100, Math.round(r.progressPercent || 0));
        return (
          <div style={{ minWidth: 130 }}>
            <Text style={{ fontSize: 11 }}>
              {fmtValue(r.achievedValue, r.unit)} ({Math.round(r.progressPercent || 0)}%)
            </Text>
            <Progress
              percent={pct}
              size="small"
              strokeColor={pct >= 100 ? '#52c41a' : pct >= 50 ? '#faad14' : '#ff4d4f'}
              showInfo={false}
            />
          </div>
        );
      },
    },
    {
      title: 'Period',
      key: 'period',
      render: (_, r) => (
        <Text style={{ fontSize: 12 }}>
          {r.startDate ? dayjs(r.startDate).format('DD MMM YY') : '—'} →{' '}
          {r.endDate ? dayjs(r.endDate).format('DD MMM YY') : '—'}
        </Text>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s] || 'default'}>{String(s || '').toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, r) => {
        if (r.shared) {
          return (
            <Tooltip title="Shared incentive rule covering more than one executive. Edit it from Incentive Rules.">
              <Tag icon={<LockOutlined />} color="default">Shared rule</Tag>
            </Tooltip>
          );
        }
        return (
          <Space>
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
            </Tooltip>
            {r.ruleStatus === 'paused' ? (
              <Tooltip title="Resume">
                <Button size="small" icon={<PlayCircleOutlined />} onClick={() => setStatus(r, 'active')} />
              </Tooltip>
            ) : (
              <Tooltip title="Pause">
                <Button size="small" icon={<PauseCircleOutlined />} onClick={() => setStatus(r, 'paused')} />
              </Tooltip>
            )}
            <Popconfirm
              title="Delete this target?"
              description="Targets with incentive earning history cannot be deleted."
              onConfirm={() => deleteTarget(r)}
              okText="Delete"
              okButtonProps={{ danger: true }}
            >
              <Button size="small" icon={<DeleteOutlined />} danger />
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Target Management</Title>
          <Text type="secondary">
            Set sales, order, visit and collection targets per executive. Achievement is computed live and mirrors the executive app.
          </Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadTargets} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            New Target
          </Button>
        </Space>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          message="Targets could not be loaded"
          description={loadError}
          action={<Button size="small" onClick={loadTargets}>Retry</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Targets" value={summary?.totalTargets ?? targets.length} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Active" value={summary?.active ?? 0} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic title="Achieved" value={summary?.completed ?? 0} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Tooltip title="Sums value-based targets only. Order and visit counts are excluded.">
              <Statistic
                title="Value Targets (₹)"
                value={fmtCurrency(summary?.totalTargetValue)}
                valueStyle={{ color: '#52c41a', fontSize: 16 }}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search title, code or executive..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={8}>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }}>
              <Option value="all">All Executives</Option>
              {salesExecs.map((se) => <Option key={se._id} value={se._id}>{se.name}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={8}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
              <Option value="all">All Statuses</Option>
              {['active', 'scheduled', 'completed', 'expired', 'paused', 'closed'].map((s) => (
                <Option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</Option>
              ))}
            </Select>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey={(r) => r.rowKey || r._id}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} targets` }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: loadError ? 'Targets unavailable.' : 'No targets set. Click "New Target" to create one.' }}
        />
      </Card>

      <Modal
        title={editTarget ? 'Edit Target' : 'Create New Target'}
        open={modalOpen}
        onOk={saveTarget}
        onCancel={closeModal}
        confirmLoading={saving}
        okText={editTarget ? 'Update' : 'Create'}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={540}
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="salesExecutive" label="Sales Executive" rules={[{ required: true, message: 'Pick one sales executive.' }]}>
            <Select placeholder="Select SE..." showSearch optionFilterProp="children">
              {salesExecs.map((se) => <Option key={se._id} value={se._id}>{se.name}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="Target Title" rules={[{ required: true, message: 'Give the target a name.' }]}>
            <Input placeholder="e.g. Q3 Sales Target" />
          </Form.Item>
          <Form.Item name="targetMetric" label="Measured On" rules={[{ required: true }]}>
            <Select>
              {metrics.map((m) => <Option key={m.value} value={m.value}>{m.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item
            name="targetValue"
            label={formUnit === 'count' ? 'Target Count' : 'Target Amount (₹)'}
            rules={[{ required: true, message: 'Enter a target greater than zero.' }]}
          >
            <InputNumber style={{ width: '100%' }} min={formUnit === 'count' ? 1 : 1} placeholder={formUnit === 'count' ? '25' : '500000'} />
          </Form.Item>
          <Form.Item name="bonusOnTarget" label="Bonus On Achievement (₹)" tooltip="Paid through the incentive earning workflow when the target is met.">
            <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
          </Form.Item>
          <Form.Item name="period" label="Period" rules={[{ required: true }]}>
            <Select>
              {PERIODS.map((p) => <Option key={p.value} value={p.value}>{p.label}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="range" label="Target Window" rules={[{ required: true, message: 'Pick the start and end dates.' }]}>
            <RangePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes">
            <Input.TextArea rows={2} placeholder="Optional notes..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
