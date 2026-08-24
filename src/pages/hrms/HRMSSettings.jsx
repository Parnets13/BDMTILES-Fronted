import { useState, useEffect } from 'react';
import { Form, Input, InputNumber, Button, Card, Row, Col, Divider, TimePicker, Select, Switch, message, Spin } from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const HRMSSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await hrmsService.getSettings();
      const data = res.data || {};
      form.setFieldsValue({
        ...data,
        shiftStart: data.shiftStart ? dayjs(data.shiftStart, 'HH:mm') : null,
        shiftEnd: data.shiftEnd ? dayjs(data.shiftEnd, 'HH:mm') : null,
        lunchStart: data.lunchStart ? dayjs(data.lunchStart, 'HH:mm') : null,
        lunchEnd: data.lunchEnd ? dayjs(data.lunchEnd, 'HH:mm') : null,
        graceTime: data.graceTime || 15,
        lateMarkAfter: data.lateMarkAfter || 15,
        halfDayAfter: data.halfDayAfter || 120,
        overtimeAfter: data.overtimeAfter || 30,
        overtimeRate: data.overtimeRate || 1.5,
        weekOffs: data.weekOffs || ['Sunday'],
        casualLeave: data.casualLeave || 12,
        sickLeave: data.sickLeave || 6,
        earnedLeave: data.earnedLeave || 15,
        pfPercentEmployee: data.pfPercentEmployee || 12,
        pfPercentEmployer: data.pfPercentEmployer || 12,
        esiPercentEmployee: data.esiPercentEmployee || 0.75,
        esiPercentEmployer: data.esiPercentEmployer || 3.25,
        esiThreshold: data.esiThreshold || 21000,
      });
    } catch (err) { message.error('Failed to load settings'); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const values = await form.validateFields();
      const payload = {
        ...values,
        shiftStart: values.shiftStart ? values.shiftStart.format('HH:mm') : null,
        shiftEnd: values.shiftEnd ? values.shiftEnd.format('HH:mm') : null,
        lunchStart: values.lunchStart ? values.lunchStart.format('HH:mm') : null,
        lunchEnd: values.lunchEnd ? values.lunchEnd.format('HH:mm') : null,
      };
      const res = await hrmsService.updateSettings(payload);
      if (res.success) {
        message.success('Settings saved successfully');
      } else {
        message.error(res.message || 'Failed to save');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed');
    } finally { setSaving(false); }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64"><Spin size="large" /></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">HRMS Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Configure shift timings, leave rules & payroll settings</p>
        </div>
        <div className="flex gap-3">
          <Button icon={<ReloadOutlined />} onClick={fetchSettings}>Reset</Button>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Save Settings
          </Button>
        </div>
      </div>

      <Form form={form} layout="vertical">
        {/* Shift Timing */}
        <Card className="mb-4" title={<span className="text-base font-semibold flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Shift Timing</span>}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="shiftStart" label="Shift Start">
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="shiftEnd" label="Shift End">
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="lunchStart" label="Lunch Start">
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="lunchEnd" label="Lunch End">
                <TimePicker format="HH:mm" className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="graceTime" label="Grace Period (minutes)">
                <InputNumber min={0} max={60} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="workingHours" label="Working Hours/Day">
                <InputNumber min={1} max={24} step={0.5} className="w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Late Mark Rules */}
        <Card className="mb-4" title={<span className="text-base font-semibold flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Late Mark Rules</span>}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="lateMarkAfter" label="Late Mark After (minutes)">
                <InputNumber min={0} max={120} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="halfDayAfter" label="Half Day After (minutes late)">
                <InputNumber min={0} max={480} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="lateMarksAllowed" label="Late Marks Allowed/Month">
                <InputNumber min={0} max={30} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="lateDeductionPerDay" label="Late Deduction (₹/day)">
                <InputNumber min={0} className="w-full" prefix="₹" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Overtime Rules */}
        <Card className="mb-4" title={<span className="text-base font-semibold flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Overtime Rules</span>}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="overtimeAfter" label="OT Starts After (minutes)">
                <InputNumber min={0} max={120} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="overtimeRate" label="OT Rate Multiplier">
                <InputNumber min={1} max={5} step={0.25} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="maxOvertimeHours" label="Max OT Hours/Day">
                <InputNumber min={0} max={8} step={0.5} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="overtimeEnabled" label="Enable Overtime" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Week Offs */}
        <Card className="mb-4" title={<span className="text-base font-semibold flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Week Offs</span>}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="weekOffs" label="Weekly Off Days">
                <Select mode="multiple" placeholder="Select week offs"
                  options={WEEK_DAYS.map(d => ({ value: d, label: d }))} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="alternateWeekOff" label="Alternate Saturday Off" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Leave Allocation */}
        <Card className="mb-4" title={<span className="text-base font-semibold flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Leave Allocation (Per Year)</span>}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="casualLeave" label="Casual Leave">
                <InputNumber min={0} max={50} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sickLeave" label="Sick Leave">
                <InputNumber min={0} max={50} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="earnedLeave" label="Earned Leave">
                <InputNumber min={0} max={50} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="maternityLeave" label="Maternity Leave">
                <InputNumber min={0} max={180} className="w-full" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="paternityLeave" label="Paternity Leave">
                <InputNumber min={0} max={30} className="w-full" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="carryForward" label="Leave Carry Forward" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="maxCarryForward" label="Max Carry Forward Days">
                <InputNumber min={0} max={30} className="w-full" />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* PF & ESI */}
        <Card className="mb-4" title={<span className="text-base font-semibold flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>PF & ESI Configuration</span>}>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="pfPercentEmployee" label="PF % (Employee)">
                <InputNumber min={0} max={100} step={0.5} className="w-full" addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="pfPercentEmployer" label="PF % (Employer)">
                <InputNumber min={0} max={100} step={0.5} className="w-full" addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="esiPercentEmployee" label="ESI % (Employee)">
                <InputNumber min={0} max={100} step={0.25} className="w-full" addonAfter="%" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="esiPercentEmployer" label="ESI % (Employer)">
                <InputNumber min={0} max={100} step={0.25} className="w-full" addonAfter="%" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={6}>
              <Form.Item name="esiThreshold" label="ESI Threshold Salary (₹)">
                <InputNumber min={0} className="w-full" prefix="₹" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="pfEnabled" label="Enable PF" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="esiEnabled" label="Enable ESI" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end pb-6">
          <Button type="primary" size="large" icon={<SaveOutlined />} onClick={handleSave} loading={saving} style={{ background: '#FF5F03', borderColor: '#FF5F03' }} className="px-8">
            Save All Settings
          </Button>
        </div>
      </Form>
    </div>
  );
};

export default HRMSSettings;
