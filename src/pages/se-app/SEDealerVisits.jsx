import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography,
  DatePicker, Alert, Tooltip, Descriptions, Drawer, Empty,
} from 'antd';
import {
  UserOutlined, ShopOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined,
  ClockCircleOutlined, CheckCircleOutlined, LoginOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService';
import api from '../../config/api';
import dayjs from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

const BRAND = '#FF5F03';

const STATUS_COLOR = { checked_in: 'processing', completed: 'green', cancelled: 'default' };
const STATUS_LABEL = { checked_in: 'IN PROGRESS', completed: 'COMPLETED', cancelled: 'CANCELLED' };

const PURPOSES = [
  { value: 'sales', label: 'Sales' },
  { value: 'collection', label: 'Collection' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'new_business', label: 'New Business' },
  { value: 'other', label: 'Other' },
];
const PURPOSE_LABEL = Object.fromEntries(PURPOSES.map((p) => [p.value, p.label]));

const fmtDuration = (mins) => {
  const m = Number(mins || 0);
  if (!m) return '—';
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
};

const mapsLink = (loc) =>
  loc?.lat != null && loc?.lng != null
    ? `https://www.google.com/maps?q=${loc.lat},${loc.lng}`
    : null;

/**
 * Branch-wide log of the dealer visits sales executives record in the field
 * (SOW 18.2 capture, 18.10 monitoring).
 *
 * Read-only: a visit is field evidence, written only by the executive who made
 * it through the app's check-in / check-out flow.
 */
export default function SEDealerVisits() {
  const [visits, setVisits] = useState([]);
  const [summary, setSummary] = useState(null);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [detail, setDetail] = useState(null);

  const [seFilter, setSeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [purposeFilter, setPurposeFilter] = useState('all');
  const [range, setRange] = useState(null);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });

  const buildParams = useCallback((page, pageSize) => {
    const params = { page, limit: pageSize };
    if (seFilter !== 'all') params.salesExecutive = seFilter;
    if (statusFilter !== 'all') params.status = statusFilter;
    if (purposeFilter !== 'all') params.purpose = purposeFilter;
    if (range?.[0]) params.from = range[0].format('YYYY-MM-DD');
    if (range?.[1]) params.to = range[1].format('YYYY-MM-DD');
    return params;
  }, [seFilter, statusFilter, purposeFilter, range]);

  const load = useCallback(async (page = 1, pageSize = 50) => {
    setLoading(true);
    setLoadError('');
    try {
      const params = buildParams(page, pageSize);
      const [listRes, summaryRes] = await Promise.all([
        api.get('/sales-executive/visits', { params }),
        // Summary shares the filters minus paging so the cards match the table.
        api.get('/sales-executive/visits/summary', { params: { ...params, page: undefined, limit: undefined } }),
      ]);
      setVisits(listRes?.data || []);
      setPagination({
        current: listRes?.pagination?.currentPage || page,
        pageSize: listRes?.pagination?.itemsPerPage || pageSize,
        total: listRes?.pagination?.totalItems || 0,
      });
      setSummary(summaryRes?.data || null);
    } catch (err) {
      setVisits([]);
      setSummary(null);
      setLoadError(err?.message || 'Could not load dealer visits.');
    } finally {
      setLoading(false);
    }
  }, [buildParams]);

  useEffect(() => {
    userService.getUsers({ role: 'sales_executive', limit: 100 })
      .then((res) => setSalesExecs(res?.data || res?.users || []))
      .catch(() => { /* the interceptor reports it; the filter just stays empty */ });
  }, []);

  // Filters are applied server-side, so any change refetches from page 1.
  useEffect(() => { load(1, pagination.pageSize); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [seFilter, statusFilter, purposeFilter, range]);

  // Free-text search is client-side over the loaded page — the endpoint has no
  // text index over the joined dealer fields.
  const rows = search.trim()
    ? visits.filter((v) => {
      const q = search.trim().toLowerCase();
      return v.dealerName?.toLowerCase().includes(q)
        || v.dealerCode?.toLowerCase().includes(q)
        || v.dealerCity?.toLowerCase().includes(q)
        || v.salesExecutive?.name?.toLowerCase().includes(q);
    })
    : visits;

  const columns = [
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <Space>
          <ShopOutlined style={{ color: BRAND }} />
          <div>
            <Text strong>{r.dealerName || '—'}</Text>
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
              {[r.dealerCode, r.dealerCity].filter(Boolean).join(' · ') || '—'}
            </Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Sales Executive',
      key: 'se',
      render: (_, r) => (r.salesExecutive
        ? <Tag color="blue" icon={<UserOutlined />}>{r.salesExecutive.name}</Tag>
        : <Text type="secondary">—</Text>),
    },
    {
      title: 'Purpose',
      dataIndex: 'purpose',
      key: 'purpose',
      render: (v) => <Tag color="purple">{PURPOSE_LABEL[v] || v || '—'}</Tag>,
    },
    {
      title: 'Check In',
      key: 'checkIn',
      render: (_, r) => (
        <div>
          <Text style={{ fontSize: 12 }}>
            {r.checkInAt ? dayjs(r.checkInAt).format('DD MMM YY, HH:mm') : '—'}
          </Text>
          {mapsLink(r.checkInLocation) && (
            <a
              href={mapsLink(r.checkInLocation)}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'block', fontSize: 11 }}
            >
              <EnvironmentOutlined /> Location
            </a>
          )}
        </div>
      ),
    },
    {
      title: 'Check Out',
      key: 'checkOut',
      render: (_, r) => (r.checkOutAt
        ? <Text style={{ fontSize: 12 }}>{dayjs(r.checkOutAt).format('DD MMM YY, HH:mm')}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>),
    },
    {
      title: 'Duration',
      dataIndex: 'durationMinutes',
      key: 'duration',
      sorter: (a, b) => (a.durationMinutes || 0) - (b.durationMinutes || 0),
      render: (v) => <Text>{fmtDuration(v)}</Text>,
    },
    {
      title: 'Outcome',
      key: 'outcome',
      render: (_, r) => (r.outcome
        ? <Tooltip title={r.outcome}><Text ellipsis style={{ maxWidth: 160, fontSize: 12 }}>{r.outcome}</Text></Tooltip>
        : <Text type="secondary">—</Text>),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s) => <Tag color={STATUS_COLOR[s] || 'default'}>{STATUS_LABEL[s] || String(s || '').toUpperCase()}</Tag>,
    },
    {
      title: '',
      key: 'actions',
      width: 70,
      render: (_, r) => <Button size="small" onClick={() => setDetail(r)}>View</Button>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>SE Dealer Visits Log</Title>
          <Text type="secondary">
            Field visits recorded by sales executives through the app, with GPS check-in and outcome.
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(pagination.current, pagination.pageSize)} loading={loading}>
          Refresh
        </Button>
      </div>

      {loadError && (
        <Alert
          type="error"
          showIcon
          message="Dealer visits could not be loaded"
          description={loadError}
          action={<Button size="small" onClick={() => load(1, pagination.pageSize)}>Retry</Button>}
          style={{ marginBottom: 16 }}
        />
      )}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#fff7f0', border: `1px solid ${BRAND}` }}>
            <Statistic title="Visits (filtered)" value={summary?.total ?? 0} valueStyle={{ color: BRAND }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#e6f4ff', border: '1px solid #1677ff' }}>
            <Statistic
              title="In Progress"
              value={summary?.checkedIn ?? 0}
              prefix={<LoginOutlined />}
              valueStyle={{ color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic
              title="Completed"
              value={summary?.completed ?? 0}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card bordered={false} style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic
              title="Avg Duration"
              value={fmtDuration(summary?.avgDurationMinutes)}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#597ef7', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} lg={6}>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Search dealer or executive..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <Select value={seFilter} onChange={setSeFilter} style={{ width: '100%' }} showSearch optionFilterProp="children">
              <Option value="all">All Executives</Option>
              {salesExecs.map((se) => <Option key={se._id} value={se._id}>{se.name}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: '100%' }}>
              <Option value="all">All Statuses</Option>
              <Option value="checked_in">In Progress</Option>
              <Option value="completed">Completed</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <Select value={purposeFilter} onChange={setPurposeFilter} style={{ width: '100%' }}>
              <Option value="all">All Purposes</Option>
              {PURPOSES.map((p) => <Option key={p.value} value={p.value}>{p.label}</Option>)}
            </Select>
          </Col>
          <Col xs={24} lg={5}>
            <RangePicker
              style={{ width: '100%' }}
              value={range}
              onChange={setRange}
              format="DD MMM YY"
              allowClear
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={rows}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t) => `${t} visits`,
            onChange: (page, pageSize) => load(page, pageSize),
          }}
          scroll={{ x: 1200 }}
          locale={{
            emptyText: loadError
              ? 'Visits unavailable.'
              : <Empty description="No visits recorded for these filters." />,
          }}
        />
      </Card>

      <Drawer
        title="Visit Detail"
        open={Boolean(detail)}
        onClose={() => setDetail(null)}
        width={460}
      >
        {detail && (
          <>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Dealer">{detail.dealerName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Dealer Code">{detail.dealerCode || '—'}</Descriptions.Item>
              <Descriptions.Item label="City">{detail.dealerCity || '—'}</Descriptions.Item>
              <Descriptions.Item label="Mobile">{detail.dealerMobile || '—'}</Descriptions.Item>
              <Descriptions.Item label="Sales Executive">{detail.salesExecutive?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Purpose">{PURPOSE_LABEL[detail.purpose] || detail.purpose}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={STATUS_COLOR[detail.status]}>{STATUS_LABEL[detail.status] || detail.status}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Checked In">
                {detail.checkInAt ? dayjs(detail.checkInAt).format('DD MMM YYYY, HH:mm') : '—'}
                {mapsLink(detail.checkInLocation) && (
                  <>
                    {' '}
                    <a href={mapsLink(detail.checkInLocation)} target="_blank" rel="noreferrer">
                      <EnvironmentOutlined /> map
                    </a>
                  </>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Checked Out">
                {detail.checkOutAt ? dayjs(detail.checkOutAt).format('DD MMM YYYY, HH:mm') : '—'}
                {mapsLink(detail.checkOutLocation) && (
                  <>
                    {' '}
                    <a href={mapsLink(detail.checkOutLocation)} target="_blank" rel="noreferrer">
                      <EnvironmentOutlined /> map
                    </a>
                  </>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">{fmtDuration(detail.durationMinutes)}</Descriptions.Item>
              <Descriptions.Item label="Next Follow-up">
                {detail.nextFollowUpDate ? dayjs(detail.nextFollowUpDate).format('DD MMM YYYY') : '—'}
              </Descriptions.Item>
            </Descriptions>

            <Title level={5} style={{ marginTop: 20 }}>Outcome</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {detail.outcome || <Text type="secondary">Not recorded.</Text>}
            </Paragraph>

            <Title level={5}>Notes</Title>
            <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
              {detail.notes || <Text type="secondary">Not recorded.</Text>}
            </Paragraph>
          </>
        )}
      </Drawer>
    </div>
  );
}
