import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Tooltip, Row, Col, Card, Statistic, InputNumber, Divider, Popconfirm } from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, CheckCircleOutlined, ReloadOutlined, AuditOutlined } from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';

const STATUS_COLORS = {
  pending: 'orange', approved: 'green', cancelled: 'red',
};

const GRNEntryPage = () => {
  const [grns, setGRNs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined });
  const [stats, setStats] = useState({});
  const [showCreateGRN, setShowCreateGRN] = useState(false);

  const fetchStats = () => {
    // Derive stats from list or a separate endpoint if available
    purchaseService.getGRNs({ limit: 1 }).then(r => {
      if (r.success) {
        setStats({
          total: r.pagination?.totalItems || 0,
          pending: r.stats?.pending || 0,
          approved: r.stats?.approved || 0,
        });
      }
    }).catch(() => {});
  };

  useEffect(() => { fetchStats(); }, []);

  const fetchGRNs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const res = await purchaseService.getGRNs(params);
      if (res.success) {
        setGRNs(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
        if (res.stats) setStats(res.stats);
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchGRNs(); }, [fetchGRNs]);

  const handleApprove = async (id) => {
    try {
      const res = await purchaseService.approveGRN(id);
      if (res.success) { message.success('GRN approved & stock updated'); fetchGRNs(); fetchStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'GRN #', dataIndex: 'grnNumber', width: 120, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'grnDate', width: 100, render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '-'}</span> },
    { title: 'Supplier', key: 'supplier', width: 180, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[170px]">{r.supplierName || r.supplier?.businessName || '-'}</div></div>
    )},
    { title: 'PO #', dataIndex: 'poNumber', width: 110, render: (v, r) => <span className="text-xs font-mono">{v || r.purchaseOrder?.poNumber || '-'}</span> },
    { title: 'Invoice No', dataIndex: 'supplierInvoiceNo', width: 120, render: v => <span className="text-xs">{v || '-'}</span> },
    { title: 'Vehicle', dataIndex: 'vehicleNo', width: 100, render: v => <span className="text-xs">{v || '-'}</span> },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" /></Tooltip>
        {r.status === 'pending' && (
          <Popconfirm title="Approve GRN & update stock?" onConfirm={() => handleApprove(r._id)} okText="Approve" cancelText="Cancel">
            <Tooltip title="Approve"><Button type="text" size="small" icon={<CheckCircleOutlined />} className="text-green-600" /></Tooltip>
          </Popconfirm>
        )}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Goods Receipt Note (GRN)</h1><p className="text-sm text-gray-500 mt-0.5">Record incoming goods against purchase orders</p></div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreateGRN(true)}>New GRN</Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={8}><Card size="small"><Statistic title="Total GRNs" value={stats.total || 0} prefix={<AuditOutlined />} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Pending" value={stats.pending || 0} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Approved" value={stats.approved || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search GRN #, supplier, invoice..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" options={[{ value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'cancelled', label: 'Cancelled' }]}
            value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))} allowClear className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ status: undefined }); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={grns} rowKey="_id" loading={loading} size="middle" scroll={{ x: 950 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} GRNs` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Create GRN Overlay */}
      {showCreateGRN && (
        <CreateGRN
          onClose={() => setShowCreateGRN(false)}
          onSuccess={() => { fetchGRNs(); fetchStats(); }}
        />
      )}
    </div>
  );
};

// ===================== CREATE GRN (Full-page overlay) =====================
const CreateGRN = ({ onClose, onSuccess }) => {
  const [availablePOs, setAvailablePOs] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [items, setItems] = useState([]);
  const [warehouses, setWarehouses] = useState([]);

  const [formData, setFormData] = useState({
    grnDate: new Date().toISOString().split('T')[0],
    supplierInvoiceNo: '',
    vehicleNo: '',
    remarks: '',
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    purchaseService.getAvailablePOs().then(r => {
      if (r.success) setAvailablePOs(r.data);
    }).catch(() => {});
    masterService.getWarehouses({ limit: 50 }).then(r => {
      if (r.success) setWarehouses(r.data);
    }).catch(() => {});
  }, []);

  const handleSelectPO = (poId) => {
    const po = availablePOs.find(p => p._id === poId);
    if (!po) return;
    setSelectedPO(po);
    // Build items from PO items
    setItems((po.items || []).map((item, idx) => ({
      key: idx,
      product: item.product,
      productCode: item.productCode,
      productName: item.productName,
      unit: item.unit || 'Box',
      orderedQty: item.quantity || 0,
      receivedQty: item.quantity || 0,
      acceptedQty: item.quantity || 0,
      shortQty: 0,
      damagedQty: 0,
      shade: item.shade || '',
      batch: item.batch || '',
      warehouse: warehouses[0]?._id || '',
      rack: '',
    })));
  };

  const updateItem = (key, field, value) => {
    setItems(prev => prev.map(i => {
      if (i.key !== key) return i;
      const updated = { ...i, [field]: value };
      // Auto-calculate
      if (field === 'receivedQty' || field === 'damagedQty') {
        const received = field === 'receivedQty' ? value : updated.receivedQty;
        const damaged = field === 'damagedQty' ? value : updated.damagedQty;
        updated.acceptedQty = Math.max(0, received - damaged);
        updated.shortQty = Math.max(0, updated.orderedQty - received);
      }
      return updated;
    }));
  };

  const handleSubmit = async () => {
    if (!selectedPO) { message.error('Select a Purchase Order first'); return; }
    if (!formData.supplierInvoiceNo) { message.error('Enter supplier invoice number'); return; }
    setLoading(true);
    try {
      const payload = {
        purchaseOrder: selectedPO._id,
        supplier: selectedPO.supplier?._id || selectedPO.supplier,
        grnDate: formData.grnDate,
        supplierInvoiceNo: formData.supplierInvoiceNo,
        vehicleNo: formData.vehicleNo,
        remarks: formData.remarks,
        items: items.map(i => ({
          product: i.product, productCode: i.productCode, productName: i.productName,
          unit: i.unit, orderedQty: i.orderedQty, receivedQty: i.receivedQty,
          acceptedQty: i.acceptedQty, shortQty: i.shortQty, damagedQty: i.damagedQty,
          shade: i.shade, batch: i.batch, warehouse: i.warehouse, rack: i.rack,
        })),
      };
      const res = await purchaseService.createGRN(payload);
      if (res.success) {
        message.success(`GRN ${res.data.grnNumber || ''} created!`);
        onSuccess?.();
        onClose();
      }
    } catch (err) { message.error(err.message || 'Failed to create GRN'); }
    finally { setLoading(false); }
  };

  const columns = [
    { title: '#', width: 35, render: (_, __, i) => <span className="text-xs text-gray-400">{i + 1}</span> },
    { title: 'Product', width: 180, render: (_, r) => (
      <div><div className="text-xs font-medium truncate max-w-[170px]">{r.productName}</div>
        <div className="text-[10px] text-gray-400">{r.productCode}</div></div>
    )},
    { title: 'Ordered', width: 70, render: (_, r) => <span className="text-xs font-medium bg-gray-100 px-2 py-0.5 rounded">{r.orderedQty}</span> },
    { title: 'Received', width: 75, render: (_, r) => <InputNumber size="small" min={0} value={r.receivedQty} onChange={v => updateItem(r.key, 'receivedQty', v)} className="w-full" /> },
    { title: 'Accepted', width: 75, render: (_, r) => <span className="text-xs font-semibold text-green-600">{r.acceptedQty}</span> },
    { title: 'Short', width: 65, render: (_, r) => <span className="text-xs text-orange-500">{r.shortQty}</span> },
    { title: 'Damaged', width: 75, render: (_, r) => <InputNumber size="small" min={0} value={r.damagedQty} onChange={v => updateItem(r.key, 'damagedQty', v)} className="w-full" /> },
    { title: 'Shade', width: 80, render: (_, r) => <Input size="small" value={r.shade} onChange={e => updateItem(r.key, 'shade', e.target.value)} placeholder="—" /> },
    { title: 'Batch', width: 80, render: (_, r) => <Input size="small" value={r.batch} onChange={e => updateItem(r.key, 'batch', e.target.value)} placeholder="—" /> },
    { title: 'Warehouse', width: 120, render: (_, r) => (
      <Select size="small" value={r.warehouse} onChange={v => updateItem(r.key, 'warehouse', v)} className="w-full"
        options={warehouses.map(w => ({ value: w._id, label: w.name }))} placeholder="Select" allowClear />
    )},
    { title: 'Rack', width: 70, render: (_, r) => <Input size="small" value={r.rack} onChange={e => updateItem(r.key, 'rack', e.target.value)} placeholder="—" /> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 border-b px-6 py-3 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-800">New Goods Receipt Note</h2>
            <div className="flex gap-2">
              <Button type="primary" onClick={handleSubmit} loading={loading}>Save GRN</Button>
              <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-1 ml-2" onClick={onClose}>✕</span>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* PO Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Select Purchase Order *</label>
                <Select
                  placeholder="Select an approved PO"
                  className="w-full"
                  size="large"
                  showSearch
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={availablePOs.map(po => ({
                    value: po._id,
                    label: `${po.poNumber} - ${po.supplierName || po.supplier?.businessName || 'Supplier'} (₹${(po.grandTotal || 0).toLocaleString()})`,
                  }))}
                  onChange={handleSelectPO}
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-1.5">Supplier</label>
                <Input size="large" disabled value={selectedPO ? (selectedPO.supplierName || selectedPO.supplier?.businessName || '') : ''} className="bg-gray-50" />
              </div>
            </div>

            {/* GRN Details */}
            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="text-xs text-gray-500 block mb-1">GRN Date</label>
                <Input type="date" value={formData.grnDate} onChange={e => setFormData(p => ({ ...p, grnDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Supplier Invoice No *</label>
                <Input value={formData.supplierInvoiceNo} onChange={e => setFormData(p => ({ ...p, supplierInvoiceNo: e.target.value }))} placeholder="INV-001" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Vehicle No</label>
                <Input value={formData.vehicleNo} onChange={e => setFormData(p => ({ ...p, vehicleNo: e.target.value }))} placeholder="MH-12-AB-1234" />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Remarks</label>
                <Input value={formData.remarks} onChange={e => setFormData(p => ({ ...p, remarks: e.target.value }))} placeholder="Optional notes" />
              </div>
            </div>

            <Divider className="my-3" />

            {/* Items Table */}
            {items.length > 0 ? (
              <div>
                <label className="text-sm font-semibold text-gray-700 block mb-2">Items Received</label>
                <div className="border rounded-lg overflow-hidden">
                  <Table columns={columns} dataSource={items} rowKey="key" size="small" pagination={false} scroll={{ x: 1100 }} />
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-gray-400 border-2 border-dashed rounded-lg">
                <AuditOutlined className="mx-auto mb-2 opacity-40 text-4xl" />
                <p>Select a Purchase Order above to load items</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default GRNEntryPage;
