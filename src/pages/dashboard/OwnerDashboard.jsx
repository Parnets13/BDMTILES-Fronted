import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Empty,
  Row,
  Segmented,
  Skeleton,
  Space,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import dayjs from 'dayjs';
import {
  BarChartOutlined,
  CheckSquareOutlined,
  DollarOutlined,
  FileTextOutlined,
  HistoryOutlined,
  ReloadOutlined,
  RiseOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  TeamOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../context/AuthContext.jsx';
import reportService from '../../services/reportService.js';

// Dashboard palette. Navy and orange are the two primaries; red (URGENT) is
// reserved strictly for overdue, failed and urgent alerts so it keeps its
// meaning. Anything that is merely negative-but-normal (returns, damaged units,
// ageing stock, pending paperwork) uses CAUTION or NEUTRAL instead.
const BRAND = '#FF5F03';   // orange
const NAVY = '#0F2B5B';    // navy — primary
const NAVY_SOFT = '#2F54EB';
const URGENT = '#CF1322';  // red — overdue / failed / urgent only
const CAUTION = '#D46B08'; // amber-brown — needs attention, not an alarm
const WARN = '#FA8C16';
const POSITIVE = '#389E0D';
const NEUTRAL = '#8C8C8C';
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

const formatCurrency = (value) => `₹${INR.format(Number(value) || 0)}`;
const formatNumber = (value) => NUMBER.format(Number(value) || 0);
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

// Attendance comes back as a status/count breakdown (Present, Absent, Late, Leave,
// Half Day, …). Returning null when the whole array is null keeps the card showing
// "Unavailable" for a user without attendance permission, rather than a false zero.
const attendanceCount = (rows, status) => {
  if (!Array.isArray(rows)) return null;
  return rows.find((row) => row._id === status)?.count ?? 0;
};

const MetricCard = ({ title, value, currency = false, suffix, color = NAVY, note, onClick }) => (
  <Col xs={24} sm={12} lg={8} xl={6}>
    <Card
      size="small"
      hoverable={Boolean(onClick)}
      onClick={onClick}
      style={{ borderLeft: `4px solid ${color}`, height: '100%', cursor: onClick ? 'pointer' : 'default' }}
    >
      <Statistic
        title={title}
        value={value ?? 0}
        formatter={() => (value === null ? 'Unavailable' : currency ? formatCurrency(value) : formatNumber(value))}
        suffix={value === null ? undefined : suffix}
        valueStyle={{ color, fontSize: 21 }}
      />
      {note && <div className="text-xs text-gray-400 mt-1">{note}</div>}
    </Card>
  </Col>
);

// Denser, more prominent tile for the top business-summary strip. Clickable when
// the user has permission to open the underlying list.
const SummaryTile = ({ label, value, currency = false, accent, onClick }) => (
  <Col xs={12} sm={8} lg={6} xl={3}>
    <Card
      size="small"
      hoverable={Boolean(onClick)}
      onClick={onClick}
      style={{ height: '100%', cursor: onClick ? 'pointer' : 'default', borderTop: `3px solid ${accent}` }}
    >
      <div className="text-[11px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-1 text-xl font-semibold" style={{ color: accent }}>
        {value === null || value === undefined
          ? <span className="text-sm font-normal text-gray-400">Unavailable</span>
          : currency ? formatCurrency(value) : formatNumber(value)}
      </div>
    </Card>
  </Col>
);

const SectionWarnings = ({ warnings = [] }) => warnings.map((warning) => (
  <Alert key={warning} type="warning" showIcon message={warning} className="mt-3" />
));

const Section = ({ title, icon, action, children, warnings }) => (
  <Card
    className="mb-4"
    title={<span className="font-semibold text-gray-700">{icon} <span className="ml-1">{title}</span></span>}
    extra={action}
  >
    {children}
    <SectionWarnings warnings={warnings} />
  </Card>
);

const UnavailableSection = ({ title, section }) => (
  <Section title={title} icon={<FileTextOutlined />} warnings={section?.warnings}>
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Branch-safe data is not available for this section." />
  </Section>
);

const OwnerDashboard = () => {
  const navigate = useNavigate();
  const { user, activeBranch, hasPermission, hasAnyPermission } = useAuth();
  const [data, setData] = useState(null);
  const [scope, setScope] = useState('branch');
  // Profitability is the one section with its own date window (the rest report
  // fixed periods named in the card itself).
  const [profitPeriod, setProfitPeriod] = useState('month');
  const [profitRange, setProfitRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const isGlobalRole = ['owner', 'super_admin'].includes(user?.role);

  // A half-picked custom range sends nothing, so the server keeps its default
  // (current month) instead of rejecting an incomplete request.
  const profitParams = useMemo(() => {
    if (profitPeriod !== 'custom') return { profitPeriod };
    if (!profitRange?.[0] || !profitRange?.[1]) return {};
    return {
      profitPeriod: 'custom',
      profitFrom: profitRange[0].format('YYYY-MM-DD'),
      profitTo: profitRange[1].format('YYYY-MM-DD'),
    };
  }, [profitPeriod, profitRange]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getDashboard({ scope, ...profitParams });
      if (response.success) {
        setData(response.data);
        setLastRefresh(new Date(response.data.metadata?.generatedAt || Date.now()));
      }
    } catch (error) {
      message.error(error.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [scope, profitParams]);

  useEffect(() => { load(); }, [load]);

  const sections = data?.sections || {};
  const metadata = data?.metadata;
  const canNavigate = useCallback((permissions) => hasAnyPermission(permissions), [hasAnyPermission]);

  const quickActions = useMemo(() => [
    { label: 'Sales Orders', icon: <ShoppingCartOutlined />, path: '/sales-purchase/sales-order-dashboard', permissions: ['sales.order.dashboard'], color: BRAND },
    { label: 'New Quotation', icon: <FileTextOutlined />, path: '/sales-purchase/quotation-manager', permissions: ['quotation.management'], color: '#1890ff' },
    { label: 'Dealer Payment', icon: <DollarOutlined />, path: '/sales-purchase/dealer-payments', permissions: ['payment'], color: '#52c41a' },
    { label: 'Dealer Ledger', icon: <TeamOutlined />, path: '/finance/dealer-ledger', permissions: ['dealer.ledger'], color: '#722ed1' },
    { label: 'Stock', icon: <ShopOutlined />, path: '/inventory/stock', permissions: ['stock.view'], color: '#fa8c16' },
    { label: 'Purchase Orders', icon: <FileTextOutlined />, path: '/sales-purchase/po-management', permissions: ['po.management'], color: '#13c2c2' },
    { label: 'GRN Entry', icon: <CheckSquareOutlined />, path: '/sales-purchase/grn-entry', permissions: ['grn.entry'], color: '#2f54eb' },
    { label: 'Picking', icon: <CheckSquareOutlined />, path: '/warehouse/picking-list', permissions: ['picking.management'], color: '#9254de' },
    { label: 'Delivery', icon: <TruckOutlined />, path: '/warehouse/delivery-tracking', permissions: ['delivery.view', 'delivery.tracking'], color: '#08979c' },
    { label: 'Approvals', icon: <CheckSquareOutlined />, path: '/approvals', permissions: ['sales.order.approve', 'po.approve', 'finance.management', 'dealer.discounts', 'credit.note', 'debit.note', 'system.management'], color: '#d46b08' },
  ].filter((action) => canNavigate(action.permissions)), [canNavigate]);

  // Summary tiles and metric cards drill into the matching list, but only when the
  // user could actually open that page — otherwise the tile stays non-interactive
  // instead of navigating into an Unauthorized screen.
  const openIfAllowed = useCallback(
    (path, permissions) => (canNavigate(permissions) ? () => navigate(path) : undefined),
    [canNavigate, navigate],
  );

  const sales = sections.sales;
  const collections = sections.collections;
  const inventory = sections.inventory;
  const purchase = sections.purchase;
  const warehouse = sections.warehouseDelivery;
  const profitability = sections.profitability;
  const approvals = sections.approvals;
  const crm = sections.crm;
  const hr = sections.hr;
  const activity = sections.activity;

  const moneyTableColumns = (nameTitle = 'Name', valueField = 'total') => [
    { title: nameTitle, dataIndex: 'name', key: 'name', render: (value, row) => value || titleCase(row._id || 'Unknown') },
    { title: 'Count', dataIndex: 'count', key: 'count', width: 90, render: (value) => value ?? '—' },
    { title: 'Value', dataIndex: valueField, key: valueField, align: 'right', render: (value) => formatCurrency(value) },
  ];

  return (
    <div>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Live Dashboard</h1>
          <p className="text-xs text-gray-500 mt-1">
            {metadata?.scope === 'all'
              ? `All active branches (${metadata.branchCount || 0})`
              : metadata?.branch?.name || activeBranch?.name || 'Selected branch'}
            {lastRefresh ? ` · Refreshed ${lastRefresh.toLocaleTimeString('en-IN')}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {isGlobalRole && (
            <Segmented
              value={scope}
              onChange={setScope}
              options={[{ label: 'Selected branch', value: 'branch' }, { label: 'All branches', value: 'all' }]}
            />
          )}
          <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <Skeleton active paragraph={{ rows: 3 }} />
          <Skeleton active paragraph={{ rows: 6 }} />
        </div>
      ) : !data ? (
        <Empty description="Dashboard data is unavailable" />
      ) : (
        <>
          {/* 1 — Top business summary: the numbers the owner checks first. */}
          <Row gutter={[12, 12]} className="mb-4">
            <SummaryTile label="Today Sales" value={sales?.todaySales} currency accent={BRAND} onClick={openIfAllowed('/sales-purchase/sales-order-dashboard', ['sales.order.dashboard'])} />
            <SummaryTile label="This Month Sales" value={sales?.monthSales} currency accent={NAVY} onClick={openIfAllowed('/sales-purchase/sales-order-dashboard', ['sales.order.dashboard'])} />
            <SummaryTile label="Today Collection" value={collections?.todayCollection} currency accent={POSITIVE} onClick={openIfAllowed('/sales-purchase/dealer-payments', ['payment'])} />
            <SummaryTile label="This Month Collection" value={collections?.monthCollection} currency accent="#13c2c2" onClick={openIfAllowed('/sales-purchase/dealer-payments', ['payment'])} />
            <SummaryTile label="Total Outstanding" value={collections?.pendingCollection} currency accent={NAVY} onClick={openIfAllowed('/finance/dealer-ledger', ['dealer.ledger'])} />
            <SummaryTile label="Stock Value" value={inventory?.stockValue} currency accent="#531dab" onClick={openIfAllowed('/inventory/stock', ['stock.view'])} />
            <SummaryTile label="Pending Orders" value={sales?.pendingOrders} accent={CAUTION} onClick={openIfAllowed('/sales-purchase/sales-order-dashboard', ['sales.order.dashboard'])} />
            <SummaryTile label="Pending Approvals" value={approvals?.pending} accent={approvals?.pending > 0 ? URGENT : NAVY} onClick={openIfAllowed('/approvals', ['dashboard.view'])} />
          </Row>

          {/* 2 — Quick Actions sit near the top so the common jumps are one click away. */}
          {quickActions.length > 0 && (
            <Section title="Quick Actions" icon={<CheckSquareOutlined />}>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    type="button"
                    className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-100 hover:border-gray-300 hover:bg-gray-50 transition text-center cursor-pointer"
                    onClick={() => navigate(action.path)}
                  >
                    <span style={{ color: action.color, fontSize: 20 }}>{action.icon}</span>
                    <span className="text-xs text-gray-600 leading-tight">{action.label}</span>
                  </button>
                ))}
              </div>
            </Section>
          )}

          {sales && (
            <Section
              title="Sales Overview"
              icon={<RiseOutlined />}
              action={hasPermission('sales.order.dashboard') ? <Button size="small" onClick={() => navigate('/sales-purchase/sales-order-dashboard')}>Open sales</Button> : null}
              warnings={sales.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Today's Sales" value={sales.todaySales} currency color={BRAND} note={`${sales.todayOrders} orders`} />
                <MetricCard title="Yesterday's Sales" value={sales.yesterdaySales} currency color={WARN} />
                <MetricCard title="Last 7 Days" value={sales.weekSales} currency color="#13c2c2" />
                <MetricCard title="This Month" value={sales.monthSales} currency color={NAVY_SOFT} note={sales.monthGrowth === null ? 'No prior-month baseline' : `${sales.monthGrowth >= 0 ? '+' : ''}${sales.monthGrowth}% vs prior month`} />
                <MetricCard title="This Year" value={sales.yearSales} currency color="#722ed1" />
                <MetricCard title="Pending Orders" value={sales.pendingOrders} color={CAUTION} onClick={openIfAllowed('/sales-purchase/sales-order-dashboard', ['sales.order.dashboard'])} />
                <MetricCard title="Sales Returns (Month)" value={sales.salesReturns} currency color={CAUTION} note={sales.salesReturnCount === null ? undefined : `${sales.salesReturnCount} returns`} />
                <MetricCard title="Average Order Value" value={sales.averageOrderValue} currency color={POSITIVE} note={`${sales.cancelledOrders} cancelled this month`} />
              </Row>

              <div className="mt-5">
                <div className="text-sm font-medium text-gray-600 mb-2">7-day sales trend</div>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={sales.weeklyTrend || []} margin={{ top: 8, right: 18, left: 8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={BRAND} stopOpacity={0.25} />
                        <stop offset="95%" stopColor={BRAND} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="_id" tickFormatter={(value) => value.slice(5)} tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={(value) => `₹${Math.round(value / 1000)}k`} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => [formatCurrency(value), 'Sales']} />
                    <Area type="monotone" dataKey="total" stroke={BRAND} strokeWidth={2} fill="url(#salesGradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <Row gutter={[16, 16]} className="mt-3">
                <Col xs={24} xl={8}>
                  <Table rowKey={(row) => String(row._id)} size="small" pagination={false} dataSource={sales.branchWise || []} columns={moneyTableColumns('Branch')} scroll={{ x: 420 }} />
                </Col>
                <Col xs={24} xl={8}>
                  <Table rowKey={(row) => String(row._id)} size="small" pagination={false} dataSource={sales.dealerWise || []} columns={moneyTableColumns('Dealer / Customer')} scroll={{ x: 420 }} />
                </Col>
                <Col xs={24} xl={8}>
                  <Table rowKey={(row) => String(row._id)} size="small" pagination={false} dataSource={sales.channelWise || []} columns={moneyTableColumns('Channel')} scroll={{ x: 420 }} />
                </Col>
              </Row>
            </Section>
          )}

          {collections && (
            <Section
              title="Collection Overview"
              icon={<DollarOutlined />}
              action={hasPermission('payment') ? <Button size="small" onClick={() => navigate('/sales-purchase/dealer-payments')}>Open payments</Button> : null}
              warnings={collections.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Today's Collection" value={collections.todayCollection} currency color={POSITIVE} />
                <MetricCard title="Cash" value={collections.cashCollection} currency color="#52c41a" />
                <MetricCard title="Bank / Digital" value={collections.bankCollection} currency color={NAVY_SOFT} />
                <MetricCard title="Cheque" value={collections.chequeCollection} currency color="#722ed1" />
                <MetricCard title="Outstanding" value={collections.pendingCollection} currency color={NAVY} />
                <MetricCard title="Overdue Collection" value={collections.overdueCollection} currency color={URGENT} />
                <MetricCard title="Pending Bills" value={collections.pendingOrders} color={CAUTION} />
                <MetricCard title="Overdue Bills" value={collections.overdueOrders} color={URGENT} />
                <MetricCard title="Month Collection" value={collections.monthCollection} currency color="#13c2c2" />
              </Row>
              <Row gutter={[16, 16]} className="mt-4">
                <Col xs={24} lg={12}>
                  <Table
                    rowKey={(row) => String(row._id)} size="small" pagination={false}
                    dataSource={collections.dealerOutstanding || []}
                    columns={moneyTableColumns('Dealer', 'outstanding').filter((column) => column.dataIndex !== 'count')}
                    scroll={{ x: 380 }}
                  />
                </Col>
                <Col xs={24} lg={12}>
                  <Table
                    rowKey={(row) => String(row._id)} size="small" pagination={false}
                    dataSource={collections.customerOutstanding || []}
                    columns={moneyTableColumns('Retail Customer', 'outstanding')}
                    scroll={{ x: 420 }}
                  />
                </Col>
                <Col xs={24}>
                  <Row gutter={[8, 8]}>
                    <MetricCard title="0–30 Days" value={collections.billAging?.current ?? null} currency color={POSITIVE} />
                    <MetricCard title="31–60 Days" value={collections.billAging?.days31To60 ?? null} currency color="#FAAD14" />
                    <MetricCard title="61–90 Days" value={collections.billAging?.days61To90 ?? null} currency color={WARN} />
                    <MetricCard title="Over 90 Days" value={collections.billAging?.over90 ?? null} currency color={URGENT} />
                  </Row>
                </Col>
              </Row>
            </Section>
          )}

          {profitability && (
            <Section
              title="Profitability Overview"
              icon={<BarChartOutlined />}
              action={(
                <Space size="small" wrap>
                  <Segmented
                    size="small"
                    value={profitPeriod}
                    onChange={setProfitPeriod}
                    options={[
                      { label: 'Today', value: 'today' },
                      { label: 'This Month', value: 'month' },
                      { label: 'This Year', value: 'year' },
                      { label: 'Custom', value: 'custom' },
                    ]}
                  />
                  {profitPeriod === 'custom' && (
                    <DatePicker.RangePicker
                      size="small"
                      value={profitRange}
                      onChange={setProfitRange}
                      format="DD/MM/YYYY"
                      disabledDate={(current) => current && current.isAfter(dayjs(), 'day')}
                    />
                  )}
                  {hasPermission('reports.profit') && (
                    <Button size="small" onClick={() => navigate('/reports/advanced')}>Open profit reports</Button>
                  )}
                </Space>
              )}
              warnings={profitability.warnings}
            >
              {profitPeriod === 'custom' && !profitRange?.[1] && (
                <Alert
                  className="mb-3"
                  type="info"
                  showIcon
                  message="Pick a start and end date to apply a custom range. Showing this month until then."
                />
              )}
              {profitability.period && (
                <div className="text-xs text-gray-400 mb-3">
                  {profitability.period.from === profitability.period.to
                    ? dayjs(profitability.period.from).format('DD MMM YYYY')
                    : `${dayjs(profitability.period.from).format('DD MMM YYYY')} → ${dayjs(profitability.period.to).format('DD MMM YYYY')}`}
                </div>
              )}
              <Row gutter={[12, 12]}>
                <MetricCard title="Gross Sales" value={profitability.grossSales} currency color={NAVY_SOFT} />
                <MetricCard title="Sales Returns" value={profitability.salesReturns} currency color={CAUTION} />
                <MetricCard title="Net Sales" value={profitability.netSales} currency color={POSITIVE} />
                <MetricCard title="Discounts" value={profitability.discounts} currency color={WARN} />
                <MetricCard title="Gross Profit" value={profitability.grossProfit} currency color={NEUTRAL} />
                <MetricCard title="Gross Profit %" value={profitability.grossProfitPercent} suffix="%" color={NEUTRAL} />
                <MetricCard title="Estimated Net Profit" value={profitability.estimatedNetProfit} currency color={NEUTRAL} />
              </Row>
            </Section>
          )}

          {approvals && (
            <Section
              title={`Approvals (${approvals.pending})`}
              icon={<CheckSquareOutlined />}
              action={<Button size="small" onClick={() => navigate('/approvals')}>Open workflow</Button>}
            >
              <Table
                rowKey="_id" size="small" pagination={false} dataSource={approvals.recent || []}
                locale={{ emptyText: 'Nothing awaiting approval' }}
                onRow={(row) => ({ onClick: () => navigate('/approvals'), style: { cursor: 'pointer' } })}
                columns={[
                  { title: 'Request', dataIndex: 'requestNumber', width: 130 },
                  { title: 'Title', dataIndex: 'title' },
                  { title: 'Type', dataIndex: 'type', render: titleCase },
                  { title: 'Priority', dataIndex: 'priority', render: (value) => <Tag color={value === 'urgent' ? 'red' : 'blue'}>{titleCase(value)}</Tag> },
                  { title: 'Requested by', dataIndex: 'requestedByName' },
                ]}
                scroll={{ x: 720 }}
              />
            </Section>
          )}

          {inventory && (
            <Section
              title="Inventory Overview"
              icon={<ShopOutlined />}
              action={hasPermission('stock.view') ? <Button size="small" onClick={() => navigate('/inventory/stock')}>Open stock</Button> : null}
              warnings={inventory.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Total Stock" value={inventory.totalQty} suffix="units" color={POSITIVE} />
                <MetricCard title="Available" value={inventory.availableQty} suffix="units" color="#52c41a" />
                <MetricCard title="Reserved" value={inventory.reservedQty} suffix="units" color={NAVY_SOFT} />
                <MetricCard title="Blocked" value={inventory.blockedQty} suffix="units" color="#722ed1" />
                <MetricCard title="Transit" value={inventory.transitQty} suffix="units" color="#13c2c2" />
                <MetricCard title="Damaged" value={inventory.damagedQty} suffix="units" color={CAUTION} />
                <MetricCard title="Low-stock Products" value={inventory.lowStockProducts} color={WARN} onClick={openIfAllowed('/inventory/stock-alerts', ['stock.view'])} />
                <MetricCard title="Out-of-stock Products" value={inventory.outOfStockProducts} color={URGENT} onClick={openIfAllowed('/inventory/stock-alerts', ['stock.view'])} />
                <MetricCard title="Slow-moving Products" value={inventory.movement?.slowMovingProducts} color={WARN} note="no sale in 91–180 days" />
                <MetricCard title="Non-moving Products" value={inventory.movement?.nonMovingProducts} color={CAUTION} note={inventory.movement?.neverSoldProducts ? `${formatNumber(inventory.movement.neverSoldProducts)} never sold` : 'over 180 days or never sold'} />
                <MetricCard title="Sample Stock" value={inventory.sampleQty} suffix="units" color={CAUTION} />
                <MetricCard title="Stock Value" value={inventory.stockValue} currency color="#531dab" />
              </Row>
              <Row gutter={[16, 16]} className="mt-4">
                <Col xs={24} lg={14}>
                  <Table
                    rowKey={(row) => String(row._id)} size="small" pagination={false}
                    dataSource={inventory.byWarehouse || []}
                    columns={[
                      { title: 'Warehouse', dataIndex: 'name' },
                      { title: 'Available', dataIndex: 'availableQty', align: 'right', render: formatNumber },
                      { title: 'Stock Value', dataIndex: 'stockValue', align: 'right', render: formatCurrency },
                    ]}
                    scroll={{ x: 460 }}
                  />
                </Col>
                <Col xs={24} lg={10}>
                  <Row gutter={[8, 8]}>
                    <MetricCard title="Age 0–30" value={inventory.aging?.under30} color={POSITIVE} />
                    <MetricCard title="Age 31–90" value={inventory.aging?.days31To90} color="#FAAD14" />
                    <MetricCard title="Age 91–180" value={inventory.aging?.days91To180} color={WARN} />
                    <MetricCard title="Age 180+" value={inventory.aging?.over180} color={CAUTION} />
                  </Row>
                </Col>
              </Row>
            </Section>
          )}

          {purchase && (
            <Section
              title="Purchase Overview"
              icon={<FileTextOutlined />}
              action={hasPermission('po.management') ? <Button size="small" onClick={() => navigate('/sales-purchase/po-management')}>Open purchase orders</Button> : null}
              warnings={purchase.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Pending POs" value={purchase.pendingPurchaseOrders} color={WARN} />
                <MetricCard title="Approved POs" value={purchase.approvedPurchaseOrders} color="#52c41a" />
                <MetricCard title="Goods in Transit" value={purchase.goodsInTransit} color={NAVY_SOFT} />
                <MetricCard title="GRN Pending" value={purchase.grnPending} color="#722ed1" />
                <MetricCard title="Purchase Returns" value={purchase.purchaseReturns} color={CAUTION} note={purchase.purchaseReturnValue === null ? undefined : formatCurrency(purchase.purchaseReturnValue)} />
                <MetricCard title="Supplier Outstanding" value={purchase.supplierOutstanding} currency color={CAUTION} />
                <MetricCard title="Supplier Invoices Pending" value={purchase.supplierInvoicesPending} color={NEUTRAL} />
                <MetricCard title="Supplier Scheme Due" value={purchase.supplierSchemeDue} color={NEUTRAL} />
              </Row>
            </Section>
          )}

          {warehouse && (
            <Section
              title="Warehouse & Delivery"
              icon={<TruckOutlined />}
              action={hasPermission('picking.management') ? <Button size="small" onClick={() => navigate('/warehouse/picking-list')}>Open picking</Button> : null}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Awaiting Picking" value={warehouse.awaitingPicking} color={WARN} onClick={openIfAllowed('/warehouse/picking-list', ['picking.management'])} />
                <MetricCard title="Under Picking" value={warehouse.underPicking} color={NAVY_SOFT} />
                <MetricCard title="Under Sorting" value={warehouse.underSorting} color="#722ed1" />
                <MetricCard title="Ready for Dispatch" value={warehouse.readyForDispatch} color="#13c2c2" />
                <MetricCard title="Vehicles Loading" value={warehouse.vehiclesUnderLoading} color={CAUTION} />
                <MetricCard title="Deliveries in Progress" value={warehouse.deliveriesInProgress} color="#08979c" />
                <MetricCard title="Delivered Today" value={warehouse.deliveredToday} color={POSITIVE} />
                <MetricCard title="Failed Deliveries" value={warehouse.failedDeliveries} color={URGENT} onClick={openIfAllowed('/warehouse/delivery-tracking', ['delivery.view', 'delivery.tracking'])} />
                <MetricCard title="Rescheduled" value={warehouse.rescheduledDeliveries} color="#FAAD14" />
                <MetricCard title="Pending POD" value={warehouse.pendingPod} color={WARN} />
              </Row>
            </Section>
          )}

          {crm && (crm.available === false ? <UnavailableSection title="CRM Overview" section={crm} /> : (
            <Section
              title="CRM Overview"
              icon={<SolutionOutlined />}
              action={hasPermission('lead.view') ? <Button size="small" onClick={() => navigate('/crm/lead-management')}>Open leads</Button> : null}
              warnings={crm.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Total Leads" value={crm.totalLeads} color={NAVY_SOFT} />
                <MetricCard title="New Leads (Today)" value={crm.todayLeads} color={BRAND} note={`${formatNumber(crm.monthLeads)} this month`} />
                <MetricCard title="Active Leads" value={crm.activeLeads} color="#13c2c2" />
                <MetricCard title="Hot Leads" value={crm.hotLeads} color={WARN} />
                <MetricCard title="Follow-ups Today" value={crm.followupsToday} color="#722ed1" />
                <MetricCard title="Overdue Follow-ups" value={crm.overdueFollowups} color={URGENT} />
                <MetricCard title="Unassigned Leads" value={crm.unassignedLeads} color={CAUTION} />
                <MetricCard title="Won Leads" value={crm.wonLeads} color={POSITIVE} note={`${formatNumber(crm.lostLeads)} lost`} />
                <MetricCard title="Open Complaints" value={crm.openComplaints} color={WARN} note={`${formatNumber(crm.totalComplaints)} total`} />
                <MetricCard title="Critical Complaints" value={crm.criticalComplaints} color={URGENT} />
              </Row>
              {(crm.leadsBySource || []).length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Lead sources</div>
                  <div className="flex flex-wrap gap-2">
                    {crm.leadsBySource.map((row) => (
                      <Tag key={String(row._id)} className="px-2 py-1">
                        {titleCase(String(row._id || 'Other'))}
                        <strong className="ml-1">{formatNumber(row.count)}</strong>
                      </Tag>
                    ))}
                  </div>
                </div>
              )}

              {(crm.recentLeads || []).length > 0 && (
                <div className="mt-4">
                  <div className="text-sm font-medium text-gray-600 mb-2">Latest leads</div>
                  <Table
                    rowKey="_id" size="small" pagination={false} dataSource={crm.recentLeads}
                    columns={[
                      { title: 'Lead #', dataIndex: 'leadNumber', width: 130 },
                      { title: 'Name', key: 'name', render: (_, row) => row.businessName || row.name || '—' },
                      { title: 'City', dataIndex: 'city', width: 120, render: (value) => value || '—' },
                      { title: 'Priority', dataIndex: 'priority', width: 100, render: (value) => <Tag color={value === 'hot' ? 'red' : 'blue'}>{titleCase(value || '')}</Tag> },
                      { title: 'Status', dataIndex: 'status', width: 120, render: (value) => titleCase(value || '') },
                      { title: 'Assigned to', dataIndex: 'assignedToName', width: 150, render: (value) => value || 'Unassigned' },
                      { title: 'Next follow-up', dataIndex: 'nextFollowupDate', width: 130, render: (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—') },
                    ]}
                    scroll={{ x: 900 }}
                  />
                </div>
              )}
            </Section>
          ))}

          {hr && (hr.available === false ? <UnavailableSection title="HR Overview" section={hr} /> : (
            <Section
              title="HR Overview"
              icon={<TeamOutlined />}
              action={hasPermission('employee.registration') ? <Button size="small" onClick={() => navigate('/hrms/employee-registration')}>Open employees</Button> : null}
              warnings={hr.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Total Employees" value={hr.totalEmployees} color={NAVY_SOFT} note={`${formatNumber(hr.activeEmployees)} active`} />
                <MetricCard title="Present Today" value={attendanceCount(hr.attendanceByStatus, 'Present')} color={POSITIVE} />
                <MetricCard title="Absent Today" value={attendanceCount(hr.attendanceByStatus, 'Absent')} color={CAUTION} />
                <MetricCard title="Late Today" value={attendanceCount(hr.attendanceByStatus, 'Late')} color={WARN} />
                <MetricCard title="On Leave" value={attendanceCount(hr.attendanceByStatus, 'Leave')} color="#722ed1" />
                <MetricCard title="Half Day" value={attendanceCount(hr.attendanceByStatus, 'Half Day')} color={CAUTION} />
                <MetricCard title="Pending Leave Approvals" value={hr.pendingLeaves} color={CAUTION} />
                <MetricCard title="Upcoming Approved Leaves" value={hr.upcomingLeaves} color="#13c2c2" />
                <MetricCard title="On Notice" value={hr.onNoticeEmployees} color={WARN} />
                <MetricCard title="On Probation" value={hr.onProbationEmployees} color={NAVY_SOFT} />
                <MetricCard title="Marked Today" value={hr.attendanceToday} color={NEUTRAL} note="attendance records" />
              </Row>
              <Row gutter={[16, 16]} className="mt-4">
                <Col xs={24} lg={10}>
                  <div className="text-sm font-medium text-gray-600 mb-2">Department strength</div>
                  <Table
                    rowKey={(row) => String(row._id)} size="small" pagination={false}
                    dataSource={hr.departments || []}
                    columns={[
                      { title: 'Department', dataIndex: '_id', render: (value) => titleCase(String(value || 'Unassigned')) },
                      { title: 'Employees', dataIndex: 'count', align: 'right', render: formatNumber },
                    ]}
                    scroll={{ x: 300 }}
                  />
                </Col>
                <Col xs={24} lg={14}>
                  <div className="text-sm font-medium text-gray-600 mb-2">Leave approvals waiting</div>
                  <Table
                    rowKey="_id" size="small" pagination={false}
                    dataSource={hr.pendingLeaveRows || []}
                    locale={{ emptyText: 'No pending leave requests' }}
                    columns={[
                      { title: 'Employee', key: 'employee', render: (_, row) => row.employee?.name || '—' },
                      { title: 'Type', dataIndex: 'leaveType', width: 110 },
                      { title: 'From', dataIndex: 'fromDate', width: 110, render: (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—') },
                      { title: 'To', dataIndex: 'toDate', width: 110, render: (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—') },
                      { title: 'Days', dataIndex: 'days', width: 80, align: 'right' },
                    ]}
                    scroll={{ x: 520 }}
                  />
                </Col>
              </Row>
            </Section>
          ))}

          {activity && (activity.available === false ? <UnavailableSection title="Recent Activity" section={activity} /> : (
            <Section
              title="Recent Activity"
              icon={<HistoryOutlined />}
              action={hasPermission('activity.logs') ? <Button size="small" onClick={() => navigate('/reports/activity-logs')}>Open logs</Button> : null}
              warnings={activity.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Actions Today" value={activity.todayCount} color={BRAND} />
                <MetricCard title={activity.periodLabel || 'Last 7 days'} value={activity.periodCount} color={NAVY_SOFT} />
              </Row>
              <div className="mt-4">
                <Table
                  rowKey="_id" size="small" pagination={false}
                  dataSource={activity.recentLogs || []}
                  locale={{ emptyText: 'No activity recorded yet' }}
                  columns={[
                    { title: 'When', dataIndex: 'timestamp', width: 165, render: (value) => (value ? new Date(value).toLocaleString('en-IN') : '—') },
                    { title: 'User', key: 'user', width: 160, render: (_, row) => <span>{row.userName || 'System'}{row.userRole ? <span className="text-xs text-gray-400"> · {titleCase(row.userRole)}</span> : null}</span> },
                    { title: 'Action', dataIndex: 'action', width: 110, render: (value) => <Tag>{titleCase(value || '')}</Tag> },
                    { title: 'Module', dataIndex: 'module', width: 130, render: (value) => titleCase(value || '') },
                    { title: 'Record', key: 'record', render: (_, row) => row.recordTitle || row.description || '—' },
                  ]}
                  scroll={{ x: 800 }}
                />
              </div>
            </Section>
          ))}

        </>
      )}
    </div>
  );
};

export default OwnerDashboard;
