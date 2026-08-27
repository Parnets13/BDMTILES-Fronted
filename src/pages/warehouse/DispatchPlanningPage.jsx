import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip, Pagination } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CarOutlined, CheckCircleOutlined, CloseCircleOutlined, RocketOutlined, TruckOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const STATUS_COLORS = {
  planning: 'default', loading: 'orange', loaded: 'blue', dispatched: 'geekblue',
  in_transit: 'cyan', completed: 'green', cancelled: 'red',
};

const DispatchPlanningPage = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => { api.get('/dispatch-trips/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dispatch-trips', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setTrips(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const handleAction = async (id, action, body = {}) => {
    try {
      const res = await api.patch(`/dispatch-trips/${id}/${action}`, body);
      if (res?.success) { message.success(res.message); fetchTrips(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Trip #', dataIndex: 'tripNumber', width: 100, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'tripDate', width: 90, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Vehicle', dataIndex: 'vehicleNumber', width: 110, render: v => <span className="text-xs font-medium">{v || '—'}</span> },
    { title: 'Driver', dataIndex: 'driverName', width: 120 },
    { title: 'Route', dataIndex: 'routeName', width: 120 },
    { title: 'Orders', dataIndex: 'totalOrders', width: 60 },
    { title: 'Boxes', dataIndex: 'totalBoxes', width: 60 },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLORS[s]}>{s.replace('_', ' ')}</Tag> },
    { title: 'Actions', width: 140, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewRecord(r)} /></Tooltip>
        {r.status === 'planning' && <Tooltip title="Start Loading"><Button type="text" size="small" icon={<TruckOutlined />} className="text-orange-500" onClick={() => handleAction(r._id, 'start-loading')} /></Tooltip>}
        {r.status === 'loading' && <Tooltip title="Complete verification in Loading Verification"><Tag color="orange">Awaiting verification</Tag></Tooltip>}
        {r.status === 'loaded' && <Tooltip title="Dispatch verified trip"><Button type="text" size="small" icon={<RocketOutlined />} className="text-indigo-600" onClick={() => handleAction(r._id, 'dispatch')} /></Tooltip>}
        {['planning', 'loading', 'loaded'].includes(r.status) && <Tooltip title="Cancel before dispatch"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleAction(r._id, 'cancel')} /></Tooltip>}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dispatch Planning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create trips, assign vehicles, verify loading, dispatch orders</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>Create Trip</Button>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<CarOutlined />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Planning" value={stats.planning || 0} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Loading" value={stats.loading || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Dispatched" value={stats.dispatched || 0} valueStyle={{ color: '#2f54eb' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="In Transit" value={stats.inTransit || 0} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Completed" value={stats.completed || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search trip #, vehicle, driver..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace('_', ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={trips} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      <CreateTripModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { fetchTrips(); loadStats(); }} />

      {viewRecord && (
        <Modal open title={`Trip ${viewRecord.tripNumber}`} onCancel={() => setViewRecord(null)} width={750} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="space-y-3 text-sm mt-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase font-semibold">Vehicle</div><div className="font-bold">{viewRecord.vehicleNumber || '—'}</div><div className="text-xs text-gray-500">{viewRecord.vehicleType}</div></div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="text-[10px] text-gray-400 uppercase font-semibold">Driver</div><div className="font-bold">{viewRecord.driverName || '—'}</div><div className="text-xs text-gray-500">{viewRecord.driverPhone}</div></div>
              <div className="bg-green-50 p-3 rounded border border-green-100"><div className="text-[10px] text-gray-400 uppercase font-semibold">Summary</div><div className="font-bold">{viewRecord.totalOrders} orders · {viewRecord.totalBoxes} boxes</div><Tag color={STATUS_COLORS[viewRecord.status]}>{viewRecord.status.replace('_', ' ')}</Tag></div>
            </div>
            <div className="font-semibold text-gray-700">Orders in Trip ({viewRecord.orders?.length || 0})</div>
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-gray-50"><tr>{['#','Order','Dealer','Address','Boxes','Loaded','Verified','Delivery'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
              <tbody>{viewRecord.orders?.map((o, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-400">{o.sequence || i+1}</td>
                  <td className="px-2 py-1.5 font-mono font-medium">{o.orderNumber}</td>
                  <td className="px-2 py-1.5">{o.dealerName}</td>
                  <td className="px-2 py-1.5 text-[10px] max-w-[120px] truncate">{o.deliveryAddress || '—'}</td>
                  <td className="px-2 py-1.5">{o.totalBoxes || 0}</td>
                  <td className="px-2 py-1.5">{o.loadedBoxes || 0}</td>
                  <td className="px-2 py-1.5">{o.loadingVerified ? <Tag color="green" className="text-[9px]">Yes</Tag> : <Tag className="text-[9px]">No</Tag>}</td>
                  <td className="px-2 py-1.5"><Tag color={o.deliveryStatus === 'delivered' ? 'green' : o.deliveryStatus === 'failed' ? 'red' : 'default'} className="text-[9px]">{o.deliveryStatus}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// CREATE TRIP MODAL
// ═══════════════════════════════════════════════
const CreateTripModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [readyOrders, setReadyOrders] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [form, setForm] = useState({ vehicleNumber: '', vehicleType: '', driverName: '', driverPhone: '', routeName: '', remarks: '' });
  const [selectedOrders, setSelectedOrders] = useState([]);
  const [readySearch, setReadySearch] = useState('');
  const [readyPagination, setReadyPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  useEffect(() => {
    if (!open) return;
    api.get('/dispatch-trips/ready-orders', {
      params: { page: readyPagination.current, limit: readyPagination.pageSize, search: readySearch },
    }).then(r => {
      if (r.success) {
        setReadyOrders(r.data || []);
        setReadyPagination(current => ({ ...current, total: r.pagination?.totalItems || 0 }));
      }
    }).catch(() => {});
  }, [open, readyPagination.current, readyPagination.pageSize, readySearch]);

  useEffect(() => {
    if (open) api.get('/masters/vehicles', { params: { limit: 50 } }).then(r => { if (r.success) setVehicles(r.data || []); }).catch(() => {});
  }, [open]);

  const handleSubmit = async () => {
    if (selectedOrders.length === 0) { message.error('Select at least one order for the trip'); return; }
    if (!form.vehicleNumber) { message.error('Enter vehicle number'); return; }

    setLoading(true);
    try {
      const res = await api.post('/dispatch-trips', {
        ...form,
        pickListIds: selectedOrders.map(pickList => pickList._id),
      });
      if (res.success) { message.success(res.message); onSuccess?.(); handleClose(); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClose = () => {
    setForm({ vehicleNumber: '', vehicleType: '', driverName: '', driverPhone: '', routeName: '', remarks: '' });
    setSelectedOrders([]);
    setReadySearch('');
    setReadyPagination({ current: 1, pageSize: 10, total: 0 });
    onClose();
  };

  const toggleOrder = (order) => {
    setSelectedOrders(prev => prev.find(o => o._id === order._id) ? prev.filter(o => o._id !== order._id) : [...prev, order]);
  };

  return (
    <Modal title="Create Dispatch Trip" open={open} onCancel={handleClose} width={850} footer={null} destroyOnHidden>
      <div className="space-y-4 mt-4">
        {/* Vehicle & Driver */}
        <div className="grid grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vehicle # *</label>
            <Input value={form.vehicleNumber} onChange={e => setForm(f => ({ ...f, vehicleNumber: e.target.value }))} placeholder="MH-12-AB-1234" size="large" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vehicle Type</label>
            <Select value={form.vehicleType || undefined} onChange={v => setForm(f => ({ ...f, vehicleType: v }))} className="w-full" size="large" placeholder="Type" allowClear
              options={[{ value: 'Mini Truck', label: 'Mini Truck' }, { value: 'Tata Ace', label: 'Tata Ace' }, { value: 'Bolero', label: 'Bolero' }, { value: '14ft', label: '14ft Truck' }, { value: '17ft', label: '17ft Truck' }, { value: '22ft', label: '22ft Container' }]} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Driver Name</label>
            <Input value={form.driverName} onChange={e => setForm(f => ({ ...f, driverName: e.target.value }))} placeholder="Driver" size="large" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Driver Phone</label>
            <Input value={form.driverPhone} onChange={e => setForm(f => ({ ...f, driverPhone: e.target.value }))} placeholder="Phone" size="large" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Route Name</label>
            <Input value={form.routeName} onChange={e => setForm(f => ({ ...f, routeName: e.target.value }))} placeholder="e.g. Hubli-Dharwad Route" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional" />
          </div>
        </div>

        {/* Ready Orders */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label className="text-sm font-semibold text-gray-700">Select Orders Ready for Dispatch ({readyPagination.total} available)</label>
            <Input.Search
              placeholder="Search pick list, order, dealer or route"
              value={readySearch}
              onChange={event => { setReadySearch(event.target.value); setReadyPagination(current => ({ ...current, current: 1 })); }}
              allowClear
              className="w-80"
            />
          </div>
          {readyOrders.length === 0 ? (
            <div className="text-center text-gray-400 py-6 bg-gray-50 rounded-lg border border-dashed">No orders ready for dispatch. Complete picking & sorting first.</div>
          ) : (
            <div className="border border-gray-200 rounded-lg max-h-60 overflow-y-auto">
              {readyOrders.map(order => {
                const selected = selectedOrders.some(o => o._id === order._id);
                return (
                  <div key={order._id} className={`px-4 py-3 border-b border-gray-100 cursor-pointer transition ${selected ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'hover:bg-gray-50'}`}
                    onClick={() => toggleOrder(order)}>
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm font-medium">{order.orderNumber} — {order.dealerName}</div>
                        <div className="text-[10px] text-gray-400">PL: {order.pickListNumber} · {order.deliveryAddress || 'No address'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs font-bold">{order.totalRequestedQty || order.totalBoxes || 0} boxes</div>
                        {selected && <Tag color="blue" className="text-[9px]">Selected</Tag>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {readyPagination.total > readyPagination.pageSize && (
            <div className="flex justify-end mt-3">
              <Pagination
                size="small"
                current={readyPagination.current}
                pageSize={readyPagination.pageSize}
                total={readyPagination.total}
                showSizeChanger
                pageSizeOptions={[10, 20, 50]}
                onChange={(page, pageSize) => setReadyPagination(current => ({ ...current, current: page, pageSize }))}
              />
            </div>
          )}
          {selectedOrders.length > 0 && (
            <div className="mt-2 text-xs text-blue-600 font-medium">{selectedOrders.length} orders selected · {selectedOrders.reduce((s, o) => s + (o.totalRequestedQty || o.totalBoxes || 0), 0)} total boxes</div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<CarOutlined />}>Create Trip</Button>
        </div>
      </div>
    </Modal>
  );
};

export default DispatchPlanningPage;
