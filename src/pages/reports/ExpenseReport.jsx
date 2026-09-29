import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Select, Table, Tag, message } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const titleCase = (value = '') => String(value).replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

const STATUS_COLORS = {
  pending: 'orange', approved: 'green', reimbursed: 'blue', rejected: 'red', cancelled: 'default',
};
const STATUS_OPTIONS = ['pending', 'approved', 'rejected', 'reimbursed', 'cancelled'];
const CATEGORY_OPTIONS = [
  'travel', 'fuel', 'phone', 'lodging', 'food', 'office', 'loading', 'unloading',
  'vehicle_repair', 'warehouse', 'marketing', 'staff_welfare', 'courier', 'misc',
];

const ExpenseReport = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    status: undefined,
    category: undefined,
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getExpenseReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const summary = data?.summary || {};
  const byCategory = data?.byCategory || [];
  const byStatus = data?.byStatus || [];
  const byDepartment = data?.byDepartment || [];
  const byEmployee = data?.byEmployee || [];

  const shareColumn = (total) => ({
    title: 'Share', key: 'share', width: 80, align: 'right',
    render: (_, row) => <span className="text-gray-500">{total > 0 ? Math.round((row.total / total) * 100) : 0}%</span>,
  });

  const chartData = byCategory.slice(0, 10).map(row => ({
    name: titleCase(row._id),
    total: row.total || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Expense Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Expense claims by category, status, department and claimant</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={generate} loading={loading}>Refresh</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(c => ({ ...c, dateFrom: e.target.value }))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(c => ({ ...c, dateTo: e.target.value }))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Status</label>
            <Select allowClear placeholder="All" value={filters.status} className="w-36"
              onChange={v => setFilters(c => ({ ...c, status: v }))}
              options={STATUS_OPTIONS.map(v => ({ value: v, label: titleCase(v) }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Category</label>
            <Select allowClear placeholder="All" value={filters.category} className="w-44" showSearch
              onChange={v => setFilters(c => ({ ...c, category: v }))}
              options={CATEGORY_OPTIONS.map(v => ({ value: v, label: titleCase(v) }))} /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          “Approved” includes reimbursed claims; rejected and cancelled claims are excluded from it.
        </p>
      </div>

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Claimed', money(summary.total), '#1890ff'],
              ['Claims', Number(summary.claims || 0).toLocaleString('en-IN'), '#2f54eb'],
              ['Approved', money(summary.approved), '#52c41a'],
              ['Pending', money(summary.pending), '#d46b08'],
              ['Reimbursed', money(summary.reimbursed), '#13c2c2'],
              ['Rejected', money(summary.rejected), '#cf1322'],
            ].map(([title, value, color]) => (
              <Col xs={12} md={8} lg={4} key={title}>
                <Card size="small"><Statistic title={title} value={value} valueStyle={{ color, fontSize: 16 }} /></Card>
              </Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Spend by Category">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 50 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [money(v), 'Spend']} />
                  <Bar dataKey="total" fill="#FF5F03" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Row gutter={16}>
            <Col xs={24} lg={12}>
              <Card size="small" title="By Category" className="mb-4">
                <Table size="small" pagination={false} rowKey={row => String(row._id)} dataSource={byCategory}
                  locale={{ emptyText: 'No claims in this period' }}
                  columns={[
                    { title: 'Category', dataIndex: '_id', render: v => titleCase(v) },
                    { title: 'Claims', dataIndex: 'count', width: 80, align: 'right' },
                    { title: 'Amount', dataIndex: 'total', align: 'right', render: v => <span className="font-medium">{money(v)}</span> },
                    shareColumn(summary.total),
                  ]} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title="By Status" className="mb-4">
                <Table size="small" pagination={false} rowKey={row => String(row._id)} dataSource={byStatus}
                  locale={{ emptyText: 'No claims in this period' }}
                  columns={[
                    { title: 'Status', dataIndex: '_id',
                      render: v => <Tag color={STATUS_COLORS[v] || 'default'}>{titleCase(v)}</Tag> },
                    { title: 'Claims', dataIndex: 'count', width: 80, align: 'right' },
                    { title: 'Amount', dataIndex: 'total', align: 'right', render: v => <span className="font-medium">{money(v)}</span> },
                    shareColumn(summary.total),
                  ]} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title="By Department" className="mb-4">
                <Table size="small" pagination={false} rowKey={row => String(row._id)} dataSource={byDepartment}
                  locale={{ emptyText: 'No claims in this period' }}
                  columns={[
                    { title: 'Department', dataIndex: '_id', render: v => titleCase(v) },
                    { title: 'Claims', dataIndex: 'count', width: 80, align: 'right' },
                    { title: 'Amount', dataIndex: 'total', align: 'right', render: v => <span className="font-medium">{money(v)}</span> },
                  ]} />
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card size="small" title="Top Claimants" className="mb-4">
                <Table size="small" pagination={false} rowKey={row => String(row._id)} dataSource={byEmployee}
                  locale={{ emptyText: 'No claims in this period' }}
                  columns={[
                    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
                    { title: 'Employee', dataIndex: 'employeeName', render: v => <span className="font-medium">{v || '—'}</span> },
                    { title: 'Claims', dataIndex: 'count', width: 80, align: 'right' },
                    { title: 'Amount', dataIndex: 'total', align: 'right', render: v => <span className="font-semibold">{money(v)}</span> },
                  ]} />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {data === null && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          Set filters and click “Generate”
        </div>
      )}
    </div>
  );
};

export default ExpenseReport;
