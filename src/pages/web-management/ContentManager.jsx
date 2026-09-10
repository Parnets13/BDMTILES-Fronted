import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Modal, Form, Input, InputNumber, Select, Switch, Slider, Tag, Space, message, Popconfirm, Tooltip, Image } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import WebImageUpload from './WebImageUpload.jsx';
import { resolveUploadUrl } from '../../config/api.js';

// Curated Font Awesome icons offered for storefront content (top-bar strip, etc.).
// The CRM loads the same Font Awesome CDN as the website, so these preview
// exactly as they render on the storefront.
export const ICON_OPTIONS = [
  { value: 'fa-hand-holding-dollar', label: 'Pay on Delivery' },
  { value: 'fa-truck-fast', label: 'Fast Delivery' },
  { value: 'fa-truck', label: 'Delivery Truck' },
  { value: 'fa-percent', label: 'Discount / Cashback' },
  { value: 'fa-shield-halved', label: 'Genuine / Secure' },
  { value: 'fa-cubes', label: 'Bulk / No Minimum' },
  { value: 'fa-circle-check', label: 'Check / Verified' },
  { value: 'fa-tags', label: 'Best Price' },
  { value: 'fa-star', label: 'Top Rated' },
  { value: 'fa-headset', label: 'Support' },
  { value: 'fa-rotate-left', label: 'Easy Returns' },
  { value: 'fa-award', label: 'Quality Assured' },
  { value: 'fa-bolt', label: 'Express' },
  { value: 'fa-gift', label: 'Offer / Gift' },
  { value: 'fa-indian-rupee-sign', label: 'Wholesale Price' },
  { value: 'fa-location-dot', label: 'Location' },
  { value: 'fa-phone', label: 'Call' },
  { value: 'fa-store', label: 'Store' },
  { value: 'fa-boxes-stacked', label: 'Stock / Inventory' },
  { value: 'fa-clock', label: 'Time / Slot' },
  { value: 'fa-fire', label: 'Hot Deal' },
  { value: 'fa-heart', label: 'Favourite' },
  { value: 'fa-wallet', label: 'Wallet / Cash' },
  { value: 'fa-medal', label: 'Trusted' },
  { value: 'fa-hammer', label: 'Tools / Hardware' },
  { value: 'fa-trowel-bricks', label: 'Civil / Construction' },
  { value: 'fa-leaf', label: 'Eco Friendly' },
  { value: 'fa-thumbs-up', label: 'Recommended' },
];

// Default background swatches for banner cards.
export const COLOR_PRESETS = [
  '#FFF7ED', '#FEF2F2', '#EFF6FF', '#ECFDF5', '#F5F3FF',
  '#FDF4FF', '#FEFCE8', '#F0FDFA', '#F8FAFC', '#FFFFFF',
];

/**
 * Controlled hex-color field: preset swatches + a native color picker + text input.
 * Stores a plain hex string (e.g. "#FFF7ED") so it serializes cleanly to the API.
 */
const ColorField = ({ value, onChange, presets = COLOR_PRESETS }) => (
  <div>
    <div className="flex flex-wrap gap-1.5 mb-2">
      {presets.map((c) => (
        <button
          type="button"
          key={c}
          onClick={() => onChange?.(c)}
          title={c}
          className={`w-6 h-6 rounded-full border ${value === c ? 'ring-2 ring-orange-500 border-orange-500' : 'border-gray-300'}`}
          style={{ background: c }}
        />
      ))}
    </div>
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || '#ffffff'}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-9 h-9 p-0 border border-gray-200 rounded cursor-pointer"
      />
      <Input
        placeholder="#FFF7ED"
        value={value || ''}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-40"
        allowClear
      />
    </div>
  </div>
);

/** Re-renders a preview whenever any form field changes. `render(values)` returns JSX. */
const LivePreview = ({ form, render }) => {
  const values = Form.useWatch([], form) || {};
  return <div>{render(values, { resolveUploadUrl })}</div>;
};

/**
 * Reusable Web Management CRUD page.
 *
 * Props:
 *  - title, subtitle
 *  - service: { get, create, update, delete }
 *  - fields:  [{ name, label, type: 'text'|'textarea'|'image'|'number'|'status'|'color'|'opacity'|'icon'|'boolean', required?, placeholder?, help?, presets? }]
 *  - columns: antd column defs for the table (optional; a sensible default is built from fields)
 *  - preview: (values, helpers) => JSX  — optional live preview panel beside the form
 */
const ContentManager = ({ title, subtitle, service, fields, columns, preview, cardRender, cardSpan }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.get();
      if (res.success) setItems(res.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (item = null) => {
    setEditing(item);
    const defaults = { status: 'active', sortOrder: 0, bgOpacity: 1, size: 'small', overlayStyle: 'gradient', gradientDirection: 'to right', ctaLabel: 'Shop Now' };
    form.setFieldsValue(item || defaults);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = editing ? await service.update(editing._id, values) : await service.create(values);
      if (res.success) {
        message.success(res.message);
        closeModal();
        fetchData();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await service.delete(id);
      if (res.success) { message.success(res.message); fetchData(); }
    } catch (err) {
      message.error(err.message);
    }
  };

  const actionColumn = {
    title: 'Actions', key: 'actions', width: 110, render: (_, r) => (
      <Space>
        <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
        <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(r._id)}>
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      </Space>
    ),
  };

  const tableColumns = [...(columns || []), actionColumn];

  const renderField = (f) => {
    switch (f.type) {
      case 'textarea':
        return <Input.TextArea rows={3} placeholder={f.placeholder} />;
      case 'image':
        return <WebImageUpload />;
      case 'number':
        return <InputNumber className="w-full" min={0} />;
      case 'boolean':
        return <Switch />;
      case 'color':
        return <ColorField presets={f.presets} />;
      case 'opacity':
        return <Slider min={0} max={1} step={0.05} marks={{ 0: '0', 0.5: '50%', 1: '100%' }} />;
      case 'icon':
        return (
          <Select
            showSearch
            optionFilterProp="title"
            placeholder="Select an icon"
            optionLabelProp="label"
            popupMatchSelectWidth={false}
          >
            {ICON_OPTIONS.map((o) => {
              const content = (
                <span className="flex items-center gap-2">
                  <i className={`fa-solid ${o.value} text-orange-500 w-4 text-center`} />
                  <span>{o.label}</span>
                </span>
              );
              return (
                <Select.Option key={o.value} value={o.value} title={o.label} label={content}>
                  {content}
                </Select.Option>
              );
            })}
          </Select>
        );
      case 'select':
        return <Select options={f.options || []} placeholder={f.placeholder} />;
      case 'status':
        return (
          <Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        );
      default:
        return <Input placeholder={f.placeholder} />;
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => openModal()}>Add</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm text-gray-500">{items.length} item(s)</span>
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
        </div>

        {cardRender ? (
          // Card/gallery view: each saved item rendered as its real website layout.
          <div className="p-4">
            {items.length === 0 && !loading && (
              <div className="text-center text-gray-400 text-sm py-10">No items yet. Click “Add” to create one.</div>
            )}
            <div className="grid grid-cols-1 gap-5">
              {items.map((item) => (
                <div key={item._id} className={`group relative ${cardSpan ? cardSpan(item) : ''}`}>
                  {item.status === 'inactive' && (
                    <span className="absolute top-2 left-2 z-20 bg-gray-800/80 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                  {/* live card exactly like the storefront */}
                  {cardRender(item, { resolveUploadUrl })}
                  {/* hover actions */}
                  <div className="absolute top-2 right-2 z-20 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button size="small" icon={<EditOutlined />} onClick={() => openModal(item)} />
                    <Popconfirm title="Delete this item?" onConfirm={() => handleDelete(item._id)}>
                      <Button size="small" danger icon={<DeleteOutlined />} />
                    </Popconfirm>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Table columns={tableColumns} dataSource={items} rowKey="_id" loading={loading} size="middle"
            pagination={{ showTotal: (t) => `${t} items` }} scroll={{ x: 700 }} />
        )}
      </div>

      <Modal title={editing ? `Edit — ${title}` : `Add — ${title}`} open={modalOpen}
        onOk={handleSave} onCancel={closeModal} okText={editing ? 'Update' : 'Create'}
        confirmLoading={loading} destroyOnHidden width={preview ? 860 : 620}>
        <div className={preview ? 'flex gap-6 mt-4' : 'mt-4'}>
          <Form form={form} layout="vertical" className={preview ? 'flex-1 min-w-0' : ''}>
            {fields.map((f) => (
              <Form.Item
                key={f.name}
                name={f.name}
                label={f.label}
                extra={f.help}
                valuePropName={f.type === 'boolean' ? 'checked' : 'value'}
                rules={f.required ? [{ required: true, message: `${f.label} is required` }] : undefined}
              >
                {renderField(f)}
              </Form.Item>
            ))}
          </Form>
          {preview && (
            <div className="w-72 shrink-0">
              <div className="sticky top-0">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Live Preview</p>
                <LivePreview form={form} render={preview} open={modalOpen} />
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

// Shared column helpers reused by the pages.
export const imageColumn = (dataIndex = 'image', title = 'Image') => ({
  title, dataIndex, width: 90,
  render: (v) => (v ? <Image src={resolveUploadUrl(v)} width={56} height={40} className="rounded object-cover" /> : <span className="text-gray-300">—</span>),
});

export const statusColumn = {
  title: 'Status', dataIndex: 'status', width: 90,
  render: (s) => <Tag color={s === 'active' ? 'green' : 'red'}>{s}</Tag>,
};

export const orderColumn = { title: 'Order', dataIndex: 'sortOrder', width: 70 };

export const colorColumn = (dataIndex = 'bgColor', title = 'Color') => ({
  title, dataIndex, width: 80,
  render: (v) => (v
    ? <span className="inline-flex items-center gap-1.5"><span className="w-4 h-4 rounded border border-gray-300" style={{ background: v }} /><span className="text-xs text-gray-500">{v}</span></span>
    : <span className="text-gray-300">—</span>),
});

export default ContentManager;
