import { useState, useEffect } from 'react';
import { Form, InputNumber, Button, Card, Row, Col, TimePicker, Select, Switch, message, Spin } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const parseTime = value => value ? dayjs(`2000-01-01T${value}:00`) : null;

const HRMSSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await hrmsService.getSettings();
      const data = res.data || {};
      form.setFieldsValue({
        defaultShiftStart: parseTime(data.defaultShiftStart ?? '09:00'),
        defaultShiftEnd: parseTime(data.defaultShiftEnd ?? '18:00'),
        lunchBreakMinutes: data.lunchBreakMinutes ?? 60,
        graceMinutes: data.graceMinutes ?? 15,
        lateMarkAfterMinutes: data.lateMarkAfterMinutes ?? 15,
        halfDayAfterMinutes: data.halfDayAfterMinutes ?? 120,
        lateMarksForHalfDay: data.lateMarksForHalfDay ?? 3,
        overtimeAfterHours: data.overtimeAfterHours ?? 9,
        overtimeRateMultiplier: data.overtimeRateMultiplier ?? 1.5,
        overtimeEnabled: data.overtimeEnabled ?? true,
        weeklyOffs: data.weeklyOffs ?? ['Sunday'],
        casualLeavePerYear: data.casualLeavePerYear ?? 12,
        sickLeavePerYear: data.sickLeavePerYear ?? 6,
        earnedLeavePerYear: data.earnedLeavePerYear ?? 15,
        pfPercentage: data.pfPercentage ?? 12,
        esiPercentage: data.esiPercentage ?? 0.75,
        esiThreshold: data.esiThreshold ?? 21000,
      });
    } catch (err) { message.error(err.message || 'Failed to load settings'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSettings(); }, []);

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const payload = {
        ...values,
        defaultShiftStart: values.defaultShiftStart.format('HH:mm'),
        defaultShiftEnd: values.defaultShiftEnd.format('HH:mm'),
      };
      const res = await hrmsService.updateSettings(payload);
      if (res.success) message.success('Settings saved successfully');
    } catch (err) {
      if (!err.errorFields) message.error(err.message || 'Failed to save settings');
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">HRMS Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure persisted shift, leave, overtime and statutory settings</p>
        </div>
        <div className="flex gap-3">
          <Button icon={<ReloadOutlined />} onClick={fetchSettings}>Reset</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Save Settings
          </Button>
        </div>
      </div>

      <Form form={form} layout="vertical">
        <Card className="mb-4" title={<span className="text-base font-semibold">Shift Timing</span>}>
          <Row gutter={16}>
            <Col span={6}><Form.Item name="defaultShiftStart" label="Default Shift Start" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" className="w-full" /></Form.Item></Col>
            <Col span={6}><Form.Item name="defaultShiftEnd" label="Default Shift End" rules={[{ required: true }]}>
              <TimePicker format="HH:mm" className="w-full" /></Form.Item></Col>
            <Col span={6}><Form.Item name="lunchBreakMinutes" label="Lunch Break (minutes)" rules={[{ required: true }]}>
              <InputNumber min={0} max={240} className="w-full" /></Form.Item></Col>
            <Col span={6}><Form.Item name="graceMinutes" label="Grace Period (minutes)" rules={[{ required: true }]}>
              <InputNumber min={0} max={120} className="w-full" /></Form.Item></Col>
          </Row>
        </Card>

        <Card className="mb-4" title={<span className="text-base font-semibold">Late Mark Rules</span>}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="lateMarkAfterMinutes" label="Late Mark After (minutes)" rules={[{ required: true }]}>
              <InputNumber min={0} max={240} className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="halfDayAfterMinutes" label="Half Day After (minutes late)" rules={[{ required: true }]}>
              <InputNumber min={0} max={480} className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="lateMarksForHalfDay" label="Late Marks for Half Day" rules={[{ required: true }]}>
              <InputNumber min={0} max={31} precision={0} className="w-full" /></Form.Item></Col>
          </Row>
        </Card>

        <Card className="mb-4" title={<span className="text-base font-semibold">Overtime Rules</span>}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="overtimeAfterHours" label="Daily OT Threshold (hours)" rules={[{ required: true }]}>
              <InputNumber min={0} max={24} step={0.5} className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="overtimeRateMultiplier" label="OT Rate Multiplier" rules={[{ required: true }]}>
              <InputNumber min={0} max={5} step={0.25} className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="overtimeEnabled" label="Enable Overtime" valuePropName="checked">
              <Switch /></Form.Item></Col>
          </Row>
        </Card>

        <Card className="mb-4" title={<span className="text-base font-semibold">Weekly Offs</span>}>
          <Row gutter={16}><Col span={12}><Form.Item name="weeklyOffs" label="Weekly Off Days">
            <Select mode="multiple" options={WEEK_DAYS.map(day => ({ value: day, label: day }))} />
          </Form.Item></Col></Row>
        </Card>

        <Card className="mb-4" title={<span className="text-base font-semibold">Leave Allocation (Per Year)</span>}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="casualLeavePerYear" label="Casual Leave" rules={[{ required: true }]}>
              <InputNumber min={0} max={365} className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="sickLeavePerYear" label="Sick Leave" rules={[{ required: true }]}>
              <InputNumber min={0} max={365} className="w-full" /></Form.Item></Col>
            <Col span={8}><Form.Item name="earnedLeavePerYear" label="Earned Leave" rules={[{ required: true }]}>
              <InputNumber min={0} max={365} className="w-full" /></Form.Item></Col>
          </Row>
        </Card>

        <Card className="mb-4" title={<span className="text-base font-semibold">PF & ESI Configuration</span>}>
          <Row gutter={16}>
            <Col span={8}><Form.Item name="pfPercentage" label="PF Percentage" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.5} className="w-full" addonAfter="%" /></Form.Item></Col>
            <Col span={8}><Form.Item name="esiPercentage" label="ESI Percentage" rules={[{ required: true }]}>
              <InputNumber min={0} max={100} step={0.25} className="w-full" addonAfter="%" /></Form.Item></Col>
            <Col span={8}><Form.Item name="esiThreshold" label="ESI Threshold Salary (₹)" rules={[{ required: true }]}>
              <InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
          </Row>
        </Card>

        <div className="flex justify-end pb-6">
          <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSave} loading={saving}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }} className="px-8">Save All Settings</Button>
        </div>
      </Form>
    </div>
  );
};

export default HRMSSettings;
