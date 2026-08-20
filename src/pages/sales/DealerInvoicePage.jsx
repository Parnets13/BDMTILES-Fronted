import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Row, Col, Card, Statistic, Tooltip } from 'antd';
import { SearchOutlined, PrinterOutlined, EyeOutlined, ReloadOutlined, FileTextOutlined } from '@ant-design/icons';
import salesService from '../../services/salesService.js';
import SalesOrderView from './SalesOrderView.jsx';

const STATUS_COLORS = {
  confirmed: 'blue', approved: 'cyan', processing: 'orange',
  partial_dispatch: 'geekblue', dispatched: 'purple', delivered: 'green',
};

const DealerInvoicePage = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [viewOrderId, setViewOrderId] = useState(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        status: statusFilter || undefined,
      };
      // Only show invoice-able orders (not draft/cancelled)
      if (!statusFilter) params.status = undefined;
      const res = await salesService.getOrders(params);
      if (res.success) {
        // Filter only confirmed+ orders for invoice view
        const invoiceable = statusFilter ? res.data : res.data.filter(o => !['draft', 'cancelled', 'expired'].includes(o.status));
        setOrders(invoiceable);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const columns = [
    { title: 'Invoice #', dataIndex: 'orderNumber', width: 110, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'orderDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'Dealer', key: 'dealer', width: 180, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[170px]">{r.dealerName || r.dealer?.businessName || '—'}</div><div className="text-xs text-gray-400">{r.dealerCode || r.dealer?.dealerCode}</div></div>
    )},
    { title: 'Items', key: 'items', width: 55, render: (_, r) => <span className="text-sm">{r.items?.length || 0}</span> },
    { title: 'Amount', dataIndex: 'grandTotal', width: 110, render: v => <span className="text-sm font-bold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Paid', key: 'paid', width: 90, render: (_, r) => <span className="text-xs text-green-600">₹{(r.advanceAmount || 0).toLocaleString()}</span> },
    { title: 'Balance', key: 'bal', width: 90, render: (_, r) => <span className="text-xs font-semibold text-red-600">₹{(r.balanceAmount || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 100, render: s => <Tag color={STATUS_COLORS[s]}>{s?.replace('_', ' ')}</Tag> },
    { title: 'Tally', dataIndex: 'tallySyncStatus', width: 80, render: s => (
      <Tag color={s === 'synced' ? 'green' : s === 'pending' ? 'orange' : s === 'failed' ? 'red' : 'default'} className="text-[10px]">{s === 'not_synced' ? 'Not Synced' : s}</Tag>
    )},
    { title: 'Actions', width: 90, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View & Print"><Button type="text" size="small" icon={<PrinterOutlined />} className="text-blue-600" onClick={() => setViewOrderId(r._id)} /></Tooltip>
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Dealer Invoices</h1><p className="text-sm text-gray-500 mt-0.5">View and print GST tax invoices for confirmed orders</p></div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search invoice #, dealer..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace('_', ' ') }))}
            value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-36" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={orders} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} invoices` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* View/Print Order */}
      {viewOrderId && (
        <SalesOrderView
          orderId={viewOrderId}
          onClose={() => setViewOrderId(null)}
          onStatusChange={fetchInvoices}
        />
      )}
    </div>
  );
};

export default DealerInvoicePage;
