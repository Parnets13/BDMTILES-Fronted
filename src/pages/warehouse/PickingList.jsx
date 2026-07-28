import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic
} from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined } from '@ant-design/icons';
import { Package, ClipboardList } from 'lucide-react';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';

const PRIORITY_COLORS = { normal: 'default', urgent: 'red', vip: 'gold' };

const PickingList = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseFilter, setWarehouseFilter] = useState(undefined);
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');

  const stats = {
    totalOrders: orders.length,
    itemsToPick: orders.reduce((s, o) => s + (o.items?.length || 0), 0),
    totalBoxes: orders.reduce((s, o) => s + (o.items?.reduce((ss, i) => ss + (i.quantity || 0), 0) || 0), 0),
  };

  useEffect(() => {
    masterService.getWarehouses({ limit: 100 }).then(r => { if (r.success) setWarehouses(r.data || []); }).catch(() => {});
  }, []);

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

  const generatePickingSlip = (order) => {
    const win = window.open('', '_blank');
    const items = order.items || [];
    win.document.write(`<html><head><title>Picking Slip - ${order.orderNumber}</title>
    <style>
      body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
      h2{margin-bottom:2px}
      .meta{color:#666;font-size:11px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;margin-top:12px}
      th{background:#f0f0f0;padding:7px 10px;text-align:left;font-size:10px;border-bottom:2px solid #ddd;text-transform:uppercase}
      td{padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:11px}
      .footer{margin-top:30px;display:flex;justify-content:space-between;border-top:1px solid #ccc;padding-top:16px}
      @media print{body{padding:0}}
    </style></head><body>
    <h2>Picking Slip</h2>
    <div class="meta">
      Order #: <strong>${order.orderNumber}</strong> &nbsp;|&nbsp;
      Dealer: <strong>${order.dealerName || order.dealer?.businessName || '—'}</strong> &nbsp;|&nbsp;
      Date: <strong>${new Date().toLocaleDateString('en-IN')}</strong>
    </div>
    <table>
      <thead><tr><th>#</th><th>Product</th><th>Shade</th><th>Batch</th><th>Qty</th><th>Unit</th><th>Rack/Bin</th></tr></thead>
      <tbody>
        ${items.map((item, idx) => `
          <tr>
            <td>${idx + 1}</td>
            <td>${item.productName || item.product?.productName || '—'}</td>
            <td>${item.shade || '—'}</td>
            <td>${item.batch || '—'}</td>
            <td>${item.quantity || 0}</td>
            <td>${item.unit || 'Box'}</td>
            <td>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="footer">
      <span>Picked by: ___________________________</span>
      <span>Date: _______________</span>
      <span>Signature: _______________</span>
    </div>
    </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 400);
  };

  const columns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 120,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Dealer', key: 'dealer', width: 160,
      render: (_, r) => <div className="text-sm font-medium truncate max-w-[150px]">{r.dealerName || r.dealer?.businessName || '—'}</div> },
    { title: 'Delivery Address', dataIndex: 'deliveryAddress', width: 200,
      render: v => <span className="text-xs text-gray-500 line-clamp-2">{v || '—'}</span> },
    { title: 'Items', key: 'itemCount', width: 70,
      render: (_, r) => <span className="text-sm">{r.items?.length || 0}</span> },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="text-sm font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Priority', dataIndex: 'deliveryPriority', width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v || 'normal'}</Tag> },
    { title: 'Expected By', dataIndex: 'expectedDeliveryDate', width: 110,
      render: v => v ? <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> : <span className="text-gray-300">—</span> },
    { title: 'Actions', width: 120,
      render: (_, r) => (
        <Button size="small" icon={<PrinterOutlined />} onClick={() => generatePickingSlip(r)}>
          Picking Slip
        </Button>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-600" /> Picking List
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate picking lists from pending dispatch orders</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchOrders}>Refresh</Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={8}><Card size="small"><Statistic title="Pending Orders" value={stats.totalOrders} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Items to Pick" value={stats.itemsToPick} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Total Boxes" value={stats.totalBoxes} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search order or dealer..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-56" allowClear />
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" placeholder="From date" />
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" placeholder="To date" />
          <Select placeholder="Warehouse" allowClear value={warehouseFilter} onChange={v => setWarehouseFilter(v)} className="w-40"
            options={warehouses.map(w => ({ value: w._id, label: w.name || w.warehouseName }))} />
          <Select placeholder="Priority" allowClear value={priorityFilter} onChange={v => setPriorityFilter(v)} className="w-32"
            options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }, { value: 'vip', label: 'VIP' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setPriorityFilter(undefined); setDateFrom(''); setDateTo(''); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 1000 }}
          pagination={{ pageSize: 20, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }} />
      </div>
    </div>
  );
};

export default PickingList;
