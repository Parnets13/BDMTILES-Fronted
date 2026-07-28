import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, InputNumber, Divider, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { FileX } from 'lucide-react';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = { draft: 'default', approved: 'blue', stock_deducted: 'cyan', debit_issued: 'green', cancelled: 'red' };
const REASON_LABELS = { damaged_on_receipt: 'Damaged on Receipt', wrong_product: 'Wrong Product', quality_issue: 'Quality Issue', excess_supply: 'Excess Supply', defective: 'Defective', other: 'Other' };

const DebitNotePage = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Supplier selection
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  // GRNs for supplier
  const [supplierGRNs, setSupplierGRNs] = useState([]);
  const [selectedGRN, setSelectedGRN] = useState(null);

  // Return items
  const [returnItems, setReturnItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    purchaseService.getReturnStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
    masterService.getWarehouses({ limit: 50 }).then(r => { if (r.success) setWarehouses(r.data); }).catch(() => {});
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter };
      const res = await purchaseService.getReturns(params);
      if (res.success) {
        setReturns(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  const handleSupplierChange = async (supplierId) => {
    const sup = suppliers.find(s => s._id === supplierId);
    setSelectedSupplier(sup);
    setSelectedGRN(null);
    setReturnItems([]);
    try {
      const res = await purchaseService.getGRNsForSupplier(supplierId);
      if (res.success) setSupplierGRNs(res.data);
    } catch (e) { message.error(e.message); }
  };

  const handleGRNSelect = (grnId) => {
    const grn = supplierGRNs.find(g => g._id === grnId);
    setSelectedGRN(grn);
    if (grn?.items) {
      setReturnItems(grn.items.map((item, i) => ({
        key: i,
        product: item.product,
        productCode: item.productCode,
        productName: item.productName,
        shade: item.shade || '',
        batch: item.batch || '',
        receivedQty: item.acceptedQty || item.receivedQty,
        returnQty: 0,
        rate: item.rate || 0,
        gstPercentage: 18,
        reason: 'other',
        warehouse: item.warehouse || '',
        unit: 'Box',
      })));
    }
  };

  const updateReturnItem = (key, field, value) => {
    setReturnItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const handleCreateReturn = async () => {
    const validItems = returnItems.filter(i => i.returnQty > 0);
    if (!selectedSupplier) { message.error('Select a supplier'); return; }
    if (validItems.length === 0) { message.error('Enter return quantity for at least one item'); return; }

    setCreateLoading(true);
    try {
      const payload = {
        supplier: selectedSupplier._id,
        grn: selectedGRN?._id || undefined,
        purchaseOrder: selectedGRN?.purchaseOrder || undefined,
        remarks,
        items: validItems.map(i => ({
          product: i.product, productCode: i.productCode, productName: i.productName,
          shade: i.shade, batch: i.batch, returnQty: i.returnQty, unit: i.unit,
          rate: i.rate, gstPercentage: i.gstPercentage, reason: i.reason,
          warehouse: i.warehouse || undefined,
        })),
      };
      const res = await purchaseService.createReturn(payload);
      if (res.success) {
        message.success(`Debit Note ${res.data.debitNoteNumber} created!`);
        setShowCreate(false);
        resetForm();
        fetchReturns();
        purchaseService.getReturnStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      const res = await purchaseService.approveReturn(id, {});
      if (res.success) { message.success(res.message); fetchReturns(); purchaseService.getReturnStats().then(r => { if (r.success) setStats(r.data); }); }
    } catch (err) { message.error(err.message); }
  };

  const handleCancel = async (id) => {
    try {
      const res = await purchaseService.cancelReturn(id);
      if (res.success) { message.success(res.message); fetchReturns(); }
    } catch (err) { message.error(err.message); }
  };

  const resetForm = () => {
    setSelectedSupplier(null); setSelectedGRN(null); setReturnItems([]);
    setSupplierGRNs([]); setRemarks('');
  };

  const columns = [
    { title: 'Debit Note #', dataIndex: 'debitNoteNumber', width: 120, render: v => <span className="text-xs font-mono text-red-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'returnDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Supplier', key: 'supplier', width: 170, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[160px]">{r.supplierName || r.supplier?.companyName}</div><div className="text-xs text-gray-400">{r.supplier?.supplierCode}</div></div>
    )},
    { title: 'Against PO', dataIndex: 'poNumber', width: 100, render: v => v ? <span className="text-xs font-mono">{v}</span> : '—' },
    { title: 'Against GRN', dataIndex: 'grnNumber', width: 100, render: v => v ? <span className="text-xs font-mono">{v}</span> : '—' },
    { title: 'Items', key: 'items', width: 55, render: (_, r) => r.items?.length || 0 },
    { title: 'Amount', dataIndex: 'grandTotal', width: 100, render: v => <span className="font-semibold text-sm">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace('_', ' ')}</Tag> },
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        {r.status === 'draft' && (
          <>
            <Tooltip title="Approve"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" onClick={() => handleApprove(r._id)} /></Tooltip>
            <Tooltip title="Cancel"><Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(r._id)} /></Tooltip>
          </>
        )}
      </Space>
    )},
  ];

  const returnItemColumns = [
    { title: '#', width: 30, render: (_, __, i) => <span className="text-xs text-gray-400">{i + 1}</span> },
    { title: 'Product', width: 180, render: (_, r) => <div><div className="text-xs font-medium">{r.productName}</div><div className="text-[10px] text-gray-400">{r.productCode}</div></div> },
    { title: 'Shade', width: 60, render: (_, r) => <span className="text-xs">{r.shade || '—'}</span> },
    { title: 'Received', width: 65, render: (_, r) => <span className="text-xs">{r.receivedQty}</span> },
    { title: 'Return Qty', width: 80, render: (_, r) => <InputNumber size="small" min={0} max={r.receivedQty} value={r.returnQty} onChange={v => updateReturnItem(r.key, 'returnQty', v)} className="w-full" /> },
    { title: 'Rate', width: 70, render: (_, r) => <span className="text-xs">₹{r.rate}</span> },
    { title: 'Reason', width: 130, render: (_, r) => (
      <Select size="small" value={r.reason} onChange={v => updateReturnItem(r.key, 'reason', v)} className="w-full"
        options={Object.entries(REASON_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
    )},
    { title: 'Total', width: 80, render: (_, r) => {
      const taxable = r.returnQty * r.rate;
      const gst = (taxable * r.gstPercentage) / 100;
      return <span className="text-xs font-semibold">₹{Math.round(taxable + gst).toLocaleString()}</span>;
    }},
  ];

  const returnTotal = returnItems.filter(i => i.returnQty > 0).reduce((s, i) => {
    const t = i.returnQty * i.rate;
    return s + t + (t * i.gstPercentage / 100);
  }, 0);

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Debit Notes (Purchase Returns)</h1><p className="text-sm text-gray-500 mt-0.5">Return goods to suppliers and issue debit notes</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Debit Note</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<FileX size={14} />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Debit Issued" value={stats.debitIssued || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Total Value" value={`₹${(stats.totalDebitValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search DN #, supplier, PO..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace('_', ' ') }))}
            value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={returns} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create Modal */}
      <Modal title="New Debit Note (Purchase Return)" open={showCreate} onCancel={() => { setShowCreate(false); resetForm(); }}
        width={1050} footer={null} destroyOnClose>
        <div className="space-y-4 mt-4">
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Supplier *</label>
              <Select className="w-full" showSearch placeholder="Select supplier..." optionFilterProp="label"
                value={selectedSupplier?._id} onChange={handleSupplierChange}
                options={suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode})` }))} />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Against GRN (optional)</label>
              <Select className="w-full" placeholder="Select GRN..." allowClear disabled={!selectedSupplier}
                value={selectedGRN?._id} onChange={v => v ? handleGRNSelect(v) : setReturnItems([])}
                options={supplierGRNs.map(g => ({ value: g._id, label: `${g.grnNumber} — ${new Date(g.grnDate).toLocaleDateString('en-IN')} — Inv: ${g.supplierInvoiceNo || '—'}` }))} />
            </div>
          </div>

          {/* Items */}
          {returnItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table columns={returnItemColumns} dataSource={returnItems} rowKey="key" size="small" pagination={false} scroll={{ x: 850 }} />
            </div>
          )}

          {/* Bottom */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 block mb-1">Remarks</label>
              <Input.TextArea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Return remarks..." />
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Items to Return</span><span className="font-medium">{returnItems.filter(i => i.returnQty > 0).length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Qty</span><span className="font-medium">{returnItems.reduce((s, i) => s + (i.returnQty || 0), 0)}</span></div>
                <Divider className="my-1" />
                <div className="flex justify-between text-base font-bold"><span>Debit Note Value</span><span className="text-red-600">₹{Math.round(returnTotal).toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={() => { setShowCreate(false); resetForm(); }}>Cancel</Button>
            <Button type="primary" onClick={handleCreateReturn} loading={createLoading}>Create Debit Note</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default DebitNotePage;
