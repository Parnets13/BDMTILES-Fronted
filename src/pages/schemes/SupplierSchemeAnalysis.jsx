import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Modal, Row, Statistic, Table, Tag, message } from 'antd';
import { EyeOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STATUS_COLORS = { draft: 'default', active: 'green', paused: 'orange', expired: 'gold', closed: 'red' };

const SupplierSchemeAnalysis = () => {
  const [schemes, setSchemes] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [list, summary] = await Promise.all([
        reportService.getSupplierSchemes({ limit: 100 }),
        reportService.getSupplierSchemeStats(),
      ]);
      if (list.success) setSchemes(list.data || []);
      if (summary.success) setStats(summary.data || {});
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const analyse = async record => {
    setAnalysisLoading(true);
    try {
      const response = await reportService.getSupplierSchemeAnalysis(record._id);
      if (response.success) setDetail(response.data);
    } catch (error) { message.error(error.message); }
    finally { setAnalysisLoading(false); }
  };

  const submit = async record => {
    try {
      const response = await reportService.submitSupplierSchemeClaim(record._id);
      if (response.success) { message.success(response.message); load(); }
    } catch (error) { message.error(error.message); }
  };

  const columns = [
    { title: 'Scheme', dataIndex: 'schemeNumber', render: (value, record) => <div><div className="font-medium">{record.schemeName}</div><div className="font-mono text-xs text-gray-400">{value}</div></div> },
    { title: 'Supplier', dataIndex: 'supplierName' },
    { title: 'Rule', key: 'rule', render: (_, record) => <div><Tag color="blue">{record.basis?.replaceAll('_', ' ')}</Tag><div className="text-xs text-gray-500">{record.calculationType?.replaceAll('_', ' ')}</div></div> },
    { title: 'Period', key: 'period', render: (_, record) => `${new Date(record.startDate).toLocaleDateString('en-IN')} – ${new Date(record.endDate).toLocaleDateString('en-IN')}` },
    { title: 'Submitted', key: 'submitted', render: (_, record) => money(record.settlementSummary?.submitted) },
    { title: 'Posted', key: 'posted', render: (_, record) => <span className="text-green-700">{money(record.settlementSummary?.approved)}</span> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={STATUS_COLORS[value]}>{value}</Tag> },
    { title: 'Actions', render: (_, record) => <div className="flex gap-2"><Button size="small" icon={<EyeOutlined />} disabled={!['active', 'expired', 'closed'].includes(record.status)} onClick={() => analyse(record)}>Analyse</Button><Button size="small" type="primary" icon={<SendOutlined />} disabled={!['active', 'expired', 'closed'].includes(record.status)} onClick={() => submit(record)}>Submit claim</Button></div> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold text-gray-800">Supplier Scheme Analysis</h1><p className="text-sm text-gray-500">Authoritative achievement and claim submission; claim amount cannot be edited.</p></div><Button icon={<ReloadOutlined />} loading={loading} onClick={load} /></div>
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Rules" value={stats.total || 0} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Awaiting approval" value={stats.submitted || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Posted claims" value={money(stats.approvedAmount)} valueStyle={{ color: '#1677ff' }} /></Card></Col>
      </Row>
      <div className="bg-white border rounded-lg overflow-hidden"><Table rowKey="_id" columns={columns} dataSource={schemes} loading={loading} scroll={{ x: 1050 }} /></div>
      <Modal title={`${detail?.scheme?.schemeNumber || ''} authoritative analysis`} open={!!detail} onCancel={() => setDetail(null)} confirmLoading={analysisLoading}
        footer={detail ? [<Button key="close" onClick={() => setDetail(null)}>Close</Button>, <Button key="submit" type="primary" disabled={!detail.eligible} onClick={() => submit(detail.scheme)}>Submit exact claim</Button>] : null} width={780}>
        {detail && <div className="space-y-3 text-sm mt-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <Card size="small"><Statistic title="Gross value" value={money(detail.grossValue)} /></Card>
            <Card size="small"><Statistic title="Posted returns" value={money(detail.returnValue)} /></Card>
            <Card size="small"><Statistic title="Net value" value={money(detail.netValue)} /></Card>
            <Card size="small"><Statistic title="Earned" value={money(detail.earnedAmount)} valueStyle={{ color: detail.eligible ? '#52c41a' : '#fa8c16' }} /></Card>
          </div>
          <Tag color={detail.eligible ? 'green' : 'orange'}>{detail.eligible ? 'Eligible' : 'Target not met'}</Tag>
          <div><strong>Verified invoices ({detail.sources?.invoices?.length || 0})</strong><div className="text-xs text-gray-500">{detail.sources?.invoices?.map(row => row.number).join(', ') || 'None'}</div></div>
          <div><strong>Posted purchase returns ({detail.sources?.returns?.length || 0})</strong><div className="text-xs text-gray-500">{detail.sources?.returns?.map(row => row.noteNumber).join(', ') || 'None'}</div></div>
          <div><strong>Confirmed allocations ({detail.sources?.payments?.length || 0})</strong><div className="text-xs text-gray-500">{detail.sources?.payments?.map(row => `${row.number}: ${money(row.allocatedAmount)}`).join(', ') || 'None / not selected basis'}</div></div>
          <div className="text-xs text-gray-400 break-all">Fingerprint: {detail.calculationFingerprint}</div>
        </div>}
      </Modal>
    </div>
  );
};

export default SupplierSchemeAnalysis;
