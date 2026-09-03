import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Card, Col, Input, InputNumber, Modal, Row, Select, Space, Table, Tag, message } from 'antd';
import {
  AppstoreAddOutlined, CheckCircleOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined,
  SafetyCertificateOutlined, ShopOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import masterService from '../../services/masterService.js';
import salesService from '../../services/salesService.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import QuotationProductBrowser from '../../components/sales/QuotationProductBrowser.jsx';

const activeType = (item) => item?.isActive !== false && item?.status !== 'inactive';
const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const productIdOf = (item) => item.product?._id || item.product || item.productId || item._id;
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
  const [browserOpen, setBrowserOpen] = useState(false);
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

  const selectedType = dealerTypes.find((type) => type._id === dealerType);
  const targetReady = scope === 'walk_in' ? Boolean(customer.name.trim()) : Boolean(selectedDealer?._id);
  const target = useMemo(() => ({
    scope,
    ...(dealerType ? { dealerType } : {}),
    ...(selectedDealer?._id ? { dealer: selectedDealer._id } : {}),
  }), [scope, dealerType, selectedDealer]);
  const pricingLabel = scope === 'walk_in'
    ? `Walk-in retail · ${customer.name || 'customer name required'}`
    : selectedDealer
      ? `${selectedDealer.businessName} · ${selectedDealer.dealerType?.pricingTier || selectedType?.pricingTier || 'configured tier'}`
      : `${selectedType?.name || 'Dealer'} · select a registered customer`;

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
        const response = await salesService.searchDealers({
          q: dealerSearch || '', page: 1, limit: 50, dealerType,
          pricingTier: selectedType?.pricingTier,
        });
        if (response.success) {
          const result = response.data || [];
          setDealers(result.filter((dealer) => (dealer.dealerType?._id || dealer.dealerType) === dealerType));
        }
      } catch (error) { message.error(error.message || 'Dealer search failed'); }
      finally { setDealerLoading(false); }
    }, dealerSearch ? 300 : 0);
    return () => clearTimeout(timer);
  }, [open, scope, dealerType, selectedType?.pricingTier, dealerSearch]);

  const minimalItems = (source) => source.map((item) => ({
    product: productIdOf(item), quantity: Number(item.quantity || 1),
    ...(item.manualRate != null ? { manualRate: Number(item.manualRate) } : {}),
  }));

  const mergePreview = (source, response) => {
    const resolvedRows = rowsOf(response);
    return source.map((item, index) => {
      const resolved = resolvedRows.find((row) => String(productIdOf(row)) === String(productIdOf(item))) || resolvedRows[index] || {};
      const pricingSnapshot = resolved.pricingSnapshot || {};
      return {
        ...item,
        baseRate: Number(resolved.baseRate ?? pricingSnapshot.baseRate ?? resolved.configuredRate ?? item.baseRate ?? 0),
        effectiveRate: Number(resolved.effectiveRate ?? pricingSnapshot.effectiveRate ?? resolved.finalRate ?? resolved.rate ?? item.effectiveRate ?? 0),
        minimumSellingRate: Number(resolved.minimumSellingRate ?? pricingSnapshot.minimumSellingRate ?? item.minimumSellingRate ?? 0),
        belowMinimum: Boolean(resolved.belowMinimum ?? pricingSnapshot.belowMinimum),
        source: resolved.sourceName || resolved.source || pricingSnapshot.sourceName || pricingSnapshot.source || resolved.priceSource || item.source || 'Server pricing',
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

  const clearResolvedLines = () => {
    previewRequest.current += 1;
    setPricing(false);
    setBrowserOpen(false);
    setItems([]);
    setSummary({});
  };

  const changeTarget = (value) => {
    clearResolvedLines();
    if (value === 'walk_in') { setScope('walk_in'); setDealerType(undefined); }
    else { setScope('dealer'); setDealerType(value); }
    setSelectedDealer(null);
    setDealerSearch('');
    setCustomer({ name: '', phone: '', address: '' });
  };

  const selectDealer = (dealerId) => {
    clearResolvedLines();
    const nextDealer = dealers.find((dealer) => dealer._id === dealerId) || null;
    setSelectedDealer(nextDealer);
    if (nextDealer) {
      setCustomer({
        name: nextDealer.businessName || '',
        phone: nextDealer.mobile || '',
        address: nextDealer.address || '',
      });
    }
  };

  const addProducts = (products) => {
    const existing = new Set(items.map((item) => String(productIdOf(item))));
    const additions = products.filter((product) => !existing.has(String(product._id))).map((product) => ({
      key: `${product._id}-${Date.now()}-${Math.random()}`,
      product: product._id,
      productName: product.itemName,
      productCode: product.productCode,
      productImage: product.images?.[0] || '',
      unit: product.unit || 'Box',
      quantity: 1,
      stockAvailable: Number(product.stock?.availableQty ?? product.stockAvailable ?? 0),
      manualRate: null,
      baseRate: Number(product.baseRate || 0),
      effectiveRate: Number(product.effectiveRate || 0),
      minimumSellingRate: Number(product.minimumSellingRate || 0),
      source: product.sourceName || product.source || 'Resolving…',
      pricingPending: true,
    }));
    const nextItems = [...items, ...additions];
    setItems(nextItems);
    setBrowserOpen(false);
    if (additions.length) previewAll(nextItems).catch(() => {});
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
    setScope('dealer');
    setDealerType(dealerTypes[0]?._id);
    setSelectedDealer(null);
    setDealerSearch('');
    setCustomer({ name: '', phone: '', address: '' });
    setBrowserOpen(false);
    setItems([]);
    setSummary({});
    setForm({
      quotationDate: dayjs().format('YYYY-MM-DD'), validUntil: dayjs().add(30, 'day').format('YYYY-MM-DD'),
      freightCharges: 0, loadingCharges: 0, installationCharges: 0, otherCharges: 0,
      remarks: '', termsAndConditions: 'Prices are subject to change. GST extra as applicable.',
    });
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
    {
      title: 'Product', width: 280, fixed: 'left',
      render: (_, item) => (
        <div className="flex items-center gap-3">
          {item.productImage
            ? <ProductImage src={item.productImage} size="md" />
            : <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-slate-100"><ShopOutlined className="text-slate-300" /></div>}
          <div className="min-w-0">
            <div className="truncate text-xs font-semibold text-slate-800">{item.productName}</div>
            <div className="text-[10px] text-slate-400">{item.productCode || 'No code'} · {item.unit}</div>
            <div className="text-[10px] text-emerald-600">Branch stock at selection: {Number(item.stockAvailable || 0).toLocaleString('en-IN')}</div>
          </div>
        </div>
      ),
    },
    { title: 'Quantity', width: 105, render: (_, item) => <InputNumber min={1} value={item.quantity} onChange={(value) => updateItem(item.key, { quantity: value || 1 })} className="w-full" /> },
    {
      title: 'Selling rate', width: 190,
      render: (_, item) => <div><strong className="text-emerald-700">{item.pricingPending ? 'Resolving…' : money(item.effectiveRate)}</strong><div className="max-w-44 truncate text-[10px] text-slate-400">Base {money(item.baseRate)} · {item.source}</div></div>,
    },
    {
      title: 'Override rate', width: 180,
      render: (_, item) => <Space.Compact className="w-full"><InputNumber min={0} value={item.manualRate} placeholder={String(item.effectiveRate || 0)} onChange={(value) => updateItem(item.key, { manualRate: value })} prefix="₹" className="w-full" /><Button icon={<ReloadOutlined />} title="Restore server rate" onClick={() => updateItem(item.key, { manualRate: null })} /></Space.Compact>,
    },
    {
      title: 'Rate control', width: 170,
      render: (_, item) => <div><div className="text-xs">Minimum {money(item.minimumSellingRate)}</div><div className="mt-1">{item.belowMinimum ? <Tag color="red"><WarningOutlined /> Approval required</Tag> : <Tag color="green"><CheckCircleOutlined /> Valid</Tag>}</div>{item.pricingMessage && <div className="text-[10px] text-slate-500">{item.pricingMessage}</div>}</div>,
    },
    {
      title: 'Line total', width: 135,
      render: (_, item) => <div><strong>{money(item.lineTotal)}</strong>{item.taxAmount > 0 && <div className="text-[10px] text-slate-400">Tax {money(item.taxAmount)}</div>}</div>,
    },
    { title: '', width: 48, fixed: 'right', render: (_, item) => <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeItem(item.key)} /> },
  ];

  const total = summary.grandTotal ?? summary.total ?? items.reduce((sum, item) => sum + Number(item.lineTotal || 0), 0);

  return (
    <>
      <Modal
        title={(
          <div>
            <div className="text-base font-semibold text-gray-800">Create Quotation</div>
            <div className="mt-0.5 text-xs font-normal text-gray-500">Prepare a customer quotation using live branch stock and configured pricing.</div>
          </div>
        )}
        open={open}
        onCancel={handleClose}
        width={1280}
        style={{ top: 20 }}
        styles={{ body: { maxHeight: 'calc(100vh - 170px)', overflowY: 'auto' } }}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={handleClose}>Cancel</Button>,
          <Button key="create" type="primary" icon={<PlusOutlined />} onClick={handleSubmit} loading={submitting}>Create Quotation</Button>,
        ]}
      >
        <div className="mt-4 space-y-4">
          <Alert
            type="info"
            showIcon
            icon={<SafetyCertificateOutlined />}
            message="Pricing is controlled by the selected customer"
            description="Rates, discounts, GST and minimum-price checks are resolved by the server and recalculated when the quotation is saved."
          />

          <Card size="small" title="Customer & pricing audience">
            <div className="mb-4">
              <div className="mb-1.5 text-xs text-gray-500">Customer type</div>
              <div className="flex flex-wrap gap-2">
                {dealerTypes.map((type) => (
                  <Button key={type._id} type={scope === 'dealer' && dealerType === type._id ? 'primary' : 'default'} onClick={() => changeTarget(type._id)}>
                    {type.name}<span className="ml-1 text-[10px] opacity-60">{type.pricingTier}</span>
                  </Button>
                ))}
                <Button type={scope === 'walk_in' ? 'primary' : 'default'} onClick={() => changeTarget('walk_in')}>Walk-in Retail</Button>
              </div>
            </div>

            {scope === 'dealer' ? (
              <Row gutter={[12, 12]} align="middle">
                <Col xs={24} lg={12}>
                  <label htmlFor="quotation-customer" className="mb-1 block text-xs text-gray-500">Registered customer</label>
                  <Select
                    id="quotation-customer" aria-label="Registered customer"
                    showSearch filterOption={false} onSearch={setDealerSearch} loading={dealerLoading}
                    value={selectedDealer?._id} onChange={selectDealer} className="w-full"
                    placeholder={`Search registered ${selectedType?.name || 'dealer'}`}
                    options={dealers.map((dealer) => ({ value: dealer._id, label: `${dealer.businessName} (${dealer.dealerCode || 'No code'})` }))}
                  />
                </Col>
                <Col xs={24} lg={12}>
                  {selectedDealer ? (
                    <div className="rounded-lg border border-green-100 bg-green-50 px-3 py-2.5">
                      <div className="text-sm font-semibold text-gray-800">{selectedDealer.businessName}</div>
                      <div className="mt-0.5 text-xs text-gray-500">
                        {selectedDealer.dealerCode || 'No customer code'} · {selectedDealer.dealerType?.name || selectedType?.name || 'Dealer type'} · {selectedDealer.dealerType?.pricingTier || selectedType?.pricingTier || 'Configured tier'}
                      </div>
                    </div>
                  ) : <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-500">Select a registered customer to enable product browsing.</div>}
                </Col>
              </Row>
            ) : (
              <Row gutter={[12, 12]}>
                <Col xs={24} md={8}><label htmlFor="walk-in-name" className="mb-1 block text-xs text-gray-500">Customer name *</label><Input id="walk-in-name" value={customer.name} onChange={(event) => setCustomer((current) => ({ ...current, name: event.target.value }))} placeholder="Enter customer name" /></Col>
                <Col xs={24} md={8}><label htmlFor="walk-in-phone" className="mb-1 block text-xs text-gray-500">Phone</label><Input id="walk-in-phone" value={customer.phone} onChange={(event) => setCustomer((current) => ({ ...current, phone: event.target.value }))} placeholder="Optional" /></Col>
                <Col xs={24} md={8}><label htmlFor="walk-in-address" className="mb-1 block text-xs text-gray-500">Address</label><Input id="walk-in-address" value={customer.address} onChange={(event) => setCustomer((current) => ({ ...current, address: event.target.value }))} placeholder="Optional" /></Col>
              </Row>
            )}
          </Card>

          <Card size="small" styles={{ body: { padding: 0 } }} title="Quotation items" extra={(
            <Button type="primary" icon={<AppstoreAddOutlined />} disabled={!targetReady} onClick={() => setBrowserOpen(true)}>
              Browse Products {items.length ? `(${items.length})` : ''}
            </Button>
          )}>
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-500">
              {targetReady ? pricingLabel : 'Select the customer and pricing audience before adding products.'}
            </div>
            <Table
              rowKey="key" columns={columns} dataSource={items} pagination={false} loading={pricing}
              size="small" scroll={{ x: 1160 }}
              locale={{ emptyText: targetReady ? 'No items added. Use Browse Products to select from live branch inventory.' : 'Complete the customer section first.' }}
            />
          </Card>

          <Alert
            type="warning"
            showIcon
            message="Stock shown during selection is a branch-wide snapshot. A quotation does not reserve a warehouse, shade or batch."
          />

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={17}>
              <Card size="small" title="Quotation details" className="h-full">
                <Row gutter={[12, 12]}>
                  <Col xs={24} sm={12}>
                    <label htmlFor="quotation-date" className="mb-1 block text-xs text-gray-500">Quotation date</label>
                    <Input id="quotation-date" type="date" value={form.quotationDate} onChange={(event) => setForm((current) => ({ ...current, quotationDate: event.target.value }))} />
                  </Col>
                  <Col xs={24} sm={12}>
                    <label htmlFor="quotation-valid-until" className="mb-1 block text-xs text-gray-500">Valid until</label>
                    <Input id="quotation-valid-until" type="date" value={form.validUntil} onChange={(event) => setForm((current) => ({ ...current, validUntil: event.target.value }))} />
                  </Col>
                  <Col xs={12} md={6}>
                    <label htmlFor="quotation-freight" className="mb-1 block text-xs text-gray-500">Freight charges</label>
                    <InputNumber id="quotation-freight" min={0} prefix="₹" value={form.freightCharges} onChange={(value) => setForm((current) => ({ ...current, freightCharges: value || 0 }))} className="w-full" />
                  </Col>
                  <Col xs={12} md={6}>
                    <label htmlFor="quotation-loading" className="mb-1 block text-xs text-gray-500">Loading charges</label>
                    <InputNumber id="quotation-loading" min={0} prefix="₹" value={form.loadingCharges} onChange={(value) => setForm((current) => ({ ...current, loadingCharges: value || 0 }))} className="w-full" />
                  </Col>
                  <Col xs={12} md={6}>
                    <label htmlFor="quotation-installation" className="mb-1 block text-xs text-gray-500">Installation charges</label>
                    <InputNumber id="quotation-installation" min={0} prefix="₹" value={form.installationCharges} onChange={(value) => setForm((current) => ({ ...current, installationCharges: value || 0 }))} className="w-full" />
                  </Col>
                  <Col xs={12} md={6}>
                    <label htmlFor="quotation-other-charges" className="mb-1 block text-xs text-gray-500">Other charges</label>
                    <InputNumber id="quotation-other-charges" min={0} prefix="₹" value={form.otherCharges} onChange={(value) => setForm((current) => ({ ...current, otherCharges: value || 0 }))} className="w-full" />
                  </Col>
                  <Col xs={24} md={12}>
                    <label htmlFor="quotation-remarks" className="mb-1 block text-xs text-gray-500">Remarks</label>
                    <Input.TextArea id="quotation-remarks" rows={3} value={form.remarks} onChange={(event) => setForm((current) => ({ ...current, remarks: event.target.value }))} placeholder="Internal or customer remarks" />
                  </Col>
                  <Col xs={24} md={12}>
                    <label htmlFor="quotation-terms" className="mb-1 block text-xs text-gray-500">Terms & conditions</label>
                    <Input.TextArea id="quotation-terms" rows={3} value={form.termsAndConditions} onChange={(event) => setForm((current) => ({ ...current, termsAndConditions: event.target.value }))} placeholder="Terms and conditions" />
                  </Col>
                </Row>
              </Card>
            </Col>
            <Col xs={24} xl={7}>
              <Card size="small" title="Quotation summary" className="h-full">
                <div className="rounded-lg border border-orange-100 bg-orange-50 p-4">
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between text-gray-600"><span>Subtotal</span><span className="font-medium text-gray-800">{money(summary.subtotal ?? summary.taxableAmount)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Discount</span><span className="font-medium text-gray-800">{money(summary.discountAmount ?? summary.totalDiscount)}</span></div>
                    <div className="flex justify-between text-gray-600"><span>Tax</span><span className="font-medium text-gray-800">{money(summary.taxAmount ?? summary.totalTax)}</span></div>
                    <div className="flex justify-between border-t border-orange-200 pt-3 text-base"><span className="font-semibold text-gray-800">Grand total</span><strong className="text-[#FF5F03]">{money(total)}</strong></div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] leading-5 text-gray-500">The final amount is recalculated from the server immediately before creation.</div>
              </Card>
            </Col>
          </Row>
        </div>
      </Modal>

      <QuotationProductBrowser
        open={browserOpen}
        onClose={() => setBrowserOpen(false)}
        onDone={addProducts}
        target={target}
        pricingLabel={pricingLabel}
        pricingDate={form.quotationDate}
        alreadySelected={items.map((item) => productIdOf(item))}
      />
    </>
  );
};

export default AuthoritativeQuotationModal;
