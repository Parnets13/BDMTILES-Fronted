import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Empty, Form, Input,
  InputNumber, message, Modal, Row, Select, Space, Statistic, Steps, Switch, Table,
  Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, DollarOutlined, EyeOutlined,
  LogoutOutlined, PlusOutlined, ReloadOutlined, SearchOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext.jsx';
import hrmsService from '../../services/hrmsService.js';

const { Text, Title } = Typography;

const BRAND = '#FF5F03';
const URGENT = '#cf1322';
const CAUTION = '#d46b08';
const POSITIVE = '#389e0d';

const EXIT_TYPES = [
  { value: 'resignation', label: 'Resignation' },
  { value: 'termination', label: 'Termination' },
  { value: 'retirement', label: 'Retirement' },
  { value: 'absconding', label: 'Absconding' },
  { value: 'contract_end', label: 'Contract End' },
];
const REASON_CATEGORIES = [
  { value: 'better_opportunity', label: 'Better Opportunity' },
  { value: 'compensation', label: 'Compensation' },
  { value: 'relocation', label: 'Relocation' },
  { value: 'personal', label: 'Personal' },
  { value: 'health', label: 'Health' },
  { value: 'work_environment', label: 'Work Environment' },
  { value: 'career_change', label: 'Career Change' },
  { value: 'performance', label: 'Performance' },
  { value: 'misconduct', label: 'Misconduct' },
  { value: 'other', label: 'Other' },
];
const STATUS_COLOR = {
  pending_approval: 'gold',
  approved: 'blue',
  in_clearance: 'purple',
  settled: 'cyan',
  completed: 'green',
  rejected: 'red',
  withdrawn: 'default',
};
const CLEARANCE_COLOR = { pending: 'gold', cleared: 'green', blocked: 'red', waived: 'default' };
const SETTLEMENT_COLOR = { not_computed: 'default', computed: 'gold', approved: 'blue', paid: 'green' };

// Progress rail. Rejected and withdrawn cases leave the happy path, so they get a
// failed marker on the step they stopped at instead of a fake position.
const FLOW = ['pending_approval', 'in_clearance', 'settled', 'completed'];
const stepIndexOf = (status) => {
  if (status === 'approved') return 1;
  const index = FLOW.indexOf(status);
  return index >= 0 ? index : 0;
};

const EARNING_LINES = [
  ['pendingSalary', 'Pending Salary'],
  ['leaveEncashment', 'Leave Encashment'],
  ['pendingIncentive', 'Pending Incentive'],
  ['gratuity', 'Gratuity'],
  ['otherEarnings', 'Other Earnings'],
];
const DEDUCTION_LINES = [
  ['loanOutstanding', 'Loan Outstanding'],
  ['advanceOutstanding', 'Advance Outstanding'],
  ['noticeShortfallDeduction', 'Notice Shortfall'],
  ['unreturnedAssetValue', 'Unreturned Assets'],
  ['otherDeductions', 'Other Deductions'],
];

const money = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fmtDate = (value) => (value ? dayjs(value).format('DD MMM YYYY') : '—');
const titleCase = (value) => String(value || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const EmployeeExitManagement = () => {
  const { activeBranchId, branchEpoch } = useAuth();
  const [exits, setExits] = useState([]);
  const [stats, setStats] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState(null);
  const [settlementOpen, setSettlementOpen] = useState(false);
  const [settlementDraft, setSettlementDraft] = useState(null);
  const [interviewOpen, setInterviewOpen] = useState(false);

  const [createForm] = Form.useForm();
  const [decisionForm] = Form.useForm();
  const [settlementForm] = Form.useForm();
  const [interviewForm] = Form.useForm();

  const fetchExits = useCallback(async (page = pagination.current) => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const res = await hrmsService.getExits({
        page, limit: pagination.pageSize,
        search: search || undefined,
        status: statusFilter,
      });
      if (res.success) {
        setExits(res.data || []);
        setPagination(p => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [activeBranchId, branchEpoch, search, statusFilter, pagination.pageSize, pagination.current]);

  const fetchStats = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await hrmsService.getExitStats();
      if (res.success) setStats(res.data || {});
    } catch (_) { /* the stats strip is not worth an error toast */ }
  }, [activeBranchId, branchEpoch]);

  const fetchEmployees = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await hrmsService.getEmployees({ limit: 100, page: 1 });
      // Terminated employees have already left; offering them would only produce a 409.
      if (res.success) setEmployees((res.data || []).filter(e => e.status !== 'Terminated'));
    } catch (_) { /* selector stays empty; the form will say so */ }
  }, [activeBranchId, branchEpoch]);

  useEffect(() => {
    fetchStats();
    fetchExits(1);
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId, branchEpoch, search, statusFilter]);

  const refreshAll = async (id) => {
    await Promise.all([fetchExits(pagination.current), fetchStats()]);
    if (id) await openDetail({ _id: id });
  };

  // ── Detail ────────────────────────────────────────────────────────────────
  const openDetail = async (row) => {
    setDetailLoading(true);
    try {
      const res = await hrmsService.getExit(row._id);
      if (res.success) setDetail(res.data);
    } catch (error) { message.error(error.message); }
    finally { setDetailLoading(false); }
  };

  // ── Create ────────────────────────────────────────────────────────────────
  const submitCreate = async () => {
    try {
      const values = await createForm.validateFields();
      setSaving(true);
      const res = await hrmsService.createExit({
        employeeId: values.employeeId,
        exitType: values.exitType,
        reason: values.reason,
        reasonCategory: values.reasonCategory,
        resignationDate: values.resignationDate?.format('YYYY-MM-DD'),
        noticePeriodDays: values.noticePeriodDays,
        requestedLastWorkingDay: values.requestedLastWorkingDay?.format('YYYY-MM-DD'),
      });
      message.success(res.message || 'Resignation recorded.');
      setCreateOpen(false);
      createForm.resetFields();
      await refreshAll();
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message);
    } finally { setSaving(false); }
  };

  // ── Approve / reject ──────────────────────────────────────────────────────
  const submitDecision = async () => {
    try {
      const values = await decisionForm.validateFields();
      setSaving(true);
      const res = await hrmsService.decideExit(decisionTarget._id, {
        decision: values.decision,
        approvedLastWorkingDay: values.approvedLastWorkingDay?.format('YYYY-MM-DD'),
        noticeWaived: values.noticeWaived,
        remarks: values.remarks,
      });
      message.success(res.message || 'Decision recorded.');
      setDecisionTarget(null);
      decisionForm.resetFields();
      await refreshAll(detail?.exit?._id);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message);
    } finally { setSaving(false); }
  };

  const setClearance = async (key, status) => {
    try {
      const res = await hrmsService.updateExitClearance(detail.exit._id, key, { status });
      message.success(res.message || 'Clearance updated.');
      await refreshAll(detail.exit._id);
    } catch (error) { message.error(error.message); }
  };

  // ── Settlement ────────────────────────────────────────────────────────────
  const openSettlement = async () => {
    setSaving(true);
    try {
      const res = await hrmsService.getSettlementDraft(detail.exit._id);
      if (res.success) {
        setSettlementDraft(res.data);
        const saved = detail.exit.settlement || {};
        // Prefer whatever was already agreed; fall back to the computed draft.
        const seed = saved.paymentStatus && saved.paymentStatus !== 'not_computed' ? saved : res.data.draft;
        settlementForm.setFieldsValue({
          ...Object.fromEntries([...EARNING_LINES, ...DEDUCTION_LINES]
            .map(([key]) => [key, Number(seed[key] || 0)])),
          notes: saved.notes || '',
        });
        setSettlementOpen(true);
      }
    } catch (error) { message.error(error.message); }
    finally { setSaving(false); }
  };

  const submitSettlement = async () => {
    try {
      const values = await settlementForm.validateFields();
      setSaving(true);
      const res = await hrmsService.saveSettlement(detail.exit._id, {
        ...values,
        perDayRate: settlementDraft?.draft?.perDayRate,
        perDayBasis: settlementDraft?.draft?.perDayBasis,
        payableDays: settlementDraft?.draft?.payableDays,
        leaveEncashmentDays: settlementDraft?.draft?.leaveEncashmentDays,
      });
      message.success(res.message || 'Settlement saved.');
      setSettlementOpen(false);
      await refreshAll(detail.exit._id);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message);
    } finally { setSaving(false); }
  };

  const settlementStatus = async (paymentStatus) => {
    try {
      let paymentRef;
      if (paymentStatus === 'paid') {
        paymentRef = window.prompt('Payment reference (UTR / cheque number):') || '';
      }
      const res = await hrmsService.updateSettlementStatus(detail.exit._id, { paymentStatus, paymentRef });
      message.success(res.message);
      await refreshAll(detail.exit._id);
    } catch (error) { message.error(error.message); }
  };

  const submitInterview = async () => {
    try {
      const values = await interviewForm.validateFields();
      setSaving(true);
      const res = await hrmsService.recordExitInterview(detail.exit._id, {
        date: values.date?.format('YYYY-MM-DD'),
        wouldRehire: values.wouldRehire,
        overallExperience: values.overallExperience,
        feedback: values.feedback,
        improvementSuggestions: values.improvementSuggestions,
        reasonCategory: values.reasonCategory,
      });
      message.success(res.message || 'Exit interview recorded.');
      setInterviewOpen(false);
      interviewForm.resetFields();
      await refreshAll(detail.exit._id);
    } catch (error) {
      if (error.errorFields) return;
      message.error(error.message);
    } finally { setSaving(false); }
  };

  const completeExit = async (force = false, forceReason = '') => {
    try {
      const res = await hrmsService.completeExit(detail.exit._id, force ? { force, forceReason } : {});
      message.success(res.message);
      await refreshAll(detail.exit._id);
    } catch (error) {
      // The api client normalises a failure payload onto `error.details`.
      const blockers = error.details?.blockers;
      if (blockers?.length) {
        Modal.confirm({
          title: 'Outstanding items block this exit',
          width: 620,
          icon: <WarningOutlined style={{ color: URGENT }} />,
          content: (
            <div>
              <ul style={{ paddingLeft: 18 }}>
                {blockers.map((b, i) => <li key={i}><Text>{b}</Text></li>)}
              </ul>
              <Alert
                type="warning"
                showIcon
                style={{ marginTop: 12 }}
                message="Completing anyway is recorded on the case"
                description="Use this only when the gap is genuinely unrecoverable, such as an absconding employee who will not return equipment. You will be asked for a reason."
              />
            </div>
          ),
          okText: 'Complete anyway',
          okButtonProps: { danger: true },
          onOk: () => {
            const reason = window.prompt('Reason for overriding the outstanding items:');
            if (!reason?.trim()) {
              message.warning('A reason is required to override. Nothing was changed.');
              return;
            }
            return completeExit(true, reason.trim());
          },
        });
        return;
      }
      message.error(error.message);
    }
  };

  const withdrawExit = async () => {
    Modal.confirm({
      title: 'Withdraw this exit?',
      content: 'The employee is restored to Active and the case is closed as withdrawn.',
      okText: 'Withdraw',
      onOk: async () => {
        try {
          const res = await hrmsService.withdrawExit(detail.exit._id, {});
          message.success(res.message);
          await refreshAll(detail.exit._id);
        } catch (error) { message.error(error.message); }
      },
    });
  };

  const columns = useMemo(() => [
    {
      title: 'Employee',
      key: 'employee',
      render: (_, r) => (
        <div>
          <Text strong>{r.employeeName}</Text>
          <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
            {r.empId || '—'} · {r.designation || '—'} · {r.department || '—'}
          </Text>
        </div>
      ),
    },
    { title: 'Type', dataIndex: 'exitType', width: 120, render: (v) => <Tag>{titleCase(v)}</Tag> },
    { title: 'Resigned', dataIndex: 'resignationDate', width: 120, render: fmtDate },
    {
      title: 'Last Working Day',
      key: 'lwd',
      width: 150,
      render: (_, r) => (
        <div>
          <Text>{fmtDate(r.approvedLastWorkingDay || r.requestedLastWorkingDay)}</Text>
          {!r.approvedLastWorkingDay && <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>requested</Text>}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 140,
      render: (v) => <Tag color={STATUS_COLOR[v]}>{titleCase(v)}</Tag>,
    },
    {
      title: 'Settlement',
      key: 'settlement',
      width: 160,
      render: (_, r) => (
        <div>
          <Tag color={SETTLEMENT_COLOR[r.settlement?.paymentStatus]}>{titleCase(r.settlement?.paymentStatus || 'not_computed')}</Tag>
          {r.settlement?.paymentStatus !== 'not_computed' && (
            <Text style={{ display: 'block', fontSize: 11 }}>{money(r.settlement?.netPayable)}</Text>
          )}
        </div>
      ),
    },
    {
      title: 'Action',
      key: 'action',
      width: 110,
      fixed: 'right',
      render: (_, r) => (
        <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(r)}>View</Button>
      ),
    },
  ], []);

  const exit = detail?.exit;
  const facts = detail?.clearanceFacts;
  const clearanceDone = (exit?.clearance || []).filter(c => c.status === 'cleared' || c.status === 'waived').length;

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>Employee Exit & Full-and-Final</Title>
          <Text type="secondary">Resignation, notice period, departmental clearance and settlement in one case file</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => refreshAll()}>Refresh</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!activeBranchId}
            style={{ background: BRAND, borderColor: BRAND }}
            onClick={() => { createForm.resetFields(); createForm.setFieldsValue({ exitType: 'resignation', noticePeriodDays: 30, resignationDate: dayjs() }); setCreateOpen(true); }}
          >
            Record Resignation
          </Button>
        </Space>
      </div>

      {!activeBranchId && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Select a branch to view exit cases." />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Awaiting Approval" value={stats.pendingApproval || 0} valueStyle={{ color: CAUTION }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="In Clearance" value={stats.inClearance || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Settled, Not Closed" value={stats.settled || 0} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Settled Net Payable" value={stats.settledNetPayable || 0} prefix="₹" precision={2} valueStyle={{ color: POSITIVE }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, employee code, department"
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 190 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'open', label: 'All Open Cases' },
              ...Object.keys(STATUS_COLOR).map(s => ({ value: s, label: titleCase(s) })),
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={exits}
          scroll={{ x: 1100 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `${t} exit case(s)`,
          }}
          onChange={(p) => { setPagination(prev => ({ ...prev, pageSize: p.pageSize })); fetchExits(p.current); }}
          locale={{ emptyText: 'No exit cases yet. Record a resignation to start one.' }}
        />
      </Card>

      {/* ── Record resignation ───────────────────────────────────────────── */}
      <Modal
        title="Record Resignation / Exit"
        open={createOpen}
        onOk={submitCreate}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        confirmLoading={saving}
        okText="Record"
        okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
        width={720}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="The employee stays active and moves to On Notice"
          description="App access is not touched until the exit is completed at the end of the clearance — they are still working."
        />
        <Form form={createForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select the employee.' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  placeholder={employees.length ? 'Select employee' : 'No eligible employees loaded'}
                  options={employees.map(e => ({
                    value: e._id,
                    label: `${e.name}${e.empId ? ` (${e.empId})` : ''} — ${e.department || ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="exitType" label="Exit Type" rules={[{ required: true }]}>
                <Select options={EXIT_TYPES} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="resignationDate" label="Resignation Date" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="noticePeriodDays" label="Notice Period (days)">
                <InputNumber min={0} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item
                name="requestedLastWorkingDay"
                label="Requested Last Working Day"
                tooltip="Leave blank to derive it from the resignation date plus the notice period."
              >
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="reasonCategory" label="Reason Category">
                <Select options={REASON_CATEGORIES} />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="reason" label="Reason" rules={[{ required: true, message: 'A reason is required.' }]}>
                <Input.TextArea rows={2} placeholder="As stated by the employee or by management" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* ── Case detail ──────────────────────────────────────────────────── */}
      <Modal
        title={exit ? `Exit Case — ${exit.employeeName}` : 'Exit Case'}
        open={!!detail}
        onCancel={() => { setDetail(null); setSettlementDraft(null); }}
        footer={<Button onClick={() => setDetail(null)}>Close</Button>}
        width={1000}
        destroyOnHidden
      >
        {exit && (
          <>
            <Steps
              size="small"
              current={stepIndexOf(exit.status)}
              status={['rejected', 'withdrawn'].includes(exit.status) ? 'error' : 'process'}
              style={{ marginBottom: 20 }}
              items={[
                { title: 'Approval' },
                { title: 'Clearance' },
                { title: 'Settlement' },
                { title: 'Completed' },
              ]}
            />

            {['rejected', 'withdrawn'].includes(exit.status) && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message={`This case was ${exit.status}.`}
                description={exit.approval?.remarks || 'The employee was restored to Active.'}
              />
            )}

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee Code">{exit.empId || '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{exit.designation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{exit.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Joined">{fmtDate(exit.dateOfJoining)}</Descriptions.Item>
              <Descriptions.Item label="Resigned">{fmtDate(exit.resignationDate)}</Descriptions.Item>
              <Descriptions.Item label="Notice Period">{exit.noticePeriodDays} day(s)</Descriptions.Item>
              <Descriptions.Item label="Requested LWD">{fmtDate(exit.requestedLastWorkingDay)}</Descriptions.Item>
              <Descriptions.Item label="Approved LWD">{fmtDate(exit.approvedLastWorkingDay)}</Descriptions.Item>
              <Descriptions.Item label="Notice Shortfall">
                {exit.noticeWaived
                  ? <Tag color="blue">Waived</Tag>
                  : <Text style={{ color: exit.noticeShortfallDays > 0 ? CAUTION : undefined }}>{exit.noticeShortfallDays || 0} day(s)</Text>}
              </Descriptions.Item>
              <Descriptions.Item label="Type">{titleCase(exit.exitType)}</Descriptions.Item>
              <Descriptions.Item label="Reason Category">{titleCase(exit.reasonCategory)}</Descriptions.Item>
              <Descriptions.Item label="Employee Status">{detail.employee?.status || '—'}</Descriptions.Item>
              <Descriptions.Item label="Reason" span={3}>{exit.reason}</Descriptions.Item>
            </Descriptions>

            {/* Live outstanding facts */}
            {facts && (
              <Card size="small" title="Live Outstanding Position" style={{ marginBottom: 16 }}>
                <Row gutter={[12, 12]}>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="Assets Held"
                      value={facts.assets.count}
                      valueStyle={{ color: facts.assets.count ? URGENT : POSITIVE }}
                      suffix={facts.assets.count ? <Text type="secondary" style={{ fontSize: 12 }}>{money(facts.assets.totalValue)}</Text> : null}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="Loans & Advances"
                      value={facts.finance.totalOutstanding}
                      prefix="₹"
                      precision={2}
                      valueStyle={{ color: facts.finance.totalOutstanding ? CAUTION : POSITIVE }}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="Pending Leave Requests"
                      value={facts.leave.pendingRequests}
                      valueStyle={{ color: facts.leave.pendingRequests ? CAUTION : POSITIVE }}
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="App Access"
                      value={facts.appAccess.linked ? (facts.appAccess.stillActive ? 'Active' : facts.appAccess.status || 'Revoked') : 'Not linked'}
                      valueStyle={{ color: facts.appAccess.stillActive ? CAUTION : POSITIVE, fontSize: 20 }}
                    />
                  </Col>
                </Row>

                {facts.assets.count > 0 && (
                  <Table
                    size="small"
                    style={{ marginTop: 12 }}
                    rowKey="_id"
                    pagination={false}
                    dataSource={facts.assets.items}
                    columns={[
                      { title: 'Asset', key: 'a', render: (_, a) => `${a.assetCode} · ${a.name}` },
                      { title: 'Category', dataIndex: 'category' },
                      { title: 'Condition', dataIndex: 'condition', render: titleCase },
                      { title: 'Book Value', dataIndex: 'currentValue', render: money },
                      { title: 'Held Since', dataIndex: 'assignedDate', render: fmtDate },
                    ]}
                  />
                )}
                {!facts.incentive.measurable && (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="Pending incentive could not be measured"
                    description={facts.incentive.reason}
                  />
                )}
              </Card>
            )}

            {/* Clearance checklist */}
            <Card
              size="small"
              title={`Clearance Checklist (${clearanceDone}/${(exit.clearance || []).length} signed off)`}
              style={{ marginBottom: 16 }}
            >
              <Table
                size="small"
                rowKey="key"
                pagination={false}
                dataSource={exit.clearance || []}
                columns={[
                  { title: 'Item', dataIndex: 'label' },
                  { title: 'Owner', dataIndex: 'owner', width: 160 },
                  {
                    title: 'Status',
                    dataIndex: 'status',
                    width: 110,
                    render: (v) => <Tag color={CLEARANCE_COLOR[v]}>{titleCase(v)}</Tag>,
                  },
                  {
                    title: 'Signed Off',
                    key: 'by',
                    width: 170,
                    render: (_, r) => (r.clearedByName
                      ? <Text style={{ fontSize: 12 }}>{r.clearedByName}<br /><Text type="secondary">{fmtDate(r.clearedAt)}</Text></Text>
                      : <Text type="secondary">—</Text>),
                  },
                  {
                    title: 'Set',
                    key: 'set',
                    width: 230,
                    render: (_, r) => (
                      <Select
                        size="small"
                        style={{ width: 200 }}
                        value={r.status}
                        disabled={['completed', 'rejected', 'withdrawn'].includes(exit.status)}
                        onChange={(v) => setClearance(r.key, v)}
                        options={[
                          { value: 'pending', label: 'Pending' },
                          { value: 'cleared', label: 'Cleared' },
                          { value: 'blocked', label: 'Blocked' },
                          { value: 'waived', label: 'Waived (known gap)' },
                        ]}
                      />
                    ),
                  },
                ]}
              />
            </Card>

            {/* Settlement */}
            <Card
              size="small"
              title="Full-and-Final Settlement"
              extra={<Tag color={SETTLEMENT_COLOR[exit.settlement?.paymentStatus]}>{titleCase(exit.settlement?.paymentStatus || 'not_computed')}</Tag>}
              style={{ marginBottom: 16 }}
            >
              {exit.settlement?.paymentStatus === 'not_computed' ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="Not computed yet. Open the settlement to see a draft with the basis for every figure."
                />
              ) : (
                <>
                  <Row gutter={[12, 12]}>
                    <Col xs={24} md={8}><Statistic title="Total Earnings" value={exit.settlement.totalEarnings} prefix="₹" precision={2} valueStyle={{ color: POSITIVE }} /></Col>
                    <Col xs={24} md={8}><Statistic title="Total Deductions" value={exit.settlement.totalDeductions} prefix="₹" precision={2} valueStyle={{ color: CAUTION }} /></Col>
                    <Col xs={24} md={8}><Statistic title="Net Payable" value={exit.settlement.netPayable} prefix="₹" precision={2} valueStyle={{ color: BRAND }} /></Col>
                  </Row>
                  {exit.settlement.perDayBasis && (
                    <Text type="secondary" style={{ display: 'block', marginTop: 10, fontSize: 12 }}>
                      Per-day rate {money(exit.settlement.perDayRate)} — {exit.settlement.perDayBasis}
                    </Text>
                  )}
                  {exit.settlement.notes && (
                    <Alert type="info" style={{ marginTop: 10 }} message={exit.settlement.notes} />
                  )}
                </>
              )}
              <Space style={{ marginTop: 12 }} wrap>
                <Button
                  icon={<DollarOutlined />}
                  loading={saving}
                  disabled={!exit.approvedLastWorkingDay || ['completed', 'rejected', 'withdrawn'].includes(exit.status)}
                  onClick={openSettlement}
                >
                  {exit.settlement?.paymentStatus === 'not_computed' ? 'Compute Settlement' : 'Revise Settlement'}
                </Button>
                {exit.settlement?.paymentStatus === 'computed' && (
                  <Button type="primary" style={{ background: BRAND, borderColor: BRAND }} onClick={() => settlementStatus('approved')}>
                    Approve Settlement
                  </Button>
                )}
                {exit.settlement?.paymentStatus === 'approved' && (
                  <Button type="primary" style={{ background: POSITIVE, borderColor: POSITIVE }} onClick={() => settlementStatus('paid')}>
                    Mark Paid
                  </Button>
                )}
                {exit.settlement?.paymentStatus === 'paid' && (
                  <Text type="secondary">Paid {fmtDate(exit.settlement.paidAt)} · {exit.settlement.paymentRef || 'no reference'}</Text>
                )}
              </Space>
            </Card>

            {/* Exit interview */}
            <Card
              size="small"
              title="Exit Interview"
              extra={exit.exitInterview?.conducted ? <Tag color="green">Conducted</Tag> : <Tag>Pending</Tag>}
              style={{ marginBottom: 16 }}
            >
              {exit.exitInterview?.conducted ? (
                <Descriptions size="small" column={{ xs: 1, md: 2 }}>
                  <Descriptions.Item label="Date">{fmtDate(exit.exitInterview.date)}</Descriptions.Item>
                  <Descriptions.Item label="Conducted By">{exit.exitInterview.conductedByName || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Would Rehire">
                    {exit.exitInterview.wouldRehire === undefined
                      ? '—'
                      : <Tag color={exit.exitInterview.wouldRehire ? 'green' : 'red'}>{exit.exitInterview.wouldRehire ? 'Yes' : 'No'}</Tag>}
                  </Descriptions.Item>
                  <Descriptions.Item label="Overall Experience">{exit.exitInterview.overallExperience ? `${exit.exitInterview.overallExperience} / 5` : '—'}</Descriptions.Item>
                  <Descriptions.Item label="Feedback" span={2}>{exit.exitInterview.feedback || '—'}</Descriptions.Item>
                  <Descriptions.Item label="Suggestions" span={2}>{exit.exitInterview.improvementSuggestions || '—'}</Descriptions.Item>
                </Descriptions>
              ) : (
                <Text type="secondary">Not conducted yet.</Text>
              )}
              <Button
                style={{ marginTop: 12 }}
                disabled={['rejected', 'withdrawn'].includes(exit.status)}
                onClick={() => {
                  interviewForm.resetFields();
                  interviewForm.setFieldsValue({ date: dayjs(), reasonCategory: exit.reasonCategory });
                  setInterviewOpen(true);
                }}
              >
                {exit.exitInterview?.conducted ? 'Update Interview' : 'Record Interview'}
              </Button>
            </Card>

            {exit.documentsIssued?.length > 0 && (
              <Card size="small" title="Documents Issued" style={{ marginBottom: 16 }}>
                {exit.documentsIssued.map((d, i) => (
                  <Tag key={i} color="blue">{d.documentType} · {fmtDate(d.issuedAt)}</Tag>
                ))}
              </Card>
            )}
            {exit.status !== 'completed' && (
              <Alert
                type="info"
                showIcon
                style={{ marginBottom: 16 }}
                message="Relieving Letter and Experience Certificate"
                description="Generate these from HR Document Templates. Once an exit case exists, the {{lastWorkingDay}}, {{tenure}} and {{exitReason}} placeholders resolve from this case, and the issued letters are listed here."
              />
            )}

            <Divider style={{ margin: '8px 0 16px' }} />
            <Space wrap>
              {exit.status === 'pending_approval' && (
                <>
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    style={{ background: BRAND, borderColor: BRAND }}
                    onClick={() => {
                      decisionForm.resetFields();
                      decisionForm.setFieldsValue({
                        decision: 'approved',
                        approvedLastWorkingDay: exit.requestedLastWorkingDay ? dayjs(exit.requestedLastWorkingDay) : dayjs(),
                        noticeWaived: false,
                      });
                      setDecisionTarget(exit);
                    }}
                  >
                    Approve / Reject
                  </Button>
                </>
              )}
              {['pending_approval', 'approved', 'in_clearance'].includes(exit.status) && (
                <Button icon={<CloseCircleOutlined />} onClick={withdrawExit}>Withdraw</Button>
              )}
              {['approved', 'in_clearance', 'settled'].includes(exit.status) && (
                <Tooltip title="Terminates the employee and revokes app access. Blocked while items are outstanding.">
                  <Button danger icon={<LogoutOutlined />} onClick={() => completeExit(false)}>
                    Complete Exit & Revoke Access
                  </Button>
                </Tooltip>
              )}
              {exit.status === 'completed' && (
                <Alert
                  type="success"
                  showIcon
                  message={`Exit completed ${fmtDate(exit.completedAt)} — app access revoked.`}
                  style={{ flex: 1 }}
                />
              )}
            </Space>
          </>
        )}
        {detailLoading && !exit && <Text type="secondary">Loading case…</Text>}
      </Modal>

      {/* ── Decision ─────────────────────────────────────────────────────── */}
      <Modal
        title="Exit Decision"
        open={!!decisionTarget}
        onOk={submitDecision}
        onCancel={() => { setDecisionTarget(null); decisionForm.resetFields(); }}
        confirmLoading={saving}
        okText="Save Decision"
        okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
        width={620}
        destroyOnHidden
      >
        <Form form={decisionForm} layout="vertical">
          <Form.Item name="decision" label="Decision" rules={[{ required: true }]}>
            <Select options={[{ value: 'approved', label: 'Approve' }, { value: 'rejected', label: 'Reject' }]} />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {({ getFieldValue }) => getFieldValue('decision') === 'approved' && (
              <>
                <Form.Item
                  name="approvedLastWorkingDay"
                  label="Approved Last Working Day"
                  rules={[{ required: true, message: 'Set the agreed last working day.' }]}
                  tooltip="Any notice not served becomes a shortfall, which the settlement can deduct."
                >
                  <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
                </Form.Item>
                <Form.Item name="noticeWaived" label="Waive notice shortfall" valuePropName="checked">
                  <Switch />
                </Form.Item>
              </>
            )}
          </Form.Item>
          <Form.Item name="remarks" label="Remarks">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>

      {/* ── Settlement ───────────────────────────────────────────────────── */}
      <Modal
        title="Full-and-Final Settlement"
        open={settlementOpen}
        onOk={submitSettlement}
        onCancel={() => setSettlementOpen(false)}
        confirmLoading={saving}
        okText="Save Settlement"
        okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
        width={900}
        destroyOnHidden
      >
        {settlementDraft?.warnings?.length > 0 && (
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
            message="Check these before approving"
            description={<ul style={{ paddingLeft: 18, marginBottom: 0 }}>{settlementDraft.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
          />
        )}
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 12 }}>
          Every figure below is a computed proposal you can override. Per-day rate{' '}
          <Text strong>{money(settlementDraft?.draft?.perDayRate)}</Text> — {settlementDraft?.draft?.perDayBasis}
        </Text>

        <Form form={settlementForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Text strong style={{ color: POSITIVE }}>Earnings</Text>
              <Divider style={{ margin: '8px 0' }} />
              {EARNING_LINES.map(([key, label]) => (
                <Form.Item key={key} name={key} label={label} extra={settlementDraft?.basis?.[key]} style={{ marginBottom: 12 }}>
                  <InputNumber min={0} style={{ width: '100%' }} prefix="₹" />
                </Form.Item>
              ))}
            </Col>
            <Col xs={24} md={12}>
              <Text strong style={{ color: CAUTION }}>Deductions</Text>
              <Divider style={{ margin: '8px 0' }} />
              {DEDUCTION_LINES.map(([key, label]) => (
                <Form.Item
                  key={key}
                  name={key}
                  label={label}
                  extra={key === 'noticeShortfallDeduction'
                    ? settlementDraft?.basis?.noticeShortfall
                    : key === 'unreturnedAssetValue'
                      ? settlementDraft?.basis?.unreturnedAssets
                      : undefined}
                  style={{ marginBottom: 12 }}
                >
                  <InputNumber min={0} style={{ width: '100%' }} prefix="₹" />
                </Form.Item>
              ))}
            </Col>
          </Row>
          <Form.Item name="notes" label="Settlement Notes">
            <Input.TextArea rows={2} placeholder="What was agreed, and anything that was waived" />
          </Form.Item>
        </Form>
        <Alert
          type="info"
          showIcon
          message="Totals are recalculated on save"
          description="The net payable is always derived from the lines above, so it can never disagree with them."
        />
      </Modal>

      {/* ── Exit interview ───────────────────────────────────────────────── */}
      <Modal
        title="Exit Interview"
        open={interviewOpen}
        onOk={submitInterview}
        onCancel={() => { setInterviewOpen(false); interviewForm.resetFields(); }}
        confirmLoading={saving}
        okText="Save"
        okButtonProps={{ style: { background: BRAND, borderColor: BRAND } }}
        width={680}
        destroyOnHidden
      >
        <Form form={interviewForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item name="date" label="Interview Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="reasonCategory" label="Real Reason For Leaving" tooltip="Updates the case category — the stated reason and the real one often differ.">
                <Select options={REASON_CATEGORIES} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="overallExperience" label="Overall Experience (1–5)">
                <InputNumber min={1} max={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="wouldRehire" label="Would Rehire" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="feedback" label="Feedback">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="improvementSuggestions" label="Suggestions For The Company">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Saving this also signs off the "Exit interview conducted" clearance item.
        </Text>
      </Modal>
    </div>
  );
};

export default EmployeeExitManagement;
