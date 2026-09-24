import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Switch, message, Popconfirm, Tooltip, Row, Col, Divider, Card, Statistic, Progress } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, TeamOutlined, AimOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService.js';
import dealerEmployeeTargetService from '../../services/dealerEmployeeTargetService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';

const DealerMaster = () => {
  const { hasPermission } = useAuth();
  const canAssignSalesExecutive = hasPermission('dealer.assignment.manage');
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, dealerType: undefined, region: undefined });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, blocked: 0 });
  const [options, setOptions] = useState({
    dealerTypes: [],
    dealerCategories: [],
    regions: [],
    routes: [],
    salesExecutives: [],
  });

  // Form
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);
  const [viewDealer, setViewDealer] = useState(null);
  // App users (employees the dealer created in the Dealer App) for the dealer
  // whose detail modal is open. Loaded on demand — most dealers have none.
  const [team, setTeam] = useState({ loading: false, list: [], summary: null, error: false });
  // Targets this dealer has set for those employees, shown beneath the list.
  const [dealerTargets, setDealerTargets] = useState({ loading: false, list: [], summary: null });
  // Early warning when a mobile is already taken. The server's message is
  // deliberately generic — it says the number is registered but never who holds
  // it — so this cannot be used to discover other dealers' or staff numbers.
  const [mobileCheck, setMobileCheck] = useState(null);
  const [form] = Form.useForm();

  // Load dealer masters independently from the assignment-only user lookup.
  useEffect(() => {
    Promise.all([
      masterService.getDealerTypes({ limit: 100 }),
      masterService.getDealerCategories({ limit: 100 }),
      masterService.getRegions({ limit: 100 }),
      masterService.getRoutes({ limit: 100 }),
      masterService.getDealerStats(),
    ])
      .then(([dt, dc, reg, rt, st]) => {
        setOptions(current => ({
          ...current,
          dealerTypes: dt.success ? dt.data : [],
          dealerCategories: dc.success ? dc.data : [],
          regions: reg.success ? reg.data : [],
          routes: rt.success ? rt.data : [],
        }));
        if (st.success) setStats(st.data);
      })
      .catch(err => message.error(err.message || 'Could not load dealer options.'));
  }, []);

  useEffect(() => {
    if (!canAssignSalesExecutive) return;
    masterService.getSalesExecutives()
      .then(response => {
        if (response.success) {
          setOptions(current => ({ ...current, salesExecutives: response.data }));
        }
      })
      .catch(err => message.error(err.message || 'Could not load Sales Executives.'));
  }, [canAssignSalesExecutive]);

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...Object.fromEntries(Object.entries(filters).filter(([_,v]) => v)) };
      const res = await masterService.getDealers(params);
      if (res.success) {
        setDealers(res.data);
        setPagination(p => ({ ...p, total: res.pagination.totalItems }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchDealers(); }, [fetchDealers]);

  // Load the dealer's app users whenever the detail modal opens. Guarded with a
  // cancellation flag so closing one dealer and opening another cannot let the
  // slower response overwrite the newer one.
  const viewDealerId = viewDealer?._id;
  useEffect(() => {
    if (!viewDealerId) {
      setTeam({ loading: false, list: [], summary: null, error: false });
      setDealerTargets({ loading: false, list: [], summary: null });
      return undefined;
    }
    let cancelled = false;
    setTeam({ loading: true, list: [], summary: null, error: false });
    setDealerTargets({ loading: true, list: [], summary: null });

    masterService.getDealerEmployees(viewDealerId)
      .then(response => {
        if (cancelled) return;
        setTeam({
          loading: false,
          list: response.success ? (response.data || []) : [],
          summary: response.summary || null,
          error: false,
        });
      })
      .catch(() => {
        if (!cancelled) setTeam({ loading: false, list: [], summary: null, error: true });
      });

    // Targets are supplementary context, so a failure here must not blank the
    // employee list above it — it just renders as empty.
    dealerEmployeeTargetService.forDealer(viewDealerId)
      .then(response => {
        if (cancelled) return;
        setDealerTargets({
          loading: false,
          list: response.success ? (response.data || []) : [],
          summary: response.summary || null,
        });
      })
      .catch(() => {
        if (!cancelled) setDealerTargets({ loading: false, list: [], summary: null });
      });

    return () => { cancelled = true; };
  }, [viewDealerId]);

  const checkMobile = async (mobile, excludeId) => {
    const digits = String(mobile || '').replace(/\D/g, '');
    if (digits.length < 10) {
      setMobileCheck(null);
      return;
    }
    try {
      const response = await masterService.checkDealerMobile(mobile, excludeId);
      setMobileCheck(response?.data || null);
    } catch {
      // A failed probe must never block saving — the server re-checks on save.
      setMobileCheck(null);
    }
  };

  const openForm = (dealer = null) => {
    setEditingDealer(dealer);
    setMobileCheck(null);
    if (dealer) {
      const currentSalesExecutive = dealer.assignedSalesExecutive;
      if (
        canAssignSalesExecutive &&
        currentSalesExecutive?._id &&
        !options.salesExecutives.some(user => user._id === currentSalesExecutive._id)
      ) {
        setOptions(current => ({
          ...current,
          salesExecutives: [...current.salesExecutives, currentSalesExecutive],
        }));
      }
      form.setFieldsValue({
        ...dealer,
        dealerType: dealer.dealerType?._id || dealer.dealerType,
        dealerCategory: dealer.dealerCategory?._id || dealer.dealerCategory,
        assignedRegion: dealer.assignedRegion?._id || dealer.assignedRegion,
        assignedRoute: dealer.assignedRoute?._id || dealer.assignedRoute,
        assignedSalesExecutive:
          dealer.assignedSalesExecutive?._id || dealer.assignedSalesExecutive,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ creditDays: 30, status: 'active', schemeEligible: true, discountEligible: true });
    }
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const payload = { ...values };
      if (canAssignSalesExecutive) {
        payload.assignedSalesExecutive = values.assignedSalesExecutive || null;
      } else {
        delete payload.assignedSalesExecutive;
      }
      setLoading(true);
      const res = editingDealer
        ? await masterService.updateDealer(editingDealer._id, payload)
        : await masterService.createDealer(payload);
      if (res.success) {
        message.success(res.message);
        setDrawerOpen(false);
        form.resetFields();
        setEditingDealer(null);
        fetchDealers();
        masterService.getDealerStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message);
    } finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await masterService.deleteDealer(id);
      if (res.success) { message.success('Deleted'); fetchDealers(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'dealerCode', key: 'code', width: 100, render: v => <span className="text-xs font-mono text-blue-600">{v}</span> },
    { title: 'Business Name', key: 'name', width: 180, render: (_, r) => <div><div className="text-sm font-medium truncate max-w-[170px]">{r.businessName}</div><div className="text-xs text-gray-400">{r.ownerName}</div></div> },
    { title: 'Mobile', dataIndex: 'mobile', key: 'mobile', width: 110, render: v => <span className="text-sm">{v}</span> },
    { title: 'City', dataIndex: 'city', key: 'city', width: 100 },
    { title: 'Type', key: 'type', width: 100, render: (_, r) => <span className="text-xs">{r.dealerType?.name || '-'}</span> },
    { title: 'Region', key: 'region', width: 100, render: (_, r) => <span className="text-xs">{r.assignedRegion?.name || '-'}</span> },
    { title: 'Sales Executive', key: 'salesExecutive', width: 150, render: (_, r) => r.assignedSalesExecutive ? <Tag color="blue">{r.assignedSalesExecutive.name}</Tag> : <Tag>Unassigned</Tag> },
    { title: 'Credit Limit', dataIndex: 'creditLimit', key: 'cl', width: 100, render: v => <span className="text-sm">₹{(v||0).toLocaleString()}</span> },
    { title: 'Outstanding', dataIndex: 'currentOutstanding', key: 'out', width: 100, render: v => <span className={`text-sm font-medium ${v > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(v||0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 80, render: s => <Tag color={s === 'active' ? 'green' : s === 'blocked' ? 'red' : 'orange'}>{s}</Tag> },
    { title: 'Actions', key: 'actions', width: 100, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewDealer(r)} /></Tooltip>
        <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(r)} /></Tooltip>
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(r._id)}>
          <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Dealer Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage all dealers and their information</p>
        </div>
        <Space>
          <ModuleRecycleBin module="dealer" title="Deleted Dealers" onRestore={fetchDealers} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()} size="large">Add New Dealer</Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Dealers" value={stats.total} prefix={<TeamOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Inactive" value={stats.inactive} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Blocked" value={stats.blocked} valueStyle={{ color: '#ef4444' }} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search by name, code, mobile, city..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }} className="w-72" allowClear />
          <Select placeholder="Dealer Type" options={options.dealerTypes.map(d => ({value: d._id, label: d.name}))}
            value={filters.dealerType} onChange={v => setFilters(f => ({...f, dealerType: v}))} allowClear className="w-36" />
          <Select placeholder="Region" options={options.regions.map(r => ({value: r._id, label: r.name}))}
            value={filters.region} onChange={v => setFilters(f => ({...f, region: v}))} allowClear className="w-36" />
          <Select placeholder="Status" options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'blocked',label:'Blocked'}]}
            value={filters.status} onChange={v => setFilters(f => ({...f, status: v}))} allowClear className="w-32" />
          <Button onClick={() => { setSearch(''); setFilters({status:undefined,dealerType:undefined,region:undefined}); }}>Clear Filters</Button>
          {/* Re-fetches the current view. Distinct from Clear Filters, which only resets the inputs. */}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => {
              fetchDealers();
              masterService.getDealerStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={dealers} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t,r) => `${r[0]}-${r[1]} of ${t} dealers` }}
          onChange={pag => setPagination(p => ({...p, current: pag.current, pageSize: pag.pageSize}))} />
      </div>

      {/* Add/Edit Dealer Full Page Form */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingDealer(null); }} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="text-[#FF5F03] text-xl">+</span>
                <h2 className="text-lg font-bold text-gray-800">{editingDealer ? 'Edit Dealer' : 'Add New Dealer'}</h2>
              </div>
              <div className="flex items-center gap-3">
                <Button type="primary" onClick={handleSave} loading={loading}>{editingDealer ? 'Update' : 'Create Dealer'}</Button>
                <Button onClick={() => form.resetFields()} className="text-green-600 border-green-400">Clear</Button>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingDealer(null); }}>✕</span>
              </div>
            </div>
            <div className="px-8 py-6">
              <Form form={form} layout="vertical">
                <Divider orientation="left" plain>Basic Information</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="dealerCode" label="Dealer Code"><Input placeholder="Auto-generated" /></Form.Item></Col>
                  <Col span={9}><Form.Item name="businessName" label="Business Name" rules={[{required:true}]}><Input placeholder="Business name" /></Form.Item></Col>
                  <Col span={9}><Form.Item name="ownerName" label="Owner Name" rules={[{required:true}]}><Input placeholder="Owner name" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}>
                    <Form.Item
                      name="mobile"
                      label="Mobile"
                      rules={[{required:true}]}
                      validateStatus={mobileCheck && !mobileCheck.available ? 'error' : undefined}
                      help={mobileCheck && !mobileCheck.available ? mobileCheck.message : undefined}>
                      <Input
                        placeholder="Mobile number"
                        onBlur={(event) => checkMobile(event.target.value, editingDealer?._id)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={6}><Form.Item name="alternateMobile" label="Alt Mobile"><Input placeholder="Alternate" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="email" label="Email"><Input placeholder="Email" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="gstin" label="GSTIN"
                    rules={[{ pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/, message: 'Invalid GSTIN (e.g. 29ABCDE1234F1Z5)' }]}>
                    <Input placeholder="29ABCDE1234F1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} onChange={e => e.target.value = e.target.value.toUpperCase()} />
                  </Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="pan" label="PAN"><Input placeholder="PAN" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="status" label="Status"><Select options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'blocked',label:'Blocked'}]} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="priceTier" label="Price Tier"><Select options={[{value:'Dealer',label:'Dealer'},{value:'Distributor',label:'Distributor'},{value:'Wholesale',label:'Wholesale'},{value:'Retail',label:'Retail'}]} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="appAccess" label="App Access" valuePropName="checked"><Switch /></Form.Item></Col>
                </Row>

                <Divider orientation="left" plain>Address</Divider>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="address" label="Address"><Input.TextArea rows={2} placeholder="Full address" /></Form.Item></Col>
                  <Col span={12}><Form.Item name="deliveryAddress" label="Delivery Address"><Input.TextArea rows={2} placeholder="If different" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="city" label="City"><Input placeholder="City" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="state" label="State"><Input placeholder="State" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="pinCode" label="PIN Code"><Input placeholder="PIN" /></Form.Item></Col>
                </Row>

                <Divider orientation="left" plain>Classification & Assignment</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="dealerType" label="Dealer Type"><Select placeholder="Select" allowClear options={options.dealerTypes.map(d => ({value:d._id,label:d.name}))} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="dealerCategory" label="Dealer Category"><Select placeholder="Select" allowClear options={options.dealerCategories.map(d => ({value:d._id,label:d.name}))} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="assignedRegion" label="Region"><Select placeholder="Select" allowClear showSearch optionFilterProp="label" options={options.regions.map(r => ({value:r._id,label:r.name}))} /></Form.Item></Col>
                  <Col span={6}><Form.Item name="assignedRoute" label="Route"><Select placeholder="Select" allowClear showSearch optionFilterProp="label" options={options.routes.map(r => ({value:r._id,label:r.name}))} /></Form.Item></Col>
                </Row>
                {canAssignSalesExecutive && (
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item
                        name="assignedSalesExecutive"
                        label="Assign Sales Executive"
                        extra="Active Sales Executive users from User Management"
                      >
                        <Select
                          placeholder="Select Sales Executive"
                          allowClear
                          showSearch
                          optionFilterProp="label"
                          options={options.salesExecutives.map(user => ({
                            value: user._id,
                            label: `${user.name}${user.phone ? ` · ${user.phone}` : ''}${user.status === 'Inactive' ? ' · Inactive (current)' : ''}`,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                )}

                <Divider orientation="left" plain>Financial</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="creditLimit" label="Credit Limit (₹)"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="creditDays" label="Credit Days"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="openingBalance" label="Opening Balance (₹)"><InputNumber className="w-full" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="paymentTerms" label="Payment Terms"><Input placeholder="e.g. Net 30" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="securityChequeNo" label="Security Cheque No"><Input placeholder="Cheque no" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="securityChequeBank" label="Security Cheque Bank"><Input placeholder="Bank name" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="securityChequeAmount" label="Security Amount (₹)"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                </Row>

                <Divider orientation="left" plain>Eligibility</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="schemeEligible" label="Scheme Eligible" valuePropName="checked"><Switch defaultChecked /></Form.Item></Col>
                  <Col span={6}><Form.Item name="discountEligible" label="Discount Eligible" valuePropName="checked"><Switch defaultChecked /></Form.Item></Col>
                  <Col span={12}><Form.Item name="visitFrequency" label="Visit Frequency"><Input placeholder="e.g. Weekly" /></Form.Item></Col>
                </Row>
              </Form>
            </div>
          </div>
        </>
      )}

      {/* View Dealer Detail Modal */}
      {viewDealer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewDealer(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{viewDealer.businessName}</h2>
                <p className="text-sm text-gray-500">{viewDealer.dealerCode} • {viewDealer.ownerName}</p>
              </div>
              <div className="flex items-center gap-3">
                <Tag color={viewDealer.status === 'active' ? 'green' : viewDealer.status === 'blocked' ? 'red' : 'orange'}>{viewDealer.status}</Tag>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl" onClick={() => setViewDealer(null)}>✕</span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Contact Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Owner:</span> <span className="font-medium">{viewDealer.ownerName || '-'}</span></div>
                  <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{viewDealer.mobile || '-'}</span></div>
                  <div><span className="text-gray-500">Alt Mobile:</span> <span className="font-medium">{viewDealer.alternateMobile || '-'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{viewDealer.email || '-'}</span></div>
                  <div><span className="text-gray-500">Whatsapp:</span> <span className="font-medium">{viewDealer.whatsappNumber || viewDealer.mobile || '-'}</span></div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Address</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{viewDealer.address || '-'}</span></div>
                  <div><span className="text-gray-500">City:</span> <span className="font-medium">{viewDealer.city || '-'}</span></div>
                  <div><span className="text-gray-500">State:</span> <span className="font-medium">{viewDealer.state || '-'}</span></div>
                  <div><span className="text-gray-500">Pin Code:</span> <span className="font-medium">{viewDealer.pinCode || '-'}</span></div>
                </div>
              </div>

              {/* Business Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Business Info</h3>
                  <div className="space-y-1.5 text-sm">
                    <div><span className="text-gray-500">GSTIN:</span> <span className="font-medium">{viewDealer.gstin || '-'}</span></div>
                    <div><span className="text-gray-500">PAN:</span> <span className="font-medium">{viewDealer.pan || '-'}</span></div>
                    <div><span className="text-gray-500">Dealer Type:</span> <span className="font-medium">{viewDealer.dealerType?.name || '-'}</span></div>
                    <div><span className="text-gray-500">Category:</span> <span className="font-medium">{viewDealer.dealerCategory?.name || '-'}</span></div>
                    <div><span className="text-gray-500">Region:</span> <span className="font-medium">{viewDealer.assignedRegion?.name || '-'}</span></div>
                    <div><span className="text-gray-500">Route:</span> <span className="font-medium">{viewDealer.assignedRoute?.name || '-'}</span></div>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Financial</h3>
                  <div className="space-y-1.5 text-sm">
                    <div><span className="text-gray-500">Credit Limit:</span> <span className="font-semibold">₹{(viewDealer.creditLimit || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Credit Days:</span> <span className="font-medium">{viewDealer.creditDays || 0}</span></div>
                    <div><span className="text-gray-500">Outstanding:</span> <span className={`font-semibold ${(viewDealer.currentOutstanding || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(viewDealer.currentOutstanding || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Opening Balance:</span> <span className="font-medium">₹{(viewDealer.openingBalance || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Payment Terms:</span> <span className="font-medium">{viewDealer.paymentTerms || '-'}</span></div>
                  </div>
                </div>
              </div>

              {/* Security Cheque */}
              {viewDealer.securityChequeNo && (
                <div className="bg-purple-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Security Cheque</h3>
                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div><span className="text-gray-500">Cheque No:</span> <span className="font-medium">{viewDealer.securityChequeNo}</span></div>
                    <div><span className="text-gray-500">Bank:</span> <span className="font-medium">{viewDealer.securityChequeBank || '-'}</span></div>
                    <div><span className="text-gray-500">Amount:</span> <span className="font-semibold">₹{(viewDealer.securityChequeAmount || 0).toLocaleString()}</span></div>
                  </div>
                </div>
              )}

              {/* Eligibility & Other */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-100 rounded p-2 text-center"><span className="text-gray-500 block">Scheme</span><Tag color={viewDealer.schemeEligible ? 'green' : 'red'}>{viewDealer.schemeEligible ? 'Yes' : 'No'}</Tag></div>
                <div className="bg-gray-100 rounded p-2 text-center"><span className="text-gray-500 block">Discount</span><Tag color={viewDealer.discountEligible ? 'green' : 'red'}>{viewDealer.discountEligible ? 'Yes' : 'No'}</Tag></div>
                <div className="bg-gray-100 rounded p-2 text-center"><span className="text-gray-500 block">Visit Freq</span><span className="font-medium">{viewDealer.visitFrequency || '-'}</span></div>
              </div>

              {/* App Users — employees the dealer created from the Dealer App.
                  Read-only: the dealer owns this relationship, BDMTILES only observes. */}
              <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                    <TeamOutlined /> Dealer App Users (Employees)
                  </h3>
                  <div className="flex items-center gap-3 text-xs">
                    {viewDealer.employeeAccessEnabled === false && (
                      <Tag color="default">Employee access not enabled</Tag>
                    )}
                    {team.summary && (
                      <>
                        <span className="text-gray-600">Total: <b>{team.summary.total}</b></span>
                        <span className="text-green-700">Active: <b>{team.summary.active}</b></span>
                        <span className="text-gray-500">Login on: <b>{team.summary.withLogin}</b></span>
                        <span className="text-gray-500">Live targets: <b>{team.summary.activeTargets ?? 0}</b></span>
                      </>
                    )}
                  </div>
                </div>

                {team.loading ? (
                  <div className="text-sm text-gray-400 py-4 text-center">Loading app users…</div>
                ) : team.error ? (
                  <div className="text-sm text-red-500 py-4 text-center">Could not load app users.</div>
                ) : team.list.length === 0 ? (
                  <div className="text-sm text-gray-400 py-4 text-center">
                    This dealer has not added any employees to the app yet.
                  </div>
                ) : (
                  <Table
                    size="small"
                    rowKey="_id"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    dataSource={team.list}
                    columns={[
                      {
                        title: 'Name',
                        dataIndex: 'name',
                        render: (value, row) => (
                          <div>
                            <div className="font-medium">{value}</div>
                            <div className="text-xs text-gray-400">{row.employeeCode || '—'}</div>
                          </div>
                        ),
                      },
                      { title: 'Mobile', dataIndex: 'mobile' },
                      { title: 'Designation', dataIndex: 'designation', render: (value) => value || '—' },
                      { title: 'Role', dataIndex: 'role', render: (value) => <Tag>{value}</Tag> },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        render: (value) => <Tag color={value === 'active' ? 'green' : 'default'}>{value}</Tag>,
                      },
                      {
                        title: 'App Login',
                        dataIndex: 'loginEnabled',
                        render: (value) => <Tag color={value ? 'blue' : 'default'}>{value ? 'Enabled' : 'Off'}</Tag>,
                      },
                      {
                        title: 'Last Login',
                        dataIndex: 'appLastLoginAt',
                        render: (value) => (value ? new Date(value).toLocaleDateString('en-IN') : 'Never'),
                      },
                    ]}
                  />
                )}
              </div>

              {/* Targets this dealer has set for those employees. Read-only here:
                  authoring lives on the Dealer Employee Targets page. */}
              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-100">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase flex items-center gap-2">
                    <AimOutlined /> Employee Targets Set By This Dealer
                  </h3>
                  {dealerTargets.summary && (
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-gray-600">Targets: <b>{dealerTargets.summary.total}</b></span>
                      <span className="text-green-700">Achieved: <b>{dealerTargets.summary.achieved}</b></span>
                      <span className="text-blue-700">In progress: <b>{dealerTargets.summary.inProgress}</b></span>
                    </div>
                  )}
                </div>

                {dealerTargets.loading ? (
                  <div className="text-sm text-gray-400 py-4 text-center">Loading targets…</div>
                ) : dealerTargets.list.length === 0 ? (
                  <div className="text-sm text-gray-400 py-4 text-center">
                    This dealer has not set any targets for their employees yet.
                  </div>
                ) : (
                  <Table
                    size="small"
                    rowKey="rowKey"
                    pagination={false}
                    scroll={{ x: 'max-content' }}
                    dataSource={dealerTargets.list}
                    columns={[
                      {
                        title: 'Employee',
                        dataIndex: 'employee',
                        render: (employee) => (
                          <div>
                            <div className="font-medium">{employee?.name || '—'}</div>
                            <div className="text-xs text-gray-400">{employee?.employeeCode || ''}</div>
                          </div>
                        ),
                      },
                      {
                        title: 'Target',
                        dataIndex: 'title',
                        render: (title, row) => (
                          <div>
                            <div>{title}</div>
                            <div className="text-xs text-gray-400">
                              {row.metricLabel} · {String(row.period || '').replace(/_/g, ' ')}
                              {row.shared ? ' · team-wide' : ''}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'Progress',
                        key: 'progress',
                        width: 170,
                        render: (_, row) => (
                          <div>
                            <Progress
                              percent={Math.min(100, Math.round(row.progressPercent || 0))}
                              size="small"
                              strokeColor={row.isAchieved ? '#16a34a' : '#1890ff'}
                            />
                            <div className="text-xs text-gray-500">
                              {Number(row.achievedValue || 0).toLocaleString('en-IN')} of{' '}
                              {Number(row.targetValue || 0).toLocaleString('en-IN')} {row.unit === 'currency' ? '₹' : row.unit}
                            </div>
                          </div>
                        ),
                      },
                      {
                        title: 'Status',
                        dataIndex: 'status',
                        width: 100,
                        render: (status) => (
                          <Tag color={status === 'active' ? 'blue' : status === 'completed' ? 'green' : 'default'}>
                            {status}
                          </Tag>
                        ),
                      },
                    ]}
                  />
                )}
              </div>

              {/* Meta */}
              <div className="text-xs text-gray-400 flex gap-4 pt-2 border-t">
                <span>Created: {viewDealer.createdAt ? new Date(viewDealer.createdAt).toLocaleDateString('en-IN') : '-'}</span>
                <span>Assigned SE: {viewDealer.assignedSalesExecutive?.name || '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DealerMaster;
