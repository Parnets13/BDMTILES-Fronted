import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  CheckOutlined, CloseOutlined, EyeOutlined, PrinterOutlined
} from '@ant-design/icons';
import { Receipt } from 'lucide-react';
import api from '../../config/api.js';
import masterService from '../../services/masterService.js';
import hrmsService from '../../services/hrmsService.js';

const expService = {
  getAll:    (p) => api.get('/expenses', { params: p }),
  getStats:  ()  => api.get('/expenses/stats'),
  create:    (d) => api.post('/expenses', d),
  update:    (id, d) => api.put(`/expenses/${id}`, d),
  approve:   (id, d) => api.patch(`/expenses/${id}/approve`, d),
  reject:    (id, d) => api.patch(`/expenses/${id}/reject`, d),
  markPaid:  (id, d) => api.patch(`/expenses/${id}/pay`, d),
};

const STATUS_COLORS = {
  draft: 'default', submitted: 'blue', approved: 'green',
  rejected: 'red', paid: 'geekblue',
};

const PAYMENT_MODES = ['cash', 'bank_transfer', 'credit_card', 'petty_cash'];

const emptyForm = () => ({
  expenseDate: new Date().toISOString().split('T')[0],
  category: '', description: '', amount: 0,
  paymentMode: 'cash', receiptNumber: '', gstAmount: 0,
  employee: '', status: 'submitted',
});

const ExpenseManagement = () => {
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 25, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [categories, setCategories] = useState([]);
  const [employees, setEmployees] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);
  const [actionModal, setActionModal] = useState(null); // { type: 'approve'|'reject'|'pay', expense }
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        expService.getAll({ page, limit: 25, search, status: statusFilter, dateFrom, dateTo }),
        expService.getStats(),
      ]);
      if (listRes.success) {
        setExpenses(listRes.data || []);
        const pg = listRes.pagination;
        setPagination({ current: pg?.currentPage || page, pageSize: 25, total: pg?.totalItems || 0 });
      }
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    masterService.getExpenseCategories({ limit: 100 }).then(r => { if (r.success) setCategories(r.data || []); }).catch(() => {});
    hrmsService.getEmployees({ limit: 200, status: 'active' }).then(r => { if (r.success) setEmployees(r.data || []); }).catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!form.description.trim()) { message.error('Enter description'); return; }
    if (!form.amount || form.amount <= 0) { message.error('Enter amount'); return; }
    setCreateLoading(true);
    try {
      const res = await expService.create(form);
      if (res.success) {
        message.success(`Expense ${res.data.expenseNumber} created`);
        setShowCreate(false);
        setForm(emptyForm());
        load(1);
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setCreateLoading(false); }
  };

  const handleAction = async () => {
    setActionLoading(true);
    try {
      let res;
      if (actionModal.type === 'approve') res = await expService.approve(actionModal.expense._id, { notes: actionNote });
      if (actionModal.type === 'reject')  res = await expService.reject(actionModal.expense._id, { notes: actionNote });
      if (actionModal.type === 'pay')     res = await expService.markPaid(actionModal.expense._id, {});
      if (res?.success) {
        message.success(`${actionModal.type === 'approve' ? 'Approved' : actionModal.type === 'reject' ? 'Rejected' : 'Marked Paid'}`);
        setActionModal(null);
        load(1);
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setActionLoading(false); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const columns = [
    { title: 'Exp No.', dataIndex: 'expenseNumber', width: 110, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Date / Description',
      key: 'desc',
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.description}</div>
          <div className="text-xs text-gray-400">
            {r.expenseDate ? new Date(r.expenseDate).toLocaleDateString('en-IN') : ''} · {r.categoryName || '—'} · {r.employeeName || 'General'}
          </div>
        </div>
      ),
    },
    {
      title: 'Amount (₹)',
      dataIndex: 'amount',
      width: 110,
      render: v => <span className="font-bold">₹{(v||0).toLocaleString()}</span>,
    },
    {
      title: 'Mode',
      dataIndex: 'paymentMode',
      width: 110,
      render: v => <Tag color="blue" className="text-xs capitalize">{v?.replace(/_/g,' ')}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v}</Tag>,
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          {r.status === 'submitted' && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => { setActionModal({ type: 'approve', expense: r }); setActionNote(''); }}>
                Approve
              </Button>
              <Button size="small" danger icon={<CloseOutlined />}
                onClick={() => { setActionModal({ type: 'reject', expense: r }); setActionNote(''); }}>
                Reject
              </Button>
            </>
          )}
          {r.status === 'approved' && (
            <Button size="small" type="primary"
              style={{ background: '#722ed1', borderColor: '#722ed1' }}
              onClick={() => { setActionModal({ type: 'pay', expense: r }); setActionNote(''); }}>
              Mark Paid
            </Button>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewExpense(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Receipt size={22} className="text-orange-500" />
            Expense Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Record, approve and track all business expenses
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setShowCreate(true); setForm(emptyForm()); }}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Add Expense
          </Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total',        stats.total || 0,                                    '#1890ff'],
          ['Pending',      stats.pending || 0,                                  '#fa8c16'],
          ['Approved',     stats.approved || 0,                                 '#52c41a'],
          ['This Month',   `₹${(stats.monthTotal || 0).toLocaleString()}`,       '#FF5F03'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      {/* Top categories */}
      {stats.byCategory?.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500 self-center">Top categories:</span>
          {stats.byCategory.map(c => (
            <Tag key={c._id} color="blue">{c._id}: ₹{(c.total||0).toLocaleString()}</Tag>
          ))}
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input placeholder="Search description, number…" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} className="w-36"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))} />
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" /></div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={expenses} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          rowClassName={r => r.status === 'submitted' ? 'bg-blue-50' : ''}
          locale={{ emptyText: 'No expenses. Add the first one.' }}
        />
      </div>

      {/* Create Modal */}
      <Modal title="Add Expense" open={showCreate}
        onCancel={() => setShowCreate(false)} onOk={handleCreate}
        okText="Submit Expense" confirmLoading={createLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={520} destroyOnHidden>
        <Divider />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Date</label>
            <Input type="date" value={form.expenseDate} onChange={e => setF('expenseDate', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Category</label>
            <Select value={form.category} onChange={v => setF('category', v)} className="w-full" placeholder="Select category"
              options={categories.map(c => ({ value: c._id, label: c.name }))} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Description *</label>
            <Input value={form.description} onChange={e => setF('description', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Amount (₹) *</label>
            <InputNumber value={form.amount} onChange={v => setF('amount', v || 0)} prefix="₹" className="w-full" min={0} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">GST Amount (₹)</label>
            <InputNumber value={form.gstAmount} onChange={v => setF('gstAmount', v || 0)} prefix="₹" className="w-full" min={0} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Payment Mode</label>
            <Select value={form.paymentMode} onChange={v => setF('paymentMode', v)} className="w-full"
              options={PAYMENT_MODES.map(m => ({ value: m, label: m.replace(/_/g, ' ') }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Receipt No.</label>
            <Input value={form.receiptNumber} onChange={e => setF('receiptNumber', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="text-xs text-gray-500 block mb-1">Employee (if claimable)</label>
            <Select value={form.employee} onChange={v => setF('employee', v)} className="w-full"
              allowClear placeholder="Select employee (optional)"
              options={employees.map(e => ({ value: e._id, label: e.name }))} />
          </div>
        </div>
      </Modal>

      {/* Approve / Reject / Pay Modal */}
      <Modal
        title={`${actionModal?.type === 'approve' ? 'Approve' : actionModal?.type === 'reject' ? 'Reject' : 'Mark Paid'} — ${actionModal?.expense?.expenseNumber}`}
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={handleAction}
        confirmLoading={actionLoading}
        okText={actionModal?.type === 'approve' ? 'Approve' : actionModal?.type === 'reject' ? 'Reject' : 'Mark Paid'}
        okButtonProps={{ style: { background: actionModal?.type === 'reject' ? '#dc2626' : actionModal?.type === 'pay' ? '#722ed1' : '#52c41a', borderColor: 'transparent' } }}
        destroyOnHidden>
        <Divider />
        {actionModal?.expense && (
          <div className="space-y-3">
            <div className="bg-gray-50 p-3 rounded text-sm">
              <div className="font-semibold">{actionModal.expense.description}</div>
              <div className="text-orange-600 font-bold text-lg">₹{(actionModal.expense.amount||0).toLocaleString()}</div>
            </div>
            {actionModal.type !== 'pay' && (
              <div>
                <label className="text-xs text-gray-500 block mb-1">Notes</label>
                <Input.TextArea rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* View Modal */}
      <Modal title={viewExpense?.expenseNumber} open={!!viewExpense}
        onCancel={() => setViewExpense(null)}
        footer={[<Button key="c" onClick={() => setViewExpense(null)}>Close</Button>]} width={480}>
        {viewExpense && (
          <div className="space-y-2 text-sm">
            {[
              ['Date',          new Date(viewExpense.expenseDate).toLocaleDateString('en-IN')],
              ['Category',      viewExpense.categoryName || '—'],
              ['Description',   viewExpense.description],
              ['Amount',        `₹${(viewExpense.amount||0).toLocaleString()}`],
              ['GST',           `₹${(viewExpense.gstAmount||0).toLocaleString()}`],
              ['Payment Mode',  viewExpense.paymentMode?.replace(/_/g,' ')],
              ['Receipt No.',   viewExpense.receiptNumber || '—'],
              ['Employee',      viewExpense.employeeName || '—'],
              ['Status',        <Tag color={STATUS_COLORS[viewExpense.status]} className="capitalize">{viewExpense.status}</Tag>],
              ['Approval Notes',viewExpense.approvalNotes || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ExpenseManagement;
