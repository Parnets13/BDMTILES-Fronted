import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Space, Button, Select, Tag, Table, Typography,
  message, Empty, Descriptions, Alert,
} from 'antd';
import { ReloadOutlined, UserOutlined, HistoryOutlined } from '@ant-design/icons';
import api from '../../config/api';
import hrmsService from '../../services/hrmsService';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const statusColor = {
  active: 'green', in_use: 'blue', under_maintenance: 'orange',
  disposed: 'red', lost: 'volcano', returned: 'default',
};
const conditionColor = {
  excellent: 'green', good: 'cyan', fair: 'gold', poor: 'orange', damaged: 'red',
};
const movementColor = {
  assigned: 'blue', returned: 'green', transferred: 'purple',
  damaged: 'red', lost: 'red', disposed: 'red', repaired: 'green', status_change: 'default',
};

const fmtDate = (d) => d ? dayjs(d).format('DD MMM YYYY') : '—';
const titleCase = (s) => (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export default function EmployeeAssetHistory() {
  const [employees, setEmployees] = useState([]);
  const [employeeId, setEmployeeId] = useState();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    hrmsService.getEmployees({ limit: 500 })
      .then(r => setEmployees(r?.data || r?.employees || []))
      .catch(() => message.error('Failed to load employees'));
  }, []);

  const fetchHistory = useCallback(async (id) => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await api.get(`/assets/employee/${id}/history`);
      if (res.success) setData(res.data);
    } catch (err) {
      message.error(err.message || 'Failed to load asset history');
      setData(null);
    } finally { setLoading(false); }
  }, []);

  const heldColumns = [
    {
      title: 'Asset',
      key: 'asset',
      render: (_, r) => (
        <div>
          <Text strong>{r.name}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.assetCode} · {r.category}</Text>
        </div>
      ),
    },
    { title: 'Status', dataIndex: 'status', render: (s) => <Tag color={statusColor[s]}>{titleCase(s)}</Tag> },
    { title: 'Condition', dataIndex: 'condition', render: (c) => <Tag color={conditionColor[c]}>{titleCase(c)}</Tag> },
    { title: 'Held Since', dataIndex: 'assignedDate', render: fmtDate },
    {
      title: 'Days Held',
      key: 'days',
      render: (_, r) => r.assignedDate ? `${dayjs().diff(dayjs(r.assignedDate), 'day')} days` : '—',
    },
  ];

  const historyColumns = [
    { title: 'Date', dataIndex: 'date', width: 120, render: fmtDate },
    {
      title: 'Asset',
      key: 'asset',
      render: (_, r) => (
        <div>
          <Text strong>{r.assetName}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>{r.assetCode} · {r.category}</Text>
        </div>
      ),
    },
    {
      title: 'Event',
      dataIndex: 'type',
      width: 130,
      render: (t) => <Tag color={movementColor[t] || 'default'}>{titleCase(t)}</Tag>,
    },
    {
      title: 'Direction',
      dataIndex: 'direction',
      width: 130,
      render: (d) => {
        if (d === 'received')     return <Tag color="blue">Received</Tag>;
        if (d === 'handed_over')  return <Tag color="gold">Handed Over</Tag>;
        return <Tag>While Held</Tag>;
      },
    },
    {
      title: 'Counterparty',
      dataIndex: 'counterpartName',
      render: (v) => v || <Text type="secondary">Company</Text>,
    },
    {
      title: 'Condition',
      key: 'condition',
      render: (_, r) => (r.conditionBefore !== r.conditionAfter && (r.conditionBefore || r.conditionAfter))
        ? <Text style={{ fontSize: 12 }}>{titleCase(r.conditionBefore) || '—'} → {titleCase(r.conditionAfter) || '—'}</Text>
        : <Text type="secondary">{titleCase(r.conditionAfter) || '—'}</Text>,
    },
    {
      title: 'Notes',
      key: 'notes',
      render: (_, r) => {
        const parts = [r.reason, r.remarks].filter(Boolean);
        return parts.length ? <Text style={{ fontSize: 12 }}>{parts.join(' · ')}</Text> : <Text type="secondary">—</Text>;
      },
    },
    {
      title: 'Recorded By',
      dataIndex: 'recordedByName',
      width: 140,
      render: (v) => v || <Text type="secondary">—</Text>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: '#FF5F03' }}>Employee Asset History</Title>
          <Text type="secondary">Everything an employee currently holds, plus every handover they were part of</Text>
        </div>
        <Button
          icon={<ReloadOutlined />}
          onClick={() => fetchHistory(employeeId)}
          loading={loading}
          disabled={!employeeId}
        >
          Refresh
        </Button>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Row gutter={12} align="middle">
          <Col xs={24} sm={14}>
            <Select
              style={{ width: '100%' }}
              placeholder="Select an employee to view their asset history"
              showSearch
              optionFilterProp="label"
              value={employeeId}
              onChange={(v) => { setEmployeeId(v); fetchHistory(v); }}
              options={employees.map(e => ({
                value: e._id,
                label: `${e.name}${e.empId ? ` (${e.empId})` : ''}${e.department ? ` — ${e.department}` : ''}`,
              }))}
            />
          </Col>
          <Col xs={24} sm={10}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              Useful before an exit clearance — confirm nothing is still outstanding against the employee.
            </Text>
          </Col>
        </Row>
      </Card>

      {!employeeId && (
        <Card>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="Pick an employee above to see what they hold and what they have handed over."
          />
        </Card>
      )}

      {employeeId && data && (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Descriptions column={{ xs: 1, sm: 2, md: 4 }} size="small">
              <Descriptions.Item label="Employee">
                <Space><UserOutlined />{data.employee?.name}</Space>
              </Descriptions.Item>
              <Descriptions.Item label="Emp ID">{data.employee?.empId || '—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{data.employee?.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{data.employee?.designation || '—'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={8}>
              <Card variant="borderless" style={{ background: '#e6f7ff', border: '1px solid #1890ff' }}>
                <Statistic title="Currently Held" value={data.summary?.currentlyHeldCount || 0} valueStyle={{ color: '#1890ff' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card variant="borderless" style={{ background: '#fff7f0', border: '1px solid #FF5F03' }}>
                <Statistic title="Assets Ever Touched" value={data.summary?.totalAssetsTouched || 0} valueStyle={{ color: '#FF5F03' }} />
              </Card>
            </Col>
            <Col xs={12} sm={8}>
              <Card variant="borderless" style={{ background: '#f9f0ff', border: '1px solid #722ed1' }}>
                <Statistic title="Movements Logged" value={data.summary?.totalMovements || 0} valueStyle={{ color: '#722ed1' }} />
              </Card>
            </Col>
          </Row>

          {(data.currentlyHeld || []).length === 0 && (
            <Alert
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
              message="Nothing outstanding"
              description="This employee is not currently holding any company asset."
            />
          )}

          <Card title="Currently Held Assets" style={{ marginBottom: 16 }}>
            <Table
              columns={heldColumns}
              dataSource={data.currentlyHeld || []}
              rowKey="_id"
              loading={loading}
              pagination={false}
              size="small"
              locale={{ emptyText: 'No assets currently assigned to this employee.' }}
            />
          </Card>

          <Card title={<Space><HistoryOutlined />Movement History</Space>}>
            <Table
              columns={historyColumns}
              dataSource={data.history || []}
              rowKey="_id"
              loading={loading}
              size="small"
              scroll={{ x: 1100 }}
              pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `${t} movements` }}
              locale={{
                emptyText: 'No movements recorded for this employee yet. Assignments made from Asset Assignment will appear here.',
              }}
            />
          </Card>
        </>
      )}
    </div>
  );
}
