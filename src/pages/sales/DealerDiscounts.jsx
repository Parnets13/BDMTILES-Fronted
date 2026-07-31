import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber,
  Alert, Switch, Tooltip
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined,
  ReloadOutlined, WarningOutlined, CheckOutlined
} from '@ant-design/icons';
import { Percent } from 'lucide-react';
import api from '../../config/api.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';

const dpService = {
  getAll:    (params) => api.get('/dealer-pricing', { params }),
  save:      (data)   => api.post('/dealer-pricing', data),
  update:    (id, d)  => api.put(`/dealer-pricing/${id}`, d),
  remove:    (id)     => api.delete(`/dealer-pricing/${id}`),
  getBulk:   (id)     => api.get(`/dealer-pricing/bulk-by-dealer/${id}`),
};

const emptyForm = () => ({
  dealer: '', dealerName: '',
  product: '', productName: '',
  discountType: 'percent',    // 'percent' | 'flat' | 'custom_rate'
  discountPercent: 0,
  discountFlat: 0,
  customRate: null,
  schemeDiscount: 0,
  minQty: 0,
  validFrom: '',
  validTo: '',
  remarks: '',
  isActive: true,
});

const DealerDiscounts = () => {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });

  const [dealers, setDealers] = useState([]);
  const [dealerFilter, setDealerFilter] = useState(undefined);
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [form, setForm] = useState(emptyForm());

  // Dealer + product search in modal
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerResults, setDealerResults] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [belowMinWarning, setBelowMinWarning] = useState(false);
  const [baseRate, setBaseRate] = useState(null);
  const [minRate, setMinRate] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await dpService.getAll({ dealer: dealerFilter, page, limit: 25 });
      if (res.success) {
        setRecords(res.data || []);
        const pg = res.pagination;
        setPagination({ current: pg?.currentPage || page, pageSize: 25, total: pg?.totalItems || 0 });
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [dealerFilter]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    masterService.getDealers({ limit: 200, status: 'active' }).then(r => {
      if (r.success) setDealers(r.data || []);
    }).catch(() => {});
  }, []);

  // Dealer search in modal
  useEffect(() => {
    if (dealerSearch.length < 2) { setDealerResults([]); return; }
    const t = setTimeout(() => {
      masterService.getDealers({ search: dealerSearch, limit: 10 }).then(r => {
        if (r.success) setDealerResults(r.data || []);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [dealerSearch]);

  // Product search in modal
  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const t = setTimeout(() => {
      productService.getProducts({ search: productSearch, limit: 10 }).then(r => {
        if (r.success) setProductResults(r.data || []);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(t);
  }, [productSearch]);

  // Check effective rate vs minimum when form values change
  useEffect(() => {
    if (!baseRate) { setBelowMinWarning(false); return; }
    let effective = baseRate;
    if (form.discountType === 'custom_rate' && form.customRate != null) {
      effective = form.customRate;
    } else if (form.discountType === 'percent') {
      effective = baseRate * (1 - (form.discountPercent || 0) / 100);
    } else if (form.discountType === 'flat') {
      effective = baseRate - (form.discountFlat || 0);
    }
    setBelowMinWarning(minRate != null && effective < minRate);
  }, [form.discountType, form.discountPercent, form.discountFlat, form.customRate, baseRate, minRate]);

  const openCreate = () => { setEditing(null); setForm(emptyForm()); setDealerSearch(''); setProductSearch(''); setBaseRate(null); setMinRate(null); setShowModal(true); };
  const openEdit = (r) => {
    setEditing(r);
    setDealerSearch(r.dealer?.businessName || r.dealerName || '');
    setProductSearch(r.product?.itemName || r.productName || '');
    setBaseRate(r.product?.dealerRate || null);
    setMinRate(r.product?.minimumSellingRate || null);
    setForm({
      dealer: r.dealer?._id || r.dealer,
      dealerName: r.dealer?.businessName || r.dealerName || '',
      product: r.product?._id || r.product,
      productName: r.product?.itemName || r.productName || '',
      discountType: r.customRate != null ? 'custom_rate' : r.discountFlat > 0 ? 'flat' : 'percent',
      discountPercent: r.discountPercent || 0,
      discountFlat: r.discountFlat || 0,
      customRate: r.customRate ?? null,
      schemeDiscount: r.schemeDiscount || 0,
      minQty: r.minQty || 0,
      validFrom: r.validFrom ? r.validFrom.split('T')[0] : '',
      validTo: r.validTo ? r.validTo.split('T')[0] : '',
      remarks: r.remarks || '',
      isActive: r.isActive !== false,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.dealer)   { message.error('Select a dealer');   return; }
    if (!form.product)  { message.error('Select a product');  return; }
    setSaveLoading(true);
    try {
      const payload = { ...form };
      if (form.discountType === 'percent')     { payload.customRate = null; payload.discountFlat = 0; }
      if (form.discountType === 'flat')        { payload.customRate = null; payload.discountPercent = 0; }
      if (form.discountType === 'custom_rate') { payload.discountPercent = 0; payload.discountFlat = 0; }

      const res = editing ? await dpService.update(editing._id, payload) : await dpService.save(payload);
      if (res.success) {
        message.success(editing ? 'Discount updated' : 'Discount created');
        setShowModal(false);
        load(1);
      }
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const handleToggle = async (id, isActive) => {
    try {
      await dpService.update(id, { isActive });
      message.success(isActive ? 'Enabled' : 'Disabled');
      load(pagination.current);
    } catch (err) { message.error(err.message); }
  };

  const handleDelete = async (id) => {
    try {
      await dpService.remove(id);
      message.success('Removed');
      load(1);
    } catch (err) { message.error(err.message); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  // Compute effective rate for display
  const effectiveRateDisplay = (r) => {
    const base = r.product?.dealerRate || r.product?.mrp || 0;
    if (r.customRate != null) return { rate: r.customRate, label: 'Custom Rate' };
    let rate = base;
    if (r.discountPercent > 0) rate = base * (1 - r.discountPercent / 100);
    if (r.discountFlat > 0)    rate = base - r.discountFlat;
    return { rate: Math.round(rate * 100) / 100, label: `Base: ₹${base}` };
  };

  const filteredRecords = records.filter(r =>
    !search ||
    (r.dealer?.businessName || r.dealerName || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.product?.itemName    || r.productName || '').toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-sm">{r.dealer?.businessName || r.dealerName || '—'}</div>
          <div className="text-xs text-gray-400 font-mono">{r.dealer?.dealerCode || ''}</div>
        </div>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.product?.itemName || r.productName || '—'}</div>
          <div className="text-xs text-gray-400 font-mono">{r.product?.productCode || ''}</div>
        </div>
      ),
    },
    {
      title: 'Discount',
      key: 'disc',
      width: 140,
      render: (_, r) => {
        if (r.customRate != null)   return <Tag color="purple">₹{r.customRate} (Fixed Rate)</Tag>;
        if (r.discountPercent > 0)  return <Tag color="blue">{r.discountPercent}% off</Tag>;
        if (r.discountFlat > 0)     return <Tag color="cyan">₹{r.discountFlat} flat off</Tag>;
        return <Tag color="default">No discount</Tag>;
      },
    },
    {
      title: 'Effective Rate',
      key: 'eff',
      width: 120,
      render: (_, r) => {
        const { rate, label } = effectiveRateDisplay(r);
        const minSell = r.product?.minimumSellingRate;
        const isBelowMin = minSell && rate < minSell;
        return (
          <div>
            <span className={`font-bold ${isBelowMin ? 'text-red-600' : 'text-green-700'}`}>₹{rate}</span>
            {isBelowMin && <Tooltip title={`Below min selling rate ₹${minSell}`}><WarningOutlined className="ml-1 text-red-500" /></Tooltip>}
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        );
      },
    },
    {
      title: 'Min Qty',
      dataIndex: 'minQty',
      width: 80,
      render: v => v > 0 ? <span className="text-xs">{v} units</span> : <span className="text-gray-400 text-xs">—</span>,
    },
    {
      title: 'Valid Until',
      dataIndex: 'validTo',
      width: 100,
      render: v => {
        if (!v) return <span className="text-gray-400 text-xs">No expiry</span>;
        const expired = new Date(v) < new Date();
        return <Tag color={expired ? 'red' : 'green'}>{new Date(v).toLocaleDateString('en-IN')}</Tag>;
      },
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      width: 70,
      render: (v, r) => (
        <Switch size="small" checked={v !== false}
          onChange={checked => handleToggle(r._id, checked)} />
      ),
    },
    {
      title: 'Actions',
      width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Button size="small" danger onClick={() => handleDelete(r._id)}>Del</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Percent size={22} className="text-orange-500" />
            Dealer Discounts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Dealer-specific rate overrides and discount settings per product
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Discount
          </Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total Overrides',  records.length,                                    '#1890ff'],
          ['Active',           records.filter(r => r.isActive !== false).length,   '#52c41a'],
          ['Custom Rates',     records.filter(r => r.customRate != null).length,   '#722ed1'],
          ['Below Min Rate',   records.filter(r => {
            const base = r.product?.dealerRate || 0;
            const rate = r.customRate ?? (r.discountPercent > 0 ? base * (1 - r.discountPercent/100) : base - (r.discountFlat || 0));
            return r.product?.minimumSellingRate && rate < r.product.minimumSellingRate;
          }).length, '#dc2626'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search dealer or product…" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Filter by dealer" allowClear value={dealerFilter}
            onChange={v => setDealerFilter(v)} className="w-56" showSearch
            filterOption={(input, opt) => opt.label?.toLowerCase().includes(input.toLowerCase())}
            options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="_id"
          loading={loading}
          size="small"
          pagination={{ ...pagination, onChange: load }}
          locale={{ emptyText: 'No dealer discounts configured.' }}
        />
      </div>

      {/* Add / Edit Modal */}
      <Modal
        title={<span className="font-bold">{editing ? 'Edit Dealer Discount' : 'Add Dealer Discount'}</span>}
        open={showModal}
        onCancel={() => setShowModal(false)}
        onOk={handleSave}
        okText={editing ? 'Update' : 'Save'}
        confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={560}
        destroyOnHidden
      >
        <Divider />

        {belowMinWarning && (
          <Alert
            className="mb-3"
            type="warning"
            showIcon
            message="Effective rate is below minimum selling rate"
            description="This override may require manager approval before it applies to orders."
          />
        )}

        <div className="space-y-3">
          {/* Dealer search */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dealer *</label>
            <div className="relative">
              <Input
                value={dealerSearch}
                onChange={e => { setDealerSearch(e.target.value); setF('dealer', ''); setF('dealerName', ''); }}
                placeholder="Type dealer name…"
              />
              {dealerResults.length > 0 && !form.dealer && (
                <div className="absolute z-50 bg-white border border-gray-200 rounded shadow-lg w-full max-h-40 overflow-y-auto">
                  {dealerResults.map(d => (
                    <div key={d._id}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => { setF('dealer', d._id); setF('dealerName', d.businessName); setDealerSearch(d.businessName); setDealerResults([]); }}>
                      <span className="font-medium">{d.businessName}</span>
                      <span className="text-gray-400 text-xs ml-2">{d.dealerCode}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Product search */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Product *</label>
            <div className="relative">
              <Input
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setF('product', ''); setBaseRate(null); setMinRate(null); }}
                placeholder="Type product name or code…"
              />
              {productResults.length > 0 && !form.product && (
                <div className="absolute z-50 bg-white border border-gray-200 rounded shadow-lg w-full max-h-40 overflow-y-auto">
                  {productResults.map(p => (
                    <div key={p._id}
                      className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                      onClick={() => {
                        setF('product', p._id); setF('productName', p.itemName);
                        setProductSearch(p.itemName); setProductResults([]);
                        setBaseRate(p.dealerRate || p.mrp || 0);
                        setMinRate(p.minimumSellingRate || null);
                      }}>
                      <span className="font-medium">{p.itemName}</span>
                      <span className="text-gray-400 text-xs ml-2">{p.productCode}</span>
                      <span className="text-green-700 text-xs ml-2">₹{p.dealerRate || p.mrp}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {baseRate != null && (
              <div className="text-xs text-gray-500 mt-1">
                Base dealer rate: <strong>₹{baseRate}</strong>
                {minRate ? ` · Min selling rate: ₹${minRate}` : ''}
              </div>
            )}
          </div>

          {/* Discount type */}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Discount Type</label>
            <Select value={form.discountType} onChange={v => setF('discountType', v)} className="w-full"
              options={[
                { value: 'percent',     label: '% Percentage Discount' },
                { value: 'flat',        label: '₹ Flat Amount Discount' },
                { value: 'custom_rate', label: '₹ Fixed Custom Rate' },
              ]} />
          </div>

          {form.discountType === 'percent' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Discount %</label>
              <InputNumber value={form.discountPercent} onChange={v => setF('discountPercent', v || 0)}
                min={0} max={100} suffix="%" className="w-40" />
            </div>
          )}
          {form.discountType === 'flat' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Flat Discount (₹)</label>
              <InputNumber value={form.discountFlat} onChange={v => setF('discountFlat', v || 0)}
                min={0} prefix="₹" className="w-40" />
            </div>
          )}
          {form.discountType === 'custom_rate' && (
            <div>
              <label className="text-xs text-gray-500 block mb-1">Fixed Rate (₹)</label>
              <InputNumber value={form.customRate} onChange={v => setF('customRate', v)}
                min={0} prefix="₹" className="w-40" />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Min Qty (units)</label>
              <InputNumber value={form.minQty} onChange={v => setF('minQty', v || 0)} min={0} className="w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Scheme Discount (₹)</label>
              <InputNumber value={form.schemeDiscount} onChange={v => setF('schemeDiscount', v || 0)} min={0} prefix="₹" className="w-full" />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valid From</label>
              <Input type="date" value={form.validFrom} onChange={e => setF('validFrom', e.target.value)} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Valid Until</label>
              <Input type="date" value={form.validTo} onChange={e => setF('validTo', e.target.value)} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={form.isActive} onChange={v => setF('isActive', v)} size="small" />
            <span className="text-sm text-gray-600">Active</span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DealerDiscounts;
