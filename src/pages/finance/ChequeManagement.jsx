import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, DatePicker, InputNumber, Divider
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, BankOutlined, CloseCircleOutlined, EyeOutlined, CreditCardOutlined
} from '@ant-design/icons';
import financeService from '../../services/financeService.js';
import masterService from '../../services/masterService.js';
import dayjs from 'dayjs';

const STATUS_COLORS = {
  received: 'blue', deposited: 'orange', cleared: 'green',
  bounced: 'red', cancelled: 'default', returned: 'volcano',
};

const STATUS_FLOW = ['received', 'deposited', 'cleared'];

const ChequeManagement = () => {
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [viewCheque, setViewCheque] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'deposit'|'clear'|'bounce', cheque }
  const [actionData, setActionData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);

  const [dealers, setDealers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({
    chequeType: 'received', chequeNumber: '', chequeDate: '',
    amount: 0, bankName: '', branchName: '', dealer: '', supplier: '', remarks: '',
  });

  useEffect(() => {
    financeService.getChequeStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
    masterService.getDealers({ limit: 100, status: 'active' }).then(r => { if (r.success) setDealers(r.data); }).catch(() => {});
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
  }, []);

  const fetchCheques = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.getCheques({
        page: pagination.current, limit: pagination.pageSize,
        search, status: statusFilter, chequeType: typeFilter,
      });
      if (res.success) {
        setCheques(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter, typeFilter]);

  useEffect(() => { fetchCheques(); }, [fetchCheques]);

  const loadStats = () => financeService.getChequeStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});

  const handleCreate = async () => {
    if (!form.chequeNumber) { message.error('Enter cheque number'); return; }
    if (!form.chequeDate) { message.error('Select cheque date'); return; }
    if (!form.amount || form.amount <= 0) { message.error('Enter valid amount'); return; }
    if (!form.bankName) { message.error('Enter bank name'); return; }
    setCreateLoading(true);
    try {
      const res = await financeService.createCheque(form);
      if (res.success) {
        message.success('Cheque recorded successfully');
        setShowCreate(false);
        resetForm();
        fetchCheques(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const resetForm = () => setForm({
    chequeType: 'received', chequeNumber: '', chequeDate: '',
    amount: 0, bankName: '', branchName: '', dealer: '', supplier: '', remarks: '',
  });

  const handleAction = async () => {
    setActionLoading(true);
    try {
      let res;
      if (actionModal.type === 'deposit') res = await financeService.depositCheque(actionModal.cheque._id, actionData);
      else if (actionModal.type === 'clear') res = await financeService.clearCheque(actionModal.cheque._id, actionData);
      else if (actionModal.type === 'bounce') res = await financeService.bounceCheque(actionModal.cheque._id, actionData);
      if (res?.success) {
        message.success(res.message);
        setActionModal(null); setActionData({});
        fetchCheques(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setActionLoading(false); }
  };

  const columns = [
    { title: 'Cheque #', dataIndex: 'chequeNumber', width: 120,
      render: v => <span className="font-mono text-sm font-semibold">{v}</span> },
    { title: 'Date', dataIndex: 'chequeDate', width: 100,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Party', key: 'party', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[170px]">{r.partyName || '—'}</div>
          <div className="text-xs text-gray-400">{r.chequeType === 'received' ? 'From Dealer' : 'To Supplier'}</div>
        </div>
      )},
    { title: 'Bank', dataIndex: 'bankName', width: 140, render: v => <span className="text-xs">{v}</span> },
    { title: 'Amount', dataIndex: 'amount', width: 110,
      render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Type', dataIndex: 'chequeType', width: 90,
      render: v => <Tag color={v === 'received' ? 'blue' : 'orange'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 100,
      render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 130,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500"
            onClick={() => setViewCheque(r)} />
          {r.status === 'received' && (
            <Button type="text" size="small" icon={<BankOutlined />} className="text-orange-500"
              onClick={() => { setActionModal({ type: 'deposit', cheque: r }); setActionData({}); }} />
          )}
          {r.status === 'deposited' && (
            <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600"
              onClick={() => { setActionModal({ type: 'clear', cheque: r }); setActionData({}); }} />
          )}
          {['received', 'deposited'].includes(r.status) && (
            <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500"
              onClick={() => { setActionModal({ type: 'bounce', cheque: r }); setActionData({}); }} />
          )}
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cheque Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track cheque lifecycle: Received → Deposited → Cleared / Bounced</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>
          Add Cheque
        </Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Received" value={stats.received || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Deposited" value={stats.deposited || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Cleared" value={stats.cleared || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Bounced" value={stats.bounced || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Total Received" value={`₹${(stats.totalReceived || 0).toLocaleString()}`} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Total Cleared" value={`₹${(stats.totalCleared || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search cheque #, party, bank..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))} />
          <Select placeholder="Type" allowClear value={typeFilter} onChange={v => setTypeFilter(v)} className="w-36"
            options={[{ value: 'received', label: 'Received' }, { value: 'issued', label: 'Issued' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); setTypeFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={cheques} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Cheque Modal */}
      <Modal title="Add Cheque" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        onOk={handleCreate} confirmLoading={createLoading} okText="Save Cheque" width={600} destroyOnHidden>
        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cheque Type *</label>
              <Select className="w-full" value={form.chequeType} onChange={v => setForm(f => ({ ...f, chequeType: v, dealer: '', supplier: '' }))}
                options={[{ value: 'received', label: 'Received (from Dealer)' }, { value: 'issued', label: 'Issued (to Supplier)' }]} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cheque No. *</label>
              <Input value={form.chequeNumber} onChange={e => setForm(f => ({ ...f, chequeNumber: e.target.value }))} placeholder="e.g. 123456" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Cheque Date *</label>
              <Input type="date" value={form.chequeDate} onChange={e => setForm(f => ({ ...f, chequeDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Amount *</label>
              <InputNumber className="w-full" min={0} value={form.amount} onChange={v => setForm(f => ({ ...f, amount: v || 0 }))} prefix="₹" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bank Name *</label>
              <Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="e.g. HDFC Bank" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Branch</label>
              <Input value={form.branchName} onChange={e => setForm(f => ({ ...f, branchName: e.target.value }))} placeholder="Optional" />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">
              {form.chequeType === 'received' ? 'Dealer' : 'Supplier'} (optional)
            </label>
            {form.chequeType === 'received' ? (
              <Select className="w-full" showSearch optionFilterProp="label" placeholder="Select dealer..."
                value={form.dealer || undefined} onChange={v => setForm(f => ({ ...f, dealer: v }))} allowClear
                options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))} />
            ) : (
              <Select className="w-full" showSearch optionFilterProp="label" placeholder="Select supplier..."
                value={form.supplier || undefined} onChange={v => setForm(f => ({ ...f, supplier: v }))} allowClear
                options={suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode})` }))} />
            )}
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
          </div>
        </div>
      </Modal>

      {/* Action Modal (Deposit / Clear / Bounce) */}
      {actionModal && (
        <Modal
          title={`${actionModal.type === 'deposit' ? '🏦 Deposit' : actionModal.type === 'clear' ? '✅ Clear' : '❌ Bounce'} Cheque #${actionModal.cheque.chequeNumber}`}
          open onCancel={() => { setActionModal(null); setActionData({}); }}
          onOk={handleAction} confirmLoading={actionLoading}
          okText={actionModal.type === 'bounce' ? 'Mark Bounced' : actionModal.type === 'clear' ? 'Mark Cleared' : 'Mark Deposited'}
          okButtonProps={{ danger: actionModal.type === 'bounce' }}>
          <div className="space-y-3 mt-4 text-sm">
            <div className="bg-gray-50 p-3 rounded border text-sm">
              <div>Party: <strong>{actionModal.cheque.partyName}</strong></div>
              <div>Amount: <strong className="text-blue-700">₹{(actionModal.cheque.amount || 0).toLocaleString()}</strong></div>
              <div>Bank: {actionModal.cheque.bankName}</div>
            </div>
            {actionModal.type === 'deposit' && (
              <>
                <div><label className="text-xs text-gray-500 block mb-1">Deposited Date</label>
                  <Input type="date" defaultValue={new Date().toISOString().split('T')[0]}
                    onChange={e => setActionData(d => ({ ...d, depositedDate: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Deposited To Bank</label>
                  <Input placeholder="Our bank name" onChange={e => setActionData(d => ({ ...d, depositedBank: e.target.value }))} /></div>
              </>
            )}
            {actionModal.type === 'clear' && (
              <div><label className="text-xs text-gray-500 block mb-1">Cleared Date</label>
                <Input type="date" defaultValue={new Date().toISOString().split('T')[0]}
                  onChange={e => setActionData(d => ({ ...d, clearedDate: e.target.value }))} /></div>
            )}
            {actionModal.type === 'bounce' && (
              <>
                <div className="bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                  ⚠ Bouncing this cheque will add ₹{actionModal.cheque.amount?.toLocaleString()} back to the dealer's outstanding.
                </div>
                <div><label className="text-xs text-gray-500 block mb-1">Bounce Reason *</label>
                  <Input placeholder="e.g. Insufficient funds, signature mismatch..."
                    onChange={e => setActionData(d => ({ ...d, reason: e.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Bank Charges (₹)</label>
                  <InputNumber min={0} defaultValue={0} className="w-full"
                    onChange={v => setActionData(d => ({ ...d, charges: v || 0 }))} /></div>
              </>
            )}
          </div>
        </Modal>
      )}

      {/* View Modal */}
      {viewCheque && (
        <Modal title={`Cheque #${viewCheque.chequeNumber}`} open onCancel={() => setViewCheque(null)}
          footer={<Button onClick={() => setViewCheque(null)}>Close</Button>}>
          <div className="space-y-2 mt-4 text-sm">
            {[
              ['Party', viewCheque.partyName],
              ['Type', viewCheque.chequeType],
              ['Date', new Date(viewCheque.chequeDate).toLocaleDateString('en-IN')],
              ['Amount', `₹${(viewCheque.amount || 0).toLocaleString()}`],
              ['Bank', viewCheque.bankName],
              ['Branch', viewCheque.branchName || '—'],
              ['Status', viewCheque.status],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
            ))}
            {viewCheque.depositedDate && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Deposited</span><span>{new Date(viewCheque.depositedDate).toLocaleDateString('en-IN')}</span></div>}
            {viewCheque.clearedDate && <div className="flex justify-between py-1 border-b border-gray-50"><span className="text-gray-400">Cleared</span><span>{new Date(viewCheque.clearedDate).toLocaleDateString('en-IN')}</span></div>}
            {viewCheque.bounceReason && (
              <div className="bg-red-50 p-2 rounded text-xs text-red-700 mt-2">
                Bounce Reason: {viewCheque.bounceReason}<br />
                Charges: ₹{viewCheque.bounceCharges || 0}
              </div>
            )}
            {viewCheque.remarks && <div className="text-gray-400 text-xs mt-2">Remarks: {viewCheque.remarks}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChequeManagement;
