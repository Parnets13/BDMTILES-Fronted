import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Checkbox
} from 'antd';
import {
  PlusOutlined, SearchOutlined, SendOutlined, ReloadOutlined, EyeOutlined, CarOutlined, ShopOutlined
} from '@ant-design/icons';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = {
  planned: 'blue', loaded: 'orange', in_transit: 'purple',
  partially_delivered: 'geekblue', completed: 'green', cancelled: 'red',
};

const DeliveryAssignment = () => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [vehicles, setVehicles] = useState([]);

  const [showAssign, setShowAssign] = useState(null); // dispatch obj
  // vehicleRef is the Vehicle Master id the server validates; `vehicle` stays the
  // registration text so existing dispatch records keep displaying correctly.
  const [assignForm, setAssignForm] = useState({ vehicleRef: undefined, vehicle: '', driverName: '', driverPhone: '', departureTime: '' });
  const [assignLoading, setAssignLoading] = useState(false);

  const [viewDispatch, setViewDispatch] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        crmService.getDispatches({ page, limit: 20, search, status: statusFilter }),
        crmService.getDispatchStats(),
      ]);
      if (listRes.success) {
        setDispatches(listRes.data || []);
        const pg = listRes.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    masterService.getVehicles?.({ limit: 200, isActive: true }).then(r => { if (r?.success) setVehicles(r.data || []); }).catch(() => {});
  }, []);

  // Choosing a different vehicle replaces the previous vehicle's usual driver
  // and account context instead of accidentally retaining stale details.
  const chooseVehicle = (vehicleId) => {
    const picked = vehicles.find(v => String(v._id) === String(vehicleId));
    setAssignForm(f => ({
      ...f,
      vehicleRef: vehicleId,
      vehicle: picked?.vehicleNumber || '',
      driverName: picked?.driverName || '',
      driverPhone: picked?.driverPhone || '',
    }));
  };

  const selectedVehicle = vehicles.find(vehicle => String(vehicle._id) === String(assignForm.vehicleRef));
  const selectedExecutive = selectedVehicle?.deliveryExecutive;

  const handleAssign = async () => {
    if (!assignForm.vehicleRef) { message.error('Select a vehicle from Vehicle Master'); return; }
    if (!assignForm.driverName.trim()) { message.error('Enter driver name'); return; }
    setAssignLoading(true);
    try {
      const res = await crmService.updateDispatchStatus(showAssign._id, {
        status: 'loaded',
        ...assignForm,
      });
      if (res.success) {
        message.success('Driver assigned, marked as Loaded');
        setShowAssign(null);
        load(1);
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setAssignLoading(false); }
  };

  const dispatchOut = async (id) => {
    try {
      await crmService.updateDispatchStatus(id, { status: 'in_transit' });
      message.success('Marked as In Transit');
      load(1);
    } catch (err) { message.error(err.message); }
  };

  const aset = (k, v) => setAssignForm(f => ({ ...f, [k]: v }));

  const columns = [
    { title: 'Dispatch No.', dataIndex: 'dispatchNumber', width: 130, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Vehicle / Driver', key: 'veh',
      render: (_, r) => (
        <div>
          <div className="font-medium">
            {r.vehicle || <span className="text-orange-500 text-xs">No vehicle assigned</span>}
            {r.vehicle && !r.vehicleRef ? (
              <Tag color="orange" className="ml-1 text-[10px]">not linked to master</Tag>
            ) : null}
          </div>
          <div className="text-xs text-gray-400">{r.driverName || ''} {r.driverPhone ? `· ${r.driverPhone}` : ''}</div>
        </div>
      ),
    },
    {
      title: 'Delivery Executive', key: 'executive', width: 150,
      render: (_, record) => {
        const executive = record.deliveryExecutive;
        return (
          <div>
            <div className="text-xs font-medium">{record.deliveryExecutiveName || executive?.name || 'Unlinked'}</div>
            <div className="text-[11px] text-gray-400">{executive?.phone || executive?.email || ''}</div>
          </div>
        );
      },
    },
    {
      title: 'Orders', dataIndex: 'totalOrders', width: 80,
      render: v => <Tag color="blue">{v || 0} orders</Tag>,
    },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Departure', dataIndex: 'departureTime', width: 130,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
    {
      title: 'Created', dataIndex: 'createdAt', width: 100,
      render: v => new Date(v).toLocaleDateString('en-IN'),
    },
    {
      title: 'Actions', width: 200,
      render: (_, r) => (
        <Space size="small">
          {r.status === 'planned' && (
            <Button size="small" type="primary"
              style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
              icon={<CarOutlined />}
              onClick={() => { setShowAssign(r); setAssignForm({ vehicleRef: r.vehicleRef ? String(r.vehicleRef) : undefined, vehicle: r.vehicle || '', driverName: r.driverName || '', driverPhone: r.driverPhone || '', departureTime: '' }); }}>
              Assign
            </Button>
          )}
          {r.status === 'loaded' && (
            <Button size="small" type="primary" icon={<SendOutlined />}
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
              onClick={() => dispatchOut(r._id)}>
              Dispatch
            </Button>
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
          <h1 className="text-2xl font-bold text-gray-800">Delivery Assignment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Assign drivers and vehicles to dispatch batches</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Pending Orders', stats.pendingOrders || 0, '#fa8c16'],
          ['Planned', stats.planned || 0, '#1890ff'],
          ['In Transit', stats.inTransit || 0, '#722ed1'],
          ['Completed Today', stats.completed || 0, '#52c41a'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search by dispatch no. or driver…"
            prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Filter by status" allowClear value={statusFilter}
            onChange={setStatusFilter} className="w-44"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={dispatches} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          locale={{ emptyText: 'No dispatches. Create one via Dispatch Planning.' }}
        />
      </div>

      {/* Assign Driver Modal */}
      <Modal
        title={<span className="font-bold">Assign Driver — {showAssign?.dispatchNumber}</span>}
        open={!!showAssign} onCancel={() => setShowAssign(null)}
        onOk={handleAssign} confirmLoading={assignLoading}
        okText="Assign & Mark Loaded"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={800}
        destroyOnHidden
      >
        <Divider />
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Vehicle *</label>
            <Select
              value={assignForm.vehicleRef}
              onChange={chooseVehicle}
              className="w-full"
              placeholder="Select from Vehicle Master"
              showSearch
              optionFilterProp="label"
              notFoundContent={vehicles.length ? 'No match' : 'No active vehicles in Vehicle Master'}
              options={vehicles.map(v => ({
                value: String(v._id),
                label: v.vehicleNumber,
                title: [
                  v.vehicleType,
                  v.capacity ? `${v.capacity} ${v.capacityUnit || ''}`.trim() : null,
                  v.deliveryExecutive?.name ? `Executive: ${v.deliveryExecutive.name}` : 'No executive linked',
                ].filter(Boolean).join(' · '),
              }))}
              optionRender={option => (
                <div>
                  <div className="font-medium">{option.data.label}</div>
                  <div className="text-xs text-gray-400">{option.data.title}</div>
                </div>
              )}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Linked Delivery Executive</label>
            <div className={`rounded border px-3 py-2 ${selectedExecutive ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
              <div className="text-sm font-medium">{selectedExecutive?.name || 'No Delivery Executive linked'}</div>
              <div className="text-xs text-gray-500">
                {selectedExecutive ? (selectedExecutive.phone || selectedExecutive.email || 'User Management account') : 'You can link an account in Vehicle Master.'}
              </div>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Driver Name *</label>
            <Input value={assignForm.driverName} onChange={e => aset('driverName', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Driver Phone</label>
            <Input value={assignForm.driverPhone} onChange={e => aset('driverPhone', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Departure Time</label>
            <Input type="datetime-local" value={assignForm.departureTime} onChange={e => aset('departureTime', e.target.value)} />
          </div>
        </div>
      </Modal>

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
              ['Vehicle', viewDispatch.vehicle || '—'],
              ['Driver', viewDispatch.driverName || '—'],
              ['Driver Phone', viewDispatch.driverPhone || '—'],
              ['Delivery Executive', viewDispatch.deliveryExecutiveName || viewDispatch.deliveryExecutive?.name || 'Unlinked'],
              ['Executive Phone', viewDispatch.deliveryExecutive?.phone || '—'],
              ['Total Orders', viewDispatch.totalOrders || 0],
              ['Departure', viewDispatch.departureTime ? new Date(viewDispatch.departureTime).toLocaleString('en-IN') : '—'],
              ['Remarks', viewDispatch.remarks || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 items-start"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryAssignment;
