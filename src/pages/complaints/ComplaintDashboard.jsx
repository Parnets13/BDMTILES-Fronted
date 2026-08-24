import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, Tabs, Badge, Checkbox
} from 'antd';
import { PlusOutlined, SearchOutlined, EyeOutlined, ReloadOutlined, WarningOutlined, CheckCircleOutlined } from '@ant-design/icons';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';

const CATEGORY_COLORS = {
  damaged_goods: 'red', wrong_product: 'orange', quality_issue: 'volcano',
  shade_mismatch: 'magenta', size_issue: 'purple', short_delivery: 'gold',
  billing_error: 'blue', delivery_delay: 'purple', packing_issue: 'cyan', other: 'default',
};
const PRIORITY_COLORS = { low: 'default', medium: 'blue', high: 'orange', critical: 'red' };
const STATUS_COLORS = {
  open: 'red', acknowledged: 'orange', warehouse_pending: 'gold',
  warehouse_verified: 'lime', finance_review: 'geekblue', in_progress: 'blue',
  resolved: 'green', closed: 'default', rejected: 'volcano',
};

const CATEGORY_OPTIONS = Object.keys(CATEGORY_COLORS).map(k => ({ value: k, label: k.replace(/_/g, ' ') }));
const PRIORITY_OPTIONS = Object.keys(PRIORITY_COLORS).map(k => ({ value: k, label: k }));
const STATUS_OPTIONS = Object.keys(STATUS_COLORS).map(k => ({ value: k, label: k.replace(/_/g, ' ') }));

const ComplaintDashboard = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [priorityFilter, setPriorityFilter] = useState(undefined);
  const [activeTab, setActiveTab] = useState('all');
  const [dealers, setDealers] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({
    dealer: '', orderNumber: '', category: '', description: '',
    priority: 'medium', assignedTo: '',
  });

  const [viewComplaint, setViewComplaint] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [resolveForm, setResolveForm] = useState({
    action: '', notes: '', closeComplaint: false, creditNoteAmount: 0,
  });
  const [resolveLoading, setResolveLoading] = useState(false);

  useEffect(() => {
    crmService.getComplaintStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
    masterService.getDealers({ limit: 200, status: 'active' })
      .then(r => { if (r.success) setDealers(r.data || []); }).catch(() => {});
  }, []);

  const fetchComplaints = useCallback(async (tabStatus) => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        status: tabStatus || statusFilter,
        priority: priorityFilter,
      };
      const res = await crmService.getComplaints(params);
      if (res.success) {
        setComplaints(res.data || []);
        setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 }));
      }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter, priorityFilter]);

  useEffect(() => {
    const tabStatus = activeTab === 'open' ? 'open' : activeTab === 'critical' ? undefined : undefined;
    const tabPriority = activeTab === 'critical' ? 'critical' : undefined;
    fetchComplaints(tabStatus);
  }, [fetchComplaints, activeTab]);

  const handleCreate = async () => {
    if (!form.description) { message.error('Enter complaint description'); return; }
    if (!form.category) { message.error('Select category'); return; }
    setCreateLoading(true);
    try {
      const res = await crmService.createComplaint(form);
      if (res.success) {
        message.success('Complaint registered');
        setShowCreate(false);
        setForm({ dealer: '', orderNumber: '', category: '', description: '', priority: 'medium', assignedTo: '' });
        fetchComplaints();
        crmService.getComplaintStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
      }
    } catch (err) { message.error(err.message); }
    finally { setCreateLoading(false); }
  };

  const openView = async (id) => {
    setViewLoading(true);
    setViewComplaint({ _id: id });
    setResolveForm({ action: '', notes: '', closeComplaint: false, creditNoteAmount: 0 });
    try {
      const res = await crmService.getComplaint(id);
      if (res.success) setViewComplaint(res.data);
    } catch (err) { message.error(err.message); }
    finally { setViewLoading(false); }
  };

  const handleResolve = async () => {
    if (!resolveForm.action) { message.error('Enter action taken'); return; }
    setResolveLoading(true);
    try {
      const res = await crmService.resolveComplaint(viewComplaint._id, resolveForm);
      if (res.success) {
        message.success('Resolution added');
        setResolveForm({ action: '', notes: '', closeComplaint: false, creditNoteAmount: 0 });
        openView(viewComplaint._id);
        fetchComplaints();
      }
    } catch (err) { message.error(err.message); }
    finally { setResolveLoading(false); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const res = await crmService.updateComplaintStatus(id, { status });
      if (res.success) { message.success('Status updated'); fetchComplaints(); }
    } catch (err) { message.error(err.message); }
  };

  const columns = [
    { title: 'Complaint #', dataIndex: 'complaintNumber', width: 130,
      render: v => <span className="font-mono text-xs text-red-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'createdAt', width: 100,
      render: v => <span className="text-xs">{v ? new Date(v).toLocaleDateString('en-IN') : '—'}</span> },
    { title: 'Dealer', key: 'dealer', width: 160,
      render: (_, r) => <div className="text-sm font-medium truncate max-w-[150px]">{r.dealerName || r.dealer?.businessName || '—'}</div> },
    { title: 'Order #', dataIndex: 'orderNumber', width: 110,
      render: v => <span className="text-xs font-mono text-blue-500">{v || '—'}</span> },
    { title: 'Category', dataIndex: 'category', width: 130,
      render: v => <Tag color={CATEGORY_COLORS[v] || 'default'}>{v?.replace(/_/g, ' ')}</Tag> },
    { title: 'Priority', dataIndex: 'priority', width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'}>{v}</Tag> },
    { title: 'Status', dataIndex: 'status', width: 110,
      render: s => <Tag color={STATUS_COLORS[s] || 'default'}>{s?.replace(/_/g, ' ')}</Tag> },
    { title: 'Assigned', dataIndex: 'assignedToName', width: 110,
      render: v => <span className="text-xs">{v || '—'}</span> },
    { title: 'Actions', width: 110,
      render: (_, r) => (
        <Space size="small">
          <Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-500"
            onClick={() => openView(r._id)} />
          <Select size="small" className="w-24" placeholder="Status" value={undefined}
            onChange={v => handleStatusChange(r._id, v)}
            options={STATUS_OPTIONS} />
        </Space>
      )},
  ];

  const ComplaintTable = ({ filterStatus, filterPriority }) => {
    const filtered = complaints.filter(c =>
      (!filterStatus || c.status === filterStatus) &&
      (!filterPriority || c.priority === filterPriority)
    );
    return (
      <Table columns={columns} dataSource={filterStatus || filterPriority ? filtered : complaints}
        rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }}
        pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
        onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
    );
  };

  const tabItems = [
    { key: 'all', label: 'All Complaints', children: <ComplaintTable /> },
    { key: 'open', label: <span>Open <Badge count={stats.open || 0} size="small" /></span>,
      children: <ComplaintTable filterStatus="open" /> },
    { key: 'critical', label: <span>Critical <Badge count={stats.critical || 0} size="small" color="red" /></span>,
      children: <ComplaintTable filterPriority="critical" /> },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <WarningOutlined className="text-orange-600 text-xl" /> Complaint Management
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and resolve customer complaints</p>
        </div>
        <Space>
          <ModuleRecycleBin module="complaint" title="Deleted Complaints" onRestore={fetchComplaints} />
          <Button type="primary" icon={<PlusOutlined />} size="large" onClick={() => setShowCreate(true)}>
            New Complaint
          </Button>
        </Space>
      </div>

      <Row gutter={[12, 12]} className="mb-4">
        {[
          ['Total', stats.total, '#1890ff'], ['Open', stats.open, '#f5222d'],
          ['In Progress', stats.inProgress, '#1890ff'], ['Resolved', stats.resolved, '#52c41a'],
          ['Closed', stats.closed, '#8c8c8c'], ['Critical', stats.critical, '#a8071a'],
        ].map(([label, val, color]) => (
          <Col key={label} span={4}>
            <Card size="small"><Statistic title={label} value={val || 0} valueStyle={{ color, fontSize: 18 }} /></Card>
          </Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search complaint #, dealer, order..."
            prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }}
            className="w-64" allowClear />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={v => setStatusFilter(v)} className="w-36"
            options={STATUS_OPTIONS} />
          <Select placeholder="Priority" allowClear value={priorityFilter} onChange={v => setPriorityFilter(v)} className="w-32"
            options={PRIORITY_OPTIONS} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); setPriorityFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} className="px-4 pt-2" />
      </div>

      {/* Create Complaint Modal */}
      <Modal title="New Complaint" open={showCreate} onCancel={() => setShowCreate(false)}
        onOk={handleCreate} confirmLoading={createLoading} okText="Register Complaint" width={580} destroyOnHidden>
        <div className="space-y-3 mt-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Dealer</label>
            <Select className="w-full" showSearch optionFilterProp="label" placeholder="Select dealer..."
              value={form.dealer || undefined} onChange={v => setForm(f => ({ ...f, dealer: v }))} allowClear
              options={dealers.map(d => ({ value: d._id, label: `${d.businessName} (${d.dealerCode})` }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Sales Order #</label>
              <Input value={form.orderNumber} onChange={e => setForm(f => ({ ...f, orderNumber: e.target.value }))} placeholder="SO-XXXX" /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Category *</label>
              <Select className="w-full" value={form.category || undefined} onChange={v => setForm(f => ({ ...f, category: v }))}
                placeholder="Select category" options={CATEGORY_OPTIONS} /></div>
          </div>
          <div><label className="text-xs text-gray-500 block mb-1">Description *</label>
            <Input.TextArea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the complaint in detail..." /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-gray-500 block mb-1">Priority</label>
              <Select className="w-full" value={form.priority} onChange={v => setForm(f => ({ ...f, priority: v }))}
                options={PRIORITY_OPTIONS} /></div>
            <div><label className="text-xs text-gray-500 block mb-1">Assigned To</label>
              <Input value={form.assignedTo} onChange={e => setForm(f => ({ ...f, assignedTo: e.target.value }))} placeholder="Staff name / ID" /></div>
          </div>
        </div>
      </Modal>

      {/* View Complaint Modal */}
      {viewComplaint && (
        <Modal title={`Complaint: ${viewComplaint.complaintNumber || '...'}`} open
          onCancel={() => setViewComplaint(null)}
          footer={<Button onClick={() => setViewComplaint(null)}>Close</Button>}
          width={680}>
          {viewLoading ? <div className="py-8 text-center text-gray-400">Loading...</div> : (
            <div className="space-y-3 mt-3 text-sm">
              <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                {[['Dealer', viewComplaint.dealerName || viewComplaint.dealer?.businessName || '—'],
                  ['Order #', viewComplaint.orderNumber || '—'],
                  ['Category', viewComplaint.category?.replace(/_/g, ' ')],
                  ['Assigned To', viewComplaint.assignedToName || '—'],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between py-1 border-b border-gray-50">
                    <span className="text-gray-400">{k}</span><span className="font-medium">{v}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <span>Status: <Tag color={STATUS_COLORS[viewComplaint.status]}>{viewComplaint.status?.replace(/_/g, ' ')}</Tag></span>
                <span>Priority: <Tag color={PRIORITY_COLORS[viewComplaint.priority]}>{viewComplaint.priority}</Tag></span>
              </div>
              <div className="bg-gray-50 rounded p-3 text-sm">{viewComplaint.description}</div>

              {/* Products */}
              {viewComplaint.products?.length > 0 && (
                <>
                  <Divider className="my-2">Products Affected</Divider>
                  <div className="border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-100"><tr>
                        <th className="px-3 py-1.5 text-left">Product</th>
                        <th className="px-3 py-1.5 text-right">Qty</th>
                        <th className="px-3 py-1.5 text-left">Shade</th>
                        <th className="px-3 py-1.5 text-left">Batch</th>
                      </tr></thead>
                      <tbody>{viewComplaint.products.map((p, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-1.5 font-medium">{p.productName || '-'}</td>
                          <td className="px-3 py-1.5 text-right">{p.quantity || 0}</td>
                          <td className="px-3 py-1.5">{p.shade || '-'}</td>
                          <td className="px-3 py-1.5">{p.batch || '-'}</td>
                        </tr>
                      ))}</tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Warehouse Verification */}
              {viewComplaint.warehouseVerification?.verifiedBy && (
                <>
                  <Divider className="my-2">Warehouse Verification</Divider>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500">Problem Confirmed:</span> <Tag color={viewComplaint.warehouseVerification.problemConfirmed ? 'green' : 'red'}>{viewComplaint.warehouseVerification.problemConfirmed ? 'Yes' : 'No'}</Tag></div>
                      <div><span className="text-gray-500">Severity:</span> <span className="font-medium capitalize">{viewComplaint.warehouseVerification.severity || '-'}</span></div>
                      <div><span className="text-gray-500">Product Condition:</span> <span className="font-medium capitalize">{viewComplaint.warehouseVerification.productCondition?.replace(/_/g, ' ') || '-'}</span></div>
                      <div><span className="text-gray-500">Resaleable:</span> <Tag color={viewComplaint.warehouseVerification.isResaleable ? 'green' : 'red'}>{viewComplaint.warehouseVerification.isResaleable ? 'Yes' : 'No'}</Tag></div>
                      <div><span className="text-gray-500">Qty Received:</span> <span className="font-medium">{viewComplaint.warehouseVerification.quantityReceived || 0}</span></div>
                      <div><span className="text-gray-500">Qty Damaged:</span> <span className="font-medium text-red-600">{viewComplaint.warehouseVerification.quantityDamaged || 0}</span></div>
                    </div>
                    {viewComplaint.warehouseVerification.problemDescription && (
                      <div className="mt-1"><span className="text-gray-500 block">Description:</span><span>{viewComplaint.warehouseVerification.problemDescription}</span></div>
                    )}
                    {viewComplaint.warehouseVerification.recommendation && (
                      <div className="mt-1 bg-white p-2 rounded border">
                        <span className="text-gray-500 block text-[10px]">Recommendation:</span>
                        <span className="capitalize">{viewComplaint.warehouseVerification.recommendation.action?.replace(/_/g, ' ')}</span>
                        {viewComplaint.warehouseVerification.recommendation.amount > 0 && <span className="ml-2 text-blue-600">₹{viewComplaint.warehouseVerification.recommendation.amount.toLocaleString()}</span>}
                      </div>
                    )}
                    {viewComplaint.warehouseVerification.photos?.length > 0 && (
                      <div className="flex gap-2 mt-1 flex-wrap">
                        {viewComplaint.warehouseVerification.photos.map((photo, i) => (
                          <img key={i} src={photo.url} alt={photo.caption || 'Evidence'} className="w-16 h-16 object-cover rounded border cursor-pointer" />
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Accountant Review */}
              {viewComplaint.accountantReview?.reviewedBy && (
                <>
                  <Divider className="my-2">Finance Review</Divider>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-xs">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-gray-500">Decision:</span> <Tag color={viewComplaint.accountantReview.decision === 'approved' ? 'green' : viewComplaint.accountantReview.decision === 'rejected' ? 'red' : 'orange'}>{viewComplaint.accountantReview.decision}</Tag></div>
                      <div><span className="text-gray-500">Approved Amount:</span> <span className="font-semibold text-green-700">₹{(viewComplaint.accountantReview.approvedAmount || 0).toLocaleString()}</span></div>
                      <div><span className="text-gray-500">Adjustment Type:</span> <span className="font-medium capitalize">{viewComplaint.accountantReview.adjustmentType?.replace(/_/g, ' ') || '-'}</span></div>
                      <div><span className="text-gray-500">Reviewed:</span> <span>{viewComplaint.accountantReview.reviewedAt ? new Date(viewComplaint.accountantReview.reviewedAt).toLocaleDateString('en-IN') : '-'}</span></div>
                    </div>
                    {viewComplaint.accountantReview.remarks && <div className="mt-1 text-gray-600">Remarks: {viewComplaint.accountantReview.remarks}</div>}
                  </div>
                </>
              )}

              {viewComplaint.resolutionHistory?.length > 0 && (
                <>
                  <Divider className="my-2">Resolution History</Divider>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {viewComplaint.resolutionHistory.map((r, i) => (
                      <div key={i} className="bg-green-50 rounded px-3 py-2 text-xs border-l-2 border-green-400">
                        <div className="flex justify-between mb-1">
                          <span className="font-medium">{r.action}</span>
                          <span className="text-gray-400">{new Date(r.date || r.createdAt).toLocaleDateString('en-IN')}</span>
                        </div>
                        {r.notes && <div className="text-gray-600">{r.notes}</div>}
                        {r.creditNoteAmount > 0 && <div className="text-blue-600 mt-1">Credit Note: ₹{r.creditNoteAmount.toLocaleString()}</div>}
                        {r.closedComplaint && <Tag color="green" className="mt-1">Complaint Closed</Tag>}
                      </div>
                    ))}
                  </div>
                </>
              )}

              <Divider className="my-2">Add Resolution</Divider>
              <div className="space-y-2">
                <div><label className="text-xs text-gray-500 block mb-1">Action Taken *</label>
                  <Input value={resolveForm.action} onChange={e => setResolveForm(f => ({ ...f, action: e.target.value }))} placeholder="What action was taken?" /></div>
                <div><label className="text-xs text-gray-500 block mb-1">Notes</label>
                  <Input.TextArea rows={2} value={resolveForm.notes} onChange={e => setResolveForm(f => ({ ...f, notes: e.target.value }))} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs text-gray-500 block mb-1">Credit Note Amount (₹)</label>
                    <Input type="number" value={resolveForm.creditNoteAmount} onChange={e => setResolveForm(f => ({ ...f, creditNoteAmount: parseFloat(e.target.value) || 0 }))} placeholder="0" /></div>
                  <div className="flex items-center gap-2 pt-5">
                    <Checkbox checked={resolveForm.closeComplaint} onChange={e => setResolveForm(f => ({ ...f, closeComplaint: e.target.checked }))}>
                      Close this complaint
                    </Checkbox>
                  </div>
                </div>
                <Button type="primary" size="small" loading={resolveLoading} icon={<CheckCircleOutlined />} onClick={handleResolve}>
                  Submit Resolution
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

export default ComplaintDashboard;
