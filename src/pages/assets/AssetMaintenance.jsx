import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Row, Col, Statistic, Space, Button, Input, Select, Tag,
  Modal, Form, InputNumber, DatePicker, Typography, message, Descriptions, Timeline, Alert, Badge,
} from 'antd';
import {
  ToolOutlined, SearchOutlined, PlusOutlined, ReloadOutlined,
  WarningOutlined, CheckCircleOutlined, ClockCircleOutlined, EyeOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const MAINTENANCE_TYPES = ['preventive', 'corrective', 'inspection', 'repair'];
const MAINTENANCE_STATUS = ['pending', 'in_progress', 'completed'];

const statusColor  = { pending: 'gold', in_progress: 'blue', completed: 'green' };
const typeColor    = { preventive: 'green', corrective: 'orange', inspection: 'blue', repair: 'red' };
const assetStatusColor = { active: 'green', in_use: 'blue', under_maintenance: 'orange', disposed: 'red' };

const fmtDate     = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';
const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
const isDueSoon   = (d) => { if (!d) return false; const days = dayjs(d).diff(dayjs(), 'day'); return days >= 0 && days <= 14; };
const isOverdue   = (d) => d && dayjs(d).isBefore(dayjs());

export default function AssetMaintenance() {
  const [assets, setAssets]           = useState([]);
  const [loading, setLoading]         = useState(false);
  const [logModal, setLogModal]       = useState(false);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [saving, setSaving]           = useState(false);
  const [search, setSearch]           = useState('');
  const [dueFilter, setDueFilter]     = useState('all');
  const [stats, setStats]             = useState({ total: 0, maintenance: 0, dueSoon: 0, overdue: 0 });
  const [pagination, setPagination]   = useState({ current: 1, pageSize: 20, total: 0 });
  const [form] = Form.useForm();

  // ── Fetch ──────────────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20, search: search || undefined };
      if (dueFilter === 'under_maintenance') params.status = 'under_maintenance';
      const res = await api.get('/assets', { params });
      if (res.success) {
        setAssets(res.data);
        setPagination(p => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
        // Compute stats from loaded data
        const all = res.data;
        const maintenance = all.filter(a => a.status === 'under_maintenance').length;
        const dueSoon = all.filter(a => isDueSoon(a.nextMaintenanceDue)).length;
        const overdue = all.filter(a => isOverdue(a.nextMaintenanceDue)).length;
        setStats({ total: all.length, maintenance, dueSoon, overdue });
      }
    } catch (err) { message.error(err.message || 'Failed to load assets'); }
    finally { setLoading(false); }
  }, [search, dueFilter]);

  useEffect(() => { fetchAssets(1); }, []);

  // ── Log maintenance entry ───────────────────────────────────────────────────────
  const openLogModal = (asset) => {
    setSelectedAsset(asset);
    form.resetFields();
    form.setFieldsValue({
      date: dayjs(),
      type: 'preventive',
      status: 'completed',
    });
    setLogModal(true);
  };

  const saveLog = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        date:        values.date?.toISOString(),
        nextDueDate: values.nextDueDate?.toISOString() ?? null,
      };
      await api.post(`/assets/${selectedAsset._id}/maintenance`, payload);
      message.success('Maintenance log added');
      setLogModal(false);
      form.resetFields();
      fetchAssets(pagination.current);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to save log');
    } finally {
      setSaving(false);
    }
  };

  // ── Update asset status to under_maintenance ──────────────────────────────────
  const sendToMaintenance = async (id) => {
    try {
      await api.patch(`/assets/${id}/status`, { status: 'under_maintenance' });
      message.success('Asset sent to maintenance');
      fetchAssets(pagination.current);
    } catch (err) { message.error(err.message); }
  };

  // ── Filtered (client-side search for already loaded data) ─────────────────────
  const filtered = useMemo(() => {
    if (dueFilter === 'due_soon') return assets.filter(a => isDueSoon(a.nextMaintenanceDue));
    if (dueFilter === 'overdue')  return assets.filter(a => isOverdue(a.nextMaintenanceDue));
    return assets;
  }, [assets, dueFilter]);

  // ── Table columns ──────────────────────────────────────────────────────────────
  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => (pagination.current - 1) * 20 + i + 1, width: 55 },
    {
      title: 'Asset',
      key: 'asset',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
            {r.assetCode} · {r.category}
          </Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={assetStatusColor[s] || 'default'}>{s?.replace('_', ' ')?.toUpperCase()}</Tag>,
    },
    {
      title: 'Last Maintenance',
      dataIndex: 'lastMaintenanceDate',
      key: 'lastMaintenanceDate',
      render: (d) => d ? fmtDate(d) : <Text type="secondary">Never</Text>,
    },
    {
      title: 'Next Due',
      dataIndex: 'nextMaintenanceDue',
      key: 'nextMaintenanceDue',
      render: (d) => {
        if (!d) return <Text type="secondary">—</Text>;
        if (isOverdue(d))  return <Tag color="red" icon={<WarningOutlined />}>Overdue — {fmtDate(d)}</Tag>;
        if (isDueSoon(d))  return <Tag color="orange" icon={<ClockCircleOutlined />}>Due {fmtDate(d)}</Tag>;
        return <Text style={{ color: '#52c41a' }}>{fmtDate(d)}</Text>;
      },
    },
    {
      title: 'Logs',
      key: 'logCount',
      render: (_, r) => {
        const count = r.maintenanceLogs?.length || 0;
        return count > 0
          ? <Badge count={count} style={{ background: '#FF5F03' }} />
          : <Text type="secondary">0</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 200,
      render: (_, r) => (
        <Space>
          <Button size="small" icon={<PlusOutlined />} type="primary"
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
            onClick={() => openLogModal(r)}>
            Log
          </Button>
          {r.status !== 'under_maintenance' && (
            <Button size="small" icon={<ToolOutlined />} onClick={() => sendToMaintenance(r._id)}>
              Send to Maint.
            </Button>
          )}
          <Button size="small" icon={<EyeOutlined />}
            onClick={() => { setSelectedAsset(r); setDetailModal(true); }}>
            History
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>Asset Maintenance</Title>
          <Text type="secondary">Log maintenance activities, track service history and upcoming due dates</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => fetchAssets(1)} loading={loading}>Refresh</Button>
      </div>

      {/* Overdue / Due Soon Banner */}
      {(stats.overdue > 0 || stats.dueSoon > 0) && (
        <Alert
          style={{ marginBottom: 16 }}
          type="warning"
          icon={<WarningOutlined />}
          showIcon
          message={
            <span>
              {stats.overdue > 0 && <><Text strong style={{ color: '#ff4d4f' }}>{stats.overdue} asset{stats.overdue > 1 ? 's' : ''} overdue</Text> for maintenance. </>}
              {stats.dueSoon > 0 && <><Text strong style={{ color: '#faad14' }}>{stats.dueSoon} asset{stats.dueSoon > 1 ? 's' : ''} due within 14 days.</Text></>}
            </span>
          }
        />
      )}

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Assets" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fffbe6', border: '1px solid #faad14' }}>
            <Statistic title="Under Maintenance" value={stats.maintenance} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff2e8', border: '1px solid #fa8c16' }}>
            <Statistic title="Due in 14 Days" value={stats.dueSoon} valueStyle={{ color: '#fa8c16' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Overdue" value={stats.overdue} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Input prefix={<SearchOutlined />} placeholder="Search asset name, code..."
              value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
          </Col>
          <Col xs={24} sm={7}>
            <Select value={dueFilter} onChange={setDueFilter} style={{ width: '100%' }}>
              <Option value="all">All Assets</Option>
              <Option value="due_soon">Due Soon (14 days)</Option>
              <Option value="overdue">Overdue</Option>
              <Option value="under_maintenance">Under Maintenance</Option>
            </Select>
          </Col>
          <Col xs={24} sm={7}>
            <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
              onClick={() => fetchAssets(1)} block>Apply</Button>
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
          scroll={{ x: 1000 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `${t} assets`,
            onChange: (page, size) => { setPagination(p => ({ ...p, pageSize: size })); fetchAssets(page); },
          }}
          locale={{ emptyText: 'No assets found.' }}
          rowClassName={(r) => isOverdue(r.nextMaintenanceDue) ? 'table-row-red' : isDueSoon(r.nextMaintenanceDue) ? 'table-row-warn' : ''}
        />
      </Card>

      {/* ── Log Maintenance Modal ────────────────────────────────────────────── */}
      <Modal
        title={<Space><ToolOutlined style={{ color: '#FF5F03' }} />Log Maintenance — {selectedAsset?.name}</Space>}
        open={logModal}
        onOk={saveLog}
        onCancel={() => { setLogModal(false); setSelectedAsset(null); form.resetFields(); }}
        confirmLoading={saving}
        okText="Save Log"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="date" label="Maintenance Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select>
                  {MAINTENANCE_TYPES.map(t => (
                    <Option key={t} value={t}>
                      <Tag color={typeColor[t]}>{t.toUpperCase()}</Tag>
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="description" label="Description / Work Done" rules={[{ required: true, message: 'Please describe the maintenance work.' }]}>
            <TextArea rows={2} placeholder="Describe the maintenance performed..." />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="cost" label="Cost (₹)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="doneBy" label="Performed By">
                <Input placeholder="Technician or vendor name" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="nextDueDate" label="Next Maintenance Due">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select>
                  {MAINTENANCE_STATUS.map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Remarks">
            <TextArea rows={1} placeholder="Optional remarks..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── History Modal ──────────────────────────────────────────────────── */}
      <Modal
        title={<Space><EyeOutlined style={{ color: '#FF5F03' }} />Maintenance History — {selectedAsset?.name}</Space>}
        open={detailModal}
        onCancel={() => { setDetailModal(false); setSelectedAsset(null); }}
        footer={<Button onClick={() => setDetailModal(false)}>Close</Button>}
        width={680}
        destroyOnHidden
      >
        {selectedAsset && (
          <>
            <Descriptions column={3} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Asset Code">{selectedAsset.assetCode}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={assetStatusColor[selectedAsset.status]}>{selectedAsset.status?.replace('_', ' ')?.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Last Maintenance">{fmtDate(selectedAsset.lastMaintenanceDate)}</Descriptions.Item>
              <Descriptions.Item label="Next Due" span={2}>
                {selectedAsset.nextMaintenanceDue
                  ? <Tag color={isOverdue(selectedAsset.nextMaintenanceDue) ? 'red' : isDueSoon(selectedAsset.nextMaintenanceDue) ? 'orange' : 'green'}>
                      {fmtDate(selectedAsset.nextMaintenanceDue)}
                    </Tag>
                  : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Total Cost">
                {fmtCurrency(selectedAsset.maintenanceLogs?.reduce((s, l) => s + (l.cost || 0), 0))}
              </Descriptions.Item>
            </Descriptions>

            {selectedAsset.maintenanceLogs?.length > 0 ? (
              <Timeline mode="left" items={[...selectedAsset.maintenanceLogs].reverse().map(log => ({
                label: fmtDate(log.date),
                color: log.status === 'completed' ? 'green' : log.status === 'in_progress' ? 'blue' : 'orange',
                dot: log.status === 'completed' ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : undefined,
                children: (
                  <div style={{ paddingBottom: 8 }}>
                    <Space>
                      <Tag color={typeColor[log.type]}>{log.type?.toUpperCase()}</Tag>
                      <Tag color={statusColor[log.status]}>{log.status?.replace('_', ' ')?.toUpperCase()}</Tag>
                    </Space>
                    <Text style={{ display: 'block', marginTop: 4 }}>{log.description}</Text>
                    <Space style={{ marginTop: 4 }} wrap>
                      {log.cost > 0 && <Text type="secondary" style={{ fontSize: 11 }}>Cost: {fmtCurrency(log.cost)}</Text>}
                      {log.doneBy && <Text type="secondary" style={{ fontSize: 11 }}>By: {log.doneBy}</Text>}
                      {log.nextDueDate && <Text type="secondary" style={{ fontSize: 11 }}>Next: {fmtDate(log.nextDueDate)}</Text>}
                    </Space>
                    {log.remarks && <Text type="secondary" style={{ display: 'block', fontSize: 11, fontStyle: 'italic' }}>{log.remarks}</Text>}
                  </div>
                ),
              }))} />
            ) : (
              <Text type="secondary">No maintenance logs recorded yet. Click "Log" to add the first entry.</Text>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
