import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, InputNumber, Tag, Space, message, Row, Col, Card, Statistic, Modal, Checkbox, Divider, Timeline } from 'antd';
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined, CarOutlined, UserOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const LoadingVerification = () => {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [verifyTrip, setVerifyTrip] = useState(null);
  const [verificationOrders, setVerificationOrders] = useState([]);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState(null);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchTrips = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/dispatch-trips', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          search,
          status: 'planning,loading,loaded',
        },
      });
      if (res.success) {
        setTrips(res.data || []);
        setPagination(current => ({ ...current, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchTrips(); }, [fetchTrips]);

  const startLoading = async trip => {
    try {
      const res = await api.patch(`/dispatch-trips/${trip._id}/start-loading`, {});
      if (res.success) { message.success(res.message); fetchTrips(); }
    } catch (err) { message.error(err.message); }
  };

  const openVerification = async trip => {
    try {
      const res = await api.get(`/dispatch-trips/${trip._id}`);
      if (!res.success) return;
      setVerifyTrip(res.data);
      setVerificationOrders((res.data.orders || []).map(order => ({
        _id: order._id,
        orderNumber: order.orderNumber,
        dealerName: order.dealerName,
        totalBoxes: order.totalBoxes,
        loadedBoxes: 0,
        loadingVerified: false,
        loadingRemarks: '',
      })));
    } catch (err) { message.error(err.message); }
  };

  const updateOrder = (index, field, value) => {
    setVerificationOrders(orders => orders.map((order, orderIndex) => orderIndex === index ? { ...order, [field]: value } : order));
  };

  const toggleAll = checked => {
    setVerificationOrders(orders => orders.map(order => ({
      ...order,
      loadingVerified: checked,
      loadedBoxes: checked ? order.totalBoxes : 0,
    })));
  };

  const handleConfirmLoading = async () => {
    const incomplete = verificationOrders.find(order => !order.loadingVerified || Number(order.loadedBoxes) !== Number(order.totalBoxes));
    if (incomplete) {
      message.error(`${incomplete.orderNumber}: verify all ${incomplete.totalBoxes} boxes before completing loading`);
      return;
    }
    setVerifyLoading(true);
    try {
      const res = await api.patch(`/dispatch-trips/${verifyTrip._id}/verify-loading`, {
        orders: verificationOrders.map(({ orderNumber, dealerName, totalBoxes, ...order }) => order),
      });
      if (res.success) {
        message.success(res.message);
        setVerifyTrip(null);
        setVerificationOrders([]);
        fetchTrips();
      }
    } catch (err) { message.error(err.message); }
    finally { setVerifyLoading(false); }
  };

  const handleViewDetail = async trip => {
    try {
      const res = await api.get(`/dispatch-trips/${trip._id}`);
      if (res.success) setViewDetail(res.data);
    } catch (err) { message.error(err.message); }
  };

  const awaiting = trips.filter(trip => ['planning', 'loading'].includes(trip.status)).length;
  const loaded = trips.filter(trip => trip.status === 'loaded').length;
  const allVerified = verificationOrders.length > 0 && verificationOrders.every(order => order.loadingVerified && Number(order.loadedBoxes) === Number(order.totalBoxes));

  const columns = [
    { title: 'Trip #', dataIndex: 'tripNumber', width: 120, render: value => <span className="font-mono text-xs text-blue-600 font-medium">{value}</span> },
    { title: 'Date', dataIndex: 'tripDate', width: 100, render: value => <span className="text-xs">{new Date(value).toLocaleDateString('en-IN')}</span> },
    { title: 'Vehicle', dataIndex: 'vehicleNumber', width: 130 },
    { title: 'Driver', dataIndex: 'driverName', width: 130 },
    { title: 'Orders', dataIndex: 'totalOrders', width: 70 },
    { title: 'Boxes', dataIndex: 'totalBoxes', width: 70 },
    { title: 'Status', dataIndex: 'status', width: 100, render: value => <Tag color={value === 'loaded' ? 'green' : value === 'loading' ? 'blue' : 'orange'}>{value}</Tag> },
    { title: 'Actions', width: 220, render: (_, trip) => (
      <Space size="small">
        <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(trip)}>View</Button>
        {trip.status === 'planning' && <Button size="small" type="primary" ghost icon={<PlayCircleOutlined />} onClick={() => startLoading(trip)}>Start</Button>}
        {trip.status === 'loading' && <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => openVerification(trip)}>Verify</Button>}
        {trip.status === 'loaded' && <Tag color="green" icon={<CheckCircleOutlined />}>Verified</Tag>}
      </Space>
    ) },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><UserOutlined className="text-green-600 text-xl" /> Loading Verification</h1><p className="text-sm text-gray-500 mt-0.5">Verify every planned order and physical box before dispatch is enabled</p></div>
        <Button icon={<ReloadOutlined />} onClick={fetchTrips}>Refresh</Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={8}><Card size="small"><Statistic title="Awaiting Verification" value={awaiting} valueStyle={{ color: '#fa8c16' }} prefix={<CarOutlined />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Loaded & Verified" value={loaded} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-3">
        <Input placeholder="Search trip, vehicle or driver..." prefix={<SearchOutlined className="text-gray-400" />} value={search} onChange={event => setSearch(event.target.value)} className="w-72" allowClear />
        <Button icon={<ReloadOutlined />} onClick={() => setSearch('')}>Reset</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={trips} rowKey="_id" loading={loading} size="middle" scroll={{ x: 900 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }}
          onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))}
          locale={{ emptyText: 'No dispatch trips awaiting loading verification' }} />
      </div>

      {verifyTrip && (
        <Modal title={`Verify Loading — ${verifyTrip.tripNumber}`} open onCancel={() => setVerifyTrip(null)} onOk={handleConfirmLoading} confirmLoading={verifyLoading} okText="Confirm all loaded" width={760}>
          <div className="mt-3 space-y-3 text-sm">
            <div className="bg-gray-50 rounded p-3 border grid grid-cols-4 gap-2"><div><span className="text-gray-400">Vehicle:</span><br /><strong>{verifyTrip.vehicleNumber}</strong></div><div><span className="text-gray-400">Driver:</span><br /><strong>{verifyTrip.driverName || '—'}</strong></div><div><span className="text-gray-400">Orders:</span><br /><strong>{verifyTrip.totalOrders}</strong></div><div><span className="text-gray-400">Boxes:</span><br /><strong>{verifyTrip.totalBoxes}</strong></div></div>
            <Divider className="my-2">Physical loading checks</Divider>
            <div className="flex justify-end"><Checkbox checked={allVerified} onChange={event => toggleAll(event.target.checked)}>Confirm every order at planned quantity</Checkbox></div>
            {verificationOrders.map((order, index) => (
              <div key={order._id} className={`grid grid-cols-[32px_1fr_120px_180px] gap-3 items-center p-3 rounded border ${order.loadingVerified ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
                <Checkbox checked={order.loadingVerified} onChange={event => { updateOrder(index, 'loadingVerified', event.target.checked); updateOrder(index, 'loadedBoxes', event.target.checked ? order.totalBoxes : 0); }} />
                <div><div className="font-medium">{order.orderNumber}</div><div className="text-xs text-gray-400">{order.dealerName} · Planned {order.totalBoxes} boxes</div></div>
                <InputNumber min={0} max={order.totalBoxes} value={order.loadedBoxes} onChange={value => updateOrder(index, 'loadedBoxes', value || 0)} addonAfter="boxes" />
                <Input value={order.loadingRemarks} onChange={event => updateOrder(index, 'loadingRemarks', event.target.value)} placeholder="Remarks (optional)" />
              </div>
            ))}
            <div className="bg-blue-50 rounded p-2 text-xs text-blue-700">The trip becomes dispatchable only when every order is checked and loaded boxes exactly match planned boxes.</div>
          </div>
        </Modal>
      )}

      {viewDetail && (
        <Modal title={`Trip Detail — ${viewDetail.tripNumber}`} open onCancel={() => setViewDetail(null)} width={850} footer={<Button onClick={() => setViewDetail(null)}>Close</Button>}>
          <div className="space-y-4 mt-3">
            <div className="grid grid-cols-3 gap-3"><div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Vehicle</div><div className="font-bold">{viewDetail.vehicleNumber || '—'}</div></div><div className="bg-blue-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Driver</div><div className="font-bold">{viewDetail.driverName || '—'}</div></div><div className="bg-green-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Summary</div><div className="font-bold">{viewDetail.totalOrders} orders · {viewDetail.totalBoxes} boxes</div></div></div>
            <table className="w-full text-xs border border-gray-200"><thead className="bg-gray-50"><tr>{['Order', 'Dealer', 'Pick List', 'Planned', 'Loaded', 'Verified'].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>{viewDetail.orders?.map(order => <tr key={order._id} className="border-t"><td className="p-2 font-mono">{order.orderNumber}</td><td className="p-2">{order.dealerName}</td><td className="p-2">{order.pickListNumber}</td><td className="p-2">{order.totalBoxes}</td><td className="p-2">{order.loadedBoxes || 0}</td><td className="p-2">{order.loadingVerified ? <Tag color="green">Yes</Tag> : <Tag>Pending</Tag>}</td></tr>)}</tbody></table>
            {(viewDetail.loadingStartTime || viewDetail.loadingEndTime) && <Timeline items={[viewDetail.loadingStartTime && { color: 'blue', children: `Started: ${new Date(viewDetail.loadingStartTime).toLocaleString('en-IN')}` }, viewDetail.loadingEndTime && { color: 'green', children: `Verified: ${new Date(viewDetail.loadingEndTime).toLocaleString('en-IN')}` }].filter(Boolean)} />}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LoadingVerification;
