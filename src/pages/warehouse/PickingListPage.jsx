import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, InputNumber, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip, Steps, Checkbox } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, UserOutlined, PlayCircleOutlined, CheckCircleOutlined, UnorderedListOutlined } from '@ant-design/icons';
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
  const [completionRecord, setCompletionRecord] = useState(null);
  const [completionItems, setCompletionItems] = useState([]);
  const [savingCompletion, setSavingCompletion] = useState(false);

  const loadStats = () => api.get('/pick-lists/stats').then(res => { if (res.success) setStats(res.data); }).catch(() => {});
  useEffect(() => { loadStats(); }, []);

  const fetchPickLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pick-lists', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) {
        setPickLists(res.data);
        setPagination(current => ({ ...current, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchPickLists(); }, [fetchPickLists]);

  const handleAction = async (id, action, body = {}) => {
    try {
      const res = await api.patch(`/pick-lists/${id}/${action}`, body);
      if (res?.success) {
        message.success(res.message);
        fetchPickLists();
        loadStats();
      }
    } catch (err) { message.error(err.message); }
  };

  const openCompletion = async record => {
    try {
      const res = await api.get(`/pick-lists/${record._id}`);
      if (!res.success) return;
      setCompletionRecord(res.data);
      setCompletionItems((res.data.items || []).map(item => ({
        _id: item._id,
        productName: item.productName,
        productCode: item.productCode,
        shade: item.shade,
        batch: item.batch,
        requestedQty: item.requestedQty,
        pickedQty: item.requestedQty,
        shortQty: 0,
        damagedQty: 0,
        barcodeVerified: false,
        shadeConfirmed: false,
        batchConfirmed: false,
        remarks: '',
      })));
    } catch (err) { message.error(err.message); }
  };

  const updateCompletionItem = (index, field, value) => {
    setCompletionItems(items => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  };

  const confirmAllChecks = checked => {
    setCompletionItems(items => items.map(item => ({
      ...item,
      barcodeVerified: checked,
      shadeConfirmed: checked,
      batchConfirmed: checked,
    })));
  };

  const submitCompletion = async () => {
    for (const item of completionItems) {
      const accounted = Number(item.pickedQty || 0) + Number(item.shortQty || 0) + Number(item.damagedQty || 0);
      if (Math.abs(accounted - item.requestedQty) > 0.0001) {
        message.error(`${item.productName}: picked + short + damaged must equal ${item.requestedQty}`);
        return;
      }
      if (!item.barcodeVerified || !item.shadeConfirmed || !item.batchConfirmed) {
        message.error(`Confirm barcode, shade and batch for ${item.productName}`);
        return;
      }
    }
    setSavingCompletion(true);
    try {
      const res = await api.patch(`/pick-lists/${completionRecord._id}/complete-picking`, {
        items: completionItems.map(({ productName, productCode, shade, batch, requestedQty, ...item }) => item),
      });
      if (res.success) {
        message.success(res.message);
        setCompletionRecord(null);
        setCompletionItems([]);
        fetchPickLists();
        loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setSavingCompletion(false); }
  };

  const columns = [
    { title: 'Pick List #', dataIndex: 'pickListNumber', width: 110, render: value => <span className="text-xs font-mono text-blue-600 font-medium">{value}</span> },
    { title: 'SO #', dataIndex: 'orderNumber', width: 100, render: value => <span className="text-xs font-mono">{value}</span> },
    { title: 'Dealer', dataIndex: 'dealerName', width: 150, render: value => <span className="text-xs font-medium truncate block max-w-[140px]">{value}</span> },
    { title: 'Items', dataIndex: 'totalItems', width: 55 },
    { title: 'Requested', dataIndex: 'totalRequestedQty', width: 75 },
    { title: 'Picked', dataIndex: 'totalPickedQty', width: 60, render: value => value || 0 },
    { title: 'Priority', dataIndex: 'priority', width: 75, render: value => <Tag color={value === 'urgent' ? 'orange' : value === 'vip' ? 'red' : 'default'}>{value}</Tag> },
    { title: 'Assigned', key: 'assigned', width: 100, render: (_, record) => record.assignedToName || <span className="text-gray-400">Unassigned</span> },
    { title: 'Status', dataIndex: 'status', width: 120, render: value => <Tag color={STATUS_COLORS[value]}>{value.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 140, render: (_, record) => (
      <Space size="small" wrap>
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewRecord(record)} /></Tooltip>
        {record.status === 'generated' && <Tooltip title="Assign to me"><Button type="text" size="small" icon={<UserOutlined />} className="text-orange-500" onClick={() => handleAction(record._id, 'assign')} /></Tooltip>}
        {record.status === 'assigned' && <Tooltip title="Start picking"><Button type="text" size="small" icon={<PlayCircleOutlined />} className="text-blue-600" onClick={() => handleAction(record._id, 'start')} /></Tooltip>}
        {record.status === 'in_progress' && <Tooltip title="Record item verification"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-cyan-600" onClick={() => openCompletion(record)} /></Tooltip>}
        {record.status === 'picked' && <Tooltip title="Supervisor verify"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-indigo-600" onClick={() => handleAction(record._id, 'verify')} /></Tooltip>}
      </Space>
    ) },
  ];

  const allChecksConfirmed = completionItems.length > 0 && completionItems.every(item => item.barcodeVerified && item.shadeConfirmed && item.batchConfirmed);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Picking List</h1>
        <p className="text-sm text-gray-500 mt-0.5">Assign, pick and verify reserved stock before handing it to sorting</p>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<UnorderedListOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Generated" value={stats.generated || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Assigned" value={stats.assigned || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="In Progress" value={stats.inProgress || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Picked" value={stats.picked || 0} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Verified" value={stats.verified || 0} valueStyle={{ color: '#2f54eb' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search pick list #, SO #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={event => { setSearch(event.target.value); setPagination(current => ({ ...current, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={setStatusFilter} allowClear className="w-40"
            options={Object.keys(STATUS_COLORS).map(status => ({ value: status, label: status.replace(/_/g, ' ') }))} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={pickLists} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }}
          onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))} />
      </div>

      {completionRecord && (
        <Modal open title={`Complete Picking — ${completionRecord.pickListNumber}`} onCancel={() => setCompletionRecord(null)} width={1050}
          onOk={submitCompletion} confirmLoading={savingCompletion} okText="Save verified picking">
          <div className="mt-3">
            <div className="flex justify-between items-center bg-blue-50 border border-blue-100 rounded p-3 mb-3 text-xs">
              <span>Record every quantity explicitly. Short and damaged quantities are released from the stock reservation.</span>
              <Checkbox checked={allChecksConfirmed} onChange={event => confirmAllChecks(event.target.checked)}>Confirm all physical checks</Checkbox>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border border-gray-200">
                <thead className="bg-gray-50"><tr>{['Product / Variant', 'Requested', 'Picked', 'Short', 'Damaged', 'Barcode', 'Shade', 'Batch', 'Remarks'].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead>
                <tbody>{completionItems.map((item, index) => (
                  <tr key={item._id} className="border-t border-gray-100">
                    <td className="p-2 min-w-40"><div className="font-medium">{item.productName}</div><div className="text-[10px] text-gray-400">{item.productCode} · {item.shade || 'No shade'} · {item.batch || 'No batch'}</div></td>
                    <td className="p-2 font-semibold">{item.requestedQty}</td>
                    {['pickedQty', 'shortQty', 'damagedQty'].map(field => <td key={field} className="p-2"><InputNumber min={0} max={item.requestedQty} value={item[field]} onChange={value => updateCompletionItem(index, field, value || 0)} className="w-20" /></td>)}
                    <td className="p-2"><Checkbox checked={item.barcodeVerified} onChange={event => updateCompletionItem(index, 'barcodeVerified', event.target.checked)} /></td>
                    <td className="p-2"><Checkbox checked={item.shadeConfirmed} onChange={event => updateCompletionItem(index, 'shadeConfirmed', event.target.checked)} /></td>
                    <td className="p-2"><Checkbox checked={item.batchConfirmed} onChange={event => updateCompletionItem(index, 'batchConfirmed', event.target.checked)} /></td>
                    <td className="p-2"><Input value={item.remarks} onChange={event => updateCompletionItem(index, 'remarks', event.target.value)} placeholder="Optional" /></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}

      {viewRecord && (
        <Modal open title={`Pick List ${viewRecord.pickListNumber}`} onCancel={() => setViewRecord(null)} width={850} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="space-y-4 text-sm mt-3">
            <Steps size="small" current={STATUS_STEPS.indexOf(viewRecord.status)} items={STATUS_STEPS.map(status => ({ title: status.replace(/_/g, ' ') }))} />
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Order</div><div className="font-bold">{viewRecord.orderNumber}</div><div className="text-xs text-gray-500">{viewRecord.dealerName}</div></div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="text-[10px] text-gray-400 uppercase">Assigned To</div><div className="font-bold">{viewRecord.assignedToName || 'Unassigned'}</div></div>
              <div className="bg-green-50 p-3 rounded border border-green-100"><div className="text-[10px] text-gray-400 uppercase">Progress</div><div className="font-bold">{viewRecord.totalPickedQty || 0} / {viewRecord.totalRequestedQty}</div><div className="text-xs text-gray-500">Stock: {viewRecord.stockConsumedAt ? 'consumed' : viewRecord.stockReserved ? 'reserved' : 'legacy/unreserved'}</div></div>
            </div>
            <table className="w-full text-xs border border-gray-200">
              <thead className="bg-blue-50"><tr>{['Product', 'Shade', 'Batch', 'Requested', 'Picked', 'Short', 'Damaged', 'Checks', 'Status'].map(label => <th key={label} className="px-2 py-1.5 text-left">{label}</th>)}</tr></thead>
              <tbody>{viewRecord.items?.map(item => (
                <tr key={item._id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5"><div className="font-medium">{item.productName}</div><div className="text-[9px] text-gray-400">{item.productCode}</div></td>
                  <td className="px-2 py-1.5">{item.shade || '—'}</td><td className="px-2 py-1.5">{item.batch || '—'}</td>
                  <td className="px-2 py-1.5">{item.requestedQty}</td><td className="px-2 py-1.5">{item.pickedQty || 0}</td><td className="px-2 py-1.5">{item.shortQty || 0}</td><td className="px-2 py-1.5">{item.damagedQty || 0}</td>
                  <td className="px-2 py-1.5">{item.barcodeVerified && item.shadeConfirmed && item.batchConfirmed ? <Tag color="green">All</Tag> : <Tag color="orange">Pending</Tag>}</td>
                  <td className="px-2 py-1.5"><Tag color={item.status === 'picked' ? 'green' : item.status === 'pending' ? 'default' : 'orange'}>{item.status}</Tag></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default PickingListPage;
