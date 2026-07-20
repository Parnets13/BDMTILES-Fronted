import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, Form, message, Drawer, Checkbox, Popconfirm, Tooltip } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, KeyOutlined, ReloadOutlined } from '@ant-design/icons';
import userService from '../../services/userService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const ROLE_OPTIONS = [
  { value: 'super_admin', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'sub_admin', label: 'Sub Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'sales_manager', label: 'Sales Manager' },
  { value: 'purchase_manager', label: 'Purchase Manager' },
  { value: 'warehouse_manager', label: 'Warehouse Manager' },
  { value: 'finance_manager', label: 'Finance Manager' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'sales_executive', label: 'Sales Executive' },
  { value: 'delivery_executive', label: 'Delivery Executive' },
  { value: 'picking_staff', label: 'Picking Staff' },
  { value: 'sorting_staff', label: 'Sorting Staff' },
  { value: 'dealer', label: 'Dealer' },
];

const ROLE_COLORS = {
  super_admin: 'red',
  admin: 'volcano',
  sub_admin: 'orange',
  owner: 'gold',
  sales_manager: 'blue',
  purchase_manager: 'purple',
  warehouse_manager: 'cyan',
  finance_manager: 'green',
  hr_manager: 'magenta',
  sales_executive: 'geekblue',
  delivery_executive: 'lime',
  picking_staff: 'default',
  sorting_staff: 'default',
  dealer: 'default',
};

const UserManagement = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(undefined);
  const [statusFilter, setStatusFilter] = useState(undefined);

  // Modal states
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [permissionDrawerOpen, setPermissionDrawerOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [permissionsConfig, setPermissionsConfig] = useState({});
  const [form] = Form.useForm();

  // Fetch users
  const fetchUsers = useCallback(async (page = 1, pageSize = 10) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pageSize,
        ...(search && { search }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
        excludeRole: 'dealer',
      };
      const res = await userService.getUsers(params);
      if (res.success) {
        setUsers(res.data);
        setPagination({
          current: res.pagination.currentPage,
          pageSize: res.pagination.itemsPerPage,
          total: res.pagination.totalItems,
        });
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch permissions config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const res = await userService.getPermissionsConfig();
        if (res.success) {
          setPermissionsConfig(res.permissions || {});
        }
      } catch (err) {
        console.error('Failed to load permissions config:', err);
      }
    };
    loadConfig();
  }, []);

  // Handle table pagination
  const handleTableChange = (pag) => {
    fetchUsers(pag.current, pag.pageSize);
  };

  // Open add/edit modal
  const openUserModal = (user = null) => {
    setSelectedUser(user);
    if (user) {
      form.setFieldsValue({
        name: user.name,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        password: '',
      });
    } else {
      form.resetFields();
    }
    setUserModalOpen(true);
  };

  // Save user (create or update)
  const handleSaveUser = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Remove empty password for edit
      if (selectedUser && !values.password) {
        delete values.password;
      }

      let res;
      if (selectedUser) {
        res = await userService.updateUser(selectedUser._id, values);
      } else {
        res = await userService.createUser(values);
      }

      if (res.success) {
        message.success(selectedUser ? 'User updated' : 'User created');
        setUserModalOpen(false);
        form.resetFields();
        setSelectedUser(null);
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (err) {
      if (err.errorFields) return; // form validation error
      message.error(err.message || 'Failed to save user');
    } finally {
      setLoading(false);
    }
  };

  // Delete user
  const handleDelete = async (userId) => {
    try {
      const res = await userService.deleteUser(userId);
      if (res.success) {
        message.success('User deleted');
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (err) {
      message.error(err.message || 'Failed to delete user');
    }
  };

  // Open permissions drawer
  const openPermissions = (user) => {
    setSelectedUser(user);
    setPermissionDrawerOpen(true);
  };

  // Save permissions
  const handleSavePermissions = async (permissions) => {
    try {
      const res = await userService.updatePermissions(selectedUser._id, { permissions });
      if (res.success) {
        message.success('Permissions updated');
        setPermissionDrawerOpen(false);
        fetchUsers(pagination.current, pagination.pageSize);
      }
    } catch (err) {
      message.error(err.message || 'Failed to update permissions');
    }
  };

  // Table columns
  const columns = [
    {
      title: 'User',
      key: 'user',
      render: (_, record) => (
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#FF5F03]/10 flex items-center justify-center text-[#FF5F03] font-semibold text-sm">
            {record.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900">{record.name}</div>
            <div className="text-xs text-gray-500">{record.email}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'Phone',
      dataIndex: 'phone',
      key: 'phone',
      render: (phone) => <span className="text-sm text-gray-700">{phone}</span>,
    },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      render: (role) => (
        <Tag color={ROLE_COLORS[role] || 'default'} className="capitalize">
          {role?.replace(/_/g, ' ')}
        </Tag>
      ),
    },
    {
      title: 'Permissions',
      key: 'permissions',
      render: (_, record) => (
        <span className="text-xs text-gray-500">
          {record.role === 'super_admin' ? 'All Access' : `${record.permissions?.length || 0} assigned`}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'Active' ? 'green' : 'red'}>{status}</Tag>
      ),
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
      width: 140,
      render: (_, record) => (
        <Space>
          <Tooltip title="Edit">
            <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openUserModal(record)} />
          </Tooltip>
          <Tooltip title="Permissions">
            <Button type="text" size="small" icon={<KeyOutlined />} onClick={() => openPermissions(record)} className="text-green-600" />
          </Tooltip>
          {record._id !== currentUser?._id && (
            <Popconfirm title="Delete this user?" onConfirm={() => handleDelete(record._id)} okText="Yes" cancelText="No">
              <Tooltip title="Delete">
                <Button type="text" size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage users, roles, and permissions</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openUserModal()} size="large">
          Add New User
        </Button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <Input
            placeholder="Search by name, email, phone..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="sm:w-64"
            allowClear
          />
          <Select
            placeholder="All Roles"
            options={ROLE_OPTIONS}
            value={roleFilter}
            onChange={setRoleFilter}
            allowClear
            className="sm:w-44"
          />
          <Select
            placeholder="All Status"
            options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]}
            value={statusFilter}
            onChange={setStatusFilter}
            allowClear
            className="sm:w-36"
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setRoleFilter(undefined); setStatusFilter(undefined); }}>
            Reset
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
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
          onChange={handleTableChange}
          size="middle"
        />
      </div>

      {/* Add/Edit User Modal */}
      <Modal
        title={selectedUser ? 'Edit User' : 'Add New User'}
        open={userModalOpen}
        onCancel={() => { setUserModalOpen(false); form.resetFields(); setSelectedUser(null); }}
        onOk={handleSaveUser}
        okText={selectedUser ? 'Update' : 'Create'}
        confirmLoading={loading}
        width="90%"
        style={{ top: 20, maxWidth: 800 }}
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Name is required' }]}>
              <Input placeholder="Enter full name" />
            </Form.Item>
            <Form.Item name="username" label="Username" rules={[{ required: true, message: 'Username is required' }]}>
              <Input placeholder="Enter username" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}>
              <Input placeholder="Enter email" />
            </Form.Item>
            <Form.Item name="phone" label="Phone" rules={[{ required: true, message: 'Phone is required' }]}>
              <Input placeholder="Enter phone number" />
            </Form.Item>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Select a role' }]}>
              <Select options={ROLE_OPTIONS} placeholder="Select role" />
            </Form.Item>
            <Form.Item name="status" label="Status" initialValue="Active">
              <Select options={[{ value: 'Active', label: 'Active' }, { value: 'Inactive', label: 'Inactive' }]} />
            </Form.Item>
          </div>
          <Form.Item
            name="password"
            label={selectedUser ? 'New Password (leave blank to keep current)' : 'Password'}
            rules={selectedUser ? [] : [{ required: true, min: 6, message: 'Min 6 characters' }]}
          >
            <Input.Password placeholder={selectedUser ? 'Leave blank to keep current' : 'Enter password'} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Permissions Drawer */}
      <PermissionDrawer
        open={permissionDrawerOpen}
        onClose={() => { setPermissionDrawerOpen(false); setSelectedUser(null); }}
        user={selectedUser}
        permissionsConfig={permissionsConfig}
        onSave={handleSavePermissions}
      />
    </div>
  );
};

// Permission management drawer component
const PermissionDrawer = ({ open, onClose, user, permissionsConfig, onSave }) => {
  const [selectedPermissions, setSelectedPermissions] = useState([]);

  useEffect(() => {
    if (user) {
      setSelectedPermissions(user.permissions || []);
    }
  }, [user]);

  const handleToggle = (permId) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((p) => p !== permId) : [...prev, permId]
    );
  };

  const handleSelectAll = (category, permissions) => {
    const allIds = permissions.map((p) => p.id);
    const allSelected = allIds.every((id) => selectedPermissions.includes(id));
    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((p) => !allIds.includes(p)));
    } else {
      setSelectedPermissions((prev) => [...new Set([...prev, ...allIds])]);
    }
  };

  if (!user) return null;

  return (
    <Drawer
      title={`Permissions — ${user.name}`}
      open={open}
      onClose={onClose}
      width={480}
      extra={
        <Button type="primary" onClick={() => onSave(selectedPermissions)}>
          Save Permissions
        </Button>
      }
    >
      {user.role === 'super_admin' ? (
        <div className="text-center py-8 text-gray-500">
          <KeyOutlined className="text-4xl text-[#FF5F03] mb-3" />
          <p className="text-lg font-medium text-gray-700">Super Admin</p>
          <p className="text-sm">Has full access to all modules. No individual permissions needed.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="text-sm text-gray-500 mb-4">
            Selected: <span className="font-semibold text-gray-800">{selectedPermissions.length}</span> permissions
          </div>
          {Object.entries(permissionsConfig).map(([category, permissions]) => (
            <div key={category} className="border border-gray-100 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-800 text-sm">{category}</h4>
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleSelectAll(category, permissions)}
                  className="text-xs"
                >
                  {permissions.every((p) => selectedPermissions.includes(p.id)) ? 'Deselect All' : 'Select All'}
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {permissions.map((perm) => (
                  <Checkbox
                    key={perm.id}
                    checked={selectedPermissions.includes(perm.id)}
                    onChange={() => handleToggle(perm.id)}
                  >
                    <span className="text-sm text-gray-700">{perm.name}</span>
                  </Checkbox>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Drawer>
  );
};

export default UserManagement;
