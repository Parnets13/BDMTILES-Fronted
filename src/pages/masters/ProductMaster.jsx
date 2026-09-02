import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Switch, message, Popconfirm, Tooltip, Row, Col, Divider, Card, Statistic, Modal } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, ShopOutlined } from '@ant-design/icons';
import productService from '../../services/productService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import getImageUrl from '../../utils/imageUrl.js';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const TILE_SIZES = ['200x200','200x300','250x375','300x300','300x450','300x600','400x400','600x600','600x1200','800x800','800x1200','800x1600','1000x1000','1200x1200','1200x1800','1200x2400','1600x3200'];
const FINISHES = ['Glossy','Matt','Sugar','Carving','Satin','Rustic','Polished','Lapato','High Gloss','Anti-Skid','Rocker','Book Match'];
const UNITS = ['Box','Piece','SqFt','Kg','Meter','Litre','Set','Nos'];
const GST_RATES = [0, 5, 12, 18, 28];
const TILE_TYPES = ['Ceramic','Vitrified','GVT','PGVT','Double Charge','Full Body','Porcelain','Slab','Natural Stone','Granite','Marble'];
const APPLICATION_AREAS = ['Floor','Wall','Bathroom','Kitchen','Parking','Elevation','Outdoor','Swimming Pool','Commercial','Industrial'];
const ANTI_SKID = ['','R9','R10','R11','R12','R13'];
const ORIGINS = ['India','Spain','Italy','China','Vietnam','Indonesia','Turkey'];

const ProductMaster = () => {
  const { confirm, alertModal } = useConfirm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ brand: undefined, category: undefined, subcategory: undefined, status: undefined, tileSize: undefined, finish: undefined, tileType: undefined, applicationArea: undefined });
  const [filterOptions, setFilterOptions] = useState({ brands: [], categories: [], subcategories: [] });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, draft: 0 });

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  // Load filter options
  useEffect(() => {
    productService.getFilterOptions().then(res => {
      if (res.success) setFilterOptions(res.data);
    }).catch(() => {});
    productService.getStats().then(res => {
      if (res.success) setStats(res.data);
    }).catch(() => {});
  }, []);

  // Fetch products
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
        setPagination(prev => ({ ...prev, total: res.pagination.totalItems }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Open drawer
  const openDrawer = (product = null) => {
    setEditingProduct(product);
    setShowPreview(false);
    setImageFiles([]);
    setImagePreviews((product?.images || []).map(img => getImageUrl(img)));
    if (product) {
      form.setFieldsValue({
        ...product,
        brand: product.brand?._id || product.brand,
        category: product.category?._id || product.category,
        subcategory: product.subcategory?._id || product.subcategory,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ gst: 18, unit: 'Box', status: 'active', salesType: 'Regular Sale', productType: 'Regular Product' });
    }
    setDrawerOpen(true);
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeImage = (index) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Show preview before saving
  const handleShowPreview = async () => {
    try {
      const values = await form.validateFields();
      // Resolve names for preview display
      const brandName = filterOptions.brands.find(b => b._id === values.brand)?.name || '-';
      const categoryName = filterOptions.categories.find(c => c._id === values.category)?.name || '-';
      const subcategoryName = filterOptions.subcategories.find(s => s._id === values.subcategory)?.name || '-';
      setPreviewData({ ...values, brandName, categoryName, subcategoryName });
      setShowPreview(true);
    } catch (err) {
      // validation errors shown by form
    }
  };

  // Confirm save after preview
  const handleConfirmSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // Upload images first if any new files selected
      let imageUrls = [];
      if (imageFiles.length > 0) {
        const uploadRes = await productService.uploadImages(imageFiles);
        if (uploadRes.success) {
          imageUrls = uploadRes.data;
        }
      }
      // Keep existing image URLs (for edit mode)
      if (editingProduct?.images) {
        imageUrls = [...editingProduct.images, ...imageUrls];
      }

      const productData = { ...values, images: imageUrls };

      let res;
      if (editingProduct) {
        res = await productService.updateProduct(editingProduct._id, productData);
      } else {
        res = await productService.createProduct(productData);
      }
      if (res.success) {
        message.success(res.message);
        setDrawerOpen(false);
        setShowPreview(false);
        form.resetFields();
        setEditingProduct(null);
        setImageFiles([]);
        setImagePreviews([]);
        fetchProducts();
        productService.getStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Old handleSave now goes through preview
  const handleSave = handleShowPreview;

  // Delete
  const handleDelete = async (id) => {
    const proceed = await confirm('Delete this product?', { type: 'danger', okText: 'Delete', content: 'Product will be moved to Recycle Bin. You can restore it within 30 days.' });
    if (!proceed) return;
    try {
      const res = await productService.deleteProduct(id);
      if (res.success) { message.success(res.message || 'Moved to Recycle Bin'); fetchProducts(); }
      else { alertModal('Cannot Delete', res.message, 'error'); }
    } catch (err) {
      alertModal('Cannot Delete', err.message, 'error');
    }
  };

  // View product detail
  const [viewProduct, setViewProduct] = useState(null);
  const handleViewProduct = async (product) => {
    try {
      const res = await productService.getProduct(product._id);
      if (res.success) setViewProduct(res.data);
    } catch (err) {
      message.error(err.message || 'Unable to load product details');
    }
  };

  // Get filtered categories/subcategories based on selection (cascading)
  const getFilteredCategories = (brandId) => {
    const bid = brandId || form.getFieldValue('brand');
    if (!bid) return filterOptions.categories;
    return filterOptions.categories.filter(c => String(c.brand) === String(bid) || String(c.brand?._id) === String(bid));
  };

  const getFilteredSubcategories = (categoryId) => {
    const cid = categoryId || form.getFieldValue('category');
    if (!cid) return filterOptions.subcategories;
    return filterOptions.subcategories.filter(s => String(s.category) === String(cid) || String(s.category?._id) === String(cid));
  };

  // When brand changes → clear category and subcategory
  const handleBrandChange = (brandId) => {
    form.setFieldsValue({ category: undefined, subcategory: undefined });
  };

  // When category changes → auto-fill brand if not set, clear subcategory
  const handleCategoryChange = (categoryId) => {
    const cat = filterOptions.categories.find(c => c._id === categoryId);
    if (cat) {
      // Auto-fill brand from category's parent
      form.setFieldsValue({ brand: cat.brand, subcategory: undefined });
    } else {
      form.setFieldsValue({ subcategory: undefined });
    }
  };

  // When subcategory changes → auto-fill both category and brand
  const handleSubcategoryChange = (subcategoryId) => {
    const sub = filterOptions.subcategories.find(s => s._id === subcategoryId);
    if (sub) {
      // Auto-fill category from subcategory's parent
      form.setFieldsValue({ category: sub.category });
      // Auto-fill brand from category's parent
      const cat = filterOptions.categories.find(c => c._id === sub.category);
      if (cat) {
        form.setFieldsValue({ brand: cat.brand });
      }
    }
  };

  const columns = [
    {
      title: 'Code', dataIndex: 'productCode', key: 'code', width: 100,
      render: (code) => <span className="text-xs font-mono text-blue-600">{code}</span>,
    },
    {
      title: 'Product Name', key: 'name', width: 200,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{r.itemName}</div>
          {r.tileSize && <span className="text-xs text-gray-400">{r.tileSize} | {r.finish}</span>}
        </div>
      ),
    },
    {
      title: 'Brand', key: 'brand', width: 100,
      render: (_, r) => <span className="text-sm">{r.brand?.name || '-'}</span>,
    },
    {
      title: 'Category', key: 'category', width: 110,
      render: (_, r) => <span className="text-xs text-gray-600">{r.category?.name}</span>,
    },
    {
      title: 'Subcategory', key: 'subcategory', width: 110,
      render: (_, r) => <span className="text-xs text-gray-600">{r.subcategory?.name}</span>,
    },
    {
      title: 'MRP', dataIndex: 'mrp', key: 'mrp', width: 80,
      render: (v) => <span className="text-sm font-medium">₹{v || 0}</span>,
    },
    {
      title: 'Min Stock', dataIndex: 'minStockLevel', key: 'minStock', width: 80,
      render: (v, r) => <span className="text-xs">{v} {r.unit}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 80,
      render: (s) => <Tag color={s === 'active' ? 'green' : s === 'draft' ? 'orange' : 'red'}>{s}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewProduct(r)} className="text-blue-600" /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openDrawer(r)} /></Tooltip>
          <Popconfirm title="Delete this product?" onConfirm={() => handleDelete(r._id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Product Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiles, granite, marble & building material products</p>
        </div>
        <Space>
          <ModuleRecycleBin module="product" title="Deleted Products" onRestore={fetchProducts} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()} size="large">
            Add New Product
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Products" value={stats.total} prefix={<ShopOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Inactive" value={stats.inactive} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Draft" value={stats.draft} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search by name, code, HSN, colour..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
            className="w-72" allowClear />
          <Select placeholder="Brand" options={filterOptions.brands.map(b => ({ value: b._id, label: b.name }))}
            value={filters.brand} onChange={v => setFilters(f => ({...f, brand: v, category: undefined, subcategory: undefined}))}
            allowClear className="w-36" />
          <Select placeholder="Category" options={getFilteredCategories().map(c => ({ value: c._id, label: c.name }))}
            value={filters.category} onChange={v => setFilters(f => ({...f, category: v, subcategory: undefined}))}
            allowClear className="w-36" />
          <Select placeholder="Subcategory" options={getFilteredSubcategories().map(s => ({ value: s._id, label: s.name }))}
            value={filters.subcategory} onChange={v => setFilters(f => ({...f, subcategory: v}))}
            allowClear className="w-36" />
          <Select placeholder="Status" options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'draft',label:'Draft'}]}
            value={filters.status} onChange={v => setFilters(f => ({...f, status: v}))} allowClear className="w-28" />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Select placeholder="Tile Size" options={TILE_SIZES.map(s => ({value:s,label:s}))}
            value={filters.tileSize} onChange={v => setFilters(f => ({...f, tileSize: v}))} allowClear className="w-32" showSearch />
          <Select placeholder="Finish" options={FINISHES.map(f => ({value:f,label:f}))}
            value={filters.finish} onChange={v => setFilters(f2 => ({...f2, finish: v}))} allowClear className="w-32" showSearch />
          <Select placeholder="Tile Type" options={TILE_TYPES.map(t => ({value:t,label:t}))}
            value={filters.tileType} onChange={v => setFilters(f => ({...f, tileType: v}))} allowClear className="w-36" showSearch />
          <Select placeholder="Application" options={APPLICATION_AREAS.map(a => ({value:a,label:a}))}
            value={filters.applicationArea} onChange={v => setFilters(f => ({...f, applicationArea: v}))} allowClear className="w-36" showSearch />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({brand:undefined,category:undefined,subcategory:undefined,status:undefined,tileSize:undefined,finish:undefined,tileType:undefined,applicationArea:undefined}); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={products} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['10','20','50','100'],
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} products` }}
          onChange={(pag) => setPagination(prev => ({...prev, current: pag.current, pageSize: pag.pageSize}))} />
      </div>

      {/* View Product Modal */}
      <ViewProductModal product={viewProduct} onClose={() => setViewProduct(null)} />

      {/* Add/Edit Product — Modal Overlay (like Jain Impex) */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingProduct(null); }} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="text-[#FF5F03] text-xl">+</span>
                <h2 className="text-lg font-bold text-gray-800">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Button type="primary" onClick={handleSave} loading={loading}>
                  {editingProduct ? 'Update Product' : '+ New Product'}
                </Button>
                <Button onClick={() => form.resetFields()} className="text-green-600 border-green-400">Clear Form</Button>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingProduct(null); }}>✕</span>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 py-6">
              <Form form={form} layout="vertical">
              {/* Row 1: Brand, Category, Subcategory */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="brand" label="Brand" rules={[{ required: true, message: 'Select brand' }]}>
                    <Select placeholder="Search brands..." showSearch optionFilterProp="label"
                      options={filterOptions.brands.map(b => ({ value: b._id, label: b.name }))}
                      onChange={handleBrandChange} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.brand !== curr.brand}>
                    {() => (
                      <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Select category' }]}>
                        <Select placeholder={form.getFieldValue('brand') ? 'Select category...' : 'Select brand first'} showSearch optionFilterProp="label"
                          disabled={!form.getFieldValue('brand')}
                          options={getFilteredCategories().map(c => ({ value: c._id, label: c.name }))}
                          onChange={handleCategoryChange}
                          notFoundContent={form.getFieldValue('brand') ? 'No categories for this brand' : 'Select a brand first'} />
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category || prev.brand !== curr.brand}>
                    {() => (
                      <Form.Item name="subcategory" label="Subcategory" rules={[{ required: true, message: 'Select subcategory' }]}>
                        <Select placeholder={form.getFieldValue('category') ? 'Select subcategory...' : 'Select category first'} showSearch optionFilterProp="label"
                          disabled={!form.getFieldValue('category')}
                          options={getFilteredSubcategories().map(s => ({ value: s._id, label: s.name }))}
                          onChange={handleSubcategoryChange}
                          notFoundContent={form.getFieldValue('category') ? 'No subcategories for this category' : 'Select a category first'} />
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 2: Product Code, Item Name, HSN */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="productCode" label="Product Code">
                    <Input placeholder="Will be auto-generated if left empty" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="itemName" label="Item Name" rules={[{ required: true, message: 'Required' }]}>
                    <Input placeholder="Enter item name" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="hsnCode" label="HSN Code">
                    <Input placeholder="Enter HSN code (optional)" />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 3: Alias, Description, Unit */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="aliasName" label="Alias Name (optional)">
                    <Input placeholder="Enter alias / alternate name" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="description" label="Description">
                    <Input.TextArea rows={1} placeholder="Enter product description" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                    <Select options={UNITS.map(u => ({ value: u, label: u }))} placeholder="Select Unit" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="gst" label="GST %" rules={[{ required: true }]}>
                    <Select options={GST_RATES.map(r => ({ value: r, label: `${r}%` }))} />
                  </Form.Item>
                </Col>
              </Row>

              <Divider className="my-4" />

              {/* Row 4: Tile Specifications */}
              <Row gutter={16}>
                <Col span={4}><Form.Item name="tileSize" label="Tile Size"><Select placeholder="Size" allowClear showSearch options={TILE_SIZES.map(s => ({ value: s, label: s }))} /></Form.Item></Col>
                <Col span={4}><Form.Item name="finish" label="Finish"><Select placeholder="Finish" allowClear showSearch options={FINISHES.map(f => ({ value: f, label: f }))} /></Form.Item></Col>
                <Col span={4}><Form.Item name="colour" label="Colour"><Input placeholder="Colour" /></Form.Item></Col>
                <Col span={4}><Form.Item name="surface" label="Surface"><Input placeholder="Surface" /></Form.Item></Col>
                <Col span={4}><Form.Item name="thickness" label="Thickness"><Input placeholder="e.g. 10mm" /></Form.Item></Col>
                <Col span={4}><Form.Item name="grade" label="Grade"><Select allowClear placeholder="Grade" options={[{value:'A',label:'A'},{value:'B',label:'B'},{value:'C',label:'C'}]} /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={4}><Form.Item name="tileType" label="Tile Type"><Select placeholder="Type" allowClear showSearch options={TILE_TYPES.map(t => ({ value: t, label: t }))} /></Form.Item></Col>
                <Col span={4}><Form.Item name="applicationArea" label="Application"><Select placeholder="Area" allowClear showSearch options={APPLICATION_AREAS.map(a => ({ value: a, label: a }))} /></Form.Item></Col>
                <Col span={4}><Form.Item name="antiSkidRating" label="Anti-Skid"><Select placeholder="Rating" allowClear options={ANTI_SKID.map(a => ({ value: a, label: a || 'None' }))} /></Form.Item></Col>
                <Col span={4}><Form.Item name="countryOfOrigin" label="Origin"><Select showSearch allowClear options={ORIGINS.map(o => ({ value: o, label: o }))} /></Form.Item></Col>
                <Col span={4}><Form.Item name="manufacturer" label="Manufacturer"><Input placeholder="If different from brand" /></Form.Item></Col>
                <Col span={4}><Form.Item name="barcode" label="Barcode"><Input placeholder="Barcode/EAN" /></Form.Item></Col>
              </Row>

              <Row gutter={16}>
                <Col span={6}><Form.Item name="design" label="Design"><Input placeholder="Design name" /></Form.Item></Col>
                <Col span={6}><Form.Item name="collection" label="Collection"><Input placeholder="Collection" /></Form.Item></Col>
                <Col span={4}><Form.Item name="piecesPerBox" label="Pcs/Box"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                <Col span={4}><Form.Item name="sqftPerBox" label="SqFt/Box"><InputNumber min={0} step={0.01} className="w-full" /></Form.Item></Col>
                <Col span={4}><Form.Item name="weightPerBox" label="Weight/Box (Kg)"><InputNumber min={0} step={0.1} className="w-full" /></Form.Item></Col>
              </Row>

              <Divider className="my-4" />

              {/* Pricing — Basic Price & Purchase Control */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-orange-800 mb-2">Purchase Price Control</div>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="basicPrice" label="Basic Price (₹)" tooltip="Base purchase price of this product"><InputNumber min={0} className="w-full" prefix="₹" placeholder="e.g. 100" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="excessPrice" label="Excess Price (₹)" tooltip="Max excess allowed above basic. Purchase rate cannot exceed Basic + Excess"><InputNumber min={0} className="w-full" prefix="₹" placeholder="e.g. 15" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="purchaseRate" label="Purchase Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="landingCost" label="Landing Cost"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                </Row>
                <div className="text-xs text-orange-600 -mt-2">⚠ Max Purchase Rate = Basic Price + Excess Price. PO rate above this will be blocked.</div>
              </div>

              {/* Selling Prices */}
              <Row gutter={16}>
                <Col span={4}><Form.Item name="mrp" label="MRP"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="retailRate" label="Retail Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="dealerRate" label="Dealer Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="wholesaleRate" label="Wholesale Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="distributorRate" label="Distributor Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="builderRate" label="Builder Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={4}><Form.Item name="projectRate" label="Project Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="minimumSellingRate" label="Min Selling Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="minStockLevel" label="Min Stock Level"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                <Col span={4}><Form.Item name="reorderLevel" label="Reorder Level"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                <Col span={4}><Form.Item name="status" label="Status"><Select options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'draft',label:'Draft'}]} /></Form.Item></Col>
                <Col span={4}><Form.Item name="salesType" label="Sales Type"><Select options={[{value:'Regular Sale',label:'Regular Sale'},{value:'CD Sales',label:'CD Sales'}]} /></Form.Item></Col>
              </Row>

              <Divider className="my-4" />

              {/* Toggles + Product Type */}
              <Row gutter={16}>
                <Col span={4}><Form.Item name="productType" label="Product Type"><Select options={[{value:'Regular Product',label:'Regular Product'},{value:'AO Product',label:'AO Product'}]} /></Form.Item></Col>
                <Col span={4}><Form.Item name="isNewArrival" label="New Arrival" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={4}><Form.Item name="isFeatured" label="Featured" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={4}><Form.Item name="onlineVisible" label="Online Visible" valuePropName="checked"><Switch defaultChecked /></Form.Item></Col>
                <Col span={4}><Form.Item name="dealerVisible" label="Dealer Visible" valuePropName="checked"><Switch defaultChecked /></Form.Item></Col>
              </Row>

              <Divider className="my-3" />

              {/* Image Upload */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Images</label>
                <div className="flex flex-wrap items-center gap-3">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => removeImage(i)}>
                        <span className="text-white text-lg font-bold">✕</span>
                      </div>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#FF5F03] hover:bg-orange-50 transition-colors">
                    <span className="text-2xl text-gray-400 leading-none">+</span>
                    <span className="text-[9px] text-gray-400 mt-1">Add</span>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageChange} />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">Upload product images (JPG, PNG, WEBP). Max 5MB each, up to 10 images.</p>
              </div>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3 pb-6">
                <Button size="large" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingProduct(null); setImageFiles([]); setImagePreviews([]); }}>
                  Cancel
                </Button>
                <Button type="primary" size="large" onClick={handleSave} loading={loading} className="px-8">
                  {editingProduct ? 'Update Product' : 'Preview & Save'}
                </Button>
              </div>
            </Form>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && previewData && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowPreview(false)} />
            <div className="fixed inset-x-8 top-8 bottom-8 z-[70] bg-white rounded-xl shadow-2xl overflow-y-auto max-w-3xl mx-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl">
                <h3 className="text-lg font-bold text-gray-800">Product Preview</h3>
                <div className="flex gap-3">
                  <Button onClick={() => setShowPreview(false)}>Back to Edit</Button>
                  <Button type="primary" onClick={handleConfirmSave} loading={loading}>Confirm & Save</Button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* Images */}
                {imagePreviews.length > 0 && (
                  <div className="flex gap-3 mb-4">
                    {imagePreviews.map((src, i) => (
                      <img key={i} src={src} alt="" className="w-24 h-24 rounded-lg object-cover border" />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <PreviewItem label="Brand" value={previewData.brandName} />
                  <PreviewItem label="Category" value={previewData.categoryName} />
                  <PreviewItem label="Subcategory" value={previewData.subcategoryName} />
                  <PreviewItem label="Product Code" value={previewData.productCode || 'Auto-generated'} />
                  <PreviewItem label="Item Name" value={previewData.itemName} highlight />
                  <PreviewItem label="HSN Code" value={previewData.hsnCode} />
                  <PreviewItem label="GST" value={`${previewData.gst}%`} />
                  <PreviewItem label="Unit" value={previewData.unit} />
                  <PreviewItem label="Status" value={previewData.status} />
                </div>

                <Divider className="my-3" />
                <h4 className="font-semibold text-gray-700 text-sm">Tile Specifications</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <PreviewItem label="Size" value={previewData.tileSize} />
                  <PreviewItem label="Finish" value={previewData.finish} />
                  <PreviewItem label="Colour" value={previewData.colour} />
                  <PreviewItem label="Surface" value={previewData.surface} />
                  <PreviewItem label="Thickness" value={previewData.thickness} />
                  <PreviewItem label="Grade" value={previewData.grade} />
                  <PreviewItem label="Design" value={previewData.design} />
                  <PreviewItem label="Collection" value={previewData.collection} />
                  <PreviewItem label="Tile Type" value={previewData.tileType} />
                  <PreviewItem label="Application" value={previewData.applicationArea} />
                  <PreviewItem label="Anti-Skid" value={previewData.antiSkidRating} />
                  <PreviewItem label="Origin" value={previewData.countryOfOrigin} />
                  <PreviewItem label="Manufacturer" value={previewData.manufacturer} />
                  <PreviewItem label="Barcode" value={previewData.barcode} />
                  <PreviewItem label="Pcs/Box" value={previewData.piecesPerBox} />
                  <PreviewItem label="SqFt/Box" value={previewData.sqftPerBox} />
                  <PreviewItem label="Weight/Box" value={previewData.weightPerBox} />
                </div>

                <Divider className="my-3" />
                <h4 className="font-semibold text-gray-700 text-sm">Pricing (₹)</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <PreviewItem label="Purchase Rate" value={previewData.purchaseRate ? `₹${previewData.purchaseRate}` : '-'} />
                  <PreviewItem label="Landing Cost" value={previewData.landingCost ? `₹${previewData.landingCost}` : '-'} />
                  <PreviewItem label="MRP" value={previewData.mrp ? `₹${previewData.mrp}` : '-'} highlight />
                  <PreviewItem label="Retail Rate" value={previewData.retailRate ? `₹${previewData.retailRate}` : '-'} />
                  <PreviewItem label="Dealer Rate" value={previewData.dealerRate ? `₹${previewData.dealerRate}` : '-'} />
                  <PreviewItem label="Wholesale Rate" value={previewData.wholesaleRate ? `₹${previewData.wholesaleRate}` : '-'} />
                  <PreviewItem label="Project Rate" value={previewData.projectRate ? `₹${previewData.projectRate}` : '-'} />
                  <PreviewItem label="Min Selling" value={previewData.minimumSellingRate ? `₹${previewData.minimumSellingRate}` : '-'} />
                </div>

                <Divider className="my-3" />
                <h4 className="font-semibold text-gray-700 text-sm">Stock & Visibility</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <PreviewItem label="Min Stock" value={previewData.minStockLevel} />
                  <PreviewItem label="Reorder Level" value={previewData.reorderLevel} />
                  <PreviewItem label="Sales Type" value={previewData.salesType} />
                  <PreviewItem label="Product Type" value={previewData.productType} />
                  <PreviewItem label="New Arrival" value={previewData.isNewArrival ? 'Yes' : 'No'} />
                  <PreviewItem label="Featured" value={previewData.isFeatured ? 'Yes' : 'No'} />
                  <PreviewItem label="Online Visible" value={previewData.onlineVisible ? 'Yes' : 'No'} />
                  <PreviewItem label="Dealer Visible" value={previewData.dealerVisible ? 'Yes' : 'No'} />
                </div>
              </div>
            </div>
          </>
        )}
        </>
      )}
    </div>
  );
};

// Small preview item component
const PreviewItem = ({ label, value, highlight }) => (
  <div>
    <span className="text-xs text-gray-400 block">{label}</span>
    <span className={`${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value || '-'}</span>
  </div>
);

// View Product Detail Modal
const ViewProductModal = ({ product, onClose }) => {
  if (!product) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-8 top-8 bottom-8 z-[70] bg-white rounded-xl shadow-2xl overflow-y-auto max-w-3xl mx-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-800">Product Details</h3>
          <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={onClose}>✕</span>
        </div>
        <div className="p-6 space-y-4">
          {product.images?.length > 0 && (
            <div className="flex gap-3 mb-4">
              {product.images.map((src, i) => (
                <ProductImage key={i} src={src} size="xl" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <PreviewItem label="Product Code" value={product.productCode} highlight />
            <PreviewItem label="Item Name" value={product.itemName} highlight />
            <PreviewItem label="Alias" value={product.aliasName} />
            <PreviewItem label="Brand" value={product.brand?.name} />
            <PreviewItem label="Category" value={product.category?.name} />
            <PreviewItem label="Subcategory" value={product.subcategory?.name} />
            <PreviewItem label="HSN Code" value={product.hsnCode} />
            <PreviewItem label="GST" value={`${product.gst}%`} />
            <PreviewItem label="Unit" value={product.unit} />
            <PreviewItem label="Status" value={product.status} />
            <PreviewItem label="Sales Type" value={product.salesType} />
            <PreviewItem label="Product Type" value={product.productType} />
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Tile Specifications</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <PreviewItem label="Tile Size" value={product.tileSize} />
              <PreviewItem label="Finish" value={product.finish} />
              <PreviewItem label="Colour" value={product.colour} />
              <PreviewItem label="Surface" value={product.surface} />
              <PreviewItem label="Thickness" value={product.thickness} />
              <PreviewItem label="Grade" value={product.grade} />
              <PreviewItem label="Design" value={product.design} />
              <PreviewItem label="Collection" value={product.collection} />
              <PreviewItem label="Tile Type" value={product.tileType} />
              <PreviewItem label="Application" value={product.applicationArea} />
              <PreviewItem label="Anti-Skid" value={product.antiSkidRating} />
              <PreviewItem label="Origin" value={product.countryOfOrigin} />
              <PreviewItem label="Manufacturer" value={product.manufacturer} />
              <PreviewItem label="Barcode" value={product.barcode} />
              <PreviewItem label="Pcs/Box" value={product.piecesPerBox} />
              <PreviewItem label="SqFt/Box" value={product.sqftPerBox} />
              <PreviewItem label="Weight/Box" value={product.weightPerBox} />
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Pricing (₹)</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <PreviewItem label="Purchase Rate" value={product.purchaseRate ? `₹${product.purchaseRate}` : '-'} />
              <PreviewItem label="Landing Cost" value={product.landingCost ? `₹${product.landingCost}` : '-'} />
              <PreviewItem label="MRP" value={product.mrp ? `₹${product.mrp}` : '-'} highlight />
              <PreviewItem label="Retail Rate" value={product.retailRate ? `₹${product.retailRate}` : '-'} />
              <PreviewItem label="Dealer Rate" value={product.dealerRate ? `₹${product.dealerRate}` : '-'} />
              <PreviewItem label="Wholesale Rate" value={product.wholesaleRate ? `₹${product.wholesaleRate}` : '-'} />
              <PreviewItem label="Project Rate" value={product.projectRate ? `₹${product.projectRate}` : '-'} />
              <PreviewItem label="Min Selling" value={product.minimumSellingRate ? `₹${product.minimumSellingRate}` : '-'} />
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Stock & Visibility</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <PreviewItem label="Min Stock" value={product.minStockLevel} />
              <PreviewItem label="Reorder Level" value={product.reorderLevel} />
              <PreviewItem label="New Arrival" value={product.isNewArrival ? 'Yes' : 'No'} />
              <PreviewItem label="Featured" value={product.isFeatured ? 'Yes' : 'No'} />
              <PreviewItem label="Online Visible" value={product.onlineVisible ? 'Yes' : 'No'} />
              <PreviewItem label="Dealer Visible" value={product.dealerVisible ? 'Yes' : 'No'} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ProductMaster;
