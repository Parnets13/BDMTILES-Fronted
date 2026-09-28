import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Empty, Input, Modal, Row, Select,
  Space, Statistic, Switch, Table, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  ExclamationCircleOutlined, KeyOutlined, LogoutOutlined, MobileOutlined,
  ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api';

const { Text, Title } = Typography;

const BRAND = '#FF5F03';
const URGENT = '#cf1322';
const POSITIVE = '#389e0d';

const STATUS_COLOR = { active: 'green', inactive: 'default', blocked: 'red' };
const fmtDateTime = (v) => (v ? dayjs(v).format('DD MMM YYYY, HH:mm') : '—');

const DealerAppAccess = () => {
  const [dealers, setDealers] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [accessFilter, setAccessFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await api.get('/system/app-access/dealers', {
        params: {
          page,
          limit: pagination.pageSize,
          search: search || undefined,
          appAccess: accessFilter,
          status: statusFilter,
        },
      });
      if (res.success) {
        setDealers(res.data || []);
        setStats(res.stats || {});
        setPagination(p => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [search, accessFilter, statusFilter, pagination.pageSize]);

  useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [search, accessFilter, statusFilter]);

  const toggleAccess = async (dealer, next) => {
    setBusyId(dealer._id);
    try {
      const res = await api.patch(`/system/app-access/dealers/${dealer._id}`, { appAccess: next });
      message.success(res.message);
      await load(pagination.current);
    } catch (error) { message.error(error.message); }
    finally { setBusyId(null); }
  };

  const bulkSet = (next) => {
    Modal.confirm({
      title: next ? 'Enable app access for selected dealers?' : 'Revoke app access for selected dealers?',
      icon: <ExclamationCircleOutlined style={{ color: next ? BRAND : URGENT }} />,
      content: next
        ? `${selectedRowKeys.length} dealer(s) will be able to sign in to the Dealer App. Dealers who are not active will be skipped.`
        : `${selectedRowKeys.length} dealer(s) will lose access immediately and any signed-in devices will be logged out.`,
      okText: next ? 'Enable' : 'Revoke',
      okButtonProps: next ? { style: { background: BRAND, borderColor: BRAND } } : { danger: true },
      onOk: async () => {
        try {
          const res = await api.post('/system/app-access/dealers/bulk', {
            dealerIds: selectedRowKeys,
            appAccess: next,
          });
          message.success(res.message);
          // Skips are reported rather than swallowed, so a partial run is visible.
          if (res.data?.skipped?.length) {
            Modal.info({
              title: `${res.data.skipped.length} dealer(s) were not changed`,
              width: 560,
              content: (
                <ul style={{ paddingLeft: 18 }}>
                  {res.data.skipped.map(s => <li key={s._id}>{s.businessName} — {s.reason}</li>)}
                </ul>
              ),
            });
          }
          setSelectedRowKeys([]);
          await load(pagination.current);
        } catch (error) { message.error(error.message); }
      },
    });
  };

  const revokeSessions = (dealer) => {
    Modal.confirm({
      title: `Sign ${dealer.businessName} out of all devices?`,
      icon: <ExclamationCircleOutlined style={{ color: URGENT }} />,
      content: 'Existing app tokens stop working immediately and the dealer must log in again. App access itself stays enabled.',
      okText: 'Sign Out All Devices',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await api.post(`/system/app-access/dealers/${dealer._id}/revoke-sessions`);
          message.success(res.message);
          setDetail(null);
          await load(pagination.current);
        } catch (error) { message.error(error.message); }
      },
    });
  };

  const resetPin = (dealer) => {
    Modal.confirm({
      title: `Clear the login PIN for ${dealer.businessName}?`,
      icon: <ExclamationCircleOutlined style={{ color: URGENT }} />,
      content: 'Their PIN and biometric login are removed and all devices are signed out. They will set a new PIN after logging in with an OTP.',
      okText: 'Clear PIN',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const res = await api.post(`/system/app-access/dealers/${dealer._id}/reset-pin`);
          message.success(res.message);
          setDetail(null);
          await load(pagination.current);
        } catch (error) { message.error(error.message); }
      },
    });
  };

  const columns = useMemo(() => [
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <div>
          <Text strong>{r.businessName}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
            {r.dealerCode || '—'} · {r.ownerName} · {r.mobile}
          </Text>
        </div>
      ),
    },
    {
      title: 'Dealer Status',
      dataIndex: 'status',
      width: 130,
      render: (s) => <Tag color={STATUS_COLOR[s]}>{String(s || '').toUpperCase()}</Tag>,
    },
    {
      title: 'App Access',
      key: 'appAccess',
      width: 150,
      render: (_, r) => (
        <Tooltip title={r.status !== 'active' && !r.appAccess
          ? `Cannot enable while the dealer is ${r.status}.`
          : undefined}>
          <Switch
            checked={!!r.appAccess}
            loading={busyId === r._id}
            disabled={r.status !== 'active' && !r.appAccess}
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(next) => toggleAccess(r, next)}
          />
        </Tooltip>
      ),
    },
    {
      title: 'Login Setup',
      key: 'login',
      width: 150,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.pinSet ? <Tag color="blue">PIN set</Tag> : <Tag>No PIN</Tag>}
          {r.biometricEnabled && <Tag color="purple">Biometric</Tag>}
        </Space>
      ),
    },
    {
      title: 'Devices',
      dataIndex: 'deviceCount',
      width: 90,
      render: (v) => (v > 0 ? <Tag color="cyan">{v}</Tag> : <Text type="secondary">—</Text>),
    },
    {
      title: 'Last App Login',
      dataIndex: 'appLastLoginAt',
      width: 170,
      render: (v) => (v ? fmtDateTime(v) : <Text type="secondary">Never</Text>),
    },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, r) => <Button size="small" icon={<MobileOutlined />} onClick={() => setDetail(r)}>Manage</Button>,
    },
  ], [busyId, pagination.current]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>Dealer App Access Control</Title>
          <Text type="secondary">Grant or revoke Dealer App sign-in, manage devices and reset login PINs</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(pagination.current)}>Refresh</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message="App access is a separate grant from the dealer record itself"
        description="A dealer who exists in the system still cannot sign in to the Dealer App until access is enabled here. Until now this could only be changed by running a script on the server."
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Total Dealers" value={stats.total || 0} valueStyle={{ color: BRAND }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="App Access Enabled" value={stats.appEnabled || 0} valueStyle={{ color: POSITIVE }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Ever Logged In" value={stats.everLoggedIn || 0} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Blocked Dealers" value={stats.blocked || 0} valueStyle={{ color: stats.blocked ? URGENT : POSITIVE }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search business, owner, mobile, code"
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            allowClear
            placeholder="App access"
            style={{ width: 160 }}
            value={accessFilter}
            onChange={setAccessFilter}
            options={[{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]}
          />
          <Select
            allowClear
            placeholder="Dealer status"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={['active', 'inactive', 'blocked'].map(s => ({ value: s, label: s.toUpperCase() }))}
          />
          <Button onClick={() => { setSearch(''); setAccessFilter(undefined); setStatusFilter(undefined); }}>Reset</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { load(); }}>Refresh</Button>
        </Space>
      </Card>

      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, background: '#fff7f0', borderColor: BRAND }}>
          <Space wrap>
            <Text strong>{selectedRowKeys.length} selected</Text>
            <Button size="small" type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => bulkSet(true)}>
              Enable App Access
            </Button>
            <Button size="small" danger onClick={() => bulkSet(false)}>Revoke App Access</Button>
            <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
          </Space>
        </Card>
      )}

      <Card>
        <Table
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={dealers}
          scroll={{ x: 1100 }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `${t} dealer(s)`,
          }}
          onChange={(p) => { setPagination(prev => ({ ...prev, pageSize: p.pageSize })); load(p.current); }}
          locale={{ emptyText: 'No dealers match these filters.' }}
        />
      </Card>

      <Modal
        title={detail ? `Dealer App — ${detail.businessName}` : 'Dealer App'}
        open={!!detail}
        onCancel={() => setDetail(null)}
        footer={<Button onClick={() => setDetail(null)}>Close</Button>}
        width={760}
        destroyOnHidden
      >
        {detail && (
          <>
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Dealer Code">{detail.dealerCode || '—'}</Descriptions.Item>
              <Descriptions.Item label="Owner">{detail.ownerName}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{detail.mobile}</Descriptions.Item>
              <Descriptions.Item label="Dealer Status">
                <Tag color={STATUS_COLOR[detail.status]}>{String(detail.status || '').toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="App Access">
                <Tag color={detail.appAccess ? 'green' : 'default'}>{detail.appAccess ? 'Enabled' : 'Disabled'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="PIN">{detail.pinSet ? 'Set' : 'Not set'}</Descriptions.Item>
              <Descriptions.Item label="Biometric">{detail.biometricEnabled ? 'Enabled' : 'Disabled'}</Descriptions.Item>
              <Descriptions.Item label="Last App Login">{fmtDateTime(detail.appLastLoginAt)}</Descriptions.Item>
            </Descriptions>

            <Card size="small" title={`Registered Devices (${detail.deviceCount || 0})`} style={{ marginBottom: 16 }}>
              {detail.devices?.length > 0 ? (
                <Table
                  size="small"
                  rowKey="deviceId"
                  pagination={false}
                  dataSource={detail.devices}
                  columns={[
                    { title: 'Device', dataIndex: 'deviceName', render: (v) => v || <Text type="secondary">Unnamed</Text> },
                    { title: 'Platform', dataIndex: 'platform', render: (v) => v || '—' },
                    { title: 'App Version', dataIndex: 'appVersion', render: (v) => v || '—' },
                    { title: 'Last Seen', dataIndex: 'lastSeenAt', render: fmtDateTime },
                  ]}
                />
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No devices registered. Devices are recorded on each app login."
                />
              )}
            </Card>

            <Space wrap>
              <Button
                type={detail.appAccess ? 'default' : 'primary'}
                style={!detail.appAccess && detail.status === 'active' ? { background: BRAND, borderColor: BRAND } : {}}
                disabled={detail.status !== 'active' && !detail.appAccess}
                onClick={() => toggleAccess(detail, !detail.appAccess).then(() => setDetail(null))}
              >
                {detail.appAccess ? 'Revoke App Access' : 'Enable App Access'}
              </Button>
              <Button danger icon={<LogoutOutlined />} onClick={() => revokeSessions(detail)}>
                Sign Out All Devices
              </Button>
              <Button danger icon={<KeyOutlined />} disabled={!detail.pinSet} onClick={() => resetPin(detail)}>
                Clear Login PIN
              </Button>
            </Space>
            {detail.status !== 'active' && !detail.appAccess && (
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message={`This dealer is ${detail.status}, so app access cannot be granted.`}
                description="Activate the dealer record first, from Dealer Master."
              />
            )}
          </>
        )}
      </Modal>
    </div>
  );
};

export default DealerAppAccess;
