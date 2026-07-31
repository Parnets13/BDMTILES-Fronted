import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Progress, Tooltip
} from 'antd';
import { SearchOutlined, ReloadOutlined, WarningOutlined, PhoneOutlined } from '@ant-design/icons';
import { Clock, AlertTriangle, CheckCircle } from 'lucide-react';
import financeService from '../../services/financeService.js';
import masterService from '../../services/masterService.js';

const OVERDUE_BUCKETS = [
  { key: 'current',   label: 'Current',       color: 'green',  days: 0  },
  { key: '1_30',      label: '1–30 Days',      color: 'blue',   days: 30 },
  { key: '31_60',     label: '31–60 Days',     color: 'orange', days: 60 },
  { key: '61_90',     label: '61–90 Days',     color: 'volcano',days: 90 },
  { key: '90_plus',   label: '90+ Days',       color: 'red',    days: 999},
];

const getBucket = (daysOverdue) => {
  if (daysOverdue <= 0)  return 'current';
  if (daysOverdue <= 30) return '1_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  return '90_plus';
};

const CreditDaysMonitor = () => {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [bucketFilter, setBucketFilter] = useState('all');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [summary, setSummary] = useState({
    totalOutstanding: 0, overLimit: 0, overDue: 0, current: 0,
  });

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await financeService.getDealers({
        search, page, limit: 25,
      });
      if (res.success) {
        const today = new Date();
        const data = (res.data || []).map(d => {
          const outstanding = d.currentOutstanding || d.outstanding || 0;
          const creditLimit = d.creditLimit || 0;
          const creditDays  = d.creditDays  || 30;
          // Use lastInvoiceDate or createdAt as proxy for when credit started
          const lastActivity = d.lastInvoiceDate ? new Date(d.lastInvoiceDate) : null;
          const daysOverdue  = lastActivity
            ? Math.max(0, Math.floor((today - lastActivity) / (1000 * 60 * 60 * 24)) - creditDays)
            : 0;
          return {
            ...d,
            outstanding,
            creditLimit,
            creditDays,
            daysOverdue,
            bucket: getBucket(daysOverdue),
            overLimit: outstanding > creditLimit,
            utilization: creditLimit > 0 ? Math.min(100, Math.round((outstanding / creditLimit) * 100)) : 0,
          };
        });

        setSummary({
          totalOutstanding: data.reduce((s, d) => s + d.outstanding, 0),
          overLimit: data.filter(d => d.overLimit).length,
          overDue:   data.filter(d => d.daysOverdue > 0).length,
          current:   data.filter(d => d.daysOverdue === 0).length,
        });

        setDealers(data);
        const pg = res.pagination;
        setPagination({ current: pg?.currentPage || page, pageSize: 25, total: pg?.totalItems || 0 });
      }
    } catch (err) { message.error(err.message || 'Load failed'); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1); }, [load]);

  const filtered = dealers.filter(d =>
    bucketFilter === 'all' || d.bucket === bucketFilter
  );

  const bucketCounts = OVERDUE_BUCKETS.reduce((acc, b) => {
    acc[b.key] = dealers.filter(d => d.bucket === b.key).length;
    return acc;
  }, {});

  const columns = [
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-sm">{r.businessName || r.name}</div>
          <div className="text-xs text-gray-400 font-mono">{r.dealerCode}</div>
        </div>
      ),
    },
    {
      title: 'City',
      dataIndex: 'city',
      width: 100,
      render: v => <span className="text-sm text-gray-600">{v || '—'}</span>,
    },
    {
      title: 'Outstanding (₹)',
      dataIndex: 'outstanding',
      width: 130,
      sorter: (a, b) => b.outstanding - a.outstanding,
      render: (v, r) => (
        <span className={`font-bold text-sm ${r.overLimit ? 'text-red-600' : 'text-gray-800'}`}>
          ₹{(v || 0).toLocaleString()}
          {r.overLimit && (
            <Tooltip title="Exceeds credit limit">
              <WarningOutlined className="ml-1 text-red-500" />
            </Tooltip>
          )}
        </span>
      ),
    },
    {
      title: 'Credit Limit (₹)',
      dataIndex: 'creditLimit',
      width: 130,
      render: v => <span className="text-sm">₹{(v || 0).toLocaleString()}</span>,
    },
    {
      title: 'Utilization',
      dataIndex: 'utilization',
      width: 140,
      sorter: (a, b) => b.utilization - a.utilization,
      render: (v, r) => (
        <div className="min-w-24">
          <Progress
            percent={v}
            size="small"
            strokeColor={v >= 100 ? '#dc2626' : v >= 80 ? '#d97706' : '#16a34a'}
            format={p => `${p}%`}
          />
        </div>
      ),
    },
    {
      title: 'Credit Days',
      dataIndex: 'creditDays',
      width: 100,
      render: v => <span className="text-sm">{v || 30} days</span>,
    },
    {
      title: 'Days Overdue',
      dataIndex: 'daysOverdue',
      width: 110,
      sorter: (a, b) => b.daysOverdue - a.daysOverdue,
      render: (v, r) => {
        if (v <= 0) return <Tag color="green" icon={<CheckCircle size={11} />}>Current</Tag>;
        const bkt = OVERDUE_BUCKETS.find(b => b.key === r.bucket);
        return <Tag color={bkt?.color || 'red'}><Clock size={11} className="inline mr-1" />{v} days</Tag>;
      },
    },
    {
      title: 'Phone',
      dataIndex: 'mobile',
      width: 120,
      render: v => v ? (
        <a href={`tel:${v}`} className="text-xs text-blue-600 flex items-center gap-1">
          <PhoneOutlined /> {v}
        </a>
      ) : <span className="text-gray-400">—</span>,
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Clock size={22} className="text-blue-500" />
            Credit Days Monitor
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Track dealer outstanding balances and credit limit utilization
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading}>
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      <Row gutter={16} className="mb-5">
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '4px solid #1890ff' }}>
            <Statistic title="Total Outstanding" value={`₹${summary.totalOutstanding.toLocaleString()}`}
              valueStyle={{ color: '#1890ff', fontSize: 18 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '4px solid #dc2626', cursor: 'pointer' }}
            onClick={() => setBucketFilter(bucketFilter === 'all' ? '90_plus' : 'all')}>
            <Statistic title="Over Credit Limit" value={summary.overLimit}
              valueStyle={{ color: '#dc2626', fontSize: 22 }} suffix="dealers" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '4px solid #d97706', cursor: 'pointer' }}
            onClick={() => setBucketFilter(bucketFilter === 'all' ? '31_60' : 'all')}>
            <Statistic title="Overdue Accounts" value={summary.overDue}
              valueStyle={{ color: '#d97706', fontSize: 22 }} suffix="dealers" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
            <Statistic title="Current (Within Limit)" value={summary.current}
              valueStyle={{ color: '#52c41a', fontSize: 22 }} suffix="dealers" />
          </Card>
        </Col>
      </Row>

      {/* Bucket tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Button
          size="small"
          type={bucketFilter === 'all' ? 'primary' : 'default'}
          onClick={() => setBucketFilter('all')}
          style={bucketFilter === 'all' ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
        >
          All ({dealers.length})
        </Button>
        {OVERDUE_BUCKETS.map(b => (
          <Button
            key={b.key}
            size="small"
            type={bucketFilter === b.key ? 'primary' : 'default'}
            onClick={() => setBucketFilter(b.key)}
            danger={['61_90', '90_plus'].includes(b.key) && bucketCounts[b.key] > 0}
          >
            {b.label} ({bucketCounts[b.key] || 0})
          </Button>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <Input
          placeholder="Search dealer name, code, city…"
          prefix={<SearchOutlined />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="max-w-sm"
          allowClear
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 text-sm font-medium text-gray-600">
          {filtered.length} dealer{filtered.length !== 1 ? 's' : ''} shown
        </div>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="_id"
          loading={loading}
          size="small"
          pagination={{ ...pagination, onChange: load }}
          rowClassName={r =>
            r.overLimit         ? 'bg-red-50'    :
            r.daysOverdue > 60  ? 'bg-orange-50' : ''
          }
          locale={{ emptyText: 'No dealers found.' }}
        />
      </div>
    </div>
  );
};

export default CreditDaysMonitor;
