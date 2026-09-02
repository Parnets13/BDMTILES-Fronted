import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Alert, Button, Card, Col, Divider, Input, InputNumber, Modal, Popconfirm, Row,
  Select, Space, Statistic, Table, Tag, Tooltip, message,
} from 'antd';
import {
  CheckOutlined, DeleteOutlined, EditOutlined, EyeOutlined,
  PrinterOutlined, ReloadOutlined, SearchOutlined, SendOutlined, ShopOutlined,
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const STATUS_COLORS = {
  draft: 'default', submitted: 'orange', pending_approval: 'orange', approved: 'cyan',
  rejected: 'red', sent: 'blue', partial_received: 'geekblue', received: 'green', cancelled: 'red',
};
const STATUS_OPTIONS = Object.keys(STATUS_COLORS).map(value => ({ value, label: value.replace(/_/g, ' ') }));
const dateValue = value => value ? new Date(value).toISOString().slice(0, 10) : '';
const money = value => Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const idOf = value => value?._id || value || '';

const PurchaseOrderPage = () => {
  const { hasPermission } = useAuth();
  const [searchParams] = useSearchParams();
  const requestedPO = searchParams.get('po');
  const canManage = hasPermission('po.management');
  const canApprove = hasPermission('po.approve');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(undefined);
  const [stats, setStats] = useState({});
  const [editorPO, setEditorPO] = useState(undefined);
  const [viewPO, setViewPO] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionModal, setActionModal] = useState(null);
  const [actionRemarks, setActionRemarks] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError] = useState('');

  const fetchStats = useCallback(() => {
    purchaseService.getPOStats().then(res => { if (res.success) setStats(res.data || {}); }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    setPageError('');
    try {
      const res = await purchaseService.getPOs({ page, limit: pageSize, search, status });
      if (res.success) {
        setOrders(res.data || []);
        setPagination({ current: res.pagination?.currentPage || page, pageSize, total: res.pagination?.totalItems || 0 });
      }
    } catch (err) {
      setPageError(err.message || 'Unable to load purchase orders');
    } finally { setLoading(false); }
  }, [search, status]);

  useEffect(() => { fetchOrders(1, pagination.pageSize); fetchStats(); }, [fetchOrders, fetchStats, pagination.pageSize]);

  const openDetail = useCallback(async (id) => {
    setDetailLoading(true);
    setPageError('');
    try {
      const res = await purchaseService.getPO(id);
      if (res.success) setViewPO(res.data);
    } catch (err) {
      const text = err.message || 'Unable to load purchase order';
      setPageError(text);
      message.error(text);
    } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { if (requestedPO) openDetail(requestedPO); }, [openDetail, requestedPO]);

  const refresh = async () => {
    await fetchOrders(pagination.current, pagination.pageSize);
    fetchStats();
  };

  const submitPO = async record => {
    setActionLoading(true);
    try {
      const res = await purchaseService.submitPO(record._id);
      if (res.success) {
        message.success(res.message || 'Purchase order submitted for approval');
        setViewPO(prev => prev?._id === record._id ? res.data?.po || prev : prev);
        refresh();
      }
    } catch (err) { message.error(err.message || 'Unable to submit purchase order'); }
    finally { setActionLoading(false); }
  };

  const runApproval = async () => {
    setActionLoading(true);
    try {
      const service = actionModal.type === 'approve' ? purchaseService.approvePO : purchaseService.rejectPO;
      const res = await service(actionModal.po._id, { remarks: actionRemarks });
      if (res.success) {
        message.success(res.message || `Purchase order ${actionModal.type}d`);
        setActionModal(null);
        setViewPO(prev => prev?._id === res.data?._id ? res.data : prev);
        refresh();
      }
    } catch (err) { message.error(err.message || 'Purchase order approval action failed'); }
    finally { setActionLoading(false); }
  };

  const deletePO = async id => {
    try {
      const res = await purchaseService.deletePO(id);
      if (res.success) { message.success('PO deleted'); refresh(); }
    } catch (err) { message.error(err.message || 'Unable to delete PO'); }
  };

  const printPO = async record => {
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) return message.error('Allow pop-ups to print the purchase order');
    popup.opener = null;
    popup.document.body.textContent = 'Preparing purchase order…';
    try {
      const res = await purchaseService.printPO(record._id);
      const data = res.data;
      popup.document.body.textContent = '';
      popup.document.title = `PO ${data.documentNumber}`;
      const root = popup.document.createElement('div');
      root.style.cssText = 'font-family:Arial,sans-serif;padding:24px;color:#222';
      const title = popup.document.createElement('h1');
      title.textContent = `Purchase Order ${data.documentNumber}`;
      root.appendChild(title);
      const meta = popup.document.createElement('p');
      meta.textContent = `Date: ${new Date(data.documentDate).toLocaleDateString('en-IN')} | Status: ${data.status} | Supplier: ${data.supplier?.companyName || '—'} | Warehouse: ${data.receivingWarehouse?.name || '—'}`;
      root.appendChild(meta);
      const table = popup.document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;margin-top:20px';
      const header = table.insertRow();
      ['Product', 'Qty', 'Rate', 'Discounts', 'Tax', 'Line Total'].forEach(label => {
        const cell = header.insertCell(); cell.textContent = label; cell.style.cssText = 'border:1px solid #bbb;padding:8px;font-weight:bold;background:#eee';
      });
      (data.items || []).forEach(item => {
        const row = table.insertRow();
        [item.productName, `${item.quantity} ${item.unit}`, `₹${money(item.rate)}`, `₹${money(Number(item.discount || 0) + Number(item.schemeDiscount || 0))}`, `₹${money(item.gstAmount)}`, `₹${money(item.totalAmount)}`].forEach(value => {
          const cell = row.insertCell(); cell.textContent = value; cell.style.cssText = 'border:1px solid #bbb;padding:8px';
        });
      });
      root.appendChild(table);
      const totals = popup.document.createElement('pre');
      totals.style.cssText = 'font:14px Arial;text-align:right;line-height:1.8';
      totals.textContent = `Subtotal: ₹${money(data.totals.subtotal)}\nDiscount: ₹${money(data.totals.totalDiscount)}\nGST: ₹${money(data.totals.totalTax)}\nFreight / Loading / Insurance: ₹${money(Number(data.totals.freight || 0) + Number(data.totals.loading || 0) + Number(data.totals.insurance || 0))}\nGrand Total: ₹${money(data.totals.grandTotal)}`;
      root.appendChild(totals);
      popup.document.body.appendChild(root);
      popup.focus();
      popup.print();
    } catch (err) {
      popup.close();
      message.error(err.message || 'Unable to prepare PO print');
    }
  };

  const openEdit = async record => {
    if (record.sourceSupplierQuotation || record.sourceRequisition) {
      message.info('Converted purchase orders are commercially read-only. Submit or action the draft without changing its source values.');
      return;
    }
    try {
      const res = await purchaseService.getPO(record._id);
      setEditorPO(res.data);
    } catch (err) { message.error(err.message || 'Unable to load PO for editing'); }
  };

  const actionButtons = record => <Space size="small" wrap>
    <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => openDetail(record._id)} /></Tooltip>
    <Tooltip title="Print"><Button type="text" size="small" icon={<PrinterOutlined />} onClick={() => printPO(record)} /></Tooltip>
    {canManage && record.status === 'draft' && <>
      {!record.sourceSupplierQuotation && !record.sourceRequisition && <>
        <Tooltip title="Edit draft"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(record)} /></Tooltip>
        <Popconfirm title="Delete this PO?" onConfirm={() => deletePO(record._id)}><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Popconfirm>
      </>}
      <Popconfirm title="Submit this PO for approval?" onConfirm={() => submitPO(record)}><Button size="small" type="primary" icon={<SendOutlined />}>Submit</Button></Popconfirm>
    </>}
    {canApprove && ['submitted', 'pending_approval'].includes(record.status) && <>
      <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => { setActionModal({ type: 'approve', po: record }); setActionRemarks(''); }}>Approve</Button>
      <Button size="small" danger onClick={() => { setActionModal({ type: 'reject', po: record }); setActionRemarks(''); }}>Reject</Button>
    </>}
  </Space>;

  const columns = [
    { title: 'PO #', dataIndex: 'poNumber', width: 135, render: value => <span className="text-xs font-mono text-blue-600 font-medium">{value}</span> },
    { title: 'Date', dataIndex: 'poDate', width: 105, render: value => value ? new Date(value).toLocaleDateString('en-IN') : '—' },
    { title: 'Supplier', render: (_, row) => <div><div className="font-medium">{row.supplierName || row.supplier?.companyName || '—'}</div><div className="text-xs text-gray-400">{row.supplier?.supplierCode || ''}</div></div> },
    { title: 'Items', render: (_, row) => row.items?.length || 0, width: 70 },
    { title: 'Grand Total', dataIndex: 'grandTotal', width: 130, render: value => <b>₹{money(value)}</b> },
    { title: 'Status', dataIndex: 'status', width: 135, render: value => <Tag color={STATUS_COLORS[value]}>{value?.replace(/_/g, ' ')}</Tag> },
    { title: 'Source', width: 105, render: (_, row) => row.sourceSupplierQuotation ? <Tag color="purple">Quotation</Tag> : row.sourceRequisition ? <Tag color="blue">PR</Tag> : <Tag>Direct</Tag> },
    { title: 'Actions', width: 300, render: (_, row) => actionButtons(row) },
  ];

  return <div>
    <div className="flex justify-between items-center mb-5">
      <div><h1 className="text-2xl font-bold text-gray-800">Purchase Order Management</h1><p className="text-sm text-gray-500 mt-0.5">Draft, submit, approve, and print supplier purchase orders</p></div>
      <Space>
        {canManage && <ModuleRecycleBin module="purchase" title="Deleted Purchase Orders" onRestore={refresh} />}
      </Space>
    </div>
    {pageError && <Alert type="error" showIcon closable className="mb-4" message={pageError} onClose={() => setPageError('')} />}
    <Row gutter={12} className="mb-4">
      <Col span={4}><Card size="small"><Statistic title="Total POs" value={stats.total || 0} prefix={<ShopOutlined />} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="Pending Approval" value={stats.pendingApproval || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="Partial" value={stats.partialReceived || 0} valueStyle={{ color: '#2f54eb' }} /></Card></Col>
      <Col span={4}><Card size="small"><Statistic title="Received" value={stats.received || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
    </Row>
    <Card size="small" className="mb-4"><Space wrap>
      <Input placeholder="Search PO #, supplier..." prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} className="w-64" allowClear />
      <Select placeholder="Status" options={STATUS_OPTIONS} value={status} onChange={setStatus} allowClear className="w-44" />
      <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatus(undefined); }}>Reset</Button>
    </Space></Card>
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading} size="small" scroll={{ x: 1200 }}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: total => `${total} purchase orders` }}
        onChange={page => { setPagination(prev => ({ ...prev, current: page.current, pageSize: page.pageSize })); fetchOrders(page.current, page.pageSize); }} />
    </div>

    {editorPO && <PurchaseOrderEditor po={editorPO} onClose={() => setEditorPO(undefined)} onSuccess={refresh} />}

    <Modal title={`Purchase Order ${viewPO?.poNumber || ''}`} open={!!viewPO} width={950} confirmLoading={detailLoading}
      onCancel={() => setViewPO(null)} footer={viewPO ? [
        <Button key="print" icon={<PrinterOutlined />} onClick={() => printPO(viewPO)}>Print</Button>,
        canManage && viewPO.status === 'draft' && !viewPO.sourceSupplierQuotation && !viewPO.sourceRequisition && <Button key="edit" icon={<EditOutlined />} onClick={() => { setViewPO(null); setEditorPO(viewPO); }}>Edit Draft</Button>,
        canManage && viewPO.status === 'draft' && <Button key="submit" type="primary" icon={<SendOutlined />} loading={actionLoading} onClick={() => submitPO(viewPO)}>Submit</Button>,
        canApprove && ['submitted', 'pending_approval'].includes(viewPO.status) && <Button key="approve" type="primary" onClick={() => { setActionModal({ type: 'approve', po: viewPO }); setActionRemarks(''); }}>Approve</Button>,
        canApprove && ['submitted', 'pending_approval'].includes(viewPO.status) && <Button key="reject" danger onClick={() => { setActionModal({ type: 'reject', po: viewPO }); setActionRemarks(''); }}>Reject</Button>,
        <Button key="close" onClick={() => setViewPO(null)}>Close</Button>,
      ].filter(Boolean) : null}>
      {viewPO && <div className="space-y-4">
        <Space wrap><Tag color={STATUS_COLORS[viewPO.status]}>{viewPO.status?.replace(/_/g, ' ')}</Tag><b>{viewPO.supplierName || viewPO.supplier?.companyName}</b><span>{viewPO.items?.length || 0} items</span></Space>
        {(viewPO.sourceSupplierQuotation || viewPO.sourceRequisition) && <Alert type="info" showIcon message={`Converted from ${viewPO.sourceSupplierQuotation ? 'a selected supplier quotation' : 'a purchase requisition'}; source commercial values are read-only.`} />}
        <Row gutter={12}>
          <Col span={8}><Card size="small" title="PO Date">{viewPO.poDate ? new Date(viewPO.poDate).toLocaleDateString('en-IN') : '—'}</Card></Col>
          <Col span={8}><Card size="small" title="Expected Delivery">{viewPO.expectedDeliveryDate ? new Date(viewPO.expectedDeliveryDate).toLocaleDateString('en-IN') : '—'}</Card></Col>
          <Col span={8}><Card size="small" title="Payment Terms">{viewPO.paymentTerms || '—'} {viewPO.creditDays ? `(${viewPO.creditDays} days)` : ''}</Card></Col>
        </Row>
        <Table size="small" pagination={false} rowKey={(row, index) => row._id || index} dataSource={viewPO.items || []} columns={[
          { title: 'Image', width: 65, render: (_, item) => <ProductImage src={item.productImage || item.product?.images?.[0] || item.images?.[0]} size="md" /> },
          { title: 'Product', render: (_, item) => <div><b>{item.productName || item.product?.itemName}</b><div className="text-xs text-gray-400">{item.productCode || item.product?.productCode}</div></div> },
          { title: 'Qty', render: (_, item) => `${item.quantity} ${item.unit}` },
          { title: 'Rate', dataIndex: 'rate', render: value => `₹${money(value)}` },
          { title: 'Discount', render: (_, item) => `₹${money(Number(item.discount || 0) + Number(item.schemeDiscount || 0))}` },
          { title: 'Taxable', dataIndex: 'taxableAmount', render: value => `₹${money(value)}` },
          { title: 'GST', dataIndex: 'gstAmount', render: value => `₹${money(value)}` },
          { title: 'Server Line Total', dataIndex: 'totalAmount', render: value => <b>₹{money(value)}</b> },
        ]} />
        <div className="bg-orange-50 rounded-lg p-4 grid grid-cols-2 gap-2 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><b>₹{money(viewPO.subtotal)}</b></div>
          <div className="flex justify-between"><span>Discount</span><b>-₹{money(viewPO.totalDiscount)}</b></div>
          <div className="flex justify-between"><span>GST</span><b>₹{money(viewPO.totalTax)}</b></div>
          <div className="flex justify-between"><span>Freight / Loading / Insurance</span><b>₹{money(Number(viewPO.freight || 0) + Number(viewPO.loading || 0) + Number(viewPO.insurance || 0))}</b></div>
          <div className="col-span-2 border-t pt-2 flex justify-between text-lg"><b>Grand Total</b><b className="text-[#FF5F03]">₹{money(viewPO.grandTotal)}</b></div>
        </div>
        {viewPO.remarks && <Alert type="warning" message={viewPO.remarks} />}
      </div>}
    </Modal>

    <Modal title={`${actionModal?.type === 'approve' ? 'Approve' : 'Reject'} ${actionModal?.po?.poNumber || ''}`} open={!!actionModal}
      onCancel={() => setActionModal(null)} onOk={runApproval} confirmLoading={actionLoading} okText={actionModal?.type === 'approve' ? 'Approve' : 'Reject'}
      okButtonProps={{ danger: actionModal?.type === 'reject' }}>
      <Input.TextArea rows={3} value={actionRemarks} onChange={event => setActionRemarks(event.target.value)} placeholder="Approval remarks (optional)" />
    </Modal>
  </div>;
};

const PurchaseOrderEditor = ({ po, onClose, onSuccess }) => {
  const [suppliers, setSuppliers] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(po?.supplier && typeof po.supplier === 'object' ? po.supplier : null);
  const [items, setItems] = useState((po?.items || []).map(item => ({
    ...item, key: item._id || `${Date.now()}-${Math.random()}`, product: idOf(item.product),
    productImage: item.productImage || item.product?.images?.[0] || item.images?.[0] || '',
  })));
  const [form, setForm] = useState({
    receivingWarehouse: idOf(po?.receivingWarehouse), poDate: dateValue(po?.poDate) || dateValue(new Date()),
    expectedDeliveryDate: dateValue(po?.expectedDeliveryDate), freight: po?.freight || 0, loading: po?.loading || 0,
    insurance: po?.insurance || 0, paymentTerms: po?.paymentTerms || '', creditDays: po?.creditDays || 0,
    deliveryAddress: po?.deliveryAddress || '', remarks: po?.remarks || '', amendmentReason: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      masterService.getSuppliers({ status: 'active', limit: 100 }),
      masterService.getWarehouses({ status: 'active', limit: 100 }),
    ]).then(([supplierRes, warehouseRes]) => {
      if (supplierRes.success) setSuppliers(supplierRes.data || []);
      if (warehouseRes.success) setWarehouses(warehouseRes.data || []);
    }).catch(err => setError(err.message || 'Unable to load supplier or warehouse options'));
  }, []);

  useEffect(() => {
    if (productSearch.length < 2) { setProducts([]); return; }
    const timer = setTimeout(() => productService.getProducts({ search: productSearch, limit: 10 })
      .then(res => { if (res.success) setProducts(res.data || []); })
      .catch(err => setError(err.message || 'Unable to search products')), 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const supplierOptions = useMemo(() => suppliers
    .filter(supplier => !supplierSearch || `${supplier.companyName} ${supplier.supplierCode || ''}`.toLowerCase().includes(supplierSearch.toLowerCase()))
    .map(supplier => ({ value: supplier._id, label: `${supplier.companyName} (${supplier.supplierCode || 'No code'})`, supplier })), [supplierSearch, suppliers]);

  const addProduct = product => {
    if (items.some(item => item.product === product._id)) return message.warning('Product already added');
    setItems(prev => [...prev, {
      key: `${Date.now()}-${Math.random()}`, product: product._id, productName: product.itemName,
      productCode: product.productCode, productImage: product.images?.[0] || '', quantity: 1, unit: product.unit || 'Box',
      rate: product.purchaseRate || product.dealerRate || 0, discount: 0, schemeDiscount: 0,
      scheme: '', gstPercentage: product.gst ?? 18,
    }]);
    setProductSearch(''); setProducts([]);
  };
  const updateItem = (key, field, value) => setItems(prev => prev.map(item => item.key === key ? { ...item, [field]: value } : item));
  const lineEstimate = item => {
    const base = Number(item.quantity || 0) * Number(item.rate || 0);
    const taxable = Math.max(0, base - Number(item.discount || 0) - Number(item.schemeDiscount || 0));
    const tax = taxable * Number(item.gstPercentage || 0) / 100;
    return { taxable, tax, total: taxable + tax };
  };
  const estimates = items.reduce((total, item) => {
    const line = lineEstimate(item);
    return { taxable: total.taxable + line.taxable, tax: total.tax + line.tax, total: total.total + line.total };
  }, { taxable: 0, tax: 0, total: 0 });

  const save = async () => {
    setError('');
    if (!selectedSupplier) return setError('Select a supplier');
    if (!form.receivingWarehouse) return setError('Receiving warehouse is required');
    if (!items.length) return setError('Add at least one product');
    if (items.some(item => Number(item.quantity) <= 0 || Number(item.rate) < 0 || Number(item.discount || 0) + Number(item.schemeDiscount || 0) > Number(item.quantity) * Number(item.rate))) {
      return setError('Check quantities, rates, and absolute line discounts. Discounts cannot exceed a line base amount.');
    }
    if (!form.amendmentReason.trim()) return setError('Amendment reason is required when editing a draft');
    setSaving(true);
    try {
      const payload = {
        supplier: selectedSupplier._id, receivingWarehouse: form.receivingWarehouse,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        items: items.map(item => ({
          product: item.product, quantity: Number(item.quantity), unit: item.unit, rate: Number(item.rate),
          discount: Number(item.discount || 0), schemeDiscount: Number(item.schemeDiscount || 0), scheme: item.scheme || '',
          gstPercentage: Number(item.gstPercentage ?? 18),
        })),
        freight: Number(form.freight || 0), loading: Number(form.loading || 0), insurance: Number(form.insurance || 0),
        paymentTerms: form.paymentTerms, creditDays: Number(form.creditDays || 0), deliveryAddress: form.deliveryAddress,
        remarks: form.remarks, amendmentReason: form.amendmentReason.trim(),
      };
      const res = await purchaseService.updatePO(po._id, payload);
      if (res.success) {
        message.success('PO draft amended');
        onSuccess(); onClose();
      }
    } catch (err) { setError(err.message || 'Unable to save purchase order'); }
    finally { setSaving(false); }
  };

  const itemColumns = [
    { title: 'Product', width: 210, render: (_, item) => <div className="flex items-center gap-2"><ProductImage src={item.productImage || item.product?.images?.[0] || item.images?.[0]} size="sm" /><div><b>{item.productName}</b><div className="text-xs text-gray-400">{item.productCode}</div></div></div> },
    { title: 'Qty', width: 85, render: (_, item) => <InputNumber min={0.0001} value={item.quantity} onChange={value => updateItem(item.key, 'quantity', value)} className="w-full" /> },
    { title: 'Rate ₹', width: 100, render: (_, item) => <InputNumber min={0} value={item.rate} onChange={value => updateItem(item.key, 'rate', value)} className="w-full" /> },
    { title: 'Line Discount ₹', width: 125, render: (_, item) => <InputNumber min={0} value={item.discount} onChange={value => updateItem(item.key, 'discount', value || 0)} className="w-full" /> },
    { title: 'Scheme Discount ₹', width: 140, render: (_, item) => <InputNumber min={0} value={item.schemeDiscount} onChange={value => updateItem(item.key, 'schemeDiscount', value || 0)} className="w-full" /> },
    { title: 'Scheme', width: 110, render: (_, item) => <Input value={item.scheme} onChange={event => updateItem(item.key, 'scheme', event.target.value)} /> },
    { title: 'GST %', width: 85, render: (_, item) => <InputNumber min={0} max={100} value={item.gstPercentage} onChange={value => updateItem(item.key, 'gstPercentage', value ?? 0)} className="w-full" /> },
    { title: 'Est. Total', width: 105, render: (_, item) => <b>₹{money(lineEstimate(item).total)}</b> },
    { title: '', width: 45, render: (_, item) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => setItems(prev => prev.filter(row => row.key !== item.key))} /> },
  ];

  return <Modal title={`Amend Draft ${po.poNumber}`} open width={1150} onCancel={onClose}
    footer={[
      <Button key="cancel" onClick={onClose}>Cancel</Button>,
      <Button key="draft" loading={saving} onClick={save}>Save Amendment</Button>,
    ]} destroyOnHidden>
    <div className="space-y-4">
      {error && <Alert type="error" showIcon closable message={error} onClose={() => setError('')} />}
      <Alert type="info" showIcon message="Discount and scheme discount are absolute whole-line amounts. Final line and order totals are calculated by the server." />
      <Row gutter={12}>
        <Col span={8}><label className="text-xs text-gray-500 block mb-1">Supplier *</label>
          <Select className="w-full" showSearch filterOption={false} onSearch={setSupplierSearch} value={selectedSupplier?._id}
            onChange={value => setSelectedSupplier(suppliers.find(supplier => supplier._id === value))}
            options={supplierOptions.map(({ value, label }) => ({ value, label }))} /></Col>
        <Col span={8}><label className="text-xs text-gray-500 block mb-1">Receiving Warehouse *</label>
          <Select className="w-full" showSearch optionFilterProp="label" value={form.receivingWarehouse || undefined}
            onChange={value => setForm(prev => ({ ...prev, receivingWarehouse: value }))}
            options={warehouses.map(warehouse => ({ value: warehouse._id, label: `${warehouse.name} (${warehouse.warehouseCode || 'No code'})` }))} /></Col>
        <Col span={4}><label className="text-xs text-gray-500 block mb-1">PO Date</label><Input type="date" disabled value={form.poDate} /></Col>
        <Col span={4}><label className="text-xs text-gray-500 block mb-1">Expected Delivery</label><Input type="date" value={form.expectedDeliveryDate} onChange={event => setForm(prev => ({ ...prev, expectedDeliveryDate: event.target.value }))} /></Col>
      </Row>
      <div className="relative">
        <label className="text-xs text-gray-500 block mb-1">Add Products</label>
        <Input prefix={<SearchOutlined />} value={productSearch} onChange={event => setProductSearch(event.target.value)} placeholder="Search product name or code" />
        {products.length > 0 && <div className="absolute z-20 bg-white border rounded shadow w-full max-h-56 overflow-y-auto">
          {products.map(product => <div key={product._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer flex items-center gap-2" onClick={() => addProduct(product)}>
            <ProductImage src={product.images?.[0]} size="sm" />
            <div><b>{product.itemName}</b> <span className="text-xs text-gray-400">{product.productCode} · ₹{product.purchaseRate || product.dealerRate || 0}</span></div>
          </div>)}
        </div>}
      </div>
      <Table columns={itemColumns} dataSource={items} rowKey="key" size="small" pagination={false} scroll={{ x: 1050 }} locale={{ emptyText: 'Search and add at least one product' }} />
      <Divider />
      <Row gutter={12}>
        {['freight', 'loading', 'insurance'].map(field => <Col span={4} key={field}><label className="text-xs text-gray-500 block mb-1 capitalize">{field} ₹</label>
          <InputNumber min={0} className="w-full" value={form[field]} onChange={value => setForm(prev => ({ ...prev, [field]: value || 0 }))} /></Col>)}
        <Col span={5}><label className="text-xs text-gray-500 block mb-1">Payment Terms</label><Input value={form.paymentTerms} onChange={event => setForm(prev => ({ ...prev, paymentTerms: event.target.value }))} /></Col>
        <Col span={3}><label className="text-xs text-gray-500 block mb-1">Credit Days</label><InputNumber min={0} className="w-full" value={form.creditDays} onChange={value => setForm(prev => ({ ...prev, creditDays: value || 0 }))} /></Col>
        <Col span={4}><div className="bg-orange-50 border rounded p-2 text-right"><div className="text-xs text-gray-500">Estimated Grand Total</div><b className="text-[#FF5F03]">₹{money(estimates.total + Number(form.freight || 0) + Number(form.loading || 0) + Number(form.insurance || 0))}</b></div></Col>
      </Row>
      <Row gutter={12}>
        <Col span={12}><label className="text-xs text-gray-500 block mb-1">Delivery Address</label><Input.TextArea rows={2} value={form.deliveryAddress} onChange={event => setForm(prev => ({ ...prev, deliveryAddress: event.target.value }))} /></Col>
        <Col span={12}><label className="text-xs text-gray-500 block mb-1">Remarks</label><Input.TextArea rows={2} value={form.remarks} onChange={event => setForm(prev => ({ ...prev, remarks: event.target.value }))} /></Col>
      </Row>
      <div><label className="text-xs text-gray-500 block mb-1">Amendment Reason *</label><Input.TextArea rows={2} value={form.amendmentReason} onChange={event => setForm(prev => ({ ...prev, amendmentReason: event.target.value }))} placeholder="Explain why this draft is being amended" /></div>
    </div>
  </Modal>;
};

export default PurchaseOrderPage;
