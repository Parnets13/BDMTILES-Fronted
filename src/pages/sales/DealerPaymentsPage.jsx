import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, InputNumber, Divider, Tooltip, Checkbox } from 'antd';
import { PlusOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, ExclamationCircleOutlined, WalletOutlined, RiseOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { createIdempotencyKey } from '../../config/api.js';

const STATUS_COLORS = { pending: 'orange', confirmed: 'green', bounced: 'red', cancelled: 'default' };
const MODE_COLORS = { cash: 'green', cheque: 'blue', upi: 'purple', neft: 'cyan', rtgs: 'geekblue', card: 'magenta', adjustment: 'default' };

const DealerPaymentsPage = () => {
  const paymentSubmissionKey = useRef(createIdempotencyKey());
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, paymentMode: undefined });
  const [stats, setStats] = useState({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Dealer search
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerResults, setDealerResults] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: 0, paymentMode: 'cash', bankName: '', chequeNumber: '', chequeDate: '', transactionRef: '', remarks: '',
  });

  // Allocation
  const [dealerOrders, setDealerOrders] = useState([]);
  const [allocations, setAllocations] = useState([]);

  useEffect(() => {
    salesService.getPaymentStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, paymentType: 'dealer_receipt', ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const res = await salesService.getPayments(params);
      if (res.success) {
        setPayments(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  // Dealer search
  useEffect(() => {
    if (dealerSearch.length < 2) { setDealerResults([]); return; }
    const t = setTimeout(() => {
      salesService.searchDealers(dealerSearch).then(r => { if (r.success) setDealerResults(r.data); });
    }, 300);
    return () => clearTimeout(t);
  }, [dealerSearch]);

  const handleSelectDealer = async (dealer) => {
    setSelectedDealer(dealer);
    setDealerSearch('');
    setShowDealerDropdown(false);
    setDealerResults([]);
    setAllocations([]);
    try {
      const res = await salesService.getDealerOrders(dealer._id);
      if (res.success) {
        setDealerOrders(res.data);
        setAllocations(res.data.map(o => ({ order: o._id, orderNumber: o.orderNumber, balance: o.balanceAmount, allocatedAmount: 0, selected: false })));
      }
    } catch (e) { message.error(e.message); }
  };

  const updateAllocation = (idx, field, value) => {
    setAllocations(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const autoAllocate = () => {
    let remaining = paymentForm.amount;
    setAllocations(prev => prev.map(a => {
      if (remaining <= 0) return { ...a, allocatedAmount: 0, selected: false };
      const alloc = Math.min(remaining, a.balance);
      remaining -= alloc;
      return { ...a, allocatedAmount: alloc, selected: alloc > 0 };
    }));
  };

  const handleCreatePayment = async () => {
    if (!selectedDealer) { message.error('Select a dealer'); return; }
    if (!paymentForm.amount || paymentForm.amount <= 0) { message.error('Enter a valid amount'); return; }

    setCreateLoading(true);
    try {
      const selectedAllocations = allocations.filter(a => a.allocatedAmount > 0);
      const payload = {
        paymentType: 'dealer_receipt',
        dealer: selectedDealer._id,
        amount: paymentForm.amount,
        paymentMode: paymentForm.paymentMode,
        bankName: paymentForm.bankName,
        chequeNumber: paymentForm.chequeNumber,
        chequeDate: paymentForm.chequeDate || undefined,
        transactionRef: paymentForm.transactionRef,
        remarks: paymentForm.remarks,
        againstOrders: selectedAllocations.map(a => ({
          order: a.order, orderModel: 'SalesOrder', orderNumber: a.orderNumber, allocatedAmount: a.allocatedAmount,
        })),
      };
      const res = await salesService.createPayment(payload, paymentSubmissionKey.current);
      if (res.success) {
        paymentSubmissionKey.current = createIdempotencyKey();
        message.success(`Payment ${res.data.paymentNumber} recorded!`);
        setShowCreate(false);
        resetForm();
        fetchPayments();
        salesService.getPaymentStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleConfirm = async (id) => {
    try {
      const res = await salesService.confirmPayment(id);
      if (res.success) { message.success(res.message); fetchPayments(); salesService.getPaymentStats().then(r => { if (r.success) setStats(r.data); }); }
    } catch (err) { message.error(err.message); }
  };

  const handleBounce = async (id) => {
    Modal.confirm({
      title: 'Mark Cheque as Bounced?',
      icon: <ExclamationCircleOutlined />,
      content: 'This will reverse the amount and add bounce charges to dealer outstanding.',
      onOk: async () => {
        try {
          const res = await salesService.bouncePayment(id, { reason: 'Cheque bounced', charges: 500 });
          if (res.success) { message.success(res.message); fetchPayments(); }
        } catch (err) { message.error(err.message); }
      }
    });
  };

  const resetForm = () => {
    setSelectedDealer(null); setDealerOrders([]); setAllocations([]);
    setPaymentForm({ amount: 0, paymentMode: 'cash', bankName: '', chequeNumber: '', chequeDate: '', transactionRef: '', remarks: '' });
  };

  const startNewPayment = () => {
    paymentSubmissionKey.current = createIdempotencyKey();
    resetForm();
    setShowCreate(true);
  };

  const cancelNewPayment = () => {
    paymentSubmissionKey.current = createIdempotencyKey();
    setShowCreate(false);
    resetForm();
  };

  const columns = [
    { title: 'Receipt #', dataIndex: 'paymentNumber', width: 110, render: v => <span className="text-xs font-mono text-green-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'paymentDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Dealer', key: 'party', width: 170, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[160px]">{r.partyName || r.dealer?.businessName}</div><div className="text-xs text-gray-400">{r.dealer?.dealerCode}</div></div>
    )},
    { title: 'Amount', dataIndex: 'amount', width: 100, render: v => <span className="font-semibold text-sm text-green-700">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Mode', dataIndex: 'paymentMode', width: 80, render: v => <Tag color={MODE_COLORS[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Ref/Cheque', key: 'ref', width: 110, render: (_, r) => <span className="text-xs">{r.chequeNumber || r.transactionRef || '—'}</span> },
    { title: 'Against', key: 'orders', width: 100, render: (_, r) => <span className="text-xs">{r.againstOrders?.length || 0} order(s)</span> },
    { title: 'Status', dataIndex: 'status', width: 90, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        {r.status === 'pending' && (
          <>
            <Tooltip title="Confirm"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleConfirm(r._id)} /></Tooltip>
            <Tooltip title="Bounce"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleBounce(r._id)} /></Tooltip>
          </>
        )}
      </Space>
    )},
  ];

  const totalAllocated = allocations.reduce((s, a) => s + (a.allocatedAmount || 0), 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Dealer Payments</h1><p className="text-sm text-gray-500 mt-0.5">Record and track dealer payment receipts</p></div>
        <Space>
          <ModuleRecycleBin module="payment" title="Deleted Payments" onRestore={fetchPayments} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={startNewPayment}>Record Payment</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Today's Receipts" value={`₹${(stats.todayReceipts || 0).toLocaleString()}`} prefix={<RiseOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Today Count" value={stats.todayCount || 0} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="This Month" value={`₹${(stats.monthReceipts || 0).toLocaleString()}`} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Total Receipts" value={`₹${(stats.totalReceipts || 0).toLocaleString()}`} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Pending Cheques" value={stats.pendingCheques || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={3}><Card size="small"><Statistic title="Total Paid Out" value={`₹${(stats.totalPayments || 0).toLocaleString()}`} valueStyle={{ color: '#f5222d' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search receipt #, dealer, cheque..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s }))}
            value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))} allowClear className="w-32" />
          <Select placeholder="Mode" options={Object.keys(MODE_COLORS).map(s => ({ value: s, label: s.toUpperCase() }))}
            value={filters.paymentMode} onChange={v => setFilters(f => ({ ...f, paymentMode: v }))} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ status: undefined, paymentMode: undefined }); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={payments} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Payment Modal */}
      <Modal title="Record Dealer Payment" open={showCreate} onCancel={cancelNewPayment}
        width={900} footer={null} destroyOnHidden>
        <div className="space-y-4 mt-4">
          {/* Dealer Search */}
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Select Dealer *</label>
            <div className="relative">
              <Input prefix={<SearchOutlined className="text-gray-400" />} placeholder="Search dealer..."
                value={dealerSearch} onChange={e => { setDealerSearch(e.target.value); setShowDealerDropdown(true); }}
                onFocus={() => setShowDealerDropdown(true)} />
              {showDealerDropdown && dealerResults.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {dealerResults.map(d => (
                    <div key={d._id} className="px-4 py-2 hover:bg-green-50 cursor-pointer border-b border-gray-50" onClick={() => handleSelectDealer(d)}>
                      <div className="flex justify-between">
                        <div><div className="text-sm font-medium">{d.businessName}</div><div className="text-xs text-gray-400">{d.dealerCode} · {d.city}</div></div>
                        <div className="text-right"><div className="text-xs text-gray-500">O/S: ₹{(d.currentOutstanding || 0).toLocaleString()}</div></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedDealer && (
              <div className="mt-2 flex items-center gap-4 bg-green-50 p-3 rounded-lg border border-green-100">
                <div><div className="text-sm font-bold">{selectedDealer.businessName}</div><div className="text-xs text-gray-500">{selectedDealer.dealerCode}</div></div>
                <div className="ml-auto text-right"><div className="text-xs text-gray-500">Outstanding</div><div className="text-sm font-bold text-red-600">₹{(selectedDealer.currentOutstanding || 0).toLocaleString()}</div></div>
              </div>
            )}
          </div>

          {/* Payment Details */}
          {selectedDealer && (
            <>
              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Amount *</label>
                  <InputNumber value={paymentForm.amount} onChange={v => setPaymentForm(p => ({ ...p, amount: v || 0 }))} min={0} className="w-full" size="large"
                    formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/₹\s?|(,*)/g, '')} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Payment Mode *</label>
                  <Select value={paymentForm.paymentMode} onChange={v => setPaymentForm(p => ({ ...p, paymentMode: v }))} className="w-full" size="large"
                    options={[{ value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'upi', label: 'UPI' }, { value: 'neft', label: 'NEFT' }, { value: 'rtgs', label: 'RTGS' }, { value: 'card', label: 'Card' }]} />
                </div>
                {['cheque'].includes(paymentForm.paymentMode) && (
                  <>
                    <div><label className="text-xs text-gray-500 block mb-1">Cheque No.</label><Input value={paymentForm.chequeNumber} onChange={e => setPaymentForm(p => ({ ...p, chequeNumber: e.target.value }))} /></div>
                    <div><label className="text-xs text-gray-500 block mb-1">Cheque Date</label><Input type="date" value={paymentForm.chequeDate} onChange={e => setPaymentForm(p => ({ ...p, chequeDate: e.target.value }))} /></div>
                  </>
                )}
                {['upi', 'neft', 'rtgs'].includes(paymentForm.paymentMode) && (
                  <div><label className="text-xs text-gray-500 block mb-1">Transaction Ref</label><Input value={paymentForm.transactionRef} onChange={e => setPaymentForm(p => ({ ...p, transactionRef: e.target.value }))} /></div>
                )}
                {['cheque', 'neft', 'rtgs'].includes(paymentForm.paymentMode) && (
                  <div><label className="text-xs text-gray-500 block mb-1">Bank Name</label><Input value={paymentForm.bankName} onChange={e => setPaymentForm(p => ({ ...p, bankName: e.target.value }))} /></div>
                )}
              </div>

              {/* Allocation */}
              {dealerOrders.length > 0 && paymentForm.amount > 0 && (
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-semibold text-gray-700">Allocate Against Orders</label>
                    <Button size="small" onClick={autoAllocate}>Auto Allocate</Button>
                  </div>
                  <div className="border rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50"><tr><th className="p-2 text-left text-xs">Order</th><th className="p-2 text-left text-xs">Date</th><th className="p-2 text-right text-xs">Balance</th><th className="p-2 text-right text-xs">Allocate</th></tr></thead>
                      <tbody>
                        {allocations.map((a, idx) => (
                          <tr key={a.order} className="border-t">
                            <td className="p-2 font-mono text-xs text-blue-600">{a.orderNumber}</td>
                            <td className="p-2 text-xs">{new Date(dealerOrders[idx]?.orderDate).toLocaleDateString('en-IN')}</td>
                            <td className="p-2 text-right text-xs">₹{(a.balance || 0).toLocaleString()}</td>
                            <td className="p-2 text-right"><InputNumber size="small" min={0} max={a.balance} value={a.allocatedAmount} onChange={v => updateAllocation(idx, 'allocatedAmount', v || 0)} className="w-24" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-between mt-2 text-sm">
                    <span className="text-gray-500">Allocated: ₹{totalAllocated.toLocaleString()}</span>
                    <span className={totalAllocated > paymentForm.amount ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                      {totalAllocated > paymentForm.amount ? '⚠ Over-allocated!' : `Unallocated: ₹${(paymentForm.amount - totalAllocated).toLocaleString()}`}
                    </span>
                  </div>
                </div>
              )}

              <div><label className="text-xs text-gray-500 block mb-1">Remarks</label><Input value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Payment remarks..." /></div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button onClick={cancelNewPayment}>Cancel</Button>
                <Button type="primary" onClick={handleCreatePayment} loading={createLoading}>Record Payment</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default DealerPaymentsPage;
