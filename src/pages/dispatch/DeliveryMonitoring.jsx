import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Progress, Badge
} from 'antd';
import { ReloadOutlined, EyeOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { MapPin, Truck, Clock } from 'lucide-react';
import crmService from '../../services/crmService.js';

const STATUS_COLORS = {
  planned: 'blue', loaded: 'orange', in_transit: 'purple',
  partially_delivered: 'geekblue', completed: 'green', cancelled: 'red',
};

const DeliveryMonitoring = () => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('in_transit');
  const [viewDispatch, setViewDispatch] = useState(null);
  const [updateLoading, setUpdateLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        crmService.getDispatches({ limit: 50, search, status: statusFilter }),
        crmService.getDispatchStats(),
      ]);
      if (listRes.success) setDispatches(listRes.data || []);
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const markDelivered = async (id) => {
    setUpdateLoading(true);
    try {
      await crmService.updateDispatchStatus(id, { status: 'completed' });
      message.success('Marked as Delivered');
      load();
    } catch (err) { message.error(err.message); }
    finally { setUpdateLoading(false); }
  };

  const markPartial = async (id) => {
    try {
      await crmService.updateDispatchStatus(id, { status: 'partially_delivered' });
      message.success('Marked as Partially Delivered');
      load();
    } catch (err) { message.error(err.message); }
  };

  // Compute delivery progress for each dispatch
  const getProgress = (d) => {
    const total = d.totalOrders || 0;
    const done = d.orders?.filter(o => o.deliveryStatus === 'delivered').length || 0;
    return total ? Math.round((done / total) * 100) : 0;
  };

  const columns = [
    { title: 'Dispatch No.', dataIndex: 'dispatchNumber', width: 130, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Driver / Vehicle', key: 'drv',
      render: (_, r) => (
        <div>
          <div className="font-medium flex items-center gap-1">
            <Truck size={13} className="text-gray-400" /> {r.driverName || '—'}
          </div>
          <div className="text-xs text-gray-400">{r.vehicle || 'No vehicle'} · {r.driverPhone || ''}</div>
        </div>
      ),
    },
    { title: 'Orders', dataIndex: 'totalOrders', width: 80, render: v => <Tag color="blue">{v || 0}</Tag> },
    {
      title: 'Delivery Progress', key: 'prog', width: 160,
      render: (_, r) => {
        const pct = getProgress(r);
        return <Progress percent={pct} size="small" status={pct === 100 ? 'success' : 'active'} />;
      },
    },
    {
      title: 'Status', dataIndex: 'status', width: 130,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Departed', dataIndex: 'departureTime', width: 110,
      render: v => v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—',
    },
    {
      title: 'Actions', width: 220,
      render: (_, r) => (
        <Space size="small">
          {['in_transit', 'partially_delivered'].includes(r.status) && (
            <>
              <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                loading={updateLoading}
                onClick={() => markDelivered(r._id)}>
                Delivered
              </Button>
              {r.status === 'in_transit' && (
                <Button size="small" onClick={() => markPartial(r._id)}>Partial</Button>
              )}
            </>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewDispatch(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery Monitoring</h1>
          <p className="text-sm text-gray-500 mt-0.5">Real-time status of active deliveries</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['In Transit', stats.inTransit || 0, '#722ed1'],
          ['Pending Orders', stats.pendingOrders || 0, '#fa8c16'],
          ['Completed Today', stats.completed || 0, '#52c41a'],
          ['Cancelled', stats.cancelled || 0, '#f5222d'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by dispatch no. or driver…"
            prefix={<MapPin size={14} className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onChange={setStatusFilter} className="w-52"
            options={[
              { value: undefined, label: 'All Active' },
              ...Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
            ]} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={dispatches} rowKey="_id"
          loading={loading} size="small"
          pagination={{ pageSize: 20 }}
          rowClassName={r => r.status === 'in_transit' ? 'bg-purple-50' : ''}
          locale={{ emptyText: 'No active deliveries.' }}
        />
      </div>

      {/* View Modal */}
      <Modal
        title={<span className="font-bold">{viewDispatch?.dispatchNumber}</span>}
        open={!!viewDispatch} onCancel={() => setViewDispatch(null)}
        footer={[<Button key="c" onClick={() => setViewDispatch(null)}>Close</Button>]} width={540}
      >
        {viewDispatch && (
          <div className="space-y-2 text-sm">
            {[
              ['Status', <Tag color={STATUS_COLORS[viewDispatch.status]} className="capitalize">{viewDispatch.status?.replace(/_/g, ' ')}</Tag>],
              ['Driver', viewDispatch.driverName || '—'],
              ['Vehicle', viewDispatch.vehicle || '—'],
              ['Phone', viewDispatch.driverPhone || '—'],
              ['Orders', viewDispatch.totalOrders],
              ['Progress', `${getProgress(viewDispatch)}%`],
              ['Departed', viewDispatch.departureTime ? new Date(viewDispatch.departureTime).toLocaleString('en-IN') : '—'],
              ['Route', viewDispatch.route?.name || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 items-start"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
            {viewDispatch.orders?.length > 0 && (
              <>
                <Divider className="my-2" />
                <div className="font-semibold text-gray-600 mb-2">Order Details</div>
                {viewDispatch.orders.map((o, i) => (
                  <div key={i} className="bg-gray-50 p-2 rounded text-xs flex justify-between">
                    <span>{o.orderNumber || o.salesOrder}</span>
                    <Tag color={o.deliveryStatus === 'delivered' ? 'green' : 'orange'} className="text-xs">{o.deliveryStatus || 'pending'}</Tag>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryMonitoring;
