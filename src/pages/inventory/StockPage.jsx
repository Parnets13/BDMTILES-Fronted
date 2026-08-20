import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, InputNumber, Modal, Divider } from 'antd';
import { SearchOutlined, ReloadOutlined, SwapOutlined, PlusCircleOutlined } from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import productService from '../../services/productService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';

const StockPage = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ warehouse: undefined, shade: undefined, batch: undefined });
  const [summary, setSummary] = useState({});
  const [warehouses, setWarehouses] = useState([]);

  // Modals
  const [showAdjust, setShowAdjust] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  useEffect(() => {
    purchaseService.getStockSummary().then(r => { if (r.success) setSummary(r.data); }).catch(() => {});
    masterService.getWarehouses({ limit: 50 }).then(r => { if (r.success) setWarehouses(r.data); }).catch(() => {});
  }, []);

  const fetchStock = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const res = await purchaseService.getStock(params);
      if (res.success) {
        setStock(res.data);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchStock(); }, [fetchStock]);

  const columns = [
    { title: 'Product Code', dataIndex: 'productCode', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Product Name', dataIndex: 'productName', width: 200, render: (v, r) => (
      <div><div className="text-sm font-medium truncate max-w-[190px]">{v || r.product?.itemName || '-'}</div>
        <div className="text-[10px] text-gray-400">{r.brandName || r.product?.brand?.name || ''}</div></div>
    )},
    { title: 'Warehouse', dataIndex: 'warehouseName', width: 120, render: (v, r) => <span className="text-xs">{v || r.warehouse?.name || '-'}</span> },
    { title: 'Shade', dataIndex: 'shade', width: 80, render: v => <span className="text-xs">{v || '-'}</span> },
    { title: 'Batch', dataIndex: 'batch', width: 80, render: v => <span className="text-xs">{v || '-'}</span> },
    { title: 'Total Qty', dataIndex: 'totalQty', width: 80, render: v => <span className="text-sm font-semibold">{v || 0}</span> },
    { title: 'Available', dataIndex: 'availableQty', width: 80, render: v => <span className="text-sm font-medium text-green-600">{v || 0}</span> },
    { title: 'Reserved', dataIndex: 'reservedQty', width: 80, render: v => <span className="text-sm text-blue-600">{v || 0}</span> },
    { title: 'Damaged', dataIndex: 'damagedQty', width: 80, render: v => v > 0 ? <span className="text-sm text-red-500">{v}</span> : <span className="text-xs text-gray-300">0</span> },
    { title: 'Rack/Bin', dataIndex: 'rack', width: 80, render: v => <span className="text-xs">{v || '-'}</span> },
    { title: 'Last GRN', dataIndex: 'lastGRNDate', width: 100, render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '-'}</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Stock Management</h1><p className="text-sm text-gray-500 mt-0.5">Real-time inventory view across all warehouses</p></div>
        <Space>
          <ModuleRecycleBin module="stock" title="Deleted Stock Records" onRestore={fetchStock} />
          <Button icon={<PlusCircleOutlined />} onClick={() => setShowAdjust(true)}>Adjust Stock</Button>
          <Button type="primary" icon={<SwapOutlined />} onClick={() => setShowTransfer(true)}>Transfer</Button>
        </Space>
      </div>

      {/* Summary Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={5}><Card size="small"><Statistic title="Total Qty" value={summary.totalQty || 0} /></Card></Col>
        <Col span={5}><Card size="small"><Statistic title="Available" value={summary.availableQty || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Reserved" value={summary.reservedQty || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Damaged" value={summary.damagedQty || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Value" value={`₹${(summary.totalValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search product code, name..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Warehouse" options={warehouses.map(w => ({ value: w._id, label: w.name }))}
            value={filters.warehouse} onChange={v => setFilters(f => ({ ...f, warehouse: v }))} allowClear className="w-40" />
          <Input placeholder="Shade" value={filters.shade} onChange={e => setFilters(f => ({ ...f, shade: e.target.value || undefined }))} className="w-28" allowClear />
          <Input placeholder="Batch" value={filters.batch} onChange={e => setFilters(f => ({ ...f, batch: e.target.value || undefined }))} className="w-28" allowClear />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ warehouse: undefined, shade: undefined, batch: undefined }); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={stock} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1150 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} records` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Adjust Stock Modal */}
      <AdjustStockModal
        open={showAdjust}
        onClose={() => setShowAdjust(false)}
        warehouses={warehouses}
        onSuccess={() => { fetchStock(); purchaseService.getStockSummary().then(r => { if (r.success) setSummary(r.data); }).catch(() => {}); }}
      />

      {/* Transfer Stock Modal */}
      <TransferStockModal
        open={showTransfer}
        onClose={() => setShowTransfer(false)}
        warehouses={warehouses}
        onSuccess={() => { fetchStock(); purchaseService.getStockSummary().then(r => { if (r.success) setSummary(r.data); }).catch(() => {}); }}
      />
    </div>
  );
};

// ===================== ADJUST STOCK MODAL =====================
const AdjustStockModal = ({ open, onClose, warehouses, onSuccess }) => {
  const [formData, setFormData] = useState({
    product: '', warehouse: '', shade: '', batch: '', quantity: 0, adjustmentType: 'add', reason: '',
  });
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(() => {
      productService.getProducts({ search: productSearch, limit: 10 }).then(r => {
        if (r.success) setProductResults(r.data);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleSubmit = async () => {
    if (!formData.product) { message.error('Select a product'); return; }
    if (!formData.warehouse) { message.error('Select a warehouse'); return; }
    if (!formData.quantity || formData.quantity <= 0) { message.error('Enter valid quantity'); return; }
    if (!formData.reason) { message.error('Enter reason for adjustment'); return; }
    setLoading(true);
    try {
      const res = await purchaseService.adjustStock(formData);
      if (res.success) {
        message.success('Stock adjusted successfully');
        onSuccess?.();
        onClose();
        setFormData({ product: '', warehouse: '', shade: '', batch: '', quantity: 0, adjustmentType: 'add', reason: '' });
        setProductSearch('');
      }
    } catch (err) { message.error(err.message || 'Adjustment failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Adjust Stock" open={open} onCancel={onClose} onOk={handleSubmit} confirmLoading={loading}
      okText="Adjust" width={500}>
      <div className="space-y-4 mt-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Product *</label>
          <div className="relative">
            <Input
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search product..."
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && productResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {productResults.map(p => (
                  <div key={p._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50"
                    onClick={() => { setFormData(f => ({ ...f, product: p._id })); setProductSearch(p.itemName); setShowDropdown(false); }}>
                    <div className="text-sm font-medium">{p.itemName}</div>
                    <div className="text-xs text-gray-400">{p.productCode}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Warehouse *</label>
          <Select className="w-full" value={formData.warehouse || undefined} onChange={v => setFormData(f => ({ ...f, warehouse: v }))}
            options={warehouses.map(w => ({ value: w._id, label: w.name }))} placeholder="Select warehouse" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Shade</label>
            <Input value={formData.shade} onChange={e => setFormData(f => ({ ...f, shade: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Batch</label>
            <Input value={formData.batch} onChange={e => setFormData(f => ({ ...f, batch: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Adjustment Type *</label>
            <Select className="w-full" value={formData.adjustmentType} onChange={v => setFormData(f => ({ ...f, adjustmentType: v }))}
              options={[{ value: 'add', label: '+ Add' }, { value: 'subtract', label: '- Subtract' }]} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quantity *</label>
            <InputNumber className="w-full" min={1} value={formData.quantity} onChange={v => setFormData(f => ({ ...f, quantity: v }))} />
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-500 block mb-1">Reason *</label>
          <Input.TextArea rows={2} value={formData.reason} onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))} placeholder="Reason for stock adjustment..." />
        </div>
      </div>
    </Modal>
  );
};

// ===================== TRANSFER STOCK MODAL =====================
const TransferStockModal = ({ open, onClose, warehouses, onSuccess }) => {
  const [formData, setFormData] = useState({
    product: '', fromWarehouse: '', toWarehouse: '', shade: '', batch: '', quantity: 0,
  });
  const [loading, setLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);

  useEffect(() => {
    if (productSearch.length < 2) { setProductResults([]); return; }
    const timer = setTimeout(() => {
      productService.getProducts({ search: productSearch, limit: 10 }).then(r => {
        if (r.success) setProductResults(r.data);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const handleSubmit = async () => {
    if (!formData.product) { message.error('Select a product'); return; }
    if (!formData.fromWarehouse) { message.error('Select source warehouse'); return; }
    if (!formData.toWarehouse) { message.error('Select destination warehouse'); return; }
    if (formData.fromWarehouse === formData.toWarehouse) { message.error('Source and destination must be different'); return; }
    if (!formData.quantity || formData.quantity <= 0) { message.error('Enter valid quantity'); return; }
    setLoading(true);
    try {
      const res = await purchaseService.transferStock(formData);
      if (res.success) {
        message.success('Stock transferred successfully');
        onSuccess?.();
        onClose();
        setFormData({ product: '', fromWarehouse: '', toWarehouse: '', shade: '', batch: '', quantity: 0 });
        setProductSearch('');
      }
    } catch (err) { message.error(err.message || 'Transfer failed'); }
    finally { setLoading(false); }
  };

  return (
    <Modal title="Transfer Stock" open={open} onCancel={onClose} onOk={handleSubmit} confirmLoading={loading}
      okText="Transfer" width={500}>
      <div className="space-y-4 mt-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Product *</label>
          <div className="relative">
            <Input
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search product..."
              value={productSearch}
              onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
            />
            {showDropdown && productResults.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                {productResults.map(p => (
                  <div key={p._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50"
                    onClick={() => { setFormData(f => ({ ...f, product: p._id })); setProductSearch(p.itemName); setShowDropdown(false); }}>
                    <div className="text-sm font-medium">{p.itemName}</div>
                    <div className="text-xs text-gray-400">{p.productCode}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">From Warehouse *</label>
            <Select className="w-full" value={formData.fromWarehouse || undefined} onChange={v => setFormData(f => ({ ...f, fromWarehouse: v }))}
              options={warehouses.map(w => ({ value: w._id, label: w.name }))} placeholder="Source" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To Warehouse *</label>
            <Select className="w-full" value={formData.toWarehouse || undefined} onChange={v => setFormData(f => ({ ...f, toWarehouse: v }))}
              options={warehouses.map(w => ({ value: w._id, label: w.name }))} placeholder="Destination" />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Shade</label>
            <Input value={formData.shade} onChange={e => setFormData(f => ({ ...f, shade: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Batch</label>
            <Input value={formData.batch} onChange={e => setFormData(f => ({ ...f, batch: e.target.value }))} placeholder="Optional" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Quantity *</label>
            <InputNumber className="w-full" min={1} value={formData.quantity} onChange={v => setFormData(f => ({ ...f, quantity: v }))} />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default StockPage;
