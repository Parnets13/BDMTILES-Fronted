import { useCallback, useEffect, useState } from 'react';
import { Form, Input, Button, message, Card, Divider } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import WebImageUpload from './WebImageUpload.jsx';
import webManagementService from '../../services/webManagementService.js';

/**
 * Site header settings — the storefront top header: logo, brand name/tagline,
 * and the phone number shown to customers. Single global record.
 */
const SiteSettingsPage = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Named rather than inline in the effect, so the Refresh button can call the same
  // load. The old `active` flag existed to avoid a state update after unmount; React 18
  // no longer warns about that, and keeping it would have meant two copies of the fetch.
  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await webManagementService.getSiteSettings();
      if (res.success) form.setFieldsValue(res.data);
    } catch (err) {
      message.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const res = await webManagementService.updateSiteSettings(values);
      if (res.success) { message.success(res.message); form.setFieldsValue(res.data); }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Site Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Header logo, brand text and contact number shown on the website</p>
        </div>
        <div className="flex gap-2">
          <Button icon={<ReloadOutlined />} onClick={loadSettings} loading={loading}>Refresh</Button>
          <Button type="primary" icon={<SaveOutlined />} size="large" loading={saving} onClick={handleSave}>Save Changes</Button>
        </div>
      </div>

      <Card loading={loading} className="max-w-2xl">
        <Form form={form} layout="vertical">
          <Divider orientation="left" className="!text-sm">Logo</Divider>
          <Form.Item name="logo" label="Header Logo">
            <WebImageUpload />
          </Form.Item>

          <Divider orientation="left" className="!text-sm">Brand Text</Divider>
          <Form.Item name="brandName" label="Brand Name" rules={[{ required: true, message: 'Brand name is required' }]}>
            <Input placeholder="e.g. BDM TILES" />
          </Form.Item>
          <Form.Item name="brandTagline" label="Tagline">
            <Input placeholder="e.g. BISHNOI CERAMICS" />
          </Form.Item>

          <Divider orientation="left" className="!text-sm">Contact</Divider>
          <Form.Item name="phoneLabel" label="Phone Label">
            <Input placeholder="e.g. Call us" />
          </Form.Item>
          <Form.Item name="phoneNumber" label="Phone Number">
            <Input placeholder="e.g. +91 98765 43210" />
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default SiteSettingsPage;
