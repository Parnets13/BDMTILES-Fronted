import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input,
  Typography, DatePicker, Tooltip, Drawer, Badge, Timeline, Empty,
  Descriptions, Divider, Progress, Alert,
} from 'antd';
import {
  UserOutlined, ReloadOutlined, SearchOutlined, EnvironmentOutlined,
  ClockCircleOutlined, CheckCircleOutlined, AuditOutlined, BellOutlined,
  BellFilled, HistoryOutlined, EditOutlined, DeleteOutlined, LoginOutlined,
  LogoutOutlined, ThunderboltOutlined, InfoCircleOutlined, EyeOutlined,
  PlusCircleOutlined, StopOutlined, SwapOutlined, FileTextOutlined,
  ShopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import durationPlugin from 'dayjs/plugin/duration';
import api from '../../config/api.js';
import seMonitoringService from '../../services/seMonitoringService.js';
import { subscribeToTracking } from '../../lib/realtime.js';

dayjs.extend(relativeTime);
dayjs.extend(durationPlugin);

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const BRAND = '#FF5F03';

// ─── Web Audio notification sound ────────────────────────────────────────────
let _audioCtx = null;
const getAudioCtx = () => {
  if (!_audioCtx) {
    const Ctor = window.AudioContext || window.webkitAudioContext;
    if (Ctor) _audioCtx = new Ctor();
  }
  return _audioCtx;
};

const playTone = (freq, durationMs, gainVal = 0.22) => {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    vol.gain.setValueAtTime(gainVal, ctx.currentTime);
    vol.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + durationMs / 1000);
  } catch { /* silent */ }
};

/** Two-tone chime for important activity events. */
const playAlert = () => {
  playTone(660, 200, 0.18);
  setTimeout(() => playTone(880, 300, 0.22), 230);
};

/** Single soft tick for a new tracking ping. */
const playTick = () => playTone(1047, 100, 0.08);

// ─── Action display config ────────────────────────────────────────────────────
const ACTION_CFG = {
  create:           { color: 'green',    label: 'Created',     icon: <PlusCircleOutlined /> },
  update:           { color: 'blue',     label: 'Updated',     icon: <EditOutlined /> },
  delete:           { color: 'red',      label: 'Deleted',     icon: <DeleteOutlined /> },
  restore:          { color: 'cyan',     label: 'Restored',    icon: <HistoryOutlined /> },
  permanent_delete: { color: 'volcano',  label: 'Purged',      icon: <StopOutlined /> },
  view:             { color: 'default',  label: 'Viewed',      icon: <EyeOutlined /> },
  download:         { color: 'purple',   label: 'Downloaded',  icon: <FileTextOutlined /> },
  login:            { color: 'geekblue', label: 'Sign-in',     icon: <LoginOutlined /> },
  logout:           { color: 'default',  label: 'Sign-out',    icon: <LogoutOutlined /> },
  approve:          { color: 'green',    label: 'Approved',    icon: <CheckCircleOutlined /> },
  reject:           { color: 'red',      label: 'Rejected',    icon: <StopOutlined /> },
  status_change:    { color: 'orange',   label: 'Status',      icon: <SwapOutlined /> },
  bulk_update:      { color: 'magenta',  label: 'Bulk Edit',   icon: <ThunderboltOutlined /> },
  access:           { color: 'default',  label: 'Access',      icon: <InfoCircleOutlined /> },
};
const cfgFor = (action) => ACTION_CFG[action] || { color: 'default', label: action || '—', icon: <AuditOutlined /> };

// Actions that play an alert sound when they arrive.
const ALERT_ACTIONS = new Set(['create', 'approve', 'reject', 'delete', 'login', 'logout']);

// ─── Tracking status display config ──────────────────────────────────────────
const TRACK_CFG = {
  active:  { color: 'success', tag: 'green',   label: 'On duty'      },
  gps_off: { color: 'warning', tag: 'orange',  label: 'Location off' },
  offline: { color: 'default', tag: 'default', label: 'Offline'      },
  stale:   { color: 'error',   tag: 'red',     label: 'Stale'        },
};
const trackCfg = (row) => {
  if (row.stale)                           return TRACK_CFG.stale;
  return TRACK_CFG[row.trackingStatus] || TRACK_CFG.offline;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmtTime     = (v) => v ? dayjs(v).format('HH:mm:ss')          : '—';
const fmtDate     = (v) => v ? dayjs(v).format('DD MMM YYYY')       : '—';
const fmtDateTime = (v) => v ? dayjs(v).format('DD MMM YYYY HH:mm') : '—';
const fmtRel      = (v) => v ? dayjs(v).fromNow()                   : '—';

/** Elapsed work time since punch-in, formatted as "Xh Ym". */
const fmtWorking = (punchIn) => {
  if (!punchIn) return null;
  const mins = Math.floor((Date.now() - new Date(punchIn).getTime()) / 60000);
  if (mins < 1)  return 'just punched in';
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
};

/** Fraction of a 9-hour workday elapsed (0–100). */
const workPct = (punchIn) =>
  punchIn ? Math.min(100, Math.round(((Date.now() - new Date(punchIn).getTime()) / (9 * 3600000)) * 100)) : 0;

const renderValue = (v) => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Animated circular clock showing elapsed work time. Ticks every 60 s. */
const WorkingClock = ({ punchIn, punchOut }) => {
  const [, tick] = useState(0);
  useEffect(() => {
    if (punchOut || !punchIn) return;
    const id = setInterval(() => tick((n) => n + 1), 60000);
    return () => clearInterval(id);
  }, [punchIn, punchOut]);

  if (!punchIn) return null;
  const pct  = punchOut ? 100 : workPct(punchIn);
  const text = punchOut ? fmtDateTime(punchOut) : fmtWorking(punchIn);
  const color = pct > 90 ? '#52c41a' : pct > 55 ? BRAND : '#1677ff';

  return (
    <div className="flex items-center gap-2">
      <Progress
        type="circle"
        size={40}
        percent={pct}
        strokeColor={color}
        format={() => <span className="text-[8px] font-bold leading-none">{punchOut ? '✓' : fmtWorking(punchIn)}</span>}
      />
      <div className="leading-tight">
        <div className="text-xs font-semibold">{punchOut ? 'Punched out' : (text || '—')}</div>
        <div className="text-[10px] text-gray-400">since {fmtTime(punchIn)}</div>
      </div>
    </div>
  );
};

/** Clickable location chip with Google Maps link. */
const LocationChip = ({ location }) => {
  if (!location || (location.lat == null && !location.address)) {
    return <Text type="secondary" className="text-xs">—</Text>;
  }
  const url   = location.lat != null ? `https://www.google.com/maps?q=${location.lat},${location.lng}` : null;
  const label = location.address || `${location.lat?.toFixed(5)}, ${location.lng?.toFixed(5)}`;
  return (
    <div className="flex items-start gap-1">
      <EnvironmentOutlined className="text-[10px] mt-0.5 shrink-0" style={{ color: BRAND }} />
      <div className="leading-tight">
        {url
          ? <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline break-all">{label}</a>
          : <span className="text-xs">{label}</span>}
        {location.accuracy ? <div className="text-[9px] text-gray-400">±{Math.round(location.accuracy)} m</div> : null}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────
export default function SEActivityHistory() {

  // ── State ──────────────────────────────────────────────────────────────────
  const [executives, setExecutives]     = useState([]);
  const [liveRows, setLiveRows]         = useState([]);
  const [logs, setLogs]                 = useState([]);
  const [logStats, setLogStats]         = useState({ total: 0, todayCount: 0, byAction: [], byModule: [] });
  const [loadingLive, setLoadingLive]   = useState(false);
  const [loadingLogs, setLoadingLogs]   = useState(false);
  const [socketLive, setSocketLive]     = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [activeTab, setActiveTab]       = useState('status'); // 'status' | 'activity' | 'trail'
  const [detailRow, setDetailRow]       = useState(null);  // activity log drawer
  const [selectedExec, setSelectedExec] = useState(null);  // exec history tab

  // Activity log filters
  const [logSearch,  setLogSearch]  = useState('');
  const [logAction,  setLogAction]  = useState(undefined);
  const [logModule,  setLogModule]  = useState(undefined);
  const [logDevice,  setLogDevice]  = useState(undefined); // 'mobile' | 'web'
  const [logRange,   setLogRange]   = useState(null);
  const [logPage, setLogPage]       = useState({ current: 1, pageSize: 30, total: 0 });

  // Track IDs we have already seen so we can detect newly arrived rows.
  const seenIds = useRef(new Set());
  const statsLoaded = useRef(false);

  // Trail state
  const [trail, setTrail]           = useState([]);
  const [trailLoading, setTrailLoading] = useState(false);
  const [trailDate, setTrailDate]   = useState(dayjs());

  // ── Data loaders ───────────────────────────────────────────────────────────
  const loadLive = useCallback(async () => {
    setLoadingLive(true);
    try {
      const res = await seMonitoringService.live();
      if (res?.success) setLiveRows(res.data || []);
    } finally {
      setLoadingLive(false);
    }
  }, []);

  const loadLogs = useCallback(async (page = 1) => {
    setLoadingLogs(true);
    try {
      const params = {
        page,
        limit: logPage.pageSize,
        ...(logSearch.trim()  ? { search:   logSearch.trim() } : {}),
        ...(logAction         ? { action:   logAction }         : {}),
        ...(logModule         ? { module:   logModule }         : {}),
        ...(logDevice         ? { device:   logDevice }         : {}),
        ...(logRange?.[0]     ? { dateFrom: logRange[0].format('YYYY-MM-DD') } : {}),
        ...(logRange?.[1]     ? { dateTo:   logRange[1].format('YYYY-MM-DD') } : {}),
      };
      const requests = [api.get('/system/activity-logs', { params })];
      if (!statsLoaded.current) requests.push(api.get('/system/activity-logs/stats'));

      const [logsRes, statsRes] = await Promise.all(requests);

      if (logsRes?.success) {
        const incoming = logsRes.data || [];

        // Detect new entries and play sound.
        if (soundEnabled && seenIds.current.size > 0) {
          const isNew = incoming.filter(
            (r) => !seenIds.current.has(r._id) && ALERT_ACTIONS.has(r.action),
          );
          if (isNew.length) playAlert();
        }
        incoming.forEach((r) => seenIds.current.add(r._id));

        setLogs(incoming);
        setLogPage((p) => ({
          ...p,
          current: logsRes.pagination?.currentPage ?? page,
          total:   logsRes.pagination?.totalItems  ?? 0,
        }));
      }

      if (statsRes?.success) {
        setLogStats(statsRes.data);
        statsLoaded.current = true;
      }
    } finally {
      setLoadingLogs(false);
    }
  }, [logSearch, logAction, logModule, logRange, logPage.pageSize, soundEnabled]);

  const loadTrail = useCallback(async (exec, date) => {
    if (!exec?.executiveId) return;
    setTrailLoading(true);
    try {
      const res = await seMonitoringService.trail(exec.executiveId, date.format('YYYY-MM-DD'));
      setTrail(res?.data?.points || []);
    } finally {
      setTrailLoading(false);
    }
  }, []);

  // ── Initial load ───────────────────────────────────────────────────────────
  useEffect(() => {
    seMonitoringService.executives()
      .then((res) => setExecutives(res?.data || res?.users || []))
      .catch(() => {});
    loadLive();
    loadLogs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-fetch logs when filters change ──────────────────────────────────────
  useEffect(() => {
    loadLogs(1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logAction, logModule, logDevice, logRange]);

  // ── Load trail when exec or date changes ──────────────────────────────────
  useEffect(() => {
    if (selectedExec && activeTab === 'trail') loadTrail(selectedExec, trailDate);
  }, [selectedExec, trailDate, activeTab, loadTrail]);

  // ── Socket tracking ─────────────────────────────────────────────────────────
  useEffect(() => {
    const unsub = subscribeToTracking((update) => {
      setSocketLive(true);
      if (soundEnabled) playTick();

      setLiveRows((cur) => {
        const idx = cur.findIndex((r) => String(r.executiveId) === String(update.executiveId));
        const patched = {
          ...(idx >= 0 ? cur[idx] : { executiveId: update.executiveId }),
          name:           update.name   || cur[idx]?.name  || '',
          lastSeenAt:     update.at,
          trackingStatus: update.status,
          battery:        update.battery  ?? null,
          charging:       update.charging === true,
          mocked:         update.mocked   === true,
          stale:          false,
          location:       update.lat != null
            ? { lat: update.lat, lng: update.lng, address: update.address }
            : cur[idx]?.location || null,
        };
        if (idx < 0) return [patched, ...cur];
        const next = [...cur];
        next[idx] = patched;
        return next;
      });
    });
    return unsub;
  }, [soundEnabled]);

  // ── Computed stats ─────────────────────────────────────────────────────────
  const liveStats = useMemo(() => ({
    total:     liveRows.length,
    active:    liveRows.filter((r) => r.trackingStatus === 'active' && !r.stale).length,
    punchedIn: liveRows.filter((r) => r.punchIn && !r.punchOut).length,
    onSite:    liveRows.filter((r) => r.onSite).length,
    gpsOff:    liveRows.filter((r) => r.trackingStatus === 'gps_off').length,
    stale:     liveRows.filter((r) => r.stale).length,
  }), [liveRows]);

  const moduleOptions = useMemo(() => {
    const BASE = [
      'auth', 'product', 'sales_order', 'payment', 'hrms', 'user',
      'quotation', 'lead', 'complaint', 'approval', 'scheme', 'stock',
    ];
    return Array.from(new Set([
      ...(logStats.byModule || []).map((m) => m._id).filter(Boolean),
      ...BASE,
    ])).sort();
  }, [logStats.byModule]);

  // ─────────────────────────────────────────────────────────────────────────
  // TAB DEFINITIONS
  // ─────────────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'status',   label: 'Employee Status',      icon: <UserOutlined /> },
    { id: 'activity', label: 'Activity & History',   icon: <HistoryOutlined /> },
    ...(selectedExec
      ? [{ id: 'trail', label: `${selectedExec.name}'s Trail`, icon: <EnvironmentOutlined /> }]
      : []),
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1 — Employee Status columns
  // ─────────────────────────────────────────────────────────────────────────
  const statusCols = [
    {
      title: 'Employee',
      dataIndex: 'name',
      width: 180,
      render: (v, row) => (
        <div className="leading-tight">
          <div className="font-semibold text-sm">{v || '—'}</div>
          <div className="text-[10px] text-gray-400">{row.empId || row.phone || ''}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'st',
      width: 130,
      render: (_, row) => {
        const cfg = trackCfg(row);
        return (
          <Tooltip title={row.onSite ? `At: ${row.dealerName || 'dealer'}` : cfg.label}>
            <Badge status={cfg.color} text={
              <Tag color={cfg.tag} className="text-xs">
                {row.onSite ? 'At dealer' : cfg.label}
              </Tag>
            } />
          </Tooltip>
        );
      },
    },
    {
      title: 'Working time',
      key: 'wt',
      width: 170,
      render: (_, row) => <WorkingClock punchIn={row.punchIn} punchOut={row.punchOut} />,
    },
    {
      title: 'Location',
      key: 'loc',
      render: (_, row) => (
        <div>
          <LocationChip location={row.location} />
          {row.mocked
            ? <div className="text-[9px] text-orange-500 mt-0.5">device reported mocked GPS</div>
            : null}
        </div>
      ),
    },
    {
      title: 'Last seen',
      dataIndex: 'lastSeenAt',
      width: 150,
      render: (v, row) => (
        <div className="leading-tight">
          <div className="text-xs font-medium">{fmtTime(v)}</div>
          <div className="text-[10px] text-gray-400">
            {fmtDate(v)}{row.stale ? ' · stale' : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Battery',
      key: 'bat',
      width: 85,
      render: (_, row) =>
        row.battery == null
          ? <Text type="secondary">—</Text>
          : (
            <span className={row.battery <= 15 ? 'text-red-500 font-semibold' : ''}>
              {row.battery}%{row.charging ? ' ⚡' : ''}
            </span>
          ),
    },
    {
      title: '',
      key: 'act',
      width: 80,
      render: (_, row) => (
        <Button
          size="small"
          type="link"
          onClick={() => {
            setSelectedExec(row);
            setActiveTab('trail');
          }}
        >
          History
        </Button>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2 — Activity log columns
  // ─────────────────────────────────────────────────────────────────────────
  const logCols = [
    {
      title: 'Time',
      dataIndex: 'timestamp',
      width: 130,
      sorter: (a, b) => new Date(b.timestamp) - new Date(a.timestamp),
      render: (v) => (
        <div className="leading-tight">
          <div className="text-xs font-medium">{fmtDate(v)}</div>
          <div className="text-[10px] text-gray-400">{fmtTime(v)}</div>
          <div className="text-[9px] text-gray-300">{fmtRel(v)}</div>
        </div>
      ),
    },
    {
      title: 'User',
      key: 'user',
      width: 145,
      render: (_, r) => (
        <div className="leading-tight">
          <div className="text-sm font-medium">{r.userName || '—'}</div>
          <div className="text-[10px] text-gray-400 capitalize">
            {r.userRole?.replace(/_/g, ' ') || ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 115,
      filters: Object.entries(ACTION_CFG).map(([k, v]) => ({ text: v.label, value: k })),
      render: (v) => {
        const cfg = cfgFor(v);
        return (
          <Tag icon={cfg.icon} color={cfg.color} className="text-xs">
            {cfg.label}
          </Tag>
        );
      },
    },
    {
      title: 'Module',
      dataIndex: 'module',
      width: 110,
      render: (v) => (
        <Tag className="text-[10px] capitalize">{v?.replace(/_/g, ' ') || '—'}</Tag>
      ),
    },
    {
      title: 'Record',
      key: 'rec',
      width: 180,
      render: (_, r) => (
        <div className="leading-tight">
          <div className="text-sm font-medium text-blue-600">{r.recordTitle || '—'}</div>
          {r.recordModel
            ? <div className="text-[10px] text-gray-400">{r.recordModel}</div>
            : null}
        </div>
      ),
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (v) => <span className="text-xs text-gray-600">{v || '—'}</span>,
    },
    {
      title: 'Device',
      dataIndex: 'device',
      width: 75,
      render: (v) => {
        const isMobile = v === 'mobile';
        return (
          <Tag
            color={isMobile ? 'blue' : 'default'}
            className="text-[10px]"
          >
            {isMobile ? '📱 App' : '🖥 Web'}
          </Tag>
        );
      },
    },
    {
      title: 'IP',
      dataIndex: 'ipAddress',
      width: 115,
      render: (v) => (
        <span className="text-[10px] font-mono text-gray-400">{v || '—'}</span>
      ),
    },
    {
      title: '',
      key: 'info',
      width: 55,
      render: (_, row) => (
        <Tooltip title="View details">
          <Button
            size="small"
            type="text"
            icon={<InfoCircleOutlined />}
            onClick={(e) => { e.stopPropagation(); setDetailRow(row); }}
          />
        </Tooltip>
      ),
    },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div>

      {/* ── Page header ────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
        <div>
          <Title level={4} style={{ margin: 0 }}>
            Activity &amp; History Management
          </Title>
          <Text type="secondary" className="text-sm">
            Live employee status · activity history · location tracking · change records
            {socketLive && (
              <span className="ml-2 text-green-600 font-medium">· live</span>
            )}
          </Text>
        </div>

        <Space wrap>
          {/* Sound toggle */}
          <Tooltip title={soundEnabled ? 'Notification sound on — click to mute' : 'Notification sound off — click to enable'}>
            <Button
              icon={soundEnabled ? <BellFilled /> : <BellOutlined />}
              style={soundEnabled ? { borderColor: BRAND, color: BRAND } : {}}
              onClick={() =>
                setSoundEnabled((on) => {
                  if (!on) playTone(880, 180, 0.15); // preview when turning on
                  return !on;
                })
              }
            >
              Sound {soundEnabled ? 'ON' : 'OFF'}
            </Button>
          </Tooltip>

          <Button
            icon={<ReloadOutlined />}
            onClick={() => { loadLive(); loadLogs(1); }}
            loading={loadingLive || loadingLogs}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {/* ── Summary stat cards ──────────────────────────────────────────── */}
      <Row gutter={[10, 10]} className="mb-4">
        {[
          { label: 'Total SE',       value: liveStats.total,          color: '#1677ff' },
          { label: 'On duty',        value: liveStats.active,         color: '#52c41a' },
          { label: 'Punched in',     value: liveStats.punchedIn,      color: BRAND     },
          { label: 'At a dealer',    value: liveStats.onSite,         color: '#722ed1' },
          { label: 'Location off',   value: liveStats.gpsOff,         color: '#faad14' },
          { label: 'Stale / silent', value: liveStats.stale,          color: '#ff4d4f' },
          { label: 'Logs today',     value: logStats.todayCount,      color: '#13c2c2' },
          { label: 'Total logs',     value: logStats.total,           color: '#8c8c8c' },
        ].map(({ label, value, color }) => (
          <Col xs={12} sm={8} md={6} lg={3} key={label}>
            <Card size="small" bodyStyle={{ padding: '10px 14px' }}>
              <Statistic
                title={<span className="text-[10px] text-gray-500">{label}</span>}
                value={value}
                valueStyle={{ fontSize: 20, color }}
              />
            </Card>
          </Col>
        ))}
      </Row>

      {/* ── Tab bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeTab === tab.id
                ? 'bg-white shadow-sm text-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            ].join(' ')}
          >
            {tab.icon}
            {tab.label}
            {tab.id === 'trail' && (
              <span
                role="button"
                tabIndex={0}
                className="ml-1 text-gray-400 hover:text-gray-700 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedExec(null);
                  setTrail([]);
                  setActiveTab('status');
                }}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); setSelectedExec(null); setActiveTab('status'); } }}
              >
                ✕
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          TAB 1 — Employee Status
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'status' && (
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
            <Text strong className="text-sm">
              Live status — {liveStats.total} executive{liveStats.total !== 1 ? 's' : ''}
            </Text>
            <Text type="secondary" className="text-xs">
              Updates via socket · click "History" for breadcrumb trail
            </Text>
          </div>
          <Table
            columns={statusCols}
            dataSource={liveRows}
            rowKey={(r) => String(r.executiveId || r.employeeId || Math.random())}
            loading={loadingLive}
            size="middle"
            scroll={{ x: 950 }}
            pagination={{ pageSize: 25, hideOnSinglePage: true }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No executives reporting. Tracking runs between punch-in and punch-out."
                />
              ),
            }}
          />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 2 — Activity & History
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'activity' && (
        <div>

          {/* Action breakdown quick-filter chips */}
          {(logStats.byAction || []).length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 mb-4 flex flex-wrap gap-2 items-center">
              <Text type="secondary" className="text-[10px] mr-1">TOP ACTIONS</Text>
              {(logStats.byAction || []).slice(0, 8).map((a) => {
                const cfg = cfgFor(a._id);
                return (
                  <Tooltip key={a._id} title={`${a.count} entries — click to filter`}>
                    <Tag
                      icon={cfg.icon}
                      color={cfg.color}
                      className="cursor-pointer text-[11px]"
                      onClick={() => setLogAction(a._id === logAction ? undefined : a._id)}
                      style={logAction === a._id ? { outline: `2px solid ${BRAND}` } : {}}
                    >
                      {cfg.label} · {a.count}
                    </Tag>
                  </Tooltip>
                );
              })}
              {logAction && (
                <Button size="small" type="link" onClick={() => setLogAction(undefined)}>
                  Clear filter
                </Button>
              )}
            </div>
          )}

          {/* Filters */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap gap-3 items-end">
              <Input
                placeholder="Search user, record, description…"
                prefix={<SearchOutlined className="text-gray-400" />}
                value={logSearch}
                onChange={(e) => setLogSearch(e.target.value)}
                onPressEnter={() => loadLogs(1)}
                className="w-56"
                allowClear
              />
              <Select
                placeholder="Action"
                allowClear
                value={logAction}
                onChange={setLogAction}
                className="w-36"
                options={Object.entries(ACTION_CFG).map(([k, v]) => ({ value: k, label: v.label }))}
              />
              <Select
                placeholder="Module"
                allowClear
                value={logModule}
                onChange={setLogModule}
                className="w-40"
                options={moduleOptions.map((m) => ({ value: m, label: m.replace(/_/g, ' ') }))}
              />
              <Select
                placeholder="Device"
                allowClear
                value={logDevice}
                onChange={setLogDevice}
                className="w-32"
                options={[
                  { value: 'mobile', label: '📱 Mobile App' },
                  { value: 'web',    label: '🖥 Web' },
                ]}
              />
              <RangePicker
                value={logRange}
                onChange={setLogRange}
                format="DD MMM YYYY"
                className="w-60"
              />
              <Button
                onClick={() => {
                  setLogSearch('');
                  setLogAction(undefined);
                  setLogModule(undefined);
                  setLogDevice(undefined);
                  setLogRange(null);
                  loadLogs(1);
                }}
              >
                Clear
              </Button>
              <Button
                type="primary"
                style={{ background: BRAND, borderColor: BRAND }}
                onClick={() => loadLogs(1)}
                loading={loadingLogs}
              >
                Search
              </Button>
            </div>
          </div>

          {/* Log table */}
          <div className="bg-white rounded-lg border border-gray-200">
            <Table
              columns={logCols}
              dataSource={logs}
              rowKey="_id"
              loading={loadingLogs}
              size="small"
              scroll={{ x: 1300 }}
              onRow={(row) => ({
                className: 'hover:bg-orange-50 cursor-pointer transition-colors',
                onClick: () => setDetailRow(row),
              })}
              pagination={{
                current:      logPage.current,
                pageSize:     logPage.pageSize,
                total:        logPage.total,
                showSizeChanger: true,
                pageSizeOptions: ['20', '30', '50', '100'],
                showTotal:    (t, r) => `${r[0]}–${r[1]} of ${t} entries`,
                onChange:     (page, size) =>
                  setLogPage((p) => ({ ...p, current: page, pageSize: size })),
              }}
            />
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          TAB 3 — Individual executive breadcrumb trail
      ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'trail' && selectedExec && (
        <Row gutter={16}>

          {/* Left — executive status card */}
          <Col xs={24} md={8} lg={7}>
            <Card
              size="small"
              className="mb-4"
              title={
                <div className="flex items-center gap-2">
                  <UserOutlined style={{ color: BRAND }} />
                  <span className="font-semibold">{selectedExec.name}</span>
                </div>
              }
            >
              <Descriptions column={1} size="small" colon>
                <Descriptions.Item label="Status">
                  <Tag color={trackCfg(selectedExec).tag}>
                    {selectedExec.onSite ? 'At dealer' : trackCfg(selectedExec).label}
                  </Tag>
                </Descriptions.Item>
                {selectedExec.onSite && selectedExec.dealerName && (
                  <Descriptions.Item label="At dealer">
                    {selectedExec.dealerName}
                  </Descriptions.Item>
                )}
                <Descriptions.Item label="Punch-in">
                  {fmtDateTime(selectedExec.punchIn)}
                </Descriptions.Item>
                <Descriptions.Item label="Punch-out">
                  {selectedExec.punchOut
                    ? fmtDateTime(selectedExec.punchOut)
                    : <span className="text-green-600">Still active</span>}
                </Descriptions.Item>
                <Descriptions.Item label="Last seen">
                  {fmtRel(selectedExec.lastSeenAt)}
                </Descriptions.Item>
                <Descriptions.Item label="Battery">
                  {selectedExec.battery != null
                    ? `${selectedExec.battery}%${selectedExec.charging ? ' ⚡' : ''}`
                    : '—'}
                </Descriptions.Item>
              </Descriptions>

              <Divider className="my-3" />
              <WorkingClock
                punchIn={selectedExec.punchIn}
                punchOut={selectedExec.punchOut}
              />

              {selectedExec.location && (
                <>
                  <Divider className="my-3" />
                  <div className="text-[10px] text-gray-400 mb-1 font-medium">LAST LOCATION</div>
                  <LocationChip location={selectedExec.location} />
                </>
              )}

              {selectedExec.mocked && (
                <>
                  <Divider className="my-2" />
                  <Alert
                    type="warning"
                    showIcon
                    message={<span className="text-xs">Device reported a mocked GPS fix</span>}
                    className="py-1"
                  />
                </>
              )}
            </Card>
          </Col>

          {/* Right — breadcrumb trail */}
          <Col xs={24} md={16} lg={17}>
            <Card
              size="small"
              title={
                <div className="flex flex-wrap items-center gap-3">
                  <span className="font-semibold">
                    Breadcrumb trail
                  </span>
                  <DatePicker
                    value={trailDate}
                    onChange={(d) => d && setTrailDate(d)}
                    format="DD MMM YYYY"
                    disabledDate={(d) => d.isAfter(dayjs())}
                    size="small"
                  />
                  <Button
                    size="small"
                    icon={<ReloadOutlined />}
                    onClick={() => loadTrail(selectedExec, trailDate)}
                    loading={trailLoading}
                  >
                    Reload
                  </Button>
                  <Text type="secondary" className="text-xs">
                    {trail.length} GPS point{trail.length !== 1 ? 's' : ''}
                  </Text>
                </div>
              }
              loading={trailLoading}
            >
              {trail.length > 0 ? (
                <div className="max-h-[460px] overflow-y-auto pr-1">
                  <Timeline
                    mode="left"
                    items={trail.map((pt, idx) => ({
                      key: `${pt.at}-${idx}`,
                      label: (
                        <span className="text-[10px] text-gray-500 w-16 text-right leading-none">
                          {fmtTime(pt.at)}
                        </span>
                      ),
                      dot: pt.context === 'visit'
                        ? <ShopOutlined className="text-purple-500" />
                        : <EnvironmentOutlined className="text-blue-500" />,
                      color: pt.context === 'visit' ? 'purple' : 'blue',
                      children: (
                        <div className="leading-snug pb-1">
                          <div className="text-xs">
                            {pt.address || `${pt.lat?.toFixed(5)}, ${pt.lng?.toFixed(5)}`}
                          </div>
                          <div className="flex flex-wrap gap-2 mt-0.5">
                            {pt.accuracy != null && (
                              <span className="text-[9px] text-gray-400">±{Math.round(pt.accuracy)} m</span>
                            )}
                            {pt.speed != null && (
                              <span className="text-[9px] text-gray-400">{pt.speed.toFixed(1)} m/s</span>
                            )}
                            {pt.battery != null && (
                              <span className="text-[9px] text-gray-400">🔋 {pt.battery}%</span>
                            )}
                            {pt.context === 'visit' && (
                              <span className="text-[9px] text-purple-500 font-medium">at dealer</span>
                            )}
                            {pt.mocked && (
                              <span className="text-[9px] text-orange-500">mocked GPS</span>
                            )}
                          </div>
                        </div>
                      ),
                    }))}
                  />
                </div>
              ) : (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={
                    trailLoading
                      ? 'Loading trail…'
                      : `No tracking data for ${trailDate.format('DD MMM YYYY')}`
                  }
                />
              )}
            </Card>
          </Col>
        </Row>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Activity detail drawer
      ══════════════════════════════════════════════════════════════════ */}
      <Drawer
        open={!!detailRow}
        onClose={() => setDetailRow(null)}
        title={
          detailRow ? (
            <div className="flex items-center gap-2">
              <Tag icon={cfgFor(detailRow.action).icon} color={cfgFor(detailRow.action).color}>
                {cfgFor(detailRow.action).label}
              </Tag>
              <span className="text-sm font-semibold">{detailRow.module?.replace(/_/g, ' ')}</span>
            </div>
          ) : 'Activity detail'
        }
        width={520}
        destroyOnClose
      >
        {detailRow && (
          <div className="space-y-4">

            {/* Basic info */}
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Time">
                {fmtDateTime(detailRow.timestamp)}
                <span className="ml-2 text-gray-400 text-xs">({fmtRel(detailRow.timestamp)})</span>
              </Descriptions.Item>
              <Descriptions.Item label="User">
                {detailRow.userName || '—'}
                {detailRow.userRole && (
                  <Tag className="ml-2 text-[10px] capitalize">{detailRow.userRole.replace(/_/g, ' ')}</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Record">
                <span className="font-medium text-blue-600">{detailRow.recordTitle || '—'}</span>
                {detailRow.recordModel && (
                  <span className="ml-2 text-gray-400 text-xs">{detailRow.recordModel}</span>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Description">
                {detailRow.description || '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Device">
                {detailRow.device || 'web'}
              </Descriptions.Item>
              <Descriptions.Item label="IP address">
                <span className="font-mono text-xs">{detailRow.ipAddress || '—'}</span>
              </Descriptions.Item>
            </Descriptions>

            {/* Field-level changes */}
            {Array.isArray(detailRow.changes) && detailRow.changes.length > 0 ? (
              <div>
                <Divider orientation="left" className="text-sm font-semibold">
                  Field changes ({detailRow.changes.length})
                </Divider>
                <Table
                  size="small"
                  pagination={false}
                  rowKey={(c, i) => `${c.field}-${i}`}
                  dataSource={detailRow.changes}
                  columns={[
                    {
                      title: 'Field',
                      dataIndex: 'field',
                      width: 140,
                      render: (v) => (
                        <span className="font-mono text-xs text-gray-700">{v || '—'}</span>
                      ),
                    },
                    {
                      title: 'Old value',
                      dataIndex: 'oldValue',
                      render: (v) => (
                        <span className="text-xs text-red-600 break-all">{renderValue(v)}</span>
                      ),
                    },
                    {
                      title: 'New value',
                      dataIndex: 'newValue',
                      render: (v) => (
                        <span className="text-xs text-green-700 break-all">{renderValue(v)}</span>
                      ),
                    },
                  ]}
                />
              </div>
            ) : (
              <Alert
                type="info"
                showIcon
                message={<span className="text-xs">No field-level changes captured for this entry.</span>}
              />
            )}

            {/* Raw metadata */}
            {detailRow.metadata && (
              <div>
                <Divider orientation="left" className="text-sm font-semibold">Metadata</Divider>
                <pre className="bg-gray-50 rounded p-3 text-[10px] overflow-auto max-h-40 font-mono text-gray-700">
                  {JSON.stringify(detailRow.metadata, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Drawer>

    </div>
  );
}
