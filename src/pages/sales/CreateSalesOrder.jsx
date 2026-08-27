import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, message } from 'antd';
import { DeleteOutlined, ReloadOutlined, SearchOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import salesService from '../../services/salesService.js';
import { createIdempotencyKey } from '../../config/api.js';
import masterService from '../../services/masterService.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const activeType = (item) => item?.isActive !== false && item?.status !== 'inactive';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const previewRows = (response) => {
  if (Array.isArray(response?.data)) return response.data;
  return response?.data?.items || response?.data?.rows || response?.data?.products || [];
};
const previewSummary = (response) => {
  const data = response?.data || {};
  return data.summary || response?.summary || data.totals || data;
};
const productIdOf = (item) => item.product?._id || item.product || item.productId;

const CreateSalesOrder = ({ onClose, onSuccess }) => {
  const [dealerTypes, setDealerTypes] = useState([]);
  const [dealerType, setDealerType] = useState(undefined);
  const [scope, setScope] = useState('dealer');
  const [dealers, setDealers] = useState([]);
  const [dealerSearch, setDealerSearch] = useState('');
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [dealerLoading, setDealerLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [walkIn, setWalkIn] = useState({ name: '', phone: '' });
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [productLoading, setProductLoading] = useState(false);
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({});
  const [pricing, setPricing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderData, setOrderData] = useState({
    orderDate: dayjs().format('YYYY-MM-DD'), expectedDeliveryDate: '', deliveryPriority: 'normal',
    deliveryAddress: '', freightCharges: 0, loadingCharges: 0, otherCharges: 0,
    advanceAmount: 0, remarks: '',
  });
  const priceTimer = useRef(null);
  const previewRequest = useRef(0);
  const productRequest = useRef(0);
  const createAttempt = useRef({ fingerprint: null, key: null });

  const selectedType = dealerTypes.find((type) => type._id === dealerType);
  const targetReady = scope === 'walk_in' || Boolean(selectedDealer?._id);
  const target = useMemo(() => ({
    scope,
    ...(dealerType ? { dealerType } : {}),
    ...(selectedDealer?._id ? { dealer: selectedDealer._id } : {}),
  }), [scope, dealerType, selectedDealer]);

  useEffect(() => {
    Promise.all([
      masterService.getDealerTypes({ limit: 200 }),
      masterService.getWarehouses({ limit: 100, status: 'active' }),
    ]).then(([typeResponse, warehouseResponse]) => {
      if (typeResponse.success) {
        const types = (typeResponse.data || []).filter(activeType);
        setDealerTypes(types);
        setDealerType(types[0]?._id);
      }
      if (warehouseResponse.success) setWarehouses(warehouseResponse.data || []);
    }).catch((error) => message.error(error.message || 'Failed to load order configuration'));
  }, []);

  useEffect(() => {
    if (scope !== 'dealer' || !dealerType) { setDealers([]); return undefined; }
    const timer = setTimeout(async () => {
      setDealerLoading(true);
      try {
        const response = await salesService.searchDealers({
          q: dealerSearch || '', page: 1, limit: 50,
          dealerType, pricingTier: selectedType?.pricingTier,
        });
        if (response.success) {
          const rows = response.data || [];
          setDealers(rows.filter((item) => (item.dealerType?._id || item.dealerType) === dealerType));
        }
      } catch (error) { message.error(error.message || 'Dealer search failed'); }
      finally { setDealerLoading(false); }
    }, dealerSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [scope, dealerType, selectedType?.pricingTier, dealerSearch]);

  useEffect(() => {
    if (!targetReady || productSearch.trim().length < 2) { setProductResults([]); return undefined; }
    const timer = setTimeout(async () => {
      const requestId = ++productRequest.current;
      setProductLoading(true);
      try {
        const response = await salesService.searchProducts({
          q: productSearch.trim(), page: 1, limit: 30, quantity: 1,
          ...target,
        });
        if (requestId === productRequest.current && response.success) setProductResults(response.data || []);
      } catch (error) { if (requestId === productRequest.current) message.error(error.message || 'Product search failed'); }
      finally { if (requestId === productRequest.current) setProductLoading(false); }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch, targetReady, target]);

  const minimalPreviewItems = (sourceItems) => sourceItems.map((item) => ({
    product: productIdOf(item),
    quantity: Number(item.quantity || 1),
    warehouse: item.warehouse || undefined,
    ...(item.manualRate != null ? { manualRate: Number(item.manualRate) } : {}),
  }));

  const mergePreview = (sourceItems, response) => {
    const rows = previewRows(response);
    return sourceItems.map((item, index) => {
      const resolved = rows.find((row) => productIdOf(row) === productIdOf(item)) || rows[index] || {};
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

  const previewAll = useCallback(async (sourceItems, showErrors = true) => {
    if (!sourceItems.length) { setSummary({}); return sourceItems; }
    const requestId = ++previewRequest.current;
    setPricing(true);
    setItems((current) => current.map((item) => ({ ...item, pricingPending: true })));
    try {
      const response = await salesService.previewPricing({
        ...target,
        customerName: scope === 'walk_in' ? walkIn.name || undefined : undefined,
        customerPhone: scope === 'walk_in' ? walkIn.phone || undefined : undefined,
        orderDate: orderData.orderDate,
        freightCharges: Number(orderData.freightCharges || 0),
        loadingCharges: Number(orderData.loadingCharges || 0),
        otherCharges: Number(orderData.otherCharges || 0),
        advanceAmount: Number(orderData.advanceAmount || 0),
        items: minimalPreviewItems(sourceItems),
      });
      if (!response.success) throw new Error(response.message || 'Pricing preview failed');
      const merged = mergePreview(sourceItems, response);
      if (requestId !== previewRequest.current) return sourceItems;
      setItems(merged);
      setSummary(previewSummary(response));
      return merged;
    } catch (error) {
      if (requestId === previewRequest.current) {
        setItems((current) => current.map((item) => ({ ...item, pricingPending: false })));
        if (showErrors) message.error(error.message || 'Could not resolve authoritative prices');
      }
      throw error;
    } finally { if (requestId === previewRequest.current) setPricing(false); }
  }, [target, scope, walkIn.name, walkIn.phone, orderData.orderDate, orderData.freightCharges, orderData.loadingCharges, orderData.otherCharges, orderData.advanceAmount]);

  const queuePreview = (nextItems) => {
    clearTimeout(priceTimer.current);
    priceTimer.current = setTimeout(() => previewAll(nextItems).catch(() => {}), 350);
  };

  useEffect(() => () => clearTimeout(priceTimer.current), []);
  useEffect(() => {
    if (items.length) queuePreview(items);
  }, [orderData.orderDate, orderData.freightCharges, orderData.loadingCharges, orderData.otherCharges, orderData.advanceAmount, walkIn.name, walkIn.phone]);

  const changeTargetType = (value) => {
    previewRequest.current += 1;
    productRequest.current += 1;
    setPricing(false);
    setProductLoading(false);
    if (value === 'walk_in') {
      setScope('walk_in');
      setDealerType(undefined);
    } else {
      setScope('dealer');
      setDealerType(value);
    }
    setSelectedDealer(null);
    setDealerSearch('');
    setProductSearch('');
    setItems([]);
    setSummary({});
  };

  const chooseDealer = (dealerId) => {
    previewRequest.current += 1;
    productRequest.current += 1;
    setPricing(false);
    setProductLoading(false);
    const chosen = dealers.find((item) => item._id === dealerId) || null;
    setSelectedDealer(chosen);
    setItems([]);
    setSummary({});
    setProductSearch('');
    if (chosen) {
      setOrderData((current) => ({ ...current, deliveryAddress: chosen.address || current.deliveryAddress }));
    }
  };

  const addProduct = (product) => {
    if (items.some((item) => productIdOf(item) === product._id)) { message.warning('Product already added'); return; }
    const nextItems = [...items, {
      key: `${product._id}-${Date.now()}`,
      product: product._id,
      productName: product.itemName,
      productCode: product.productCode,
      productImage: product.images?.[0] || '',
      brandName: product.brand?.name || '',
      unit: product.unit || 'Box',
      quantity: 1,
      warehouse: warehouses[0]?._id || '',
      manualRate: null,
      baseRate: Number(product.baseRate || 0),
      effectiveRate: Number(product.effectiveRate || 0),
      minimumSellingRate: Number(product.minimumSellingRate || 0),
      source: product.source || 'Resolving…',
      pricingPending: true,
    }];
    setItems(nextItems);
    setProductSearch('');
    setProductResults([]);
    previewAll(nextItems).catch(() => {});
  };

  const updateItem = (key, changes, reprice = false) => {
    const nextItems = items.map((item) => item.key === key ? { ...item, ...changes } : item);
    setItems(nextItems);
    if (reprice) queuePreview(nextItems);
  };

  const removeItem = (key) => {
    const nextItems = items.filter((item) => item.key !== key);
    setItems(nextItems);
    if (nextItems.length) queuePreview(nextItems); else setSummary({});
  };

  const handleSubmit = async (status) => {
    if (scope === 'dealer' && !selectedDealer) { message.error('Select a registered dealer'); return; }
    if (scope === 'walk_in' && !walkIn.name.trim()) { message.error('Enter the walk-in customer name'); return; }
    if (!items.length) { message.error('Add at least one product'); return; }
    if (items.some((item) => !item.warehouse)) { message.error('Select a warehouse for every product'); return; }
    setSubmitting(true);
    try {
      const pricedItems = await previewAll(items);
      const belowMinimum = pricedItems.filter((item) => item.belowMinimum);
      if (belowMinimum.length && status === 'confirmed') message.warning(`${belowMinimum.length} line(s) are below minimum selling rate and may require approval.`);
      const payload = {
        ...target,
        status,
        orderType: scope === 'walk_in' ? 'retail' : 'dealer',
        orderDate: orderData.orderDate,
        expectedDeliveryDate: orderData.expectedDeliveryDate || undefined,
        deliveryPriority: orderData.deliveryPriority,
        deliveryAddress: orderData.deliveryAddress,
        customerName: scope === 'walk_in' ? walkIn.name || undefined : undefined,
        customerPhone: scope === 'walk_in' ? walkIn.phone || undefined : undefined,
        items: minimalPreviewItems(pricedItems),
        freightCharges: Number(orderData.freightCharges || 0),
        loadingCharges: Number(orderData.loadingCharges || 0),
        otherCharges: Number(orderData.otherCharges || 0),
        advanceAmount: Number(orderData.advanceAmount || 0),
        remarks: orderData.remarks || '',
      };
      const fingerprint = JSON.stringify(payload);
      if (createAttempt.current.fingerprint !== fingerprint) {
        createAttempt.current = { fingerprint, key: createIdempotencyKey() };
      }
      const response = await salesService.createOrder(payload, createAttempt.current.key);
      if (response.success) {
        message.success(`Sales Order ${response.data?.orderNumber || ''} created`);
        onSuccess?.();
        onClose?.();
      }
    } catch (error) { message.error(error.message || 'Failed to create Sales Order'); }
    finally { setSubmitting(false); }
  };

  const columns = [
    { title: 'Product', width: 230, fixed: 'left', render: (_, item) => <div className="flex items-center gap-2">{item.productImage && <ProductImage src={item.productImage} size="sm" />}<div><div className="font-medium text-xs">{item.productName}</div><div className="text-[10px] text-gray-400">{item.productCode} · {item.brandName}</div></div></div> },
    { title: 'Qty', width: 85, render: (_, item) => <InputNumber min={1} value={item.quantity} onChange={(value) => updateItem(item.key, { quantity: value || 1 }, true)} className="w-full" /> },
    { title: 'Warehouse', width: 150, render: (_, item) => <Select value={item.warehouse} onChange={(value) => updateItem(item.key, { warehouse: value }, true)} className="w-full" options={warehouses.map((warehouse) => ({ value: warehouse._id, label: warehouse.name }))} placeholder="Required" /> },
    { title: 'Server price', width: 155, render: (_, item) => <div><div className="font-semibold text-green-700">{item.pricingPending ? 'Resolving…' : money(item.effectiveRate)}</div><div className="text-[10px] text-gray-400">Base {money(item.baseRate)} · {item.source}</div></div> },
    { title: 'Optional manual rate', width: 165, render: (_, item) => <Space.Compact className="w-full"><InputNumber min={0} value={item.manualRate} placeholder={String(item.effectiveRate || 0)} onChange={(value) => updateItem(item.key, { manualRate: value }, true)} prefix="₹" className="w-full" /><Button title="Use server rate" icon={<ReloadOutlined />} onClick={() => updateItem(item.key, { manualRate: null }, true)} /></Space.Compact> },
    { title: 'Minimum / validation', width: 170, render: (_, item) => <div><div>{money(item.minimumSellingRate)}</div>{item.belowMinimum ? <Tag color="red"><WarningOutlined /> Below minimum</Tag> : <Tag color="green">Valid</Tag>}{item.pricingMessage && <div className="text-[10px] text-gray-500">{item.pricingMessage}</div>}</div> },
    { title: 'Server total', width: 125, render: (_, item) => <div><strong>{money(item.lineTotal)}</strong>{item.taxAmount > 0 && <div className="text-[10px] text-gray-400">Tax {money(item.taxAmount)}</div>}</div> },
    { title: '', width: 45, fixed: 'right', render: (_, item) => <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeItem(item.key)} /> },
  ];

  const summaryTotal = summary.grandTotal ?? summary.total ?? items.reduce((total, item) => total + Number(item.lineTotal || 0), 0);

  return (
    <Modal open onCancel={onClose} footer={null} width="min(1280px, 96vw)" style={{ top: 18 }} destroyOnHidden title="Create Sales Order — authoritative pricing">
      <div className="space-y-4">
        <Card size="small" title="1. Customer pricing target">
          <div className="flex gap-2 flex-wrap mb-3">
            {dealerTypes.map((type) => <Button key={type._id} type={scope === 'dealer' && dealerType === type._id ? 'primary' : 'default'} onClick={() => changeTargetType(type._id)}>{type.name}<span className="ml-1 text-[10px] opacity-70">{type.pricingTier}</span></Button>)}
            <Button type={scope === 'walk_in' ? 'primary' : 'default'} onClick={() => changeTargetType('walk_in')}>Walk-in Retail</Button>
          </div>
          {scope === 'dealer' ? <Row gutter={[12, 12]}><Col xs={24} md={12}><div className="text-xs text-gray-500 mb-1">Registered {selectedType?.name || 'dealer'} *</div><Select showSearch filterOption={false} onSearch={setDealerSearch} loading={dealerLoading} value={selectedDealer?._id} onChange={chooseDealer} className="w-full" placeholder="Search name, code, or phone" options={dealers.map((item) => ({ value: item._id, label: `${item.businessName} (${item.dealerCode || 'No code'})` }))} /></Col><Col xs={24} md={12}>{selectedDealer && <Alert type="info" showIcon message={selectedDealer.businessName} description={`Dealer Type: ${selectedDealer.dealerType?.name || selectedType?.name || '—'} · Tier: ${selectedDealer.dealerType?.pricingTier || selectedType?.pricingTier || '—'}`} />}</Col></Row> : <Row gutter={[12, 12]}><Col xs={24} md={12}><Input value={walkIn.name} onChange={(event) => setWalkIn((current) => ({ ...current, name: event.target.value }))} placeholder="Walk-in customer name *" /></Col><Col xs={24} md={12}><Input value={walkIn.phone} onChange={(event) => setWalkIn((current) => ({ ...current, phone: event.target.value }))} placeholder="Walk-in phone (optional)" /></Col></Row>}
        </Card>

        <Card size="small" title="2. Products and server pricing">
          <div className="relative mb-3">
            <Input prefix={<SearchOutlined />} value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder={targetReady ? 'Search product name, code, or barcode' : 'Select a registered dealer first'} disabled={!targetReady} suffix={productLoading ? 'Searching…' : null} />
            {productResults.length > 0 && <div className="absolute z-50 left-0 right-0 top-full mt-1 bg-white border rounded-lg shadow-xl max-h-64 overflow-y-auto">{productResults.filter((product) => !items.some((item) => productIdOf(item) === product._id)).map((product) => <button type="button" key={product._id} className="w-full text-left px-3 py-2 border-b hover:bg-orange-50 flex justify-between" onClick={() => addProduct(product)}><span><span className="block text-sm font-medium">{product.itemName}</span><span className="block text-xs text-gray-400">{product.productCode} · {product.brand?.name || ''}</span></span><span className="text-right"><span className="block font-semibold text-green-700">{money(product.effectiveRate ?? product.rate ?? product.baseRate)}</span><span className="block text-[10px] text-gray-400">{product.source || 'Preview on add'}</span></span></button>)}</div>}
          </div>
          <Table rowKey="key" columns={columns} dataSource={items} pagination={false} loading={pricing} size="small" scroll={{ x: 1200 }} locale={{ emptyText: targetReady ? 'Search and add products.' : 'Choose a customer pricing target first.' }} />
        </Card>

        <Row gutter={[12, 12]}>
          <Col xs={24} lg={15}><Card size="small" title="3. Order details"><div className="grid grid-cols-1 sm:grid-cols-3 gap-3"><label className="text-xs text-gray-500">Order date<Input type="date" value={orderData.orderDate} onChange={(event) => setOrderData((current) => ({ ...current, orderDate: event.target.value }))} /></label><label className="text-xs text-gray-500">Expected delivery<Input type="date" value={orderData.expectedDeliveryDate} onChange={(event) => setOrderData((current) => ({ ...current, expectedDeliveryDate: event.target.value }))} /></label><label className="text-xs text-gray-500">Priority<Select value={orderData.deliveryPriority} onChange={(value) => setOrderData((current) => ({ ...current, deliveryPriority: value }))} className="w-full" options={[{ value: 'normal', label: 'Normal' }, { value: 'urgent', label: 'Urgent' }, { value: 'vip', label: 'VIP' }]} /></label></div><Input.TextArea className="mt-3" value={orderData.deliveryAddress} onChange={(event) => setOrderData((current) => ({ ...current, deliveryAddress: event.target.value }))} rows={2} placeholder="Delivery address" /><Input.TextArea className="mt-3" value={orderData.remarks} onChange={(event) => setOrderData((current) => ({ ...current, remarks: event.target.value }))} rows={2} placeholder="Remarks" /></Card></Col>
          <Col xs={24} lg={9}><Card size="small" title="Server preview summary"><div className="space-y-2 text-sm"><div className="flex justify-between"><span>Subtotal</span><strong>{money(summary.subtotal ?? summary.taxableAmount)}</strong></div><div className="flex justify-between"><span>Tax</span><strong>{money(summary.taxAmount ?? summary.totalTax)}</strong></div><div className="flex justify-between"><span>Discount</span><strong>{money(summary.discountAmount ?? summary.totalDiscount)}</strong></div><div className="flex justify-between border-t pt-2 text-base"><span>Total</span><strong className="text-green-700">{money(summaryTotal)}</strong></div><div className="grid grid-cols-2 gap-2 pt-2"><InputNumber min={0} value={orderData.freightCharges} onChange={(value) => setOrderData((current) => ({ ...current, freightCharges: value || 0 }))} addonBefore="Freight" className="w-full" /><InputNumber min={0} value={orderData.advanceAmount} onChange={(value) => setOrderData((current) => ({ ...current, advanceAmount: value || 0 }))} addonBefore="Advance" className="w-full" /></div></div></Card></Col>
        </Row>
        <Alert type="info" showIcon message="Product taxes, discounts, minimum-rate validation, and effective prices are resolved by the server. Only product, quantity, warehouse, and an explicit optional manual rate are submitted per line." />
        <div className="flex justify-end gap-2"><Button onClick={onClose}>Cancel</Button><Button onClick={() => handleSubmit('draft')} loading={submitting}>Save draft</Button><Button type="primary" onClick={() => handleSubmit('confirmed')} loading={submitting}>Confirm order</Button></div>
      </div>
    </Modal>
  );
};

export default CreateSalesOrder;
