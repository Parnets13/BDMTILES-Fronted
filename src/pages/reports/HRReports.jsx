import { useState, useEffect } from 'react';
import { Row, Col, Card, Statistic, Button, Table, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import reportService from '../../services/reportService.js';

const COLORS = ['#FF5F03','#1890ff','#52c41a','#fa8c16','#722ed1','#13c2c2','#f5222d','#eb2f96'];

const HRReports = () => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await reportService.getHRReport();
      if (res.success) setData(res.data);
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const deptCols = [
    { title: 'Department', dataIndex: '_id', render: v => <span className="font-medium">{v || 'Unassigned'}</span> },
    { title: 'Employees', dataIndex: 'count', width: 120 },
    { title: '% of Total', key: 'pct', width: 100, render: (_, r) => data?.totalEmployees
      ? `${((r.count / data.totalEmployees) * 100).toFixed(1)}%` : '—' },
  ];

  const pieData = (data?.byDept || []).map(d => ({ name: d._id || 'Unassigned', value: d.count }));

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">HR Reports</h1>
          <p className="text-sm text-gray-500 mt-0.5">Employee statistics and attendance summary</p>
        </div>
        <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
      </div>

      {data && (
        <>
          <Row gutter={16} className="mb-4">
            {[
              ['Total Employees', data.totalEmployees || 0, '#1890ff'],
              ['Active Employees', data.activeEmployees || 0, '#52c41a'],
              ['Pending Leaves', data.pendingLeaves || 0, '#fa8c16'],
              ['Departments', data.byDept?.length || 0, '#722ed1'],
            ].map(([t, v, c]) => (
              <Col span={6} key={t}><Card size="small"><Statistic title={t} value={v} valueStyle={{color:c}} /></Card></Col>
            ))}
          </Row>

          <Row gutter={16}>
            <Col span={10}>
              <Card title="Employees by Department (Distribution)" size="small">
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={100}
                      dataKey="value" nameKey="name">
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </Col>
            <Col span={14}>
              <Card title="Department-wise Headcount" size="small">
                <Table columns={deptCols} dataSource={data.byDept || []} rowKey="_id"
                  size="small" pagination={false} />
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  );
};

export default HRReports;
