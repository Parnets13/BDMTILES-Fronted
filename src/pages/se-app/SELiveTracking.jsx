import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, Col, Empty, Row, Space, Statistic, Table, Tag, Tooltip, Typography, Button } from 'antd';
import {
  EnvironmentOutlined,
  ReloadOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import seMonitoringService from '../../services/seMonitoringService';
import { subscribeToTracking } from '../../lib/realtime';

const { Title, Text } = Typography;

/**
 * Live field tracking (SOW 18.10).
 *
 * Positions arrive over the existing socket, so the board updates without polling.
 * The REST call is the fallback, not the mechanism — if the socket drops, the page
 * still shows a slightly stale board rather than an empty one.
 *
 * NO MAP PROVIDER IS REQUIRED FOR THIS PAGE. Everything here is coordinates, times,
 * addresses and battery. The map panel at the bottom is the only part that needs a
 * provider, and it says so rather than rendering a broken frame.
 */

const STALE_AFTER_MS = 10 * 60 * 1000;

const statusOf = (row) => {
  if (row.trackingStatus === 'gps_off') {
    return { color: 'orange', label: 'Location off', hint: 'Device location is switched off' };
  }
  if (row.stale) {
    return { color: 'red', label: 'Stale', hint: 'No fix within the staleness window' };
  }
  if (row.trackingStatus === 'offline') return { color: 'default', label: 'Offline', hint: 'Checked out or app stopped' };
  if (row.onSite) return { color: 'green', label: 'At dealer', hint: 'Checked in at a dealer now' };
  return { color: 'blue', label: 'On duty', hint: 'Checked in and reporting' };
};

const place = (location) => {
  if (!location || (location.lat == null && location.lng == null)) return '—';
  return location.address || `${location.lat}, ${location.lng}`;
};

export default function SELiveTracking() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [trail, setTrail] = useState([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [socketLive, setSocketLive] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await seMonitoringService.live();
      if (res?.success) setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Patch a row in place on each socket update rather than refetching the board —
  // one executive moving must not cost a full query for the whole branch.
  useEffect(() => {
    const unsubscribe = subscribeToTracking((update) => {
      setSocketLive(true);
      setRows((current) => {
        const index = current.findIndex((row) => String(row.executiveId) === String(update.executiveId));
        const patched = {
          ...(index >= 0 ? current[index] : { executiveId: update.executiveId, name: update.name }),
          name: update.name || current[index]?.name || '',
          lastSeenAt: update.at,
          trackingStatus: update.status,
          battery: update.battery ?? null,
          charging: update.charging === true,
          mocked: update.mocked === true,
          stale: false,
          location: update.lat != null
            ? { lat: update.lat, lng: update.lng, address: update.address }
            : current[index]?.location || null,
        };
        if (index < 0) return [patched, ...current];
        const next = [...current];
        next[index] = patched;
        return next;
      });
    });
    return unsubscribe;
  }, []);

  const openTrail = useCallback(async (row) => {
    setSelected(row);
    setTrailLoading(true);
    try {
      const res = await seMonitoringService.trail(row.executiveId, dayjs().format('YYYY-MM-DD'));
      setTrail(res?.success ? res.data?.points || [] : []);
    } finally {
      setTrailLoading(false);
    }
  }, []);

  const stats = useMemo(() => ({
    total: rows.length,
    onDuty: rows.filter((row) => row.trackingStatus === 'active' && !row.stale).length,
    onSite: rows.filter((row) => row.onSite).length,
    gpsOff: rows.filter((row) => row.trackingStatus === 'gps_off').length,
    stale: rows.filter((row) => row.stale).length,
  }), [rows]);

  const columns = [
    {
      title: 'Executive',
      dataIndex: 'name',
      render: (value, row) => (
        <div className="leading-tight">
          <div className="font-medium text-sm">{value || '—'}</div>
          <div className="text-[11px] text-gray-400">{row.empId || row.phone || ''}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 130,
      render: (_, row) => {
        const status = statusOf(row);
        return <Tooltip title={status.hint}><Tag color={status.color}>{status.label}</Tag></Tooltip>;
      },
    },
    {
      title: 'Current position',
      key: 'place',
      render: (_, row) => (
        <div className="leading-tight">
          <div className="text-xs">{place(row.location)}</div>
          {row.onSite && row.dealerName ? (
            <div className="text-[11px] text-gray-400">at {row.dealerName}</div>
          ) : null}
          {/* Device-reported, never a conclusion — see the productivity view. */}
          {row.mocked ? (
            <div className="text-[11px] text-orange-500">device reported a mocked fix</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Last seen',
      dataIndex: 'lastSeenAt',
      width: 150,
      render: (value, row) => (
        <div className="leading-tight">
          <div className="text-xs">{value ? dayjs(value).format('HH:mm:ss') : '—'}</div>
          <div className="text-[11px] text-gray-400">
            {value ? dayjs(value).format('DD MMM') : ''}
            {row.stale ? ' · stale' : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Battery',
      key: 'battery',
      width: 100,
      render: (_, row) =>
        row.battery == null ? (
          <Text type="secondary">—</Text>
        ) : (
          <span className={row.battery <= 15 ? 'text-red-500' : ''}>
            {row.battery}%{row.charging ? ' ⚡' : ''}
          </span>
        ),
    },
    {
      title: '',
      key: 'action',
      width: 90,
      render: (_, row) => (
        <Button size="small" type="link" onClick={() => openTrail(row)}>Trail</Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
        <div>
          <Title level={4} style={{ margin: 0 }}>SE Live Tracking</Title>
          <Text type="secondary" className="text-sm">
            Field positions between check-in and check-out
            {socketLive ? ' · live' : ''}
          </Text>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Row gutter={[12, 12]} className="mb-4">
        {[
          ['Executives', stats.total],
          ['On duty', stats.onDuty],
          ['At a dealer', stats.onSite],
          ['Location off', stats.gpsOff],
          ['Stale', stats.stale],
        ].map(([label, value]) => (
          <Col xs={12} sm={8} md={4} key={label}>
            <Card size="small">
              <Statistic title={<span className="text-xs text-gray-500">{label}</span>} value={value} />
            </Card>
          </Col>
        ))}
      </Row>

      <div className="rounded-lg border border-gray-200 bg-white">
        <Table
          columns={columns}
          dataSource={rows}
          rowKey={(row) => String(row.executiveId || row.employeeId)}
          loading={loading}
          size="middle"
          pagination={{ pageSize: 20, hideOnSinglePage: true }}
          locale={{ emptyText: <Empty description="No executives reporting. Tracking runs only between check-in and check-out." /> }}
        />
      </div>

      {selected ? (
        <Card
          size="small"
          className="mt-4"
          title={`Trail — ${selected.name || 'executive'} · ${dayjs().format('DD MMM')}`}
          extra={<Button size="small" onClick={() => { setSelected(null); setTrail([]); }}>Close</Button>}
          loading={trailLoading}
        >
          {trail.length ? (
            <div className="max-h-80 overflow-auto">
              {trail.map((point, index) => (
                <div key={`${point.at}-${index}`} className="flex gap-3 py-1 text-xs border-b border-gray-100 last:border-0">
                  <span className="w-20 text-gray-500">{dayjs(point.at).format('HH:mm:ss')}</span>
                  <span className="flex-1">{point.address || `${point.lat}, ${point.lng}`}</span>
                  <span className="w-24 text-right text-gray-400">
                    {point.context === 'visit' ? 'at dealer' : 'travelling'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="No breadcrumbs stored for today." />
          )}
        </Card>
      ) : null}

      {/* The only part of this page that needs a provider.
          Rendering an empty frame with a live-looking map would be worse than saying
          so — an operator cannot tell "nobody is moving" from "the map is broken". */}
      <Card size="small" className="mt-4">
        <Space direction="vertical" size={4}>
          <Space>
            <EnvironmentOutlined />
            <Text strong>Map view</Text>
          </Space>
          <Text type="secondary" className="text-xs">
            Not rendered. Positions, addresses, trails and battery are all live above — the
            map is only the picture drawn underneath them. Enable it by setting
            <Text code className="mx-1">MAP_PROVIDER</Text> and
            <Text code className="mx-1">MAP_BROWSER_KEY</Text>
            in the backend environment, then loading that provider&apos;s SDK here.
          </Text>
          <Text type="secondary" className="text-xs">
            <WarningOutlined className="mr-1" />
            Use a permitted provider. A plaintext browser key can be sniffed — restrict it by
            Referer in the provider&apos;s console before going live.
          </Text>
        </Space>
      </Card>
    </div>
  );
}
