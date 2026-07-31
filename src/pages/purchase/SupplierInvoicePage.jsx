import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, InputNumber, Divider } from 'antd';
import { PlusOutlined, SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined, PrinterOutlined } from '@ant-design/icons';
import { ReceiptText } from 'lucide-react';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import api from '../../config/api.js';

const supplierInvoiceService = {
  getAll: (params) => api.get('/supplier-invoices', { params }),
  getOne: (id) => api.get(`/supplier-invoices/${id}`),
  create: (data) => api.post('/supplier-invoices', data),
  verify: (id) => api.patch(`/supplier-invoices/${id}/verify`),
  getStats: () => api.get('/supplier-invoices/stats'),
  getAvailableGRNs: (supplier) => api.get('/supplier-invoices/available-grns', { params: { supplier } }),
};

const STATUS_COLORS = { draft: 'default', pending_verification: 'orange', verified: 'blue', paid: 'green', cancelled: 'red' };

const SupplierInvoicePage = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [availableGRNs, setAvailableGRNs] = useState([]);
  const [selectedGRNs, setSelectedGRNs] = useState([]);

  const [form, setForm] = useState({
    invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0],
    invoiceAmount: 0, taxAmount: 0, freightAmount: 0, otherCharges: 0,
    paymentTerms: '', dueDate: '', remarks: '',
  });

  // View modal
  const [viewInvoice, setViewInvoice] = useState(null);

  useEffect(() => {
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
    supplierInvoiceService.getStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter };
      const res = await supplierInvoiceService.getAll(params);
      if (res.success) {
        setInvoices(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const handleSupplierChange = async (supplierId) => {
    const sup = suppliers.find(s => s._id === supplierId);
    setSelectedSupplier(sup);
    setSelectedGRNs([]);
    if (supplierId) {
      try {
        const res = await supplierInvoiceService.getAvailableGRNs(supplierId);
        if (res.success) setAvailableGRNs(res.data);
      } catch (e) { message.error(e.message); }
    }
  };

  const handleCreate = async () => {
    if (!selectedSupplier) { message.error('Select a supplier'); return; }
    if (!form.invoiceNumber) { message.error('Enter invoice number'); return; }
    if (!form.invoiceAmount) { message.error('Enter invoice amount'); return; }
    setCreateLoading(true);
    try {
      const payload = {
        supplier: selectedSupplier._id,
        linkedGRNs: selectedGRNs,
        ...form,
      };
      const res = await supplierInvoiceService.create(payload);
      if (res.success) {
        message.success(`Invoice ${res.data.invoiceRefNumber} created!`);
        setShowCreate(false);
        resetForm();
        fetchInvoices();
        supplierInvoiceService.getStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleVerify = async (id) => {
    try {
      const res = await supplierInvoiceService.verify(id);
      if (res.success) { message.success(res.message); fetchInvoices(); }
    } catch (err) { message.error(err.message); }
  };

  const resetForm = () => {
    setSelectedSupplier(null); setSelectedGRNs([]); setAvailableGRNs([]);
    setForm({ invoiceNumber: '', invoiceDate: new Date().toISOString().split('T')[0], invoiceAmount: 0, taxAmount: 0, freightAmount: 0, otherCharges: 0, paymentTerms: '', dueDate: '', remarks: '' });
  };

  const grandTotal = (form.invoiceAmount || 0) + (form.taxAmount || 0) + (form.freightAmount || 0) + (form.otherCharges || 0);

  const columns = [
    { title: 'Ref #', dataIndex: 'invoiceRefNumber', width: 120, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Supplier Invoice', dataIndex: 'invoiceNumber', width: 130, render: v => <span className="text-xs font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'invoiceDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Supplier', key: 'supplier', width: 170, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[160px]">{r.supplierName}</div><div className="text-xs text-gray-400">{r.supplier?.supplierCode}</div></div>
    )},
    { title: 'Amount', dataIndex: 'grandTotal', width: 110, render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'GRNs', key: 'grns', width: 60, render: (_, r) => <span className="text-xs">{r.linkedGRNs?.length || 0}</span> },
    { title: 'Due Date', dataIndex: 'dueDate', width: 90, render: v => v ? <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> : '—' },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace('_', ' ')}</Tag> },
    { title: 'Tally', dataIndex: 'tallySyncStatus', width: 80, render: s => <Tag color={s === 'synced' ? 'green' : 'default'}>{s === 'not_synced' ? '—' : s}</Tag> },
    { title: 'Actions', width: 90, render: (_, r) => (
      <Space size="small">
        <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewInvoice(r)} />
        {r.status === 'draft' && <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleVerify(r._id)} />}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Supplier Invoices</h1><p className="text-sm text-gray-500 mt-0.5">Record and verify supplier invoices against GRNs</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>Add Invoice</Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<ReceiptText size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Pending" value={stats.pendingVerification || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Verified" value={stats.verified || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Paid" value={stats.paid || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Total Value" value={`₹${(stats.totalValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search invoice #, supplier..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace('_', ' ') }))}
            value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={invoices} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Invoice Modal */}
      <Modal title="Add Supplier Invoice" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        width={780} footer={null} destroyOnHidden>
        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold block mb-1">Supplier *</label>
              <Select className="w-full" showSearch placeholder="Select supplier..." optionFilterProp="label" size="large"
                onChange={handleSupplierChange}
                options={suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode})` }))} />
            </div>
            <div>
              <label className="text-xs text-gray-500 block mb-1">Supplier Invoice No. *</label>
              <Input value={form.invoiceNumber} onChange={e => setForm(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="e.g. SI-2024-001" size="large" />
            </div>
          </div>

          {/* Link GRNs */}
          {availableGRNs.length > 0 && (
            <div>
              <label className="text-sm font-semibold block mb-1">Link Against GRNs (optional)</label>
              <Select mode="multiple" className="w-full" placeholder="Select GRNs this invoice covers..."
                onChange={v => setSelectedGRNs(v)}
                options={availableGRNs.map(g => ({ value: g._id, label: `${g.grnNumber} — ${new Date(g.grnDate).toLocaleDateString('en-IN')} — ₹${(g.grandTotal || 0).toLocaleString()}` }))} />
            </div>
          )}

          <div className="grid grid-cols-4 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Invoice Date</label>
              <Input type="date" value={form.invoiceDate} onChange={e => setForm(p => ({ ...p, invoiceDate: e.target.value }))} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Invoice Amount *</label>
              <InputNumber value={form.invoiceAmount} onChange={v => setForm(p => ({ ...p, invoiceAmount: v || 0 }))} min={0} className="w-full" prefix="₹" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Tax Amount (GST)</label>
              <InputNumber value={form.taxAmount} onChange={v => setForm(p => ({ ...p, taxAmount: v || 0 }))} min={0} className="w-full" prefix="₹" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Freight</label>
              <InputNumber value={form.freightAmount} onChange={v => setForm(p => ({ ...p, freightAmount: v || 0 }))} min={0} className="w-full" prefix="₹" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Other Charges</label>
              <InputNumber value={form.otherCharges} onChange={v => setForm(p => ({ ...p, otherCharges: v || 0 }))} min={0} className="w-full" prefix="₹" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Payment Terms</label>
              <Input value={form.paymentTerms} onChange={e => setForm(p => ({ ...p, paymentTerms: e.target.value }))} placeholder="e.g. Net 30" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm(p => ({ ...p, dueDate: e.target.value }))} /></div>
          </div>

          <div><label className="text-xs text-gray-500 block mb-1">Remarks</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} /></div>

          <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 text-sm">
            <div className="flex justify-between font-bold text-base"><span>Grand Total</span><span className="text-blue-700">₹{grandTotal.toLocaleString()}</span></div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button type="primary" onClick={handleCreate} loading={createLoading}>Create Invoice</Button>
          </div>
        </div>
      </Modal>

      {/* View Invoice Modal */}
      {viewInvoice && (
        <Modal title={`Invoice: ${viewInvoice.invoiceRefNumber}`} open={!!viewInvoice} onCancel={() => setViewInvoice(null)} footer={<Button onClick={() => setViewInvoice(null)}>Close</Button>} width={600}>
          <div className="space-y-3 mt-4 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div><span className="text-gray-400">Supplier:</span> <span className="font-medium">{viewInvoice.supplierName}</span></div>
              <div><span className="text-gray-400">Supplier Inv #:</span> <span className="font-medium">{viewInvoice.invoiceNumber}</span></div>
              <div><span className="text-gray-400">Date:</span> <span>{new Date(viewInvoice.invoiceDate).toLocaleDateString('en-IN')}</span></div>
              <div><span className="text-gray-400">Due:</span> <span>{viewInvoice.dueDate ? new Date(viewInvoice.dueDate).toLocaleDateString('en-IN') : '—'}</span></div>
            </div>
            <Divider className="my-2" />
            <div className="space-y-1">
              <div className="flex justify-between"><span>Invoice Amount</span><span>₹{(viewInvoice.invoiceAmount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Tax (GST)</span><span>₹{(viewInvoice.taxAmount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Freight</span><span>₹{(viewInvoice.freightAmount || 0).toLocaleString()}</span></div>
              <div className="flex justify-between"><span>Other</span><span>₹{(viewInvoice.otherCharges || 0).toLocaleString()}</span></div>
              <Divider className="my-1" />
              <div className="flex justify-between font-bold text-base"><span>Grand Total</span><span className="text-blue-700">₹{(viewInvoice.grandTotal || 0).toLocaleString()}</span></div>
            </div>
            {viewInvoice.remarks && <div className="text-gray-500">Remarks: {viewInvoice.remarks}</div>}
          </div>
        </Modal>
      )}
    </div>
  );
};

export default SupplierInvoicePage;
