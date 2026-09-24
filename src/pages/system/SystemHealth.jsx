import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, Row, Space, Statistic, Table, Tag,
  Tooltip, Typography, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, CloudServerOutlined,
  DatabaseOutlined, ExclamationCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api';

const { Text, Title, Paragraph } = Typography;

const BRAND = '#FF5F03';
const URGENT = '#cf1322';
const CAUTION = '#d46b08';
const POSITIVE = '#389e0d';
const NEUTRAL = '#8c8c8c';

const STATUS_META = {
  available:       { color: 'green',   label: 'Available',       icon: <CheckCircleOutlined /> },
  partial:         { color: 'gold',    label: 'Partial',         icon: <ExclamationCircleOutlined /> },
  not_implemented: { color: 'default', label: 'Not Implemented', icon: <CloseCircleOutlined /> },
};

const fmtBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} B`;
  if (value < 1048576) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1048576).toFixed(1)} MB`;
};

const fmtUptime = (seconds) => {
  const total = Number(seconds || 0);
  const days = Math.floor(total / 86400);
  const hours = Math.floor((total % 86400) / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (days) return `${days}d ${hours}h`;
  if (hours) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
};

const SystemHealth = () => {
  const [health, setHealth] = useState(null);
  const [integrations, setIntegrations] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [h, i] = await Promise.all([
        api.get('/system/health'),
        api.get('/system/integrations'),
      ]);
      if (h.success) setHealth(h.data);
      if (i.success) setIntegrations(i.data);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const integrationColumns = [
    {
      title: 'Integration',
      key: 'name',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.category}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 160,
      filters: Object.entries(STATUS_META).map(([value, meta]) => ({ text: meta.label, value })),
      onFilter: (value, record) => record.status === value,
      render: (status) => {
        const meta = STATUS_META[status] || STATUS_META.not_implemented;
        return <Tag color={meta.color} icon={meta.icon}>{meta.label}</Tag>;
      },
    },
    {
      title: 'Credentials',
      dataIndex: 'envConfigured',
      width: 120,
      render: (value) => {
        if (value === null || value === undefined) return <Text type="secondary">—</Text>;
        return value
          ? <Tag color="green">Configured</Tag>
          : <Tag color="orange">Not set</Tag>;
      },
    },
    {
      title: 'What exists today',
      key: 'detail',
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12 }}>{r.detail}</Text>
          {r.evidence && (
            <Text type="secondary" style={{ display: 'block', fontSize: 11, marginTop: 4 }}>
              Live check: {r.evidence}
            </Text>
          )}
        </div>
      ),
    },
  ];

  const channelColumns = [
    { title: 'Channel', dataIndex: 'label', width: 150 },
    {
      title: 'Delivers?',
      dataIndex: 'available',
      width: 130,
      render: (value) => (value
        ? <Tag color="green" icon={<CheckCircleOutlined />}>Sends</Tag>
        : <Tag color="red" icon={<CloseCircleOutlined />}>Skipped</Tag>),
    },
    { title: 'Provider', dataIndex: 'provider', width: 170, render: (v) => v || <Text type="secondary">None</Text> },
    { title: 'Detail', dataIndex: 'note', render: (v) => <Text style={{ fontSize: 12 }}>{v}</Text> },
  ];

  const db = health?.database;
  const recycle = health?.backup?.recycleBin;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>System Health & Integrations</Title>
          <Text type="secondary">What this deployment can actually do right now, checked live</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Refresh</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="This is a readiness report, not a configuration screen"
        description={integrations?.summary
          || 'Credentials are not collected for integrations that have no client code, because storing keys that nothing reads would imply a working pipeline.'}
      />

      {/* Runtime */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Database"
              value={db?.state === 'connected' ? 'Connected' : (db?.state || 'Unknown')}
              valueStyle={{ color: db?.state === 'connected' ? POSITIVE : URGENT, fontSize: 20 }}
              prefix={<DatabaseOutlined />}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Server Uptime" value={fmtUptime(health?.runtime?.uptimeSeconds)} valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Memory In Use" value={health?.runtime?.memoryMb || 0} suffix="MB" valueStyle={{ fontSize: 20 }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Integrations Live"
              value={`${(integrations?.counts?.available || 0) + (integrations?.counts?.partial || 0)} of ${integrations?.counts?.total || 0}`}
              valueStyle={{ color: CAUTION, fontSize: 20 }}
              prefix={<CloudServerOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card size="small" title="Runtime" style={{ height: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Node">{health?.runtime?.nodeVersion || '—'}</Descriptions.Item>
              <Descriptions.Item label="Environment">
                <Tag color={health?.runtime?.environment === 'production' ? 'red' : 'blue'}>
                  {health?.runtime?.environment || '—'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Server Time">
                {health?.runtime?.serverTime ? dayjs(health.runtime.serverTime).format('DD MMM YYYY, HH:mm:ss') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="UTC Offset">
                {health?.runtime?.timezoneOffsetMinutes !== undefined
                  ? `${health.runtime.timezoneOffsetMinutes >= 0 ? '+' : ''}${health.runtime.timezoneOffsetMinutes} min`
                  : '—'}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card size="small" title="Database" style={{ height: '100%' }}>
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Name">{db?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Host">
                <Text style={{ fontSize: 12 }}>{db?.host || '—'}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Replica Set">{db?.replicaSet || <Text type="secondary">None</Text>}</Descriptions.Item>
              <Descriptions.Item label="Transactions">
                {db?.transactionsAvailable === true && <Tag color="green">Supported</Tag>}
                {db?.transactionsAvailable === false && <Tag color="red">Not supported</Tag>}
                {(db?.transactionsAvailable === null || db?.transactionsAvailable === undefined) && <Tag>Unknown</Tag>}
              </Descriptions.Item>
            </Descriptions>
            {db?.transactionsNote && (
              <Alert
                type={db.transactionsAvailable === true ? 'success' : 'warning'}
                showIcon
                style={{ marginTop: 8 }}
                message={db.transactionsNote}
              />
            )}
          </Card>
        </Col>

        {/* Backup — stated plainly, deliberately not offered as a button */}
        <Col xs={24}>
          <Card size="small" title="Backup & Data Retention">
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="This application has no backup or restore feature"
              description={health?.backup?.note}
            />
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}>
                <Statistic title="Recycle Bin Records" value={recycle?.totalRecords || 0} valueStyle={{ color: BRAND }} />
              </Col>
              <Col xs={12} md={6}>
                <Statistic title="Retention" value={recycle?.retentionDays || 30} suffix="days" valueStyle={{ color: NEUTRAL }} />
              </Col>
              <Col xs={12} md={6}>
                <Tooltip title="After 30 days the database removes these rows automatically and the records cannot be recovered.">
                  <Statistic
                    title="Expiring Within 7 Days"
                    value={recycle?.expiringWithin7Days || 0}
                    valueStyle={{ color: recycle?.expiringWithin7Days ? URGENT : POSITIVE }}
                  />
                </Tooltip>
              </Col>
              <Col xs={12} md={6}>
                <Statistic
                  title="Oldest Deleted Record"
                  value={recycle?.oldestRecord ? dayjs(recycle.oldestRecord.deletedAt).format('DD MMM YYYY') : '—'}
                  valueStyle={{ fontSize: 18 }}
                />
              </Col>
            </Row>
            {recycle?.expiringWithin7Days > 0 && (
              <Alert
                type="error"
                showIcon
                style={{ marginTop: 12 }}
                message={`${recycle.expiringWithin7Days} deleted record(s) will be permanently removed within 7 days`}
                description="Restore anything you still need from the Recycle Bin before the retention window closes."
              />
            )}
          </Card>
        </Col>

        {/* File storage */}
        <Col xs={24}>
          <Card size="small" title="File Storage">
            <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={health?.storage?.note} />
            <Row gutter={[12, 12]}>
              <Col xs={24} md={12}>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="HR Documents">
                    {health?.storage?.hrDocuments?.exists
                      ? `${health.storage.hrDocuments.files} file(s), ${fmtBytes(health.storage.hrDocuments.bytes)}`
                      : <Text type="secondary">Directory missing</Text>}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col xs={24} md={12}>
                <Descriptions size="small" column={1} bordered>
                  <Descriptions.Item label="Candidate Resumes">
                    {health?.storage?.candidateResumes?.exists
                      ? `${health.storage.candidateResumes.files} file(s), ${fmtBytes(health.storage.candidateResumes.bytes)}`
                      : <Text type="secondary">Directory missing</Text>}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Notification channels */}
        <Col xs={24}>
          <Card size="small" title="Notification Delivery Channels">
            <Alert
              type="warning"
              showIcon
              style={{ marginBottom: 12 }}
              message="Only the in-app inbox actually delivers"
              description={health?.notifications?.summary}
            />
            <Table
              size="small"
              rowKey="channel"
              pagination={false}
              dataSource={health?.notifications?.channels || []}
              columns={channelColumns}
              loading={loading}
            />
            <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
              {health?.notifications?.skippedDeliveries || 0} notification attempt(s) in this branch have been recorded as
              skipped because no provider was available.
            </Text>
          </Card>
        </Col>

        {/* Dealer app */}
        <Col xs={24}>
          <Card size="small" title="Dealer Mobile App">
            <Row gutter={[12, 12]}>
              <Col xs={12} md={6}><Statistic title="Total Dealers" value={health?.dealerApp?.totalDealers || 0} valueStyle={{ color: BRAND }} /></Col>
              <Col xs={12} md={6}><Statistic title="App Access Enabled" value={health?.dealerApp?.appEnabled || 0} valueStyle={{ color: POSITIVE }} /></Col>
              <Col xs={12} md={6}><Statistic title="PIN Set" value={health?.dealerApp?.pinSet || 0} valueStyle={{ color: '#1677ff' }} /></Col>
              <Col xs={12} md={6}><Statistic title="Ever Logged In" value={health?.dealerApp?.everLoggedIn || 0} valueStyle={{ color: NEUTRAL }} /></Col>
            </Row>
            <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
              There is no minimum-version enforcement, maintenance mode or feature flagging in this build. App version
              strings reported by devices are recorded but never checked.
            </Text>
          </Card>
        </Col>

        {/* Integration matrix */}
        <Col xs={24}>
          <Card
            size="small"
            title="Integration Readiness"
            extra={integrations && (
              <Space>
                <Tag color="green">{integrations.counts.available} available</Tag>
                <Tag color="gold">{integrations.counts.partial} partial</Tag>
                <Tag>{integrations.counts.notImplemented} not implemented</Tag>
              </Space>
            )}
          >
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              Each row states what exists in this build today. Rows marked <Text strong>Not Implemented</Text> have no
              client code at all — related database fields and permissions may exist, but nothing reads or writes them.
            </Paragraph>
            <Table
              size="small"
              rowKey="key"
              loading={loading}
              pagination={false}
              dataSource={integrations?.integrations || []}
              columns={integrationColumns}
              scroll={{ x: 900 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default SystemHealth;
