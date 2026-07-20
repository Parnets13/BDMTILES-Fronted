import { useState, useEffect, useRef } from 'react';
import { Input, Select, InputNumber, Button, message, Divider, Table, DatePicker, Modal } from 'antd';
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';

const CreateSalesOrder = ({ onClose, onSuccess }) => {
  // Dealer
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerResults, setDealerResults] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  // Products
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [items, setItems] = useState([]);

  // Warehouses
  const [warehouses, setWarehouses] = useState([]);

  // Order details
  const [orderData, setOrderData] = useState({
    orderType: 'dealer',
    orderDate: dayjs().format('YYYY-MM-DD'),
    creditDays: 0,
    dueDate: '',
    deliveryAddress: '',
    expectedDeliveryDate: null,
    deliveryPriority: 'normal',
    freightCharges: 0,
    loadingCharges: 0,
    otherCharges: 0,
    advanceAmount: 0,
    remarks: '',
    status: 'draft',
  });

  const [loading, setLoading] = useState(false);
  const dealerInputRef = useRef(null);
  const productInputRef = useRef(null);

  // Load warehouses on mount
  useEffect(() => {
    masterService.getWarehouses({ limit: 50 }).then(r => {
      if (r.success) setWarehouses(r.data);
    }).catch(() => {});
  }, []);

  // Search dealers (debounced)
  useEffect(() => {
    if (dealerSearch.length < 2) { setDealerResults([]); return; }
    const timer = setTimeout(() => {
      salesService.searchDealers(dealerSearch).then(r => {
        if (r.success) setDealerResults(r.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [dealerSearch]);

  // Search products (debounced)
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(() => {
      salesService.searchProducts(productSearch).then(r => {
        if (r.success) setProductResults(r.data);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  // Select dealer
  const handleSelectDealer = (dealer) => {
    setSelectedDealer(dealer);
    setDealerSearch('');
    setShowDealerDropdown(false);
    setDealerResults([]);
    // Auto-fill from dealer
    const creditDays = dealer.creditDays || 30;
    const dueDate = dayjs(orderData.orderDate).add(creditDays, 'day').format('YYYY-MM-DD');
    setOrderData(prev => ({
      ...prev,
      deliveryAddress: dealer.address || '',
      creditDays,
      dueDate,
    }));
  };

  // Add product to items
  const addProduct = (product) => {
    if (items.find(i => i.product === product._id && !i.shade)) {
      message.warning('Product already added. Set shade/batch to add again.');
      return;
    }
    // Rate based on dealer price tier
    const rate = selectedDealer?.priceTier === 'Wholesale'
      ? (product.wholesaleRate || product.dealerRate || product.mrp)
      : selectedDealer?.priceTier === 'Retail'
        ? (product.retailRate || product.mrp)
        : (product.dealerRate || product.mrp);

    setItems(prev => [...prev, {
      key: Date.now() + Math.random(),
      product: product._id,
      productCode: product.productCode,
      productName: product.itemName,
      brandName: product.brand?.name || '',
      tileSize: product.tileSize || '',
      finish: product.finish || '',
      shade: '',
      batch: '',
      quantity: 1,
      unit: product.unit || 'Box',
      rate: rate || 0,
      discount: 0,
      discountType: 'flat',
      schemeDiscount: 0,
      gstPercentage: product.gst || 18,
      piecesPerBox: product.piecesPerBox || 0,
      sqftPerBox: product.sqftPerBox || 0,
      minimumSellingRate: product.minimumSellingRate || 0,
      warehouse: warehouses[0]?._id || '',
    }]);
    setProductSearch('');
    setProductResults([]);
    setShowProductDropdown(false);
  };

  // Update item
  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  // Remove item
  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key));

  // Calculate line total
  const calcLine = (item) => {
    const base = item.quantity * item.rate;
    const disc = item.discountType === 'percentage' ? (base * item.discount / 100) : (item.discount * item.quantity);
    const taxable = base - disc - (item.schemeDiscount || 0);
    const gst = (taxable * item.gstPercentage) / 100;
    return { taxable, gst, total: taxable + gst, disc };
  };

  // Totals
  const subtotal = items.reduce((s, i) => s + calcLine(i).taxable, 0);
  const totalDiscount = items.reduce((s, i) => s + calcLine(i).disc, 0);
  const totalTax = items.reduce((s, i) => s + calcLine(i).gst, 0);
  const charges = (orderData.freightCharges || 0) + (orderData.loadingCharges || 0) + (orderData.otherCharges || 0);
  const grandTotal = Math.round(subtotal + totalTax + charges);
  const balanceAmount = grandTotal - (orderData.advanceAmount || 0);

  // Credit check
  const creditExceeded = selectedDealer?.creditLimit > 0 &&
    ((selectedDealer.currentOutstanding || 0) + grandTotal) > selectedDealer.creditLimit;

  // Below min rate check
  const belowMinItems = items.filter(i => i.minimumSellingRate > 0 && i.rate < i.minimumSellingRate);

  // Submit
  const handleSubmit = async (status = 'draft') => {
    if (!selectedDealer) { message.error('Select a dealer first'); return; }
    if (items.length === 0) { message.error('Add at least one product'); return; }
    if (belowMinItems.length > 0 && status === 'confirmed') {
      message.warning(`${belowMinItems.length} item(s) below minimum rate. Will need approval.`);
    }
    setLoading(true);
    try {
      const payload = {
        dealer: selectedDealer._id,
        orderType: orderData.orderType,
        status,
        items: items.map(i => ({
          product: i.product, productCode: i.productCode, productName: i.productName,
          shade: i.shade, batch: i.batch, quantity: i.quantity, unit: i.unit,
          boxes: i.quantity, pieces: i.quantity * (i.piecesPerBox || 0), sqft: i.quantity * (i.sqftPerBox || 0),
          rate: i.rate, discount: i.discount, discountType: i.discountType,
          schemeDiscount: i.schemeDiscount, gstPercentage: i.gstPercentage,
          warehouse: i.warehouse || undefined,
        })),
        freightCharges: orderData.freightCharges, loadingCharges: orderData.loadingCharges,
        otherCharges: orderData.otherCharges, advanceAmount: orderData.advanceAmount,
        deliveryAddress: orderData.deliveryAddress, deliveryPriority: orderData.deliveryPriority,
        expectedDeliveryDate: orderData.expectedDeliveryDate, remarks: orderData.remarks,
      };
      const res = await salesService.createOrder(payload);
      if (res.success) {
        message.success(`Order ${res.data.orderNumber} created!`);
        onSuccess?.();
        onClose();
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setLoading(false); }
  };

  // Columns
  const columns = [
    { title: '#', width: 35, render: (_, __, i) => <span className="text-xs text-gray-400">{i + 1}</span> },
    { title: 'Product', width: 180, render: (_, r) => (
      <div><div className="text-xs font-medium truncate max-w-[170px]">{r.productName}</div>
        <div className="text-[10px] text-gray-400">{r.productCode} · {r.brandName} · {r.tileSize} · {r.finish}</div></div>
    )},
    { title: 'Shade', width: 70, render: (_, r) => <Input size="small" value={r.shade} onChange={e => updateItem(r.key, 'shade', e.target.value)} placeholder="—" className="text-xs" /> },
    { title: 'Batch', width: 70, render: (_, r) => <Input size="small" value={r.batch} onChange={e => updateItem(r.key, 'batch', e.target.value)} placeholder="—" className="text-xs" /> },
    { title: 'Qty', width: 65, render: (_, r) => <InputNumber size="small" min={1} value={r.quantity} onChange={v => updateItem(r.key, 'quantity', v)} className="w-full" /> },
    { title: 'Rate ₹', width: 80, render: (_, r) => (
      <InputNumber size="small" min={0} value={r.rate} onChange={v => updateItem(r.key, 'rate', v)} className="w-full"
        status={r.minimumSellingRate > 0 && r.rate < r.minimumSellingRate ? 'warning' : ''} />
    )},
    { title: 'Disc', width: 60, render: (_, r) => <InputNumber size="small" min={0} value={r.discount} onChange={v => updateItem(r.key, 'discount', v)} className="w-full" /> },
    { title: 'GST', width: 45, render: (_, r) => <span className="text-xs">{r.gstPercentage}%</span> },
    { title: 'Warehouse', width: 110, render: (_, r) => (
      <Select size="small" value={r.warehouse} onChange={v => updateItem(r.key, 'warehouse', v)} className="w-full"
        options={warehouses.map(w => ({ value: w._id, label: w.name }))} placeholder="Select" allowClear />
    )},
    { title: 'Total', width: 85, render: (_, r) => <span className="text-xs font-semibold">₹{calcLine(r).total.toFixed(0)}</span> },
    { title: '', width: 30, render: (_, r) => <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 border-b px-6 py-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">New Sales Order</h2>
            <div className="flex gap-2">
              <Button onClick={() => handleSubmit('draft')} loading={loading}>Save Draft</Button>
              <Button type="primary" onClick={() => handleSubmit('confirmed')} loading={loading}>Confirm Order</Button>
              <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-1 ml-2" onClick={onClose}>✕</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* === DEALER SELECTION === */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Select Dealer *</label>
              <div className="relative">
                <Input
                  ref={dealerInputRef}
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="Search by dealer name, code, mobile..."
                  value={dealerSearch}
                  onChange={e => { setDealerSearch(e.target.value); setShowDealerDropdown(true); }}
                  onFocus={() => setShowDealerDropdown(true)}
                  size="large"
                />
                {showDealerDropdown && dealerResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {dealerResults.map(d => (
                      <div key={d._id} className="px-4 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-gray-50 flex justify-between items-center"
                        onClick={() => handleSelectDealer(d)}>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{d.businessName}</div>
                          <div className="text-xs text-gray-400">{d.dealerCode} · {d.ownerName} · {d.mobile} · {d.city}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Credit: ₹{(d.creditLimit || 0).toLocaleString()}</div>
                          <div className="text-xs text-gray-400">O/S: ₹{(d.currentOutstanding || 0).toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dealer info cards */}
              {selectedDealer && (
                <div className="grid grid-cols-4 gap-3 mt-3">
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="text-[10px] text-gray-400 uppercase">Dealer</div>
                    <div className="text-sm font-semibold mt-0.5">{selectedDealer.businessName}</div>
                    <div className="text-xs text-gray-500">{selectedDealer.dealerCode} · {selectedDealer.city}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="text-[10px] text-gray-400 uppercase">Credit Limit</div>
                    <div className="text-sm font-semibold mt-0.5">₹{(selectedDealer.creditLimit || 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">{selectedDealer.creditDays || 30} credit days</div>
                  </div>
                  <div className={`rounded-lg p-3 border ${creditExceeded ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}>
                    <div className="text-[10px] text-gray-400 uppercase">Outstanding</div>
                    <div className={`text-sm font-semibold mt-0.5 ${creditExceeded ? 'text-red-600' : 'text-green-700'}`}>₹{(selectedDealer.currentOutstanding || 0).toLocaleString()}</div>
                    {creditExceeded && <div className="text-[10px] text-red-600 font-semibold">⚠ LIMIT EXCEEDED</div>}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="text-[10px] text-gray-400 uppercase">Price Tier</div>
                    <div className="text-sm font-semibold mt-0.5">{selectedDealer.priceTier || 'Dealer'}</div>
                    <div className="text-xs text-gray-500">{selectedDealer.mobile}</div>
                  </div>
                </div>
              )}
            </div>

            {/* === ORDER META === */}
            <div className="grid grid-cols-5 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Order Date</label>
                <Input value={orderData.orderDate} onChange={e => {
                  const od = e.target.value;
                  setOrderData(p => ({...p, orderDate: od, dueDate: dayjs(od).add(p.creditDays, 'day').format('YYYY-MM-DD')}));
                }} type="date" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Credit Days</label>
                <InputNumber value={orderData.creditDays} min={0} className="w-full" onChange={v => {
                  setOrderData(p => ({...p, creditDays: v, dueDate: dayjs(p.orderDate).add(v, 'day').format('YYYY-MM-DD')}));
                }} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Due Date</label>
                <Input value={orderData.dueDate} disabled className="bg-gray-50" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Priority</label>
                <Select value={orderData.deliveryPriority} onChange={v => setOrderData(p => ({...p, deliveryPriority: v}))} className="w-full"
                  options={[{value:'normal',label:'Normal'},{value:'urgent',label:'Urgent'},{value:'vip',label:'VIP'}]} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Order Type</label>
                <Select value={orderData.orderType} onChange={v => setOrderData(p => ({...p, orderType: v}))} className="w-full"
                  options={[{value:'dealer',label:'Dealer'},{value:'retail',label:'Retail'},{value:'online',label:'Online'},{value:'project',label:'Project'}]} />
              </div>
            </div>

            <Divider className="my-3" />

            {/* === PRODUCT SEARCH & ADD === */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Add Products</label>
              <div className="relative">
                <Input
                  ref={productInputRef}
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="Search product by name, code, barcode..."
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  size="large"
                  disabled={!selectedDealer}
                />
                {!selectedDealer && <div className="text-xs text-orange-500 mt-1">Select a dealer first to add products</div>}
                {showProductDropdown && productResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {productResults.map(p => (
                      <div key={p._id} className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50"
                        onClick={() => addProduct(p)}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{p.itemName}</div>
                            <div className="text-xs text-gray-400 mt-0.5">
                              {p.productCode} · {p.brand?.name} · {p.tileSize} · {p.finish} · {p.colour}
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              Unit: {p.unit} · Pcs/Box: {p.piecesPerBox || '-'} · SqFt/Box: {p.sqftPerBox || '-'}
                            </div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <div className="text-sm font-bold text-[#FF5F03]">₹{p.dealerRate || p.mrp || 0}/{p.unit || 'Box'}</div>
                            <div className="text-[10px] text-gray-400">MRP ₹{p.mrp} · GST {p.gst}%</div>
                            {p.minimumSellingRate > 0 && <div className="text-[10px] text-red-400">Min: ₹{p.minimumSellingRate}</div>}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* === ITEMS TABLE === */}
            {items.length > 0 && (
              <div className="border rounded-lg overflow-hidden">
                <Table columns={columns} dataSource={items} rowKey="key" size="small" pagination={false} scroll={{ x: 950 }} />
              </div>
            )}

            {items.length === 0 && selectedDealer && (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                <SearchOutlined className="text-3xl mb-2" />
                <p>Search and add products above</p>
              </div>
            )}

            <Divider className="my-3" />

            {/* === BOTTOM: Summary === */}
            <div className="grid grid-cols-12 gap-5">
              {/* Left: Remarks only (no delivery address — comes from dealer) */}
              <div className="col-span-7 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Delivery Date</label>
                  <Input type="date" value={orderData.expectedDeliveryDate || ''} onChange={e => setOrderData(p => ({...p, expectedDeliveryDate: e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Remarks / Special Instructions</label>
                  <Input.TextArea rows={3} value={orderData.remarks} onChange={e => setOrderData(p => ({...p, remarks: e.target.value}))} placeholder="Any special instructions for this order..." />
                </div>
              </div>

              {/* Right: Summary */}
              <div className="col-span-5">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm border">
                  <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{items.length} products</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {totalDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{totalDiscount.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">GST</span><span>₹{totalTax.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Freight</span><InputNumber size="small" min={0} value={orderData.freightCharges} onChange={v => setOrderData(p => ({...p, freightCharges: v||0}))} className="w-20" /></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Loading</span><InputNumber size="small" min={0} value={orderData.loadingCharges} onChange={v => setOrderData(p => ({...p, loadingCharges: v||0}))} className="w-20" /></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Other</span><InputNumber size="small" min={0} value={orderData.otherCharges} onChange={v => setOrderData(p => ({...p, otherCharges: v||0}))} className="w-20" /></div>
                  <Divider className="my-1" />
                  <div className="flex justify-between text-base font-bold"><span>Grand Total</span><span className="text-[#FF5F03]">₹{grandTotal.toLocaleString()}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Advance</span><InputNumber size="small" min={0} value={orderData.advanceAmount} onChange={v => setOrderData(p => ({...p, advanceAmount: v||0}))} className="w-20" /></div>
                  <div className="flex justify-between font-semibold"><span>Balance</span><span className="text-red-600">₹{balanceAmount.toLocaleString()}</span></div>

                  {creditExceeded && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                      ⚠️ Credit limit exceeded. Order requires management approval.
                    </div>
                  )}
                  {belowMinItems.length > 0 && (
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-700">
                      ⚠️ {belowMinItems.length} item(s) below minimum selling rate.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default CreateSalesOrder;
