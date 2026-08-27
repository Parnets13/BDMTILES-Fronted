import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Link, useParams } from 'react-router-dom';
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

const ResetPassword = () => {
  const { token } = useParams();
  const { resetPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFinish = async ({ newPassword }) => {
    setSubmitting(true);
    const response = await resetPassword(token, newPassword);
    setSubmitting(false);
    setResult(response);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-sm">
        <div className="mb-6 text-center">
          <SafetyCertificateOutlined className="mb-3 text-4xl text-[#FF5F03]" />
          <Typography.Title level={3} className="!mb-1">Reset Password</Typography.Title>
          <Typography.Text type="secondary">Choose a strong password for your account.</Typography.Text>
        </div>
        {result && <Alert className="mb-5" type={result.success ? 'success' : 'error'} showIcon message={result.success ? result.message : result.error} />}
        {!result?.success && (
          <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
            <Form.Item name="newPassword" label="New Password" rules={passwordRules}>
              <Input.Password autoComplete="new-password" />
            </Form.Item>
            <Form.Item
              name="confirmPassword"
              label="Confirm Password"
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
            <Button type="primary" htmlType="submit" block size="large" loading={submitting} disabled={!token}>Reset Password</Button>
          </Form>
        )}
        <div className="mt-5 text-center"><Link to="/login">Back to login</Link></div>
      </Card>
    </div>
  );
};

export default ResetPassword;
