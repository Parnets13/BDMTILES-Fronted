import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table, Button, Input, Select, Tag, Space, message, Modal,
  Row, Col, Card, Statistic, Alert, Checkbox, InputNumber
} from 'antd';
import { ReloadOutlined, SearchOutlined, WarningOutlined, ShopOutlined, FallOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';

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
        <div className="flex items-center gap-2">
          <ProductImage src={r.product?.images?.[0]} size="sm" />
          <div>
            <div className="font-medium text-sm">{r.product?.itemName || '—'}</div>
            <div className="text-xs text-gray-400 font-mono">
              {r.product?.productCode || ''}
              {r.shade ? ` · Shade: ${r.shade}` : ''}
              {r.batch ? ` · Batch: ${r.batch}` : ''}
            </div>
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
            Reorder Guidance
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
          &nbsp;Raise a purchase requisition and complete supplier quotation selection before creating a PO.
          <Button size="small" type="primary" danger icon={<ShoppingCartOutlined />} className="ml-auto"
            onClick={() => setShowReorder(true)}>
            View Reorder Guidance
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
      <ReorderSuggestionsModal
        open={showReorder}
        onClose={() => setShowReorder(false)}
        warehouse={warehouseFilter}
        warehouses={warehouses}
      />
    </div>
  );
};

// ═══════════════════════════════════════════════
// REORDER SUGGESTIONS MODAL
// ═══════════════════════════════════════════════
const ReorderSuggestionsModal = ({ open, onClose, warehouse, warehouses }) => {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('po.management');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [summary, setSummary] = useState({});
  const [selected, setSelected] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [receivingWarehouse, setReceivingWarehouse] = useState(warehouse || undefined);

  useEffect(() => {
    if (open) {
      setReceivingWarehouse(warehouse || undefined);
      fetchSuggestions();
    }
  }, [open, warehouse]);

  const fetchSuggestions = async (scopeWarehouse = warehouse) => {
    setLoading(true);
    try {
      const res = await purchaseService.getReorderSuggestions({ warehouse: scopeWarehouse || undefined });
      if (res.success) {
        const rows = res.data || [];
        setSuggestions(rows);
        setSummary(res.summary || {});
        setSelected([]);
        setQuantities(Object.fromEntries(rows.map(row => [row.product, Number(row.suggestedQty || 1)])));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const createRequisition = async () => {
    if (!canManage) return;
    if (!receivingWarehouse) return message.error('Select the receiving warehouse');
    const rows = suggestions.filter(row => selected.includes(String(row.product)));
    if (!rows.length) return message.error('Select at least one suggestion');
    if (rows.some(row => !(Number(quantities[row.product]) > 0))) return message.error('Every selected quantity must be positive');
    setCreating(true);
    try {
      const res = await purchaseService.createPurchaseRequisition({
        source: 'reorder_suggestion',
        department: 'Inventory',
        warehouse: receivingWarehouse,
        priority: rows.some(row => row.urgency === 'critical') ? 'urgent' : 'high',
        remarks: `Created from ${warehouse ? 'warehouse-scoped' : 'branch-scoped'} stock suggestions`,
        items: rows.map(row => ({
          product: row.product,
          requiredQty: Number(quantities[row.product]),
          currentStock: row.currentStock,
          provenance: row.provenance,
        })),
      });
      if (res.success) {
        message.success(`${res.data.prNumber} created as a draft requisition`);
        onClose();
        navigate(`/sales-purchase/purchase-requisition?pr=${res.data._id}`, { state: { openPurchaseRequisitionId: res.data._id } });
      }
    } catch (err) { message.error(err.message || 'Unable to create purchase requisition'); }
    finally { setCreating(false); }
  };

  const URGENCY_COLORS = { critical: 'red', high: 'orange', medium: 'blue' };

  return (
    <Modal title="Reorder Suggestions" open={open} onCancel={onClose} width={1050}
      footer={[
        <Button key="close" onClick={onClose}>Close</Button>,
        canManage && <Button key="create" type="primary" loading={creating} disabled={!selected.length || !receivingWarehouse} onClick={createRequisition}>Create Purchase Requisition</Button>,
      ].filter(Boolean)}>
      <div className="space-y-4 mt-3">
        {/* Summary */}
        <Row gutter={12}>
          <Col span={6}><Card size="small"><Statistic title="Total Suggestions" value={summary.total || 0} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Critical (Zero Stock)" value={summary.critical || 0} valueStyle={{ color: '#dc2626' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="High Priority" value={summary.high || 0} valueStyle={{ color: '#ea580c' }} /></Card></Col>
          <Col span={6}><Card size="small"><Statistic title="Medium" value={summary.medium || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        </Row>

        <Alert
          type={canManage ? 'info' : 'warning'}
          showIcon
          message={canManage ? 'Create a draft requisition; a PO still requires two supplier offers and final quotation selection.' : 'Reorder guidance only'}
          description={canManage ? 'Select products, adjust requested quantities, and choose the receiving warehouse. Current stock and provenance are recomputed by the server.' : 'You need Purchase Order Management permission to raise a requisition. Share this guidance with an authorized purchase user.'}
        />

        {canManage && <div className="flex items-center gap-3">
          <label className="text-xs text-gray-500">Receiving warehouse *</label>
          <Select className="w-64" placeholder="Select warehouse" value={receivingWarehouse} onChange={value => { setReceivingWarehouse(value); fetchSuggestions(value); }}
            options={warehouses.map(item => ({ value: item._id, label: item.name }))} />
          <span className="text-xs text-gray-400">Suggestions are {warehouse ? 'filtered to the selected warehouse' : 'branch-wide'}.</span>
        </div>}

        {/* Items table */}
        <div className="max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 sticky top-0">
              <tr>{[canManage ? 'Select' : '', 'Product', 'Warehouse', 'Current', 'Reorder / Min', 'Requested Qty', 'Last Supplier / Rate', 'Urgency'].map((h, index) => <th key={`${h}-${index}`} className="px-2 py-2 text-left font-semibold text-gray-600">{h}</th>)}</tr>
            </thead>
            <tbody>
              {suggestions.map(s => (
                <tr key={s.product} className={`border-t border-gray-100 ${s.isZeroStock ? 'bg-red-50' : ''}`}>
                  <td className="px-2 py-2">{canManage && <Checkbox checked={selected.includes(String(s.product))} onChange={event => setSelected(keys => event.target.checked ? [...keys, String(s.product)] : keys.filter(key => key !== String(s.product)))} />}</td>
                  <td className="px-2 py-2">
                    <div className="flex items-center gap-1.5">
                      <ProductImage src={s.productImage} size="xs" />
                      <div><div className="font-medium">{s.productName}</div><div className="text-[9px] text-gray-400">{s.productCode} · {s.brand} · {s.tileSize}</div></div>
                    </div>
                  </td>
                  <td className="px-2 py-2">{s.warehouseName || 'All branch warehouses'}</td>
                  <td className="px-2 py-2"><span className={`font-bold ${s.isZeroStock ? 'text-red-600' : 'text-orange-600'}`}>{s.currentStock}</span></td>
                  <td className="px-2 py-2"><div>{s.reorderLevel}</div><div className="text-[9px] text-gray-400">Min {s.minimumStockLevel || 'fallback'} · {s.reorderLevelSource === 'branch_fallback' ? 'configured fallback' : 'product'}</div></td>
                  <td className="px-2 py-2">{canManage ? <InputNumber size="small" min={0.0001} value={quantities[s.product]} onChange={value => setQuantities(current => ({ ...current, [s.product]: value }))} /> : <span className="font-medium text-blue-600">{s.suggestedQty}</span>}</td>
                  <td className="px-2 py-2"><div>{s.suggestedSupplierName}</div><div className="text-[9px] text-gray-400">₹{s.lastPurchaseRate}</div></td>
                  <td className="px-2 py-2"><Tag color={URGENCY_COLORS[s.urgency]} className="text-[9px]">{s.urgency}</Tag></td>
                </tr>
              ))}
              {suggestions.length === 0 && !loading && (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No reorder suggestions. All products are adequately stocked.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
};

export default StockAlerts;
