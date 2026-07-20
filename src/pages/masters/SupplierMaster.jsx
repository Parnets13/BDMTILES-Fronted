import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, message, Popconfirm, Tooltip, Row, Col, Divider } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService.js';

const SupplierMaster = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form] = Form.useForm();

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page: pagination.current, limit: pagination.pageSize, search, ...(statusFilter && { status: statusFilter }) };
      const res = await masterService.getSuppliers(params);
      if (res.success) { setSuppliers(res.data); setPagination(p => ({ ...p, total: res.pagination.totalItems })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const openForm = (supplier = null) => {
    setEditingSupplier(supplier);
    form.setFieldsValue(supplier || { creditDays: 30, status: 'active' });
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const res = editingSupplier
        ? await masterService.updateSupplier(editingSupplier._id, values)
        : await masterService.createSupplier(values);
      if (res.success) { message.success(res.message); setDrawerOpen(false); form.resetFields(); setEditingSupplier(null); fetchSuppliers(); }
    } catch (err) { if (err.errorFields) return; message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleDelete = async (id) => {
    try { const res = await masterService.deleteSupplier(id); if (res.success) { message.success('Deleted'); fetchSuppliers(); } }
    catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Code', dataIndex: 'supplierCode', width: 100, render: v => <span className="text-xs font-mono text-blue-600">{v}</span> },
    { title: 'Company Name', key: 'name', width: 200, render: (_, r) => <div><div className="text-sm font-medium truncate max-w-[190px]">{r.companyName}</div><div className="text-xs text-gray-400">{r.contactPerson}</div></div> },
    { title: 'Mobile', dataIndex: 'mobile', width: 110 },
    { title: 'City', dataIndex: 'city', width: 100 },
    { title: 'GSTIN', dataIndex: 'gstin', width: 150, render: v => <span className="text-xs font-mono">{v || '-'}</span> },
    { title: 'Credit Days', dataIndex: 'creditDays', width: 90 },
    { title: 'Outstanding', dataIndex: 'currentOutstanding', width: 110, render: v => <span className={`text-sm font-medium ${v > 0 ? 'text-red-600' : ''}`}>₹{(v||0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 80, render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s}</Tag> },
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(r)} /></Tooltip>
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(r._id)}><Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Supplier Master</h1><p className="text-sm text-gray-500 mt-0.5">Manage tile & material suppliers</p></div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()} size="large">Add Supplier</Button>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search by name, code, mobile, city..." prefix={<SearchOutlined className="text-gray-400" />} value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }} className="w-72" allowClear />
          <Select placeholder="Status" options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]} value={statusFilter} onChange={setStatusFilter} allowClear className="w-32" />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={suppliers} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1000 }}
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t,r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({...p, current: pag.current, pageSize: pag.pageSize}))} />
      </div>

      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingSupplier(null); }} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-y-auto">
            <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl">
              <h2 className="text-lg font-bold text-gray-800">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h2>
              <div className="flex gap-3">
                <Button type="primary" onClick={handleSave} loading={loading}>{editingSupplier ? 'Update' : 'Create'}</Button>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingSupplier(null); }}>✕</span>
              </div>
            </div>
            <div className="px-8 py-6">
              <Form form={form} layout="vertical">
                <Divider orientation="left" plain>Basic Information</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="supplierCode" label="Supplier Code"><Input placeholder="Auto-generated" /></Form.Item></Col>
                  <Col span={9}><Form.Item name="companyName" label="Company Name" rules={[{required:true}]}><Input placeholder="Company name" /></Form.Item></Col>
                  <Col span={9}><Form.Item name="contactPerson" label="Contact Person" rules={[{required:true}]}><Input placeholder="Contact person" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="mobile" label="Mobile" rules={[{required:true}]}><Input placeholder="Mobile" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="alternateMobile" label="Alt Mobile"><Input placeholder="Alternate" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="email" label="Email"><Input placeholder="Email" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="status" label="Status"><Select options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'}]} /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="gstin" label="GSTIN"><Input placeholder="GSTIN" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="pan" label="PAN"><Input placeholder="PAN" /></Form.Item></Col>
                  <Col span={8}><Form.Item name="transportDetails" label="Transport"><Input placeholder="Transport details" /></Form.Item></Col>
                </Row>

                <Divider orientation="left" plain>Address</Divider>
                <Row gutter={16}>
                  <Col span={12}><Form.Item name="address" label="Address"><Input.TextArea rows={2} placeholder="Full address" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="city" label="City"><Input placeholder="City" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="state" label="State"><Input placeholder="State" /></Form.Item></Col>
                  <Col span={4}><Form.Item name="pinCode" label="PIN"><Input placeholder="PIN" /></Form.Item></Col>
                </Row>

                <Divider orientation="left" plain>Bank Details</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="bankName" label="Bank Name"><Input placeholder="Bank" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="accountNumber" label="Account No"><Input placeholder="Account number" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="ifscCode" label="IFSC Code"><Input placeholder="IFSC" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="accountHolderName" label="Account Holder"><Input placeholder="Name" /></Form.Item></Col>
                </Row>

                <Divider orientation="left" plain>Financial & Scheme</Divider>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="creditDays" label="Credit Days"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="openingBalance" label="Opening Balance (₹)"><InputNumber className="w-full" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="paymentTerms" label="Payment Terms"><Input placeholder="e.g. Net 30" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="schemeType" label="Scheme Type"><Input placeholder="Quantity/Value based" /></Form.Item></Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}><Form.Item name="schemeDetails" label="Scheme Details"><Input.TextArea rows={2} placeholder="Describe scheme details" /></Form.Item></Col>
                </Row>
              </Form>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SupplierMaster;
