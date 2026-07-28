import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Skeleton, message } from 'antd';
import { ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import {
  TrendingUp, ShoppingCart, Clock, DollarSign,
  Package, Warehouse, FileText, Users, BarChart2, CheckSquare
} from 'lucide-react';
import reportService from '../../services/reportService.js';

const BRAND = '#FF5F03';

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportService.getDashboard();
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); setLastRefresh(new Date()); }
  };

  useEffect(() => { load(); }, []);

  const growthColor = data?.monthGrowth > 0 ? '#52c41a' : data?.monthGrowth < 0 ? '#f5222d' : '#666';

  const quickActions = [
    { label: 'New Sales Order', icon: <ShoppingCart size={18} />, path: '/sales-purchase/sales-order-dashboard', color: BRAND },
    { label: 'New Quotation', icon: <FileText size={18} />, path: '/sales-purchase/quotation-manager', color: '#1890ff' },
    { label: 'Add Payment', icon: <DollarSign size={18} />, path: '/sales-purchase/dealer-payments', color: '#52c41a' },
    { label: 'Dealer Ledger', icon: <Users size={18} />, path: '/finance/dealer-ledger', color: '#722ed1' },
    { label: 'Stock Check', icon: <Package size={18} />, path: '/inventory/stock', color: '#fa8c16' },
    { label: 'Reports', icon: <BarChart2 size={18} />, path: '/reports/sales-reports', color: '#13c2c2' },
  ];

  const recentActivity = [
    { icon: <ShoppingCart size={13} className="text-orange-500" />, text: 'Sales module active — orders being processed' },
    { icon: <Package size={13} className="text-blue-500" />, text: 'Stock levels updated after last GRN' },
    { icon: <DollarSign size={13} className="text-green-500" />, text: 'Payments module ready for dealer receipts' },
    { icon: <CheckSquare size={13} className="text-purple-500" />, text: 'Approval workflow is active' },
    { icon: <TrendingUp size={13} className="text-teal-500" />, text: 'Reports generated for current month' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            Last refreshed: {lastRefresh.toLocaleTimeString('en-IN')}
          </p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton active paragraph={{ rows: 2 }} />
          <Skeleton active paragraph={{ rows: 4 }} />
        </div>
      ) : (
        <>
          {/* Top KPI Row */}
          <Row gutter={[16, 16]} className="mb-4">
            <Col span={6}>
              <Card size="small" style={{ borderLeft: `4px solid ${BRAND}` }}>
                <Statistic title="Today's Sales" value={data?.todaySales || 0}
                  prefix="₹" formatter={v => Number(v).toLocaleString()}
                  valueStyle={{ color: BRAND, fontSize: 22 }} />
                <div className="text-xs text-gray-400 mt-1">{data?.todayOrders || 0} orders today</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderLeft: '4px solid #1890ff' }}>
                <Statistic title="This Month Sales" value={data?.monthSales || 0}
                  prefix="₹" formatter={v => Number(v).toLocaleString()}
                  valueStyle={{ color: '#1890ff', fontSize: 22 }} />
                {data?.monthGrowth !== null && (
                  <div className="text-xs mt-1" style={{ color: growthColor }}>
                    {data?.monthGrowth > 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />}
                    {' '}{Math.abs(data?.monthGrowth)}% vs last month
                  </div>
                )}
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderLeft: '4px solid #fa8c16' }}>
                <Statistic title="Pending Orders" value={data?.pendingOrders || 0}
                  valueStyle={{ color: '#fa8c16', fontSize: 22 }} />
                <div className="text-xs text-gray-400 mt-1">Awaiting processing / dispatch</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ borderLeft: '4px solid #f5222d' }}>
                <Statistic title="Pending Payments" value={data?.pendingPayments || 0}
                  prefix="₹" formatter={v => Number(v).toLocaleString()}
                  valueStyle={{ color: '#f5222d', fontSize: 22 }} />
                <div className="text-xs text-gray-400 mt-1">{data?.pendingPaymentsCount || 0} orders outstanding</div>
              </Card>
            </Col>
          </Row>

          {/* Second Row */}
          <Row gutter={[16, 16]} className="mb-4">
            <Col span={8}>
              <Card size="small" style={{ borderLeft: '4px solid #52c41a' }}>
                <Statistic title="Total Stock Qty" value={data?.totalStock || 0}
                  suffix="units" valueStyle={{ color: '#52c41a' }}
                  prefix={<Package size={16} />} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderLeft: '4px solid #722ed1' }}>
                <Statistic title="Stock Value" value={data?.stockValue || 0}
                  prefix="₹" formatter={v => Number(v).toLocaleString()}
                  valueStyle={{ color: '#722ed1' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small" style={{ borderLeft: '4px solid #13c2c2' }}>
                <Statistic title="Outstanding Orders (Balance)" value={data?.pendingPaymentsCount || 0}
                  suffix="orders" valueStyle={{ color: '#13c2c2' }} />
              </Card>
            </Col>
          </Row>

          {/* Chart */}
          <Card className="mb-4" title={<span className="font-semibold text-gray-700">Weekly Sales Trend</span>}>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={data?.weeklySalesTrend || []}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={BRAND} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Revenue']} />
                <Area type="monotone" dataKey="total" stroke={BRAND} strokeWidth={2}
                  fill="url(#salesGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          {/* Bottom Row */}
          <Row gutter={16}>
            <Col span={12}>
              <Card title="Recent Activity" size="small">
                <div className="space-y-2">
                  {recentActivity.map((a, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 text-sm text-gray-600">
                      {a.icon} {a.text}
                    </div>
                  ))}
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Quick Actions" size="small">
                <div className="grid grid-cols-3 gap-2">
                  {quickActions.map(a => (
                    <button key={a.label}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition text-center cursor-pointer"
                      onClick={() => navigate(a.path)}>
                      <span style={{ color: a.color }}>{a.icon}</span>
                      <span className="text-xs text-gray-600 leading-tight">{a.label}</span>
                    </button>
                  ))}
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default OwnerDashboard;
