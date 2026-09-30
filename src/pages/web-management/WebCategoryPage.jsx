import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AutoComplete, Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Space,
  Switch, Select, Table, Tag, Tooltip, Upload, Image, message,
} from 'antd';
import {
  DeleteOutlined, EditOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, UploadOutlined,
} from '@ant-design/icons';
import categoryService from '../../services/categoryService.js';
import { resolveUploadUrl } from '../../config/api.js';

/**
 * Category Management — the master list of main categories.
 *
 * This is where the categories themselves are created: Tiles, Building Materials, Paints &
 * Coatings, Sanitaryware … everything the business sells. Brand & Category Setup then picks
 * from this list per brand, and Product Master picks from it per product.
 *
 * Keeping creation here — and selection everywhere else — is what stops the same category
 * being retyped under each brand and drifting into "KAJARIA CATEGORY".
 *
 * The image / badge / sort order fields are the storefront card shown on the website home
 * page, so one record describes the category for both the admin and the shop.
 */
const WebCategoryPage = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState({ open: false, editing: null });
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  // Default names from the seeded taxonomy, so the common case is a click not a retype.
  const [suggestions, setSuggestions] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // The TREE, not the flat list: the Subcategories column counts each row's children,
      // and `/nodes` returns plain documents with no `children` — so that column read 0 for
      // every category even when subcategories existed.
      const res = await categoryService.getTree();
      if (res.success) setCategories(res.data || []);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    categoryService.getSuggestions()
      .then((res) => { if (res.success) setSuggestions(res.data || []); })
      .catch(() => { /* suggestions are a shortcut — the field is free text anyway */ });
  }, []);

  /**
   * The default names that do NOT exist yet. A name disappears from this list the moment it
   * is created, so the admin is never offered a duplicate. Typing a brand new name still
   * works — this only shortens the common path.
   */
  const nameSuggestions = useMemo(() => {
    const existing = new Set(categories.map((c) => c.name.trim().toLowerCase()));
    return suggestions
      .filter((s) => !existing.has(s.name.trim().toLowerCase()))
      .map((s) => ({ value: s.name, label: s.name }));
  }, [suggestions, categories]);

  const openModal = (editing = null) => {
    setModal({ open: true, editing });
    if (editing) {
      form.setFieldsValue({
        name: editing.name,
        description: editing.description || '',
        image: editing.image || '',
        badge: editing.badge || '',
        sortOrder: editing.sortOrder || 0,
        showOnHome: Boolean(editing.showOnHome),
        status: editing.status || 'active',
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ status: 'active', sortOrder: 0, showOnHome: false });
    }
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = modal.editing
        ? await categoryService.updateNode(modal.editing._id, values)
        : await categoryService.createNode(values);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Saved.');
      setModal({ open: false, editing: null });
      form.resetFields();
      await load();
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const remove = async (id) => {
    try {
      const res = await categoryService.deleteNode(id);
      if (!res.success) throw new Error(res.message);
      message.success('Category deleted.');
      await load();
    } catch (error) { message.error(error.message || 'Failed to delete'); }
  };

  const uploadImage = async (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Choose a JPG, PNG or WEBP image.'); return false;
    }
    if (file.size > 5 * 1024 * 1024) { message.error('Image must be 5 MB or smaller.'); return false; }
    setUploading(true);
    try {
      const res = await categoryService.uploadBrandImage(file);
      if (!res.success || !res.data) throw new Error(res.message || 'Upload failed.');
      form.setFieldsValue({ image: res.data });
      message.success('Image uploaded.');
    } catch (error) { message.error(error.message || 'Upload failed.'); }
    finally { setUploading(false); }
    return false;
  };

  const rows = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : categories;

  const columns = [
    {
      title: 'Image', dataIndex: 'image', width: 70,
      render: (v) => (v
        ? <Image src={resolveUploadUrl(v)} width={44} height={44} className="rounded object-cover" />
        : <div className="w-11 h-11 rounded bg-gray-100" />),
    },
    {
      title: 'Category', dataIndex: 'name',
      render: (v, r) => (
        <div>
          <div className="font-medium text-sm text-gray-900">{v}</div>
          {r.slug && <div className="text-xs text-gray-400">/{r.slug}</div>}
        </div>
      ),
    },
    {
      title: 'Badge', dataIndex: 'badge', width: 120,
      render: (v) => (v ? <Tag color="orange">{v}</Tag> : <span className="text-gray-300">—</span>),
    },
    {
      title: 'Subcategories', key: 'subs', width: 110,
      render: (_, r) => <Tag>{(r.children || []).length}</Tag>,
    },
    {
      title: 'On home page', dataIndex: 'showOnHome', width: 120, align: 'center',
      render: (v) => (v ? <Tag color="green">Shown</Tag> : <span className="text-gray-300">—</span>),
    },
    { title: 'Order', dataIndex: 'sortOrder', width: 80, align: 'center' },
    {
      title: 'Status', dataIndex: 'status', width: 100,
      render: (v) => <Tag color={v === 'active' ? 'green' : 'red'}>{v}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          <Popconfirm title={`Delete "${r.name}"?`} onConfirm={() => remove(r._id)} okButtonProps={{ danger: true }}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Category Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            The main categories the business sells. Everything else picks from this list.
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} size="large"
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }} onClick={() => openModal()}>
            Add Category
          </Button>
        </Space>
      </div>

      <Alert
        className="mb-3"
        type="info"
        showIcon
        message="Add the main categories here."
        description="Brand & Category Setup then ticks which of these a brand sells, and Product Master picks one per product. Adding a category once and selecting it everywhere is what keeps the list consistent."
      />

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-3">
        <Input
          placeholder="Search categories…"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          allowClear
          className="w-72"
        />
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={rows}
          columns={columns}
          size="middle"
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} categories` }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={search ? 'No categories match that search' : 'No categories yet — add the first one'}
              />
            ),
          }}
        />
      </div>

      <Modal
        title={modal.editing ? `Edit ${modal.editing.name}` : 'Add Category'}
        open={modal.open}
        onCancel={() => { setModal({ open: false, editing: null }); form.resetFields(); }}
        onOk={save}
        confirmLoading={saving}
        okText={modal.editing ? 'Update' : 'Add'}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={640}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="Category name"
            rules={[{ required: true, message: 'Name is required' }]}
            extra={nameSuggestions.length
              ? `${nameSuggestions.length} of the standard categories are not added yet — pick one, or type your own.`
              : 'All standard categories have been added — type a new name.'}
          >
            <AutoComplete
              options={nameSuggestions}
              placeholder="e.g. Tiles"
              filterOption={(input, option) => option.value.toLowerCase().includes(input.toLowerCase())}
            />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>

          <Form.Item name="image" label="Home page image" extra="Shown on the website category card">
            <Input placeholder="Paste an image URL or upload" />
          </Form.Item>
          <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={uploadImage}>
            <Button icon={<UploadOutlined />} loading={uploading} size="small">Upload image</Button>
          </Upload>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <Form.Item name="badge" label="Badge" extra="e.g. Bulk Prices">
              <Input placeholder="Optional" />
            </Form.Item>
            <Form.Item name="sortOrder" label="Sort order" extra="Lower shows first">
              <InputNumber min={0} className="w-full" />
            </Form.Item>
            <Form.Item name="showOnHome" label="Show on home page" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default WebCategoryPage;
