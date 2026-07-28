import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Input, Table, Divider, message } from 'antd';
import { SearchOutlined, PrinterOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const COLORS = ['#FF5F03', '#1890ff', '#52c41a', '#fa8c16', '#722ed1'];

const GSTReports = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0].slice(0, 7),
    dateTo: new Date().toISOString().split('T')[0].slice(0, 7),
  });

  const generate = async () => {
    setLoading(true);
    try {
      const params = {
        dateFrom: filters.dateFrom + '-01',
        dateTo: filters.dateTo + '-31',
      };
      const res = await reportService.getGSTReport(params);
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const el = document.getElementById('gst-print');
    if (!el) return;
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>GST Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
    table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:7px;text-align:left;border-bottom:2px solid #ddd}
    td{padding:6px 8px;border-bottom:1px solid #eee}.total{font-weight:bold;background:#fff3e0}
    @media print{body{padding:0}}</style></head><body>${el.innerHTML}</body></html>`);
    w.document.close(); setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const cols = [
    { title: 'GST Rate', dataIndex: '_id', width: 90, render: v => <span className="font-bold">{v}%</span> },
    { title: 'Taxable Amount', dataIndex: 'taxableAmount', render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'CGST', dataIndex: 'cgst', render: v => `₹${(v||0).toFixed(2)}` },
    { title: 'SGST', dataIndex: 'sgst', render: v => `₹${(v||0).toFixed(2)}` },
    { title: 'Total GST', dataIndex: 'totalGst', render: v => <span className="font-semibold text-blue-700">₹{(v||0).toFixed(2)}</span> },
    { title: 'Invoice Count', dataIndex: 'invoiceCount', width: 110 },
  ];

  const pieData = data?.gstByRate?.map(r => ({
    name: `${r._id}% GST`,
    value: r.taxableAmount || 0,
  })) || [];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">GST Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">GSTR-1 / GSTR-3B style tax summary</p>
        </div>
        {data && <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-xs text-gray-500 block mb-1">From Month</label>
            <Input type="month" value={filters.dateFrom} onChange={e => setFilters(f => ({...f, dateFrom: e.target.value}))} className="w-36" /></div>
          <div><label className="text-xs text-gray-500 block mb-1">To Month</label>
            <Input type="month" value={filters.dateTo} onChange={e => setFilters(f => ({...f, dateTo: e.target.value}))} className="w-36" /></div>
          <Button type="primary" onClick={generate} loading={loading} icon={<SearchOutlined />}>Generate</Button>
        </div>
      </div>

      {data && (
        <div id="gst-print">
          {/* Totals banner */}
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
            <Row gutter={16}>
              {[
                ['Total Taxable', `₹${(data.totals?.taxableAmount||0).toLocaleString()}`],
                ['Total CGST', `₹${(data.totals?.cgst||0).toFixed(2)}`],
                ['Total SGST', `₹${(data.totals?.sgst||0).toFixed(2)}`],
                ['Total GST', `₹${(data.totals?.totalGst||0).toFixed(2)}`],
              ].map(([t, v]) => (
                <Col span={6} key={t}>
                  <div className="text-xs text-gray-500">{t}</div>
                  <div className="text-lg font-bold text-orange-700">{v}</div>
                </Col>
              ))}
            </Row>
          </div>

          <Row gutter={16}>
            <Col span={14}>
              <Card title="GST Summary by Rate" size="small">
                <Table columns={cols} dataSource={data.gstByRate||[]} rowKey="_id"
                  size="small" pagination={false}
                  summary={() => (
                    <Table.Summary>
                      <Table.Summary.Row className="bg-orange-50 font-bold">
                        <Table.Summary.Cell index={0}><strong>Total</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={1}><strong>₹{(data.totals?.taxableAmount||0).toLocaleString()}</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={2}><strong>₹{(data.totals?.cgst||0).toFixed(2)}</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={3}><strong>₹{(data.totals?.sgst||0).toFixed(2)}</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={4}><strong className="text-blue-700">₹{(data.totals?.totalGst||0).toFixed(2)}</strong></Table.Summary.Cell>
                        <Table.Summary.Cell index={5} />
                      </Table.Summary.Row>
                    </Table.Summary>
                  )} />
              </Card>
            </Col>
            <Col span={10}>
              <Card title="Distribution by GST Rate" size="small">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={90}
                      dataKey="value" nameKey="name" label={({name, percent}) => `${name} ${(percent*100).toFixed(0)}%`}
                      labelLine={false}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Taxable']} />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
          </Row>
        </div>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <p>Select month range and click "Generate"</p>
        </div>
      )}
    </div>
  );
};

export default GSTReports;
