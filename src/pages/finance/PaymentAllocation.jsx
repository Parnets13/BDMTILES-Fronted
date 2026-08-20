import { useState, useEffect } from 'react';
import {
  Table, Button, Select, Input, InputNumber, message,
  Row, Col, Card, Statistic, Tag, Divider, Modal, Space
} from 'antd';
import { SearchOutlined, CheckCircleOutlined, DollarOutlined, SwapOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import masterService from '../../services/masterService.js';
import financeService from '../../services/financeService.js';

const PaymentAllocation = () => {
  const [dealers, setDealers] = useState([]);
  const [selectedDealer, setSelectedDealer] = useState(null);
  const [dealerSearch, setDealerSearch] = useState('');

  const [payments, setPayments] = useState([]);     // unallocated payments
  const [orders, setOrders] = useState([]);          // pending balance orders
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingPayments, setLoadingPayments] = useState(false);

  const [selectedPayment, setSelectedPayment] = useState(null);
  const [allocations, setAllocations] = useState({}); // orderId -> amount
  const [allocating, setAllocating] = useState(false);

  useEffect(() => {
    masterService.getDealers({ limit: 100, status: 'active' })
      .then(r => { if (r.success) setDealers(r.data); })
      .catch(() => {});
  }, []);

  const handleDealerSelect = async (dealerId) => {
    const dealer = dealers.find(d => d._id === dealerId);
    setSelectedDealer(dealer);
    setSelectedPayment(null);
    setAllocations({});
    loadDealerData(dealerId);
  };

  const loadDealerData = async (dealerId) => {
    setLoadingOrders(true);
    setLoadingPayments(true);
    try {
      const [ordersRes, paymentsRes] = await Promise.all([
        salesService.getDealerOrders(dealerId),
        salesService.getPayments({ dealer: dealerId, paymentType: 'dealer_receipt', status: 'confirmed', limit: 50 }),
      ]);
      if (ordersRes.success) setOrders(ordersRes.data);
      if (paymentsRes.success) setPayments(paymentsRes.data);
    } catch (err) { message.error(err.message); }
    finally { setLoadingOrders(false); setLoadingPayments(false); }
  };

  const selectPayment = (payment) => {
    setSelectedPayment(payment);
    setAllocations({});
    // Auto-allocate: fill oldest invoices first
    let remaining = payment.amount;
    const autoAlloc = {};
    for (const order of [...orders].sort((a, b) => new Date(a.orderDate) - new Date(b.orderDate))) {
      if (remaining <= 0) break;
      const bal = order.balanceAmount || 0;
      if (bal <= 0) continue;
      const alloc = Math.min(remaining, bal);
      autoAlloc[order._id] = alloc;
      remaining -= alloc;
    }
    setAllocations(autoAlloc);
  };

  const totalAllocated = Object.values(allocations).reduce((s, v) => s + (v || 0), 0);
  const remainingToAllocate = selectedPayment ? selectedPayment.amount - totalAllocated : 0;

  const handleAllocate = async () => {
    if (!selectedPayment) { message.error('Select a payment first'); return; }
    const items = Object.entries(allocations)
      .filter(([, v]) => v > 0)
      .map(([orderId, amount]) => {
        const order = orders.find(o => o._id === orderId);
        return { order: orderId, orderModel: 'SalesOrder', orderNumber: order?.orderNumber, allocatedAmount: amount };
      });
    if (!items.length) { message.error('Allocate amount to at least one order'); return; }

    setAllocating(true);
    try {
      // Update each SO's paid amount directly
      for (const item of items) {
        const order = orders.find(o => o._id === item.order);
        if (!order) continue;
        const newAdvance = (order.advanceAmount || 0) + item.allocatedAmount;
        const newBalance = order.grandTotal - newAdvance;
        await salesService.updateOrder(item.order, {
          advanceAmount: newAdvance,
          balanceAmount: Math.max(0, newBalance),
          paymentStatus: newBalance <= 0 ? 'paid' : 'partial',
        });
      }
      message.success(`₹${totalAllocated.toLocaleString()} allocated to ${items.length} order(s)`);
      setSelectedPayment(null);
      setAllocations({});
      loadDealerData(selectedDealer._id);
    } catch (err) { message.error(err.message); }
    finally { setAllocating(false); }
  };

  const orderColumns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 110,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 95,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Total', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="text-sm">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Paid', dataIndex: 'advanceAmount', width: 100,
      render: v => <span className="text-sm text-green-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Balance', dataIndex: 'balanceAmount', width: 110,
      render: v => <span className="text-sm font-semibold text-red-600">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Payment Status', dataIndex: 'paymentStatus', width: 110,
      render: s => <Tag color={s === 'paid' ? 'green' : s === 'partial' ? 'blue' : 'orange'}>{s}</Tag> },
    ...(selectedPayment ? [{
      title: 'Allocate (₹)',
      key: 'allocate',
      width: 130,
      render: (_, r) => (
        <InputNumber
          min={0}
          max={r.balanceAmount || 0}
          value={allocations[r._id] || 0}
          onChange={v => setAllocations(a => ({ ...a, [r._id]: v || 0 }))}
          size="small"
          prefix="₹"
          className="w-28"
        />
      ),
    }] : []),
  ];

  const paymentColumns = [
    { title: 'Payment #', dataIndex: 'paymentNumber', width: 120,
      render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    { title: 'Date', dataIndex: 'paymentDate', width: 95,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Amount', dataIndex: 'amount', width: 110,
      render: v => <span className="font-semibold text-blue-700">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Mode', dataIndex: 'paymentMode', width: 80,
      render: v => <Tag className="text-xs">{v}</Tag> },
    { title: '',  width: 90,
      render: (_, r) => (
        <Button
          size="small"
          type={selectedPayment?._id === r._id ? 'primary' : 'default'}
          icon={<CheckCircleOutlined />}
          onClick={() => selectPayment(r)}
        >
          {selectedPayment?._id === r._id ? 'Selected' : 'Select'}
        </Button>
      )},
  ];

  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Payment Allocation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Link dealer receipts against specific sales orders
          </p>
        </div>
      </div>

      {/* Dealer Selection */}
      <Card size="small" className="mb-5 border-blue-100">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <SwapOutlined className="text-blue-500 text-lg" />
            <span className="font-semibold text-gray-700">Select Dealer:</span>
          </div>
          <Select
            showSearch
            className="w-80"
            size="large"
            placeholder="Search dealer by name or code..."
            optionFilterProp="label"
            onChange={handleDealerSelect}
            options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))}
          />
          {selectedDealer && (
            <div className="ml-4 flex gap-6 text-sm">
              <div><span className="text-gray-400">Outstanding:</span>{' '}
                <span className="font-bold text-red-600">₹{(selectedDealer.currentOutstanding || 0).toLocaleString()}</span>
              </div>
              <div><span className="text-gray-400">Credit Limit:</span>{' '}
                <span className="font-medium">₹{(selectedDealer.creditLimit || 0).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {selectedDealer && (
        <Row gutter={16}>
          {/* Payments Panel */}
          <Col span={10}>
            <Card
              title={<span className="text-sm font-semibold">💰 Receipts from {selectedDealer.businessName}</span>}
              size="small"
              className="h-full"
            >
              {selectedPayment && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
                  <div className="font-semibold text-blue-800">Selected: {selectedPayment.paymentNumber}</div>
                  <div className="flex justify-between mt-1">
                    <span>Total: <strong>₹{(selectedPayment.amount || 0).toLocaleString()}</strong></span>
                    <span>Allocated: <strong className="text-green-600">₹{totalAllocated.toLocaleString()}</strong></span>
                    <span>Remaining: <strong className={remainingToAllocate > 0 ? 'text-orange-600' : 'text-green-600'}>
                      ₹{remainingToAllocate.toLocaleString()}
                    </strong></span>
                  </div>
                </div>
              )}
              <Table
                columns={paymentColumns}
                dataSource={payments}
                rowKey="_id"
                size="small"
                loading={loadingPayments}
                pagination={{ pageSize: 8, showTotal: t => `${t} payments` }}
                rowClassName={r => selectedPayment?._id === r._id ? 'bg-blue-50' : ''}
              />
            </Card>
          </Col>

          {/* Orders Panel */}
          <Col span={14}>
            <Card
              title={<span className="text-sm font-semibold">📋 Pending Orders</span>}
              size="small"
              extra={
                selectedPayment && (
                  <Button
                    type="primary"
                    icon={<DollarOutlined />}
                    loading={allocating}
                    disabled={totalAllocated <= 0}
                    onClick={handleAllocate}
                  >
                    Allocate ₹{totalAllocated.toLocaleString()}
                  </Button>
                )
              }
            >
              {selectedPayment && (
                <div className="mb-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded">
                  ✏ Edit the "Allocate" column to adjust amounts per order. Auto-filled oldest-first.
                </div>
              )}
              <Table
                columns={orderColumns}
                dataSource={orders}
                rowKey="_id"
                size="small"
                loading={loadingOrders}
                scroll={{ x: 700 }}
                pagination={{ pageSize: 8, showTotal: t => `${t} orders` }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {!selectedDealer && (
        <div className="flex flex-col items-center justify-center py-24 text-gray-300">
          <SwapOutlined className="text-5xl" />
          <p className="mt-4 text-lg text-gray-400">Select a dealer above to begin allocation</p>
        </div>
      )}
    </div>
  );
};

export default PaymentAllocation;
