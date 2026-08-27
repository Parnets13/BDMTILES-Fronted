import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, Button, Input, Select, Tag, Space, message, Tooltip, Row, Col, Card, Statistic, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, ShoppingCartOutlined, RiseOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import SalesOrderView from './SalesOrderView.jsx';
import CreateSalesOrder from './CreateSalesOrder.jsx';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', approved: 'cyan', processing: 'orange',
  partial_dispatch: 'geekblue', dispatched: 'purple', delivered: 'green', cancelled: 'red', expired: 'volcano',
};
const PAYMENT_COLORS = { pending: 'orange', partial: 'blue', paid: 'green', overdue: 'red' };

const SalesOrderDashboard = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, paymentStatus: undefined });
  const [stats, setStats] = useState({});

  const [viewOrderId, setViewOrderId] = useState(null);
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  useEffect(() => {
    salesService.getStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...Object.fromEntries(Object.entries(filters).filter(([_,v]) => v)) };
      const res = await salesService.getOrders(params);
      if (res.success) {
        setOrders(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleStatusChange = async (id, status, reason) => {
    try {
      const res = await salesService.updateStatus(id, { status, cancellationReason: reason });
      if (res.success) { message.success(res.message); fetchOrders(); }
    } catch (err) { message.error(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await salesService.deleteOrder(id);
      if (res.success) { message.success(res.message); fetchOrders(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 100, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Dealer', key: 'dealer', width: 180, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[170px]">{r.dealerName || r.dealer?.businessName || '-'}</div><div className="text-xs text-gray-400">{r.dealerCode || r.dealer?.dealerCode}</div></div>
    )},
    { title: 'Items', key: 'items', width: 60, render: (_, r) => <span className="text-sm">{r.items?.length || 0}</span> },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110, render: v => <span className="text-sm font-semibold">₹{(v||0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace('_', ' ')}</Tag> },
    { title: 'Payment', dataIndex: 'paymentStatus', width: 90, render: s => <Tag color={PAYMENT_COLORS[s]}>{s}</Tag> },
    { title: 'Tally', dataIndex: 'tallySyncStatus', width: 80, render: s => (
      <Tag color={s === 'synced' ? 'green' : s === 'pending' ? 'orange' : s === 'failed' ? 'red' : 'default'}>{s === 'not_synced' ? 'Not Synced' : s}</Tag>
    )},
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewOrderId(r._id)} /></Tooltip>
        {r.status === 'draft' && (
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r._id)} /></Tooltip>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Sales Order Dashboard</h1><p className="text-sm text-gray-500 mt-0.5">Manage all dealer and retail sales orders</p></div>
        <Space>
          <ModuleRecycleBin module="sales_order" title="Deleted Sales Orders" onRestore={fetchOrders} />
          <Button icon={<PlusOutlined />} size="large" onClick={() => navigate('/sales-purchase/quotation-manager')}>Create Quotation</Button>
          <Button type="primary" icon={<ShoppingCartOutlined />} size="large" onClick={() => setShowCreateOrder(true)}>Create Sales Order</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Today's Sales" value={`₹${(stats.todaySales||0).toLocaleString()}`} prefix={<RiseOutlined />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{color:'#666'}} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Confirmed" value={stats.confirmed || 0} valueStyle={{color:'#1890ff'}} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Processing" value={stats.processing || 0} valueStyle={{color:'#fa8c16'}} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Dispatched" value={stats.dispatched || 0} valueStyle={{color:'#722ed1'}} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Delivered" value={stats.delivered || 0} valueStyle={{color:'#52c41a'}} /></Card></Col>
        <Col span={2}><Card size="small"><Statistic title="Cancel" value={stats.cancelled || 0} valueStyle={{color:'#f5222d'}} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search order #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }} className="w-64" allowClear />
          <Select placeholder="Status" options={Object.keys(STATUS_COLORS).map(s => ({value:s, label:s.replace('_',' ')}))}
            value={filters.status} onChange={v => setFilters(f => ({...f, status:v}))} allowClear className="w-36" />
          <Select placeholder="Payment" options={Object.keys(PAYMENT_COLORS).map(s => ({value:s, label:s}))}
            value={filters.paymentStatus} onChange={v => setFilters(f => ({...f, paymentStatus:v}))} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({status:undefined,paymentStatus:undefined}); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t,r) => `${r[0]}-${r[1]} of ${t} orders` }}
          onChange={pag => setPagination(p => ({...p, current: pag.current, pageSize: pag.pageSize}))} />
      </div>

      {/* Create Sales Order */}
      {showCreateOrder && (
        <CreateSalesOrder
          onClose={() => setShowCreateOrder(false)}
          onSuccess={() => {
            setShowCreateOrder(false);
            fetchOrders();
            salesService.getStats().then(r => { if (r.success) setStats(r.data); });
          }}
        />
      )}

      {/* View Order Detail */}
      {viewOrderId && (
        <SalesOrderView
          orderId={viewOrderId}
          onClose={() => setViewOrderId(null)}
          onStatusChange={() => { fetchOrders(); salesService.getStats().then(r => { if (r.success) setStats(r.data); }); }}
        />
      )}
    </div>
  );
};

export default SalesOrderDashboard;
