import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Modal, Form, Tag, Space, message, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';

/**
 * Reusable simple master page (name + description + status)
 * Props: title, subtitle, service (object with get, create, update, delete methods)
 */
const SimpleMaster = ({ title, subtitle, service }) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 50, total: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [form] = Form.useForm();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await service.get({ page: pagination.current, limit: pagination.pageSize, search });
      if (res.success) {
        setItems(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openModal = (item = null) => {
    setEditingItem(item);
    form.setFieldsValue(item || { name: '', description: '' });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = editingItem
        ? await service.update(editingItem._id, values)
        : await service.create(values);
      if (res.success) {
        message.success(res.message);
        setModalOpen(false);
        form.resetFields();
        setEditingItem(null);
        fetchData();
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await service.delete(id);
      if (res.success) { message.success(res.message); fetchData(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    {
      title: 'Name', key: 'name', render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{r.name}</div>
          {r.description && <div className="text-xs text-gray-400">{r.description}</div>}
        </div>
      ),
    },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: (s) => <Tag color={s === 'active' ? 'green' : 'red'}>{s}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 120, render: (_, r) => (
        <Space>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          <Popconfirm title={`Delete "${r.name}"?`} onConfirm={() => handleDelete(r._id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} size="large">Add {title}</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <Input placeholder={`Search ${title.toLowerCase()}...`} prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
            className="w-64" allowClear />
          <Button icon={<ReloadOutlined />} onClick={fetchData}>Refresh</Button>
        </div>
        <Table columns={columns} dataSource={items} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showTotal: t => `${t} items` }}
          onChange={pag => setPagination(p => ({...p, current: pag.current}))} />
      </div>

      <Modal title={editingItem ? `Edit ${title}` : `Add ${title}`} open={modalOpen}
        onOk={handleSave} onCancel={() => { setModalOpen(false); form.resetFields(); setEditingItem(null); }}
        okText={editingItem ? 'Update' : 'Create'} confirmLoading={loading} destroyOnHidden>
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder={`Enter ${title.toLowerCase()} name`} />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Optional description" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SimpleMaster;
