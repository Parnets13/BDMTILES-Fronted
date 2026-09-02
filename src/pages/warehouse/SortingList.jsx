import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, InputNumber, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, Checkbox, Divider } from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, CheckOutlined, SwapOutlined, InboxOutlined, CarOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const STATUS_COLORS = { verified: 'geekblue', sorted: 'purple', packed: 'lime', ready_for_dispatch: 'green' };
const PRIORITY_COLORS = { normal: 'default', urgent: 'orange', vip: 'red' };

const SortingList = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('sorting.management');
  const [pickLists, setPickLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [packRecord, setPackRecord] = useState(null);
  const [packForm, setPackForm] = useState({ totalBoxes: 0, totalWeight: 0, deliveryRoute: '' });
  const [detail, setDetail] = useState(null);
  const [sortItems, setSortItems] = useState([]);
  const [route, setRoute] = useState('');
  const [remarks, setRemarks] = useState('');
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const fetchPickLists = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/pick-lists', { params: { page: pagination.current, limit: pagination.pageSize, search, priority: priorityFilter, status: 'verified,sorted,packed,ready_for_dispatch' } });
      if (res.success) {
        setPickLists(res.data || []);
        setPagination(current => ({ ...current, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, priorityFilter, search]);

  useEffect(() => { fetchPickLists(); }, [fetchPickLists]);

  const openDetail = async record => {
    try {
      const res = await api.get(`/pick-lists/${record._id}`);
      if (!res.success) return;
      setDetail(res.data);
      setRoute(res.data.deliveryRoute || '');
      setRemarks(res.data.remarks || '');
      setSortItems((res.data.items || []).map(item => ({
        _id: item._id,
        sortedQty: item.sortedQty || item.pickedQty || 0,
        shortQty: item.sortingShortQty || 0,
        damagedQty: item.sortingDamagedQty || 0,
        barcodeConfirmed: item.sortingBarcodeConfirmed || false,
        shadeConfirmed: item.sortingShadeConfirmed || false,
        batchConfirmed: item.sortingBatchConfirmed || false,
        remarks: item.sortingRemarks || '',
      })));
    } catch (err) { message.error(err.message); }
  };

  const updateSortItem = (index, field, value) => setSortItems(items => items.map((item, i) => i === index ? { ...item, [field]: value } : item));
  const verifyAllIdentity = checked => setSortItems(items => items.map(item => ({ ...item, barcodeConfirmed: checked, shadeConfirmed: checked, batchConfirmed: checked })));

  const submitSorting = async () => {
    const invalid = sortItems.find((row, index) => {
      const source = detail.items[index];
      return Math.abs(Number(row.sortedQty || 0) + Number(row.shortQty || 0) + Number(row.damagedQty || 0) - Number(source.pickedQty || 0)) > 0.0001
        || !row.barcodeConfirmed || !row.shadeConfirmed || !row.batchConfirmed;
    });
    if (invalid) return message.error('Every item needs exact sorted/short/damaged quantities and barcode, shade, and batch confirmation');
    setSaving(true);
    try {
      const res = await api.patch(`/pick-lists/${detail._id}/sort`, { items: sortItems, deliveryRoute: route, remarks });
      if (res.success) { message.success(res.message); setDetail(null); fetchPickLists(); }
    } catch (err) { message.error(err.message); }
    finally { setSaving(false); }
  };

  const handleAction = async (record, action) => {
    try {
      const res = await api.patch(`/pick-lists/${record._id}/${action}`, {});
      if (res.success) { message.success(res.message); fetchPickLists(); }
    } catch (err) { message.error(err.message); }
  };

  const openPack = record => {
    setPackRecord(record);
    setPackForm({ totalBoxes: record.totalBoxes || record.totalPickedQty || 0, totalWeight: record.totalWeight || 0, deliveryRoute: record.deliveryRoute || '' });
  };

  const submitPack = async () => {
    if (!(Number(packForm.totalBoxes) > 0)) return message.error('Enter the physical number of packed boxes');
    setSaving(true);
    try {
      const res = await api.patch(`/pick-lists/${packRecord._id}/pack`, packForm);
      if (res.success) { message.success(res.message); setPackRecord(null); fetchPickLists(); }
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
    { title: 'SO #', dataIndex: 'orderNumber', width: 105 },
    { title: 'Dealer', dataIndex: 'dealerName', width: 160 },
    { title: 'Route', dataIndex: 'deliveryRoute', width: 130, render: value => value ? <Tag color="blue">{value}</Tag> : 'Unassigned' },
    { title: 'Priority', dataIndex: 'priority', width: 90, render: value => <Tag color={PRIORITY_COLORS[value]}>{value}</Tag> },
    { title: 'Picked Qty', dataIndex: 'totalPickedQty', width: 90 },
    { title: 'Boxes', dataIndex: 'totalBoxes', width: 70, render: value => value || '—' },
    { title: 'Status', dataIndex: 'status', width: 125, render: value => <Tag color={STATUS_COLORS[value]}>{value.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 280, render: (_, record) => <Space size="small" wrap>
      <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>Details</Button>
      <Button size="small" icon={<PrinterOutlined />} onClick={() => printSortingSlip(record)}>Slip</Button>
      {canManage && record.status === 'verified' && <Button size="small" type="primary" ghost icon={<CheckOutlined />} onClick={() => openDetail(record)}>Verify Sort</Button>}
      {canManage && record.status === 'sorted' && <Button size="small" type="primary" icon={<InboxOutlined />} onClick={() => openPack(record)}>Pack</Button>}
      {canManage && record.status === 'packed' && <Button size="small" type="primary" icon={<CarOutlined />} onClick={() => handleAction(record, 'ready')}>Ready</Button>}
      {record.status === 'ready_for_dispatch' && <Tag color="green" icon={<CheckOutlined />}>Dispatch Ready</Tag>}
    </Space> },
  ];

  const allIdentityConfirmed = sortItems.length > 0 && sortItems.every(item => item.barcodeConfirmed && item.shadeConfirmed && item.batchConfirmed);

  return <div>
    <div className="flex justify-between items-center mb-5"><div><h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2"><SwapOutlined className="text-purple-600 text-xl" /> Sorting List</h1><p className="text-sm text-gray-500 mt-0.5">Authoritative item sorting, discrepancy evidence, packing and dispatch-ready handoff</p></div><Button icon={<ReloadOutlined />} onClick={fetchPickLists}>Refresh</Button></div>
    <Row gutter={16} className="mb-4"><Col span={6}><Card size="small"><Statistic title="Awaiting Sort" value={counts('verified')} /></Card></Col><Col span={6}><Card size="small"><Statistic title="Sorted" value={counts('sorted')} /></Card></Col><Col span={6}><Card size="small"><Statistic title="Packed" value={counts('packed')} /></Card></Col><Col span={6}><Card size="small"><Statistic title="Ready" value={counts('ready_for_dispatch')} /></Card></Col></Row>
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-3"><Input placeholder="Search pick list, order or dealer..." prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} className="w-64" allowClear /><Select placeholder="Priority" allowClear value={priorityFilter} onChange={setPriorityFilter} className="w-32" options={Object.keys(PRIORITY_COLORS).map(value => ({ value, label: value }))} /><Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setPriorityFilter(undefined); }}>Reset</Button></div>
    <div className="bg-white rounded-lg border border-gray-200"><Table columns={columns} dataSource={pickLists} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }} pagination={{ ...pagination, showSizeChanger: true }} onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))} /></div>

    {detail && <Modal open title={`Sorting Details — ${detail.pickListNumber}`} onCancel={() => setDetail(null)} width={1120} footer={detail.status === 'verified' && canManage ? [<Button key="cancel" onClick={() => setDetail(null)}>Cancel</Button>, <Button key="save" type="primary" loading={saving} onClick={submitSorting}>Complete verified sorting</Button>] : <Button onClick={() => setDetail(null)}>Close</Button>}>
      <div className="space-y-3 mt-3">
        <div className="grid grid-cols-5 gap-2 text-xs bg-gray-50 border rounded p-3"><div><span className="text-gray-400">SO</span><br /><b>{detail.orderNumber}</b></div><div><span className="text-gray-400">Dealer</span><br /><b>{detail.dealerName}</b></div><div><span className="text-gray-400">Status</span><br /><Tag color={STATUS_COLORS[detail.status]}>{detail.status}</Tag></div><div><span className="text-gray-400">Verifier</span><br /><b>{detail.sortedBy?.name || 'Pending'}</b></div><div><span className="text-gray-400">Verified at</span><br /><b>{detail.sortingEndTime ? new Date(detail.sortingEndTime).toLocaleString('en-IN') : 'Pending'}</b></div></div>
        {detail.status === 'verified' && canManage && <div className="flex gap-3"><Input value={route} onChange={event => setRoute(event.target.value)} placeholder="Delivery route" /><Input value={remarks} onChange={event => setRemarks(event.target.value)} placeholder="Overall sorting remarks" /><Checkbox checked={allIdentityConfirmed} onChange={event => verifyAllIdentity(event.target.checked)}>Confirm all identity checks</Checkbox></div>}
        <Divider className="my-2">Item verification</Divider>
        <Table size="small" pagination={false} rowKey="_id" dataSource={detail.items || []} scroll={{ x: 1050 }} columns={[
          { title: 'Product', width: 230, render: (_, item) => <div className="flex items-center gap-2"><ProductImage src={item.productImage || item.product?.images?.[0]} size="sm" /><div><b>{item.productName}</b><div className="text-[10px] text-gray-400">{item.productCode}</div></div></div> },
          { title: 'Shade / Batch', width: 140, render: (_, item) => <span>{item.shade || '—'} / {item.batch || '—'}</span> },
          { title: 'Picked', dataIndex: 'pickedQty', width: 75 },
          { title: 'Pick Short / Damaged', width: 125, render: (_, item) => `${item.shortQty || 0} / ${item.damagedQty || 0}` },
          { title: 'Sorted', width: 90, render: (_, item, index) => detail.status === 'verified' ? <InputNumber min={0} value={sortItems[index]?.sortedQty} onChange={value => updateSortItem(index, 'sortedQty', value || 0)} /> : item.sortedQty },
          { title: 'Sort Short', width: 90, render: (_, item, index) => detail.status === 'verified' ? <InputNumber min={0} value={sortItems[index]?.shortQty} onChange={value => updateSortItem(index, 'shortQty', value || 0)} /> : item.sortingShortQty },
          { title: 'Sort Damaged', width: 100, render: (_, item, index) => detail.status === 'verified' ? <InputNumber min={0} value={sortItems[index]?.damagedQty} onChange={value => updateSortItem(index, 'damagedQty', value || 0)} /> : item.sortingDamagedQty },
          { title: 'Identity', width: 210, render: (_, item, index) => detail.status === 'verified' ? <Space direction="vertical" size={0}><Checkbox checked={sortItems[index]?.barcodeConfirmed} onChange={e => updateSortItem(index, 'barcodeConfirmed', e.target.checked)}>Barcode</Checkbox><Checkbox checked={sortItems[index]?.shadeConfirmed} onChange={e => updateSortItem(index, 'shadeConfirmed', e.target.checked)}>Shade</Checkbox><Checkbox checked={sortItems[index]?.batchConfirmed} onChange={e => updateSortItem(index, 'batchConfirmed', e.target.checked)}>Batch</Checkbox></Space> : <span>{item.sortingBarcodeConfirmed && item.sortingShadeConfirmed && item.sortingBatchConfirmed ? 'Confirmed' : '—'}</span> },
          { title: 'Remarks', width: 170, render: (_, item, index) => detail.status === 'verified' ? <Input value={sortItems[index]?.remarks} onChange={e => updateSortItem(index, 'remarks', e.target.value)} /> : item.sortingRemarks || '—' },
        ]} />
        <div className="text-xs text-blue-700 bg-blue-50 p-2 rounded">Sorting discrepancies are recorded as evidence only. This step does not move or restore inventory quantities.</div>
      </div>
    </Modal>}

    {packRecord && <Modal open title={`Pack ${packRecord.pickListNumber}`} onCancel={() => setPackRecord(null)} onOk={submitPack} confirmLoading={saving} okText="Confirm packing"><div className="grid grid-cols-2 gap-4 mt-4"><div><label className="text-xs text-gray-500 block mb-1">Physical total boxes *</label><InputNumber min={1} value={packForm.totalBoxes} onChange={value => setPackForm(form => ({ ...form, totalBoxes: value || 0 }))} className="w-full" /></div><div><label className="text-xs text-gray-500 block mb-1">Total weight (kg)</label><InputNumber min={0} value={packForm.totalWeight} onChange={value => setPackForm(form => ({ ...form, totalWeight: value || 0 }))} className="w-full" /></div><div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Delivery route</label><Input value={packForm.deliveryRoute} onChange={event => setPackForm(form => ({ ...form, deliveryRoute: event.target.value }))} /></div></div></Modal>}
  </div>;
};

export default SortingList;
