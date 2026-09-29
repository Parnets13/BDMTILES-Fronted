import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, Tag, message, Alert } from 'antd';
import { SearchOutlined, ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';

const DeviationReport = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getDeviationReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const rows = data?.rows || [];
  const summary = data?.summary || {};

  const money = (v) => `₹${(v || 0).toLocaleString()}`;
  const signed = (v) => `${(v || 0) < 0 ? '−' : '+'}${money(Math.abs(v || 0))}`;

  const cols = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 110,
      render: v => <span className="font-mono text-xs text-blue-600">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 95,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { title: 'Dealer', dataIndex: 'dealerName', render: v => v || '—' },
    { title: 'Revenue', dataIndex: 'revenue', width: 115, align: 'right', render: money },
    { title: 'Actual Profit', dataIndex: 'actualProfit', width: 115, align: 'right',
      render: v => <span className={v >= 0 ? 'text-green-600' : 'text-red-600'}>{money(v)}</span> },
    { title: 'Expected', dataIndex: 'expectedProfit', width: 110, align: 'right', render: money },
    { title: 'Deviation', dataIndex: 'deviation', width: 125, align: 'right',
      render: v => (
        <span className={`font-semibold ${v >= 0 ? 'text-green-600' : 'text-red-600'}`}>{signed(v)}</span>
      ) },
    { title: 'Dev %', dataIndex: 'deviationPercent', width: 90, align: 'right',
      render: v => v === null || v === undefined ? '—' : (
        <span className={v >= 0 ? 'text-green-600' : 'text-red-600'}>{v.toFixed(1)}%</span>
      ) },
    { title: 'Status', dataIndex: 'status', width: 105,
      render: v => <Tag color={v === 'favourable' ? 'green' : 'red'}>{v === 'favourable' ? 'Favourable' : 'Adverse'}</Tag> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Deviation Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Actual margin against the expected margin of each order</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Refresh</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From Date</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To Date</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data && (
        <>
          {data.basis && (
            <Alert type="info" showIcon icon={<WarningOutlined />} className="mb-4"
              message={`Basis: ${data.basis}`} />
          )}

          <Row gutter={16} className="mb-4">
            {[
              ['Orders Analysed', summary.orders || 0, '#1890ff'],
              ['Total Deviation', money(summary.totalDeviation),
                (summary.totalDeviation || 0) >= 0 ? '#52c41a' : '#f5222d'],
              ['Adverse Orders', summary.adverseCount || 0, '#f5222d'],
              ['Margin Lost to Adverse', money(summary.adverseDeviation), '#fa8c16'],
            ].map(([t, v, c]) => (
              <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{ color: c }} /></Card></Col>
            ))}
          </Row>

          {summary.excludedNoCost > 0 && (
            <Alert type="warning" showIcon className="mb-4"
              message={`${summary.excludedNoCost} order(s) excluded — no purchase rate could be resolved for their lines, so cost and margin cannot be computed.`} />
          )}

          <Card title="Order-level Deviation" size="small">
            <Table columns={cols} dataSource={rows} rowKey="orderId" size="small"
              scroll={{ x: 1000 }} pagination={{ pageSize: 15 }} />
          </Card>
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <p>Set date range and click "Generate"</p>
        </div>
      )}
    </div>
  );
};

export default DeviationReport;
