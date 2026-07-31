import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const ACCOUNT_GROUPS = [
  'Current Assets', 'Fixed Assets', 'Investments',
  'Current Liabilities', 'Long-term Liabilities', 'Capital & Reserves',
  'Revenue', 'Direct Expenses', 'Indirect Expenses', 'Other Income',
];
const GROUP_COLORS = {
  'Current Assets': 'green', 'Fixed Assets': 'blue', 'Investments': 'cyan',
  'Current Liabilities': 'orange', 'Long-term Liabilities': 'red', 'Capital & Reserves': 'purple',
  'Revenue': 'geekblue', 'Direct Expenses': 'volcano', 'Indirect Expenses': 'gold', 'Other Income': 'lime',
};

const empty = () => ({
  accountName: '', accountCode: '', accountGroup: 'Current Assets',
  openingBalance: 0, openingType: 'Dr', isActive: true, description: '',
});

const AccountMaster = () => {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [form, setForm] = useState(empty());
  const [search, setSearch] = useState('');
  const [groupFilter, setGroupFilter] = useState(undefined);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const res = await api.get('/vouchers/accounts/list', { params: { page, limit: pageSize, search, group: groupFilter } });
      if (res.success) {
        setAccounts(res.data || []);
        if (res.pagination) setPagination(p => ({ ...p, current: res.pagination.currentPage, total: res.pagination.totalItems, pageSize }));
      }
    } catch {
      setAccounts([]);
    }
    finally { setLoading(false); }
  }, [search, groupFilter]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  const openCreate = () => { setEditing(null); setForm(empty()); setShowModal(true); };
  const openEdit = (acc) => { setEditing(acc); setForm({ ...acc }); setShowModal(true); };
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(empty()); };

  const handleSave = async () => {
    if (!form.accountName.trim()) { message.error('Account name is required'); return; }
    if (!form.accountGroup) { message.error('Account group is required'); return; }
    setSaveLoading(true);
    try {
      let res;
      if (editing) {
        res = await api.put(`/vouchers/accounts/${editing._id}`, form);
      } else {
        res = await api.post('/vouchers/accounts', form);
      }
      if (res.success) {
        message.success(editing ? 'Account updated' : 'Account created');
        closeModal();
        load();
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Group summary
  const bySide = accounts.reduce((acc, a) => {
    const g = a.accountGroup || 'Other';
    if (!acc[g]) acc[g] = 0;
    acc[g]++;
    return acc;
  }, {});

  const columns = [
    { title: '#', render: (_, __, i) => i + 1, width: 45 },
    {
      title: 'Account Name', dataIndex: 'accountName',
      render: (v, r) => (
        <div>
          <div className="font-medium text-gray-800">{v}</div>
          {r.accountCode && <div className="text-xs text-gray-400 font-mono">{r.accountCode}</div>}
        </div>
      ),
    },
    {
      title: 'Group', dataIndex: 'accountGroup',
      render: v => <Tag color={GROUP_COLORS[v] || 'default'} className="text-xs">{v}</Tag>,
    },
    {
      title: 'Opening Balance', dataIndex: 'openingBalance',
      render: (v, r) => <span className={`font-semibold ${(r.openingType === 'Cr') ? 'text-red-600' : 'text-green-700'}`}>
        ₹{(v || 0).toLocaleString()} {r.openingType || 'Dr'}
      </span>,
    },
    {
      title: 'Status', dataIndex: 'isActive',
      render: v => <Tag color={v !== false ? 'green' : 'default'}>{v !== false ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Description', dataIndex: 'description',
      render: v => <span className="text-xs text-gray-400">{v || '—'}</span>,
    },
    {
      title: 'Actions', width: 80,
      render: (_, r) => <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>,
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Account Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Chart of accounts — groups for voucher allocation and financial statements</p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Account
          </Button>
        </Space>
      </div>

      {/* Group quick counts */}
      {Object.keys(bySide).length > 0 && (
        <Row gutter={[8, 8]} className="mb-5">
          {Object.entries(bySide).map(([g, cnt]) => (
            <Col key={g}>
              <Tag color={GROUP_COLORS[g] || 'default'} className="text-xs cursor-pointer px-3 py-1"
                onClick={() => setGroupFilter(f => f === g ? undefined : g)}>
                {g}: {cnt}
              </Tag>
            </Col>
          ))}
        </Row>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input
            placeholder="Search by account name or code…"
            prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select
            placeholder="Filter by group"
            allowClear
            value={groupFilter}
            onChange={setGroupFilter}
            className="w-52"
            options={ACCOUNT_GROUPS.map(g => ({ value: g, label: g }))}
          />
        </div>
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
          locale={{ emptyText: 'No accounts found. Add your chart of accounts.' }}
        />
      </div>

      {/* Modal */}
      <Modal
        title={<span className="font-bold">{editing ? 'Edit Account' : 'Add Account'}</span>}
        open={showModal}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editing ? 'Update' : 'Create'}
        confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={520}
        destroyOnHidden
      >
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Account Name *</label>
            <Input value={form.accountName} onChange={e => set('accountName', e.target.value)}
              placeholder="e.g. Cash in Hand" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Account Code</label>
            <Input value={form.accountCode} onChange={e => set('accountCode', e.target.value)} placeholder="e.g. CA001" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Account Group *</label>
            <Select value={form.accountGroup} onChange={v => set('accountGroup', v)} className="w-full"
              options={ACCOUNT_GROUPS.map(g => ({ value: g, label: g }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Opening Balance (₹)</label>
            <Input type="number" value={form.openingBalance}
              onChange={e => set('openingBalance', parseFloat(e.target.value) || 0)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dr / Cr</label>
            <Select value={form.openingType} onChange={v => set('openingType', v)} className="w-full"
              options={[{ value: 'Dr', label: 'Debit (Dr)' }, { value: 'Cr', label: 'Credit (Cr)' }]} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Status</label>
            <Select value={form.isActive} onChange={v => set('isActive', v)} className="w-full"
              options={[{ value: true, label: 'Active' }, { value: false, label: 'Inactive' }]} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Description</label>
            <Input.TextArea rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AccountMaster;
