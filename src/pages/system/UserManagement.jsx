import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Checkbox,
  Divider,
  Drawer,
  Form,
  Grid,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  message,
} from 'antd';
import {
  DeleteOutlined,
  EditOutlined,
  KeyOutlined,
  LockOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const SCOPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'selected', label: 'Selected only' },
  { value: 'none', label: 'None' },
];

const EMPTY_OPTIONS = {
  branches: [],
  warehouses: [],
  regions: [],
  dealers: [],
  departments: [],
  reports: [],
  employees: [],
};

const EMPTY_AVAILABILITY = {
  warehouses: { available: true, reason: null },
  regions: { available: false, reason: 'Assignment options are loading.' },
  dealers: { available: false, reason: 'Assignment options are loading.' },
  departments: { available: false, reason: 'Assignment options are loading.' },
  reports: { available: true, reason: null },
  employees: { available: false, reason: 'Assignment options are loading.' },
};

const DIMENSION_FIELDS = {
  warehouses: 'assignedWarehouses',
  regions: 'assignedRegions',
  dealers: 'assignedDealers',
  departments: 'assignedDepartments',
  reports: 'assignedReports',
  employees: 'assignedEmployees',
};

const idsOf = (values = []) => values.map((value) => value?._id || value).filter(Boolean);

const inferredScope = (user, dimension, values) => (
  user?.assignmentScopes?.[dimension] || (values.length ? 'selected' : 'none')
);

const AssignmentScopeField = ({
  form,
  dimension,
  label,
  fieldName,
  options,
  availability,
  placeholder,
  mode = 'multiple',
  extra,
}) => {
  if (availability?.available === false) {
    return (
      <div className="mb-4">
        <div className="mb-2 text-sm font-medium text-gray-700">{label}</div>
        <Alert type="info" showIcon message="Unavailable" description={availability.reason} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
      <Form.Item
        name={['assignmentScopes', dimension]}
        label={`${label} Scope`}
        rules={[{ required: true, message: `Select a ${label.toLowerCase()} scope` }]}
        extra={extra}
      >
        <Select
          options={availability?.allowAll === false
            ? SCOPE_OPTIONS.filter((option) => option.value !== 'all')
            : SCOPE_OPTIONS}
          onChange={(scope) => {
            if (scope !== 'selected') form.setFieldValue(fieldName, []);
          }}
        />
      </Form.Item>
      <Form.Item noStyle shouldUpdate={(previous, current) => (
        previous.assignmentScopes?.[dimension] !== current.assignmentScopes?.[dimension]
      )}>
        {() => form.getFieldValue(['assignmentScopes', dimension]) === 'selected' ? (
          <Form.Item
            name={fieldName}
            label={`Selected ${label}`}
            rules={[{ required: true, type: 'array', min: 1, message: `Select at least one ${label.toLowerCase()}` }]}
          >
            <Select
              mode={mode}
              showSearch
              allowClear
              optionFilterProp="label"
              placeholder={placeholder}
              options={options}
              tokenSeparators={mode === 'tags' ? [','] : undefined}
            />
          </Form.Item>
        ) : (
          <div className="mb-4 flex min-h-16 items-center rounded-md bg-gray-50 px-3 text-xs text-gray-500">
            {form.getFieldValue(['assignmentScopes', dimension]) === 'all'
              ? `All permitted ${label.toLowerCase()} are in scope; no individual selections are stored.`
              : `No ${label.toLowerCase()} are in scope.`}
          </div>
        )}
      </Form.Item>
    </div>
  );
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [branchFilter, setBranchFilter] = useState(undefined);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [permissionDrawerOpen, setPermissionDrawerOpen] = useState(false);
  const [resetPasswordModalOpen, setResetPasswordModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [permissionsConfig, setPermissionsConfig] = useState({});
  const [rolePermissions, setRolePermissions] = useState({});
  const [roleInfo, setRoleInfo] = useState({});
  const [assignmentOptions, setAssignmentOptions] = useState(EMPTY_OPTIONS);
  const [assignmentAvailability, setAssignmentAvailability] = useState(EMPTY_AVAILABILITY);
  const [form] = Form.useForm();
  const [resetPasswordForm] = Form.useForm();

  const roleOptions = Object.entries(roleInfo).map(([value, info]) => ({
    value,
    label: info.name,
    title: info.description,
  }));
  const manageableRoleOptions = roleOptions.filter(({ value }) => {
    if (currentUser?.role === 'super_admin') return true;
    if (value === 'super_admin' || value === 'owner') return false;
    return (roleInfo[value]?.rank ?? Number.POSITIVE_INFINITY)
      < (roleInfo[currentUser?.role]?.rank ?? Number.NEGATIVE_INFINITY);
  });
  const branches = assignmentOptions.branches;
  const allPermissionOptions = Object.values(permissionsConfig)
    .flat()
    .filter((permission) => permission.id !== '*')
    .map((permission) => ({ value: permission.id, label: permission.name }));

  const fetchUsers = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(branchFilter && { branch: branchFilter }),
        excludeRole: 'dealer',
      };
      const response = await userService.getUsers(params);
      if (response.success) {
        setUsers(response.data);
        setPagination({
          current: response.pagination.currentPage,
          pageSize: response.pagination.itemsPerPage,
          total: response.pagination.totalItems,
        });
      }
    } catch (error) {
      message.error(error.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [branchFilter, roleFilter, search, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    const loadMetadata = async () => {
      setMetadataLoading(true);
      try {
        const [configResponse, optionsResponse] = await Promise.all([
          userService.getPermissionsConfig(),
          userService.getAssignmentOptions(),
        ]);
        if (configResponse.success) {
          setPermissionsConfig(configResponse.permissions || {});
          setRolePermissions(configResponse.rolePermissions || {});
          setRoleInfo(configResponse.roleInfo || {});
        }
        if (optionsResponse.success) {
          setAssignmentOptions({ ...EMPTY_OPTIONS, ...(optionsResponse.data || {}) });
          setAssignmentAvailability({ ...EMPTY_AVAILABILITY, ...(optionsResponse.availability || {}) });
        }
      } catch (error) {
        message.error(error.message || 'Failed to load user assignment options');
      } finally {
        setMetadataLoading(false);
      }
    };
    loadMetadata();
  }, []);

  const openUserModal = (user = null) => {
    setSelectedUser(user);
    if (!user) {
      form.resetFields();
      form.setFieldsValue({
        status: 'Active',
        permissionMode: 'role_default',
        permissions: [],
        assignedBranches: [],
        assignedWarehouses: [],
        assignedRegions: [],
        assignedDealers: [],
        assignedDepartments: [],
        assignedReports: [],
        assignedEmployees: [],
        assignmentScopes: {
          warehouses: 'none',
          regions: 'none',
          dealers: 'none',
          departments: 'none',
          reports: 'none',
          employees: 'none',
        },
      });
    } else {
      const assignedWarehouses = user.assignedWarehouses?.length
        ? idsOf(user.assignedWarehouses)
        : idsOf(user.assignedWarehouse ? [user.assignedWarehouse] : []);
      const assignedRegions = idsOf(user.assignedRegions);
      const assignedDealers = idsOf(user.assignedDealers);
      const assignedDepartments = user.assignedDepartments || [];
      const assignedReports = user.assignedReports || [];
      const assignedEmployees = idsOf(user.assignedEmployees);
      form.setFieldsValue({
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        permissionMode: user.permissionMode || 'custom',
        permissions: (user.permissions || []).filter((permission) => permission !== '*'),
        assignedBranches: idsOf(user.assignedBranches),
        defaultBranch: user.defaultBranch?._id || user.defaultBranch,
        assignedWarehouses,
        assignedRegions,
        assignedDealers,
        assignedDepartments,
        assignedReports,
        assignedEmployees,
        assignmentScopes: {
          warehouses: inferredScope(user, 'warehouses', assignedWarehouses),
          regions: inferredScope(user, 'regions', assignedRegions),
          dealers: inferredScope(user, 'dealers', assignedDealers),
          departments: inferredScope(user, 'departments', assignedDepartments),
          reports: inferredScope(user, 'reports', assignedReports),
          employees: inferredScope(user, 'employees', assignedEmployees),
        },
        password: '',
      });
    }
    setUserModalOpen(true);
  };

  const closeUserModal = () => {
    setUserModalOpen(false);
    form.resetFields();
    setSelectedUser(null);
  };

  const handleSaveUser = async () => {
    try {
      const values = await form.validateFields();
      if (values.defaultBranch && !(values.assignedBranches || []).includes(values.defaultBranch)) {
        message.error('Default branch must be selected in Assigned Branches');
        return;
      }
      if (selectedUser) delete values.password;
      if (values.permissionMode === 'role_default') delete values.permissions;
      else values.permissions = (values.permissions || []).filter((permission) => permission !== '*');

      const scopes = { ...(values.assignmentScopes || {}) };
      Object.entries(DIMENSION_FIELDS).forEach(([dimension, fieldName]) => {
        if (assignmentAvailability[dimension]?.available === false) {
          delete scopes[dimension];
          delete values[fieldName];
        }
      });
      values.assignmentScopes = scopes;

      setLoading(true);
      const response = selectedUser
        ? await userService.updateUser(selectedUser._id, values)
        : await userService.createUser(values);
      if (response.success) {
        message.success(selectedUser ? 'User updated' : 'User created');
        closeUserModal();
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (userId) => {
    try {
      const response = await userService.deleteUser(userId);
      if (response.success) {
        message.success('User deleted');
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      message.error(error.message || 'Failed to delete user');
    }
  };

  const handleAdminResetPassword = async () => {
    try {
      const { temporaryPassword } = await resetPasswordForm.validateFields();
      setLoading(true);
      const response = await userService.resetPassword(resetPasswordUser._id, { temporaryPassword });
      if (response.success) {
        message.success('Temporary password set and active sessions revoked');
        setResetPasswordModalOpen(false);
        setResetPasswordUser(null);
        resetPasswordForm.resetFields();
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePermissions = async (permissions) => {
    try {
      const safePermissions = permissions.filter((permission) => permission !== '*');
      const response = await userService.updatePermissions(selectedUser._id, { permissions: safePermissions });
      if (response.success) {
        message.success('Custom permissions updated');
        setPermissionDrawerOpen(false);
        setSelectedUser(null);
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      message.error(error.message || 'Failed to update permissions');
    }
  };

  const handleResetPermissions = async () => {
    try {
      const response = await userService.resetPermissions(selectedUser._id);
      if (response.success) {
        message.success('Permissions reset to role defaults');
        setPermissionDrawerOpen(false);
        setSelectedUser(null);
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      message.error(error.message || 'Failed to reset permissions');
    }
  };

  const selectedBranchIds = Form.useWatch('assignedBranches', form) || [];
  const selectedRegionIds = Form.useWatch('assignedRegions', form) || [];
  const regionScope = Form.useWatch(['assignmentScopes', 'regions'], form);
  const warehouseOptions = assignmentOptions.warehouses
    .filter((warehouse) => selectedBranchIds.includes(warehouse.branch?._id || warehouse.branch))
    .map((warehouse) => ({
      value: warehouse._id,
      label: `${warehouse.warehouseCode || 'Warehouse'} — ${warehouse.name}`,
    }));
  const dealerOptions = assignmentOptions.dealers
    .filter((dealer) => regionScope !== 'selected'
      || selectedRegionIds.includes(dealer.assignedRegion?._id || dealer.assignedRegion))
    .map((dealer) => ({
      value: dealer._id,
      label: `${dealer.dealerCode || 'Dealer'} — ${dealer.businessName}`,
    }));

  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#FF5F03]/10 text-sm font-semibold text-[#FF5F03]">
            {record.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{record.name}</div>
            <div className="text-xs text-gray-500">{record.email}</div>
          </div>
        </div>
      ),
    },
    { title: 'Phone', dataIndex: 'phone', key: 'phone' },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={roleInfo[role]?.color || 'default'}>
          {roleInfo[role]?.name || role}
        </Tag>
      ),
    },
    {
      title: 'Branches',
      key: 'branches',
      render: (_, record) => {
        const assigned = record.assignedBranches || [];
        if (!assigned.length) return <span className="text-xs text-amber-600">Not assigned</span>;
        return (
          <Space size={[0, 4]} wrap>
            {assigned.slice(0, 2).map((branch) => (
              <Tag key={branch._id || branch}>{branch.branchCode || branch.name || branch}</Tag>
            ))}
            {assigned.length > 2 && <Tag>+{assigned.length - 2}</Tag>}
          </Space>
        );
      },
    },
    {
      title: 'Warehouses',
      key: 'warehouses',
      render: (_, record) => {
        const assigned = record.assignedWarehouses?.length
          ? record.assignedWarehouses
          : (record.assignedWarehouse ? [record.assignedWarehouse] : []);
        const scope = record.assignmentScopes?.warehouses || (assigned.length ? 'selected' : 'none');
        if (scope !== 'selected') return <Tag>{scope}</Tag>;
        return <span className="text-xs text-gray-600">{assigned.length} selected</span>;
      },
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_, record) => (
        <div className="text-xs text-gray-500">
          <div>{record.permissions?.includes('*') ? 'All access' : `${record.permissions?.length || 0} permissions`}</div>
          <div>{record.permissionMode === 'role_default' ? 'Role defaults' : 'Custom'}</div>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>,
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      render: (date) => (
        <span className="text-xs text-gray-500">
          {date ? new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Never'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openUserModal(record)} />
          </Tooltip>
          <Tooltip title="Permissions">
            <Button
              type="text"
              size="small"
              icon={<KeyOutlined />}
              onClick={() => { setSelectedUser(record); setPermissionDrawerOpen(true); }}
              className="text-green-600"
            />
          </Tooltip>
          {record._id !== currentUser?._id && (
            <Tooltip title="Reset Password">
              <Button
                type="text"
                size="small"
                icon={<LockOutlined />}
                className="text-orange-600"
                onClick={() => {
                  setResetPasswordUser(record);
                  resetPasswordForm.resetFields();
                  setResetPasswordModalOpen(true);
                }}
              />
            </Tooltip>
          )}
          {record._id !== currentUser?._id && (
            <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record._id)} okText="Yes" cancelText="No">
              <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="mt-0.5 text-sm text-gray-500">Manage users, role-derived permissions, and assignment scopes</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal()} size="large" loading={metadataLoading}>
          Add New User
        </Button>
      </div>

      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Input
            placeholder="Search by name, email, phone..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:w-64"
            allowClear
          />
          <Select placeholder="All Roles" options={roleOptions.filter((option) => option.value !== 'dealer')} value={roleFilter} onChange={setRoleFilter} allowClear className="sm:w-44" />
          <Select
            placeholder="All Branches"
            options={branches.map((branch) => ({ value: branch._id, label: `${branch.branchCode} — ${branch.name}` }))}
            value={branchFilter}
            onChange={setBranchFilter}
            allowClear
            className="sm:w-52"
          />
          <Select
            placeholder="All Status"
            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            className="sm:w-36"
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setRoleFilter(undefined); setStatusFilter(undefined); setBranchFilter(undefined); }}>
            Reset
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        <Table
          columns={columns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} users`,
          }}
          onChange={(page) => fetchUsers(page.current, page.pageSize)}
          scroll={{ x: 1250 }}
          size="middle"
        />
      </div>

      <Modal
        title={selectedUser ? 'Edit User' : 'Add New User'}
        open={userModalOpen}
        onCancel={closeUserModal}
        onOk={handleSaveUser}
        okText={selectedUser ? 'Update' : 'Create'}
        confirmLoading={loading}
        width="min(960px, 94vw)"
        style={{ top: 20 }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
            <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}><Input /></Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Username is required' }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}><Input /></Form.Item>
            <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Phone is required' }]}><Input /></Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
              <Select options={manageableRoleOptions} optionFilterProp="label" showSearch />
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
            </Form.Item>
          </div>

          <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
            <Form.Item name="permissionMode" label="Permission Mode" rules={[{ required: true }]}>
              <Select options={[
                { value: 'role_default', label: 'Use role defaults' },
                { value: 'custom', label: 'Custom permissions' },
              ]} />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(previous, current) => previous.permissionMode !== current.permissionMode || previous.role !== current.role}>
              {() => form.getFieldValue('permissionMode') === 'custom' ? (
                <Form.Item name="permissions" label="Custom Permissions">
                  <Select mode="multiple" showSearch allowClear optionFilterProp="label" options={allPermissionOptions} placeholder="Select permissions" />
                </Form.Item>
              ) : (
                <div className="mb-4 flex min-h-16 items-center rounded-md bg-blue-50 px-3 text-xs text-blue-700">
                  Defaults come from the backend role configuration ({(rolePermissions[form.getFieldValue('role')] || []).length} configured).
                </div>
              )}
            </Form.Item>
          </div>

          <Divider orientation="left">Branch Assignment</Divider>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
            <Form.Item name="assignedBranches" label="Assigned Branches" rules={[{ required: branches.length > 0, type: 'array', min: branches.length > 0 ? 1 : 0, message: 'Assign at least one branch' }]}>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                options={branches.map((branch) => ({ value: branch._id, label: `${branch.branchCode} — ${branch.name}` }))}
                onChange={(selected) => {
                  const currentDefault = form.getFieldValue('defaultBranch');
                  if (currentDefault && !selected.includes(currentDefault)) form.setFieldValue('defaultBranch', undefined);
                  const allowedWarehouses = new Set(assignmentOptions.warehouses
                    .filter((warehouse) => selected.includes(warehouse.branch?._id || warehouse.branch))
                    .map((warehouse) => warehouse._id));
                  form.setFieldValue('assignedWarehouses', (form.getFieldValue('assignedWarehouses') || [])
                    .filter((warehouseId) => allowedWarehouses.has(warehouseId)));
                }}
              />
            </Form.Item>
            <Form.Item noStyle shouldUpdate={(previous, current) => previous.assignedBranches !== current.assignedBranches}>
              {() => (
                <Form.Item name="defaultBranch" label="Default Branch">
                  <Select
                    allowClear
                    options={branches
                      .filter((branch) => (form.getFieldValue('assignedBranches') || []).includes(branch._id))
                      .map((branch) => ({ value: branch._id, label: `${branch.branchCode} — ${branch.name}` }))}
                  />
                </Form.Item>
              )}
            </Form.Item>
          </div>

          <Divider orientation="left">Assignment Scopes</Divider>
          <AssignmentScopeField form={form} dimension="warehouses" label="Warehouses" fieldName="assignedWarehouses" options={warehouseOptions} availability={assignmentAvailability.warehouses} placeholder="Select warehouses" />
          <AssignmentScopeField
            form={form}
            dimension="regions"
            label="Regions"
            fieldName="assignedRegions"
            options={assignmentOptions.regions.map((region) => ({ value: region._id, label: region.state ? `${region.name} — ${region.state}` : region.name }))}
            availability={assignmentAvailability.regions}
            placeholder="Select regions"
          />
          <AssignmentScopeField form={form} dimension="dealers" label="Dealers" fieldName="assignedDealers" options={dealerOptions} availability={assignmentAvailability.dealers} placeholder="Select dealers" extra="When region scope is selected, dealers must belong to those regions." />
          <AssignmentScopeField
            form={form}
            dimension="departments"
            label="Departments"
            fieldName="assignedDepartments"
            options={assignmentOptions.departments.map((department) => ({ value: department, label: department }))}
            availability={assignmentAvailability.departments}
            placeholder="Select or enter departments"
            mode="tags"
          />
          <AssignmentScopeField
            form={form}
            dimension="reports"
            label="Reports"
            fieldName="assignedReports"
            options={assignmentOptions.reports.map((report) => ({ value: report.id, label: report.name }))}
            availability={assignmentAvailability.reports}
            placeholder="Select report permissions"
            extra="Only canonical report permissions that you can grant are listed."
          />
          <AssignmentScopeField
            form={form}
            dimension="employees"
            label="Employees"
            fieldName="assignedEmployees"
            options={assignmentOptions.employees.map((employee) => ({
              value: employee._id,
              label: `${employee.name} (${employee.empId || 'No ID'})${employee.designation ? ` — ${employee.designation}` : ''}`,
            }))}
            availability={assignmentAvailability.employees}
            placeholder="Select employees"
          />

          {!selectedUser && (
            <>
              <Divider />
              <Form.Item
                name="password"
                label="Initial Password"
                rules={[
                  { required: true, min: 10, message: 'Use at least 10 characters' },
                  {
                    validator: (_, value) => !value || (
                      /[a-z]/.test(value)
                      && /[A-Z]/.test(value)
                      && /\d/.test(value)
                      && /[^A-Za-z0-9]/.test(value)
                    ) ? Promise.resolve() : Promise.reject(new Error('Include uppercase, lowercase, number, and special character')),
                  },
                ]}
              >
                <Input.Password autoComplete="new-password" />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>

      <Modal
        title={`Reset Password${resetPasswordUser ? ` — ${resetPasswordUser.name}` : ''}`}
        open={resetPasswordModalOpen}
        onCancel={() => {
          setResetPasswordModalOpen(false);
          setResetPasswordUser(null);
          resetPasswordForm.resetFields();
        }}
        onOk={handleAdminResetPassword}
        okText="Set Temporary Password"
        confirmLoading={loading}
        destroyOnHidden
      >
        <Alert
          className="mb-4"
          type="warning"
          showIcon
          message="All active sessions will be revoked"
          description="The user must sign in with this temporary password and change it before accessing business modules."
        />
        <Form form={resetPasswordForm} layout="vertical">
          <Form.Item
            name="temporaryPassword"
            label="Temporary Password"
            rules={[
              { required: true, min: 10, message: 'Use at least 10 characters' },
              {
                validator: (_, value) => !value || (
                  /[a-z]/.test(value)
                  && /[A-Z]/.test(value)
                  && /\d/.test(value)
                  && /[^A-Za-z0-9]/.test(value)
                ) ? Promise.resolve() : Promise.reject(new Error('Include uppercase, lowercase, number, and special character')),
              },
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
          <Form.Item
            name="confirmTemporaryPassword"
            label="Confirm Temporary Password"
            dependencies={['temporaryPassword']}
            rules={[
              { required: true, message: 'Confirm the temporary password' },
              ({ getFieldValue }) => ({
                validator: (_, value) => value === getFieldValue('temporaryPassword')
                  ? Promise.resolve()
                  : Promise.reject(new Error('Passwords do not match')),
              }),
            ]}
          >
            <Input.Password autoComplete="new-password" />
          </Form.Item>
        </Form>
      </Modal>

      <PermissionDrawer
        open={permissionDrawerOpen}
        onClose={() => { setPermissionDrawerOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        roleInfo={roleInfo}
        permissionsConfig={permissionsConfig}
        onSave={handleSavePermissions}
        onReset={handleResetPermissions}
      />
    </div>
  );
};

const PermissionDrawer = ({ open, onClose, user, roleInfo, permissionsConfig, onSave, onReset }) => {
  const screens = Grid.useBreakpoint();
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    setSelectedPermissions((user?.permissions || []).filter((permission) => permission !== '*'));
  }, [user]);

  if (!user) return null;
  const unrestricted = (user.permissions || []).includes('*');

  return (
    <Drawer
      title={`Permissions — ${user.name}`}
      open={open}
      onClose={onClose}
      width={screens.md ? 520 : '100%'}
      extra={unrestricted ? (
        user.permissionMode === 'custom' ? <Button onClick={onReset}>Use Role Defaults</Button> : null
      ) : (
        <Space>
          {user.permissionMode === 'custom' && <Button onClick={onReset}>Use Role Defaults</Button>}
          <Button type="primary" onClick={() => onSave(selectedPermissions)}>Save as Custom</Button>
        </Space>
      )}
    >
      {unrestricted ? (
        <div className="py-8 text-center text-gray-500">
          <KeyOutlined className="mb-3 text-4xl text-[#FF5F03]" />
          <p className="text-lg font-medium text-gray-700">{roleInfo[user.role]?.name || user.role}</p>
          <p className="text-sm">This role has unrestricted server-defined access. The UI never grants the wildcard permission.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <Alert
            type={user.permissionMode === 'role_default' ? 'info' : 'warning'}
            showIcon
            message={user.permissionMode === 'role_default' ? 'Using backend role defaults' : 'Using custom permissions'}
            description="Saving selections switches this user to custom mode. Use Role Defaults to discard custom grants."
          />
          <div className="text-sm text-gray-500">Selected: <strong className="text-gray-800">{selectedPermissions.length}</strong> permissions</div>
          {Object.entries(permissionsConfig).map(([category, permissions]) => {
            const safePermissions = permissions.filter((permission) => permission.id !== '*');
            const allSelected = safePermissions.length > 0
              && safePermissions.every((permission) => selectedPermissions.includes(permission.id));
            return (
              <div key={category} className="rounded-lg border border-gray-100 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">{category}</h4>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      const ids = safePermissions.map((permission) => permission.id);
                      setSelectedPermissions((previous) => allSelected
                        ? previous.filter((permission) => !ids.includes(permission))
                        : [...new Set([...previous, ...ids])]);
                    }}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {safePermissions.map((permission) => (
                    <Checkbox
                      key={permission.id}
                      checked={selectedPermissions.includes(permission.id)}
                      onChange={() => setSelectedPermissions((previous) => previous.includes(permission.id)
                        ? previous.filter((item) => item !== permission.id)
                        : [...previous, permission.id])}
                    >
                      <span className="text-sm text-gray-700">{permission.name}</span>
                    </Checkbox>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Drawer>
  );
};

export default UserManagement;
