import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Card, Col, Divider, Empty, Input, InputNumber, Modal, Popconfirm,
  Row, Select, Space, Table, Tag, message,
} from 'antd';
import {
  CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  ReloadOutlined, SendOutlined, ShoppingCartOutlined,
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_COLORS = {
  draft: 'default', submitted: 'blue', compared: 'purple', selected: 'green',
  po_created: 'geekblue', cancelled: 'red',
};

const emptyOffer = (pr) => ({
  key: `${Date.now()}-${Math.random()}`,
  supplier: '',
  items: (pr?.items || []).map(item => ({
    requisitionItem: item._id,
    product: item.product?._id || item.product,
    productCode: item.productCode,
    productName: item.productName,
    quantity: item.requiredQty,
    unit: item.unit || 'Box',
    offeredRate: 0,
    discount: 0,
    schemeDiscount: 0,
    scheme: '',
    gstPercentage: item.gstPercentage ?? 18,
  })),
  freight: 0,
  loading: 0,
  insurance: 0,
  creditDays: 0,
  paymentTerms: '',
  promisedDeliveryDate: '',
  deliveryTimeline: '',
  remarks: '',
});

const toEditorOffer = offer => ({
  ...offer,
  key: offer._id || `${Date.now()}-${Math.random()}`,
  supplier: offer.supplier?._id || offer.supplier,
  promisedDeliveryDate: offer.promisedDeliveryDate?.slice?.(0, 10) || '',
  items: (offer.items || []).map(item => ({
    ...item,
    product: item.product?._id || item.product,
    requisitionItem: item.requisitionItem?._id || item.requisitionItem,
  })),
});

const offerPayload = offer => ({
  supplier: offer.supplier,
  items: offer.items.map(item => ({
    requisitionItem: item.requisitionItem,
    product: item.product,
    quantity: item.quantity,
    unit: item.unit,
    offeredRate: Number(item.offeredRate || 0),
    discount: Number(item.discount || 0),
    schemeDiscount: Number(item.schemeDiscount || 0),
    scheme: item.scheme || '',
    gstPercentage: Number(item.gstPercentage ?? 18),
  })),
  freight: Number(offer.freight || 0),
  loading: Number(offer.loading || 0),
  insurance: Number(offer.insurance || 0),
  creditDays: Number(offer.creditDays || 0),
  paymentTerms: offer.paymentTerms || '',
  promisedDeliveryDate: offer.promisedDeliveryDate || undefined,
  deliveryTimeline: offer.deliveryTimeline || '',
  remarks: offer.remarks || '',
});

const localOfferTotal = offer => {
  const lines = offer.items.reduce((sum, item) => {
    const base = Number(item.quantity || 0) * Number(item.offeredRate || 0);
    const taxable = Math.max(0, base - Number(item.discount || 0) - Number(item.schemeDiscount || 0));
    return sum + taxable + taxable * Number(item.gstPercentage || 0) / 100;
  }, 0);
  return lines + Number(offer.freight || 0) + Number(offer.loading || 0) + Number(offer.insurance || 0);
};

const SupplierQuotationPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('po.management');
  const canApprove = hasPermission('po.approve');
  const [searchParams] = useSearchParams();
  const requestedId = searchParams.get('id');
  const requestedPR = searchParams.get('purchaseRequisition');
  const shouldCreate = searchParams.get('create') === '1';

  const [quotations, setQuotations] = useState([]);
  const [approvedPRs, setApprovedPRs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [editor, setEditor] = useState(null);
  const [editorPR, setEditorPR] = useState(null);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectOffer, setSelectOffer] = useState(null);
  const [selectionRemarks, setSelectionRemarks] = useState('');

  const showError = useCallback((err, fallback) => {
    const text = err?.message || fallback;
    setError(text);
    message.error(text);
  }, []);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const res = await purchaseService.getSupplierQuotations({
        page, limit: pagination.pageSize, status,
        purchaseRequisition: requestedPR || undefined,
      });
      if (res.success) {
        setQuotations(res.data || []);
        setPagination(prev => ({ ...prev, current: res.pagination?.currentPage || page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { showError(err, 'Unable to load supplier quotations'); }
    finally { setLoading(false); }
  }, [pagination.pageSize, requestedPR, showError, status]);

  const loadDetail = useCallback(async (id) => {
    setActionLoading(true);
    setError('');
    try {
      const res = await purchaseService.getSupplierQuotation(id);
      if (res.success) setDetail(res.data);
    } catch (err) { showError(err, 'Unable to load quotation comparison'); }
    finally { setActionLoading(false); }
  }, [showError]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    if (!canManage) return;
    Promise.all([
      purchaseService.getPurchaseRequisitions({ status: 'approved', limit: 100 }),
      masterService.getSuppliers({ status: 'active', limit: 100 }),
      masterService.getWarehouses({ status: 'active', limit: 100 }),
    ]).then(([prRes, supplierRes, warehouseRes]) => {
      if (prRes.success) setApprovedPRs(prRes.data || []);
      if (supplierRes.success) setSuppliers(supplierRes.data || []);
      if (warehouseRes.success) setWarehouses(warehouseRes.data || []);
    }).catch(err => showError(err, 'Unable to load supplier or warehouse options'));
  }, [canManage, showError]);
  useEffect(() => { if (requestedId) loadDetail(requestedId); }, [loadDetail, requestedId]);
  useEffect(() => {
    if (!canManage || !shouldCreate || !requestedPR || editor) return;
    purchaseService.getPurchaseRequisition(requestedPR).then(res => {
      if (res.success) {
        const pr = res.data;
        setEditorPR(pr);
        setEditor({ purchaseRequisition: pr._id, warehouse: pr.warehouse?._id || pr.warehouse || '', offers: [emptyOffer(pr), emptyOffer(pr)] });
      }
    }).catch(err => showError(err, 'Unable to start supplier comparison'));
  }, [canManage, editor, requestedPR, shouldCreate, showError]);

  const startCreate = async (prId) => {
    if (!canManage || !prId) return;
    try {
      const res = await purchaseService.getPurchaseRequisition(prId);
      const pr = res.data;
      setEditorPR(pr);
      setDetail(null);
      setEditor({ purchaseRequisition: pr._id, warehouse: pr.warehouse?._id || pr.warehouse || '', offers: [emptyOffer(pr), emptyOffer(pr)] });
    } catch (err) { showError(err, 'Unable to load purchase requisition'); }
  };

  const startEdit = () => {
    if (!canManage) return;
    const pr = detail.purchaseRequisition;
    setEditorPR(pr);
    setEditor({
      id: detail._id,
      purchaseRequisition: pr?._id || pr,
      warehouse: detail.warehouse?._id || detail.warehouse,
      offers: detail.offers.map(toEditorOffer),
    });
  };

  const updateOffer = (index, field, value) => setEditor(prev => ({
    ...prev,
    offers: prev.offers.map((offer, i) => i === index ? { ...offer, [field]: value } : offer),
  }));

  const updateOfferItem = (offerIndex, itemIndex, field, value) => setEditor(prev => ({
    ...prev,
    offers: prev.offers.map((offer, i) => i !== offerIndex ? offer : {
      ...offer,
      items: offer.items.map((item, j) => j === itemIndex ? { ...item, [field]: value } : item),
    }),
  }));

  const addOffer = () => setEditor(prev => ({ ...prev, offers: [...prev.offers, emptyOffer(editorPR)] }));
  const removeOffer = index => setEditor(prev => ({ ...prev, offers: prev.offers.filter((_, i) => i !== index) }));

  const saveDraft = async () => {
    setError('');
    if (!editor.warehouse) return showError(null, 'Select a receiving warehouse');
    if (editor.offers.length < 2) return showError(null, 'Add complete offers from at least two suppliers');
    if (editor.offers.some(offer => !offer.supplier)) return showError(null, 'Select a supplier for every offer');
    if (new Set(editor.offers.map(offer => offer.supplier)).size !== editor.offers.length) return showError(null, 'Each offer must use a different supplier');
    if (editor.offers.some(offer => offer.items.length !== (editorPR?.items?.length || 0))) return showError(null, 'Every supplier must quote every requisition item');
    setSaving(true);
    try {
      const payload = { purchaseRequisition: editor.purchaseRequisition, warehouse: editor.warehouse, offers: editor.offers.map(offerPayload) };
      const res = editor.id
        ? await purchaseService.updateSupplierQuotation(editor.id, payload)
        : await purchaseService.createSupplierQuotation(payload);
      if (res.success) {
        message.success(res.message || 'Supplier quotation draft saved');
        setEditor(null);
        await loadDetail(res.data._id);
        await load(1);
        navigate(`/sales-purchase/supplier-quotations?id=${res.data._id}`, { replace: true });
      }
    } catch (err) { showError(err, 'Unable to save supplier quotation'); }
    finally { setSaving(false); }
  };

  const runAction = async (action) => {
    if (!detail) return;
    if (action === 'submit' && (detail.offers?.length || 0) < 2) {
      return showError(null, 'At least two complete supplier offers are required before submission');
    }
    setActionLoading(true);
    setError('');
    try {
      let res;
      if (action === 'submit') res = await purchaseService.submitSupplierQuotation(detail._id);
      if (action === 'compare') res = await purchaseService.compareSupplierQuotation(detail._id);
      if (action === 'convert') res = await purchaseService.convertSupplierQuotationToPO(detail._id);
      if (res?.success) {
        message.success(res.message || 'Action completed');
        if (action === 'convert') {
          const poId = res.data?.po?._id;
          navigate(poId ? `/sales-purchase/po-management?po=${poId}` : '/sales-purchase/po-management');
          return;
        }
        await loadDetail(detail._id);
        await load(pagination.current);
      }
    } catch (err) { showError(err, 'Supplier quotation action failed'); }
    finally { setActionLoading(false); }
  };

  const confirmSupplier = async () => {
    setActionLoading(true);
    try {
      const res = await purchaseService.selectFinalSupplier(detail._id, { offerId: selectOffer.offer, remarks: selectionRemarks });
      if (res.success) {
        message.success('Final supplier selected');
        setSelectOffer(null);
        setSelectionRemarks('');
        await loadDetail(detail._id);
        await load(pagination.current);
      }
    } catch (err) { showError(err, 'Unable to select final supplier'); }
    finally { setActionLoading(false); }
  };

  const deleteDraft = async record => {
    try {
      const res = await purchaseService.deleteSupplierQuotation(record._id);
      if (res.success) {
        message.success('Supplier quotation deleted');
        if (detail?._id === record._id) setDetail(null);
        load(1);
      }
    } catch (err) { showError(err, 'Unable to delete draft'); }
  };

  const comparison = detail?.comparison || [];
  const selectedOfferId = String(detail?.selectedOffer || '');
  const supplierOptions = suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode || 'No code'})` }));
  const usedSuppliers = useMemo(() => new Set(editor?.offers?.map(offer => offer.supplier).filter(Boolean) || []), [editor]);
  const closeEditor = () => {
    if (!editor?.id && shouldCreate) navigate('/sales-purchase/supplier-quotations', { replace: true });
    setEditor(null);
  };

  const listColumns = [
    { title: 'Quotation', dataIndex: 'quotationNumber', render: value => <span className="font-mono text-xs font-semibold">{value}</span> },
    { title: 'PR', render: (_, row) => row.prNumber || row.purchaseRequisition?.prNumber || '—' },
    { title: 'Offers', render: (_, row) => <Tag>{row.offers?.length || 0} suppliers</Tag> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={STATUS_COLORS[value]}>{value?.replace(/_/g, ' ')}</Tag> },
    { title: 'Selected Supplier', render: (_, row) => row.selectedSupplier?.companyName || '—' },
    { title: 'Created', dataIndex: 'createdAt', render: value => value ? new Date(value).toLocaleDateString('en-IN') : '—' },
    { title: 'Actions', render: (_, row) => <Space>
      <Button size="small" icon={<EyeOutlined />} onClick={() => loadDetail(row._id)}>Open</Button>
      {canManage && row.status === 'draft' && <Popconfirm title="Delete this draft?" onConfirm={() => deleteDraft(row)}>
        <Button size="small" danger icon={<DeleteOutlined />} />
      </Popconfirm>}
    </Space> },
  ];

  return <div>
    <div className="flex justify-between items-center mb-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Supplier Quotation Comparison</h1>
        <p className="text-sm text-gray-500 mt-0.5">Capture complete supplier offers, compare landed costs, and select the final supplier</p>
      </div>
      <Space>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={() => load(pagination.current)} />
        {canManage && <Select
          placeholder="Create for approved PR"
          className="w-64"
          showSearch
          optionFilterProp="label"
          value={undefined}
          onChange={startCreate}
          options={approvedPRs.map(pr => ({ value: pr._id, label: `${pr.prNumber} · ${pr.items?.length || 0} items` }))}
        />}
      </Space>
    </div>

    {error && <Alert className="mb-4" type="error" showIcon closable message={error} onClose={() => setError('')} />}

    <Card size="small" className="mb-4">
      <Space wrap>
        <Select placeholder="Status" allowClear className="w-44" value={status} onChange={setStatus}
          options={Object.keys(STATUS_COLORS).map(value => ({ value, label: value.replace(/_/g, ' ') }))} />
        {requestedPR && <Tag color="blue">Filtered by PR</Tag>}
      </Space>
    </Card>

    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table columns={listColumns} dataSource={quotations} rowKey="_id" loading={loading} size="small"
        pagination={{ ...pagination, onChange: (page, pageSize) => { setPagination(prev => ({ ...prev, pageSize })); load(page); } }} />
    </div>

    <Modal title={editor?.id ? 'Edit Supplier Quotation Draft' : 'New Supplier Quotation Comparison'} open={!!editor}
      onCancel={closeEditor} width={1100} footer={[
        <Button key="cancel" onClick={closeEditor}>Cancel</Button>,
        <Button key="save" type="primary" loading={saving} onClick={saveDraft}>Save Draft</Button>,
      ]} destroyOnHidden>
      {editor && <div className="space-y-4">
        <Row gutter={12}>
          <Col span={12}><label className="text-xs text-gray-500 block mb-1">Purchase Requisition</label>
            <Input value={editorPR?.prNumber || ''} disabled /></Col>
          <Col span={12}><label className="text-xs text-gray-500 block mb-1">Receiving Warehouse *</label>
            <Select className="w-full" showSearch optionFilterProp="label" value={editor.warehouse || undefined}
              onChange={value => setEditor(prev => ({ ...prev, warehouse: value }))}
              options={warehouses.map(w => ({ value: w._id, label: `${w.name} (${w.warehouseCode || 'No code'})` }))} /></Col>
        </Row>
        {editor.offers.map((offer, offerIndex) => <Card key={offer.key} size="small"
          title={`Supplier Offer ${offerIndex + 1}`}
          extra={editor.offers.length > 1 && <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeOffer(offerIndex)} /> }>
          <Row gutter={12} className="mb-3">
            <Col span={12}><label className="text-xs text-gray-500 block mb-1">Supplier *</label>
              <Select className="w-full" showSearch optionFilterProp="label" value={offer.supplier || undefined}
                onChange={value => updateOffer(offerIndex, 'supplier', value)}
                options={supplierOptions.map(option => ({ ...option, disabled: usedSuppliers.has(option.value) && option.value !== offer.supplier }))} /></Col>
            <Col span={4}><label className="text-xs text-gray-500 block mb-1">Credit Days</label>
              <InputNumber min={0} className="w-full" value={offer.creditDays} onChange={value => updateOffer(offerIndex, 'creditDays', value || 0)} /></Col>
            <Col span={8}><label className="text-xs text-gray-500 block mb-1">Promised Delivery</label>
              <Input type="date" value={offer.promisedDeliveryDate} onChange={event => updateOffer(offerIndex, 'promisedDeliveryDate', event.target.value)} /></Col>
          </Row>
          <Table size="small" pagination={false} rowKey={(row, index) => row.requisitionItem || index} dataSource={offer.items}
            columns={[
              { title: 'PR Item', render: (_, item) => <div><b>{item.productName}</b><div className="text-xs text-gray-400">{item.productCode} · {item.quantity} {item.unit}</div></div> },
              { title: 'Rate', width: 110, render: (_, item, itemIndex) => <InputNumber min={0} className="w-full" value={item.offeredRate} onChange={value => updateOfferItem(offerIndex, itemIndex, 'offeredRate', value || 0)} /> },
              { title: 'Discount ₹', width: 120, render: (_, item, itemIndex) => <InputNumber min={0} className="w-full" value={item.discount} onChange={value => updateOfferItem(offerIndex, itemIndex, 'discount', value || 0)} /> },
              { title: 'Scheme Disc. ₹', width: 130, render: (_, item, itemIndex) => <InputNumber min={0} className="w-full" value={item.schemeDiscount} onChange={value => updateOfferItem(offerIndex, itemIndex, 'schemeDiscount', value || 0)} /> },
              { title: 'Scheme', width: 120, render: (_, item, itemIndex) => <Input value={item.scheme} onChange={event => updateOfferItem(offerIndex, itemIndex, 'scheme', event.target.value)} /> },
              { title: 'GST %', width: 90, render: (_, item, itemIndex) => <InputNumber min={0} max={100} className="w-full" value={item.gstPercentage} onChange={value => updateOfferItem(offerIndex, itemIndex, 'gstPercentage', value ?? 0)} /> },
            ]} />
          <Row gutter={8} className="mt-3">
            {['freight', 'loading', 'insurance'].map(field => <Col span={4} key={field}><label className="text-xs text-gray-500 block mb-1 capitalize">{field} ₹</label>
              <InputNumber min={0} className="w-full" value={offer[field]} onChange={value => updateOffer(offerIndex, field, value || 0)} /></Col>)}
            <Col span={6}><label className="text-xs text-gray-500 block mb-1">Payment Terms</label>
              <Input value={offer.paymentTerms} onChange={event => updateOffer(offerIndex, 'paymentTerms', event.target.value)} /></Col>
            <Col span={6}><label className="text-xs text-gray-500 block mb-1">Delivery Timeline</label>
              <Input value={offer.deliveryTimeline} onChange={event => updateOffer(offerIndex, 'deliveryTimeline', event.target.value)} /></Col>
          </Row>
          <div className="flex justify-between items-end mt-3">
            <Input.TextArea className="max-w-2xl" rows={2} placeholder="Supplier offer remarks" value={offer.remarks}
              onChange={event => updateOffer(offerIndex, 'remarks', event.target.value)} />
            <div className="font-semibold text-[#FF5F03]">Estimated landed total: ₹{localOfferTotal(offer).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</div>
          </div>
        </Card>)}
        <Button icon={<PlusOutlined />} onClick={addOffer}>Add Supplier Offer</Button>
      </div>}
    </Modal>

    <Modal title={detail?.quotationNumber || 'Supplier Quotation'} open={!!detail && !editor} width={1050}
      onCancel={() => setDetail(null)} footer={[
        canManage && detail?.status === 'draft' && <Button key="edit" icon={<EditOutlined />} onClick={startEdit}>Edit Draft</Button>,
        canManage && detail?.status === 'draft' && <Button key="submit" type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={() => runAction('submit')}>Submit</Button>,
        canManage && detail?.status === 'submitted' && <Button key="compare" type="primary" loading={actionLoading} onClick={() => runAction('compare')}>Compare Offers</Button>,
        canManage && detail?.status === 'selected' && <Button key="convert" type="primary" icon={<ShoppingCartOutlined />} loading={actionLoading} onClick={() => runAction('convert')}>Convert to PO</Button>,
        detail?.status === 'po_created' && <Button key="open-po" type="primary" onClick={() => navigate(`/sales-purchase/po-management?po=${detail.linkedPO?._id || detail.linkedPO}`)}>Open PO</Button>,
        <Button key="close" onClick={() => setDetail(null)}>Close</Button>,
      ].filter(Boolean)}>
      {detail && <div className="space-y-4">
        <Space><Tag color={STATUS_COLORS[detail.status]}>{detail.status.replace(/_/g, ' ')}</Tag><span>PR: <b>{detail.prNumber || detail.purchaseRequisition?.prNumber}</b></span><span>{detail.offers?.length || 0} complete supplier offers</span></Space>
        {detail.status !== 'draft' && <Alert type="info" showIcon message="Submitted quotation values are immutable. Server-calculated commercial values are shown below." />}
        {(comparison.length > 0 || detail.status === 'compared') && <>
          <Divider orientation="left">Server Comparison & Ranking</Divider>
          {comparison.length ? <Table size="small" pagination={false} rowKey="offer" dataSource={comparison} columns={[
            { title: 'Rank', dataIndex: 'rank', width: 70, render: value => <Tag color={value === 1 ? 'gold' : 'default'}>#{value}</Tag> },
            { title: 'Supplier', dataIndex: 'supplierName' },
            { title: 'Landed Total', dataIndex: 'totalLandedAmount', render: value => <b>₹{Number(value || 0).toLocaleString('en-IN')}</b> },
            { title: 'Normalized Unit Cost', dataIndex: 'normalizedUnitCost', render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
            { title: 'Rating', dataIndex: 'supplierRating' },
            { title: 'Credit Days', dataIndex: 'creditDays' },
            { title: 'Action', render: (_, row) => canApprove && detail.status === 'compared'
              ? <Button size="small" type={row.rank === 1 ? 'primary' : 'default'} icon={<CheckOutlined />} onClick={() => setSelectOffer(row)}>Select</Button>
              : String(row.offer) === selectedOfferId ? <Tag color="green">Selected</Tag> : null },
          ]} /> : <Empty description="Run comparison to calculate ranks" />}
        </>}
        <Divider orientation="left">Supplier Offers</Divider>
        {(detail.offers || []).map(offer => <Card size="small" key={offer._id} className={String(offer._id) === selectedOfferId ? 'border-green-500' : ''}
          title={<Space><span>{offer.supplierSnapshot?.companyName || offer.supplier?.companyName}</span>{offer.rank && <Tag>Rank #{offer.rank}</Tag>}{String(offer._id) === selectedOfferId && <Tag color="green">Final Supplier</Tag>}</Space>}
          extra={<b>₹{Number(offer.totalLandedAmount || 0).toLocaleString('en-IN')}</b>}>
          <Table size="small" pagination={false} rowKey="_id" dataSource={offer.items} columns={[
            { title: 'Product', render: (_, item) => `${item.productName} (${item.productCode || '—'})` },
            { title: 'Qty', render: (_, item) => `${item.quantity} ${item.unit}` },
            { title: 'Rate', dataIndex: 'offeredRate', render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
            { title: 'Discount', render: (_, item) => `₹${Number(item.discount || 0).toLocaleString('en-IN')} + ₹${Number(item.schemeDiscount || 0).toLocaleString('en-IN')}` },
            { title: 'Taxable', dataIndex: 'taxableAmount', render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
            { title: 'Tax', dataIndex: 'taxAmount', render: value => `₹${Number(value || 0).toLocaleString('en-IN')}` },
            { title: 'Line Total', dataIndex: 'lineTotal', render: value => <b>₹{Number(value || 0).toLocaleString('en-IN')}</b> },
          ]} />
          <div className="text-xs text-gray-500 mt-2">Freight ₹{offer.freight || 0} · Loading ₹{offer.loading || 0} · Insurance ₹{offer.insurance || 0} · Credit {offer.creditDays || 0} days · {offer.paymentTerms || 'No payment terms'}</div>
        </Card>)}
      </div>}
    </Modal>

    <Modal title={`Select ${selectOffer?.supplierName || 'final supplier'}`} open={!!selectOffer} onCancel={() => setSelectOffer(null)}
      onOk={confirmSupplier} okText="Confirm Selection" confirmLoading={actionLoading}>
      <Alert type="warning" showIcon message="Selection is final and locks the winning commercial offer for PO conversion." className="mb-3" />
      <Input.TextArea rows={3} value={selectionRemarks} onChange={event => setSelectionRemarks(event.target.value)} placeholder="Selection remarks (optional)" />
    </Modal>
  </div>;
};

export default SupplierQuotationPage;
