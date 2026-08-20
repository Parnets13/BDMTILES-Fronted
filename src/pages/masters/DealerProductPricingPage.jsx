import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message, InputNumber,
  Modal, Divider, Tooltip, Tabs, Row, Col, Card, Statistic, Badge
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, SaveOutlined,
  ReloadOutlined, ArrowUpOutlined, ArrowDownOutlined,
  CloseOutlined, CheckOutlined, FilterOutlined
} from '@ant-design/icons';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';
import api from '../../config/api.js';

const RATE_FIELDS = [
  { key: 'basicPrice', label: 'Basic Price', color: '#fa8c16' },
  { key: 'excessPrice', label: 'Excess', color: '#faad14' },
  { key: 'mrp', label: 'MRP', color: '#000' },
  { key: 'dealerRate', label: 'Dealer', color: '#FF5F03' },
  { key: 'wholesaleRate', label: 'Wholesale', color: '#1890ff' },
  { key: 'retailRate', label: 'Retail', color: '#52c41a' },
  { key: 'distributorRate', label: 'Distributor', color: '#722ed1' },
  { key: 'builderRate', label: 'Builder', color: '#13c2c2' },
  { key: 'minimumSellingRate', label: 'Min Sell', color: '#f5222d' },
];

const DealerProductPricingPage = () => {
  const [activeTab, setActiveTab] = useState('pricing');
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });
  const [filters, setFilters] = useState({ brand: undefined, category: undefined, subcategory: undefined });

  // Inline editing
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({});
  const [saveLoading, setSaveLoading] = useState(false);

  // Bulk update
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    filterBy: 'all', filterId: '',
    priceField: 'dealerRate', changeType: 'increase_percent', changeValue: 0,
  });

  useEffect(() => {
    productService.getFilterOptions().then(r => { if (r.success) setFilterOptions(r.data); }).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      };
      const res = await productService.getProducts(params);
      if (res.success) {
        setProducts(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Start inline editing
  const startEdit = (record) => {
    setEditingId(record._id);
    setEditData({
      basicPrice: record.basicPrice || 0,
      excessPrice: record.excessPrice || 0,
      mrp: record.mrp || 0,
      dealerRate: record.dealerRate || 0,
      wholesaleRate: record.wholesaleRate || 0,
      retailRate: record.retailRate || 0,
      distributorRate: record.distributorRate || 0,
      builderRate: record.builderRate || 0,
      minimumSellingRate: record.minimumSellingRate || 0,
    });
  };

  const cancelEdit = () => { setEditingId(null); setEditData({}); };

  const saveEdit = async () => {
    setSaveLoading(true);
    try {
      const res = await productService.updateProduct(editingId, editData);
      if (res.success) {
        message.success('Prices updated!');
        setEditingId(null); setEditData({});
        fetchProducts();
      }
    } catch (err) { message.error(err.message); }
    finally { setSaveLoading(false); }
  };

  // Bulk update handler
  const handleBulkUpdate = async () => {
    if (!bulkForm.changeValue) { message.error('Enter a change value'); return; }
    if (bulkForm.filterBy !== 'all' && !bulkForm.filterId) { message.error('Select a filter target'); return; }
    setBulkLoading(true);
    try {
      const res = await productService.bulkPriceUpdate(bulkForm);
      if (res.success) {
        message.success(`${res.data.updatedCount} products updated!`);
        setBulkModal(false); setBulkForm(f => ({ ...f, changeValue: 0 }));
        fetchProducts();
      }
    } catch (err) { message.error(err.message); }
    finally { setBulkLoading(false); }
  };

  const columns = [
    { title: 'Product', key: 'product', width: 220, fixed: 'left',
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[200px]">{r.itemName}</div>
          <div className="text-[10px] text-gray-400">{r.productCode} · {r.brand?.name} · {r.tileSize}</div>
        </div>
      )},
    ...RATE_FIELDS.map(f => ({
      title: <span className="text-[10px] font-semibold" style={{ color: f.color }}>{f.label}</span>,
      key: f.key,
      width: 95,
      render: (_, r) => {
        if (editingId === r._id) {
          return (
            <InputNumber
              size="small"
              min={0}
              value={editData[f.key]}
              onChange={v => setEditData(d => ({ ...d, [f.key]: v || 0 }))}
              className="w-20"
              controls={false}
            />
          );
        }
        const val = r[f.key] || 0;
        return (
          <span className={`text-xs font-medium ${val > 0 ? '' : 'text-gray-300'}`} style={val > 0 ? { color: f.color } : {}}>
            {val > 0 ? `₹${val.toLocaleString()}` : '—'}
          </span>
        );
      },
    })),
    { title: 'Max Purchase', key: 'maxPurchase', width: 95,
      render: (_, r) => {
        const max = (r.basicPrice || 0) + (r.excessPrice || 0);
        return max > 0
          ? <Tag color="orange" className="text-[10px]">₹{max}</Tag>
          : <span className="text-gray-300 text-xs">—</span>;
      }},
    { title: 'Margin', key: 'margin', width: 70,
      render: (_, r) => {
        if (!r.dealerRate || !r.basicPrice) return <span className="text-gray-300 text-xs">—</span>;
        const margin = ((r.dealerRate - r.basicPrice) / r.basicPrice * 100).toFixed(1);
        return <span className={`text-xs font-semibold ${margin >= 15 ? 'text-green-600' : margin >= 5 ? 'text-orange-500' : 'text-red-600'}`}>{margin}%</span>;
      }},
    { title: '', key: 'actions', width: 80, fixed: 'right',
      render: (_, r) => {
        if (editingId === r._id) {
          return (
            <Space size="small">
              <Button type="text" size="small" icon={<CheckOutlined />}
                className="text-green-600" onClick={saveEdit} loading={saveLoading} />
              <Button type="text" size="small" icon={<CloseOutlined />}
                className="text-gray-400" onClick={cancelEdit} />
            </Space>
          );
        }
        return (
          <Button type="text" size="small" icon={<EditOutlined />}
            onClick={() => startEdit(r)} />
        );
      }},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Product Pricing</h1>
          <p className="text-sm text-gray-500 mt-0.5">View & edit all product rates — Dealer, Wholesale, Retail, Distributor, Builder. Click edit icon to modify.</p>
        </div>
        <Space>
          <Button icon={<ArrowUpOutlined />} onClick={() => setBulkModal(true)} type="primary" ghost>
            Bulk Price Update
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchProducts}>Refresh</Button>
        </Space>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5 uppercase">Search</label>
            <Input placeholder="Product name or code..." prefix={<SearchOutlined className="text-gray-400" />}
              value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
              className="w-56" allowClear size="middle" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5 uppercase">Brand</label>
            <Select placeholder="All Brands" allowClear value={filters.brand} showSearch optionFilterProp="label"
              onChange={v => setFilters(f => ({...f, brand: v}))} className="w-44"
              options={filterOptions.brands.map(b => ({ value: b._id, label: b.name }))} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5 uppercase">Category</label>
            <Select placeholder="All Categories" allowClear value={filters.category} showSearch optionFilterProp="label"
              onChange={v => setFilters(f => ({...f, category: v}))} className="w-44"
              options={filterOptions.categories.map(c => ({ value: c._id, label: c.name }))} />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5 uppercase">Subcategory</label>
            <Select placeholder="All" allowClear value={filters.subcategory} showSearch optionFilterProp="label"
              onChange={v => setFilters(f => ({...f, subcategory: v}))} className="w-40"
              options={filterOptions.subcategories.map(s => ({ value: s._id, label: s.name }))} />
          </div>
          <Button onClick={() => { setSearch(''); setFilters({ brand: undefined, category: undefined, subcategory: undefined }); }}>Clear</Button>
        </div>
      </div>

      {/* Summary Stats */}
      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Products" value={pagination.total || 0} valueStyle={{fontSize:16}} /></Card></Col>
        <Col span={5}><Card size="small" className="border-orange-100"><div><div className="text-[10px] text-gray-400">Rate Fields per Product</div><div className="text-base font-bold text-orange-600">9 rates</div></div></Card></Col>
        <Col span={5}><Card size="small" className="border-blue-100"><div className="text-[10px] text-gray-400 mb-0.5">Customer Types Covered</div><div className="flex flex-wrap gap-1">{['Dealer','Wholesale','Retail','Distributor','Builder'].map(t => <Tag key={t} className="text-[9px] m-0">{t}</Tag>)}</div></Card></Col>
        <Col span={10}><Card size="small" className="border-red-100"><div className="text-[10px] text-gray-400 mb-0.5">Purchase Rate Control</div><div className="text-xs text-red-600 font-medium">Basic Price + Excess Price = Max Purchase Rate. PO exceeding this will be blocked.</div></Card></Col>
      </Row>

      {/* Main Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={products}
          rowKey="_id"
          loading={loading}
          size="small"
          scroll={{ x: 1350 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50', '100'],
            showTotal: (t, r) => <span className="text-xs text-gray-500">{r[0]}–{r[1]} of {t} products</span>,
          }}
          onChange={(pag) => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))}
          rowClassName={(r) => editingId === r._id ? 'bg-yellow-50' : ''}
        />
      </div>

      {/* Bulk Price Update Modal */}
      <Modal
        title={<span className="flex items-center gap-2"><ArrowUpOutlined className="text-blue-600" /> Bulk Price Update</span>}
        open={bulkModal} onCancel={() => setBulkModal(false)} footer={null} width={650} destroyOnHidden>
        <div className="space-y-4 mt-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
            Update prices for multiple products at once — by brand, category, or all products. Applies to ALL dealers, wholesalers, retail etc.
          </div>

          <Row gutter={16}>
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2">Filter Products By</label>
              <Select className="w-full" size="large" value={bulkForm.filterBy}
                onChange={v => setBulkForm(f => ({...f, filterBy: v, filterId: ''}))}
                options={[
                  { value: 'all', label: 'All Active Products' },
                  { value: 'brand', label: 'By Brand' },
                  { value: 'category', label: 'By Category' },
                  { value: 'subcategory', label: 'By Subcategory' },
                ]} />
            </Col>
            {bulkForm.filterBy !== 'all' && (
              <Col span={12}>
                <label className="text-sm font-semibold block mb-2">
                  Select {bulkForm.filterBy === 'brand' ? 'Brand' : bulkForm.filterBy === 'category' ? 'Category' : 'Subcategory'}
                </label>
                <Select className="w-full" size="large" showSearch optionFilterProp="label"
                  value={bulkForm.filterId || undefined}
                  onChange={v => setBulkForm(f => ({...f, filterId: v}))}
                  placeholder={`Choose...`}
                  options={
                    bulkForm.filterBy === 'brand' ? filterOptions.brands.map(b => ({value: b._id, label: b.name})) :
                    bulkForm.filterBy === 'category' ? filterOptions.categories.map(c => ({value: c._id, label: c.name})) :
                    filterOptions.subcategories.map(s => ({value: s._id, label: s.name}))
                  } />
              </Col>
            )}
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2">Rate Field</label>
              <Select className="w-full" size="large" value={bulkForm.priceField}
                onChange={v => setBulkForm(f => ({...f, priceField: v}))}
                options={[
                  { value: 'all', label: 'All Rate Fields' },
                  { value: 'dealerRate', label: 'Dealer Rate' },
                  { value: 'wholesaleRate', label: 'Wholesale Rate' },
                  { value: 'retailRate', label: 'Retail Rate' },
                  { value: 'distributorRate', label: 'Distributor Rate' },
                  { value: 'builderRate', label: 'Builder Rate' },
                  { value: 'mrp', label: 'MRP' },
                ]} />
            </Col>
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2">Operation</label>
              <Select className="w-full" size="large" value={bulkForm.changeType}
                onChange={v => setBulkForm(f => ({...f, changeType: v}))}
                options={[
                  { value: 'increase_percent', label: 'Increase by %' },
                  { value: 'decrease_percent', label: 'Decrease by %' },
                  { value: 'increase_flat', label: 'Increase by ₹' },
                  { value: 'decrease_flat', label: 'Decrease by ₹' },
                  { value: 'set_value', label: 'Set exact value' },
                ]} />
            </Col>
          </Row>

          <div>
            <label className="text-sm font-semibold block mb-2">
              {bulkForm.changeType.includes('percent') ? 'Percentage Value (%)' : 'Amount (₹)'}
            </label>
            <InputNumber className="w-full" size="large" min={0}
              max={bulkForm.changeType.includes('percent') ? 100 : 999999}
              value={bulkForm.changeValue}
              onChange={v => setBulkForm(f => ({...f, changeValue: v || 0}))}
              addonBefore={bulkForm.changeType.includes('percent') ? '%' : '₹'}
              placeholder={bulkForm.changeType.includes('percent') ? 'e.g. 10' : 'e.g. 50'} />
          </div>

          {bulkForm.changeValue > 0 && (
            <div className={`p-3 rounded-lg border-2 text-sm ${
              bulkForm.changeType.includes('increase') ? 'bg-green-50 border-green-200 text-green-800' :
              bulkForm.changeType.includes('decrease') ? 'bg-red-50 border-red-200 text-red-800' :
              'bg-blue-50 border-blue-200 text-blue-800'}`}>
              <strong>Preview: </strong>
              {bulkForm.changeType === 'increase_percent' && `+${bulkForm.changeValue}%`}
              {bulkForm.changeType === 'decrease_percent' && `-${bulkForm.changeValue}%`}
              {bulkForm.changeType === 'increase_flat' && `+₹${bulkForm.changeValue}`}
              {bulkForm.changeType === 'decrease_flat' && `-₹${bulkForm.changeValue}`}
              {bulkForm.changeType === 'set_value' && `= ₹${bulkForm.changeValue}`}
              {' on '}
              <strong>{bulkForm.priceField === 'all' ? 'ALL rates' : RATE_FIELDS.find(f => f.key === bulkForm.priceField)?.label || bulkForm.priceField}</strong>
              {bulkForm.filterBy !== 'all' && (
                <span> for {bulkForm.filterBy}: <strong>
                  {bulkForm.filterBy === 'brand' ? filterOptions.brands.find(b => b._id === bulkForm.filterId)?.name :
                   bulkForm.filterBy === 'category' ? filterOptions.categories.find(c => c._id === bulkForm.filterId)?.name :
                   filterOptions.subcategories.find(s => s._id === bulkForm.filterId)?.name || '—'}
                </strong></span>
              )}
            </div>
          )}

          <div className="flex justify-between items-center pt-3 border-t">
            <span className="text-[10px] text-red-500">⚠ Updates product master directly. Cannot undo.</span>
            <Space>
              <Button onClick={() => setBulkModal(false)}>Cancel</Button>
              <Button type="primary" loading={bulkLoading} onClick={handleBulkUpdate}
                disabled={!bulkForm.changeValue || (bulkForm.filterBy !== 'all' && !bulkForm.filterId)}
                danger={bulkForm.changeType.includes('decrease')}>
                Apply Update
              </Button>
            </Space>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DealerProductPricingPage;
