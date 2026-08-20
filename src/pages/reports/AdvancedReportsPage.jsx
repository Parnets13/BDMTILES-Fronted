import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Tabs } from 'antd';
import { DollarOutlined, UserOutlined, ShopOutlined, RiseOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import dayjs from 'dayjs';

const AdvancedReportsPage = () => {
  const [activeTab, setActiveTab] = useState('profitability');
  const [dateFrom, setDateFrom] = useState(dayjs().startOf('month').format('YYYY-MM-DD'));
  const [dateTo, setDateTo] = useState(dayjs().format('YYYY-MM-DD'));
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchReport = async (tab) => {
    setLoading(true);
    try {
      const endpoint = tab === 'profitability' ? '/reports/profitability'
        : tab === 'dealer' ? '/reports/dealer-performance'
        : '/reports/se-performance';
      const res = await api.get(endpoint, { params: { dateFrom, dateTo } });
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchReport(activeTab); }, [activeTab, dateFrom, dateTo]);

  const profitColumns = [
    { title: 'Product', key: 'product', render: (_, r) => <div><div className="font-medium text-xs">{r.productName}</div><div className="text-[10px] text-gray-400">{r.productCode}</div></div> },
    { title: 'Qty Sold', dataIndex: 'salesQty', width: 80 },
    { title: 'Revenue', dataIndex: 'salesRevenue', width: 110, render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'Discount', dataIndex: 'discountGiven', width: 90, render: v => v > 0 ? <span className="text-red-500">₹{v.toLocaleString()}</span> : '—' },
  ];

  const dealerColumns = [
    { title: 'Dealer', key: 'dealer', render: (_, r) => <div><div className="font-medium text-xs">{r.dealerName}</div><div className="text-[10px] text-gray-400">{r.dealerCode}</div></div> },
    { title: 'Orders', dataIndex: 'orderCount', width: 65 },
    { title: 'Sales ₹', dataIndex: 'salesValue', width: 110, render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'Avg Order', dataIndex: 'avgOrderValue', width: 100, render: v => `₹${Math.round(v || 0).toLocaleString()}` },
    { title: 'Collection ₹', dataIndex: 'collectionValue', width: 110, render: v => <span className="text-green-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Collection %', dataIndex: 'collectionRatio', width: 90, render: v => <Tag color={v >= 80 ? 'green' : v >= 50 ? 'orange' : 'red'}>{v}%</Tag> },
    { title: 'Discount', dataIndex: 'totalDiscount', width: 90, render: v => v > 0 ? `₹${v.toLocaleString()}` : '—' },
  ];

  const seColumns = [
    { title: 'Executive', dataIndex: 'executiveName', width: 140 },
    { title: 'Sales ₹', dataIndex: 'salesValue', width: 110, render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'Orders', dataIndex: 'orderCount', width: 65 },
    { title: 'Avg Order', dataIndex: 'avgOrderValue', width: 100, render: v => `₹${Math.round(v || 0).toLocaleString()}` },
    { title: 'Dealers', dataIndex: 'dealerCount', width: 70 },
  ];

  const categoryColumns = [
    { title: 'Category', dataIndex: '_id', width: 140, render: v => v || 'Uncategorized' },
    { title: 'Revenue', dataIndex: 'salesRevenue', width: 110, render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'Cost Est.', dataIndex: 'costEstimate', width: 110, render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'Gross Margin', dataIndex: 'grossMargin', width: 110, render: v => <span className={v >= 0 ? 'text-green-600' : 'text-red-500'}>₹{(v || 0).toLocaleString()}</span> },
    { title: 'Margin %', dataIndex: 'marginPercent', width: 90, render: v => <Tag color={v >= 20 ? 'green' : v >= 10 ? 'orange' : 'red'}>{Math.round(v || 0)}%</Tag> },
    { title: 'Qty', dataIndex: 'totalQty', width: 70 },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Advanced Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Profitability, dealer performance, sales executive performance</p>
        </div>
        <Space>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          <span className="text-gray-400">to</span>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => fetchReport(activeTab)}>Refresh</Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={k => setActiveTab(k)} items={[
        { key: 'profitability', label: <span><DollarOutlined /> Profitability</span>, children: (
          <div className="space-y-4">
            {data?.summary && (
              <Row gutter={12}>
                <Col span={4}><Card size="small"><Statistic title="Gross Sales" value={`₹${Math.round(data.summary.grossSales || 0).toLocaleString()}`} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Discount Given" value={`₹${Math.round(data.summary.totalDiscount || 0).toLocaleString()}`} valueStyle={{ color: '#f5222d' }} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Total Tax" value={`₹${Math.round(data.summary.totalTax || 0).toLocaleString()}`} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Total Orders" value={data.summary.totalOrders || 0} /></Card></Col>
                <Col span={4}><Card size="small"><Statistic title="Freight" value={`₹${Math.round(data.summary.freightCharges || 0).toLocaleString()}`} /></Card></Col>
              </Row>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="font-semibold text-gray-700 mb-2">Top Products by Revenue</div>
                <Table columns={profitColumns} dataSource={data?.productProfit || []} rowKey="_id" size="small" pagination={false} loading={loading} />
              </div>
              <div>
                <div className="font-semibold text-gray-700 mb-2">Category-wise Margin</div>
                <Table columns={categoryColumns} dataSource={data?.categoryProfit || []} rowKey="_id" size="small" pagination={false} loading={loading} />
              </div>
            </div>
            <div>
              <div className="font-semibold text-gray-700 mb-2">Dealer-wise Profitability</div>
              <Table columns={[
                { title: 'Dealer', key: 'd', render: (_, r) => <span className="text-xs font-medium">{r.dealerName} ({r.dealerCode})</span> },
                { title: 'Revenue', dataIndex: 'revenue', width: 110, render: v => `₹${(v || 0).toLocaleString()}` },
                { title: 'Orders', dataIndex: 'orders', width: 65 },
                { title: 'Discount', dataIndex: 'discount', width: 90, render: v => v > 0 ? `₹${v.toLocaleString()}` : '—' },
              ]} dataSource={data?.dealerProfit || []} rowKey="_id" size="small" pagination={{ pageSize: 10 }} loading={loading} />
            </div>
          </div>
        )},
        { key: 'dealer', label: <span><ShopOutlined /> Dealer Performance</span>, children: (
          <Table columns={dealerColumns} dataSource={data || []} rowKey="_id" size="middle" loading={loading}
            pagination={{ pageSize: 20, showTotal: (t) => `${t} dealers` }} />
        )},
        { key: 'se', label: <span><UserOutlined /> SE Performance</span>, children: (
          <Table columns={seColumns} dataSource={data || []} rowKey="_id" size="middle" loading={loading}
            pagination={{ pageSize: 20 }} />
        )},
      ]} />
    </div>
  );
};

export default AdvancedReportsPage;
