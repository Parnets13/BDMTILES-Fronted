import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Drawer, Empty, Grid, Input,
  InputNumber, Row, Select, Space, Spin, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const { RangePicker } = DatePicker;
const BUCKETS = ['totalQty', 'availableQty', 'reservedQty', 'blockedQty', 'damagedQty', 'sampleQty', 'transitQty', 'shortQty'];
const BUCKET_LABELS = {
  totalQty: 'Total', availableQty: 'Available', reservedQty: 'Reserved', blockedQty: 'Blocked',
  damagedQty: 'Damaged', sampleQty: 'Sample', transitQty: 'Transit', shortQty: 'Short',
};
const BUCKET_HELP = {
  totalQty: 'All physical stock recorded in this exact product, warehouse, shade and batch bucket.',
  availableQty: 'Stock currently free for allocation.', reservedQty: 'Stock committed to open demand.',
  blockedQty: 'Stock held from normal allocation.', damagedQty: 'Stock classified as damaged.',
  sampleQty: 'Stock assigned for samples.', transitQty: 'Stock currently moving between locations.',
  shortQty: 'Quantity recorded as short during fulfillment or transfer.',
};
const MOVEMENT_TYPES = [
  'grn_receipt', 'manual_adjustment', 'stock_adjustment', 'stock_adjustment_reversal', 'physical_count', 'physical_audit', 'physical_audit_reversal', 'sales_reservation',
  'sales_reservation_release', 'pick_short_release', 'pick_damage', 'sorting_short', 'sorting_damage', 'sales_dispatch',
  'sales_remaining_cancel', 'sales_dispatch_reversal',
  'purchase_return', 'purchase_return_reversal', 'sales_return', 'sales_return_reversal',
  'legacy_transfer', 'transfer_block', 'transfer_block_release', 'transfer_dispatch', 'transfer_receive', 'transfer_short', 'migration_opening',
];
const SOURCE_TYPES = [
  'GRN', 'ManualStockAdjustment', 'StockAdjustment', 'LegacyStockTransfer', 'PhysicalStockAudit', 'SalesOrder',
  'PickList', 'DispatchTrip', 'PurchaseReturn', 'SalesReturn', 'StockTransfer', 'DispatchReturn', 'Stock',
];

const titleCase = value => value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase()) : '—';
const numberText = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 6 });
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const cleanParams = source => Object.fromEntries(Object.entries(source).filter(([, value]) => value !== undefined && value !== null && value !== ''));
const objectId = value => value?._id || value || '—';

const movementClass = movement => {
  const type = movement?.movementType || '';
  if (type === 'migration_opening') return { label: 'Baseline', color: 'default' };
  if (type.includes('reservation')) return { label: type.includes('release') ? 'Reservation release' : 'Reservation', color: 'blue' };
  if (type.includes('damage') || type.includes('short')) return { label: 'Reclassification', color: 'orange' };
  if (Number(movement?.deltas?.totalQty || 0) > 0) return { label: 'Inbound', color: 'green' };
  if (Number(movement?.deltas?.totalQty || 0) < 0) return { label: 'Outbound', color: 'red' };
  return { label: 'Reclassification', color: 'purple' };
};

const QuantityGrid = ({ values = {}, prefix = '', unit = 'Unit' }) => (
  <Row gutter={[8, 8]}>
    {BUCKETS.map(bucket => (
      <Col xs={12} sm={8} lg={6} key={bucket}>
        <Card size="small">
          <Tooltip title={BUCKET_HELP[bucket]}>
            <div className="text-xs text-gray-500 cursor-help">{prefix}{BUCKET_LABELS[bucket]}</div>
          </Tooltip>
          <div className="text-lg font-semibold">{numberText(values?.[bucket])} <span className="text-xs font-normal text-gray-400">{unit}</span></div>
        </Card>
      </Col>
    ))}
  </Row>
);

const SnapshotVector = ({ movement }) => (
  <div className="overflow-x-auto">
    <table className="w-full min-w-[780px] text-xs border-collapse">
      <thead><tr className="bg-gray-50"><th className="p-2 text-left">Bucket</th><th className="p-2 text-right">Before</th><th className="p-2 text-right">Delta</th><th className="p-2 text-right">After</th></tr></thead>
      <tbody>{BUCKETS.map(bucket => {
        const delta = Number(movement?.deltas?.[bucket] || 0);
        return <tr key={bucket} className="border-t"><td className="p-2">{BUCKET_LABELS[bucket]}</td><td className="p-2 text-right">{numberText(movement?.before?.[bucket])}</td><td className={`p-2 text-right font-semibold ${delta > 0 ? 'text-green-700' : delta < 0 ? 'text-red-700' : 'text-gray-400'}`}>{delta > 0 ? '+' : ''}{numberText(delta)}</td><td className="p-2 text-right">{numberText(movement?.after?.[bucket])}</td></tr>;
      })}</tbody>
    </table>
  </div>
);

const DeltaVector = ({ deltas = {} }) => (
  <div className="flex flex-wrap gap-1 max-w-[360px]">
    {BUCKETS.map(bucket => Number(deltas[bucket] || 0)).some(Boolean)
      ? BUCKETS.map(bucket => {
        const value = Number(deltas[bucket] || 0);
        if (!value) return null;
        return <Tag key={bucket} color={value > 0 ? 'green' : 'red'}>{BUCKET_LABELS[bucket]} {value > 0 ? '+' : ''}{numberText(value)}</Tag>;
      })
      : <span className="text-gray-400">No quantity change</span>}
  </div>
);

const lineDescription = item => {
  const quantityFields = [
    ['reservedQuantity', 'Reserved'], ['receivedQty', 'Received'], ['acceptedQty', 'Accepted'],
    ['returnQty', 'Returned'], ['dispatchedQuantity', 'Dispatched'], ['receivedQuantity', 'Received'],
    ['quantity', 'Ordered'], ['enteredQuantity', 'Entered'], ['physicalCount', 'Counted'], ['variance', 'Variance'],
  ];
  const quantities = quantityFields
    .filter(([field]) => item[field] !== undefined && item[field] !== null)
    .map(([field, label]) => `${label} ${numberText(item[field])}`);
  return [
    item.productName || item.productCode || (typeof item.product === 'object' ? item.product?.itemName : null),
    item.shade ? `Shade ${item.shade}` : 'No shade', item.batch ? `Batch ${item.batch}` : 'No batch',
    quantities.length ? `${quantities.join(' · ')} ${item.unit || item.enteredUnit || ''}`.trim() : null,
    item.operationKey ? `Posting ${item.operationKey}` : null,
    item.reversalOperationKey ? `Reversal ${item.reversalOperationKey}` : null,
  ].filter(Boolean).join(' · ');
};

const RelatedRecords = ({ title, records = [], identifier, dateField, emptyText }) => (
  <Card size="small" title={`${title} (${records.length})`}>
    {records.length ? (
      <Table
        size="small"
        rowKey={(record, index) => record._id || identifier(record) || index}
        pagination={false}
        scroll={{ x: 760 }}
        columns={[
          { title: 'Source identifier', width: 190, render: (_, record) => <Typography.Text copyable={{ text: identifier(record) || objectId(record._id) }}>{identifier(record) || objectId(record._id)}</Typography.Text> },
          { title: 'Date / Status', width: 180, render: (_, record) => <div><div>{dateTime(record[dateField])}</div><Tag>{titleCase(record.status || record.reservationStatus || 'recorded')}</Tag></div> },
          { title: 'Exact matching lines', render: (_, record) => <div className="space-y-1">{(record.items || []).length ? record.items.map((item, index) => <div key={item._id || index} className="text-xs">{lineDescription(item)}</div>) : <span className="text-orange-700">The source matched, but no exact line was returned.</span>}</div> },
        ]}
        dataSource={records}
      />
    ) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText || `No ${title.toLowerCase()} for this exact stock bucket.`} />}
  </Card>
);

const StockDetailDrawer = ({ open, stockId, onClose, filterOptions = {} }) => {
  const screens = Grid.useBreakpoint();
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [movements, setMovements] = useState([]);
  const [movementLoading, setMovementLoading] = useState(false);
  const [movementPagination, setMovementPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [movementFilters, setMovementFilters] = useState({});
  const detailSequence = useRef(0);
  const movementSequence = useRef(0);
  const pollInFlight = useRef(false);

  const loadDetail = useCallback(async () => {
    if (!open || !stockId) return;
    const requestId = ++detailSequence.current;
    setDetailLoading(true);
    try {
      const response = await purchaseService.getStockDetail(stockId);
      if (requestId === detailSequence.current && response.success) setDetail(response.data);
    } catch (error) {
      if (requestId === detailSequence.current) message.error(error.message || 'Unable to load stock details');
    } finally {
      if (requestId === detailSequence.current) setDetailLoading(false);
    }
  }, [open, stockId]);

  const loadMovements = useCallback(async () => {
    if (!open || !stockId) return;
    const requestId = ++movementSequence.current;
    setMovementLoading(true);
    const [dateFrom, dateTo] = movementFilters.dates || [];
    const params = cleanParams({
      page: movementPagination.current, limit: movementPagination.pageSize,
      movementType: movementFilters.movementType, sourceType: movementFilters.sourceType,
      direction: movementFilters.direction, deltaField: movementFilters.deltaField,
      minDelta: movementFilters.minDelta, maxDelta: movementFilters.maxDelta,
      sourceNumber: movementFilters.sourceNumber,
      dateFrom: dateFrom?.startOf('day').toISOString(), dateTo: dateTo?.endOf('day').toISOString(),
      sortBy: 'occurredAt', sortOrder: 'desc',
    });
    try {
      const response = await purchaseService.getStockBucketMovements(stockId, params);
      if (requestId === movementSequence.current && response.success) {
        setMovements(response.data || []);
        setMovementPagination(current => ({
          ...current,
          current: response.pagination?.currentPage ?? current.current,
          pageSize: response.pagination?.itemsPerPage ?? current.pageSize,
          total: response.pagination?.totalItems ?? (response.data || []).length,
        }));
      }
    } catch (error) {
      if (requestId === movementSequence.current) message.error(error.message || 'Unable to load stock history');
    } finally {
      if (requestId === movementSequence.current) setMovementLoading(false);
    }
  }, [open, stockId, movementFilters, movementPagination.current, movementPagination.pageSize]);

  useEffect(() => {
    if (!open || !stockId) return undefined;
    setDetail(null);
    setMovements([]);
    setMovementFilters({});
    setMovementPagination({ current: 1, pageSize: 20, total: 0 });
    loadDetail();
    return () => { detailSequence.current += 1; movementSequence.current += 1; };
  }, [open, stockId, loadDetail]);

  useEffect(() => { loadMovements(); }, [loadMovements]);
  useEffect(() => {
    if (!open || !stockId) return undefined;
    let timer; let cancelled = false;
    const run = async () => {
      if (cancelled || document.visibilityState !== 'visible' || pollInFlight.current) return;
      pollInFlight.current = true;
      try { await Promise.all([loadDetail(), loadMovements()]); }
      finally { pollInFlight.current = false; if (!cancelled) timer = setTimeout(run, 30000); }
    };
    const foreground = () => { if (document.visibilityState === 'visible') { clearTimeout(timer); void run(); } };
    window.addEventListener('focus', foreground); document.addEventListener('visibilitychange', foreground);
    timer = setTimeout(run, 30000);
    return () => { cancelled = true; clearTimeout(timer); window.removeEventListener('focus', foreground); document.removeEventListener('visibilitychange', foreground); };
  }, [loadDetail, loadMovements, open, stockId]);

  const stock = detail?.stock || {};
  const product = detail?.product || stock.product || {};
  const warehouse = detail?.warehouse || stock.warehouse || {};
  const baseUnit = stock.baseUnit || detail?.uom?.inventoryBaseUom || product.inventoryBaseUom || product.unit || 'Unit';
  const reconciliation = detail?.journal?.reconciliation || detail?.journal || {};
  const baselineMissing = reconciliation.reconciliationStatus === 'baseline_missing' || reconciliation.legacyOpeningSource === 'baseline_missing';

  const movementColumns = useMemo(() => [
    { title: 'Occurred', dataIndex: 'occurredAt', width: 165, render: dateTime },
    { title: 'Movement', width: 190, render: (_, movement) => { const classification = movementClass(movement); return <div><Tag color={classification.color}>{classification.label}</Tag><div className="font-medium text-xs mt-1">{titleCase(movement.movementType)}</div><div className="text-xs text-gray-400">Phase: {titleCase(movement.phase)}</div></div>; } },
    { title: 'Source / Actor', width: 210, render: (_, movement) => <div className="text-xs"><Typography.Text copyable={movement.sourceNumber ? { text: movement.sourceNumber } : false}>{movement.sourceNumber || objectId(movement.sourceId)}</Typography.Text><div>{titleCase(movement.sourceType)}</div><div className="text-gray-500">{movement.actor?.name || movement.actor?.email || 'System'}{movement.relatedWarehouse?.name ? ` · ${movement.relatedWarehouse.name}` : ''}</div></div> },
    { title: 'Entered', width: 155, render: (_, movement) => <div className="text-xs"><strong>{numberText(movement.enteredQuantity)}</strong> {movement.enteredUnit || movement.unit || 'Unit'}<div className="text-gray-400">= {numberText(movement.baseQuantity ?? movement.enteredQuantity)} {movement.baseUnit || '—'} · ×{numberText(movement.conversionFactor || 1)} · v{movement.uomVersion || 1}</div></div> },
    { title: 'Signed bucket deltas', render: (_, movement) => <DeltaVector deltas={movement.deltas} /> },
    { title: 'Reason', dataIndex: 'reason', width: 220, render: (value, movement) => <div className="text-xs">{value || movement.remarks || '—'}</div> },
  ], []);

  const technicalDetails = movement => (
    <div className="space-y-3">
      <SnapshotVector movement={movement} />
      <Descriptions size="small" bordered column={{ xs: 1, md: 2 }} items={[
        { key: 'operation', label: 'Operation key', children: <Typography.Text copyable>{movement.operationKey || '—'}</Typography.Text> },
        { key: 'intent', label: 'Intent hash', children: <Typography.Text copyable>{movement.intentHash || '—'}</Typography.Text> },
        { key: 'correlation', label: 'Correlation key', children: <Typography.Text copyable>{movement.correlationKey || '—'}</Typography.Text> },
        { key: 'source', label: 'Source ID', children: <Typography.Text copyable>{objectId(movement.sourceId)}</Typography.Text> },
        { key: 'provenance', label: 'Provenance / confidence', children: `${titleCase(movement.provenance)} / ${titleCase(movement.confidence)}` },
        { key: 'recorded', label: 'Recorded', children: dateTime(movement.recordedAt) },
        { key: 'reversal', label: 'Reversal', children: movement.reversalOf || movement.reversedBy ? <Typography.Text copyable>{objectId(movement.reversalOf || movement.reversedBy)}</Typography.Text> : 'Not a reversal' },
        { key: 'remarks', label: 'Remarks', children: movement.remarks || '—' },
      ]} />
    </div>
  );

  const movementView = (
    <div className="space-y-3">
      <Alert showIcon type="info" message="Movement history starts at the migration opening baseline." description="The opening baseline is an aggregate starting position. The application does not invent an explicit residual event or other pre-migration event detail." />
      <Card size="small">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
          <Select aria-label="Movement type" mode="multiple" maxTagCount="responsive" placeholder="Movement type" allowClear value={movementFilters.movementType?.split(',').filter(Boolean)} onChange={value => { setMovementFilters(current => ({ ...current, movementType: value?.join(',') })); setMovementPagination(current => ({ ...current, current: 1 })); }} options={(filterOptions.movementTypes || MOVEMENT_TYPES).map(value => ({ value, label: titleCase(value) }))} />
          <Select aria-label="Source type" mode="multiple" maxTagCount="responsive" placeholder="Source type" allowClear value={movementFilters.sourceType?.split(',').filter(Boolean)} onChange={value => { setMovementFilters(current => ({ ...current, sourceType: value?.join(',') })); setMovementPagination(current => ({ ...current, current: 1 })); }} options={(filterOptions.sourceTypes || SOURCE_TYPES).map(value => ({ value, label: titleCase(value) }))} />
          <Select aria-label="Direction" placeholder="Direction" allowClear value={movementFilters.direction} onChange={value => { setMovementFilters(current => ({ ...current, direction: value })); setMovementPagination(current => ({ ...current, current: 1 })); }} options={['inbound', 'outbound', 'all'].map(value => ({ value, label: titleCase(value) }))} />
          <Select aria-label="Delta bucket" placeholder="Delta bucket" allowClear value={movementFilters.deltaField} onChange={value => { setMovementFilters(current => ({ ...current, deltaField: value })); setMovementPagination(current => ({ ...current, current: 1 })); }} options={(filterOptions.deltaFields || BUCKETS).map(value => ({ value, label: BUCKET_LABELS[value] }))} />
          <InputNumber stringMode aria-label="Minimum delta" placeholder="Minimum delta" className="w-full" value={movementFilters.minDelta} onChange={value => { setMovementFilters(current => ({ ...current, minDelta: value })); setMovementPagination(current => ({ ...current, current: 1 })); }} />
          <InputNumber stringMode aria-label="Maximum delta" placeholder="Maximum delta" className="w-full" value={movementFilters.maxDelta} onChange={value => { setMovementFilters(current => ({ ...current, maxDelta: value })); setMovementPagination(current => ({ ...current, current: 1 })); }} />
          <Input aria-label="Source number" placeholder="Source number" allowClear value={movementFilters.sourceNumber} onChange={event => { setMovementFilters(current => ({ ...current, sourceNumber: event.target.value })); setMovementPagination(current => ({ ...current, current: 1 })); }} />
          <RangePicker aria-label="Movement date range" className="w-full" value={movementFilters.dates} onChange={value => { setMovementFilters(current => ({ ...current, dates: value })); setMovementPagination(current => ({ ...current, current: 1 })); }} />
        </div>
      </Card>
      <Table
        rowKey="_id" size="small" loading={movementLoading} columns={movementColumns} dataSource={movements}
        scroll={{ x: 1250 }} expandable={{ expandedRowRender: technicalDetails }}
        locale={{ emptyText: 'No movements match the selected filters.' }}
        pagination={{ ...movementPagination, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: total => `${total} movements` }}
        onChange={pagination => setMovementPagination(current => ({ ...current, current: pagination.current || 1, pageSize: pagination.pageSize || current.pageSize }))}
      />
    </div>
  );

  const overviewView = detailLoading && !detail ? <div className="py-20 text-center"><Spin /></div> : detail ? (
    <div className="space-y-4">
      <Card size="small">
        <div className="flex flex-col sm:flex-row gap-4">
          <ProductImage src={product.images?.[0]} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="text-lg font-semibold">{product.itemName || 'Unnamed product'}</div>
            <div className="font-mono text-sm text-blue-700">{product.productCode || 'No code'}</div>
            <div className="text-sm text-gray-500 mt-1">{[product.brand?.name, product.category?.name, product.subcategory?.name].filter(Boolean).join(' · ') || 'No hierarchy recorded'}</div>
            <Space wrap className="mt-2"><Tag>{product.unit || detail.uom?.unit || 'Unit'}</Tag><Tag color="blue">Base: {stock.baseUnit || detail.uom?.inventoryBaseUom || product.inventoryBaseUom || product.unit || 'Unit'} · v{stock.uomVersion || detail.uom?.uomVersion || 1}</Tag><Tag>{product.tileSize || 'No size'}</Tag><Tag>{product.finish || 'No finish'}</Tag><Tag>{product.grade || 'No grade'}</Tag></Space>
          </div>
        </div>
      </Card>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><Card size="small" title="Product specification & packaging"><Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'type', label: 'Tile type', children: detail.specification?.tileType || product.tileType || '—' },
          { key: 'size', label: 'Size / thickness', children: [detail.specification?.tileSize, detail.specification?.thickness].filter(Boolean).join(' · ') || '—' },
          { key: 'surface', label: 'Finish / surface', children: [detail.specification?.finish, detail.specification?.surface].filter(Boolean).join(' · ') || '—' },
          { key: 'colour', label: 'Colour / design', children: [detail.specification?.colour, detail.specification?.design].filter(Boolean).join(' · ') || '—' },
          { key: 'pack', label: 'Pieces / box', children: numberText(detail.packaging?.piecesPerBox) },
          { key: 'coverage', label: 'Sq.ft / box', children: numberText(detail.packaging?.sqftPerBox) },
          { key: 'weight', label: 'Weight / box', children: numberText(detail.packaging?.weightPerBox) },
          { key: 'application', label: 'Application', children: detail.specification?.applicationArea || '—' },
        ]} /></Card></Col>
        <Col xs={24} lg={12}><Card size="small" title="Exact stock key & location"><Descriptions size="small" column={{ xs: 1, sm: 2 }} items={[
          { key: 'branch', label: 'Branch ID', children: <Typography.Text copyable>{objectId(detail.identity?.branch)}</Typography.Text> },
          { key: 'warehouse', label: 'Warehouse', children: `${warehouse.name || '—'}${warehouse.warehouseCode ? ` (${warehouse.warehouseCode})` : ''}` },
          { key: 'warehouseType', label: 'Warehouse type', children: titleCase(warehouse.type) },
          { key: 'shade', label: 'Shade', children: detail.identity?.shade || 'No shade' },
          { key: 'batch', label: 'Batch', children: detail.identity?.batch || 'No batch' },
          { key: 'zone', label: 'Zone', children: detail.location?.zone || '—' },
          { key: 'rack', label: 'Rack', children: detail.location?.rack || '—' },
          { key: 'bin', label: 'Bin', children: detail.location?.bin || '—' },
        ]} /></Card></Col>
      </Row>
      <Card size="small" title="Current quantity buckets" extra={<Tag color={detail.statuses?.availability === 'in_stock' ? 'green' : detail.statuses?.availability === 'low_stock' ? 'orange' : 'red'}>{titleCase(detail.statuses?.availability)}</Tag>}>
        <QuantityGrid unit={baseUnit} values={stock} />
        <Alert className="mt-3" type="info" showIcon message="Physical availability" description="Available stock is the allocatable bucket, not a calculation made by this screen. Reserved, blocked, damaged, sample, transit and short buckets describe why recorded physical or workflow quantities are not freely allocatable." />
      </Card>
      <Row gutter={[12, 12]}>
        <Col xs={24} lg={12}><Card size="small" title="Valuation"><Descriptions size="small" column={1} items={[
          { key: 'purchase', label: 'Purchase rate', children: money(detail.valuation?.purchaseRate) },
          { key: 'landing', label: 'Landing cost', children: money(detail.valuation?.landingCost) },
          { key: 'effective', label: 'Effective valuation rate', children: money(detail.valuation?.effectiveRate) },
          { key: 'total', label: 'Current total value', children: <strong>{money(detail.valuation?.totalValue)}</strong> },
          { key: 'available', label: 'Current available value', children: money(detail.valuation?.availableValue) },
        ]} /></Card></Col>
        <Col xs={24} lg={12}><Card size="small" title="Status & timestamps"><Descriptions size="small" column={1} items={[
          { key: 'flags', label: 'Indicators', children: <Space wrap>{Object.entries(detail.statuses || {}).map(([key, value]) => key === 'availability' ? null : <Tag key={key} color={value ? 'orange' : 'default'}>{titleCase(key)}: {value ? 'Yes' : 'No'}</Tag>)}</Space> },
          { key: 'grn', label: 'Last GRN', children: dateTime(stock.lastGRNDate) },
          { key: 'sale', label: 'Last sale', children: dateTime(stock.lastSaleDate) },
          { key: 'updated', label: 'Updated', children: dateTime(stock.updatedAt) },
          { key: 'created', label: 'Created', children: dateTime(stock.createdAt) },
        ]} /></Card></Col>
      </Row>
    </div>
  ) : <Empty description="Stock detail is unavailable." />;

  const reconciliationView = (
    <div className="space-y-4">
      <Alert
        showIcon type={baselineMissing ? 'warning' : reconciliation.reconciled ? 'success' : 'error'}
        message={baselineMissing ? 'Opening baseline is missing' : reconciliation.reconciled ? 'Journal reconciles to current stock' : 'Journal mismatch detected'}
        description={baselineMissing
          ? 'This bucket predates the migration baseline or has not received one. The estimated legacy opening is shown only as an estimate; no residual event detail is fabricated.'
          : 'History starts from the persisted migration opening baseline. That baseline is an aggregate starting balance, not fabricated pre-migration event detail.'}
      />
      <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }} items={[
        { key: 'source', label: 'Opening source', children: titleCase(reconciliation.legacyOpeningSource) },
        { key: 'status', label: 'Reconciliation status', children: <Tag color={baselineMissing ? 'orange' : reconciliation.reconciled ? 'green' : 'red'}>{titleCase(reconciliation.reconciliationStatus)}</Tag> },
        { key: 'count', label: 'Movement count', children: numberText(reconciliation.movementCount) },
        { key: 'first', label: 'First movement', children: dateTime(reconciliation.firstMovement?.occurredAt || reconciliation.firstMovement) },
        { key: 'last', label: 'Last movement', children: dateTime(reconciliation.lastMovement?.occurredAt || reconciliation.lastMovement) },
        { key: 'warning', label: 'Baseline persisted', children: baselineMissing ? 'No' : 'Yes' },
      ]} />
      <Card size="small" title="Current ledger snapshot"><QuantityGrid unit={baseUnit} values={reconciliation.current || stock} /></Card>
      <Card size="small" title="Persisted legacy opening balance"><QuantityGrid unit={baseUnit} values={reconciliation.legacyOpeningBalance || {}} /></Card>
      <Card size="small" title="Estimated legacy opening (comparison only)"><QuantityGrid unit={baseUnit} values={reconciliation.estimatedLegacyOpeningBalance || {}} /></Card>
      <Card size="small" title="Journal totals after opening"><QuantityGrid unit={baseUnit} values={reconciliation.journalWithoutOpening || {}} /></Card>
      <Card size="small" title="Expected stock from opening + journal"><QuantityGrid unit={baseUnit} values={reconciliation.expected || {}} /></Card>
      <Card size="small" title="Current minus expected differences"><QuantityGrid unit={baseUnit} values={reconciliation.differences || {}} /></Card>
    </div>
  );

  const relatedView = (
    <div className="space-y-3">
      <Alert type="info" showIcon message="Exact bucket matching" description="These records are limited to the current product, warehouse, shade and batch. Identifiers are copyable; navigation is intentionally omitted where the application has no reliable detail route." />
      <RelatedRecords title="Open Sales Order reservations" records={detail?.openReservations} identifier={record => record.orderNumber} dateField="orderDate" />
      <RelatedRecords title="In-transit transfers" records={detail?.inTransitTransfers} identifier={record => record.transferNumber} dateField="transferDate" />
      <RelatedRecords title="Recent GRNs" records={detail?.recentGRNs} identifier={record => record.grnNumber} dateField="grnDate" />
      <RelatedRecords title="Recent purchase returns" records={detail?.recentPurchaseReturns} identifier={record => record.debitNoteNumber} dateField="returnDate" />
      <RelatedRecords title="Recent sales returns" records={detail?.recentSalesReturns} identifier={record => record.returnNumber} dateField="returnDate" />
      <RelatedRecords title="Recent dispatch recoveries" records={detail?.recentDispatchReturns} identifier={record => record.returnNumber} dateField="requestedAt" />
      <RelatedRecords
        title="Durable stock adjustments"
        records={(detail?.recentStockAdjustments || []).map(record => ({ ...record, items: (record.lines || []).map(line => ({ ...line, productName: titleCase(line.operation), quantity: line.enteredQuantity, unit: line.enteredUnit })) }))}
        identifier={record => record.adjustmentNumber}
        dateField="approvedAt"
      />
      <RelatedRecords
        title="Physical stock audits"
        records={(detail?.recentPhysicalAudits || []).map(record => ({ ...record, items: (record.lines || []).map(line => ({ ...line, productName: `Physical audit · ${titleCase(line.classification)}`, quantity: line.physicalCount, unit: line.enteredUnit })) }))}
        identifier={record => record.auditNumber}
        dateField="approvedAt"
      />
    </div>
  );

  return (
    <Drawer
      title={<div><div className="font-semibold">Stock detail</div><div className="text-xs font-normal text-gray-500">{product.productCode || stockId || '—'} · {product.itemName || 'Loading…'}</div></div>}
      open={open} onClose={onClose} width={screens.lg ? 1180 : '100%'} destroyOnHidden
      extra={<Button icon={<ReloadOutlined />} loading={detailLoading || movementLoading} onClick={() => { loadDetail(); loadMovements(); }}>Refresh detail</Button>}
    >
      <Tabs items={[
        { key: 'overview', label: 'Overview', children: overviewView },
        { key: 'reconciliation', label: 'Reconciliation', children: reconciliationView },
        { key: 'movements', label: `Movements (${movementPagination.total})`, children: movementView },
        { key: 'related', label: 'Related records', children: relatedView },
      ]} />
    </Drawer>
  );
};

export default StockDetailDrawer;
