import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Checkbox, Divider, Descriptions, Timeline
} from 'antd';
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined, CarOutlined, UserOutlined, EyeOutlined } from '@ant-design/icons';
import crmService from '../../services/crmService.js';
import api from '../../config/api.js';
import getImageUrl from '../../utils/imageUrl.js';

const LoadingVerification = () => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [verifyModal, setVerifyModal] = useState(null);
  const [checkedOrders, setCheckedOrders] = useState([]);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [viewDetail, setViewDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [stats, setStats] = useState({ awaitingLoading: 0, verifiedToday: 0 });

  const fetchDispatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await crmService.getDispatches({ status: 'planned', limit: 100 });
      if (res.success) {
        let data = res.data || [];
        if (search) data = data.filter(d =>
          (d.dispatchNumber || '').toLowerCase().includes(search.toLowerCase()) ||
          (d.vehicle || '').toLowerCase().includes(search.toLowerCase()) ||
          (d.driverName || '').toLowerCase().includes(search.toLowerCase())
        );
        setDispatches(data);
        setStats(s => ({ ...s, awaitingLoading: data.length }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [search]);

  useEffect(() => { fetchDispatches(); }, [fetchDispatches]);

  const openVerifyModal = (dispatch) => {
    setVerifyModal(dispatch);
    setCheckedOrders((dispatch.orders || []).map(o => o._id || o));
  };

  const handleConfirmLoading = async () => {
    if (!verifyModal) return;
    setVerifyLoading(true);
    try {
      const res = await crmService.updateDispatchStatus(verifyModal._id, { status: 'loaded' });
      if (res.success) {
        message.success(`Dispatch ${verifyModal.dispatchNumber} marked as Loaded`);
        setVerifyModal(null);
        setCheckedOrders([]);
        setStats(s => ({ ...s, verifiedToday: s.verifiedToday + 1 }));
        fetchDispatches();
      }
    } catch (err) { message.error(err.message); }
    finally { setVerifyLoading(false); }
  };

  const toggleOrder = (id) => {
    setCheckedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleViewDetail = async (dispatch) => {
    setDetailLoading(true);
    try {
      // Try to fetch trip detail from dispatch-trips API (has more info)
      const res = await api.get(`/dispatch-trips/${dispatch._id}`);
      if (res.success) {
        setViewDetail(res.data);
      } else {
        // Fallback to dispatch data
        setViewDetail(dispatch);
      }
    } catch {
      // Fallback to dispatch data directly
      setViewDetail(dispatch);
    }
    finally { setDetailLoading(false); }
  };

  const columns = [
    { title: 'Dispatch #', dataIndex: 'dispatchNumber', width: 130,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'dispatchDate', width: 100,
      render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '—'}</span> },
    { title: 'Vehicle', dataIndex: 'vehicle', width: 120 },
    { title: 'Driver', dataIndex: 'driverName', width: 130 },
    { title: 'Orders', dataIndex: 'totalOrders', width: 70,
      render: v => <span className="text-sm">{v || 0}</span> },
    { title: 'Status', dataIndex: 'status', width: 100,
      render: () => <Tag color="blue">Planned</Tag> },
    { title: 'Actions', width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(r)}>
            View Detail
          </Button>
          <Button type="primary" size="small" icon={<CheckCircleOutlined />}
            onClick={() => openVerifyModal(r)}>
            Verify
          </Button>
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <UserOutlined className="text-green-600 text-xl" /> Loading Verification
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Verify goods loaded match dispatch plan</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchDispatches}>Refresh</Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card size="small" className="border-orange-100">
            <Statistic title="Awaiting Loading" value={stats.awaitingLoading}
              valueStyle={{ color: '#fa8c16' }} prefix={<CarOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" className="border-green-100">
            <Statistic title="Verified Today" value={stats.verifiedToday}
              valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3">
          <Input placeholder="Search dispatch number, vehicle, driver..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-72" allowClear />
          <Button icon={<ReloadOutlined />} onClick={() => setSearch('')}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={dispatches} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 900 }}
          pagination={{ pageSize: 20, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          locale={{ emptyText: 'No dispatches awaiting loading verification' }} />
      </div>

      {/* Verification Modal */}
      {verifyModal && (
        <Modal title={`Verify Loading — ${verifyModal.dispatchNumber}`} open
          onCancel={() => setVerifyModal(null)}
          onOk={handleConfirmLoading} confirmLoading={verifyLoading}
          okText="Confirm Loading" okButtonProps={{ icon: <CheckCircleOutlined /> }}
          width={560}>
          <div className="mt-3 space-y-3 text-sm">
            <div className="bg-gray-50 rounded p-3 border text-sm grid grid-cols-2 gap-2">
              <div><span className="text-gray-400">Vehicle:</span> <strong>{verifyModal.vehicle}</strong></div>
              <div><span className="text-gray-400">Driver:</span> <strong>{verifyModal.driverName}</strong></div>
              <div><span className="text-gray-400">Phone:</span> {verifyModal.driverPhone || '—'}</div>
              <div><span className="text-gray-400">Orders:</span> {verifyModal.totalOrders || 0}</div>
            </div>
            <Divider className="my-2">Orders — Check each as loaded</Divider>
            {(verifyModal.orders?.length > 0) ? verifyModal.orders.map((o, i) => {
              const id = o._id || o;
              return (
                <div key={id || i}
                  className={`flex items-center gap-3 px-3 py-2 rounded border cursor-pointer transition-colors ${checkedOrders.includes(id) ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}
                  onClick={() => toggleOrder(id)}>
                  <Checkbox checked={checkedOrders.includes(id)} onChange={() => toggleOrder(id)} />
                  <div className="flex-1">
                    <span className="font-medium text-sm">{o.orderNumber || `Order ${i + 1}`}</span>
                    {o.dealerName && <span className="text-xs text-gray-400 ml-2">{o.dealerName}</span>}
                  </div>
                  {checkedOrders.includes(id) && (
                    <span className="text-xs text-green-600 font-medium">Loaded ✓</span>
                  )}
                </div>
              );
            }) : (
              <div className="text-center text-gray-400 py-4">No orders linked to this dispatch</div>
            )}
            <div className="bg-blue-50 rounded p-2 text-xs text-blue-700 mt-2">
              Confirming will mark this dispatch as <strong>Loaded</strong> and ready for transit.
            </div>
          </div>
        </Modal>
      )}
      {/* View Detail Modal */}
      {viewDetail && (
        <Modal title={`Dispatch Detail — ${viewDetail.dispatchNumber || viewDetail.tripNumber || ''}`}
          open onCancel={() => setViewDetail(null)} width={850}
          footer={<Button onClick={() => setViewDetail(null)}>Close</Button>}>
          <div className="space-y-4 mt-3">
            {/* Trip/Dispatch Info */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded border">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Vehicle</div>
                <div className="font-bold text-sm mt-1">{viewDetail.vehicleNumber || viewDetail.vehicle || '—'}</div>
                <div className="text-xs text-gray-500">{viewDetail.vehicleType || ''}</div>
              </div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Driver</div>
                <div className="font-bold text-sm mt-1">{viewDetail.driverName || '—'}</div>
                <div className="text-xs text-gray-500">{viewDetail.driverPhone || ''}</div>
              </div>
              <div className="bg-green-50 p-3 rounded border border-green-100">
                <div className="text-[10px] text-gray-400 uppercase font-semibold">Summary</div>
                <div className="font-bold text-sm mt-1">{viewDetail.totalOrders || viewDetail.orders?.length || 0} Orders</div>
                <div className="text-xs text-gray-500">{viewDetail.totalBoxes || 0} Total Boxes · {viewDetail.totalWeight || 0} kg</div>
              </div>
            </div>

            {/* Route & Status */}
            <div className="flex items-center gap-3 text-xs">
              {viewDetail.routeName && <Tag color="blue">Route: {viewDetail.routeName}</Tag>}
              <Tag color={viewDetail.status === 'loaded' ? 'green' : viewDetail.status === 'dispatched' ? 'geekblue' : 'orange'}>
                {viewDetail.status || 'Planned'}
              </Tag>
              {viewDetail.loadingVerified && <Tag color="green">Loading Verified ✓</Tag>}
              {viewDetail.dispatchTime && <span className="text-gray-400">Dispatched: {new Date(viewDetail.dispatchTime).toLocaleString('en-IN')}</span>}
            </div>

            {/* Orders with Products */}
            <div className="font-semibold text-gray-700">Orders ({viewDetail.orders?.length || 0})</div>
            <div className="max-h-96 overflow-y-auto space-y-3">
              {(viewDetail.orders || []).map((order, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <span className="font-mono text-sm font-medium text-blue-600">{order.orderNumber || `Order ${idx + 1}`}</span>
                      <span className="text-xs text-gray-500 ml-2">{order.dealerName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs">{order.totalBoxes || 0} boxes</span>
                      {order.loadingVerified ? (
                        <Tag color="green" className="text-[9px]">Verified ✓</Tag>
                      ) : (
                        <Tag color="orange" className="text-[9px]">Pending</Tag>
                      )}
                    </div>
                  </div>
                  {order.deliveryAddress && (
                    <div className="text-[10px] text-gray-400 mb-2">📍 {order.deliveryAddress}</div>
                  )}
                  {/* If we have item-level details from SO population */}
                  {order.salesOrder?.items && (
                    <table className="w-full text-[10px] border border-gray-100 rounded">
                      <thead className="bg-gray-50">
                        <tr>{['Product', 'Shade', 'Qty', 'Boxes'].map(h => <th key={h} className="px-2 py-1 text-left">{h}</th>)}</tr>
                      </thead>
                      <tbody>
                        {order.salesOrder.items.map((item, i) => (
                          <tr key={i} className="border-t border-gray-50">
                            <td className="px-2 py-1">
                              <div className="flex items-center gap-1">
                                {(item.productImage || item.product?.images?.[0]) && (
                                  <img src={getImageUrl(item.productImage || item.product?.images?.[0])} className="w-5 h-5 rounded object-cover border" />
                                )}
                                <span>{item.productName || item.product?.itemName || '—'}</span>
                              </div>
                            </td>
                            <td className="px-2 py-1">{item.shade || '—'}</td>
                            <td className="px-2 py-1 font-medium">{item.quantity} {item.unit || 'Box'}</td>
                            <td className="px-2 py-1">{item.quantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {order.loadingRemarks && (
                    <div className="text-[10px] text-gray-500 mt-1 italic">Remarks: {order.loadingRemarks}</div>
                  )}
                </div>
              ))}
              {(!viewDetail.orders || viewDetail.orders.length === 0) && (
                <div className="text-center text-gray-400 py-6">No orders in this dispatch</div>
              )}
            </div>

            {/* Loading timeline */}
            {(viewDetail.loadingStartTime || viewDetail.loadingEndTime) && (
              <div className="bg-gray-50 rounded-lg p-3 border">
                <div className="text-xs font-semibold text-gray-600 mb-2">Loading Timeline</div>
                <Timeline items={[
                  viewDetail.loadingStartTime && { color: 'blue', children: `Loading Started: ${new Date(viewDetail.loadingStartTime).toLocaleString('en-IN')}` },
                  viewDetail.loadingEndTime && { color: 'green', children: `Loading Completed: ${new Date(viewDetail.loadingEndTime).toLocaleString('en-IN')}` },
                  viewDetail.dispatchTime && { color: 'purple', children: `Dispatched: ${new Date(viewDetail.dispatchTime).toLocaleString('en-IN')}` },
                ].filter(Boolean)} />
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default LoadingVerification;
