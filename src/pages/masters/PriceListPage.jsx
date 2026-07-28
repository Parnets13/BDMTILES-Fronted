import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, InputNumber, Tooltip, Row, Col, Card, Statistic } from 'antd';
import { SearchOutlined, ReloadOutlined, SaveOutlined, EditOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { Tag as TagIcon } from 'lucide-react';
import productService from '../../services/productService.js';
import categoryService from '../../services/categoryService.js';

const PRICE_TIERS = [
  { key: 'mrp', label: 'MRP', color: '#f5222d' },
  { key: 'dealerRate', label: 'Dealer Rate', color: '#1890ff' },
  { key: 'wholesaleRate', label: 'Wholesale', color: '#722ed1' },
  { key: 'retailRate', label: 'Retail', color: '#fa8c16' },
  { key: 'projectRate', label: 'Project', color: '#13c2c2' },
  { key: 'minimumSellingRate', label: 'Min Selling', color: '#52c41a' },
  { key: 'purchaseRate', label: 'Purchase Rate', color: '#666' },
];

const PriceListPage = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [editingKey, setEditingKey] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [search, setSearch] = useState('');
  const [brandFilter, setBrandFilter] = useState(undefined);
  const [categoryFilter, setCategoryFilter] = useState(undefined);
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [] });

  useEffect(() => {
    productService.getFilterOptions().then(r => {
      if (r.success) setFilterOptions(r.data);
    }).catch(() => {});
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
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || res.data.length }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, brandFilter, categoryFilter]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const startEdit = (record) => {
    setEditingKey(record._id);
    setEditingValues({
      mrp: record.mrp || 0,
      dealerRate: record.dealerRate || 0,
      wholesaleRate: record.wholesaleRate || 0,
      retailRate: record.retailRate || 0,
      projectRate: record.projectRate || 0,
      minimumSellingRate: record.minimumSellingRate || 0,
      purchaseRate: record.purchaseRate || 0,
    });
  };

  const cancelEdit = () => { setEditingKey(null); setEditingValues({}); };

  const saveEdit = async (id) => {
    setSaving(s => ({ ...s, [id]: true }));
    try {
      const res = await productService.updateProduct(id, editingValues);
      if (res.success) {
        message.success('Prices updated');
        setProducts(prev => prev.map(p => p._id === id ? { ...p, ...editingValues } : p));
        setEditingKey(null);
        setEditingValues({});
      }
    } catch (err) { message.error(err.message); }
    finally { setSaving(s => ({ ...s, [id]: false })); }
  };

  const columns = [
    {
      title: 'Product', key: 'product', width: 220, fixed: 'left',
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium">{r.itemName}</div>
          <div className="text-xs text-gray-400">{r.productCode} · {r.tileSize} · {r.finish}</div>
          <div className="text-xs text-gray-400">{r.brand?.name} · {r.category?.name}</div>
        </div>
      ),
    },
    {
      title: 'Unit', dataIndex: 'unit', width: 60,
      render: v => <span className="text-xs">{v}</span>
    },
    ...PRICE_TIERS.map(tier => ({
      title: <span style={{ color: tier.color }} className="text-xs font-semibold">{tier.label}</span>,
      dataIndex: tier.key,
      width: 110,
      render: (val, record) => {
        if (editingKey === record._id) {
          return (
            <InputNumber
              size="small" min={0} value={editingValues[tier.key]}
              onChange={v => setEditingValues(prev => ({ ...prev, [tier.key]: v || 0 }))}
              prefix="₹" className="w-full" style={{ fontSize: 11 }}
            />
          );
        }
        return (
          <span className="text-sm font-medium" style={{ color: tier.color }}>
            ₹{(val || 0).toLocaleString()}
          </span>
        );
      },
    })),
    {
      title: 'Actions', width: 90, fixed: 'right',
      render: (_, r) => {
        if (editingKey === r._id) {
          return (
            <Space size="small">
              <Tooltip title="Save">
                <Button type="primary" size="small" icon={<CheckOutlined />} onClick={() => saveEdit(r._id)} loading={saving[r._id]} />
              </Tooltip>
              <Tooltip title="Cancel">
                <Button size="small" icon={<CloseOutlined />} onClick={cancelEdit} />
              </Tooltip>
            </Space>
          );
        }
        return (
          <Tooltip title="Edit Prices">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => startEdit(r)} />
          </Tooltip>
        );
      },
    },
  ];

  // Stats
  const avgMRP = products.length ? Math.round(products.reduce((s, p) => s + (p.mrp || 0), 0) / products.length) : 0;
  const avgMargin = products.filter(p => p.mrp && p.purchaseRate).length
    ? Math.round(products.filter(p => p.mrp && p.purchaseRate).reduce((s, p) => s + ((p.mrp - p.purchaseRate) / p.mrp * 100), 0) / products.filter(p => p.mrp && p.purchaseRate).length)
    : 0;

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Price List</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage MRP and all selling rates for every product</p>
        </div>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Products" value={pagination.total} prefix={<TagIcon size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Avg MRP" value={`₹${avgMRP.toLocaleString()}`} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Avg Margin" value={`${avgMargin}%`} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Brands" value={filterOptions.brands?.length || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="This Page" value={products.length} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Input
            placeholder="Search product name, code..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear
          />
          <Select
            placeholder="Filter by Brand"
            options={(filterOptions.brands || []).map(b => ({ value: b._id, label: b.name }))}
            value={brandFilter} onChange={v => setBrandFilter(v)} allowClear className="w-44"
          />
          <Select
            placeholder="Filter by Category"
            options={(filterOptions.categories || []).map(c => ({ value: c._id, label: c.name }))}
            value={categoryFilter} onChange={v => setCategoryFilter(v)} allowClear className="w-44"
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setBrandFilter(undefined); setCategoryFilter(undefined); }}>Reset</Button>
          <span className="ml-auto text-xs text-gray-400">Click ✏️ on any row to edit prices inline</span>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={products}
          rowKey="_id"
          loading={loading}
          size="small"
          scroll={{ x: 1200 }}
          rowClassName={r => editingKey === r._id ? 'bg-yellow-50' : ''}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['20', '50', '100'],
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} products`,
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
          }}
        />
      </div>
    </div>
  );
};

export default PriceListPage;
