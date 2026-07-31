import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Tag, Space, message,
  Row, Col, Card, Statistic, Tabs, Divider
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { TrendingUp, Gift } from 'lucide-react';
import reportService from '../../services/reportService.js';

const STATUS_COLORS = { active: 'green', expired: 'orange', claimed: 'blue', closed: 'default' };

const SchemeReconciliation = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getSupplierSchemes({ limit: 200 });
      if (res.success) setSchemes(res.data || []);
    } catch { setSchemes([]); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Compute reconciliation totals
  const totals = schemes.reduce((acc, s) => {
    acc.earned += s.totalIncentiveEarned || 0;
    acc.claimed += s.totalClaimAmount || 0;
    acc.settled += s.claimSettledAmount || 0;
    return acc;
  }, { earned: 0, claimed: 0, settled: 0 });

  const pendingClaim = totals.earned - totals.claimed;
  const pendingSettlement = totals.claimed - totals.settled;

  // Per-supplier reconciliation
  const bySupplier = Object.values(schemes.reduce((acc, s) => {
    const key = s.supplierName || 'Unknown';
    if (!acc[key]) acc[key] = { supplier: key, earned: 0, claimed: 0, settled: 0, count: 0 };
    acc[key].earned += s.totalIncentiveEarned || 0;
    acc[key].claimed += s.totalClaimAmount || 0;
    acc[key].settled += s.claimSettledAmount || 0;
    acc[key].count++;
    return acc;
  }, {})).sort((a, b) => b.earned - a.earned);

  const supplierCols = [
    { title: 'Supplier', dataIndex: 'supplier', render: v => <span className="font-semibold">{v}</span> },
    { title: 'Schemes', dataIndex: 'count', width: 80 },
    { title: 'Total Earned (₹)', dataIndex: 'earned', width: 150, render: v => <span className="text-green-700 font-semibold">₹{v.toLocaleString()}</span> },
    { title: 'Claimed (₹)', dataIndex: 'claimed', width: 130, render: v => <span className="text-blue-700">₹{v.toLocaleString()}</span> },
    { title: 'Settled (₹)', dataIndex: 'settled', width: 130, render: v => `₹${v.toLocaleString()}` },
    {
      title: 'Pending Claim (₹)', key: 'pc', width: 140,
      render: (_, r) => {
        const p = r.earned - r.claimed;
        return p > 0 ? <span className="text-orange-600 font-semibold">₹{p.toLocaleString()}</span> : <span className="text-gray-400">—</span>;
      },
    },
    {
      title: 'Pending Settlement (₹)', key: 'ps', width: 170,
      render: (_, r) => {
        const p = r.claimed - r.settled;
        return p > 0 ? <span className="text-red-600 font-semibold">₹{p.toLocaleString()}</span> : <span className="text-gray-400">—</span>;
      },
    },
  ];

  const schemeCols = [
    { title: 'Scheme No.', dataIndex: 'schemeNumber', width: 120, render: v => <span className="font-mono text-xs">{v}</span> },
    { title: 'Scheme', dataIndex: 'schemeName', render: (v, r) => <div><div className="font-medium">{v}</div><div className="text-xs text-gray-400">{r.supplierName}</div></div> },
    { title: 'Status', dataIndex: 'status', width: 90, render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v}</Tag> },
    { title: 'Earned', dataIndex: 'totalIncentiveEarned', width: 110, render: v => <span className="text-green-700">₹{(v||0).toLocaleString()}</span> },
    { title: 'Claimed', dataIndex: 'totalClaimAmount', width: 110, render: v => v ? `₹${v.toLocaleString()}` : '—' },
    { title: 'Settled', dataIndex: 'claimSettledAmount', width: 110, render: v => v ? `₹${v.toLocaleString()}` : '—' },
    {
      title: 'Difference', key: 'diff', width: 110,
      render: (_, r) => {
        const diff = (r.totalClaimAmount || 0) - (r.claimSettledAmount || 0);
        if (diff === 0) return <Tag color="green">Reconciled</Tag>;
        return <Tag color="orange">₹{diff.toLocaleString()} pending</Tag>;
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Incentive Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Reconcile supplier scheme earnings vs claims vs settlements</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total Earned (₹)', `₹${totals.earned.toLocaleString()}`, '#52c41a'],
          ['Total Claimed (₹)', `₹${totals.claimed.toLocaleString()}`, '#1890ff'],
          ['Total Settled (₹)', `₹${totals.settled.toLocaleString()}`, '#722ed1'],
          ['Pending Claim (₹)', `₹${pendingClaim.toLocaleString()}`, pendingClaim > 0 ? '#fa8c16' : '#52c41a'],
          ['Pending Settlement (₹)', `₹${pendingSettlement.toLocaleString()}`, pendingSettlement > 0 ? '#f5222d' : '#52c41a'],
        ].map(([t, v, c]) => (
          <Col span={Math.floor(24/5)} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c, fontSize: 16 }} />
          </Card></Col>
        ))}
      </Row>

      <Tabs items={[
        {
          key: 'supplier',
          label: 'Supplier-wise Reconciliation',
          children: (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <Table columns={supplierCols} dataSource={bySupplier} rowKey="supplier"
                loading={loading} size="small" pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'No data.' }} />
            </div>
          ),
        },
        {
          key: 'scheme',
          label: 'Scheme-wise Reconciliation',
          children: (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <Table columns={schemeCols} dataSource={schemes} rowKey="_id"
                loading={loading} size="small" pagination={{ pageSize: 20 }}
                locale={{ emptyText: 'No schemes.' }} />
            </div>
          ),
        },
      ]} />
    </div>
  );
};

export default SchemeReconciliation;
