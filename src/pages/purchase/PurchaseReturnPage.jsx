import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, InputNumber, Divider, Form
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, UndoOutlined
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { createIdempotencyKey } from '../../config/api.js';

const STATUS_COLORS = {
  draft: 'default',
  approved: 'blue',
  stock_deducted: 'cyan',
  debit_issued: 'green',
  cancelled: 'red',
};

const REASON_OPTIONS = [
  { value: 'damaged_on_receipt', label: 'Damaged on Receipt' },
  { value: 'wrong_product', label: 'Wrong Product' },
  { value: 'quality_issue', label: 'Quality Issue' },
  { value: 'excess_supply', label: 'Excess Supply' },
  { value: 'defective', label: 'Defective' },
  { value: 'other', label: 'Other' },
];

const PurchaseReturnPage = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [suppliers, setSuppliers] = useState([]);

  // Modals
  const [showCreate, setShowCreate] = useState(false);
  const [viewRecord, setViewRecord] = useState(null);
  const [approveRecord, setApproveRecord] = useState(null);
  const [approveRemarks, setApproveRemarks] = useState('');
  const [approveLoading, setApproveLoading] = useState(false);

  useEffect(() => {
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
    loadStats();
  }, []);

  const loadStats = () => {
    purchaseService.getReturnStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
  };

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter };
      const res = await purchaseService.getReturns(params);
      if (res.success) {
        setReturns(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleApprove = async () => {
    setApproveLoading(true);
    try {
      const res = await purchaseService.approveReturn(approveRecord._id, { remarks: approveRemarks });
      if (res.success) {
        message.success('Purchase Return approved. Stock deducted. Debit note issued.');
        setApproveRecord(null); setApproveRemarks('');
        fetchReturns(); loadStats();
      }
    } catch (err) { message.error(err.message); }
    finally { setApproveLoading(false); }
  };

  const handleCancel = async (id) => {
    Modal.confirm({
      title: 'Cancel Purchase Return?',
      content: 'This action cannot be undone.',
      okText: 'Yes, Cancel', okType: 'danger',
      onOk: async () => {
        try {
          const res = await purchaseService.cancelReturn(id);
          if (res.success) { message.success('Return cancelled.'); fetchReturns(); loadStats(); }
        } catch (err) { message.error(err.message); }
      },
    });
  };

  const columns = [
    { title: 'Debit Note #', dataIndex: 'debitNoteNumber', width: 120,
      render: v => <span className="text-xs font-mono text-red-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'returnDate', width: 95,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Supplier', key: 'supplier', width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium truncate max-w-[170px]">{r.supplierName}</div>
          <div className="text-xs text-gray-400">{r.supplier?.supplierCode}</div>
        </div>
      )},
    { title: 'GRN / PO #', key: 'ref', width: 130,
      render: (_, r) => (
        <div>
          <div className="text-xs">{r.grnNumber || '—'}</div>
          <div className="text-xs text-gray-400">{r.poNumber || ''}</div>
        </div>
      )},
    { title: 'Items', key: 'items', width: 60,
      render: (_, r) => <span className="text-xs">{r.items?.length || 0}</span> },
    { title: 'Grand Total', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="font-semibold text-red-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 120,
      render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Actions', width: 100,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600"
            onClick={() => setViewRecord(r)} />
          {r.status === 'draft' && (
            <Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600"
              onClick={() => { setApproveRecord(r); setApproveRemarks(''); }} />
          )}
          {r.status === 'draft' && (
            <Button type="text" size="small" icon={<CloseCircleOutlined />} className="text-red-500"
              onClick={() => handleCancel(r._id)} />
          )}
        </Space>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Purchase Returns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage debit notes for returned goods to suppliers</p>
        </div>
        <Space>
          <ModuleRecycleBin module="purchase_return" title="Deleted Purchase Returns" onRestore={fetchReturns} />
          <Button type="primary" icon={<PlusOutlined />} size="large"
            onClick={() => setShowCreate(true)} danger>
            New Return / Debit Note
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<UndoOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Debit Issued" value={stats.debitIssued || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Total Value" value={`₹${(stats.totalDebitValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search debit note #, supplier, GRN..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-72" allowClear />
          <Select placeholder="Status"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') }))}
            value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-40" />
          <Button icon={<ReloadOutlined />}
            onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={returns} rowKey="_id" loading={loading}
          size="middle" scroll={{ x: 900 }}
          pagination={{ ...pagination, showSizeChanger: true,
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Modal */}
      <CreateReturnModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        suppliers={suppliers}
        onSuccess={() => { fetchReturns(); loadStats(); }}
      />

      {/* Approve Modal */}
      <Modal title="Approve Purchase Return"
        open={!!approveRecord}
        onCancel={() => setApproveRecord(null)}
        onOk={handleApprove}
        confirmLoading={approveLoading}
        okText="Approve & Issue Debit Note"
        okButtonProps={{ danger: false }}>
        <div className="space-y-3 mt-4">
          <div className="bg-orange-50 border border-orange-200 rounded p-3 text-sm">
            <div className="font-semibold text-orange-800 mb-1">⚠ This will:</div>
            <ul className="text-orange-700 space-y-0.5 list-disc list-inside">
              <li>Deduct stock for all return items</li>
              <li>Mark status as <strong>Debit Issued</strong></li>
            </ul>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Approval Remarks</label>
            <Input.TextArea rows={2} value={approveRemarks}
              onChange={e => setApproveRemarks(e.target.value)}
              placeholder="Optional remarks..." />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      {viewRecord && (
        <ViewReturnModal record={viewRecord} onClose={() => setViewRecord(null)} />
      )}
    </div>
  );
};

// ════════════════════════════════════════════
// CREATE RETURN MODAL
// ════════════════════════════════════════════
const CreateReturnModal = ({ open, onClose, suppliers, onSuccess }) => {
  const returnSubmissionKey = useRef(createIdempotencyKey());
  const wasOpenRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [availableGRNs, setAvailableGRNs] = useState([]);
  const [selectedGRN, setSelectedGRN] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [form, setForm] = useState({
    returnDate: new Date().toISOString().split('T')[0],
    purchaseOrder: '', grn: '', remarks: '',
  });
  const [items, setItems] = useState([
    { product: '', productName: '', shade: '', batch: '', returnQty: 1,
      unit: 'Box', rate: 0, gstPercentage: 18, reason: 'quality_issue', reasonDetails: '', warehouse: '' }
  ]);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      returnSubmissionKey.current = createIdempotencyKey();
    }
    wasOpenRef.current = open;

    if (open) {
      masterService.getWarehouses({ limit: 50 }).then(r => { if (r.success) setWarehouses(r.data); }).catch(() => {});
    }
  }, [open]);

  const handleSupplierChange = async (supplierId) => {
    const sup = suppliers.find(s => s._id === supplierId);
    setSelectedSupplier(sup);
    setSelectedGRN(null);
    setAvailableGRNs([]);
    setForm(f => ({ ...f, grn: '', purchaseOrder: '' }));
    if (supplierId) {
      try {
        const res = await purchaseService.getGRNsForSupplier(supplierId);
        if (res.success) setAvailableGRNs(res.data);
      } catch (e) { /* no GRNs is fine */ }
    }
  };

  const handleGRNChange = (grnId) => {
    const grn = availableGRNs.find(g => g._id === grnId);
    setSelectedGRN(grn);
    setForm(f => ({ ...f, grn: grnId, purchaseOrder: grn?.purchaseOrder || '' }));
    // Pre-fill items from GRN
    if (grn?.items?.length) {
      setItems(grn.items.map(i => ({
        product: i.product?._id || i.product || '',
        productName: i.productName || i.product?.itemName || '',
        shade: i.shade || '', batch: i.batch || '',
        returnQty: 1, unit: i.unit || 'Box', rate: i.rate || 0,
        gstPercentage: i.gstPercentage || 18, reason: 'quality_issue',
        reasonDetails: '', warehouse: i.warehouse?._id || i.warehouse || '',
      })));
    }
  };

  const updateItem = (idx, field, value) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  };

  const addItem = () => setItems(prev => [...prev, {
    product: '', productName: '', shade: '', batch: '', returnQty: 1,
    unit: 'Box', rate: 0, gstPercentage: 18, reason: 'quality_issue', reasonDetails: '', warehouse: '',
  }]);

  const removeItem = (idx) => setItems(prev => prev.filter((_, i) => i !== idx));

  const calcTotals = () => {
    let subtotal = 0, totalTax = 0;
    items.forEach(item => {
      const taxable = item.returnQty * item.rate;
      const gst = (taxable * (item.gstPercentage || 18)) / 100;
      subtotal += taxable; totalTax += gst;
    });
    return { subtotal, totalTax, grandTotal: subtotal + totalTax };
  };

  const handleSubmit = async () => {
    if (!selectedSupplier) { message.error('Select a supplier'); return; }
    if (!items.length || items.some(i => !i.product)) { message.error('Add at least one item with a product'); return; }
    setLoading(true);
    try {
      const { subtotal, totalTax, grandTotal } = calcTotals();
      const payload = {
        supplier: selectedSupplier._id,
        ...form,
        items, subtotal, totalTax, grandTotal,
      };
      const res = await purchaseService.createReturn(payload, returnSubmissionKey.current);
      if (res.success) {
        returnSubmissionKey.current = createIdempotencyKey();
        message.success(`Debit Note ${res.data.debitNoteNumber} created!`);
        onSuccess?.(); closeAndReset();
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const closeAndReset = () => {
    setSelectedSupplier(null); setSelectedGRN(null); setAvailableGRNs([]);
    setForm({ returnDate: new Date().toISOString().split('T')[0], purchaseOrder: '', grn: '', remarks: '' });
    setItems([{ product: '', productName: '', shade: '', batch: '', returnQty: 1, unit: 'Box', rate: 0, gstPercentage: 18, reason: 'quality_issue', reasonDetails: '', warehouse: '' }]);
    onClose();
  };

  const handleClose = () => {
    returnSubmissionKey.current = createIdempotencyKey();
    closeAndReset();
  };

  const { subtotal, totalTax, grandTotal } = calcTotals();

  return (
    <Modal title="New Purchase Return / Debit Note" open={open} onCancel={handleClose}
      width={900} footer={null} destroyOnHidden>
      <div className="space-y-4 mt-4">
        {/* Header */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Supplier *</label>
            <Select className="w-full" showSearch placeholder="Select supplier..."
              optionFilterProp="label" size="large" onChange={handleSupplierChange}
              options={suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode})` }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Return Date</label>
            <Input type="date" value={form.returnDate}
              onChange={e => setForm(f => ({ ...f, returnDate: e.target.value }))} size="large" />
          </div>
        </div>

        {/* Link GRN */}
        {availableGRNs.length > 0 && (
          <div>
            <label className="text-xs text-gray-500 block mb-1">Link Against GRN (optional — auto-fills items)</label>
            <Select className="w-full" placeholder="Select GRN..." onChange={handleGRNChange} allowClear
              options={availableGRNs.map(g => ({
                value: g._id,
                label: `${g.grnNumber} — ${new Date(g.grnDate || g.createdAt).toLocaleDateString('en-IN')}${g.supplierInvoiceNo ? ` — Inv: ${g.supplierInvoiceNo}` : ''}`
              }))} />
          </div>
        )}

        {/* Items Table */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="text-sm font-semibold text-gray-700">Return Items *</label>
            <Button size="small" icon={<PlusOutlined />} onClick={addItem}>Add Item</Button>
          </div>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-red-50">
                  <tr>
                    {['Product / Name', 'Shade', 'Batch', 'Qty', 'Rate', 'GST%', 'Reason', 'Warehouse', ''].map(h => (
                      <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-t border-gray-100">
                      <td className="px-2 py-1.5">
                        <Input value={item.productName}
                          onChange={e => updateItem(idx, 'productName', e.target.value)}
                          placeholder="Product name" className="w-40" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={item.shade} onChange={e => updateItem(idx, 'shade', e.target.value)}
                          placeholder="Shade" className="w-20" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Input value={item.batch} onChange={e => updateItem(idx, 'batch', e.target.value)}
                          placeholder="Batch" className="w-20" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={1} value={item.returnQty}
                          onChange={v => updateItem(idx, 'returnQty', v || 1)} className="w-16" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} value={item.rate}
                          onChange={v => updateItem(idx, 'rate', v || 0)} className="w-20" prefix="₹" />
                      </td>
                      <td className="px-2 py-1.5">
                        <InputNumber min={0} max={28} value={item.gstPercentage}
                          onChange={v => updateItem(idx, 'gstPercentage', v || 18)} className="w-14" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={item.reason} onChange={v => updateItem(idx, 'reason', v)}
                          options={REASON_OPTIONS} className="w-36" />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select value={item.warehouse || undefined}
                          onChange={v => updateItem(idx, 'warehouse', v)}
                          options={warehouses.map(w => ({ value: w._id, label: w.name }))}
                          placeholder="Warehouse" className="w-32" allowClear />
                      </td>
                      <td className="px-2 py-1.5">
                        {items.length > 1 && (
                          <Button type="text" size="small" danger
                            icon={<CloseCircleOutlined />} onClick={() => removeItem(idx)} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div>
          <label className="text-xs text-gray-500 block mb-1">Remarks</label>
          <Input.TextArea rows={2} value={form.remarks}
            onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
            placeholder="Any notes about this return..." />
        </div>

        {/* Totals */}
        <div className="bg-red-50 border border-red-100 rounded-lg p-3">
          <div className="flex justify-end gap-8 text-sm">
            <div className="space-y-1 text-right">
              <div className="text-gray-500">Subtotal: <span className="font-medium text-gray-800">₹{subtotal.toLocaleString()}</span></div>
              <div className="text-gray-500">GST: <span className="font-medium text-gray-800">₹{totalTax.toFixed(2)}</span></div>
              <Divider className="my-1" />
              <div className="font-bold text-base text-red-700">Debit Note Total: ₹{grandTotal.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button onClick={handleClose}>Cancel</Button>
          <Button type="primary" danger onClick={handleSubmit} loading={loading}>
            Create Debit Note
          </Button>
        </div>
      </div>
    </Modal>
  );
};

// ════════════════════════════════════════════
// VIEW RETURN MODAL
// ════════════════════════════════════════════
const ViewReturnModal = ({ record, onClose }) => (
  <Modal title={`Debit Note: ${record.debitNoteNumber}`}
    open={!!record} onCancel={onClose}
    footer={<Button onClick={onClose}>Close</Button>}
    width={700}>
    <div className="space-y-4 mt-4 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div><span className="text-gray-400">Supplier:</span> <span className="font-medium">{record.supplierName}</span></div>
        <div><span className="text-gray-400">Return Date:</span> <span>{new Date(record.returnDate).toLocaleDateString('en-IN')}</span></div>
        <div><span className="text-gray-400">GRN #:</span> <span>{record.grnNumber || '—'}</span></div>
        <div><span className="text-gray-400">PO #:</span> <span>{record.poNumber || '—'}</span></div>
        <div>
          <span className="text-gray-400">Status:</span>{' '}
          <Tag color={STATUS_COLORS[record.status]}>{record.status?.replace(/_/g, ' ')}</Tag>
        </div>
      </div>
      <Divider className="my-2" />

      {/* Items */}
      {record.items?.length > 0 && (
        <div>
          <div className="font-semibold mb-2">Return Items</div>
          <table className="w-full text-xs border border-gray-200 rounded">
            <thead className="bg-gray-50">
              <tr>
                {['Product', 'Shade', 'Batch', 'Qty', 'Rate', 'GST', 'Total', 'Reason'].map(h => (
                  <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {record.items.map((item, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">{item.productName || item.product?.itemName || '—'}</td>
                  <td className="px-2 py-1.5">{item.shade || '—'}</td>
                  <td className="px-2 py-1.5">{item.batch || '—'}</td>
                  <td className="px-2 py-1.5">{item.returnQty}</td>
                  <td className="px-2 py-1.5">₹{(item.rate || 0).toLocaleString()}</td>
                  <td className="px-2 py-1.5">{item.gstPercentage}%</td>
                  <td className="px-2 py-1.5 font-medium">₹{(item.totalAmount || 0).toLocaleString()}</td>
                  <td className="px-2 py-1.5">{item.reason?.replace(/_/g, ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex justify-end gap-8 text-sm bg-red-50 p-3 rounded-lg">
        <div className="text-right space-y-1">
          <div>Subtotal: <span className="font-medium">₹{(record.subtotal || 0).toLocaleString()}</span></div>
          <div>GST: <span className="font-medium">₹{(record.totalTax || 0).toLocaleString()}</span></div>
          <div className="font-bold text-base text-red-700">
            Grand Total: ₹{(record.grandTotal || 0).toLocaleString()}
          </div>
        </div>
      </div>
      {record.remarks && <div className="text-gray-500">Remarks: {record.remarks}</div>}
    </div>
  </Modal>
);

export default PurchaseReturnPage;
