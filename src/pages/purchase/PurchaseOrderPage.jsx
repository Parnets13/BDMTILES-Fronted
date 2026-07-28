import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Tooltip, Row, Col, Card, Statistic, InputNumber, Divider, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { Package, TrendingUp } from 'lucide-react';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';

const STATUS_COLORS = {
  draft: 'default', pending_approval: 'orange', approved: 'cyan', sent: 'blue',
  partial_received: 'geekblue', received: 'green', cancelled: 'red',
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent', label: 'Sent' },
  { value: 'partial_received', label: 'Partial Received' },
  { value: 'received', label: 'Received' },
  { value: 'cancelled', label: 'Cancelled' },
];

const PurchaseOrderPage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined });
  const [stats, setStats] = useState({});
  const [showCreatePO, setShowCreatePO] = useState(false);

  useEffect(() => {
    purchaseService.getPOStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  }, []);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const res = await purchaseService.getPOs(params);
      if (res.success) {
        setOrders(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const handleDelete = async (id) => {
    try {
      const res = await purchaseService.deletePO(id);
      if (res.success) { message.success('PO deleted'); fetchOrders(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'PO #', dataIndex: 'poNumber', width: 120, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'poDate', width: 100, render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '-'}</span> },
    { title: 'Supplier', key: 'supplier', width: 180, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[170px]">{r.supplierName || r.supplier?.businessName || '-'}</div>
        <div className="text-xs text-gray-400">{r.supplierCode || r.supplier?.supplierCode}</div></div>
    )},
    { title: 'Items', key: 'items', width: 60, render: (_, r) => <span className="text-sm">{r.items?.length || 0}</span> },
    { title: 'Grand Total', dataIndex: 'grandTotal', width: 120, render: v => <span className="text-sm font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 130, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Tally', dataIndex: 'tallySyncStatus', width: 80, render: s => (
      <Tag color={s === 'synced' ? 'green' : s === 'pending' ? 'orange' : s === 'failed' ? 'red' : 'default'}>{s === 'not_synced' ? 'Not Synced' : s || 'N/A'}</Tag>
    )},
    { title: 'Actions', width: 110, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" /></Tooltip>
        {r.status === 'draft' && (
          <>
            <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} className="text-orange-500" /></Tooltip>
            <Popconfirm title="Delete this PO?" onConfirm={() => handleDelete(r._id)} okText="Yes" cancelText="No">
              <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          </>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Purchase Order Management</h1><p className="text-sm text-gray-500 mt-0.5">Create and manage supplier purchase orders</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreatePO(true)}>New PO</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={5}><Card size="small"><Statistic title="Total POs" value={stats.total || 0} prefix={<Package size={14} />} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#13c2c2' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Received" value={stats.received || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search PO #, supplier..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" options={STATUS_OPTIONS}
            value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))} allowClear className="w-44" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ status: undefined }); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} purchase orders` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create PO Overlay */}
      {showCreatePO && (
        <CreatePurchaseOrder
          onClose={() => setShowCreatePO(false)}
          onSuccess={() => { fetchOrders(); purchaseService.getPOStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {}); }}
        />
      )}
    </div>
  );
};

// ===================== CREATE PURCHASE ORDER (Full-page overlay) =====================
const CreatePurchaseOrder = ({ onClose, onSuccess }) => {
  // Supplier
  const [supplierSearch, setSupplierSearch] = useState('');
  const [supplierResults, setSupplierResults] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  // Products
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [items, setItems] = useState([]);

  // Order details
  const [orderData, setOrderData] = useState({
    poDate: new Date().toISOString().split('T')[0],
    expectedDeliveryDate: '',
    freightCharges: 0,
    loadingCharges: 0,
    otherCharges: 0,
    remarks: '',
    status: 'draft',
  });

  const [loading, setLoading] = useState(false);

  // Search suppliers (debounced)
  useEffect(() => {
    if (supplierSearch.length < 2) { setSupplierResults([]); return; }
    const timer = setTimeout(() => {
      masterService.getSuppliers({ search: supplierSearch, limit: 10 }).then(r => {
        if (r.success) setSupplierResults(r.data);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [supplierSearch]);

  // Search products (debounced)
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(() => {
      productService.getProducts({ search: productSearch, limit: 10 }).then(r => {
        if (r.success) setProductResults(r.data);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleSelectSupplier = (supplier) => {
    setSelectedSupplier(supplier);
    setSupplierSearch('');
    setShowSupplierDropdown(false);
    setSupplierResults([]);
  };

  const addProduct = (product) => {
    if (items.find(i => i.product === product._id)) {
      message.warning('Product already added');
      return;
    }
    setItems(prev => [...prev, {
      key: Date.now() + Math.random(),
      product: product._id,
      productCode: product.productCode,
      productName: product.itemName,
      brandName: product.brand?.name || '',
      tileSize: product.tileSize || '',
      unit: product.unit || 'Box',
      quantity: 1,
      rate: product.purchaseRate || product.dealerRate || 0,
      discount: 0,
      discountType: 'flat',
      gstPercentage: product.gst || 18,
    }]);
    setProductSearch('');
    setProductResults([]);
    setShowProductDropdown(false);
  };

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const removeItem = (key) => setItems(prev => prev.filter(i => i.key !== key));

  const calcLine = (item) => {
    const base = item.quantity * item.rate;
    const disc = item.discountType === 'percentage' ? (base * item.discount / 100) : (item.discount * item.quantity);
    const taxable = base - disc;
    const gst = (taxable * item.gstPercentage) / 100;
    return { taxable, gst, total: taxable + gst, disc };
  };

  const subtotal = items.reduce((s, i) => s + calcLine(i).taxable, 0);
  const totalDiscount = items.reduce((s, i) => s + calcLine(i).disc, 0);
  const totalTax = items.reduce((s, i) => s + calcLine(i).gst, 0);
  const charges = (orderData.freightCharges || 0) + (orderData.loadingCharges || 0) + (orderData.otherCharges || 0);
  const grandTotal = Math.round(subtotal + totalTax + charges);

  const handleSubmit = async (status = 'draft') => {
    if (!selectedSupplier) { message.error('Select a supplier first'); return; }
    if (items.length === 0) { message.error('Add at least one product'); return; }
    setLoading(true);
    try {
      const payload = {
        supplier: selectedSupplier._id,
        status,
        poDate: orderData.poDate,
        expectedDeliveryDate: orderData.expectedDeliveryDate || undefined,
        items: items.map(i => ({
          product: i.product, productCode: i.productCode, productName: i.productName,
          quantity: i.quantity, unit: i.unit, rate: i.rate,
          discount: i.discount, discountType: i.discountType, gstPercentage: i.gstPercentage,
        })),
        freightCharges: orderData.freightCharges,
        loadingCharges: orderData.loadingCharges,
        otherCharges: orderData.otherCharges,
        remarks: orderData.remarks,
      };
      const res = await purchaseService.createPO(payload);
      if (res.success) {
        message.success(`PO ${res.data.poNumber || ''} created!`);
        onSuccess?.();
        onClose();
      }
    } catch (err) { message.error(err.message || 'Failed to create PO'); }
    finally { setLoading(false); }
  };

  const columns = [
    { title: '#', width: 35, render: (_, __, i) => <span className="text-xs text-gray-400">{i + 1}</span> },
    { title: 'Product', width: 200, render: (_, r) => (
      <div><div className="text-xs font-medium truncate max-w-[190px]">{r.productName}</div>
        <div className="text-[10px] text-gray-400">{r.productCode} · {r.brandName} · {r.tileSize}</div></div>
    )},
    { title: 'Qty', width: 70, render: (_, r) => <InputNumber size="small" min={1} value={r.quantity} onChange={v => updateItem(r.key, 'quantity', v)} className="w-full" /> },
    { title: 'Rate ₹', width: 90, render: (_, r) => <InputNumber size="small" min={0} value={r.rate} onChange={v => updateItem(r.key, 'rate', v)} className="w-full" /> },
    { title: 'Disc', width: 65, render: (_, r) => <InputNumber size="small" min={0} value={r.discount} onChange={v => updateItem(r.key, 'discount', v)} className="w-full" /> },
    { title: 'Disc Type', width: 85, render: (_, r) => (
      <Select size="small" value={r.discountType} onChange={v => updateItem(r.key, 'discountType', v)} className="w-full"
        options={[{ value: 'flat', label: '₹ Flat' }, { value: 'percentage', label: '%' }]} />
    )},
    { title: 'GST %', width: 60, render: (_, r) => <InputNumber size="small" min={0} max={28} value={r.gstPercentage} onChange={v => updateItem(r.key, 'gstPercentage', v)} className="w-full" /> },
    { title: 'Total', width: 90, render: (_, r) => <span className="text-xs font-semibold">₹{calcLine(r).total.toFixed(0)}</span> },
    { title: '', width: 30, render: (_, r) => <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(r.key)} /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 border-b px-6 py-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">New Purchase Order</h2>
            <div className="flex gap-2">
              <Button onClick={() => handleSubmit('draft')} loading={loading}>Save Draft</Button>
              <Button type="primary" onClick={() => handleSubmit('pending_approval')} loading={loading}>Submit for Approval</Button>
              <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-1 ml-2" onClick={onClose}>✕</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* === SUPPLIER SELECTION === */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Select Supplier *</label>
              <div className="relative">
                <Input
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="Search by supplier name, code, mobile..."
                  value={supplierSearch}
                  onChange={e => { setSupplierSearch(e.target.value); setShowSupplierDropdown(true); }}
                  onFocus={() => setShowSupplierDropdown(true)}
                  size="large"
                />
                {showSupplierDropdown && supplierResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-56 overflow-y-auto">
                    {supplierResults.map(s => (
                      <div key={s._id} className="px-4 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-gray-50 flex justify-between items-center"
                        onClick={() => handleSelectSupplier(s)}>
                        <div>
                          <div className="text-sm font-medium text-gray-900">{s.businessName}</div>
                          <div className="text-xs text-gray-400">{s.supplierCode} · {s.contactPerson} · {s.mobile} · {s.city}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500">GSTIN: {s.gstin || '-'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {selectedSupplier && (
                <div className="grid grid-cols-3 gap-3 mt-3">
                  <div className="bg-gray-50 rounded-lg p-3 border">
                    <div className="text-[10px] text-gray-400 uppercase">Supplier</div>
                    <div className="text-sm font-semibold mt-0.5">{selectedSupplier.businessName}</div>
                    <div className="text-xs text-gray-500">{selectedSupplier.supplierCode} · {selectedSupplier.city}</div>
                  </div>
                  <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
                    <div className="text-[10px] text-gray-400 uppercase">Contact</div>
                    <div className="text-sm font-semibold mt-0.5">{selectedSupplier.contactPerson || '-'}</div>
                    <div className="text-xs text-gray-500">{selectedSupplier.mobile || selectedSupplier.phone}</div>
                  </div>
                  <div className="bg-green-50 rounded-lg p-3 border border-green-100">
                    <div className="text-[10px] text-gray-400 uppercase">GSTIN</div>
                    <div className="text-sm font-semibold mt-0.5">{selectedSupplier.gstin || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{selectedSupplier.state || ''}</div>
                  </div>
                </div>
              )}
            </div>

            {/* === ORDER META === */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">PO Date</label>
                <Input type="date" value={orderData.poDate} onChange={e => setOrderData(p => ({ ...p, poDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Expected Delivery Date</label>
                <Input type="date" value={orderData.expectedDeliveryDate} onChange={e => setOrderData(p => ({ ...p, expectedDeliveryDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Status</label>
                <Select value={orderData.status} onChange={v => setOrderData(p => ({ ...p, status: v }))} className="w-full"
                  options={STATUS_OPTIONS} />
              </div>
            </div>

            <Divider className="my-3" />

            {/* === PRODUCT SEARCH === */}
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1.5">Add Products</label>
              <div className="relative">
                <Input
                  prefix={<SearchOutlined className="text-gray-400" />}
                  placeholder="Search product by name, code..."
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                  onFocus={() => setShowProductDropdown(true)}
                  size="large"
                  disabled={!selectedSupplier}
                />
                {!selectedSupplier && <div className="text-xs text-orange-500 mt-1">Select a supplier first to add products</div>}
                {showProductDropdown && productResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-60 overflow-y-auto">
                    {productResults.map(p => (
                      <div key={p._id} className="px-4 py-3 hover:bg-orange-50 cursor-pointer border-b border-gray-50"
                        onClick={() => addProduct(p)}>
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="text-sm font-medium text-gray-900">{p.itemName}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{p.productCode} · {p.brand?.name} · {p.tileSize}</div>
                          </div>
                          <div className="text-right shrink-0 ml-4">
                            <div className="text-sm font-bold text-[#FF5F03]">₹{p.purchaseRate || p.dealerRate || p.mrp || 0}/{p.unit || 'Box'}</div>
                            <div className="text-[10px] text-gray-400">GST {p.gst}%</div>
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
                <Table columns={columns} dataSource={items} rowKey="key" size="small" pagination={false} scroll={{ x: 800 }} />
              </div>
            )}

            {items.length === 0 && selectedSupplier && (
              <div className="text-center py-8 text-gray-400 border-2 border-dashed rounded-lg">
                <SearchOutlined className="text-3xl mb-2" />
                <p>Search and add products above</p>
              </div>
            )}

            <Divider className="my-3" />

            {/* === BOTTOM SUMMARY === */}
            <div className="grid grid-cols-12 gap-5">
              <div className="col-span-7 space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Remarks / Special Instructions</label>
                  <Input.TextArea rows={3} value={orderData.remarks} onChange={e => setOrderData(p => ({ ...p, remarks: e.target.value }))} placeholder="Any special instructions for this PO..." />
                </div>
              </div>

              <div className="col-span-5">
                <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm border">
                  <div className="flex justify-between"><span className="text-gray-500">Items</span><span className="font-medium">{items.length} products</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                  {totalDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{totalDiscount.toFixed(2)}</span></div>}
                  <div className="flex justify-between"><span className="text-gray-500">GST</span><span>₹{totalTax.toFixed(2)}</span></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Freight</span><InputNumber size="small" min={0} value={orderData.freightCharges} onChange={v => setOrderData(p => ({ ...p, freightCharges: v || 0 }))} className="w-20" /></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Loading</span><InputNumber size="small" min={0} value={orderData.loadingCharges} onChange={v => setOrderData(p => ({ ...p, loadingCharges: v || 0 }))} className="w-20" /></div>
                  <div className="flex justify-between items-center"><span className="text-gray-500">Other</span><InputNumber size="small" min={0} value={orderData.otherCharges} onChange={v => setOrderData(p => ({ ...p, otherCharges: v || 0 }))} className="w-20" /></div>
                  <Divider className="my-1" />
                  <div className="flex justify-between text-base font-bold"><span>Grand Total</span><span className="text-[#FF5F03]">₹{grandTotal.toLocaleString()}</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PurchaseOrderPage;
