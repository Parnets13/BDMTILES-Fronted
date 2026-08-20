import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, Tag, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const SEPerformance = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getDealerPerformance(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const dealers = data || [];
  const totalRevenue = dealers.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalOrders = dealers.reduce((s, d) => s + (d.orders || 0), 0);

  const columns = [
    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
    { title: 'Sales Executive', dataIndex: 'dealerName', render: v => <span className="font-medium">{v || 'Unassigned'}</span> },
    { title: 'Orders', dataIndex: 'orders', width: 80 },
    { title: 'Revenue', dataIndex: 'revenue', width: 130,
      render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Avg Order', dataIndex: 'avgOrderValue', width: 110,
      render: v => `₹${Math.round(v || 0).toLocaleString()}` },
    { title: 'Collected', dataIndex: 'paidAmount', width: 120,
      render: v => <span className="text-green-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Outstanding', dataIndex: 'balanceAmount', width: 120,
      render: v => <span className="text-red-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Collection %', key: 'pct', width: 100,
      render: (_, r) => {
        const pct = r.revenue ? Math.round((r.paidAmount || 0) / r.revenue * 100) : 0;
        return <Tag color={pct >= 80 ? 'green' : pct >= 50 ? 'orange' : 'red'}>{pct}%</Tag>;
      }},
  ];

  const chartData = (data || []).slice(0, 10).map(d => ({
    name: (d.dealerName || 'N/A').split(' ')[0],
    revenue: d.revenue || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SE Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales Executive target vs achievement, collection efficiency</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total SEs', dealers.length, '#1890ff'],
              ['Total Revenue', `₹${totalRevenue.toLocaleString()}`, '#FF5F03'],
              ['Total Orders', totalOrders, '#52c41a'],
            ].map(([t, v, c]) => (
              <Col span={8} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Top 10 by Revenue">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{top:10,right:20,left:10,bottom:40}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize:10}} angle={-25} textAnchor="end" />
                  <YAxis tick={{fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="revenue" fill="#FF5F03" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={columns} dataSource={dealers} rowKey="_id" size="middle" scroll={{ x: 900 }}
              pagination={{ pageSize: 20, showTotal: t => `${t} entries` }} />
          </div>
        </>
      )}

      {data === null && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          Set date range and click "Generate"
        </div>
      )}
    </div>
  );
};

export default SEPerformance;
