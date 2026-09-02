import { useCallback, useEffect, useState } from 'react';
import { Button, Checkbox, Divider, Input, InputNumber, Modal, Select, Space, Table, Tag, Upload, message } from 'antd';
import { EyeOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import ComplaintDetail from '../../components/complaints/ComplaintDetail.jsx';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';

const REASONS = [
  { value: 'damaged_goods', label: 'Damaged goods' },
  { value: 'wrong_product', label: 'Wrong product' },
  { value: 'quality_issue', label: 'Quality issue' },
  { value: 'shade_mismatch', label: 'Shade mismatch' },
  { value: 'size_issue', label: 'Size issue' },
  { value: 'other', label: 'Other' },
];
const emptyForm = { dealer: '', invoice: '', category: '', description: '', priority: 'medium', evidenceFiles: [], products: [] };

const ReturnRequest = () => {
  const [records, setRecords] = useState([]);
  const [dealers, setDealers] = useState([]);
  const [sources, setSources] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await crmService.getComplaints({ page: 1, limit: 100 });
      if (response.success) setRecords((response.data || []).filter((record) => record.products?.some((item) => item.invoiceItem)));
    } catch (error) { message.error(error.message || 'Unable to load return requests.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    masterService.getDealers({ limit: 200, status: 'active' }).then((response) => {
      if (response.success) setDealers(response.data || []);
    }).catch(() => setDealers([]));
  }, []);

  const selectDealer = async (dealer) => {
    setForm({ ...emptyForm, dealer });
    setSources([]);
    if (!dealer) return;
    try {
      const response = await crmService.getComplaintSourcesForDealer(dealer);
      if (response.success) setSources(response.data || []);
    } catch (error) { message.error(error.message || 'Unable to load invoiced sales.'); }
  };
  const selectInvoice = (invoiceId) => {
    const source = sources.find((item) => item._id === invoiceId);
    setForm((current) => ({
      ...current,
      invoice: invoiceId,
      products: (source?.items || []).map((item) => ({ invoiceItem: item._id, quantity: Number(item.remainingReturnQty || 0), selected: false })),
    }));
  };
  const updateLine = (index, field, value) => setForm((current) => ({
    ...current,
    products: current.products.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const selectedSource = sources.find((source) => source._id === form.invoice);

  const submit = async () => {
    const products = form.products.filter((item) => item.selected).map(({ invoiceItem, quantity }) => ({ invoiceItem, quantity }));
    if (!form.dealer || !selectedSource || !form.category || !form.description.trim() || products.length === 0) {
      message.error('Dealer, invoice, reason, description, and at least one invoice line are required.');
      return;
    }
    if (products.some((item) => Number(item.quantity) <= 0)) {
      message.error('Selected line quantities must be greater than zero.');
      return;
    }
    setSaving(true);
    try {
      let complaintPhotos = [];
      if (form.evidenceFiles.length > 0) {
        const uploaded = await crmService.uploadComplaintEvidence(form.evidenceFiles);
        if (!uploaded.success) throw new Error('Customer evidence upload failed.');
        complaintPhotos = (uploaded.data || []).map((evidence) => ({ url: evidence.url, caption: 'Customer evidence' }));
      }
      const created = await crmService.createComplaint({
        dealer: form.dealer,
        salesOrder: selectedSource.salesOrder,
        invoice: selectedSource._id,
        products,
        category: form.category,
        description: form.description.trim(),
        priority: form.priority,
        complaintPhotos,
      });
      if (created.success) {
        try {
          await crmService.sendComplaintToWarehouse(created.data._id, { remarks: 'Submitted as an invoice-linked return request.' });
          message.success('Return request created and sent to warehouse verification.');
        } catch (error) {
          message.warning(`Complaint created, but warehouse handoff failed: ${error.message}`);
        }
        setShowCreate(false);
        setForm(emptyForm);
        setSources([]);
        load();
      }
    } catch (error) { message.error(error.message || 'Unable to create return request.'); }
    finally { setSaving(false); }
  };

  const openDetail = async (id) => {
    setDetail({ _id: id });
    setDetailLoading(true);
    try {
      const response = await crmService.getComplaint(id);
      if (response.success) setDetail(response.data);
    } catch (error) { message.error(error.message || 'Unable to load complaint.'); }
    finally { setDetailLoading(false); }
  };

  const columns = [
    { title: 'Request', dataIndex: 'complaintNumber', render: value => <span className="font-mono font-medium">{value}</span> },
    { title: 'Dealer', dataIndex: 'dealerName' },
    { title: 'Invoice', dataIndex: 'invoiceNumber' },
    { title: 'Reason', dataIndex: 'category', render: value => <Tag>{String(value).replace(/_/g, ' ')}</Tag> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={value === 'resolved' ? 'green' : value === 'rejected' ? 'red' : 'blue'}>{String(value).replace(/_/g, ' ')}</Tag> },
    { title: 'Action', render: (_, record) => <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record._id)}>View</Button> },
  ];

  return <div>
    <div className="flex justify-between items-center mb-5">
      <div><h1 className="text-2xl font-bold text-gray-800">Invoice-linked Return Requests</h1><p className="text-sm text-gray-500">Create return complaints only from authoritative invoice lines.</p></div>
      <Space><Button icon={<ReloadOutlined />} onClick={load} loading={loading} /><Button type="primary" icon={<PlusOutlined />} onClick={() => setShowCreate(true)}>New return request</Button></Space>
    </div>
    <div className="bg-white border rounded-lg overflow-hidden"><Table rowKey="_id" loading={loading} dataSource={records} columns={columns} pagination={false} /></div>

    <Modal open={showCreate} title="New invoice-linked return request" width={900} onCancel={() => setShowCreate(false)} onOk={submit} confirmLoading={saving} okText="Create and send to warehouse" destroyOnHidden>
      <Divider />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500">Dealer *</label><Select className="w-full" showSearch optionFilterProp="label" value={form.dealer || undefined} onChange={selectDealer} options={dealers.map((dealer) => ({ value: dealer._id, label: `${dealer.businessName} (${dealer.dealerCode})` }))} /></div>
        <div><label className="text-xs text-gray-500">Active tax invoice *</label><Select className="w-full" value={form.invoice || undefined} onChange={selectInvoice} options={sources.map((source) => ({ value: source._id, label: `${source.invoiceNumber} · ${source.orderNumber || ''}` }))} /></div>
        <div><label className="text-xs text-gray-500">Reason *</label><Select className="w-full" value={form.category || undefined} onChange={value => setForm(current => ({ ...current, category: value }))} options={REASONS} /></div>
        <div><label className="text-xs text-gray-500">Priority</label><Select className="w-full" value={form.priority} onChange={value => setForm(current => ({ ...current, priority: value }))} options={['low','medium','high','critical'].map(value => ({ value, label: value }))} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500">Issue description *</label><Input.TextArea rows={3} value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} /></div>
        <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Customer evidence photos (optional)</label>
          <Upload multiple accept="image/jpeg,image/png,image/webp,image/gif" maxCount={10}
            fileList={form.evidenceFiles}
            beforeUpload={(file) => { setForm(current => ({ ...current, evidenceFiles: [...current.evidenceFiles, file].slice(0, 10) })); return false; }}
            onRemove={(file) => setForm(current => ({ ...current, evidenceFiles: current.evidenceFiles.filter(item => item.uid !== file.uid) }))}>
            <Button icon={<UploadOutlined />}>Select photos</Button>
          </Upload>
        </div>
      </div>
      <Table className="mt-4" size="small" pagination={false} rowKey="invoiceItem" dataSource={form.products}
        columns={[
          { title: 'Return', render: (_, item, index) => <Checkbox checked={item.selected} onChange={event => updateLine(index, 'selected', event.target.checked)} /> },
          { title: 'Product', render: (_, item, index) => { const source = selectedSource?.items?.[index]; return `${source?.productName || '—'} (${source?.productCode || ''})`; } },
          { title: 'Invoiced / remaining', render: (_, item, index) => `${selectedSource?.items?.[index]?.quantity || 0} / ${selectedSource?.items?.[index]?.remainingReturnQty || 0}` },
          { title: 'Complaint qty', render: (_, item, index) => <InputNumber min={0.0001} max={selectedSource?.items?.[index]?.remainingReturnQty || 0} value={item.quantity} disabled={!item.selected} onChange={value => updateLine(index, 'quantity', value || 0)} /> },
          { title: 'Shade / Batch', render: (_, item, index) => `${selectedSource?.items?.[index]?.shade || '—'} / ${selectedSource?.items?.[index]?.batch || '—'}` },
        ]} />
    </Modal>

    <Modal open={!!detail} title={`Return request ${detail?.complaintNumber || ''}`} width={900} footer={<Button onClick={() => setDetail(null)}>Close</Button>} onCancel={() => setDetail(null)}>
      <ComplaintDetail complaint={detail} loading={detailLoading} />
    </Modal>
  </div>;
};

export default ReturnRequest;
