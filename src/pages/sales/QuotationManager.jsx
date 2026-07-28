import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber, Divider, Tooltip
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined,
  SendOutlined, CheckCircleOutlined, CloseCircleOutlined,
  SwapOutlined, DeleteOutlined, PrinterOutlined
} from '@ant-design/icons';
import { FileSpreadsheet } from 'lucide-react';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';

const STATUS_COLORS = {
  draft: 'default', sent: 'blue', accepted: 'green',
  converted: 'purple', expired: 'orange', cancelled: 'red',
};

const QuotationManager = () => {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => {
    salesService.getQuotationStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  };

  useEffect(() => { loadStats(); }, []);

  const fetchQuotations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesService.getQuotations({
        page: pagination.current, limit: pagination.pageSize, search, status: statusFilter,
      });
      if (res.success) {
        setQuotations(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchQuotations(); }, [fetchQuotations]);

  const handleStatusChange = async (id, status) => {
    try {
      const res = await salesService.updateQuotationStatus(id, { status });
      if (res.success) { message.success(res.message); fetchQuotations(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const handleConvert = (record) => {
    Modal.confirm({
      title: `Convert ${record.quotationNumber} to Sales Order?`,
      content: 'A confirmed Sales Order will be created from this quotation.',
      okText: 'Convert to SO', okType: 'primary',
      onOk: async () => {
        try {
          const res = await salesService.convertQuotation(record._id);
          if (res.success) {
            message.success(`✅ Converted! Sales Order ${res.data.salesOrder.orderNumber} created.`);
            fetchQuotations(); loadStats();
          }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Delete Quotation?', okText: 'Delete', okType: 'danger',
      onOk: async () => {
        try {
          const res = await salesService.deleteQuotation(id);
          if (res.success) { message.success('Deleted.'); fetchQuotations(); loadStats(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const isExpired = (validUntil) => validUntil && new Date(validUntil) < new Date();

  const columns = [
    { title: 'Quotation #', dataIndex: 'quotationNumber', width: 120,
      render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'quotationDate', width: 95,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Valid Until', dataIndex: 'validUntil', width: 100,
      render: (v, r) => (
        <span className={`text-xs ${isExpired(v) && !['converted','cancelled'].includes(r.status) ? 'text-red-500 font-medium' : ''}`}>
          {v ? new Date(v).toLocaleDateString('en-IN') : '—'}
        </span>
      )},
    { title: 'Customer / Dealer', key: 'customer', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[170px]">{r.dealerName || r.customerName || '—'}</div>
          <div className="text-xs text-gray-400">{r.dealerCode || r.customerPhone || ''}</div>
        </div>
      )},
    { title: 'Items', key: 'items', width: 55,
      render: (_, r) => <span className="text-xs">{r.items?.length || 0}</span> },
    { title: 'Total', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 100,
      render: (s, r) => {
        const expired = s === 'sent' && isExpired(r.validUntil);
        return <Tag color={expired ? 'orange' : STATUS_COLORS[s]}>{expired ? 'Expired' : s}</Tag>;
      }},
    { title: 'Actions', width: 120,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="View / Print">
            <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600"
              onClick={() => setViewRecord(r)} />
          </Tooltip>
          {r.status === 'draft' && (
            <Tooltip title="Mark Sent">
              <Button type="text" size="small" icon={<SendOutlined />} className="text-blue-500"
                onClick={() => handleStatusChange(r._id, 'sent')} />
            </Tooltip>
          )}
          {['sent', 'accepted'].includes(r.status) && (
            <Tooltip title="Convert to Sales Order">
              <Button type="text" size="small" icon={<SwapOutlined />} className="text-purple-600"
                onClick={() => handleConvert(r)} />
            </Tooltip>
          )}
          {['draft', 'cancelled'].includes(r.status) && (
            <Tooltip title="Delete">
              <Button type="text" size="small" icon={<DeleteOutlined />} className="text-red-400"
                onClick={() => handleDelete(r._id)} />
            </Tooltip>
          )}
          {!['converted', 'cancelled'].includes(r.status) && r.status !== 'draft' && (
            <Tooltip title="Cancel">
              <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500"
                onClick={() => handleStatusChange(r._id, 'cancelled')} />
            </Tooltip>
          )}
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quotation Manager</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create quotations, send to dealers, convert to Sales Orders</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>
          New Quotation
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={12} className="mb-4">
        <Col span={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<FileSpreadsheet size={13} />} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Sent" value={stats.sent || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Accepted" value={stats.accepted || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Converted" value={stats.converted || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Expired" value={stats.expired || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Total Value" value={`₹${Math.round(stats.totalValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search quotation #, dealer, customer..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-72" allowClear />
          <Select placeholder="Status"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))}
            value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={quotations} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 950 }}
          pagination={{ ...pagination, showSizeChanger: true,
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Modal */}
      <CreateQuotationModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSuccess={() => { fetchQuotations(); loadStats(); }}
      />

      {/* View / Print Modal */}
      {viewRecord && (
        <ViewQuotationModal
          quotationId={viewRecord._id}
          onClose={() => setViewRecord(null)}
          onConvert={() => { handleConvert(viewRecord); setViewRecord(null); }}
          onStatusChange={(id, s) => { handleStatusChange(id, s); setViewRecord(null); }}
        />
      )}
    </div>
  );
};

// ═══════════════════════════════════════════════
// CREATE QUOTATION MODAL
// ═══════════════════════════════════════════════
const CreateQuotationModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [dealers, setDealers] = useState([]);

  const [form, setForm] = useState({
    dealer: '', customerName: '', customerPhone: '', customerAddress: '',
    quotationDate: new Date().toISOString().split('T')[0],
    validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(),
    freightCharges: 0, otherCharges: 0,
    remarks: '', termsAndConditions: 'Prices are subject to change. GST extra as applicable.',
  });

  const [items, setItems] = useState([
    { product: '', productName: '', productCode: '', shade: '', batch: '',
      quantity: 1, unit: 'Box', rate: 0, discount: 0, discountType: 'flat', gstPercentage: 18 }
  ]);

  const [productSearches, setProductSearches] = useState({});
  const [productResults, setProductResults] = useState({});

  useEffect(() => {
    if (open) {
      masterService.getDealers({ limit: 100, status: 'active' }).then(r => {
        if (r.success) setDealers(r.data);
      }).catch(() => {});
    }
  }, [open]);

  const searchProduct = (idx, val) => {
    setProductSearches(p => ({ ...p, [idx]: val }));
    if (val.length < 2) { setProductResults(p => ({ ...p, [idx]: [] })); return; }
    setTimeout(() => {
      productService.getProducts({ search: val, limit: 10 }).then(r => {
        if (r.success) setProductResults(p => ({ ...p, [idx]: r.data }));
      }).catch(() => {});
    }, 300);
  };

  const selectProduct = (idx, prod) => {
    updateItem(idx, {
      product: prod._id, productName: prod.itemName, productCode: prod.productCode,
      rate: prod.dealerRate || prod.wholesaleRate || prod.mrp || 0,
      unit: prod.unit || 'Box', gstPercentage: prod.gst || 18,
    });
    setProductSearches(p => ({ ...p, [idx]: prod.itemName }));
    setProductResults(p => ({ ...p, [idx]: [] }));
  };

  const updateItem = (idx, changes) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, ...changes } : item));
  };

  const addItem = () => setItems(prev => [...prev, {
    product: '', productName: '', productCode: '', shade: '', batch: '',
    quantity: 1, unit: 'Box', rate: 0, discount: 0, discountType: 'flat', gstPercentage: 18
  }]);

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const calcTotals = () => {
    let subtotal = 0, totalTax = 0;
    items.forEach(item => {
      const base = item.quantity * item.rate;
      const disc = item.discountType === 'percentage' ? (base * item.discount) / 100 : item.discount * item.quantity;
      const taxable = base - disc;
      subtotal += taxable;
      totalTax += (taxable * item.gstPercentage) / 100;
    });
    const grand = subtotal + totalTax + (form.freightCharges || 0) + (form.otherCharges || 0);
    return { subtotal, totalTax, grandTotal: grand };
  };

  const handleSubmit = async () => {
    if (!items.some(i => i.product)) { message.error('Add at least one product'); return; }
    setLoading(true);
    try {
      const res = await salesService.createQuotation({ ...form, items });
      if (res.success) {
        message.success(`${res.data.quotationNumber} created!`);
        onSuccess?.(); handleClose();
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClose = () => {
    setForm({
      dealer: '', customerName: '', customerPhone: '', customerAddress: '',
      quotationDate: new Date().toISOString().split('T')[0],
      validUntil: (() => { const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().split('T')[0]; })(),
      freightCharges: 0, otherCharges: 0, remarks: '',
      termsAndConditions: 'Prices are subject to change. GST extra as applicable.',
    });
    setItems([{ product: '', productName: '', productCode: '', shade: '', batch: '', quantity: 1, unit: 'Box', rate: 0, discount: 0, discountType: 'flat', gstPercentage: 18 }]);
    setProductSearches({}); setProductResults({});
    onClose();
  };

  const { subtotal, totalTax, grandTotal } = calcTotals();

  return (
    <Modal title="New Quotation" open={open} onCancel={handleClose}
      width={1000} footer={null} destroyOnClose>
      <div className="space-y-4 mt-4">
        {/* Customer / Dealer */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dealer (optional)</label>
            <Select className="w-full" showSearch placeholder="Select dealer..." allowClear
              optionFilterProp="label" size="large"
              onChange={v => setForm(f => ({ ...f, dealer: v || '' }))}
              options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Walk-in Customer Name</label>
            <Input value={form.customerName} onChange={e => setForm(f => ({ ...f, customerName: e.target.value }))}
              placeholder="If not a registered dealer" size="large" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Customer Phone</label>
            <Input value={form.customerPhone} onChange={e => setForm(f => ({ ...f, customerPhone: e.target.value }))}
              placeholder="Phone number" size="large" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quotation Date</label>
            <Input type="date" value={form.quotationDate}
              onChange={e => setForm(f => ({ ...f, quotationDate: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Valid Until</label>
            <Input type="date" value={form.validUntil}
              onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
          </div>
        </div>

        {/* Items */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700">Products / Items *</label>
            <Button size="small" icon={<PlusOutlined />} onClick={addItem}>Add Row</Button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-blue-50">
                  <tr>
                    {['Product', 'Shade', 'Batch', 'Qty', 'Unit', 'Rate', 'Disc', 'GST%', 'Total', ''].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1.5 relative">
                        <Input value={productSearches[idx] ?? item.productName}
                          onChange={e => searchProduct(idx, e.target.value)}
                          placeholder="Search product..." className="w-44" />
                        {(productResults[idx] || []).length > 0 && (
                          <div className="absolute z-20 left-2 mt-1 w-72 bg-white border rounded-lg shadow-xl max-h-44 overflow-y-auto">
                            {(productResults[idx] || []).map(p => (
                              <div key={p._id} className="px-3 py-2 hover:bg-blue-50 cursor-pointer border-b border-gray-50"
                                onClick={() => selectProduct(idx, p)}>
                                <div className="text-xs font-semibold">{p.itemName}</div>
                                <div className="text-[10px] text-gray-400">{p.productCode} · ₹{p.dealerRate || p.mrp}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={item.shade} onChange={e => updateItem(idx, { shade: e.target.value })} className="w-18" placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={item.batch} onChange={e => updateItem(idx, { batch: e.target.value })} className="w-18" placeholder="—" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={1} value={item.quantity} onChange={v => updateItem(idx, { quantity: v || 1 })} className="w-16" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={item.unit} onChange={v => updateItem(idx, { unit: v })} className="w-20"
                          options={[{ value: 'Box', label: 'Box' }, { value: 'Pcs', label: 'Pcs' }, { value: 'Sqft', label: 'Sqft' }]} />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={item.rate} onChange={v => updateItem(idx, { rate: v || 0 })} prefix="₹" className="w-24" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={item.discount} onChange={v => updateItem(idx, { discount: v || 0 })} className="w-16" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} max={28} value={item.gstPercentage} onChange={v => updateItem(idx, { gstPercentage: v || 18 })} className="w-14" />
                      </td>
                      <td className="px-2 py-1.5 font-medium text-right">
                        {(() => {
                          const base = item.quantity * item.rate;
                          const disc = item.discountType === 'percentage' ? (base * item.discount) / 100 : item.discount * item.quantity;
                          const taxable = base - disc;
                          const gst = (taxable * item.gstPercentage) / 100;
                          return `₹${(taxable + gst).toFixed(0)}`;
                        })()}
                      </td>
                      <td className="px-2 py-1.5">
                        {items.length > 1 && (
                          <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Charges & Remarks */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Freight Charges</label>
                <InputNumber value={form.freightCharges} onChange={v => setForm(f => ({ ...f, freightCharges: v || 0 }))} prefix="₹" className="w-full" min={0} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Other Charges</label>
                <InputNumber value={form.otherCharges} onChange={v => setForm(f => ({ ...f, otherCharges: v || 0 }))} prefix="₹" className="w-full" min={0} />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Remarks</label>
              <Input.TextArea rows={2} value={form.remarks} onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Terms & Conditions</label>
              <Input.TextArea rows={2} value={form.termsAndConditions} onChange={e => setForm(f => ({ ...f, termsAndConditions: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-end justify-end">
            <div className="w-full bg-blue-50 border border-blue-100 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{subtotal.toLocaleString()}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">GST</span><span>₹{totalTax.toFixed(2)}</span></div>
              {form.freightCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Freight</span><span>₹{form.freightCharges}</span></div>}
              {form.otherCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Other</span><span>₹{form.otherCharges}</span></div>}
              <Divider className="my-1" />
              <div className="flex justify-between font-bold text-base text-blue-700">
                <span>Grand Total</span><span>₹{Math.round(grandTotal).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<PlusOutlined />}>
            Create Quotation
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ═══════════════════════════════════════════════
// VIEW / PRINT QUOTATION MODAL
// ═══════════════════════════════════════════════
const ViewQuotationModal = ({ quotationId, onClose, onConvert, onStatusChange }) => {
  const [q, setQ] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    salesService.getQuotation(quotationId)
      .then(r => { if (r.success) setQ(r.data); })
      .catch(err => message.error(err.message))
      .finally(() => setLoading(false));
  }, [quotationId]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Quotation - ${q.quotationNumber}</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family:'Segoe UI',Arial,sans-serif; padding:24px; color:#333; font-size:12px; }
        .header { display:flex; justify-content:space-between; border-bottom:3px solid #1890ff; padding-bottom:14px; margin-bottom:18px; }
        .co-name { font-size:22px; font-weight:bold; color:#1890ff; }
        .co-sub { font-size:10px; color:#888; margin-top:3px; }
        .qt-title { font-size:18px; font-weight:bold; text-align:right; }
        .qt-meta { text-align:right; font-size:10px; color:#666; margin-top:4px; }
        .info-row { display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:16px; }
        .info-box { padding:10px; border:1px solid #eee; border-radius:5px; }
        .info-box .lbl { font-size:10px; color:#888; text-transform:uppercase; }
        .info-box .val { font-size:13px; font-weight:600; margin-top:2px; }
        table { width:100%; border-collapse:collapse; margin:14px 0; }
        th { background:#f5f5f5; padding:7px 9px; text-align:left; font-size:10px; text-transform:uppercase; color:#666; border-bottom:2px solid #ddd; }
        td { padding:7px 9px; border-bottom:1px solid #f0f0f0; font-size:11px; }
        .totals { margin-left:auto; width:260px; margin-top:12px; }
        .totals .row { display:flex; justify-content:space-between; padding:4px 0; font-size:12px; }
        .totals .grand { font-size:14px; font-weight:bold; color:#1890ff; border-top:2px solid #1890ff; padding-top:7px; margin-top:5px; }
        .terms { margin-top:20px; padding:12px; background:#f9f9f9; border-radius:5px; font-size:10px; color:#666; }
        .footer { margin-top:36px; border-top:1px solid #eee; padding-top:14px; display:flex; justify-content:space-between; }
        .sign-line { border-top:1px solid #555; width:140px; margin-top:38px; padding-top:4px; font-size:10px; color:#777; text-align:center; }
        @media print { body { padding:0; } }
      </style></head><body>
      ${printRef.current.innerHTML}
      </body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading || !q) return (
    <Modal open onCancel={onClose} footer={null} title="Loading...">
      <div className="py-8 text-center text-gray-400">Loading quotation...</div>
    </Modal>
  );

  const isExpired = q.validUntil && new Date(q.validUntil) < new Date();

  return (
    <Modal
      title={
        <div className="flex items-center gap-3">
          <span className="font-bold">{q.quotationNumber}</span>
          <Tag color={STATUS_COLORS[q.status]}>{q.status}</Tag>
          {isExpired && <Tag color="orange">Validity Expired</Tag>}
        </div>
      }
      open onCancel={onClose} width={820}
      footer={
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print PDF</Button>
          {['sent', 'accepted'].includes(q.status) && (
            <Button type="primary" icon={<SwapOutlined />} onClick={onConvert}>
              Convert to Sales Order
            </Button>
          )}
          {q.status === 'draft' && (
            <Button icon={<SendOutlined />} onClick={() => onStatusChange(q._id, 'sent')}>
              Mark as Sent
            </Button>
          )}
          <Button onClick={onClose}>Close</Button>
        </Space>
      }>
      <div className="space-y-4 mt-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-3 rounded border">
            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Customer / Dealer</div>
            <div className="font-bold text-base">{q.dealerName || q.customerName || '—'}</div>
            <div className="text-gray-500 text-xs mt-0.5">{q.dealerCode || q.customerPhone || ''}</div>
            {q.dealer?.gstin && <div className="text-xs text-gray-400">GSTIN: {q.dealer.gstin}</div>}
          </div>
          <div className="bg-blue-50 p-3 rounded border border-blue-100">
            <div className="text-xs text-gray-400 uppercase font-semibold mb-1">Quotation Details</div>
            <div className="space-y-1">
              <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{new Date(q.quotationDate).toLocaleDateString('en-IN')}</span></div>
              <div className="flex justify-between">
                <span className="text-gray-500">Valid Until:</span>
                <span className={isExpired ? 'text-red-500 font-medium' : ''}>{q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : '—'}</span>
              </div>
              {q.convertedToSO && (
                <div className="flex justify-between"><span className="text-gray-500">Converted SO:</span><span className="text-purple-600 font-medium">{q.convertedToSO.orderNumber || '—'}</span></div>
              )}
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div>
          <div className="font-semibold text-gray-700 mb-2">Items ({q.items?.length || 0})</div>
          <table className="w-full text-xs border border-gray-200 rounded overflow-hidden">
            <thead className="bg-blue-50">
              <tr>
                {['#','Product','Shade','Qty','Rate','Disc','GST%','Total'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {q.items?.map((item, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 text-gray-400">{i + 1}</td>
                  <td className="px-2 py-1.5">
                    <div className="font-medium">{item.productName || item.product?.itemName}</div>
                    <div className="text-[10px] text-gray-400">{item.productCode || item.product?.productCode}</div>
                  </td>
                  <td className="px-2 py-1.5">{item.shade || '—'}</td>
                  <td className="px-2 py-1.5">{item.quantity} {item.unit}</td>
                  <td className="px-2 py-1.5">₹{(item.rate || 0).toLocaleString()}</td>
                  <td className="px-2 py-1.5">{item.discount ? `${item.discount}${item.discountType === 'percentage' ? '%' : ''}` : '—'}</td>
                  <td className="px-2 py-1.5">{item.gstPercentage}%</td>
                  <td className="px-2 py-1.5 font-medium">₹{(item.totalAmount || 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{(q.subtotal || 0).toLocaleString()}</span></div>
            {q.totalDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{q.totalDiscount.toLocaleString()}</span></div>}
            <div className="flex justify-between"><span className="text-gray-500">GST</span><span>₹{(q.totalTax || 0).toLocaleString()}</span></div>
            {q.freightCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Freight</span><span>₹{q.freightCharges}</span></div>}
            {q.otherCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Other</span><span>₹{q.otherCharges}</span></div>}
            <Divider className="my-1" />
            <div className="flex justify-between font-bold text-base text-blue-700">
              <span>Grand Total</span><span>₹{(q.grandTotal || 0).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {q.remarks && <div className="text-gray-500 text-xs bg-gray-50 p-2 rounded">Remarks: {q.remarks}</div>}
        {q.termsAndConditions && <div className="text-gray-400 text-xs bg-gray-50 p-2 rounded">T&C: {q.termsAndConditions}</div>}
      </div>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="header">
            <div><div className="co-name">BDM TILES</div><div className="co-sub">Tiles &amp; Sanitary Ware Distributors</div></div>
            <div><div className="qt-title">QUOTATION</div>
              <div className="qt-meta"><div><strong>{q.quotationNumber}</strong></div>
                <div>Date: {new Date(q.quotationDate).toLocaleDateString('en-IN')}</div>
                <div>Valid Until: {q.validUntil ? new Date(q.validUntil).toLocaleDateString('en-IN') : '—'}</div></div></div>
          </div>
          <div className="info-row">
            <div className="info-box"><div className="lbl">To</div>
              <div className="val">{q.dealerName || q.customerName}</div>
              <div style={{fontSize:'10px',color:'#666'}}>{q.dealerCode || q.customerPhone}</div></div>
            <div className="info-box"><div className="lbl">Quotation No.</div>
              <div className="val">{q.quotationNumber}</div></div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th><th>GST%</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
            <tbody>{q.items?.map((item, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td><strong>{item.productName}</strong>{item.shade ? ` (${item.shade})` : ''}</td>
                <td>{item.quantity} {item.unit}</td>
                <td>₹{(item.rate || 0).toLocaleString()}</td>
                <td>{item.gstPercentage}%</td>
                <td style={{textAlign:'right'}}><strong>₹{(item.totalAmount || 0).toLocaleString()}</strong></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="totals">
            <div className="row"><span>Subtotal</span><span>₹{(q.subtotal || 0).toLocaleString()}</span></div>
            <div className="row"><span>GST</span><span>₹{(q.totalTax || 0).toLocaleString()}</span></div>
            {q.freightCharges > 0 && <div className="row"><span>Freight</span><span>₹{q.freightCharges}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>₹{(q.grandTotal || 0).toLocaleString()}</span></div>
          </div>
          {q.termsAndConditions && <div className="terms"><strong>Terms &amp; Conditions:</strong> {q.termsAndConditions}</div>}
          <div className="footer">
            <div className="sign-line">Prepared By</div>
            <div className="sign-line">Authorized Signatory</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default QuotationManager;
