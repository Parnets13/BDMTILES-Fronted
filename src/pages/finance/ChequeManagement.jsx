import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Col, Descriptions, Input, InputNumber, Modal,
  Row, Select, Space, Spin, Statistic, Table, Tag, Tooltip, message,
} from 'antd';
import {
  BankOutlined, CheckCircleOutlined, CloseCircleOutlined, EyeOutlined,
  PlusOutlined, RedoOutlined, ReloadOutlined, SearchOutlined, UndoOutlined,
} from '@ant-design/icons';
import financeService from '../../services/financeService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const STATUS_COLORS = {
  received: 'blue', issued: 'gold', deposited: 'orange', cleared: 'green',
  bounced: 'red', cancelled: 'default', returned: 'volcano', re_deposited: 'geekblue',
};

const today = () => new Date().toISOString().slice(0, 10);
const money = value => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const formatDate = value => (value ? new Date(value).toLocaleDateString('en-IN') : '—');
const statusLabel = value => String(value || '—').replace(/_/g, ' ');

const initialForm = () => ({
  chequeType: 'received', chequeNumber: '', chequeDate: '', amount: null,
  bankName: '', branchName: '', accountNumber: '', ifscCode: '', accountHolderName: '',
  micr: '', dealer: '', supplier: '', payment: '', remarks: '', isPDC: false,
  pdcDueDate: '', isSecurityCheque: false, securityFor: '', chequeFrontImage: '',
  chequeBackImage: '',
});

const actionPermission = {
  deposit: 'cheque.deposit', clear: 'cheque.clear', bounce: 'cheque.bounce',
  return: 'cheque.return', reDeposit: 'cheque.return',
};

const actionTitle = {
  deposit: 'Deposit', clear: 'Clear', bounce: 'Bounce', return: 'Return',
  reDeposit: 'Re-deposit',
};

const ChequeManagement = () => {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('cheque.create');
  const [cheques, setCheques] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [typeFilter, setTypeFilter] = useState(undefined);

  const [dealers, setDealers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [linkablePayments, setLinkablePayments] = useState([]);
  const [linkableLoading, setLinkableLoading] = useState(false);

  const [viewCheque, setViewCheque] = useState(null);
  const [viewLoadingId, setViewLoadingId] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionData, setActionData] = useState({});
  const [actionLoading, setActionLoading] = useState(false);
  const [replacementPayments, setReplacementPayments] = useState([]);
  const [replacementLoading, setReplacementLoading] = useState(false);

  const loadStats = useCallback(() => {
    financeService.getChequeStats()
      .then(response => { if (response.success) setStats(response.data); })
      .catch(() => {});
  }, []);

  const fetchCheques = useCallback(async () => {
    setLoading(true);
    try {
      const response = await financeService.getCheques({
        page: pagination.current,
        limit: pagination.pageSize,
        search: search || undefined,
        status: statusFilter,
        chequeType: typeFilter,
      });
      if (response.success) {
        setCheques(response.data);
        setPagination(current => ({ ...current, total: response.pagination?.totalItems || 0 }));
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, statusFilter, typeFilter]);

  useEffect(() => {
    loadStats();
    masterService.getDealers({ limit: 100, status: 'active' })
      .then(response => { if (response.success) setDealers(response.data); }).catch(() => {});
    masterService.getSuppliers({ limit: 100, status: 'active' })
      .then(response => { if (response.success) setSuppliers(response.data); }).catch(() => {});
  }, [loadStats]);

  useEffect(() => { fetchCheques(); }, [fetchCheques]);

  useEffect(() => {
    const partyId = form.chequeType === 'received' ? form.dealer : form.supplier;
    if (!showCreate || !partyId || !canCreate) {
      setLinkablePayments([]);
      return;
    }
    let active = true;
    setLinkableLoading(true);
    financeService.getLinkableChequePayments({
      chequeType: form.chequeType,
      ...(form.chequeType === 'received' ? { dealer: partyId } : { supplier: partyId }),
    }).then(response => {
      if (active && response.success) setLinkablePayments(response.data || []);
    }).catch(() => {
      if (active) setLinkablePayments([]);
    }).finally(() => { if (active) setLinkableLoading(false); });
    return () => { active = false; };
  }, [showCreate, canCreate, form.chequeType, form.dealer, form.supplier]);

  const resetForm = () => {
    setForm(initialForm());
    setLinkablePayments([]);
  };

  const selectLinkedPayment = paymentId => {
    const payment = linkablePayments.find(item => item._id === paymentId);
    if (!payment) {
      setForm(current => ({ ...current, payment: '' }));
      return;
    }
    setForm(current => ({
      ...current,
      payment: payment._id,
      chequeNumber: payment.chequeNumber || '',
      chequeDate: payment.chequeDate ? String(payment.chequeDate).slice(0, 10) : '',
      amount: payment.amount,
      bankName: payment.bankName || '',
    }));
  };

  const handleCreate = async () => {
    if (!form.chequeNumber.trim()) return message.error('Enter cheque number.');
    if (!form.chequeDate) return message.error('Select cheque date.');
    if (!Number.isFinite(Number(form.amount)) || Number(form.amount) <= 0) return message.error('Enter a positive amount.');
    if (!form.bankName.trim()) return message.error('Enter bank name.');
    if (form.chequeType === 'received' && !form.dealer) return message.error('Select the dealer.');
    if (form.chequeType === 'issued' && !form.supplier) return message.error('Select the supplier.');
    if (form.isPDC && !form.pdcDueDate) return message.error('Select the PDC due date.');

    setCreateLoading(true);
    try {
      const payload = {
        ...form,
        amount: Number(form.amount),
        dealer: form.chequeType === 'received' ? form.dealer : undefined,
        supplier: form.chequeType === 'issued' ? form.supplier : undefined,
        payment: form.payment || undefined,
        pdcDueDate: form.isPDC ? form.pdcDueDate : undefined,
        securityFor: form.isSecurityCheque ? form.securityFor : '',
      };
      const response = await financeService.createCheque(payload);
      if (response.success) {
        message.success(response.message);
        setShowCreate(false);
        resetForm();
        fetchCheques();
        loadStats();
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openDetail = async record => {
    setViewLoadingId(record._id);
    try {
      const response = await financeService.getCheque(record._id);
      if (response.success) setViewCheque(response.data);
    } catch (error) {
      message.error(error.message);
    } finally {
      setViewLoadingId(null);
    }
  };

  const openAction = async (type, cheque) => {
    const dateField = {
      deposit: 'depositedDate', clear: 'clearedDate', bounce: 'bounceDate',
      return: 'returnedDate', reDeposit: 'reDepositDate',
    }[type];
    setActionModal({ type, cheque });
    setActionData({ [dateField]: today(), charges: 0 });
    setReplacementPayments([]);
    if (type === 'reDeposit' && cheque.payment) {
      setReplacementLoading(true);
      try {
        const response = await financeService.getChequeReDepositCandidates(cheque._id);
        if (response.success) setReplacementPayments(response.data || []);
      } catch (error) {
        message.error(error.message);
      } finally {
        setReplacementLoading(false);
      }
    }
  };

  const validateAction = () => {
    const { type, cheque } = actionModal;
    const requiredDateField = {
      deposit: 'depositedDate', clear: 'clearedDate', bounce: 'bounceDate',
      return: 'returnedDate', reDeposit: 'reDepositDate',
    }[type];
    if (!actionData[requiredDateField]) return `${actionTitle[type]} date is required.`;
    if (['deposit', 'reDeposit'].includes(type) && !String(actionData.depositedBank || '').trim()) {
      return 'Deposited-to bank is required.';
    }
    if (['bounce', 'return', 'reDeposit'].includes(type) && !String(actionData.reason || '').trim()) {
      return 'Reason is required.';
    }
    if (type === 'bounce' && (!Number.isFinite(Number(actionData.charges)) || Number(actionData.charges) < 0)) {
      return 'Charges must be a finite nonnegative amount.';
    }
    if (type === 'reDeposit' && cheque.payment && !actionData.replacementPayment) {
      return 'Select a distinct new pending replacement Payment. The bounced Payment cannot be reused.';
    }
    return null;
  };

  const handleAction = async () => {
    const validationError = validateAction();
    if (validationError) return message.error(validationError);
    setActionLoading(true);
    try {
      const { type, cheque } = actionModal;
      const methods = {
        deposit: financeService.depositCheque,
        clear: financeService.clearCheque,
        bounce: financeService.bounceCheque,
        return: financeService.returnCheque,
        reDeposit: financeService.reDepositCheque,
      };
      const response = await methods[type](cheque._id, {
        ...actionData,
        charges: type === 'bounce' ? Number(actionData.charges || 0) : undefined,
      });
      if (response.success) {
        message.success(response.message);
        setActionModal(null);
        setActionData({});
        fetchCheques();
        loadStats();
        if (viewCheque?._id === cheque._id) {
          const detail = await financeService.getCheque(cheque._id);
          if (detail.success) setViewCheque(detail.data);
        }
      }
    } catch (error) {
      message.error(error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const allowed = (record, action) => {
    const transitions = record.allowedActions || [];
    return transitions.includes(action) && hasPermission(actionPermission[action]);
  };

  const renderActionButton = (record, action) => {
    if (!allowed(record, action)) return null;
    const config = {
      deposit: { icon: <BankOutlined />, color: 'text-orange-500', tip: 'Deposit' },
      clear: { icon: <CheckCircleOutlined />, color: 'text-green-600', tip: 'Clear' },
      bounce: { icon: <CloseCircleOutlined />, color: 'text-red-500', tip: 'Bounce' },
      return: { icon: <UndoOutlined />, color: 'text-volcano-500', tip: 'Return' },
      reDeposit: { icon: <RedoOutlined />, color: 'text-blue-600', tip: 'Re-deposit' },
    }[action];
    return (
      <Tooltip key={action} title={config.tip}>
        <Button type="text" size="small" icon={config.icon} className={config.color}
          onClick={() => openAction(action, record)} />
      </Tooltip>
    );
  };

  const columns = [
    {
      title: 'Cheque #', dataIndex: 'chequeNumber', width: 125,
      render: value => <span className="font-mono text-sm font-semibold">{value}</span>,
    },
    { title: 'Date', dataIndex: 'chequeDate', width: 105, render: value => <span className="text-xs">{formatDate(value)}</span> },
    {
      title: 'Party', key: 'party', width: 185,
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[175px]">{record.partyName || '—'}</div>
          <div className="text-xs text-gray-400">{record.chequeType === 'received' ? 'From dealer' : 'To supplier'}</div>
        </div>
      ),
    },
    { title: 'Bank', dataIndex: 'bankName', width: 140, render: value => <span className="text-xs">{value}</span> },
    { title: 'Amount', dataIndex: 'amount', width: 115, render: value => <span className="font-semibold">{money(value)}</span> },
    { title: 'Type', dataIndex: 'chequeType', width: 90, render: value => <Tag color={value === 'received' ? 'blue' : 'orange'}>{value}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 115, render: value => <Tag color={STATUS_COLORS[value]}>{statusLabel(value)}</Tag> },
    {
      title: 'Payment', key: 'payment', width: 130,
      render: (_, record) => record.payment
        ? <div><div className="text-xs font-medium">{record.payment.paymentNumber}</div><Tag color={record.payment.status === 'confirmed' ? 'green' : record.payment.status === 'bounced' ? 'red' : 'gold'}>{record.payment.status}</Tag></div>
        : <span className="text-xs text-gray-400">Standalone</span>,
    },
    {
      title: 'Actions', width: 190, fixed: 'right',
      render: (_, record) => (
        <Space size={0}>
          <Tooltip title="View authoritative detail">
            <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500"
              loading={viewLoadingId === record._id} onClick={() => openDetail(record)} />
          </Tooltip>
          {['deposit', 'clear', 'bounce', 'return', 'reDeposit'].map(action => renderActionButton(record, action))}
        </Space>
      ),
    },
  ];

  const actionAccountingMessage = () => {
    if (!actionModal) return '';
    const { type, cheque } = actionModal;
    const payment = cheque.payment;
    if (!payment) return `This is a standalone cheque. ${actionTitle[type]} will not post, apply, or reverse any ledger/accounting entry.`;
    if (type === 'deposit') return 'Deposit records physical presentation only. Accounting remains pending until clearance.';
    if (type === 'clear') return payment.status === 'confirmed'
      ? `Payment ${payment.paymentNumber} is already confirmed; clearance will not post accounting twice.`
      : `Clearance will atomically confirm Payment ${payment.paymentNumber} and apply its allocations/accounting.`;
    if (type === 'bounce') return payment.status === 'confirmed'
      ? `Bounce will atomically reverse Payment ${payment.paymentNumber} accounting and record eligible charges.`
      : `Payment ${payment.paymentNumber} has no confirmed accounting to reverse; both records will become bounced.`;
    if (type === 'return') return `Return will safely close pending Payment ${payment.paymentNumber}; confirmed Payments cannot be returned through this action.`;
    return `Payment ${payment.paymentNumber} remains permanently bounced. Select a distinct new pending Payment; it will only post on a later clearance.`;
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Cheque Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Branch-scoped receipt, issue, deposit, clearance, bounce, return, and re-deposit controls</p>
        </div>
        {canCreate && (
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>
            Add Cheque
          </Button>
        )}
      </div>

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} md={4}><Card size="small"><Statistic title="Received" value={stats.received || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Deposited" value={stats.deposited || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Cleared" value={stats.cleared || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Bounced" value={stats.bounced || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total Received" value={money(stats.totalReceived)} /></Card></Col>
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total Cleared" value={money(stats.totalCleared)} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search cheque, payment, party, bank" prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={event => { setSearch(event.target.value); setPagination(current => ({ ...current, current: 1 })); }}
            className="w-72" allowClear />
          <Select placeholder="Status" allowClear value={statusFilter}
            onChange={value => { setStatusFilter(value); setPagination(current => ({ ...current, current: 1 })); }} className="w-40"
            options={Object.keys(STATUS_COLORS).map(status => ({ value: status, label: statusLabel(status) }))} />
          <Select placeholder="Type" allowClear value={typeFilter}
            onChange={value => { setTypeFilter(value); setPagination(current => ({ ...current, current: 1 })); }} className="w-40"
            options={[{ value: 'received', label: 'Received' }, { value: 'issued', label: 'Issued' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); setTypeFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={cheques} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1200 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (total, range) => `${range[0]}-${range[1]} of ${total}` }}
          onChange={page => setPagination(current => ({ ...current, current: page.current, pageSize: page.pageSize }))} />
      </div>

      <Modal title="Add Cheque" open={showCreate} width={720} confirmLoading={createLoading} okText="Save Cheque"
        onOk={handleCreate} onCancel={() => { setShowCreate(false); resetForm(); }} destroyOnHidden>
        <div className="space-y-3 mt-4">
          <Alert type="info" showIcon message="Link a pending cheque Payment to make clearance and bounce accounting authoritative. Standalone cheques never affect the ledger." />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Cheque Type *</label>
              <Select className="w-full" value={form.chequeType} onChange={value => setForm(current => ({ ...initialForm(), chequeType: value }))}
                options={[{ value: 'received', label: 'Received from dealer' }, { value: 'issued', label: 'Issued to supplier' }]} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">{form.chequeType === 'received' ? 'Dealer' : 'Supplier'} *</label>
              {form.chequeType === 'received' ? (
                <Select className="w-full" showSearch optionFilterProp="label" placeholder="Select dealer" value={form.dealer || undefined}
                  onChange={value => setForm(current => ({ ...current, dealer: value, payment: '' }))}
                  options={dealers.map(dealer => ({ value: dealer._id, label: `${dealer.businessName} (${dealer.dealerCode})` }))} />
              ) : (
                <Select className="w-full" showSearch optionFilterProp="label" placeholder="Select supplier" value={form.supplier || undefined}
                  onChange={value => setForm(current => ({ ...current, supplier: value, payment: '' }))}
                  options={suppliers.map(supplier => ({ value: supplier._id, label: `${supplier.companyName} (${supplier.supplierCode})` }))} />
              )}</div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Linked pending Payment (optional)</label>
            <Select className="w-full" allowClear showSearch optionFilterProp="label" loading={linkableLoading}
              placeholder="Select matching branch Payment or leave standalone" value={form.payment || undefined} onChange={selectLinkedPayment}
              options={linkablePayments.map(payment => ({
                value: payment._id,
                label: `${payment.paymentNumber} · Cheque ${payment.chequeNumber} · ${money(payment.amount)} · ${formatDate(payment.chequeDate)}`,
              }))} notFoundContent={linkableLoading ? <Spin size="small" /> : 'No matching unlinked pending Payments'} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Cheque No. *</label><Input value={form.chequeNumber} onChange={event => setForm(current => ({ ...current, chequeNumber: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Cheque Date *</label><Input type="date" value={form.chequeDate} onChange={event => setForm(current => ({ ...current, chequeDate: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Amount *</label><InputNumber className="w-full" min={0.01} precision={2} value={form.amount} onChange={value => setForm(current => ({ ...current, amount: value }))} prefix="₹" /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Drawer Bank *</label><Input value={form.bankName} onChange={event => setForm(current => ({ ...current, bankName: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Drawer Branch</label><Input value={form.branchName} onChange={event => setForm(current => ({ ...current, branchName: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Account Holder</label><Input value={form.accountHolderName} onChange={event => setForm(current => ({ ...current, accountHolderName: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Account Number</label><Input value={form.accountNumber} onChange={event => setForm(current => ({ ...current, accountNumber: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">IFSC</label><Input value={form.ifscCode} onChange={event => setForm(current => ({ ...current, ifscCode: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">MICR</label><Input value={form.micr} onChange={event => setForm(current => ({ ...current, micr: event.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Front Image URL</label><Input value={form.chequeFrontImage} onChange={event => setForm(current => ({ ...current, chequeFrontImage: event.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Back Image URL</label><Input value={form.chequeBackImage} onChange={event => setForm(current => ({ ...current, chequeBackImage: event.target.value }))} /></div>
          </div>
          <div className="flex flex-wrap gap-5">
            <Checkbox checked={form.isPDC} onChange={event => setForm(current => ({ ...current, isPDC: event.target.checked }))}>Post-dated cheque</Checkbox>
            <Checkbox checked={form.isSecurityCheque} onChange={event => setForm(current => ({ ...current, isSecurityCheque: event.target.checked }))}>Security cheque</Checkbox>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {form.isPDC && <div><label className="text-xs text-gray-500 block mb-1">PDC Due Date *</label><Input type="date" value={form.pdcDueDate} onChange={event => setForm(current => ({ ...current, pdcDueDate: event.target.value }))} /></div>}
            {form.isSecurityCheque && <div><label className="text-xs text-gray-500 block mb-1">Security Purpose</label><Input value={form.securityFor} onChange={event => setForm(current => ({ ...current, securityFor: event.target.value }))} /></div>}
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Remarks</label><Input.TextArea rows={2} value={form.remarks} onChange={event => setForm(current => ({ ...current, remarks: event.target.value }))} /></div>
        </div>
      </Modal>

      {actionModal && (
        <Modal title={`${actionTitle[actionModal.type]} Cheque #${actionModal.cheque.chequeNumber}`} open
          onCancel={() => { setActionModal(null); setActionData({}); }} onOk={handleAction}
          confirmLoading={actionLoading} okText={actionTitle[actionModal.type]}
          okButtonProps={{ danger: ['bounce', 'return'].includes(actionModal.type) }}>
          <div className="space-y-3 mt-4 text-sm">
            <div className="bg-gray-50 p-3 rounded border">
              <div>Party: <strong>{actionModal.cheque.partyName}</strong></div>
              <div>Amount: <strong className="text-blue-700">{money(actionModal.cheque.amount)}</strong></div>
              <div>Current status: <Tag color={STATUS_COLORS[actionModal.cheque.status]}>{statusLabel(actionModal.cheque.status)}</Tag></div>
            </div>
            <Alert type={actionModal.cheque.payment ? 'warning' : 'info'} showIcon message={actionAccountingMessage()} />

            {['deposit', 'reDeposit'].includes(actionModal.type) && (
              <>
                <div><label className="text-xs text-gray-500 block mb-1">{actionModal.type === 'deposit' ? 'Deposited' : 'Re-deposit'} Date *</label>
                  <Input type="date" value={actionData[actionModal.type === 'deposit' ? 'depositedDate' : 'reDepositDate']}
                    onChange={event => setActionData(current => ({ ...current, [actionModal.type === 'deposit' ? 'depositedDate' : 'reDepositDate']: event.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Deposited To Bank *</label><Input value={actionData.depositedBank || ''} onChange={event => setActionData(current => ({ ...current, depositedBank: event.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">Bank Branch</label><Input value={actionData.depositedBranch || ''} onChange={event => setActionData(current => ({ ...current, depositedBranch: event.target.value }))} /></div>
                  <div><label className="text-xs text-gray-500 block mb-1">Account Number</label><Input value={actionData.depositedAccountNumber || ''} onChange={event => setActionData(current => ({ ...current, depositedAccountNumber: event.target.value }))} /></div>
                </div>
                <div><label className="text-xs text-gray-500 block mb-1">Deposit Slip Number</label><Input value={actionData.depositSlipNumber || ''} onChange={event => setActionData(current => ({ ...current, depositSlipNumber: event.target.value }))} /></div>
              </>
            )}
            {actionModal.type === 'clear' && (
              <>
                <div><label className="text-xs text-gray-500 block mb-1">Cleared Date *</label><Input type="date" value={actionData.clearedDate} onChange={event => setActionData(current => ({ ...current, clearedDate: event.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Clearance Reference</label><Input value={actionData.clearanceReference || ''} onChange={event => setActionData(current => ({ ...current, clearanceReference: event.target.value }))} /></div>
              </>
            )}
            {actionModal.type === 'bounce' && (
              <>
                <div><label className="text-xs text-gray-500 block mb-1">Bounce Date *</label><Input type="date" value={actionData.bounceDate} onChange={event => setActionData(current => ({ ...current, bounceDate: event.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Bounce Reason *</label><Input.TextArea rows={2} value={actionData.reason || ''} onChange={event => setActionData(current => ({ ...current, reason: event.target.value }))} /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Bank Charges</label><InputNumber min={0} precision={2} value={actionData.charges} className="w-full" prefix="₹" onChange={value => setActionData(current => ({ ...current, charges: value ?? 0 }))} /></div>
              </>
            )}
            {['return', 'reDeposit'].includes(actionModal.type) && (
              <div><label className="text-xs text-gray-500 block mb-1">Reason *</label><Input.TextArea rows={2} value={actionData.reason || ''} onChange={event => setActionData(current => ({ ...current, reason: event.target.value }))} /></div>
            )}
            {actionModal.type === 'return' && (
              <div><label className="text-xs text-gray-500 block mb-1">Returned Date *</label><Input type="date" value={actionData.returnedDate} onChange={event => setActionData(current => ({ ...current, returnedDate: event.target.value }))} /></div>
            )}
            {actionModal.type === 'reDeposit' && actionModal.cheque.payment && (
              <div><label className="text-xs text-gray-500 block mb-1">New Pending Replacement Payment *</label>
                <Select className="w-full" loading={replacementLoading} value={actionData.replacementPayment}
                  onChange={value => setActionData(current => ({ ...current, replacementPayment: value }))}
                  options={replacementPayments.map(payment => ({ value: payment._id, label: `${payment.paymentNumber} · ${money(payment.amount)} · ${formatDate(payment.paymentDate)}` }))}
                  notFoundContent={replacementLoading ? <Spin size="small" /> : 'Create a new matching pending Payment before re-depositing'} /></div>
            )}
          </div>
        </Modal>
      )}

      {viewCheque && (
        <Modal title={`Cheque #${viewCheque.chequeNumber}`} open width={820} onCancel={() => setViewCheque(null)}
          footer={<Button onClick={() => setViewCheque(null)}>Close</Button>}>
          <div className="space-y-4 mt-4 text-sm">
            <Alert type={viewCheque.payment ? 'info' : 'warning'} showIcon message={viewCheque.accountingSummary} />
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Party">{viewCheque.partyName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Type"><Tag color={viewCheque.chequeType === 'received' ? 'blue' : 'orange'}>{viewCheque.chequeType}</Tag></Descriptions.Item>
              <Descriptions.Item label="Cheque Date">{formatDate(viewCheque.chequeDate)}</Descriptions.Item>
              <Descriptions.Item label="Amount">{money(viewCheque.amount)}</Descriptions.Item>
              <Descriptions.Item label="Drawer Bank">{viewCheque.bankName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Drawer Branch">{viewCheque.branchName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Account Holder">{viewCheque.accountHolderName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Account Number">{viewCheque.accountNumber || '—'}</Descriptions.Item>
              <Descriptions.Item label="IFSC / MICR">{[viewCheque.ifscCode, viewCheque.micr].filter(Boolean).join(' / ') || '—'}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLORS[viewCheque.status]}>{statusLabel(viewCheque.status)}</Tag></Descriptions.Item>
              <Descriptions.Item label="Created By">{viewCheque.createdBy?.name || viewCheque.createdByName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Allowed Next Actions">{viewCheque.allowedActions?.length ? viewCheque.allowedActions.map(action => <Tag key={action}>{actionTitle[action]}</Tag>) : 'None'}</Descriptions.Item>
            </Descriptions>

            {(viewCheque.isPDC || viewCheque.isSecurityCheque) && (
              <div className="flex flex-wrap gap-2">
                {viewCheque.isPDC && <Tag color="purple">Post-dated · Due {formatDate(viewCheque.pdcDueDate)}</Tag>}
                {viewCheque.isSecurityCheque && <Tag color="geekblue">Security · {viewCheque.securityFor || 'Purpose not specified'}</Tag>}
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Lifecycle Details</h4>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Deposited Date">{formatDate(viewCheque.depositedDate)}</Descriptions.Item>
                <Descriptions.Item label="Deposited To">{[viewCheque.depositedBank, viewCheque.depositedBranch].filter(Boolean).join(' · ') || '—'}</Descriptions.Item>
                <Descriptions.Item label="Deposit Account">{viewCheque.depositedAccountNumber || '—'}</Descriptions.Item>
                <Descriptions.Item label="Deposit Slip">{viewCheque.depositSlipNumber || '—'}</Descriptions.Item>
                <Descriptions.Item label="Cleared Date">{formatDate(viewCheque.clearedDate)}</Descriptions.Item>
                <Descriptions.Item label="Clearance Reference">{viewCheque.clearanceReference || '—'}</Descriptions.Item>
                <Descriptions.Item label="Bounce Date">{formatDate(viewCheque.bounceDate)}</Descriptions.Item>
                <Descriptions.Item label="Bounce Reason">{viewCheque.bounceReason || '—'}</Descriptions.Item>
                <Descriptions.Item label="Bounce Charges / Count">{money(viewCheque.bounceCharges)} / {viewCheque.bounceCount || 0}</Descriptions.Item>
                <Descriptions.Item label="Re-deposit Date / Count">{formatDate(viewCheque.reDepositDate)} / {viewCheque.reDepositCount || 0}</Descriptions.Item>
                <Descriptions.Item label="Returned Date">{formatDate(viewCheque.returnedDate)}</Descriptions.Item>
                <Descriptions.Item label="Return Reason">{viewCheque.returnReason || '—'}</Descriptions.Item>
              </Descriptions>
            </div>

            {viewCheque.payment && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Authoritative Linked Payment</h4>
                <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                  <Descriptions.Item label="Payment Number">{viewCheque.payment.paymentNumber}</Descriptions.Item>
                  <Descriptions.Item label="Status"><Tag color={viewCheque.payment.status === 'confirmed' ? 'green' : viewCheque.payment.status === 'bounced' ? 'red' : 'gold'}>{viewCheque.payment.status}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Direction">{statusLabel(viewCheque.payment.paymentType)}</Descriptions.Item>
                  <Descriptions.Item label="Payment Date">{formatDate(viewCheque.payment.paymentDate)}</Descriptions.Item>
                  <Descriptions.Item label="Mode / Amount">{viewCheque.payment.paymentMode} · {money(viewCheque.payment.amount)}</Descriptions.Item>
                  <Descriptions.Item label="Cheque / Bank">{viewCheque.payment.chequeNumber} · {viewCheque.payment.bankName || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Transaction Ref">{viewCheque.payment.transactionRef || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Created By">{viewCheque.payment.createdBy?.name || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Bounce Detail" span={2}>{viewCheque.payment.bounceReason ? `${viewCheque.payment.bounceReason} · ${money(viewCheque.payment.bounceCharges)}` : '—'}</Descriptions.Item>
                </Descriptions>
                {viewCheque.payment.againstOrders?.length > 0 && (
                  <div className="mt-2 border rounded p-2">
                    <div className="text-xs font-semibold text-gray-600 mb-1">Allocations</div>
                    {viewCheque.payment.againstOrders.map((allocation, index) => (
                      <div key={`${allocation.order?._id || allocation.order}-${index}`} className="text-xs flex justify-between py-1 border-b last:border-b-0">
                        <span>{allocation.orderNumber || allocation.order?.invoiceNumber || allocation.order?.invoiceRefNumber || 'Reference'} ({allocation.orderModel})</span>
                        <strong>{money(allocation.allocatedAmount)}</strong>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {(viewCheque.chequeFrontImage || viewCheque.chequeBackImage) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Cheque Images</h4>
                <div className="flex gap-3">
                  {viewCheque.chequeFrontImage && <a href={viewCheque.chequeFrontImage} target="_blank" rel="noreferrer"><img src={viewCheque.chequeFrontImage} alt="Cheque front" className="w-48 h-28 object-cover rounded border" /></a>}
                  {viewCheque.chequeBackImage && <a href={viewCheque.chequeBackImage} target="_blank" rel="noreferrer"><img src={viewCheque.chequeBackImage} alt="Cheque back" className="w-48 h-28 object-cover rounded border" /></a>}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Audit Timeline</h4>
              <div className="space-y-2 max-h-56 overflow-y-auto border rounded p-3">
                {(viewCheque.timeline || []).map((entry, index) => (
                  <div key={`${entry.date}-${index}`} className="border-l-2 border-blue-300 pl-3 text-xs">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span className="font-medium capitalize">{statusLabel(entry.action)}</span>
                      <span className="text-gray-400">{formatDate(entry.date)}</span>
                      <span className="text-gray-500">by {entry.performedBy?.name || entry.performedByName || 'Unknown user'}</span>
                      {entry.referenceNumber && <Tag>{entry.referenceModel}: {entry.referenceNumber}</Tag>}
                    </div>
                    <div className="text-gray-600 mt-1">{entry.notes || 'No notes recorded'}</div>
                    {(entry.previousStatus || entry.newStatus) && <div className="text-gray-400 mt-0.5">{entry.previousStatus || 'new'} → {entry.newStatus || '—'}</div>}
                  </div>
                ))}
              </div>
            </div>
            {viewCheque.remarks && <div className="text-xs text-gray-600 bg-yellow-50 border border-yellow-100 rounded p-2">Remarks: {viewCheque.remarks}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default ChequeManagement;
