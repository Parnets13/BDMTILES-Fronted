import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Alert, DatePicker
} from 'antd';
import { SearchOutlined, CheckCircleOutlined, ReloadOutlined, BankOutlined, SyncOutlined } from '@ant-design/icons';
import financeService from '../../services/financeService.js';
import dayjs from 'dayjs';

const STATUS_COLORS = {
  matched: 'green', unmatched: 'orange', reconciled: 'blue', discrepancy: 'red',
};

const Reconciliation = () => {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  // Load bank accounts on mount
  useEffect(() => {
    financeService.getBankAccounts().then(r => {
      if (r.success) setAccounts(r.data || []);
    }).catch(() => {});
  }, []);

  const loadEntries = useCallback(async () => {
    if (!selectedAccount) return;
    setLoading(true);
    try {
      const params = { bankAccount: selectedAccount, ...filters };
      const res = await financeService.getCashBankEntries(params);
      if (res.success) {
        const data = res.data || [];
        setEntries(data);

        // Compute reconciliation stats
        const totalDebits = data.filter(e => e.type === 'debit').reduce((s, e) => s + (e.amount || 0), 0);
        const totalCredits = data.filter(e => e.type === 'credit').reduce((s, e) => s + (e.amount || 0), 0);
        const reconciled = data.filter(e => e.isReconciled).length;
        const unreconciled = data.filter(e => !e.isReconciled).length;
        setStats({ totalDebits, totalCredits, balance: totalCredits - totalDebits, reconciled, unreconciled, total: data.length });
      }
    } catch {
      setEntries([]);
      setStats(null);
    }
    finally { setLoading(false); }
  }, [selectedAccount, filters]);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  const columns = [
    { title: 'Date', dataIndex: 'voucherDate', width: 100, render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { title: 'Voucher No.', dataIndex: 'voucherNumber', width: 130, render: v => <span className="font-mono text-xs">{v}</span> },
    { title: 'Type', dataIndex: 'voucherType', width: 100, render: v => <Tag color="blue" className="text-xs capitalize">{v}</Tag> },
    { title: 'Narration', dataIndex: 'narration', ellipsis: true },
    {
      title: 'Debit (₹)', key: 'debit', width: 120,
      render: (_, r) => r.type === 'debit' ? <span className="text-red-600 font-medium">₹{(r.amount || 0).toLocaleString()}</span> : '—',
    },
    {
      title: 'Credit (₹)', key: 'credit', width: 120,
      render: (_, r) => r.type === 'credit' ? <span className="text-green-600 font-medium">₹{(r.amount || 0).toLocaleString()}</span> : '—',
    },
    {
      title: 'Status', dataIndex: 'isReconciled', width: 110,
      render: v => <Tag color={v ? 'green' : 'orange'}>{v ? 'Reconciled' : 'Unreconciled'}</Tag>,
    },
    { title: 'Ref No.', dataIndex: 'referenceNumber', width: 120, render: v => <span className="text-xs text-gray-400">{v || '—'}</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Auto Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Match voucher entries against bank statement</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadEntries} loading={loading} />
      </div>

      <Alert
        className="mb-4"
        type="info"
        showIcon
        message="How reconciliation works"
        description="Select a bank account and date range. All voucher entries for that account appear below. Mark entries as reconciled once matched with your bank statement. Unreconciled entries indicate discrepancies to investigate."
      />

      {/* Filter bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-500 block mb-1">Bank Account</label>
            <Select
              placeholder="Select bank account"
              value={selectedAccount}
              onChange={v => setSelectedAccount(v)}
              className="w-full"
              options={accounts.map(a => ({ value: a._id, label: `${a.accountName} — ${a.bankName}` }))}
              allowClear
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Date</label>
            <Input type="date" value={filters.dateFrom}
              onChange={e => setFilters(f => ({ ...f, dateFrom: e.target.value }))} className="w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Date</label>
            <Input type="date" value={filters.dateTo}
              onChange={e => setFilters(f => ({ ...f, dateTo: e.target.value }))} className="w-36" />
          </div>
          <Button type="primary" icon={<SearchOutlined />} onClick={loadEntries} loading={loading}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Load Entries
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <Row gutter={16} className="mb-4">
          {[
            ['Total Entries', stats.total, '#1890ff'],
            ['Total Debits', `₹${stats.totalDebits.toLocaleString()}`, '#f5222d'],
            ['Total Credits', `₹${stats.totalCredits.toLocaleString()}`, '#52c41a'],
            ['Net Balance', `₹${stats.balance.toLocaleString()}`, stats.balance >= 0 ? '#52c41a' : '#f5222d'],
            ['Reconciled', stats.reconciled, '#52c41a'],
            ['Unreconciled', stats.unreconciled, '#fa8c16'],
          ].map(([t, v, c]) => (
            <Col span={4} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
              <Statistic title={t} value={v} valueStyle={{ color: c, fontSize: 18 }} />
            </Card></Col>
          ))}
        </Row>
      )}

      {!selectedAccount && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <BankOutlined className="text-4xl mb-3 block" />
          <p>Select a bank account above to view and reconcile entries</p>
        </div>
      )}

      {selectedAccount && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100 flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600">
              {entries.length} entries found
            </span>
            {stats?.unreconciled > 0 && (
              <span className="text-xs text-orange-600 font-medium">
                ⚠ {stats.unreconciled} unreconciled entries
              </span>
            )}
          </div>
          <Table
            columns={columns}
            dataSource={entries}
            rowKey="_id"
            loading={loading}
            size="small"
            pagination={{ pageSize: 30 }}
            rowClassName={r => r.isReconciled ? '' : 'bg-orange-50'}
            locale={{ emptyText: 'No entries found for the selected period.' }}
          />
        </div>
      )}
    </div>
  );
};

export default Reconciliation;
