import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, InputNumber, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal } from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, CheckOutlined, SwapOutlined, InboxOutlined, CarOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const STATUS_COLORS = { verified: 'geekblue', sorted: 'purple', packed: 'lime', ready_for_dispatch: 'green' };
const PRIORITY_COLORS = { normal: 'default', urgent: 'orange', vip: 'red' };

const SortingList = () => {
  const [pickLists, setPickLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [packRecord, setPackRecord] = useState(null);
  const [packForm, setPackForm] = useState({ totalBoxes: 0, totalWeight: 0, deliveryRoute: '' });
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchPickLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pick-lists', {
        params: {
          page: pagination.current,
          limit: pagination.pageSize,
          search,
          priority: priorityFilter,
          status: 'verified,sorted,packed,ready_for_dispatch',
        },
      });
      if (res.success) {
        setPickLists(res.data || []);
        setPagination(current => ({ ...current, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, priorityFilter, search]);

  useEffect(() => { fetchPickLists(); }, [fetchPickLists]);

  const handleAction = async (record, action, body = {}) => {
    try {
      const res = await api.patch(`/pick-lists/${record._id}/${action}`, body);
      if (res.success) {
        message.success(res.message);
        fetchPickLists();
      }
    } catch (err) { message.error(err.message); }
  };

  const openPack = record => {
    setPackRecord(record);
    setPackForm({
      totalBoxes: record.totalBoxes || record.totalPickedQty || 0,
      totalWeight: record.totalWeight || 0,
      deliveryRoute: record.deliveryRoute || '',
    });
  };

  const submitPack = async () => {
    if (!(Number(packForm.totalBoxes) > 0)) {
      message.error('Enter the physical number of packed boxes');
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch(`/pick-lists/${packRecord._id}/pack`, packForm);
      if (res.success) {
        message.success(res.message);
        setPackRecord(null);
        fetchPickLists();
      }
    } catch (err) { message.error(err.message); }
    finally { setSaving(false); }
  };

  const printSortingSlip = record => {
    const popup = window.open('', '_blank');
    if (!popup) return message.error('Allow pop-ups to print the sorting slip');
    popup.document.write(`<html><head><title>Sorting Slip - ${record.pickListNumber}</title><style>body{font-family:Arial;padding:20px;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:7px;border-bottom:1px solid #ddd;text-align:left}th{background:#f3f4f6}.footer{margin-top:30px}</style></head><body><h2>Sorting Slip — ${record.pickListNumber}</h2><p>Sales Order: ${record.orderNumber} | Dealer: ${record.dealerName || '—'} | Route: ${record.deliveryRoute || 'Unassigned'}</p><table><thead><tr><th>#</th><th>Product</th><th>Shade</th><th>Batch</th><th>Picked</th></tr></thead><tbody>${(record.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${item.productName || item.productCode}</td><td>${item.shade || '—'}</td><td>${item.batch || '—'}</td><td>${item.pickedQty || 0} ${item.unit || ''}</td></tr>`).join('')}</tbody></table><div class="footer">Sorted by: __________________ Date: __________ Signature: __________</div></body></html>`);
    popup.document.close();
    setTimeout(() => { popup.print(); popup.close(); }, 300);
  };

  const counts = status => pickLists.filter(item => item.status === status).length;
  const columns = [
    { title: 'Pick List #', dataIndex: 'pickListNumber', width: 115, render: value => <span className="font-mono text-xs text-blue-600 font-medium">{value}</span> },
    { title: 'SO #', dataIndex: 'orderNumber', width: 105, render: value => <span className="font-mono text-xs">{value}</span> },
    { title: 'Dealer', dataIndex: 'dealerName', width: 160 },
    { title: 'Route', dataIndex: 'deliveryRoute', width: 130, render: value => value ? <Tag color="blue">{value}</Tag> : <span className="text-gray-400">Unassigned</span> },
    { title: 'Priority', dataIndex: 'priority', width: 90, render: value => <Tag color={PRIORITY_COLORS[value]}>{value}</Tag> },
    { title: 'Picked Qty', dataIndex: 'totalPickedQty', width: 90 },
    { title: 'Boxes', dataIndex: 'totalBoxes', width: 70, render: value => value || '—' },
    { title: 'Status', dataIndex: 'status', width: 125, render: value => <Tag color={STATUS_COLORS[value]}>{value.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 245, render: (_, record) => (
      <Space size="small" wrap>
        <Button size="small" icon={<PrinterOutlined />} onClick={() => printSortingSlip(record)}>Slip</Button>
        {record.status === 'verified' && <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => handleAction(record, 'sort')}>Mark Sorted</Button>}
        {record.status === 'sorted' && <Button size="small" type="primary" icon={<InboxOutlined />} onClick={() => openPack(record)}>Pack</Button>}
        {record.status === 'packed' && <Button size="small" type="primary" icon={<CarOutlined />} onClick={() => handleAction(record, 'ready')}>Ready</Button>}
        {record.status === 'ready_for_dispatch' && <Tag color="green" icon={<CheckOutlined />}>Dispatch Ready</Tag>}
      </Space>
    ) },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><SwapOutlined className="text-purple-600 text-xl" /> Sorting List</h1><p className="text-sm text-gray-500 mt-0.5">Persist sorting, packing and dispatch-ready handoff for verified pick lists</p></div>
        <Button icon={<ReloadOutlined />} onClick={fetchPickLists}>Refresh</Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Awaiting Sort" value={counts('verified')} valueStyle={{ color: '#2f54eb' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Sorted" value={counts('sorted')} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Packed" value={counts('packed')} valueStyle={{ color: '#a0d911' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Ready for Dispatch" value={counts('ready_for_dispatch')} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-3">
        <Input placeholder="Search pick list, order or dealer..." prefix={<SearchOutlined className="text-gray-400" />} value={search} onChange={event => setSearch(event.target.value)} className="w-64" allowClear />
        <Select placeholder="Priority" allowClear value={priorityFilter} onChange={setPriorityFilter} className="w-32" options={Object.keys(PRIORITY_COLORS).map(value => ({ value, label: value }))} />
        <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setPriorityFilter(undefined); }}>Reset</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={pickLists} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1050 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }}
          onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))}
          locale={{ emptyText: 'No verified pick lists awaiting sorting' }} />
      </div>

      {packRecord && (
        <Modal open title={`Pack ${packRecord.pickListNumber}`} onCancel={() => setPackRecord(null)} onOk={submitPack} confirmLoading={saving} okText="Confirm packing">
          <div className="grid grid-cols-2 gap-4 mt-4">
            <div><label className="text-xs text-gray-500 block mb-1">Physical total boxes *</label><InputNumber min={1} value={packForm.totalBoxes} onChange={value => setPackForm(form => ({ ...form, totalBoxes: value || 0 }))} className="w-full" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Total weight (kg)</label><InputNumber min={0} value={packForm.totalWeight} onChange={value => setPackForm(form => ({ ...form, totalWeight: value || 0 }))} className="w-full" /></div>
            <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Delivery route</label><Input value={packForm.deliveryRoute} onChange={event => setPackForm(form => ({ ...form, deliveryRoute: event.target.value }))} placeholder="e.g. Hubli-Dharwad" /></div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SortingList;
