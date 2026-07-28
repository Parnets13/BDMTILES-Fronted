import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Checkbox
} from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Truck, Package, CheckCircle, Clock } from 'lucide-react';
import crmService from '../../services/crmService.js';

const STATUS_COLORS = {
  planned: 'blue', loaded: 'orange', in_transit: 'purple',
  partially_delivered: 'geekblue', completed: 'green', cancelled: 'red',
};

const DispatchPlanning = () => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [pendingOrders, setPendingOrders] = useState([]);
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [form, setForm] = useState({
    vehicle: '', driverName: '', driverPhone: '', departureTime: '', remarks: '',
  });

  const [viewDispatch, setViewDispatch] = useState(null);
  const [statusUpdateLoading, setStatusUpdateLoading] = useState(false);

  useEffect(() => {
    crmService.getDispatchStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  }, []);

  const fetchDispatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmService.getDispatches({
        page: pagination.current, limit: pagination.pageSize,
        search, status: statusFilter,
      });
      if (res.success) {
        setDispatches(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

  const openCreateModal = async () => {
    try {
      const res = await crmService.getPendingOrders();
      if (res.success) setPendingOrders(res.data || []);
    } catch { setPendingOrders([]); }
    setSelectedOrders([]);
    setForm({ vehicle: '', driverName: '', driverPhone: '', departureTime: '', remarks: '' });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!form.vehicle) { message.error('Enter vehicle number'); return; }
    if (!form.driverName) { message.error('Enter driver name'); return; }
    if (selectedOrders.length === 0) { message.error('Select at least one order'); return; }
    setCreateLoading(true);
    try {
      const res = await crmService.createDispatch({ ...form, orders: selectedOrders });
      if (res.success) {
        message.success('Dispatch plan created');
        setShowCreate(false);
        fetchDispatches();
        crmService.getDispatchStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleStatusUpdate = async (id, status) => {
    setStatusUpdateLoading(true);
    try {
      const res = await crmService.updateDispatchStatus(id, { status });
      if (res.success) {
        message.success(`Status updated to ${status}`);
        setViewDispatch(prev => prev ? { ...prev, status } : null);
        fetchDispatches();
      }
    } catch (err) { message.error(err.message); }
    finally { setStatusUpdateLoading(false); }
  };

  const toggleOrder = (id) => {
    setSelectedOrders(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const columns = [
    { title: 'Dispatch #', dataIndex: 'dispatchNumber', width: 120,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'dispatchDate', width: 100,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Vehicle', dataIndex: 'vehicle', width: 110 },
    { title: 'Driver', dataIndex: 'driverName', width: 130 },
    { title: 'Route', dataIndex: 'routeName', width: 120, render: v => v || '—' },
    { title: 'Orders', dataIndex: 'totalOrders', width: 70, render: v => <span className="text-sm">{v || 0}</span> },
    { title: 'Status', dataIndex: 'status', width: 130,
      render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 80,
      render: (_, r) => (
        <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500"
          onClick={async () => {
            try {
              const res = await crmService.getDispatch(r._id);
              if (res.success) setViewDispatch(res.data);
            } catch { setViewDispatch(r); }
          }} />
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Truck size={24} className="text-blue-600" /> Dispatch Planning
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan and manage delivery dispatches</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={openCreateModal}>
          Create Dispatch Plan
        </Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Planned" value={stats.planned || 0} valueStyle={{ color: '#096dd9' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="In Transit" value={stats.inTransit || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Completed" value={stats.completed || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Pending Orders" value={stats.pendingOrders || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search dispatch number, vehicle..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear />
          <Select placeholder="Filter Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-40"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={dispatches} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 900 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Dispatch Modal */}
      <Modal title="Create Dispatch Plan" open={showCreate}
        onCancel={() => setShowCreate(false)} onOk={handleCreate}
        confirmLoading={createLoading} okText="Create Dispatch" width={720} destroyOnClose>
        <div className="space-y-3 mt-4">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Vehicle No. *</label>
              <Input value={form.vehicle} onChange={e => setForm(f => ({ ...f, vehicle: e.target.value }))} placeholder="e.g. GJ01AB1234" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Driver Name *</label>
              <Input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} placeholder="Driver full name" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Driver Phone</label>
              <Input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} placeholder="10-digit mobile" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Departure Time</label>
              <Input type="datetime-local" value={form.departureTime} onChange={e => setForm(f => ({ ...f, departureTime: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Remarks</label>
              <Input.TextArea rows={1} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
          </div>
          <Divider className="my-2">Select Orders ({selectedOrders.length} selected)</Divider>
          <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
            {pendingOrders.length === 0 ? (
              <div className="p-4 text-center text-gray-400 text-sm">No pending orders available</div>
            ) : pendingOrders.map(order => (
              <div key={order._id}
                className={`flex items-center gap-3 px-3 py-2 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${selectedOrders.includes(order._id) ? 'bg-blue-50' : ''}`}
                onClick={() => toggleOrder(order._id)}>
                <Checkbox checked={selectedOrders.includes(order._id)} onChange={() => toggleOrder(order._id)} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{order.orderNumber} — {order.dealerName || order.dealer?.businessName}</div>
                  <div className="text-xs text-gray-400 truncate">{order.deliveryAddress || 'No address'}</div>
                </div>
                <span className="text-sm font-semibold text-green-700 shrink-0">₹{(order.grandTotal || 0).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* View Dispatch Modal */}
      {viewDispatch && (
        <Modal title={`Dispatch: ${viewDispatch.dispatchNumber}`} open
          onCancel={() => setViewDispatch(null)}
          footer={<Button onClick={() => setViewDispatch(null)}>Close</Button>}
          width={640}>
          <div className="space-y-2 mt-3 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              {[['Vehicle', viewDispatch.vehicle],['Driver', viewDispatch.driverName],
                ['Driver Phone', viewDispatch.driverPhone || '—'],['Route', viewDispatch.routeName || '—'],
                ['Total Orders', viewDispatch.totalOrders || 0],
                ['Date', new Date(viewDispatch.dispatchDate || Date.now()).toLocaleDateString('en-IN')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                  <span className="text-gray-400">{k}</span><span className="font-medium">{v}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 py-1">
              <span className="text-gray-400">Status:</span>
              <Tag color={STATUS_COLORS[viewDispatch.status]}>{viewDispatch.status?.replace(/_/g, ' ')}</Tag>
            </div>
            {viewDispatch.remarks && <div className="text-xs text-gray-400">Remarks: {viewDispatch.remarks}</div>}
            {(viewDispatch.orders?.length > 0) && (
              <>
                <Divider className="my-2">Orders in this dispatch</Divider>
                {viewDispatch.orders.map((o, i) => (
                  <div key={o._id || i} className="bg-gray-50 rounded px-3 py-2 text-xs flex justify-between">
                    <span className="font-medium">{o.orderNumber || o}</span>
                    <span className="text-gray-500">{o.dealerName || ''}</span>
                    <span className="font-semibold text-green-700">{o.grandTotal ? `₹${o.grandTotal.toLocaleString()}` : ''}</span>
                  </div>
                ))}
              </>
            )}
            <Divider className="my-2">Update Status</Divider>
            <div className="flex gap-2 flex-wrap">
              {viewDispatch.status === 'planned' && (
                <Button size="small" type="primary" loading={statusUpdateLoading}
                  onClick={() => handleStatusUpdate(viewDispatch._id, 'loaded')}>Mark Loaded</Button>
              )}
              {viewDispatch.status === 'loaded' && (
                <Button size="small" type="primary" loading={statusUpdateLoading}
                  onClick={() => handleStatusUpdate(viewDispatch._id, 'in_transit')}>Mark In Transit</Button>
              )}
              {viewDispatch.status === 'in_transit' && (
                <Button size="small" type="primary" style={{ background: '#52c41a' }} loading={statusUpdateLoading}
                  onClick={() => handleStatusUpdate(viewDispatch._id, 'completed')}>Mark Completed</Button>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DispatchPlanning;
