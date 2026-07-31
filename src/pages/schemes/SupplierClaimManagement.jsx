import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber, Timeline
} from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, SendOutlined, CheckOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = { active: 'green', expired: 'orange', claimed: 'blue', closed: 'default' };

const emptyForm = () => ({
  supplier: '', schemeName: '', schemeType: 'quantity_discount',
  startDate: '', endDate: '', totalTargetValue: 0, remarks: '',
});

const SupplierClaimManagement = () => {
  const [schemes, setSchemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [suppliers, setSuppliers] = useState([]);

  const [claimModal, setClaimModal] = useState(null);
  const [claimAmount, setClaimAmount] = useState(0);
  const [claimNotes, setClaimNotes] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  const [settleModal, setSettleModal] = useState(null);
  const [settledAmount, setSettledAmount] = useState(0);
  const [settleLoading, setSettleLoading] = useState(false);

  const [viewScheme, setViewScheme] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await reportService.getSupplierSchemes({ page, limit: 20, search, status: statusFilter });
      if (res.success) {
        setSchemes(res.data || []);
        const pg = res.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
    } catch { setSchemes([]); }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data || []); }).catch(() => {});
  }, []);

  const submitClaim = async () => {
    if (!claimAmount || claimAmount <= 0) { message.error('Enter valid claim amount'); return; }
    setClaimLoading(true);
    try {
      const res = await reportService.claimSupplierScheme(claimModal._id, { claimAmount, notes: claimNotes });
      if (res.success) { message.success(`Claim of ₹${claimAmount.toLocaleString()} submitted`); setClaimModal(null); load(1); }
    } catch (err) { message.error(err.message); }
    finally { setClaimLoading(false); }
  };

  const submitSettle = async () => {
    if (!settledAmount || settledAmount <= 0) { message.error('Enter settled amount'); return; }
    setSettleLoading(true);
    try {
      const res = await reportService.settleSupplierScheme(settleModal._id, { settledAmount });
      if (res.success) { message.success('Scheme settled'); setSettleModal(null); load(1); }
    } catch (err) { message.error(err.message); }
    finally { setSettleLoading(false); }
  };

  const totalClaimed = schemes.filter(s => s.status === 'claimed').reduce((acc, s) => acc + (s.totalClaimAmount || 0), 0);
  const pendingSettlement = schemes.filter(s => s.status === 'claimed').length;

  const columns = [
    { title: 'Scheme No.', dataIndex: 'schemeNumber', width: 120, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    { title: 'Scheme Name / Supplier', dataIndex: 'schemeName', render: (v, r) => <div><div className="font-medium">{v}</div><div className="text-xs text-gray-400">{r.supplierName}</div></div> },
    { title: 'Period', key: 'period', width: 180, render: (_, r) => `${r.startDate ? new Date(r.startDate).toLocaleDateString('en-IN') : '—'} → ${r.endDate ? new Date(r.endDate).toLocaleDateString('en-IN') : '—'}` },
    { title: 'Earned (₹)', dataIndex: 'totalIncentiveEarned', width: 120, render: v => <span className="text-green-700 font-semibold">₹{(v||0).toLocaleString()}</span> },
    { title: 'Claim Amt (₹)', dataIndex: 'totalClaimAmount', width: 120, render: v => v ? <span className="text-blue-700 font-semibold">₹{v.toLocaleString()}</span> : '—' },
    {
      title: 'Settled (₹)', dataIndex: 'claimSettledAmount', width: 120,
      render: v => v ? <span className="font-semibold text-gray-800">₹{v.toLocaleString()}</span> : '—',
    },
    { title: 'Status', dataIndex: 'status', width: 90, render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v}</Tag> },
    {
      title: 'Actions', width: 200,
      render: (_, r) => (
        <Space size="small">
          {r.status === 'active' && (
            <Button size="small" icon={<SendOutlined />}
              onClick={() => { setClaimModal(r); setClaimAmount(r.totalIncentiveEarned || 0); setClaimNotes(''); }}>
              Submit Claim
            </Button>
          )}
          {r.status === 'claimed' && (
            <Button size="small" type="primary" icon={<CheckOutlined />}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => { setSettleModal(r); setSettledAmount(r.totalClaimAmount || 0); }}>
              Mark Settled
            </Button>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewScheme(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Claim Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Submit and track incentive claims from suppliers</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Pending Claims', pendingSettlement, '#fa8c16'],
          ['Total Claimed (₹)', `₹${totalClaimed.toLocaleString()}`, '#1890ff'],
          ['Active Schemes', schemes.filter(s => s.status === 'active').length, '#52c41a'],
          ['Settled Schemes', schemes.filter(s => s.status === 'closed').length, '#57606a'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search schemes…" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onChange={setStatusFilter} className="w-40"
            options={[
              { value: undefined, label: 'All Status' },
              ...Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s })),
            ]} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={schemes} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          locale={{ emptyText: 'No schemes found.' }}
        />
      </div>

      {/* Claim Modal */}
      <Modal title="Submit Claim" open={!!claimModal} onCancel={() => setClaimModal(null)}
        onOk={submitClaim} confirmLoading={claimLoading}
        okText="Submit Claim"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden>
        <Divider />
        {claimModal && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="font-semibold">{claimModal.schemeName}</div>
              <div className="text-gray-400">{claimModal.supplierName}</div>
              <div className="text-green-700 mt-1">Earned: ₹{(claimModal.totalIncentiveEarned || 0).toLocaleString()}</div>
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Claim Amount (₹) *</label>
              <InputNumber value={claimAmount} onChange={v => setClaimAmount(v || 0)} prefix="₹" className="w-full" min={0} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Notes / Reference</label>
              <Input.TextArea rows={2} value={claimNotes} onChange={e => setClaimNotes(e.target.value)} /></div>
          </div>
        )}
      </Modal>

      {/* Settle Modal */}
      <Modal title="Mark as Settled" open={!!settleModal} onCancel={() => setSettleModal(null)}
        onOk={submitSettle} confirmLoading={settleLoading}
        okText="Confirm Settled"
        okButtonProps={{ style: { background: '#52c41a', borderColor: '#52c41a' } }}
        destroyOnHidden>
        <Divider />
        {settleModal && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="font-semibold">{settleModal.schemeName}</div>
              <div className="text-gray-400">{settleModal.supplierName}</div>
              <div className="text-blue-700 mt-1">Claimed: ₹{(settleModal.totalClaimAmount || 0).toLocaleString()}</div>
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Settled Amount (₹) *</label>
              <InputNumber value={settledAmount} onChange={v => setSettledAmount(v || 0)} prefix="₹" className="w-full" min={0} /></div>
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal title={viewScheme?.schemeNumber} open={!!viewScheme}
        onCancel={() => setViewScheme(null)}
        footer={[<Button key="c" onClick={() => setViewScheme(null)}>Close</Button>]} width={500}>
        {viewScheme && (
          <div className="space-y-2 text-sm">
            {[
              ['Supplier', viewScheme.supplierName],
              ['Scheme Name', viewScheme.schemeName],
              ['Status', viewScheme.status],
              ['Earned', `₹${(viewScheme.totalIncentiveEarned || 0).toLocaleString()}`],
              ['Claimed', `₹${(viewScheme.totalClaimAmount || 0).toLocaleString()}`],
              ['Settled', `₹${(viewScheme.claimSettledAmount || 0).toLocaleString()}`],
              ['Submitted On', viewScheme.claimSubmittedDate ? new Date(viewScheme.claimSubmittedDate).toLocaleDateString('en-IN') : '—'],
              ['Settled On', viewScheme.claimSettledDate ? new Date(viewScheme.claimSettledDate).toLocaleDateString('en-IN') : '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SupplierClaimManagement;
