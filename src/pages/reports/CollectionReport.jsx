import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, Tag, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const MODE_COLORS = {
  cash: 'green', cheque: 'purple', upi: 'blue', neft: 'geekblue',
  rtgs: 'cyan', card: 'magenta', adjustment: 'default',
};

const CollectionReport = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getCollectionReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const summary = data?.summary || {};
  const byMode = data?.byMode || [];
  const daily = data?.daily || [];
  const topPayers = data?.topPayers || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Collection Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Confirmed dealer receipts by mode, day and payer</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Refresh</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(c => ({ ...c, dateFrom: e.target.value }))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(c => ({ ...c, dateTo: e.target.value }))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Counts confirmed dealer receipts only — pending and cancelled payments are excluded.
        </p>
      </div>

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Collected', money(summary.total), '#FF5F03'],
              ['Receipts', Number(summary.receipts || 0).toLocaleString('en-IN'), '#1890ff'],
              ['Average Receipt', money(Math.round(summary.avgReceipt || 0)), '#52c41a'],
            ].map(([title, value, color]) => (
              <Col xs={24} md={8} key={title}><Card size="small"><Statistic title={title} value={value} valueStyle={{ color, fontSize: 19 }} /></Card></Col>
            ))}
          </Row>

          {daily.length > 0 && (
            <Card className="mb-4" title="Daily Collection Trend">
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={daily} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
                  <defs>
                    <linearGradient id="collectionFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF5F03" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#FF5F03" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="_id" tick={{ fontSize: 10 }} tickFormatter={v => String(v).slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [money(v), 'Collected']} />
                  <Area type="monotone" dataKey="total" stroke="#FF5F03" strokeWidth={2} fill="url(#collectionFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Row gutter={16}>
            <Col xs={24} lg={10}>
              <Card size="small" title="By Payment Mode" className="mb-4">
                <Table
                  size="small" pagination={false} rowKey={row => String(row._id)}
                  dataSource={byMode}
                  locale={{ emptyText: 'No receipts in this period' }}
                  columns={[
                    { title: 'Mode', dataIndex: '_id',
                      render: v => <Tag color={MODE_COLORS[v] || 'default'}>{String(v || 'unknown').toUpperCase()}</Tag> },
                    { title: 'Receipts', dataIndex: 'count', width: 90, align: 'right' },
                    { title: 'Amount', dataIndex: 'total', align: 'right',
                      render: v => <span className="font-medium">{money(v)}</span> },
                    { title: 'Share', key: 'share', width: 80, align: 'right',
                      render: (_, row) => {
                        const pct = summary.total > 0 ? Math.round((row.total / summary.total) * 100) : 0;
                        return <span className="text-gray-500">{pct}%</span>;
                      } },
                  ]}
                />
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card size="small" title="Top Payers" className="mb-4">
                <Table
                  size="small" pagination={false} rowKey={row => String(row._id)}
                  dataSource={topPayers}
                  locale={{ emptyText: 'No receipts in this period' }}
                  columns={[
                    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
                    { title: 'Payer', dataIndex: 'name', render: v => <span className="font-medium">{v || '—'}</span> },
                    { title: 'Receipts', dataIndex: 'count', width: 90, align: 'right' },
                    { title: 'Amount', dataIndex: 'total', align: 'right',
                      render: v => <span className="font-semibold">{money(v)}</span> },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {data === null && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          Set a date range and click “Generate”
        </div>
      )}
    </div>
  );
};

export default CollectionReport;
