import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider
} from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, PrinterOutlined } from '@ant-design/icons';
import crmService from '../../services/crmService.js';

const STATUS_COLORS = {
  planned: 'blue', loaded: 'orange', in_transit: 'purple',
  partially_delivered: 'geekblue', completed: 'green', cancelled: 'red',
};

const DeliveryHistory = () => {
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('completed');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [viewDispatch, setViewDispatch] = useState(null);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const res = await crmService.getDispatches({
        page, limit: 20, search, status: statusFilter,
        dateFrom, dateTo,
      });
      if (res.success) {
        setDispatches(res.data || []);
        const pg = res.pagination;
        setPagination({ current: pg?.currentPage || 1, pageSize: 20, total: pg?.totalItems || 0 });
      }
    } catch { setDispatches([]); }
    finally { setLoading(false); }
  }, [search, statusFilter, dateFrom, dateTo]);

  useEffect(() => { load(1); }, [load]);

  const handlePrint = (d) => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>Delivery Note — ${d.dispatchNumber}</title>
    <style>body{font-family:Arial,sans-serif;padding:24px;font-size:12px}
    h2{margin-bottom:8px}table{width:100%;border-collapse:collapse}
    th{background:#f5f5f5;padding:6px;border-bottom:2px solid #ddd;text-align:left}
    td{padding:5px 6px;border-bottom:1px solid #eee}
    .meta{display:flex;gap:24px;margin-bottom:16px;flex-wrap:wrap}
    .meta div{font-size:12px}</style></head>
    <body>
    <h2>Delivery Note — ${d.dispatchNumber}</h2>
    <div class="meta">
      <div><b>Driver:</b> ${d.driverName || '—'}</div>
      <div><b>Vehicle:</b> ${d.vehicle || '—'}</div>
      <div><b>Departed:</b> ${d.departureTime ? new Date(d.departureTime).toLocaleString('en-IN') : '—'}</div>
      <div><b>Total Orders:</b> ${d.totalOrders || 0}</div>
      <div><b>Status:</b> ${d.status}</div>
    </div>
    <p style="margin-top:32px;font-size:11px;color:#666">Generated: ${new Date().toLocaleString('en-IN')}</p>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  // Summary stats from loaded data
  const completedCount = dispatches.filter(d => d.status === 'completed').length;
  const totalOrders = dispatches.reduce((s, d) => s + (d.totalOrders || 0), 0);

  const columns = [
    { title: 'Dispatch No.', dataIndex: 'dispatchNumber', width: 130, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Driver / Vehicle', key: 'drv',
      render: (_, r) => (
        <div>
          <div className="font-medium">{r.driverName || '—'}</div>
          <div className="text-xs text-gray-400">{r.vehicle || 'No vehicle'}</div>
        </div>
      ),
    },
    { title: 'Orders', dataIndex: 'totalOrders', width: 80, render: v => <Tag color="blue">{v || 0}</Tag> },
    {
      title: 'Status', dataIndex: 'status', width: 120,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v?.replace(/_/g, ' ')}</Tag>,
    },
    {
      title: 'Departed', dataIndex: 'departureTime', width: 120,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
    {
      title: 'Route', key: 'route', width: 100,
      render: (_, r) => r.route?.name || '—',
    },
    {
      title: 'Actions', width: 120,
      render: (_, r) => (
        <Space size="small">
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewDispatch(r)}>View</Button>
          <Button size="small" icon={<PrinterOutlined />} onClick={() => handlePrint(r)} />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Delivery History</h1>
          <p className="text-sm text-gray-500 mt-0.5">Past deliveries — search, filter and print delivery notes</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Deliveries Shown', dispatches.length, '#1890ff'],
          ['Completed', completedCount, '#52c41a'],
          ['Total Orders', totalOrders, '#FF5F03'],
        ].map(([t, v, c]) => (
          <Col span={8} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <Input placeholder="Search by dispatch no. or driver…"
            prefix={<SearchOutlined />} value={search}
            onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select value={statusFilter} onChange={setStatusFilter} className="w-52"
            options={[
              { value: undefined, label: 'All Status' },
              ...Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
            ]} />
          <div>
            <label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-36" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-36" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={dispatches} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          locale={{ emptyText: 'No delivery records found.' }}
        />
      </div>

      {/* View Modal */}
      <Modal
        title={<span className="font-bold">{viewDispatch?.dispatchNumber}</span>}
        open={!!viewDispatch} onCancel={() => setViewDispatch(null)}
        footer={[
          <Button key="p" icon={<PrinterOutlined />} onClick={() => handlePrint(viewDispatch)}>Print</Button>,
          <Button key="c" onClick={() => setViewDispatch(null)}>Close</Button>,
        ]}
        width={540}
      >
        {viewDispatch && (
          <div className="space-y-2 text-sm">
            {[
              ['Status', <Tag color={STATUS_COLORS[viewDispatch.status]} className="capitalize">{viewDispatch.status?.replace(/_/g, ' ')}</Tag>],
              ['Driver', viewDispatch.driverName || '—'],
              ['Vehicle', viewDispatch.vehicle || '—'],
              ['Phone', viewDispatch.driverPhone || '—'],
              ['Orders', viewDispatch.totalOrders || 0],
              ['Route', viewDispatch.route?.name || '—'],
              ['Departed', viewDispatch.departureTime ? new Date(viewDispatch.departureTime).toLocaleString('en-IN') : '—'],
              ['Remarks', viewDispatch.remarks || '—'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-2 items-start"><span className="text-gray-400 min-w-28">{k}:</span><span className="font-medium">{v}</span></div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DeliveryHistory;
