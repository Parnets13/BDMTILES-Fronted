import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Input, Modal, Select, Space, Switch, Table, Tabs, Tag, message } from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import notificationService from '../../services/notificationService.js';
import userService from '../../services/userService.js';

const CHANNELS = ['web', 'email', 'whatsapp', 'sms', 'push'];
const ROLES = ['admin', 'sub_admin', 'sales_manager', 'purchase_manager', 'warehouse_manager', 'finance_manager', 'hr_manager', 'sales_executive', 'delivery_executive', 'picking_staff', 'sorting_staff', 'dealer'];
const emptyEvent = { eventCode: '', eventName: '', isEnabled: true, channels: ['web'], recipientRoles: [], recipientUserIds: [] };

const NotificationSettingsPage = () => {
  const [settings, setSettings] = useState([]);
  const [audit, setAudit] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(null);
  const [events, setEvents] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsResponse, auditResponse, usersResponse] = await Promise.all([
        notificationService.getSettings(),
        notificationService.getDeliveryAudit({ limit: 100 }),
        userService.getUsers({ limit: 100 }),
      ]);
      setSettings(settingsResponse.data || []);
      setAudit(auditResponse.data || []);
      setUsers(usersResponse.data || []);
    } catch (error) {
      message.error(error.message || 'Unable to load notification controls');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const initialize = async () => {
    try {
      const response = await notificationService.initializeSettings();
      message.success(response.message);
      load();
    } catch (error) {
      message.error(error.message || 'Unable to initialize modules');
    }
  };

  const openEditor = (record) => {
    setEditing(record);
    setEvents((record.events || []).map((event) => ({
      ...event,
      recipientUserIds: (event.recipients || []).map((recipient) => String(recipient.user || '')).filter(Boolean),
    })));
  };

  const save = async () => {
    try {
      const normalizedEvents = events.map(({ recipientUserIds, ...event }) => ({
        ...event,
        recipients: (recipientUserIds || []).map((userId) => ({
          user: userId,
          userName: users.find((user) => user._id === userId)?.name || '',
          channels: event.channels,
        })),
      }));
      await notificationService.updateModuleSettings(editing.module, {
        moduleName: editing.moduleName,
        isEnabled: editing.isEnabled,
        events: normalizedEvents,
      });
      message.success('Notification settings saved');
      setEditing(null);
      load();
    } catch (error) {
      message.error(error.message || 'Unable to save settings');
    }
  };

  const updateEvent = (index, patch) => setEvents((previous) => previous.map((event, itemIndex) => itemIndex === index ? { ...event, ...patch } : event));

  const settingsColumns = [
    { title: 'Module', dataIndex: 'moduleName', render: (value, record) => value || record.module.replace(/_/g, ' ') },
    { title: 'Key', dataIndex: 'module', render: (value) => <Tag>{value}</Tag> },
    { title: 'Enabled', dataIndex: 'isEnabled', render: (value) => <Tag color={value ? 'green' : 'default'}>{value ? 'Enabled' : 'Disabled'}</Tag> },
    { title: 'Events', dataIndex: 'events', render: (value) => value?.length || 0 },
    { title: '', render: (_, record) => <Button icon={<EditOutlined />} onClick={() => openEditor(record)}>Configure</Button> },
  ];

  const auditColumns = [
    { title: 'Created', dataIndex: 'createdAt', render: (value) => new Date(value).toLocaleString('en-IN') },
    { title: 'Recipient', dataIndex: 'recipient', render: (value, record) => value?.name || record.recipientRole || 'Unknown' },
    { title: 'Module / Event', render: (_, record) => `${record.module} / ${record.event}` },
    { title: 'Title', dataIndex: 'title' },
    { title: 'State', dataIndex: 'deliveryState', render: (value) => <Tag color={value === 'delivered' ? 'green' : value === 'failed' ? 'red' : 'orange'}>{value}</Tag> },
    { title: 'Channels', dataIndex: 'channelAttempts', render: (value = []) => <Space wrap>{value.map((attempt) => <Tag key={attempt.channel} color={attempt.status === 'delivered' ? 'green' : 'default'}>{attempt.channel}: {attempt.status}</Tag>)}</Space> },
  ];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-gray-800">Notification Controls</h1><p className="mt-0.5 text-sm text-gray-500">Owner-only event recipients, channels, and delivery audit</p></div>
        <Space><Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button><Button type="primary" onClick={initialize}>Initialize Modules</Button></Space>
      </div>
      <Tabs items={[
        { key: 'settings', label: 'Module Settings', children: <Table loading={loading} rowKey="_id" dataSource={settings} columns={settingsColumns} pagination={false} /> },
        { key: 'audit', label: 'Delivery Audit', children: <Table loading={loading} rowKey="_id" dataSource={audit} columns={auditColumns} scroll={{ x: 1000 }} pagination={{ pageSize: 25 }} /> },
      ]} />

      <Modal title={`Configure ${editing?.moduleName || editing?.module || ''}`} open={Boolean(editing)} onCancel={() => setEditing(null)} onOk={save} width={900} okText="Save Settings" destroyOnHidden>
        {editing && <div className="space-y-4">
          <Card size="small">
            <div className="flex items-center justify-between"><span>Enable this module</span><Switch checked={editing.isEnabled} onChange={(isEnabled) => setEditing((previous) => ({ ...previous, isEnabled }))} /></div>
          </Card>
          {events.map((event, index) => (
            <Card key={`${event.eventCode}-${index}`} size="small" title={`Event ${index + 1}`} extra={<Button danger type="text" onClick={() => setEvents((previous) => previous.filter((_, itemIndex) => itemIndex !== index))}>Remove</Button>}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <Input placeholder="Event code" value={event.eventCode} onChange={(e) => updateEvent(index, { eventCode: e.target.value })} />
                <Input placeholder="Event name" value={event.eventName} onChange={(e) => updateEvent(index, { eventName: e.target.value })} />
                <Select mode="multiple" placeholder="Channels" value={event.channels} options={CHANNELS.map((channel) => ({ value: channel, label: channel }))} onChange={(channels) => updateEvent(index, { channels })} />
                <Select mode="multiple" placeholder="Recipient roles" value={event.recipientRoles} options={ROLES.map((role) => ({ value: role, label: role.replace(/_/g, ' ') }))} onChange={(recipientRoles) => updateEvent(index, { recipientRoles })} />
                <Select className="md:col-span-2" mode="multiple" showSearch optionFilterProp="label" placeholder="Explicit recipient users" value={event.recipientUserIds} options={users.map((user) => ({ value: user._id, label: `${user.name} (${user.role})` }))} onChange={(recipientUserIds) => updateEvent(index, { recipientUserIds })} />
                <div className="flex items-center gap-2"><Switch checked={event.isEnabled} onChange={(isEnabled) => updateEvent(index, { isEnabled })} /><span>Event enabled</span></div>
              </div>
            </Card>
          ))}
          <Button block type="dashed" icon={<PlusOutlined />} onClick={() => setEvents((previous) => [...previous, { ...emptyEvent }])}>Add Event</Button>
        </div>}
      </Modal>
    </div>
  );
};

export default NotificationSettingsPage;
