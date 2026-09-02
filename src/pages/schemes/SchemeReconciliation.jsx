import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Space, Table, Tabs, Tag, message } from 'antd';
import { CheckOutlined, EyeOutlined, ReloadOutlined, RollbackOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STATUS_COLORS = { submitted: 'blue', approved: 'green', reversed: 'red', superseded: 'default' };

const SchemeReconciliation = () => {
  const [rows, setRows] = useState([]);
  const [partyType, setPartyType] = useState(undefined);
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getSchemeSettlements({ partyType, status, limit: 200 });
      if (response.success) setRows(response.data || []);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [partyType, status]);
  useEffect(() => { load(); }, [load]);

  const approve = record => Modal.confirm({
    title: `Approve ${record.settlementNumber}?`,
    content: `${money(record.amount)} will be recalculated, then posted as a ${record.partyType === 'dealer' ? 'dealer credit/debit note' : 'supplier debit/credit memo'}.`,
    okText: 'Recalculate and approve',
    onOk: async () => {
      const response = await reportService.approveSchemeSettlement(record._id);
      if (response.success) { message.success(response.message); load(); }
    },
  });

  const reverse = async () => {
    try {
      const response = await reportService.reverseSchemeSettlement(reverseTarget._id, { reason });
      if (response.success) { message.success(response.message); setReverseTarget(null); setReason(''); load(); }
    } catch (error) { message.error(error.message); }
  };

  const verifyEvidence = (record, decision) => Modal.confirm({
    title: `${decision === 'verified' ? 'Verify' : 'Reject'} supplier credit note ${record.supplierCreditNote.noteNumber}?`,
    content: decision === 'verified' ? 'Verification records the final supplier document without creating another accounting entry.' : 'Rejection leaves accounting unchanged and allows corrected evidence to be captured.',
    onOk: async () => {
      const response = await reportService.verifySupplierCreditNote(record._id, { decision });
      if (response.success) { message.success(response.message); load(); }
    },
  });

  const openDetail = async record => {
    try {
      const response = await reportService.getSchemeSettlement(record._id);
      if (response.success) setDetail(response.data);
    } catch (error) { message.error(error.message); }
  };

  const openEvidence = async settlement => {
    try {
      const blob = await reportService.downloadSupplierCreditNote(settlement._id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { message.error(error.message || 'Unable to open supplier credit-note evidence'); }
  };

  const columns = [
    { title: 'Settlement / scheme', dataIndex: 'settlementNumber', render: (value, record) => <div><div className="font-mono text-xs text-blue-600">{value}</div><div className="font-medium">{record.schemeName}</div><div className="text-xs text-gray-400">{record.schemeNumber}</div></div> },
    { title: 'Party', dataIndex: 'partyName', render: (value, record) => <div>{value}<div><Tag>{record.partyType}</Tag></div></div> },
    { title: 'Calculation', key: 'calculation', render: (_, record) => <div className="text-xs"><div>{record.calculation?.basis?.replaceAll('_', ' ')}</div><div>{record.adjustmentType}</div></div> },
    { title: 'Amount', dataIndex: 'amount', render: value => <strong>{money(value)}</strong> },
    { title: 'Maker / checker', key: 'actors', render: (_, record) => <div className="text-xs"><div>M: {record.submittedBy?.name || '—'}</div><div>C: {record.approvedBy?.name || '—'}</div></div> },
    { title: 'Accounting note', dataIndex: 'accountingNoteNumber', render: value => value || 'Not posted' },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={STATUS_COLORS[value]}>{value}</Tag> },
    { title: 'Actions', render: (_, record) => <Space wrap>
      <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>Details</Button>
      {record.status === 'submitted' && <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approve(record)}>Approve</Button>}
      {record.status === 'approved' && <Button size="small" danger icon={<RollbackOutlined />} onClick={() => { setReverseTarget(record); setReason(''); }}>Reverse</Button>}
      {record.partyType === 'supplier' && record.supplierCreditNote?.status === 'pending_verification' && <>
        <Button size="small" icon={<SafetyCertificateOutlined />} onClick={() => verifyEvidence(record, 'verified')}>Verify note</Button>
        <Button size="small" danger onClick={() => verifyEvidence(record, 'rejected')}>Reject note</Button>
      </>}
    </Space> },
  ];

  const summary = type => rows.filter(row => !type || row.partyType === type);
  const summaryTable = type => <Table rowKey="_id" columns={columns} dataSource={summary(type)} loading={loading} scroll={{ x: 1250 }} />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold text-gray-800">Scheme Reconciliation & Approval</h1><p className="text-sm text-gray-500">Maker-checker approval, authoritative note posting, supplier evidence verification, and exact reversals.</p></div><Button icon={<ReloadOutlined />} onClick={load} loading={loading} /></div>
      <div className="bg-white border rounded-lg p-4 mb-4 flex gap-3"><Select allowClear placeholder="All parties" value={partyType} onChange={setPartyType} className="w-40" options={[{ value: 'dealer', label: 'Dealer' }, { value: 'supplier', label: 'Supplier' }]} /><Select allowClear placeholder="All statuses" value={status} onChange={setStatus} className="w-44" options={Object.keys(STATUS_COLORS).map(value => ({ value, label: value }))} /></div>
      <div className="bg-white border rounded-lg overflow-hidden"><Tabs className="px-4" items={[
        { key: 'all', label: `All (${rows.length})`, children: summaryTable() },
        { key: 'dealer', label: `Dealer (${summary('dealer').length})`, children: summaryTable('dealer') },
        { key: 'supplier', label: `Supplier (${summary('supplier').length})`, children: summaryTable('supplier') },
      ]} /></div>

      <Modal title={detail?.settlementNumber} open={!!detail} onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>} width={820}>
        {detail && <div className="space-y-3 text-sm mt-3">
          <div className="grid grid-cols-3 gap-3"><div className="bg-gray-50 rounded p-3"><div className="text-xs text-gray-400">Party</div><strong>{detail.partyName}</strong></div><div className="bg-gray-50 rounded p-3"><div className="text-xs text-gray-400">Scheme</div><strong>{detail.schemeName}</strong></div><div className="bg-green-50 rounded p-3"><div className="text-xs text-gray-400">Amount</div><strong className="text-green-700">{money(detail.amount)}</strong></div></div>
          <div><strong>Period:</strong> {new Date(detail.periodStart).toLocaleDateString('en-IN')} – {new Date(detail.periodEnd).toLocaleDateString('en-IN')}</div>
          <div><strong>Source totals:</strong> gross {money(detail.calculation?.grossValue)}, returns {money(detail.calculation?.returnValue)}, net {money(detail.calculation?.netValue)}; net quantity {detail.calculation?.netQuantity || 0}</div>
          <div><strong>Documents:</strong> {detail.calculation?.sources?.invoices?.length || 0} invoices, {detail.calculation?.sources?.returns?.length || 0} returns, {detail.calculation?.sources?.payments?.length || 0} allocations</div>
          <div><strong>Accounting:</strong> {detail.accountingNoteNumber || 'Awaiting approval'} {detail.reversalPostingKey ? '· reversed exactly' : ''}</div>
          {detail.supplierCreditNote?.noteNumber && <div><strong>Supplier credit note:</strong> {detail.supplierCreditNote.noteNumber} · {money(detail.supplierCreditNote.amount)} · <Tag>{detail.supplierCreditNote.status}</Tag>{detail.supplierCreditNote.documentUrl && <Button type="link" size="small" className="px-1" onClick={() => openEvidence(detail)}>Open evidence</Button>}</div>}
          <div className="text-xs text-gray-400 break-all">Fingerprint: {detail.calculationFingerprint}</div>
        </div>}
      </Modal>

      <Modal title={`Reverse ${reverseTarget?.accountingNoteNumber || ''}`} open={!!reverseTarget} onCancel={() => setReverseTarget(null)} onOk={reverse} okText="Reverse exact posting" okButtonProps={{ danger: true }}>
        <div className="mt-3"><div className="rounded bg-red-50 p-3 text-xs text-red-800 mb-3">A third actor is required. The original debit/credit direction and amount will be copied and swapped; no custom reversal amount is accepted.</div><label className="text-xs text-gray-500 block mb-1">Reason *</label><Input.TextArea rows={3} value={reason} onChange={event => setReason(event.target.value)} /></div>
      </Modal>
    </div>
  );
};

export default SchemeReconciliation;
