import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber, Tabs, Divider
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, BankOutlined
} from '@ant-design/icons';
import { FileText, Building2 } from 'lucide-react';
import financeService from '../../services/financeService.js';

const VOUCHER_TYPE_COLORS = {
  receipt: 'green', payment: 'red', contra: 'blue',
  journal: 'purple', sales: 'cyan', purchase: 'orange',
};
const STATUS_COLORS = { draft: 'default', posted: 'green', cancelled: 'red' };
const VOUCHER_TYPES = [
  { value: 'receipt', label: '📥 Receipt Voucher' },
  { value: 'payment', label: '📤 Payment Voucher' },
  { value: 'contra', label: '🔄 Contra Voucher' },
  { value: 'journal', label: '📓 Journal Voucher' },
];
const ACCOUNT_TYPES = ['cash', 'bank', 'dealer', 'supplier', 'expense', 'income', 'capital', 'other'];
const PAYMENT_MODES = ['cash', 'cheque', 'upi', 'neft', 'rtgs', 'transfer'];

const VoucherEntry = () => {
  const [activeTab, setActiveTab] = useState('vouchers');
  const [vouchers, setVouchers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [bankAccounts, setBankAccounts] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [viewVoucher, setViewVoucher] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);

  const [form, setForm] = useState({
    voucherType: 'receipt', voucherDate: new Date().toISOString().split('T')[0],
    narration: '', referenceNumber: '', paymentMode: 'cash',
    bankAccount: '', chequeNumber: '', chequeDate: '', transactionRef: '',
    status: 'posted',
  });
  const [entries, setEntries] = useState([
    { accountName: '', accountType: 'cash', debit: 0, credit: 0, narration: '' },
    { accountName: '', accountType: 'dealer', debit: 0, credit: 0, narration: '' },
  ]);

  const loadStats = () => financeService.getVoucherStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});

  useEffect(() => {
    loadStats();
    financeService.getBankAccounts().then(r => { if (r.success) setBankAccounts(r.data); }).catch(() => {});
  }, []);

  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.getVouchers({
        page: pagination.current, limit: pagination.pageSize,
        search, voucherType: typeFilter, status: statusFilter,
      });
      if (res.success) {
        setVouchers(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, typeFilter, statusFilter]);

  useEffect(() => { if (activeTab === 'vouchers') fetchVouchers(); }, [fetchVouchers, activeTab]);

  const handlePost = async (id) => {
    try {
      const res = await financeService.postVoucher(id);
      if (res.success) { message.success('Voucher posted.'); fetchVouchers(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const handleCancel = async (id) => {
    Modal.confirm({
      title: 'Cancel Voucher?', okType: 'danger', okText: 'Cancel Voucher',
      onOk: async () => {
        try {
          const res = await financeService.cancelVoucher(id);
          if (res.success) { message.success('Cancelled.'); fetchVouchers(); loadStats(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const updateEntry = (idx, field, val) => {
    setEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: val } : e));
  };

  const addEntry = () => setEntries(prev => [...prev, { accountName: '', accountType: 'cash', debit: 0, credit: 0, narration: '' }]);
  const removeEntry = (idx) => setEntries(prev => prev.filter((_, i) => i !== idx));

  const totalDebit = entries.reduce((s, e) => s + (e.debit || 0), 0);
  const totalCredit = entries.reduce((s, e) => s + (e.credit || 0), 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  const handleCreate = async () => {
    if (!entries.some(e => e.accountName)) { message.error('Add at least one account entry'); return; }
    if (!isBalanced) { message.error('Debit and Credit must be equal (balanced)'); return; }
    setCreateLoading(true);
    try {
      const res = await financeService.createVoucher({ ...form, entries });
      if (res.success) {
        message.success(`${res.data.voucherNumber} created!`);
        setShowCreate(false); resetForm();
        fetchVouchers(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const resetForm = () => {
    setForm({
      voucherType: 'receipt', voucherDate: new Date().toISOString().split('T')[0],
      narration: '', referenceNumber: '', paymentMode: 'cash',
      bankAccount: '', chequeNumber: '', chequeDate: '', transactionRef: '',
      status: 'posted',
    });
    setEntries([
      { accountName: '', accountType: 'cash', debit: 0, credit: 0, narration: '' },
      { accountName: '', accountType: 'dealer', debit: 0, credit: 0, narration: '' },
    ]);
  };

  const voucherColumns = [
    { title: 'Voucher #', dataIndex: 'voucherNumber', width: 120,
      render: v => <span className="font-mono text-xs font-semibold text-blue-600">{v}</span> },
    { title: 'Date', dataIndex: 'voucherDate', width: 95,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Type', dataIndex: 'voucherType', width: 110,
      render: t => <Tag color={VOUCHER_TYPE_COLORS[t]}>{t}</Tag> },
    { title: 'Narration', dataIndex: 'narration', render: v => <span className="text-xs truncate max-w-[220px] block">{v || '—'}</span> },
    { title: 'Ref #', dataIndex: 'referenceNumber', width: 110,
      render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
    { title: 'Amount', dataIndex: 'totalAmount', width: 110,
      render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Payment', dataIndex: 'paymentMode', width: 80,
      render: v => v ? <Tag className="text-xs">{v}</Tag> : '—' },
    { title: 'Status', dataIndex: 'status', width: 90,
      render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500"
            onClick={() => setViewVoucher(r)} />
          {r.status === 'draft' && (
            <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600"
              onClick={() => handlePost(r._id)} />
          )}
          {r.status !== 'cancelled' && (
            <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-400"
              onClick={() => handleCancel(r._id)} />
          )}
        </Space>
      )},
  ];

  const tabItems = [
    {
      key: 'vouchers',
      label: <span className="flex items-center gap-1"><FileText size={14} /> Vouchers</span>,
      children: (
        <div>
          <Row gutter={12} className="mb-4">
            {[['Total', stats.total, '#333'], ['Draft', stats.draft, '#666'], ['Posted', stats.posted, '#52c41a']].map(([label, val, color]) => (
              <Col span={4} key={label}>
                <Card size="small"><Statistic title={label} value={val || 0} valueStyle={{ color }} /></Card>
              </Col>
            ))}
            <Col span={4}><Card size="small"><Statistic title="Today" value={stats.todayVouchers || 0} /></Card></Col>
            <Col span={8}><Card size="small"><Statistic title="This Month (Posted)" value={`₹${(stats.monthTotal || 0).toLocaleString()}`} /></Card></Col>
          </Row>

          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <div className="flex flex-wrap gap-3">
              <Input placeholder="Search voucher #, narration..."
                prefix={<SearchOutlined className="text-gray-400" />}
                value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
                className="w-64" allowClear />
              <Select placeholder="Type" allowClear value={typeFilter} onChange={v => setTypeFilter(v)} className="w-40"
                options={VOUCHER_TYPES.map(t => ({ value: t.value, label: t.value }))} />
              <Select placeholder="Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-32"
                options={['draft','posted','cancelled'].map(s => ({ value: s, label: s }))} />
              <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTypeFilter(undefined); setStatusFilter(undefined); }}>Reset</Button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={voucherColumns} dataSource={vouchers} rowKey="_id" loading={loading}
              size="middle" scroll={{ x: 1000 }}
              pagination={{ ...pagination, showSizeChanger: true, showTotal: (t,r) => `${r[0]}-${r[1]} of ${t}` }}
              onChange={pag => setPagination(p => ({...p, current: pag.current, pageSize: pag.pageSize}))} />
          </div>
        </div>
      ),
    },
    {
      key: 'bank-accounts',
      label: <span className="flex items-center gap-1"><Building2 size={14} /> Bank Accounts</span>,
      children: <BankAccountMaster bankAccounts={bankAccounts} onRefresh={() => financeService.getBankAccounts().then(r => { if (r.success) setBankAccounts(r.data); })} />,
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Voucher Entry</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receipt, Payment, Contra, Journal vouchers + Bank Account Master</p>
        </div>
        {activeTab === 'vouchers' && (
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>
            New Voucher
          </Button>
        )}
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

      {/* Create Voucher Modal */}
      <Modal title="New Voucher Entry" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        width={900} footer={null} destroyOnClose>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Voucher Type *</label>
              <Select className="w-full" value={form.voucherType} onChange={v => setForm(f => ({...f, voucherType: v}))}
                options={VOUCHER_TYPES} size="large" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Date *</label>
              <Input type="date" value={form.voucherDate} onChange={e => setForm(f => ({...f, voucherDate: e.target.value}))} size="large" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Payment Mode</label>
              <Select className="w-full" value={form.paymentMode} onChange={v => setForm(f => ({...f, paymentMode: v}))}
                options={PAYMENT_MODES.map(m => ({ value: m, label: m }))} size="large" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Bank Account</label>
              <Select className="w-full" allowClear value={form.bankAccount || undefined}
                onChange={v => setForm(f => ({...f, bankAccount: v || ''}))}
                options={bankAccounts.map(b => ({ value: b._id, label: `${b.accountName} (${b.bankName})` }))} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Reference #</label>
              <Input value={form.referenceNumber} onChange={e => setForm(f => ({...f, referenceNumber: e.target.value}))} placeholder="Cheque/UTR/Bill ref..." />
            </div>
            {form.paymentMode === 'cheque' && (
              <>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cheque No.</label>
                  <Input value={form.chequeNumber} onChange={e => setForm(f => ({...f, chequeNumber: e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Cheque Date</label>
                  <Input type="date" value={form.chequeDate} onChange={e => setForm(f => ({...f, chequeDate: e.target.value}))} />
                </div>
              </>
            )}
          </div>

          {/* Ledger Entries */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="text-sm font-semibold text-gray-700">Ledger Entries (Dr / Cr)</label>
              <Button size="small" icon={<PlusOutlined />} onClick={addEntry}>Add Row</Button>
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-purple-50">
                  <tr>
                    {['Account Name', 'Account Type', 'Debit (Dr)', 'Credit (Cr)', 'Narration', ''].map(h => (
                      <th key={h} className="px-3 py-2 text-left font-semibold text-gray-600">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <Input value={entry.accountName} onChange={e => updateEntry(idx, 'accountName', e.target.value)}
                          placeholder="e.g. HDFC Bank, Cash, Dealer XYZ" className="w-44" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={entry.accountType} onChange={v => updateEntry(idx, 'accountType', v)}
                          options={ACCOUNT_TYPES.map(t => ({ value: t, label: t }))} className="w-28" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={entry.debit} onChange={v => updateEntry(idx, 'debit', v || 0)}
                          prefix="₹" className="w-28" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={entry.credit} onChange={v => updateEntry(idx, 'credit', v || 0)}
                          prefix="₹" className="w-28" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={entry.narration} onChange={e => updateEntry(idx, 'narration', e.target.value)}
                          placeholder="Optional" className="w-36" />
                      </td>
                      <td className="px-2 py-1.5">
                        {entries.length > 2 && (
                          <Button type="text" size="small" danger icon={<CloseCircleOutlined />}
                            onClick={() => removeEntry(idx)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={`mt-2 flex justify-end gap-8 text-sm px-3 py-2 rounded ${isBalanced ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              <span>Total Debit: <strong>₹{totalDebit.toLocaleString()}</strong></span>
              <span>Total Credit: <strong>₹{totalCredit.toLocaleString()}</strong></span>
              <span className="font-semibold">{isBalanced ? '✅ Balanced' : '⚠ Not Balanced'}</span>
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Narration / Description</label>
            <Input.TextArea rows={2} value={form.narration} onChange={e => setForm(f => ({...f, narration: e.target.value}))}
              placeholder="Brief description of this voucher..." />
          </div>

          <div className="flex justify-between items-center pt-2 border-t">
            <Select value={form.status} onChange={v => setForm(f => ({...f, status: v}))}
              options={[{ value: 'posted', label: 'Post Immediately' }, { value: 'draft', label: 'Save as Draft' }]}
              className="w-48" />
            <div className="flex gap-2">
              <Button onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
              <Button type="primary" onClick={handleCreate} loading={createLoading} disabled={!isBalanced}>
                {form.status === 'posted' ? 'Post Voucher' : 'Save Draft'}
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      {/* View Voucher Modal */}
      {viewVoucher && (
        <Modal title={`Voucher: ${viewVoucher.voucherNumber}`}
          open onCancel={() => setViewVoucher(null)}
          footer={<Button onClick={() => setViewVoucher(null)}>Close</Button>}
          width={600}>
          <div className="space-y-3 mt-4 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div><span className="text-gray-400">Type:</span> <Tag color={VOUCHER_TYPE_COLORS[viewVoucher.voucherType]}>{viewVoucher.voucherType}</Tag></div>
              <div><span className="text-gray-400">Date:</span> {new Date(viewVoucher.voucherDate).toLocaleDateString('en-IN')}</div>
              <div><span className="text-gray-400">Status:</span> <Tag color={STATUS_COLORS[viewVoucher.status]}>{viewVoucher.status}</Tag></div>
              <div><span className="text-gray-400">Amount:</span> <strong>₹{(viewVoucher.totalAmount||0).toLocaleString()}</strong></div>
              {viewVoucher.referenceNumber && <div><span className="text-gray-400">Ref #:</span> {viewVoucher.referenceNumber}</div>}
              {viewVoucher.paymentMode && <div><span className="text-gray-400">Mode:</span> {viewVoucher.paymentMode}</div>}
            </div>
            <Divider className="my-2" />
            {viewVoucher.entries?.length > 0 && (
              <div>
                <div className="font-semibold mb-2">Ledger Entries</div>
                <table className="w-full text-xs border border-gray-100 rounded">
                  <thead className="bg-gray-50">
                    <tr>
                      {['Account','Type','Debit','Credit'].map(h => (
                        <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-500">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {viewVoucher.entries.map((e, i) => (
                      <tr key={i} className="border-t border-gray-50">
                        <td className="px-2 py-1.5">{e.accountName}</td>
                        <td className="px-2 py-1.5"><Tag className="text-[10px]">{e.accountType}</Tag></td>
                        <td className="px-2 py-1.5">{e.debit > 0 ? <span className="text-red-600">₹{e.debit.toLocaleString()}</span> : '—'}</td>
                        <td className="px-2 py-1.5">{e.credit > 0 ? <span className="text-green-600">₹{e.credit.toLocaleString()}</span> : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {viewVoucher.narration && <div className="text-gray-500 bg-gray-50 p-2 rounded text-xs">{viewVoucher.narration}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════
// BANK ACCOUNT MASTER (sub-component)
// ═══════════════════════════════════
const BankAccountMaster = ({ bankAccounts, onRefresh }) => {
  const [showAdd, setShowAdd] = useState(false);
  const [editRecord, setEditRecord] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const emptyForm = { accountName: '', accountNumber: '', bankName: '', branchName: '', ifscCode: '', accountType: 'current', openingBalance: 0, isDefault: false };
  const [form, setForm] = useState(emptyForm);

  const handleSave = async () => {
    if (!form.accountName || !form.accountNumber || !form.bankName) { message.error('Fill required fields'); return; }
    setSaveLoading(true);
    try {
      let res;
      if (editRecord) res = await financeService.updateBankAccount(editRecord._id, form);
      else res = await financeService.createBankAccount(form);
      if (res.success) {
        message.success(editRecord ? 'Updated.' : 'Bank account added.');
        setShowAdd(false); setEditRecord(null); setForm(emptyForm);
        onRefresh();
      }
    } catch (err) { message.error(err.message); }
    finally { setSaveLoading(false); }
  };

  const columns = [
    { title: 'Account Name', dataIndex: 'accountName', render: (v, r) => (
      <div><span className="font-medium">{v}</span>{r.isDefault && <Tag color="gold" className="ml-2 text-[10px]">Default</Tag>}</div>
    )},
    { title: 'Account #', dataIndex: 'accountNumber', render: v => <span className="font-mono text-xs">{v}</span> },
    { title: 'Bank', dataIndex: 'bankName' },
    { title: 'Branch', dataIndex: 'branchName', render: v => v || '—' },
    { title: 'IFSC', dataIndex: 'ifscCode', render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    { title: 'Type', dataIndex: 'accountType', render: v => <Tag>{v}</Tag> },
    { title: 'Balance', dataIndex: 'currentBalance', render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: '', width: 80, render: (_, r) => (
      <Button size="small" type="link" onClick={() => { setEditRecord(r); setForm({ ...r }); setShowAdd(true); }}>Edit</Button>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="text-sm text-gray-500">Manage company bank accounts and opening balances</div>
        <Button icon={<PlusOutlined />} onClick={() => { setEditRecord(null); setForm(emptyForm); setShowAdd(true); }}>Add Bank Account</Button>
      </div>

      <Row gutter={16} className="mb-4">
        {bankAccounts.map(acc => (
          <Col span={6} key={acc._id}>
            <Card size="small" className={`border ${acc.isDefault ? 'border-blue-300' : 'border-gray-200'}`}>
              <div className="flex items-start gap-2">
                <BankOutlined className="text-blue-500 text-lg mt-1" />
                <div>
                  <div className="font-semibold text-sm">{acc.accountName}</div>
                  <div className="text-xs text-gray-400">{acc.bankName} · {acc.accountType}</div>
                  <div className="text-base font-bold text-blue-700 mt-1">₹{(acc.currentBalance || 0).toLocaleString()}</div>
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={bankAccounts} rowKey="_id" size="middle" pagination={false} />
      </div>

      <Modal title={editRecord ? 'Edit Bank Account' : 'Add Bank Account'}
        open={showAdd} onCancel={() => { setShowAdd(false); setEditRecord(null); setForm(emptyForm); }}
        onOk={handleSave} confirmLoading={saveLoading} destroyOnClose width={580}>
        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Account Name *</label>
              <Input value={form.accountName} onChange={e => setForm(f => ({...f, accountName: e.target.value}))} placeholder="e.g. HDFC Current A/c" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Account Number *</label>
              <Input value={form.accountNumber} onChange={e => setForm(f => ({...f, accountNumber: e.target.value}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Bank Name *</label>
              <Input value={form.bankName} onChange={e => setForm(f => ({...f, bankName: e.target.value}))} placeholder="e.g. HDFC Bank" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Branch</label>
              <Input value={form.branchName} onChange={e => setForm(f => ({...f, branchName: e.target.value}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">IFSC Code</label>
              <Input value={form.ifscCode} onChange={e => setForm(f => ({...f, ifscCode: e.target.value}))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Account Type</label>
              <Select className="w-full" value={form.accountType} onChange={v => setForm(f => ({...f, accountType: v}))}
                options={[{value:'current',label:'Current'},{value:'savings',label:'Savings'},{value:'cc',label:'Cash Credit'},{value:'od',label:'Overdraft'}]} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Opening Balance</label>
              <InputNumber className="w-full" min={0} value={form.openingBalance} onChange={v => setForm(f => ({...f, openingBalance: v||0}))} prefix="₹" /></div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={form.isDefault} onChange={e => setForm(f => ({...f, isDefault: e.target.checked}))} id="isDefault" />
              <label htmlFor="isDefault" className="text-sm cursor-pointer">Set as Default Account</label>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default VoucherEntry;
