import { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Statistic, Button, Table, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN')}`;
const qty = (value) => Number(value || 0).toLocaleString('en-IN');
const dateText = (value) => (value ? new Date(value).toLocaleDateString('en-IN') : '—');

const WarehousePerformance = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);

  // Stock is a point-in-time position rather than a period, so this report loads
  // immediately and offers a refresh instead of a date range.
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await reportService.getWarehousePerformance();
      if (res.success) setData(res.data || []);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const totalValue = data.reduce((sum, row) => sum + (row.stockValue || 0), 0);
  const totalAvailable = data.reduce((sum, row) => sum + (row.availableQty || 0), 0);
  const totalReserved = data.reduce((sum, row) => sum + (row.reservedQty || 0), 0);
  const totalDamaged = data.reduce((sum, row) => sum + (row.damagedQty || 0), 0);

  const columns = [
    { title: 'Warehouse', dataIndex: 'warehouseName', render: (value, row) => (
      <div>
        <div className="font-medium">{value || '—'}</div>
        {row.warehouseCode ? <div className="text-[10px] font-mono text-gray-400">{row.warehouseCode}</div> : null}
      </div>
    ) },
    { title: 'Products', dataIndex: 'productCount', width: 95 },
    { title: 'Available', dataIndex: 'availableQty', width: 110,
      sorter: (a, b) => a.availableQty - b.availableQty, render: qty },
    { title: 'Reserved', dataIndex: 'reservedQty', width: 100, render: qty },
    { title: 'Blocked', dataIndex: 'blockedQty', width: 100, render: qty },
    { title: 'Damaged', dataIndex: 'damagedQty', width: 100,
      render: value => <span className={(value || 0) > 0 ? 'text-orange-600' : 'text-gray-400'}>{qty(value)}</span> },
    { title: 'Stock Value', dataIndex: 'stockValue', width: 140,
      sorter: (a, b) => a.stockValue - b.stockValue, defaultSortOrder: 'descend',
      render: value => <span className="font-semibold">{money(value)}</span> },
    { title: 'Share', key: 'share', width: 85,
      render: (_, row) => {
        const pct = totalValue > 0 ? Math.round(((row.stockValue || 0) / totalValue) * 100) : 0;
        return <span className="text-gray-600">{pct}%</span>;
      } },
    { title: 'GRN Lines', dataIndex: 'grnLines', width: 105 },
    { title: 'Last Receipt', dataIndex: 'lastReceipt', width: 120, render: dateText },
    { title: 'Last Sale', dataIndex: 'lastSaleDate', width: 115, render: dateText },
  ];

  const chartData = data.slice(0, 10).map(row => ({
    name: row.warehouseCode || (row.warehouseName || '—').split(' ')[0],
    stockValue: row.stockValue || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Warehouse Performance</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock held, valuation and movement freshness per warehouse in the active branch</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      <Row gutter={16} className="mb-4">
        {[
          ['Warehouses', data.length, '#1890ff'],
          ['Stock Value', money(totalValue), '#FF5F03'],
          ['Available Units', qty(totalAvailable), '#52c41a'],
          ['Reserved Units', qty(totalReserved), '#2f54eb'],
          ['Damaged Units', qty(totalDamaged), '#d46b08'],
        ].map(([title, value, color]) => (
          <Col xs={12} md={8} lg={4} key={title}><Card size="small"><Statistic title={title} value={value} valueStyle={{ color, fontSize: 17 }} /></Card></Col>
        ))}
      </Row>

      {chartData.length > 0 && (
        <Card className="mb-4" title="Stock Value by Warehouse">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={v => [money(v), 'Stock Value']} />
              <Bar dataKey="stockValue" fill="#FF5F03" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={data} rowKey="_id" size="middle" loading={loading} scroll={{ x: 1250 }}
          locale={{ emptyText: 'No stock recorded for this branch' }}
          pagination={{ pageSize: 20, showTotal: total => `${total} warehouses` }} />
      </div>
    </div>
  );
};

export default WarehousePerformance;
