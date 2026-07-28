import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, InputNumber, Modal, Divider, Tooltip, Switch } from 'antd';
import { PlusOutlined, SearchOutlined, DeleteOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons';
import { DollarSign } from 'lucide-react';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';
import api from '../../config/api.js';

const dealerPricingService = {
  getAll: (params) => api.get('/dealer-pricing', { params }),
  getBulkByDealer: (id) => api.get(`/dealer-pricing/bulk-by-dealer/${id}`),
  save: (data) => api.post('/dealer-pricing', data),
  update: (id, data) => api.put(`/dealer-pricing/${id}`, data),
  remove: (id) => api.delete(`/dealer-pricing/${id}`),
};

const DealerProductPricingPage = () => {
  const [pricings, setPricings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });

  // Dealer selection
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerResults, setDealerResults] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [showDealerDrop, setShowDealerDrop] = useState(false);

  // Add override modal
  const [showAdd, setShowAdd] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showProductDrop, setShowProductDrop] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [form, setForm] = useState({
    customRate: null, discountPercent: 0, discountFlat: 0,
    schemeDiscount: 0, minQty: 0, validFrom: '', validTo: '', remarks: '',
  });

  const [editModal, setEditModal] = useState(null);
  const [editLoading, setEditLoading] = useState(false);

  // Dealer search debounce
  useEffect(() => {
    if (dealerSearch.length < 2) { setDealerResults([]); return; }
    const t = setTimeout(() => {
      masterService.getDealers({ search: dealerSearch, limit: 10 }).then(r => {
        if (r.success) setDealerResults(r.data);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [dealerSearch]);

  // Product search debounce
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const t = setTimeout(() => {
      productService.getProducts({ search: productSearch, limit: 15 }).then(r => {
        if (r.success) setProductResults(r.data);
      });
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  const fetchPricings = useCallback(async () => {
    if (!selectedDealer) return;
    setLoading(true);
    try {
      const res = await dealerPricingService.getAll({ dealer: selectedDealer._id, page: pagination.current, limit: pagination.pageSize });
      if (res.success) {
        setPricings(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [selectedDealer, pagination.current, pagination.pageSize]);

  useEffect(() => { fetchPricings(); }, [fetchPricings]);

  const handleSelectDealer = (dealer) => {
    setSelectedDealer(dealer);
    setDealerSearch('');
    setShowDealerDrop(false);
    setDealerResults([]);
    setPricings([]);
  };

  const handleAddOverride = async () => {
    if (!selectedDealer || !selectedProduct) { message.error('Select a dealer and product'); return; }
    if (!form.customRate && !form.discountPercent && !form.discountFlat) {
      message.error('Enter custom rate or discount'); return;
    }
    setAddLoading(true);
    try {
      const payload = {
        dealer: selectedDealer._id,
        product: selectedProduct._id,
        ...form,
        customRate: form.customRate || null,
      };
      const res = await dealerPricingService.save(payload);
      if (res.success) {
        message.success('Pricing override saved!');
        setShowAdd(false);
        resetAddForm();
        fetchPricings();
      }
    } catch (err) { message.error(err.message); }
    finally { setAddLoading(false); }
  };

  const handleUpdateOverride = async () => {
    setEditLoading(true);
    try {
      const res = await dealerPricingService.update(editModal._id, {
        customRate: editModal.customRate || null,
        discountPercent: editModal.discountPercent || 0,
        discountFlat: editModal.discountFlat || 0,
        schemeDiscount: editModal.schemeDiscount || 0,
        minQty: editModal.minQty || 0,
        validTo: editModal.validTo || null,
        remarks: editModal.remarks || '',
        isActive: editModal.isActive,
      });
      if (res.success) {
        message.success('Updated');
        setEditModal(null);
        fetchPricings();
      }
    } catch (err) { message.error(err.message); }
    finally { setEditLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await dealerPricingService.remove(id);
      if (res.success) { message.success('Override removed'); fetchPricings(); }
    } catch (err) { message.error(err.message); }
  };

  const resetAddForm = () => {
    setSelectedProduct(null); setProductSearch(''); setProductResults([]);
    setForm({ customRate: null, discountPercent: 0, discountFlat: 0, schemeDiscount: 0, minQty: 0, validFrom: '', validTo: '', remarks: '' });
  };

  // Compute effective rate for display
  const getEffectiveRate = (p) => {
    const baseRate = p.product?.dealerRate || p.product?.mrp || 0;
    if (p.customRate != null) return p.customRate;
    let rate = baseRate;
    if (p.discountPercent > 0) rate = rate * (1 - p.discountPercent / 100);
    if (p.discountFlat > 0) rate = Math.max(0, rate - p.discountFlat);
    return Math.round(rate * 100) / 100;
  };

  const columns = [
    {
      title: 'Product', key: 'product', width: 220,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium">{r.product?.itemName}</div>
          <div className="text-xs text-gray-400">{r.product?.productCode} · {r.product?.tileSize} · {r.product?.unit}</div>
        </div>
      ),
    },
    { title: 'Base Rate', key: 'base', width: 100, render: (_, r) => <span className="text-sm">₹{(r.product?.dealerRate || 0).toLocaleString()}</span> },
    {
      title: 'Override', key: 'override', width: 160,
      render: (_, r) => {
        if (r.customRate != null) return <Tag color="blue">Custom: ₹{r.customRate}</Tag>;
        const parts = [];
        if (r.discountPercent > 0) parts.push(`${r.discountPercent}% off`);
        if (r.discountFlat > 0) parts.push(`₹${r.discountFlat} off`);
        if (r.schemeDiscount > 0) parts.push(`+₹${r.schemeDiscount} scheme`);
        return parts.length ? <div className="space-y-0.5">{parts.map((t, i) => <Tag key={i} color="purple">{t}</Tag>)}</div> : <span className="text-gray-400 text-xs">—</span>;
      },
    },
    { title: 'Effective Rate', key: 'effective', width: 110, render: (_, r) => <span className="font-semibold text-[#FF5F03]">₹{getEffectiveRate(r).toLocaleString()}</span> },
    { title: 'Min MSP', key: 'msp', width: 80, render: (_, r) => <span className="text-xs text-gray-400">₹{(r.product?.minimumSellingRate || 0)}</span> },
    { title: 'Min Qty', dataIndex: 'minQty', width: 70, render: v => v || '—' },
    { title: 'Valid To', dataIndex: 'validTo', width: 90, render: v => v ? new Date(v).toLocaleDateString('en-IN') : '∞' },
    { title: 'Active', dataIndex: 'isActive', width: 70, render: v => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Off'}</Tag> },
    {
      title: 'Actions', width: 80,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => setEditModal({ ...r })} /></Tooltip>
          <Tooltip title="Remove"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r._id)} /></Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dealer Product Pricing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Set custom rates and discounts for individual dealers</p>
        </div>
        {selectedDealer && (
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowAdd(true)}>Add Override</Button>
        )}
      </div>

      {/* Dealer Selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <label className="text-sm font-semibold text-gray-700 block mb-2">Select Dealer *</label>
        <div className="relative max-w-lg">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search dealer by name, code..."
            value={dealerSearch}
            onChange={e => { setDealerSearch(e.target.value); setShowDealerDrop(true); }}
            onFocus={() => setShowDealerDrop(true)}
          />
          {showDealerDrop && dealerResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
              {dealerResults.map(d => (
                <div key={d._id} className="px-4 py-2.5 hover:bg-orange-50 cursor-pointer border-b border-gray-50" onClick={() => handleSelectDealer(d)}>
                  <div className="text-sm font-medium">{d.businessName}</div>
                  <div className="text-xs text-gray-400">{d.dealerCode} · {d.city} · O/S ₹{(d.currentOutstanding || 0).toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedDealer && (
          <div className="mt-3 flex items-center gap-4 bg-orange-50 p-3 rounded-lg border border-orange-100">
            <div>
              <span className="font-bold text-orange-700">{selectedDealer.businessName}</span>
              <span className="text-sm text-gray-500 ml-2">{selectedDealer.dealerCode}</span>
            </div>
            <div className="ml-auto text-sm text-gray-500">{pricings.length} override(s)</div>
            <Button size="small" onClick={() => { setSelectedDealer(null); setPricings([]); }}>Change Dealer</Button>
          </div>
        )}
      </div>

      {/* Pricing Table */}
      {selectedDealer && (
        <div className="bg-white rounded-lg border border-gray-200">
          <Table
            columns={columns} dataSource={pricings} rowKey="_id" loading={loading} size="middle"
            scroll={{ x: 1000 }}
            pagination={{ ...pagination, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
            onChange={pag => setPagination(p => ({ ...p, current: pag.current }))}
            locale={{ emptyText: <div className="py-8 text-gray-400">No pricing overrides yet. Click "Add Override" to set custom rates.</div> }}
          />
        </div>
      )}

      {!selectedDealer && (
        <div className="text-center py-16 text-gray-400 bg-white rounded-lg border border-gray-200">
          <DollarSign size={48} className="mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">Select a dealer above to view and manage their pricing overrides</p>
        </div>
      )}

      {/* Add Override Modal */}
      <Modal title="Add Pricing Override" open={showAdd} onCancel={() => { setShowAdd(false); resetAddForm(); }}
        footer={null} width={680} destroyOnClose>
        <div className="space-y-4 mt-4">
          {/* Product Search */}
          <div>
            <label className="text-sm font-semibold block mb-1">Select Product *</label>
            <div className="relative">
              <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="Search product..."
                value={productSearch} onChange={e => { setProductSearch(e.target.value); setShowProductDrop(true); }}
                onFocus={() => setShowProductDrop(true)} />
              {showProductDrop && productResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {productResults.map(p => (
                    <div key={p._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b" onClick={() => { setSelectedProduct(p); setProductSearch(''); setShowProductDrop(false); setProductResults([]); setForm(f => ({ ...f, customRate: p.dealerRate || null })); }}>
                      <div className="text-sm font-medium">{p.itemName}</div>
                      <div className="text-xs text-gray-400">{p.productCode} · {p.tileSize} · Base: ₹{p.dealerRate || p.mrp} · Min: ₹{p.minimumSellingRate || 0}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedProduct && (
              <div className="mt-2 bg-blue-50 p-2 rounded text-sm">
                <strong>{selectedProduct.itemName}</strong> — Base Rate: ₹{selectedProduct.dealerRate || selectedProduct.mrp} | MRP: ₹{selectedProduct.mrp} | Min: ₹{selectedProduct.minimumSellingRate || '—'}
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Custom Rate (₹)</label>
              <InputNumber value={form.customRate} onChange={v => setForm(p => ({ ...p, customRate: v }))} min={0} className="w-full" placeholder="Override rate" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Discount %</label>
              <InputNumber value={form.discountPercent} onChange={v => setForm(p => ({ ...p, discountPercent: v || 0 }))} min={0} max={100} className="w-full" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Flat Discount (₹)</label>
              <InputNumber value={form.discountFlat} onChange={v => setForm(p => ({ ...p, discountFlat: v || 0 }))} min={0} className="w-full" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Scheme Discount (₹)</label>
              <InputNumber value={form.schemeDiscount} onChange={v => setForm(p => ({ ...p, schemeDiscount: v || 0 }))} min={0} className="w-full" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Min Qty</label>
              <InputNumber value={form.minQty} onChange={v => setForm(p => ({ ...p, minQty: v || 0 }))} min={0} className="w-full" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Valid To</label>
              <Input type="date" value={form.validTo} onChange={e => setForm(p => ({ ...p, validTo: e.target.value }))} /></div>
          </div>

          <div><label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Reason for override..." /></div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={() => { setShowAdd(false); resetAddForm(); }}>Cancel</Button>
            <Button type="primary" onClick={handleAddOverride} loading={addLoading}>Save Override</Button>
          </div>
        </div>
      </Modal>

      {/* Edit Override Modal */}
      {editModal && (
        <Modal title="Edit Pricing Override" open={!!editModal} onCancel={() => setEditModal(null)} footer={null} width={580}>
          <div className="space-y-3 mt-4">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <strong>{editModal.product?.itemName}</strong> — Base: ₹{editModal.product?.dealerRate || 0}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-gray-500 block mb-1">Custom Rate (₹)</label>
                <InputNumber value={editModal.customRate} onChange={v => setEditModal(m => ({ ...m, customRate: v }))} min={0} className="w-full" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Discount %</label>
                <InputNumber value={editModal.discountPercent} onChange={v => setEditModal(m => ({ ...m, discountPercent: v || 0 }))} min={0} max={100} className="w-full" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Flat Discount (₹)</label>
                <InputNumber value={editModal.discountFlat} onChange={v => setEditModal(m => ({ ...m, discountFlat: v || 0 }))} min={0} className="w-full" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Scheme (₹)</label>
                <InputNumber value={editModal.schemeDiscount} onChange={v => setEditModal(m => ({ ...m, schemeDiscount: v || 0 }))} min={0} className="w-full" /></div>
              <div><label className="text-xs text-gray-500 block mb-1">Valid To</label>
                <Input type="date" value={editModal.validTo ? new Date(editModal.validTo).toISOString().split('T')[0] : ''} onChange={e => setEditModal(m => ({ ...m, validTo: e.target.value }))} /></div>
              <div className="flex items-end pb-1"><label className="text-xs text-gray-500 mr-2">Active</label>
                <Switch checked={editModal.isActive} onChange={v => setEditModal(m => ({ ...m, isActive: v }))} /></div>
            </div>
            <div><label className="text-xs text-gray-500 block mb-1">Remarks</label>
              <Input value={editModal.remarks} onChange={e => setEditModal(m => ({ ...m, remarks: e.target.value }))} /></div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button onClick={() => setEditModal(null)}>Cancel</Button>
              <Button type="primary" onClick={handleUpdateOverride} loading={editLoading}>Update</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default DealerProductPricingPage;
