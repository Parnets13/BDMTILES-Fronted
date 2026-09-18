import React, { useState, useEffect, useCallback } from 'react';
import { Table, Card, Select, Tag, Row, Col, Statistic, Space, Button, Input, Typography, Modal, Alert, message } from 'antd';
import { UserOutlined, ShopOutlined, EnvironmentOutlined, ReloadOutlined, SearchOutlined, EditOutlined, TeamOutlined, WarningOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService';

const { Title, Text } = Typography;
const { Option } = Select;

const executiveIdOf = (dealer) =>
  (typeof dealer.assignedSalesExecutive === 'object'
    ? dealer.assignedSalesExecutive?._id
    : dealer.assignedSalesExecutive) || null;

export default function SEDealerAssignment() {
  const [dealers, setDealers] = useState([]);
  const [salesExecs, setSalesExecs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seFilter, setSeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [editModal, setEditModal] = useState(false);
  const [editDealer, setEditDealer] = useState(null);
  const [selectedSE, setSelectedSE] = useState(null);
  const [assignmentReason, setAssignmentReason] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkModal, setBulkModal] = useState(false);
  const [bulkSE, setBulkSE] = useState(null);
  // Counted server-side. Deriving these from one page of dealers is how the old
  // version reported the wrong totals as soon as there were more than 100.
  const [summary, setSummary] = useState({ total: 0, assigned: 0, unassigned: 0, activeExecutives: 0, strandedOnInactive: 0, orphaned: 0, byExecutive: [] });

  const loadSummary = useCallback(() => {
    masterService.getDealerAssignmentSummary()
      .then(res => { if (res?.success) setSummary(res.data || {}); })
      .catch(() => {});
  }, []);

  // Filtering and searching happen on the server, so they apply to every dealer
  // rather than only the ones already downloaded.
  const loadDealers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await masterService.getDealers({
        page: pagination.current,
        limit: pagination.pageSize,
        search: search.trim() || undefined,
        assignedSalesExecutive: seFilter === 'all' ? undefined : seFilter,
      });
      if (res?.success) {
        setDealers(res.data || []);
        setPagination(current => ({ ...current, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) {
      console.error('SEDealerAssignment load error:', err);
      message.error(err.message || 'Failed to load dealers');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, seFilter]);

  useEffect(() => { loadDealers(); }, [loadDealers]);
  useEffect(() => { loadSummary(); }, [loadSummary]);
  useEffect(() => {
    masterService.getSalesExecutives?.().then(r => { if (r?.success) setSalesExecs(r.data || []); }).catch(() => {});
  }, []);

  const refresh = () => { loadDealers(); loadSummary(); setSelectedRowKeys([]); };
  const changeFilter = (value) => { setSeFilter(value); setPagination(p => ({ ...p, current: 1 })); setSelectedRowKeys([]); };

  const openAssign = (dealer) => {
    setEditDealer(dealer);
    setSelectedSE(executiveIdOf(dealer));
    setAssignmentReason('');
    setEditModal(true);
  };

  const currentExecutive = typeof editDealer?.assignedSalesExecutive === 'object'
    ? editDealer.assignedSalesExecutive
    : null;
  const currentExecutiveIsRetired = Boolean(
    currentExecutive?._id && !salesExecs.some(se => String(se._id) === String(currentExecutive._id)),
  );

  const saveAssignment = async () => {
    if (!editDealer) return;
    setSaving(true);
    try {
      const res = await masterService.updateDealer(editDealer._id, {
        assignedSalesExecutive: selectedSE || null,
        assignmentReason: assignmentReason.trim(),
      });
      if (res?.success) {
        message.success('Dealer assignment updated');
        setEditModal(false);
        setEditDealer(null);
        refresh();
      }
    } catch (err) {
      console.error('Assignment save error:', err);
      message.error(err.message || 'Failed to update assignment');
    } finally {
      setSaving(false);
    }
  };

  const saveBulk = async () => {
    setSaving(true);
    try {
      const res = await masterService.bulkAssignDealers({
        dealerIds: selectedRowKeys,
        assignedSalesExecutive: bulkSE || null,
        reason: assignmentReason.trim(),
      });
      if (res?.success) {
        message.success(res.message || 'Dealers reassigned');
        setBulkModal(false);
        setBulkSE(null);
        setAssignmentReason('');
        refresh();
      }
    } catch (err) {
      message.error(err.message || 'Bulk assignment failed');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: 'Dealer',
      key: 'dealer',
      render: (_, r) => (
        <Space>
          <ShopOutlined style={{ color: '#FF5F03' }} />
          <div>
            <Text strong>{r.businessName}</Text>
            {r.dealerCode && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.dealerCode}</Text>}
          </div>
        </Space>
      ),
    },
    { title: 'City', dataIndex: 'city', key: 'city', render: v => v || <Text type="secondary">—</Text> },
    {
      title: 'Region',
      key: 'region',
      render: (_, r) => {
        const region = typeof r.assignedRegion === 'object' ? r.assignedRegion : null;
        return region
          ? <Space size={4}><EnvironmentOutlined style={{ color: '#52c41a' }} /><Text>{region.name}</Text></Space>
          : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Route',
      key: 'route',
      render: (_, r) => {
        const route = typeof r.assignedRoute === 'object' ? r.assignedRoute : null;
        return route ? <Tag color="purple">{route.name}</Tag> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Assigned SE',
      key: 'se',
      render: (_, r) => {
        const se = typeof r.assignedSalesExecutive === 'object' ? r.assignedSalesExecutive : null;
        if (!se) return <Tag color="red">Unassigned</Tag>;
        // An inactive executive cannot log in, so their dealers' chat and order
        // requests go nowhere. Call that out rather than showing a calm blue tag.
        const inactive = se.status && se.status !== 'Active';
        return (
          <Space direction="vertical" size={0}>
            <Tag color={inactive ? 'orange' : 'blue'} icon={<UserOutlined />}>{se.name}</Tag>
            {inactive ? <Text type="warning" style={{ fontSize: 11 }}>Executive is inactive</Text> : null}
          </Space>
        );
      },
    },
    {
      title: 'Last change',
      key: 'history',
      render: (_, r) => {
        const last = (r.assignmentHistory || [])[r.assignmentHistory.length - 1];
        if (!last) return <Text type="secondary">—</Text>;
        return (
          <div style={{ fontSize: 11 }}>
            <div>{last.fromName || 'Unassigned'} → {last.toName || 'Unassigned'}</div>
            <Text type="secondary">{new Date(last.at).toLocaleDateString('en-IN')} · {last.byName || 'Staff'}</Text>
          </div>
        );
      },
    },
    {
      title: 'Action',
      key: 'action',
      render: (_, r) => (
        <Button size="small" icon={<EditOutlined />} onClick={() => openAssign(r)}>Assign</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>SE Dealer Assignment</Title>
          <Text type="secondary">Assign dealers to sales executives — a dealer's branch, chat and order requests all route through this</Text>
        </div>
        <Space>
          {selectedRowKeys.length ? (
            <Button type="primary" icon={<TeamOutlined />} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}
              onClick={() => { setBulkSE(null); setAssignmentReason(''); setBulkModal(true); }}>
              Reassign {selectedRowKeys.length} selected
            </Button>
          ) : null}
          <Button icon={<ReloadOutlined />} onClick={refresh} loading={loading}>Refresh</Button>
        </Space>
      </div>

      {summary.strandedOnInactive > 0 || summary.orphaned > 0 ? (
        <Alert
          type="warning"
          showIcon
          icon={<WarningOutlined />}
          style={{ marginBottom: 16 }}
          message="Some dealers are pointing at an executive who cannot log in"
          description={[
            summary.strandedOnInactive ? `${summary.strandedOnInactive} dealer(s) are assigned to an inactive Sales Executive.` : null,
            summary.orphaned ? `${summary.orphaned} dealer(s) reference a user that no longer exists.` : null,
            'Their order requests and chat will not reach anyone until they are reassigned.',
          ].filter(Boolean).join(' ')}
        />
      ) : null}

      {summary.unassigned > 0 ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={`${summary.unassigned} dealer(s) have no Sales Executive`}
          description="Without one they have no branch, so they cannot submit order requests or use chat in the dealer app."
        />
      ) : null}

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
            <Statistic title="Total Dealers" value={summary.total} valueStyle={{ color: '#FF5F03' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ background: '#f6ffed', border: '1px solid #52c41a' }}>
            <Statistic title="Assigned" value={summary.assigned} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ background: '#fff2f0', border: '1px solid #ff4d4f' }}>
            <Statistic title="Unassigned" value={summary.unassigned} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card variant="borderless" style={{ background: '#f0f5ff', border: '1px solid #597ef7' }}>
            <Statistic title="Active Executives" value={summary.activeExecutives} valueStyle={{ color: '#597ef7' }} />
          </Card>
        </Col>
      </Row>

      {/* Per-executive chips, counted across all dealers rather than one page */}
      <div style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <Button size="small" type={seFilter === 'all' ? 'primary' : 'default'}
          style={seFilter === 'all' ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
          onClick={() => changeFilter('all')}>
          All ({summary.total})
        </Button>
        {(summary.byExecutive || []).map(executive => (
          <Button key={executive._id} size="small"
            type={seFilter === executive._id ? 'primary' : 'default'}
            style={seFilter === executive._id ? { background: '#FF5F03', borderColor: '#FF5F03' } : {}}
            onClick={() => changeFilter(executive._id)}>
            {executive.name}{executive.status !== 'Active' ? ' (inactive)' : ''} ({executive.dealerCount})
          </Button>
        ))}
        <Button size="small" type={seFilter === 'unassigned' ? 'primary' : 'default'}
          danger={seFilter === 'unassigned'} onClick={() => changeFilter('unassigned')}>
          Unassigned ({summary.unassigned})
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Input
          prefix={<SearchOutlined />}
          placeholder="Search dealer name, code, city..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
          style={{ maxWidth: 400 }}
          allowClear
        />
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={dealers}
          rowKey="_id"
          loading={loading}
          rowSelection={{ selectedRowKeys, onChange: setSelectedRowKeys }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (t, range) => `${range[0]}-${range[1]} of ${t} dealers`,
          }}
          onChange={page => setPagination(p => ({ ...p, current: page.current, pageSize: page.pageSize }))}
          scroll={{ x: 1050 }}
          locale={{ emptyText: 'No dealers found.' }}
        />
      </Card>

      <Modal
        title={`Assign SE — ${editDealer?.businessName}`}
        open={editModal}
        onOk={saveAssignment}
        onCancel={() => { setEditModal(false); setEditDealer(null); }}
        confirmLoading={saving}
        okText="Save Assignment"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <div style={{ marginBottom: 8 }}><Text strong>Sales Executive</Text></div>
        <Select value={selectedSE} onChange={setSelectedSE} style={{ width: '100%' }}
          placeholder="Choose a sales executive..." allowClear showSearch optionFilterProp="children">
          {/* The options list only holds active executives, so a dealer sitting on
              an inactive one would otherwise render as a raw id. Show it, disabled,
              so the current state is readable and can only be changed away from. */}
          {currentExecutiveIsRetired ? (
            <Option key={currentExecutive._id} value={currentExecutive._id} disabled>
              <UserOutlined /> {currentExecutive.name} — inactive
            </Option>
          ) : null}
          {salesExecs.map(se => (
            <Option key={se._id} value={se._id}><UserOutlined /> {se.name}</Option>
          ))}
        </Select>
        <div style={{ margin: '12px 0 8px' }}><Text strong>Reason (optional)</Text></div>
        <Input maxLength={500} value={assignmentReason} onChange={e => setAssignmentReason(e.target.value)}
          placeholder="e.g. Territory rebalance" />
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Clearing the selection removes the dealer's executive. They will lose order requests and chat in the dealer app until reassigned.
        </Text>
      </Modal>

      <Modal
        title={`Reassign ${selectedRowKeys.length} dealer(s)`}
        open={bulkModal}
        onOk={saveBulk}
        onCancel={() => setBulkModal(false)}
        confirmLoading={saving}
        okText="Reassign"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <div style={{ marginBottom: 8 }}><Text strong>Move them to</Text></div>
        <Select value={bulkSE} onChange={setBulkSE} style={{ width: '100%' }}
          placeholder="Choose a sales executive..." allowClear showSearch optionFilterProp="children">
          {salesExecs.map(se => (
            <Option key={se._id} value={se._id}><UserOutlined /> {se.name}</Option>
          ))}
        </Select>
        <div style={{ margin: '12px 0 8px' }}><Text strong>Reason (optional)</Text></div>
        <Input maxLength={500} value={assignmentReason} onChange={e => setAssignmentReason(e.target.value)}
          placeholder="e.g. Executive left the company" />
        <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
          Leave the executive empty to unassign all of them. Every change is recorded against the dealer.
        </Text>
      </Modal>
    </div>
  );
}
