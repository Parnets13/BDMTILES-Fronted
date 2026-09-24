import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Badge, Button, Card, Col, Collapse, Divider, Empty, Input, Progress,
  Row, Select, Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  KeyOutlined, ReloadOutlined, SafetyCertificateOutlined, SearchOutlined,
  TeamOutlined, WarningOutlined,
} from '@ant-design/icons';
import userService from '../../services/userService.js';
import menuConfig from '../../config/menuConfig.js';

const { Text, Title, Paragraph } = Typography;

const BRAND = '#FF5F03';
const URGENT = '#cf1322';
const CAUTION = '#d46b08';
const POSITIVE = '#389e0d';

const SOURCE_META = {
  role_default:         { color: 'blue',    label: 'Role default',   hint: 'Comes from the role preset. Changing the role definition changes this user.' },
  custom_matching_role: { color: 'cyan',    label: 'Custom (same)',  hint: 'Granted individually, but the role preset also includes it.' },
  custom_extra:         { color: 'orange',  label: 'Custom (extra)', hint: 'Granted individually and NOT part of the role preset.' },
  unrestricted:         { color: 'red',     label: 'Unrestricted',   hint: 'Holds everything via the wildcard or a bypass role.' },
};

/**
 * Every permission string the sidebar relies on. These are hand-written literals in
 * menuConfig with nothing validating them, so a typo or a removed permission id
 * makes a menu item permanently invisible with no error anywhere. Collecting them
 * here lets the catalogue below flag the mismatch.
 */
const collectMenuPermissions = () => {
  const found = new Map();   // permission id -> where it is used
  const note = (permission, where) => {
    if (!permission || typeof permission !== 'string') return;
    const list = found.get(permission) || [];
    list.push(where);
    found.set(permission, list);
  };

  const walkItems = (items, trail) => {
    for (const item of items || []) {
      const where = `${trail} › ${item.title || item.id}`;
      note(item.permission, where);
      (item.permissions || []).forEach((permission) => note(permission, where));
      if (item.children) walkItems(item.children, where);
      if (item.items) walkItems(item.items, where);
    }
  };

  for (const section of Object.values(menuConfig || {})) {
    if (!section || typeof section !== 'object') continue;
    const trail = section.title || section.id || 'section';
    note(section.permission, `${trail} (section)`);
    (section.modulePermissions || []).forEach((permission) => note(permission, `${trail} (section)`));
    walkItems(section.items, trail);
  }
  return found;
};

const RolesPermissions = () => {
  const [catalogue, setCatalogue] = useState(null);
  const [permissionsConfig, setPermissionsConfig] = useState({});
  const [loading, setLoading] = useState(false);

  const [compareLeft, setCompareLeft] = useState();
  const [compareRight, setCompareRight] = useState();

  const [lookupPermission, setLookupPermission] = useState();
  const [holders, setHolders] = useState(null);
  const [holderLoading, setHolderLoading] = useState(false);

  const [drift, setDrift] = useState(null);
  const [driftLoading, setDriftLoading] = useState(false);

  const [permissionSearch, setPermissionSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [roleResponse, configResponse] = await Promise.all([
        userService.getRoleCatalogue(),
        userService.getPermissionsConfig(),
      ]);
      if (roleResponse.success) setCatalogue(roleResponse.data);
      if (configResponse.success) setPermissionsConfig(configResponse.permissions || {});
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadDrift = useCallback(async () => {
    setDriftLoading(true);
    try {
      const res = await userService.getPermissionDrift();
      if (res.success) setDrift(res.data);
    } catch (error) { message.error(error.message); }
    finally { setDriftLoading(false); }
  }, []);

  const lookup = async (permissionId) => {
    setLookupPermission(permissionId);
    if (!permissionId) { setHolders(null); return; }
    setHolderLoading(true);
    try {
      const res = await userService.getPermissionHolders(permissionId);
      if (res.success) setHolders(res.data);
    } catch (error) { message.error(error.message); setHolders(null); }
    finally { setHolderLoading(false); }
  };

  const roles = catalogue?.roles || [];
  const roleOptions = roles.map((role) => ({ value: role.key, label: `${role.name} (rank ${role.rank})` }));

  const permissionOptions = useMemo(() => Object.entries(permissionsConfig).map(([category, permissions]) => ({
    label: category,
    options: (permissions || []).map((permission) => ({
      value: permission.id,
      label: `${permission.name} — ${permission.id}`,
    })),
  })), [permissionsConfig]);

  const allPermissionIds = useMemo(
    () => new Set(Object.values(permissionsConfig).flat().map((permission) => permission.id)),
    [permissionsConfig]
  );

  // Menu coverage: which sidebar permission strings do not exist in the backend
  // catalogue, and which catalogued permissions the sidebar never uses.
  const coverage = useMemo(() => {
    if (!allPermissionIds.size) return null;
    const menuPermissions = collectMenuPermissions();
    const unknown = [];
    for (const [permission, where] of menuPermissions.entries()) {
      if (!allPermissionIds.has(permission)) unknown.push({ permission, usedIn: where });
    }
    const unused = [...allPermissionIds].filter((permission) => !menuPermissions.has(permission));
    return {
      menuCount: menuPermissions.size,
      unknown: unknown.sort((a, b) => a.permission.localeCompare(b.permission)),
      unused: unused.sort(),
    };
  }, [allPermissionIds]);

  const comparison = useMemo(() => {
    if (!compareLeft || !compareRight) return null;
    const left = roles.find((role) => role.key === compareLeft);
    const right = roles.find((role) => role.key === compareRight);
    if (!left || !right) return null;

    const rows = [];
    for (const group of left.groups) {
      const rightGroup = right.groups.find((candidate) => candidate.category === group.category);
      for (const permission of group.permissions) {
        const rightPermission = rightGroup?.permissions.find((candidate) => candidate.id === permission.id);
        const inLeft = permission.granted;
        const inRight = Boolean(rightPermission?.granted);
        if (inLeft === inRight) continue;   // only differences are interesting
        rows.push({
          key: permission.id,
          category: group.category,
          name: permission.name,
          id: permission.id,
          inLeft,
          inRight,
        });
      }
    }
    const shared = left.groups.reduce((sum, group) => {
      const rightGroup = right.groups.find((candidate) => candidate.category === group.category);
      return sum + group.permissions.filter((permission) => permission.granted
        && rightGroup?.permissions.find((candidate) => candidate.id === permission.id)?.granted).length;
    }, 0);
    return { left, right, rows, shared };
  }, [compareLeft, compareRight, roles]);

  const holderColumns = [
    {
      title: 'User',
      key: 'user',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.username} · {r.email}</Text>
        </div>
      ),
    },
    { title: 'Role', dataIndex: 'roleName', width: 160 },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (v) => <Tag color={v === 'Active' ? 'green' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Granted Via',
      dataIndex: 'source',
      width: 170,
      render: (source) => {
        const meta = SOURCE_META[source] || { color: 'default', label: source, hint: '' };
        return <Tooltip title={meta.hint}><Tag color={meta.color}>{meta.label}</Tag></Tooltip>;
      },
    },
    {
      title: 'Branches',
      dataIndex: 'branches',
      render: (list) => (list?.length ? list.join(', ') : <Text type="secondary">—</Text>),
    },
  ];

  const driftColumns = [
    {
      title: 'User',
      key: 'user',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.username} · {r.roleName}</Text>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 90,
      render: (v) => <Tag color={v === 'Active' ? 'green' : 'default'}>{v}</Tag>,
    },
    {
      title: 'Held / Preset',
      key: 'counts',
      width: 130,
      render: (_, r) => (r.unrestricted
        ? <Tag color="red">Unrestricted</Tag>
        : <Text>{r.heldCount} / {r.presetCount}</Text>),
    },
    {
      title: 'Extra Grants',
      dataIndex: 'extra',
      render: (list) => (list?.length
        ? (
          <Tooltip title={list.join(', ')}>
            <Tag color="orange">{list.length} beyond the role</Tag>
          </Tooltip>
        )
        : <Text type="secondary">None</Text>),
    },
    {
      title: 'Missing From Role',
      dataIndex: 'missing',
      render: (list) => (list?.length
        ? (
          <Tooltip title={list.join(', ')}>
            <Tag color="gold">{list.length} not granted</Tag>
          </Tooltip>
        )
        : <Text type="secondary">None</Text>),
    },
    {
      title: 'Drift',
      dataIndex: 'driftScore',
      width: 90,
      sorter: (a, b) => a.driftScore - b.driftScore,
      render: (v) => <Badge count={v} color={v > 20 ? URGENT : v > 5 ? CAUTION : POSITIVE} showZero />,
    },
  ];

  const renderRoleCard = (role) => {
    const filterText = permissionSearch.trim().toLowerCase();
    const groups = role.groups
      .map((group) => ({
        ...group,
        permissions: filterText
          ? group.permissions.filter((permission) => permission.name.toLowerCase().includes(filterText)
            || permission.id.toLowerCase().includes(filterText))
          : group.permissions,
      }))
      .filter((group) => group.permissions.length > 0);

    return {
      key: role.key,
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Tag color={role.color}>{role.name}</Tag>
          <Text type="secondary" style={{ fontSize: 12 }}>rank {role.rank}</Text>
          {role.unrestricted
            ? <Tag color="red">Unrestricted</Tag>
            : <Text style={{ fontSize: 12 }}>{role.grantedCount} / {role.totalPermissions} permissions</Text>}
          <Tag icon={<TeamOutlined />}>{role.accounts.total} account(s)</Tag>
          {role.accounts.total > 0 && !role.presetIsLive && (
            <Tooltip title="Every account on this role uses custom permissions, so editing this preset would change nothing for anyone.">
              <Tag color="gold" icon={<WarningOutlined />}>Preset unused</Tag>
            </Tooltip>
          )}
        </div>
      ),
      children: (
        <div>
          <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>{role.description}</Paragraph>
          <Row gutter={[8, 8]} style={{ marginBottom: 12 }}>
            <Col xs={8}><Statistic title="On role defaults" value={role.accounts.roleDefault} valueStyle={{ fontSize: 18, color: POSITIVE }} /></Col>
            <Col xs={8}><Statistic title="On custom permissions" value={role.accounts.custom} valueStyle={{ fontSize: 18, color: CAUTION }} /></Col>
            <Col xs={8}>
              <div style={{ paddingTop: 4 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>Coverage</Text>
                <Progress
                  percent={role.unrestricted ? 100 : Math.round((role.grantedCount / role.totalPermissions) * 100)}
                  size="small"
                  strokeColor={role.unrestricted ? URGENT : BRAND}
                />
              </div>
            </Col>
          </Row>
          {role.unrestricted && (
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 12 }}
              message="This role bypasses permission checks entirely"
              description="The server grants every action to this role regardless of the stored permission list. The individual grants below are shown for reference only."
            />
          )}
          {groups.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No permissions match your search in this role." />
          ) : (
            <Row gutter={[12, 12]}>
              {groups.map((group) => (
                <Col xs={24} md={12} key={group.category}>
                  <Card
                    size="small"
                    title={<Text style={{ fontSize: 13 }}>{group.category}</Text>}
                    extra={<Text type="secondary" style={{ fontSize: 12 }}>{group.granted}/{group.total}</Text>}
                  >
                    <Space direction="vertical" size={2} style={{ width: '100%' }}>
                      {group.permissions.map((permission) => (
                        <div key={permission.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                          {permission.granted
                            ? <CheckCircleOutlined style={{ color: POSITIVE, marginTop: 3 }} />
                            : <CloseCircleOutlined style={{ color: '#d9d9d9', marginTop: 3 }} />}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <Text
                              style={{ fontSize: 12, color: permission.granted ? undefined : '#bfbfbf' }}
                              delete={!permission.granted}
                            >
                              {permission.name}
                            </Text>
                            <Text type="secondary" style={{ display: 'block', fontSize: 10 }}>{permission.id}</Text>
                          </div>
                        </div>
                      ))}
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </div>
      ),
    };
  };

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>Roles & Permissions</Title>
          <Text type="secondary">What each role grants, who holds a permission, and where accounts diverge from their role</Text>
        </div>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>Refresh</Button>
      </div>

      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 20 }}
        message="Roles are defined in code, not in the database"
        description="This screen explains and audits the role definitions; it cannot edit them. Changing what a role grants requires a code change and a deploy. Per-user permissions are editable from User Management."
      />

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Roles Defined" value={roles.length} valueStyle={{ color: BRAND }} prefix={<SafetyCertificateOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small"><Statistic title="Permissions Defined" value={catalogue?.totalPermissions || 0} valueStyle={{ color: '#1677ff' }} prefix={<KeyOutlined />} /></Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic
              title="Accounts On Custom Perms"
              value={roles.reduce((sum, role) => sum + role.accounts.custom, 0)}
              valueStyle={{ color: CAUTION }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Tooltip title="Sidebar permission strings that do not exist in the backend catalogue. Each one hides a menu item permanently.">
              <Statistic
                title="Broken Menu Permissions"
                value={coverage?.unknown.length ?? 0}
                valueStyle={{ color: coverage?.unknown.length ? URGENT : POSITIVE }}
                prefix={coverage?.unknown.length ? <ExclamationCircleOutlined /> : <CheckCircleOutlined />}
              />
            </Tooltip>
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="catalogue"
        onChange={(key) => { if (key === 'drift' && !drift) loadDrift(); }}
        items={[
          {
            key: 'catalogue',
            label: 'Role Catalogue',
            children: (
              <>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Filter permissions by name or id"
                  style={{ width: 340, marginBottom: 12 }}
                  value={permissionSearch}
                  onChange={(e) => setPermissionSearch(e.target.value)}
                />
                {roles.length === 0 ? (
                  <Card loading={loading}><Empty description="No roles loaded." /></Card>
                ) : (
                  <Collapse accordion items={roles.map(renderRoleCard)} />
                )}
              </>
            ),
          },
          {
            key: 'compare',
            label: 'Compare Roles',
            children: (
              <Card>
                <Space wrap style={{ marginBottom: 16 }}>
                  <Select
                    style={{ width: 240 }}
                    placeholder="First role"
                    options={roleOptions}
                    value={compareLeft}
                    onChange={setCompareLeft}
                    showSearch
                    optionFilterProp="label"
                  />
                  <Text type="secondary">vs</Text>
                  <Select
                    style={{ width: 240 }}
                    placeholder="Second role"
                    options={roleOptions}
                    value={compareRight}
                    onChange={setCompareRight}
                    showSearch
                    optionFilterProp="label"
                  />
                </Space>

                {!comparison ? (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Pick two roles to see only where they differ." />
                ) : (
                  <>
                    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                      <Col xs={8}><Statistic title={comparison.left.name} value={comparison.left.unrestricted ? 'All' : comparison.left.grantedCount} valueStyle={{ color: comparison.left.color }} /></Col>
                      <Col xs={8}><Statistic title="Shared" value={comparison.shared} valueStyle={{ color: POSITIVE }} /></Col>
                      <Col xs={8}><Statistic title={comparison.right.name} value={comparison.right.unrestricted ? 'All' : comparison.right.grantedCount} valueStyle={{ color: comparison.right.color }} /></Col>
                    </Row>
                    {(comparison.left.unrestricted || comparison.right.unrestricted) && (
                      <Alert
                        type="warning"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="One of these roles is unrestricted"
                        description="A bypass role holds everything, so the differences below describe the other role's gaps rather than a meaningful comparison."
                      />
                    )}
                    {comparison.rows.length === 0 ? (
                      <Alert type="success" showIcon message="These two roles grant exactly the same permissions." />
                    ) : (
                      <Table
                        size="small"
                        rowKey="key"
                        dataSource={comparison.rows}
                        pagination={{ pageSize: 25, showSizeChanger: true, showTotal: (t) => `${t} difference(s)` }}
                        columns={[
                          { title: 'Group', dataIndex: 'category', width: 200 },
                          {
                            title: 'Permission',
                            key: 'permission',
                            render: (_, r) => (
                              <div>
                                <Text>{r.name}</Text>
                                <Text type="secondary" style={{ display: 'block', fontSize: 10 }}>{r.id}</Text>
                              </div>
                            ),
                          },
                          {
                            title: comparison.left.name,
                            dataIndex: 'inLeft',
                            width: 150,
                            align: 'center',
                            render: (v) => (v
                              ? <CheckCircleOutlined style={{ color: POSITIVE }} />
                              : <CloseCircleOutlined style={{ color: '#d9d9d9' }} />),
                          },
                          {
                            title: comparison.right.name,
                            dataIndex: 'inRight',
                            width: 150,
                            align: 'center',
                            render: (v) => (v
                              ? <CheckCircleOutlined style={{ color: POSITIVE }} />
                              : <CloseCircleOutlined style={{ color: '#d9d9d9' }} />),
                          },
                        ]}
                      />
                    )}
                  </>
                )}
              </Card>
            ),
          },
          {
            key: 'holders',
            label: 'Who Holds A Permission',
            children: (
              <Card>
                <Select
                  style={{ width: '100%', maxWidth: 560, marginBottom: 16 }}
                  placeholder="Select a permission to see who currently holds it"
                  options={permissionOptions}
                  value={lookupPermission}
                  onChange={lookup}
                  showSearch
                  allowClear
                  optionFilterProp="label"
                />
                {!holders ? (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="Pick a permission above. Accounts on role defaults do not store their permissions, so this is resolved the same way the server resolves it at request time."
                  />
                ) : (
                  <>
                    <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                      <Col xs={12} md={6}><Statistic title="Holders" value={holders.counts.total} valueStyle={{ color: BRAND }} /></Col>
                      <Col xs={12} md={6}><Statistic title="Active" value={holders.counts.active} valueStyle={{ color: POSITIVE }} /></Col>
                      <Col xs={12} md={6}><Statistic title="Via Role Default" value={holders.counts.viaRoleDefault} valueStyle={{ color: '#1677ff' }} /></Col>
                      <Col xs={12} md={6}><Statistic title="Via Unrestricted" value={holders.counts.viaUnrestricted} valueStyle={{ color: URGENT }} /></Col>
                    </Row>
                    <Alert type="info" showIcon style={{ marginBottom: 12 }} message={holders.scopeNote} />
                    <Table
                      size="small"
                      rowKey="_id"
                      loading={holderLoading}
                      dataSource={holders.holders}
                      columns={holderColumns}
                      pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} holder(s)` }}
                      locale={{ emptyText: 'No account currently holds this permission.' }}
                    />
                  </>
                )}
              </Card>
            ),
          },
          {
            key: 'drift',
            label: (
              <Space size={4}>
                Permission Drift
                {drift?.summary?.driftingAccounts > 0 && <Badge count={drift.summary.driftingAccounts} color={CAUTION} />}
              </Space>
            ),
            children: (
              <Card
                loading={driftLoading}
                extra={<Button size="small" icon={<ReloadOutlined />} onClick={loadDrift}>Recheck</Button>}
              >
                <Alert
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                  message="Custom permissions ignore the role preset entirely"
                  description={drift?.note
                    || 'Accounts on custom permissions do not follow their role definition. Changing a role grants nothing to them.'}
                />
                {drift && (
                  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                    <Col xs={12} md={6}><Statistic title="Custom Accounts" value={drift.summary.customAccounts} valueStyle={{ color: BRAND }} /></Col>
                    <Col xs={12} md={6}><Statistic title="Diverging" value={drift.summary.driftingAccounts} valueStyle={{ color: drift.summary.driftingAccounts ? CAUTION : POSITIVE }} /></Col>
                    <Col xs={12} md={6}><Statistic title="With Extra Grants" value={drift.summary.withExtraGrants} valueStyle={{ color: drift.summary.withExtraGrants ? URGENT : POSITIVE }} /></Col>
                    <Col xs={12} md={6}><Statistic title="Missing Role Defaults" value={drift.summary.missingRoleDefaults} valueStyle={{ color: CAUTION }} /></Col>
                  </Row>
                )}
                <Table
                  size="small"
                  rowKey="_id"
                  dataSource={drift?.rows || []}
                  columns={driftColumns}
                  pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} account(s)` }}
                  locale={{ emptyText: 'No custom-permission account diverges from its role preset.' }}
                />
              </Card>
            ),
          },
          {
            key: 'coverage',
            label: (
              <Space size={4}>
                Menu Coverage
                {coverage?.unknown.length > 0 && <Badge count={coverage.unknown.length} color={URGENT} />}
              </Space>
            ),
            children: (
              <Card>
                <Paragraph type="secondary" style={{ fontSize: 13 }}>
                  The sidebar and route guards reference permission ids as plain strings with nothing checking them
                  against the backend catalogue. A renamed or mistyped id does not raise an error — the menu item simply
                  never appears for anyone. This tab cross-checks the two lists.
                </Paragraph>
                <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
                  <Col xs={8}><Statistic title="Referenced By Menu" value={coverage?.menuCount || 0} valueStyle={{ color: '#1677ff' }} /></Col>
                  <Col xs={8}>
                    <Statistic
                      title="Unknown To Backend"
                      value={coverage?.unknown.length || 0}
                      valueStyle={{ color: coverage?.unknown.length ? URGENT : POSITIVE }}
                    />
                  </Col>
                  <Col xs={8}><Statistic title="Defined But Unused" value={coverage?.unused.length || 0} valueStyle={{ color: CAUTION }} /></Col>
                </Row>

                <Divider orientation="left" style={{ fontSize: 13 }}>Broken references</Divider>
                {coverage?.unknown.length ? (
                  <>
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message={`${coverage.unknown.length} menu permission(s) do not exist in the backend catalogue`}
                      description="These menu entries can never become visible, because no account can hold a permission that is not defined."
                    />
                    <Table
                      size="small"
                      rowKey="permission"
                      dataSource={coverage.unknown}
                      pagination={false}
                      columns={[
                        { title: 'Permission id', dataIndex: 'permission', render: (v) => <Text code>{v}</Text> },
                        { title: 'Referenced by', dataIndex: 'usedIn', render: (list) => (list || []).join(' | ') },
                      ]}
                    />
                  </>
                ) : (
                  <Alert type="success" showIcon message="Every permission the sidebar references exists in the backend catalogue." />
                )}

                <Divider orientation="left" style={{ fontSize: 13, marginTop: 24 }}>Defined but never used by the menu</Divider>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  Not necessarily a problem — many of these guard API routes or mobile-app features rather than a sidebar
                  entry. Worth reviewing for permissions that guard nothing at all.
                </Paragraph>
                {coverage?.unused.length ? (
                  <Space wrap>
                    {coverage.unused.map((permission) => <Tag key={permission}>{permission}</Tag>)}
                  </Space>
                ) : (
                  <Text type="secondary">Every defined permission is referenced by the menu.</Text>
                )}
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
};

export default RolesPermissions;
