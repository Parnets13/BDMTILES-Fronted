import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Descriptions, Divider, Empty, Form, Input,
  InputNumber, message, Modal, Progress, Row, Segmented, Select, Space, Statistic,
  Switch, Table, Tag, Tooltip, Typography,
} from 'antd';
import {
  CheckCircleOutlined, EyeOutlined, LineChartOutlined, PlusOutlined,
  ReloadOutlined, RiseOutlined, SearchOutlined, WarningOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext.jsx';
import hrmsService from '../../services/hrmsService.js';

const { Text, Title } = Typography;

const BRAND = '#FF5F03';
const URGENT = '#cf1322';
const CAUTION = '#d46b08';
const POSITIVE = '#389e0d';
const NEUTRAL = '#8c8c8c';

const GRADE_COLOR = {
  'A+': 'green', A: 'green', B: 'cyan', C: 'gold', D: 'orange', E: 'red', NA: 'default',
};
const STATUS_COLOR = { draft: 'default', submitted: 'blue', acknowledged: 'green' };

const PERIOD_PRESETS = ['This Month', 'Last Month', 'This Quarter', 'This Year', 'Custom'];

const rangeForPreset = (preset) => {
  const now = dayjs();
  switch (preset) {
    case 'Last Month':  return [now.subtract(1, 'month').startOf('month'), now.subtract(1, 'month').endOf('month')];
    case 'This Quarter':return [now.startOf('quarter'), now.endOf('quarter')];
    case 'This Year':   return [now.startOf('year'), now.endOf('year')];
    case 'This Month':
    default:            return [now.startOf('month'), now.endOf('month')];
  }
};

const scoreColor = (score, measuredWeight) => {
  if (!measuredWeight) return NEUTRAL;
  if (score >= 80) return POSITIVE;
  if (score >= 60) return '#1677ff';
  if (score >= 50) return CAUTION;
  return URGENT;
};

const fmtDate = (v) => (v ? dayjs(v).format('DD MMM YYYY') : '—');

const PerformanceAppraisal = () => {
  const { activeBranchId, branchEpoch } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [stats, setStats] = useState({});
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [gradeFilter, setGradeFilter] = useState(undefined);

  const [composerOpen, setComposerOpen] = useState(false);
  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [periodPreset, setPeriodPreset] = useState('This Month');
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null);

  const [form] = Form.useForm();

  const fetchReviews = useCallback(async (page = 1) => {
    if (!activeBranchId) return;
    setLoading(true);
    try {
      const res = await hrmsService.getPerformanceReviews({
        page, limit: pagination.pageSize,
        search: search || undefined,
        status: statusFilter,
        grade: gradeFilter,
      });
      if (res.success) {
        setReviews(res.data || []);
        setPagination(p => ({ ...p, current: page, total: res.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [activeBranchId, branchEpoch, search, statusFilter, gradeFilter, pagination.pageSize]);

  const fetchStats = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await hrmsService.getPerformanceStats();
      if (res.success) setStats(res.data || {});
    } catch (_) { /* stats strip is not worth an error toast */ }
  }, [activeBranchId, branchEpoch]);

  useEffect(() => {
    fetchStats();
    fetchReviews(1);
    if (activeBranchId) {
      hrmsService.getEmployees({ limit: 100, page: 1, status: 'Active' })
        .then(r => { if (r.success) setEmployees(r.data || []); })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBranchId, branchEpoch, search, statusFilter, gradeFilter]);

  // ── Live preview of the automatic score ───────────────────────────────────
  const runPreview = useCallback(async () => {
    const values = form.getFieldsValue();
    if (!values.employeeId || !values.period?.[0] || !values.period?.[1]) {
      setPreview(null);
      return;
    }
    setPreviewLoading(true);
    try {
      const res = await hrmsService.previewPerformance({
        employeeId: values.employeeId,
        from: values.period[0].format('YYYY-MM-DD'),
        to: values.period[1].format('YYYY-MM-DD'),
        managerRating: values.managerRating || undefined,
      });
      if (res.success) setPreview(res.data);
    } catch (error) { message.error(error.message); setPreview(null); }
    finally { setPreviewLoading(false); }
  }, [form]);

  const openComposer = () => {
    form.resetFields();
    setPeriodPreset('This Month');
    form.setFieldsValue({ period: rangeForPreset('This Month') });
    setPreview(null);
    setEditing(null);
    setComposerOpen(true);
  };

  const openEdit = (review) => {
    setEditing(review);
    form.resetFields();
    form.setFieldsValue({
      employeeId: review.employee,
      period: [dayjs(review.periodFrom), dayjs(review.periodTo)],
      periodLabel: review.periodLabel,
      managerRating: review.managerRating,
      strengths: review.strengths,
      improvements: review.improvements,
      managerRemarks: review.managerRemarks,
      pipRequired: review.performanceImprovementPlan?.required,
      pipObjectives: review.performanceImprovementPlan?.objectives,
      pipReviewDate: review.performanceImprovementPlan?.reviewDate ? dayjs(review.performanceImprovementPlan.reviewDate) : undefined,
      promotionRecommended: review.promotionRecommended,
      promotionRemarks: review.promotionRemarks,
      incrementRecommended: review.incrementRecommended,
    });
    // Existing reviews already carry their breakdown; show it without a round trip.
    setPreview({
      components: review.components,
      totalScore: review.totalScore,
      grade: review.grade,
      measuredWeight: review.measuredWeight,
      excludedComponents: review.excludedComponents,
      warnings: review.warnings,
      employee: { name: review.employeeName, empId: review.empId, designation: review.designation },
    });
    setDetail(null);
    setComposerOpen(true);
  };

  const submit = async (andSubmit) => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        managerRating: values.managerRating,
        strengths: values.strengths,
        improvements: values.improvements,
        managerRemarks: values.managerRemarks,
        pipRequired: !!values.pipRequired,
        pipObjectives: values.pipObjectives,
        pipReviewDate: values.pipReviewDate?.format('YYYY-MM-DD'),
        promotionRecommended: !!values.promotionRecommended,
        promotionRemarks: values.promotionRemarks,
        incrementRecommended: values.incrementRecommended || 0,
        submit: andSubmit,
      };
      const res = editing
        ? await hrmsService.updatePerformanceReview(editing._id, payload)
        : await hrmsService.createPerformanceReview({
          ...payload,
          employeeId: values.employeeId,
          from: values.period[0].format('YYYY-MM-DD'),
          to: values.period[1].format('YYYY-MM-DD'),
          periodLabel: values.periodLabel,
        });
      message.success(res.message || 'Saved.');
      setComposerOpen(false);
      setEditing(null);
      await Promise.all([fetchReviews(pagination.current), fetchStats()]);
    } catch (error) {
      if (error.errorFields) {
        // Was a bare `return`. antd marks the offending field, but when that field is
        // scrolled out of view or on another tab of the modal, nothing visibly happened:
        // the dialog refused to save and the user had no idea why. Name the problem and
        // bring the field into view.
        const first = error.errorFields[0];
        form.scrollToField(first?.name);
        message.error(first?.errors?.[0] || 'Please correct the highlighted field.');
        return;
      }
      message.error(error.message);
    } finally { setSaving(false); }
  };

  const acknowledge = (review) => {
    Modal.confirm({
      title: 'Acknowledge this appraisal?',
      content: 'An acknowledged appraisal becomes a signed record and can no longer be edited.',
      okText: 'Acknowledge',
      okButtonProps: { style: { background: BRAND, borderColor: BRAND } },
      onOk: async () => {
        try {
          const res = await hrmsService.acknowledgePerformanceReview(review._id, {});
          message.success(res.message);
          setDetail(null);
          await Promise.all([fetchReviews(pagination.current), fetchStats()]);
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
    {
      title: 'Period',
      key: 'period',
      width: 190,
      render: (_, r) => (
        <div>
          <Text>{r.periodLabel || `${fmtDate(r.periodFrom)} – ${fmtDate(r.periodTo)}`}</Text>
          {r.periodLabel && (
            <Text type="secondary" style={{ display: 'block', fontSize: 11 }}>
              {fmtDate(r.periodFrom)} – {fmtDate(r.periodTo)}
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Score',
      key: 'score',
      width: 170,
      sorter: (a, b) => a.totalScore - b.totalScore,
      render: (_, r) => (
        <div>
          <Progress
            percent={r.totalScore}
            size="small"
            strokeColor={scoreColor(r.totalScore, r.measuredWeight)}
            format={(p) => `${p}/100`}
          />
          <Text type="secondary" style={{ fontSize: 11 }}>
            measured on {r.measuredWeight}/100 weight
          </Text>
        </div>
      ),
    },
    { title: 'Grade', dataIndex: 'grade', width: 80, render: (g) => <Tag color={GRADE_COLOR[g]}>{g}</Tag> },
    {
      title: 'Flags',
      key: 'flags',
      width: 150,
      render: (_, r) => (
        <Space size={4} wrap>
          {r.performanceImprovementPlan?.required && (
            <Tag color="red">PIP {r.performanceImprovementPlan.outcome !== 'open' ? `· ${r.performanceImprovementPlan.outcome}` : ''}</Tag>
          )}
          {r.promotionRecommended && <Tag color="green">Promotion</Tag>}
          {r.incrementRecommended > 0 && <Tag color="blue">+{r.incrementRecommended}%</Tag>}
        </Space>
      ),
    },
    { title: 'Status', dataIndex: 'status', width: 120, render: (s) => <Tag color={STATUS_COLOR[s]}>{s?.toUpperCase()}</Tag> },
    {
      title: 'Action',
      key: 'action',
      width: 100,
      fixed: 'right',
      render: (_, r) => <Button size="small" icon={<EyeOutlined />} onClick={() => setDetail(r)}>View</Button>,
    },
  ], [pagination.current]);

  const breakdownColumns = [
    { title: 'Component', dataIndex: 'label' },
    {
      title: 'Weight',
      key: 'weight',
      width: 130,
      render: (_, c) => (c.measurable
        ? <Text>{c.weight} → <Text strong>{c.effectiveWeight}</Text></Text>
        : <Text type="secondary" delete>{c.weight}</Text>),
    },
    {
      title: 'Target',
      dataIndex: 'targetValue',
      width: 100,
      render: (v, c) => (c.measurable ? Number(v).toLocaleString('en-IN') : '—'),
    },
    {
      title: 'Achieved',
      dataIndex: 'achievedValue',
      width: 100,
      render: (v, c) => (c.measurable ? Number(v).toLocaleString('en-IN') : '—'),
    },
    {
      title: 'Achievement',
      dataIndex: 'achievementPercent',
      width: 120,
      render: (v, c) => (c.measurable
        ? <Text style={{ color: v >= 80 ? POSITIVE : v >= 50 ? CAUTION : URGENT }}>{v}%</Text>
        : <Tag>Not measurable</Tag>),
    },
    {
      title: 'Points',
      dataIndex: 'points',
      width: 90,
      render: (v, c) => (c.measurable ? <Text strong>{v}</Text> : <Text type="secondary">0</Text>),
    },
    {
      title: 'Basis',
      key: 'basis',
      render: (_, c) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {c.measurable ? c.detail : c.excludedReason}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={4} style={{ margin: 0, color: BRAND }}>Employee Performance Appraisal</Title>
          <Text type="secondary">Automatic /100 rating from attendance, targets and tasks, combined with the manager&apos;s judgement</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} loading={loading} onClick={() => { fetchReviews(pagination.current); fetchStats(); }}>Refresh</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!activeBranchId}
            style={{ background: BRAND, borderColor: BRAND }}
            onClick={openComposer}
          >
            New Appraisal
          </Button>
        </Space>
      </div>

      {!activeBranchId && (
        <Alert type="info" showIcon style={{ marginBottom: 16 }} message="Select a branch to view appraisals." />
      )}

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Total Appraisals" value={stats.total || 0} valueStyle={{ color: BRAND }} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Tooltip title={stats.averageScoreBasis}>
              <Statistic
                title="Average Score"
                value={stats.averageScore || 0}
                suffix="/100"
                precision={2}
                valueStyle={{ color: scoreColor(stats.averageScore, 100) }}
              />
            </Tooltip>
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Open PIPs" value={stats.pipOpen || 0} valueStyle={{ color: stats.pipOpen ? URGENT : POSITIVE }} prefix={<WarningOutlined />} />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card size="small">
            <Statistic title="Promotions Recommended" value={stats.promotions || 0} valueStyle={{ color: POSITIVE }} prefix={<RiseOutlined />} />
          </Card>
        </Col>
      </Row>

      {stats.total > 0 && stats.averageScore === 0 && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="No appraisal yet has a broad enough measurement base to average"
          description={stats.averageScoreBasis}
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search name, code, department, period"
            style={{ width: 300 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 160 }}
            value={statusFilter}
            onChange={setStatusFilter}
            options={['draft', 'submitted', 'acknowledged'].map(s => ({ value: s, label: s.toUpperCase() }))}
          />
          <Select
            allowClear
            placeholder="Grade"
            style={{ width: 130 }}
            value={gradeFilter}
            onChange={setGradeFilter}
            options={Object.keys(GRADE_COLOR).map(g => ({ value: g, label: g }))}
          />
          <Button onClick={() => { setSearch(''); setStatusFilter(undefined); setGradeFilter(undefined); }}>Reset</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchReviews(); fetchStats(); }}>Refresh</Button>
        </Space>
      </Card>

      <Card>
        <Table
          rowKey="_id"
          loading={loading}
          columns={columns}
          dataSource={reviews}
          scroll={{ x: 1150 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            pageSizeOptions: ['10', '20', '50'],
            showTotal: (t) => `${t} appraisal(s)`,
          }}
          onChange={(p) => { setPagination(prev => ({ ...prev, pageSize: p.pageSize })); fetchReviews(p.current); }}
          locale={{ emptyText: 'No appraisals yet. Create one to score an employee for a period.' }}
        />
      </Card>

      {/* ── Composer ─────────────────────────────────────────────────────── */}
      <Modal
        title={editing ? `Edit Appraisal — ${editing.employeeName}` : 'New Appraisal'}
        open={composerOpen}
        onCancel={() => { setComposerOpen(false); setEditing(null); setPreview(null); }}
        width={1080}
        destroyOnHidden
        footer={[
          <Button key="cancel" onClick={() => { setComposerOpen(false); setEditing(null); }}>Cancel</Button>,
          <Button key="draft" loading={saving} onClick={() => submit(false)}>Save Draft</Button>,
          <Button
            key="submit"
            type="primary"
            loading={saving}
            style={{ background: BRAND, borderColor: BRAND }}
            onClick={() => submit(true)}
          >
            Submit Appraisal
          </Button>,
        ]}
      >
        <Form form={form} layout="vertical" onValuesChange={(changed) => {
          // Only the inputs that move the automatic score trigger a recompute.
          if ('employeeId' in changed || 'period' in changed || 'managerRating' in changed) runPreview();
        }}>
          <Row gutter={16}>
            <Col xs={24} md={9}>
              <Form.Item name="employeeId" label="Employee" rules={[{ required: true, message: 'Select the employee.' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={!!editing}
                  placeholder="Select employee"
                  options={employees.map(e => ({
                    value: e._id,
                    label: `${e.name}${e.empId ? ` (${e.empId})` : ''} — ${e.department || ''}`,
                  }))}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={15}>
              <Form.Item label="Review Period" required>
                <Space.Compact style={{ width: '100%' }}>
                  <Segmented
                    options={PERIOD_PRESETS}
                    value={periodPreset}
                    disabled={!!editing}
                    onChange={(value) => {
                      setPeriodPreset(value);
                      if (value !== 'Custom') {
                        form.setFieldsValue({ period: rangeForPreset(value) });
                        runPreview();
                      }
                    }}
                  />
                </Space.Compact>
                <Form.Item name="period" rules={[{ required: true, message: 'Pick the review period.' }]} style={{ marginTop: 8, marginBottom: 0 }}>
                  <DatePicker.RangePicker style={{ width: '100%' }} format="DD MMM YYYY" disabled={!!editing} />
                </Form.Item>
              </Form.Item>
            </Col>
          </Row>

          {/* Automatic breakdown */}
          <Card
            size="small"
            loading={previewLoading}
            title={<Space><LineChartOutlined />Automatic Score</Space>}
            extra={preview && (
              <Space>
                <Tag color={GRADE_COLOR[preview.grade]}>{preview.grade}</Tag>
                <Text strong style={{ color: scoreColor(preview.totalScore, preview.measuredWeight), fontSize: 18 }}>
                  {preview.totalScore}/100
                </Text>
              </Space>
            )}
            style={{ marginBottom: 16 }}
          >
            {!preview ? (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description="Pick an employee and a period to compute the score."
              />
            ) : (
              <>
                {preview.measuredWeight === 0 ? (
                  <Alert
                    type="error"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Nothing measurable in this period"
                    description="There is no attendance, no applicable target and no manager rating yet, so the score is not meaningful. Add a manager rating at minimum."
                  />
                ) : preview.measuredWeight < 50 ? (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`Scored on only ${preview.measuredWeight} of 100 available weight`}
                    description="Weights were redistributed across what could be measured. Treat this score as indicative rather than comparable to a fully-measured one."
                  />
                ) : (
                  <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`Scored on ${preview.measuredWeight} of 100 available weight`}
                    description="Components that could not be measured are excluded, not zeroed, and the remaining weights are renormalised to 100."
                  />
                )}
                <Table
                  size="small"
                  rowKey="key"
                  pagination={false}
                  dataSource={preview.components || []}
                  columns={breakdownColumns}
                  rowClassName={(c) => (c.measurable ? '' : 'opacity-60')}
                />
                {preview.suggestions && (
                  <Alert
                    type={preview.suggestions.pipRecommended ? 'warning' : preview.suggestions.promotionRecommended ? 'success' : 'info'}
                    showIcon
                    style={{ marginTop: 12 }}
                    message="Suggestion"
                    description={preview.suggestions.rationale}
                  />
                )}
              </>
            )}
          </Card>

          <Divider orientation="left" style={{ marginTop: 0 }}>Manager Assessment</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item
                name="managerRating"
                label="Manager Rating (1–10)"
                tooltip="Carries 20 of the 100 weight. Required to submit — without it the component is excluded from the score."
              >
                <InputNumber min={1} max={10} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="periodLabel" label="Period Label" tooltip="Shown in lists, e.g. &quot;Q2 FY26&quot;.">
                <Input placeholder="e.g. Aug 2026" disabled={!!editing} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="incrementRecommended" label="Increment Recommended (%)">
                <InputNumber min={0} max={100} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="strengths" label="Strengths">
                <Input.TextArea rows={3} placeholder="What this employee does well" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="improvements" label="Areas For Improvement">
                <Input.TextArea rows={3} placeholder="What needs to change" />
              </Form.Item>
            </Col>
            <Col xs={24}>
              <Form.Item name="managerRemarks" label="Manager Remarks">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left">Outcomes</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="pipRequired" label="Performance Improvement Plan" valuePropName="checked">
                <Switch checkedChildren="Required" unCheckedChildren="Not required" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="promotionRecommended" label="Recommend Promotion" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="pipReviewDate" label="PIP Review Date">
                <DatePicker style={{ width: '100%' }} format="DD MMM YYYY" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="pipObjectives" label="PIP Objectives">
                <Input.TextArea rows={2} placeholder="Specific, measurable objectives and the deadline" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="promotionRemarks" label="Promotion Remarks">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Col>
          </Row>
          {editing && (
            <Form.Item name="pipOutcome" label="PIP Outcome">
              <Select
                allowClear
                options={[
                  { value: 'open', label: 'Open' },
                  { value: 'met', label: 'Objectives Met' },
                  { value: 'not_met', label: 'Objectives Not Met' },
                  { value: 'withdrawn', label: 'Withdrawn' },
                ]}
              />
            </Form.Item>
          )}
          <Alert
            type="info"
            showIcon
            message="The automatic half is always recomputed on save"
            description="Scores are derived server-side from live attendance, targets and tasks, so a saved appraisal always reflects the data rather than anything sent from this screen."
          />
        </Form>
      </Modal>

      {/* ── Detail ───────────────────────────────────────────────────────── */}
      <Modal
        title={detail ? `Appraisal — ${detail.employeeName}` : 'Appraisal'}
        open={!!detail}
        onCancel={() => setDetail(null)}
        width={980}
        destroyOnHidden
        footer={[
          <Button key="close" onClick={() => setDetail(null)}>Close</Button>,
          detail?.status !== 'acknowledged' && (
            <Button key="edit" onClick={() => openEdit(detail)}>Edit</Button>
          ),
          detail?.status === 'submitted' && (
            <Button
              key="ack"
              type="primary"
              icon={<CheckCircleOutlined />}
              style={{ background: BRAND, borderColor: BRAND }}
              onClick={() => acknowledge(detail)}
            >
              Acknowledge
            </Button>
          ),
        ].filter(Boolean)}
      >
        {detail && (
          <>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col xs={24} md={8}>
                <Card size="small">
                  <Statistic
                    title="Total Score"
                    value={detail.totalScore}
                    suffix="/100"
                    precision={2}
                    valueStyle={{ color: scoreColor(detail.totalScore, detail.measuredWeight) }}
                  />
                  <Progress
                    percent={detail.totalScore}
                    size="small"
                    showInfo={false}
                    strokeColor={scoreColor(detail.totalScore, detail.measuredWeight)}
                  />
                </Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small"><Statistic title="Grade" value={detail.grade} valueStyle={{ color: BRAND }} /></Card>
              </Col>
              <Col xs={12} md={8}>
                <Card size="small">
                  <Statistic
                    title="Measurement Base"
                    value={detail.measuredWeight}
                    suffix="/100 weight"
                    valueStyle={{ color: detail.measuredWeight >= 50 ? POSITIVE : CAUTION }}
                  />
                </Card>
              </Col>
            </Row>

            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, md: 3 }} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Employee Code">{detail.empId || '—'}</Descriptions.Item>
              <Descriptions.Item label="Designation">{detail.designation || '—'}</Descriptions.Item>
              <Descriptions.Item label="Department">{detail.department || '—'}</Descriptions.Item>
              <Descriptions.Item label="Period">{fmtDate(detail.periodFrom)} – {fmtDate(detail.periodTo)}</Descriptions.Item>
              <Descriptions.Item label="Manager Rating">{detail.managerRating ? `${detail.managerRating}/10` : 'Not rated'}</Descriptions.Item>
              <Descriptions.Item label="Status"><Tag color={STATUS_COLOR[detail.status]}>{detail.status?.toUpperCase()}</Tag></Descriptions.Item>
              <Descriptions.Item label="Reviewed By">{detail.reviewedByName || '—'}</Descriptions.Item>
              <Descriptions.Item label="Submitted">{fmtDate(detail.submittedAt)}</Descriptions.Item>
              <Descriptions.Item label="Acknowledged">{fmtDate(detail.acknowledgedAt)}</Descriptions.Item>
            </Descriptions>

            {detail.warnings?.length > 0 && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="What this score does and does not cover"
                description={<ul style={{ paddingLeft: 18, marginBottom: 0 }}>{detail.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
              />
            )}

            <Card size="small" title="Score Breakdown" style={{ marginBottom: 16 }}>
              <Table
                size="small"
                rowKey="key"
                pagination={false}
                dataSource={detail.components || []}
                columns={breakdownColumns}
              />
            </Card>

            <Descriptions bordered size="small" column={1} style={{ marginBottom: 16 }}>
              <Descriptions.Item label="Strengths">{detail.strengths || '—'}</Descriptions.Item>
              <Descriptions.Item label="Areas For Improvement">{detail.improvements || '—'}</Descriptions.Item>
              <Descriptions.Item label="Manager Remarks">{detail.managerRemarks || '—'}</Descriptions.Item>
            </Descriptions>

            <Row gutter={12}>
              <Col xs={24} md={12}>
                <Card size="small" title="Performance Improvement Plan">
                  {detail.performanceImprovementPlan?.required ? (
                    <>
                      <Tag color="red">Required</Tag>
                      <Tag>{detail.performanceImprovementPlan.outcome}</Tag>
                      <Text style={{ display: 'block', marginTop: 8 }}>{detail.performanceImprovementPlan.objectives || 'No objectives recorded.'}</Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Review by {fmtDate(detail.performanceImprovementPlan.reviewDate)}
                      </Text>
                    </>
                  ) : <Text type="secondary">Not required.</Text>}
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card size="small" title="Promotion & Increment">
                  {detail.promotionRecommended
                    ? <Tag color="green">Promotion recommended</Tag>
                    : <Text type="secondary">No promotion recommended.</Text>}
                  {detail.incrementRecommended > 0 && <Tag color="blue" style={{ marginLeft: 6 }}>+{detail.incrementRecommended}%</Tag>}
                  {detail.promotionRemarks && <Text style={{ display: 'block', marginTop: 8 }}>{detail.promotionRemarks}</Text>}
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Modal>
    </div>
  );
};

export default PerformanceAppraisal;
