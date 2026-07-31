import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Row, Col, Statistic, Space, Button, Input, Select, Tag,
  Modal, Form, DatePicker, Typography, message, Descriptions, Timeline,
} from 'antd';
import {
  UserOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ReloadOutlined, SwapOutlined, HistoryOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import hrmsService from '../../services/hrmsService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;

const statusColor = {
  active: 'green', in_use: 'blue', under_maintenance: 'orange',
  disposed: 'red', lost: 'volcano', returned: 'default',
};
const fmtDate = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';

export default function AssetAssignment() {
  const [assets, setAssets]         = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [assignModal, setAssignModal] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [historyModal, setHistoryModal]   = useState(false);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [stats, setStats]           = useState({ total: 0, inUse: 0, available: 0 });
  const [form] = Form.useForm();

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 20, search: search || undefined };
      if (filterAssigned === 'assigned')   params.status = 'in_use';
      if (filterAssigned === 'available')  params.status = 'active';
      const res = await api.get('/assets', { params });
      if (res.success) {
        setAssets(res.data);
        setPagination(p => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message || 'Failed to load assets'); }
    finally { setLoading(false); }
  }, [search, filterAssigned]);

  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/assets/stats');
      if (res.success) setStats({ total: res.data.total, inUse: res.data.inUse, available: res.data.active });
    } catch (_) {}
  }, []);

  useEffect(() => {
    fetchStats();
    fetchAssets(1);
    hrmsService.getEmployees({ limit: 500, status: 'active' })
      .then(r => setEmployees(r?.data || r?.employees || []))
      .catch(() => {});
  }, []);

  // ── Open assign/unassign modal ────────────────────────────────────────────────
  const openAssign = (asset) => {
    setSelectedAsset(asset);
    form.resetFields();
    form.setFieldsValue({
      employeeId: typeof asset.assignedTo === 'object' ? asset.assignedTo?._id : asset.assignedTo || undefined,
      assignedDate: asset.assignedDate ? dayjs(asset.assignedDate) : dayjs(),
    });
    setAssignModal(true);
  };

  // ── Save assignment ───────────────────────────────────────────────────────────
  const saveAssignment = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      await api.post(`/assets/${selectedAsset._id}/assign`, {
        employeeId: values.employeeId || null,
        assignedDate: values.assignedDate?.toISOString(),
        notes: values.notes || '',
      });
      message.success(values.employeeId ? 'Asset assigned successfully' : 'Asset returned / unassigned');
      setAssignModal(false);
      fetchStats();
      fetchAssets(pagination.current);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  // ── Filtered assets ────────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!search) return assets;
    const q = search.toLowerCase();
    return assets.filter(a =>
      a.name?.toLowerCase().includes(q) ||
      a.assetCode?.toLowerCase().includes(q) ||
      a.assignedToName?.toLowerCase().includes(q)
    );
  }, [assets, search]);

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
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s?.replace('_', ' ')?.toUpperCase()}</Tag>,
    },
    {
      title: 'Assigned To',
      key: 'assignedTo',
      render: (_, r) => {
        const name = r.assignedToName || (typeof r.assignedTo === 'object' ? r.assignedTo?.name : '');
        return name
          ? <Space><UserOutlined style={{ color: '#1890ff' }} /><Text strong>{name}</Text></Space>
          : <Tag color="green">Available</Tag>;
      },
    },
    {
      title: 'Assigned Date',
      dataIndex: 'assignedDate',
      key: 'assignedDate',
      render: (d) => d ? fmtDate(d) : <Text type="secondary">—</Text>,
    },
    {
      title: 'Location',
      dataIndex: 'location',
      key: 'location',
      render: (v) => v || <Text type="secondary">—</Text>,
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button
            size="small"
            type={r.status === 'in_use' ? 'default' : 'primary'}
            icon={<SwapOutlined />}
            onClick={() => openAssign(r)}
            style={r.status !== 'in_use' ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
          >
            {r.status === 'in_use' ? 'Reassign' : 'Assign'}
          </Button>
          {r.status === 'in_use' && (
            <Button size="small" icon={<CloseCircleOutlined />} danger
              onClick={() => {
                setSelectedAsset(r);
                form.resetFields();
                form.setFieldsValue({ assignedDate: dayjs() });
                setAssignModal(true);
              }}>
              Return
            </Button>
          )}
          <Button size="small" icon={<HistoryOutlined />} onClick={() => { setSelectedAsset(r); setHistoryModal(true); }}>
            Log
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
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>Asset Assignment</Title>
          <Text type="secondary">Assign assets to employees and track handover history</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchAssets(1); }} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Assets" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#e6f7ff', border: '1px solid #1890ff' }}>
            <Statistic title="In Use (Assigned)" value={stats.inUse} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Available" value={stats.available} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={10}>
            <Input prefix={<SearchOutlined />} placeholder="Search asset name, code, assigned employee..."
              value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
          </Col>
          <Col xs={24} sm={7}>
            <Select value={filterAssigned} onChange={setFilterAssigned} style={{ width: '100%' }}>
              <Option value="all">All Assets</Option>
              <Option value="assigned">Assigned (In Use)</Option>
              <Option value="available">Available</Option>
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
          scroll={{ x: 950 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `${t} assets`,
            onChange: (page, size) => { setPagination(p => ({ ...p, pageSize: size })); fetchAssets(page); },
          }}
          locale={{ emptyText: 'No assets found.' }}
        />
      </Card>

      {/* ── Assign / Return Modal ───────────────────────────────────────────── */}
      <Modal
        title={<Space>
          <SwapOutlined style={{ color: '#FF5F03' }} />
          {selectedAsset?.status === 'in_use' ? 'Reassign / Return Asset' : 'Assign Asset'}
          {' — '}
          <Text type="secondary">{selectedAsset?.name}</Text>
        </Space>}
        open={assignModal}
        onOk={saveAssignment}
        onCancel={() => { setAssignModal(false); setSelectedAsset(null); form.resetFields(); }}
        confirmLoading={saving}
        okText="Save"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Form.Item name="employeeId" label="Assign To Employee">
            <Select placeholder="Select employee (leave blank to return/unassign)" allowClear showSearch
              filterOption={(input, opt) => opt.children?.toLowerCase().includes(input.toLowerCase())}>
              {employees.map(emp => (
                <Option key={emp._id} value={emp._id}>
                  {emp.name} {emp.empId ? `(${emp.empId})` : ''} — {emp.designation || ''}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="assignedDate" label="Assignment Date">
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="notes" label="Notes / Handover Remarks">
            <Input.TextArea rows={2} placeholder="Optional handover notes..." />
          </Form.Item>
        </Form>
        {selectedAsset?.assignedToName && (
          <Text type="secondary" style={{ display: 'block', marginTop: 8, fontSize: 12 }}>
            Currently assigned to: <Text strong>{selectedAsset.assignedToName}</Text> since {fmtDate(selectedAsset.assignedDate)}
          </Text>
        )}
      </Modal>

      {/* ── History / Log Modal ─────────────────────────────────────────────── */}
      <Modal
        title={<Space><HistoryOutlined style={{ color: '#FF5F03' }} />Asset Log — {selectedAsset?.name}</Space>}
        open={historyModal}
        onCancel={() => { setHistoryModal(false); setSelectedAsset(null); }}
        footer={<Button onClick={() => setHistoryModal(false)}>Close</Button>}
        width={600}
        destroyOnHidden
      >
        {selectedAsset && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Asset Code">{selectedAsset.assetCode}</Descriptions.Item>
              <Descriptions.Item label="Category">{selectedAsset.category}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={statusColor[selectedAsset.status]}>{selectedAsset.status?.replace('_', ' ')?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Current Holder">{selectedAsset.assignedToName || 'Unassigned'}</Descriptions.Item>
            </Descriptions>

            <Text strong style={{ display: 'block', marginBottom: 12 }}>Maintenance History</Text>
            {selectedAsset.maintenanceLogs?.length > 0 ? (
              <Timeline mode="left" items={selectedAsset.maintenanceLogs.slice().reverse().map(log => ({
                label: fmtDate(log.date),
                color: log.status === 'completed' ? 'green' : log.status === 'in_progress' ? 'blue' : 'orange',
                children: (
                  <div>
                    <Text strong>{log.type?.replace('_', ' ')?.toUpperCase()} — {log.description}</Text>
                    {log.cost > 0 && <Text type="secondary" style={{ display: 'block' }}>Cost: ₹{log.cost?.toLocaleString('en-IN')}</Text>}
                    {log.doneBy && <Text type="secondary" style={{ display: 'block' }}>By: {log.doneBy}</Text>}
                    {log.nextDueDate && <Text type="secondary" style={{ display: 'block' }}>Next Due: {fmtDate(log.nextDueDate)}</Text>}
                  </div>
                ),
              }))} />
            ) : (
              <Text type="secondary">No maintenance logs recorded for this asset.</Text>
            )}
          </>
        )}
      </Modal>
    </div>
  );
}
