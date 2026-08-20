import { useState } from 'react';
import { Card, Row, Col, Statistic, Input, Button, Alert, Tag, Divider, message } from 'antd';
import { SyncOutlined, DisconnectOutlined, CheckCircleOutlined, WarningOutlined, SettingOutlined } from '@ant-design/icons';

const TallyDashboard = () => {
  const [config, setConfig] = useState({ company: '', host: 'localhost', port: '9000' });
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const testConnection = async () => {
    setTesting(true);
    await new Promise(r => setTimeout(r, 1500));
    setTesting(false);
    message.info('Tally integration requires Tally Prime with ODBC enabled on the client machine. Please install and configure Tally Prime first.');
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
            <SyncOutlined className="text-white text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Tally Integration</h1>
            <p className="text-sm text-gray-500 mt-0.5">Sync accounting data with Tally Prime</p>
          </div>
        </div>
        <Tag color="orange" icon={<DisconnectOutlined />} className="text-sm px-3 py-1">
          Not Connected
        </Tag>
      </div>

      <Alert type="warning" showIcon className="mb-5" icon={<WarningOutlined />}
        message="Client Setup Required"
        description="Tally integration requires Tally Prime with ODBC connector enabled on the client machine (port 9000). Please provide GST portal API credentials to enable E-Invoice and E-Way Bill sync." />

      <Row gutter={16} className="mb-4">
        {[
          ['Pending Sync', 0, '#fa8c16'],
          ['Synced Records', 0, '#52c41a'],
          ['Failed', 0, '#f5222d'],
          ['Total Records', 0, '#1890ff'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
        ))}
      </Row>

      <Row gutter={16}>
        <Col span={10}>
          <Card title={<span className="flex items-center gap-2"><SettingOutlined /> Connection Config</span>} size="small">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Tally Company Name</label>
                <Input value={config.company} onChange={e => setConfig(c => ({...c, company: e.target.value}))}
                  placeholder="e.g. BDM Tiles Pvt Ltd" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Host</label>
                  <Input value={config.host} onChange={e => setConfig(c => ({...c, host: e.target.value}))} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Port</label>
                  <Input value={config.port} onChange={e => setConfig(c => ({...c, port: e.target.value}))} />
                </div>
              </div>
              <Button type="primary" loading={testing} onClick={testConnection} className="w-full" icon={<SyncOutlined />}>
                Test Connection
              </Button>
            </div>
            <Divider className="my-3" />
            <div className="text-xs text-gray-400 space-y-1">
              <div>Connection URL: <code className="bg-gray-100 px-1 rounded">{`http://${config.host}:${config.port}`}</code></div>
              <div>Protocol: Tally XML over HTTP</div>
              <div>Status: <Tag color="orange">Requires Tally Prime</Tag></div>
            </div>
          </Card>
        </Col>

        <Col span={14}>
          <Card title="Sync Status" size="small">
            <div className="py-12 text-center">
              <DisconnectOutlined className="mx-auto mb-4 text-gray-300 text-5xl" />
              <p className="text-gray-500 font-medium">Tally is not connected</p>
              <p className="text-sm text-gray-400 mt-2">No pending items. Connect Tally Prime to start syncing.</p>
            </div>
          </Card>

          <Card title="Sync Modules" size="small" className="mt-4">
            <div className="space-y-2 text-sm">
              {[
                ['Sales Orders → Tally Sales Voucher', 'When status = delivered'],
                ['Payments → Tally Receipt Voucher', 'When status = confirmed'],
                ['Purchase Orders → Tally Purchase Voucher', 'When status = received'],
                ['Stock → Tally Stock Item', 'On every GRN approval'],
                ['GST → GSTR-1 Export', 'Monthly batch export'],
              ].map(([module, trigger]) => (
                <div key={module} className="flex justify-between py-1.5 border-b border-gray-50">
                  <div>
                    <div className="font-medium text-gray-700">{module}</div>
                    <div className="text-xs text-gray-400">{trigger}</div>
                  </div>
                  <Tag color="default">Pending</Tag>
                </div>
              ))}
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default TallyDashboard;
