import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
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
      const res = await reportService.getSEPerformance(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const executives = data || [];
  const totalRevenue = executives.reduce((sum, executive) => sum + (executive.salesValue || 0), 0);
  const totalOrders = executives.reduce((sum, executive) => sum + (executive.orderCount || 0), 0);

  const columns = [
    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
    { title: 'Sales Executive', dataIndex: 'executiveName', render: value => <span className="font-medium">{value || 'Unassigned'}</span> },
    { title: 'Orders', dataIndex: 'orderCount', width: 80 },
    { title: 'Revenue', dataIndex: 'salesValue', width: 130,
      render: value => <span className="font-semibold">₹{(value || 0).toLocaleString()}</span> },
    { title: 'Avg Order', dataIndex: 'avgOrderValue', width: 110,
      render: value => `₹${Math.round(value || 0).toLocaleString()}` },
    { title: 'Dealers', dataIndex: 'dealerCount', width: 90 },
  ];

  const chartData = executives.slice(0, 10).map(executive => ({
    name: (executive.executiveName || 'Unassigned').split(' ')[0],
    salesValue: executive.salesValue || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">SE Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales, orders, and dealer coverage by sales executive</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={filters.dateFrom} onChange={event => setFilters(current => ({...current, dateFrom: event.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={filters.dateTo} onChange={event => setFilters(current => ({...current, dateTo: event.target.value}))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total SEs', executives.length, '#1890ff'],
              ['Total Revenue', `₹${totalRevenue.toLocaleString()}`, '#FF5F03'],
              ['Total Orders', totalOrders, '#52c41a'],
            ].map(([title, value, color]) => (
              <Col span={8} key={title}><Card size="small"><Statistic title={title} value={value} valueStyle={{color}} /></Card></Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Top 10 by Revenue">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{top:10,right:20,left:10,bottom:40}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize:10}} angle={-25} textAnchor="end" />
                  <YAxis tick={{fontSize:11}} tickFormatter={value => `₹${(value/1000).toFixed(0)}k`} />
                  <Tooltip formatter={value => [`₹${Number(value).toLocaleString()}`, 'Revenue']} />
                  <Bar dataKey="salesValue" fill="#FF5F03" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={columns} dataSource={executives} rowKey="_id" size="middle" scroll={{ x: 650 }}
              pagination={{ pageSize: 20, showTotal: total => `${total} entries` }} />
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
