import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, message, Popconfirm, Tooltip, Row, Col, Divider, Card, Statistic, DatePicker } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import { Users } from 'lucide-react';
import hrmsService from '../../services/hrmsService.js';
import dayjs from 'dayjs';

const DEPARTMENTS = ['Sales', 'Marketing', 'Accounts', 'Warehouse', 'Delivery', 'HR', 'IT', 'Admin', 'Production'];
const DESIGNATIONS = ['Manager', 'Executive', 'Sr. Executive', 'Assistant', 'Supervisor', 'Driver', 'Helper', 'Accountant', 'Director', 'Intern'];
const EMPLOYMENT_TYPES = ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Probation'];
const SHIFTS = ['General (9AM-6PM)', 'Morning (6AM-2PM)', 'Evening (2PM-10PM)', 'Night (10PM-6AM)'];
const GENDERS = ['Male', 'Female', 'Other'];

const EmployeeRegistration = () => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ department: undefined, status: undefined });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, onLeave: 0 });

  // Form
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [form] = Form.useForm();

  // Salary auto-calc
  const [salaryCalc, setSalaryCalc] = useState({ gross: 0, totalDeductions: 0, net: 0 });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await hrmsService.getEmployeeStats();
      if (res.data?.success !== false) setStats(res.data?.data || res.data || { total: 0, active: 0, inactive: 0, onLeave: 0 });
    } catch {}
  };

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)) };
      const res = await hrmsService.getEmployees(params);
      const data = res.data?.data || res.data || [];
      const total = res.data?.pagination?.totalItems || res.data?.total || data.length;
      setEmployees(Array.isArray(data) ? data : []);
      setPagination(p => ({ ...p, total }));
    } catch (err) { message.error(err.message || 'Failed to fetch employees'); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const openDrawer = (employee = null) => {
    setEditingEmployee(employee);
    if (employee) {
      form.setFieldsValue({
        ...employee,
        dob: employee.dob ? dayjs(employee.dob) : null,
        joiningDate: employee.joiningDate ? dayjs(employee.joiningDate) : null,
      });
      calculateSalary(employee);
    } else {
      form.resetFields();
      setSalaryCalc({ gross: 0, totalDeductions: 0, net: 0 });
    }
    setDrawerOpen(true);
  };

  const calculateSalary = (values) => {
    const basic = values?.basic || 0;
    const hra = values?.hra || 0;
    const conveyance = values?.conveyance || 0;
    const medical = values?.medical || 0;
    const special = values?.special || 0;
    const otherAllowance = values?.otherAllowance || 0;
    const gross = basic + hra + conveyance + medical + special + otherAllowance;

    const pf = values?.pf || 0;
    const esi = values?.esiDeduction || 0;
    const pt = values?.pt || 0;
    const tds = values?.tds || 0;
    const otherDeductions = values?.otherDeductions || 0;
    const totalDeductions = pf + esi + pt + tds + otherDeductions;

    const net = gross - totalDeductions;
    setSalaryCalc({ gross, totalDeductions, net });
  };

  const handleSalaryChange = () => {
    const values = form.getFieldsValue();
    calculateSalary(values);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      values.dob = values.dob ? values.dob.format('YYYY-MM-DD') : null;
      values.joiningDate = values.joiningDate ? values.joiningDate.format('YYYY-MM-DD') : null;

      let res;
      if (editingEmployee) {
        res = await hrmsService.updateEmployee(editingEmployee._id, values);
      } else {
        res = await hrmsService.createEmployee(values);
      }
      const result = res.data;
      if (result.success !== false) {
        message.success(result.message || 'Employee saved successfully');
        setDrawerOpen(false);
        form.resetFields();
        setEditingEmployee(null);
        fetchEmployees();
        fetchStats();
      } else {
        message.error(result.message || 'Failed to save');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || err.message || 'Failed to save');
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await hrmsService.deleteEmployee(id);
      if (res.data?.success !== false) { message.success('Deleted'); fetchEmployees(); fetchStats(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Name', key: 'name', width: 180, render: (_, r) => <div><div className="text-sm font-medium text-gray-900">{r.firstName} {r.lastName}</div><span className="text-xs text-gray-400">{r.employeeCode}</span></div> },
    { title: 'Department', dataIndex: 'department', key: 'department', width: 120, render: v => <span className="text-sm">{v}</span> },
    { title: 'Designation', dataIndex: 'designation', key: 'designation', width: 120, render: v => <span className="text-sm">{v}</span> },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile', width: 120 },
    { title: 'Joining', dataIndex: 'joiningDate', key: 'joiningDate', width: 100, render: v => v ? dayjs(v).format('DD/MM/YY') : '-' },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 90, render: s => <Tag color={s === 'active' ? 'green' : s === 'onLeave' ? 'orange' : 'red'}>{s || 'active'}</Tag> },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openDrawer(r)} /></Tooltip>
          <Popconfirm title="Delete this employee?" onConfirm={() => handleDelete(r._id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employee Registration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employee records & details</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Add Employee
        </Button>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Employees" value={stats.total} prefix={<Users size={16} />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Inactive" value={stats.inactive} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="On Leave" value={stats.onLeave} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search by name, code, mobile..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-72" allowClear />
          <Select placeholder="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))}
            value={filters.department} onChange={v => setFilters(f => ({ ...f, department: v }))} allowClear className="w-40" />
          <Select placeholder="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }, { value: 'onLeave', label: 'On Leave' }]}
            value={filters.status} onChange={v => setFilters(f => ({ ...f, status: v }))} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ department: undefined, status: undefined }); }}>Reset</Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={employees} rowKey="_id" loading={loading} size="middle" scroll={{ x: 900 }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'],
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} employees` }}
          onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {/* Full page overlay form */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingEmployee(null); }} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-y-auto">
            {/* Sticky Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="text-[#FF5F03] text-xl">👤</span>
                <h2 className="text-lg font-bold text-gray-800">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
              </div>
              <div className="flex items-center gap-3">
                <Button type="primary" onClick={handleSave} loading={loading} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
                  {editingEmployee ? 'Update Employee' : 'Save Employee'}
                </Button>
                <Button onClick={() => form.resetFields()} className="text-green-600 border-green-400">Clear Form</Button>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingEmployee(null); }}>✕</span>
              </div>
            </div>

            {/* Form Content */}
            <div className="px-8 py-6">
              <Form form={form} layout="vertical" onValuesChange={handleSalaryChange}>

                {/* Personal Info */}
                <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Personal Information</h3>
                <Row gutter={16}>
                  <Col span={4}><Form.Item name="firstName" label="First Name" rules={[{ required: true }]}><Input placeholder="First Name" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="lastName" label="Last Name" rules={[{ required: true }]}><Input placeholder="Last Name" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="fatherName" label="Father's Name"><Input placeholder="Father's Name" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="dob" label="Date of Birth"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="gender" label="Gender" rules={[{ required: true }]}><Select placeholder="Gender" options={GENDERS.map(g => ({ value: g, label: g }))} /></Form.Item></Col>
                  <Col span={4}><Form.Item name="mobile" label="Mobile" rules={[{ required: true }]}><Input placeholder="Mobile Number" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="email" label="Email"><Input placeholder="Email address" /></Form.Item></Col>
                  <Col span={10}><Form.Item name="address" label="Address"><Input placeholder="Full address" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="emergencyContact" label="Emergency Contact"><Input placeholder="Emergency No." /></Form.Item></Col>
                  <Col span={4}><Form.Item name="emergencyContactName" label="Emergency Person"><Input placeholder="Name" /></Form.Item></Col>
                </Row>

                <Divider className="my-4" />

                {/* Identity */}
                <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Identity Documents</h3>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="aadhaar" label="Aadhaar Number"><Input placeholder="12-digit Aadhaar" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="pan" label="PAN Number"><Input placeholder="PAN" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="uan" label="UAN Number"><Input placeholder="UAN" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="esiNumber" label="ESI Number"><Input placeholder="ESI No." /></Form.Item></Col>
                </Row>

                <Divider className="my-4" />

                {/* Employment Details */}
                <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Employment Details</h3>
                <Row gutter={16}>
                  <Col span={4}><Form.Item name="designation" label="Designation" rules={[{ required: true }]}><Select placeholder="Designation" options={DESIGNATIONS.map(d => ({ value: d, label: d }))} showSearch /></Form.Item></Col>
                  <Col span={4}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select placeholder="Department" options={DEPARTMENTS.map(d => ({ value: d, label: d }))} showSearch /></Form.Item></Col>
                  <Col span={4}><Form.Item name="joiningDate" label="Joining Date" rules={[{ required: true }]}><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="employmentType" label="Employment Type"><Select placeholder="Type" options={EMPLOYMENT_TYPES.map(t => ({ value: t, label: t }))} /></Form.Item></Col>
                  <Col span={4}><Form.Item name="shift" label="Shift"><Select placeholder="Shift" options={SHIFTS.map(s => ({ value: s, label: s }))} /></Form.Item></Col>
                  <Col span={4}><Form.Item name="reportingManager" label="Reporting Manager"><Input placeholder="Manager Name" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="branch" label="Branch"><Input placeholder="Branch / Location" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="employeeCode" label="Employee Code"><Input placeholder="Auto-generated if empty" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="status" label="Status"><Select placeholder="Status" options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></Form.Item></Col>
                </Row>

                <Divider className="my-4" />

                {/* Bank Details */}
                <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Bank Details</h3>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="bankName" label="Bank Name"><Input placeholder="Bank Name" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="accountNumber" label="Account Number"><Input placeholder="Account No." /></Form.Item></Col>
                  <Col span={6}><Form.Item name="ifscCode" label="IFSC Code"><Input placeholder="IFSC" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="accountHolderName" label="Account Holder Name"><Input placeholder="Holder Name" /></Form.Item></Col>
                </Row>

                <Divider className="my-4" />

                {/* Salary Structure */}
                <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Salary Structure</h3>
                <p className="text-xs text-gray-400 mb-3">Earnings (Allowances)</p>
                <Row gutter={16}>
                  <Col span={4}><Form.Item name="basic" label="Basic"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="hra" label="HRA"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="conveyance" label="Conveyance"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="medical" label="Medical"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="special" label="Special Allowance"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="otherAllowance" label="Other Allowance"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                </Row>
                <p className="text-xs text-gray-400 mb-3">Deductions</p>
                <Row gutter={16}>
                  <Col span={4}><Form.Item name="pf" label="PF"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="esiDeduction" label="ESI"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="pt" label="Professional Tax"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="tds" label="TDS"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="otherDeductions" label="Other Deductions"><InputNumber min={0} className="w-full" prefix="₹" placeholder="0" /></Form.Item></Col>
                </Row>
                {/* Salary Summary */}
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                  <Row gutter={24}>
                    <Col span={8}><div className="text-center"><p className="text-xs text-gray-500">Gross Salary</p><p className="text-lg font-bold text-green-600">₹{salaryCalc.gross.toLocaleString()}</p></div></Col>
                    <Col span={8}><div className="text-center"><p className="text-xs text-gray-500">Total Deductions</p><p className="text-lg font-bold text-red-500">₹{salaryCalc.totalDeductions.toLocaleString()}</p></div></Col>
                    <Col span={8}><div className="text-center"><p className="text-xs text-gray-500">Net Salary</p><p className="text-lg font-bold text-[#FF5F03]">₹{salaryCalc.net.toLocaleString()}</p></div></Col>
                  </Row>
                </div>

                <Divider className="my-4" />

                {/* Leave Balance */}
                <h3 className="text-base font-semibold text-gray-700 mb-3 flex items-center gap-2"><span className="w-1 h-5 bg-[#FF5F03] rounded-full inline-block"></span>Leave Balance (Per Year)</h3>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="casualLeave" label="Casual Leave"><InputNumber min={0} className="w-full" placeholder="12" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="sickLeave" label="Sick Leave"><InputNumber min={0} className="w-full" placeholder="6" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="earnedLeave" label="Earned Leave"><InputNumber min={0} className="w-full" placeholder="15" /></Form.Item></Col>
                </Row>

                {/* Footer Buttons */}
                <div className="mt-6 flex justify-end gap-3 pb-6">
                  <Button size="large" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingEmployee(null); }}>Cancel</Button>
                  <Button type="primary" size="large" onClick={handleSave} loading={loading} style={{ background: '#FF5F03', borderColor: '#FF5F03' }} className="px-8">
                    {editingEmployee ? 'Update Employee' : 'Save Employee'}
                  </Button>
                </div>
              </Form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default EmployeeRegistration;
