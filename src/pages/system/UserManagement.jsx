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
  ExclamationCircleOutlined,
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

const AccountAccessPreview = ({ form, permissionsConfig, rolePermissions, roleInfo }) => (
  <Form.Item
    noStyle
    shouldUpdate={(previous, current) => (
      previous.role !== current.role
      || previous.permissionMode !== current.permissionMode
      || previous.permissions !== current.permissions
    )}
  >
    {() => {
      const role = form.getFieldValue('role');
      if (!role) return null;

      const permissionMode = form.getFieldValue('permissionMode') || 'role_default';
      const roleDefaultPermissionIds = rolePermissions[role] || [];
      const grantedPermissionIds = permissionMode === 'custom'
        ? (form.getFieldValue('permissions') || [])
        : roleDefaultPermissionIds;
      const grantsAllPermissions = grantedPermissionIds.includes('*');
      const appPermissionCatalog = Object.entries(permissionsConfig)
        .filter(([category]) => category.toLowerCase().includes('app'))
        .map(([category, permissions]) => ({
          category,
          permissions: (permissions || []).filter((permission) => permission.id !== '*'),
        }))
        .filter((group) => group.permissions.length > 0);
      const grantedAppPermissionGroups = appPermissionCatalog
        .map((group) => ({
          ...group,
          permissions: group.permissions.filter((permission) => (
            grantsAllPermissions || grantedPermissionIds.includes(permission.id)
          )),
        }))
        .filter((group) => group.permissions.length > 0);
      const pickingSortingCatalog = appPermissionCatalog.filter(({ category }) => {
        const normalizedCategory = category.toLowerCase();
        return normalizedCategory.includes('picking') && normalizedCategory.includes('sorting');
      });
      const pickingSortingPermissionIds = new Set(
        pickingSortingCatalog.flatMap((group) => group.permissions.map((permission) => permission.id)),
      );
      const roleHasPickingSortingAccess = pickingSortingPermissionIds.size > 0 && (
        roleDefaultPermissionIds.includes('*')
        || roleDefaultPermissionIds.some((permissionId) => pickingSortingPermissionIds.has(permissionId))
      );
      const accountHasPickingSortingAccess = pickingSortingPermissionIds.size > 0 && (
        grantsAllPermissions
        || grantedPermissionIds.some((permissionId) => pickingSortingPermissionIds.has(permissionId))
      );
      const selectedRoleInfo = roleInfo[role];

      return (
        <div className="mb-4 rounded-lg border border-blue-100 bg-blue-50/60 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-800">Selected role</span>
            <Tag color={selectedRoleInfo?.color || 'default'}>{selectedRoleInfo?.name || role}</Tag>
            <Tag>{permissionMode === 'custom' ? 'Custom permissions' : 'Role defaults'}</Tag>
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {selectedRoleInfo?.description || 'No role description is available.'}
          </p>

          <div className="mt-3 border-t border-blue-100 pt-3">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-blue-800">
              Application permission preview
            </div>
            {grantedAppPermissionGroups.length ? (
              <div className="space-y-2">
                {grantedAppPermissionGroups.map((group) => (
                  <div key={group.category} className="flex flex-wrap items-center gap-1.5">
                    <span className="mr-1 text-xs font-medium text-gray-700">{group.category}</span>
                    {group.permissions.map((permission) => (
                      <Tag key={permission.id} color="blue">{permission.name}</Tag>
                    ))}
                  </div>
                ))}
              </div>
            ) : (
              <span className="text-xs text-gray-500">
                No application-specific permissions are granted by the current permission mode.
              </span>
            )}
          </div>

          {(roleHasPickingSortingAccess || accountHasPickingSortingAccess) && (
            <Alert
              className="mt-3"
              type="info"
              showIcon
              message={`${pickingSortingCatalog.map((group) => group.category).join(', ')} assignment guidance`}
              description="Assign at least one branch, choose the default branch used after sign-in, and set Warehouse Scope to All or Selected. Selected warehouses are limited to the assigned branches."
            />
          )}
        </div>
      );
    }}
  </Form.Item>
);

const UserManagement = () => {
  const { user: currentUser, refreshUser } = useAuth();
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
  // Grants that carry approval authority or administrative control, from the backend
  // so the warning list stays in one place.
  const [sensitivePermissions, setSensitivePermissions] = useState({});
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
  // Grouped permission options so the Add/Edit modal list mirrors the drawer —
  // each backend category (including "Picking & Sorting App") shows as its own
  // labeled section, with the app's Picking / Sorting / Loading permissions listed.
  const allPermissionOptions = Object.entries(permissionsConfig)
    .map(([category, permissions]) => ({
      label: category,
      options: (permissions || [])
        .filter((permission) => permission.id !== '*')
        .map((permission) => ({ value: permission.id, label: permission.name })),
    }))
    .filter((group) => group.options.length > 0);

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
          setSensitivePermissions(configResponse.sensitivePermissions || {});
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
      const editedUserId = selectedUser?._id;
      const response = selectedUser
        ? await userService.updateUser(editedUserId, values)
        : await userService.createUser(values);
      if (response.success) {
        message.success(selectedUser ? 'User updated' : 'User created');
        closeUserModal();
        await refreshSelfIfNeeded(editedUserId);
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      if (error.errorFields) return;
      if (error.code === 'PHONE_ALREADY_USED') {
        const duplicateMessage = error.message || 'This phone number is already used by another user.';
        form.setFields([{ name: 'phone', errors: [duplicateMessage] }]);
        message.error(duplicateMessage);
        return;
      }
      message.error(error.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  // Deactivation, not deletion — the backend never removes a user record. A Sales
  // Executive who still holds dealers is refused with 409 and the dealer list,
  // because a dealer's branch is derived from their executive; that response has to
  // be handled or the account simply cannot be deactivated from this screen.
  const handleDelete = async (userId, options = {}) => {
    try {
      const response = await userService.deactivateUser(userId, {
        reason: options.reason || 'Administrative deactivation',
        ...(options.reassignDealersTo ? { reassignDealersTo: options.reassignDealersTo } : {}),
        ...(options.unassignDealers ? { unassignDealers: true } : {}),
      });
      if (response.success) {
        message.success(response.message || 'User deactivated');
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      if (error.code === 'DEALERS_STILL_ASSIGNED' || error.details?.dealers?.length) {
        promptDealerHandover(userId, error);
        return;
      }
      message.error(error.message || 'Failed to deactivate user');
    }
  };

  const promptDealerHandover = (userId, error) => {
    const dealers = error.details?.dealers || [];
    // Only executives who can actually own dealers are offered as a destination.
    const candidates = users.filter((candidate) => candidate._id !== userId
      && candidate.status === 'Active'
      && candidate.role === 'sales_executive');
    let selectedTarget;
    let handoverChoice = candidates.length ? 'reassign' : 'unassign';

    Modal.confirm({
      title: 'This user still holds dealers',
      icon: <ExclamationCircleOutlined style={{ color: '#d46b08' }} />,
      width: 640,
      okText: 'Deactivate',
      okButtonProps: { danger: true },
      content: (
        <div>
          <p className="mb-2 text-sm">
            {dealers.length} dealer{dealers.length === 1 ? ' is' : 's are'} assigned to this account. Decide where
            they go before the account is deactivated.
          </p>
          {dealers.length > 0 && (
            <div className="mb-3 max-h-32 overflow-auto rounded bg-gray-50 p-2 text-xs">
              {dealers.map((dealer) => (
                <div key={dealer._id || dealer.dealerCode}>
                  {dealer.dealerCode ? `${dealer.dealerCode} — ` : ''}{dealer.businessName || dealer.name}
                </div>
              ))}
            </div>
          )}
          <Select
            className="mb-2 w-full"
            defaultValue={handoverChoice}
            onChange={(value) => { handoverChoice = value; }}
            options={[
              { value: 'reassign', label: 'Reassign to another sales executive', disabled: candidates.length === 0 },
              { value: 'unassign', label: 'Leave the dealers unassigned' },
            ]}
          />
          <Select
            className="w-full"
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={candidates.length ? 'Select the receiving sales executive' : 'No other active sales executive available'}
            disabled={candidates.length === 0}
            onChange={(value) => { selectedTarget = value; }}
            options={candidates.map((candidate) => ({
              value: candidate._id,
              label: `${candidate.name} (${candidate.username})`,
            }))}
          />
        </div>
      ),
      onOk: async () => {
        if (handoverChoice === 'reassign' && !selectedTarget) {
          message.warning('Select the sales executive who will take over these dealers.');
          return Promise.reject(new Error('handover target required'));
        }
        return handleDelete(userId, handoverChoice === 'reassign'
          ? { reassignDealersTo: selectedTarget }
          : { unassignDealers: true });
      },
    });
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

  // When the edited user is the currently logged-in user, refresh the auth session
  // so their OWN sidebar/menu reflects the new permissions immediately (otherwise
  // the sidebar stays stale until a full page reload / re-login).
  const refreshSelfIfNeeded = async (editedUserId) => {
    if (editedUserId && currentUser?._id === editedUserId) {
      try { await refreshUser(); } catch { /* non-fatal: menu updates on next load */ }
    }
  };

  const handleSavePermissions = async (permissions) => {
    try {
      const editedUserId = selectedUser._id;
      const safePermissions = permissions.filter((permission) => permission !== '*');
      const response = await userService.updatePermissions(editedUserId, { permissions: safePermissions });
      if (response.success) {
        message.success('Custom permissions updated');
        setPermissionDrawerOpen(false);
        setSelectedUser(null);
        await refreshSelfIfNeeded(editedUserId);
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (error) {
      message.error(error.message || 'Failed to update permissions');
    }
  };

  const handleResetPermissions = async () => {
    try {
      const editedUserId = selectedUser._id;
      const response = await userService.resetPermissions(editedUserId);
      if (response.success) {
        message.success('Permissions reset to role defaults');
        setPermissionDrawerOpen(false);
        setSelectedUser(null);
        await refreshSelfIfNeeded(editedUserId);
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
      render: (_, record) => {
        const granted = record.permissions || [];
        const unrestricted = granted.includes('*');
        const preset = rolePermissions?.[record.role] || [];
        const presetSet = new Set(preset);
        const extra = unrestricted || presetSet.has('*')
          ? []
          : granted.filter((permission) => !presetSet.has(permission));
        const sensitiveExtra = extra.filter((permission) => sensitivePermissions[permission]);

        return (
          <div className="text-xs text-gray-500">
            <div>{unrestricted ? 'All access' : `${granted.length} permissions`}</div>
            <div>{record.permissionMode === 'role_default' ? 'Role defaults' : 'Custom'}</div>
            {/* An account holding far more than its role intends is the thing a
                reviewer needs to spot from the list, not from a drawer. */}
            {extra.length > 0 && (
              <Tooltip
                title={sensitiveExtra.length
                  ? `${extra.length} permission(s) beyond the ${roleInfo[record.role]?.name || record.role} preset, including ${sensitiveExtra.length} high-authority one(s).`
                  : `${extra.length} permission(s) beyond the ${roleInfo[record.role]?.name || record.role} preset.`}
              >
                <Tag
                  color={sensitiveExtra.length ? 'red' : 'orange'}
                  className="mt-1 cursor-help"
                  icon={sensitiveExtra.length ? <ExclamationCircleOutlined /> : undefined}
                >
                  +{extra.length} beyond role
                </Tag>
              </Tooltip>
            )}
          </div>
        );
      },
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
            <Popconfirm
              title="Deactivate this user?"
              description="The account is disabled and signed out everywhere. No records are deleted."
              onConfirm={() => handleDelete(record._id)}
              okText="Deactivate"
              okButtonProps={{ danger: true }}
              cancelText="Cancel"
            >
              <Tooltip title="Deactivate"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
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
          <p className="mt-0.5 text-sm text-gray-500">Manage application login, roles, permissions, branches, and operational access in one place</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal()} size="large" loading={metadataLoading}>
          Add Application User
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
          <Button icon={<ReloadOutlined />} onClick={() => fetchUsers(pagination.current, pagination.pageSize)} loading={loading}>
            Refresh
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
        title={selectedUser ? 'Edit Account & Application Access' : 'Add Account & Application Access'}
        open={userModalOpen}
        onCancel={closeUserModal}
        onOk={handleSaveUser}
        okText={selectedUser ? 'Update Account' : 'Create Account'}
        confirmLoading={loading}
        width="min(960px, 94vw)"
        style={{ top: 20 }}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Alert
            className="mb-2"
            type="info"
            showIcon
            message="Application account access is managed here"
            description="Application login, roles, permissions, branches, and warehouse access are managed in User Management. HRMS stores employee details only."
          />
          <Divider orientation="left">Account &amp; Application Access</Divider>
          <div className="grid grid-cols-1 gap-0 md:grid-cols-2 md:gap-4">
            <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}><Input /></Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Username is required' }]}><Input /></Form.Item>
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}><Input /></Form.Item>
            <Form.Item
              name="phone"
              label="Mobile Number"
              rules={[
                { required: true, message: 'Mobile number is required' },
                {
                  validator: (_, value) => {
                    if (!value) return Promise.resolve();
                    const input = String(value).trim();
                    const digits = input.replace(/\D/g, '');
                    return /^[\d\s()+.-]+$/.test(input) && digits.length >= 10 && digits.length <= 15
                      ? Promise.resolve()
                      : Promise.reject(new Error('Enter a valid mobile number using digits and standard formatting'));
                  },
                },
              ]}
            >
              <Input inputMode="tel" autoComplete="tel" maxLength={20} placeholder="e.g. 9876543210" />
            </Form.Item>
            <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
              <Select options={manageableRoleOptions} optionFilterProp="label" showSearch />
            </Form.Item>
            <Form.Item
              name="status"
              label="Status"
              extra={selectedUser?.status === 'Active'
                ? 'Use the deactivate action in the row menu to switch an active user off — it captures a reason and handles dependent records.'
                : undefined}
            >
              <Select
                options={[
                  { value: 'Active', label: 'Active' },
                  {
                    value: 'Inactive',
                    label: 'Inactive',
                    // The server rejects Active → Inactive here on purpose; offering
                    // it would only produce a confusing 422.
                    disabled: selectedUser?.status === 'Active',
                  },
                ]}
              />
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

          <AccountAccessPreview
            form={form}
            permissionsConfig={permissionsConfig}
            rolePermissions={rolePermissions}
            roleInfo={roleInfo}
          />

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
        width={580}
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
        rolePermissions={rolePermissions}
        sensitivePermissions={sensitivePermissions}
        onSave={handleSavePermissions}
        onReset={handleResetPermissions}
      />
    </div>
  );
};

/**
 * Permission editor.
 *
 * There are 164 permissions across 15 groups. The previous version rendered all of
 * them as flat checkboxes with no search and no way to tell a grant apart from what
 * the role already gives, which made granting or auditing anything impractical.
 *
 * This version adds search, group and global bulk actions, a live diff against the
 * role preset, and a confirmation step for grants that carry approval authority.
 */
const PermissionDrawer = ({
  open, onClose, user, roleInfo, permissionsConfig, rolePermissions, sensitivePermissions = {}, onSave, onReset,
}) => {
  const screens = Grid.useBreakpoint();
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);

  useEffect(() => {
    setSelectedPermissions((user?.permissions || []).filter((permission) => permission !== '*'));
    setSearch('');
    setOnlyChanged(false);
  }, [user]);

  if (!user) return null;
  const unrestricted = (user.permissions || []).includes('*');

  const rolePreset = new Set(rolePermissions?.[user.role] || []);
  const roleGrantsAll = rolePreset.has('*');
  const selectedSet = new Set(selectedPermissions);

  const allPermissions = Object.entries(permissionsConfig || {})
    .flatMap(([category, permissions]) => (permissions || [])
      .filter((permission) => permission.id !== '*')
      .map((permission) => ({ ...permission, category })));

  const extraBeyondRole = roleGrantsAll
    ? []
    : selectedPermissions.filter((permission) => !rolePreset.has(permission));
  const missingFromRole = roleGrantsAll
    ? []
    : [...rolePreset].filter((permission) => !selectedSet.has(permission));
  const sensitiveSelected = selectedPermissions.filter((permission) => sensitivePermissions[permission]);

  const matchesFilters = (permission) => {
    const text = search.trim().toLowerCase();
    if (text && !permission.name.toLowerCase().includes(text) && !permission.id.toLowerCase().includes(text)) {
      return false;
    }
    if (onlyChanged) {
      const inRole = roleGrantsAll || rolePreset.has(permission.id);
      const isSelected = selectedSet.has(permission.id);
      if (inRole === isSelected) return false;
    }
    return true;
  };

  const toggle = (permission) => {
    const isAdding = !selectedSet.has(permission.id);
    const warning = sensitivePermissions[permission.id];
    const apply = () => setSelectedPermissions((previous) => (previous.includes(permission.id)
      ? previous.filter((item) => item !== permission.id)
      : [...previous, permission.id]));

    // Approval authority and administrative control get a deliberate second step.
    if (isAdding && warning) {
      Modal.confirm({
        title: `Grant "${permission.name}"?`,
        icon: <ExclamationCircleOutlined style={{ color: '#d46b08' }} />,
        content: (
          <div>
            <p className="mb-2">{warning}</p>
            <p className="text-xs text-gray-500">
              Granting this to {user.name} ({roleInfo[user.role]?.name || user.role}) is not reversible from an audit
              point of view — the change is recorded either way.
            </p>
          </div>
        ),
        okText: 'Grant',
        okButtonProps: { danger: true },
        onOk: apply,
      });
      return;
    }
    apply();
  };

  const setMany = (ids, shouldSelect) => setSelectedPermissions((previous) => (shouldSelect
    ? [...new Set([...previous, ...ids])]
    : previous.filter((permission) => !ids.includes(permission))));

  return (
    <Drawer
      title={`Permissions — ${user.name}`}
      open={open}
      onClose={onClose}
      width={screens.lg ? 720 : screens.md ? 560 : '100%'}
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
        <div className="space-y-4">
          <Alert
            type={user.permissionMode === 'role_default' ? 'info' : 'warning'}
            showIcon
            message={user.permissionMode === 'role_default' ? 'Using role defaults' : 'Using custom permissions'}
            description={user.permissionMode === 'role_default'
              ? `This account follows the ${roleInfo[user.role]?.name || user.role} preset. Saving any change switches it to custom, and it will then stop following the preset.`
              : `This account no longer follows the ${roleInfo[user.role]?.name || user.role} preset. Use Role Defaults to put it back.`}
          />

          {/* Live comparison against the role preset — the thing that makes an
              over-permissioned account obvious instead of invisible. */}
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 p-3 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-800">{selectedPermissions.length}</div>
              <div className="text-[11px] text-gray-500">selected of {allPermissions.length}</div>
            </div>
            <div>
              <div className={`text-lg font-semibold ${extraBeyondRole.length ? 'text-orange-600' : 'text-gray-800'}`}>
                {extraBeyondRole.length}
              </div>
              <div className="text-[11px] text-gray-500">beyond the role</div>
            </div>
            <div>
              <div className={`text-lg font-semibold ${missingFromRole.length ? 'text-amber-600' : 'text-gray-800'}`}>
                {missingFromRole.length}
              </div>
              <div className="text-[11px] text-gray-500">role grants, not given</div>
            </div>
          </div>

          {sensitiveSelected.length > 0 && (
            <Alert
              type="warning"
              showIcon
              message={`${sensitiveSelected.length} high-authority permission(s) selected`}
              description={
                <div className="flex flex-wrap gap-1">
                  {sensitiveSelected.map((permission) => (
                    <Tooltip key={permission} title={sensitivePermissions[permission]}>
                      <Tag color="orange">
                        {allPermissions.find((item) => item.id === permission)?.name || permission}
                      </Tag>
                    </Tooltip>
                  ))}
                </div>
              }
            />
          )}

          <Space wrap>
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined />}
              placeholder="Search permissions"
              style={{ width: 240 }}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Button size="small" onClick={() => setMany(allPermissions.map((p) => p.id), true)}>Select All</Button>
            <Button size="small" onClick={() => setSelectedPermissions([])}>Clear All</Button>
            <Button
              size="small"
              onClick={() => setSelectedPermissions(roleGrantsAll ? [] : [...rolePreset])}
              disabled={roleGrantsAll}
            >
              Match Role Preset
            </Button>
            <Button
              size="small"
              type={onlyChanged ? 'primary' : 'default'}
              onClick={() => setOnlyChanged((previous) => !previous)}
            >
              {onlyChanged ? 'Showing differences' : 'Show differences only'}
            </Button>
          </Space>

          {Object.entries(permissionsConfig || {}).map(([category, permissions]) => {
            const safePermissions = (permissions || []).filter((permission) => permission.id !== '*');
            const visible = safePermissions
              .map((permission) => ({ ...permission, category }))
              .filter(matchesFilters);
            if (!visible.length) return null;

            const ids = safePermissions.map((permission) => permission.id);
            const selectedInGroup = ids.filter((id) => selectedSet.has(id)).length;
            const allSelected = selectedInGroup === ids.length;

            return (
              <div key={category} className="rounded-lg border border-gray-100 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-800">
                    {category}
                    <span className="ml-2 text-xs font-normal text-gray-400">{selectedInGroup}/{ids.length}</span>
                  </h4>
                  <Button type="link" size="small" onClick={() => setMany(ids, !allSelected)}>
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {visible.map((permission) => {
                    const inRole = roleGrantsAll || rolePreset.has(permission.id);
                    const isSelected = selectedSet.has(permission.id);
                    const isSensitive = Boolean(sensitivePermissions[permission.id]);
                    return (
                      <div key={permission.id} className="flex items-start gap-2">
                        <Checkbox checked={isSelected} onChange={() => toggle(permission)}>
                          <span className="text-sm text-gray-700">{permission.name}</span>
                        </Checkbox>
                        {isSensitive && (
                          <Tooltip title={sensitivePermissions[permission.id]}>
                            <Tag color="orange" className="mt-0.5 cursor-help">high authority</Tag>
                          </Tooltip>
                        )}
                        {isSelected && !inRole && (
                          <Tooltip title={`Not part of the ${roleInfo[user.role]?.name || user.role} preset.`}>
                            <Tag className="mt-0.5">extra</Tag>
                          </Tooltip>
                        )}
                        {!isSelected && inRole && (
                          <Tooltip title={`The ${roleInfo[user.role]?.name || user.role} preset includes this, but it is not granted here.`}>
                            <Tag color="gold" className="mt-0.5">role has it</Tag>
                          </Tooltip>
                        )}
                      </div>
                    );
                  })}
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
