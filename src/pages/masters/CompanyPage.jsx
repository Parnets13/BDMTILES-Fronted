import { useCallback, useEffect, useState } from 'react';
import {
  App as AntdApp, Button, Card, Col, Form, Input, Modal, Popconfirm, Row, Select, Space,
  Statistic, Switch, Table, Tag, Tooltip,
} from 'antd';
import {
  BankOutlined, DeleteOutlined, EditOutlined, EyeOutlined, PlusOutlined,
  ReloadOutlined, SearchOutlined, StarFilled,
} from '@ant-design/icons';
import RecordDetailModal from '../../components/RecordDetailModal.jsx';
import masterService from '../../services/masterService.js';
import { GST_STATES, normalizeGstin } from '../../utils/gstin.js';
import { useAuth } from '../../context/AuthContext.jsx';

const initialValues = { status: 'active', isDefault: false };

const CompanyPage = () => {
  // Context-aware message so toasts follow the active theme instead of the
  // static API (which cannot read ConfigProvider context).
  const { message } = AntdApp.useApp();
  // Company scope from the header — used to filter the list only, not the add form.
  const { activeCompanyIds, isAllCompanies } = useAuth();
  const [form] = Form.useForm();
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(undefined);
  const [editing, setEditing] = useState(null);
  const [viewRecord, setViewRecord] = useState(null);
  const [open, setOpen] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  // companyId -> branch codes it serves. This is what makes the scope real: the
  // header narrows by these branches, so an unlinked registration shows no data.
  const [branchLinks, setBranchLinks] = useState({});

  useEffect(() => {
    let cancelled = false;
    masterService.getBranches({ limit: 200 })
      .then((response) => {
        if (cancelled) return;
        const map = {};
        (response.data || []).forEach((branch) => {
          (branch.companies || []).forEach((company) => {
            const id = String(company?._id || company);
            if (!map[id]) map[id] = [];
            map[id].push(branch.branchCode || branch.name);
          });
        });
        setBranchLinks(map);
      })
      .catch(() => { if (!cancelled) setBranchLinks({}); });
    return () => { cancelled = true; };
  }, []);

  // PAN and state are typed by hand — no derived previews, no auto-fill, and no
  // validation banners. The GST number is only format-checked on save.

  const load = useCallback(async (page = 1, pageSize = 20) => {
    setLoading(true);
    try {
      const response = await masterService.getCompanies({ page, limit: pageSize, search, status });
      if (response.success) {
        setCompanies(response.data || []);
        setPagination({
          current: response.pagination?.currentPage || page,
          pageSize,
          total: response.pagination?.totalItems || 0,
        });
      }
    } catch (error) {
      message.error(error.message || 'Failed to load companies');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { load(1, pagination.pageSize); }, [load]);

  // Apply header company scope to the list — filter by selected company ids when
  // a specific company is chosen in the header. The add/edit form is unaffected.
  const filteredCompanies = isAllCompanies
    ? companies
    : companies.filter((company) => activeCompanyIds.includes(String(company._id)));

  const showCreate = () => {
    setEditing(null);
    form.setFieldsValue(initialValues);
    setOpen(true);
  };

  const showEdit = async (record) => {
    setEditing(record);
    try {
      const response = await masterService.getCompany(record._id);
      form.setFieldsValue({ ...initialValues, ...(response.data || record) });
      setOpen(true);
    } catch (error) {
      message.error(error.message || 'Failed to load company');
    }
  };

  const closeModal = () => {
    setOpen(false);
    form.resetFields();
    setEditing(null);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = { ...values, gstin: normalizeGstin(values.gstin) };
      const response = editing
        ? await masterService.updateCompany(editing._id, payload)
        : await masterService.createCompany(payload);
      if (response.success) {
        message.success(editing ? 'Company updated' : 'Company created');
        closeModal();
        await load(editing ? pagination.current : 1, pagination.pageSize);
      }
    } catch (error) {
      if (!error.errorFields) message.error(error.message || 'Failed to save company');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    try {
      const response = await masterService.deleteCompany(id);
      if (response.success) {
        message.success('Company moved to Recycle Bin');
        load(1, pagination.pageSize);
      }
    } catch (error) {
      message.error(error.message || 'Failed to delete company');
    }
  };

  const columns = [
    {
      title: 'Company',
      render: (_, record) => (
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-2">
            {record.legalName}
            {record.isDefault && (
              <Tag color="gold" icon={<StarFilled />} className="!mr-0">Primary</Tag>
            )}
          </div>
          <div className="text-xs text-gray-500">
            {record.tradeName ? `Trades as ${record.tradeName}` : 'No trade name'}
          </div>
        </div>
      ),
    },
    {
      title: 'GST Number',
      width: 210,
      render: (_, record) => (
        <div>
          <div className="font-mono text-sm text-gray-800">{record.gstin}</div>
          <div className="text-xs text-gray-500">PAN {record.pan || '—'}</div>
        </div>
      ),
    },
    {
      title: 'State',
      width: 160,
      // Plain value, exactly as entered — no state code, no derived comparison.
      render: (_, record) => record.state || '—',
    },
    {
      title: 'Branches',
      width: 150,
      // A GST registration is only usable as a scope once a branch is linked to it;
      // these are the branches whose data the header will show for this GST number.
      render: (_, record) => {
        const linked = branchLinks[String(record._id)] || [];
        if (!linked.length) {
          return <Tooltip title="Link a branch in Branch Master to use this company as a scope"><Tag color="orange">Not linked</Tag></Tooltip>;
        }
        return (
          <Tooltip title={linked.join(', ')}>
            <Tag color="blue">{linked.length} branch{linked.length > 1 ? 'es' : ''}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (value) => <Tag color={value === 'active' ? 'green' : 'default'}>{value?.toUpperCase()}</Tag>,
    },
    {
      title: 'Actions',
      width: 140,
      render: (_, record) => (
        <Space>
          <Button type="text" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewRecord(record)} />
          <Button type="text" icon={<EditOutlined />} onClick={() => showEdit(record)} />
          {record.isDefault ? (
            <Tooltip title="Primary company — mark another company primary before deleting">
              <Button type="text" danger disabled icon={<DeleteOutlined />} />
            </Tooltip>
          ) : (
            <Popconfirm
              title="Delete this company?"
              description="It will move to the Recycle Bin and can be restored."
              onConfirm={() => remove(record._id)}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center">
            <BankOutlined className="text-[#FF5F03] text-xl" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Company Master</h1>
            <p className="text-sm text-gray-500">Legal entities, trade names and GST registrations</p>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} size="large" onClick={showCreate}>Add Company</Button>
      </div>

      <Row gutter={16} className="mb-5">
        <Col span={8}><Card size="small"><Statistic title="Total Companies" value={pagination.total} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Active on this page" value={filteredCompanies.filter((item) => item.status === 'active').length} valueStyle={{ color: '#16a34a' }} /></Card></Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="Primary company"
              value={filteredCompanies.find((item) => item.isDefault)?.tradeName || filteredCompanies.find((item) => item.isDefault)?.legalName || 'Not set'}
              valueStyle={{ fontSize: 18 }}
            />
          </Card>
        </Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200">
        <div className="p-4 border-b flex flex-wrap gap-3">
          <Input
            className="w-80"
            prefix={<SearchOutlined />}
            placeholder="Search legal name, trade name, GSTIN, PAN, city"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            allowClear
          />
          <Select
            className="w-40"
            placeholder="All statuses"
            value={status}
            onChange={setStatus}
            allowClear
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => load(1, pagination.pageSize)}>Refresh</Button>
        </div>
        <Table
          rowKey="_id"
          columns={columns}
          dataSource={filteredCompanies}
          loading={loading}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (total) => `${total} companies` }}
          onChange={(next) => load(next.current, next.pageSize)}
        />
      </div>

      <RecordDetailModal
        open={Boolean(viewRecord)}
        onClose={() => setViewRecord(null)}
        title={`Company — ${viewRecord?.tradeName || viewRecord?.legalName || ''}`}
        subtitle={viewRecord?.gstin}
        sections={viewRecord ? [
          {
            title: 'Legal identity',
            fields: [
              { label: 'Legal Name', value: viewRecord.legalName, span: 3 },
              { label: 'Trade Name', value: viewRecord.tradeName, span: 2 },
              { label: 'Status', value: viewRecord.status, type: 'tag', tagColor: viewRecord.status === 'active' ? 'green' : 'default', alwaysShow: true },
              { label: 'Primary', value: viewRecord.isDefault, type: 'boolean' },
            ],
          },
          {
            title: 'GST registration',
            fields: [
              { label: 'GSTIN', value: viewRecord.gstin, type: 'code' },
              { label: 'PAN', value: viewRecord.pan, type: 'code' },
              { label: 'State', value: viewRecord.state },
              { label: 'State Code', value: viewRecord.stateCode },
            ],
          },
          {
            title: 'Address & contact',
            fields: [
              { label: 'Address', value: viewRecord.address, span: 3 },
              { label: 'City', value: viewRecord.city },
              { label: 'PIN Code', value: viewRecord.pinCode },
              { label: 'Phone', value: viewRecord.phone },
              { label: 'Email', value: viewRecord.email },
            ],
          },
        ] : []}
      />

      <Modal
        title={editing ? 'Edit Company' : 'Add Company'}
        open={open}
        onCancel={closeModal}
        onOk={save}
        okText={editing ? 'Update' : 'Create'}
        confirmLoading={saving}
        width={760}
        centered
        destroyOnHidden
        // `src/index.css` forces `.ant-modal-body { overflow: visible !important }`
        // app-wide. The `company-modal` class opts this body back into scrolling
        // (see index.css) so the long form cannot paint over the footer.
        className="company-modal"
        styles={{ body: { maxHeight: '58vh', paddingRight: 8 } }}
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={initialValues}
          className="mt-2 [&_.ant-form-item]:mb-4"
        >
          <div className="text-sm font-semibold text-gray-700 mb-2">Legal identity</div>
          <Row gutter={16}>
            <Col xs={24} md={14}>
              <Form.Item
                name="legalName"
                label="Company Legal Name"
                tooltip="Name as registered with the Registrar / printed on GST certificate"
                rules={[{ required: true, message: 'Legal name is required' }, { max: 200 }]}
              >
                <Input placeholder="e.g. BDM Tiles Private Limited" />
              </Form.Item>
            </Col>
            <Col xs={24} md={10}>
              <Form.Item
                name="tradeName"
                label="Company Trade Name"
                tooltip="Brand name the business is known by. Leave blank if it matches the legal name."
                rules={[{ max: 200 }]}
              >
                <Input placeholder="e.g. BDM Tiles" />
              </Form.Item>
            </Col>
          </Row>

          <div className="text-sm font-semibold text-gray-700 mb-2">GST registration</div>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Form.Item
                name="gstin"
                label="GST Number"
                normalize={(value) => normalizeGstin(value).slice(0, 15)}
                rules={[{ required: true, message: 'GST number is required' }]}
              >
                <Input placeholder="e.g. 29ABCDE1234F1Z5" maxLength={15} className="font-mono uppercase" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item
                name="pan"
                label="PAN"
                normalize={(value) => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10)}
              >
                <Input placeholder="e.g. ABCDE1234F" maxLength={10} className="font-mono uppercase" />
              </Form.Item>
            </Col>
            <Col xs={12} md={6}>
              <Form.Item name="state" label="State">
                <Select
                  showSearch
                  allowClear
                  placeholder="Select state"
                  optionFilterProp="label"
                  options={GST_STATES.map((state) => ({ value: state.name, label: state.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <div className="text-sm font-semibold text-gray-700 mb-2">Address & contact (optional)</div>
          <Form.Item name="address" label="Registered Address"><Input.TextArea rows={2} /></Form.Item>
          {/* Four short fields share one row so the form stays short enough to sit
              clear of the modal footer on laptop heights. */}
          <Row gutter={16}>
            <Col xs={12} md={7}><Form.Item name="city" label="City"><Input /></Form.Item></Col>
            <Col xs={12} md={5}><Form.Item name="pinCode" label="PIN Code" rules={[{ pattern: /^[0-9]{0,6}$/, message: 'PIN code must be 6 digits' }]}><Input maxLength={6} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="phone" label="Phone"><Input maxLength={15} /></Form.Item></Col>
            <Col xs={12} md={6}><Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Enter a valid email' }]}><Input /></Form.Item></Col>
          </Row>
          <Row gutter={16}>
            <Col xs={12} md={8}>
              <Form.Item name="status" label="Status">
                <Select options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
              </Form.Item>
            </Col>
            <Col xs={12} md={8}>
              <Form.Item
                name="isDefault"
                label="Primary company"
                valuePropName="checked"
                tooltip="The primary company is used as the default seller identity on documents."
              >
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default CompanyPage;
