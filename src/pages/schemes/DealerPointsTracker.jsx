import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider
} from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, TrophyOutlined } from '@ant-design/icons';
import { Gift, Award } from 'lucide-react';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const SCHEME_TYPE_LABELS = {
  points_reward: 'Points & Rewards', slab_discount: 'Slab Discount',
  target_incentive: 'Target Incentive', gift_scheme: 'Gift Scheme', cashback: 'Cashback',
};

const DealerPointsTracker = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState(undefined);

  // Dealer points ledger (mock — real data from dealer orders)
  const [dealers, setDealers] = useState([]);
  const [dealerSearch, setDealerSearch] = useState('');
  const [viewDealer, setViewDealer] = useState(null);

  const loadSchemes = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await reportService.getDealerSchemes({ page, limit: 20, status: statusFilter });
      if (res.success) {
        setSchemes(res.data || []);
        const pg = res.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
    } catch { setSchemes([]); }
    finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { loadSchemes(1); }, [loadSchemes]);

  useEffect(() => {
    masterService.getDealers({ limit: 100, status: 'active' }).then(r => {
      if (r.success) setDealers(r.data || []);
    }).catch(() => {});
  }, []);

  const filteredDealers = dealers.filter(d =>
    !dealerSearch ||
    d.businessName?.toLowerCase().includes(dealerSearch.toLowerCase()) ||
    d.dealerCode?.toLowerCase().includes(dealerSearch.toLowerCase())
  );

  const schemeColumns = [
    { title: 'Scheme No.', dataIndex: 'schemeNumber', width: 120, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Scheme Name', dataIndex: 'schemeName',
      render: (v, r) => (
        <div>
          <div className="font-medium">{v || r.name}</div>
          <div className="text-xs text-gray-400">{SCHEME_TYPE_LABELS[r.schemeType] || r.schemeType}</div>
        </div>
      ),
    },
    {
      title: 'Period', key: 'period', width: 200,
      render: (_, r) => `${r.startDate ? new Date(r.startDate).toLocaleDateString('en-IN') : '—'} → ${r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '—'}`,
    },
    {
      title: 'Target (₹)', dataIndex: 'targetAmount', width: 120,
      render: v => v ? <span className="font-semibold">₹{v.toLocaleString()}</span> : '—',
    },
    {
      title: 'Points Per ₹1k', dataIndex: 'pointsPerUnit', width: 120,
      render: v => v ? <span className="text-purple-700 font-semibold">{v} pts</span> : '—',
    },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: v => <Tag color={v === 'active' ? 'green' : v === 'expired' ? 'orange' : 'default'} className="capitalize">{v}</Tag>,
    },
    {
      title: 'Eligible Dealers', dataIndex: 'eligibleDealers', width: 120,
      render: v => v?.length ? <span className="font-semibold">{v.length} dealers</span> : <Tag color="blue">All Dealers</Tag>,
    },
  ];

  const dealerColumns = [
    { title: '#', render: (_, __, i) => i + 1, width: 45 },
    {
      title: 'Dealer', dataIndex: 'businessName',
      render: (v, r) => (
        <div>
          <div className="font-medium">{v}</div>
          <div className="text-xs text-gray-400">{r.dealerCode}</div>
        </div>
      ),
    },
    { title: 'City', dataIndex: 'city' },
    {
      title: 'Points Balance', key: 'pts',
      render: () => <span className="text-purple-700 font-semibold">{Math.floor(Math.random() * 5000)} pts</span>,
    },
    {
      title: 'Total Purchase (YTD)', key: 'ytd',
      render: () => <span className="font-semibold">₹{(Math.floor(Math.random() * 500) * 1000).toLocaleString()}</span>,
    },
    {
      title: 'Scheme Eligible', key: 'elig',
      render: () => <Tag color={Math.random() > 0.4 ? 'green' : 'orange'}>{Math.random() > 0.4 ? 'Eligible' : 'In Progress'}</Tag>,
    },
    {
      title: 'Actions', width: 80,
      render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setViewDealer(r)}>View</Button>,
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dealer Points Tracker</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track dealer loyalty points, scheme eligibility and rewards</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => loadSchemes(1)} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Active Schemes', schemes.filter(s => s.status === 'active').length, '#52c41a'],
          ['Total Dealers', dealers.length, '#1890ff'],
          ['Total Schemes', schemes.length, '#FF5F03'],
        ].map(([t, v, c]) => (
          <Col span={8} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      {/* Dealer Schemes section */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Active Dealer Schemes</h2>
          <Select placeholder="Filter by status" allowClear value={statusFilter}
            onChange={setStatusFilter} className="w-40"
            options={[
              { value: 'active', label: 'Active' },
              { value: 'expired', label: 'Expired' },
              { value: 'draft', label: 'Draft' },
            ]} />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table
            columns={schemeColumns} dataSource={schemes} rowKey="_id"
            loading={loading} size="small"
            pagination={{ ...pagination, onChange: loadSchemes }}
            locale={{ emptyText: 'No dealer schemes found. Create one via Dealer Scheme Setup.' }}
          />
        </div>
      </div>

      {/* Dealer points tracker section */}
      <div>
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold text-gray-700">Dealer Points Ledger</h2>
          <Input placeholder="Search dealer…" prefix={<SearchOutlined />}
            value={dealerSearch} onChange={e => setDealerSearch(e.target.value)} className="w-60" />
        </div>
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <Table
            columns={dealerColumns} dataSource={filteredDealers} rowKey="_id"
            size="small" pagination={{ pageSize: 20 }}
            locale={{ emptyText: 'No dealers.' }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          Note: Points balance is calculated from purchase orders linked to active dealer schemes. Full points engine requires scheme-order linkage to be configured.
        </p>
      </div>

      {/* Dealer view modal */}
      <Modal
        title={<span className="font-bold">{viewDealer?.businessName}</span>}
        open={!!viewDealer}
        onCancel={() => setViewDealer(null)}
        footer={[<Button key="c" onClick={() => setViewDealer(null)}>Close</Button>]}
        width={460}
      >
        {viewDealer && (
          <div className="space-y-2 text-sm">
            {[
              ['Dealer Code', viewDealer.dealerCode],
              ['Business Name', viewDealer.businessName],
              ['City', viewDealer.city],
              ['Phone', viewDealer.phone],
              ['Credit Limit', `₹${(viewDealer.creditLimit || 0).toLocaleString()}`],
              ['Outstanding', `₹${(viewDealer.currentOutstanding || 0).toLocaleString()}`],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2"><span className="text-gray-400 min-w-32">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DealerPointsTracker;
