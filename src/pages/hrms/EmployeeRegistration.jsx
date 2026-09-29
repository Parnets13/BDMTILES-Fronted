import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  DatePicker,
  Divider,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Tooltip,
} from 'antd';
import {
  DownloadOutlined,
  EditOutlined,
  EyeOutlined,
  FileTextOutlined,
  LogoutOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext.jsx';
import hrmsService from '../../services/hrmsService.js';
import userService from '../../services/userService.js';
import LinkRecordModal from '../../components/LinkRecordModal.jsx';

const DEPARTMENTS = ['Sales', 'Marketing', 'Accounts', 'Warehouse', 'Delivery', 'HR', 'IT', 'Admin', 'Production'];
const DESIGNATIONS = ['Driver', 'Helper', 'Accountant', 'Office Assistant', 'Intern'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Daily Wage'];
const SHIFTS = ['General', 'Morning (6AM-2PM)', 'Evening (2PM-10PM)', 'Night (10PM-6AM)'];
const GENDERS = ['Male', 'Female', 'Other'];
const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'On Notice'];

const branchValue = (branch) => String(branch?._id || branch || '');
const money = (value) => `₹${Number(value || 0).toLocaleString()}`;

const EmployeeRegistration = () => {
  const { user, activeBranchId, setActiveBranch, branchEpoch } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ department: undefined, status: undefined });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, onNotice: 0, terminated: 0 });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  // A login picked from User Management to attach to this employee. Held in state rather
  // than written straight through, because on a NEW employee there is no id to link
  // against until the save returns one.
  const [pendingLogin, setPendingLogin] = useState(null);
  const [linkLoginOpen, setLinkLoginOpen] = useState(false);

  // What the App Login section shows. A login picked in this session wins over the one
  // already saved, because the pick is what the operator will actually get on save.
  // `value`, not `_id` — the candidate rows are built for LinkRecordModal, which keys on
  // `value`. Reading `_id` here always yielded undefined, so the section never registered
  // the pick: the banner stayed on "No login linked yet" and the name and mobile fields
  // stayed editable, which is precisely what the lock exists to prevent.
  const linkedLoginId = pendingLogin?.value || editingEmployee?.userId || null;

  const linkedLoginLabel = pendingLogin
    ? `${pendingLogin.label}${pendingLogin.hint ? ` · ${pendingLogin.hint}` : ''} (saved when you save)`
    : editingEmployee?.userId
      ? `${editingEmployee.name}${editingEmployee.appAccess?.username ? ` · ${editingEmployee.appAccess.username}` : ''}`
      : '';

  // Once a login is linked, the LOGIN owns the name and mobile. Editing them here would
  // let the two records drift, and the link guard requires the numbers to match — so the
  // save would be rejected for a reason the operator could not see coming. Locking the
  // fields makes the rule visible at the point of entry instead.
  const loginOwnsIdentity = Boolean(linkedLoginId);
  const [viewEmployee, setViewEmployee] = useState(null);
  const [exitEmployeeRecord, setExitEmployeeRecord] = useState(null);
  const [form] = Form.useForm();
  const [exitForm] = Form.useForm();
  const [salaryCalc, setSalaryCalc] = useState({ gross: 0, totalDeductions: 0, net: 0 });

  const branchOptions = useMemo(() => (user?.assignedBranches || [])
    .filter((branch) => branch?.status === 'active')
    .map((branch) => ({
      value: branchValue(branch),
      label: `${branch.branchCode ? `${branch.branchCode} — ` : ''}${branch.name}`,
    })), [user?.assignedBranches]);

  // A login belongs to one or more branches, and the employee must live in one of them —
  // the server refuses the link otherwise. So the branch FOLLOWS the login rather than
  // being chosen freely: a single-branch login locks the field outright, a multi-branch
  // one restricts the choices to that login's branches.
  //
  // Computed here rather than beside the other link state because it reads
  // `branchOptions`, which is declared just above — placing it earlier is a temporal dead
  // zone error, not a syntax one, so no build step catches it.
  const loginBranchIds = pendingLogin?.branchIds?.length ? pendingLogin.branchIds : [];
  const branchChoices = loginBranchIds.length
    ? branchOptions.filter((option) => loginBranchIds.includes(String(option.value)))
    : branchOptions;
  const branchLocked = loginBranchIds.length === 1;

  const fetchStats = useCallback(async () => {
    if (!activeBranchId) return setStats({ total: 0, active: 0, inactive: 0, onNotice: 0, terminated: 0 });
    try {
      const response = await hrmsService.getEmployeeStats();
      if (response.success) setStats(response.data || {});
    } catch (error) {
      message.error(error.message || 'Failed to load employee statistics');
    }
  }, [activeBranchId, branchEpoch]);

  const fetchEmployees = useCallback(async () => {
    if (!activeBranchId) {
      setEmployees([]);
      setPagination((current) => ({ ...current, total: 0 }));
      return;
    }
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search,
        ...Object.fromEntries(Object.entries(filters).filter(([, value]) => value)),
      };
      const response = await hrmsService.getEmployees(params);
      if (response.success) {
        setEmployees(response.data || []);
        setPagination((current) => ({ ...current, total: response.pagination?.totalItems || 0 }));
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch employees');
    } finally {
      setLoading(false);
    }
  }, [activeBranchId, branchEpoch, filters, pagination.current, pagination.pageSize, search]);

  useEffect(() => {
    fetchEmployees();
    fetchStats();
  }, [fetchEmployees, fetchStats]);

  const calculateSalary = (values) => {
    const gross = Number(values?.basicSalary || 0)
      + Number(values?.hra || 0)
      + Number(values?.conveyance || 0)
      + Number(values?.medicalAllowance || 0)
      + Number(values?.specialAllowance || 0)
      + Number(values?.otherAllowance || 0);
    const totalDeductions = Number(values?.pf || 0)
      + Number(values?.esi || 0)
      + Number(values?.professionalTax || 0)
      + Number(values?.tds || 0)
      + Number(values?.otherDeductions || 0);
    setSalaryCalc({ gross, totalDeductions, net: Math.max(0, gross - totalDeductions) });
  };

  const newEmployeeDefaults = () => ({
    branchId: activeBranchId,
    status: 'Active',
    gender: 'Male',
    employmentType: 'Full Time',
    shift: 'General',
    leaveBalance: { casual: 12, sick: 6, earned: 0, unpaid: 0 },
  });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  };

  const openDrawer = (employee = null) => {
    setEditingEmployee(employee);
    setPendingLogin(null);
    if (employee) {
      const employeeFormValues = { ...employee };
      delete employeeFormValues.appAccess;
      form.setFieldsValue({
        ...employeeFormValues,
        designation: employee.designation ? [employee.designation] : [],
        branchId: branchValue(employee.branchId),
        dateOfBirth: employee.dateOfBirth ? dayjs(employee.dateOfBirth) : null,
        dateOfJoining: employee.dateOfJoining ? dayjs(employee.dateOfJoining) : null,
      });
      calculateSalary(employee);
    } else {
      form.resetFields();
      form.setFieldsValue(newEmployeeDefaults());
      setSalaryCalc({ gross: 0, totalDeductions: 0, net: 0 });
    }
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const rawDesignation = Array.isArray(values.designation) ? values.designation[0] : values.designation;
      const designation = String(rawDesignation || '').trim();
      const payload = {
        ...values,
        designation,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        dateOfJoining: values.dateOfJoining ? values.dateOfJoining.format('YYYY-MM-DD') : null,
      };
      delete payload.appAccess;
      if (!designation) {
        setLoading(false);
        message.error('Select or enter a designation.');
        return;
      }
      const response = editingEmployee
        ? await hrmsService.updateEmployee(editingEmployee._id, payload)
        : await hrmsService.createEmployee(payload);
      if (!response.success) throw new Error(response.message || 'Failed to save employee');

      // Attach a chosen login, if any. Done AFTER the save because a new employee has no
      // id until this point — and a link failure must not be reported as a save failure,
      // or the operator re-creates the employee and ends up with two.
      const savedEmployee = response.data;
      if (pendingLogin?._id && savedEmployee?._id) {
        try {
          await hrmsService.linkUser(savedEmployee._id, pendingLogin._id);
          message.success(`${savedEmployee.name} linked to the login ${pendingLogin.name}.`);
        } catch (linkError) {
          message.warning(
            `Employee saved, but the login could not be linked: ${linkError.message} Use "Link existing login" on the employee to retry.`,
          );
        }
      }

      message.success(response.message || 'Employee saved successfully');
      closeDrawer();
      await Promise.all([fetchEmployees(), fetchStats()]);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (employee) => {
    try {
      setLoading(true);
      const response = await hrmsService.deactivateEmployee(employee._id);
      if (!response.success) throw new Error(response.message || 'Deactivation failed');
      message.success('Employee deactivated. Records were preserved.');
      if (viewEmployee?._id === employee._id) setViewEmployee(response.data);
      await Promise.all([fetchEmployees(), fetchStats()]);
    } catch (error) {
      message.error(error.message || 'Failed to deactivate employee');
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentDownload = async (employee, doc) => {
    try {
      const blob = await hrmsService.downloadEmployeeDocument(employee._id, doc.url);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = doc.name || doc.url;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 60000);
    } catch (error) {
      message.error(error.message || 'Failed to download document');
    }
  };

  const openExit = (employee) => {
    setExitEmployeeRecord(employee);
    exitForm.setFieldsValue({ exitDate: dayjs(), exitReason: '' });
  };

  const handleExit = async () => {
    try {
      const values = await exitForm.validateFields();
      setLoading(true);
      const response = await hrmsService.exitEmployee(exitEmployeeRecord._id, {
        exitDate: values.exitDate.format('YYYY-MM-DD'),
        exitReason: values.exitReason.trim(),
      });
      if (!response.success) throw new Error(response.message || 'Exit failed');
      message.success('Employee exit recorded. Records were preserved.');
      setExitEmployeeRecord(null);
      exitForm.resetFields();
      if (viewEmployee?._id === response.data?._id) setViewEmployee(response.data);
      await Promise.all([fetchEmployees(), fetchStats()]);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to exit employee');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name', key: 'name', width: 190,
      render: (_, employee) => <div><div className="text-sm font-medium text-gray-900">{employee.name}</div><span className="text-xs text-gray-400">{employee.empId}</span></div>,
    },
    { title: 'Department', dataIndex: 'department', key: 'department', width: 120 },
    { title: 'Designation', dataIndex: 'designation', key: 'designation', width: 130 },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile', width: 120 },
    { title: 'Joining', dataIndex: 'dateOfJoining', key: 'dateOfJoining', width: 105, render: (value) => value ? dayjs(value).format('DD/MM/YY') : '-' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 105,
      render: (status) => <Tag color={status === 'Active' ? 'green' : status === 'On Notice' ? 'orange' : 'red'}>{status || 'Active'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 145, fixed: 'right',
      render: (_, employee) => (
        <Space size="small">
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewEmployee(employee)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openDrawer(employee)} /></Tooltip>
          <Tooltip title="Record exit"><Button type="text" size="small" danger icon={<LogoutOutlined />} disabled={employee.status === 'Terminated'} onClick={() => openExit(employee)} /></Tooltip>
          <Popconfirm
            title="Deactivate this employee?"
            description="The employee and references are preserved."
            okText="Deactivate"
            okButtonProps={{ danger: true }}
            onConfirm={() => handleDeactivate(employee)}
            disabled={employee.status === 'Inactive' || employee.status === 'Terminated'}
          >
            <Tooltip title="Deactivate"><Button type="text" size="small" danger icon={<StopOutlined />} disabled={employee.status === 'Inactive' || employee.status === 'Terminated'} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Employee Registration</h1>
          <p className="text-sm text-gray-500 mt-0.5">Branch-scoped employee records and lifecycle management</p>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => openDrawer()}
          disabled={!activeBranchId}
          size="large"
          style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
        >
          Add Employee
        </Button>
      </div>

      {!activeBranchId && <Alert className="mb-4" type="warning" showIcon message="Select an active branch before managing employees." />}

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} md={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<TeamOutlined />} /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="Active" value={stats.active || 0} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="Inactive" value={stats.inactive || 0} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="On Notice" value={stats.onNotice || 0} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col xs={12} md={5}><Card size="small"><Statistic title="Terminated" value={stats.terminated || 0} valueStyle={{ color: '#991b1b' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search by name, code, mobile..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPagination((current) => ({ ...current, current: 1 })); }}
            className="w-72"
            allowClear
          />
          <Select placeholder="Department" options={DEPARTMENTS.map((value) => ({ value, label: value }))} value={filters.department} onChange={(value) => setFilters((current) => ({ ...current, department: value }))} allowClear className="w-40" />
          <Select placeholder="Status" options={[...EMPLOYEE_STATUSES, 'Terminated'].map((value) => ({ value, label: value }))} value={filters.status} onChange={(value) => setFilters((current) => ({ ...current, status: value }))} allowClear className="w-36" />
          <Button onClick={() => { setSearch(''); setFilters({ department: undefined, status: undefined }); }}>Reset</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchEmployees(); fetchStats(); }}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={employees}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 1050 }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} employees` }}
          onChange={(next) => setPagination((current) => ({ ...current, current: next.current, pageSize: next.pageSize }))}
        />
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closeDrawer} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div>
                <h2 className="text-lg font-bold text-gray-800">{editingEmployee ? 'Edit Employee' : 'Add New Employee'}</h2>
                <p className="text-xs text-gray-500">Maintain personal, employment, salary, leave, and lifecycle details.</p>
              </div>
              <Space>
                <Button type="primary" onClick={handleSave} loading={loading} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>{editingEmployee ? 'Update Employee' : 'Save Employee'}</Button>
                <Button onClick={() => { form.resetFields(); form.setFieldsValue(editingEmployee ? {} : newEmployeeDefaults()); }}>Clear Form</Button>
                <Button type="text" onClick={closeDrawer}>✕</Button>
              </Space>
            </div>

            <div className="px-8 py-6">
              <Form form={form} layout="vertical" onValuesChange={(_, values) => calculateSalary(values)}>
                <h3 className="text-base font-semibold text-gray-700 mb-3">Personal Information</h3>
                <Row gutter={16}>
                  <Col xs={24} md={6}><Form.Item name="name" label="Full Name" rules={[{ required: true }]} extra={loginOwnsIdentity ? 'From the linked login' : undefined}><Input disabled={loginOwnsIdentity} /></Form.Item></Col>
                  <Col xs={24} md={5}><Form.Item name="fatherName" label="Father's Name"><Input /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="dateOfBirth" label="Date of Birth"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="gender" label="Gender" rules={[{ required: true }]}><Select options={GENDERS.map((value) => ({ value, label: value }))} /></Form.Item></Col>
                  <Col xs={24} md={5}><Form.Item name="mobile" label="Mobile" rules={[{ required: true }]} extra={loginOwnsIdentity ? 'From the linked login' : undefined}><Input disabled={loginOwnsIdentity} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={6}><Form.Item name="email" label="Email"><Input type="email" /></Form.Item></Col>
                  <Col xs={24} md={12}><Form.Item name="address" label="Address"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="emergencyContact" label="Emergency Contact"><Input /></Form.Item></Col>
                </Row>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">Identity Documents</h3>
                <Row gutter={16}>
                  <Col xs={24} md={6}><Form.Item name="aadhaar" label="Aadhaar Number"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="pan" label="PAN Number"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="uan" label="UAN Number"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="esiNumber" label="ESI Number"><Input /></Form.Item></Col>
                </Row>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">Employment Details</h3>
                <Row gutter={16}>
                  <Col xs={24} md={4}>
                    <Form.Item
                      name="designation"
                      label="Designation"
                      rules={[{ required: true, message: 'Select or enter a designation.' }]}
                      extra={<span className="text-xs text-gray-400">Select a standard HR designation or enter another title</span>}>
                      <Select
                        options={DESIGNATIONS.map((value) => ({ value, label: value }))}
                        showSearch
                        allowClear
                        mode="tags"
                        maxCount={1}
                        placeholder="Select or enter designation"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select options={DEPARTMENTS.map((value) => ({ value, label: value }))} showSearch /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="dateOfJoining" label="Joining Date" rules={[{ required: true }]}><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="employmentType" label="Employment Type"><Select options={EMPLOYMENT_TYPES.map((value) => ({ value, label: value }))} /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="shift" label="Shift"><Select options={SHIFTS.map((value) => ({ value, label: value }))} /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="reportingManager" label="Reporting Manager"><Input /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col xs={24} md={8}>
                    <Form.Item
                      name="branchId"
                      label="Branch"
                      rules={[{ required: true }]}
                      extra={
                        branchLocked
                          ? 'Set by the linked login'
                          : loginBranchIds.length
                            ? 'Limited to the linked login\u2019s branches'
                            : undefined
                      }
                    >
                      <Select
                        options={branchChoices}
                        disabled={branchLocked}
                        onChange={(value) => { if (!editingEmployee) setActiveBranch(value); }}
                        placeholder="Select an active assigned branch"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}><Form.Item name="empId" label="Employee Code"><Input placeholder="Auto-generated if empty" /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="status" label="Status"><Select options={EMPLOYEE_STATUSES.map((value) => ({ value, label: value }))} disabled={editingEmployee?.status === 'Terminated'} /></Form.Item></Col>
                </Row>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">App Login</h3>
                {/* Attendance, GPS punch-in and field tracking all resolve the signed-in
                    user through Employee.userId. An employee with no login cannot use the
                    Sales Executive app at all — its attendance call returns 404 and the
                    home screen shows "Couldn't load attendance". This is where that link
                    is made. */}
                <Alert
                  className="mb-3"
                  type={linkedLoginId ? 'success' : 'warning'}
                  showIcon
                  message={linkedLoginId ? 'Login linked' : 'No login linked yet'}
                  description={
                    linkedLoginId
                      ? 'This employee can sign in and use the field app. The login owns the name, mobile, username and role; HRMS owns everything else — department, designation, salary, leave.'
                      : 'Until a login is linked, this employee cannot sign in to the Sales Executive app — attendance will fail to load for them. Pick one below and the name and mobile are copied across and locked, so the two records cannot disagree.'
                  }
                />
                <Row gutter={16} align="middle">
                  <Col xs={24} md={14}>
                    <Form.Item label="Login">
                      <Input readOnly value={linkedLoginLabel} placeholder="No login linked" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={10}>
                    <Space className="mb-6">
                      <Button onClick={() => setLinkLoginOpen(true)}>
                        {linkedLoginId ? 'Change login' : 'Link existing login'}
                      </Button>
                      {pendingLogin ? (
                        <Button type="text" onClick={() => setPendingLogin(null)}>Undo</Button>
                      ) : null}
                    </Space>
                  </Col>
                </Row>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">Bank Details</h3>
                <Row gutter={16}>
                  <Col xs={24} md={6}><Form.Item name="bankName" label="Bank Name"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="accountNumber" label="Account Number"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="ifscCode" label="IFSC Code"><Input /></Form.Item></Col>
                  <Col xs={24} md={6}><Form.Item name="accountHolderName" label="Account Holder Name"><Input /></Form.Item></Col>
                </Row>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">Salary Structure</h3>
                <Row gutter={16}>
                  {[
                    ['basicSalary', 'Basic'], ['hra', 'HRA'], ['conveyance', 'Conveyance'],
                    ['medicalAllowance', 'Medical'], ['specialAllowance', 'Special Allowance'], ['otherAllowance', 'Other Allowance'],
                  ].map(([name, label]) => <Col xs={12} md={4} key={name}><Form.Item name={name} label={label}><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>)}
                </Row>
                <Row gutter={16}>
                  {[
                    ['pf', 'PF'], ['esi', 'ESI'], ['professionalTax', 'Professional Tax'], ['tds', 'TDS'], ['otherDeductions', 'Other Deductions'],
                  ].map(([name, label]) => <Col xs={12} md={4} key={name}><Form.Item name={name} label={label}><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>)}
                </Row>
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 mb-4">
                  <Row gutter={24}>
                    <Col span={8}><div className="text-center"><p className="text-xs text-gray-500">Gross Salary</p><p className="text-lg font-bold text-green-600">{money(salaryCalc.gross)}</p></div></Col>
                    <Col span={8}><div className="text-center"><p className="text-xs text-gray-500">Total Deductions</p><p className="text-lg font-bold text-red-500">{money(salaryCalc.totalDeductions)}</p></div></Col>
                    <Col span={8}><div className="text-center"><p className="text-xs text-gray-500">Net Salary</p><p className="text-lg font-bold text-[#FF5F03]">{money(salaryCalc.net)}</p></div></Col>
                  </Row>
                </div>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">Leave Balance (Per Year)</h3>
                <Row gutter={16}>
                  <Col xs={12} md={6}><Form.Item name={['leaveBalance', 'casual']} label="Casual Leave"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                  <Col xs={12} md={6}><Form.Item name={['leaveBalance', 'sick']} label="Sick Leave"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                  <Col xs={12} md={6}><Form.Item name={['leaveBalance', 'earned']} label="Earned Leave"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                  <Col xs={12} md={6}><Form.Item name={['leaveBalance', 'unpaid']} label="Unpaid Leave"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                </Row>

                <div className="mt-6 flex justify-end gap-3 pb-6">
                  <Button size="large" onClick={closeDrawer}>Cancel</Button>
                  <Button type="primary" size="large" onClick={handleSave} loading={loading} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>{editingEmployee ? 'Update Employee' : 'Save Employee'}</Button>
                </div>
              </Form>
            </div>
          </div>
        </>
      )}

      <LinkRecordModal
        open={linkLoginOpen}
        onClose={() => setLinkLoginOpen(false)}
        title="Link an existing login"
        description="Logins already linked to another employee are excluded. Linking copies this employee's name, email and mobile onto the login — the login keeps its username, role and permissions."
        emptyText="Every login already has an employee."
        searchPlaceholder="Search by name or username…"
        loadCandidates={async () => {
          const branchId = form.getFieldValue('branchId');
          const [usersRes, employeesRes] = await Promise.all([
            userService.getUsers({ limit: 200 }),
            hrmsService.getEmployees({ limit: 200 }),
          ]);
          const linked = new Set(
            (employeesRes?.data || []).map((employee) => String(employee.userId || '')).filter(Boolean),
          );
          return (usersRes?.data || usersRes?.users || [])
            .filter((user) => !linked.has(String(user._id)))
            // Global administrator roles are not employees. Offering them invites linking
            // an HR record to a super-admin login, which is never what is meant — and the
            // employee would then inherit that login's reach.
            .filter((user) => !['super_admin', 'owner', 'admin', 'sub_admin'].includes(user.role))
            // Branch-scoped. A login assigned to another branch cannot be linked to an
            // employee here — the server rejects it — so offering it would be a dead end
            // the operator only discovers after clicking. A login with no branch
            // assignment is kept: it has nowhere else to belong.
            .filter((user) => {
              if (!branchId) return true;
              const branches = (user.assignedBranches || []).map((branch) => String(branch?._id || branch));
              return branches.length === 0 || branches.includes(String(branchId));
            })
            .map((user) => ({
              value: user._id,
              label: user.name,
              hint: [user.username, user.role, user.phone].filter(Boolean).join(' · '),
              // Carried so the form can copy it — the login owns the mobile, and the
              // employee record has to agree with it or the link is refused.
              mobile: user.phone || '',
              // Drives the Branch field: the employee has to sit in a branch the login
              // is assigned to.
              branchIds: (user.assignedBranches || []).map((branch) => String(branch?._id || branch)),
            }));
        }}
        linkRecord={async (userId, row) => {
          // An existing employee can be linked immediately. A NEW one has no id yet, so
          // the choice is held in state and applied the moment the save returns one.
          if (editingEmployee?._id) {
            await hrmsService.linkUser(editingEmployee._id, userId);
            setPendingLogin(null);
            await fetchEmployees();
            return;
          }
          setPendingLogin(row);
          // Copy the login's identity into the form now. The fields are locked the moment
          // a login is chosen, so this is the operator's one chance to see what the
          // employee record will actually say.
          form.setFieldsValue({
            ...(row.label ? { name: row.label } : {}),
            ...(row.mobile ? { mobile: row.mobile } : {}),
            // Move the branch onto the login's, so the save cannot fail the link's branch
            // check for a reason the operator never saw.
            ...(row.branchIds?.length ? { branchId: String(row.branchIds[0]) } : {}),
          });
        }}
      />

      <Modal
        title={`Record employee exit${exitEmployeeRecord ? ` — ${exitEmployeeRecord.name}` : ''}`}
        open={Boolean(exitEmployeeRecord)}
        onCancel={() => { setExitEmployeeRecord(null); exitForm.resetFields(); }}
        onOk={handleExit}
        okText="Confirm Exit"
        okButtonProps={{ danger: true }}
        width={700}
        confirmLoading={loading}
      >
        <Alert className="mb-4" type="warning" showIcon message="This records the end of employment while preserving employee history and references." />
        <Form form={exitForm} layout="vertical">
          <Form.Item name="exitDate" label="Exit Date" rules={[{ required: true }]}><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item>
          <Form.Item name="exitReason" label="Exit Reason" rules={[{ required: true, whitespace: true }]}><Input.TextArea rows={4} maxLength={500} showCount /></Form.Item>
        </Form>
      </Modal>

      <Modal
        title={viewEmployee ? `${viewEmployee.name} — ${viewEmployee.empId}` : 'Employee'}
        open={Boolean(viewEmployee)}
        onCancel={() => setViewEmployee(null)}
        footer={<Button onClick={() => setViewEmployee(null)}>Close</Button>}
        width={800}
      >
        {viewEmployee && (
          <div className="space-y-4 mt-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-4">
              <div><span className="text-gray-500 block">Status</span><Tag color={viewEmployee.status === 'Active' ? 'green' : viewEmployee.status === 'On Notice' ? 'orange' : 'red'}>{viewEmployee.status}</Tag></div>
              <div><span className="text-gray-500 block">Branch</span><strong>{viewEmployee.branchId?.name || viewEmployee.branch || '-'}</strong></div>
              <div><span className="text-gray-500 block">Department</span><strong>{viewEmployee.department || '-'}</strong></div>
              <div><span className="text-gray-500 block">Designation</span><strong>{viewEmployee.designation || '-'}</strong></div>
              <div><span className="text-gray-500 block">Mobile</span><strong>{viewEmployee.mobile || '-'}</strong></div>
              <div><span className="text-gray-500 block">Email</span><strong>{viewEmployee.email || '-'}</strong></div>
              <div><span className="text-gray-500 block">Joined</span><strong>{viewEmployee.dateOfJoining ? dayjs(viewEmployee.dateOfJoining).format('DD/MM/YYYY') : '-'}</strong></div>
              <div><span className="text-gray-500 block">Net Salary</span><strong>{money(viewEmployee.netSalary)}</strong></div>
            </div>
            {viewEmployee.status === 'Terminated' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <strong>Exit: {viewEmployee.exitDate ? dayjs(viewEmployee.exitDate).format('DD/MM/YYYY') : '-'}</strong>
                <p className="mt-1 text-gray-700">{viewEmployee.exitReason || '-'}</p>
              </div>
            )}

            <div>
              <strong className="mb-2 block">Documents</strong>
              {(viewEmployee.documents || []).length ? (
                <div className="space-y-2">
                  {viewEmployee.documents.map((doc, idx) => (
                    <div key={doc._id || idx} className="flex items-center justify-between rounded border border-gray-200 p-2">
                      <div className="flex items-center gap-2">
                        <FileTextOutlined className="text-gray-400" />
                        <span>{doc.name || doc.url}</span>
                        {doc.uploadDate && <span className="text-xs text-gray-400">{dayjs(doc.uploadDate).format('DD/MM/YYYY')}</span>}
                      </div>
                      <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDocumentDownload(viewEmployee, doc)}>Download</Button>
                    </div>
                  ))}
                </div>
              ) : <p className="text-gray-400">No documents on file (resumes carried over on conversion or HR-generated letters will appear here).</p>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeRegistration;
