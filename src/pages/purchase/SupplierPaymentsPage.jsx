import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, InputNumber, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { Wallet } from 'lucide-react';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = { pending: 'orange', confirmed: 'green', bounced: 'red', cancelled: 'default' };
const MODE_COLORS = { cash: 'green', cheque: 'blue', upi: 'purple', neft: 'cyan', rtgs: 'geekblue', card: 'magenta', adjustment: 'default' };

const SupplierPaymentsPage = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, paymentMode: undefined });

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Suppliers
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    amount: 0, paymentMode: 'neft', bankName: '', chequeNumber: '', chequeDate: '', transactionRef: '', remarks: '',
  });

  useEffect(() => {
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
  }, []);

  const fetchPayments = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, paymentType: 'supplier_payment', ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const res = await salesService.getPayments(params);
      if (res.success) {
        setPayments(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchPayments(); }, [fetchPayments]);

  const handleCreatePayment = async () => {
    if (!selectedSupplier) { message.error('Select a supplier'); return; }
    if (!paymentForm.amount || paymentForm.amount <= 0) { message.error('Enter a valid amount'); return; }

    setCreateLoading(true);
    try {
      const payload = {
        paymentType: 'supplier_payment',
        supplier: selectedSupplier._id,
        amount: paymentForm.amount,
        paymentMode: paymentForm.paymentMode,
        bankName: paymentForm.bankName,
        chequeNumber: paymentForm.chequeNumber,
        chequeDate: paymentForm.chequeDate || undefined,
        transactionRef: paymentForm.transactionRef,
        remarks: paymentForm.remarks,
      };
      const res = await salesService.createPayment(payload);
      if (res.success) {
        message.success(`Payment ${res.data.paymentNumber} recorded!`);
        setShowCreate(false);
        resetForm();
        fetchPayments();
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const resetForm = () => {
    setSelectedSupplier(null);
    setPaymentForm({ amount: 0, paymentMode: 'neft', bankName: '', chequeNumber: '', chequeDate: '', transactionRef: '', remarks: '' });
  };

  const columns = [
    { title: 'Payment #', dataIndex: 'paymentNumber', width: 110, render: v => <span className="text-xs font-mono text-red-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'paymentDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Supplier', key: 'party', width: 180, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[170px]">{r.partyName || r.supplier?.companyName}</div><div className="text-xs text-gray-400">{r.supplier?.supplierCode}</div></div>
    )},
    { title: 'Amount', dataIndex: 'amount', width: 110, render: v => <span className="font-semibold text-sm text-red-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Mode', dataIndex: 'paymentMode', width: 80, render: v => <Tag color={MODE_COLORS[v]}>{v?.toUpperCase()}</Tag> },
    { title: 'Ref/Cheque', key: 'ref', width: 120, render: (_, r) => <span className="text-xs">{r.chequeNumber || r.transactionRef || '—'}</span> },
    { title: 'Bank', dataIndex: 'bankName', width: 100, render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Status', dataIndex: 'status', width: 90, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Supplier Payments</h1><p className="text-sm text-gray-500 mt-0.5">Record and track payments made to suppliers</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>Record Payment</Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search payment #, supplier..." prefix={<SearchOutlined className="text-gray-400" />}
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
        <Table columns={columns} dataSource={payments} rowKey="_id" loading={loading} size="middle" scroll={{ x: 900 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Payment Modal */}
      <Modal title="Record Supplier Payment" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        width={650} footer={null} destroyOnClose>
        <div className="space-y-4 mt-4">
          <div>
            <label className="text-sm font-semibold text-gray-700 block mb-1">Supplier *</label>
            <Select className="w-full" showSearch placeholder="Select supplier..." optionFilterProp="label" size="large"
              value={selectedSupplier?._id} onChange={v => setSelectedSupplier(suppliers.find(s => s._id === v))}
              options={suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode})` }))} />
          </div>

          {selectedSupplier && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Amount *</label>
                  <InputNumber value={paymentForm.amount} onChange={v => setPaymentForm(p => ({ ...p, amount: v || 0 }))} min={0} className="w-full" size="large"
                    formatter={v => `₹ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} parser={v => v.replace(/₹\s?|(,*)/g, '')} />
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1">Payment Mode *</label>
                  <Select value={paymentForm.paymentMode} onChange={v => setPaymentForm(p => ({ ...p, paymentMode: v }))} className="w-full" size="large"
                    options={[{ value: 'cash', label: 'Cash' }, { value: 'cheque', label: 'Cheque' }, { value: 'upi', label: 'UPI' }, { value: 'neft', label: 'NEFT' }, { value: 'rtgs', label: 'RTGS' }]} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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

              <div><label className="text-xs text-gray-500 block mb-1">Remarks</label><Input value={paymentForm.remarks} onChange={e => setPaymentForm(p => ({ ...p, remarks: e.target.value }))} placeholder="Payment remarks..." /></div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <Button onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
                <Button type="primary" danger onClick={handleCreatePayment} loading={createLoading}>Record Payment (₹{(paymentForm.amount || 0).toLocaleString()})</Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default SupplierPaymentsPage;
