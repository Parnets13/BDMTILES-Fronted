import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Card, Statistic, Row, Col, message, DatePicker } from 'antd';
import { SearchOutlined, ReloadOutlined, DollarOutlined, FileTextOutlined, DownloadOutlined } from '@ant-design/icons';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' }, { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' }, { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const SalaryProcessing = () => {
  const [slips, setSlips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(dayjs().month() + 1);
  const [selectedYear, setSelectedYear] = useState(dayjs().year());
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [stats, setStats] = useState({ totalEmployees: 0, generated: 0, pending: 0, totalPayout: 0 });

  // View slip modal
  const [viewModal, setViewModal] = useState(false);
  const [viewSlip, setViewSlip] = useState(null);

  // Generate modal
  const [generateLoading, setGenerateLoading] = useState(false);

  const fetchSlips = useCallback(async () => {
    setLoading(true);
    try {
      const params = { month: selectedMonth, year: selectedYear, search, status: statusFilter };
      const res = await hrmsService.getSalarySlips(params);
      const data = res.data || [];
      const records = Array.isArray(data) ? data : [];
      setSlips(records);

      // Stats
      const generated = records.filter(r => r.status === 'Approved' || r.status === 'Paid').length;
      const pending = records.filter(r => r.status === 'Draft' || !r.status).length;
      const totalPayout = records.reduce((sum, r) => sum + (r.netSalary || 0), 0);
      setStats({ totalEmployees: records.length, generated, pending, totalPayout });
    } catch (err) { message.error(err.message || 'Failed to fetch salary slips'); }
    finally { setLoading(false); }
  }, [selectedMonth, selectedYear, search, statusFilter]);

  useEffect(() => { fetchSlips(); }, [fetchSlips]);

  const handleGenerateSlip = async (employeeId) => {
    try {
      setGenerateLoading(true);
      const res = await hrmsService.generateSalarySlip({ employeeId, month: selectedMonth, year: selectedYear });
      if (res.success) {
        message.success('Salary slip generated');
        fetchSlips();
      } else {
        message.error(res.message || 'Failed');
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setGenerateLoading(false); }
  };

  const handleBulkGenerate = async () => {
    try {
      setGenerateLoading(true);
      const res = await hrmsService.generateSalarySlip({ month: selectedMonth, year: selectedYear, bulk: true });
      if (res.success) {
        message.success('Bulk salary slips generated');
        fetchSlips();
      } else {
        message.error(res.message || 'Failed');
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setGenerateLoading(false); }
  };

  const columns = [
    {
      title: 'Employee', key: 'employee', width: 200,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900">{r.employee?.name || '-'}</div>
          <span className="text-xs text-gray-400">{r.employee?.empId || ''}</span>
        </div>
      ),
    },
    { title: 'Basic', key: 'basic', width: 90, render: (_, r) => <span className="text-sm">₹{(r.basicSalary || 0).toLocaleString()}</span> },
    { title: 'Gross', key: 'gross', width: 100, render: (_, r) => <span className="text-sm font-medium">₹{(r.grossEarnings || 0).toLocaleString()}</span> },
    { title: 'Deductions', key: 'deductions', width: 100, render: (_, r) => <span className="text-sm text-red-500">₹{(r.grossDeductions || 0).toLocaleString()}</span> },
    { title: 'Net Salary', key: 'net', width: 110, render: (_, r) => <span className="text-sm font-bold text-[#FF5F03]">₹{(r.netSalary || 0).toLocaleString()}</span> },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: s => {
        const map = { Approved: 'green', Paid: 'blue', Draft: 'orange' };
        return <Tag color={map[s] || 'default'}>{s || 'Draft'}</Tag>;
      },
    },
    {
      title: 'Actions', key: 'actions', width: 140, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<FileTextOutlined />} onClick={() => { setViewSlip(r); setViewModal(true); }} className="text-blue-600" />
          {(!r.status || r.status === 'pending') && (
            <Button type="text" size="small" icon={<DollarOutlined />} onClick={() => handleGenerateSlip(r.employeeId || r.employee?._id)}
              loading={generateLoading} className="text-green-600" />
          )}
        </Space>
      ),
    },
  ];

  const currentYears = Array.from({ length: 5 }, (_, i) => dayjs().year() - 2 + i);

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Salary Processing</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate & manage monthly salary slips</p>
        </div>
        <Button type="primary" icon={<DollarOutlined />} onClick={handleBulkGenerate} loading={generateLoading} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Generate All Slips
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Employees" value={stats.totalEmployees} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Generated" value={stats.generated} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Pending" value={stats.pending} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Total Payout" value={`₹${stats.totalPayout.toLocaleString()}`} valueStyle={{ color: '#FF5F03' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-center">
          <Select placeholder="Month" options={MONTHS} value={selectedMonth} onChange={v => setSelectedMonth(v)} className="w-36" />
          <Select placeholder="Year" options={currentYears.map(y => ({ value: y, label: y.toString() }))} value={selectedYear} onChange={v => setSelectedYear(v)} className="w-24" />
          <Input placeholder="Search employee..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => setSearch(e.target.value)} className="w-60" allowClear />
          <Select placeholder="Status" options={[
            { value: 'generated', label: 'Generated' }, { value: 'paid', label: 'Paid' }, { value: 'pending', label: 'Pending' },
          ]} value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={slips} rowKey={r => r._id || Math.random()} loading={loading} size="middle" scroll={{ x: 950 }}
          pagination={{ pageSize: 20, showTotal: (t) => `${t} salary records` }} />
      </div>

      {/* View Slip Modal */}
      <Modal title="Salary Slip Details" open={viewModal} onCancel={() => { setViewModal(false); setViewSlip(null); }}
        footer={[<Button key="close" onClick={() => setViewModal(false)}>Close</Button>]} width={600}>
        {viewSlip && (
          <div className="mt-4">
            <div className="bg-gray-50 rounded-lg p-4 mb-4 border">
              <Row gutter={16}>
                <Col span={12}><p className="text-xs text-gray-500">Employee</p><p className="font-medium">{viewSlip.employee?.name || '-'}</p></Col>
                <Col span={12}><p className="text-xs text-gray-500">Month/Year</p><p className="font-medium">{MONTHS.find(m => m.value === viewSlip.month)?.label || viewSlip.month} {viewSlip.year}</p></Col>
              </Row>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* Earnings */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-green-700 mb-3">Earnings</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">Basic</span><span>₹{(viewSlip.basicSalary || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">HRA</span><span>₹{(viewSlip.hra || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Conveyance</span><span>₹{(viewSlip.conveyance || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Medical</span><span>₹{(viewSlip.medicalAllowance || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Special</span><span>₹{(viewSlip.specialAllowance || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Other</span><span>₹{(viewSlip.otherAllowance || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between border-t pt-2 font-bold text-green-700"><span>Gross</span><span>₹{(viewSlip.grossEarnings || 0).toLocaleString()}</span></div>
                </div>
              </div>

              {/* Deductions */}
              <div className="border rounded-lg p-4">
                <h4 className="text-sm font-semibold text-red-700 mb-3">Deductions</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-gray-600">PF</span><span>₹{(viewSlip.pf || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">ESI</span><span>₹{(viewSlip.esi || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Prof. Tax</span><span>₹{(viewSlip.professionalTax || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">TDS</span><span>₹{(viewSlip.tds || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-600">Other</span><span>₹{(viewSlip.otherDeductions || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between border-t pt-2 font-bold text-red-700"><span>Total Deductions</span><span>₹{(viewSlip.grossDeductions || 0).toLocaleString()}</span></div>
                </div>
              </div>
            </div>

            {/* Net */}
            <div className="mt-4 bg-[#FFF5EE] rounded-lg p-4 border border-[#FF5F03]/20 text-center">
              <p className="text-sm text-gray-600">Net Salary (Take Home)</p>
              <p className="text-2xl font-bold text-[#FF5F03]">₹{(viewSlip.netSalary || 0).toLocaleString()}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SalaryProcessing;
