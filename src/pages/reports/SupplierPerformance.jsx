import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const dateText = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');

const SupplierPerformance = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
  });

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getSupplierPerformance(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const suppliers = data || [];
  const totalPurchase = suppliers.reduce((sum, row) => sum + (row.poValue || 0), 0);
  const totalPayable = suppliers.reduce((sum, row) => sum + (row.payable || 0), 0);
  const totalPos = suppliers.reduce((sum, row) => sum + (row.poCount || 0), 0);

  const columns = [
    { title: '#', render: (_, __, i) => <span className="text-gray-400">{i + 1}</span>, width: 40 },
    { title: 'Supplier', dataIndex: 'supplierName', render: (value, row) => (
      <div>
        <div className="font-medium">{value || '—'}</div>
        {row.supplierCode ? <div className="text-[10px] font-mono text-gray-400">{row.supplierCode}</div> : null}
      </div>
    ) },
    { title: 'POs', dataIndex: 'poCount', width: 70 },
    { title: 'Purchase Value', dataIndex: 'poValue', width: 140,
      sorter: (a, b) => a.poValue - b.poValue, defaultSortOrder: 'descend',
      render: value => <span className="font-semibold">{money(value)}</span> },
    { title: 'Avg PO', dataIndex: 'avgPoValue', width: 120, render: value => money(Math.round(value || 0)) },
    { title: 'GRNs', dataIndex: 'grnCount', width: 70 },
    { title: 'Fulfilment', dataIndex: 'fulfilmentRate', width: 110,
      render: (value, row) => {
        if (value === null) return <span className="text-gray-400">—</span>;
        const tone = value >= 80 ? 'text-green-600' : value >= 50 ? 'text-orange-500' : 'text-red-600';
        return (
          <span className={`font-medium ${tone}`}>
            {value}%
            {row.partialPos ? <span className="ml-1 text-[10px] text-gray-400">({row.partialPos} partial)</span> : null}
          </span>
        );
      } },
    { title: 'Payable', dataIndex: 'payable', width: 130,
      render: value => <span className={(value || 0) > 0 ? 'font-medium text-red-600' : 'text-gray-400'}>{money(value)}</span> },
    { title: 'Last GRN', dataIndex: 'lastGrnDate', width: 110, render: dateText },
  ];

  const chartData = suppliers.slice(0, 10).map(row => ({
    name: (row.supplierName || '—').split(' ')[0],
    poValue: row.poValue || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Supplier Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Purchase volume, receipt reliability and outstanding payable by supplier</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(c => ({ ...c, dateFrom: e.target.value }))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(c => ({ ...c, dateTo: e.target.value }))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
        <p className="text-[11px] text-gray-400 mt-2">
          Payable is the full ledger balance for the supplier and is not limited by the date range above.
        </p>
      </div>

      {data !== null && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Suppliers', suppliers.length, '#1890ff'],
              ['Purchase Value', money(totalPurchase), '#FF5F03'],
              ['Purchase Orders', totalPos, '#52c41a'],
              ['Total Payable', money(totalPayable), '#cf1322'],
            ].map(([title, value, color]) => (
              <Col xs={12} md={6} key={title}><Card size="small"><Statistic title={title} value={value} valueStyle={{ color, fontSize: 18 }} /></Card></Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Top 10 Suppliers by Purchase Value">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [money(v), 'Purchase']} />
                  <Bar dataKey="poValue" fill="#FF5F03" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={columns} dataSource={suppliers} rowKey="_id" size="middle" scroll={{ x: 1000 }}
              locale={{ emptyText: 'No supplier activity in this period' }}
              pagination={{ pageSize: 20, showTotal: total => `${total} suppliers` }} />
          </div>
        </>
      )}

      {data === null && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          Set a date range and click “Generate”
        </div>
      )}
    </div>
  );
};

export default SupplierPerformance;
