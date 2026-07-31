import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Switch, message, Popconfirm, Tooltip, Row, Col, Divider, Card, Statistic } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import { Users } from 'lucide-react';
import masterService from '../../services/masterService.js';

const DealerMaster = () => {
  const [dealers, setDealers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: undefined, dealerType: undefined, region: undefined });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, blocked: 0 });
  const [options, setOptions] = useState({ dealerTypes: [], dealerCategories: [], regions: [], routes: [] });

  // Form
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingDealer, setEditingDealer] = useState(null);
  const [form] = Form.useForm();

  // Load options
  useEffect(() => {
    Promise.all([
      masterService.getDealerTypes({ limit: 100 }),
      masterService.getDealerCategories({ limit: 100 }),
      masterService.getRegions({ limit: 100 }),
      masterService.getRoutes({ limit: 100 }),
      masterService.getDealerStats(),
    ]).then(([dt, dc, reg, rt, st]) => {
      setOptions({
        dealerTypes: dt.success ? dt.data : [],
        dealerCategories: dc.success ? dc.data : [],
        regions: reg.success ? reg.data : [],
        routes: rt.success ? rt.data : [],
      });
      if (st.success) setStats(st.data);
    });
  }, []);

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

  const openForm = (dealer = null) => {
    setEditingDealer(dealer);
    if (dealer) {
      form.setFieldsValue({
        ...dealer,
        dealerType: dealer.dealerType?._id || dealer.dealerType,
        dealerCategory: dealer.dealerCategory?._id || dealer.dealerCategory,
        assignedRegion: dealer.assignedRegion?._id || dealer.assignedRegion,
        assignedRoute: dealer.assignedRoute?._id || dealer.assignedRoute,
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
      setLoading(true);
      const res = editingDealer
        ? await masterService.updateDealer(editingDealer._id, values)
        : await masterService.createDealer(values);
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
    { title: 'Credit Limit', dataIndex: 'creditLimit', key: 'cl', width: 100, render: v => <span className="text-sm">₹{(v||0).toLocaleString()}</span> },
    { title: 'Outstanding', dataIndex: 'currentOutstanding', key: 'out', width: 100, render: v => <span className={`text-sm font-medium ${v > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(v||0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 80, render: s => <Tag color={s === 'active' ? 'green' : s === 'blocked' ? 'red' : 'orange'}>{s}</Tag> },
    { title: 'Actions', key: 'actions', width: 100, render: (_, r) => (
      <Space size="small">
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
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()} size="large">Add New Dealer</Button>
      </div>

      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Dealers" value={stats.total} prefix={<Users size={16} />} /></Card></Col>
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
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setFilters({status:undefined,dealerType:undefined,region:undefined}); }}>Reset</Button>
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
                  <Col span={6}><Form.Item name="mobile" label="Mobile" rules={[{required:true}]}><Input placeholder="Mobile number" /></Form.Item></Col>
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
                  <Col span={6}><Form.Item name="visitFrequency" label="Visit Frequency"><Input placeholder="e.g. Weekly" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="tallyLedgerName" label="Tally Ledger Name"><Input placeholder="Tally name" /></Form.Item></Col>
                </Row>
              </Form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DealerMaster;
