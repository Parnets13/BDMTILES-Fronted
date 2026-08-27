import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, message, Row, Col, Card, Statistic, Space, Tag } from 'antd';
import { SearchOutlined, ReloadOutlined, PrinterOutlined, ClockCircleOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const now = new Date();

const OvertimeCalculation = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [otLines, setOtLines] = useState([]);

  useEffect(() => {
    Promise.all([hrmsService.getAllActiveEmployees(), hrmsService.getSettings()])
      .then(([employeeResponse, settingsResponse]) => {
        if (employeeResponse.success) setEmployees(employeeResponse.data || []);
        if (settingsResponse.success) setSettings(settingsResponse.data);
      }).catch(() => {});
  }, []);

  const computeOT = useCallback(async () => {
    if (!employees.length || !settings) return;
    setLoading(true);
    try {
      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const dateTo = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
      const response = await hrmsService.getAttendance({ dateFrom, dateTo, limit: 5000 });
      const attendance = response.success ? (response.data || []) : [];
      const dailyThreshold = Number(settings.overtimeAfterHours ?? 9);
      const rateMultiplier = Number(settings.overtimeRateMultiplier ?? 1.5);
      const overtimeEnabled = settings.overtimeEnabled ?? true;

      setOtLines(employees.map(employee => {
        const employeeAttendance = attendance.filter(record =>
          (record.employee?._id || record.employee) === employee._id
        );
        const workedHours = employeeAttendance.reduce((sum, record) => sum + (Number(record.totalHours) || 0), 0);
        const overtimeHours = overtimeEnabled
          ? employeeAttendance.reduce((sum, record) => sum + Math.max(0, (Number(record.totalHours) || 0) - dailyThreshold), 0)
          : 0;
        return {
          employeeId: employee._id,
          empCode: employee.empId || '',
          name: employee.name,
          department: employee.department || '—',
          attendanceDays: employeeAttendance.length,
          workedHours: Math.round(workedHours * 100) / 100,
          overtimeHours: Math.round(overtimeHours * 100) / 100,
          weightedOvertimeHours: Math.round(overtimeHours * rateMultiplier * 100) / 100,
        };
      }));
    } catch (err) { message.error(err.message || 'Failed to calculate overtime preview'); }
    finally { setLoading(false); }
  }, [employees, month, year, settings]);

  useEffect(() => { computeOT(); }, [computeOT]);

  const displayLines = otLines.filter(line => !search ||
    line.name.toLowerCase().includes(search.toLowerCase()) ||
    line.department.toLowerCase().includes(search.toLowerCase()) ||
    line.empCode.toLowerCase().includes(search.toLowerCase())
  );
  const totalOvertimeHours = displayLines.reduce((sum, line) => sum + line.overtimeHours, 0);
  const totalWeightedHours = displayLines.reduce((sum, line) => sum + line.weightedOvertimeHours, 0);
  const employeesWithOT = displayLines.filter(line => line.overtimeHours > 0).length;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<html><head><title>OT Preview — ${MONTHS[month - 1]} ${year}</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;font-size:11px}h2{margin-bottom:4px}p{color:#666;margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#f5f5f5;padding:5px;border-bottom:2px solid #ccc;text-align:left}td{padding:4px 6px;border-bottom:1px solid #eee}.total{font-weight:bold;border-top:2px solid #333}</style>
      </head><body><h2>Overtime Hours Preview — ${MONTHS[month - 1]} ${year}</h2>
      <p>Preview only. Daily threshold: ${settings?.overtimeAfterHours ?? 9} hours; multiplier: ${settings?.overtimeRateMultiplier ?? 1.5}×. No payroll amount is calculated or posted.</p><table>
      <tr><th>Emp Code</th><th>Name</th><th>Dept</th><th>Attendance Days</th><th>Worked Hrs</th><th>OT Hrs</th><th>Weighted OT Hrs</th></tr>
      ${displayLines.filter(line => line.overtimeHours > 0).map(line => `<tr><td>${line.empCode}</td><td>${line.name}</td><td>${line.department}</td><td>${line.attendanceDays}</td><td>${line.workedHours}</td><td>${line.overtimeHours}</td><td>${line.weightedOvertimeHours}</td></tr>`).join('')}
      <tr class="total"><td colspan="5">Totals</td><td>${totalOvertimeHours.toFixed(2)}</td><td>${totalWeightedHours.toFixed(2)}</td></tr></table></body></html>`);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 400);
  };

  const columns = [
    {
      title: 'Employee', key: 'employee',
      render: (_, record) => <div><div className="font-semibold text-sm">{record.name}</div><div className="text-xs text-gray-400">{record.empCode} · {record.department}</div></div>,
    },
    { title: 'Attendance Days', dataIndex: 'attendanceDays', width: 120 },
    { title: 'Worked Hrs', dataIndex: 'workedHours', width: 105 },
    { title: 'Daily Threshold', width: 115, render: () => `${settings?.overtimeAfterHours ?? 9}h` },
    { title: 'OT Hours', dataIndex: 'overtimeHours', width: 100,
      render: value => <span className={value > 0 ? 'text-orange-600 font-semibold' : 'text-gray-400'}>{value}</span> },
    { title: 'Multiplier', width: 90, render: () => `${settings?.overtimeRateMultiplier ?? 1.5}×` },
    { title: 'Weighted OT Hrs', dataIndex: 'weightedOvertimeHours', width: 125,
      render: value => <span className={value > 0 ? 'font-semibold text-orange-600' : 'text-gray-400'}>{value}</span> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClockCircleOutlined className="text-orange-500 text-xl" />Overtime Calculation Preview
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Daily attendance-based hours preview only; no overtime is posted to payroll</p>
        </div>
        <Space>
          <Tag color="orange">Preview only</Tag>
          <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!otLines.length}>Print Preview</Button>
        </Space>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div><label className="text-xs text-gray-500 block mb-1">Month</label>
            <Select value={month} onChange={setMonth} className="w-36" options={MONTHS.map((name, index) => ({ value: index + 1, label: name }))} /></div>
          <div><label className="text-xs text-gray-500 block mb-1">Year</label>
            <Select value={year} onChange={setYear} className="w-28" options={[year - 1, year, year + 1].map(value => ({ value, label: String(value) }))} /></div>
          <Button onClick={computeOT} loading={loading} icon={<ReloadOutlined />}>Recalculate</Button>
          <div className="ml-4"><label className="text-xs text-gray-500 block mb-1">Search</label>
            <Input placeholder="Employee name, ID or dept..." prefix={<SearchOutlined />} value={search} onChange={event => setSearch(event.target.value)} className="w-56" /></div>
        </div>
      </div>

      <Row gutter={16} className="mb-4">
        {[
          ['Active Employees', employees.length, '#1890ff'],
          ['With Preview OT', employeesWithOT, '#d97706'],
          ['Total OT Hours', totalOvertimeHours.toFixed(2), '#FF5F03'],
          ['Weighted OT Hours', totalWeightedHours.toFixed(2), '#722ed1'],
        ].map(([title, value, color]) => (
          <Col span={6} key={title}><Card size="small" style={{ borderLeft: `4px solid ${color}` }}>
            <Statistic title={title} value={value} valueStyle={{ color }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 text-sm text-gray-500">
          OT is calculated per attendance day as max(0, total hours − daily threshold). Weighted hours apply the configured multiplier; no salary amount is calculated or saved.
        </div>
        <Table columns={columns} dataSource={displayLines} rowKey="employeeId" loading={loading} size="small"
          pagination={{ pageSize: 30 }} rowClassName={record => record.overtimeHours > 0 ? 'bg-orange-50' : ''}
          locale={{ emptyText: 'No active employees or attendance records found.' }} />
      </div>
    </div>
  );
};

export default OvertimeCalculation;
