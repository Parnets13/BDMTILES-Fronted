import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const DealerPerformance = () => {
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
  const totalCollected = dealers.reduce((s, d) => s + (d.paidAmount || 0), 0);
  const totalOutstanding = dealers.reduce((s, d) => s + (d.balanceAmount || 0), 0);

  const cols = [
    { title: '#', render: (_, __, i) => <span className="text-gray-400 font-medium">{i+1}</span>, width: 45 },
    { title: 'Dealer Code', dataIndex: 'dealerCode', width: 110,
      render: v => <span className="font-mono text-xs text-blue-600">{v || '—'}</span> },
    { title: 'Dealer Name', dataIndex: 'dealerName', render: v => <span className="font-medium">{v || '—'}</span> },
    { title: 'Orders', dataIndex: 'orders', width: 75 },
    { title: 'Revenue', dataIndex: 'revenue', width: 130,
      render: v => <span className="font-semibold">₹{(v||0).toLocaleString()}</span>,
      sorter: (a, b) => a.revenue - b.revenue, defaultSortOrder: 'descend' },
    { title: 'Avg Order', dataIndex: 'avgOrderValue', width: 110,
      render: v => `₹${Math.round(v||0).toLocaleString()}` },
    { title: 'Collected', dataIndex: 'paidAmount', width: 120,
      render: v => <span className="text-green-600">₹{(v||0).toLocaleString()}</span> },
    { title: 'Balance', dataIndex: 'balanceAmount', width: 120,
      render: v => <span className={`${(v||0) > 0 ? 'text-red-600' : 'text-gray-400'} font-medium`}>₹{(v||0).toLocaleString()}</span> },
    { title: 'Collection %', key: 'col', width: 110,
      render: (_, r) => {
        const pct = r.revenue > 0 ? ((r.paidAmount || 0) / r.revenue * 100).toFixed(0) : 0;
        return <span className={`font-medium ${pct >= 80 ? 'text-green-600' : pct >= 50 ? 'text-orange-500' : 'text-red-600'}`}>{pct}%</span>;
      }},
  ];

  const chartData = dealers.slice(0, 10).map(d => ({
    name: d.dealerName?.split(' ')[0] || d.dealerCode || 'N/A',
    revenue: d.revenue || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dealer Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Revenue, collection efficiency and outstanding by dealer</p>
        </div>
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

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Dealers (in period)', dealers.length, '#1890ff'],
              ['Total Revenue', `₹${totalRevenue.toLocaleString()}`, '#FF5F03'],
              ['Total Collected', `₹${totalCollected.toLocaleString()}`, '#52c41a'],
              ['Total Outstanding', `₹${totalOutstanding.toLocaleString()}`, '#f5222d'],
            ].map(([t, v, c]) => (
              <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Top 10 Dealers by Revenue">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{top:10,right:20,left:10,bottom:50}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize:10}} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{fontSize:11}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v=>[`₹${Number(v).toLocaleString()}`,'Revenue']} />
                  <Bar dataKey="revenue" fill="#FF5F03" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={cols} dataSource={dealers} rowKey="_id" size="middle" scroll={{ x: 1050 }}
              pagination={{ pageSize: 20, showTotal: t => `${t} dealers` }} />
          </div>
        </>
      )}

      {data === null && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <p>Set date range and click "Generate"</p>
        </div>
      )}
    </div>
  );
};

export default DealerPerformance;
