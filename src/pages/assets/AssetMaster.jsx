import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Row, Col, Statistic, Space, Button, Input, Select, Tag,
  Modal, Form, InputNumber, DatePicker, Typography, message, Descriptions, Divider, Tooltip,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, ReloadOutlined, WarningOutlined,
} from '@ant-design/icons';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

const CATEGORIES = ['IT Equipment', 'Vehicle', 'Furniture', 'Machinery', 'Tools', 'Office Equipment', 'Building', 'Other'];
const CONDITIONS  = ['excellent', 'good', 'fair', 'poor', 'damaged'];

const statusColor = {
  active: 'green', in_use: 'blue', under_maintenance: 'orange',
  disposed: 'red', lost: 'volcano', returned: 'default',
};
const conditionColor = { excellent: 'green', good: 'blue', fair: 'gold', poor: 'orange', damaged: 'red' };

const fmtCurrency = (n) => n ? '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 }) : '₹0';
const fmtDate     = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';

const isWarrantyExpiringSoon = (d) => {
  if (!d) return false;
  const days = dayjs(d).diff(dayjs(), 'day');
  return days >= 0 && days <= 30;
};
const isOverdue = (d) => d && dayjs(d).isBefore(dayjs());

export default function AssetMaster() {
  const [assets, setAssets]       = useState([]);
  const [stats, setStats]         = useState({});
  const [loading, setLoading]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editAsset, setEditAsset] = useState(null);
  const [viewAsset, setViewAsset] = useState(null);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [form] = Form.useForm();

  // ── Fetch stats ─────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    try {
      const res = await api.get('/assets/stats');
      if (res.success) setStats(res.data);
    } catch (_) {}
  }, []);

  // ── Fetch list ──────────────────────────────────────────────────────────────
  const fetchAssets = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
        category: categoryFilter || undefined,
      };
      const res = await api.get('/assets', { params });
      if (res.success) {
        setAssets(res.data);
        setPagination(p => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to load assets');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, categoryFilter, pagination.pageSize]);

  useEffect(() => { fetchStats(); fetchAssets(1); }, []);

  // ── Open create modal ───────────────────────────────────────────────────────
  const openCreate = () => {
    setEditAsset(null);
    form.resetFields();
    form.setFieldsValue({ condition: 'good', depreciationMethod: 'straight_line', usefulLifeYears: 5, depreciationRate: 20 });
    setModalOpen(true);
  };

  // ── Open edit modal ─────────────────────────────────────────────────────────
  const openEdit = (asset) => {
    setEditAsset(asset);
    form.setFieldsValue({
      ...asset,
      purchaseDate:   asset.purchaseDate   ? dayjs(asset.purchaseDate)   : null,
      warrantyExpiry: asset.warrantyExpiry ? dayjs(asset.warrantyExpiry) : null,
      amcExpiry:      asset.amcExpiry      ? dayjs(asset.amcExpiry)      : null,
    });
    setModalOpen(true);
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        ...values,
        purchaseDate:   values.purchaseDate?.toISOString()   ?? null,
        warrantyExpiry: values.warrantyExpiry?.toISOString() ?? null,
        amcExpiry:      values.amcExpiry?.toISOString()      ?? null,
      };
      if (editAsset) {
        await api.put(`/assets/${editAsset._id}`, payload);
        message.success('Asset updated');
      } else {
        await api.post('/assets', payload);
        message.success('Asset created');
      }
      setModalOpen(false);
      fetchStats();
      fetchAssets(1);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to save asset');
    } finally {
      setSaving(false);
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteAsset = async (id) => {
    try {
      await api.delete(`/assets/${id}`);
      message.success('Asset deleted');
      fetchStats();
      fetchAssets(1);
    } catch (err) {
      message.error(err.message || 'Failed to delete');
    }
  };

  // ── Table columns ───────────────────────────────────────────────────────────
  const columns = [
    { title: '#', key: 'idx', render: (_, __, i) => (pagination.current - 1) * pagination.pageSize + i + 1, width: 55 },
    {
      title: 'Asset Code',
      dataIndex: 'assetCode',
      key: 'assetCode',
      render: (v) => <Text strong style={{ color: '#FF5F03', fontFamily: 'monospace' }}>{v}</Text>,
      width: 110,
    },
    {
      title: 'Name',
      key: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          {r.brand && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.brand} {r.modelNumber ? `· ${r.modelNumber}` : ''}</Text>}
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (v) => <Tag color="purple">{v}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={statusColor[s] || 'default'}>{s?.replace('_', ' ')?.toUpperCase()}</Tag>,
    },
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      render: (c) => <Tag color={conditionColor[c] || 'default'}>{c?.toUpperCase()}</Tag>,
    },
    {
      title: 'Assigned To',
      key: 'assigned',
      render: (_, r) => {
        if (!r.assignedToName && !r.assignedTo) return <Text type="secondary">—</Text>;
        const name = r.assignedToName || (typeof r.assignedTo === 'object' ? r.assignedTo?.name : '');
        return <Tag color="blue">{name}</Tag>;
      },
    },
    {
      title: 'Purchase Cost',
      dataIndex: 'purchaseCost',
      key: 'purchaseCost',
      render: (v) => <Text>{fmtCurrency(v)}</Text>,
    },
    {
      title: 'Warranty',
      dataIndex: 'warrantyExpiry',
      key: 'warrantyExpiry',
      render: (d) => {
        if (!d) return <Text type="secondary">—</Text>;
        if (isOverdue(d)) return <Tag color="red">Expired {fmtDate(d)}</Tag>;
        if (isWarrantyExpiringSoon(d)) return (
          <Tooltip title="Expiring in 30 days!">
            <Tag color="orange" icon={<WarningOutlined />}>{fmtDate(d)}</Tag>
          </Tooltip>
        );
        return <Text>{fmtDate(d)}</Text>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 120,
      render: (_, r) => (
        <Space>
          <Tooltip title="View Details">
            <Button size="small" icon={<EyeOutlined />} onClick={() => setViewAsset(r)} />
          </Tooltip>
          <Tooltip title="Edit">
            <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          </Tooltip>
          <Tooltip title="Delete">
            <Button size="small" icon={<DeleteOutlined />} danger onClick={() => deleteAsset(r._id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>Asset Master</Title>
          <Text type="secondary">Register and manage all company assets — equipment, vehicles, furniture</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchAssets(1); }} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Asset
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        {[
          { label: 'Total Assets',      value: stats.total      || 0, color: '#FF5F03', bg: '#fff7f0', border: '#FF5F03' },
          { label: 'Active',            value: stats.active     || 0, color: '#52c41a', bg: '#f6ffed', border: '#52c41a' },
          { label: 'In Use',            value: stats.inUse      || 0, color: '#1890ff', bg: '#e6f7ff', border: '#1890ff' },
          { label: 'Under Maintenance', value: stats.maintenance|| 0, color: '#faad14', bg: '#fffbe6', border: '#faad14' },
          { label: 'Warranty Expiring', value: stats.warrantyExpiringSoon || 0, color: '#fa541c', bg: '#fff2e8', border: '#fa541c' },
          { label: 'Total Value',       value: fmtCurrency(stats.totalCurrentValue), color: '#722ed1', bg: '#f9f0ff', border: '#722ed1', raw: true },
        ].map((s, i) => (
          <Col xs={12} sm={8} lg={4} key={i}>
            <Card bordered={false} style={{ background: s.bg, border: `1px solid ${s.border}` }} bodyStyle={{ padding: '12px 16px' }}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>{s.label}</Text>
              <Text strong style={{ fontSize: s.raw ? 16 : 22, color: s.color }}>{s.value}</Text>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12}>
          <Col xs={24} sm={8}>
            <Input prefix={<SearchOutlined />} placeholder="Search code, name, brand, serial..."
              value={search} onChange={(e) => setSearch(e.target.value)} allowClear />
          </Col>
          <Col xs={24} sm={5}>
            <Select value={statusFilter || undefined} onChange={(v) => setStatusFilter(v || '')}
              style={{ width: '100%' }} placeholder="All Status" allowClear>
              {Object.keys(statusColor).map(s => (
                <Option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={5}>
            <Select value={categoryFilter || undefined} onChange={(v) => setCategoryFilter(v || '')}
              style={{ width: '100%' }} placeholder="All Categories" allowClear>
              {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={6}>
            <Button type="primary" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
              onClick={() => fetchAssets(1)} block>Apply Filters</Button>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={assets}
          rowKey="_id"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (t) => `${t} assets`,
            onChange: (page, size) => { setPagination(p => ({ ...p, pageSize: size })); fetchAssets(page); },
          }}
          locale={{ emptyText: 'No assets found. Click "Add Asset" to get started.' }}
        />
      </Card>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Modal
        title={editAsset ? `Edit Asset — ${editAsset.assetCode}` : 'Add New Asset'}
        open={modalOpen}
        onOk={save}
        onCancel={() => { setModalOpen(false); setEditAsset(null); form.resetFields(); }}
        confirmLoading={saving}
        okText={editAsset ? 'Update' : 'Create'}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={720}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Asset Name" rules={[{ required: true }]}>
                <Input placeholder="e.g. Dell Laptop - L001" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select placeholder="Select category">
                  {CATEGORIES.map(c => <Option key={c} value={c}>{c}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="brand" label="Brand">
                <Input placeholder="e.g. Dell, Toyota, Samsung" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="modelNumber" label="Model Number">
                <Input placeholder="e.g. Latitude 5540" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="serialNumber" label="Serial Number">
                <Input placeholder="SN / Asset Tag" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="location" label="Location / Department">
                <Input placeholder="e.g. Office - Floor 2, Warehouse A" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 12px' }}>Purchase Details</Divider>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="vendor" label="Vendor / Supplier">
                <Input placeholder="Vendor name" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="invoiceNumber" label="Invoice Number">
                <Input placeholder="Vendor invoice no." />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="purchaseDate" label="Purchase Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="purchaseCost" label="Purchase Cost (₹)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="currentValue" label="Current Value (₹)">
                <InputNumber style={{ width: '100%' }} min={0} placeholder="0" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="warrantyExpiry" label="Warranty Expiry">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="amcExpiry" label="AMC Expiry">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="amcVendor" label="AMC Vendor">
                <Input placeholder="AMC service provider" />
              </Form.Item>
            </Col>
          </Row>

          <Divider style={{ margin: '4px 0 12px' }}>Depreciation</Divider>
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="depreciationMethod" label="Method">
                <Select>
                  <Option value="straight_line">Straight Line</Option>
                  <Option value="written_down_value">Written Down Value</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="usefulLifeYears" label="Useful Life (years)">
                <InputNumber style={{ width: '100%' }} min={1} max={50} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="depreciationRate" label="Rate (% / year)">
                <InputNumber style={{ width: '100%' }} min={0} max={100} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="condition" label="Condition">
                <Select>
                  {CONDITIONS.map(c => <Option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</Option>)}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="status" label="Status">
                <Select>
                  {Object.keys(statusColor).map(s => (
                    <Option key={s} value={s}>{s.replace('_', ' ').toUpperCase()}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item name="notes" label="Notes">
                <TextArea rows={2} placeholder="Any additional notes..." />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── View Details Modal ──────────────────────────────────────────────── */}
      <Modal
        title={<Space>📦 <span>{viewAsset?.name}</span> <Text type="secondary" style={{ fontSize: 12 }}>({viewAsset?.assetCode})</Text></Space>}
        open={!!viewAsset}
        onCancel={() => setViewAsset(null)}
        footer={<Button onClick={() => setViewAsset(null)}>Close</Button>}
        width={700}
        destroyOnHidden
      >
        {viewAsset && (
          <Descriptions column={2} bordered size="small">
            <Descriptions.Item label="Asset Code"><Text strong style={{ color: '#FF5F03' }}>{viewAsset.assetCode}</Text></Descriptions.Item>
            <Descriptions.Item label="Category"><Tag color="purple">{viewAsset.category}</Tag></Descriptions.Item>
            <Descriptions.Item label="Brand">{viewAsset.brand || '—'}</Descriptions.Item>
            <Descriptions.Item label="Model">{viewAsset.modelNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Serial No.">{viewAsset.serialNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Location">{viewAsset.location || '—'}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={statusColor[viewAsset.status]}>{viewAsset.status?.replace('_', ' ')?.toUpperCase()}</Tag></Descriptions.Item>
            <Descriptions.Item label="Condition"><Tag color={conditionColor[viewAsset.condition]}>{viewAsset.condition?.toUpperCase()}</Tag></Descriptions.Item>
            <Descriptions.Item label="Vendor">{viewAsset.vendor || '—'}</Descriptions.Item>
            <Descriptions.Item label="Invoice">{viewAsset.invoiceNumber || '—'}</Descriptions.Item>
            <Descriptions.Item label="Purchase Date">{fmtDate(viewAsset.purchaseDate)}</Descriptions.Item>
            <Descriptions.Item label="Purchase Cost">{fmtCurrency(viewAsset.purchaseCost)}</Descriptions.Item>
            <Descriptions.Item label="Current Value">{fmtCurrency(viewAsset.currentValue)}</Descriptions.Item>
            <Descriptions.Item label="Warranty Expiry">{fmtDate(viewAsset.warrantyExpiry)}</Descriptions.Item>
            <Descriptions.Item label="AMC Expiry">{fmtDate(viewAsset.amcExpiry)}</Descriptions.Item>
            <Descriptions.Item label="AMC Vendor">{viewAsset.amcVendor || '—'}</Descriptions.Item>
            <Descriptions.Item label="Assigned To">{viewAsset.assignedToName || '—'}</Descriptions.Item>
            <Descriptions.Item label="Assigned Date">{fmtDate(viewAsset.assignedDate)}</Descriptions.Item>
            <Descriptions.Item label="Depreciation" span={2}>
              {viewAsset.depreciationMethod?.replace('_', ' ')} · {viewAsset.depreciationRate}% / year · {viewAsset.usefulLifeYears} yrs useful life
            </Descriptions.Item>
            {viewAsset.notes && <Descriptions.Item label="Notes" span={2}>{viewAsset.notes}</Descriptions.Item>}
            <Descriptions.Item label="Maintenance Logs" span={2}>
              {viewAsset.maintenanceLogs?.length > 0
                ? `${viewAsset.maintenanceLogs.length} entries — Last: ${fmtDate(viewAsset.lastMaintenanceDate)}`
                : 'None recorded'}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
