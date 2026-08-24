import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber
} from 'antd';
import { SearchOutlined, ReloadOutlined, SaveOutlined, PrinterOutlined, ClockCircleOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const now = new Date();

const OvertimeCalculation = () => {
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState(null);

  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');

  // OT lines: { employeeId, name, department, basicSalary, stdHours, workedHours, otHours, otRate, otAmount }
  const [otLines, setOtLines] = useState([]);
  const [overrides, setOverrides] = useState({}); // employeeId -> { otRate, otHours }

  const [saveLoading, setSaveLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Load employees + settings
  useEffect(() => {
    Promise.all([
      hrmsService.getEmployees({ limit: 200, status: 'active' }),
      hrmsService.getSettings(),
    ]).then(([empRes, setRes]) => {
      if (empRes.success) setEmployees(empRes.data || []);
      if (setRes.success) setSettings(setRes.data);
    }).catch(() => {});
  }, []);

  const computeOT = useCallback(async () => {
    if (!employees.length) return;
    setLoading(true);
    try {
      // Fetch attendance for the selected month
      const dateFrom = `${year}-${String(month).padStart(2, '0')}-01`;
      const lastDay  = new Date(year, month, 0).getDate();
      const dateTo   = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

      const attRes = await hrmsService.getAttendance({ dateFrom, dateTo, limit: 5000 });
      const attData = attRes.success ? (attRes.data || []) : [];

      // Standard working hours per day from settings (default 8)
      const stdHrsPerDay = settings?.workingHoursPerDay || 8;
      const workingDays  = settings?.workingDaysPerMonth || 26;
      const stdMonthHrs  = stdHrsPerDay * workingDays;

      // OT rate: settings or default (basic / std hrs * 1.5)
      const defaultOtMultiplier = settings?.otMultiplier || 1.5;

      const lines = employees.map(emp => {
        // Get all attendance records for this employee this month
        const empAtt = attData.filter(a =>
          (a.employee?._id || a.employee) === emp._id
        );

        // Sum working hours
        const totalWorked = empAtt.reduce((s, a) => s + (a.workingHours || 0), 0);
        const otHours     = Math.max(0, totalWorked - stdMonthHrs);

        const basicSalary = emp.salary || emp.basicSalary || 0;
        const hourlyRate  = basicSalary > 0 ? basicSalary / stdMonthHrs : 0;
        const otRate      = hourlyRate * defaultOtMultiplier;
        const otAmount    = Math.round(otRate * otHours);

        return {
          employeeId:   emp._id,
          empCode:      emp.empId || '',
          name:         emp.name,
          department:   emp.department || '—',
          basicSalary,
          stdHours:     stdMonthHrs,
          workedHours:  Math.round(totalWorked * 10) / 10,
          otHours:      Math.round(otHours * 10) / 10,
          otRate:       Math.round(otRate * 100) / 100,
          otAmount,
        };
      });

      setOtLines(lines);
      setOverrides({});
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setLoading(false); }
  }, [employees, month, year, settings]);

  useEffect(() => { if (employees.length) computeOT(); }, [computeOT]);

  const setOverride = (empId, field, value) => {
    setOverrides(prev => ({
      ...prev,
      [empId]: { ...(prev[empId] || {}), [field]: value },
    }));
  };

  const getEffectiveLine = (line) => {
    const ov = overrides[line.employeeId] || {};
    const otHours  = ov.otHours  !== undefined ? ov.otHours  : line.otHours;
    const otRate   = ov.otRate   !== undefined ? ov.otRate   : line.otRate;
    const otAmount = Math.round(otRate * otHours);
    return { ...line, otHours, otRate, otAmount };
  };

  const displayLines = otLines
    .map(getEffectiveLine)
    .filter(l => !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.department.toLowerCase().includes(search.toLowerCase())
    );

  const totalOT     = displayLines.reduce((s, l) => s + l.otAmount, 0);
  const employeesOT = displayLines.filter(l => l.otHours > 0).length;

  const handleSave = async () => {
    setSaveLoading(true);
    try {
      // Build payload to update salary slips with OT
      const otData = displayLines
        .filter(l => l.otHours > 0)
        .map(l => ({
          employee: l.employeeId,
          month, year,
          otHours:  l.otHours,
          otRate:   l.otRate,
          otAmount: l.otAmount,
        }));

      // Post each as a salary supplement (using existing generate endpoint)
      for (const item of otData) {
        await hrmsService.generateSalarySlip({
          employee: item.employee,
          month, year,
          otHours: item.otHours,
          otRate:  item.otRate,
          otAmount: item.otAmount,
          includeOT: true,
        });
      }
      message.success(`OT saved for ${otData.length} employee(s)`);
      setShowConfirm(false);
    } catch (err) { message.error(err.message || 'Save failed'); }
    finally { setSaveLoading(false); }
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`<html><head><title>OT Report — ${MONTHS[month-1]} ${year}</title>
    <style>body{font-family:Arial,sans-serif;padding:20px;font-size:11px}
    h2{margin-bottom:4px}p{color:#666;margin-bottom:12px}
    table{width:100%;border-collapse:collapse}
    th{background:#f5f5f5;padding:5px;border-bottom:2px solid #ccc;text-align:left}
    td{padding:4px 6px;border-bottom:1px solid #eee}
    .total{font-weight:bold;border-top:2px solid #333}
    </style></head><body>
    <h2>Overtime Report — ${MONTHS[month-1]} ${year}</h2>
    <table>
      <tr><th>Emp Code</th><th>Name</th><th>Dept</th><th>Basic</th><th>Worked Hrs</th><th>OT Hrs</th><th>OT Rate/hr</th><th>OT Amount</th></tr>
      ${displayLines.filter(l=>l.otHours>0).map(l=>`<tr>
        <td>${l.empCode}</td><td>${l.name}</td><td>${l.department}</td>
        <td>₹${l.basicSalary.toLocaleString()}</td><td>${l.workedHours}</td>
        <td>${l.otHours}</td><td>₹${l.otRate}</td><td>₹${l.otAmount.toLocaleString()}</td>
      </tr>`).join('')}
      <tr class="total"><td colspan="7">Total OT Payout</td><td>₹${totalOT.toLocaleString()}</td></tr>
    </table>
    </body></html>`);
    w.document.close();
    setTimeout(() => { w.print(); w.close(); }, 400);
  };

  const columns = [
    {
      title: 'Employee',
      key: 'emp',
      render: (_, r) => (
        <div>
          <div className="font-semibold text-sm">{r.name}</div>
          <div className="text-xs text-gray-400">{r.empCode} · {r.department}</div>
        </div>
      ),
    },
    {
      title: 'Basic Salary',
      dataIndex: 'basicSalary',
      width: 110,
      render: v => `₹${(v||0).toLocaleString()}`,
    },
    {
      title: 'Worked Hrs',
      dataIndex: 'workedHours',
      width: 100,
      render: (v, r) => (
        <span className={v > r.stdHours ? 'text-orange-600 font-semibold' : ''}>{v}</span>
      ),
    },
    {
      title: 'Std Hrs',
      dataIndex: 'stdHours',
      width: 80,
      render: v => <span className="text-gray-500">{v}</span>,
    },
    {
      title: 'OT Hours',
      key: 'otHours',
      width: 120,
      render: (_, r) => (
        <InputNumber
          value={overrides[r.employeeId]?.otHours ?? r.otHours}
          onChange={v => setOverride(r.employeeId, 'otHours', v ?? 0)}
          min={0}
          step={0.5}
          size="small"
          className="w-24"
          style={{ borderColor: (overrides[r.employeeId]?.otHours ?? r.otHours) > 0 ? '#d97706' : undefined }}
        />
      ),
    },
    {
      title: 'OT Rate (₹/hr)',
      key: 'otRate',
      width: 130,
      render: (_, r) => (
        <InputNumber
          value={overrides[r.employeeId]?.otRate ?? r.otRate}
          onChange={v => setOverride(r.employeeId, 'otRate', v ?? 0)}
          min={0}
          prefix="₹"
          size="small"
          className="w-28"
        />
      ),
    },
    {
      title: 'OT Amount (₹)',
      key: 'otAmount',
      width: 120,
      render: (_, r) => {
        const eff = getEffectiveLine(r);
        return (
          <span className={`font-bold ${eff.otAmount > 0 ? 'text-orange-600' : 'text-gray-400'}`}>
            ₹{eff.otAmount.toLocaleString()}
          </span>
        );
      },
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ClockCircleOutlined className="text-orange-500 text-xl" />
            Overtime Calculation
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auto-calculate OT from attendance — review and save to salary
          </p>
        </div>
        <Space>
          <Button icon={<PrinterOutlined />} onClick={handlePrint} disabled={!otLines.length}>
            Print
          </Button>
          <Button type="primary" icon={<SaveOutlined />}
            onClick={() => setShowConfirm(true)}
            disabled={employeesOT === 0}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            Save OT ({employeesOT})
          </Button>
        </Space>
      </div>

      {/* Period selector */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap items-end">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Month</label>
            <Select value={month} onChange={setMonth} className="w-36"
              options={MONTHS.map((m, i) => ({ value: i + 1, label: m }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Year</label>
            <Select value={year} onChange={setYear} className="w-28"
              options={[year - 1, year, year + 1].map(y => ({ value: y, label: String(y) }))} />
          </div>
          <Button onClick={computeOT} loading={loading} icon={<ReloadOutlined />}>
            Recalculate
          </Button>
          <div className="ml-4">
            <label className="text-xs text-gray-500 block mb-1">Search</label>
            <Input placeholder="Employee name or dept…" prefix={<SearchOutlined />}
              value={search} onChange={e => setSearch(e.target.value)} className="w-52" />
          </div>
        </div>
      </div>

      {/* Summary */}
      <Row gutter={16} className="mb-4">
        {[
          ['Total Employees', employees.length,  '#1890ff'],
          ['With OT',         employeesOT,        '#d97706'],
          ['Total OT Payout', `₹${totalOT.toLocaleString()}`, '#FF5F03'],
          ['Avg OT per emp',  employeesOT ? `₹${Math.round(totalOT / employeesOT).toLocaleString()}` : '₹0', '#722ed1'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-2 border-b border-gray-100 text-sm text-gray-500">
          OT hrs and rate are auto-calculated — you can override any value before saving
        </div>
        <Table
          columns={columns}
          dataSource={displayLines}
          rowKey="employeeId"
          loading={loading}
          size="small"
          pagination={{ pageSize: 30 }}
          rowClassName={r => getEffectiveLine(r).otHours > 0 ? 'bg-orange-50' : ''}
          locale={{ emptyText: 'No employees. Load employees and recalculate.' }}
        />
      </div>

      {/* Confirm modal */}
      <Modal
        title="Save Overtime to Salary"
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onOk={handleSave}
        okText={`Save OT for ${employeesOT} employees`}
        confirmLoading={saveLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Divider />
        <div className="space-y-2 text-sm">
          <p>This will add OT amounts to salary slips for <strong>{MONTHS[month-1]} {year}</strong>.</p>
          <div className="bg-orange-50 border border-orange-200 rounded p-3">
            <div className="font-semibold">{employeesOT} employees with OT</div>
            <div className="text-orange-700 font-bold text-lg">Total payout: ₹{totalOT.toLocaleString()}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OvertimeCalculation;
