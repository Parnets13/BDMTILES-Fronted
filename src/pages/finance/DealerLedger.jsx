import { useState, useEffect, useCallback } from 'react';
import {
  Table, Input, Button, Select, Tag, Space, message,
  Card, Statistic, Row, Col, Divider, Spin
} from 'antd';
import { SearchOutlined, ReloadOutlined, ArrowLeftOutlined, PrinterOutlined } from '@ant-design/icons';
import { BookOpen } from 'lucide-react';
import financeService from '../../services/financeService.js';
import masterService from '../../services/masterService.js';

const ENTRY_COLORS = {
  opening: 'default', invoice: 'blue', payment: 'green',
  credit_note: 'cyan', debit_note: 'red', adjustment: 'orange', advance: 'purple',
};

const DealerLedger = () => {
  const [view, setView] = useState('list'); // 'list' | 'statement'
  const [dealers, setDealers] = useState([]);
  const [loadingDealers, setLoadingDealers] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });

  // Statement view
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [entries, setEntries] = useState([]);
  const [outstanding, setOutstanding] = useState(0);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const fetchDealers = useCallback(async () => {
    setLoadingDealers(true);
    try {
      const res = await financeService.getDealers({ search, page: pagination.current, limit: pagination.pageSize });
      if (res.success) {
        setDealers(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoadingDealers(false); }
  }, [search, pagination.current, pagination.pageSize]);

  useEffect(() => { if (view === 'list') fetchDealers(); }, [fetchDealers, view]);

  const openStatement = async (dealer) => {
    setSelectedDealer(dealer);
    setView('statement');
    loadStatement(dealer._id, dateFrom, dateTo);
  };

  const loadStatement = async (dealerId, from, to) => {
    setLoadingEntries(true);
    try {
      const res = await financeService.getDealerLedger(dealerId, { dateFrom: from, dateTo: to, limit: 200 });
      if (res.success) {
        setEntries(res.data);
        setOutstanding(res.outstanding || 0);
        if (res.dealer && !selectedDealer) setSelectedDealer(res.dealer);
      }
    } catch (err) { message.error(err.message); }
    finally { setLoadingEntries(false); }
  };

  const handlePrint = () => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Ledger - ${selectedDealer?.businessName}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h2{color:#333;margin-bottom:4px}
      .sub{color:#888;font-size:10px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse}
      th{background:#f5f5f5;padding:7px 10px;text-align:left;font-size:10px;border-bottom:2px solid #ddd;text-transform:uppercase}
      td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px}
      .dr{color:#e03}
      .cr{color:#0a0}
      .bal-pos{color:#e03;font-weight:bold}
      .bal-neg{color:#0a0;font-weight:bold}
      .summary{margin-top:16px;text-align:right;font-size:13px;font-weight:bold}
      @media print{body{padding:0}}
    </style></head><body>
    <h2>Dealer Ledger — ${selectedDealer?.businessName}</h2>
    <div class="sub">${selectedDealer?.dealerCode} | ${dateFrom ? `From: ${dateFrom}` : ''} ${dateTo ? `To: ${dateTo}` : ''}</div>
    <table><thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Ref #</th><th>Debit (Dr)</th><th>Credit (Cr)</th><th>Balance</th></tr></thead>
    <tbody>${entries.map(e => `
      <tr>
        <td>${new Date(e.entryDate).toLocaleDateString('en-IN')}</td>
        <td>${e.entryType?.replace('_',' ')}</td>
        <td>${e.description || '—'}</td>
        <td>${e.referenceNumber || '—'}</td>
        <td class="dr">${e.debit > 0 ? '₹'+e.debit.toLocaleString() : '—'}</td>
        <td class="cr">${e.credit > 0 ? '₹'+e.credit.toLocaleString() : '—'}</td>
        <td class="${e.balance >= 0 ? 'bal-pos' : 'bal-neg'}">₹${Math.abs(e.balance).toLocaleString()} ${e.balance >= 0 ? 'Dr' : 'Cr'}</td>
      </tr>`).join('')}
    </tbody></table>
    <div class="summary">Outstanding Balance: ₹${Math.abs(outstanding).toLocaleString()} ${outstanding >= 0 ? '(Dealer owes)' : '(Advance)'}</div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const dealerColumns = [
    { title: 'Dealer Code', dataIndex: 'dealerCode', width: 110, render: v => <span className="font-mono text-xs text-blue-600">{v}</span> },
    { title: 'Business Name', dataIndex: 'businessName', render: v => <span className="font-medium">{v}</span> },
    { title: 'City', dataIndex: 'city', width: 120 },
    { title: 'Mobile', dataIndex: 'mobile', width: 120, render: v => <span className="text-xs">{v}</span> },
    { title: 'Credit Limit', dataIndex: 'creditLimit', width: 120, render: v => <span className="text-sm">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Outstanding', dataIndex: 'currentOutstanding', width: 130,
      render: v => <span className={`font-semibold text-sm ${v > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(v || 0).toLocaleString()}</span> },
    { title: '', width: 100,
      render: (_, r) => <Button size="small" type="link" icon={<BookOpen size={13} />} onClick={() => openStatement(r)}>View Ledger</Button> },
  ];

  const entryColumns = [
    { title: 'Date', dataIndex: 'entryDate', width: 100, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Type', dataIndex: 'entryType', width: 110,
      render: t => <Tag color={ENTRY_COLORS[t]} className="text-xs">{t?.replace('_', ' ')}</Tag> },
    { title: 'Description', dataIndex: 'description', render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Ref #', dataIndex: 'referenceNumber', width: 120,
      render: v => <span className="text-xs font-mono text-gray-500">{v || '—'}</span> },
    { title: 'Debit (Dr)', dataIndex: 'debit', width: 110,
      render: v => v > 0 ? <span className="text-sm font-medium text-red-600">₹{v.toLocaleString()}</span> : <span className="text-gray-300">—</span> },
    { title: 'Credit (Cr)', dataIndex: 'credit', width: 110,
      render: v => v > 0 ? <span className="text-sm font-medium text-green-600">₹{v.toLocaleString()}</span> : <span className="text-gray-300">—</span> },
    { title: 'Balance', dataIndex: 'balance', width: 120,
      render: v => (
        <span className={`text-sm font-semibold ${v >= 0 ? 'text-red-600' : 'text-green-600'}`}>
          ₹{Math.abs(v || 0).toLocaleString()} {v >= 0 ? 'Dr' : 'Cr'}
        </span>
      )},
  ];

  if (view === 'statement') {
    return (
      <div>
        <div className="flex justify-between items-start mb-4">
          <div className="flex items-center gap-3">
            <Button icon={<ArrowLeftOutlined />} onClick={() => setView('list')}>Back</Button>
            <div>
              <h1 className="text-xl font-bold text-gray-800">{selectedDealer?.businessName}</h1>
              <p className="text-xs text-gray-400">{selectedDealer?.dealerCode} · {selectedDealer?.city}</p>
            </div>
          </div>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Statement</Button>
        </div>

        <Row gutter={16} className="mb-4">
          <Col span={6}>
            <Card size="small" className="border-red-100">
              <Statistic title="Outstanding Balance" value={`₹${Math.abs(outstanding).toLocaleString()}`}
                suffix={outstanding >= 0 ? '(Dr)' : '(Cr)'}
                valueStyle={{ color: outstanding > 0 ? '#e03' : '#0a0', fontSize: 18 }} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <Statistic title="Credit Limit" value={`₹${(selectedDealer?.creditLimit || 0).toLocaleString()}`} />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div className="text-xs text-gray-400 mb-1">Filter From</div>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} size="small" />
            </Card>
          </Col>
          <Col span={6}>
            <Card size="small">
              <div className="text-xs text-gray-400 mb-1">Filter To</div>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} size="small" />
            </Card>
          </Col>
        </Row>

        <div className="flex gap-2 mb-3">
          <Button onClick={() => loadStatement(selectedDealer._id, dateFrom, dateTo)}>Apply Filter</Button>
          <Button onClick={() => { setDateFrom(''); setDateTo(''); loadStatement(selectedDealer._id, '', ''); }}>Clear Filter</Button>
        </div>

        <div className="bg-white rounded-lg border border-gray-200">
          {loadingEntries ? (
            <div className="py-16 text-center"><Spin size="large" tip="Loading ledger..." /></div>
          ) : (
            <Table columns={entryColumns} dataSource={entries} rowKey="_id" size="small" scroll={{ x: 900 }}
              pagination={{ pageSize: 50, showTotal: t => `${t} entries` }}
              summary={() => (
                <Table.Summary fixed>
                  <Table.Summary.Row className="bg-gray-50 font-bold">
                    <Table.Summary.Cell index={0} colSpan={4}><span className="font-bold text-sm">Total</span></Table.Summary.Cell>
                    <Table.Summary.Cell index={4}>
                      <span className="text-red-600 font-bold">₹{entries.reduce((s,e)=>s+(e.debit||0),0).toLocaleString()}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={5}>
                      <span className="text-green-600 font-bold">₹{entries.reduce((s,e)=>s+(e.credit||0),0).toLocaleString()}</span>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={6}>
                      <span className={`font-bold text-base ${outstanding >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        ₹{Math.abs(outstanding).toLocaleString()} {outstanding >= 0 ? 'Dr' : 'Cr'}
                      </span>
                    </Table.Summary.Cell>
                  </Table.Summary.Row>
                </Table.Summary>
              )} />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dealer Ledger</h1>
          <p className="text-sm text-gray-500 mt-0.5">View outstanding balances and transaction history per dealer</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3">
          <Input placeholder="Search dealer name or code..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-72" allowClear />
          <Button icon={<ReloadOutlined />} onClick={fetchDealers}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={dealerColumns} dataSource={dealers} rowKey="_id" loading={loadingDealers}
          size="middle" scroll={{ x: 900 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>
    </div>
  );
};

export default DealerLedger;
