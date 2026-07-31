import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Modal, InputNumber, Divider, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, CheckCircleOutlined, CloseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { Undo2 } from 'lucide-react';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = { draft: 'default', approved: 'blue', stock_updated: 'cyan', credit_issued: 'green', cancelled: 'red' };
const REASON_LABELS = { damaged: 'Damaged', wrong_product: 'Wrong Product', quality_issue: 'Quality Issue', excess: 'Excess', shade_mismatch: 'Shade Mismatch', other: 'Other' };
const CONDITION_COLORS = { resaleable: 'green', damaged: 'red', scrap: 'volcano' };

const SalesReturnPage = () => {
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({});

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

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
      const res = await salesService.createReturn(payload);
      if (res.success) {
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
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>New Sales Return</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total Returns" value={stats.total || 0} prefix={<Undo2 size={14} />} /></Card></Col>
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
      <Modal title="New Sales Return" open={showCreate} onCancel={() => { setShowCreate(false); resetCreateForm(); }}
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
            <Button onClick={() => { setShowCreate(false); resetCreateForm(); }}>Cancel</Button>
            <Button type="primary" onClick={handleCreateReturn} loading={createLoading}>Create Sales Return</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default SalesReturnPage;
