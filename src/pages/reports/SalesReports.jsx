import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Select, Table, message, Divider } from 'antd';
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const COLORS = ['#FF5F03','#1890ff','#52c41a','#fa8c16','#722ed1'];

const SalesReports = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    groupBy: 'month',
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getSalesReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const el = document.getElementById('sales-report-print');
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Sales Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
    table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:7px;text-align:left;border-bottom:2px solid #ddd}
    td{padding:6px 8px;border-bottom:1px solid #eee}@media print{body{padding:0}}</style>
    </head><body>${el.innerHTML}</body></html>`);
    w.document.close(); setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const dealerCols = [
    { title: '#', render: (_, __, i) => i + 1, width: 40 },
    { title: 'Dealer', dataIndex: 'dealerName', render: v => v || '—' },
    { title: 'Orders', dataIndex: 'orders', width: 80 },
    { title: 'Revenue', dataIndex: 'revenue', width: 130, render: v => `₹${(v||0).toLocaleString()}` },
    { title: '% of Total', key: 'pct', width: 100, render: (_, r) => data?.summary?.totalRevenue
      ? `${((r.revenue / data.summary.totalRevenue) * 100).toFixed(1)}%` : '—' },
  ];
  const productCols = [
    { title: '#', render: (_, __, i) => i + 1, width: 40 },
    { title: 'Product', dataIndex: 'productName', render: v => v || '—' },
    { title: 'Code', dataIndex: 'productCode', width: 100 },
    { title: 'Qty Sold', dataIndex: 'qty', width: 90 },
    { title: 'Revenue', dataIndex: 'revenue', width: 120, render: v => `₹${(v||0).toLocaleString()}` },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Sales Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily / Monthly / Category-wise sales analysis</p>
        </div>
        {data && <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Report</Button>}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From Date</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To Date</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Group By</label>
            <Select value={filters.groupBy} onChange={v => setFilters(f => ({...f, groupBy: v}))} className="w-32"
              options={[{value:'day',label:'Day'},{value:'month',label:'Month'},{value:'year',label:'Year'}]} /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate Report</Button>
        </div>
      </div>

      {data && (
        <div id="sales-report-print">
          <Row gutter={16} className="mb-4">
            {[
              ['Total Revenue', `₹${(data.summary?.totalRevenue||0).toLocaleString()}`, '#FF5F03'],
              ['Total Orders', data.summary?.totalOrders || 0, '#1890ff'],
              ['Avg Order Value', `₹${Math.round(data.summary?.avgOrderValue||0).toLocaleString()}`, '#52c41a'],
              ['Returns Value', `₹${(data.summary?.returnsValue||0).toLocaleString()}`, '#f5222d'],
            ].map(([t, v, c]) => (
              <Col span={6} key={t}><Card size="small">
                <Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          <Card className="mb-4" title="Revenue Trend">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.byPeriod || []} margin={{top:10,right:20,left:10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{fontSize:11}} />
                <YAxis tick={{fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                <Bar dataKey="revenue" fill="#FF5F03" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Row gutter={16}>
            <Col span={12}>
              <Card title="Top 10 Dealers" size="small">
                <Table columns={dealerCols} dataSource={data.byDealer||[]} rowKey="_id"
                  size="small" pagination={false} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Top 10 Products" size="small">
                <Table columns={productCols} dataSource={data.topProducts||[]} rowKey="_id"
                  size="small" pagination={false} />
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <BarChart size={48} className="mx-auto mb-3" />
          <p>Set filters and click "Generate Report" to view sales data</p>
        </div>
      )}
    </div>
  );
};

export default SalesReports;
