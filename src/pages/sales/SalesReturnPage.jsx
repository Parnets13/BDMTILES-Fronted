import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, InputNumber, Divider, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined, UndoOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import { createIdempotencyKey } from '../../config/api.js';

const STATUS_COLORS = { draft: 'default', approved: 'blue', stock_updated: 'cyan', credit_issued: 'green', cancelled: 'red' };
const REASON_LABELS = { damaged: 'Damaged', wrong_product: 'Wrong Product', quality_issue: 'Quality Issue', excess: 'Excess', shade_mismatch: 'Shade Mismatch', other: 'Other' };
const CONDITION_COLORS = { resaleable: 'green', damaged: 'red', scrap: 'volcano' };

const SalesReturnPage = () => {
  const returnSubmissionKey = useRef(createIdempotencyKey());
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [viewReturn, setViewReturn] = useState(null);

  // Dealer search
  const [dealerSearch, setDealerSearch] = useState('');
  const [dealerResults, setDealerResults] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [showDealerDropdown, setShowDealerDropdown] = useState(false);

  // Orders for dealer
  const [dealerOrders, setDealerOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Return items
  const [returnItems, setReturnItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [remarks, setRemarks] = useState('');
  const [adjustmentType, setAdjustmentType] = useState('credit_note');

  useEffect(() => {
    salesService.getReturnStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
    masterService.getWarehouses({ limit: 50 }).then(r => { if (r.success) setWarehouses(r.data); }).catch(() => {});
  }, []);

  const fetchReturns = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter };
      const res = await salesService.getReturns(params);
      if (res.success) {
        setReturns(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchReturns(); }, [fetchReturns]);

  // Dealer search debounce
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
    setSelectedOrder(null);
    setReturnItems([]);
    try {
      const res = await salesService.getOrdersForDealer(dealer._id);
      if (res.success) setDealerOrders(res.data);
    } catch (e) { message.error(e.message); }
  };

  const handleSelectOrder = (orderId) => {
    const order = dealerOrders.find(o => o._id === orderId);
    setSelectedOrder(order);
    if (order?.items) {
      setReturnItems(order.items.map((item, i) => ({
        key: i,
        product: item.product?._id || item.product,
        productCode: item.productCode,
        productName: item.productName,
        shade: item.shade || '',
        batch: item.batch || '',
        orderedQty: item.quantity,
        returnQty: 0,
        rate: item.rate,
        gstPercentage: item.gstPercentage || 18,
        reason: 'other',
        condition: 'resaleable',
        warehouse: '',
        unit: item.unit || 'Box',
      })));
    }
  };

  const updateReturnItem = (key, field, value) => {
    setReturnItems(prev => prev.map(i => i.key === key ? { ...i, [field]: value } : i));
  };

  const handleCreateReturn = async () => {
    const validItems = returnItems.filter(i => i.returnQty > 0);
    if (!selectedDealer) { message.error('Select a dealer'); return; }
    if (validItems.length === 0) { message.error('Enter return quantity for at least one item'); return; }

    setCreateLoading(true);
    try {
      const payload = {
        dealer: selectedDealer._id,
        salesOrder: selectedOrder?._id || undefined,
        adjustmentType,
        remarks,
        items: validItems.map(i => ({
          product: i.product, productCode: i.productCode, productName: i.productName,
          shade: i.shade, batch: i.batch, returnQty: i.returnQty, unit: i.unit,
          rate: i.rate, gstPercentage: i.gstPercentage, reason: i.reason,
          condition: i.condition, warehouse: i.warehouse || undefined,
        })),
      };
      const res = await salesService.createReturn(payload, returnSubmissionKey.current);
      if (res.success) {
        returnSubmissionKey.current = createIdempotencyKey();
        message.success(`Return ${res.data.returnNumber} created!`);
        setShowCreate(false);
        resetCreateForm();
        fetchReturns();
        salesService.getReturnStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const handleApprove = async (id) => {
    try {
      const res = await salesService.approveReturn(id, {});
      if (res.success) { message.success(res.message); fetchReturns(); salesService.getReturnStats().then(r => { if (r.success) setStats(r.data); }); }
    } catch (err) { message.error(err.message); }
  };

  const handleCancel = async (id) => {
    try {
      const res = await salesService.cancelReturn(id);
      if (res.success) { message.success(res.message); fetchReturns(); }
    } catch (err) { message.error(err.message); }
  };

  const resetCreateForm = () => {
    setSelectedDealer(null); setSelectedOrder(null); setReturnItems([]);
    setDealerOrders([]); setRemarks(''); setAdjustmentType('credit_note');
  };

  const startNewReturn = () => {
    returnSubmissionKey.current = createIdempotencyKey();
    resetCreateForm();
    setShowCreate(true);
  };

  const cancelNewReturn = () => {
    returnSubmissionKey.current = createIdempotencyKey();
    setShowCreate(false);
    resetCreateForm();
  };

  const columns = [
    { title: 'Return #', dataIndex: 'returnNumber', width: 110, render: v => <span className="text-xs font-mono text-purple-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'returnDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Dealer', key: 'dealer', width: 170, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[160px]">{r.dealerName || r.dealer?.businessName}</div><div className="text-xs text-gray-400">{r.dealerCode || r.dealer?.dealerCode}</div></div>
    )},
    { title: 'Against SO', dataIndex: 'orderNumber', width: 110, render: v => v ? <span className="text-xs font-mono text-blue-500">{v}</span> : '—' },
    { title: 'Items', key: 'items', width: 55, render: (_, r) => r.items?.length || 0 },
    { title: 'Amount', dataIndex: 'grandTotal', width: 100, render: v => <span className="font-semibold text-sm">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Credit Note', dataIndex: 'creditNoteNumber', width: 100, render: v => v || '—' },
    { title: 'Status', dataIndex: 'status', width: 110, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace('_', ' ')}</Tag> },
    { title: 'Actions', width: 110, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewReturn(r)} /></Tooltip>
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
    { title: 'Shade', width: 65, render: (_, r) => <span className="text-xs">{r.shade || '—'}</span> },
    { title: 'Ordered', width: 60, render: (_, r) => <span className="text-xs">{r.orderedQty}</span> },
    { title: 'Return Qty', width: 80, render: (_, r) => <InputNumber size="small" min={0} max={r.orderedQty} value={r.returnQty} onChange={v => updateReturnItem(r.key, 'returnQty', v)} className="w-full" /> },
    { title: 'Rate', width: 70, render: (_, r) => <span className="text-xs">₹{r.rate}</span> },
    { title: 'Reason', width: 120, render: (_, r) => (
      <Select size="small" value={r.reason} onChange={v => updateReturnItem(r.key, 'reason', v)} className="w-full"
        options={Object.entries(REASON_LABELS).map(([k, v]) => ({ value: k, label: v }))} />
    )},
    { title: 'Condition', width: 100, render: (_, r) => (
      <Select size="small" value={r.condition} onChange={v => updateReturnItem(r.key, 'condition', v)} className="w-full"
        options={[{ value: 'resaleable', label: 'Resaleable' }, { value: 'damaged', label: 'Damaged' }, { value: 'scrap', label: 'Scrap' }]} />
    )},
    { title: 'Warehouse', width: 110, render: (_, r) => (
      <Select size="small" value={r.warehouse} onChange={v => updateReturnItem(r.key, 'warehouse', v)} className="w-full" placeholder="Select"
        options={warehouses.map(w => ({ value: w._id, label: w.name }))} allowClear />
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
        <div><h1 className="text-2xl font-bold text-gray-800">Sales Returns & Credit Notes</h1><p className="text-sm text-gray-500 mt-0.5">Handle product returns and issue credit notes</p></div>
        <Space>
          <ModuleRecycleBin module="sales_return" title="Deleted Sales Returns" onRestore={fetchReturns} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={startNewReturn}>New Sales Return</Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Returns" value={stats.total || 0} prefix={<UndoOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Draft" value={stats.draft || 0} valueStyle={{ color: '#666' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Credit Issued" value={stats.creditIssued || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Return Value" value={`₹${(stats.totalReturnValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search return #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
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

      {/* Create Return Modal */}
      <Modal title="New Sales Return" open={showCreate} onCancel={cancelNewReturn}
        width={1100} footer={null} destroyOnHidden>
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
                    <div key={d._id} className="px-4 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50" onClick={() => handleSelectDealer(d)}>
                      <div className="text-sm font-medium">{d.businessName}</div>
                      <div className="text-xs text-gray-400">{d.dealerCode} · {d.mobile} · {d.city}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedDealer && <div className="mt-2 text-sm text-green-700 bg-green-50 p-2 rounded">Selected: <strong>{selectedDealer.businessName}</strong> ({selectedDealer.dealerCode})</div>}
          </div>

          {/* Select Order */}
          {selectedDealer && dealerOrders.length > 0 && (
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Against Sales Order (optional)</label>
              <Select className="w-full" placeholder="Select order to return against..." allowClear
                value={selectedOrder?._id} onChange={v => v ? handleSelectOrder(v) : setReturnItems([])}
                options={dealerOrders.map(o => ({ value: o._id, label: `${o.orderNumber} — ${new Date(o.orderDate).toLocaleDateString('en-IN')} — ₹${(o.grandTotal || 0).toLocaleString()} [${o.status}]` }))} />
            </div>
          )}

          {/* Return Items */}
          {returnItems.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              <Table columns={returnItemColumns} dataSource={returnItems} rowKey="key" size="small" pagination={false} scroll={{ x: 1000 }} />
            </div>
          )}

          {/* Bottom section */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Adjustment Type</label>
                <Select value={adjustmentType} onChange={v => setAdjustmentType(v)} className="w-full"
                  options={[{ value: 'credit_note', label: 'Credit Note' }, { value: 'refund', label: 'Cash Refund' }, { value: 'replacement', label: 'Replacement' }]} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Remarks</label>
                <Input.TextArea rows={3} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Return remarks..." />
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Items to Return</span><span className="font-medium">{returnItems.filter(i => i.returnQty > 0).length}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Total Qty</span><span className="font-medium">{returnItems.reduce((s, i) => s + (i.returnQty || 0), 0)}</span></div>
                <Divider className="my-1" />
                <div className="flex justify-between text-base font-bold"><span>Return Value</span><span className="text-purple-600">₹{Math.round(returnTotal).toLocaleString()}</span></div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t">
            <Button onClick={cancelNewReturn}>Cancel</Button>
            <Button type="primary" onClick={handleCreateReturn} loading={createLoading}>Create Sales Return</Button>
          </div>
        </div>
      </Modal>

      {/* View Return Detail Modal */}
      {viewReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewReturn(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">Sales Return Details</h2>
                <p className="text-sm text-gray-500 mt-0.5">{viewReturn.returnNumber}</p>
              </div>
              <div className="flex items-center gap-3">
                <Tag color={STATUS_COLORS[viewReturn.status]} className="text-sm px-3 py-0.5">{viewReturn.status?.replace(/_/g, ' ')}</Tag>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl" onClick={() => setViewReturn(null)}>✕</span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Dealer & Order Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Dealer:</span> <span className="font-medium">{viewReturn.dealerName || viewReturn.dealer?.businessName || '-'}</span></div>
                  <div><span className="text-gray-500">Dealer Code:</span> <span className="font-medium">{viewReturn.dealerCode || viewReturn.dealer?.dealerCode || '-'}</span></div>
                  <div><span className="text-gray-500">Against SO:</span> <span className="font-medium font-mono text-blue-600">{viewReturn.orderNumber || '-'}</span></div>
                  <div><span className="text-gray-500">Return Date:</span> <span className="font-medium">{viewReturn.returnDate ? new Date(viewReturn.returnDate).toLocaleDateString('en-IN') : '-'}</span></div>
                  <div><span className="text-gray-500">Adjustment Type:</span> <span className="font-medium capitalize">{viewReturn.adjustmentType?.replace(/_/g, ' ') || 'Credit Note'}</span></div>
                  <div><span className="text-gray-500">Credit Note #:</span> <span className="font-medium text-green-600">{viewReturn.creditNoteNumber || '-'}</span></div>
                </div>
              </div>

              {/* Return Items */}
              <div>
                <h3 className="text-sm font-semibold text-gray-600 mb-2">Returned Items ({viewReturn.items?.length || 0})</h3>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-100"><tr>
                      <th className="px-3 py-2 text-left">#</th>
                      <th className="px-3 py-2 text-left">Product</th>
                      <th className="px-3 py-2 text-right">Qty</th>
                      <th className="px-3 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                      <th className="px-3 py-2 text-left">Condition</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr></thead>
                    <tbody>
                      {viewReturn.items?.map((item, idx) => {
                        const taxable = (item.returnQty || item.quantity || 0) * (item.rate || 0);
                        const gst = (taxable * (item.gstPercentage || 0)) / 100;
                        return (
                          <tr key={idx} className="border-t">
                            <td className="px-3 py-2">{idx + 1}</td>
                            <td className="px-3 py-2">
                              <div className="font-medium">{item.productName}</div>
                              <div className="text-gray-400">{item.productCode} {item.shade ? `· ${item.shade}` : ''}</div>
                            </td>
                            <td className="px-3 py-2 text-right font-medium">{item.returnQty || item.quantity || 0} {item.unit}</td>
                            <td className="px-3 py-2 text-right">₹{(item.rate || 0).toLocaleString()}</td>
                            <td className="px-3 py-2"><Tag color="default">{REASON_LABELS[item.reason] || item.reason || '-'}</Tag></td>
                            <td className="px-3 py-2"><Tag color={CONDITION_COLORS[item.condition] || 'default'}>{item.condition || '-'}</Tag></td>
                            <td className="px-3 py-2 text-right font-semibold">₹{Math.round(taxable + gst).toLocaleString()}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-purple-50 rounded-lg p-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Subtotal:</span><span className="font-medium">₹{(viewReturn.subtotal || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">GST:</span><span className="font-medium">₹{(viewReturn.totalTax || 0).toLocaleString()}</span></div>
                  <div className="col-span-2 border-t pt-2 mt-1 flex justify-between text-base font-bold"><span>Grand Total:</span><span className="text-purple-700">₹{(viewReturn.grandTotal || 0).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Remarks */}
              {viewReturn.remarks && (
                <div className="bg-yellow-50 rounded-lg p-3"><span className="text-xs font-semibold text-gray-600">Remarks:</span><p className="text-sm mt-1">{viewReturn.remarks}</p></div>
              )}

              {/* Meta */}
              <div className="text-xs text-gray-400 flex gap-4 pt-2 border-t">
                <span>Created: {viewReturn.createdAt ? new Date(viewReturn.createdAt).toLocaleDateString('en-IN') : '-'}</span>
                <span>By: {viewReturn.createdBy?.name || '-'}</span>
                {viewReturn.approvedAt && <span>Approved: {new Date(viewReturn.approvedAt).toLocaleDateString('en-IN')}</span>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SalesReturnPage;
