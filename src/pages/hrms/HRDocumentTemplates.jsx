import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Col, Divider, Form, Input, message, Modal, Popconfirm,
  Row, Select, Space, Switch, Table, Tag, Tooltip,
} from 'antd';
import {
  DeleteOutlined, EditOutlined,
  FileAddOutlined, PlusOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext.jsx';
import hrTemplateService from '../../services/hrTemplateService.js';
import hrmsService from '../../services/hrmsService.js';

const DOCUMENT_TYPES = ['Offer Letter', 'Appointment Letter', 'NDA', 'Relieving Letter', 'Experience Certificate', 'Other'];

const HRDocumentTemplates = () => {
  const { activeBranchId, branchEpoch } = useAuth();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [documentType, setDocumentType] = useState(undefined);
  const [fieldMap, setFieldMap] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  // Ready-made letter starters, offered when creating (not editing) a template.
  const [starters, setStarters] = useState([]);
  const [seeding, setSeeding] = useState(false);

  // Generate flow
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateTemplate, setGenerateTemplate] = useState(null);
  const [employeeOptions, setEmployeeOptions] = useState([]);
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(undefined);
  const [previewText, setPreviewText] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const fetchTemplates = useCallback(async () => {
    if (!activeBranchId) { setTemplates([]); return; }
    setLoading(true);
    try {
      const res = await hrTemplateService.getTemplates({ search: search || undefined, documentType });
      if (res.success) setTemplates(res.data || []);
    } catch (error) { message.error(error.message); }
    finally { setLoading(false); }
  }, [activeBranchId, branchEpoch, search, documentType]);

  const fetchFieldMap = useCallback(async () => {
    try {
      const res = await hrTemplateService.getFieldMap();
      if (res.success) setFieldMap(res.data || []);
    } catch { /* non-critical helper list */ }
  }, []);

  const fetchStarters = useCallback(async () => {
    try {
      const res = await hrTemplateService.getStarters();
      if (res.success) setStarters(res.data || []);
    } catch { /* picker is a convenience; the free-text path still works */ }
  }, []);

  useEffect(() => { fetchTemplates(); fetchFieldMap(); fetchStarters(); }, [fetchTemplates, fetchFieldMap, fetchStarters]);

  const fetchEmployeeOptions = useCallback(async (text = '') => {
    try {
      const res = await hrmsService.getEmployees({ search: text, limit: 50, status: 'Active' });
      if (res.success) setEmployeeOptions((res.data || []).map(e => ({ value: e._id, label: `${e.empId} — ${e.name} (${e.designation || 'N/A'})` })));
    } catch (error) { message.error(error.message); }
  }, []);

  // ── Template CRUD ────────────────────────────────────────────────────────
  const openModal = (record = null) => {
    setEditing(record);
    if (record) form.setFieldsValue(record);
    else { form.resetFields(); form.setFieldsValue({ documentType: 'Offer Letter', isActive: true }); }
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); form.resetFields(); };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = editing
        ? await hrTemplateService.updateTemplate(editing._id, values)
        : await hrTemplateService.createTemplate(values);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Saved.');
      closeModal();
      await fetchTemplates();
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save template');
    } finally { setLoading(false); }
  };

  const handleDelete = async (record) => {
    try {
      const res = await hrTemplateService.deleteTemplate(record._id);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Deleted.');
      await fetchTemplates();
    } catch (error) { message.error(error.message); }
  };

  const insertVariable = (variable) => {
    const current = form.getFieldValue('content') || '';
    form.setFieldsValue({ content: `${current}${current && !current.endsWith('\n') ? ' ' : ''}${variable}` });
  };

  // Drop a ready-made letter into the form. Overwrites the body on purpose: the point
  // is to replace the blank canvas, and the browser still has the admin's undo.
  const applyStarter = (starter) => {
    form.setFieldsValue({
      templateName: starter.templateName,
      documentType: starter.documentType,
      content: starter.content,
      isActive: true,
    });
    message.success(`Loaded "${starter.templateName}" — review and save.`);
  };

  // One-click bulk add of every ready-made letter the branch is missing.
  const handleSeedStarters = async () => {
    setSeeding(true);
    try {
      const res = await hrTemplateService.seedStarters();
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Ready-made templates added.');
      await fetchTemplates();
    } catch (error) { message.error(error.message || 'Failed to add ready-made templates'); }
    finally { setSeeding(false); }
  };

  // ── Generate flow: select template -> select employee -> preview -> generate PDF ──
  const openGenerate = (template) => {
    setGenerateTemplate(template);
    setSelectedEmployeeId(undefined);
    setPreviewText('');
    setEmployeeSearch('');
    fetchEmployeeOptions('');
    setGenerateOpen(true);
  };

  const closeGenerate = () => {
    setGenerateOpen(false);
    setGenerateTemplate(null);
    setSelectedEmployeeId(undefined);
    setPreviewText('');
  };

  const loadPreview = useCallback(async (employeeId) => {
    if (!generateTemplate || !employeeId) { setPreviewText(''); return; }
    setPreviewLoading(true);
    try {
      const res = await hrTemplateService.previewTemplate(generateTemplate._id, employeeId);
      if (res.success) setPreviewText(res.data?.rendered || '');
    } catch (error) { message.error(error.message); }
    finally { setPreviewLoading(false); }
  }, [generateTemplate]);

  useEffect(() => { if (selectedEmployeeId) loadPreview(selectedEmployeeId); }, [selectedEmployeeId, loadPreview]);

  const handleGenerate = async () => {
    if (!selectedEmployeeId) return message.error('Select an employee first.');
    setGenerating(true);
    try {
      const res = await hrTemplateService.generateDocument(generateTemplate._id, selectedEmployeeId);
      if (!res.success) throw new Error(res.message);
      message.success(res.message || 'Document generated and saved to employee documents.');
      const blob = await hrTemplateService.downloadDocument(res.data.fileName);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      closeGenerate();
    } catch (error) { message.error(error.message || 'Failed to generate document'); }
    finally { setGenerating(false); }
  };

  const columns = [
    {
      title: 'Template', key: 'template', width: 220,
      render: (_, r) => <div><div className="font-medium text-gray-900">{r.templateName}</div><span className="text-xs text-gray-400">{r.templateCode}</span></div>,
    },
    { title: 'Document Type', dataIndex: 'documentType', key: 'documentType', width: 170, render: (v) => <Tag color="blue">{v}</Tag> },
    { title: 'Variables', dataIndex: 'variables', key: 'variables', render: (vars) => (vars || []).length ? (vars || []).map(v => <Tag key={v}>{`{{${v}}}`}</Tag>) : <span className="text-gray-400">None</span> },
    {
      title: 'Active', dataIndex: 'isActive', key: 'isActive', width: 80, align: 'center',
      render: (v) => <Tag color={v ? 'green' : 'default'}>{v ? 'Active' : 'Inactive'}</Tag>,
    },
    {
      title: 'Actions', key: 'actions', width: 160, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="Generate document"><Button type="text" size="small" icon={<FileAddOutlined />} className="text-green-600" disabled={!r.isActive} onClick={() => openGenerate(r)} /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openModal(r)} /></Tooltip>
          <Popconfirm title="Delete this template?" onConfirm={() => handleDelete(r)} okButtonProps={{ danger: true }}>
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
          <h1 className="text-2xl font-bold text-gray-800">HR Document Templates</h1>
          <p className="text-sm text-gray-500 mt-0.5">Create reusable Offer Letter, Appointment Letter, NDA and other HR document templates</p>
        </div>
        <Space>
          {templates.length === 0 && !loading && starters.length > 0 && (
            <Button onClick={handleSeedStarters} loading={seeding} style={{ borderColor: '#FF5F03', color: '#FF5F03' }}>
              Add 5 ready-made templates
            </Button>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal()} disabled={!activeBranchId} size="large" style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            New Template
          </Button>
        </Space>
      </div>

      {!activeBranchId && <Alert className="mb-4" type="warning" showIcon message="Select an active branch before managing templates." />}

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search template name or code..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" allowClear />
          <Select placeholder="Document Type" options={DOCUMENT_TYPES.map(v => ({ value: v, label: v }))} value={documentType} onChange={setDocumentType} allowClear className="w-48" />
          <Button onClick={() => { setSearch(''); setDocumentType(undefined); }}>Reset</Button>
          <Button icon={<ReloadOutlined />} onClick={fetchTemplates} loading={loading}>Refresh</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table
          columns={columns}
          dataSource={templates}
          rowKey="_id"
          loading={loading}
          size="middle"
          scroll={{ x: 950 }}
          pagination={{ pageSize: 20 }}
          locale={{
            emptyText: (
              <div className="py-8 text-center">
                <div className="text-gray-700 font-medium mb-1">No templates yet</div>
                <div className="text-sm text-gray-500 mb-4">
                  Start from a ready-made letter instead of a blank page — you can edit everything after.
                </div>
                <Space>
                  <Button onClick={handleSeedStarters} loading={seeding} style={{ borderColor: '#FF5F03', color: '#FF5F03' }}>
                    Add 5 ready-made templates
                  </Button>
                  <Button type="primary" onClick={() => openModal()} style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
                    Create from scratch
                  </Button>
                </Space>
              </div>
            ),
          }}
        />
      </div>

      {/* Create / Edit template */}
      <Modal
        title={editing ? 'Edit Template' : 'New Template'}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        confirmLoading={loading}
        okText={editing ? 'Update' : 'Create'}
        width={860}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Row gutter={16}>
            <Col xs={24} md={14}><Form.Item name="templateName" label="Template Name" rules={[{ required: true }]}><Input /></Form.Item></Col>
            <Col xs={24} md={6}><Form.Item name="documentType" label="Document Type" rules={[{ required: true }]}><Select options={DOCUMENT_TYPES.map(v => ({ value: v, label: v }))} /></Form.Item></Col>
            <Col xs={24} md={4}><Form.Item name="isActive" label="Active" valuePropName="checked"><Switch /></Form.Item></Col>
          </Row>
          {!editing && starters.length > 0 && (
            <div className="mb-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-3">
              <div className="text-sm font-medium text-gray-700 mb-1">Start from a ready template</div>
              <div className="text-xs text-gray-500 mb-2">Pick a standard letter, then change anything you like. Fields fill in automatically from the employee record — delete any line you don't need (e.g. "You will report to…" when it's blank).</div>
              <Space wrap size={[8, 8]}>
                {starters.map(s => (
                  <Button key={s.key} size="small" onClick={() => applyStarter(s)}>{s.templateName}</Button>
                ))}
              </Space>
            </div>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Insert field:</span>
            {fieldMap.map(f => <Tag key={f.key} className="cursor-pointer" onClick={() => insertVariable(f.variable)}>{f.variable}</Tag>)}
          </div>
          <Form.Item
            name="content"
            label="Document Content"
            rules={[{ required: true }]}
            extra="Use {{variable}} placeholders (click a field above to insert it). Separate paragraphs with a blank line."
          >
            <Input.TextArea rows={14} />
          </Form.Item>
        </Form>
      </Modal>

      {/* Generate document flow */}
      <Modal
        title={generateTemplate ? `Generate: ${generateTemplate.templateName}` : 'Generate Document'}
        open={generateOpen}
        onCancel={closeGenerate}
        onOk={handleGenerate}
        confirmLoading={generating}
        okText="Generate PDF"
        okButtonProps={{ disabled: !selectedEmployeeId, icon: <FileAddOutlined />, style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={860}
      >
        <p className="text-sm text-gray-500 mb-3">Select an employee to auto-fill this template. Preview updates automatically, then generate the PDF — it's saved directly into the employee's documents.</p>
        <Select
          showSearch
          value={selectedEmployeeId}
          placeholder="Search employee by name, code, mobile…"
          className="w-full mb-4"
          filterOption={false}
          onSearch={(text) => { setEmployeeSearch(text); fetchEmployeeOptions(text); }}
          onChange={setSelectedEmployeeId}
          options={employeeOptions}
          notFoundContent={employeeSearch ? 'No matching employees' : 'Type to search'}
        />
        <Divider className="!my-2">Preview</Divider>
        <div className="max-h-96 overflow-y-auto rounded border border-gray-200 bg-gray-50 p-4 text-sm whitespace-pre-wrap" style={{ minHeight: 160 }}>
          {previewLoading ? 'Loading preview…' : (previewText || <span className="text-gray-400">Select an employee to see the filled-in preview.</span>)}
        </div>
      </Modal>
    </div>
  );
};

export default HRDocumentTemplates;
