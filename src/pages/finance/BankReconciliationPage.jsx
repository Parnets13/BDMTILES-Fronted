import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, InputNumber, Row, Col, Card, Statistic, Tooltip, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined, SyncOutlined, BankOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../config/api.js';

const STATUS_COLORS = { draft: 'default', in_progress: 'blue', completed: 'green', approved: 'purple' };
const MATCH_COLORS = { unmatched: 'red', matched: 'green', partial: 'orange', discrepancy: 'volcano' };

const BankReconciliationPage = () => {
  const [reconciliations, setReconciliations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);

  const loadStats = () => { api.get('/bank-reconciliation/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchReconciliations = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/bank-reconciliation', { params: { page: pagination.current, limit: pagination.pageSize } });
      if (res.success) { setReconciliations(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchReconciliations(); }, [fetchReconciliations]);

  const handleAutoMatch = async (id) => {
    try {
      const res = await api.patch(`/bank-reconciliation/${id}/auto-match`);
      if (res.success) { message.success(res.message); fetchReconciliations(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Recon #', dataIndex: 'reconciliationNumber', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Bank', dataIndex: 'bankName', width: 130 },
    { title: 'Period', key: 'period', width: 160, render: (_, r) => <span className="text-xs">{dayjs(r.statementFrom).format('DD/MM/YY')} — {dayjs(r.statementTo).format('DD/MM/YY')}</span> },
    { title: 'Entries', dataIndex: 'totalEntries', width: 60 },
    { title: 'Matched', key: 'matched', width: 90, render: (_, r) => (
      <div className="text-xs">
        <span className="text-green-600 font-medium">{r.matchedEntries || 0}</span>
        <span className="text-gray-400"> / {r.totalEntries || 0}</span>
      </div>
    )},
    { title: 'Difference', dataIndex: 'netDifference', width: 100, render: v => v ? <span className={`font-medium ${Math.abs(v) > 0 ? 'text-red-500' : 'text-green-600'}`}>₹{v?.toLocaleString()}</span> : '₹0' },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLORS[s]}>{s.replace('_', ' ')}</Tag> },
    { title: 'Actions', width: 120, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => loadFullRecord(r._id)} /></Tooltip>
        {['draft', 'in_progress'].includes(r.status) && <Tooltip title="Auto Match"><Button type="text" size="small" icon={<SyncOutlined />} className="text-purple-600" onClick={() => handleAutoMatch(r._id)} /></Tooltip>}
        {r.status === 'in_progress' && <Tooltip title="Complete"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={async () => {
          const res = await api.patch(`/bank-reconciliation/${r._id}/complete`);
          if (res.success) { message.success('Completed.'); fetchReconciliations(); loadStats(); }
        }} /></Tooltip>}
      </Space>
    )},
  ];

  const loadFullRecord = async (id) => {
    try {
      const res = await api.get(`/bank-reconciliation/${id}`);
      if (res.success) setViewRecord(res.data);
    } catch (err) { message.error(err.message); }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bank Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">Upload bank statements, auto-match with payments, identify differences</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Reconciliation</Button>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<BankOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="In Progress" value={stats.inProgress || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Completed" value={stats.completed || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={reconciliations} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      <CreateReconModal open={showCreate} onClose={() => setShowCreate(false)} onSuccess={() => { fetchReconciliations(); loadStats(); }} />

      {viewRecord && (
        <Modal open title={`Reconciliation ${viewRecord.reconciliationNumber}`} onCancel={() => setViewRecord(null)} width={900} footer={<Button onClick={() => setViewRecord(null)}>Close</Button>}>
          <div className="space-y-4 text-sm mt-3">
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-gray-50 p-3 rounded border"><div className="text-[10px] text-gray-400 uppercase">Bank</div><div className="font-bold">{viewRecord.bankName}</div><div className="text-xs text-gray-500">{viewRecord.accountNumber}</div></div>
              <div className="bg-blue-50 p-3 rounded border border-blue-100"><div className="text-[10px] text-gray-400 uppercase">Period</div><div className="font-bold text-xs">{dayjs(viewRecord.statementFrom).format('DD MMM')} - {dayjs(viewRecord.statementTo).format('DD MMM YY')}</div></div>
              <div className="bg-green-50 p-3 rounded border border-green-100"><div className="text-[10px] text-gray-400 uppercase">Match Rate</div><div className="font-bold">{viewRecord.totalEntries > 0 ? Math.round((viewRecord.matchedEntries / viewRecord.totalEntries) * 100) : 0}%</div><Progress percent={viewRecord.totalEntries > 0 ? Math.round((viewRecord.matchedEntries / viewRecord.totalEntries) * 100) : 0} size="small" showInfo={false} /></div>
              <div className={`p-3 rounded border ${Math.abs(viewRecord.netDifference || 0) > 0 ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-100'}`}><div className="text-[10px] text-gray-400 uppercase">Difference</div><div className="font-bold">₹{(viewRecord.netDifference || 0).toLocaleString()}</div></div>
            </div>

            <div className="font-semibold text-gray-700">Entries ({viewRecord.entries?.length || 0})</div>
            <div className="max-h-80 overflow-y-auto">
              <table className="w-full text-[10px] border border-gray-200 rounded">
                <thead className="bg-gray-50 sticky top-0"><tr>{['Date','Description','Ref','Debit','Credit','Match','Matched With','Diff'].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody>{viewRecord.entries?.map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1">{dayjs(e.date).format('DD/MM')}</td>
                    <td className="px-2 py-1 max-w-[180px] truncate">{e.description}</td>
                    <td className="px-2 py-1 font-mono">{e.reference || '—'}</td>
                    <td className="px-2 py-1 text-red-600">{e.debit > 0 ? `₹${e.debit.toLocaleString()}` : ''}</td>
                    <td className="px-2 py-1 text-green-600">{e.credit > 0 ? `₹${e.credit.toLocaleString()}` : ''}</td>
                    <td className="px-2 py-1"><Tag color={MATCH_COLORS[e.matchStatus]} className="text-[8px]">{e.matchStatus}</Tag></td>
                    <td className="px-2 py-1 text-gray-500">{e.matchedWith || '—'}</td>
                    <td className="px-2 py-1">{e.difference !== 0 ? <span className="text-red-500">₹{e.difference}</span> : '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

// CREATE RECONCILIATION MODAL
const CreateReconModal = ({ open, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    bankName: '', accountNumber: '',
    statementFrom: dayjs().startOf('month').format('YYYY-MM-DD'),
    statementTo: dayjs().format('YYYY-MM-DD'),
    openingBalance: 0, closingBalance: 0,
  });
  const [entries, setEntries] = useState([]);

  const addEntry = () => setEntries(prev => [...prev, { date: dayjs().format('YYYY-MM-DD'), description: '', reference: '', debit: 0, credit: 0 }]);

  const handleSubmit = async () => {
    if (!form.bankName) { message.error('Enter bank name'); return; }
    if (entries.length === 0) { message.error('Add at least one entry'); return; }
    setLoading(true);
    try {
      const res = await api.post('/bank-reconciliation', { ...form, entries });
      if (res.success) { message.success(res.message); onSuccess?.(); handleClose(); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleClose = () => {
    setForm({ bankName: '', accountNumber: '', statementFrom: dayjs().startOf('month').format('YYYY-MM-DD'), statementTo: dayjs().format('YYYY-MM-DD'), openingBalance: 0, closingBalance: 0 });
    setEntries([]); onClose();
  };

  return (
    <Modal title="New Bank Reconciliation" open={open} onCancel={handleClose} width={900} footer={null} destroyOnHidden>
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-4 gap-3">
          <div><label className="text-xs text-gray-500 block mb-1">Bank Name *</label><Input value={form.bankName} onChange={e => setForm(f => ({ ...f, bankName: e.target.value }))} placeholder="SBI / HDFC / ICICI" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Account Number</label><Input value={form.accountNumber} onChange={e => setForm(f => ({ ...f, accountNumber: e.target.value }))} placeholder="A/c #" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Statement From</label><Input type="date" value={form.statementFrom} onChange={e => setForm(f => ({ ...f, statementFrom: e.target.value }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Statement To</label><Input type="date" value={form.statementTo} onChange={e => setForm(f => ({ ...f, statementTo: e.target.value }))} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500 block mb-1">Opening Balance ₹</label><InputNumber value={form.openingBalance} onChange={v => setForm(f => ({ ...f, openingBalance: v || 0 }))} className="w-full" prefix="₹" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Closing Balance ₹</label><InputNumber value={form.closingBalance} onChange={v => setForm(f => ({ ...f, closingBalance: v || 0 }))} className="w-full" prefix="₹" /></div>
        </div>

        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700">Bank Statement Entries</label>
            <Button size="small" onClick={addEntry}>+ Add Entry</Button>
          </div>
          {entries.length > 0 && (
            <div className="max-h-60 overflow-y-auto border border-gray-200 rounded">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 sticky top-0"><tr>{['Date','Description','Reference','Debit ₹','Credit ₹',''].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
                <tbody>{entries.map((e, i) => (
                  <tr key={i} className="border-t border-gray-100">
                    <td className="px-2 py-1"><Input type="date" size="small" value={e.date} onChange={ev => { const n = [...entries]; n[i].date = ev.target.value; setEntries(n); }} className="w-28" /></td>
                    <td className="px-2 py-1"><Input size="small" value={e.description} onChange={ev => { const n = [...entries]; n[i].description = ev.target.value; setEntries(n); }} placeholder="Description" /></td>
                    <td className="px-2 py-1"><Input size="small" value={e.reference} onChange={ev => { const n = [...entries]; n[i].reference = ev.target.value; setEntries(n); }} placeholder="UTR/Chq" className="w-24" /></td>
                    <td className="px-2 py-1"><InputNumber size="small" min={0} value={e.debit} onChange={v => { const n = [...entries]; n[i].debit = v || 0; setEntries(n); }} className="w-20" /></td>
                    <td className="px-2 py-1"><InputNumber size="small" min={0} value={e.credit} onChange={v => { const n = [...entries]; n[i].credit = v || 0; setEntries(n); }} className="w-20" /></td>
                    <td className="px-2 py-1"><Button type="text" size="small" danger onClick={() => setEntries(prev => prev.filter((_, idx) => idx !== i))}>✕</Button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {entries.length === 0 && <div className="text-center text-gray-400 py-4 bg-gray-50 rounded border border-dashed">No entries. Click "+ Add Entry" or paste from bank statement.</div>}
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" onClick={handleSubmit} loading={loading} icon={<BankOutlined />}>Create Reconciliation</Button>
        </div>
      </div>
    </Modal>
  );
};

export default BankReconciliationPage;
