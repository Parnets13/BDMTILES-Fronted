import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Table, Button, Input, Select, Tag, Space, message,
  Row, Col, Card, Statistic, Modal, Divider, InputNumber, Alert, Spin, Popconfirm
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined,
  CheckOutlined, CloseOutlined, EyeOutlined, DeleteOutlined, ShoppingOutlined, EditOutlined
} from '@ant-design/icons';
import purchaseService from '../../services/purchaseService.js';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import getImageUrl from '../../utils/imageUrl.js';

const STATUS_COLORS = {
  draft: 'default', submitted: 'blue', approved: 'green',
  rejected: 'red', po_created: 'geekblue',
};
const PRIORITY_COLORS = { low: 'default', normal: 'blue', high: 'orange', urgent: 'red' };

/**
 * ProductSearchCell — self-contained product search for a single PR row.
 *
 * Mirrors the proven Jain Impex `ProductSearchDropdown` pattern:
 *   - useRef-based 350 ms debounce (debounceRef) — clearTimeout before each new schedule
 *   - Refs for query / page / loading / hasMore — stale-closure-safe inside async callbacks
 *   - Dropdown rendered via React portal → escapes all overflow:hidden parents (modal, table)
 *   - Outside-click closes dropdown via document mousedown listener
 *   - Infinite scroll: load next page when user scrolls within 80px of the bottom
 */
const PAGE_SIZE = 20;

const ProductSearchCell = ({ item, excludeIds, onSelect, onClear }) => {
  const [query, setQuery]     = useState(item.productName || '');
  const [results, setResults] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [dropRect, setDropRect] = useState(null);

  // Refs — never trigger re-renders, always hold latest value inside async code
  const debounceRef  = useRef(null);
  const queryRef     = useRef(item.productName || '');
  const pageRef      = useRef(1);
  const loadingRef   = useRef(false);
  const hasMoreRef   = useRef(false);
  const anchorRef    = useRef(null);

  // Keep query in sync if the row is reset from the outside (e.g. form reset)
  useEffect(() => { setQuery(item.productName || ''); queryRef.current = item.productName || ''; }, [item.productName]);

  // Position the portal whenever the anchor moves
  const updateRect = useCallback(() => {
    if (!anchorRef.current) return;
    const r = anchorRef.current.getBoundingClientRect();
    setDropRect({ top: r.bottom + window.scrollY + 2, left: r.left + window.scrollX, width: Math.max(r.width, 380) });
  }, []);

  // Core fetch — append=true for infinite scroll pages
  const doSearch = useCallback(async (q, pg, append = false) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setSearching(true);
    try {
      const res = await productService.getProducts({ search: q || '', page: pg, limit: PAGE_SIZE, status: 'active' });
      if (!res.success) return;
      const items = res.data || [];
      setResults(prev => append ? [...prev, ...items] : items);
      const more = items.length === PAGE_SIZE;
      setHasMore(more);
      hasMoreRef.current = more;
      pageRef.current = pg;
    } catch { /* silent */ }
    finally { setSearching(false); loadingRef.current = false; }
  }, []);

  // Input change — debounced 350 ms, same as Jain Impex reference
  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    queryRef.current = q;
    setOpen(true);
    updateRect();
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pageRef.current = 1;
      doSearch(q, 1, false);
    }, 350);
  };

  // Focus — open immediately; fetch if list is empty
  const handleFocus = () => {
    setOpen(true);
    updateRect();
    if (results.length === 0) {
      pageRef.current = 1;
      doSearch(queryRef.current, 1, false);
    }
  };

  // Infinite scroll — load next page when near bottom
  const handleScroll = (e) => {
    const el = e.target;
    if (loadingRef.current || !hasMoreRef.current) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 80) {
      doSearch(queryRef.current, pageRef.current + 1, true);
    }
  };

  // Select a product
  const handleSelect = (prod) => {
    setQuery(prod.itemName);
    queryRef.current = prod.itemName;
    setOpen(false);
    setResults([]);
    onSelect(prod);
  };

  // Clear selection
  const handleClear = () => {
    setQuery('');
    queryRef.current = '';
    setResults([]);
    setOpen(false);
    onClear();
  };

  // Close on outside click — must exclude both the search cell AND the portal dropdown
  useEffect(() => {
    const handler = (e) => {
      if (
        e.target.closest('.pr-product-search-cell') ||
        e.target.closest('.pr-product-dropdown-portal')
      ) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Re-measure position on scroll / resize while open
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', updateRect, true);
    window.addEventListener('resize', updateRect);
    return () => { window.removeEventListener('scroll', updateRect, true); window.removeEventListener('resize', updateRect); };
  }, [open, updateRect]);

  // Dropdown portal
  const dropdown = open && dropRect && createPortal(
    <div
      style={{ position: 'absolute', top: dropRect.top, left: dropRect.left, width: dropRect.width, maxHeight: 280, zIndex: 9999 }}
      className="pr-product-dropdown-portal bg-white border border-gray-200 rounded-lg shadow-2xl overflow-y-auto"
      onScroll={handleScroll}
    >
      {!results.length && !searching && (
        <div className="px-4 py-3 text-gray-400 text-center text-sm">
          {query ? 'No products found' : 'Type to search products'}
        </div>
      )}
      {searching && !results.length && (
        <div className="px-4 py-4 text-center"><Spin size="small" /></div>
      )}
      {results.filter(p => !excludeIds.includes(p._id)).map(p => (
        <div key={p._id}
          className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50"
          onClick={() => handleSelect(p)}
        >
          <div className="flex justify-between items-center gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {p.images?.[0] && (
                <img src={getImageUrl(p.images[0])} alt=""
                  className="w-9 h-9 rounded object-cover shrink-0 border border-gray-100" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate text-gray-800">{p.itemName}</div>
                <div className="text-[10px] text-gray-400">
                  {p.productCode}{p.brand?.name ? ` · ${p.brand.name}` : ''}{p.tileSize ? ` · ${p.tileSize}` : ''}
                </div>
                {p.sqftPerBox ? (
                  <div className="text-[10px] text-green-600 font-medium">{p.sqftPerBox} sqft/box</div>
                ) : null}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-xs font-bold text-[#FF5F03]">
                ₹{(p.dealerRate || p.mrp || 0).toLocaleString('en-IN')}
              </div>
              <div className={`text-[10px] font-medium ${(p.stockAvailable || 0) > 0 ? 'text-green-600' : 'text-red-500'}`}>
                Stock: {p.stockAvailable ?? 0}
              </div>
            </div>
          </div>
        </div>
      ))}
      {hasMore && (
        <div className="px-4 py-2 text-center text-xs text-gray-400">
          {searching ? 'Loading more…' : 'Scroll for more'}
        </div>
      )}
    </div>,
    document.body,
  );

  return (
    <div className="pr-product-search-cell">
      {item.product ? (
        /* Selected chip */
        <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2 min-h-[40px]">
          {item.productImage && (
            <img src={getImageUrl(item.productImage)} alt=""
              className="w-9 h-9 rounded object-cover shrink-0 border border-gray-100" />
          )}
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate text-gray-800">{item.productName}</div>
            <div className="text-xs text-gray-400">{item.productCode}</div>
          </div>
          <button className="text-gray-300 hover:text-red-500 shrink-0 px-1 text-base" onClick={handleClear}>✕</button>
        </div>
      ) : (
        /* Search input */
        <div ref={anchorRef}>
          <Input
            placeholder="Type to search product…"
            value={query}
            onChange={handleChange}
            onFocus={handleFocus}
            suffix={searching ? <Spin size="small" /> : <SearchOutlined className="text-gray-300" />}
          />
        </div>
      )}
      {dropdown}
    </div>
  );
};

const emptyForm = () => ({
  requiredByDate: '', department: '', warehouse: '', priority: 'normal',
  remarks: '',
  items: [{ productName: '', productCode: '', product: '', requiredQty: 1, currentStock: 0, purchaseRate: 0, unit: '', remarks: '' }],
});

const PurchaseRequisition = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = useAuth();
  const canManage = hasPermission('po.management');
  const canApprove = hasPermission('po.approve');
  const [prs, setPRs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [createLoading, setCreateLoading] = useState(false);
  const [editId, setEditId] = useState(null);
  const [viewPR, setViewPR] = useState(null);
  const [actionModal, setActionModal] = useState(null);
  const [actionNote, setActionNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const [warehouses, setWarehouses] = useState([]);

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const [listRes, statsRes] = await Promise.all([
        purchaseService.getPurchaseRequisitions({ page, limit: 20, search, status: statusFilter }),
        purchaseService.getPurchaseRequisitionStats(),
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

  const updateItem = (idx, field, value) => {
    setForm(f => {
      const items = [...f.items];
      items[idx] = { ...items[idx], [field]: value };
      return { ...f, items };
    });
  };

  const addItem = () => setForm(f => ({
    ...f,
    items: [...f.items, { productName: '', productCode: '', product: '', requiredQty: 1, currentStock: 0, purchaseRate: 0, unit: '', remarks: '' }],
  }));

  const removeItem = (idx) => setForm(f => ({
    ...f,
    items: f.items.filter((_, i) => i !== idx),
  }));

  const openEdit = async (pr) => {
    try {
      const res = await purchaseService.getPurchaseRequisition(pr._id);
      const data = res.data || pr;
      setEditId(data._id);
      setForm({
        requiredByDate: data.requiredByDate ? new Date(data.requiredByDate).toISOString().slice(0, 10) : '',
        department: data.department || '',
        warehouse: data.warehouse?._id || data.warehouse || '',
        priority: data.priority || 'normal',
        remarks: data.remarks || '',
        items: (data.items || []).map(item => ({
          product: item.product?._id || item.product,
          productName: item.productName || '',
          productCode: item.productCode || '',
          productImage: item.productImage || '',
          requiredQty: item.requiredQty || 1,
          currentStock: item.currentStock || 0,
          purchaseRate: item.purchaseRate || 0,
          unit: item.unit || '',
          remarks: item.remarks || '',
        })),
      });
      setViewPR(null);
      setShowCreate(true);
    } catch (err) { message.error(err.message || 'Unable to open purchase requisition for editing'); }
  };

  const closeCreate = () => { setShowCreate(false); setEditId(null); setForm(emptyForm()); };

  const handleCreate = async () => {
    if (!form.items.length || form.items.some(item => !item.product || Number(item.requiredQty) <= 0)) {
      message.error('Select a valid product and positive quantity for every row');
      return;
    }
    setCreateLoading(true);
    try {
      const payload = {
        ...form,
        requiredByDate: form.requiredByDate || undefined,
        warehouse: form.warehouse || undefined,
        items: form.items.map(({ product, requiredQty, currentStock, unit, remarks }) => ({
          product, requiredQty, currentStock, unit, remarks,
        })),
      };
      const res = editId
        ? await purchaseService.updatePurchaseRequisition(editId, payload)
        : await purchaseService.createPurchaseRequisition(payload);
      if (res.success) {
        message.success(editId ? `${res.data.prNumber} updated` : `${res.data.prNumber} saved as draft`);
        setShowCreate(false);
        setEditId(null);
        setViewPR(res.data);
        setForm(emptyForm());
        load(editId ? pagination.current : 1);
      }
    } catch (err) { message.error(err.message || `Failed to ${editId ? 'update' : 'create'} purchase requisition`); }
    finally { setCreateLoading(false); }
  };

  const deletePR = async (pr) => {
    try {
      const res = await purchaseService.deletePurchaseRequisition(pr._id);
      if (res.success) {
        message.success(`${pr.prNumber} deleted`);
        if (viewPR?._id === pr._id) setViewPR(null);
        load(pagination.current);
      }
    } catch (err) { message.error(err.message || 'Failed to delete purchase requisition'); }
  };

  const handleSubmit = async (pr) => {
    try {
      const res = await purchaseService.submitPurchaseRequisition(pr._id);
      if (res.success) {
        message.success('PR submitted for approval');
        load(pagination.current);
      }
    } catch (err) { message.error(err.message || 'Failed to submit PR'); }
  };

  const handleAction = async () => {
    setActionLoading(true);
    try {
      const res = actionModal.type === 'approve'
        ? await purchaseService.approvePurchaseRequisition(actionModal.pr._id, { notes: actionNote })
        : await purchaseService.rejectPurchaseRequisition(actionModal.pr._id, { notes: actionNote });
      if (res.success) {
        message.success(actionModal.type === 'approve' ? 'PR Approved' : 'PR Rejected');
        setActionModal(null);
        load(pagination.current);
      }
    } catch (err) { message.error(err.message || 'PR action failed'); }
    finally { setActionLoading(false); }
  };

  const openQuotation = async (pr) => {
    try {
      const res = await purchaseService.getSupplierQuotations({ purchaseRequisition: pr._id, limit: 1 });
      const existing = res.data?.[0];
      navigate(existing
        ? `/sales-purchase/supplier-quotations?id=${existing._id}`
        : `/sales-purchase/supplier-quotations?purchaseRequisition=${pr._id}&create=1`);
    } catch (err) { message.error(err.message || 'Unable to open supplier quotation'); }
  };

  const openPO = (pr) => {
    const linkedPO = pr.linkedPO?._id || pr.linkedPO;
    navigate(linkedPO ? `/sales-purchase/po-management?po=${linkedPO}` : '/sales-purchase/po-management');
  };

  const handleView = async (pr) => {
    try {
      const res = await purchaseService.getPurchaseRequisition(pr._id);
      setViewPR(res.data || pr);
    } catch (err) {
      message.error(err.message || 'Unable to load purchase requisition');
    }
  };

  useEffect(() => {
    const id = new URLSearchParams(location.search).get('pr') || location.state?.openPurchaseRequisitionId;
    if (!id) return;
    purchaseService.getPurchaseRequisition(id).then(res => {
      if (res.success) setViewPR(res.data);
    }).catch(err => message.error(err.message || 'Unable to open the created purchase requisition'));
  }, [location.search, location.state]);

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
      width: 310,
      render: (_, r) => (
        <Space size="small" wrap>
          {canManage && r.status === 'draft' && (
            <>
              <Button size="small" type="primary" onClick={() => handleSubmit(r)}>Submit</Button>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(r)}>Edit</Button>
              <Popconfirm title="Delete this draft PR?" okText="Delete" okButtonProps={{ danger: true }} onConfirm={() => deletePR(r)}>
                <Button size="small" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
          {canApprove && r.status === 'submitted' && (
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
          {canManage && r.status === 'approved' && (
            <Button size="small" type="primary" onClick={() => openQuotation(r)}>Supplier Quotation</Button>
          )}
          {r.status === 'po_created' && (
            <Button size="small" type="link" onClick={() => openPO(r)}>Open PO</Button>
          )}
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleView(r)}>View</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <ShoppingOutlined className="text-blue-500 text-xl" />
            Purchase Requisition
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Internal purchase requests — raise, approve and convert to PO
          </p>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => load(1)} loading={loading} />
          {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditId(null); setForm(emptyForm()); setShowCreate(true); }}
            style={{ background: '#FF5F03', borderColor: '#FF5F03' }}>
            New Requisition
          </Button>}
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
        title={
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-[#FF5F03] font-bold border border-orange-100 shadow-2xs">
              <ShoppingOutlined className="text-lg" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 m-0">{editId ? 'Edit Purchase Requisition' : 'New Purchase Requisition'}</h2>
              <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">Raise an internal stock requirement for warehouse or department</p>
            </div>
          </div>
        }
        open={showCreate}
        onCancel={closeCreate}
        onOk={handleCreate}
        okText={editId ? 'Save Changes' : 'Save Draft'}
        confirmLoading={createLoading}
        okButtonProps={{ style: { background: '#FF5F03', borderColor: '#FF5F03' }, size: 'large', className: 'rounded-xl px-6' }}
        cancelButtonProps={{ size: 'large', className: 'rounded-xl px-5' }}
        width="min(1440px, calc(100vw - 32px))"
        style={{ top: 12 }}
        destroyOnHidden
      >
        <div className="max-h-[calc(100vh-110px)] overflow-y-auto space-y-4 pr-1 py-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Department</label>
              <Input size="large" value={form.department} onChange={e => setF('department', e.target.value)} placeholder="Warehouse / Admin…" className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Warehouse</label>
              <Select size="large" value={form.warehouse} onChange={v => setF('warehouse', v)} className="w-full"
                allowClear options={warehouses.map(w => ({ value: w._id, label: w.name }))} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Required By Date</label>
              <Input size="large" type="date" value={form.requiredByDate} onChange={e => setF('requiredByDate', e.target.value)} className="rounded-lg" />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1.5">Priority</label>
              <Select size="large" value={form.priority} onChange={v => setF('priority', v)} className="w-full"
                options={['low','normal','high','urgent'].map(p => ({ value: p, label: p.toUpperCase() }))} />
            </div>
          </div>

          {/* Items table */}
          <div className="flex justify-between items-center pt-2">
            <div className="text-sm font-bold text-slate-800">Products Required</div>
            <Button icon={<PlusOutlined />} onClick={addItem} className="rounded-lg bg-slate-100 hover:bg-slate-200 border-0">Add Row</Button>
          </div>
          {/* NOTE: no overflow-hidden — portal dropdowns must escape this container */}
          <div className="border border-slate-200 rounded-xl bg-white shadow-2xs">
            <table className="w-full text-sm">
              <thead className="bg-slate-50/90 border-b border-slate-200">
                <tr>
                  {['Product', 'Req Qty', 'Current Stock', 'Purchase Rate', 'Note', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left font-bold text-slate-700 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {form.items.map((item, idx) => {
                  return (
                    <tr key={idx} className="border-t border-slate-100 hover:bg-slate-50/50">
                      {/* ── Product cell ── */}
                      <td className="px-3 py-2.5" style={{ minWidth: 320 }}>
                        <ProductSearchCell
                          item={item}
                          excludeIds={form.items.map(i => i.product).filter(Boolean)}
                          onSelect={prod => {
                            setForm(f => {
                              const items = [...f.items];
                              items[idx] = {
                                ...items[idx],
                                product:      prod._id,
                                productName:  prod.itemName,
                                productCode:  prod.productCode || '',
                                productImage: prod.images?.[0] || '',
                                currentStock: prod.stockAvailable || 0,
                                purchaseRate: Number(prod.purchaseRate || prod.basicPrice || 0),
                                unit:         prod.unit || '',
                              };
                              return { ...f, items };
                            });
                          }}
                          onClear={() => {
                            setForm(f => {
                              const items = [...f.items];
                              items[idx] = { ...items[idx], product: '', productName: '', productCode: '', productImage: '', currentStock: 0, purchaseRate: 0, unit: '' };
                              return { ...f, items };
                            });
                          }}
                        />
                      </td>

                      {/* ── Req Qty ── */}
                      <td className="px-3 py-2.5" style={{ width: 110 }}>
                        <InputNumber
                          min={1} value={item.requiredQty}
                          onChange={v => updateItem(idx, 'requiredQty', v || 1)}
                          className="w-full rounded-lg"
                        />
                      </td>

                      {/* ── Current Stock (auto-filled, read-only) ── */}
                      <td className="px-3 py-2.5" style={{ width: 130 }}>
                        <InputNumber
                          min={0} value={item.currentStock}
                          disabled className="w-full rounded-lg"
                        />
                      </td>

                      {/* ── Purchase Rate (from Product Master, read-only) ── */}
                      <td className="px-3 py-2.5" style={{ width: 140 }}>
                        <InputNumber
                          value={item.purchaseRate}
                          disabled
                          className="w-full rounded-lg"
                          formatter={v => `₹ ${Number(v || 0).toLocaleString('en-IN')}`}
                        />
                        {item.unit ? <div className="text-[10px] text-slate-400 mt-0.5">per {item.unit}</div> : null}
                      </td>

                      {/* ── Note ── */}
                      <td className="px-3 py-2.5" style={{ minWidth: 160 }}>
                        <Input value={item.remarks}
                          onChange={e => updateItem(idx, 'remarks', e.target.value)}
                          placeholder="Optional note" className="rounded-lg" />
                      </td>

                      {/* ── Remove ── */}
                      <td className="px-3 py-2.5" style={{ width: 48 }}>
                        {form.items.length > 1 && (
                          <Button danger type="text" icon={<DeleteOutlined />} onClick={() => removeItem(idx)} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200/80">
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Remarks / Internal Instructions</label>
            <Input.TextArea rows={2} value={form.remarks} onChange={e => setF('remarks', e.target.value)} placeholder="Additional instructions..." className="rounded-lg" />
          </div>
        </div>
      </Modal>

      {/* Approve / Reject Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
            <div className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold border shadow-sm ${
              actionModal?.type === 'approve'
                ? 'bg-green-50 text-green-600 border-green-100'
                : 'bg-red-50 text-red-600 border-red-100'
            }`}>
              {actionModal?.type === 'approve' ? <CheckOutlined className="text-lg" /> : <CloseOutlined className="text-lg" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 m-0">
                {actionModal?.type === 'approve' ? 'Approve' : 'Reject'} Purchase Requisition
              </h2>
              <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">{actionModal?.pr?.prNumber}</p>
            </div>
          </div>
        }
        open={!!actionModal}
        onCancel={() => setActionModal(null)}
        onOk={handleAction}
        okText={actionModal?.type === 'approve' ? 'Approve' : 'Reject'}
        confirmLoading={actionLoading}
        okButtonProps={{
          style: { background: actionModal?.type === 'approve' ? '#52c41a' : '#dc2626', borderColor: 'transparent' },
          size: 'large', className: 'rounded-xl px-6'
        }}
        cancelButtonProps={{ size: 'large', className: 'rounded-xl px-5' }}
        width="min(720px, calc(100vw - 32px))"
        centered
        destroyOnHidden>
        <div className="space-y-4 py-2">
          {actionModal?.pr && (
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-4 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Requested By</span>
                  <span className="font-semibold text-slate-800">{actionModal.pr.requestedByName}</span>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Items</span>
                  <span className="font-semibold text-slate-800">{actionModal.pr.items?.length} item(s)</span>
                </div>
                <div className="h-8 w-px bg-slate-200 hidden sm:block" />
                <div>
                  <span className="text-xs text-slate-400 block mb-0.5">Priority</span>
                  <Tag color={PRIORITY_COLORS[actionModal.pr.priority]} className="capitalize m-0">{actionModal.pr.priority}</Tag>
                </div>
              </div>
            </div>
          )}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">Notes / Remarks</label>
            <Input.TextArea rows={3} value={actionNote} onChange={e => setActionNote(e.target.value)}
              placeholder="Add notes for this approval decision..." className="rounded-lg" />
          </div>
        </div>
      </Modal>

      {/* View Modal */}
      <Modal
        title={
          <div className="flex items-center gap-3 border-b border-slate-100 pb-3 pr-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100 shadow-2xs">
              <ShoppingOutlined className="text-lg" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-slate-900 font-mono">{viewPR?.prNumber}</span>
                {viewPR?.status && (
                  <Tag color={STATUS_COLORS[viewPR.status]} className="px-2.5 py-0.5 text-xs font-semibold capitalize rounded-md border-0 m-0">
                    {viewPR.status?.replace(/_/g, ' ')}
                  </Tag>
                )}
                {viewPR?.priority && (
                  <Tag color={PRIORITY_COLORS[viewPR.priority]} className="px-2 py-0.5 text-xs font-semibold capitalize rounded-md border-0 m-0">
                    {viewPR.priority} Priority
                  </Tag>
                )}
              </div>
              <p className="text-xs text-slate-400 font-normal m-0 mt-0.5">Purchase Requisition Summary & Requested Items</p>
            </div>
          </div>
        }
        open={!!viewPR}
        onCancel={() => setViewPR(null)}
        centered
        footer={[
          canManage && viewPR?.status === 'draft' && <Button key="edit" icon={<EditOutlined />} onClick={() => openEdit(viewPR)} className="rounded-lg">Edit Draft</Button>,
          canManage && viewPR?.status === 'approved' && <Button key="quotation" type="primary" onClick={() => openQuotation(viewPR)} className="rounded-lg bg-blue-600">Supplier Quotation</Button>,
          viewPR?.status === 'po_created' && <Button key="po" type="primary" onClick={() => openPO(viewPR)} className="rounded-lg bg-emerald-600 border-0">Open Linked PO</Button>,
          <Button key="c" onClick={() => setViewPR(null)} className="rounded-lg">Close</Button>,
        ].filter(Boolean)}
        width="min(1280px, calc(100vw - 32px))"
      >
        {viewPR && (
          <div className="max-h-[calc(85vh-120px)] overflow-y-auto space-y-4 pr-1 py-1 text-sm">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-xs text-slate-400 font-medium block mb-0.5">Requested By</span>
                <span className="text-sm font-semibold text-slate-800">{viewPR.requestedByName || '—'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-xs text-slate-400 font-medium block mb-0.5">Department</span>
                <span className="text-sm font-semibold text-slate-800">{viewPR.department || '—'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-xs text-slate-400 font-medium block mb-0.5">Warehouse</span>
                <span className="text-sm font-semibold text-slate-800">{viewPR.warehouseName || '—'}</span>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80">
                <span className="text-xs text-slate-400 font-medium block mb-0.5">Required By Date</span>
                <span className="text-sm font-semibold text-slate-800">{viewPR.requiredByDate ? new Date(viewPR.requiredByDate).toLocaleDateString('en-IN') : '—'}</span>
              </div>
            </div>

            <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-200/80 font-bold text-slate-800">
                Requested Items ({(viewPR.items || []).length})
              </div>
              <Table
                size="small"
                dataSource={viewPR.items || []}
                rowKey={(row) => row._id || row.product || row.productCode}
                pagination={false}
                columns={[
                  { title: 'Product', dataIndex: 'productName', render: (v, r) => <div className="flex items-center gap-2.5"><ProductImage src={r.productImage} size="sm" /><div><span className="font-semibold text-slate-800">{v}</span> <span className="text-slate-400 text-xs font-mono">({r.productCode})</span></div></div> },
                  { title: 'Req Qty', dataIndex: 'requiredQty', width: 90, render: (v, r) => <span className="font-bold text-slate-800">{v}{r.unit ? <span className="text-slate-400 font-normal text-xs"> {r.unit}</span> : null}</span> },
                  { title: 'In Stock', dataIndex: 'currentStock', width: 90, render: v => <span className="font-semibold text-slate-600">{v}</span> },
                  { title: 'Purchase Rate', dataIndex: 'purchaseRate', width: 130, render: v => <span className="font-semibold text-slate-700">₹{Number(v || 0).toLocaleString('en-IN')}</span> },
                  { title: 'Remarks', dataIndex: 'remarks', render: v => v || '—' },
                ]}
              />
            </div>
            {viewPR.remarks && (
              <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 text-xs text-amber-900">
                <b>Internal Note:</b> {viewPR.remarks}
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PurchaseRequisition;
