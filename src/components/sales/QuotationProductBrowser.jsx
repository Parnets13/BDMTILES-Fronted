import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Empty, Input, Modal, Select, Spin, Tag, message } from 'antd';
import {
  CheckOutlined, CloseOutlined, FilterOutlined, ReloadOutlined, SearchOutlined,
  ShoppingCartOutlined, TagsOutlined,
} from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import { ProductImage } from '../ImageLightbox.jsx';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const idOf = (value) => String(value?._id || value || '');
const deduplicate = (rows) => [...new Map(rows.map((row) => [idOf(row), row])).values()];

const QuotationProductBrowser = ({
  open,
  onClose,
  onDone,
  target,
  pricingLabel,
  pricingDate,
  alreadySelected = [],
}) => {
  const [products, setProducts] = useState([]);
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });
  const [filters, setFilters] = useState({ brand: undefined, category: undefined, subcategory: undefined });
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selected, setSelected] = useState([]);
  const [pagination, setPagination] = useState({ currentPage: 1, totalItems: 0, hasMore: false });
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);
  const loadingRef = useRef(false);
  const scrollRef = useRef(null);

  const alreadySelectedIds = useMemo(() => new Set(alreadySelected.map(idOf)), [alreadySelected]);
  const selectedIds = useMemo(() => new Set(selected.map((product) => idOf(product))), [selected]);
  const targetKey = useMemo(() => JSON.stringify(target || {}), [target]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchPage = useCallback(async (page, replace = false) => {
    if (!open || loadingRef.current) return;
    const requestId = ++requestRef.current;
    loadingRef.current = true;
    setLoading(true);
    try {
      const response = await salesService.getQuotationProducts({
        ...target,
        page,
        limit: 50,
        search: debouncedSearch || undefined,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
        quantity: 1,
        pricingDate,
        includeFilterOptions: page === 1,
      });
      if (requestId !== requestRef.current) return;
      if (!response.success) throw new Error(response.message || 'Could not load products');
      const incoming = Array.isArray(response.data) ? response.data : [];
      setProducts((current) => replace ? incoming : deduplicate([...current, ...incoming]));
      setPagination(response.pagination || {
        currentPage: page,
        totalItems: incoming.length,
        hasMore: incoming.length === 50,
      });
      if (response.filterOptions) setFilterOptions(response.filterOptions);
    } catch (error) {
      if (requestId === requestRef.current) message.error(error.message || 'Could not load quotation products');
    } finally {
      if (requestId === requestRef.current) {
        loadingRef.current = false;
        setLoading(false);
      }
    }
  }, [open, target, debouncedSearch, filters, pricingDate]);

  useEffect(() => {
    if (!open) return;
    requestRef.current += 1;
    loadingRef.current = false;
    setProducts([]);
    setPagination({ currentPage: 1, totalItems: 0, hasMore: false });
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    fetchPage(1, true);
  }, [open, targetKey, debouncedSearch, filters, pricingDate, fetchPage]);

  useEffect(() => {
    if (!open) return;
    setSelected([]);
    setSearch('');
    setDebouncedSearch('');
    setFilters({ brand: undefined, category: undefined, subcategory: undefined });
  }, [open, targetKey]);

  useEffect(() => () => {
    requestRef.current += 1;
    loadingRef.current = false;
  }, []);

  const categories = useMemo(() => filterOptions.categories.filter(
    (category) => !filters.brand || idOf(category.brand) === filters.brand
  ), [filterOptions.categories, filters.brand]);
  const subcategories = useMemo(() => filterOptions.subcategories.filter(
    (subcategory) => (!filters.brand || idOf(subcategory.brand) === filters.brand)
      && (!filters.category || idOf(subcategory.category) === filters.category)
  ), [filterOptions.subcategories, filters.brand, filters.category]);

  const handleScroll = (event) => {
    const node = event.currentTarget;
    const nearBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 260;
    if (nearBottom && pagination.hasMore && !loadingRef.current) {
      fetchPage(Number(pagination.currentPage || 1) + 1, false);
    }
  };

  const toggleProduct = (product) => {
    const productId = idOf(product);
    if (alreadySelectedIds.has(productId) || Number(product.stock?.availableQty ?? product.stockAvailable ?? 0) <= 0) return;
    setSelected((current) => current.some((row) => idOf(row) === productId)
      ? current.filter((row) => idOf(row) !== productId)
      : [...current, product]);
  };

  const clearFilters = () => {
    setSearch('');
    setDebouncedSearch('');
    setFilters({ brand: undefined, category: undefined, subcategory: undefined });
  };

  const handleDone = () => {
    if (!selected.length) return;
    onDone(selected);
    setSelected([]);
  };

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      closable={false}
      destroyOnHidden
      width="calc(100vw - 44px)"
      style={{ top: 16, maxWidth: 1560 }}
      styles={{ body: { height: 'calc(100vh - 72px)', padding: 0, overflow: 'hidden' } }}
    >
      <div className="h-full flex flex-col bg-slate-50">
        <header className="shrink-0 relative overflow-hidden bg-gradient-to-r from-slate-950 via-slate-900 to-orange-950 px-6 py-5 text-white">
          <div className="absolute -right-24 -top-32 h-72 w-72 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="relative flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-950/40">
                <ShoppingCartOutlined className="text-xl" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="m-0 text-xl font-bold tracking-tight text-white">Browse quotation products</h2>
                  <Tag color="orange" className="m-0 border-0">50 at a time</Tag>
                </div>
                <p className="mb-0 mt-1 text-xs text-slate-300">
                  Live branch stock snapshot · Authoritative pricing for <strong className="text-white">{pricingLabel}</strong>
                </p>
              </div>
            </div>
            <Button ghost icon={<CloseOutlined />} onClick={onClose}>Close browser</Button>
          </div>
        </header>

        <section className="shrink-0 border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <Input
              size="large"
              allowClear
              prefix={<SearchOutlined className="text-slate-400" />}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product name, code, alias or barcode"
              className="xl:max-w-xl"
            />
            <div className="flex flex-1 flex-wrap gap-2">
              <Select
                allowClear showSearch optionFilterProp="label" placeholder="All brands"
                value={filters.brand}
                onChange={(brand) => setFilters({ brand, category: undefined, subcategory: undefined })}
                options={filterOptions.brands.map((item) => ({ value: idOf(item), label: item.name }))}
                className="min-w-44 flex-1"
              />
              <Select
                allowClear showSearch optionFilterProp="label" placeholder="All categories"
                value={filters.category}
                onChange={(category) => setFilters((current) => ({ ...current, category, subcategory: undefined }))}
                options={categories.map((item) => ({ value: idOf(item), label: item.name }))}
                className="min-w-44 flex-1"
              />
              <Select
                allowClear showSearch optionFilterProp="label" placeholder="All subcategories"
                value={filters.subcategory}
                onChange={(subcategory) => setFilters((current) => ({ ...current, subcategory }))}
                options={subcategories.map((item) => ({ value: idOf(item), label: item.name }))}
                className="min-w-44 flex-1"
              />
              <Button icon={<ReloadOutlined />} onClick={clearFilters}>Reset</Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
            <span><FilterOutlined className="mr-1" />{pagination.totalItems.toLocaleString('en-IN')} matching products</span>
            <span>Stock shown across this branch; warehouse, shade and batch allocation occurs later.</span>
          </div>
        </section>

        <main ref={scrollRef} onScroll={handleScroll} className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!products.length && loading ? (
            <div className="grid h-full place-items-center"><Spin size="large" tip="Resolving branch stock and prices…" /></div>
          ) : !products.length ? (
            <div className="grid h-full place-items-center"><Empty description="No products match these filters" /></div>
          ) : (
            <div className="grid grid-cols-1 gap-3 2xl:grid-cols-2">
              {products.map((product) => {
                const productId = idOf(product);
                const stock = Number(product.stock?.availableQty ?? product.stockAvailable ?? 0);
                const isSelected = selectedIds.has(productId);
                const isAdded = alreadySelectedIds.has(productId);
                const unavailable = stock <= 0;
                return (
                  <button
                    type="button"
                    key={productId}
                    disabled={isAdded || unavailable}
                    onClick={() => toggleProduct(product)}
                    className={`group relative w-full overflow-hidden rounded-2xl border bg-white p-4 text-left transition-all ${
                      isSelected
                        ? 'border-orange-500 ring-2 ring-orange-200 shadow-lg shadow-orange-100'
                        : isAdded
                          ? 'cursor-not-allowed border-emerald-200 bg-emerald-50/50 opacity-75'
                          : unavailable
                            ? 'cursor-not-allowed border-slate-200 opacity-55 grayscale'
                            : 'border-slate-200 hover:-translate-y-0.5 hover:border-orange-300 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex gap-4">
                      <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-slate-100">
                        {product.images?.[0]
                          ? <ProductImage src={product.images[0]} size="xl" className="h-20 w-20 border-0" />
                          : <TagsOutlined className="text-2xl text-slate-300" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-bold text-slate-900">{product.itemName}</div>
                            <div className="mt-0.5 truncate text-[11px] font-medium uppercase tracking-wide text-slate-400">
                              {product.productCode || 'No code'} · {product.unit || 'Box'} · GST {product.gst || 0}%
                            </div>
                          </div>
                          <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-full border ${isSelected ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300 bg-white text-transparent'}`}>
                            <CheckOutlined className="text-xs" />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <div>
                            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Resolved selling rate</div>
                            <div className="text-lg font-extrabold text-orange-600">{money(product.effectiveRate)} <span className="text-[10px] font-normal text-slate-400">/ {product.unit || 'unit'}</span></div>
                            <div className="max-w-72 truncate text-[10px] text-slate-500">{product.sourceName || product.source || 'Product tier'}{product.fallbackApplied ? ' · fallback applied' : ''}</div>
                          </div>
                          <div className="text-right">
                            <Tag color={unavailable ? 'red' : stock <= 10 ? 'gold' : 'green'} className="m-0 font-semibold">
                              {unavailable ? 'Out of stock' : `${stock.toLocaleString('en-IN')} available`}
                            </Tag>
                            <div className="mt-1 text-[10px] text-slate-400">Branch-wide snapshot</div>
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                          {[product.brand?.name, product.category?.name, product.subcategory?.name, product.tileSize, product.finish, product.colour]
                            .filter(Boolean).map((value) => <span key={value} className="rounded-md bg-slate-100 px-2 py-1">{value}</span>)}
                        </div>
                      </div>
                    </div>
                    {isAdded && <div className="absolute right-4 top-4 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">Already in quotation</div>}
                  </button>
                );
              })}
            </div>
          )}
          {products.length > 0 && (
            <div className="py-6 text-center text-xs text-slate-400">
              {loading ? <Spin size="small" /> : pagination.hasMore ? 'Scroll for the next 50 products' : `All ${pagination.totalItems.toLocaleString('en-IN')} matching products loaded`}
            </div>
          )}
        </main>

        <footer className="shrink-0 border-t border-slate-200 bg-white px-6 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-slate-800">{selected.length} product{selected.length === 1 ? '' : 's'} selected</div>
              <div className="mt-1 flex max-w-4xl gap-1.5 overflow-x-auto pb-1">
                {selected.length ? selected.map((product) => (
                  <button type="button" key={idOf(product)} onClick={() => toggleProduct(product)} className="shrink-0 rounded-full bg-orange-50 px-2.5 py-1 text-[10px] font-medium text-orange-700 hover:bg-orange-100">
                    {product.itemName} <CloseOutlined className="ml-1" />
                  </button>
                )) : <span className="text-xs text-slate-400">Choose one or more in-stock products. Existing quotation lines stay untouched.</span>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="large" onClick={onClose}>Cancel</Button>
              <Button type="primary" size="large" icon={<CheckOutlined />} disabled={!selected.length} onClick={handleDone} className="min-w-44">
                Add selected ({selected.length})
              </Button>
            </div>
          </div>
        </footer>
      </div>
    </Modal>
  );
};

export default QuotationProductBrowser;
