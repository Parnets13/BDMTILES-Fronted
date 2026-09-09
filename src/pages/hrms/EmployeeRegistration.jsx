import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Checkbox,
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
  EditOutlined,
  EyeOutlined,
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

const DEPARTMENTS = ['Sales', 'Marketing', 'Accounts', 'Warehouse', 'Delivery', 'HR', 'IT', 'Admin', 'Production'];
// Non-app HR designations for staff who do NOT need mobile/app access.
// App-role designations (Picking Staff, Sorting/Loading Staff, etc.) come from the
// backend role catalog (roleOptions) so that Designation === Access, single source of truth.
const NON_APP_DESIGNATIONS = ['Driver', 'Helper', 'Accountant', 'Office Assistant', 'Intern'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Daily Wage'];
const SHIFTS = ['General', 'Morning (6AM-2PM)', 'Evening (2PM-10PM)', 'Night (10PM-6AM)'];
const GENDERS = ['Male', 'Female', 'Other'];
const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'On Notice'];

const branchValue = (branch) => String(branch?._id || branch || '');
const money = (value) => `₹${Number(value || 0).toLocaleString()}`;
const accessColor = (status) => status === 'Active' ? 'green' : status === 'Inactive' ? 'red' : 'default';

const EmployeeRegistration = () => {
  const { user, activeBranchId, setActiveBranch, branchEpoch } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ department: undefined, status: undefined });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, onNotice: 0, terminated: 0 });
  const [roleOptions, setRoleOptions] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
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

  // ── Multi-select Designation === Access ────────────────────────────────────
  // An employee can hold SEVERAL app-access designations at once (e.g. Picking +
  // Sorting + Loading). Checked roles are stored in appAccess.roles[]; the app
  // grants the union of their permissions. roleOptions come from the backend:
  // [{ value: 'picking_staff', label: 'Picking Staff' }, ...]
  const roleToLabel = useMemo(() => {
    const map = {};
    roleOptions.forEach((option) => { map[option.value] = option.label; });
    return map;
  }, [roleOptions]);

  // Checkbox options for the multi-select — one box per assignable app role.
  const accessRoleCheckboxes = useMemo(
    () => roleOptions.map((option) => ({ value: option.value, label: option.label })),
    [roleOptions],
  );

  // Human-readable permission preview for a set of selected roles.
  const rolePermissionPreview = useCallback((roles = []) => {
    const preview = {
      picking_staff: 'Picking: pick lists, picked/short/damaged, barcode·shade·batch',
      sorting_staff: 'Sorting + Loading: sort, pack, ready for dispatch, scan-verify loading',
      warehouse_manager: 'Full warehouse: picking, sorting, loading, dispatch, delivery',
    };
    return roles.map((role) => preview[role] || roleToLabel[role] || role);
  }, [roleToLabel]);

  // Watch the selected roles so the preview + derived designation stay live.
  const selectedRoles = Form.useWatch(['appAccess', 'roles'], form) || [];
  const hasAppAccess = selectedRoles.length > 0;
  // The stored `designation` string is derived from the selected role labels so
  // the employee table stays readable and designation always mirrors access.
  const designationSummary = selectedRoles.map((role) => roleToLabel[role] || role).join(', ');

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

  useEffect(() => {
    if (!activeBranchId) return;
    hrmsService.getEmployeeAppAccessOptions()
      .then((response) => setRoleOptions(response.data?.roles || []))
      .catch((error) => message.error(error.message || 'Failed to load app-access roles'));
  }, [activeBranchId, branchEpoch]);

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
    appAccess: { enabled: false, roles: [] },
  });

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingEmployee(null);
    form.resetFields();
  };

  const openDrawer = (employee = null) => {
    setEditingEmployee(employee);
    if (employee) {
      // Pre-check the multi-select boxes from the roles the linked user satisfies.
      const grantedRoles = employee.appAccess?.roles || [];
      // Designation mirrors access when app roles exist; else keep the HR title.
      // The designation Select uses mode="tags" (array value).
      const designation = grantedRoles.length
        ? [grantedRoles.map((role) => roleToLabel[role] || role).join(', ')]
        : (employee.designation ? [employee.designation] : []);
      form.setFieldsValue({
        ...employee,
        designation,
        branchId: branchValue(employee.branchId),
        dateOfBirth: employee.dateOfBirth ? dayjs(employee.dateOfBirth) : null,
        dateOfJoining: employee.dateOfJoining ? dayjs(employee.dateOfJoining) : null,
        appAccess: {
          roles: grantedRoles,
          enabled: Boolean(employee.appAccess?.enabled),
          username: employee.appAccess?.username,
          email: employee.appAccess?.email || employee.email,
          phone: employee.appAccess?.phone || employee.mobile,
          temporaryPassword: undefined,
        },
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
      const appAccess = values.appAccess || {};
      // Multi-select designations drive access: the ticked roles ARE the access.
      // antd Checkbox.Group yields an array; ignore any empty/falsy entries.
      const roles = (appAccess.roles || []).filter(Boolean);
      // Designation string mirrors the access (or the free-typed HR title for
      // non-app staff). The `designation` field uses mode="tags" so it's an array.
      const rawDesignation = Array.isArray(values.designation) ? values.designation[0] : values.designation;
      const designation = roles.length
        ? roles.map((role) => roleToLabel[role] || role).join(', ')
        : (rawDesignation || '');
      const payload = {
        ...values,
        designation,
        dateOfBirth: values.dateOfBirth ? values.dateOfBirth.format('YYYY-MM-DD') : null,
        dateOfJoining: values.dateOfJoining ? values.dateOfJoining.format('YYYY-MM-DD') : null,
        appAccess: {
          ...appAccess,
          roles,
          enabled: roles.length > 0,
        },
      };
      if (!designation) {
        setLoading(false);
        message.error('Select a designation or at least one app-access role.');
        return;
      }
      const response = editingEmployee
        ? await hrmsService.updateEmployee(editingEmployee._id, payload)
        : await hrmsService.createEmployee(payload);
      if (!response.success) throw new Error(response.message || 'Failed to save employee');
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
      message.success(response.message);
      if (viewEmployee?._id === employee._id) setViewEmployee(response.data);
      await Promise.all([fetchEmployees(), fetchStats()]);
    } catch (error) {
      message.error(error.message || 'Failed to deactivate employee');
    } finally {
      setLoading(false);
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
      message.success(response.message);
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
      title: 'App Access', key: 'appAccess', width: 135,
      render: (_, employee) => employee.appAccess?.linked
        ? <Tag color={accessColor(employee.appAccess.status)}>{employee.appAccess.status}</Tag>
        : <Tag>Not provisioned</Tag>,
    },
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
            description="The employee and references are preserved. Linked app access will be revoked."
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
          <p className="text-sm text-gray-500 mt-0.5">Branch-scoped employee records, lifecycle, and app access</p>
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
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({ department: undefined, status: undefined }); }}>Reset</Button>
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
                <p className="text-xs text-gray-500">Passwords are accepted only as temporary credentials and are never displayed after save.</p>
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
                  <Col xs={24} md={6}><Form.Item name="name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
                  <Col xs={24} md={5}><Form.Item name="fatherName" label="Father's Name"><Input /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="dateOfBirth" label="Date of Birth"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
                  <Col xs={24} md={4}><Form.Item name="gender" label="Gender" rules={[{ required: true }]}><Select options={GENDERS.map((value) => ({ value, label: value }))} /></Form.Item></Col>
                  <Col xs={24} md={5}><Form.Item name="mobile" label="Mobile" rules={[{ required: true }]}><Input /></Form.Item></Col>
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
                      rules={[{ required: true }]}
                      extra={
                        hasAppAccess
                          ? <span className="text-xs text-green-600">Auto-set from App Access below</span>
                          : <span className="text-xs text-gray-400">e.g. Driver, Accountant — or set App Access below</span>
                      }>
                      <Select
                        options={NON_APP_DESIGNATIONS.map((value) => ({ value, label: value }))}
                        showSearch
                        allowClear
                        // Free-form allowed for HR titles not in the list.
                        mode="tags"
                        maxCount={1}
                        placeholder="Select or type designation"
                        disabled={hasAppAccess}
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
                    <Form.Item name="branchId" label="Branch" rules={[{ required: true }]}>
                      <Select
                        options={branchOptions}
                        onChange={(value) => { if (!editingEmployee) setActiveBranch(value); }}
                        placeholder="Select an active assigned branch"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={8}><Form.Item name="empId" label="Employee Code"><Input placeholder="Auto-generated if empty" /></Form.Item></Col>
                  <Col xs={24} md={8}><Form.Item name="status" label="Status"><Select options={EMPLOYEE_STATUSES.map((value) => ({ value, label: value }))} disabled={editingEmployee?.status === 'Terminated'} /></Form.Item></Col>
                </Row>

                <Divider />
                <h3 className="text-base font-semibold text-gray-700 mb-3">App Access</h3>

                {/* ── Picking & Sorting mobile app callout ── */}
                <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">📱</span>
                    <div className="flex-1">
                      <p className="font-semibold text-blue-800 mb-1">
                        BDM Tiles — Picking &amp; Sorting mobile app
                      </p>
                      <p className="text-sm text-blue-700 mb-3">
                        Enable app access to let this employee log in to the warehouse mobile app.
                        The credentials you set here are their login details. They will be prompted
                        to change the temporary password on first login.
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="rounded bg-white border border-blue-200 p-3">
                          <p className="font-semibold text-blue-800 mb-1">📦 Picking Staff</p>
                          <p className="text-gray-600 text-xs">
                            Role: <code className="bg-blue-50 px-1 rounded">picking_staff</code>
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            Grants: assign self, start picking, record picked/short/damaged quantities,
                            confirm barcode · shade · batch, and sorting.
                          </p>
                        </div>
                        <div className="rounded bg-white border border-purple-200 p-3">
                          <p className="font-semibold text-purple-800 mb-1">🔀 Sorting / Loading Staff</p>
                          <p className="text-gray-600 text-xs">
                            Role: <code className="bg-purple-50 px-1 rounded">sorting_staff</code>
                          </p>
                          <p className="text-gray-600 text-xs mt-1">
                            Grants: verify sorting quantities, record discrepancies, pack (boxes + weight),
                            mark ready for dispatch, and scan-verify vehicle loading.
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-blue-600 mt-2">
                        💡 Tick every designation this employee works as — they can do all of them in the app.
                        Selecting multiple grants the <strong>combined</strong> permissions.
                      </p>
                    </div>
                  </div>
                </div>

                <Alert
                  className="mb-4"
                  type={editingEmployee?.appAccess?.linked ? 'success' : 'info'}
                  showIcon
                  message={
                    editingEmployee?.appAccess?.linked
                      ? `Linked account — ${editingEmployee.appAccess.role ?? 'role unknown'} · ${editingEmployee.appAccess.status}`
                      : 'No app account linked yet'
                  }
                  description={
                    editingEmployee?.appAccess?.linked
                      ? `Username: ${editingEmployee.appAccess.username}  ·  Email: ${editingEmployee.appAccess.email}${editingEmployee.appAccess.mustChangePassword ? '  ·  ⚠ Password change required on next login' : ''}`
                      : 'Enable the toggle below to create login credentials for the BDM Tiles Picking & Sorting app. The employee must change their temporary password on first login.'
                  }
                />

                {/* Multi-select designations = app access. Ticking any box grants access. */}
                <Form.Item
                  name={['appAccess', 'roles']}
                  label="Designations / Access (select one or more)"
                  extra="Each ticked designation adds its permissions. Leave all unticked for no app access.">
                  <Checkbox.Group className="w-full">
                    <Row gutter={[12, 12]}>
                      {accessRoleCheckboxes.map((option) => (
                        <Col xs={24} sm={12} md={8} key={option.value}>
                          <Checkbox value={option.value} className="w-full">
                            {option.label}
                          </Checkbox>
                        </Col>
                      ))}
                    </Row>
                  </Checkbox.Group>
                </Form.Item>

                {hasAppAccess && (
                  <>
                    {/* Combined-permission preview for every ticked designation. */}
                    <div className="mb-3 rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm">
                      <p className="font-semibold text-green-800 mb-1">
                        Combined app access ({selectedRoles.length} designation{selectedRoles.length > 1 ? 's' : ''})
                      </p>
                      <ul className="list-disc list-inside text-xs text-green-700 space-y-0.5">
                        {rolePermissionPreview(selectedRoles).map((line, index) => (
                          <li key={index}>{line}</li>
                        ))}
                      </ul>
                    </div>

                    <Row gutter={16} className="mb-2">
                      <Col xs={24} md={5}>
                        <Form.Item
                          name={['appAccess', 'username']}
                          label="Username"
                          rules={[{ required: true, message: 'Username is required' }]}
                          extra="Employee uses this to log in">
                          <Input autoComplete="off" placeholder="e.g. ravi.picker" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item
                          name={['appAccess', 'email']}
                          label="App Email"
                          rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
                          extra="Can also be used to log in">
                          <Input autoComplete="off" placeholder="employee@company.com" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={4}>
                        <Form.Item
                          name={['appAccess', 'phone']}
                          label="App Phone"
                          rules={[{ required: true, message: 'Phone is required' }]}>
                          <Input placeholder="10-digit mobile" />
                        </Form.Item>
                      </Col>
                      <Col xs={24} md={5}>
                        <Form.Item
                          name={['appAccess', 'temporaryPassword']}
                          label={editingEmployee?.appAccess?.linked ? 'Reset Temporary Password' : 'Temporary Password'}
                          rules={[
                            ...(editingEmployee?.appAccess?.linked ? [] : [{ required: true, message: 'Temporary password is required' }]),
                            { min: 10, message: 'Use at least 10 characters' },
                            {
                              validator: (_, value) => !value || (
                                /[a-z]/.test(value)
                                && /[A-Z]/.test(value)
                                && /\d/.test(value)
                                && /[^A-Za-z0-9]/.test(value)
                              ) ? Promise.resolve() : Promise.reject(new Error('Include uppercase, lowercase, number, and special character')),
                            },
                          ]}
                          extra={
                            editingEmployee?.appAccess?.linked
                              ? 'Leave blank to keep the current password.'
                              : '⚠ Employee must change this on first login (min 10 chars, mixed case + number + special).'
                          }>
                          <Input.Password autoComplete="new-password" placeholder="Min 10 chars" />
                        </Form.Item>
                      </Col>
                    </Row>

                  </>
                )}

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

      <Modal
        title={`Record employee exit${exitEmployeeRecord ? ` — ${exitEmployeeRecord.name}` : ''}`}
        open={Boolean(exitEmployeeRecord)}
        onCancel={() => { setExitEmployeeRecord(null); exitForm.resetFields(); }}
        onOk={handleExit}
        okText="Confirm Exit"
        okButtonProps={{ danger: true }}
        confirmLoading={loading}
      >
        <Alert className="mb-4" type="warning" showIcon message="This terminates employment and guarantees linked app access is revoked. Records are preserved." />
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
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700">Linked App Access</h3>
                <Tag color={accessColor(viewEmployee.appAccess?.status)}>{viewEmployee.appAccess?.status || 'Not provisioned'}</Tag>
              </div>
              {viewEmployee.appAccess?.linked ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><span className="text-gray-500 block">Username</span><strong>{viewEmployee.appAccess.username}</strong></div>
                  <div><span className="text-gray-500 block">Role</span><strong>{roleOptions.find((option) => option.value === viewEmployee.appAccess.role)?.label || viewEmployee.appAccess.role}</strong></div>
                  <div><span className="text-gray-500 block">Email</span><strong>{viewEmployee.appAccess.email}</strong></div>
                  <div><span className="text-gray-500 block">Password change</span><strong>{viewEmployee.appAccess.mustChangePassword ? 'Required' : 'Not flagged'}</strong></div>
                </div>
              ) : <span className="text-gray-500">No user account is linked to this employee.</span>}
            </div>
            {viewEmployee.status === 'Terminated' && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <strong>Exit: {viewEmployee.exitDate ? dayjs(viewEmployee.exitDate).format('DD/MM/YYYY') : '-'}</strong>
                <p className="mt-1 text-gray-700">{viewEmployee.exitReason || '-'}</p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmployeeRegistration;
