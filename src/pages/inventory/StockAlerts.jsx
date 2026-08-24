import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message, Tabs, InputNumber, Modal, Checkbox,
  Row, Col, Card, Statistic, Badge, Tooltip
} from 'antd';
import { ReloadOutlined, SearchOutlined, WarningOutlined, ShopOutlined, FallOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import getImageUrl from '../../utils/imageUrl.js';

const ALERT_LEVELS = {
  out_of_stock:  { label: 'Out of Stock',  color: 'red',    bg: '#fee2e2' },
  critical:      { label: 'Critical',      color: 'volcano',bg: '#fff1f0' },
  low_stock:     { label: 'Low Stock',     color: 'orange', bg: '#fffbe6' },
  adequate:      { label: 'Adequate',      color: 'green',  bg: '#f6ffed' },
};

const getAlertLevel = (qty, reorderLevel = 10, minLevel = 5) => {
  if (qty <= 0)              return 'out_of_stock';
  if (qty <= minLevel)       return 'critical';
  if (qty <= reorderLevel)   return 'low_stock';
  return 'adequate';
};

const StockAlerts = () => {
  const [stock, setStock] = useState([]);
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseFilter, setWarehouseFilter] = useState(undefined);
  const [alertFilter, setAlertFilter] = useState('low_stock'); // show low + critical + out by default
  const [search, setSearch] = useState('');
  const [lowThreshold, setLowThreshold] = useState(10);
  const [summary, setSummary] = useState({ outOfStock: 0, critical: 0, lowStock: 0 });
  const [showReorder, setShowReorder] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch all low-stock items using the inventory report endpoint
      const res = await purchaseService.getStock({
        warehouse: warehouseFilter,
        limit: 200,
        page: 1,
      });
      if (res.success) {
        const all = res.data || [];
        // Annotate each with alert level
        const annotated = all.map(s => ({
          ...s,
          alertLevel: getAlertLevel(s.availableQty, lowThreshold, Math.floor(lowThreshold / 2)),
        }));

        setSummary({
          outOfStock: annotated.filter(s => s.alertLevel === 'out_of_stock').length,
          critical:   annotated.filter(s => s.alertLevel === 'critical').length,
          lowStock:   annotated.filter(s => s.alertLevel === 'low_stock').length,
        });

        setStock(annotated);
      }
    } catch (err) { message.error(err.message || 'Failed to load stock'); }
    finally { setLoading(false); }
  }, [warehouseFilter, lowThreshold]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    masterService.getWarehouses({ limit: 50 }).then(r => {
      if (r.success) setWarehouses(r.data || []);
    }).catch(() => {});
  }, []);

  const filtered = stock.filter(s => {
    const matchAlert = alertFilter === 'all'
      ? s.alertLevel !== 'adequate'
      : s.alertLevel === alertFilter;
    const matchSearch = !search ||
      s.product?.itemName?.toLowerCase().includes(search.toLowerCase()) ||
      s.product?.productCode?.toLowerCase().includes(search.toLowerCase());
    return matchAlert && matchSearch;
  });

  const columns = [
    {
      title: 'Alert',
      dataIndex: 'alertLevel',
      width: 120,
      render: v => {
        const lvl = ALERT_LEVELS[v] || ALERT_LEVELS.adequate;
        return (
          <Tag color={lvl.color} style={{ fontWeight: 600 }}>
            {v === 'out_of_stock' && <WarningOutlined className="mr-1" />}
            {lvl.label}
          </Tag>
        );
      },
      sorter: (a, b) => {
        const order = { out_of_stock: 0, critical: 1, low_stock: 2, adequate: 3 };
        return (order[a.alertLevel] || 3) - (order[b.alertLevel] || 3);
      },
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">
            {r.product?.itemName || '—'}
          </div>
          <div className="text-xs text-gray-400 font-mono">
            {r.product?.productCode || ''}
            {r.shade ? ` · Shade: ${r.shade}` : ''}
            {r.batch ? ` · Batch: ${r.batch}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Warehouse',
      key: 'wh',
      width: 130,
      render: (_, r) => <span className="text-sm">{r.warehouse?.name || '—'}</span>,
    },
    {
      title: 'Available Qty',
      dataIndex: 'availableQty',
      width: 120,
      sorter: (a, b) => (a.availableQty || 0) - (b.availableQty || 0),
      render: (v, r) => {
        const lvl = r.alertLevel;
        const color = lvl === 'out_of_stock' ? '#dc2626' : lvl === 'critical' ? '#ea580c' : lvl === 'low_stock' ? '#d97706' : '#16a34a';
        return <span className="font-bold text-base" style={{ color }}>{v ?? 0}</span>;
      },
    },
    {
      title: 'Reserved',
      dataIndex: 'reservedQty',
      width: 90,
      render: v => <span className="text-gray-500">{v ?? 0}</span>,
    },
    {
      title: 'Reorder Level',
      key: 'reorder',
      width: 110,
      render: () => <span className="text-xs text-gray-400">{lowThreshold} units</span>,
    },
    {
      title: 'Size / Finish',
      key: 'spec',
      width: 130,
      render: (_, r) => (
        <span className="text-xs text-gray-500">
          {[r.product?.tileSize, r.product?.finish].filter(Boolean).join(' · ') || '—'}
        </span>
      ),
    },
    {
      title: 'Stock Value',
      key: 'val',
      width: 110,
      render: (_, r) => {
        const val = (r.availableQty || 0) * (r.purchaseRate || 0);
        return <span className="text-sm">₹{val.toLocaleString()}</span>;
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <WarningOutlined className="text-orange-500 text-xl" />
            Stock Alerts
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Products below reorder level — requires restocking action
          </p>
        </div>
        <Space>
          <Button icon={<ShoppingCartOutlined />} onClick={() => setShowReorder(true)} type="primary" ghost>
            Reorder Suggestions
          </Button>
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Summary cards */}
      <Row gutter={16} className="mb-5">
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '4px solid #dc2626', cursor: 'pointer' }}
            onClick={() => setAlertFilter('out_of_stock')}>
            <Statistic
              title={<span className="flex items-center gap-1"><WarningOutlined className="text-red-600" /> Out of Stock</span>}
              value={summary.outOfStock}
              valueStyle={{ color: '#dc2626', fontSize: 28 }}
            />
            <div className="text-xs text-gray-400 mt-1">Zero available qty</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '4px solid #ea580c', cursor: 'pointer' }}
            onClick={() => setAlertFilter('critical')}>
            <Statistic
              title={<span className="flex items-center gap-1"><FallOutlined className="text-orange-600" /> Critical</span>}
              value={summary.critical}
              valueStyle={{ color: '#ea580c', fontSize: 28 }}
            />
            <div className="text-xs text-gray-400 mt-1">Below {Math.floor(lowThreshold / 2)} units</div>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" style={{ borderLeft: '4px solid #d97706', cursor: 'pointer' }}
            onClick={() => setAlertFilter('low_stock')}>
            <Statistic
              title={<span className="flex items-center gap-1"><ShopOutlined className="text-yellow-600" /> Low Stock</span>}
              value={summary.lowStock}
              valueStyle={{ color: '#d97706', fontSize: 28 }}
            />
            <div className="text-xs text-gray-400 mt-1">Below {lowThreshold} units</div>
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Search Product</label>
            <Input
              placeholder="Name or code…"
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-52"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Alert Level</label>
            <Select
              value={alertFilter}
              onChange={setAlertFilter}
              className="w-40"
              options={[
                { value: 'all',          label: 'All Alerts' },
                { value: 'out_of_stock', label: 'Out of Stock' },
                { value: 'critical',     label: 'Critical' },
                { value: 'low_stock',    label: 'Low Stock' },
              ]}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Warehouse</label>
            <Select
              placeholder="All warehouses"
              allowClear
              value={warehouseFilter}
              onChange={setWarehouseFilter}
              className="w-44"
              options={warehouses.map(w => ({ value: w._id, label: w.name }))}
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Reorder Level (units)</label>
            <Input
              type="number"
              value={lowThreshold}
              onChange={e => setLowThreshold(parseInt(e.target.value) || 10)}
              className="w-28"
              min={1}
            />
          </div>
        </div>
      </div>

      {/* Alert banner if critical items exist */}
      {summary.outOfStock > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <WarningOutlined />
          <strong>{summary.outOfStock} product(s) are completely out of stock.</strong>
          &nbsp;Raise a Purchase Order immediately to avoid dispatch failures.
          <Button size="small" type="primary" danger icon={<ShoppingCartOutlined />} className="ml-auto"
            onClick={() => setShowReorder(true)}>
            View Reorder Suggestions
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-600">
            {filtered.length} item{filtered.length !== 1 ? 's' : ''} shown
          </span>
          {alertFilter !== 'all' && (
            <Button size="small" type="link" onClick={() => setAlertFilter('all')}>
              Show all alerts
            </Button>
          )}
        </div>
        <Table
          columns={columns}
          dataSource={filtered}
          rowKey={r => `${r._id}-${r.shade}-${r.batch}`}
          loading={loading}
          size="small"
          pagination={{ pageSize: 30, showSizeChanger: false }}
          rowClassName={r =>
            r.alertLevel === 'out_of_stock' ? 'bg-red-50' :
            r.alertLevel === 'critical'     ? 'bg-orange-50' : ''
          }
          locale={{
            emptyText: loading ? 'Loading…' : 'No stock alerts — all products are adequately stocked!',
          }}
        />
      </div>

      {/* Reorder Suggestions Modal */}
      <ReorderSuggestionsModal open={showReorder} onClose={() => setShowReorder(false)} />
    </div>
  );
};

// ═══════════════════════════════════════════════
// REORDER SUGGESTIONS MODAL
// ═══════════════════════════════════════════════
const ReorderSuggestionsModal = ({ open, onClose }) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState({});

  useEffect(() => {
    if (open) {
      fetchSuggestions();
      masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data || []); }).catch(() => {});
    }
  }, [open]);

  const fetchSuggestions = async () => {
    setLoading(true);
    try {
      const res = await purchaseService.getReorderSuggestions();
      if (res.success) {
        setSuggestions(res.data || []);
        setSummary(res.summary || {});
        // Pre-select all critical items
        setSelectedItems((res.data || []).filter(s => s.urgency === 'critical').map(s => s.product));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const toggleSelect = (productId) => {
    setSelectedItems(prev => prev.includes(productId) ? prev.filter(id => id !== productId) : [...prev, productId]);
  };

  const selectAll = () => setSelectedItems(suggestions.map(s => s.product));
  const selectNone = () => setSelectedItems([]);

  const handleCreatePO = async () => {
    if (!selectedSupplier) { message.error('Select a supplier'); return; }
    if (selectedItems.length === 0) { message.error('Select at least one product'); return; }

    const items = suggestions.filter(s => selectedItems.includes(s.product)).map(s => ({
      product: s.product,
      productName: s.productName,
      productCode: s.productCode,
      quantity: s.suggestedQty,
      rate: s.lastPurchaseRate,
      gstPercentage: 18,
    }));

    setCreating(true);
    try {
      const res = await purchaseService.createPOFromSuggestions({ supplier: selectedSupplier, items });
      if (res.success) {
        message.success(res.message || 'PO created successfully!');
        onClose();
      }
    } catch (err) { message.error(err.message); }
    finally { setCreating(false); }
  };

  const URGENCY_COLORS = { critical: 'red', high: 'orange', medium: 'blue' };

  return (
    <Modal title="Reorder Suggestions — Create Purchase Order" open={open} onCancel={onClose} width={950}
      footer={
        <div className="flex justify-between items-center">
          <span className="text-xs text-gray-500">{selectedItems.length} of {suggestions.length} items selected</span>
          <Space>
            <Button onClick={onClose}>Cancel</Button>
            <Button type="primary" icon={<ShoppingCartOutlined />} onClick={handleCreatePO} loading={creating}
              disabled={selectedItems.length === 0 || !selectedSupplier}>
              Create PO ({selectedItems.length} items)
            </Button>
          </Space>
        </div>
      }>
      <div className="space-y-4 mt-3">
        {/* Summary */}
        <Row gutter={12}>
          <Col span={6}><Card size="small"><Statistic title="Total Suggestions" value={summary.total || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Critical (Zero Stock)" value={summary.critical || 0} valueStyle={{ color: '#dc2626' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="High Priority" value={summary.high || 0} valueStyle={{ color: '#ea580c' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Medium" value={summary.medium || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        </Row>

        {/* Supplier selection */}
        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
          <label className="text-xs text-gray-600 font-semibold block mb-1">Select Supplier for PO *</label>
          <Select showSearch className="w-full" size="large" value={selectedSupplier || undefined}
            placeholder="Select supplier..." optionFilterProp="label"
            onChange={v => setSelectedSupplier(v)}
            options={[
              // Show suggested suppliers first
              ...Array.from(new Set(suggestions.filter(s => s.suggestedSupplier).map(s => JSON.stringify({ value: s.suggestedSupplier, label: `${s.suggestedSupplierName} (suggested)` })))).map(s => JSON.parse(s)),
              ...suppliers.map(s => ({ value: s._id, label: s.companyName })),
            ]} />
        </div>

        {/* Select all / none */}
        <div className="flex gap-2">
          <Button size="small" onClick={selectAll}>Select All</Button>
          <Button size="small" onClick={selectNone}>Select None</Button>
        </div>

        {/* Items table */}
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>{['', 'Product', 'Current', 'Reorder Level', 'Suggest Qty', 'Rate', 'Urgency'].map(h => <th key={h} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody>
              {suggestions.map(s => (
                <tr key={s.product} className={`border-t border-gray-100 ${selectedItems.includes(s.product) ? 'bg-blue-50' : ''} ${s.isZeroStock ? 'bg-red-50' : ''}`}>
                  <td className="px-2 py-2"><Checkbox checked={selectedItems.includes(s.product)} onChange={() => toggleSelect(s.product)} /></td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      {s.productImage && <img src={getImageUrl(s.productImage)} className="w-6 h-6 rounded object-cover border" />}
                      <div><div className="font-medium">{s.productName}</div><div className="text-[9px] text-gray-400">{s.productCode} · {s.brand} · {s.tileSize}</div></div>
                    </div>
                  </td>
                  <td className="px-2 py-2"><span className={`font-bold ${s.isZeroStock ? 'text-red-600' : 'text-orange-600'}`}>{s.currentStock}</span></td>
                  <td className="px-2 py-2">{s.reorderLevel}</td>
                  <td className="px-2 py-2 font-medium text-blue-600">{s.suggestedQty}</td>
                  <td className="px-2 py-2">₹{s.lastPurchaseRate}</td>
                  <td className="px-2 py-2"><Tag color={URGENCY_COLORS[s.urgency]} className="text-[9px]">{s.urgency}</Tag></td>
                </tr>
              ))}
              {suggestions.length === 0 && !loading && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No reorder suggestions. All products are adequately stocked.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default StockAlerts;
