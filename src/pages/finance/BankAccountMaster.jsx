import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, ReloadOutlined, BankOutlined
} from '@ant-design/icons';
import financeService from '../../services/financeService.js';

const ACCOUNT_TYPES = ['savings', 'current', 'cc', 'od'];
const ACCOUNT_TYPE_LABELS = { savings: 'Savings', current: 'Current', cc: 'Cash Credit', od: 'OD Account' };
const ACCOUNT_TYPE_COLORS = { savings: 'blue', current: 'green', cc: 'orange', od: 'purple' };

const empty = () => ({
  accountName: '', bankName: '', branchName: '', accountNumber: '',
  ifscCode: '', accountType: 'current', openingBalance: 0, isActive: true, remarks: '',
});

const BankAccountMaster = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null); // null = create, obj = edit
  const [saveLoading, setSaveLoading] = useState(false);
  const [form, setForm] = useState(empty());
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await financeService.getBankAccounts({ page, limit: pageSize, search });
      if (res.success) {
        setAccounts(res.data || []);
        if (res.pagination) setPagination(p => ({ ...p, current: res.pagination.currentPage, total: res.pagination.totalItems, pageSize }));
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty()); setShowModal(true); };
  const openEdit = (acc) => { setEditing(acc); setForm({ ...acc }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(empty()); };

  const handleSave = async () => {
    if (!form.accountName.trim()) { message.error('Account name is required'); return; }
    if (!form.bankName.trim()) { message.error('Bank name is required'); return; }
    if (!form.accountNumber.trim()) { message.error('Account number is required'); return; }
    setSaveLoading(true);
    try {
      let res;
      if (editing) {
        res = await financeService.updateBankAccount(editing._id, form);
      } else {
        res = await financeService.createBankAccount(form);
      }
      if (res.success) {
        message.success(editing ? 'Bank account updated' : 'Bank account created');
        closeModal();
        load();
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const totalBalance = accounts.reduce((s, a) => s + (a.currentBalance || a.openingBalance || 0), 0);
  const activeCount = accounts.filter(a => a.isActive !== false).length;

  const columns = [
    { title: '#', render: (_, __, i) => i + 1, width: 45 },
    {
      title: 'Account Name', dataIndex: 'accountName',
      render: (v, r) => (
        <div>
          <div className="font-medium text-gray-800">{v}</div>
          <div className="text-xs text-gray-400">{r.remarks || ''}</div>
        </div>
      ),
    },
    { title: 'Bank', dataIndex: 'bankName', render: (v, r) => <div>{v}<div className="text-xs text-gray-400">{r.branchName}</div></div> },
    { title: 'Account No.', dataIndex: 'accountNumber', render: v => <span className="font-mono text-sm">{v}</span> },
    { title: 'IFSC', dataIndex: 'ifscCode', render: v => <span className="font-mono text-xs">{v || '—'}</span> },
    {
      title: 'Type',
      dataIndex: 'accountType',
      render: v => <Tag color={ACCOUNT_TYPE_COLORS[v] || 'default'}>{ACCOUNT_TYPE_LABELS[v] || v}</Tag>,
    },
    {
      title: 'Balance', dataIndex: 'currentBalance',
      render: (v, r) => <span className="font-semibold">₹{((v ?? r.openingBalance) || 0).toLocaleString()}</span>,
    },
    {
      title: 'Status', dataIndex: 'isActive',
      render: v => <Tag color={v !== false ? 'green' : 'default'}>{v !== false ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions', width: 80,
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bank Account Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage company bank accounts for vouchers and reconciliation</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Bank Account
          </Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total Accounts', accounts.length, '#FF5F03'],
          ['Active Accounts', activeCount, '#52c41a'],
          ['Total Balance', `₹${totalBalance.toLocaleString()}`, '#1890ff'],
        ].map(([t, v, c]) => (
          <Col span={8} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <Input
          placeholder="Search by account name, bank, or account number…"
          prefix={<SearchOutlined />}
          value={search} onChange={e => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          dataSource={accounts}
          rowKey="_id"
          loading={loading}
          size="small"
          pagination={{ current: pagination.current, pageSize: pagination.pageSize, total: pagination.total, showSizeChanger: true, showTotal: t => `${t} accounts` }}
          onChange={p => load(p.current, p.pageSize)}
          locale={{ emptyText: 'No bank accounts found. Click "Add Bank Account" to create one.' }}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        title={<span className="font-bold">{editing ? 'Edit Bank Account' : 'Add Bank Account'}</span>}
        open={showModal}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editing ? 'Update' : 'Create'}
        confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={560}
        destroyOnHidden
      >
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Account Name *</label>
            <Input value={form.accountName} onChange={e => set('accountName', e.target.value)}
              placeholder="e.g. BDM Current Account" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Bank Name *</label>
            <Input value={form.bankName} onChange={e => set('bankName', e.target.value)} placeholder="e.g. HDFC Bank" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Branch Name</label>
            <Input value={form.branchName} onChange={e => set('branchName', e.target.value)} placeholder="e.g. MG Road" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Account Number *</label>
            <Input value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">IFSC Code</label>
            <Input value={form.ifscCode} onChange={e => set('ifscCode', e.target.value.toUpperCase())} placeholder="HDFC0001234" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Account Type</label>
            <Select value={form.accountType} onChange={v => set('accountType', v)} className="w-full"
              options={ACCOUNT_TYPES.map(t => ({ value: t, label: ACCOUNT_TYPE_LABELS[t] }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Opening Balance (₹)</label>
            <Input type="number" value={form.openingBalance}
              onChange={e => set('openingBalance', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <Select value={form.isActive} onChange={v => set('isActive', v)} className="w-full"
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => set('remarks', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default BankAccountMaster;
