import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip, Steps } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, UserOutlined, PlayCircleOutlined, CheckCircleOutlined, InboxOutlined, CarOutlined, UnorderedListOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const STATUS_COLORS = {
  generated: 'default', assigned: 'orange', in_progress: 'blue', picked: 'cyan',
  verified: 'geekblue', sorted: 'purple', packed: 'lime', ready_for_dispatch: 'green',
};
const STATUS_STEPS = ['generated', 'assigned', 'in_progress', 'picked', 'verified', 'sorted', 'packed', 'ready_for_dispatch'];

const PickingListPage = () => {
  const [pickLists, setPickLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => { api.get('/pick-lists/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchPickLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pick-lists', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setPickLists(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchPickLists(); }, [fetchPickLists]);

  const handleAction = async (id, action, body = {}) => {
    try {
      const res = await api.patch(`/pick-lists/${id}/${action}`, body);
      if (res?.success) { message.success(res.message); fetchPickLists(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Pick List #', dataIndex: 'pickListNumber', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'SO #', dataIndex: 'orderNumber', width: 100, render: v => <span className="text-xs font-mono">{v}</span> },
    { title: 'Dealer', dataIndex: 'dealerName', width: 150, render: v => <span className="text-xs font-medium truncate block max-w-[140px]">{v}</span> },
    { title: 'Items', dataIndex: 'totalItems', width: 50 },
    { title: 'Qty', dataIndex: 'totalRequestedQty', width: 55 },
    { title: 'Picked', dataIndex: 'totalPickedQty', width: 60, render: (v, r) => <span className={v >= r.totalRequestedQty ? 'text-green-600 font-medium' : ''}>{v || 0}</span> },
    { title: 'Priority', dataIndex: 'priority', width: 75, render: v => <Tag color={v === 'urgent' ? 'orange' : v === 'vip' ? 'red' : 'default'}>{v}</Tag> },
    { title: 'Assigned', key: 'assigned', width: 100, render: (_, r) => r.assignedToName || <span className="text-gray-400">Unassigned</span> },
    { title: 'Status', dataIndex: 'status', width: 120, render: s => <Tag color={STATUS_COLORS[s]}>{s.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 140, render: (_, r) => (
      <Space size="small" wrap>
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewRecord(r)} /></Tooltip>
        {r.status === 'generated' && <Tooltip title="Assign"><Button type="text" size="small" icon={<UserOutlined />} className="text-orange-500" onClick={() => handleAction(r._id, 'assign', { assignedTo: null, assignedToName: 'Self' })} /></Tooltip>}
        {r.status === 'assigned' && <Tooltip title="Start"><Button type="text" size="small" icon={<PlayCircleOutlined />} className="text-blue-600" onClick={() => handleAction(r._id, 'start')} /></Tooltip>}
        {r.status === 'in_progress' && <Tooltip title="Complete Picking"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-cyan-600" onClick={() => handleAction(r._id, 'complete-picking')} /></Tooltip>}
        {r.status === 'picked' && <Tooltip title="Verify"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-indigo-600" onClick={() => handleAction(r._id, 'verify')} /></Tooltip>}
        {r.status === 'verified' && <Tooltip title="Sort"><Button type="text" size="small" icon={<InboxOutlined />} className="text-purple-600" onClick={() => handleAction(r._id, 'sort')} /></Tooltip>}
        {r.status === 'sorted' && <Tooltip title="Pack"><Button type="text" size="small" icon={<InboxOutlined />} className="text-lime-600" onClick={() => handleAction(r._id, 'pack', { totalBoxes: r.totalRequestedQty })} /></Tooltip>}
        {r.status === 'packed' && <Tooltip title="Ready"><Button type="text" size="small" icon={<CarOutlined />} className="text-green-600" onClick={() => handleAction(r._id, 'ready')} /></Tooltip>}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Picking & Sorting</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate pick lists from confirmed orders, track picking → sorting → packing → dispatch</p>
        </div>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<UnorderedListOutlined />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Generated" value={stats.generated || 0} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="In Progress" value={stats.inProgress || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Picked" value={stats.picked || 0} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Sorted" value={stats.sorted || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Packed" value={stats.packed || 0} valueStyle={{ color: '#a0d911' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Ready" value={stats.ready || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search pick list #, SO #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-40"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={pickLists} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* View Detail Modal */}
      {viewRecord && (
        <Modal open title={`Pick List ${viewRecord.pickListNumber}`} onCancel={() => setViewRecord(null)} width={800}
          footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="space-y-4 text-sm mt-3">
            {/* Progress */}
            <Steps size="small" current={STATUS_STEPS.indexOf(viewRecord.status)} items={STATUS_STEPS.map(s => ({ title: s.replace(/_/g, ' ') }))} />

            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase font-semibold">Order</div><div className="font-bold">{viewRecord.orderNumber}</div><div className="text-xs text-gray-500">{viewRecord.dealerName}</div></div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="text-[10px] text-gray-400 uppercase font-semibold">Assigned To</div><div className="font-bold">{viewRecord.assignedToName || 'Unassigned'}</div></div>
              <div className="bg-green-50 p-3 rounded border border-green-100"><div className="text-[10px] text-gray-400 uppercase font-semibold">Progress</div><div className="font-bold">{viewRecord.totalPickedQty || 0} / {viewRecord.totalRequestedQty} picked</div>{viewRecord.totalShortQty > 0 && <div className="text-xs text-red-500">{viewRecord.totalShortQty} short</div>}</div>
            </div>

            {/* Items table */}
            <table className="w-full text-xs border border-gray-200 rounded">
              <thead className="bg-blue-50"><tr>{['#','Product','Shade','Batch','Requested','Picked','Short','Status'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
              <tbody>{viewRecord.items?.map((item, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-400">{i+1}</td>
                  <td className="px-2 py-1.5"><div className="flex items-center gap-1">{item.productImage && <img src={item.productImage} className="w-5 h-5 rounded object-cover" />}<div><div className="font-medium">{item.productName}</div><div className="text-[9px] text-gray-400">{item.productCode}{item.rackLocation ? ` · Rack: ${item.rackLocation}` : ''}</div></div></div></td>
                  <td className="px-2 py-1.5">{item.shade || '—'}</td>
                  <td className="px-2 py-1.5">{item.batch || '—'}</td>
                  <td className="px-2 py-1.5 font-medium">{item.requestedQty} {item.unit}</td>
                  <td className="px-2 py-1.5">{item.pickedQty || 0}</td>
                  <td className="px-2 py-1.5 text-red-500">{item.shortQty > 0 ? item.shortQty : '—'}</td>
                  <td className="px-2 py-1.5"><Tag color={item.status === 'picked' ? 'green' : item.status === 'short' ? 'red' : 'default'} className="text-[9px]">{item.status}</Tag></td>
                </tr>
              ))}</tbody>
            </table>

            {viewRecord.pickingStartTime && <div className="text-[10px] text-gray-400">Started: {new Date(viewRecord.pickingStartTime).toLocaleString('en-IN')}{viewRecord.pickingEndTime ? ` · Ended: ${new Date(viewRecord.pickingEndTime).toLocaleString('en-IN')}` : ''}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PickingListPage;
