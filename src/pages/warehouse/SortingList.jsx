import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Switch, Divider
} from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, CheckOutlined } from '@ant-design/icons';
import { ArrowUpDown, Layers } from 'lucide-react';
import crmService from '../../services/crmService.js';

const PRIORITY_COLORS = { normal: 'default', urgent: 'red', vip: 'gold' };

const SortingList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [groupByRoute, setGroupByRoute] = useState(false);
  const [sortedIds, setSortedIds] = useState([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmService.getPendingOrders();
      if (res.success) {
        let data = res.data || [];
        if (priorityFilter) data = data.filter(o => o.deliveryPriority === priorityFilter);
        if (search) data = data.filter(o =>
          (o.orderNumber || '').toLowerCase().includes(search.toLowerCase()) ||
          (o.dealerName || o.dealer?.businessName || '').toLowerCase().includes(search.toLowerCase())
        );
        setOrders(data);
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [priorityFilter, search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleMarkSorted = (orderId, orderNumber) => {
    setSortedIds(prev => [...prev, orderId]);
    message.success(`Order ${orderNumber} marked as sorted`);
  };

  const getRoute = (order) => order.routeName || order.dealer?.route || order.region || 'Unassigned';

  const groupedOrders = orders.reduce((acc, order) => {
    const route = getRoute(order);
    if (!acc[route]) acc[route] = [];
    acc[route].push(order);
    return acc;
  }, {});

  const printSortingSlip = (routeName, routeOrders) => {
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Sorting Slip - ${routeName}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h2{margin-bottom:4px}
      .meta{color:#666;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f0f0f0;padding:7px 10px;text-align:left;font-size:10px;border-bottom:2px solid #ddd}
      td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px}
      .footer{margin-top:30px;border-top:1px solid #ccc;padding-top:16px}
      @media print{body{padding:0}}
    </style></head><body>
    <h2>Sorting Slip — Route: ${routeName}</h2>
    <div class="meta">Date: ${new Date().toLocaleDateString('en-IN')} | Orders: ${routeOrders.length}</div>
    <table>
      <thead><tr><th>#</th><th>Order #</th><th>Dealer</th><th>Delivery Address</th><th>Priority</th><th>Amount</th></tr></thead>
      <tbody>
        ${routeOrders.map((o, i) => `
          <tr>
            <td>${i + 1}</td>
            <td>${o.orderNumber || '—'}</td>
            <td>${o.dealerName || o.dealer?.businessName || '—'}</td>
            <td>${o.deliveryAddress || '—'}</td>
            <td>${o.deliveryPriority || 'normal'}</td>
            <td>₹${(o.grandTotal || 0).toLocaleString()}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      Sorted by: ___________________________ Date: _______________ Signature: _______________
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const columns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 120,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Dealer', key: 'dealer', width: 160,
      render: (_, r) => <div className="text-sm font-medium">{r.dealerName || r.dealer?.businessName || '—'}</div> },
    { title: 'Route', key: 'route', width: 130,
      render: (_, r) => <Tag color="blue">{getRoute(r)}</Tag> },
    { title: 'Delivery Address', dataIndex: 'deliveryAddress', width: 180,
      render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
    { title: 'Priority', dataIndex: 'deliveryPriority', width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v || 'normal'}</Tag> },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="text-sm font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Actions', width: 120,
      render: (_, r) => (
        sortedIds.includes(r._id)
          ? <Tag color="green" icon={<CheckOutlined />}>Sorted</Tag>
          : <Button size="small" type="primary" ghost onClick={() => handleMarkSorted(r._id, r.orderNumber)}>
              Mark Sorted
            </Button>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ArrowUpDown size={24} className="text-purple-600" /> Sorting List
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Sort picked goods by delivery route before loading</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">Group by Route</span>
          <Switch checked={groupByRoute} onChange={v => setGroupByRoute(v)} />
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>Refresh</Button>
        </div>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Orders" value={orders.length} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Routes" value={Object.keys(groupedOrders).length} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Sorted" value={sortedIds.length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Pending Sort" value={orders.length - sortedIds.length} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search order or dealer..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-56" allowClear />
          <Select placeholder="Priority" allowClear value={priorityFilter} onChange={v => setPriorityFilter(v)} className="w-32"
            options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }, { value: 'vip', label: 'VIP' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setPriorityFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {groupByRoute ? (
        <div className="space-y-4">
          {Object.entries(groupedOrders).map(([routeName, routeOrders]) => (
            <div key={routeName} className="bg-white rounded-lg border border-gray-200">
              <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
                <div className="flex items-center gap-2">
                  <Layers size={16} className="text-purple-600" />
                  <span className="font-semibold text-gray-700">Route: {routeName}</span>
                  <Tag color="blue">{routeOrders.length} orders</Tag>
                </div>
                <Button size="small" icon={<PrinterOutlined />} onClick={() => printSortingSlip(routeName, routeOrders)}>
                  Print Slip
                </Button>
              </div>
              <Table columns={columns} dataSource={routeOrders} rowKey="_id" size="small"
                pagination={false} scroll={{ x: 900 }} />
            </div>
          ))}
          {Object.keys(groupedOrders).length === 0 && !loading && (
            <div className="bg-white rounded-lg border border-gray-200 p-10 text-center text-gray-400">
              No pending orders for sorting
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200">
          <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading}
            size="middle" scroll={{ x: 900 }}
            pagination={{ pageSize: 20, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }} />
        </div>
      )}
    </div>
  );
};

export default SortingList;
