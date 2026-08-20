import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip, Timeline } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, CarOutlined, CheckCircleOutlined, CloseCircleOutlined, EnvironmentOutlined, PhoneOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const STATUS_COLORS = {
  assigned: 'default', in_transit: 'blue', reached: 'cyan', delivered: 'green',
  partially_delivered: 'lime', failed: 'red', rescheduled: 'orange', returned: 'volcano',
};

const DeliveryTrackingPage = () => {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => { api.get('/deliveries/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/deliveries', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setDeliveries(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  const handleAction = async (id, action, body = {}) => {
    try {
      const res = await api.patch(`/deliveries/${id}/${action}`, body);
      if (res?.success) { message.success(res.message); fetchDeliveries(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Delivery #', dataIndex: 'deliveryNumber', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'deliveryDate', width: 85, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'SO #', dataIndex: 'orderNumber', width: 100, render: v => <span className="text-xs font-mono">{v || '—'}</span> },
    { title: 'Dealer', dataIndex: 'dealerName', width: 140, render: v => <span className="text-xs font-medium truncate block max-w-[130px]">{v}</span> },
    { title: 'Executive', key: 'exec', width: 110, render: (_, r) => <span className="text-xs">{r.deliveryExecutiveName || r.deliveryExecutive?.name || '—'}</span> },
    { title: 'Boxes', key: 'boxes', width: 80, render: (_, r) => <span className="text-xs">{r.deliveredBoxes || 0}/{r.totalBoxes}</span> },
    { title: 'OTP', dataIndex: 'otpVerified', width: 55, render: v => v ? <Tag color="green" className="text-[9px]">Yes</Tag> : <Tag className="text-[9px]">No</Tag> },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLORS[s]}>{s.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 130, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewRecord(r)} /></Tooltip>
        {r.status === 'assigned' && <Tooltip title="Start"><Button type="text" size="small" icon={<CarOutlined />} className="text-blue-500" onClick={() => handleAction(r._id, 'start')} /></Tooltip>}
        {r.status === 'in_transit' && <Tooltip title="Reached"><Button type="text" size="small" icon={<EnvironmentOutlined />} className="text-cyan-600" onClick={() => handleAction(r._id, 'reached')} /></Tooltip>}
        {['reached', 'in_transit'].includes(r.status) && <Tooltip title="Deliver"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleAction(r._id, 'complete')} /></Tooltip>}
        {['assigned', 'in_transit', 'reached'].includes(r.status) && <Tooltip title="Failed"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleAction(r._id, 'fail', { failureReason: 'customer_unavailable', failureRemarks: 'Customer not available' })} /></Tooltip>}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track deliveries, OTP verification, POD upload, handle failures</p>
        </div>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<CarOutlined />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Assigned" value={stats.assigned || 0} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="In Transit" value={stats.inTransit || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Delivered" value={stats.delivered || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Today" value={stats.todayDelivered || 0} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Failed" value={stats.failed || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Rescheduled" value={stats.rescheduled || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search delivery #, SO #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={deliveries} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* View Detail */}
      {viewRecord && (
        <Modal open title={`Delivery ${viewRecord.deliveryNumber}`} onCancel={() => setViewRecord(null)} width={700} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="space-y-4 text-sm mt-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Delivery To</div>
                <div className="font-bold text-base mt-1">{viewRecord.dealerName}</div>
                <div className="text-xs text-gray-500">{viewRecord.dealerCode} · {viewRecord.contactPhone}</div>
                <div className="text-xs text-gray-400 mt-1">{viewRecord.deliveryAddress}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Status</div>
                <Tag color={STATUS_COLORS[viewRecord.status]} className="mt-1">{viewRecord.status.replace(/_/g, ' ')}</Tag>
                <div className="mt-2 space-y-1 text-xs">
                  <div>OTP: <span className="font-mono font-bold">{viewRecord.otp}</span> {viewRecord.otpVerified && <Tag color="green" className="text-[9px]">Verified</Tag>}</div>
                  <div>Boxes: {viewRecord.deliveredBoxes || 0} / {viewRecord.totalBoxes}</div>
                  {viewRecord.paymentCollected && <div className="text-green-600">Collected: ₹{viewRecord.collectedAmount} ({viewRecord.paymentMode})</div>}
                </div>
              </div>
            </div>

            {/* Timeline */}
            <Timeline items={[
              { color: 'green', children: `Created: ${new Date(viewRecord.createdAt).toLocaleString('en-IN')}` },
              viewRecord.startTime && { color: 'blue', children: `Started: ${new Date(viewRecord.startTime).toLocaleString('en-IN')}` },
              viewRecord.reachTime && { color: 'cyan', children: `Reached: ${new Date(viewRecord.reachTime).toLocaleString('en-IN')}` },
              viewRecord.otpVerifiedAt && { color: 'purple', children: `OTP Verified: ${new Date(viewRecord.otpVerifiedAt).toLocaleString('en-IN')}` },
              viewRecord.completionTime && { color: viewRecord.status === 'delivered' ? 'green' : 'red', children: `${viewRecord.status === 'delivered' ? 'Delivered' : 'Completed'}: ${new Date(viewRecord.completionTime).toLocaleString('en-IN')}` },
            ].filter(Boolean)} />

            {viewRecord.failureReason && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-xs font-semibold text-red-700">Failure Reason: {viewRecord.failureReason.replace(/_/g, ' ')}</div>
                {viewRecord.failureRemarks && <div className="text-xs text-red-600 mt-1">{viewRecord.failureRemarks}</div>}
                {viewRecord.rescheduleDate && <div className="text-xs text-orange-600 mt-1">Rescheduled to: {new Date(viewRecord.rescheduleDate).toLocaleDateString('en-IN')}</div>}
              </div>
            )}

            {viewRecord.podImage && <div><div className="text-xs text-gray-500 mb-1">Proof of Delivery:</div><img src={viewRecord.podImage} className="w-48 h-32 object-cover rounded border" /></div>}
            {viewRecord.deliveryRemarks && <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">Remarks: {viewRecord.deliveryRemarks}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DeliveryTrackingPage;
