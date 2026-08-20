import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, message,
  Row, Col, Card, Statistic, Spin, Divider
} from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, FilterOutlined, BankOutlined } from '@ant-design/icons';
import financeService from '../../services/financeService.js';

const TYPE_COLORS = {
  receipt: 'green', payment: 'red', contra: 'blue',
  journal: 'purple', sales: 'cyan', purchase: 'orange',
};

const CashBankBook = () => {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(undefined);
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(1); // first of current month
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);

  // Running balance summary
  const [openingBalance, setOpeningBalance] = useState(0);

  useEffect(() => {
    financeService.getBankAccounts().then(r => {
      if (r.success) {
        setBankAccounts(r.data);
        // auto-select default account
        const def = r.data.find(b => b.isDefault);
        if (def) setSelectedAccount(def._id);
      }
    }).catch(() => {});
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeService.getCashBankEntries({
        bankAccount: selectedAccount,
        dateFrom, dateTo,
        page: pagination.current,
        limit: pagination.pageSize,
      });
      if (res.success) {
        setEntries(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [selectedAccount, dateFrom, dateTo, pagination.current, pagination.pageSize]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Compute running totals from entries
  const totalReceipts = entries
    .filter(e => e.voucherType === 'receipt')
    .reduce((s, e) => s + (e.totalAmount || 0), 0);
  const totalPayments = entries
    .filter(e => e.voucherType === 'payment')
    .reduce((s, e) => s + (e.totalAmount || 0), 0);
  const closingBalance = openingBalance + totalReceipts - totalPayments;

  const selectedAccountData = bankAccounts.find(b => b._id === selectedAccount);

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Cash/Bank Book</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h2{margin-bottom:4px}.sub{color:#888;font-size:10px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f5f5;padding:7px 9px;text-align:left;font-size:10px;border-bottom:2px solid #ddd;text-transform:uppercase}
      td{padding:7px 9px;border-bottom:1px solid #f0f0f0;font-size:11px}
      .dr{color:#e03}.cr{color:#0a0}.summary{margin-top:16px;font-weight:bold}
      @media print{body{padding:0}}
    </style></head><body>
    <h2>Cash / Bank Book — ${selectedAccountData?.accountName || 'All Accounts'}</h2>
    <div class="sub">Period: ${dateFrom} to ${dateTo}</div>
    <table>
      <thead><tr><th>Date</th><th>Voucher #</th><th>Type</th><th>Narration</th><th>Receipts (Dr)</th><th>Payments (Cr)</th></tr></thead>
      <tbody>
        <tr><td colspan="4"><strong>Opening Balance</strong></td><td colspan="2"><strong>₹${openingBalance.toLocaleString()}</strong></td></tr>
        ${entries.map(e => `<tr>
          <td>${new Date(e.voucherDate).toLocaleDateString('en-IN')}</td>
          <td>${e.voucherNumber}</td>
          <td>${e.voucherType}</td>
          <td>${e.narration || '—'}</td>
          <td class="cr">${e.voucherType === 'receipt' ? '₹' + (e.totalAmount || 0).toLocaleString() : '—'}</td>
          <td class="dr">${e.voucherType === 'payment' ? '₹' + (e.totalAmount || 0).toLocaleString() : '—'}</td>
        </tr>`).join('')}
      </tbody>
    </table>
    <div class="summary">
      <div>Total Receipts: ₹${totalReceipts.toLocaleString()}</div>
      <div>Total Payments: ₹${totalPayments.toLocaleString()}</div>
      <div>Closing Balance: ₹${closingBalance.toLocaleString()}</div>
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const columns = [
    { title: 'Date', dataIndex: 'voucherDate', width: 100,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Voucher #', dataIndex: 'voucherNumber', width: 120,
      render: v => <span className="font-mono text-xs font-semibold text-blue-600">{v}</span> },
    { title: 'Type', dataIndex: 'voucherType', width: 100,
      render: t => <Tag color={TYPE_COLORS[t]} className="text-xs">{t}</Tag> },
    { title: 'Narration', dataIndex: 'narration',
      render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Ref #', dataIndex: 'referenceNumber', width: 120,
      render: v => <span className="text-xs text-gray-400">{v || '—'}</span> },
    { title: 'Receipts (Dr)', dataIndex: 'totalAmount', width: 120,
      render: (v, r) => r.voucherType === 'receipt'
        ? <span className="text-sm font-semibold text-green-600">₹{(v || 0).toLocaleString()}</span>
        : <span className="text-gray-200">—</span> },
    { title: 'Payments (Cr)', dataIndex: 'totalAmount', width: 120,
      render: (v, r) => r.voucherType === 'payment'
        ? <span className="text-sm font-semibold text-red-600">₹{(v || 0).toLocaleString()}</span>
        : <span className="text-gray-200">—</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cash / Bank Book</h1>
          <p className="text-sm text-gray-500 mt-0.5">Day-wise receipts and payments for each bank/cash account</p>
        </div>
        <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Statement</Button>
      </div>

      {/* Account Cards */}
      {bankAccounts.length > 0 && (
        <Row gutter={12} className="mb-4">
          {bankAccounts.map(acc => (
            <Col span={5} key={acc._id}>
              <Card
                size="small"
                className={`cursor-pointer transition border-2 ${selectedAccount === acc._id ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                onClick={() => setSelectedAccount(acc._id)}
              >
                <div className="flex items-center gap-2">
                  {acc.accountType === 'current' || acc.accountType === 'savings'
                    ? <BankOutlined className="text-blue-500" />
                    : <BankOutlined className="text-green-500" />}
                  <div>
                    <div className="text-xs font-semibold truncate">{acc.accountName}</div>
                    <div className="text-xs text-gray-400">{acc.bankName}</div>
                    <div className="text-sm font-bold text-blue-700">₹{(acc.currentBalance || 0).toLocaleString()}</div>
                  </div>
                </div>
              </Card>
            </Col>
          ))}
          <Col span={4}>
            <Card
              size="small"
              className={`cursor-pointer transition border-2 ${!selectedAccount ? 'border-orange-400 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
              onClick={() => setSelectedAccount(undefined)}
            >
              <div className="flex items-center gap-2">
                <BankOutlined className="text-orange-500" />
                <div>
                  <div className="text-xs font-semibold">All Accounts</div>
                  <div className="text-xs text-gray-400">Combined view</div>
                </div>
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Date</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Date</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Opening Balance (₹)</label>
            <Input
              type="number"
              value={openingBalance}
              onChange={e => setOpeningBalance(parseFloat(e.target.value) || 0)}
              className="w-36"
              placeholder="0"
            />
          </div>
          <Button icon={<FilterOutlined />} type="primary" onClick={fetchEntries}>Apply</Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            const today = new Date();
            setDateTo(today.toISOString().split('T')[0]);
            const first = new Date(today.getFullYear(), today.getMonth(), 1);
            setDateFrom(first.toISOString().split('T')[0]);
          }}>This Month</Button>
        </div>
      </div>

      {/* Summary Cards */}
      <Row gutter={16} className="mb-4">
        <Col span={6}>
          <Card size="small" className="border-gray-200">
            <Statistic title="Opening Balance" value={`₹${openingBalance.toLocaleString()}`} valueStyle={{ color: '#666' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="border-green-100">
            <Statistic title="Total Receipts" value={`₹${totalReceipts.toLocaleString()}`} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="border-red-100">
            <Statistic title="Total Payments" value={`₹${totalPayments.toLocaleString()}`} valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" className="border-blue-100">
            <Statistic
              title="Closing Balance"
              value={`₹${Math.abs(closingBalance).toLocaleString()}`}
              suffix={closingBalance >= 0 ? '(Dr)' : '(Cr)'}
              valueStyle={{ color: closingBalance >= 0 ? '#1890ff' : '#f5222d', fontSize: 18, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Entries Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        {loading ? (
          <div className="py-16 text-center"><Spin size="large" tip="Loading entries..." ><span /></Spin></div>
        ) : (
          <Table
            columns={columns}
            dataSource={entries}
            rowKey="_id"
            size="small"
            scroll={{ x: 900 }}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} entries`,
            }}
            onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))}
            summary={() => (
              <Table.Summary fixed>
                <Table.Summary.Row className="bg-blue-50 font-bold">
                  <Table.Summary.Cell index={0} colSpan={5}>
                    <span className="font-bold text-sm">Period Total</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={5}>
                    <span className="text-green-600 font-bold">₹{totalReceipts.toLocaleString()}</span>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={6}>
                    <span className="text-red-600 font-bold">₹{totalPayments.toLocaleString()}</span>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              </Table.Summary>
            )}
          />
        )}
      </div>
    </div>
  );
};

export default CashBankBook;
