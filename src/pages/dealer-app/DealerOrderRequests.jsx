import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, Divider } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { ShoppingBag } from 'lucide-react';
import salesService from '../../services/salesService.js';

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', approved: 'cyan', processing: 'orange',
  partial_dispatch: 'geekblue', dispatched: 'purple', delivered: 'green', cancelled: 'red',
};

const DealerOrderRequests = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('draft');
  const [stats, setStats] = useState({ total: 0, pending: 0, confirmed: 0, cancelled: 0 });
  const [viewOrder, setViewOrder] = useState(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesService.getOrders({
        page: pagination.current, limit: pagination.pageSize,
        search, status: statusFilter || undefined,
      });
      if (res.success) {
        setOrders(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    salesService.getStats().then(r => {
      if (r.success) setStats({
        total: r.data.total, pending: r.data.draft,
        confirmed: r.data.confirmed, cancelled: r.data.cancelled,
      });
    }).catch(() => {});
  }, []);

  const handleConfirm = async (id) => {
    try {
      const res = await salesService.updateStatus(id, { status: 'confirmed' });
      if (res.success) { message.success('Order confirmed'); fetchOrders(); }
    } catch (err) { message.error(err.message); }
  };

  const handleCancel = async (id) => {
    Modal.confirm({
      title: 'Cancel this order?', okType: 'danger', okText: 'Cancel Order',
      onOk: async () => {
        try {
          const res = await salesService.updateStatus(id, { status: 'cancelled', cancellationReason: 'Rejected by admin' });
          if (res.success) { message.success('Order cancelled'); fetchOrders(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const columns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 120, render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 100, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Dealer', key: 'dealer', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[170px]">{r.dealerName || r.dealer?.businessName || '—'}</div>
          <div className="text-xs text-gray-400">{r.dealerCode || r.dealer?.dealerCode}</div>
        </div>
      )},
    { title: 'Items', key: 'items', width: 60, render: (_, r) => r.items?.length || 0 },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110, render: v => <span className="font-semibold">₹{(v||0).toLocaleString()}</span> },
    { title: 'Type', dataIndex: 'orderType', width: 90, render: v => <Tag>{v}</Tag> },
    { title: 'Priority', dataIndex: 'deliveryPriority', width: 90,
      render: v => <Tag color={v==='urgent'?'red':v==='vip'?'gold':'default'}>{v||'normal'}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace(/_/g,' ')}</Tag> },
    { title: 'Actions', width: 110,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500" onClick={() => setViewOrder(r)} />
          {r.status === 'draft' && (
            <>
              <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleConfirm(r._id)} />
              <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500" onClick={() => handleCancel(r._id)} />
            </>
          )}
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingBag size={22} className="text-blue-600" /> Dealer Order Requests
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve orders from dealers and the Dealer App</p>
        </div>
      </div>

      <Row gutter={16} className="mb-4">
        {[['Total Orders', stats.total, '#1890ff'], ['Pending Review', stats.pending, '#fa8c16'],
          ['Confirmed', stats.confirmed, '#52c41a'], ['Cancelled', stats.cancelled, '#f5222d']
        ].map(([t,v,c]) => <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v||0} valueStyle={{color:c}} /></Card></Col>)}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search order #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }} className="w-64" allowClear />
          <Select placeholder="Status" allowClear value={statusFilter || undefined} onChange={v => setStatusFilter(v)} className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({value:s, label:s.replace(/_/g,' ')}))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter('draft'); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading} size="middle" scroll={{x:1000}}
          pagination={{...pagination, showSizeChanger:true, showTotal:(t,r)=>`${r[0]}-${r[1]} of ${t}`}}
          onChange={pag => setPagination(p => ({...p, current:pag.current, pageSize:pag.pageSize}))} />
      </div>

      {viewOrder && (
        <Modal title={`Order: ${viewOrder.orderNumber}`} open onCancel={() => setViewOrder(null)}
          footer={<Button onClick={() => setViewOrder(null)}>Close</Button>} width={580}>
          <div className="space-y-2 mt-4 text-sm">
            {[['Dealer', viewOrder.dealerName || '—'], ['Code', viewOrder.dealerCode || '—'],
              ['Date', new Date(viewOrder.orderDate).toLocaleDateString('en-IN')],
              ['Type', viewOrder.orderType], ['Priority', viewOrder.deliveryPriority || 'normal'],
              ['Items', viewOrder.items?.length || 0],
              ['Grand Total', `₹${(viewOrder.grandTotal||0).toLocaleString()}`],
              ['Status', viewOrder.status?.replace(/_/g,' ')],
            ].map(([k,v]) => (
              <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-400">{k}</span><span className="font-medium">{v}</span>
              </div>
            ))}
            {viewOrder.deliveryAddress && <div className="mt-2"><span className="text-gray-400">Delivery: </span>{viewOrder.deliveryAddress}</div>}
            {viewOrder.remarks && <div className="text-gray-400 text-xs mt-1">Remarks: {viewOrder.remarks}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DealerOrderRequests;
