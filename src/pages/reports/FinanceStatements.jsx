import { useState } from 'react';
import { Row, Col, Card, Button, Input, Tabs, Divider, message, Statistic, Table, Tag, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, ArrowUpOutlined, ArrowDownOutlined, RiseOutlined, FallOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';

const KV = ({ label, value, color }) => (
  <div className="flex justify-between py-2 border-b border-gray-100">
    <span className="text-gray-500 text-sm">{label}</span>
    <span className="font-semibold text-sm" style={color ? { color } : {}}>{value}</span>
  </div>
);

const FinanceStatements = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getFinanceSummary(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const print = (title) => {
    const el = document.getElementById('stmt-print');
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>${title}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
    .total{font-weight:bold;font-size:14px;border-top:2px solid #333;padding-top:8px;margin-top:4px}
    h2{margin-bottom:16px}@media print{body{padding:0}}</style></head>
    <body><h2>${title}</h2>${el.innerHTML}</body></html>`);
    w.document.close(); setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const pl = data?.profitLoss;
  const cf = data?.cashFlow;
  const bs = data?.balanceSheet;
  const tb = data?.trialBalance;

  const tbCols = [
    { title: 'Account', dataIndex: 'account', render: v => <span className="text-sm">{v}</span> },
    { title: 'Type', dataIndex: 'accountType', width: 110,
      render: v => <Tag className="capitalize">{v || 'other'}</Tag> },
    { title: 'Debit', dataIndex: 'debit', width: 130, align: 'right',
      render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'Credit', dataIndex: 'credit', width: 130, align: 'right',
      render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'Balance', dataIndex: 'balance', width: 130, align: 'right',
      render: v => <span className={`font-semibold ${(v||0) >= 0 ? 'text-blue-700' : 'text-orange-600'}`}>
        ₹{(v||0).toLocaleString()}</span> },
  ];

  const tabItems = [
    {
      key: 'pl',
      label: '📊 Profit & Loss',
      children: pl ? (
        <div>
          <div id="stmt-print">
            <div className="space-y-1 max-w-lg">
              <KV label="Total Revenue (Sales)" value={`₹${(pl.revenue||0).toLocaleString()}`} color="#1890ff" />
              <KV label="Less: Total Purchases" value={`(₹${(pl.purchases||0).toLocaleString()})`} color="#f5222d" />
              <div className="flex justify-between py-3 border-b-2 border-gray-300">
                <span className="font-bold text-base">Gross Profit</span>
                <span className={`font-bold text-base ${(pl.grossProfit||0)>=0?'text-green-600':'text-red-600'}`}>
                  ₹{(pl.grossProfit||0).toLocaleString()}
                </span>
              </div>
              <KV label="Gross Margin %" value={`${pl.grossMargin||0}%`} color={(pl.grossProfit||0)>=0?'#52c41a':'#f5222d'} />
              <div className="pt-3" />
              <KV label="Less: Operating Expenses" value={`(₹${(pl.expenses||0).toLocaleString()})`} color="#f5222d" />
              <div className="flex justify-between py-3 border-b-2 border-gray-300">
                <span className="font-bold text-base">Net Profit</span>
                <span className={`font-bold text-base ${(pl.netProfit||0)>=0?'text-green-600':'text-red-600'}`}>
                  ₹{(pl.netProfit||0).toLocaleString()}
                </span>
              </div>
              <KV label="Net Margin %" value={`${pl.netMargin||0}%`} color={(pl.netProfit||0)>=0?'#52c41a':'#f5222d'} />
              <div className="pt-3" />
              <KV label="GST Collected (on Sales)" value={`₹${(pl.totalTaxCollected||0).toLocaleString()}`} />
              <KV label="GST Paid (on Purchases)" value={`₹${(pl.totalTaxPaid||0).toLocaleString()}`} />
              <KV label="Net GST Payable" value={`₹${((pl.totalTaxCollected||0)-(pl.totalTaxPaid||0)).toLocaleString()}`}
                color="#fa8c16" />
              <div className="pt-2 text-xs text-gray-400">
                Net profit is gross profit less settled operating expenses (approved and reimbursed).
                Pending and rejected expense claims are excluded.
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button icon={<PrinterOutlined />} onClick={() => print('Profit & Loss Statement')}>Print P&L</Button>
          </div>
        </div>
      ) : <div className="py-8 text-center text-gray-400">Generate report to view</div>,
    },
    {
      key: 'cf',
      label: '💰 Cash Flow',
      children: cf ? (
        <div>
          <div id="stmt-print">
            <div className="space-y-1 max-w-lg">
              <KV label="Total Receipts (Dealer Payments)" value={`₹${(cf.receipts||0).toLocaleString()}`} color="#52c41a" />
              <KV label="Less: Total Payments (to Suppliers)" value={`(₹${(cf.payments||0).toLocaleString()})`} color="#f5222d" />
              <div className="flex justify-between py-3 border-b-2 border-gray-300 items-center">
                <span className="font-bold text-base">Net Cash Flow</span>
                <div className="flex items-center gap-2">
                  {(cf.netCashFlow||0) >= 0
                    ? <RiseOutlined className="text-green-600 text-lg" />
                    : <FallOutlined className="text-red-600 text-lg" />}
                  <span className={`font-bold text-base ${(cf.netCashFlow||0)>=0?'text-green-600':'text-red-600'}`}>
                    ₹{(cf.netCashFlow||0).toLocaleString()}
                  </span>
                </div>
              </div>
              <div className="pt-2 text-xs text-gray-400">
                Note: This is a simplified cash flow based on payment records. Full cash flow statement requires voucher ledger integration.
              </div>
            </div>
          </div>
          <div className="mt-4">
            <Button icon={<PrinterOutlined />} onClick={() => print('Cash Flow Statement')}>Print Cash Flow</Button>
          </div>
        </div>
      ) : <div className="py-8 text-center text-gray-400">Generate report to view</div>,
    },
    {
      key: 'bs',
      label: '🏦 Balance Sheet',
      children: bs ? (
        <div>
          <div id="stmt-print">
            <Row gutter={24}>
              <Col span={12}>
                <div className="font-bold text-sm text-gray-600 mb-3 uppercase tracking-wide">Assets</div>
                <div className="space-y-1">
                  <KV label="Stock Value (Inventory)" value={`₹${(bs.stockValue||0).toLocaleString()}`} color="#1890ff" />
                  <KV label="Accounts Receivable" value={`₹${(bs.totalReceivables||0).toLocaleString()}`} color="#1890ff" />
                </div>
              </Col>
              <Col span={12}>
                <div className="font-bold text-sm text-gray-600 mb-3 uppercase tracking-wide">Liabilities</div>
                <div className="space-y-1">
                  <KV label="Accounts Payable" value={`₹${(bs.totalPayables||0).toLocaleString()}`} color="#f5222d" />
                  <KV label="GST Payable" value={`₹${((pl?.totalTaxCollected||0)-(pl?.totalTaxPaid||0)).toLocaleString()}`} />
                </div>
              </Col>
            </Row>
            <Divider />
            <div className="flex justify-between py-3 border-t-2 border-gray-400">
              <span className="font-bold text-base">Net Working Capital</span>
              <span className={`font-bold text-base ${(bs.netWorkingCapital||0)>=0?'text-green-600':'text-red-600'}`}>
                ₹{(bs.netWorkingCapital||0).toLocaleString()}
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Receivables are dealer ledger debit − credit, payables are supplier ledger credit − debit,
              both accumulated up to the report end date. Cash &amp; bank and fixed assets are not included,
              so this is a working-capital view rather than a full statutory balance sheet.
            </p>
          </div>
          <div className="mt-4">
            <Button icon={<PrinterOutlined />} onClick={() => print('Balance Sheet')}>Print Balance Sheet</Button>
          </div>
        </div>
      ) : <div className="py-8 text-center text-gray-400">Generate report to view</div>,
    },
    {
      key: 'tb',
      label: '⚖️ Trial Balance',
      children: tb ? (
        <div>
          <div id="stmt-print">
            <Table
              columns={tbCols}
              dataSource={(tb.rows || []).map((r, i) => ({ ...r, key: r.account || i }))}
              size="small"
              pagination={(tb.rows || []).length > 15 ? { pageSize: 15 } : false}
              summary={() => (
                <Table.Summary.Row className="font-semibold bg-gray-50">
                  <Table.Summary.Cell index={0}>Total</Table.Summary.Cell>
                  <Table.Summary.Cell index={1} />
                  <Table.Summary.Cell index={2} align="right">₹{(tb.totalDebit||0).toLocaleString()}</Table.Summary.Cell>
                  <Table.Summary.Cell index={3} align="right">₹{(tb.totalCredit||0).toLocaleString()}</Table.Summary.Cell>
                  <Table.Summary.Cell index={4} />
                </Table.Summary.Row>
              )}
            />
            <div className="mt-3">
              {tb.balanced
                ? <Alert type="success" showIcon message="Debits equal credits — the ledger balances." />
                : <Alert type="error" showIcon message={`Out of balance by ₹${Math.abs((tb.totalDebit||0)-(tb.totalCredit||0)).toLocaleString()}. This indicates a data problem in the voucher entries.`} />}
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Built from posted double-entry vouchers only; drafts and cancelled vouchers are excluded.
              {tb.scope === 'company' && ' Vouchers carry no branch field, so this statement is company-wide, not branch-scoped.'}
            </p>
          </div>
          <div className="mt-4">
            <Button icon={<PrinterOutlined />} onClick={() => print('Trial Balance')}>Print Trial Balance</Button>
          </div>
        </div>
      ) : <div className="py-8 text-center text-gray-400">Generate report to view</div>,
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Finance Statements</h1>
          <p className="text-sm text-gray-500 mt-0.5">Profit & Loss, Cash Flow, Balance Sheet, Trial Balance</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Refresh</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From Date</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To Date</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate Statements</Button>
        </div>
      </div>

      <Card>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default FinanceStatements;
