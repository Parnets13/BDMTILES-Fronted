import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message, Modal, InputNumber,
  Row, Col, Card, Statistic, Tooltip, Switch, Segmented
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, EditOutlined,
  DeleteOutlined, TagOutlined, ShopOutlined, ShoppingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api.js';
import salesService from '../../services/salesService.js';

const TARGET_COLORS = { product: 'blue', brand: 'purple', category: 'green', subcategory: 'orange' };

const DiscountMappingPage = () => {
  const [mappingType, setMappingType] = useState('sales');
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [targetTypeFilter, setTargetTypeFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [showModal, setShowModal] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const isPurchase = mappingType === 'purchase';

  const loadStats = useCallback(() => {
    salesService.getDiscountMappingStats({ mappingType }).then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  }, [mappingType]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await salesService.getDiscountMappings({
        page: pagination.current, limit: pagination.pageSize, search, targetType: targetTypeFilter, status: statusFilter, mappingType,
      });
      if (res.success) {
        setRules(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, targetTypeFilter, statusFilter, mappingType]);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const handleDelete = (id) => {
    Modal.confirm({
      title: 'Delete Discount Rule?', okText: 'Delete', okType: 'danger',
      content: 'Products using this rule will no longer get the discount.',
      onOk: async () => {
        try {
          const res = await salesService.deleteDiscountMapping(id);
          if (res.success) { message.success('Deleted.'); fetchRules(); loadStats(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    try {
      const res = await salesService.updateDiscountMappingStatus(id, { status: newStatus });
      if (res.success) { message.success(`Rule ${newStatus}.`); fetchRules(); loadStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Rule', key: 'rule', width: 220,
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.ruleName}</div>
          <div className="text-[10px] text-gray-400 font-mono">{r.ruleCode}</div>
        </div>
      )},
    { title: 'Target', key: 'target', width: 200,
      render: (_, r) => (
        <div>
          <Tag color={TARGET_COLORS[r.targetType]} className="text-[10px]">{r.targetType}</Tag>
          <span className="text-xs ml-1">{r.targetName || '—'}</span>
        </div>
      )},
    { title: 'Discount', key: 'discount', width: 160,
      render: (_, r) => {
        if (isPurchase) {
          return (
            <div>
              <span className="text-sm font-bold text-green-600">{r.directDiscountPercentage || 0}%</span>
              {r.floatingDiscountEnabled && (
                <div className="text-[10px] text-emerald-500">float {r.floatingDiscountMin}%–{r.floatingDiscountMax}%</div>
              )}
            </div>
          );
        }
        return (
          <div>
            {r.discountType === 'slab' ? (
              <span className="text-sm font-bold text-purple-600">Slab ({(r.slabs || []).length})</span>
            ) : (
              <>
                {(r.discountType === 'percentage' || r.discountType === 'both') && (
                  <span className="text-sm font-bold text-green-600">{r.discountPercentage}%</span>
                )}
                {r.discountType === 'both' && <span className="text-gray-400 mx-1">+</span>}
                {(r.discountType === 'flat' || r.discountType === 'both') && (
                  <span className="text-sm font-bold text-green-600">₹{r.discountFlat}</span>
                )}
              </>
            )}
            <div className="text-[10px] text-gray-400">Max: {r.maxDiscountPercentage}%</div>
          </div>
        );
      }},
    { title: isPurchase ? 'Suppliers' : 'For', key: 'applicableTo', width: 180,
      render: (_, r) => {
        if (isPurchase) {
          const list = r.suppliers || [];
          return list.length
            ? <div className="flex flex-wrap gap-0.5">{list.map(s => <Tag key={s._id || s} className="text-[9px]">{s.companyName || 'Supplier'}</Tag>)}</div>
            : <Tag color="blue">All Suppliers</Tag>;
        }
        return r.applicableTo === 'all'
          ? <Tag color="blue">All Types</Tag>
          : <div className="flex flex-wrap gap-0.5">{(r.applicableDealerTypes || []).map(t => <Tag key={t} className="text-[9px]">{t}</Tag>)}</div>;
      }
    },
    { title: 'Validity', key: 'validity', width: 150,
      render: (_, r) => (
        <div className="text-xs">
          <div>{dayjs(r.validFrom).format('DD/MM/YY')} — {dayjs(r.validTo).format('DD/MM/YY')}</div>
          {new Date(r.validTo) < new Date() && <Tag color="red" className="text-[9px] mt-0.5">Expired</Tag>}
        </div>
      )},
    { title: 'Priority', dataIndex: 'priority', width: 70, render: v => <span className="font-mono text-xs">{v}</span> },
    { title: 'Status', dataIndex: 'status', width: 90,
      render: (s, r) => (
        <Switch size="small" checked={s === 'active'} onChange={() => handleToggleStatus(r._id, s)}
          checkedChildren="On" unCheckedChildren="Off" />
      )},
    { title: '', width: 80,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditRecord(r); setShowModal(true); }} /></Tooltip>
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r._id)} /></Tooltip>
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Discount Mapping</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {isPurchase
              ? 'Supplier purchase discounts — auto-applied when raising POs / supplier quotations'
              : 'Sales discounts by Product, Brand, Category, or Subcategory for dealer / builder types'}
          </p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => { setEditRecord(null); setShowModal(true); }}
          style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          {isPurchase ? 'New Supplier Discount' : 'New Sales Discount'}
        </Button>
      </div>

      {/* Sales vs Supplier tabs */}
      <Segmented
        className="mb-4"
        size="large"
        value={mappingType}
        onChange={(value) => {
          setMappingType(value);
          setPagination(p => ({ ...p, current: 1 }));
          setSearch(''); setTargetTypeFilter(undefined); setStatusFilter(undefined);
        }}
        options={[
          { value: 'sales', label: <span className="flex items-center gap-1.5"><ShopOutlined /> Dealer / Builder</span> },
          { value: 'purchase', label: <span className="flex items-center gap-1.5"><ShoppingOutlined /> Supplier</span> },
        ]}
      />

      {/* Stats */}
      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Rules" value={stats.total || 0} prefix={<TagOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Active" value={stats.active || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Inactive" value={stats.inactive || 0} valueStyle={{ color: '#999' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Expired" value={stats.expired || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={2}><Card size="small"><Statistic title="Product" value={stats.byTargetType?.product || 0} /></Card></Col>
        <Col span={2}><Card size="small"><Statistic title="Brand" value={stats.byTargetType?.brand || 0} /></Card></Col>
        <Col span={2}><Card size="small"><Statistic title="Category" value={stats.byTargetType?.category || 0} /></Card></Col>
        <Col span={2}><Card size="small"><Statistic title="Subcat" value={stats.byTargetType?.subcategory || 0} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search rule name, code, target..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear />
          <Select placeholder="Target Type" value={targetTypeFilter} onChange={v => setTargetTypeFilter(v)} allowClear className="w-36"
            options={[{ value: 'product', label: 'Product' }, { value: 'brand', label: 'Brand' }, { value: 'category', label: 'Category' }, { value: 'subcategory', label: 'Subcategory' }]} />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-28"
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'expired', label: 'Expired' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setTargetTypeFilter(undefined); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={rules} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create/Edit Modal */}
      <DiscountRuleModal
        open={showModal}
        mappingType={mappingType}
        editRecord={editRecord}
        onClose={() => { setShowModal(false); setEditRecord(null); }}
        onSuccess={() => { fetchRules(); loadStats(); }}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════
// CREATE / EDIT DISCOUNT RULE MODAL
// ═══════════════════════════════════════════════
const emptyForm = () => ({
  ruleName: '', targetType: 'brand',
  product: '', brand: '', category: '', subcategory: '',
  selectedBrand: '', selectedCategory: '',
  applicableTo: 'all', applicableDealerTypes: [],
  discountType: 'percentage', discountPercentage: 0, discountFlat: 0, maxDiscountPercentage: 50, slabs: [],
  priority: 0, validFrom: dayjs().format('YYYY-MM-DD'), validTo: dayjs().add(1, 'year').format('YYYY-MM-DD'),
  minOrderQty: 0, minOrderAmount: 0, remarks: '',
  // Purchase (supplier) fields
  suppliers: [], directDiscountPercentage: 0,
  floatingDiscountEnabled: false, floatingDiscountMin: 0, floatingDiscountMax: 0,
});

const DiscountRuleModal = ({ open, mappingType = 'sales', editRecord, onClose, onSuccess }) => {
  const isPurchase = mappingType === 'purchase';
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Cascading dropdowns
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [suppliers, setSuppliers] = useState([]);

  const [form, setForm] = useState(emptyForm());

  // Load brands on mount, and suppliers for purchase mode
  useEffect(() => {
    if (open) {
      api.get('/category-setup/brands', { params: { limit: 200 } }).then(r => {
        if (r.success) setBrands(r.data || []);
      }).catch(() => {});
      if (isPurchase) {
        api.get('/masters/suppliers', { params: { status: 'active', limit: 200 } }).then(r => {
          if (r.success) setSuppliers(r.data || []);
        }).catch(() => {});
      }
    }
  }, [open, isPurchase]);

  // Load categories when brand is selected (for category/subcategory targets)
  useEffect(() => {
    if (form.selectedBrand && (form.targetType === 'category' || form.targetType === 'subcategory')) {
      api.get(`/category-setup/brands/${form.selectedBrand}/categories`, { params: { limit: 200 } }).then(r => {
        if (r.success) setCategories(r.data || []);
      }).catch(() => {});
    } else {
      setCategories([]);
    }
  }, [form.selectedBrand, form.targetType]);

  // Load subcategories when brand + category selected (for subcategory target)
  useEffect(() => {
    if (form.selectedBrand && form.selectedCategory && form.targetType === 'subcategory') {
      api.get(`/category-setup/brands/${form.selectedBrand}/categories/${form.selectedCategory}/subcategories`, { params: { limit: 200 } }).then(r => {
        if (r.success) setSubcategories(r.data || []);
      }).catch(() => {});
    } else {
      setSubcategories([]);
    }
  }, [form.selectedBrand, form.selectedCategory, form.targetType]);

  // Search products
  useEffect(() => {
    if (form.targetType === 'product' && productSearch.length >= 2) {
      const timer = setTimeout(() => {
        api.get('/products', { params: { search: productSearch, limit: 30, status: 'active' } }).then(r => {
          if (r.success) setProducts(r.data || []);
        }).catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [productSearch, form.targetType]);

  // Populate form when editing
  useEffect(() => {
    if (editRecord) {
      const brandId = editRecord.brand?._id || editRecord.brand || '';
      const categoryId = editRecord.category?._id || editRecord.category || '';
      setForm({
        ruleName: editRecord.ruleName || '',
        targetType: editRecord.targetType || 'brand',
        product: editRecord.product?._id || editRecord.product || '',
        brand: brandId,
        category: categoryId,
        subcategory: editRecord.subcategory?._id || editRecord.subcategory || '',
        selectedBrand: brandId,
        selectedCategory: categoryId,
        applicableTo: editRecord.applicableTo || 'all',
        applicableDealerTypes: editRecord.applicableDealerTypes || [],
        discountType: editRecord.discountType || 'percentage',
        discountPercentage: editRecord.discountPercentage || 0,
        discountFlat: editRecord.discountFlat || 0,
        maxDiscountPercentage: editRecord.maxDiscountPercentage || 50,
        slabs: editRecord.slabs || [],
        priority: editRecord.priority || 0,
        validFrom: editRecord.validFrom ? dayjs(editRecord.validFrom).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        validTo: editRecord.validTo ? dayjs(editRecord.validTo).format('YYYY-MM-DD') : dayjs().add(1, 'year').format('YYYY-MM-DD'),
        minOrderQty: editRecord.minOrderQty || 0,
        minOrderAmount: editRecord.minOrderAmount || 0,
        remarks: editRecord.remarks || '',
        suppliers: (editRecord.suppliers || []).map(s => s._id || s),
        directDiscountPercentage: editRecord.directDiscountPercentage || 0,
        floatingDiscountEnabled: Boolean(editRecord.floatingDiscountEnabled),
        floatingDiscountMin: editRecord.floatingDiscountMin || 0,
        floatingDiscountMax: editRecord.floatingDiscountMax || 0,
      });
      if (editRecord.product?.itemName) setProductSearch(editRecord.product.itemName);
    } else {
      setForm(emptyForm());
      setProductSearch('');
    }
  }, [editRecord, open]);

  const handleSubmit = async () => {
    const newErrors = {};
    if (!form.ruleName.trim()) newErrors.ruleName = 'Rule name is required';
    if (form.targetType === 'product' && !form.product) newErrors.target = 'Select a product';
    if (form.targetType === 'brand' && !form.brand) newErrors.target = 'Select a brand';
    if (form.targetType === 'category' && !form.selectedBrand) newErrors.selectedBrand = 'Select brand first';
    if (form.targetType === 'category' && form.selectedBrand && !form.category) newErrors.target = 'Select a category';
    if (form.targetType === 'subcategory' && !form.selectedBrand) newErrors.selectedBrand = 'Select brand first';
    if (form.targetType === 'subcategory' && form.selectedBrand && !form.selectedCategory) newErrors.selectedCategory = 'Select category first';
    if (form.targetType === 'subcategory' && form.selectedCategory && !form.subcategory) newErrors.target = 'Select a subcategory';
    if (isPurchase) {
      if (Number(form.directDiscountPercentage) <= 0 && !form.floatingDiscountEnabled) {
        newErrors.discount = 'Set a direct discount % or enable a floating range';
      }
      if (form.floatingDiscountEnabled && Number(form.floatingDiscountMax) < Number(form.floatingDiscountMin)) {
        newErrors.discount = 'Floating max must be greater than or equal to min';
      }
    } else if (form.discountType === 'slab') {
      if (!form.slabs || form.slabs.length === 0) newErrors.discount = 'Add at least one quantity slab';
      else if (form.slabs.every(s => s.discountPercentage <= 0 && s.discountFlat <= 0)) newErrors.discount = 'At least one slab must have a discount value';
    } else if (form.discountPercentage <= 0 && form.discountFlat <= 0) {
      newErrors.discount = 'Set discount % or flat amount';
    }
    if (!form.validTo) newErrors.validTo = 'Valid To date is required';
    if (!isPurchase && form.applicableTo === 'specific_types' && form.applicableDealerTypes.length === 0) newErrors.dealerTypes = 'Select at least one dealer type';

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      message.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const payload = { ...form, mappingType };
      // Clean unused fields
      delete payload.selectedBrand;
      delete payload.selectedCategory;
      if (payload.targetType !== 'product') delete payload.product;
      if (payload.targetType !== 'brand') delete payload.brand;
      if (payload.targetType !== 'category') delete payload.category;
      if (payload.targetType !== 'subcategory') delete payload.subcategory;
      if (isPurchase) {
        // Purchase rules apply to all dealer types by construction; suppliers scope them.
        payload.applicableTo = 'all';
        payload.applicableDealerTypes = [];
      } else {
        delete payload.suppliers;
        delete payload.directDiscountPercentage;
        delete payload.floatingDiscountEnabled;
        delete payload.floatingDiscountMin;
        delete payload.floatingDiscountMax;
        if (payload.applicableTo === 'all') payload.applicableDealerTypes = [];
      }

      let res;
      if (editRecord) {
        res = await salesService.updateDiscountMapping(editRecord._id, payload);
      } else {
        res = await salesService.createDiscountMapping(payload);
      }
      if (res.success) {
        message.success(editRecord ? 'Rule updated.' : 'Rule created.');
        onSuccess?.(); onClose();
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const dealerTypeOptions = [
    { value: 'dealer', label: 'Dealer' },
    { value: 'wholesaler', label: 'Wholesaler' },
    { value: 'retail', label: 'Retail' },
    { value: 'distributor', label: 'Distributor' },
    { value: 'builder', label: 'Builder' },
  ];

  return (
    <Modal
      title={
        <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF5F03] font-bold border border-orange-100 shadow-2xs">
            <TagOutlined className="text-lg" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 m-0">
              {editRecord ? 'Edit' : 'New'} {isPurchase ? 'Supplier Discount' : 'Sales Discount'} Rule
            </h2>
            <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">
              {isPurchase
                ? 'Target level, applicable suppliers, purchase discount & floating range'
                : 'Configure target level, dealer applicability, discount types & validity constraints'}
            </p>
          </div>
        </div>
      }
      open={open}
      onCancel={onClose}
      width="min(1280px, calc(100vw - 32px))"
      centered
      styles={{ body: { padding: '16px 24px 20px 24px' } }}
      footer={
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
          <Button size="large" onClick={onClose} className="rounded-xl px-5">Cancel</Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading} icon={editRecord ? <EditOutlined /> : <PlusOutlined />} className="rounded-xl px-6 bg-[#FF5F03] hover:bg-[#e05302] border-0">
            {editRecord ? 'Update Discount Rule' : 'Create Discount Rule'}
          </Button>
        </div>
      }
      destroyOnHidden
    >
      <div className="max-h-[calc(85vh-120px)] overflow-y-auto space-y-5 pr-1 py-1">

        {/* Rule Name */}
        <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-100">
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">Rule Name *</label>
          <Input value={form.ruleName} onChange={e => { setForm(f => ({ ...f, ruleName: e.target.value })); setErrors(e2 => ({ ...e2, ruleName: '' })); }}
            placeholder="e.g. Kajaria 10% for Dealers, Somany Builder Special" size="large" className="rounded-lg"
            status={errors.ruleName ? 'error' : ''} />
          {errors.ruleName && <div className="text-xs text-red-500 mt-1 font-medium">{errors.ruleName}</div>}
        </div>

        {/* Target Type */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <label className="text-xs font-semibold text-slate-700 block mb-2.5">Discount Target Level *</label>
          <div className="flex gap-2.5 flex-wrap mb-3.5">
            {[
              { value: 'brand', label: 'Entire Brand' },
              { value: 'category', label: 'Category' },
              { value: 'subcategory', label: 'Subcategory' },
              { value: 'product', label: 'Specific Product' },
            ].map(t => (
              <button key={t.value}
                className={`px-4 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${form.targetType === t.value
                  ? 'bg-[#FF5F03] text-white border-[#FF5F03] shadow-xs' : 'text-slate-600 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'}`}
                onClick={() => setForm(f => ({ ...f, targetType: t.value, product: '', brand: '', category: '', subcategory: '', selectedBrand: '', selectedCategory: '' }))}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Target Selection — cascading */}
          <div className={`bg-slate-50 border rounded-xl p-4 ${errors.target || errors.selectedBrand || errors.selectedCategory ? 'border-red-300' : 'border-slate-200'}`}>
            {form.targetType === 'brand' && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Select Brand *</label>
                <Select showSearch className="w-full" size="large" value={form.brand || undefined}
                  placeholder="Select brand..." optionFilterProp="label"
                  status={errors.target ? 'error' : ''}
                  onChange={v => { setForm(f => ({ ...f, brand: v })); setErrors(e => ({ ...e, target: '' })); }}
                  options={brands.map(b => ({ value: b._id, label: b.name }))} />
                {errors.target && <div className="text-xs text-red-500 mt-1 font-medium">{errors.target}</div>}
              </div>
            )}

            {form.targetType === 'category' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Select Brand *</label>
                  <Select showSearch className="w-full" size="large" value={form.selectedBrand || undefined}
                    placeholder="First select brand..." optionFilterProp="label"
                    status={errors.selectedBrand ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, selectedBrand: v, category: '', selectedCategory: '' })); setErrors(e => ({ ...e, selectedBrand: '', target: '' })); }}
                    options={brands.map(b => ({ value: b._id, label: b.name }))} />
                  {errors.selectedBrand && <div className="text-xs text-red-500 mt-1 font-medium">{errors.selectedBrand}</div>}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Select Category *</label>
                  <Select showSearch className="w-full" size="large" value={form.category || undefined}
                    placeholder={form.selectedBrand ? 'Select category...' : 'Select brand first'}
                    disabled={!form.selectedBrand} optionFilterProp="label"
                    status={errors.target ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, category: v })); setErrors(e => ({ ...e, target: '' })); }}
                    options={categories.map(c => ({ value: c._id, label: c.name }))} />
                  {errors.target && <div className="text-xs text-red-500 mt-1 font-medium">{errors.target}</div>}
                </div>
              </div>
            )}

            {form.targetType === 'subcategory' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Select Brand *</label>
                  <Select showSearch className="w-full" size="large" value={form.selectedBrand || undefined}
                    placeholder="First select brand..." optionFilterProp="label"
                    status={errors.selectedBrand ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, selectedBrand: v, selectedCategory: '', category: '', subcategory: '' })); setErrors(e => ({ ...e, selectedBrand: '', selectedCategory: '', target: '' })); }}
                    options={brands.map(b => ({ value: b._id, label: b.name }))} />
                  {errors.selectedBrand && <div className="text-xs text-red-500 mt-1 font-medium">{errors.selectedBrand}</div>}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Select Category *</label>
                  <Select showSearch className="w-full" size="large" value={form.selectedCategory || undefined}
                    placeholder={form.selectedBrand ? 'Select category...' : 'Select brand first'}
                    disabled={!form.selectedBrand} optionFilterProp="label"
                    status={errors.selectedCategory ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, selectedCategory: v, subcategory: '' })); setErrors(e => ({ ...e, selectedCategory: '', target: '' })); }}
                    options={categories.map(c => ({ value: c._id, label: c.name }))} />
                  {errors.selectedCategory && <div className="text-xs text-red-500 mt-1 font-medium">{errors.selectedCategory}</div>}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Select Subcategory *</label>
                  <Select showSearch className="w-full" size="large" value={form.subcategory || undefined}
                    placeholder={form.selectedCategory ? 'Select subcategory...' : 'Select category first'}
                    disabled={!form.selectedCategory} optionFilterProp="label"
                    status={errors.target ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, subcategory: v })); setErrors(e => ({ ...e, target: '' })); }}
                    options={subcategories.map(s => ({ value: s._id, label: s.name }))} />
                  {errors.target && <div className="text-xs text-red-500 mt-1 font-medium">{errors.target}</div>}
                </div>
              </div>
            )}

            {form.targetType === 'product' && (
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Search & Select Product *</label>
                <Select showSearch className="w-full" size="large" value={form.product || undefined}
                  placeholder="Type product name or code to search..."
                  filterOption={false}
                  status={errors.target ? 'error' : ''}
                  onSearch={v => setProductSearch(v)}
                  onChange={v => { setForm(f => ({ ...f, product: v })); setErrors(e => ({ ...e, target: '' })); }}
                  options={products.map(p => ({ value: p._id, label: `${p.itemName} (${p.productCode})` }))}
                  notFoundContent={productSearch.length < 2 ? 'Type at least 2 characters...' : 'No products found'} />
                {errors.target && <div className="text-xs text-red-500 mt-1 font-medium">{errors.target}</div>}
              </div>
            )}
          </div>
        </div>

        {/* Applicable To (sales only) */}
        {!isPurchase && (
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Applicable To</label>
              <Select value={form.applicableTo} onChange={v => { setForm(f => ({ ...f, applicableTo: v })); setErrors(e => ({ ...e, dealerTypes: '' })); }} className="w-full" size="large"
                options={[{ value: 'all', label: 'All Dealer / Customer Types' }, { value: 'specific_types', label: 'Specific Types Only' }]} />
            </div>
            {form.applicableTo === 'specific_types' && (
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1.5">Select Dealer Types *</label>
                <Select mode="multiple" value={form.applicableDealerTypes} size="large"
                  status={errors.dealerTypes ? 'error' : ''}
                  onChange={v => { setForm(f => ({ ...f, applicableDealerTypes: v })); setErrors(e => ({ ...e, dealerTypes: '' })); }}
                  className="w-full" options={dealerTypeOptions} placeholder="Select types..." />
                {errors.dealerTypes && <div className="text-xs text-red-500 mt-1 font-medium">{errors.dealerTypes}</div>}
              </div>
            )}
          </div>
        </div>
        )}

        {/* Suppliers + purchase discount (purchase only) */}
        {isPurchase && (
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs space-y-4">
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Applicable Suppliers</label>
            <Select mode="multiple" allowClear showSearch optionFilterProp="label" size="large" className="w-full"
              value={form.suppliers} onChange={v => setForm(f => ({ ...f, suppliers: v }))}
              placeholder="Leave empty to apply to all suppliers"
              options={suppliers.map(s => ({ value: s._id, label: `${s.companyName}${s.supplierCode ? ` (${s.supplierCode})` : ''}` }))} />
            <div className="text-[11px] text-slate-500 mt-1">Empty = the discount applies to every supplier for this target.</div>
          </div>
        </div>
        )}

        {/* Purchase discount config (purchase only) */}
        {isPurchase && (
        <div className={`bg-emerald-50/50 border rounded-xl p-5 ${errors.discount ? 'border-red-300' : 'border-emerald-200/80'}`}>
          <label className="text-sm text-emerald-950 font-bold block mb-1">Purchase Discount *</label>
          <p className="text-[11px] text-slate-500 mb-3">Baseline discount the supplier gives. The buyer may accept a higher discount (up to the floating max) during PO / supplier quotation — never lower than the floating min.</p>
          {errors.discount && <div className="text-xs text-red-500 mb-2 font-medium">{errors.discount}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Direct Discount %</label>
              <InputNumber min={0} max={100} value={form.directDiscountPercentage} size="large" className="w-full" suffix="%"
                onChange={v => { setForm(f => ({ ...f, directDiscountPercentage: v || 0 })); setErrors(e => ({ ...e, discount: '' })); }} />
            </div>
            <div className="flex items-end pb-1.5">
              <Switch checked={form.floatingDiscountEnabled} onChange={v => setForm(f => ({ ...f, floatingDiscountEnabled: v }))}
                checkedChildren="Floating" unCheckedChildren="Fixed" />
              <span className="text-xs text-slate-500 ml-2">Allow a negotiable range</span>
            </div>
            {form.floatingDiscountEnabled && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Floating Min %</label>
                  <InputNumber min={0} max={100} value={form.floatingDiscountMin} size="large" className="w-full" suffix="%"
                    onChange={v => { setForm(f => ({ ...f, floatingDiscountMin: v || 0 })); setErrors(e => ({ ...e, discount: '' })); }} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Floating Max %</label>
                  <InputNumber min={0} max={100} value={form.floatingDiscountMax} size="large" className="w-full" suffix="%"
                    onChange={v => { setForm(f => ({ ...f, floatingDiscountMax: v || 0 })); setErrors(e => ({ ...e, discount: '' })); }} />
                </div>
              </>
            )}
          </div>
        </div>
        )}

        {/* Discount Values (sales only) */}
        {!isPurchase && (
        <div className={`bg-emerald-50/50 border rounded-xl p-5 ${errors.discount ? 'border-red-300' : 'border-emerald-200/80'}`}>
          <label className="text-sm text-emerald-950 font-bold block mb-3">Discount Configuration *</label>
          {errors.discount && <div className="text-xs text-red-500 mb-2 font-medium">{errors.discount}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Discount Type</label>
              <Select value={form.discountType} onChange={v => setForm(f => ({ ...f, discountType: v }))} className="w-full" size="large"
                options={[{ value: 'percentage', label: 'Percentage (%)' }, { value: 'flat', label: 'Flat (₹ per unit)' }, { value: 'both', label: 'Both (% + ₹)' }, { value: 'slab', label: 'Quantity Slab' }]} />
            </div>
            {form.discountType !== 'slab' && (
              <>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Discount %</label>
                  <InputNumber min={0} max={100} value={form.discountPercentage} size="large"
                    status={errors.discount && form.discountPercentage <= 0 && form.discountFlat <= 0 ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, discountPercentage: v || 0 })); setErrors(e => ({ ...e, discount: '' })); }} className="w-full" suffix="%" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-600 block mb-1">Flat ₹ (per unit)</label>
                  <InputNumber min={0} value={form.discountFlat} size="large"
                    status={errors.discount && form.discountPercentage <= 0 && form.discountFlat <= 0 ? 'error' : ''}
                    onChange={v => { setForm(f => ({ ...f, discountFlat: v || 0 })); setErrors(e => ({ ...e, discount: '' })); }} className="w-full" prefix="₹" />
                </div>
              </>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600 block mb-1">Max Discount Cap %</label>
              <InputNumber min={1} max={100} value={form.maxDiscountPercentage} size="large"
                onChange={v => setForm(f => ({ ...f, maxDiscountPercentage: v || 50 }))} className="w-full" suffix="%" />
            </div>
          </div>

          {/* Slab table */}
          {form.discountType === 'slab' && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-bold text-slate-700">Quantity Slabs</label>
                <Button size="small" type="primary" onClick={() => setForm(f => ({ ...f, slabs: [...(f.slabs || []), { minQty: 0, maxQty: 0, discountPercentage: 0, discountFlat: 0 }] }))} className="bg-emerald-600 hover:bg-emerald-700 border-0">
                  + Add Slab
                </Button>
              </div>
              <div className="border border-emerald-200/80 rounded-xl overflow-hidden bg-white">
                <table className="w-full text-xs">
                  <thead className="bg-emerald-100/60">
                    <tr>
                      <th className="px-3 py-2 text-left font-bold text-emerald-900">Min Qty</th>
                      <th className="px-3 py-2 text-left font-bold text-emerald-900">Max Qty</th>
                      <th className="px-3 py-2 text-left font-bold text-emerald-900">Discount %</th>
                      <th className="px-3 py-2 text-left font-bold text-emerald-900">Flat ₹</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(form.slabs || []).map((slab, si) => (
                      <tr key={si} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-3 py-1.5"><InputNumber min={0} value={slab.minQty} size="small" className="w-24"
                          onChange={v => { const s = [...(form.slabs || [])]; s[si] = { ...s[si], minQty: v || 0 }; setForm(f => ({ ...f, slabs: s })); }} /></td>
                        <td className="px-3 py-1.5"><InputNumber min={0} value={slab.maxQty} size="small" className="w-24" placeholder="0=unlimited"
                          onChange={v => { const s = [...(form.slabs || [])]; s[si] = { ...s[si], maxQty: v || 0 }; setForm(f => ({ ...f, slabs: s })); }} /></td>
                        <td className="px-3 py-1.5"><InputNumber min={0} max={100} value={slab.discountPercentage} size="small" className="w-24" suffix="%"
                          onChange={v => { const s = [...(form.slabs || [])]; s[si] = { ...s[si], discountPercentage: v || 0 }; setForm(f => ({ ...f, slabs: s })); setErrors(e => ({ ...e, discount: '' })); }} /></td>
                        <td className="px-3 py-1.5"><InputNumber min={0} value={slab.discountFlat} size="small" className="w-24" prefix="₹"
                          onChange={v => { const s = [...(form.slabs || [])]; s[si] = { ...s[si], discountFlat: v || 0 }; setForm(f => ({ ...f, slabs: s })); setErrors(e => ({ ...e, discount: '' })); }} /></td>
                        <td className="px-3 py-1.5 text-center"><Button type="text" size="small" danger onClick={() => { const s = [...(form.slabs || [])]; s.splice(si, 1); setForm(f => ({ ...f, slabs: s })); }}>✕</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(!form.slabs || form.slabs.length === 0) && <div className="text-center text-slate-400 text-xs py-4">No slabs added. Click "+ Add Slab"</div>}
              </div>
              <div className="text-[11px] text-slate-500 mt-1.5">Example: 1-10 boxes = 5%, 11-50 = 8%, 51+ = 12%. Set Max Qty to 0 for unlimited.</div>
            </div>
          )}
        </div>
        )}

        {/* Validity & Priority */}
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Valid From</label>
              <Input type="date" value={form.validFrom} size="large" onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Valid To *</label>
              <Input type="date" value={form.validTo} size="large"
                status={errors.validTo ? 'error' : ''}
                onChange={e => { setForm(f => ({ ...f, validTo: e.target.value })); setErrors(er => ({ ...er, validTo: '' })); }} />
              {errors.validTo && <div className="text-xs text-red-500 mt-1 font-medium">{errors.validTo}</div>}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Priority (higher wins)</label>
              <InputNumber min={0} max={999} value={form.priority} size="large"
                onChange={v => setForm(f => ({ ...f, priority: v || 0 }))} className="w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Remarks</label>
              <Input value={form.remarks} size="large" onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))} placeholder="Optional notes" />
            </div>
          </div>
        </div>

        {/* Min constraints (sales only) */}
        {!isPurchase && (
        <div className="bg-white p-4.5 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Min Order Qty (0 = no limit)</label>
              <InputNumber min={0} value={form.minOrderQty} size="large"
                onChange={v => setForm(f => ({ ...f, minOrderQty: v || 0 }))} className="w-full" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">Min Order Amount ₹ (0 = no limit)</label>
              <InputNumber min={0} value={form.minOrderAmount} size="large"
                onChange={v => setForm(f => ({ ...f, minOrderAmount: v || 0 }))} className="w-full" prefix="₹" />
            </div>
          </div>
        </div>
        )}

      </div>
    </Modal>
  );
};

export default DiscountMappingPage;
