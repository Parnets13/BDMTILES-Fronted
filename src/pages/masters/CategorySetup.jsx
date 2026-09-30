import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, AutoComplete, Breadcrumb, Button, Card, Drawer, Empty, Form, Image, Input, InputNumber, Modal,
  Popconfirm, Select, Space, Switch, Table, Tag, Tooltip, Upload, message,
} from 'antd';
import {
  ArrowLeftOutlined, DeleteOutlined, EditOutlined, PlusOutlined, RightOutlined,
  ReloadOutlined, SettingOutlined, UploadOutlined,
} from '@ant-design/icons';
import categoryService from '../../services/categoryService.js';
import attributeService from '../../services/attributeService.js';
import { resolveUploadUrl } from '../../config/api.js';

/**
 * Brand & Category Setup — drill-down, the same shape as the original screen.
 *
 *   Brands  →  click a brand  →  the categories that brand sells  →  click one  →  subcategories
 *
 * The brand is created here. The categories are SELECTED from the list managed in Category
 * Management rather than typed in again — that is what stops the same category being retyped
 * per brand and drifting into a "KAJARIA CATEGORY".
 *
 * A brand links to a category; it never owns a copy. So removing a category from a brand
 * unlinks it rather than deleting it — other brands may still sell it.
 *
 * Both the brand form and the category form take an image.
 */

const LEVEL_LABEL = { brands: 'Brand', categories: 'Category', subcategories: 'Subcategory' };

/** Image field with preview and upload — shared by the brand and category forms. */
const ImageField = ({ value, onChange, onUpload, uploading }) => (
  <div>
    {value && (
      <div className="mb-2 flex items-start gap-3">
        <Image src={resolveUploadUrl(value)} alt="Preview" width={88} height={88}
          className="rounded border border-gray-200 object-contain" />
        <Button size="small" danger onClick={() => onChange?.('')}>Remove</Button>
      </div>
    )}
    <Space.Compact className="w-full">
      <Input
        placeholder="Paste an image URL or upload"
        value={value || ''}
        onChange={(event) => onChange?.(event.target.value)}
      />
      <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={onUpload}>
        <Button icon={<UploadOutlined />} loading={uploading}>Upload</Button>
      </Upload>
    </Space.Compact>
    <div className="mt-1 text-xs text-gray-400">JPG, PNG or WEBP · max 5 MB</div>
  </div>
);

const CategorySetup = () => {
  const [level, setLevel] = useState('brands');
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [items, setItems] = useState([]);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [statusSavingId, setStatusSavingId] = useState(null);

  // The Fields panel: the attribute definitions that become the product form's inputs.
  // This is how a NEW category gets fields — add them here and they appear in Product Master
  // immediately, with no code change.
  const [fieldsTarget, setFieldsTarget] = useState(null);
  const [ownFields, setOwnFields] = useState([]);
  const [inheritedCount, setInheritedCount] = useState(0);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [editingField, setEditingField] = useState(null);
  const [fieldForm] = Form.useForm();
  const [savingField, setSavingField] = useState(false);
  // Default names from the seeded taxonomy, so adding a standard subcategory is a click.
  const [suggestions, setSuggestions] = useState([]);

  const brandIdsOf = (category) => (category.brands || []).map((b) => (typeof b === 'object' ? b._id : b));

  // ── Load ─────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (level === 'brands') {
        const res = await categoryService.getBrands({ limit: 200, ...(search ? { search } : {}) });
        if (res.success) setItems(res.data || []);

      } else if (level === 'categories') {
        // Categories that list this brand — the link, not a copy.
        //
        // The TREE is used rather than a flat list because each row shows its subcategory
        // count. `/nodes` returns plain documents with no `children`, so that column read 0
        // for every category even when subcategories existed.
        const res = await categoryService.getTree();
        if (res.success) {
          const all = res.data || [];
          setAllCategories(all);
          const linked = all.filter((c) => brandIdsOf(c).includes(selectedBrand?._id));
          setItems(search ? linked.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : linked);
        }

      } else {
        const res = await categoryService.getNodes({ parent: selectedCategory?._id });
        if (res.success) {
          const kids = res.data || [];
          setItems(search ? kids.filter((c) => c.name.toLowerCase().includes(search.toLowerCase())) : kids);
        }
      }
    } catch (error) { message.error(error.message || 'Failed to load'); }
    finally { setLoading(false); }
  }, [level, selectedBrand, selectedCategory, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    categoryService.getSuggestions()
      .then((res) => { if (res.success) setSuggestions(res.data || []); })
      .catch(() => { /* a shortcut only — the field is free text regardless */ });
  }, []);

  /**
   * The standard subcategories for the category being drilled into, minus the ones already
   * added. Matched by name because the taxonomy is static data while the category is a
   * database row — if the admin renamed it, no suggestions appear, which is correct: a
   * renamed category is no longer the seeded one.
   */
  const subcategorySuggestions = useMemo(() => {
    if (!selectedCategory) return [];
    const key = selectedCategory.name.trim().toLowerCase();
    const dept = suggestions.find((sug) => sug.name.trim().toLowerCase() === key);
    if (!dept) return [];
    const existing = new Set(items.map((i) => i.name.trim().toLowerCase()));
    return dept.categories
      .filter((n) => !existing.has(n.trim().toLowerCase()))
      .map((n) => ({ value: n, label: n }));
  }, [suggestions, selectedCategory, items]);

  const drillInto = (item) => {
    setSearch('');
    if (level === 'brands') { setSelectedBrand(item); setLevel('categories'); }
    else if (level === 'categories') { setSelectedCategory(item); setLevel('subcategories'); }
  };

  const goBack = () => {
    setSearch('');
    if (level === 'subcategories') { setSelectedCategory(null); setLevel('categories'); }
    else if (level === 'categories') { setSelectedBrand(null); setLevel('brands'); }
  };

  // ── Modal ────────────────────────────────────────────────────────────────
  const openModal = (item = null) => {
    setEditing(item);
    if (level === 'brands') {
      form.setFieldsValue(item
        ? { name: item.name, description: item.description, image: item.image || '' }
        : { name: '', description: '', image: '' });
    } else if (level === 'categories') {
      form.setFieldsValue(item
        ? { name: item.name, description: item.description, image: item.image || '', status: item.status || 'active' }
        : { categoryId: undefined });
    } else {
      form.setFieldsValue(item
        ? { name: item.name, description: item.description, status: item.status || 'active' }
        : { name: '', description: '', status: 'active' });
    }
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      let res;

      if (level === 'brands') {
        res = editing
          ? await categoryService.updateBrand(editing._id, values)
          : await categoryService.createBrand(values);

      } else if (level === 'categories' && !editing) {
        // "Add Category" here LINKS an existing category to this brand; it does not create one.
        const category = allCategories.find((c) => c._id === values.categoryId);
        if (!category) throw new Error('Pick a category from the list.');
        const next = [...new Set([...brandIdsOf(category), selectedBrand._id])];
        res = await categoryService.setNodeBrands(category._id, next);

      } else if (level === 'categories') {
        // Editing the shared category record.
        res = await categoryService.updateNode(editing._id, {
          name: values.name,
          description: values.description,
          image: values.image,
          status: values.status,
        });

      } else {
        res = editing
          ? await categoryService.updateNode(editing._id, { name: values.name, description: values.description, status: values.status })
          : await categoryService.createNode({ name: values.name, description: values.description, parent: selectedCategory._id });
      }

      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Saved.');
      closeModal();
      await fetchData();
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  // ── Delete ───────────────────────────────────────────────────────────────
  const handleDelete = async (item) => {
    try {
      let res;
      if (level === 'brands') {
        res = await categoryService.deleteBrand(item._id);
      } else if (level === 'categories') {
        // Unlink, not delete — the category is shared with every other brand that sells it.
        const next = brandIdsOf(item).filter((b) => b !== selectedBrand._id);
        res = await categoryService.setNodeBrands(item._id, next);
        if (res.success) res = { ...res, message: `${item.name} removed from ${selectedBrand.name}.` };
      } else {
        res = await categoryService.deleteNode(item._id);
      }
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Done.');
      await fetchData();
    } catch (error) { message.error(error.message || 'Failed'); }
  };

  // ── Status ───────────────────────────────────────────────────────────────
  /** Flip a category or subcategory between active and inactive straight from the list. */
  const toggleStatus = async (record, checked) => {
    setStatusSavingId(record._id);
    const status = checked ? 'active' : 'inactive';
    try {
      const res = level === 'brands'
        ? await categoryService.updateBrand(record._id, { status })
        : await categoryService.updateNode(record._id, { status });
      if (!res.success) throw new Error(res.message);
      setItems((list) => list.map((r) => (r._id === record._id ? { ...r, status } : r)));
      message.success(checked ? 'Set active.' : 'Set inactive — it stays in the list but is hidden from the website.');
    } catch (error) { message.error(error.message || 'Could not change status'); }
    finally { setStatusSavingId(null); }
  };

  // ── Fields (attribute definitions) ───────────────────────────────────────
  /**
   * These ARE the product form's inputs. Add one here and it appears in Product Master for
   * every product in this category — no code, no deploy. That is how a brand new category
   * gets fields at all.
   */
  const loadFields = useCallback(async (nodeId) => {
    setFieldsLoading(true);
    try {
      // `list` returns only what THIS node declares (editable). `getEffective` returns the
      // merged set, so the difference tells us how many are inherited from above.
      const [own, effective] = await Promise.all([
        attributeService.list({ category: nodeId }),
        attributeService.getEffective(nodeId),
      ]);
      const ownRows = own.success ? (own.data || []) : [];
      const total = effective.success ? (effective.data || []).length : 0;
      setOwnFields(ownRows);
      setInheritedCount(Math.max(0, total - ownRows.length));
    } catch (error) { message.error(error.message || 'Could not load fields'); }
    finally { setFieldsLoading(false); }
  }, []);

  const openFields = (record) => {
    setFieldsTarget(record);
    setEditingField(null);
    fieldForm.resetFields();
    fieldForm.setFieldsValue({ type: 'select', filterable: true, required: false });
    loadFields(record._id);
  };

  const closeFields = () => {
    setFieldsTarget(null);
    setEditingField(null);
    setOwnFields([]);
    setInheritedCount(0);
    fieldForm.resetFields();
  };

  const startEditField = (field) => {
    setEditingField(field);
    fieldForm.setFieldsValue({
      label: field.label,
      key: field.key,
      type: field.type,
      options: (field.options || []).join(', '),
      unit: field.unit || '',
      filterable: Boolean(field.filterable),
      required: Boolean(field.required),
      help: field.help || '',
    });
  };

  const cancelEditField = () => {
    setEditingField(null);
    fieldForm.resetFields();
    fieldForm.setFieldsValue({ type: 'select', filterable: true, required: false });
  };

  const saveField = async () => {
    if (!fieldsTarget) return;
    try {
      const values = await fieldForm.validateFields();
      setSavingField(true);
      const payload = {
        ...values,
        options: typeof values.options === 'string'
          ? values.options.split(',').map((o) => o.trim()).filter(Boolean)
          : (values.options || []),
      };
      const res = editingField
        ? await attributeService.update(editingField._id, payload)
        : await attributeService.create({ ...payload, category: fieldsTarget._id });
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Saved.');
      cancelEditField();
      await loadFields(fieldsTarget._id);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Could not save the field');
    } finally { setSavingField(false); }
  };

  const deleteField = async (field) => {
    try {
      const res = await attributeService.remove(field._id);
      if (!res.success) throw new Error(res.message);
      message.success('Field deleted.');
      await loadFields(fieldsTarget._id);
    } catch (error) { message.error(error.message || 'Could not delete the field'); }
  };

  // ── Image upload ─────────────────────────────────────────────────────────
  const uploadImage = async (file) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      message.error('Choose a JPG, PNG or WEBP image.'); return false;
    }
    if (file.size > 5 * 1024 * 1024) { message.error('Image must be 5 MB or smaller.'); return false; }
    setUploading(true);
    try {
      // Brand logos and category images go to their own endpoints so the two can be told
      // apart on disk.
      const res = level === 'brands'
        ? await categoryService.uploadBrandImage(file)
        : await categoryService.uploadCategoryImage(file);
      if (!res.success || !res.data) throw new Error(res.message || 'Upload failed.');
      form.setFieldsValue({ image: res.data });
      message.success('Image uploaded.');
    } catch (error) { message.error(error.message || 'Upload failed.'); }
    finally { setUploading(false); }
    return false;
  };

  // ── Headings ─────────────────────────────────────────────────────────────
  const title = level === 'brands' ? 'Brand Setup'
    : level === 'categories' ? `Categories — ${selectedBrand?.name}`
      : `Subcategories — ${selectedCategory?.name}`;

  const subtitle = level === 'brands'
    ? 'Add the brands you sell, then open one to choose its categories'
    : level === 'categories'
      ? 'Pick from the categories created in Category Management'
      : 'Split this category further if you need to';

  const addLabel = level === 'brands' ? 'Add Brand'
    : level === 'categories' ? 'Add Category'
      : 'Add Subcategory';

  // Categories not yet linked to this brand are the only sensible ones to offer.
  const linkableCategories = allCategories.filter((c) => !brandIdsOf(c).includes(selectedBrand?._id));

  const columns = [
    {
      title: level === 'brands' ? 'Brand' : level === 'categories' ? 'Category' : 'Subcategory',
      key: 'name',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          {level !== 'subcategories' && (
            record.image
              ? <Image src={resolveUploadUrl(record.image)} width={40} height={40} className="rounded object-cover" preview={false} />
              : (
                <div className="w-10 h-10 rounded-lg bg-[#FF5F03]/10 flex items-center justify-center text-[#FF5F03] font-bold text-xs">
                  {record.name?.charAt(0)?.toUpperCase()}
                </div>
              )
          )}
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
        <Tag color="blue">{level === 'brands' ? (record.categoryCount || 0) : (record.children || []).length}</Tag>
      ),
    }] : []),
    {
      // Shown at every level. The toggle is the quick path — the edit modal also has the field.
      title: 'Status',
      dataIndex: 'status',
      width: 130,
      render: (value, record) => {
        const active = (value || 'active') === 'active';
        return (
          <Space size={6}>
            <Tag color={active ? 'green' : 'red'}>{active ? 'Active' : 'Inactive'}</Tag>
            <Tooltip title={active ? 'Set inactive' : 'Set active'}>
              <Switch
                size="small"
                checked={active}
                loading={statusSavingId === record._id}
                onChange={(checked) => toggleStatus(record, checked)}
              />
            </Tooltip>
          </Space>
        );
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 190,
      render: (_, record) => (
        <Space>
          {level !== 'subcategories' && (
            <Tooltip title={level === 'brands' ? 'View its categories' : 'View subcategories'}>
              <Button type="text" size="small" icon={<RightOutlined />} onClick={() => drillInto(record)} className="text-blue-600" />
            </Tooltip>
          )}
          {/* Fields = the product form's inputs. Available at category AND subcategory level,
              because a new category gets its fields here. */}
          {level !== 'brands' && (
            <Tooltip title="Fields — what the product form asks for">
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => openFields(record)}
                className="text-purple-600"
              />
            </Tooltip>
          )}
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(record)} />
          </Tooltip>
          <Popconfirm
            title={level === 'categories'
              ? `Remove "${record.name}" from ${selectedBrand?.name}?`
              : `Delete "${record.name}"?`}
            description={level === 'categories' ? 'The category itself is kept — other brands may still sell it.' : undefined}
            onConfirm={() => handleDelete(record)}
            okButtonProps={{ danger: true }}
            okText={level === 'categories' ? 'Remove' : 'Delete'}
          >
            <Tooltip title={level === 'categories' ? 'Remove from this brand' : 'Delete'}>
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5">
        <div className="flex items-center gap-3">
          {level !== 'brands' && <Button icon={<ArrowLeftOutlined />} onClick={goBack} />}
          <div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
          <Button type="primary" size="large" onClick={() => openModal()}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            {addLabel}
          </Button>
        </Space>
      </div>

      <Breadcrumb
        className="mb-4"
        items={[
          { title: <span className="cursor-pointer" onClick={() => { setLevel('brands'); setSelectedBrand(null); setSelectedCategory(null); setSearch(''); }}>Brands</span> },
          ...(selectedBrand ? [{ title: <span className="cursor-pointer" onClick={() => { setLevel('categories'); setSelectedCategory(null); setSearch(''); }}>{selectedBrand.name}</span> }] : []),
          ...(selectedCategory ? [{ title: selectedCategory.name }] : []),
        ]}
      />

      {level === 'categories' && (
        <Alert
          className="mb-3"
          type="info"
          showIcon
          message="These are the categories this brand sells."
          description="Add Category picks one you already created in Category Management. The bin icon removes it from this brand only — the category itself stays for the other brands."
        />
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100">
          <Input
            placeholder={`Search ${level}…`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            allowClear
            className="w-64"
          />
        </div>
        <Table
          columns={columns}
          dataSource={items}
          rowKey="_id"
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: false, showTotal: (t) => `${t} items` }}
          size="middle"
          onRow={(record) => ({
            onDoubleClick: () => { if (level !== 'subcategories') drillInto(record); },
            className: level !== 'subcategories' ? 'cursor-pointer' : '',
          })}
        />
      </div>

      <Modal
        title={editing ? `Edit ${LEVEL_LABEL[level]}` : addLabel}
        open={modalOpen}
        onOk={handleSave}
        onCancel={closeModal}
        okText={editing ? 'Update' : 'Add'}
        confirmLoading={saving}
        width={620}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          {level === 'brands' && (
            <Form.Item name="name" label="Brand name" rules={[{ required: true, message: 'Brand name is required' }]}>
              <Input placeholder="e.g. Kajaria" />
            </Form.Item>
          )}

          {level === 'categories' && !editing && (
            <Form.Item
              name="categoryId"
              label="Category"
              rules={[{ required: true, message: 'Pick a category' }]}
              extra="These come from Category Management. Add a new one there if it is missing."
            >
              <Select
                showSearch
                optionFilterProp="label"
                placeholder={linkableCategories.length ? 'Select a category' : 'Every category is already linked to this brand'}
                disabled={!linkableCategories.length}
                options={linkableCategories.map((c) => ({ value: c._id, label: c.name }))}
              />
            </Form.Item>
          )}

          {level === 'categories' && editing && (
            <Form.Item name="name" label="Category name" rules={[{ required: true, message: 'Name is required' }]}>
              <Input />
            </Form.Item>
          )}

          {level === 'subcategories' && (
            <Form.Item
              name="name"
              label="Subcategory name"
              rules={[{ required: true, message: 'Name is required' }]}
              extra={subcategorySuggestions.length
                ? `${subcategorySuggestions.length} standard subcategories for ${selectedCategory?.name} are not added yet — pick one, or type your own.`
                : 'Type a subcategory name.'}
            >
              <AutoComplete
                options={subcategorySuggestions}
                placeholder="e.g. Floor Tiles"
                filterOption={(input, option) => option.value.toLowerCase().includes(input.toLowerCase())}
              />
            </Form.Item>
          )}

          {/* Image on the brand form and on the category form. */}
          {level === 'brands' && (
            <Form.Item name="image" label="Brand logo">
              <ImageField onUpload={uploadImage} uploading={uploading} />
            </Form.Item>
          )}
          {level === 'categories' && editing && (
            <Form.Item name="image" label="Category image">
              <ImageField onUpload={uploadImage} uploading={uploading} />
            </Form.Item>
          )}

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional" />
          </Form.Item>

          {level !== 'brands' && (
            <Form.Item name="status" label="Status" initialValue="active">
              <Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* ── Fields ────────────────────────────────────────────────────────────
          What the product form asks for in this category. Adding one here makes it appear in
          Product Master straight away — that is how a brand new category gets any fields. */}
      <Drawer
        title={fieldsTarget ? `Fields — ${fieldsTarget.name}` : 'Fields'}
        open={Boolean(fieldsTarget)}
        onClose={closeFields}
        width={620}
        destroyOnHidden
      >
        <Alert
          className="mb-4"
          type="info"
          showIcon
          message="These are the inputs shown on the product form for this category."
          description="Pick a type, give the options, and tick “Show as website filter” if customers should filter by it. Changes apply immediately — no deploy."
        />

        {inheritedCount > 0 && (
          <Alert
            className="mb-4"
            type="success"
            showIcon
            message={`${inheritedCount} field${inheritedCount === 1 ? '' : 's'} inherited from the level above`}
            description="Those are edited where they are declared, so they are not listed here."
          />
        )}

        {/* Existing fields */}
        <Card
          size="small"
          className="mb-4"
          title={<span className="text-sm">{ownFields.length} field{ownFields.length === 1 ? '' : 's'} declared here</span>}
        >
          {fieldsLoading ? (
            <div className="py-6 text-center text-gray-400">Loading…</div>
          ) : ownFields.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="No fields yet — add the first one below"
            />
          ) : (
            <Space direction="vertical" size={8} className="w-full">
              {ownFields.map((f) => (
                <div key={f._id} className="flex items-start justify-between gap-3 border-b border-gray-100 pb-2 last:border-0">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">
                      {f.label}
                      {f.unit ? <span className="text-gray-400 font-normal"> ({f.unit})</span> : null}
                    </div>
                    <div className="text-xs text-gray-400 font-mono">{f.key}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {f.type}
                      {(f.options || []).length ? ` · ${(f.options || []).slice(0, 5).join(', ')}${f.options.length > 5 ? '…' : ''}` : ''}
                      {f.required ? ' · required' : ''}
                    </div>
                  </div>
                  <Space size={4} className="shrink-0">
                    {f.filterable && <Tag color="green" className="!mr-0">filter</Tag>}
                    <Button type="text" size="small" icon={<EditOutlined />} onClick={() => startEditField(f)} />
                    <Popconfirm title={`Delete "${f.label}"?`} onConfirm={() => deleteField(f)} okButtonProps={{ danger: true }}>
                      <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </Space>
                </div>
              ))}
            </Space>
          )}
        </Card>

        {/* Add / edit one field */}
        <Card
          size="small"
          title={<span className="text-sm">{editingField ? `Edit "${editingField.label}"` : 'Add a field'}</span>}
          extra={editingField ? <Button size="small" onClick={cancelEditField}>Cancel edit</Button> : null}
        >
          <Form form={fieldForm} layout="vertical">
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="label" label="Label" rules={[{ required: true, message: 'Label is required' }]}>
                <Input placeholder="e.g. Finish" />
              </Form.Item>
              <Form.Item
                name="key"
                label="Key"
                rules={[
                  { required: true, message: 'Key is required' },
                  { pattern: /^[a-zA-Z][a-zA-Z0-9_]*$/, message: 'Letters, numbers and underscores only' },
                ]}
                extra="Stored on the product. Cannot change once products use it."
              >
                <Input placeholder="e.g. finish" disabled={Boolean(editingField)} />
              </Form.Item>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'select', label: 'Choose one from a list' },
                    { value: 'multiselect', label: 'Choose several' },
                    { value: 'text', label: 'Free text' },
                    { value: 'number', label: 'Number' },
                    { value: 'boolean', label: 'Yes / No' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="unit" label="Unit" extra="Shown after the value, e.g. mm, kg">
                <Input placeholder="optional" />
              </Form.Item>
            </div>
            <Form.Item name="options" label="Options" extra="Comma separated. Needed for the two list types.">
              <Input.TextArea rows={2} placeholder="Glossy, Matt, Rustic, Satin" />
            </Form.Item>
            <div className="grid grid-cols-2 gap-3">
              <Form.Item name="filterable" label="Show as website filter" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="required" label="Required on the product" valuePropName="checked">
                <Switch />
              </Form.Item>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={saveField}
              loading={savingField}
              style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
            >
              {editingField ? 'Save changes' : 'Add field'}
            </Button>
          </Form>
        </Card>
      </Drawer>
    </div>
  );
};

export default CategorySetup;
