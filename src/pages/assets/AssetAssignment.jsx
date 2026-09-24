import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Card, Row, Col, Statistic, Space, Button, Input, Select, Tag,
  Modal, Form, DatePicker, Typography, message, Descriptions, Timeline,
  Dropdown, Checkbox, Empty, Spin, Alert,
} from 'antd';
import {
  UserOutlined, SearchOutlined, CloseCircleOutlined, ReloadOutlined,
  SwapOutlined, HistoryOutlined, WarningOutlined, MoreOutlined,
  EnvironmentOutlined,
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
const conditionColor = {
  excellent: 'green', good: 'cyan', fair: 'gold', poor: 'orange', damaged: 'red',
};
const CONDITIONS = ['excellent', 'good', 'fair', 'poor', 'damaged'];

// Custody trail presentation. Red is reserved for the genuinely bad outcomes
// (damage, loss, disposal) so the timeline reads at a glance.
const movementMeta = {
  assigned:      { label: 'Assigned',       color: 'blue'    },
  returned:      { label: 'Returned',       color: 'green'   },
  transferred:   { label: 'Transferred',    color: 'purple'  },
  damaged:       { label: 'Damaged',        color: 'red'     },
  lost:          { label: 'Lost',           color: 'red'     },
  disposed:      { label: 'Disposed',       color: 'red'     },
  repaired:      { label: 'Repaired',       color: 'green'   },
  status_change: { label: 'Status Change',  color: 'gray'    },
};

const fmtDate = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';
const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function AssetAssignment() {
  const [assets, setAssets]         = useState([]);
  const [employees, setEmployees]   = useState([]);
  const [loading, setLoading]       = useState(false);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [search, setSearch]         = useState('');
  const [filterAssigned, setFilterAssigned] = useState('all');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [stats, setStats]           = useState({ total: 0, inUse: 0, available: 0 });

  // One modal flag per action keeps the form schemas from bleeding into each other.
  const [assignModal, setAssignModal]   = useState(false);
  const [returnModal, setReturnModal]   = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [damageModal, setDamageModal]   = useState(false);
  const [historyModal, setHistoryModal] = useState(false);

  const [movements, setMovements]       = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [assignForm]   = Form.useForm();
  const [returnForm]   = Form.useForm();
  const [transferForm] = Form.useForm();
  const [damageForm]   = Form.useForm();

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

  const refresh = () => { fetchStats(); fetchAssets(pagination.current); };

  const afterAction = (msg) => {
    message.success(msg);
    setAssignModal(false);
    setReturnModal(false);
    setTransferModal(false);
    setDamageModal(false);
    refresh();
  };

  // ── Assign / reassign ─────────────────────────────────────────────────────────
  const openAssign = (asset) => {
    setSelectedAsset(asset);
    assignForm.resetFields();
    assignForm.setFieldsValue({
      assignedDate: dayjs(),
      location: asset.location || undefined,
    });
    setAssignModal(true);
  };

  const saveAssignment = async () => {
    try {
      const values = await assignForm.validateFields();
      setSaving(true);
      const res = await api.post(`/assets/${selectedAsset._id}/assign`, {
        employeeId: values.employeeId,
        assignedDate: values.assignedDate?.toISOString(),
        location: values.location,
        remarks: values.remarks || '',
      });
      afterAction(res?.message || 'Asset assigned');
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to update assignment');
    } finally { setSaving(false); }
  };

  // ── Return ────────────────────────────────────────────────────────────────────
  const openReturn = (asset) => {
    setSelectedAsset(asset);
    returnForm.resetFields();
    returnForm.setFieldsValue({ returnDate: dayjs(), condition: asset.condition || 'good' });
    setReturnModal(true);
  };

  const saveReturn = async () => {
    try {
      const values = await returnForm.validateFields();
      setSaving(true);
      await api.post(`/assets/${selectedAsset._id}/return`, {
        returnDate: values.returnDate?.toISOString(),
        condition: values.condition,
        location: values.location,
        remarks: values.remarks || '',
      });
      afterAction('Asset returned');
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to record return');
    } finally { setSaving(false); }
  };

  // ── Transfer (location / department move) ─────────────────────────────────────
  const openTransfer = (asset) => {
    setSelectedAsset(asset);
    transferForm.resetFields();
    transferForm.setFieldsValue({
      date: dayjs(),
      location: asset.location || undefined,
      department: asset.department || undefined,
    });
    setTransferModal(true);
  };

  const saveTransfer = async () => {
    try {
      const values = await transferForm.validateFields();
      setSaving(true);
      await api.post(`/assets/${selectedAsset._id}/transfer`, {
        toEmployeeId: values.toEmployeeId || undefined,
        location: values.location,
        department: values.department,
        date: values.date?.toISOString(),
        reason: values.reason || '',
        remarks: values.remarks || '',
      });
      afterAction('Asset transferred');
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to transfer asset');
    } finally { setSaving(false); }
  };

  // ── Damage / loss ─────────────────────────────────────────────────────────────
  const openDamage = (asset) => {
    setSelectedAsset(asset);
    damageForm.resetFields();
    damageForm.setFieldsValue({ date: dayjs(), lost: false });
    setDamageModal(true);
  };

  const saveDamage = async () => {
    try {
      const values = await damageForm.validateFields();
      setSaving(true);
      await api.post(`/assets/${selectedAsset._id}/damage`, {
        date: values.date?.toISOString(),
        reason: values.reason,
        remarks: values.remarks || '',
        lost: !!values.lost,
      });
      afterAction(values.lost ? 'Asset marked as lost' : 'Damage recorded');
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to record damage');
    } finally { setSaving(false); }
  };

  // ── History ───────────────────────────────────────────────────────────────────
  const openHistory = async (asset) => {
    setSelectedAsset(asset);
    setMovements([]);
    setHistoryModal(true);
    setHistoryLoading(true);
    try {
      const res = await api.get(`/assets/${asset._id}/movements`);
      if (res.success) setMovements(res.data?.movements || []);
    } catch (err) {
      message.error(err.message || 'Failed to load asset history');
    } finally { setHistoryLoading(false); }
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

  const employeeOptions = useMemo(() => employees.map(emp => ({
    value: emp._id,
    label: `${emp.name}${emp.empId ? ` (${emp.empId})` : ''}${emp.designation ? ` — ${emp.designation}` : ''}`,
  })), [employees]);

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
      render: (s) => <Tag color={statusColor[s] || 'default'}>{titleCase(s)}</Tag>,
    },
    {
      title: 'Condition',
      dataIndex: 'condition',
      key: 'condition',
      render: (c) => c ? <Tag color={conditionColor[c] || 'default'}>{titleCase(c)}</Tag> : <Text type="secondary">—</Text>,
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
      width: 210,
      render: (_, r) => {
        const isHeld = !!(r.assignedTo);
        return (
          <Space size={4}>
            <Button
              size="small"
              type={isHeld ? 'default' : 'primary'}
              icon={<SwapOutlined />}
              onClick={() => openAssign(r)}
              disabled={r.status === 'disposed'}
              style={!isHeld && r.status !== 'disposed' ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
            >
              {isHeld ? 'Reassign' : 'Assign'}
            </Button>
            {isHeld && (
              <Button size="small" icon={<CloseCircleOutlined />} onClick={() => openReturn(r)}>
                Return
              </Button>
            )}
            <Button size="small" icon={<HistoryOutlined />} onClick={() => openHistory(r)}>
              History
            </Button>
            <Dropdown
              trigger={['click']}
              menu={{
                items: [
                  { key: 'transfer', icon: <EnvironmentOutlined />, label: 'Transfer / Move', disabled: r.status === 'disposed' },
                  { key: 'damage', icon: <WarningOutlined />, label: 'Report Damage / Loss', danger: true },
                ],
                onClick: ({ key }) => {
                  if (key === 'transfer') openTransfer(r);
                  if (key === 'damage')   openDamage(r);
                },
              }}
            >
              <Button size="small" icon={<MoreOutlined />} aria-label={`More actions for ${r.name}`} />
            </Dropdown>
          </Space>
        );
      },
    },
  ];

  const movementItems = movements.map((m) => {
    const meta = movementMeta[m.type] || { label: titleCase(m.type), color: 'gray' };
    const custody = m.toEmployeeName
      ? (m.fromEmployeeName ? `${m.fromEmployeeName} → ${m.toEmployeeName}` : `→ ${m.toEmployeeName}`)
      : (m.fromEmployeeName ? `${m.fromEmployeeName} → Company` : '');
    const locationMoved = m.fromLocation !== m.toLocation && (m.fromLocation || m.toLocation);
    return {
      label: fmtDate(m.date),
      color: meta.color,
      children: (
        <div>
          <Text strong>{meta.label}</Text>
          {custody && <Text style={{ display: 'block' }}>{custody}</Text>}
          {locationMoved && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Location: {m.fromLocation || '—'} → {m.toLocation || '—'}
            </Text>
          )}
          {m.statusBefore !== m.statusAfter && (m.statusBefore || m.statusAfter) && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Status: {titleCase(m.statusBefore) || '—'} → {titleCase(m.statusAfter) || '—'}
            </Text>
          )}
          {m.conditionBefore !== m.conditionAfter && (m.conditionBefore || m.conditionAfter) && (
            <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
              Condition: {titleCase(m.conditionBefore) || '—'} → {titleCase(m.conditionAfter) || '—'}
            </Text>
          )}
          {m.reason  && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Reason: {m.reason}</Text>}
          {m.remarks && <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>Remarks: {m.remarks}</Text>}
          {m.recordedByName && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>Recorded by {m.recordedByName}</Text>}
        </div>
      ),
    };
  });

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>Asset Assignment</Title>
          <Text type="secondary">Assign, return, transfer and track the full custody history of every asset</Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchStats(); fetchAssets(1); }} loading={loading}>Refresh</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card variant="borderless" style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Assets" value={stats.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card variant="borderless" style={{ background: '#e6f7ff', border: '1px solid #1890ff' }}>
            <Statistic title="In Use (Assigned)" value={stats.inUse} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card variant="borderless" style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
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
          scroll={{ x: 1150 }}
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

      {/* ── Assign / Reassign ───────────────────────────────────────────────── */}
      <Modal
        title={<Space>
          <SwapOutlined style={{ color: '#FF5F03' }} />
          {selectedAsset?.assignedTo ? 'Reassign Asset' : 'Assign Asset'}
          {' — '}
          <Text type="secondary">{selectedAsset?.name}</Text>
        </Space>}
        open={assignModal}
        onOk={saveAssignment}
        onCancel={() => { setAssignModal(false); assignForm.resetFields(); }}
        confirmLoading={saving}
        okText="Save"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={720}
        destroyOnHidden
      >
        {selectedAsset?.assignedToName && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={`Currently held by ${selectedAsset.assignedToName} since ${fmtDate(selectedAsset.assignedDate)}`}
            description="Saving will record this as a transfer from the current holder to the new employee."
          />
        )}
        <Form form={assignForm} layout="vertical">
          <Form.Item
            name="employeeId"
            label="Assign To Employee"
            rules={[{ required: true, message: 'Select the employee receiving this asset.' }]}
          >
            <Select placeholder="Select employee" showSearch optionFilterProp="label" options={employeeOptions} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="assignedDate" label="Assignment Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="location" label="Location">
                <Input placeholder="e.g. Head Office / Floor 2" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Handover Remarks">
            <Input.TextArea rows={2} placeholder="Optional handover notes recorded on the custody trail..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Return ──────────────────────────────────────────────────────────── */}
      <Modal
        title={<Space><CloseCircleOutlined style={{ color: '#D46B08' }} />Return Asset — <Text type="secondary">{selectedAsset?.name}</Text></Space>}
        open={returnModal}
        onOk={saveReturn}
        onCancel={() => { setReturnModal(false); returnForm.resetFields(); }}
        confirmLoading={saving}
        okText="Record Return"
        width={640}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Returning from <Text strong>{selectedAsset?.assignedToName || '—'}</Text>. An asset returned as
          {' '}<Text strong>damaged</Text> goes to maintenance instead of back into the available pool.
        </Text>
        <Form form={returnForm} layout="vertical">
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="returnDate" label="Return Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="condition" label="Condition On Return" rules={[{ required: true }]}>
                <Select options={CONDITIONS.map(c => ({ value: c, label: titleCase(c) }))} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="location" label="Stored At (Location)">
            <Input placeholder="e.g. Store Room / Rack 4" />
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} placeholder="Condition notes, missing accessories..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Transfer / Move ─────────────────────────────────────────────────── */}
      <Modal
        title={<Space><EnvironmentOutlined style={{ color: '#2F54EB' }} />Transfer / Move — <Text type="secondary">{selectedAsset?.name}</Text></Space>}
        open={transferModal}
        onOk={saveTransfer}
        onCancel={() => { setTransferModal(false); transferForm.resetFields(); }}
        confirmLoading={saving}
        okText="Record Transfer"
        width={640}
        destroyOnHidden
      >
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Use this to move an asset to a new location or department, with or without changing who holds it.
        </Text>
        <Form form={transferForm} layout="vertical">
          <Form.Item name="toEmployeeId" label="Transfer To Employee (optional)">
            <Select placeholder="Leave blank to keep the current holder" allowClear showSearch
              optionFilterProp="label" options={employeeOptions} />
          </Form.Item>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="location" label="New Location">
                <Input placeholder="e.g. Branch 2 / Warehouse" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="department" label="New Department">
                <Input placeholder="e.g. Sales" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col xs={24} sm={12}>
              <Form.Item name="date" label="Transfer Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item name="reason" label="Reason">
                <Input placeholder="e.g. Branch relocation" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Damage / Loss ───────────────────────────────────────────────────── */}
      <Modal
        title={<Space><WarningOutlined style={{ color: '#CF1322' }} />Report Damage / Loss — <Text type="secondary">{selectedAsset?.name}</Text></Space>}
        open={damageModal}
        onOk={saveDamage}
        onCancel={() => { setDamageModal(false); damageForm.resetFields(); }}
        confirmLoading={saving}
        okText="Record"
        okButtonProps={{ danger: true }}
        width={640}
        destroyOnHidden
      >
        <Form form={damageForm} layout="vertical">
          <Form.Item name="date" label="Date Reported">
            <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
          </Form.Item>
          <Form.Item name="reason" label="What happened?" rules={[{ required: true, message: 'A reason is required.' }]}>
            <Input.TextArea rows={2} placeholder="e.g. Screen cracked during transit" />
          </Form.Item>
          <Form.Item name="lost" valuePropName="checked">
            <Checkbox>Asset is lost / cannot be recovered</Checkbox>
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Damaged assets move to <Text strong>Under Maintenance</Text>. Lost assets are marked
          {' '}<Text strong>Lost</Text>. Custody is left unchanged — log a return separately if the
          holder hands it back.
        </Text>
      </Modal>

      {/* ── History ─────────────────────────────────────────────────────────── */}
      <Modal
        title={<Space><HistoryOutlined style={{ color: '#FF5F03' }} />Asset History — {selectedAsset?.name}</Space>}
        open={historyModal}
        onCancel={() => { setHistoryModal(false); setMovements([]); }}
        footer={<Button onClick={() => setHistoryModal(false)}>Close</Button>}
        width={760}
        destroyOnHidden
      >
        {selectedAsset && (
          <>
            <Descriptions column={2} bordered size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Asset Code">{selectedAsset.assetCode}</Descriptions.Item>
              <Descriptions.Item label="Category">{selectedAsset.category}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColor[selectedAsset.status]}>{titleCase(selectedAsset.status)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Condition">
                <Tag color={conditionColor[selectedAsset.condition]}>{titleCase(selectedAsset.condition)}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Current Holder">{selectedAsset.assignedToName || 'Unassigned'}</Descriptions.Item>
              <Descriptions.Item label="Location">{selectedAsset.location || '—'}</Descriptions.Item>
            </Descriptions>

            <Text strong style={{ display: 'block', marginBottom: 12 }}>Custody & Condition Trail</Text>
            {historyLoading ? (
              <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>
            ) : movementItems.length > 0 ? (
              <Timeline mode="left" items={movementItems} />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="No custody movements recorded yet. Assign, return or transfer this asset and the trail will build here."
              />
            )}

            <Text strong style={{ display: 'block', margin: '20px 0 12px' }}>Maintenance History</Text>
            {selectedAsset.maintenanceLogs?.length > 0 ? (
              <Timeline mode="left" items={selectedAsset.maintenanceLogs.slice().reverse().map(log => ({
                label: fmtDate(log.date),
                color: log.status === 'completed' ? 'green' : log.status === 'in_progress' ? 'blue' : 'orange',
                children: (
                  <div>
                    <Text strong>{titleCase(log.type)} — {log.description}</Text>
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
