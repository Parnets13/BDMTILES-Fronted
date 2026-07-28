import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const BillWiseProfit = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getProfitReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const bills = data?.billwiseProfit || [];
  const totalRevenue = bills.reduce((s, b) => s + (b.revenue || 0), 0);
  const totalCost = bills.reduce((s, b) => s + (b.estimatedCost || 0), 0);
  const totalProfit = bills.reduce((s, b) => s + (b.grossProfit || 0), 0);
  const margin = totalRevenue ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0;

  const cols = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 110,
      render: v => <span className="font-mono text-xs text-blue-600">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 95,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { title: 'Dealer', dataIndex: 'dealerName', render: v => v || '—' },
    { title: 'Revenue', dataIndex: 'revenue', width: 120,
      render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'Est. Cost', dataIndex: 'estimatedCost', width: 110,
      render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'Gross Profit', dataIndex: 'grossProfit', width: 120,
      render: v => <span className={`font-semibold ${(v||0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
        ₹{(v||0).toLocaleString()}</span> },
    { title: 'Margin %', key: 'margin', width: 90,
      render: (_, r) => r.revenue ? (
        <span className={`text-sm ${(r.grossProfit/r.revenue*100) >= 15 ? 'text-green-600' : 'text-orange-500'}`}>
          {((r.grossProfit / r.revenue) * 100).toFixed(1)}%
        </span>
      ) : '—' },
  ];

  const catData = (data?.categoryMargin || []).map(c => ({ name: c._id, revenue: c.revenue || 0 }));

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bill-wise Profit & Category Margin</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gross profit analysis per order and category</p>
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

      {data && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Revenue', `₹${totalRevenue.toLocaleString()}`, '#1890ff'],
              ['Est. Cost', `₹${totalCost.toLocaleString()}`, '#fa8c16'],
              ['Gross Profit', `₹${totalProfit.toLocaleString()}`, totalProfit >= 0 ? '#52c41a' : '#f5222d'],
              ['Gross Margin', `${margin}%`, totalProfit >= 0 ? '#52c41a' : '#f5222d'],
            ].map(([t, v, c]) => (
              <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          <Row gutter={16}>
            <Col span={14}>
              <Card title="Bill-wise Profit" size="small" className="mb-4">
                <Table columns={cols} dataSource={bills} rowKey="_id" size="small"
                  scroll={{ x: 800 }} pagination={{ pageSize: 10 }} />
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Revenue by Category" size="small">
                {catData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={catData} layout="vertical" margin={{top:5,right:20,left:60,bottom:5}}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis type="number" tick={{fontSize:10}} tickFormatter={v=>`₹${(v/1000).toFixed(0)}k`} />
                      <YAxis type="category" dataKey="name" tick={{fontSize:10}} width={60} />
                      <Tooltip formatter={v=>[`₹${Number(v).toLocaleString()}`,'Revenue']} />
                      <Bar dataKey="revenue" fill="#52c41a" radius={[0,3,3,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <div className="py-8 text-center text-gray-400 text-sm">No category data</div>}
              </Card>
            </Col>
          </Row>
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

export default BillWiseProfit;
