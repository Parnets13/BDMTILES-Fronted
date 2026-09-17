import React, { useEffect, useState, useMemo } from 'react';
import {
  Table, Button, Tag, Input, Space, Statistic, Card, Row, Col, DatePicker, Select, Modal,
  message, Tooltip, Popconfirm, Drawer, Descriptions, Badge, Typography, Avatar, List,
} from 'antd';
import {
  Search, Eye, Edit, Delete, Truck, RefreshCw, Phone, MapPin, Package, CreditCard,
  FileText, CheckCircle, XCircle, Clock, Calendar, Printer, Download, Filter, X,
  Send, Warehouse, User, Building,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import salesService from '../../services/salesService.js';
import useBranches from '../../hooks/useBranches.js';
import { hasPermission } from '../../utils/permissions.js';
import { StatusBadge, PaymentStatusBadge } from '../common/StatusBadges.jsx';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;

const WebsiteOrders = () => {
  const navigate = useNavigate();
  const { currentBranch, canCrossBranch } = useBranches();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    paymentStatus: '',
    dateFrom: null,
    dateTo: null,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [stats, setStats] = useState({ confirmed: 0, processing: 0, dispatched: 0, delivered: 0, cancelled: 0, total: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  const canUpdate = hasPermission('sales.order.create');
  const canDelete = hasPermission('sales.order.dashboard');
  const canViewDetail = hasPermission('sales.order.dashboard');

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        orderType: 'online',
      };
      if (filters.search) params.search = filters.search;
      if (filters.status) params.status = filters.status;
      if (filters.paymentStatus) params.paymentStatus = filters.paymentStatus;
      if (filters.dateFrom) params.dateFrom = dayjs(filters.dateFrom).format('YYYY-MM-DD');
      if (filters.dateTo) params.dateTo = dayjs(filters.dateTo).format('YYYY-MM-DD');
      const res = await salesService.getOrders(params);
      if (res?.success) {
        setOrders(res.data || []);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      message.error('Failed to load website orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const res = await salesService.getOrders({
        page: 1,
        limit: 1,
        orderType: 'online',
      });
      if (res?.success) {
        const allRes = await salesService.getOrders({
          page: 1,
          limit: 1000,
          orderType: 'online',
        });
        const allOrders = allRes?.data || [];
        setStats({
          total: res.pagination?.totalItems || 0,
          confirmed: allOrders.filter(o => o.status === 'confirmed').length,
          processing: allOrders.filter(o => o.status === 'processing').length,
          dispatched: allOrders.filter(o => o.status === 'dispatched').length,
          delivered: allOrders.filter(o => o.status === 'delivered').length,
          cancelled: allOrders.filter(o => o.status === 'cancelled').length,
        });
      }
    } catch (err) {
      console.warn('Stats fetch failed', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
    fetchStats();
  }, [pagination.current, pagination.pageSize]);

  const onSearch = () => {
    setPagination(p => ({ ...p, current: 1 }));
    setTimeout(fetchOrders, 50);
  };

  const resetFilters = () => {
    setFilters({ search: '', status: '', paymentStatus: '', dateFrom: null, dateTo: null });
    setPagination(p => ({ ...p, current: 1 }));
    setTimeout(() => { fetchOrders(); fetchStats(); }, 50);
  };

  const handleStatusChange = async (order, newStatus, confirmText) => {
    Modal.confirm({
      title: `Change status to ${newStatus.toUpperCase()}?`,
      content: confirmText || `Update order ${order.orderNumber} status?`,
      okText: 'Confirm',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await salesService.updateStatus(order._id, { status: newStatus });
          message.success(`Order marked as ${newStatus}`);
          fetchOrders();
          fetchStats();
          if (selectedOrder?._id === order._id) openDetail(order);
        } catch (err) {
          message.error(err?.message || 'Failed to update status');
        }
      },
    });
  };

  const handleDelete = async (order) => {
    try {
      await salesService.deleteOrder(order._id);
      message.success('Order deleted');
      fetchOrders();
      fetchStats();
    } catch (err) {
      message.error(err?.message || 'Failed to delete order');
    }
  };

  const openDetail = async (order) => {
    try {
      const res = await salesService.getOrder(order._id);
      if (res?.success) {
        setSelectedOrder(res.data);
        setDetailOpen(true);
      }
    } catch (err) {
      message.error(err?.message || 'Failed to load order details');
    }
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setTimeout(() => setSelectedOrder(null), 300);
  };

  const columns = useMemo(() => [
    {
      title: 'Order #',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      width: 180,
      fixed: 'left',
      render: (v, r) => (
        <Space>
          <Tag color="purple" style={{ borderRadius: 4, fontWeight: 600 }}>WEB</Tag>
          <div>
            <div className="text-sm font-semibold text-blue-700 cursor-pointer hover:underline" onClick={() => canViewDetail && openDetail(r)}>
              {v}
            </div>
            <div className="text-xs text-gray-400">{dayjs(r.orderDate).format('DD MMM YYYY HH:mm')}</div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Customer',
      key: 'customer',
      width: 180,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium flex items-center gap-1.5">
            <User size={13} className="text-gray-400" />
            {r.customerName || r.dealerName || r.dealer?.businessName || '—'}
          </div>
          <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5">
            <Phone size={11} className="text-gray-400" />
            {r.customerPhone || r.dealerCode || r.dealer?.dealerCode || '-'}
          </div>
        </div>
      ),
    },
    {
      title: 'Delivery Address',
      dataIndex: 'deliveryAddress',
      key: 'deliveryAddress',
      width: 220,
      ellipsis: true,
      render: (v) => (
        <Tooltip title={v}>
          <div className="flex items-start gap-1.5 text-sm text-gray-700">
            <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{v || '—'}</span>
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Items',
      key: 'items',
      width: 90,
      align: 'center',
      render: (_, r) => (
        <div className="flex flex-col items-center">
          <Package size={16} className="text-gray-400 mb-0.5" />
          <div className="text-sm font-semibold">{(r.items || []).length}</div>
          <div className="text-xs text-gray-400">Qty: {(r.items || []).reduce((s, i) => s + (i.quantity || 0), 0)}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      render: (_, r) => <StatusBadge status={r.status} />,
    },
    {
      title: 'Payment',
      key: 'paymentStatus',
      width: 120,
      render: (_, r) => <PaymentStatusBadge status={r.paymentStatus} />,
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 130,
      align: 'right',
      render: (_, r) => (
        <div>
          <div className="text-sm font-bold text-gray-800">₹{(r.grandTotal || 0).toLocaleString()}</div>
          {r.balanceAmount > 0 && (
            <div className="text-xs text-orange-600 font-medium">Bal: ₹{(r.balanceAmount || 0).toLocaleString()}</div>
          )}
        </div>
      ),
    },
    {
      title: 'Branch',
      key: 'branch',
      width: 120,
      render: (_, r) => r.branch ? (
        <div className="flex items-center gap-1.5">
          <Building size={12} className="text-gray-400" />
          <span className="text-xs text-gray-700">{r.branch.branchCode || r.branch.name}</span>
        </div>
      ) : canCrossBranch ? <Text type="secondary" className="text-xs">—</Text> : null,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, r) => (
        <Space size="small" wrap>
          <Tooltip title="View Details">
            <Button size="small" type="text" icon={<Eye size={14} />} onClick={() => openDetail(r)} />
          </Tooltip>
          {r.status === 'confirmed' && canUpdate && (
            <Tooltip title="Mark Processing">
              <Button size="small" type="text" icon={<Warehouse size={14} />} onClick={() => handleStatusChange(r, 'processing', 'Order will move to warehouse processing.')} />
            </Tooltip>
          )}
          {r.status === 'processing' && canUpdate && (
            <Tooltip title="Mark Dispatched">
              <Button size="small" type="text" icon={<Truck size={14} />} onClick={() => handleStatusChange(r, 'dispatched', 'Order has been handed over to delivery team?')} />
            </Tooltip>
          )}
          {r.status === 'dispatched' && canUpdate && (
            <Tooltip title="Mark Delivered">
              <Button size="small" type="text" icon={<CheckCircle size={14} />} onClick={() => handleStatusChange(r, 'delivered', 'Confirm successful delivery to customer.')} />
            </Tooltip>
          )}
          {['confirmed', 'processing'].includes(r.status) && canUpdate && (
            <Popconfirm title="Cancel this website order?" onConfirm={() => handleStatusChange(r, 'cancelled')} okText="Cancel Order" cancelText="Keep">
              <Button size="small" type="text" danger icon={<XCircle size={14} />} />
            </Popconfirm>
          )}
          {canViewDetail && (
            <Tooltip title="Open Full Order">
              <Button size="small" type="text" icon={<FileText size={14} />} onClick={() => navigate(`/sales-purchase/order-view/${r._id}`)} />
            </Tooltip>
          )}
          {canDelete && (
            <Popconfirm title="Delete order permanently?" onConfirm={() => handleDelete(r)} okText="Delete" okType="danger" cancelText="Cancel">
              <Button size="small" type="text" danger icon={<Delete size={14} />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ], [canUpdate, canDelete, canViewDetail, navigate]);

  return (
    <div className="p-5">
      <div className="flex flex-wrap items-center justify-between mb-4 gap-3">
        <Space align="center">
          <Badge color="#8B5CF6" />
          <div>
            <Title level={4} style={{ margin: 0 }}>Website Orders</Title>
            <Text type="secondary" className="text-sm">
              Orders placed by customers from the public website (bdm-tiles-web)
            </Text>
          </div>
        </Space>
        <Space wrap>
          <Button icon={<RefreshCw size={14} />} onClick={() => { fetchOrders(); fetchStats(); }}>Refresh</Button>
          <Button type="primary" icon={<Printer size={14} />} onClick={() => window.print()} disabled={orders.length === 0}>
            Print List
          </Button>
          <Button icon={<Download size={14} />} disabled={orders.length === 0}>
            Export CSV
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bordered>
            <Statistic title={<span className="text-xs text-gray-500">Total Website Orders</span>} value={stats.total} prefix={<Badge color="purple" />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bordered>
            <Statistic title={<span className="text-xs text-gray-500">New / Confirmed</span>} value={stats.confirmed} valueStyle={{ color: '#2563EB' }} prefix={<Clock size={14} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bordered>
            <Statistic title={<span className="text-xs text-gray-500">Processing</span>} value={stats.processing} valueStyle={{ color: '#D97706' }} prefix={<Warehouse size={14} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bordered>
            <Statistic title={<span className="text-xs text-gray-500">Dispatched</span>} value={stats.dispatched} valueStyle={{ color: '#7C3AED' }} prefix={<Truck size={14} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bordered>
            <Statistic title={<span className="text-xs text-gray-500">Delivered</span>} value={stats.delivered} valueStyle={{ color: '#059669' }} prefix={<CheckCircle size={14} />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} md={4}>
          <Card size="small" bordered>
            <Statistic title={<span className="text-xs text-gray-500">Cancelled</span>} value={stats.cancelled} valueStyle={{ color: '#DC2626' }} prefix={<XCircle size={14} />} />
          </Card>
        </Col>
      </Row>

      <Card size="small" className="mb-4">
        <Row gutter={[12, 12]} align="middle">
          <Col xs={24} sm={12} md={6}>
            <Input
              allowClear
              placeholder="Search order #, customer, phone..."
              prefix={<Search size={14} className="text-gray-400" />}
              value={filters.search}
              onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
              onPressEnter={onSearch}
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Order Status"
              style={{ width: '100%' }}
              value={filters.status}
              onChange={(v) => setFilters(f => ({ ...f, status: v }))}
            >
              <Option value="confirmed">Confirmed</Option>
              <Option value="processing">Processing</Option>
              <Option value="dispatched">Dispatched</Option>
              <Option value="delivered">Delivered</Option>
              <Option value="cancelled">Cancelled</Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              allowClear
              placeholder="Payment Status"
              style={{ width: '100%' }}
              value={filters.paymentStatus}
              onChange={(v) => setFilters(f => ({ ...f, paymentStatus: v }))}
            >
              <Option value="pending">Pending (COD)</Option>
              <Option value="paid">Paid</Option>
              <Option value="partial">Partial</Option>
              <Option value="failed">Failed</Option>
            </Select>
          </Col>
          <Col xs={24} sm={16} md={6}>
            <RangePicker
              style={{ width: '100%' }}
              value={filters.dateFrom && filters.dateTo ? [dayjs(filters.dateFrom), dayjs(filters.dateTo)] : null}
              onChange={(dates) => setFilters(f => ({ ...f, dateFrom: dates?.[0] || null, dateTo: dates?.[1] || null }))}
            />
          </Col>
          <Col xs={24} sm={8} md={4}>
            <Space wrap>
              <Button type="primary" icon={<Search size={14} />} onClick={onSearch}>Search</Button>
              <Button icon={<X size={14} />} onClick={resetFilters}>Reset</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card size="small" bodyStyle={{ padding: 0 }}>
        <Table
          rowKey="_id"
          loading={loading}
          dataSource={orders}
          columns={columns}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Total ${total} orders`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => setPagination(p => ({ ...p, current: page, pageSize })),
          }}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          scroll={{ x: 1400 }}
          size="middle"
        />
      </Card>

      <Drawer
        title={
          <Space>
            <Badge color="purple" />
            <span style={{ fontWeight: 600 }}>Website Order Details</span>
            <Tag color="blue">{selectedOrder?.orderNumber}</Tag>
            {selectedOrder && <StatusBadge status={selectedOrder.status} />}
          </Space>
        }
        width={720}
        open={detailOpen}
        onClose={closeDetail}
        extra={<Button size="small" onClick={closeDetail}>Close</Button>}
      >
        {selectedOrder && (
          <div className="space-y-5">
            <Descriptions bordered size="small" column={2} labelStyle={{ width: 140 }}>
              <Descriptions.Item label="Order #">{selectedOrder.orderNumber}</Descriptions.Item>
              <Descriptions.Item label="Order Date">{dayjs(selectedOrder.orderDate).format('DD MMM YYYY HH:mm')}</Descriptions.Item>
              <Descriptions.Item label="Customer">
                <div>
                  <div className="font-medium flex items-center gap-1.5">
                    <User size={12} className="text-gray-400" />
                    {selectedOrder.customerName || selectedOrder.dealerName || selectedOrder.dealer?.businessName || '—'}
                  </div>
                  <div className="text-xs text-gray-500 flex items-center gap-1.5 mt-1">
                    <Phone size={11} className="text-gray-400" />
                    {selectedOrder.customerPhone || selectedOrder.dealer?.mobile || '—'}
                  </div>
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Status"><StatusBadge status={selectedOrder.status} /></Descriptions.Item>
              <Descriptions.Item label="Payment">
                <PaymentStatusBadge status={selectedOrder.paymentStatus} />
                {selectedOrder.balanceAmount > 0 && (
                  <div className="text-xs mt-1 text-orange-600">Balance: ₹{(selectedOrder.balanceAmount || 0).toLocaleString()}</div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Branch">{selectedOrder.branch?.branchCode || selectedOrder.branch?.name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Delivery Address" span={2}>
                <div className="flex items-start gap-1.5">
                  <MapPin size={13} className="text-gray-400 mt-0.5 flex-shrink-0" />
                  <span>{selectedOrder.deliveryAddress || '—'}</span>
                </div>
              </Descriptions.Item>
              {selectedOrder.remarks && (
                <Descriptions.Item label="Notes" span={2}>
                  <Paragraph style={{ margin: 0 }} type="secondary">{selectedOrder.remarks}</Paragraph>
                </Descriptions.Item>
              )}
            </Descriptions>

            <Card size="small" title={<Space><Package size={14} />Items ({(selectedOrder.items || []).length})</Space>}>
              <List
                size="small"
                dataSource={selectedOrder.items || []}
                renderItem={(it, i) => (
                  <List.Item key={i}>
                    <div className="w-full flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {it.productImage ? (
                            <img src={it.productImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <Package size={18} className="text-gray-400" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{it.productName || it.aliasName}</div>
                          <div className="text-xs text-gray-500">
                            {it.productCode || ''}
                            {it.tileSize && ` · ${it.tileSize}`}
                            {it.colour && ` · ${it.colour}`}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm">
                          <span className="font-medium">{it.quantity || 0}</span>
                          <span className="text-gray-400 text-xs"> x </span>
                          <span>₹{(it.rate || 0).toLocaleString()}</span>
                        </div>
                        <div className="text-sm font-bold text-gray-800">₹{(it.totalAmount || 0).toLocaleString()}</div>
                      </div>
                    </div>
                  </List.Item>
                )}
              />
            </Card>

            <Descriptions bordered size="small" column={2} labelStyle={{ width: 140 }}>
              <Descriptions.Item label="Subtotal">₹{(selectedOrder.subtotal || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Total Discount">
                <Text type={selectedOrder.totalDiscount > 0 ? 'success' : ''}>- ₹{(selectedOrder.totalDiscount || 0).toLocaleString()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tax">₹{(selectedOrder.totalTax || 0).toLocaleString()}</Descriptions.Item>
              <Descriptions.Item label="Freight / Other">
                ₹{((selectedOrder.freightCharges || 0) + (selectedOrder.loadingCharges || 0) + (selectedOrder.installationCharges || 0) + (selectedOrder.otherCharges || 0) + (selectedOrder.roundOff || 0)).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Grand Total" span={2}>
                <div className="text-lg font-bold text-blue-700">₹{(selectedOrder.grandTotal || 0).toLocaleString()}</div>
              </Descriptions.Item>
            </Descriptions>

            <div className="flex flex-wrap gap-2 pt-3 justify-end border-t">
              {selectedOrder.status === 'confirmed' && canUpdate && (
                <Button icon={<Warehouse size={14} />} onClick={() => handleStatusChange(selectedOrder, 'processing', 'Move to processing?')}>
                  Start Processing
                </Button>
              )}
              {selectedOrder.status === 'processing' && canUpdate && (
                <Button icon={<Truck size={14} />} onClick={() => handleStatusChange(selectedOrder, 'dispatched', 'Mark as dispatched?')}>
                  Mark Dispatched
                </Button>
              )}
              {selectedOrder.status === 'dispatched' && canUpdate && (
                <Button type="primary" icon={<CheckCircle size={14} />} onClick={() => handleStatusChange(selectedOrder, 'delivered', 'Confirm delivery to customer?')}>
                  Mark Delivered
                </Button>
              )}
              {['confirmed', 'processing'].includes(selectedOrder.status) && canUpdate && (
                <Button danger icon={<XCircle size={14} />} onClick={() => handleStatusChange(selectedOrder, 'cancelled')}>
                  Cancel Order
                </Button>
              )}
              <Button icon={<FileText size={14} />} onClick={() => navigate(`/sales-purchase/order-view/${selectedOrder._id}`)}>
                Open Full Order
              </Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default WebsiteOrders;
