import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, Form, InputNumber, message, Popconfirm,
  Modal, Progress, Tooltip, Row, Col, Card, Statistic, DatePicker, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, AimOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import dealerEmployeeTargetService from '../../services/dealerEmployeeTargetService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';

/**
 * Dealer Employee Targets — what dealers have committed to their own app staff.
 *
 * Reading rides along with `dealer.master`: anyone who can open a Dealer Master
 * record and see its employees should not be locked out of seeing their targets.
 * Creating, editing and removing need `dealer.employee.targets.manage`, because
 * overriding a target a dealer set is a business decision — so those controls are
 * hidden rather than shown-then-rejected.
 *
 * Achievement is computed by the same server service the dealer app reads, so the
 * numbers here, in the dealer app and in the employee's app cannot drift.
 */

const METRIC_LABELS = {
  sales: 'Sales Value',
  orders: 'Order Requests',
  collections: 'Collections',
  product: 'Product Qty',
  category: 'Category Qty',
};

const formatValue = (value, unit) => {
  const number = Number(value || 0);
  if (unit === 'currency') return `₹${number.toLocaleString('en-IN')}`;
  if (unit === 'boxes') return `${number.toLocaleString('en-IN')} boxes`;
  return number.toLocaleString('en-IN');
};

const STATUS_COLOURS = {
  active: 'blue',
  completed: 'green',
  expired: 'default',
  paused: 'orange',
  scheduled: 'cyan',
  closed: 'default',
};

const DealerEmployeeTargets = () => {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('dealer.employee.targets.manage');

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: undefined, targetMetric: undefined, dealerId: undefined });

  const [meta, setMeta] = useState({ metrics: [], periods: [], dealers: [], products: [], categories: [], itemUnit: 'boxes' });

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [dealerEmployees, setDealerEmployees] = useState([]);
  const [employeesLoading, setEmployeesLoading] = useState(false);
  const [form] = Form.useForm();
  // Debounce handle for the search box. A ref, not a module global, so it is
  // scoped to this component and cleared when it unmounts.
  const searchTimer = useRef(null);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const metric = Form.useWatch('targetMetric', form);
  const scope = (meta.metrics.find((m) => m.value === metric) || {}).scope || null;

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
      };
      const response = await dealerEmployeeTargetService.list(params);
      if (response.success) {
        setRows(response.data);
        setPagination((current) => ({ ...current, total: response.pagination?.totalItems ?? 0 }));
      }
    } catch (error) {
      message.error(error.message || 'Could not load dealer employee targets.');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    Promise.all([
      dealerEmployeeTargetService.summary(),
      dealerEmployeeTargetService.meta(),
    ])
      .then(([summaryResponse, metaResponse]) => {
        if (summaryResponse.success) setSummary(summaryResponse.data);
        if (metaResponse.success) setMeta(metaResponse.data);
      })
      .catch((error) => message.error(error.message || 'Could not load target options.'));
  }, []);

  /** Load the chosen dealer's app employees so the employee picker can be scoped. */
  const loadDealerEmployees = async (dealerId) => {
    if (!dealerId) {
      setDealerEmployees([]);
      return;
    }
    setEmployeesLoading(true);
    try {
      const response = await masterService.getDealerEmployees(dealerId);
      setDealerEmployees(response.success ? (response.data || []) : []);
    } catch {
      setDealerEmployees([]);
    } finally {
      setEmployeesLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setDealerEmployees([]);
    form.resetFields();
    form.setFieldsValue({
      targetMetric: 'sales',
      period: 'monthly',
      bonusOnTarget: 0,
      startDate: dayjs().startOf('month'),
      endDate: dayjs().endOf('month'),
    });
    setModalOpen(true);
  };

  const openEdit = async (row) => {
    setEditing(row);
    form.resetFields();
    const dealerId = String(row.dealerId || row.dealer?._id || '');
    form.setFieldsValue({
      dealerId,
      employeeId: row.employee?._id ? String(row.employee._id) : undefined,
      title: row.title,
      targetMetric: row.targetMetric,
      targetValue: row.targetValue,
      period: row.period,
      startDate: row.startDate ? dayjs(row.startDate) : undefined,
      endDate: row.endDate ? dayjs(row.endDate) : undefined,
      bonusOnTarget: row.bonusOnTarget || 0,
      notes: row.notes || '',
      scopeProducts: row.scopeProducts?.length ? row.scopeProducts : undefined,
      scopeCategories: row.scopeCategories?.length ? row.scopeCategories : undefined,
    });
    setModalOpen(true);
    await loadDealerEmployees(dealerId);
  };

  const submit = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        employeeId: values.employeeId,
        title: values.title.trim(),
        targetMetric: values.targetMetric,
        targetValue: Number(values.targetValue),
        period: values.period,
        startDate: values.startDate.format('YYYY-MM-DD'),
        endDate: values.endDate.format('YYYY-MM-DD'),
        bonusOnTarget: Number(values.bonusOnTarget || 0),
        notes: (values.notes || '').trim(),
        ...(scope === 'product' ? { scopeProducts: values.scopeProducts || [] } : {}),
        ...(scope === 'category' ? { scopeCategories: values.scopeCategories || [] } : {}),
        // Only sent on create; on edit the rule's dealer is already fixed.
        ...(editing ? {} : { dealerId: values.dealerId }),
      };

      if (editing) {
        await dealerEmployeeTargetService.update(editing._id, payload);
        message.success('Target updated.');
      } else {
        await dealerEmployeeTargetService.create(payload);
        message.success('Target assigned.');
      }
      setModalOpen(false);
      fetchRows();
      dealerEmployeeTargetService.summary().then((r) => r.success && setSummary(r.data));
    } catch (error) {
      if (error?.errorFields) return; // antd validation, already shown inline
      message.error(error.message || 'Could not save this target.');
    }
  };

  const toggleStatus = async (row) => {
    const next = row.status === 'active' ? 'paused' : 'active';
    try {
      await dealerEmployeeTargetService.setStatus(row._id, next);
      message.success(`Target ${next}.`);
      fetchRows();
    } catch (error) {
      message.error(error.message || 'Could not change the target status.');
    }
  };

  const remove = async (row) => {
    try {
      await dealerEmployeeTargetService.remove(row._id);
      message.success('Target removed.');
      fetchRows();
      dealerEmployeeTargetService.summary().then((r) => r.success && setSummary(r.data));
    } catch (error) {
      message.error(error.message || 'Could not remove this target.');
    }
  };

  const columns = [
    {
      title: 'Dealer',
      dataIndex: 'dealer',
      width: 200,
      render: (dealer) => (
        <div>
          <div className="font-medium">{dealer?.businessName || '—'}</div>
          <div className="text-xs text-gray-400">{dealer?.dealerCode || ''}</div>
        </div>
      ),
    },
    {
      title: 'Employee',
      dataIndex: 'employee',
      width: 180,
      render: (employee) => (
        <div>
          <div className="font-medium">{employee?.name || '—'}</div>
          <div className="text-xs text-gray-400">
            {[employee?.employeeCode, employee?.designation].filter(Boolean).join(' · ')}
          </div>
        </div>
      ),
    },
    {
      title: 'Target',
      dataIndex: 'title',
      render: (title, row) => (
        <div>
          <div className="font-medium">{title}</div>
          <div className="text-xs text-gray-400">
            {row.metricLabel} · {String(row.period || '').replace(/_/g, ' ')}
            {row.shared ? ' · team-wide' : ''}
          </div>
        </div>
      ),
    },
    {
      title: 'Achievement',
      key: 'progress',
      width: 200,
      render: (_, row) => (
        <div>
          <Progress
            percent={Math.min(100, Math.round(row.progressPercent || 0))}
            size="small"
            strokeColor={row.isAchieved ? '#16a34a' : '#1890ff'}
            format={(percent) => `${percent}%`}
          />
          <div className="text-xs text-gray-500">
            {formatValue(row.achievedValue, row.unit)} of {formatValue(row.targetValue, row.unit)}
          </div>
        </div>
      ),
    },
    {
      title: 'Window',
      key: 'window',
      width: 170,
      render: (_, row) => (
        <div className="text-xs text-gray-600">
          {row.startDate ? dayjs(row.startDate).format('DD MMM YY') : '—'}
          {' → '}
          {row.endDate ? dayjs(row.endDate).format('DD MMM YY') : '—'}
          {row.bonusOnTarget > 0 ? (
            <div className="text-gray-500">₹{Number(row.bonusOnTarget).toLocaleString('en-IN')} bonus</div>
          ) : null}
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (status) => <Tag color={STATUS_COLOURS[status] || 'default'}>{status}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 150,
      fixed: 'right',
      render: (_, row) => (
        canManage ? (
          <Space size="small">
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
            </Tooltip>
            <Tooltip title={row.status === 'active' ? 'Pause' : 'Resume'}>
              <Button size="small" onClick={() => toggleStatus(row)}>
                {row.status === 'active' ? 'Pause' : 'Resume'}
              </Button>
            </Tooltip>
            <Popconfirm
              title="Remove this target?"
              description="The rule is deleted. Achievement already recorded against it is unaffected."
              okText="Remove"
              okButtonProps={{ danger: true }}
              onConfirm={() => remove(row)}>
              <Tooltip title="Remove">
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Tooltip>
            </Popconfirm>
          </Space>
        ) : (
          <Tooltip title="You need the 'Set / Override Dealer Employee Targets' permission.">
            <span className="text-xs text-gray-400">View only</span>
          </Tooltip>
        )
      ),
    },
  ];

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <AimOutlined /> Dealer Employee Targets
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Targets dealers have set for their own Dealer App employees, with live achievement.
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchRows}>Refresh</Button>
          {canManage ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Assign Target
            </Button>
          ) : null}
        </Space>
      </div>

      {!canManage ? (
        <Alert
          type="info"
          showIcon
          message="Read-only"
          description="You can see every dealer's employee targets. Setting or overriding them needs the 'Set / Override Dealer Employee Targets' permission."
        />
      ) : null}

      {summary ? (
        <Row gutter={16}>
          <Col span={6}>
            <Card><Statistic title="Target rules" value={summary.totalRules} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Active" value={summary.activeRules} valueStyle={{ color: '#1890ff' }} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Dealers with targets" value={summary.dealersWithTargets} /></Card>
          </Col>
          <Col span={6}>
            <Card><Statistic title="Employees with targets" value={summary.employeesWithTargets} /></Card>
          </Col>
        </Row>
      ) : null}

      <Card size="small">
        <Space wrap>
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search dealer, employee, code"
            style={{ width: 260 }}
            onChange={(event) => {
              const value = event.target.value;
              clearTimeout(searchTimer.current);
              searchTimer.current = setTimeout(() => {
                setFilters((current) => ({ ...current, search: value }));
                setPagination((current) => ({ ...current, current: 1 }));
              }, 350);
            }}
          />
          <Select
            allowClear
            placeholder="Status"
            style={{ width: 140 }}
            options={['active', 'paused', 'closed'].map((value) => ({ value, label: value }))}
            onChange={(value) => {
              setFilters((current) => ({ ...current, status: value }));
              setPagination((current) => ({ ...current, current: 1 }));
            }}
          />
          <Select
            allowClear
            placeholder="Metric"
            style={{ width: 170 }}
            options={(meta.metrics || []).map((item) => ({ value: item.value, label: item.label }))}
            onChange={(value) => {
              setFilters((current) => ({ ...current, targetMetric: value }));
              setPagination((current) => ({ ...current, current: 1 }));
            }}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Dealer"
            style={{ width: 240 }}
            options={(meta.dealers || []).map((dealer) => ({
              value: String(dealer._id),
              label: `${dealer.businessName}${dealer.dealerCode ? ` (${dealer.dealerCode})` : ''}`,
            }))}
            onChange={(value) => {
              setFilters((current) => ({ ...current, dealerId: value }));
              setPagination((current) => ({ ...current, current: 1 }));
            }}
          />
        </Space>
      </Card>

      <Table
        rowKey="rowKey"
        size="small"
        loading={loading}
        dataSource={rows}
        columns={columns}
        scroll={{ x: 'max-content' }}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          // Paginated by RULE on the server, so the label has to say so — one rule
          // can expand into several rows.
          showTotal: (total) => `${total} target rule(s)`,
        }}
        onChange={(page) => setPagination((current) => ({ ...current, current: page.current, pageSize: page.pageSize }))}
      />

      <Modal
        open={modalOpen}
        title={editing ? 'Edit Target' : 'Assign Target'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText={editing ? 'Save' : 'Assign'}
        width={640}
        destroyOnClose>
        <Form form={form} layout="vertical" className="pt-2">
          {editing?.shared ? (
            <Alert
              type="warning"
              showIcon
              className="mb-4"
              message="This target applies to every employee"
              description="Editing it changes it for all of them."
            />
          ) : null}

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="dealerId"
                label="Dealer"
                rules={[{ required: true, message: 'Select a dealer.' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  disabled={Boolean(editing)}
                  placeholder="Select dealer"
                  options={(meta.dealers || []).map((dealer) => ({
                    value: String(dealer._id),
                    label: `${dealer.businessName}${dealer.dealerCode ? ` (${dealer.dealerCode})` : ''}`,
                  }))}
                  onChange={(value) => {
                    form.setFieldValue('employeeId', undefined);
                    loadDealerEmployees(value);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="employeeId"
                label="Employee"
                rules={[{ required: true, message: 'Select the employee this target is for.' }]}>
                <Select
                  showSearch
                  optionFilterProp="label"
                  loading={employeesLoading}
                  placeholder={dealerEmployees.length ? 'Select employee' : 'Choose a dealer first'}
                  notFoundContent={employeesLoading ? 'Loading…' : 'No employees on this dealer'}
                  options={dealerEmployees.map((employee) => ({
                    value: String(employee.id || employee._id),
                    label: `${employee.name}${employee.employeeCode ? ` (${employee.employeeCode})` : ''}`,
                    disabled: employee.status !== 'active',
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="title" label="Target name" rules={[{ required: true, message: 'Give the target a name.' }]}>
            <Input placeholder="e.g. September sales target" maxLength={150} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="targetMetric" label="What to measure" rules={[{ required: true }]}>
                <Select
                  options={(meta.metrics || []).map((item) => ({ value: item.value, label: item.label }))}
                  onChange={() => {
                    form.setFieldValue('scopeProducts', undefined);
                    form.setFieldValue('scopeCategories', undefined);
                  }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="targetValue"
                label={scope
                  ? `Target (${meta.itemUnit || 'boxes'})`
                  : metric === 'sales' || metric === 'collections' ? 'Target (₹)' : 'Target (count)'}
                rules={[{ required: true, message: 'Enter a target greater than zero.' }]}>
                <InputNumber min={0.01} style={{ width: '100%' }} placeholder="0" />
              </Form.Item>
            </Col>
          </Row>

          {/* Product and category targets are quantity-based: an order request
              carries quantities but no prices, so there is no rupee figure to sum. */}
          {scope === 'product' ? (
            <Form.Item
              name="scopeProducts"
              label="Products covered"
              extra={`Measured in ${meta.itemUnit || 'boxes'} — an order request carries quantities, not prices.`}
              rules={[{ required: true, message: 'Select at least one product.' }]}>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Select products"
                options={(meta.products || []).map((product) => ({
                  value: String(product._id),
                  label: `${product.name}${product.code ? ` (${product.code})` : ''}`,
                }))}
              />
            </Form.Item>
          ) : null}

          {scope === 'category' ? (
            <Form.Item
              name="scopeCategories"
              label="Categories covered"
              extra={`Measured in ${meta.itemUnit || 'boxes'}.`}
              rules={[{ required: true, message: 'Select at least one category.' }]}>
              <Select
                mode="multiple"
                showSearch
                optionFilterProp="label"
                placeholder="Select categories"
                options={(meta.categories || []).map((category) => ({
                  value: String(category._id),
                  label: category.name,
                }))}
              />
            </Form.Item>
          ) : null}

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="period" label="Period" rules={[{ required: true }]}>
                <Select
                  options={(meta.periods || []).map((value) => ({
                    value,
                    label: value.replace(/_/g, ' '),
                  }))}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="startDate" label="Start" rules={[{ required: true, message: 'Pick a start date.' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="endDate" label="End" rules={[{ required: true, message: 'Pick an end date.' }]}>
                <DatePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="bonusOnTarget" label="Bonus on completion (₹, optional)">
            <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
          </Form.Item>

          <Form.Item name="notes" label="Notes (optional)">
            <Input.TextArea rows={2} maxLength={1000} placeholder="Anything the employee should know" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DealerEmployeeTargets;
