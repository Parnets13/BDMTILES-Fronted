import { useState } from 'react';
import { Row, Col, Card, Statistic, Button, Table, Tag, message } from 'antd';
import { ReloadOutlined, PrinterOutlined, WarningOutlined } from '@ant-design/icons';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const AgingReport = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportService.getAgingReport();
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    const rows = (data?.buckets || []).map(b => `
      <tr style="${b.overCreditLimit ? 'background:#fff1f0' : ''}">
        <td>${b.dealerCode}</td><td>${b.dealerName}</td><td>${b.city||'—'}</td>
        <td>₹${(b.creditLimit||0).toLocaleString()}</td>
        <td>${b.creditDays||0} days</td>
        <td style="font-weight:bold;color:#f5222d">₹${(b.outstanding||0).toLocaleString()}</td>
        <td>${b.overCreditLimit ? '⚠ Yes' : 'No'}</td>
      </tr>`).join('');
    w.document.write(`<html><head><title>Aging Report</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:12px}
    table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:7px;text-align:left;border-bottom:2px solid #ddd}
    td{padding:6px 8px;border-bottom:1px solid #eee}@media print{body{padding:0}}</style></head>
    <body><h2>Dealer Aging Report</h2>
    <table><thead><tr><th>Code</th><th>Dealer</th><th>City</th><th>Credit Limit</th><th>Credit Days</th><th>Outstanding</th><th>Over Limit</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <p style="margin-top:16px;font-weight:bold">Total Outstanding: ₹${(data?.summary?.totalOutstanding||0).toLocaleString()}</p>
    </body></html>`);
    w.document.close(); setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const cols = [
    { title: 'Dealer Code', dataIndex: 'dealerCode', width: 110, render: v => <span className="font-mono text-xs text-blue-600">{v}</span> },
    { title: 'Dealer Name', dataIndex: 'dealerName', render: v => <span className="font-medium">{v}</span> },
    { title: 'City', dataIndex: 'city', width: 110, render: v => v || '—' },
    { title: 'Credit Limit', dataIndex: 'creditLimit', width: 120, render: v => `₹${(v||0).toLocaleString()}` },
    { title: 'Credit Days', dataIndex: 'creditDays', width: 95, render: v => v ? `${v}d` : '—' },
    { title: 'Outstanding', dataIndex: 'outstanding', width: 130,
      render: v => <span className="font-semibold text-red-600">₹{(v||0).toLocaleString()}</span>,
      sorter: (a, b) => a.outstanding - b.outstanding, defaultSortOrder: 'descend' },
    { title: 'Over Limit?', dataIndex: 'overCreditLimit', width: 100,
      render: v => v ? <Tag color="red" icon={<WarningOutlined />}>Yes</Tag> : <Tag color="green">No</Tag> },
  ];

  const chartData = (data?.buckets || []).slice(0, 15).map(b => ({
    name: b.dealerName?.split(' ')[0] || b.dealerCode,
    outstanding: b.outstanding || 0,
  }));

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Aging Report</h1>
          <p className="text-sm text-gray-500 mt-0.5">Outstanding receivables from dealers</p>
        </div>
        <div className="flex gap-2">
          {data && <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print</Button>}
          <Button type="primary" icon={<ReloadOutlined />} onClick={load} loading={loading}>Load Report</Button>
        </div>
      </div>

      {data && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Dealers with Outstanding', data.summary?.totalDealers || 0, '#fa8c16'],
              ['Total Outstanding', `₹${(data.summary?.totalOutstanding||0).toLocaleString()}`, '#f5222d'],
              ['Over Credit Limit', data.summary?.overLimit || 0, '#a8071a'],
            ].map(([t, v, c]) => (
              <Col span={8} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          {chartData.length > 0 && (
            <Card className="mb-4" title="Top Dealers by Outstanding (₹)">
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{top:5,right:20,left:10,bottom:60}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{fontSize:10}} angle={-30} textAnchor="end" interval={0} />
                  <YAxis tick={{fontSize:11}} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                  <Tooltip formatter={v => [`₹${Number(v).toLocaleString()}`, 'Outstanding']} />
                  <Bar dataKey="outstanding" fill="#f5222d" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          <div className="bg-white rounded-lg border border-gray-200">
            <Table columns={cols} dataSource={data.buckets||[]} rowKey="dealerCode"
              size="middle" scroll={{ x: 900 }}
              rowClassName={r => r.overCreditLimit ? 'bg-red-50' : ''}
              pagination={{ pageSize: 25, showTotal: t => `${t} dealers` }} />
          </div>
        </>
      )}

      {!data && !loading && (
        <div className="bg-white rounded-lg border border-gray-200 py-20 text-center text-gray-400">
          <p>Click "Load Report" to view dealer aging data</p>
        </div>
      )}
    </div>
  );
};

export default AgingReport;
