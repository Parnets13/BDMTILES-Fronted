import { Card, Alert, Tag, Row, Col, Statistic } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';
import { ActivitySquare } from 'lucide-react';

const ActivityLogs = () => (
  <div>
    <div className="flex items-center gap-3 mb-5">
      <ActivitySquare size={24} className="text-blue-600" />
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Activity Logs</h1>
        <p className="text-sm text-gray-500 mt-0.5">Complete audit trail of user actions across all modules</p>
      </div>
      <Tag color="green" icon={<CheckCircleOutlined />} className="ml-auto text-sm">System Ready</Tag>
    </div>

    <Alert type="info" showIcon className="mb-6"
      message="Activity Logging System is Active"
      description="Activity logging will be automatically populated as users perform actions across all modules. The logging system is configured and ready to record all create, update, delete and status-change operations." />

    <Row gutter={16} className="mb-6">
      {[
        ['Modules Tracked', '18', '#1890ff'],
        ['Log Categories', '5', '#52c41a'],
        ['Retention Period', '90 days', '#722ed1'],
        ['Status', 'Ready', '#52c41a'],
      ].map(([t, v, c]) => (
        <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
      ))}
    </Row>

    <Card>
      <div className="space-y-3 text-sm text-gray-600">
        <div className="font-semibold text-gray-800 text-base mb-4">What will be logged:</div>
        {[
          ['Sales Orders', 'Create, Update, Status Changes, Cancellations'],
          ['Purchase Orders', 'Create, Approve, Receive, Cancel'],
          ['Payments', 'Record, Confirm, Bounce'],
          ['Stock', 'Adjustments, Transfers, GRN Updates'],
          ['User Management', 'Create, Role Changes, Login/Logout'],
          ['Approvals', 'Request, Approve, Reject'],
          ['HRMS', 'Attendance, Leave, Salary Processing'],
          ['Finance', 'Voucher Posting, Cheque Actions'],
        ].map(([module, actions]) => (
          <div key={module} className="flex gap-3 py-2 border-b border-gray-100">
            <Tag color="blue" className="shrink-0">{module}</Tag>
            <span className="text-gray-500">{actions}</span>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-blue-50 rounded-lg text-sm text-blue-700">
        📌 Full ActivityLog model is configured in the backend. Logs will appear here once the ActivityLog model is integrated with each module's write operations in a future sprint.
      </div>
    </Card>
  </div>
);

export default ActivityLogs;
