import { useCallback, useEffect, useState } from 'react';
import { Button, Card, Col, Modal, Row, Select, Statistic, Table, Tag, message } from 'antd';
import { EyeOutlined, ReloadOutlined, SendOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const DealerPointsTracker = () => {
  const [dealers, setDealers] = useState([]);
  const [dealer, setDealer] = useState(null);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    masterService.getDealers({ limit: 200, status: 'active' })
      .then(response => setDealers(response.data || [])).catch(() => {});
  }, []);

  const load = useCallback(async () => {
    if (!dealer) { setRows([]); return; }
    setLoading(true);
    try {
      const response = await reportService.getDealerAnalysis(dealer);
      if (response.success) setRows(response.data || []);
    } catch (error) { message.error(error.message); setRows([]); }
    finally { setLoading(false); }
  }, [dealer]);

  useEffect(() => { load(); }, [load]);

  const submit = async record => {
    try {
      const response = await reportService.submitDealerSchemeSettlement(record.scheme._id, { dealer });
      if (response.success) message.success(response.message);
    } catch (error) { message.error(error.message); }
  };

  const eligible = rows.filter(row => row.eligible);
  const columns = [
    { title: 'Scheme', key: 'scheme', render: (_, record) => <div><div className="font-medium">{record.scheme.schemeName}</div><div className="font-mono text-xs text-gray-400">{record.scheme.schemeNumber}</div></div> },
    { title: 'Basis', dataIndex: 'basis', render: value => <Tag color="blue">{value?.replaceAll('_', ' ')}</Tag> },
    { title: 'Gross', key: 'gross', render: (_, record) => record.basis.endsWith('quantity') ? record.grossQuantity : money(record.grossValue) },
    { title: 'Returns', key: 'returns', render: (_, record) => record.basis.endsWith('quantity') ? record.returnQuantity : money(record.returnValue) },
    { title: 'Net achievement', key: 'net', render: (_, record) => <strong>{record.basis.endsWith('quantity') ? record.netQuantity : money(record.netValue)}</strong> },
    { title: 'Eligibility', dataIndex: 'eligible', render: value => <Tag color={value ? 'green' : 'orange'}>{value ? 'Eligible' : 'Target not met'}</Tag> },
    { title: 'Server-calculated incentive', dataIndex: 'earnedAmount', render: value => <strong className="text-green-700">{money(value)}</strong> },
    { title: 'Actions', render: (_, record) => <div className="flex gap-2"><Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(record)}>Details</Button><Button size="small" type="primary" icon={<SendOutlined />} disabled={!record.eligible} onClick={() => submit(record)}>Submit</Button></div> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Dealer Incentive Eligibility</h1><p className="text-sm text-gray-500">No points simulation: all values come from tax invoices, posted returns, and confirmed allocations.</p></div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading} />
      </div>
      <div className="bg-white border rounded-lg p-4 mb-4"><label className="text-xs text-gray-500 block mb-1">Dealer</label><Select className="w-full max-w-xl" showSearch optionFilterProp="label" value={dealer} onChange={setDealer} placeholder="Select an active dealer"
        options={dealers.map(row => ({ value: row._id, label: `${row.businessName} (${row.dealerCode || '—'})` }))} /></div>
      <Row gutter={16} className="mb-4">
        <Col span={8}><Card size="small"><Statistic title="Applicable schemes" value={rows.length} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Eligible schemes" value={eligible.length} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Current calculated incentive" value={money(eligible.reduce((sum, row) => sum + Number(row.earnedAmount || 0), 0))} valueStyle={{ color: '#1677ff' }} /></Card></Col>
      </Row>
      <div className="bg-white border rounded-lg overflow-hidden"><Table rowKey={record => record.scheme._id} columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1100 }} locale={{ emptyText: dealer ? 'No applicable active/expired schemes.' : 'Select a dealer.' }} /></div>
      <Modal title={detail?.scheme?.schemeNumber} open={!!detail} onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>} width={760}>
        {detail && <div className="space-y-3 text-sm mt-3">
          <div className="grid grid-cols-2 gap-3"><div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-400">Rule</div><strong>{detail.scheme.calculationType.replaceAll('_', ' ')}</strong></div><div className="bg-green-50 p-3 rounded"><div className="text-xs text-gray-400">Earned</div><strong className="text-green-700">{money(detail.earnedAmount)}</strong></div></div>
          <div><strong>Source invoices ({detail.sources?.invoices?.length || 0})</strong><div className="text-xs text-gray-500 break-words">{detail.sources?.invoices?.map(row => row.number).join(', ') || 'None'}</div></div>
          <div><strong>Posted returns ({detail.sources?.returns?.length || 0})</strong><div className="text-xs text-gray-500 break-words">{detail.sources?.returns?.map(row => row.noteNumber || row.number).join(', ') || 'None'}</div></div>
          <div><strong>Confirmed allocations ({detail.sources?.payments?.length || 0})</strong><div className="text-xs text-gray-500 break-words">{detail.sources?.payments?.map(row => `${row.number}: ${money(row.allocatedAmount)}`).join(', ') || 'None / not the selected basis'}</div></div>
          <div className="text-xs text-gray-400">Fingerprint: {detail.calculationFingerprint}</div>
        </div>}
      </Modal>
    </div>
  );
};

export default DealerPointsTracker;
