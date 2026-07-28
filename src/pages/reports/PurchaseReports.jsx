import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Select, Table, message } from 'antd';
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';
import masterService from '../../services/masterService.js';

const PurchaseReports = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    dateTo: new Date().toISOString().split('T')[0],
    supplier: undefined,
  });

  useEffect(() => {
    masterService.getSuppliers({ limit: 100 }).then(r => { if (r.success) setSuppliers(r.data); }).catch(() => {});
  }, []);

  const generate = async () => {
    setLoading(true);
    try {
      const res = await reportService.getPurchaseReport(filters);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const supplierCols = [
    { title: '#', render: (_, __, i) => i + 1, width: 40 },
    { title: 'Supplier', dataIndex: 'supplierName', render: v => v || '—' },
    { title: 'PO Count', dataIndex: 'count', width: 90 },
    { title: 'Total Amount', dataIndex: 'amount', width: 130, render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'Avg PO Value', key: 'avg', width: 120, render: (_, r) => r.count ? `₹${Math.round(r.amount / r.count).toLocaleString()}` : '—' },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Purchase Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">PO-wise and supplier-wise purchase analysis</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From Date</label>
            <Input type="date" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To Date</label>
            <Input type="date" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Supplier</label>
            <Select placeholder="All suppliers" allowClear value={filters.supplier || undefined}
              onChange={v => setFilters(f => ({...f, supplier: v}))} className="w-52"
              showSearch optionFilterProp="label"
              options={suppliers.map(s => ({ value: s._id, label: `${s.companyName} (${s.supplierCode})` }))} /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Purchase', `₹${(data.summary?.totalAmount||0).toLocaleString()}`, '#1890ff'],
              ['Total POs', data.summary?.totalPOs || 0, '#52c41a'],
              ['Pending Amount', `₹${(data.summary?.pendingAmount||0).toLocaleString()}`, '#fa8c16'],
            ].map(([t, v, c]) => (
              <Col span={8} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          <Card className="mb-4" title="Monthly Purchase Trend">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.byPeriod || []} margin={{top:10,right:20,left:10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="_id" tick={{fontSize:11}} />
                <YAxis tick={{fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Amount']} />
                <Bar dataKey="amount" fill="#1890ff" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card title="Top 10 Suppliers" size="small">
            <Table columns={supplierCols} dataSource={data.bySupplier||[]} rowKey="_id"
              size="small" pagination={false} />
          </Card>
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <p>Set filters and click "Generate" to view purchase data</p>
        </div>
      )}
    </div>
  );
};

export default PurchaseReports;
