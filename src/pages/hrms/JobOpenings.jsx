import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Card, Col, DatePicker, Divider, Form, Input, InputNumber,
  message, Modal, Popconfirm, Row, Select, Space, Statistic, Switch, Table, Tag, Tooltip,
} from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../context/AuthContext.jsx';
import recruitmentService from '../../services/recruitmentService.js';

const DEPARTMENTS = ['Sales', 'Marketing', 'Accounts', 'Warehouse', 'Delivery', 'HR', 'IT', 'Admin', 'Production'];
const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Daily Wage'];
// Matches the JobOpening.jobMode enum on the backend.
const JOB_MODES = ['On-site', 'Hybrid', 'Remote'];
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'closed', label: 'Closed' },
];
const STATUS_COLOR = { open: 'green', on_hold: 'orange', closed: 'default' };

const JobOpenings = () => {
  const { activeBranchId, branchEpoch } = useAuth();
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, department: undefined });
  const [stats, setStats] = useState({ total: 0, open: 0, onHold: 0, closed: 0 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchStats = useCallback(async () => {
    if (!activeBranchId) return;
    try {
      const res = await recruitmentService.getJobOpeningStats();
      if (res.success) setStats(res.data || {});
    } catch (error) { message.error(error.message); }
  }, [activeBranchId, branchEpoch]);

  const fetchOpenings = useCallback(async () => {
    if (!activeBranchId) { setOpenings([]); return; }
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };
      const res = await recruitmentService.getJobOpenings(params);
      if (res.success) {
        setOpenings(res.data || []);
        setPagination((c) => ({ ...c, total: res.pagination?.totalItems || 0 }));
      }
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [activeBranchId, branchEpoch, filters, pagination.current, pagination.pageSize, search]);

  useEffect(() => { fetchOpenings(); fetchStats(); }, [fetchOpenings, fetchStats]);

  const openModal = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({
        ...record,
        closingDate: record.closingDate ? dayjs(record.closingDate) : null,
        // The API nests these; the form keeps them flat so Ant Design can bind to them.
        salaryMin: record.salaryRange?.min ?? 0,
        salaryMax: record.salaryRange?.max ?? 0,
        salaryPeriod: record.salaryRange?.period || 'year',
        tags: record.tags || [],
        keywords: record.keywords || [],
        publicVisible: record.publicVisible === true,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({
        positions: 1, employmentType: 'Full Time', status: 'open',
        jobMode: 'On-site', salaryPeriod: 'year', publicVisible: false,
      });
    }
    setModalOpen(true);
  };

  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const { salaryMin, salaryMax, salaryPeriod, ...rest } = values;
      const payload = {
        ...rest,
        closingDate: values.closingDate ? values.closingDate.format('YYYY-MM-DD') : null,
        salaryRange: { min: salaryMin || 0, max: salaryMax || 0, period: salaryPeriod || 'year' },
      };
      const res = editing
        ? await recruitmentService.updateJobOpening(editing._id, payload)
        : await recruitmentService.createJobOpening(payload);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Saved.');
      closeModal();
      await Promise.all([fetchOpenings(), fetchStats()]);
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save job opening');
    } finally { setLoading(false); }
  };

  const handleDelete = async (record) => {
    try {
      const res = await recruitmentService.deleteJobOpening(record._id);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Deleted.');
      await Promise.all([fetchOpenings(), fetchStats()]);
    } catch (error) { message.error(error.message); }
  };

  const columns = [
    {
      title: 'Job', key: 'job', width: 220,
      render: (_, r) => <div><div className="font-medium text-gray-900">{r.title}</div><span className="text-xs text-gray-400">{r.jobCode}</span></div>,
    },
    { title: 'Department', dataIndex: 'department', key: 'department', width: 120 },
    { title: 'Designation', dataIndex: 'designation', key: 'designation', width: 140 },
    { title: 'Positions', dataIndex: 'positions', key: 'positions', width: 90, align: 'center' },
    { title: 'Applicants', dataIndex: 'candidateCount', key: 'candidateCount', width: 100, align: 'center' },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100,
      render: (status) => <Tag color={STATUS_COLOR[status]}>{STATUS_OPTIONS.find(s => s.value === status)?.label || status}</Tag>,
    },
    {
      // Publication state is separate from the opening's own status: a job can be
      // `open` internally while not advertised. Showing it here prevents the classic
      // "why is nobody applying" question when the listing was simply never published.
      title: 'Careers Site', key: 'publicVisible', width: 120, align: 'center',
      render: (_, r) => (r.publicVisible === true
        ? <Tooltip title="Visible on the public careers page"><Tag color="blue">Published</Tag></Tooltip>
        : <Tooltip title="Not shown on the careers page"><Tag>Internal</Tag></Tooltip>),
    },
    { title: 'Posted', dataIndex: 'postedDate', key: 'postedDate', width: 105, render: (v) => v ? dayjs(v).format('DD/MM/YY') : '-' },
    {
      title: 'Actions', key: 'actions', width: 100, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          <Popconfirm title="Delete this job opening?" onConfirm={() => handleDelete(r)} okButtonProps={{ danger: true }}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Job Openings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create and manage open positions for recruitment</p>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} disabled={!activeBranchId} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
          New Job Opening
        </Button>
      </div>

      {!activeBranchId && <Alert className="mb-4" type="warning" showIcon message="Select an active branch before managing job openings." />}

      <Row gutter={[12, 12]} className="mb-4">
        <Col xs={12} md={6}><Card size="small"><Statistic title="Total" value={stats.total || 0} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Open" value={stats.open || 0} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="On Hold" value={stats.onHold || 0} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col xs={12} md={6}><Card size="small"><Statistic title="Closed" value={stats.closed || 0} valueStyle={{ color: '#94a3b8' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input
            placeholder="Search title, department, code..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPagination((c) => ({ ...c, current: 1 })); }}
            className="w-72" allowClear
          />
          <Select placeholder="Status" options={STATUS_OPTIONS} value={filters.status} onChange={(v) => setFilters((c) => ({ ...c, status: v }))} allowClear className="w-36" />
          <Select placeholder="Department" options={DEPARTMENTS.map(v => ({ value: v, label: v }))} value={filters.department} onChange={(v) => setFilters((c) => ({ ...c, department: v }))} allowClear className="w-40" />
          <Button onClick={() => { setSearch(''); setFilters({ status: undefined, department: undefined }); }}>Reset</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchOpenings(); fetchStats(); }}>Refresh</Button>
          <Button icon={<ReloadOutlined />} onClick={() => { fetchOpenings(); fetchStats(); }} loading={loading}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={openings}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 950 }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['10', '20', '50'], showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} openings` }}
          onChange={(next) => setPagination((c) => ({ ...c, current: next.current, pageSize: next.pageSize }))}
        />
      </div>

      <Modal
        title={editing ? 'Edit Job Opening' : 'New Job Opening'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={loading}
        okText={editing ? 'Update' : 'Create'}
        width={720}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={12}><Form.Item name="title" label="Job Title" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={12}><Form.Item name="designation" label="Designation" rules={[{ required: true }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="department" label="Department" rules={[{ required: true }]}><Select options={DEPARTMENTS.map(v => ({ value: v, label: v }))} showSearch /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="employmentType" label="Employment Type"><Select options={EMPLOYMENT_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="positions" label="Number of Positions" rules={[{ required: true }]}><InputNumber min={1} className="w-full" /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}><Form.Item name="experienceRequired" label="Experience Required"><Input placeholder="e.g. 2-4 years" /></Form.Item></Col>
            <Col xs={24} md={8}><Form.Item name="closingDate" label="Closing Date"><DatePicker className="w-full" format="DD/MM/YYYY" /></Form.Item></Col>
            {editing && <Col xs={24} md={8}><Form.Item name="status" label="Status"><Select options={STATUS_OPTIONS} /></Form.Item></Col>}
          </Row>
          <Divider />
          <Form.Item name="description" label="Job Description"><Input.TextArea rows={3} maxLength={2000} showCount /></Form.Item>
          <Form.Item name="requirements" label="Requirements"><Input.TextArea rows={3} maxLength={2000} showCount /></Form.Item>

          {/* ── Public careers-site fields ───────────────────────────────────
              Everything below appears on the public BDMTILES careers page and drives
              the ATS score, so it is grouped and labelled separately from the internal
              HR fields above. Nothing here is required — an opening can be created
              internally first and published later. */}
          <Divider orientation="left" plain>Public careers-site listing</Divider>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="location" label="Location" tooltip="Shown on the careers page, e.g. Bengaluru, Karnataka">
                <Input placeholder="e.g. Bengaluru, Karnataka" />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="jobMode" label="Work Mode" initialValue="On-site">
                <Select options={JOB_MODES.map(v => ({ value: v, label: v }))} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="tags" label="Tags" tooltip="Short chips shown on the job card">
                <Select mode="tags" placeholder="e.g. Field sales, Tiles" open={false} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Form.Item name="salaryMin" label="Salary From" tooltip="Used to check the applicant's expectation against your band">
                <InputNumber min={0} className="w-full" prefix="₹" step={10000} />
              </Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="salaryMax" label="Salary To"><InputNumber min={0} className="w-full" prefix="₹" step={10000} /></Form.Item>
            </Col>
            <Col xs={24} md={8}>
              <Form.Item name="salaryPeriod" label="Salary Period" initialValue="year">
                <Select options={[{ value: 'year', label: 'Per year' }, { value: 'month', label: 'Per month' }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="keywords"
            label="ATS Keywords"
            tooltip="Terms the ATS looks for in applications. Leave empty to auto-derive from the Requirements text."
          >
            <Select mode="tags" placeholder="e.g. field sales, tiles, dealer visits" open={false} />
          </Form.Item>
          <Form.Item
            name="publicVisible"
            label="Publish on careers site"
            valuePropName="checked"
            tooltip="Off by default. The opening stays internal until you tick this."
            initialValue={false}
          >
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default JobOpenings;
