import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber, Alert
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, CheckOutlined,
  SaveOutlined, PrinterOutlined, AuditOutlined, WarningOutlined, CheckCircleOutlined
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import masterService from '../../services/masterService.js';

const AUDIT_STATUS = {
  matched:    { label: 'Matched',    color: 'green'  },
  short:      { label: 'Short',      color: 'red'    },
  excess:     { label: 'Excess',     color: 'orange' },
  not_counted:{ label: 'Not Counted',color: 'default'},
};

const PhysicalAudit = () => {
  const [stock, setStock] = useState([]);
  const [auditLines, setAuditLines] = useState([]); // { stockId, systemQty, physicalQty, variance, status }
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [selectedWarehouse, setSelectedWarehouse] = useState(undefined);
  const [auditNote, setAuditNote] = useState('');
  const [postLoading, setPostLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [auditLoaded, setAuditLoaded] = useState(false);
  const [search, setSearch] = useState('');

  // Summary
  const matched = auditLines.filter(l => l.status === 'matched').length;
  const short   = auditLines.filter(l => l.status === 'short').length;
  const excess  = auditLines.filter(l => l.status === 'excess').length;
  const counted = auditLines.filter(l => l.status !== 'not_counted').length;

  useEffect(() => {
    masterService.getWarehouses({ limit: 50 }).then(r => {
      if (r.success) setWarehouses(r.data || []);
    }).catch(() => {});
  }, []);

  const loadStock = useCallback(async () => {
    if (!selectedWarehouse) { message.warning('Select a warehouse first'); return; }
    setLoading(true);
    try {
      const res = await purchaseService.getStock({ warehouse: selectedWarehouse, limit: 500, page: 1 });
      if (res.success) {
        const items = res.data || [];
        setStock(items);
        setAuditLines(items.map(s => ({
          stockId:     s._id,
          productId:   s.product?._id || s.product,
          productCode: s.product?.productCode || '',
          productName: s.product?.itemName || '',
          shade:       s.shade || '',
          batch:       s.batch || '',
          systemQty:   s.availableQty || 0,
          physicalQty: null,       // null = not yet counted
          variance:    0,
          status:      'not_counted',
        })));
        setAuditLoaded(true);
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [selectedWarehouse]);

  const updatePhysicalQty = (stockId, value) => {
    setAuditLines(prev => prev.map(l => {
      if (l.stockId !== stockId) return l;
      const pQty = value === '' || value === null ? null : Number(value);
      const variance = pQty !== null ? pQty - l.systemQty : 0;
      const status = pQty === null ? 'not_counted'
        : variance === 0 ? 'matched'
        : variance < 0   ? 'short'
        : 'excess';
      return { ...l, physicalQty: pQty, variance, status };
    }));
  };

  // Only post lines with discrepancies (short or excess)
  const discrepancies = auditLines.filter(l => ['short', 'excess'].includes(l.status));

  const handlePostAdjustments = async () => {
    if (discrepancies.length === 0) {
      message.info('No discrepancies to post');
      setShowConfirm(false);
      return;
    }
    setPostLoading(true);
    try {
      // Post each discrepancy as a stock adjustment
      for (const line of discrepancies) {
        await purchaseService.adjustStock({
          product:       line.productId,
          warehouse:     selectedWarehouse,
          shade:         line.shade,
          batch:         line.batch,
          adjustmentQty: line.variance,   // negative = short, positive = excess
          type:          line.variance > 0 ? 'add' : 'subtract',
          reason:        `Physical audit adjustment. ${auditNote}`.trim(),
        });
      }
      message.success(`${discrepancies.length} adjustment(s) posted successfully`);
      setShowConfirm(false);
      setAuditLoaded(false);
      setAuditLines([]);
      setStock([]);
    } catch (err) {
      message.error(err.message || 'Failed to post adjustments');
    } finally {
      setPostLoading(false);
    }
  };

  const handlePrint = () => {
    const counted = auditLines.filter(l => l.status !== 'not_counted');
    const w = window.open('', '_blank');
    const wh = warehouses.find(w => w._id === selectedWarehouse)?.name || '';
    w.document.write(`<html><head><title>Physical Audit — ${wh}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
    h2{margin-bottom:4px}p{color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}
    th{background:#f5f5f5;padding:5px 6px;border-bottom:2px solid #ccc;text-align:left}
    td{padding:4px 6px;border-bottom:1px solid #eee}
    .matched{color:#16a34a}.short{color:#dc2626}.excess{color:#d97706}
    </style></head><body>
    <h2>Physical Stock Audit — ${wh}</h2>
    <p>Generated: ${new Date().toLocaleString('en-IN')} &nbsp;|&nbsp; ${counted.length}/${auditLines.length} lines counted</p>
    <table>
      <tr><th>Code</th><th>Product</th><th>Shade</th><th>Batch</th><th>System Qty</th><th>Physical Qty</th><th>Variance</th><th>Status</th></tr>
      ${counted.map(l => `<tr>
        <td>${l.productCode}</td><td>${l.productName}</td>
        <td>${l.shade||'—'}</td><td>${l.batch||'—'}</td>
        <td>${l.systemQty}</td><td>${l.physicalQty??'—'}</td>
        <td class="${l.status}">${l.variance>0?'+':''}${l.variance}</td>
        <td class="${l.status}">${AUDIT_STATUS[l.status]?.label}</td>
      </tr>`).join('')}
    </table>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const displayLines = auditLines.filter(l =>
    !search ||
    l.productName.toLowerCase().includes(search.toLowerCase()) ||
    l.productCode.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    {
      title: 'Product',
      key: 'product',
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.productName}</div>
          <div className="text-xs text-gray-400 font-mono">{r.productCode}
            {r.shade ? ` · ${r.shade}` : ''}{r.batch ? ` · ${r.batch}` : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'System Qty',
      dataIndex: 'systemQty',
      width: 100,
      render: v => <span className="font-semibold text-gray-700">{v}</span>,
    },
    {
      title: 'Physical Count',
      key: 'physicalQty',
      width: 140,
      render: (_, r) => (
        <InputNumber
          value={r.physicalQty}
          onChange={v => updatePhysicalQty(r.stockId, v)}
          min={0}
          placeholder="Enter count"
          size="small"
          className="w-28"
          style={{ borderColor: r.status === 'short' ? '#dc2626' : r.status === 'excess' ? '#d97706' : undefined }}
        />
      ),
    },
    {
      title: 'Variance',
      dataIndex: 'variance',
      width: 90,
      render: (v, r) => {
        if (r.status === 'not_counted') return <span className="text-gray-400 text-xs">—</span>;
        const color = v === 0 ? '#16a34a' : v < 0 ? '#dc2626' : '#d97706';
        return <span className="font-bold" style={{ color }}>{v > 0 ? `+${v}` : v}</span>;
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: v => {
        const s = AUDIT_STATUS[v];
        return <Tag color={s?.color}>{s?.label}</Tag>;
      },
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AuditOutlined className="text-blue-500 text-xl" />
            Physical Stock Audit
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Count physical stock, compare with system qty, and post adjustments
          </p>
        </div>
        {auditLoaded && (
          <Space>
            <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Sheet</Button>
            <Button
              type="primary"
              icon={<CheckOutlined />}
              onClick={() => setShowConfirm(true)}
              disabled={counted === 0}
              style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
            >
              Post Adjustments ({discrepancies.length})
            </Button>
          </Space>
        )}
      </div>

      {/* Step 1 — select warehouse */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-500 block mb-1">Select Warehouse *</label>
            <Select
              placeholder="Choose warehouse to audit"
              value={selectedWarehouse}
              onChange={v => { setSelectedWarehouse(v); setAuditLoaded(false); setAuditLines([]); }}
              className="w-full"
              options={warehouses.map(w => ({ value: w._id, label: w.name }))}
            />
          </div>
          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={loadStock}
            loading={loading}
            disabled={!selectedWarehouse}
            style={{ background: '#1890ff', borderColor: '#1890ff' }}
          >
            Load Stock List
          </Button>
        </div>
      </div>

      {/* Summary once loaded */}
      {auditLoaded && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Lines', auditLines.length, '#1890ff'],
              ['Counted', counted,  '#52c41a'],
              ['Matched',  matched, '#52c41a'],
              ['Short (−)', short,  short  > 0 ? '#dc2626' : '#52c41a'],
              ['Excess (+)', excess, excess > 0 ? '#d97706' : '#52c41a'],
            ].map(([t, v, c]) => (
              <Col span={Math.floor(24 / 5)} key={t}>
                <Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
                  <Statistic title={t} value={v} valueStyle={{ color: c, fontSize: 18 }} />
                </Card>
              </Col>
            ))}
          </Row>

          {discrepancies.length > 0 && (
            <Alert
              className="mb-4"
              type="warning"
              showIcon
              message={`${discrepancies.length} discrepanc${discrepancies.length > 1 ? 'ies' : 'y'} found`}
              description="Review the variances below, then click 'Post Adjustments' to update stock."
            />
          )}

          {/* Search */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
            <Input
              placeholder="Filter by product name or code…"
              prefix={<SearchOutlined />}
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="max-w-xs"
              allowClear
            />
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <Table
              columns={columns}
              dataSource={displayLines}
              rowKey="stockId"
              loading={loading}
              size="small"
              pagination={{ pageSize: 50, showSizeChanger: false }}
              rowClassName={r =>
                r.status === 'short'  ? 'bg-red-50'    :
                r.status === 'excess' ? 'bg-orange-50' : ''
              }
              locale={{ emptyText: 'No stock lines.' }}
            />
          </div>
        </>
      )}

      {/* Confirm post modal */}
      <Modal
        title={<span className="font-bold text-orange-600"><WarningOutlined className="inline mr-2" />Confirm Audit Adjustments</span>}
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onOk={handlePostAdjustments}
        okText={`Post ${discrepancies.length} Adjustment(s)`}
        confirmLoading={postLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Divider />
        <div className="space-y-3">
          <p className="text-sm text-gray-600">
            This will create stock adjustments for <strong>{discrepancies.length}</strong> item(s) and permanently update inventory.
          </p>
          <div className="bg-gray-50 rounded p-3 text-xs space-y-1">
            <div className="text-red-700 font-medium">{short} short item(s) — stock will be reduced</div>
            <div className="text-orange-700 font-medium">{excess} excess item(s) — stock will be increased</div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Audit Note / Reference</label>
            <Input.TextArea
              rows={2}
              value={auditNote}
              onChange={e => setAuditNote(e.target.value)}
              placeholder="e.g. Monthly physical audit — July 2026"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default PhysicalAudit;
