import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Divider, Empty, Form, Input, InputNumber,
  message, Modal, Popconfirm, Radio, Rate, Row, Select, Space, Statistic, Table, Tag,
  Timeline, Tooltip, Upload,
} from 'antd';
import {
  CheckCircleOutlined, DeleteOutlined, DownloadOutlined, EditOutlined, EyeOutlined,
  PlusOutlined, ReloadOutlined, SearchOutlined, StarOutlined, StarFilled,
  SwapRightOutlined, UploadOutlined, UserAddOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext.jsx';
import recruitmentService from '../../services/recruitmentService.js';

const DEPARTMENTS = ['Sales', 'Marketing', 'Accounts', 'Warehouse', 'Delivery', 'HR', 'IT', 'Admin', 'Production'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Daily Wage'];
const SOURCES = [
  { value: 'referral', label: 'Referral' },
  { value: 'job_portal', label: 'Job Portal' },
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'social_media', label: 'Social Media' },
  { value: 'consultancy', label: 'Consultancy' },
  { value: 'other', label: 'Other' },
];
const PIPELINE_STATUSES = ['Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected'];
const STATUS_COLOR = { Applied: 'blue', Shortlisted: 'gold', Interview: 'purple', Selected: 'green', Rejected: 'red' };
const INTERVIEW_MODES = [
  { value: 'in_person', label: 'In Person' },
  { value: 'phone', label: 'Phone' },
  { value: 'video', label: 'Video' },
];

const CandidatePipeline = () => {
  const { activeBranchId, branchEpoch } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, jobOpening: undefined });
  const [talentPoolView, setTalentPoolView] = useState(false);
  const [stats, setStats] = useState({ total: 0, applied: 0, shortlisted: 0, interview: 0, selected: 0, rejected: 0, talentPool: 0 });
  const [jobOptions, setJobOptions] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const [viewCandidate, setViewCandidate] = useState(null);
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);

  const [interviewCandidate, setInterviewCandidate] = useState(null);
  const [interviewForm] = Form.useForm();

  const [feedbackTarget, setFeedbackTarget] = useState(null); // { candidate, interview }
  const [feedbackForm] = Form.useForm();

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  const [convertTarget, setConvertTarget] = useState(null);
  const [convertForm] = Form.useForm();
  const [converting, setConverting] = useState(false);

  const fetchStats = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await recruitmentService.getCandidateStats();
      if (res.success) setStats(res.data || {});
    } catch (error) { message.error(error.message); }
  }, [activeBranchId, branchEpoch]);

  const fetchJobOptions = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await recruitmentService.getJobOpeningOptions();
      if (res.success) setJobOptions((res.data || []).map(j => ({ value: j._id, label: `${j.jobCode} — ${j.title}` })));
    } catch { /* non-critical for the filter bar */ }
  }, [activeBranchId, branchEpoch]);

  const fetchCandidates = useCallback(async () => {
    if (!activeBranchId) { setCandidates([]); return; }
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
        ...(talentPoolView ? { talentPool: 'true' } : {}),
      };
      const res = await recruitmentService.getCandidates(params);
      if (res.success) {
        setCandidates(res.data || []);
        setPagination((c) => ({ ...c, total: res.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [activeBranchId, branchEpoch, filters, pagination.current, pagination.pageSize, search, talentPoolView]);

  useEffect(() => { fetchCandidates(); fetchStats(); fetchJobOptions(); }, [fetchCandidates, fetchStats, fetchJobOptions]);

  // ── Create / Edit candidate ────────────────────────────────────────────
  const openModal = (record = null) => {
    setEditing(record);
    if (record) form.setFieldsValue(record);
    else { form.resetFields(); form.setFieldsValue({ source: 'other' }); }
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = editing
        ? await recruitmentService.updateCandidate(editing._id, values)
        : await recruitmentService.createCandidate(values);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Saved.');
      closeModal();
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save candidate');
    } finally { setLoading(false); }
  };

  const handleDelete = async (record) => {
    try {
      const res = await recruitmentService.deleteCandidate(record._id);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Deleted.');
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) { message.error(error.message); }
  };

  // ── Pipeline status ─────────────────────────────────────────────────────
  const setStatus = async (record, status) => {
    try {
      const res = await recruitmentService.updateCandidateStatus(record._id, status);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Status updated.');
      if (viewCandidate?._id === record._id) setViewCandidate(res.data);
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) { message.error(error.message); }
  };

  const confirmReject = async () => {
    try {
      const res = await recruitmentService.updateCandidateStatus(rejectTarget._id, 'Rejected', rejectReason);
      if (!res.success) throw new Error(res.message);
      message.success('Candidate marked Rejected.');
      setRejectTarget(null);
      setRejectReason('');
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) { message.error(error.message); }
  };

  const toggleTalentPool = async (record) => {
    try {
      const res = await recruitmentService.setTalentPool(record._id, !record.talentPool);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Updated.');
      if (viewCandidate?._id === record._id) setViewCandidate(res.data);
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) { message.error(error.message); }
  };

  // ── Resume ──────────────────────────────────────────────────────────────
  const handleResumeUpload = async (candidate) => {
    if (!resumeFile) return message.error('Choose a resume file first.');
    setUploadingResume(true);
    try {
      const res = await recruitmentService.uploadResume(candidate._id, resumeFile);
      if (!res.success) throw new Error(res.message);
      message.success('Resume uploaded.');
      setResumeFile(null);
      setViewCandidate(res.data);
      await fetchCandidates();
    } catch (error) { message.error(error.message); }
    finally { setUploadingResume(false); }
  };

  const handleResumeDownload = async (candidate) => {
    try {
      const blob = await recruitmentService.downloadResume(candidate._id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = candidate.resume?.name || `${candidate.candidateCode}-resume`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (error) { message.error(error.message || 'Failed to download resume'); }
  };

  // ── Interviews ──────────────────────────────────────────────────────────
  const openScheduleInterview = (candidate) => {
    setInterviewCandidate(candidate);
    interviewForm.resetFields();
    interviewForm.setFieldsValue({ mode: 'in_person', scheduledAt: dayjs().add(1, 'day').hour(11).minute(0) });
  };

  const handleScheduleInterview = async () => {
    try {
      const values = await interviewForm.validateFields();
      setLoading(true);
      const res = await recruitmentService.scheduleInterview(interviewCandidate._id, {
        ...values, scheduledAt: values.scheduledAt.toISOString(),
      });
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Interview scheduled.');
      setInterviewCandidate(null);
      if (viewCandidate?._id === res.data?._id) setViewCandidate(res.data);
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to schedule interview');
    } finally { setLoading(false); }
  };

  const openFeedback = (candidate, interview) => {
    setFeedbackTarget({ candidate, interview });
    feedbackForm.setFieldsValue({ status: interview.status === 'scheduled' ? 'completed' : interview.status, feedback: interview.feedback, rating: interview.rating });
  };

  const handleSaveFeedback = async () => {
    try {
      const values = await feedbackForm.validateFields();
      setLoading(true);
      const res = await recruitmentService.updateInterview(feedbackTarget.candidate._id, feedbackTarget.interview._id, values);
      if (!res.success) throw new Error(res.message);
      message.success('Feedback saved.');
      setFeedbackTarget(null);
      if (viewCandidate?._id === res.data?._id) setViewCandidate(res.data);
      await fetchCandidates();
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save feedback');
    } finally { setLoading(false); }
  };

  // ── Convert to employee ─────────────────────────────────────────────────
  const openConvert = (candidate) => {
    setConvertTarget(candidate);
    convertForm.resetFields();
    convertForm.setFieldsValue({
      designation: candidate.jobOpening?.designation || '',
      department: candidate.jobOpening?.department || '',
      dateOfJoining: dayjs(),
      employmentType: 'Full Time',
      basicSalary: candidate.expectedSalary || 0,
    });
  };

  const handleConvert = async () => {
    try {
      const values = await convertForm.validateFields();
      setConverting(true);
      const payload = { ...values, dateOfJoining: values.dateOfJoining.format('YYYY-MM-DD') };
      const res = await recruitmentService.convertToEmployee(convertTarget._id, payload);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Candidate converted to employee.');
      setConvertTarget(null);
      setViewCandidate(null);
      await Promise.all([fetchCandidates(), fetchStats()]);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to convert candidate');
    } finally { setConverting(false); }
  };

  const columns = [
    {
      title: 'Candidate', key: 'candidate', width: 200,
      render: (_, r) => <div><div className="font-medium text-gray-900">{r.name}</div><span className="text-xs text-gray-400">{r.candidateCode}</span></div>,
    },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile', width: 120 },
    { title: 'Job Opening', key: 'jobOpening', width: 160, render: (_, r) => r.jobOpening?.title || '-' },
    { title: 'Qualification', dataIndex: 'qualification', key: 'qualification', width: 140, render: (v) => v || '-' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 115,
      render: (status) => <Tag color={STATUS_COLOR[status]}>{status}</Tag>,
    },
    {
      title: 'Talent Pool', dataIndex: 'talentPool', key: 'talentPool', width: 90, align: 'center',
      render: (v, r) => <Tooltip title={v ? 'In talent pool' : 'Add to talent pool'}><Button type="text" size="small" icon={v ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined />} onClick={() => toggleTalentPool(r)} /></Tooltip>,
    },
    {
      title: 'Actions', key: 'actions', width: 220, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewCandidate(r)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          {r.status === 'Selected' && !r.convertedToEmployee && (
            <Tooltip title="Convert to Employee"><Button type="text" size="small" icon={<UserAddOutlined />} className="text-green-600" onClick={() => openConvert(r)} /></Tooltip>
          )}
          {!r.convertedToEmployee && (
            <Popconfirm title="Delete this candidate?" onConfirm={() => handleDelete(r)} okButtonProps={{ danger: true }}>
              <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Candidate Recruitment</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track candidates from application through interview to hire</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} disabled={!activeBranchId} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          Add Candidate
        </Button>
      </div>

      {!activeBranchId && <Alert className="mb-4" type="warning" showIcon message="Select an active branch before managing candidates." />}

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} md={4} lg={3}><Card size="small"><Statistic title="Total" value={stats.total || 0} /></Card></Col>
        <Col xs={12} md={4} lg={3}><Card size="small"><Statistic title="Applied" value={stats.applied || 0} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={12} md={4} lg={3}><Card size="small"><Statistic title="Shortlisted" value={stats.shortlisted || 0} valueStyle={{ color: '#d4b106' }} /></Card></Col>
        <Col xs={12} md={4} lg={3}><Card size="small"><Statistic title="Interview" value={stats.interview || 0} valueStyle={{ color: '#722ed1' }} /></Card></Col>
        <Col xs={12} md={4} lg={3}><Card size="small"><Statistic title="Selected" value={stats.selected || 0} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col xs={12} md={4} lg={3}><Card size="small"><Statistic title="Rejected" value={stats.rejected || 0} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col xs={12} md={4} lg={3}>
          <Card size="small" className={talentPoolView ? 'ring-2 ring-[#FF5F03]' : ''} styles={{ body: { cursor: 'pointer' } }} onClick={() => setTalentPoolView((v) => !v)}>
            <Statistic title="Talent Pool" value={stats.talentPool || 0} valueStyle={{ color: '#faad14' }} prefix={<StarFilled />} />
          </Card>
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap items-center gap-3">
          <Input
            placeholder="Search name, mobile, email, code..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagination((c) => ({ ...c, current: 1 })); }}
            className="w-72" allowClear
          />
          {!talentPoolView && (
            <>
              <Select placeholder="Status" options={PIPELINE_STATUSES.map(v => ({ value: v, label: v }))} value={filters.status} onChange={(v) => setFilters((c) => ({ ...c, status: v }))} allowClear className="w-36" />
              <Select placeholder="Job Opening" options={jobOptions} value={filters.jobOpening} onChange={(v) => setFilters((c) => ({ ...c, jobOpening: v }))} allowClear showSearch optionFilterProp="label" className="w-52" />
            </>
          )}
          {talentPoolView && <Tag color="gold" className="text-sm py-1 px-3">Viewing Talent Pool — click the star card again to return to the full pipeline</Tag>}
          <Button onClick={() => { setSearch(''); setFilters({ status: undefined, jobOpening: undefined }); }}>Reset</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchCandidates(); fetchStats(); }}>Refresh</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchCandidates(); fetchStats(); }} loading={loading}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={candidates}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 1050 }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} candidates` }}
          onChange={(next) => setPagination((c) => ({ ...c, current: next.current, pageSize: next.pageSize }))}
        />
      </div>

      {/* Add / Edit candidate */}
      <Modal
        title={editing ? 'Edit Candidate' : 'Add Candidate'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={loading}
        okText={editing ? 'Update' : 'Add'}
        width={760}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="name" label="Full Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="mobile" label="Mobile" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="email" label="Email"><Input type="email" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="qualification" label="Qualification"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="experience" label="Experience"><Input placeholder="e.g. 3 years" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="currentEmployer" label="Current Employer"><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="jobOpening" label="Job Opening"><Select options={jobOptions} allowClear showSearch optionFilterProp="label" placeholder="Select an open position" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="source" label="Source"><Select options={SOURCES} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="expectedSalary" label="Expected Salary"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="state" label="State"><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="address" label="Address"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="tags" label="Tags / Skills"><Select mode="tags" placeholder="Type and press enter to add keywords" /></Form.Item>
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} maxLength={1000} showCount /></Form.Item>
        </Form>
      </Modal>

      {/* View candidate detail */}
      <Modal
        title={viewCandidate ? `${viewCandidate.name} — ${viewCandidate.candidateCode}` : 'Candidate'}
        open={Boolean(viewCandidate)}
        onCancel={() => { setViewCandidate(null); setResumeFile(null); }}
        footer={<Button onClick={() => setViewCandidate(null)}>Close</Button>}
        width={860}
      >
        {viewCandidate && (
          <div className="space-y-4 mt-4 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 bg-gray-50 rounded-lg p-4">
              <div><span className="text-gray-500 block">Status</span><Tag color={STATUS_COLOR[viewCandidate.status]}>{viewCandidate.status}</Tag></div>
              <div><span className="text-gray-500 block">Mobile</span><strong>{viewCandidate.mobile}</strong></div>
              <div><span className="text-gray-500 block">Email</span><strong>{viewCandidate.email || '-'}</strong></div>
              <div><span className="text-gray-500 block">Job Opening</span><strong>{viewCandidate.jobOpening?.title || '-'}</strong></div>
              <div><span className="text-gray-500 block">Qualification</span><strong>{viewCandidate.qualification || '-'}</strong></div>
              <div><span className="text-gray-500 block">Experience</span><strong>{viewCandidate.experience || '-'}</strong></div>
              <div><span className="text-gray-500 block">Expected Salary</span><strong>{viewCandidate.expectedSalary ? `₹${Number(viewCandidate.expectedSalary).toLocaleString()}` : '-'}</strong></div>
              <div><span className="text-gray-500 block">Source</span><strong>{SOURCES.find(s => s.value === viewCandidate.source)?.label || '-'}</strong></div>
            </div>

            {viewCandidate.convertedToEmployee && (
              <Alert type="success" showIcon message={`Converted to employee ${viewCandidate.convertedToEmployee.empId || ''} (${viewCandidate.convertedToEmployee.name || ''})`} />
            )}

            <Divider className="!my-3" />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <strong>Pipeline</strong>
                {!viewCandidate.convertedToEmployee && (
                  <Space size="small">
                    {PIPELINE_STATUSES.filter(s => s !== viewCandidate.status).map((s) => (
                      <Button key={s} size="small" onClick={() => s === 'Rejected' ? setRejectTarget(viewCandidate) : setStatus(viewCandidate, s)}>
                        <SwapRightOutlined /> {s}
                      </Button>
                    ))}
                  </Space>
                )}
              </div>
              {viewCandidate.status === 'Rejected' && viewCandidate.rejectionReason && (
                <Alert type="error" showIcon className="mb-2" message={`Rejection reason: ${viewCandidate.rejectionReason}`} />
              )}
            </div>

            <Divider className="!my-3" />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <strong>Resume</strong>
                <Space size="small">
                  <Upload beforeUpload={(file) => { setResumeFile(file); return false; }} maxCount={1} showUploadList={{ showRemoveIcon: true }} fileList={resumeFile ? [{ uid: '-1', name: resumeFile.name }] : []} onRemove={() => setResumeFile(null)}>
                    <Button icon={<UploadOutlined />} size="small">Choose File</Button>
                  </Upload>
                  <Button size="small" type="primary" disabled={!resumeFile} loading={uploadingResume} onClick={() => handleResumeUpload(viewCandidate)} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>Upload</Button>
                </Space>
              </div>
              {viewCandidate.resume?.url ? (
                <div className="flex items-center justify-between rounded border border-gray-200 p-2">
                  <span>{viewCandidate.resume.name}</span>
                  <Button size="small" icon={<DownloadOutlined />} onClick={() => handleResumeDownload(viewCandidate)}>Download</Button>
                </div>
              ) : <Empty description="No resume uploaded" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </div>

            <Divider className="!my-3" />
            <div>
              <div className="mb-2 flex items-center justify-between">
                <strong>Interviews</strong>
                <Button size="small" icon={<PlusOutlined />} onClick={() => openScheduleInterview(viewCandidate)}>Schedule Interview</Button>
              </div>
              {(viewCandidate.interviews || []).length ? (
                <Timeline
                  items={viewCandidate.interviews.slice().reverse().map((iv) => ({
                    color: iv.status === 'completed' ? 'green' : iv.status === 'cancelled' || iv.status === 'no_show' ? 'red' : 'blue',
                    children: (
                      <div className="pb-2">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{iv.round} — {dayjs(iv.scheduledAt).format('DD/MM/YYYY hh:mm A')}</span>
                          <Button size="small" type="link" onClick={() => openFeedback(viewCandidate, iv)}>Feedback</Button>
                        </div>
                        <div className="text-xs text-gray-500">{INTERVIEW_MODES.find(m => m.value === iv.mode)?.label} · {iv.interviewer || 'Interviewer TBD'} · <Tag className="ml-1" color={iv.status === 'completed' ? 'green' : 'default'}>{iv.status}</Tag></div>
                        {iv.rating ? <Rate disabled value={iv.rating} className="text-sm" /> : null}
                        {iv.feedback && <p className="mt-1 text-gray-600">{iv.feedback}</p>}
                      </div>
                    ),
                  }))}
                />
              ) : <Empty description="No interviews scheduled yet" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
            </div>

            {viewCandidate.notes && (
              <>
                <Divider className="!my-3" />
                <div><strong>Notes</strong><p className="mt-1 text-gray-600">{viewCandidate.notes}</p></div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* Schedule interview */}
      <Modal
        title={interviewCandidate ? `Schedule Interview — ${interviewCandidate.name}` : 'Schedule Interview'}
        open={Boolean(interviewCandidate)}
        onCancel={() => setInterviewCandidate(null)}
        onOk={handleScheduleInterview}
        confirmLoading={loading}
        okText="Schedule"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Form form={interviewForm} layout="vertical" className="mt-4">
          <Form.Item name="scheduledAt" label="Date & Time" rules={[{ required: true }]}><DatePicker showTime format="DD/MM/YYYY hh:mm A" className="w-full" /></Form.Item>
          <Form.Item name="round" label="Round"><Input placeholder="e.g. Round 1 — HR" /></Form.Item>
          <Form.Item name="mode" label="Mode"><Radio.Group options={INTERVIEW_MODES} optionType="button" /></Form.Item>
          <Form.Item name="location" label="Location / Meeting Link"><Input /></Form.Item>
          <Form.Item name="interviewer" label="Interviewer"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* Interview feedback */}
      <Modal
        title="Interview Feedback"
        open={Boolean(feedbackTarget)}
        onCancel={() => setFeedbackTarget(null)}
        onOk={handleSaveFeedback}
        confirmLoading={loading}
        okText="Save Feedback"
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Form form={feedbackForm} layout="vertical" className="mt-4">
          <Form.Item name="status" label="Interview Status"><Select options={[{ value: 'scheduled', label: 'Scheduled' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'no_show', label: 'No Show' }]} /></Form.Item>
          <Form.Item name="rating" label="Rating"><Rate /></Form.Item>
          <Form.Item name="feedback" label="Feedback"><Input.TextArea rows={4} maxLength={1000} showCount /></Form.Item>
        </Form>
      </Modal>

      {/* Reject with reason */}
      <Modal
        title={`Reject ${rejectTarget?.name || 'candidate'}`}
        open={Boolean(rejectTarget)}
        onCancel={() => { setRejectTarget(null); setRejectReason(''); }}
        onOk={confirmReject}
        okText="Confirm Reject"
        okButtonProps={{ danger: true }}
      >
        <Input.TextArea rows={3} maxLength={500} showCount placeholder="Reason for rejection (optional)" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
      </Modal>

      {/* Convert to employee */}
      <Modal
        title={`Convert ${convertTarget?.name || 'candidate'} to Employee`}
        open={Boolean(convertTarget)}
        onCancel={() => setConvertTarget(null)}
        onOk={handleConvert}
        confirmLoading={converting}
        okText="Convert"
        width={720}
        okButtonProps={{ icon: <CheckCircleOutlined />, style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Alert className="mb-4" type="info" showIcon message="Name, contact, qualification, experience, and resume carry forward automatically. Add the employee-specific details below." />
        <Form form={convertForm} layout="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="designation" label="Designation" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select options={DEPARTMENTS.map(v => ({ value: v, label: v }))} showSearch /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="dateOfJoining" label="Date of Joining" rules={[{ required: true }]}><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="employmentType" label="Employment Type"><Select options={EMPLOYMENT_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="basicSalary" label="Basic Salary"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="workLocation" label="Work Location"><Input /></Form.Item></Col>
          </Row>
          <Form.Item name="reportingManager" label="Reporting Manager"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CandidatePipeline;
