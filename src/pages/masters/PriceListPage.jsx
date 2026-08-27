import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Col, Input, Row, Select, Space, Statistic, Table, Tag, message } from 'antd';
import { DownloadOutlined, PrinterOutlined, ReloadOutlined, SearchOutlined, SettingOutlined, TagOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';

const money = (value) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const activeType = (item) => item?.isActive !== false && item?.status !== 'inactive';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

const PriceListPage = () => {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [dealerTypes, setDealerTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [filters, setFilters] = useState({ search: '', brand: undefined, category: undefined, subcategory: undefined });
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });

  useEffect(() => {
    Promise.all([masterService.getDealerTypes({ limit: 200 }), productService.getFilterOptions()])
      .then(([typesResponse, filterResponse]) => {
        if (typesResponse.success) setDealerTypes((typesResponse.data || []).filter(activeType));
        if (filterResponse.success) setFilterOptions(filterResponse.data || { brands: [], categories: [], subcategories: [] });
      })
      .catch((error) => message.error(error.message || 'Failed to load rate-card configuration'));
  }, []);

  const tierGroups = useMemo(() => {
    const grouped = new Map();
    dealerTypes.forEach((type) => {
      if (!type.pricingTier) return;
      const current = grouped.get(type.pricingTier) || [];
      grouped.set(type.pricingTier, [...current, type]);
    });
    if (!grouped.has('projectRate')) grouped.set('projectRate', []);
    return [...grouped.entries()].map(([field, types]) => ({
      field,
      types,
      label: types.length ? types.map((type) => type.name).join(' / ') : 'Project Rate',
    }));
  }, [dealerTypes]);

  const requestParams = useCallback((page, limit) => ({
    page, limit,
    status: 'active',
    search: filters.search || undefined,
    brand: filters.brand,
    category: filters.category,
    subcategory: filters.subcategory,
  }), [filters]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await productService.getProducts(requestParams(pagination.current, pagination.pageSize));
      if (response.success) {
        setProducts(response.data || []);
        setPagination((current) => ({ ...current, total: response.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message || 'Failed to load Price List'); }
    finally { setLoading(false); }
  }, [requestParams, pagination.current, pagination.pageSize]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const loadAllFilteredProducts = async () => {
    const batchSize = 100;
    const first = await productService.getProducts(requestParams(1, batchSize));
    if (!first.success) throw new Error(first.message || 'Could not load the filtered Price List');
    const all = [...(first.data || [])];
    const total = first.pagination?.totalItems || all.length;
    const effectivePageSize = first.pagination?.itemsPerPage || first.data?.length || batchSize;
    const totalPages = Math.max(1, first.pagination?.totalPages || Math.ceil(total / effectivePageSize));
    for (let page = 2; page <= totalPages; page += 1) {
      const response = await productService.getProducts(requestParams(page, batchSize));
      if (!response.success) throw new Error(response.message || `Could not load Price List page ${page}`);
      all.push(...(response.data || []));
    }
    return all.slice(0, total || all.length);
  };

  const columnHeaders = ['#', 'Product', 'Code', 'Brand', 'Category', 'Unit', 'Basic', 'Max Purchase', 'MRP', ...tierGroups.map((tier) => tier.label), 'Minimum Selling'];
  const productValues = (product, index) => [
    index + 1, product.itemName, product.productCode, product.brand?.name || '', product.category?.name || '',
    product.unit || 'Box', product.basicPrice || 0, Number(product.basicPrice || 0) + Number(product.excessPrice || 0),
    product.mrp || 0, ...tierGroups.map((tier) => product[tier.field] || 0), product.minimumSellingRate || 0,
  ];

  const handleExport = async () => {
    setExporting(true);
    try {
      const allProducts = await loadAllFilteredProducts();
      const csv = [columnHeaders.map(csvCell).join(','), ...allProducts.map((product, index) => productValues(product, index).map(csvCell).join(','))].join('\r\n');
      const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `bdm-price-list-${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      message.success(`Exported ${allProducts.length} filtered products`);
    } catch (error) { message.error(error.message || 'Export failed'); }
    finally { setExporting(false); }
  };

  const handlePrint = async () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { message.warning('Allow pop-ups to print the Price List'); return; }
    printWindow.document.write('<p style="font-family:Arial;padding:20px">Loading the complete filtered Price List…</p>');
    setExporting(true);
    try {
      const allProducts = await loadAllFilteredProducts();
      const headers = columnHeaders.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
      const body = allProducts.map((product, index) => `<tr>${productValues(product, index).map((value, valueIndex) => `<td>${valueIndex >= 6 ? `₹${money(value)}` : escapeHtml(value)}</td>`).join('')}</tr>`).join('');
      printWindow.document.open();
      printWindow.document.write(`<!doctype html><html><head><title>BDM Tiles Price List</title><style>body{font-family:Arial,sans-serif;padding:14px;color:#222}h2{margin:0;color:#f05a00}.meta{font-size:10px;color:#666;margin:5px 0 12px}table{width:100%;border-collapse:collapse;font-size:9px}th{background:#f3f4f6;text-align:left;padding:5px;border:1px solid #ddd}td{padding:5px;border:1px solid #e5e7eb;white-space:nowrap}tr:nth-child(even){background:#fafafa}.note{font-size:9px;color:#777;margin-top:10px}@media print{body{padding:0}@page{size:landscape;margin:8mm}}</style></head><body><h2>BDM TILES — Read-only Price List</h2><div class="meta">Generated ${new Date().toLocaleString('en-IN')} · ${allProducts.length} filtered active products · Tier columns follow active Dealer Type configuration</div><table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table><div class="note">Reference only. Product master tier values are not individual-dealer overrides. Configure target-specific overrides in Dealer Product Pricing.</div></body></html>`);
      printWindow.document.close();
      setTimeout(() => { printWindow.focus(); printWindow.print(); }, 350);
    } catch (error) { printWindow.close(); message.error(error.message || 'Print failed'); }
    finally { setExporting(false); }
  };

  const openPricing = (product) => {
    const configuredType = dealerTypes.find((type) => type.pricingTier);
    const params = new URLSearchParams({ scope: configuredType ? 'dealer_type' : 'walk_in', product: product.productCode || product.itemName || '' });
    if (configuredType) params.set('dealerType', configuredType._id);
    navigate(`/masters/dealer-product-pricing?${params.toString()}`);
  };

  const rateColumn = (title, field, color) => ({
    title: <TooltipTitle title={title} detail={field} color={color} />,
    dataIndex: field,
    width: Math.max(100, Math.min(180, title.length * 7)),
    render: (value) => Number(value || 0) > 0 ? <span className="text-xs font-medium" style={{ color }}>₹{money(value)}</span> : <span className="text-xs text-gray-300">—</span>,
  });

  const columns = [
    { title: '#', width: 45, fixed: 'left', render: (_, __, index) => <span className="text-xs text-gray-400">{(pagination.current - 1) * pagination.pageSize + index + 1}</span> },
    { title: 'Product', width: 250, fixed: 'left', render: (_, product) => <div><div className="font-medium text-sm">{product.itemName}</div><div className="text-[10px] text-gray-400">{product.productCode} · {product.brand?.name || ''} · {product.category?.name || ''}</div><div className="text-[10px] text-gray-400">{product.tileSize || ''} · {product.finish || ''}</div></div> },
    { title: 'Unit', dataIndex: 'unit', width: 65, render: (value) => <span className="text-xs">{value || 'Box'}</span> },
    rateColumn('Basic', 'basicPrice', '#ea580c'),
    { title: <TooltipTitle title="Max Purchase" detail="basicPrice + excessPrice" color="#f97316" />, width: 115, render: (_, product) => <span className="text-xs font-medium text-orange-500">₹{money(Number(product.basicPrice || 0) + Number(product.excessPrice || 0))}</span> },
    rateColumn('MRP', 'mrp', '#111827'),
    ...tierGroups.map((tier, index) => rateColumn(tier.label, tier.field, ['#ea580c', '#2563eb', '#16a34a', '#7c3aed', '#0f766e'][index % 5])),
    rateColumn('Minimum Selling', 'minimumSellingRate', '#dc2626'),
    { title: 'Override setup', width: 135, fixed: 'right', render: (_, product) => <Button type="link" size="small" icon={<SettingOutlined />} onClick={() => openPricing(product)}>Configure target</Button> },
  ];

  const resetFilters = () => setFilters({ search: '', brand: undefined, category: undefined, subcategory: undefined });

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
        <div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold text-gray-800">Price List</h1><Tag color="blue">Read only</Tag></div><p className="text-sm text-gray-500">Master rate-card reference. Tier columns come from active Dealer Types; duplicate pricing tiers are grouped.</p></div>
        <Space wrap><Button icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>Export all filtered</Button><Button icon={<PrinterOutlined />} onClick={handlePrint} loading={exporting}>Print all filtered</Button><Button icon={<ReloadOutlined />} onClick={fetchProducts} loading={loading}>Refresh</Button></Space>
      </div>

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} md={5}><Card size="small"><Statistic title="Active products" value={pagination.total} prefix={<TagOutlined />} valueStyle={{ fontSize: 17 }} /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="Active Dealer Types" value={dealerTypes.length} valueStyle={{ fontSize: 17 }} /></Card></Col>
        <Col xs={24} md={14}><Card size="small"><div className="text-[10px] text-gray-400 mb-1">Configured rate columns</div><Space size={[4, 4]} wrap>{tierGroups.map((tier) => <Tag key={tier.field}>{tier.label} · {tier.field}</Tag>)}<Tag color="red">Minimum Selling</Tag></Space></Card></Col>
      </Row>

      <div className="bg-white border border-gray-200 rounded-lg p-3 mb-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2">
          <Input prefix={<SearchOutlined />} placeholder="Product name or code" value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} allowClear />
          <Select placeholder="All brands" value={filters.brand} onChange={(value) => setFilters((current) => ({ ...current, brand: value, category: undefined, subcategory: undefined }))} allowClear showSearch optionFilterProp="label" options={(filterOptions.brands || []).map((item) => ({ value: item._id, label: item.name }))} />
          <Select placeholder="All categories" value={filters.category} onChange={(value) => setFilters((current) => ({ ...current, category: value, subcategory: undefined }))} allowClear showSearch optionFilterProp="label" options={(filterOptions.categories || []).filter((item) => !filters.brand || (item.brand?._id || item.brand) === filters.brand).map((item) => ({ value: item._id, label: item.name }))} />
          <Select placeholder="All subcategories" value={filters.subcategory} onChange={(value) => setFilters((current) => ({ ...current, subcategory: value }))} allowClear showSearch optionFilterProp="label" options={(filterOptions.subcategories || []).filter((item) => !filters.category || (item.category?._id || item.category) === filters.category).map((item) => ({ value: item._id, label: item.name }))} />
          <Button onClick={resetFilters}>Clear filters</Button>
        </div>
      </div>

      <Card size="small" className="mb-3"><span className="text-xs text-gray-500"><strong>Important:</strong> These are product-level tier references. “Configure target” opens Dealer Product Pricing for Dealer Type/dealer/walk-in overrides; it does not edit a global tier as an individual dealer price.</span></Card>
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden"><Table columns={columns} dataSource={products} rowKey="_id" loading={loading} size="small" scroll={{ x: Math.max(1300, columns.length * 115) }} pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['20', '50', '100'], showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}` }} onChange={(next) => setPagination((current) => ({ ...current, current: next.current, pageSize: next.pageSize }))} /></div>
    </div>
  );
};

const TooltipTitle = ({ title, detail, color }) => <div><div className="text-[10px] font-semibold" style={{ color }}>{title}</div><div className="text-[9px] text-gray-400 font-normal">{detail}</div></div>;

export default PriceListPage;
