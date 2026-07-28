import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Select, InputNumber, Table, Tag, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const InventoryReports = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [filters, setFilters] = useState({ warehouse: undefined, lowStock: 10 });

  useEffect(() => {
    masterService.getWarehouses({ limit: 100 }).then(r => { if (r.success) setWarehouses(r.data); }).catch(() => {});
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getInventoryReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const lowStockCols = [
    { title: 'Product Code', dataIndex: ['product','productCode'], width: 120, render: (v, r) => <span className="font-mono text-xs text-blue-600">{v || r.product?.productCode}</span> },
    { title: 'Product Name', dataIndex: ['product','itemName'], render: (v, r) => r.product?.itemName || '—' },
    { title: 'Size', dataIndex: ['product','tileSize'], width: 90, render: (v, r) => r.product?.tileSize || '—' },
    { title: 'Warehouse', dataIndex: ['warehouse','name'], width: 130, render: (v, r) => r.warehouse?.name || '—' },
    { title: 'Shade', dataIndex: 'shade', width: 70, render: v => v || '—' },
    { title: 'Available Qty', dataIndex: 'availableQty', width: 100,
      render: v => <span className={`font-semibold text-sm ${v <= 5 ? 'text-red-600' : v <= filters.lowStock ? 'text-orange-500' : 'text-gray-700'}`}>{v}</span> },
  ];

  const agingCols = [
    { title: 'Product', dataIndex: ['product','itemName'], render: (v, r) => r.product?.itemName || '—' },
    { title: 'Code', dataIndex: ['product','productCode'], width: 110, render: (v, r) => <span className="font-mono text-xs">{r.product?.productCode}</span> },
    { title: 'Warehouse', dataIndex: ['warehouse','name'], width: 130, render: (v, r) => r.warehouse?.name || '—' },
    { title: 'Qty', dataIndex: 'availableQty', width: 80 },
    { title: 'Last GRN', dataIndex: 'lastGRNDate', width: 110, render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—' },
    { title: 'Days Idle', key: 'idle', width: 90, render: (_, r) => {
      if (!r.lastGRNDate) return '—';
      const days = Math.floor((Date.now() - new Date(r.lastGRNDate)) / (1000 * 60 * 60 * 24));
      return <Tag color={days > 180 ? 'red' : days > 90 ? 'orange' : 'default'}>{days}d</Tag>;
    }},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Inventory Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Stock levels, aging, and low-stock alerts</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">Warehouse</label>
            <Select placeholder="All warehouses" allowClear value={filters.warehouse || undefined}
              onChange={v => setFilters(f => ({...f, warehouse: v}))} className="w-48"
              options={warehouses.map(w => ({ value: w._id, label: w.name }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Low Stock Threshold</label>
            <InputNumber min={1} max={1000} value={filters.lowStock}
              onChange={v => setFilters(f => ({...f, lowStock: v || 10}))} className="w-32" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Qty', (data.summary?.totalQty||0).toLocaleString(), '#1890ff'],
              ['Total Value', `₹${(data.summary?.totalValue||0).toLocaleString()}`, '#722ed1'],
              ['Damaged Qty', data.summary?.damagedQty || 0, '#f5222d'],
              ['Unique SKUs', data.summary?.uniqueProducts || 0, '#52c41a'],
            ].map(([t, v, c]) => (
              <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          {data.byWarehouse?.length > 0 && (
            <Card className="mb-4" title="Stock by Warehouse">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={data.byWarehouse} layout="vertical" margin={{top:5,right:30,left:80,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{fontSize:11}} />
                  <YAxis type="category" dataKey="_id" tick={{fontSize:11}} width={80} />
                  <Tooltip formatter={v => [v, 'Qty']} />
                  <Bar dataKey="totalQty" fill="#1890ff" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <Row gutter={16}>
            <Col span={12}>
              <Card title={<span className="text-orange-600">⚠ Low Stock Alerts ({data.lowStockItems?.length || 0})</span>} size="small">
                <Table columns={lowStockCols} dataSource={data.lowStockItems||[]} rowKey="_id"
                  size="small" pagination={{ pageSize: 10 }} scroll={{ x: 700 }} />
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Stock Aging (90+ days idle)" size="small">
                <Table columns={agingCols} dataSource={data.stockAging||[]} rowKey="_id"
                  size="small" pagination={{ pageSize: 10 }} scroll={{ x: 700 }} />
              </Card>
            </Col>
          </Row>
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <p>Click "Generate" to view inventory data</p>
        </div>
      )}
    </div>
  );
};

export default InventoryReports;
