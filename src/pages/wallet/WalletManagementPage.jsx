import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Tag, Space, Modal, Form, InputNumber,
  message, Tooltip, Card, Statistic, Row, Col, Tabs, Divider,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, PlusCircleOutlined,
  MinusCircleOutlined, WalletOutlined, ArrowUpOutlined, ArrowDownOutlined,
} from '@ant-design/icons';
import walletService from '../../services/walletService.js';

const REASON_LABELS = {
  cashback: 'Cashback',
  referral: 'Referral',
  manual_credit: 'Manual Credit',
  manual_debit: 'Manual Debit',
  redemption: 'Redeemed',
  expiry: 'Expired',
  refund: 'Refund',
};

// ── Transaction history sub-panel ────────────────────────────────────────
function TransactionHistory({ customerId }) {
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await walletService.getTransactions(customerId, { page, limit: 20 });
      if (res.success) {
        setTxns(res.data);
        setPagination((p) => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [customerId]);

  useEffect(() => { load(); }, [load]);

  const cols = [
    {
      title: 'Type', dataIndex: 'type', width: 80,
      render: (t) => (
        <Tag color={t === 'credit' ? 'green' : 'red'} icon={t === 'credit' ? <ArrowUpOutlined /> : <ArrowDownOutlined />}>
          {t === 'credit' ? 'Credit' : 'Debit'}
        </Tag>
      ),
    },
    {
      title: 'Amount', dataIndex: 'amount', width: 110,
      render: (v, r) => (
        <span className={`font-bold ${r.type === 'credit' ? 'text-emerald-600' : 'text-red-500'}`}>
          {r.type === 'credit' ? '+' : '-'}₹{v.toLocaleString('en-IN')}
        </span>
      ),
    },
    { title: 'Balance After', dataIndex: 'balanceAfter', width: 120, render: (v) => `₹${v.toLocaleString('en-IN')}` },
    { title: 'Reason', dataIndex: 'reason', width: 130, render: (v) => REASON_LABELS[v] || v },
    { title: 'Description', dataIndex: 'description', render: (v) => v || '—' },
    {
      title: 'Date', dataIndex: 'createdAt', width: 130,
      render: (v) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    },
  ];

  return (
    <Table
      columns={cols}
      dataSource={txns}
      rowKey="_id"
      loading={loading}
      size="small"
      pagination={{ ...pagination, onChange: (page) => load(page), showTotal: (t) => `${t} transactions` }}
    />
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function WalletManagementPage() {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 30, total: 0 });

  // Credit / debit modal
  const [txnModal, setTxnModal] = useState(null); // { type: 'credit'|'debit', customerId, customerName }
  const [txnLoading, setTxnLoading] = useState(false);
  const [txnForm] = Form.useForm();

  // Detail drawer
  const [detailCustomer, setDetailCustomer] = useState(null);
  const [walletDetail, setWalletDetail] = useState(null);

  const fetchWallets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await walletService.getWallets({ search, page: pagination.current, limit: pagination.pageSize });
      if (res.success) {
        setWallets(res.data);
        setPagination((p) => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [search, pagination.current, pagination.pageSize]);

  useEffect(() => { fetchWallets(); }, [fetchWallets]);

  const openDetail = async (wallet) => {
    setDetailCustomer(wallet.customer);
    setWalletDetail(wallet);
  };

  const openTxnModal = (type, wallet) => {
    setTxnModal({ type, customerId: wallet.customer._id, customerName: wallet.customer.name });
    txnForm.resetFields();
  };

  const submitTxn = async () => {
    try {
      const values = await txnForm.validateFields();
      setTxnLoading(true);
      const fn = txnModal.type === 'credit' ? walletService.credit : walletService.debit;
      const res = await fn(txnModal.customerId, values);
      if (res.success) {
        message.success(res.message);
        setTxnModal(null);
        fetchWallets();
        // refresh detail if open
        if (detailCustomer?._id === txnModal.customerId) {
          const detail = await walletService.getWallet(txnModal.customerId);
          if (detail.success) setWalletDetail(detail.data.wallet);
        }
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally { setTxnLoading(false); }
  };

  const totalBalance   = wallets.reduce((s, w) => s + (w.balance || 0), 0);
  const totalEarned    = wallets.reduce((s, w) => s + (w.totalEarned || 0), 0);
  const totalRedeemed  = wallets.reduce((s, w) => s + (w.totalRedeemed || 0), 0);

  const columns = [
    {
      title: 'Customer', key: 'customer',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-sm text-gray-900">{r.customer?.name || '—'}</div>
          <div className="text-xs text-gray-400">{r.customer?.contactNumber}</div>
        </div>
      ),
    },
    {
      title: 'Balance', dataIndex: 'balance', width: 120,
      render: (v) => (
        <span className="font-black text-emerald-700 text-base">₹{(v || 0).toLocaleString('en-IN')}</span>
      ),
    },
    { title: 'Total Earned', dataIndex: 'totalEarned', width: 120, render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    { title: 'Total Redeemed', dataIndex: 'totalRedeemed', width: 130, render: (v) => `₹${(v || 0).toLocaleString('en-IN')}` },
    {
      title: 'Status', dataIndex: 'status', width: 90,
      render: (s) => <Tag color={s === 'active' ? 'green' : 'red'}>{s}</Tag>,
    },
    {
      title: 'Actions', width: 160,
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Credit BDM Cash">
            <Button size="small" type="primary" icon={<PlusCircleOutlined />} onClick={() => openTxnModal('credit', r)}>
              Credit
            </Button>
          </Tooltip>
          <Tooltip title="Debit BDM Cash">
            <Button size="small" danger icon={<MinusCircleOutlined />} onClick={() => openTxnModal('debit', r)}>
              Debit
            </Button>
          </Tooltip>
          <Tooltip title="View History">
            <Button size="small" icon={<WalletOutlined />} onClick={() => openDetail(r)}>
              History
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <WalletOutlined className="text-emerald-600" /> BDM Cash Wallet Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage customer BDM Cash balances — credit cashback, debit corrections</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={fetchWallets}>Refresh</Button>
      </div>

      {/* Summary stats */}
      <Row gutter={16} className="mb-4">
        <Col span={8}>
          <Card size="small">
            <Statistic title="Total BDM Cash Outstanding" value={totalBalance} prefix="₹" precision={0} valueStyle={{ color: '#059669' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Total Ever Earned" value={totalEarned} prefix="₹" precision={0} valueStyle={{ color: '#2563eb' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="Total Redeemed" value={totalRedeemed} prefix="₹" precision={0} valueStyle={{ color: '#dc2626' }} />
          </Card>
        </Col>
      </Row>

      {/* Search */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <Input
          placeholder="Search customer name or phone…"
          prefix={<SearchOutlined className="text-gray-400" />}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination((p) => ({ ...p, current: 1 })); }}
          className="w-72"
          allowClear
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={wallets}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 900 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}`,
            onChange: (page, pageSize) => setPagination((p) => ({ ...p, current: page, pageSize })),
          }}
        />
      </div>

      {/* Credit / Debit modal */}
      <Modal
        title={txnModal?.type === 'credit'
          ? `Credit BDM Cash — ${txnModal?.customerName}`
          : `Debit BDM Cash — ${txnModal?.customerName}`}
        open={!!txnModal}
        onOk={submitTxn}
        onCancel={() => setTxnModal(null)}
        confirmLoading={txnLoading}
        okText={txnModal?.type === 'credit' ? 'Credit' : 'Debit'}
        okButtonProps={{ danger: txnModal?.type === 'debit' }}
        destroyOnHidden
      >
        <Form form={txnForm} layout="vertical" className="mt-4">
          <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: 'Amount is required' }]}>
            <InputNumber min={1} step={1} className="w-full" prefix="₹" placeholder="e.g. 250" />
          </Form.Item>
          <Form.Item name="description" label="Reason / Note">
            <Input placeholder={txnModal?.type === 'credit' ? 'e.g. Cashback on order #BDM12345' : 'e.g. Correction / expired cash'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Transaction History Modal */}
      <Modal
        title={`BDM Cash History — ${detailCustomer?.name}`}
        open={!!detailCustomer}
        onCancel={() => { setDetailCustomer(null); setWalletDetail(null); }}
        footer={null}
        width={820}
        destroyOnHidden
      >
        {walletDetail && (
          <div className="mb-4 flex gap-6 text-sm">
            <div><span className="text-gray-500">Balance: </span><span className="font-black text-emerald-700 text-lg">₹{walletDetail.balance?.toLocaleString('en-IN')}</span></div>
            <div><span className="text-gray-500">Earned: </span><span className="font-semibold text-blue-600">₹{walletDetail.totalEarned?.toLocaleString('en-IN')}</span></div>
            <div><span className="text-gray-500">Redeemed: </span><span className="font-semibold text-red-500">₹{walletDetail.totalRedeemed?.toLocaleString('en-IN')}</span></div>
          </div>
        )}
        <Divider className="my-3" />
        {detailCustomer && <TransactionHistory customerId={detailCustomer._id} />}
      </Modal>
    </div>
  );
}
