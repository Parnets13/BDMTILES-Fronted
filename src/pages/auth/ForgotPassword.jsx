import { useState } from 'react';
import { Alert, Button, Card, Form, Input, Typography } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

const ForgotPassword = () => {
  const { forgotPassword } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  const handleFinish = async ({ email }) => {
    setSubmitting(true);
    const response = await forgotPassword(email);
    setSubmitting(false);
    setResult(response);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md shadow-sm">
        <div className="mb-6 text-center">
          <MailOutlined className="mb-3 text-4xl text-[#FF5F03]" />
          <Typography.Title level={3} className="!mb-1">Forgot Password</Typography.Title>
          <Typography.Text type="secondary">Enter your account email to request a reset link.</Typography.Text>
        </div>
        {result && (
          <Alert
            className="mb-5"
            type={result.success ? 'success' : 'error'}
            showIcon
            message={result.success ? result.message : result.error}
            description={result.devResetToken ? `Development reset token: ${result.devResetToken}` : undefined}
          />
        )}
        <Form layout="vertical" onFinish={handleFinish} requiredMark={false}>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}>
            <Input autoComplete="email" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block size="large" loading={submitting}>Send Reset Link</Button>
        </Form>
        <div className="mt-5 text-center"><Link to="/login">Back to login</Link></div>
      </Card>
    </div>
  );
};

export default ForgotPassword;
