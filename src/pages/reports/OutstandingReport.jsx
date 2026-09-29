import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Statistic, Button, Table, Alert, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const dateText = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');

const OutstandingReport = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  // Ledger balances are a current position, not a period, so this loads on open.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getOutstandingReport();
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const summary = data?.summary || {};
  const receivables = data?.receivables || [];
  const payables = data?.payables || [];

  const partyColumns = (label, tone) => [
    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
    { title: label, dataIndex: 'name', render: (value, row) => (
      <div>
        <div className="font-medium">{value || '—'}</div>
        {row.code ? <div className="text-[10px] font-mono text-gray-400">{row.code}</div> : null}
      </div>
    ) },
    { title: 'Outstanding', dataIndex: 'outstanding', width: 140, align: 'right',
      sorter: (a, b) => a.outstanding - b.outstanding, defaultSortOrder: 'descend',
      render: value => <span className={`font-semibold ${tone}`}>{money(value)}</span> },
    { title: 'Last Entry', dataIndex: 'lastEntry', width: 120, render: dateText },
  ];

  const netIsPositive = (summary.netPosition || 0) >= 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Outstanding Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Receivable from dealers and payable to suppliers, side by side</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Alert
        className="mb-4"
        type="info"
        showIcon
        message="Balances are the full ledger position for the active branch"
        description="Receivable is dealer ledger debit minus credit; payable is supplier ledger credit minus debit. Overdue is counted from invoice due dates. For receivable ageing buckets, use the Aging Report."
      />

      <Row gutter={16} className="mb-4">
        {[
          ['Receivable', money(summary.receivableTotal), '#52c41a'],
          ['Payable', money(summary.payableTotal), '#cf1322'],
          [netIsPositive ? 'Net Position (in our favour)' : 'Net Position (we owe)', money(Math.abs(summary.netPosition || 0)), netIsPositive ? '#0F2B5B' : '#a8071a'],
          ['Overdue Invoices', `${Number(summary.overdueCount || 0).toLocaleString('en-IN')} · ${money(summary.overdueAmount)}`, '#cf1322'],
        ].map(([title, value, color]) => (
          <Col xs={12} md={6} key={title}>
            <Card size="small"><Statistic title={title} value={value} valueStyle={{ color, fontSize: 17 }} /></Card>
          </Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            className="mb-4"
            title={`Receivable from dealers (${summary.dealersOwing || 0})`}
          >
            <Table
              size="small" loading={loading} rowKey={row => String(row._id)}
              dataSource={receivables}
              columns={partyColumns('Dealer', 'text-green-700')}
              locale={{ emptyText: 'Nothing outstanding from dealers' }}
              pagination={{ pageSize: 15, showTotal: total => `${total} dealers` }}
              scroll={{ x: 460 }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            size="small"
            className="mb-4"
            title={`Payable to suppliers (${summary.suppliersOwed || 0})`}
          >
            <Table
              size="small" loading={loading} rowKey={row => String(row._id)}
              dataSource={payables}
              columns={partyColumns('Supplier', 'text-red-600')}
              locale={{ emptyText: 'Nothing outstanding to suppliers' }}
              pagination={{ pageSize: 15, showTotal: total => `${total} suppliers` }}
              scroll={{ x: 460 }}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default OutstandingReport;
