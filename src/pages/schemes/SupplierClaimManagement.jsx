import { useCallback, useEffect, useState } from 'react';
import { Button, DatePicker, Input, InputNumber, Modal, Select, Space, Table, Tag, Upload, message } from 'antd';
import { EyeOutlined, FileAddOutlined, ReloadOutlined, SyncOutlined, UploadOutlined } from '@ant-design/icons';
import reportService from '../../services/reportService.js';

const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const STATUS_COLORS = { submitted: 'blue', approved: 'green', reversed: 'red', superseded: 'default' };

const SupplierClaimManagement = () => {
  const [rows, setRows] = useState([]);
  const [status, setStatus] = useState(undefined);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [creditTarget, setCreditTarget] = useState(null);
  const [creditForm, setCreditForm] = useState({ noteNumber: '', noteDate: null, amount: 0, file: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getSchemeSettlements({ partyType: 'supplier', status, limit: 100 });
      if (response.success) setRows(response.data || []);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const openDetail = async record => {
    try {
      const response = await reportService.getSchemeSettlement(record._id);
      if (response.success) setDetail(response.data);
    } catch (error) { message.error(error.message); }
  };

  const adjustment = async record => {
    try {
      const response = await reportService.createSchemeAdjustment(record._id);
      if (response.success) { message.success(response.message); load(); }
    } catch (error) { message.error(error.message); }
  };

  const uploadCreditNote = async () => {
    if (!creditForm.file) { message.error('Select the supplier credit-note PDF or image.'); return; }
    setSaving(true);
    try {
      const data = new FormData();
      data.append('noteNumber', creditForm.noteNumber);
      data.append('noteDate', creditForm.noteDate?.format('YYYY-MM-DD') || '');
      data.append('amount', String(creditForm.amount || 0));
      data.append('document', creditForm.file);
      const response = await reportService.uploadSupplierCreditNote(creditTarget._id, data);
      if (response.success) {
        message.success(response.message);
        setCreditTarget(null);
        setCreditForm({ noteNumber: '', noteDate: null, amount: 0, file: null });
        load();
      }
    } catch (error) { message.error(error.message); }
    finally { setSaving(false); }
  };

  const columns = [
    { title: 'Claim', dataIndex: 'settlementNumber', render: (value, record) => <div><div className="font-mono text-xs text-blue-600">{value}</div><div className="font-medium">{record.schemeName}</div></div> },
    { title: 'Supplier', dataIndex: 'partyName' },
    { title: 'Type', dataIndex: 'adjustmentType', render: value => <Tag>{value}</Tag> },
    { title: 'Calculated amount', dataIndex: 'amount', render: value => <strong>{money(value)}</strong> },
    { title: 'Internal note', dataIndex: 'accountingNoteNumber', render: value => value || 'Awaiting approval' },
    { title: 'Supplier credit note', key: 'credit', render: (_, record) => record.supplierCreditNote?.noteNumber
      ? <div className="text-xs"><div>{record.supplierCreditNote.noteNumber}</div><Tag color={record.supplierCreditNote.status === 'verified' ? 'green' : record.supplierCreditNote.status === 'rejected' ? 'red' : 'orange'}>{record.supplierCreditNote.status}</Tag></div>
      : 'Not captured' },
    { title: 'Status', dataIndex: 'status', render: value => <Tag color={STATUS_COLORS[value]}>{value}</Tag> },
    { title: 'Actions', render: (_, record) => <Space wrap>
      <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(record)}>Details</Button>
      {record.status === 'approved' && <Button size="small" icon={<SyncOutlined />} onClick={() => adjustment(record)}>Recalculate adjustment</Button>}
      {record.status === 'approved' && record.adjustmentType !== 'clawback' && !['pending_verification', 'verified'].includes(record.supplierCreditNote?.status) && <Button size="small" icon={<FileAddOutlined />} onClick={() => {
        setCreditTarget(record);
        setCreditForm({ noteNumber: '', noteDate: null, amount: record.amount, file: null });
      }}>Credit note</Button>}
    </Space> },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-5"><div><h1 className="text-2xl font-bold text-gray-800">Supplier Claims</h1><p className="text-sm text-gray-500">Immutable server calculations, internal debit memos, and supplier-issued credit-note evidence.</p></div><Button icon={<ReloadOutlined />} onClick={load} loading={loading} /></div>
      <div className="bg-white border rounded-lg p-4 mb-4"><Select allowClear placeholder="All statuses" value={status} onChange={setStatus} className="w-48" options={Object.keys(STATUS_COLORS).map(value => ({ value, label: value }))} /></div>
      <div className="bg-white border rounded-lg overflow-hidden"><Table rowKey="_id" columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1150 }} /></div>

      <Modal title={detail?.settlementNumber} open={!!detail} onCancel={() => setDetail(null)} footer={<Button onClick={() => setDetail(null)}>Close</Button>} width={780}>
        {detail && <div className="space-y-3 text-sm mt-3">
          <div className="grid grid-cols-2 gap-3"><div className="bg-gray-50 p-3 rounded"><div className="text-xs text-gray-400">Supplier / scheme</div><strong>{detail.partyName}</strong><div>{detail.schemeName}</div></div><div className="bg-green-50 p-3 rounded"><div className="text-xs text-gray-400">Authoritative amount</div><strong className="text-green-700">{money(detail.amount)}</strong><div>{detail.adjustmentType}</div></div></div>
          <div><strong>Maker:</strong> {detail.submittedBy?.name || '—'} · <strong>Checker:</strong> {detail.approvedBy?.name || '—'}</div>
          <div><strong>Internal accounting note:</strong> {detail.accountingNoteNumber || 'Not posted'}</div>
          <div><strong>Sources:</strong> {detail.calculation?.sources?.invoices?.length || 0} invoices, {detail.calculation?.sources?.returns?.length || 0} returns, {detail.calculation?.sources?.payments?.length || 0} confirmed allocations</div>
          <div className="text-xs text-gray-400 break-all">Fingerprint: {detail.calculationFingerprint}</div>
        </div>}
      </Modal>

      <Modal title="Capture supplier-issued GST credit note" open={!!creditTarget} onCancel={() => setCreditTarget(null)} onOk={uploadCreditNote} confirmLoading={saving} okText="Submit for verification">
        <div className="space-y-3 mt-3">
          <div className="rounded bg-blue-50 p-3 text-xs text-blue-800">This evidence does not create a second ledger posting. The approved internal debit memo remains authoritative.</div>
          <div><label className="text-xs text-gray-500 block mb-1">Credit-note number *</label><Input value={creditForm.noteNumber} onChange={event => setCreditForm(current => ({ ...current, noteNumber: event.target.value }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Credit-note date *</label><DatePicker className="w-full" value={creditForm.noteDate} onChange={noteDate => setCreditForm(current => ({ ...current, noteDate }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Amount (must equal approved claim)</label><InputNumber className="w-full" value={creditForm.amount} disabled prefix="₹" /></div>
          <Upload maxCount={1} beforeUpload={file => { setCreditForm(current => ({ ...current, file })); return false; }} onRemove={() => setCreditForm(current => ({ ...current, file: null }))} accept="application/pdf,image/jpeg,image/png,image/webp">
            <Button icon={<UploadOutlined />}>Select PDF or image</Button>
          </Upload>
        </div>
      </Modal>
    </div>
  );
};

export default SupplierClaimManagement;
