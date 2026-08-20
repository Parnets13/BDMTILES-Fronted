import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic } from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, TagOutlined, DownloadOutlined } from '@ant-design/icons';
import productService from '../../services/productService.js';

const PriceListPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });

  useEffect(() => {
    productService.getFilterOptions().then(r => { if (r.success) setFilterOptions(r.data); }).catch(() => {});
  }, []);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search };
      if (brandFilter) params.brand = brandFilter;
      if (categoryFilter) params.category = categoryFilter;
      const res = await productService.getProducts(params);
      if (res.success) {
        setProducts(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, brandFilter, categoryFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handlePrint = () => {
    const rows = products.map((p, i) => `
      <tr>
        <td>${i + 1}</td>
        <td><strong>${p.itemName}</strong><br/><span style="font-size:9px;color:#888">${p.productCode} | ${p.tileSize || ''} | ${p.finish || ''}</span></td>
        <td>${p.brand?.name || ''}</td>
        <td>${p.unit || 'Box'}</td>
        <td>₹${(p.basicPrice || 0).toLocaleString()}</td>
        <td>₹${((p.basicPrice || 0) + (p.excessPrice || 0)).toLocaleString()}</td>
        <td><strong>₹${(p.mrp || 0).toLocaleString()}</strong></td>
        <td>₹${(p.dealerRate || 0).toLocaleString()}</td>
        <td>₹${(p.wholesaleRate || 0).toLocaleString()}</td>
        <td>₹${(p.retailRate || 0).toLocaleString()}</td>
        <td>₹${(p.distributorRate || 0).toLocaleString()}</td>
        <td>₹${(p.builderRate || 0).toLocaleString()}</td>
        <td>₹${(p.minimumSellingRate || 0).toLocaleString()}</td>
      </tr>`).join('');

    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>BDM Tiles - Price List</title>
    <style>
      body{font-family:Arial,sans-serif;padding:16px;font-size:11px;color:#333}
      h2{margin-bottom:4px;color:#FF5F03}
      .meta{color:#888;font-size:10px;margin-bottom:12px}
      table{width:100%;border-collapse:collapse}
      th{background:#f8f8f8;padding:6px 8px;text-align:left;font-size:9px;text-transform:uppercase;border-bottom:2px solid #ddd;color:#555}
      td{padding:5px 8px;border-bottom:1px solid #f0f0f0;font-size:10px}
      tr:nth-child(even){background:#fafafa}
      .footer{margin-top:12px;text-align:center;font-size:9px;color:#aaa}
      @media print{body{padding:0}}
    </style></head><body>
    <h2>BDM TILES — Rate Card</h2>
    <div class="meta">Generated: ${new Date().toLocaleDateString('en-IN')} | ${brandFilter ? 'Brand: ' + filterOptions.brands.find(b=>b._id===brandFilter)?.name : 'All Brands'} | Products: ${products.length}</div>
    <table>
      <thead><tr><th>#</th><th>Product</th><th>Brand</th><th>Unit</th><th>Basic</th><th>Max Purchase</th><th>MRP</th><th>Dealer</th><th>Wholesale</th><th>Retail</th><th>Distributor</th><th>Builder</th><th>Min Sell</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">Confidential — BDM GRANIMARMO PRIVATE LIMITED | Prices subject to change without notice</div>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const columns = [
    { title: '#', key: 'idx', width: 40, fixed: 'left',
      render: (_, __, i) => <span className="text-xs text-gray-400">{(pagination.current - 1) * pagination.pageSize + i + 1}</span> },
    { title: 'Product', key: 'product', width: 220, fixed: 'left',
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[200px]">{r.itemName}</div>
          <div className="text-[10px] text-gray-400">{r.productCode} · {r.brand?.name} · {r.tileSize} · {r.finish}</div>
        </div>
      )},
    { title: 'Unit', dataIndex: 'unit', width: 50, render: v => <span className="text-xs">{v || 'Box'}</span> },
    { title: <span className="text-[10px] text-orange-600 font-semibold">Basic</span>, dataIndex: 'basicPrice', width: 80,
      render: v => v ? <span className="text-xs text-orange-600 font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-orange-500 font-semibold">Max Purchase</span>, key: 'maxPurch', width: 90,
      render: (_, r) => {
        const max = (r.basicPrice || 0) + (r.excessPrice || 0);
        return max > 0 ? <span className="text-xs text-orange-500 font-medium">₹{max.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span>;
      }},
    { title: <span className="text-[10px] font-bold">MRP</span>, dataIndex: 'mrp', width: 80,
      render: v => v ? <span className="text-xs font-bold">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-[#FF5F03] font-semibold">Dealer</span>, dataIndex: 'dealerRate', width: 80,
      render: v => v ? <span className="text-xs text-[#FF5F03] font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-blue-600 font-semibold">Wholesale</span>, dataIndex: 'wholesaleRate', width: 85,
      render: v => v ? <span className="text-xs text-blue-600 font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-green-600 font-semibold">Retail</span>, dataIndex: 'retailRate', width: 75,
      render: v => v ? <span className="text-xs text-green-600 font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-purple-600 font-semibold">Distributor</span>, dataIndex: 'distributorRate', width: 85,
      render: v => v ? <span className="text-xs text-purple-600 font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-teal-600 font-semibold">Builder</span>, dataIndex: 'builderRate', width: 75,
      render: v => v ? <span className="text-xs text-teal-600 font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: <span className="text-[10px] text-red-600 font-semibold">Min Sell</span>, dataIndex: 'minimumSellingRate', width: 80,
      render: v => v ? <span className="text-xs text-red-600 font-medium">₹{v.toLocaleString()}</span> : <span className="text-gray-300 text-xs">—</span> },
    { title: 'Margin', key: 'margin', width: 65,
      render: (_, r) => {
        if (!r.dealerRate || !r.basicPrice) return <span className="text-gray-300 text-xs">—</span>;
        const m = ((r.dealerRate - r.basicPrice) / r.basicPrice * 100).toFixed(0);
        return <Tag color={m >= 20 ? 'green' : m >= 10 ? 'orange' : 'red'} className="text-[10px]">{m}%</Tag>;
      }},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Price List</h1>
          <p className="text-sm text-gray-500 mt-0.5">Master rate card — view all customer rates at a glance. For editing use "Dealer Product Pricing" page.</p>
        </div>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Rate Card</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchProducts}>Refresh</Button>
        </Space>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Products" value={pagination.total} prefix={<TagOutlined />} valueStyle={{fontSize:16}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Brands" value={filterOptions.brands?.length || 0} valueStyle={{fontSize:16}} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Categories" value={filterOptions.categories?.length || 0} valueStyle={{fontSize:16}} /></Card></Col>
        <Col span={12}>
          <Card size="small" className="border-blue-100">
            <div className="text-[10px] text-gray-400 mb-1">Rate Tiers Shown</div>
            <div className="flex flex-wrap gap-1">
              {['Basic','Max Purchase','MRP','Dealer','Wholesale','Retail','Distributor','Builder','Min Sell'].map(t => (
                <Tag key={t} className="text-[9px] m-0">{t}</Tag>
              ))}
            </div>
          </Card>
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input placeholder="Search product name, code..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
            className="w-56" allowClear />
          <Select placeholder="Brand" allowClear value={brandFilter} onChange={v => setBrandFilter(v)}
            options={(filterOptions.brands||[]).map(b => ({value:b._id, label:b.name}))} className="w-40" showSearch optionFilterProp="label" />
          <Select placeholder="Category" allowClear value={categoryFilter} onChange={v => setCategoryFilter(v)}
            options={(filterOptions.categories||[]).map(c => ({value:c._id, label:c.name}))} className="w-40" showSearch optionFilterProp="label" />
          <Button onClick={() => { setSearch(''); setBrandFilter(undefined); setCategoryFilter(undefined); }}>Clear</Button>
          <span className="ml-auto text-xs text-gray-400">Read-only view. Edit from "Dealer Product Pricing" page.</span>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={products}
          rowKey="_id"
          loading={loading}
          size="small"
          scroll={{ x: 1300 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['20','50','100'],
            showTotal: (t, r) => <span className="text-xs text-gray-500">{r[0]}–{r[1]} of {t}</span>,
            onChange: (page, pageSize) => setPagination(p => ({...p, current: page, pageSize})),
          }}
        />
      </div>
    </div>
  );
};

export default PriceListPage;
