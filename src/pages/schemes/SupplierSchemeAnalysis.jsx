import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber, Tabs
} from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, CheckOutlined, SendOutlined } from '@ant-design/icons';
import { TrendingUp } from 'lucide-react';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = { active: 'green', expired: 'orange', claimed: 'blue', closed: 'default' };
const TYPE_LABELS = {
  quantity_discount: 'Quantity Discount', cash_incentive: 'Cash Incentive',
  product_scheme: 'Product Scheme', annual_bonus: 'Annual Bonus',
};

const SupplierSchemeAnalysis = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [suppliers, setSuppliers] = useState([]);
  const [supplierFilter, setSupplierFilter] = useState(undefined);

  const [claimModal, setClaimModal] = useState(null);
  const [claimAmount, setClaimAmount] = useState(0);
  const [claimLoading, setClaimLoading] = useState(false);
  const [settleModal, setSettleModal] = useState(null);
  const [settledAmount, setSettledAmount] = useState(0);
  const [settleLoading, setSettleLoading] = useState(false);
  const [viewScheme, setViewScheme] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        reportService.getSupplierSchemes({ page, limit: 20, search, status: statusFilter, supplier: supplierFilter }),
        reportService.getSupplierSchemeStats(),
      ]);
      if (listRes.success) {
        setSchemes(listRes.data || []);
        const pg = listRes.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, statusFilter, supplierFilter]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data || []); }).catch(() => {});
  }, []);

  const handleClaim = async () => {
    setClaimLoading(true);
    try {
      const res = await reportService.claimSupplierScheme(claimModal._id, { claimAmount });
      if (res.success) { message.success('Claim submitted'); setClaimModal(null); load(1); }
    } catch (err) { message.error(err.message); }
    finally { setClaimLoading(false); }
  };

  const handleSettle = async () => {
    setSettleLoading(true);
    try {
      const res = await reportService.settleSupplierScheme(settleModal._id, { settledAmount });
      if (res.success) { message.success('Scheme settled'); setSettleModal(null); load(1); }
    } catch (err) { message.error(err.message); }
    finally { setSettleLoading(false); }
  };

  // Compute analysis — grouping by supplier
  const bySupplier = schemes.reduce((acc, s) => {
    const key = s.supplierName || 'Unknown';
    if (!acc[key]) acc[key] = { supplier: key, schemes: 0, earned: 0, claimed: 0, settled: 0 };
    acc[key].schemes++;
    acc[key].earned += s.totalIncentiveEarned || 0;
    acc[key].claimed += s.totalClaimAmount || 0;
    acc[key].settled += s.claimSettledAmount || 0;
    return acc;
  }, {});

  const analysisData = Object.values(bySupplier).sort((a, b) => b.earned - a.earned);

  const schemeColumns = [
    { title: 'Scheme No.', dataIndex: 'schemeNumber', width: 120, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    { title: 'Scheme Name', dataIndex: 'schemeName', render: (v, r) => <div><div className="font-medium">{v}</div><div className="text-xs text-gray-400">{r.supplierName}</div></div> },
    { title: 'Type', dataIndex: 'schemeType', render: v => <Tag color="blue" className="text-xs">{TYPE_LABELS[v] || v}</Tag> },
    { title: 'Valid Till', dataIndex: 'endDate', width: 110, render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { title: 'Earned (₹)', dataIndex: 'totalIncentiveEarned', width: 110, render: v => <span className="text-green-700 font-semibold">₹{(v||0).toLocaleString()}</span> },
    { title: 'Claimed (₹)', dataIndex: 'totalClaimAmount', width: 110, render: v => <span className="text-blue-700 font-semibold">₹{(v||0).toLocaleString()}</span> },
    { title: 'Settled (₹)', dataIndex: 'claimSettledAmount', width: 110, render: v => <span className="font-semibold">₹{(v||0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 90, render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v}</Tag> },
    {
      title: 'Actions', width: 180,
      render: (_, r) => (
        <Space size="small">
          {r.status === 'active' && <Button size="small" icon={<SendOutlined />} onClick={() => { setClaimModal(r); setClaimAmount(r.totalIncentiveEarned || 0); }}>Claim</Button>}
          {r.status === 'claimed' && <Button size="small" type="primary" icon={<CheckOutlined />}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
            onClick={() => { setSettleModal(r); setSettledAmount(r.totalClaimAmount || 0); }}>Settle</Button>}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewScheme(r)}>View</Button>
        </Space>
      ),
    },
  ];

  const analysisColumns = [
    { title: 'Supplier', dataIndex: 'supplier', render: v => <span className="font-semibold">{v}</span> },
    { title: 'Schemes', dataIndex: 'schemes', width: 80 },
    { title: 'Earned (₹)', dataIndex: 'earned', width: 120, render: v => <span className="text-green-700 font-semibold">₹{v.toLocaleString()}</span> },
    { title: 'Claimed (₹)', dataIndex: 'claimed', width: 120, render: v => <span className="text-blue-700">₹{v.toLocaleString()}</span> },
    { title: 'Settled (₹)', dataIndex: 'settled', width: 120, render: v => `₹${v.toLocaleString()}` },
    { title: 'Pending (₹)', key: 'pending', width: 120, render: (_, r) => <span className="text-orange-600 font-semibold">₹{(r.earned - r.settled).toLocaleString()}</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Scheme Analysis</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track incentive earnings, claims and settlements</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total Schemes', stats.total || 0, '#1890ff'],
          ['Active', stats.active || 0, '#52c41a'],
          ['Claimed', stats.claimed || 0, '#fa8c16'],
          ['Total Earned', `₹${(stats.totalEarned || 0).toLocaleString()}`, '#FF5F03'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by scheme no. or supplier…" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))} />
          <Select placeholder="Supplier" allowClear value={supplierFilter} onChange={setSupplierFilter}
            className="w-52" showSearch
            filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
            options={suppliers.map(s => ({ value: s._id, label: s.companyName }))} />
        </div>
      </div>

      <Tabs items={[
        {
          key: 'schemes',
          label: 'All Schemes',
          children: (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <Table columns={schemeColumns} dataSource={schemes} rowKey="_id"
                loading={loading} size="small"
                pagination={{ ...pagination, onChange: load }}
                locale={{ emptyText: 'No schemes found.' }} />
            </div>
          ),
        },
        {
          key: 'analysis',
          label: 'Supplier-wise Analysis',
          children: (
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <Table columns={analysisColumns} dataSource={analysisData} rowKey="supplier"
                size="small" pagination={false}
                locale={{ emptyText: 'No data.' }} />
            </div>
          ),
        },
      ]} />

      {/* Claim Modal */}
      <Modal title="Submit Claim" open={!!claimModal} onCancel={() => setClaimModal(null)}
        onOk={handleClaim} confirmLoading={claimLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        okText="Submit Claim">
        <Divider />
        <div className="space-y-3">
          <div className="bg-gray-50 p-3 rounded text-sm font-medium">{claimModal?.schemeName} — {claimModal?.supplierName}</div>
          <div><label className="text-xs text-gray-500 block mb-1">Claim Amount (₹) *</label>
            <InputNumber value={claimAmount} onChange={v => setClaimAmount(v || 0)} prefix="₹" className="w-full" min={0} /></div>
        </div>
      </Modal>

      {/* Settle Modal */}
      <Modal title="Settle Scheme" open={!!settleModal} onCancel={() => setSettleModal(null)}
        onOk={handleSettle} confirmLoading={settleLoading}
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
        okText="Confirm Settlement">
        <Divider />
        <div className="space-y-3">
          <div className="bg-gray-50 p-3 rounded text-sm font-medium">{settleModal?.schemeName} — Claimed: ₹{(settleModal?.totalClaimAmount || 0).toLocaleString()}</div>
          <div><label className="text-xs text-gray-500 block mb-1">Settled Amount (₹) *</label>
            <InputNumber value={settledAmount} onChange={v => setSettledAmount(v || 0)} prefix="₹" className="w-full" min={0} /></div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal title={<span className="font-bold">{viewScheme?.schemeNumber}</span>}
        open={!!viewScheme} onCancel={() => setViewScheme(null)}
        footer={[<Button key="c" onClick={() => setViewScheme(null)}>Close</Button>]} width={520}>
        {viewScheme && (
          <div className="space-y-2 text-sm">
            {[
              ['Supplier', viewScheme.supplierName],
              ['Scheme Name', viewScheme.schemeName],
              ['Type', TYPE_LABELS[viewScheme.schemeType] || viewScheme.schemeType],
              ['Status', viewScheme.status],
              ['Valid', `${viewScheme.startDate ? new Date(viewScheme.startDate).toLocaleDateString('en-IN') : '—'} → ${viewScheme.endDate ? new Date(viewScheme.endDate).toLocaleDateString('en-IN') : '—'}`],
              ['Earned', `₹${(viewScheme.totalIncentiveEarned || 0).toLocaleString()}`],
              ['Claimed', `₹${(viewScheme.totalClaimAmount || 0).toLocaleString()}`],
              ['Settled', `₹${(viewScheme.claimSettledAmount || 0).toLocaleString()}`],
              ['Remarks', viewScheme.remarks || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SupplierSchemeAnalysis;
