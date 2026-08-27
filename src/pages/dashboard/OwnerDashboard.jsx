import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Skeleton,
  Statistic,
  Table,
  Tag,
  message,
} from 'antd';
import {
  BarChartOutlined,
  CheckSquareOutlined,
  DollarOutlined,
  FileTextOutlined,
  ReloadOutlined,
  RiseOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
  TeamOutlined,
  TruckOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '../../context/AuthContext.jsx';
import reportService from '../../services/reportService.js';

const BRAND = '#FF5F03';
const INR = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const NUMBER = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

const formatCurrency = (value) => `₹${INR.format(Number(value) || 0)}`;
const formatNumber = (value) => NUMBER.format(Number(value) || 0);
const titleCase = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const MetricCard = ({ title, value, currency = false, suffix, color = '#1677ff', note, onClick }) => (
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
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const isGlobalRole = ['owner', 'super_admin'].includes(user?.role);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reportService.getDashboard({ scope });
      if (response.success) {
        setData(response.data);
        setLastRefresh(new Date(response.data.metadata?.generatedAt || Date.now()));
      }
    } catch (error) {
      message.error(error.message || 'Unable to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => { load(); }, [load]);

  const sections = data?.sections || {};
  const metadata = data?.metadata;
  const canNavigate = useCallback((permissions) => hasAnyPermission(permissions), [hasAnyPermission]);

  const quickActions = useMemo(() => [
    { label: 'Sales Orders', icon: <ShoppingCartOutlined />, path: '/sales-purchase/sales-order-dashboard', permissions: ['sales.order.dashboard'], color: BRAND },
    { label: 'New Quotation', icon: <FileTextOutlined />, path: '/sales-purchase/quotation-manager', permissions: ['sales.order.create'], color: '#1890ff' },
    { label: 'Dealer Payment', icon: <DollarOutlined />, path: '/sales-purchase/dealer-payments', permissions: ['payment'], color: '#52c41a' },
    { label: 'Dealer Ledger', icon: <TeamOutlined />, path: '/finance/dealer-ledger', permissions: ['dealer.ledger'], color: '#722ed1' },
    { label: 'Stock', icon: <ShopOutlined />, path: '/inventory/stock', permissions: ['stock.view'], color: '#fa8c16' },
    { label: 'Purchase Orders', icon: <FileTextOutlined />, path: '/sales-purchase/po-management', permissions: ['po.management'], color: '#13c2c2' },
    { label: 'GRN Entry', icon: <CheckSquareOutlined />, path: '/sales-purchase/grn-entry', permissions: ['grn.entry'], color: '#2f54eb' },
    { label: 'Picking', icon: <CheckSquareOutlined />, path: '/warehouse/picking-list', permissions: ['picking.management'], color: '#9254de' },
    { label: 'Delivery', icon: <TruckOutlined />, path: '/warehouse/delivery-tracking', permissions: ['delivery.management', 'delivery.tracking'], color: '#08979c' },
    { label: 'Approvals', icon: <CheckSquareOutlined />, path: '/approvals', permissions: ['sales.order.approve', 'po.management', 'finance.management', 'dealer.discounts', 'credit.note', 'debit.note', 'system.management'], color: '#d46b08' },
  ].filter((action) => canNavigate(action.permissions)), [canNavigate]);

  const sales = sections.sales;
  const collections = sections.collections;
  const inventory = sections.inventory;
  const purchase = sections.purchase;
  const warehouse = sections.warehouseDelivery;
  const profitability = sections.profitability;
  const approvals = sections.approvals;

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
          {sales && (
            <Section
              title="Sales Overview"
              icon={<RiseOutlined />}
              action={hasPermission('sales.order.dashboard') ? <Button size="small" onClick={() => navigate('/sales-purchase/sales-order-dashboard')}>Open sales</Button> : null}
              warnings={sales.warnings}
            >
              <Row gutter={[12, 12]}>
                <MetricCard title="Today's Sales" value={sales.todaySales} currency color={BRAND} note={`${sales.todayOrders} orders`} />
                <MetricCard title="Yesterday's Sales" value={sales.yesterdaySales} currency color="#fa8c16" />
                <MetricCard title="Last 7 Days" value={sales.weekSales} currency color="#13c2c2" />
                <MetricCard title="This Month" value={sales.monthSales} currency color="#1677ff" note={sales.monthGrowth === null ? 'No prior-month baseline' : `${sales.monthGrowth >= 0 ? '+' : ''}${sales.monthGrowth}% vs prior month`} />
                <MetricCard title="This Year" value={sales.yearSales} currency color="#722ed1" />
                <MetricCard title="Pending Orders" value={sales.pendingOrders} color="#d46b08" />
                <MetricCard title="Sales Returns (Month)" value={sales.salesReturns} currency color="#cf1322" note={sales.salesReturnCount === null ? undefined : `${sales.salesReturnCount} returns`} />
                <MetricCard title="Average Order Value" value={sales.averageOrderValue} currency color="#389e0d" note={`${sales.cancelledOrders} cancelled this month`} />
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
                <MetricCard title="Today's Collection" value={collections.todayCollection} currency color="#389e0d" />
                <MetricCard title="Cash" value={collections.cashCollection} currency color="#52c41a" />
                <MetricCard title="Bank / Digital" value={collections.bankCollection} currency color="#1677ff" />
                <MetricCard title="Cheque" value={collections.chequeCollection} currency color="#722ed1" />
                <MetricCard title="Outstanding" value={collections.pendingCollection} currency color="#cf1322" />
                <MetricCard title="Overdue Collection" value={collections.overdueCollection} currency color="#a8071a" />
                <MetricCard title="Pending Bills" value={collections.pendingOrders} color="#d46b08" />
                <MetricCard title="Overdue Bills" value={collections.overdueOrders} color="#a8071a" />
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
                    <MetricCard title="0–30 Days" value={collections.billAging?.current ?? null} currency color="#52c41a" />
                    <MetricCard title="31–60 Days" value={collections.billAging?.days31To60 ?? null} currency color="#faad14" />
                    <MetricCard title="61–90 Days" value={collections.billAging?.days61To90 ?? null} currency color="#fa8c16" />
                    <MetricCard title="Over 90 Days" value={collections.billAging?.over90 ?? null} currency color="#cf1322" />
                  </Row>
                </Col>
              </Row>
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
                <MetricCard title="Total Stock" value={inventory.totalQty} suffix="units" color="#389e0d" />
                <MetricCard title="Available" value={inventory.availableQty} suffix="units" color="#52c41a" />
                <MetricCard title="Reserved" value={inventory.reservedQty} suffix="units" color="#1677ff" />
                <MetricCard title="Blocked" value={inventory.blockedQty} suffix="units" color="#722ed1" />
                <MetricCard title="Transit" value={inventory.transitQty} suffix="units" color="#13c2c2" />
                <MetricCard title="Damaged" value={inventory.damagedQty} suffix="units" color="#cf1322" />
                <MetricCard title="Low-stock Products" value={inventory.lowStockProducts} color="#fa8c16" />
                <MetricCard title="Out-of-stock Products" value={inventory.outOfStockProducts} color="#a8071a" />
                <MetricCard title="Sample Stock" value={inventory.sampleQty} suffix="units" color="#d46b08" />
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
                    <MetricCard title="Age 0–30" value={inventory.aging?.under30} color="#52c41a" />
                    <MetricCard title="Age 31–90" value={inventory.aging?.days31To90} color="#faad14" />
                    <MetricCard title="Age 91–180" value={inventory.aging?.days91To180} color="#fa8c16" />
                    <MetricCard title="Age 180+" value={inventory.aging?.over180} color="#cf1322" />
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
                <MetricCard title="Pending POs" value={purchase.pendingPurchaseOrders} color="#fa8c16" />
                <MetricCard title="Approved POs" value={purchase.approvedPurchaseOrders} color="#52c41a" />
                <MetricCard title="Goods in Transit" value={purchase.goodsInTransit} color="#1677ff" />
                <MetricCard title="GRN Pending" value={purchase.grnPending} color="#722ed1" />
                <MetricCard title="Purchase Returns" value={purchase.purchaseReturns} color="#cf1322" note={purchase.purchaseReturnValue === null ? undefined : formatCurrency(purchase.purchaseReturnValue)} />
                <MetricCard title="Supplier Outstanding" value={purchase.supplierOutstanding} currency color="#d46b08" />
                <MetricCard title="Supplier Invoices Pending" value={purchase.supplierInvoicesPending} color="#8c8c8c" />
                <MetricCard title="Supplier Scheme Due" value={purchase.supplierSchemeDue} color="#8c8c8c" />
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
                <MetricCard title="Awaiting Picking" value={warehouse.awaitingPicking} color="#fa8c16" />
                <MetricCard title="Under Picking" value={warehouse.underPicking} color="#1677ff" />
                <MetricCard title="Under Sorting" value={warehouse.underSorting} color="#722ed1" />
                <MetricCard title="Ready for Dispatch" value={warehouse.readyForDispatch} color="#13c2c2" />
                <MetricCard title="Vehicles Loading" value={warehouse.vehiclesUnderLoading} color="#d46b08" />
                <MetricCard title="Deliveries in Progress" value={warehouse.deliveriesInProgress} color="#08979c" />
                <MetricCard title="Delivered Today" value={warehouse.deliveredToday} color="#389e0d" />
                <MetricCard title="Failed Deliveries" value={warehouse.failedDeliveries} color="#cf1322" />
                <MetricCard title="Rescheduled" value={warehouse.rescheduledDeliveries} color="#faad14" />
                <MetricCard title="Pending POD" value={warehouse.pendingPod} color="#a8071a" />
              </Row>
            </Section>
          )}

          {profitability && (
            <Section title="Profitability Overview" icon={<BarChartOutlined />} warnings={profitability.warnings}>
              <Row gutter={[12, 12]}>
                <MetricCard title="Gross Sales (Month)" value={profitability.grossSales} currency color="#1677ff" />
                <MetricCard title="Sales Returns" value={profitability.salesReturns} currency color="#cf1322" />
                <MetricCard title="Net Sales" value={profitability.netSales} currency color="#389e0d" />
                <MetricCard title="Discounts" value={profitability.discounts} currency color="#fa8c16" />
                <MetricCard title="Gross Profit" value={profitability.grossProfit} color="#8c8c8c" />
                <MetricCard title="Estimated Net Profit" value={profitability.estimatedNetProfit} color="#8c8c8c" />
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

          {sections.crm && <UnavailableSection title="CRM Overview" section={sections.crm} />}
          {sections.hr && <UnavailableSection title="HR Overview" section={sections.hr} />}
          {sections.activity && <UnavailableSection title="Recent Activity" section={sections.activity} />}

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
        </>
      )}
    </div>
  );
};

export default OwnerDashboard;
