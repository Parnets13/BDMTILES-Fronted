import { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber, Alert
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  CheckOutlined, CloseOutlined, EyeOutlined, DeleteOutlined
} from '@ant-design/icons';
import { ShoppingBag } from 'lucide-react';
import api from '../../config/api.js';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';

const prService = {
  getAll:   (p)    => api.get('/purchase-requisitions', { params: p }),
  getStats: ()     => api.get('/purchase-requisitions/stats'),
  get:      (id)   => api.get(`/purchase-requisitions/${id}`),
  create:   (d)    => api.post('/purchase-requisitions', d),
  approve:  (id,d) => api.patch(`/purchase-requisitions/${id}/approve`, d),
  reject:   (id,d) => api.patch(`/purchase-requisitions/${id}/reject`, d),
};

const STATUS_COLORS = {
  draft: 'default', submitted: 'blue', approved: 'green',
  rejected: 'red', po_created: 'geekblue',
};
const PRIORITY_COLORS = { low: 'default', normal: 'blue', high: 'orange', urgent: 'red' };

const emptyForm = () => ({
  requiredByDate: '', department: '', warehouse: '', priority: 'normal',
  remarks: '', status: 'submitted',
  items: [{ productName: '', productCode: '', product: '', requiredQty: 1, currentStock: 0, remarks: '' }],
});

const PurchaseRequisition = () => {
  const [prs, setPRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [viewPR, setViewPR] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [warehouses, setWarehouses] = useState([]);
  // Product search per row
  const [prodSearches, setProdSearches] = useState({});
  const [prodResults, setProdResults] = useState({});

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        prService.getAll({ page, limit: 20, search, status: statusFilter }),
        prService.getStats(),
      ]);
      if (listRes.success) {
        setPRs(listRes.data || []);
        const pg = listRes.pagination;
        setPagination({ current: pg?.currentPage || page, pageSize: 20, total: pg?.totalItems || 0 });
      }
      if (statsRes.success) setStats(statsRes.data);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [search, statusFilter]);

  useEffect(() => { load(1); }, [load]);
  useEffect(() => {
    masterService.getWarehouses({ limit: 50 }).then(r => { if (r.success) setWarehouses(r.data || []); }).catch(() => {});
  }, []);

  // Product search per item row
  const searchProduct = (idx, value) => {
    setProdSearches(p => ({ ...p, [idx]: value }));
    if (value.length < 2) { setProdResults(r => ({ ...r, [idx]: [] })); return; }
    productService.getProducts({ search: value, limit: 8 }).then(r => {
      if (r.success) setProdResults(prev => ({ ...prev, [idx]: r.data || [] }));
    }).catch(() => {});
  };

  const selectProduct = (idx, prod) => {
    updateItem(idx, 'product',     prod._id);
    updateItem(idx, 'productName', prod.itemName);
    updateItem(idx, 'productCode', prod.productCode || '');
    setProdSearches(p => ({ ...p, [idx]: prod.itemName }));
    setProdResults(r => ({ ...r, [idx]: [] }));
  };

  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { productName: '', productCode: '', product: '', requiredQty: 1, currentStock: 0, remarks: '' }],
  }));

  const removeItem = (idx) => setForm(f => ({
    ...f,
    items: f.items.filter((_, i) => i !== idx),
  }));

  const handleCreate = async () => {
    if (!form.items.length || !form.items[0].productName) {
      message.error('Add at least one product');
      return;
    }
    setCreateLoading(true);
    try {
      const res = await prService.create(form);
      if (res.success) {
        message.success(`${res.data.prNumber} created`);
        setShowCreate(false);
        setForm(emptyForm());
        load(1);
      }
    } catch (err) { message.error(err.message || 'Failed'); }
    finally { setCreateLoading(false); }
  };

  const handleAction = async () => {
    setActionLoading(true);
    try {
      const res = actionModal.type === 'approve'
        ? await prService.approve(actionModal.pr._id, { notes: actionNote })
        : await prService.reject(actionModal.pr._id, { notes: actionNote });
      if (res.success) {
        message.success(actionModal.type === 'approve' ? 'PR Approved' : 'PR Rejected');
        setActionModal(null);
        load(1);
      }
    } catch (err) { message.error(err.message); }
    finally { setActionLoading(false); }
  };

  const setF = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const columns = [
    { title: 'PR No.', dataIndex: 'prNumber', width: 110, render: v => <span className="font-mono text-xs font-semibold">{v}</span> },
    {
      title: 'Requested By / Dept',
      key: 'req',
      render: (_, r) => (
        <div>
          <div className="font-medium text-sm">{r.requestedByName || '—'}</div>
          <div className="text-xs text-gray-400">{r.department || 'General'} · {r.warehouseName || '—'}</div>
        </div>
      ),
    },
    {
      title: 'Items',
      key: 'items',
      width: 80,
      render: (_, r) => <Tag color="blue">{r.items?.length || 0} items</Tag>,
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 90,
      render: v => <Tag color={PRIORITY_COLORS[v] || 'default'} className="capitalize">{v}</Tag>,
    },
    {
      title: 'Required By',
      dataIndex: 'requiredByDate',
      width: 110,
      render: v => v ? new Date(v).toLocaleDateString('en-IN') : '—',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: v => <Tag color={STATUS_COLORS[v] || 'default'} className="capitalize">{v?.replace(/_/g,' ')}</Tag>,
    },
    {
      title: 'Actions',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          {r.status === 'submitted' && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />}
                style={{ background: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => { setActionModal({ type: 'approve', pr: r }); setActionNote(''); }}>
                Approve
              </Button>
              <Button size="small" danger
                onClick={() => { setActionModal({ type: 'reject', pr: r }); setActionNote(''); }}>
                Reject
              </Button>
            </>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => setViewPR(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingBag size={22} className="text-blue-500" />
            Purchase Requisition
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Internal purchase requests — raise, approve and convert to PO
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { setShowCreate(true); setForm(emptyForm()); }}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            New Requisition
          </Button>
        </Space>
      </div>

      <Row gutter={16} className="mb-5">
        {[
          ['Total',    stats.total || 0,     '#1890ff'],
          ['Pending',  stats.submitted || 0,  '#fa8c16'],
          ['Approved', stats.approved || 0,   '#52c41a'],
          ['Rejected', stats.rejected || 0,   '#f5222d'],
        ].map(([t, v, c]) => (
          <Col span={6} key={t}><Card size="small" style={{ borderLeft: `4px solid ${c}` }}>
            <Statistic title={t} value={v} valueStyle={{ color: c }} />
          </Card></Col>
        ))}
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex gap-3 flex-wrap">
          <Input placeholder="Search PR no., dept, requested by…" prefix={<SearchOutlined />}
            value={search} onChange={e => setSearch(e.target.value)} className="max-w-xs" />
          <Select placeholder="Status" allowClear value={statusFilter} onChange={setStatusFilter} className="w-40"
            options={Object.keys(STATUS_COLORS).map(s => ({ value: s, label: s.replace(/_/g,' ') }))} />
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <Table
          columns={columns} dataSource={prs} rowKey="_id"
          loading={loading} size="small"
          pagination={{ ...pagination, onChange: load }}
          rowClassName={r => r.priority === 'urgent' ? 'bg-red-50' : r.priority === 'high' ? 'bg-orange-50' : ''}
          locale={{ emptyText: 'No purchase requisitions.' }}
        />
      </div>

      {/* Create Modal */}
      <Modal
        title="New Purchase Requisition"
        open={showCreate}
        onCancel={() => setShowCreate(false)}
        onOk={handleCreate}
        okText="Submit PR"
        confirmLoading={createLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' } }}
        width={680}
        destroyOnHidden
      >
        <Divider />
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Department</label>
            <Input value={form.department} onChange={e => setF('department', e.target.value)} placeholder="Warehouse / Admin…" />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Warehouse</label>
            <Select value={form.warehouse} onChange={v => setF('warehouse', v)} className="w-full"
              allowClear options={warehouses.map(w => ({ value: w._id, label: w.name }))} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Required By Date</label>
            <Input type="date" value={form.requiredByDate} onChange={e => setF('requiredByDate', e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Priority</label>
            <Select value={form.priority} onChange={v => setF('priority', v)} className="w-full"
              options={['low','normal','high','urgent'].map(p => ({ value: p, label: p.toUpperCase() }))} />
          </div>
        </div>

        {/* Items table */}
        <div className="font-semibold text-sm text-gray-700 mb-2">Products Required</div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {form.items.map((item, idx) => (
            <div key={idx} className="bg-gray-50 p-2 rounded border border-gray-200 grid grid-cols-12 gap-2 items-start">
              {/* Product search */}
              <div className="col-span-5 relative">
                <Input
                  size="small"
                  placeholder="Search product…"
                  value={prodSearches[idx] ?? item.productName}
                  onChange={e => { searchProduct(idx, e.target.value); updateItem(idx, 'product', ''); }}
                />
                {prodResults[idx]?.length > 0 && !item.product && (
                  <div className="absolute z-50 bg-white border border-gray-200 rounded shadow w-full max-h-32 overflow-y-auto">
                    {prodResults[idx].map(p => (
                      <div key={p._id} className="px-2 py-1.5 hover:bg-gray-50 cursor-pointer text-xs"
                        onClick={() => selectProduct(idx, p)}>
                        <span className="font-medium">{p.itemName}</span>
                        <span className="text-gray-400 ml-1">{p.productCode}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="col-span-2">
                <InputNumber
                  size="small" min={1} value={item.requiredQty}
                  onChange={v => updateItem(idx, 'requiredQty', v || 1)}
                  placeholder="Qty" className="w-full"
                />
              </div>
              <div className="col-span-2">
                <InputNumber
                  size="small" min={0} value={item.currentStock}
                  onChange={v => updateItem(idx, 'currentStock', v || 0)}
                  placeholder="Stock" className="w-full"
                />
              </div>
              <div className="col-span-2">
                <Input size="small" value={item.remarks}
                  onChange={e => updateItem(idx, 'remarks', e.target.value)}
                  placeholder="Note" />
              </div>
              <div className="col-span-1 flex justify-center">
                {form.items.length > 1 && (
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex gap-2 text-xs text-gray-400 mt-1 mb-3">
          <span>Product · Req Qty · Current Stock · Note</span>
        </div>
        <Button size="small" onClick={addItem} icon={<PlusOutlined />}>Add Product</Button>

        <Divider className="my-3" />
        <div>
          <label className="text-xs text-gray-500 block mb-1">Remarks</label>
          <Input.TextArea rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} />
        </div>
      </Modal>

      {/* Approve / Reject Modal */}
      <Modal
        title={`${actionModal?.type === 'approve' ? 'Approve' : 'Reject'} PR — ${actionModal?.pr?.prNumber}`}
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={handleAction}
        okText={actionModal?.type === 'approve' ? 'Approve' : 'Reject'}
        confirmLoading={actionLoading}
        okButtonProps={{ style: { background: actionModal?.type === 'approve' ? '#52c41a' : '#dc2626', borderColor: 'transparent' } }}
        destroyOnHidden>
        <Divider />
        <div className="space-y-3">
          {actionModal?.pr && (
            <div className="bg-gray-50 rounded p-3 text-sm">
              <div className="font-semibold">{actionModal.pr.prNumber} — {actionModal.pr.requestedByName}</div>
              <div className="text-gray-500">{actionModal.pr.items?.length} item(s) · Priority: {actionModal.pr.priority}</div>
            </div>
          )}
          <div>
            <label className="text-xs text-gray-500 block mb-1">Notes</label>
            <Input.TextArea rows={2} value={actionNote} onChange={e => setActionNote(e.target.value)} />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        title={<span className="font-bold">{viewPR?.prNumber}</span>}
        open={!!viewPR}
        onCancel={() => setViewPR(null)}
        footer={[<Button key="c" onClick={() => setViewPR(null)}>Close</Button>]}
        width={600}
      >
        {viewPR && (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Requested By', viewPR.requestedByName],
                ['Department', viewPR.department || '—'],
                ['Warehouse', viewPR.warehouseName || '—'],
                ['Priority', <Tag color={PRIORITY_COLORS[viewPR.priority]} className="capitalize">{viewPR.priority}</Tag>],
                ['Status', <Tag color={STATUS_COLORS[viewPR.status]} className="capitalize">{viewPR.status?.replace(/_/g,' ')}</Tag>],
                ['Required By', viewPR.requiredByDate ? new Date(viewPR.requiredByDate).toLocaleDateString('en-IN') : '—'],
              ].map(([k, v]) => (
                <div key={k}><span className="text-gray-400">{k}: </span><span className="font-medium">{v}</span></div>
              ))}
            </div>
            <Divider className="my-2" />
            <div className="font-semibold text-gray-600 mb-1">Items</div>
            <Table
              size="small"
              dataSource={viewPR.items || []}
              rowKey={(_, i) => i}
              pagination={false}
              columns={[
                { title: 'Product', dataIndex: 'productName', render: (v, r) => <span>{v} <span className="text-gray-400 text-xs">{r.productCode}</span></span> },
                { title: 'Req Qty', dataIndex: 'requiredQty', width: 80 },
                { title: 'In Stock', dataIndex: 'currentStock', width: 80 },
                { title: 'Remarks', dataIndex: 'remarks', render: v => v || '—' },
              ]}
            />
            {viewPR.remarks && <div className="text-gray-500 text-xs mt-2">Note: {viewPR.remarks}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseRequisition;
