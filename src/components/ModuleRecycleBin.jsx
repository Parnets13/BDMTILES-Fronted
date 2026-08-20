import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Tag, Space, message, Modal, Drawer, Badge } from 'antd';
import { UndoOutlined, DeleteOutlined, ExclamationCircleOutlined, RestOutlined } from '@ant-design/icons';
import api from '../config/api.js';
import { useConfirm } from './ConfirmModal.jsx';

/**
 * ModuleRecycleBin — shows deleted items for a specific module.
 * Embed inside any page as a Drawer triggered by a button.
 *
 * Usage:
 *   <ModuleRecycleBin module="product" title="Deleted Products" />
 *   <ModuleRecycleBin module="sales_order" title="Deleted Sales Orders" />
 *   <ModuleRecycleBin module="dealer" title="Deleted Dealers" />
 *
 * Props:
 *   module: string — module name matching RecycleBin.module field
 *   title: string — display title for the drawer
 *   columns: array (optional) — extra columns to show from the stored data snapshot
 */
const ModuleRecycleBin = ({ module, title, columns: extraColumns, onRestore }) => {
  const { confirm, alertModal } = useConfirm();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);

  const fetchItems = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const res = await api.get('/system/recycle-bin', { params: { module, limit: 50 } });
      if (res.success) {
        setItems(res.data || []);
        setCount(res.pagination?.totalItems || res.data?.length || 0);
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [open, module]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // Also load count on mount for badge
  useEffect(() => {
    api.get('/system/recycle-bin', { params: { module, limit: 1 } })
      .then(r => { if (r.success) setCount(r.pagination?.totalItems || 0); })
      .catch(() => {});
  }, [module]);

  const handleRestore = async (id, recordTitle) => {
    const proceed = await confirm(`Restore "${recordTitle}"?`, { content: 'This item will be restored back to its original location.', okText: 'Restore', type: 'info' });
    if (!proceed) return;
    try {
      const res = await api.post(`/system/recycle-bin/${id}/restore`);
      if (res.success) { message.success(res.message || 'Restored successfully!'); fetchItems(); onRestore?.(); }
      else { alertModal('Restore Failed', res.message, 'error'); }
    } catch (err) { alertModal('Restore Failed', err.message, 'error'); }
  };

  const handlePermanentDelete = async (id, recordTitle) => {
    const proceed = await confirm(`Permanently delete "${recordTitle}"?`, { content: 'This cannot be undone. The record will be lost forever.', okText: 'Permanently Delete', type: 'danger' });
    if (!proceed) return;
    try {
      const res = await api.delete(`/system/recycle-bin/${id}`);
      if (res.success) { message.success('Permanently deleted'); fetchItems(); }
    } catch (err) { alertModal('Error', err.message, 'error'); }
  };

  const defaultColumns = [
    { title: 'Record', key: 'record', width: 200,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium">{r.recordTitle || r.recordCode || '—'}</div>
          <div className="text-[10px] text-gray-400">{r.originalModel}</div>
        </div>
      )},
    { title: 'Deleted By', dataIndex: 'deletedByName', width: 130,
      render: v => <span className="text-sm">{v || '—'}</span> },
    { title: 'Deleted On', dataIndex: 'deletedAt', width: 150,
      render: v => (
        <div>
          <div className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</div>
          <div className="text-[10px] text-gray-400">{new Date(v).toLocaleTimeString('en-IN')}</div>
        </div>
      )},
    { title: 'Reason', dataIndex: 'deleteReason', width: 160,
      render: v => <span className="text-xs text-gray-500">{v || '—'}</span> },
    { title: 'Auto-Delete', key: 'ttl', width: 100,
      render: (_, r) => {
        const days = Math.max(0, 30 - Math.floor((Date.now() - new Date(r.deletedAt)) / (1000 * 60 * 60 * 24)));
        return <Tag color={days <= 5 ? 'red' : days <= 15 ? 'orange' : 'default'}>{days} days</Tag>;
      }},
    { title: 'Actions', width: 150,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" type="primary" ghost icon={<UndoOutlined />}
            onClick={() => handleRestore(r._id, r.recordTitle || r.recordCode)}>
            Restore
          </Button>
          <Button size="small" danger icon={<DeleteOutlined />}
            onClick={() => handlePermanentDelete(r._id, r.recordTitle || r.recordCode)} />
        </Space>
      )},
  ];

  // If extra columns provided, add them after Record column
  const finalColumns = extraColumns
    ? [defaultColumns[0], ...extraColumns, ...defaultColumns.slice(1)]
    : defaultColumns;

  return (
    <>
      {/* Trigger Button */}
      <Badge count={count} size="small" offset={[-5, 5]}>
        <Button icon={<RestOutlined />} onClick={() => setOpen(true)} type="default">
          Recycle Bin
        </Button>
      </Badge>

      {/* Drawer */}
      <Drawer
        title={
          <div className="flex items-center gap-2">
            <RestOutlined className="text-red-500" />
            <span>{title || `Deleted Items (${module})`}</span>
            <Tag color="red">{count} items</Tag>
          </div>
        }
        open={open}
        onClose={() => setOpen(false)}
        width={780}
        footer={
          <div className="text-xs text-gray-400">
            Items auto-delete permanently after 30 days. Restore to recover.
          </div>
        }
      >
        {items.length === 0 && !loading ? (
          <div className="text-center py-16 text-gray-400">
            <RestOutlined className="text-4xl mb-3 opacity-30" />
            <p className="text-sm">No deleted items in this module</p>
          </div>
        ) : (
          <Table
            columns={finalColumns}
            dataSource={items}
            rowKey="_id"
            loading={loading}
            size="small"
            scroll={{ x: 750 }}
            pagination={{ pageSize: 10, showTotal: t => `${t} deleted items` }}
          />
        )}
      </Drawer>
    </>
  );
};

export default ModuleRecycleBin;
