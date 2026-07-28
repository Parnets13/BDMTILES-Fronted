import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Select, Tag, message,
  Row, Col, Card, Statistic, Tabs, Divider, Space
} from 'antd';
import { ReloadOutlined, UserOutlined, BookOutlined } from '@ant-design/icons';
import { Users, ShoppingBag, CreditCard, AlertTriangle, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';
import salesService from '../../services/salesService.js';

const Customer360 = () => {
  const navigate = useNavigate();
  const [dealers, setDealers] = useState([]);
  const [dealersLoading, setDealersLoading] = useState(false);
  const [selectedDealerId, setSelectedDealerId] = useState(null);
  const [dealerDetail, setDealerDetail] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);

  const [orderStats, setOrderStats] = useState({ total: 0, totalAmount: 0, paid: 0, balance: 0, openComplaints: 0 });

  useEffect(() => {
    setDealersLoading(true);
    masterService.getDealers({ limit: 200, status: 'active' })
      .then(r => { if (r.success) setDealers(r.data || []); })
      .catch(() => {})
      .finally(() => setDealersLoading(false));
  }, []);

  const loadDealerProfile = useCallback(async (dealerId) => {
    if (!dealerId) return;
    setProfileLoading(true);
    try {
      const res = await masterService.getDealer(dealerId);
      if (res.success) setDealerDetail(res.data);
    } catch (err) { message.error(err.message); }
    finally { setProfileLoading(false); }
  }, []);

  const loadOrders = useCallback(async (dealerId) => {
    if (!dealerId) return;
    setOrdersLoading(true);
    try {
      const res = await salesService.getOrders({ dealer: dealerId, limit: 10 });
      if (res.success) {
        const data = res.data || [];
        setOrders(data);
        const totalAmount = data.reduce((s, o) => s + (o.grandTotal || 0), 0);
        const paid = data.reduce((s, o) => s + (o.paidAmount || 0), 0);
        setOrderStats(prev => ({
          ...prev, total: data.length, totalAmount, paid, balance: totalAmount - paid,
        }));
      }
    } catch { setOrders([]); }
    finally { setOrdersLoading(false); }
  }, []);

  const loadPayments = useCallback(async (dealerId) => {
    if (!dealerId) return;
    setPaymentsLoading(true);
    try {
      const res = await salesService.getPayments({ dealer: dealerId, limit: 10 });
      if (res.success) setPayments(res.data || []);
    } catch { setPayments([]); }
    finally { setPaymentsLoading(false); }
  }, []);

  const loadComplaints = useCallback(async (dealerId) => {
    if (!dealerId) return;
    setComplaintsLoading(true);
    try {
      const res = await crmService.getComplaints({ dealer: dealerId, limit: 10 });
      if (res.success) {
        const data = res.data || [];
        setComplaints(data);
        setOrderStats(prev => ({ ...prev, openComplaints: data.filter(c => ['open', 'in_progress'].includes(c.status)).length }));
      }
    } catch { setComplaints([]); }
    finally { setComplaintsLoading(false); }
  }, []);

  const handleDealerSelect = (dealerId) => {
    setSelectedDealerId(dealerId);
    setDealerDetail(null);
    setOrders([]); setPayments([]); setComplaints([]);
    setOrderStats({ total: 0, totalAmount: 0, paid: 0, balance: 0, openComplaints: 0 });
    if (dealerId) {
      loadDealerProfile(dealerId);
      loadOrders(dealerId);
      loadPayments(dealerId);
      loadComplaints(dealerId);
    }
  };

  const orderColumns = [
    { title: 'Order #', dataIndex: 'orderNumber', width: 110,
      render: v => <span className="font-mono text-xs text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 100,
      render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Items', key: 'items', width: 60, render: (_, r) => r.items?.length || 0 },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110,
      render: v => <span className="font-semibold text-sm">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 110,
      render: s => <Tag color="blue">{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Payment', dataIndex: 'paymentStatus', width: 90,
      render: s => <Tag color={s === 'paid' ? 'green' : s === 'partial' ? 'blue' : 'orange'}>{s}</Tag> },
  ];

  const paymentColumns = [
    { title: 'Receipt #', dataIndex: 'receiptNumber', width: 120,
      render: v => <span className="font-mono text-xs text-green-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'paymentDate', width: 100,
      render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '—'}</span> },
    { title: 'Method', dataIndex: 'paymentMethod', width: 100,
      render: v => <Tag>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Amount', dataIndex: 'amount', width: 110,
      render: v => <span className="font-semibold text-sm text-green-700">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 90,
      render: s => <Tag color={s === 'confirmed' ? 'green' : 'orange'}>{s}</Tag> },
  ];

  const complaintColumns = [
    { title: 'Complaint #', dataIndex: 'complaintNumber', width: 120,
      render: v => <span className="font-mono text-xs text-red-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'createdAt', width: 100,
      render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '—'}</span> },
    { title: 'Category', dataIndex: 'category', width: 130,
      render: v => <Tag color="orange">{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Priority', dataIndex: 'priority', width: 90,
      render: v => <Tag color={v === 'critical' ? 'red' : v === 'high' ? 'orange' : 'default'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 100,
      render: s => <Tag color={s === 'resolved' ? 'green' : s === 'open' ? 'red' : 'blue'}>{s}</Tag> },
  ];

  const tabItems = [
    { key: 'orders', label: <span><ShoppingBag size={14} className="inline mr-1" />Orders</span>,
      children: <Table columns={orderColumns} dataSource={orders} rowKey="_id" loading={ordersLoading}
        size="small" pagination={false} scroll={{ x: 700 }} /> },
    { key: 'payments', label: <span><CreditCard size={14} className="inline mr-1" />Payments</span>,
      children: <Table columns={paymentColumns} dataSource={payments} rowKey="_id" loading={paymentsLoading}
        size="small" pagination={false} scroll={{ x: 600 }} /> },
    { key: 'complaints', label: <span><AlertTriangle size={14} className="inline mr-1" />Complaints</span>,
      children: <Table columns={complaintColumns} dataSource={complaints} rowKey="_id" loading={complaintsLoading}
        size="small" pagination={false} scroll={{ x: 600 }} /> },
    { key: 'ledger', label: <span><BookOutlined className="mr-1" />Ledger</span>,
      children: (
        <div className="py-8 text-center">
          <p className="text-gray-500 mb-4">View full transaction ledger for this dealer</p>
          <Button type="primary" icon={<BookOutlined />}
            onClick={() => navigate(`/finance/dealer-ledger`)}>
            Go to Dealer Ledger
          </Button>
        </div>
      )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Users size={24} className="text-indigo-600" /> Customer 360°
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Complete dealer profile — orders, payments, complaints & ledger</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex items-center gap-3">
          <UserOutlined className="text-gray-400 text-lg" />
          <Select showSearch optionFilterProp="label" placeholder="Select a dealer to view their 360° profile..."
            className="w-96" value={selectedDealerId || undefined}
            onChange={handleDealerSelect} loading={dealersLoading}
            options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode}) — ${d.city || ''}` }))} />
          {selectedDealerId && <Button icon={<ReloadOutlined />} onClick={() => handleDealerSelect(selectedDealerId)}>Refresh</Button>}
        </div>
      </div>

      {!selectedDealerId ? (
        <div className="bg-white rounded-lg border border-gray-200 py-24 text-center">
          <Users size={48} className="mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium text-gray-400">Select a dealer to view their 360° profile</h3>
          <p className="text-sm text-gray-400 mt-1">Choose a dealer from the dropdown above</p>
        </div>
      ) : (
        <div>
          <Row gutter={16} className="mb-4">
            {/* Left: Dealer Info Card */}
            <Col span={7}>
              <Card size="small" loading={profileLoading} className="h-full border-indigo-100">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                    <UserOutlined className="text-indigo-600 text-lg" />
                  </div>
                  <div>
                    <div className="font-bold text-gray-800">{dealerDetail?.businessName || '...'}</div>
                    <div className="text-xs text-gray-400">{dealerDetail?.dealerCode}</div>
                  </div>
                </div>
                <Divider className="my-2" />
                {dealerDetail && (
                  <div className="space-y-1 text-xs">
                    {[['City', dealerDetail.city],['Mobile', dealerDetail.mobile],['GSTIN', dealerDetail.gstin || '—'],
                      ['Type', dealerDetail.dealerType?.name || dealerDetail.dealerTypeName || '—'],
                      ['Category', dealerDetail.dealerCategory?.name || dealerDetail.dealerCategoryName || '—'],
                      ['Credit Limit', `₹${(dealerDetail.creditLimit || 0).toLocaleString()}`],
                      ['Outstanding', `₹${(dealerDetail.currentOutstanding || 0).toLocaleString()}`],
                    ].map(([k, v]) => (
                      <div key={k} className="flex justify-between py-0.5 border-b border-gray-50">
                        <span className="text-gray-400">{k}</span>
                        <span className={`font-medium ${k === 'Outstanding' && (dealerDetail.currentOutstanding || 0) > 0 ? 'text-red-600' : ''}`}>{v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </Col>

            {/* Right: Stats */}
            <Col span={17}>
              <Row gutter={[12, 12]}>
                {[
                  ['Total Orders', orderStats.total, '#1890ff', ShoppingBag],
                  ['Total Purchases', `₹${(orderStats.totalAmount || 0).toLocaleString()}`, '#722ed1', DollarSign],
                  ['Total Paid', `₹${(orderStats.paid || 0).toLocaleString()}`, '#52c41a', CreditCard],
                  ['Balance Due', `₹${(orderStats.balance || 0).toLocaleString()}`, '#f5222d', DollarSign],
                  ['Open Complaints', orderStats.openComplaints, '#fa8c16', AlertTriangle],
                ].map(([label, val, color, Icon]) => (
                  <Col key={label} span={8}>
                    <Card size="small" style={{ borderColor: color + '30' }}>
                      <div className="flex items-center gap-2">
                        <Icon size={18} style={{ color }} />
                        <div>
                          <div className="text-xs text-gray-400">{label}</div>
                          <div className="font-bold text-base" style={{ color }}>{val}</div>
                        </div>
                      </div>
                    </Card>
                  </Col>
                ))}
              </Row>
            </Col>
          </Row>

          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <Tabs items={tabItems} />
          </div>
        </div>
      )}
    </div>
  );
};

export default Customer360;
