import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, Alert, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;

const BranchPerformance = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getBranchPerformance(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const branches = data || [];
  const totalSales = branches.reduce((sum, row) => sum + (row.salesValue || 0), 0);
  const totalCollected = branches.reduce((sum, row) => sum + (row.collected || 0), 0);
  const totalOutstanding = branches.reduce((sum, row) => sum + (row.outstanding || 0), 0);
  const activeBranches = branches.filter(row => (row.orderCount || 0) > 0).length;

  const columns = [
    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
    { title: 'Branch', dataIndex: 'branchName', render: (value, row) => (
      <div>
        <div className="font-medium">{value || '—'}</div>
        <div className="text-[10px] text-gray-400">
          {row.branchCode}{row.city ? ` · ${row.city}` : ''}
        </div>
      </div>
    ) },
    { title: 'Orders', dataIndex: 'orderCount', width: 80 },
    { title: 'Sales', dataIndex: 'salesValue', width: 140,
      sorter: (a, b) => a.salesValue - b.salesValue, defaultSortOrder: 'descend',
      render: value => <span className="font-semibold">{money(value)}</span> },
    { title: 'Share', key: 'share', width: 90,
      render: (_, row) => {
        const pct = totalSales > 0 ? Math.round(((row.salesValue || 0) / totalSales) * 100) : 0;
        return <span className="text-gray-600">{pct}%</span>;
      } },
    { title: 'Avg Order', dataIndex: 'avgOrderValue', width: 120, render: value => money(Math.round(value || 0)) },
    { title: 'Dealers', dataIndex: 'dealerCount', width: 85 },
    { title: 'Discount', dataIndex: 'totalDiscount', width: 120, render: value => money(value) },
    { title: 'Collected', dataIndex: 'collected', width: 130,
      render: value => <span className="text-green-600">{money(value)}</span> },
    { title: 'Collection %', dataIndex: 'collectionRatio', width: 115,
      render: value => {
        if (value === null) return <span className="text-gray-400">—</span>;
        const tone = value >= 80 ? 'text-green-600' : value >= 50 ? 'text-orange-500' : 'text-red-600';
        return <span className={`font-medium ${tone}`}>{value}%</span>;
      } },
    { title: 'Outstanding', dataIndex: 'outstanding', width: 130,
      render: value => <span className={(value || 0) > 0 ? 'font-medium text-red-600' : 'text-gray-400'}>{money(value)}</span> },
  ];

  const chartData = branches.map(row => ({
    name: row.branchCode || row.branchName || '—',
    sales: row.salesValue || 0,
    collected: row.collected || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Branch Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Sales, collection efficiency and outstanding compared across branches</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Refresh</Button>
      </div>

      <Alert
        className="mb-4"
        type="info"
        showIcon
        message="This is the one report that spans branches"
        description="It covers every branch assigned to you rather than only the branch selected in the header, since comparing a branch with itself has no meaning. Branches you are not assigned to are never included."
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(c => ({ ...c, dateFrom: e.target.value }))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(c => ({ ...c, dateTo: e.target.value }))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Branches', `${activeBranches} / ${branches.length} active`, '#1890ff'],
              ['Total Sales', money(totalSales), '#FF5F03'],
              ['Total Collected', money(totalCollected), '#52c41a'],
              ['Total Outstanding', money(totalOutstanding), '#cf1322'],
            ].map(([title, value, color]) => (
              <Col xs={12} md={6} key={title}><Card size="small"><Statistic title={title} value={value} valueStyle={{ color, fontSize: 18 }} /></Card></Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Sales vs Collection by Branch">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => money(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="sales" name="Sales" fill="#FF5F03" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="collected" name="Collected" fill="#52c41a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={columns} dataSource={branches} rowKey="_id" size="middle" scroll={{ x: 1200 }}
              locale={{ emptyText: 'No branches available' }}
              pagination={false} />
          </div>
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

export default BranchPerformance;
