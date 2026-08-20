import { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const CHANNEL_COLORS = { whatsapp: 'green', sms: 'blue', email: 'purple', push: 'orange' };
const EVENTS = ['order_confirmation','invoice_generated','payment_received','payment_reminder','dispatch_notification','delivery_notification','delivery_otp','scheme_alert','credit_alert','overdue_reminder','quotation_sent','complaint_update','birthday_wish','custom'];

const NotificationTemplatePage = () => {
  const [templates, setTemplates] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [editRecord, setEditRecord] = useState(null);

  const fetchTemplates = () => { api.get('/notifications/templates').then(r => { if (r.success) setTemplates(r.data || []); }).catch(() => {}); };
  useEffect(() => { fetchTemplates(); }, []);

  const handleDelete = async (id) => {
    try { await api.delete(`/notifications/templates/${id}`); message.success('Deleted.'); fetchTemplates(); }
    catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'templateCode', width: 130, render: v => <span className="text-xs font-mono">{v}</span> },
    { title: 'Name', dataIndex: 'templateName', width: 180 },
    { title: 'Channel', dataIndex: 'channel', width: 90, render: v => <Tag color={CHANNEL_COLORS[v]}>{v}</Tag> },
    { title: 'Event', dataIndex: 'event', width: 150, render: v => <span className="text-xs">{v?.replace(/_/g, ' ')}</span> },
    { title: 'Body Preview', dataIndex: 'body', render: v => <span className="text-xs text-gray-500 truncate block max-w-[250px]">{v}</span> },
    { title: 'Active', dataIndex: 'isActive', width: 60, render: v => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
    { title: '', width: 80, render: (_, r) => (
      <Space size="small">
        <Button type="text" size="small" icon={<EditOutlined />} onClick={() => { setEditRecord(r); setShowCreate(true); }} />
        <Button type="text" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r._id)} />
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Notification Templates</h1><p className="text-sm text-gray-500 mt-0.5">WhatsApp, SMS, Email, Push notification templates for automated messaging</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => { setEditRecord(null); setShowCreate(true); }}>New Template</Button>
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={templates} rowKey="_id" size="middle" pagination={false} />
      </div>
      <Modal title={editRecord ? 'Edit Template' : 'New Template'} open={showCreate} onCancel={() => { setShowCreate(false); setEditRecord(null); }} footer={null} width={700} destroyOnHidden>
        <TemplateForm editRecord={editRecord} onSuccess={() => { setShowCreate(false); setEditRecord(null); fetchTemplates(); }} onCancel={() => { setShowCreate(false); setEditRecord(null); }} />
      </Modal>
    </div>
  );
};

const TemplateForm = ({ editRecord, onSuccess, onCancel }) => {
  const [form, setForm] = useState({ templateCode: '', templateName: '', channel: 'whatsapp', event: 'order_confirmation', subject: '', body: '', variables: '', isActive: true });

  useEffect(() => {
    if (editRecord) setForm({ templateCode: editRecord.templateCode || '', templateName: editRecord.templateName || '', channel: editRecord.channel || 'whatsapp', event: editRecord.event || 'order_confirmation', subject: editRecord.subject || '', body: editRecord.body || '', variables: (editRecord.variables || []).join(', '), isActive: editRecord.isActive ?? true });
    else setForm({ templateCode: '', templateName: '', channel: 'whatsapp', event: 'order_confirmation', subject: '', body: '', variables: '', isActive: true });
  }, [editRecord]);

  const handleSubmit = async () => {
    if (!form.templateCode || !form.templateName || !form.body) { message.error('Fill required fields'); return; }
    const payload = { ...form, variables: form.variables ? form.variables.split(',').map(v => v.trim()) : [] };
    try {
      const res = editRecord ? await api.put(`/notifications/templates/${editRecord._id}`, payload) : await api.post('/notifications/templates', payload);
      if (res.success) { message.success(editRecord ? 'Updated.' : 'Created.'); onSuccess(); }
    } catch (err) { message.error(err.message); }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Template Code *</label><Input value={form.templateCode} onChange={e => setForm(f => ({ ...f, templateCode: e.target.value }))} placeholder="e.g. ORDER_CONFIRM_WA" /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Template Name *</label><Input value={form.templateName} onChange={e => setForm(f => ({ ...f, templateName: e.target.value }))} placeholder="Order Confirmation WhatsApp" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Channel</label><Select value={form.channel} onChange={v => setForm(f => ({ ...f, channel: v }))} className="w-full" options={Object.keys(CHANNEL_COLORS).map(c => ({ value: c, label: c }))} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Event</label><Select value={form.event} onChange={v => setForm(f => ({ ...f, event: v }))} className="w-full" options={EVENTS.map(e => ({ value: e, label: e.replace(/_/g, ' ') }))} /></div>
      </div>
      <div><label className="text-xs text-gray-500 block mb-1">Subject (for email)</label><Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Optional" /></div>
      <div><label className="text-xs text-gray-500 block mb-1">Message Body * (use {'{{variableName}}'} for dynamic content)</label><Input.TextArea rows={4} value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} placeholder="Dear {{dealerName}}, your order {{orderNumber}} of ₹{{amount}} is confirmed..." /></div>
      <div><label className="text-xs text-gray-500 block mb-1">Variables (comma separated)</label><Input value={form.variables} onChange={e => setForm(f => ({ ...f, variables: e.target.value }))} placeholder="dealerName, orderNumber, amount, invoiceNumber" /></div>
      <div className="flex justify-end gap-2 pt-3 border-t"><Button onClick={onCancel}>Cancel</Button><Button type="primary" onClick={handleSubmit}>{editRecord ? 'Update' : 'Create'}</Button></div>
    </div>
  );
};

export default NotificationTemplatePage;
