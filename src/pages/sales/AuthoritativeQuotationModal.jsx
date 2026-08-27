import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import masterService from '../../services/masterService.js';
import salesService from '../../services/salesService.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const activeType = (item) => item?.isActive !== false && item?.status !== 'inactive';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const productIdOf = (item) => item.product?._id || item.product || item.productId;
const rowsOf = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  return response?.data?.items || response?.data?.rows || response?.data?.products || [];
};
const summaryOf = (response) => {
  const data = response?.data || {};
  return data.summary || data.totals || response?.summary || data;
};

const AuthoritativeQuotationModal = ({ open, onClose, onSuccess }) => {
  const [dealerTypes, setDealerTypes] = useState([]);
  const [dealerType, setDealerType] = useState(undefined);
  const [scope, setScope] = useState('dealer');
  const [dealers, setDealers] = useState([]);
  const [dealerSearch, setDealerSearch] = useState('');
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [dealerLoading, setDealerLoading] = useState(false);
  const [customer, setCustomer] = useState({ name: '', phone: '', address: '' });
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [pricing, setPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    quotationDate: dayjs().format('YYYY-MM-DD'), validUntil: dayjs().add(30, 'day').format('YYYY-MM-DD'),
    freightCharges: 0, loadingCharges: 0, installationCharges: 0, otherCharges: 0,
    remarks: '', termsAndConditions: 'Prices are subject to change. GST extra as applicable.',
  });
  const pricingTimer = useRef(null);
  const previewRequest = useRef(0);
  const productRequest = useRef(0);

  const selectedType = dealerTypes.find((type) => type._id === dealerType);
  const targetReady = scope === 'walk_in' || Boolean(selectedDealer?._id);
  const target = useMemo(() => ({
    scope,
    ...(dealerType ? { dealerType } : {}),
    ...(selectedDealer?._id ? { dealer: selectedDealer._id } : {}),
  }), [scope, dealerType, selectedDealer]);

  useEffect(() => {
    if (!open) return;
    masterService.getDealerTypes({ limit: 200 }).then((response) => {
      if (response.success) {
        const types = (response.data || []).filter(activeType);
        setDealerTypes(types);
        setDealerType((current) => current || types[0]?._id);
      }
    }).catch((error) => message.error(error.message || 'Failed to load Dealer Types'));
  }, [open]);

  useEffect(() => {
    if (!open || scope !== 'dealer' || !dealerType) { setDealers([]); return undefined; }
    const timer = setTimeout(async () => {
      setDealerLoading(true);
      try {
        const response = await salesService.searchDealers({ q: dealerSearch || '', page: 1, limit: 50, dealerType, pricingTier: selectedType?.pricingTier });
        if (response.success) {
          const result = response.data || [];
          setDealers(result.filter((dealer) => (dealer.dealerType?._id || dealer.dealerType) === dealerType));
        }
      } catch (error) { message.error(error.message || 'Dealer search failed'); }
      finally { setDealerLoading(false); }
    }, dealerSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, scope, dealerType, selectedType?.pricingTier, dealerSearch]);

  useEffect(() => {
    if (!open || !targetReady || productSearch.trim().length < 2) { setProductResults([]); return undefined; }
    const timer = setTimeout(async () => {
      const requestId = ++productRequest.current;
      setProductLoading(true);
      try {
        const response = await salesService.searchProducts({ q: productSearch.trim(), page: 1, limit: 30, quantity: 1, ...target });
        if (requestId === productRequest.current && response.success) setProductResults(response.data || []);
      } catch (error) { if (requestId === productRequest.current) message.error(error.message || 'Product search failed'); }
      finally { if (requestId === productRequest.current) setProductLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [open, targetReady, productSearch, target]);

  const minimalItems = (source) => source.map((item) => ({
    product: productIdOf(item), quantity: Number(item.quantity || 1),
    ...(item.manualRate != null ? { manualRate: Number(item.manualRate) } : {}),
  }));

  const mergePreview = (source, response) => {
    const resolvedRows = rowsOf(response);
    return source.map((item, index) => {
      const resolved = resolvedRows.find((row) => productIdOf(row) === productIdOf(item)) || resolvedRows[index] || {};
      const pricingSnapshot = resolved.pricingSnapshot || {};
      return {
        ...item,
        baseRate: Number(resolved.baseRate ?? pricingSnapshot.baseRate ?? resolved.configuredRate ?? item.baseRate ?? 0),
        effectiveRate: Number(resolved.effectiveRate ?? pricingSnapshot.effectiveRate ?? resolved.finalRate ?? resolved.rate ?? item.effectiveRate ?? 0),
        minimumSellingRate: Number(resolved.minimumSellingRate ?? pricingSnapshot.minimumSellingRate ?? item.minimumSellingRate ?? 0),
        belowMinimum: Boolean(resolved.belowMinimum ?? pricingSnapshot.belowMinimum),
        source: resolved.source || pricingSnapshot.source || resolved.priceSource || item.source || 'Server pricing',
        lineSubtotal: Number(resolved.lineSubtotal ?? resolved.taxableAmount ?? resolved.subtotal ?? item.lineSubtotal ?? 0),
        taxAmount: Number(resolved.taxAmount ?? resolved.gstAmount ?? item.taxAmount ?? 0),
        lineTotal: Number(resolved.lineTotal ?? resolved.totalAmount ?? resolved.total ?? item.lineTotal ?? 0),
        pricingMessage: resolved.message || resolved.validationMessage || '',
        pricingPending: false,
      };
    });
  };

  const previewAll = useCallback(async (source, showError = true) => {
    if (!source.length) { setSummary({}); return source; }
    const requestId = ++previewRequest.current;
    setPricing(true);
    setItems((current) => current.map((item) => ({ ...item, pricingPending: true })));
    try {
      const response = await salesService.previewQuotationPricing({
        ...target,
        customerName: scope === 'walk_in' ? customer.name || undefined : undefined,
        customerPhone: scope === 'walk_in' ? customer.phone || undefined : undefined,
        customerAddress: scope === 'walk_in' ? customer.address || undefined : undefined,
        quotationDate: form.quotationDate,
        freightCharges: Number(form.freightCharges || 0),
        loadingCharges: Number(form.loadingCharges || 0),
        installationCharges: Number(form.installationCharges || 0),
        otherCharges: Number(form.otherCharges || 0),
        items: minimalItems(source),
      });
      if (!response.success) throw new Error(response.message || 'Pricing preview failed');
      const merged = mergePreview(source, response);
      if (requestId !== previewRequest.current) return source;
      setItems(merged);
      setSummary(summaryOf(response));
      return merged;
    } catch (error) {
      if (requestId === previewRequest.current) {
        setItems((current) => current.map((item) => ({ ...item, pricingPending: false })));
        if (showError) message.error(error.message || 'Could not resolve authoritative prices');
      }
      throw error;
    } finally { if (requestId === previewRequest.current) setPricing(false); }
  }, [target, scope, customer.name, customer.phone, customer.address, form.quotationDate, form.freightCharges, form.loadingCharges, form.installationCharges, form.otherCharges]);

  const queuePreview = (nextItems) => {
    clearTimeout(pricingTimer.current);
    pricingTimer.current = setTimeout(() => previewAll(nextItems).catch(() => {}), 350);
  };
  useEffect(() => () => clearTimeout(pricingTimer.current), []);
  useEffect(() => {
    if (items.length) queuePreview(items);
  }, [form.quotationDate, form.freightCharges, form.loadingCharges, form.installationCharges, form.otherCharges, customer.name, customer.phone, customer.address]);

  const changeTarget = (value) => {
    previewRequest.current += 1;
    productRequest.current += 1;
    setPricing(false);
    setProductLoading(false);
    if (value === 'walk_in') { setScope('walk_in'); setDealerType(undefined); }
    else { setScope('dealer'); setDealerType(value); }
    setSelectedDealer(null);
    setDealerSearch('');
    setProductSearch('');
    setItems([]);
    setSummary({});
  };

  const selectDealer = (dealerId) => {
    previewRequest.current += 1;
    productRequest.current += 1;
    setPricing(false);
    setProductLoading(false);
    const nextDealer = dealers.find((dealer) => dealer._id === dealerId) || null;
    setSelectedDealer(nextDealer);
    setItems([]);
    setSummary({});
    setProductSearch('');
    if (nextDealer) setCustomer((current) => ({ ...current, name: nextDealer.businessName || '', phone: nextDealer.mobile || '', address: nextDealer.address || '' }));
  };

  const addProduct = (product) => {
    if (items.some((item) => productIdOf(item) === product._id)) { message.warning('Product already added'); return; }
    const nextItems = [...items, {
      key: `${product._id}-${Date.now()}`, product: product._id,
      productName: product.itemName, productCode: product.productCode,
      productImage: product.images?.[0] || '', unit: product.unit || 'Box', quantity: 1,
      manualRate: null, baseRate: Number(product.baseRate || 0),
      effectiveRate: Number(product.effectiveRate || 0), minimumSellingRate: Number(product.minimumSellingRate || 0),
      source: product.source || 'Resolving…', pricingPending: true,
    }];
    setItems(nextItems);
    setProductSearch('');
    setProductResults([]);
    previewAll(nextItems).catch(() => {});
  };

  const updateItem = (key, changes) => {
    const nextItems = items.map((item) => item.key === key ? { ...item, ...changes } : item);
    setItems(nextItems);
    queuePreview(nextItems);
  };
  const removeItem = (key) => {
    const nextItems = items.filter((item) => item.key !== key);
    setItems(nextItems);
    if (nextItems.length) queuePreview(nextItems); else setSummary({});
  };

  const reset = () => {
    previewRequest.current += 1;
    productRequest.current += 1;
    setScope('dealer');
    setDealerType(dealerTypes[0]?._id);
    setSelectedDealer(null);
    setDealerSearch('');
    setCustomer({ name: '', phone: '', address: '' });
    setProductSearch('');
    setProductResults([]);
    setItems([]);
    setSummary({});
    setForm({ quotationDate: dayjs().format('YYYY-MM-DD'), validUntil: dayjs().add(30, 'day').format('YYYY-MM-DD'), freightCharges: 0, loadingCharges: 0, installationCharges: 0, otherCharges: 0, remarks: '', termsAndConditions: 'Prices are subject to change. GST extra as applicable.' });
  };

  const handleClose = () => { reset(); onClose(); };
  const handleSubmit = async () => {
    if (scope === 'dealer' && !selectedDealer) { message.error('Select a registered dealer'); return; }
    if (scope === 'walk_in' && !customer.name.trim()) { message.error('Enter the walk-in customer name'); return; }
    if (!items.length) { message.error('Add at least one product'); return; }
    setSubmitting(true);
    try {
      const pricedItems = await previewAll(items);
      const response = await salesService.createQuotation({
        ...target,
        customerType: scope === 'walk_in' ? 'retail' : undefined,
        customerName: customer.name || undefined,
        customerPhone: customer.phone || undefined,
        customerAddress: customer.address || undefined,
        quotationDate: form.quotationDate,
        validUntil: form.validUntil,
        freightCharges: Number(form.freightCharges || 0),
        loadingCharges: Number(form.loadingCharges || 0),
        installationCharges: Number(form.installationCharges || 0),
        otherCharges: Number(form.otherCharges || 0),
        remarks: form.remarks || '',
        termsAndConditions: form.termsAndConditions || '',
        items: minimalItems(pricedItems),
      });
      if (response.success) {
        message.success(`${response.data?.quotationNumber || 'Quotation'} created`);
        onSuccess?.();
        handleClose();
      }
    } catch (error) { message.error(error.message || 'Failed to create quotation'); }
    finally { setSubmitting(false); }
  };

  const columns = [
    { title: 'Product', width: 230, fixed: 'left', render: (_, item) => <div className="flex items-center gap-2">{item.productImage && <ProductImage src={item.productImage} size="sm" />}<div><div className="font-medium text-xs">{item.productName}</div><div className="text-[10px] text-gray-400">{item.productCode} · {item.unit}</div></div></div> },
    { title: 'Qty', width: 85, render: (_, item) => <InputNumber min={1} value={item.quantity} onChange={(value) => updateItem(item.key, { quantity: value || 1 })} className="w-full" /> },
    { title: 'Server price', width: 160, render: (_, item) => <div><strong className="text-green-700">{item.pricingPending ? 'Resolving…' : money(item.effectiveRate)}</strong><div className="text-[10px] text-gray-400">Base {money(item.baseRate)} · {item.source}</div></div> },
    { title: 'Optional manual rate', width: 170, render: (_, item) => <Space.Compact className="w-full"><InputNumber min={0} value={item.manualRate} placeholder={String(item.effectiveRate || 0)} onChange={(value) => updateItem(item.key, { manualRate: value })} prefix="₹" className="w-full" /><Button icon={<ReloadOutlined />} title="Use server rate" onClick={() => updateItem(item.key, { manualRate: null })} /></Space.Compact> },
    { title: 'Minimum / validation', width: 175, render: (_, item) => <div>{money(item.minimumSellingRate)}<div>{item.belowMinimum ? <Tag color="red"><WarningOutlined /> Below minimum</Tag> : <Tag color="green">Valid</Tag>}</div>{item.pricingMessage && <div className="text-[10px] text-gray-500">{item.pricingMessage}</div>}</div> },
    { title: 'Server total', width: 125, render: (_, item) => <div><strong>{money(item.lineTotal)}</strong>{item.taxAmount > 0 && <div className="text-[10px] text-gray-400">Tax {money(item.taxAmount)}</div>}</div> },
    { title: '', width: 45, fixed: 'right', render: (_, item) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(item.key)} /> },
  ];

  const total = summary.grandTotal ?? summary.total ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);

  return (
    <Modal title="New Quotation — authoritative pricing" open={open} onCancel={handleClose} footer={null} width="min(1220px, 96vw)" style={{ top: 20 }} destroyOnHidden>
      <div className="space-y-4 mt-3">
        <Card size="small" title="1. Customer pricing target">
          <div className="flex flex-wrap gap-2 mb-3">{dealerTypes.map((type) => <Button key={type._id} type={scope === 'dealer' && dealerType === type._id ? 'primary' : 'default'} onClick={() => changeTarget(type._id)}>{type.name}<span className="ml-1 text-[10px] opacity-70">{type.pricingTier}</span></Button>)}<Button type={scope === 'walk_in' ? 'primary' : 'default'} onClick={() => changeTarget('walk_in')}>Walk-in Retail</Button></div>
          {scope === 'dealer' ? <Row gutter={[12, 12]}><Col xs={24} md={12}><Select showSearch filterOption={false} onSearch={setDealerSearch} loading={dealerLoading} value={selectedDealer?._id} onChange={selectDealer} className="w-full" placeholder={`Search registered ${selectedType?.name || 'dealer'}`} options={dealers.map((dealer) => ({ value: dealer._id, label: `${dealer.businessName} (${dealer.dealerCode || 'No code'})` }))} /></Col><Col xs={24} md={12}>{selectedDealer && <Alert type="info" showIcon message={selectedDealer.businessName} description={`Dealer Type: ${selectedDealer.dealerType?.name || selectedType?.name || '—'} · Tier: ${selectedDealer.dealerType?.pricingTier || selectedType?.pricingTier || '—'}`} />}</Col></Row> : <Row gutter={[12, 12]}><Col xs={24} md={8}><Input value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="Walk-in name *" /></Col><Col xs={24} md={8}><Input value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Phone (optional)" /></Col><Col xs={24} md={8}><Input value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="Address (optional)" /></Col></Row>}
        </Card>

        <Card size="small" title="2. Products and pricing"><div className="relative mb-3"><Input prefix={<SearchOutlined />} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} disabled={!targetReady} placeholder={targetReady ? 'Search product name or code' : 'Select a registered dealer first'} suffix={productLoading ? 'Searching…' : null} />{productResults.length > 0 && <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-xl max-h-64 overflow-y-auto">{productResults.filter((product) => !items.some((item) => productIdOf(item) === product._id)).map((product) => <button type="button" key={product._id} className="w-full text-left px-3 py-2 border-b hover:bg-orange-50 flex justify-between" onClick={() => addProduct(product)}><span><span className="block font-medium text-sm">{product.itemName}</span><span className="block text-xs text-gray-400">{product.productCode} · {product.brand?.name || ''}</span></span><span className="font-semibold text-green-700">{money(product.effectiveRate ?? product.rate ?? product.baseRate)}</span></button>)}</div>}</div><Table rowKey="key" columns={columns} dataSource={items} pagination={false} loading={pricing} size="small" scroll={{ x: 1050 }} locale={{ emptyText: targetReady ? 'Search and add products.' : 'Choose a customer pricing target first.' }} /></Card>

        <Row gutter={[12, 12]}><Col xs={24} lg={15}><Card size="small" title="3. Quotation details"><div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><label className="text-xs text-gray-500">Quotation date<Input type="date" value={form.quotationDate} onChange={(event) => setForm((current) => ({ ...current, quotationDate: event.target.value }))} /></label><label className="text-xs text-gray-500">Valid until<Input type="date" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))} /></label></div><div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3"><InputNumber min={0} value={form.freightCharges} onChange={(value) => setForm((current) => ({ ...current, freightCharges: value || 0 }))} addonBefore="Freight" className="w-full" /><InputNumber min={0} value={form.loadingCharges} onChange={(value) => setForm((current) => ({ ...current, loadingCharges: value || 0 }))} addonBefore="Loading" className="w-full" /><InputNumber min={0} value={form.installationCharges} onChange={(value) => setForm((current) => ({ ...current, installationCharges: value || 0 }))} addonBefore="Install" className="w-full" /><InputNumber min={0} value={form.otherCharges} onChange={(value) => setForm((current) => ({ ...current, otherCharges: value || 0 }))} addonBefore="Other" className="w-full" /></div><Input.TextArea className="mt-3" rows={2} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Remarks" /><Input.TextArea className="mt-3" rows={2} value={form.termsAndConditions} onChange={(event) => setForm((current) => ({ ...current, termsAndConditions: event.target.value }))} placeholder="Terms and conditions" /></Card></Col><Col xs={24} lg={9}><Card size="small" title="Server preview summary"><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{money(summary.subtotal ?? summary.taxableAmount)}</strong></div><div className="flex justify-between"><span>Discount</span><strong>{money(summary.discountAmount ?? summary.totalDiscount)}</strong></div><div className="flex justify-between"><span>Tax</span><strong>{money(summary.taxAmount ?? summary.totalTax)}</strong></div><div className="flex justify-between border-t pt-2 text-base"><span>Total</span><strong className="text-green-700">{money(total)}</strong></div></div></Card></Col></Row>
        <Alert type="info" showIcon message="Pricing, discount, GST, and minimum-rate checks come from the Sales Order price-preview service. Quotation lines submit only product, quantity, and an explicit optional manual rate." />
        <div className="flex justify-end gap-2"><Button onClick={handleClose}>Cancel</Button><Button type="primary" icon={<PlusOutlined />} onClick={handleSubmit} loading={submitting}>Create Quotation</Button></div>
      </div>
    </Modal>
  );
};

export default AuthoritativeQuotationModal;
