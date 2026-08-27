import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const passwordRules = [
  { required: true, message: 'Enter a new password' },
  { min: 10, message: 'Use at least 10 characters' },
  {
    validator: (_, value) => !value || (
      /[a-z]/.test(value)
      && /[A-Z]/.test(value)
      && /\d/.test(value)
      && /[^A-Za-z0-9]/.test(value)
    ) ? Promise.resolve() : Promise.reject(new Error('Include uppercase, lowercase, number, and special character')),
  },
];

const ChangePassword = () => {
  const { changePassword, user } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const handleFinish = async ({ currentPassword, newPassword }) => {
    setSubmitting(true);
    const result = await changePassword(currentPassword, newPassword);
    setSubmitting(false);
    if (!result.success) {
      message.error(result.error);
      return;
    }
    message.success('Password changed successfully');
    navigate('/dashboard', { replace: true });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-sm">
        <div className="mb-6 text-center">
          <LockOutlined className="mb-3 text-4xl text-[#FF5F03]" />
          <Typography.Title level={3} className="!mb-1">Change Password</Typography.Title>
          <Typography.Text type="secondary">Protect your account with a strong, unique password.</Typography.Text>
        </div>
        {user?.mustChangePassword && (
          <Alert className="mb-5" type="warning" showIcon message="Password change required" description="You must change the temporary password before accessing BDMTILES." />
        )}
        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item name="currentPassword" label="Current Password" rules={[{ required: true, message: 'Enter your current password' }]}>
            <Input.Password autoComplete="current-password" />
          </Form.Item>
          <Form.Item name="newPassword" label="New Password" rules={passwordRules}>
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="Confirm New Password"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Confirm your new password' },
              ({ getFieldValue }) => ({
                validator: (_, value) => value === getFieldValue('newPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Passwords do not match')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>Change Password</Button>
        </Form>
      </Card>
    </div>
  );
};

export default ChangePassword;
