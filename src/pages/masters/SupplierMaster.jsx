import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, message, Popconfirm, Tooltip, Row, Col, Divider } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined } from '@ant-design/icons';
import masterService from '../../services/masterService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';

const SupplierMaster = () => {
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [viewSupplier, setViewSupplier] = useState(null);
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
        <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewSupplier(r)} /></Tooltip>
        <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openForm(r)} /></Tooltip>
        <Popconfirm title="Delete?" onConfirm={() => handleDelete(r._id)}><Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip></Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div><h1 className="text-2xl font-bold text-gray-800">Supplier Master</h1><p className="text-sm text-gray-500 mt-0.5">Manage tile & material suppliers</p></div>
        <Space>
          <ModuleRecycleBin module="supplier" title="Deleted Suppliers" onRestore={fetchSuppliers} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openForm()} size="large">Add Supplier</Button>
        </Space>
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
                  <Col span={8}><Form.Item name="gstin" label="GSTIN"
                    rules={[{ pattern: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[A-Z0-9]{1}[Z]{1}[A-Z0-9]{1}$/, message: 'Invalid GSTIN format (e.g. 29ABCDE1234F1Z5)' }]}>
                    <Input placeholder="29ABCDE1234F1Z5" maxLength={15} style={{ textTransform: 'uppercase' }} onChange={e => e.target.value = e.target.value.toUpperCase()} />
                  </Form.Item></Col>
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

      {/* View Supplier Detail Modal */}
      {viewSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setViewSupplier(null)}>
          <div className="fixed inset-0 bg-black/40" />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{viewSupplier.companyName}</h2>
                <p className="text-sm text-gray-500">{viewSupplier.supplierCode} • {viewSupplier.contactPerson}</p>
              </div>
              <div className="flex items-center gap-3">
                <Tag color={viewSupplier.status === 'active' ? 'green' : 'red'}>{viewSupplier.status}</Tag>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl" onClick={() => setViewSupplier(null)}>✕</span>
              </div>
            </div>
            <div className="p-6 space-y-5">
              {/* Contact Info */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Contact Information</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Contact Person:</span> <span className="font-medium">{viewSupplier.contactPerson || '-'}</span></div>
                  <div><span className="text-gray-500">Mobile:</span> <span className="font-medium">{viewSupplier.mobile || '-'}</span></div>
                  <div><span className="text-gray-500">Alt Mobile:</span> <span className="font-medium">{viewSupplier.alternateMobile || '-'}</span></div>
                  <div><span className="text-gray-500">Email:</span> <span className="font-medium">{viewSupplier.email || '-'}</span></div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Address</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="col-span-2"><span className="text-gray-500">Address:</span> <span className="font-medium">{viewSupplier.address || '-'}</span></div>
                  <div><span className="text-gray-500">City:</span> <span className="font-medium">{viewSupplier.city || '-'}</span></div>
                  <div><span className="text-gray-500">State:</span> <span className="font-medium">{viewSupplier.state || '-'}</span></div>
                  <div><span className="text-gray-500">Pin Code:</span> <span className="font-medium">{viewSupplier.pinCode || '-'}</span></div>
                </div>
              </div>

              {/* Business & Financial */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Business Info</h3>
                  <div className="space-y-1.5 text-sm">
                    <div><span className="text-gray-500">GSTIN:</span> <span className="font-medium font-mono">{viewSupplier.gstin || '-'}</span></div>
                    <div><span className="text-gray-500">PAN:</span> <span className="font-medium">{viewSupplier.pan || '-'}</span></div>
                    <div><span className="text-gray-500">Product Categories:</span> <span className="font-medium">{viewSupplier.productCategories?.join(', ') || '-'}</span></div>
                    <div><span className="text-gray-500">Transport:</span> <span className="font-medium">{viewSupplier.transportDetails || '-'}</span></div>
                    <div><span className="text-gray-500">Rating:</span> <span className="font-medium">{viewSupplier.performanceRating ? `${viewSupplier.performanceRating}/5 ⭐` : '-'}</span></div>
                  </div>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Financial</h3>
                  <div className="space-y-1.5 text-sm">
                    <div><span className="text-gray-500">Credit Days:</span> <span className="font-medium">{viewSupplier.creditDays || 0}</span></div>
                    <div><span className="text-gray-500">Payment Terms:</span> <span className="font-medium">{viewSupplier.paymentTerms || '-'}</span></div>
                    <div><span className="text-gray-500">Opening Balance:</span> <span className="font-medium">₹{(viewSupplier.openingBalance || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Outstanding:</span> <span className={`font-semibold ${(viewSupplier.currentOutstanding || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{(viewSupplier.currentOutstanding || 0).toLocaleString()}</span></div>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-purple-50 rounded-lg p-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Bank Details</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-gray-500">Bank Name:</span> <span className="font-medium">{viewSupplier.bankName || '-'}</span></div>
                  <div><span className="text-gray-500">Account No:</span> <span className="font-medium">{viewSupplier.accountNumber || '-'}</span></div>
                  <div><span className="text-gray-500">IFSC:</span> <span className="font-medium">{viewSupplier.ifscCode || '-'}</span></div>
                  <div><span className="text-gray-500">Account Holder:</span> <span className="font-medium">{viewSupplier.accountHolderName || '-'}</span></div>
                </div>
              </div>

              {/* Scheme Info */}
              {(viewSupplier.schemeType || viewSupplier.schemeDetails) && (
                <div className="bg-yellow-50 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2">Supplier Scheme</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-gray-500">Type:</span> <span className="font-medium">{viewSupplier.schemeType || '-'}</span></div>
                    <div><span className="text-gray-500">Amount Due:</span> <span className="font-semibold text-blue-600">₹{(viewSupplier.schemeAmountDue || 0).toLocaleString()}</span></div>
                    <div><span className="text-gray-500">Validity:</span> <span className="font-medium">{viewSupplier.schemeValidity ? new Date(viewSupplier.schemeValidity).toLocaleDateString('en-IN') : '-'}</span></div>
                    <div className="col-span-2"><span className="text-gray-500">Details:</span> <span className="font-medium">{viewSupplier.schemeDetails || '-'}</span></div>
                  </div>
                </div>
              )}

              {/* Tally Sync */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                <div className="bg-gray-100 rounded p-2 text-center">
                  <span className="text-gray-500 block">Tally Status</span>
                  <Tag color={viewSupplier.tallySyncStatus === 'synced' ? 'green' : viewSupplier.tallySyncStatus === 'pending' ? 'orange' : 'default'}>
                    {viewSupplier.tallySyncStatus || 'not_synced'}
                  </Tag>
                </div>
                <div className="bg-gray-100 rounded p-2 text-center"><span className="text-gray-500 block">Tally Ledger</span><span className="font-medium">{viewSupplier.tallyLedgerName || '-'}</span></div>
                <div className="bg-gray-100 rounded p-2 text-center"><span className="text-gray-500 block">Last Sync</span><span className="font-medium">{viewSupplier.tallySyncDate ? new Date(viewSupplier.tallySyncDate).toLocaleDateString('en-IN') : '-'}</span></div>
              </div>

              {/* Meta */}
              <div className="text-xs text-gray-400 flex gap-4 pt-2 border-t">
                <span>Created: {viewSupplier.createdAt ? new Date(viewSupplier.createdAt).toLocaleDateString('en-IN') : '-'}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupplierMaster;
