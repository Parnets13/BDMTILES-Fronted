import { useState, useEffect, useCallback } from 'react';
import { Modal, Input, Select, Button, Tag, Pagination, message, Badge, Empty } from 'antd';
import { SearchOutlined, ReloadOutlined, CheckOutlined, PlusOutlined, CloseOutlined } from '@ant-design/icons';
import productService from '../services/productService.js';
import salesService from '../services/salesService.js';

/**
 * ProductSelectionModal — Full product browser with search, filters, cards.
 * Click product card to add. Supports multi-select.
 *
 * Props:
 *   open: boolean
 *   onClose: () => void
 *   onAdd: (products[]) => void — called with array of selected products
 *   customerType: string — 'dealer'|'wholesaler'|'retail'|'distributor'|'builder'
 *   alreadyAdded: string[] — array of product IDs already in the order (to show "Added" badge)
 */
const ProductSelectionModal = ({ open, onClose, onAdd, customerType = 'dealer', alreadyAdded = [] }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });
  const [filters, setFilters] = useState({ brand: undefined, category: undefined, subcategory: undefined });
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (open) {
      productService.getFilterOptions().then(r => { if (r.success) setFilterOptions(r.data); }).catch(() => {});
      setSelected([]);
    }
  }, [open]);

  const fetchProducts = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await salesService.searchProducts(search || 'a', 1);
      // Use product service for paginated results with filters
      const params = {
        page: pagination.current, limit: pagination.pageSize,
        search: search || undefined,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
        status: 'active',
      };
      const prodRes = await productService.getProducts(params);
      if (prodRes.success) {
        setProducts(prodRes.data);
        setPagination(p => ({ ...p, total: prodRes.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [open, search, pagination.current, filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const getRateForType = (product) => {
    const rateMap = {
      dealer: product.dealerRate, wholesaler: product.wholesaleRate,
      retail: product.retailRate, distributor: product.distributorRate,
      builder: product.builderRate || product.projectRate,
    };
    return rateMap[customerType] || product.dealerRate || product.mrp || 0;
  };

  const toggleSelect = (product) => {
    const exists = selected.find(p => p._id === product._id);
    if (exists) {
      setSelected(prev => prev.filter(p => p._id !== product._id));
    } else {
      setSelected(prev => [...prev, product]);
    }
  };

  const isSelected = (id) => selected.some(p => p._id === id);
  const isAlreadyAdded = (id) => alreadyAdded.includes(id);

  const handleDone = () => {
    if (selected.length === 0) { message.warning('Select at least one product'); return; }
    onAdd(selected);
    setSelected([]);
    onClose();
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      width="95%"
      centered
      bodyStyle={{ height: '85vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', padding: '20px 28px' }}
      footer={null}
      closable={false}
      destroyOnHidden
    >
      {/* Header */}
      <div className="shrink-0 flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-800">Select Products</h2>
          <p className="text-xs text-gray-400">Click on products to select multiple. Then click "Add Selected" to add to order.</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge count={selected.length} showZero={false}>
            <Button type="primary" size="large" icon={<PlusOutlined />} onClick={handleDone} disabled={selected.length === 0}>
              Add Selected ({selected.length})
            </Button>
          </Badge>
          <Button size="large" icon={<CloseOutlined />} onClick={onClose}>Close</Button>
        </div>
      </div>
      {/* Search + Filters */}
      <div className="shrink-0 pb-3 border-b mb-3">
        <div className="flex gap-3 items-center mb-2">
          <Input
            prefix={<SearchOutlined className="text-gray-400" />}
            placeholder="Search products by name, code, or HSN..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current: 1})); }}
            className="flex-1"
            allowClear
            size="large"
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ brand: undefined, category: undefined, subcategory: undefined }); }}>Reset</Button>
        </div>
        <div className="flex gap-3">
          <Select placeholder="All Brands" allowClear value={filters.brand} showSearch optionFilterProp="label"
            onChange={v => { setFilters(f => ({...f, brand: v})); setPagination(p => ({...p, current: 1})); }}
            options={filterOptions.brands.map(b => ({value: b._id, label: b.name}))} className="w-44" />
          <Select placeholder="All Categories" allowClear value={filters.category} showSearch optionFilterProp="label"
            onChange={v => { setFilters(f => ({...f, category: v})); setPagination(p => ({...p, current: 1})); }}
            options={filterOptions.categories.map(c => ({value: c._id, label: c.name}))} className="w-44" />
          <Select placeholder="All Subcategories" allowClear value={filters.subcategory} showSearch optionFilterProp="label"
            onChange={v => { setFilters(f => ({...f, subcategory: v})); setPagination(p => ({...p, current: 1})); }}
            options={filterOptions.subcategories.map(s => ({value: s._id, label: s.name}))} className="w-44" />
          <div className="ml-auto text-xs text-gray-400 self-center">
            {pagination.total} products found
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="py-16 text-center text-gray-400">Loading products...</div>
        ) : products.length === 0 ? (
          <Empty description="No products found" className="py-16" />
        ) : (
          <div className="grid grid-cols-5 gap-3">
            {products.map(p => {
              const sel = isSelected(p._id);
              const added = isAlreadyAdded(p._id);
              const rate = getRateForType(p);
              return (
                <div
                  key={p._id}
                  className={`relative border-2 rounded-lg p-3 cursor-pointer transition-all hover:shadow-md
                    ${sel ? 'border-[#FF5F03] bg-orange-50 shadow-sm' : added ? 'border-green-300 bg-green-50' : 'border-gray-200 hover:border-gray-300'}`}
                  onClick={() => !added && toggleSelect(p)}
                >
                  {/* Selected badge */}
                  {sel && (
                    <div className="absolute top-2 right-2 w-5 h-5 bg-[#FF5F03] rounded-full flex items-center justify-center">
                      <CheckOutlined className="text-white text-[10px]" />
                    </div>
                  )}
                  {added && (
                    <div className="absolute top-2 right-2">
                      <Tag color="green" className="text-[9px] m-0">Added</Tag>
                    </div>
                  )}

                  {/* Product info */}
                  <div className="text-sm font-semibold text-gray-800 leading-tight truncate pr-6">{p.itemName}</div>
                  <div className="text-[10px] text-gray-400 mt-0.5">
                    {p.productCode} · HSN: {p.hsnCode || '—'}
                  </div>

                  {/* Price */}
                  <div className="mt-2">
                    <span className="text-base font-bold text-[#FF5F03]">₹{rate.toLocaleString()}</span>
                    <span className="text-[10px] text-gray-400 ml-1">incl. {p.gst || 18}% GST</span>
                  </div>

                  {/* Stock */}
                  <div className="mt-1">
                    <Tag color={(p.stockAvailable || 0) > 0 ? 'green' : 'red'} className="text-[10px] m-0">
                      Stock: {p.stockAvailable || 0}
                    </Tag>
                  </div>

                  {/* Brand / Category */}
                  <div className="text-[10px] text-gray-400 mt-1">
                    {p.brand?.name || ''} · {p.category?.name || ''} · {p.tileSize || ''}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="shrink-0 pt-3 border-t mt-3 flex justify-between items-center">
        <div className="text-xs text-gray-500">
          {selected.length > 0 && <span className="text-[#FF5F03] font-semibold">{selected.length} product(s) selected</span>}
        </div>
        <Pagination
          current={pagination.current}
          pageSize={pagination.pageSize}
          total={pagination.total}
          onChange={(page) => setPagination(p => ({...p, current: page}))}
          showSizeChanger={false}
          size="small"
        />
      </div>
    </Modal>
  );
};

export default ProductSelectionModal;
