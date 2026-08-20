import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Modal, Form, Tag, Space, message, Popconfirm, Tooltip, Breadcrumb } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, RightOutlined, HomeOutlined, ReloadOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import categoryService from '../../services/categoryService.js';

const CategorySetup = () => {
  // Navigation: 'brands' | 'categories' | 'subcategories'
  const [level, setLevel] = useState('brands');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  // Data
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  // Fetch data based on current level
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      const params = { page: pagination.current, limit: pagination.pageSize, ...(search && { search }) };

      if (level === 'brands') {
        res = await categoryService.getBrands(params);
      } else if (level === 'categories') {
        res = await categoryService.getCategories(selectedBrand._id, params);
      } else if (level === 'subcategories') {
        res = await categoryService.getSubcategories(selectedBrand._id, selectedCategory._id, params);
      }

      if (res.success) {
        setItems(res.data);
        setPagination(prev => ({ ...prev, total: res.pagination.totalItems }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }, [level, selectedBrand, selectedCategory, pagination.current, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Navigate into a brand/category
  const drillInto = (item) => {
    setSearch('');
    setPagination(prev => ({ ...prev, current: 1 }));
    if (level === 'brands') {
      setSelectedBrand(item);
      setLevel('categories');
    } else if (level === 'categories') {
      setSelectedCategory(item);
      setLevel('subcategories');
    }
  };

  // Go back
  const goBack = () => {
    setSearch('');
    setPagination(prev => ({ ...prev, current: 1 }));
    if (level === 'subcategories') {
      setSelectedCategory(null);
      setLevel('categories');
    } else if (level === 'categories') {
      setSelectedBrand(null);
      setLevel('brands');
    }
  };

  // Add/Edit
  const openModal = (item = null) => {
    setEditingItem(item);
    form.setFieldsValue(item ? { name: item.name, description: item.description } : { name: '', description: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      let res;
      if (editingItem) {
        // Update
        if (level === 'brands') res = await categoryService.updateBrand(editingItem._id, values);
        else if (level === 'categories') res = await categoryService.updateCategory(editingItem._id, values);
        else res = await categoryService.updateSubcategory(editingItem._id, values);
      } else {
        // Create
        if (level === 'brands') res = await categoryService.createBrand(values);
        else if (level === 'categories') res = await categoryService.createCategory(selectedBrand._id, values);
        else res = await categoryService.createSubcategory(selectedBrand._id, selectedCategory._id, values);
      }

      if (res.success) {
        message.success(res.message || 'Saved!');
        setModalOpen(false);
        form.resetFields();
        setEditingItem(null);
        fetchData();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Delete
  const handleDelete = async (id) => {
    try {
      let res;
      if (level === 'brands') res = await categoryService.deleteBrand(id);
      else if (level === 'categories') res = await categoryService.deleteCategory(id);
      else res = await categoryService.deleteSubcategory(id);

      if (res.success) {
        message.success(res.message || 'Deleted!');
        fetchData();
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete');
    }
  };

  // Get title and description based on level
  const getTitle = () => {
    if (level === 'brands') return 'Brand Setup';
    if (level === 'categories') return `Categories — ${selectedBrand?.name}`;
    return `Subcategories — ${selectedCategory?.name}`;
  };

  const getSubtitle = () => {
    if (level === 'brands') return 'Manage tile & building material brands (Kajaria, Somany, AGL, etc.)';
    if (level === 'categories') return 'Manage categories like Floor Tiles, Wall Tiles, Granite, Marble, etc.';
    return 'Manage subcategories like Vitrified, Ceramic, GVT/PGVT, Double Charge, etc.';
  };

  const getAddLabel = () => {
    if (level === 'brands') return 'Add Brand';
    if (level === 'categories') return 'Add Category';
    return 'Add Subcategory';
  };

  // Table columns
  const columns = [
    {
      title: level === 'brands' ? 'Brand' : level === 'categories' ? 'Category' : 'Subcategory',
      key: 'name',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#FF5F03]/10 flex items-center justify-center text-[#FF5F03] font-bold text-xs">
            {record.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{record.name}</div>
            {record.description && <div className="text-xs text-gray-400">{record.description}</div>}
          </div>
        </div>
      ),
    },
    ...(level !== 'subcategories' ? [{
      title: level === 'brands' ? 'Categories' : 'Subcategories',
      key: 'count',
      width: 120,
      render: (_, record) => (
        <Tag color="blue">{record.categoryCount || record.subcategoryCount || 0}</Tag>
      ),
    }] : []),
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <Tag color={status === 'active' ? 'green' : 'red'}>{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          {level !== 'subcategories' && (
            <Tooltip title={level === 'brands' ? 'View Categories' : 'View Subcategories'}>
              <Button type="text" size="small" icon={<RightOutlined />} onClick={() => drillInto(record)} className="text-blue-600" />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          <Popconfirm title={`Delete "${record.name}"?`} onConfirm={() => handleDelete(record._id)} okText="Yes">
            <Tooltip title="Delete">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div className="flex items-center gap-3">
          {level !== 'brands' && (
            <Button icon={<ArrowLeftOutlined />} onClick={goBack} className="flex items-center" />
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{getTitle()}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{getSubtitle()}</p>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} size="large">
          {getAddLabel()}
        </Button>
      </div>

      {/* Breadcrumb */}
      <Breadcrumb className="mb-4" items={[
        { title: <span className="cursor-pointer" onClick={() => { setLevel('brands'); setSelectedBrand(null); setSelectedCategory(null); setSearch(''); }}>Brands</span> },
        ...(selectedBrand ? [{ title: <span className="cursor-pointer" onClick={() => { setLevel('categories'); setSelectedCategory(null); setSearch(''); }}>{selectedBrand.name}</span> }] : []),
        ...(selectedCategory ? [{ title: selectedCategory.name }] : []),
      ]} />

      {/* Search + Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center gap-3">
          <Input
            placeholder={`Search ${level}...`}
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64"
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
        </div>
        <Table
          columns={columns}
          dataSource={items}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showTotal: (total) => `${total} items`,
            showSizeChanger: false,
          }}
          onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current }))}
          size="middle"
          onRow={(record) => ({
            onDoubleClick: () => { if (level !== 'subcategories') drillInto(record); },
            className: level !== 'subcategories' ? 'cursor-pointer' : '',
          })}
        />
      </div>

      {/* Add/Edit Modal */}
      <Modal
        title={editingItem ? `Edit ${level.slice(0, -1)}` : getAddLabel()}
        open={modalOpen}
        onOk={handleSave}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingItem(null); }}
        okText={editingItem ? 'Update' : 'Create'}
        confirmLoading={loading}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder={`Enter ${level.slice(0, -1)} name`} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
          <Form.Item name="status" label="Status" initialValue="active">
            <Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategorySetup;
