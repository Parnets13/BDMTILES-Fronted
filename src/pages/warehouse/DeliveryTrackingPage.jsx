import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, InputNumber, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip, Timeline, Checkbox, Divider } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, CarOutlined, CheckCircleOutlined, CloseCircleOutlined, EnvironmentOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const STATUS_COLORS = { assigned: 'default', in_transit: 'blue', reached: 'cyan', delivered: 'green', partially_delivered: 'lime', failed: 'red', rescheduled: 'orange', returned: 'volcano' };
const FAILURE_REASONS = ['customer_unavailable', 'wrong_address', 'payment_pending', 'vehicle_issue', 'product_damaged', 'product_rejected', 'delivery_delayed', 'other'];

const DeliveryTrackingPage = () => {
  const { hasPermission } = useAuth();
  const canExecute = hasPermission('delivery.execute');
  const canVerify = hasPermission('delivery.verify');
  const canComplete = hasPermission('delivery.complete');
  const canException = hasPermission('delivery.exception');
  const canFail = hasPermission('delivery.fail');
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [viewRecord, setViewRecord] = useState(null);
  const [otpRecord, setOtpRecord] = useState(null);
  const [otp, setOtp] = useState('');
  const [completeRecord, setCompleteRecord] = useState(null);
  const [completeForm, setCompleteForm] = useState({ deliveredBoxes: 0, shortBoxes: 0, damagedBoxes: 0, receiverName: '', podImage: '', podSignature: '', podDocumentUrl: '', deliveryRemarks: '', shortRemarks: '', damagedRemarks: '', verificationException: false, exceptionReason: '' });
  const [failureRecord, setFailureRecord] = useState(null);
  const [failureForm, setFailureForm] = useState({ failureReason: 'customer_unavailable', failureRemarks: '', rescheduleDate: '' });
  const [saving, setSaving] = useState(false);

  const loadStats = () => { api.get('/deliveries/stats').then(res => { if (res.success) setStats(res.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchDeliveries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/deliveries', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setDeliveries(res.data); setPagination(current => ({ ...current, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);
  useEffect(() => { fetchDeliveries(); }, [fetchDeliveries]);

  const refresh = () => { fetchDeliveries(); loadStats(); };
  const handleAction = async (id, action, body = {}) => {
    try {
      const res = await api.patch(`/deliveries/${id}/${action}`, body);
      if (res?.success) { message.success(res.message); refresh(); }
    } catch (err) { message.error(err.message); }
  };

  const openDetail = async record => {
    try {
      const res = await api.get(`/deliveries/${record._id}`);
      if (res.success) setViewRecord(res.data);
    } catch (err) { message.error(err.message); }
  };

  const submitOtp = async () => {
    if (!/^\d{6}$/.test(otp)) return message.error('Enter the six-digit OTP');
    setSaving(true);
    try {
      const res = await api.patch(`/deliveries/${otpRecord._id}/verify-otp`, { otp });
      if (res.success) { message.success(res.message); setOtpRecord(null); setOtp(''); refresh(); }
    } catch (err) { message.error(err.message); }
    finally { setSaving(false); }
  };

  const openCompletion = async record => {
    try {
      const res = await api.get(`/deliveries/${record._id}`);
      if (!res.success) return;
      const delivery = res.data;
      setCompleteRecord(delivery);
      setCompleteForm({ deliveredBoxes: delivery.totalBoxes || 0, shortBoxes: 0, damagedBoxes: 0, receiverName: delivery.receiverName || '', podImage: delivery.podImage || '', podSignature: delivery.podSignature || '', podDocumentUrl: delivery.podDocumentUrl || '', deliveryRemarks: delivery.deliveryRemarks || '', shortRemarks: '', damagedRemarks: '', verificationException: false, exceptionReason: '' });
    } catch (err) { message.error(err.message); }
  };

  const updateBoxOutcome = (field, value) => {
    const numeric = Math.max(0, Number(value || 0));
    setCompleteForm(form => {
      const next = { ...form, [field]: numeric };
      if (field !== 'deliveredBoxes') next.deliveredBoxes = Math.max(0, Number(completeRecord.totalBoxes || 0) - Number(next.shortBoxes || 0) - Number(next.damagedBoxes || 0));
      return next;
    });
  };

  const submitCompletion = async () => {
    const total = Number(completeForm.deliveredBoxes) + Number(completeForm.shortBoxes) + Number(completeForm.damagedBoxes);
    if (Math.abs(total - Number(completeRecord.totalBoxes)) > 0.0001) return message.error('Delivered + short + damaged boxes must match total boxes');
    if (!completeForm.verificationException && !completeRecord.otpVerified) return message.error('Verify OTP first or use an authorized exception');
    if (!completeForm.verificationException && (!completeForm.receiverName.trim() || !(completeForm.podImage || completeForm.podSignature || completeForm.podDocumentUrl))) return message.error('Receiver name and POD evidence are required');
    setSaving(true);
    try {
      const res = await api.patch(`/deliveries/${completeRecord._id}/complete`, completeForm);
      if (res.success) { message.success(res.message); setCompleteRecord(null); refresh(); }
    } catch (err) { message.error(err.message); }
    finally { setSaving(false); }
  };

  const submitFailure = async () => {
    if (failureForm.rescheduleDate && new Date(failureForm.rescheduleDate) <= new Date()) return message.error('Reschedule date must be in the future');
    setSaving(true);
    try {
      const res = await api.patch(`/deliveries/${failureRecord._id}/fail`, { ...failureForm, rescheduleDate: failureForm.rescheduleDate || undefined });
      if (res.success) { message.success(res.message); setFailureRecord(null); refresh(); }
    } catch (err) { message.error(err.message); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: 'Delivery #', dataIndex: 'deliveryNumber', width: 110, render: value => <span className="text-xs font-mono text-blue-600 font-medium">{value}</span> },
    { title: 'Date', dataIndex: 'deliveryDate', width: 85, render: value => <span className="text-xs">{new Date(value).toLocaleDateString('en-IN')}</span> },
    { title: 'SO #', dataIndex: 'orderNumber', width: 100 },
    { title: 'Dealer', dataIndex: 'dealerName', width: 140 },
    { title: 'Executive', width: 110, render: (_, record) => record.deliveryExecutiveName || record.deliveryExecutive?.name || '—' },
    { title: 'Boxes', width: 100, render: (_, record) => `${record.deliveredBoxes || 0} delivered / ${record.shortBoxes || 0} short / ${record.damagedBoxes || 0} damaged / ${record.totalBoxes} total` },
    { title: 'OTP', dataIndex: 'otpVerified', width: 60, render: value => <Tag color={value ? 'green' : 'default'}>{value ? 'Yes' : 'No'}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 120, render: value => <Tag color={STATUS_COLORS[value]}>{value.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 210, render: (_, record) => <Space size="small" wrap>
      <Tooltip title="Authoritative details"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)} /></Tooltip>
      {canExecute && record.status === 'assigned' && <Tooltip title="Start"><Button type="text" size="small" icon={<CarOutlined />} onClick={() => handleAction(record._id, 'start')} /></Tooltip>}
      {canExecute && record.status === 'in_transit' && <Tooltip title="Reached"><Button type="text" size="small" icon={<EnvironmentOutlined />} onClick={() => handleAction(record._id, 'reached')} /></Tooltip>}
      {canVerify && ['in_transit', 'reached'].includes(record.status) && !record.otpVerified && <Tooltip title="Verify OTP"><Button type="text" size="small" icon={<SafetyCertificateOutlined />} onClick={() => { setOtpRecord(record); setOtp(''); }} /></Tooltip>}
      {canComplete && ['reached', 'in_transit'].includes(record.status) && <Tooltip title={record.otpVerified || canException ? 'Complete with POD' : 'OTP verification required'}><Button type="text" size="small" icon={<CheckCircleOutlined />} disabled={!record.otpVerified && !canException} onClick={() => openCompletion(record)} /></Tooltip>}
      {canFail && ['assigned', 'in_transit', 'reached', 'rescheduled'].includes(record.status) && <Tooltip title="Fail or reschedule"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => { setFailureRecord(record); setFailureForm({ failureReason: 'customer_unavailable', failureRemarks: '', rescheduleDate: '' }); }} /></Tooltip>}
    </Space> },
  ];

  return <div>
    <div className="flex justify-between items-center mb-5"><div><h1 className="text-2xl font-bold text-gray-800">Delivery Tracking</h1><p className="text-sm text-gray-500 mt-0.5">OTP, POD, receiver evidence, explicit discrepancies, failure and reschedule workflow</p></div></div>
    <Row gutter={12} className="mb-4"><Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} /></Card></Col><Col span={3}><Card size="small"><Statistic title="Assigned" value={stats.assigned || 0} /></Card></Col><Col span={3}><Card size="small"><Statistic title="In Transit" value={stats.inTransit || 0} /></Card></Col><Col span={3}><Card size="small"><Statistic title="Delivered" value={stats.delivered || 0} /></Card></Col><Col span={3}><Card size="small"><Statistic title="Today" value={stats.todayDelivered || 0} /></Card></Col><Col span={3}><Card size="small"><Statistic title="Failed" value={stats.failed || 0} /></Card></Col><Col span={3}><Card size="small"><Statistic title="Rescheduled" value={stats.rescheduled || 0} /></Card></Col></Row>
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4 flex gap-3"><Input placeholder="Search delivery, SO, dealer..." prefix={<SearchOutlined />} value={search} onChange={event => { setSearch(event.target.value); setPagination(current => ({ ...current, current: 1 })); }} className="w-64" allowClear /><Select placeholder="Status" value={statusFilter} onChange={setStatusFilter} allowClear className="w-40" options={Object.keys(STATUS_COLORS).map(value => ({ value, label: value.replace(/_/g, ' ') }))} /><Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button></div>
    <div className="bg-white rounded-lg border border-gray-200"><Table columns={columns} dataSource={deliveries} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1150 }} pagination={{ ...pagination, showSizeChanger: true }} onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))} /></div>

    {otpRecord && <Modal open title={`Verify OTP — ${otpRecord.deliveryNumber}`} onCancel={() => setOtpRecord(null)} onOk={submitOtp} confirmLoading={saving} okText="Verify OTP"><Input size="large" maxLength={6} value={otp} onChange={event => setOtp(event.target.value.replace(/\D/g, ''))} placeholder="Six-digit customer OTP" className="mt-3" /></Modal>}

    {completeRecord && <Modal open title={`Complete Delivery — ${completeRecord.deliveryNumber}`} onCancel={() => setCompleteRecord(null)} onOk={submitCompletion} confirmLoading={saving} okText="Complete delivery" width={760}>
      <div className="space-y-3 mt-3">
        <div className="grid grid-cols-4 gap-2"><div><label className="text-xs text-gray-500">Total boxes</label><InputNumber disabled value={completeRecord.totalBoxes} className="w-full" /></div><div><label className="text-xs text-gray-500">Delivered</label><InputNumber min={0} value={completeForm.deliveredBoxes} onChange={value => updateBoxOutcome('deliveredBoxes', value)} className="w-full" /></div><div><label className="text-xs text-gray-500">Short</label><InputNumber min={0} value={completeForm.shortBoxes} onChange={value => updateBoxOutcome('shortBoxes', value)} className="w-full" /></div><div><label className="text-xs text-gray-500">Damaged</label><InputNumber min={0} value={completeForm.damagedBoxes} onChange={value => updateBoxOutcome('damagedBoxes', value)} className="w-full" /></div></div>
        <div className="grid grid-cols-2 gap-2"><Input value={completeForm.receiverName} onChange={event => setCompleteForm(form => ({ ...form, receiverName: event.target.value }))} placeholder="Receiver name *" /><Input value={completeForm.podImage} onChange={event => setCompleteForm(form => ({ ...form, podImage: event.target.value }))} placeholder="POD photo URL" /><Input value={completeForm.podSignature} onChange={event => setCompleteForm(form => ({ ...form, podSignature: event.target.value }))} placeholder="Signature URL / evidence" /><Input value={completeForm.podDocumentUrl} onChange={event => setCompleteForm(form => ({ ...form, podDocumentUrl: event.target.value }))} placeholder="POD document URL" /></div>
        {completeForm.shortBoxes > 0 && <Input value={completeForm.shortRemarks} onChange={event => setCompleteForm(form => ({ ...form, shortRemarks: event.target.value }))} placeholder="Short-box discrepancy remarks" />}
        {completeForm.damagedBoxes > 0 && <Input value={completeForm.damagedRemarks} onChange={event => setCompleteForm(form => ({ ...form, damagedRemarks: event.target.value }))} placeholder="Damaged-box discrepancy remarks" />}
        <Input.TextArea rows={2} value={completeForm.deliveryRemarks} onChange={event => setCompleteForm(form => ({ ...form, deliveryRemarks: event.target.value }))} placeholder="Delivery remarks" />
        {canException && <div className="bg-orange-50 border border-orange-200 rounded p-3"><Checkbox checked={completeForm.verificationException} onChange={event => setCompleteForm(form => ({ ...form, verificationException: event.target.checked }))}>Authorized OTP/POD exception</Checkbox>{completeForm.verificationException && <Input className="mt-2" value={completeForm.exceptionReason} onChange={event => setCompleteForm(form => ({ ...form, exceptionReason: event.target.value }))} placeholder="Mandatory exception reason" />}</div>}
        <div className="text-xs text-gray-500">Short/damaged outcomes create discrepancy records. They do not silently restore saleable inventory.</div>
      </div>
    </Modal>}

    {failureRecord && <Modal open title={`Fail / Reschedule — ${failureRecord.deliveryNumber}`} onCancel={() => setFailureRecord(null)} onOk={submitFailure} confirmLoading={saving} okText={failureForm.rescheduleDate ? 'Reschedule' : 'Record failure'}><div className="space-y-3 mt-3"><Select className="w-full" value={failureForm.failureReason} onChange={value => setFailureForm(form => ({ ...form, failureReason: value }))} options={FAILURE_REASONS.map(value => ({ value, label: value.replace(/_/g, ' ') }))} /><Input.TextArea rows={2} value={failureForm.failureRemarks} onChange={event => setFailureForm(form => ({ ...form, failureRemarks: event.target.value }))} placeholder="Failure remarks" /><div><label className="text-xs text-gray-500">Reschedule date/time (leave blank for terminal failure)</label><Input type="datetime-local" value={failureForm.rescheduleDate} onChange={event => setFailureForm(form => ({ ...form, rescheduleDate: event.target.value }))} /></div></div></Modal>}

    {viewRecord && <Modal open title={`Authoritative Delivery Detail — ${viewRecord.deliveryNumber}`} onCancel={() => setViewRecord(null)} width={1000} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
      <div className="space-y-4 text-sm mt-3">
        <div className="grid grid-cols-3 gap-3"><div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Delivery To</div><b>{viewRecord.dealerName}</b><div className="text-xs">{viewRecord.contactPhone} · {viewRecord.deliveryAddress}</div></div><div className="bg-blue-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Trip / Driver</div><b>{viewRecord.dispatchTrip?.tripNumber || viewRecord.tripNumber}</b><div className="text-xs">{viewRecord.dispatchTrip?.routeName || '—'} · {viewRecord.dispatchTrip?.vehicleNumber || '—'} · {viewRecord.dispatchTrip?.driverName || '—'} ({viewRecord.dispatchTrip?.driverPhone || '—'})</div></div><div className="bg-green-50 p-3 rounded border"><Tag color={STATUS_COLORS[viewRecord.status]}>{viewRecord.status.replace(/_/g, ' ')}</Tag><div>OTP: <b>{viewRecord.otpVerified ? 'Verified' : 'Pending'}</b></div><div>Receiver: <b>{viewRecord.receiverName || '—'}</b></div></div></div>
        <div className="grid grid-cols-4 gap-2 text-xs"><div>Total: <b>{viewRecord.totalBoxes}</b></div><div>Delivered: <b>{viewRecord.deliveredBoxes || 0}</b></div><div>Short: <b>{viewRecord.shortBoxes || 0}</b></div><div>Damaged: <b>{viewRecord.damagedBoxes || 0}</b></div></div>
        <Timeline items={[{ color: 'green', children: `Created: ${new Date(viewRecord.createdAt).toLocaleString('en-IN')}` }, viewRecord.startTime && { color: 'blue', children: `Started: ${new Date(viewRecord.startTime).toLocaleString('en-IN')}` }, viewRecord.reachTime && { color: 'cyan', children: `Reached: ${new Date(viewRecord.reachTime).toLocaleString('en-IN')}` }, viewRecord.otpVerifiedAt && { color: 'purple', children: `OTP verified: ${new Date(viewRecord.otpVerifiedAt).toLocaleString('en-IN')}` }, viewRecord.completionTime && { color: 'green', children: `Completed: ${new Date(viewRecord.completionTime).toLocaleString('en-IN')}` }].filter(Boolean)} />
        {!!viewRecord.salesOrder?.items?.length && <><Divider>Sales Order lines</Divider><Table size="small" pagination={false} rowKey={item => item._id} dataSource={viewRecord.salesOrder.items} columns={[{ title: 'Product', render: (_, item) => <div className="flex items-center gap-2"><ProductImage src={item.productImage} size="sm" /><div><b>{item.productName}</b><div className="text-xs text-gray-400">{item.productCode}</div></div></div> }, { title: 'Ordered', dataIndex: 'quantity' }, { title: 'Dispatched', dataIndex: 'dispatchedQuantity' }, { title: 'Shade / Batch', render: (_, item) => `${item.shade || '—'} / ${item.batch || '—'}` }]} /></>}
        {!!viewRecord.discrepancies?.length && <div className="bg-orange-50 border border-orange-200 rounded p-3"><b>Discrepancies</b>{viewRecord.discrepancies.map(item => <div key={item._id} className="text-xs mt-1">{item.type}: {item.boxes} box(es) · {item.status} · {item.remarks || 'No remarks'}</div>)}</div>}
        {viewRecord.verificationException?.used && <div className="bg-red-50 border border-red-200 rounded p-3">Authorized verification exception: {viewRecord.verificationException.reason}</div>}
        <div className="flex gap-3">{viewRecord.podImage && <div><div className="text-xs text-gray-500">POD photo</div><ProductImage src={viewRecord.podImage} size="xl" /></div>}{viewRecord.podSignature && <div><div className="text-xs text-gray-500">Signature</div><ProductImage src={viewRecord.podSignature} size="xl" /></div>}{viewRecord.podDocumentUrl && <a href={viewRecord.podDocumentUrl} target="_blank" rel="noreferrer">Open POD document</a>}</div>
        {viewRecord.failureReason && <div className="bg-red-50 border rounded p-3">{viewRecord.failureReason.replace(/_/g, ' ')} · {viewRecord.failureRemarks || '—'} {viewRecord.rescheduleDate && `· Rescheduled ${new Date(viewRecord.rescheduleDate).toLocaleString('en-IN')}`}</div>}
      </div>
    </Modal>}
  </div>;
};

export default DeliveryTrackingPage;
