import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Checkbox, Divider
} from 'antd';
import { SearchOutlined, ReloadOutlined, CheckCircleOutlined, CarOutlined, UserOutlined } from '@ant-design/icons';
import crmService from '../../services/crmService.js';

const LoadingVerification = () => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [verifyModal, setVerifyModal] = useState(null);
  const [checkedOrders, setCheckedOrders] = useState([]);
  const [verifyLoading, setVerifyLoading] = useState(false);

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
    { title: 'Actions', width: 160,
      render: (_, r) => (
        <Button type="primary" size="small" icon={<CheckCircleOutlined />}
          onClick={() => openVerifyModal(r)}>
          Verify & Mark Loaded
        </Button>
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
    </div>
  );
};

export default LoadingVerification;
