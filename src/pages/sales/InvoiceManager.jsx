import { useState, useEffect, useCallback, useRef } from 'react';
import { Table, Button, Input, Select, Tag, Space, message, Modal, Row, Col, Card, Statistic, Tooltip } from 'antd';
import { SearchOutlined, ReloadOutlined, EyeOutlined, PrinterOutlined, FileTextOutlined, SendOutlined, CloseCircleOutlined } from '@ant-design/icons';
import api from '../../config/api.js';
import getImageUrl from '../../utils/imageUrl.js';

const STATUS_COLORS = { draft: 'default', generated: 'blue', sent: 'green', cancelled: 'red' };

const InvoiceManager = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(undefined);
  const [viewInvoice, setViewInvoice] = useState(null);

  const loadStats = () => { api.get('/invoices/stats').then(r => { if (r.success) setStats(r.data); }).catch(() => {}); };
  useEffect(() => { loadStats(); }, []);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/invoices', { params: { page: pagination.current, limit: pagination.pageSize, search, status: statusFilter } });
      if (res.success) { setInvoices(res.data); setPagination(p => ({ ...p, total: res.pagination?.totalItems || 0 })); }
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  }, [pagination.current, pagination.pageSize, search, statusFilter]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  const columns = [
    { title: 'Invoice #', dataIndex: 'invoiceNumber', width: 130, render: v => <span className="text-xs font-mono text-blue-600 font-medium">{v}</span> },
    { title: 'Date', dataIndex: 'invoiceDate', width: 95, render: v => <span className="text-xs">{new Date(v).toLocaleDateString('en-IN')}</span> },
    { title: 'SO #', dataIndex: 'orderNumber', width: 110, render: v => <span className="text-xs font-mono">{v || '—'}</span> },
    { title: 'Buyer', key: 'buyer', width: 180, render: (_, r) => (
      <div><div className="text-sm font-medium truncate max-w-[170px]">{r.buyerName}</div>
        <div className="text-xs text-gray-400">{r.buyerCode} · {r.buyerGstin || 'No GSTIN'}</div></div>
    )},
    { title: 'Items', key: 'items', width: 50, render: (_, r) => <span className="text-xs">{r.items?.length || 0}</span> },
    { title: 'Total', dataIndex: 'grandTotal', width: 110, render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
    { title: 'Status', dataIndex: 'status', width: 90, render: s => <Tag color={STATUS_COLORS[s]}>{s}</Tag> },
    { title: 'Actions', width: 100, render: (_, r) => (
      <Space size="small">
        <Tooltip title="View / Print"><Button type="text" size="small" icon={<EyeOutlined />} className="text-blue-600" onClick={() => setViewInvoice(r._id)} /></Tooltip>
        {r.status === 'generated' && <Tooltip title="Mark Sent"><Button type="text" size="small" icon={<SendOutlined />} className="text-green-600"
          onClick={async () => { const res = await api.patch(`/invoices/${r._id}/status`, { status: 'sent' }); if (res.success) { message.success('Marked sent.'); fetchInvoices(); } }} /></Tooltip>}
      </Space>
    )},
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Invoices</h1>
          <p className="text-sm text-gray-500 mt-0.5">GST Tax Invoices generated from Sales Orders</p>
        </div>
      </div>

      <Row gutter={12} className="mb-4">
        <Col span={4}><Card size="small"><Statistic title="Total" value={stats.total || 0} prefix={<FileTextOutlined />} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Generated" value={stats.generated || 0} valueStyle={{ color: '#1890ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Sent" value={stats.sent || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Cancelled" value={stats.cancelled || 0} valueStyle={{ color: '#f5222d' }} /></Card></Col>
        <Col span={8}><Card size="small"><Statistic title="Total Value" value={`₹${Math.round(stats.totalValue || 0).toLocaleString()}`} /></Card></Col>
      </Row>

      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search invoice #, buyer, SO #..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({ ...p, current: 1 })); }} className="w-64" allowClear />
          <Select placeholder="Status" value={statusFilter} onChange={v => setStatusFilter(v)} allowClear className="w-32"
            options={[{ value: 'generated', label: 'Generated' }, { value: 'sent', label: 'Sent' }, { value: 'cancelled', label: 'Cancelled' }]} />
          <Button icon={<ReloadOutlined />} onClick={() => { setSearch(''); setStatusFilter(undefined); }}>Reset</Button>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={invoices} rowKey="_id" loading={loading} size="middle"
          pagination={{ ...pagination, showSizeChanger: true, showTotal: (t, r) => `${r[0]}-${r[1]} of ${t}` }}
          onChange={pag => setPagination(p => ({ ...p, current: pag.current, pageSize: pag.pageSize }))} />
      </div>

      {viewInvoice && <InvoicePrintModal invoiceId={viewInvoice} onClose={() => setViewInvoice(null)} />}
    </div>
  );
};

// ═══════════════════════════════════════════════
// INVOICE PRINT MODAL
// ═══════════════════════════════════════════════
const InvoicePrintModal = ({ invoiceId, onClose }) => {
  const [inv, setInv] = useState(null);
  const [loading, setLoading] = useState(true);
  const printRef = useRef(null);

  useEffect(() => {
    api.get(`/invoices/${invoiceId}`).then(r => { if (r.success) setInv(r.data); })
      .catch(err => message.error(err.message)).finally(() => setLoading(false));
  }, [invoiceId]);

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Invoice ${inv.invoiceNumber}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',Arial,sans-serif; padding:20px; color:#333; font-size:11px; }
      .inv-header { display:flex; justify-content:space-between; border-bottom:3px solid #1890ff; padding-bottom:12px; margin-bottom:14px; }
      .company { font-size:18px; font-weight:bold; color:#1890ff; }
      .company-sub { font-size:9px; color:#888; margin-top:2px; }
      .inv-title { font-size:16px; font-weight:bold; text-align:right; text-transform:uppercase; }
      .inv-meta { text-align:right; font-size:9px; color:#666; margin-top:4px; }
      .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
      .info-box { padding:8px; border:1px solid #eee; border-radius:4px; }
      .info-box .lbl { font-size:8px; color:#888; text-transform:uppercase; font-weight:600; }
      .info-box .val { font-size:11px; font-weight:600; margin-top:1px; }
      .info-box .sub { font-size:9px; color:#666; }
      table { width:100%; border-collapse:collapse; margin:10px 0; }
      th { background:#f5f5f5; padding:6px 8px; text-align:left; font-size:9px; text-transform:uppercase; color:#666; border-bottom:2px solid #ddd; }
      td { padding:6px 8px; border-bottom:1px solid #f0f0f0; font-size:10px; vertical-align:middle; }
      .prod-cell { display:flex; align-items:center; gap:6px; }
      .prod-img { width:22px; height:22px; border-radius:2px; object-fit:cover; }
      .totals { margin-left:auto; width:280px; margin-top:10px; }
      .totals .row { display:flex; justify-content:space-between; padding:3px 0; font-size:11px; }
      .totals .grand { font-size:13px; font-weight:bold; color:#1890ff; border-top:2px solid #1890ff; padding-top:6px; margin-top:4px; }
      .words { margin-top:8px; font-size:10px; font-style:italic; color:#555; padding:6px; background:#f9f9f9; border-radius:3px; }
      .terms { margin-top:14px; font-size:9px; color:#888; padding:8px; background:#f9f9f9; border-radius:3px; }
      .footer { margin-top:30px; display:flex; justify-content:space-between; border-top:1px solid #eee; padding-top:12px; }
      .sign { border-top:1px solid #555; width:130px; margin-top:35px; padding-top:3px; font-size:9px; color:#777; text-align:center; }
      @media print { body { padding:12px; } }
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading || !inv) return <Modal open onCancel={onClose} footer={null} title="Loading..."><div className="py-8 text-center text-gray-400">Loading invoice...</div></Modal>;

  return (
    <Modal open onCancel={onClose} width={900} title={
      <div className="flex items-center gap-3"><span className="font-bold">{inv.invoiceNumber}</span><Tag color={STATUS_COLORS[inv.status]}>{inv.status}</Tag></div>
    } footer={<Space><Button icon={<PrinterOutlined />} onClick={handlePrint}>Print / PDF</Button><Button onClick={onClose}>Close</Button></Space>}>

      {/* On-screen preview */}
      <div className="text-xs space-y-3 mt-2">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-gray-50 p-3 rounded border">
            <div className="text-[10px] text-gray-400 uppercase font-semibold">Bill To</div>
            <div className="font-bold text-sm mt-1">{inv.buyerName}</div>
            <div className="text-gray-500">{inv.buyerAddress} {inv.buyerCity} {inv.buyerState}</div>
            {inv.buyerGstin && <div className="text-gray-500">GSTIN: {inv.buyerGstin}</div>}
            {inv.buyerPhone && <div className="text-gray-500">Ph: {inv.buyerPhone}</div>}
          </div>
          <div className="bg-blue-50 p-3 rounded border border-blue-100">
            <div className="text-[10px] text-gray-400 uppercase font-semibold">Invoice Details</div>
            <div className="space-y-0.5 mt-1">
              <div className="flex justify-between"><span className="text-gray-500">Invoice #:</span><span className="font-medium">{inv.invoiceNumber}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Date:</span><span>{new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">SO #:</span><span>{inv.orderNumber || '—'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Type:</span><span className="capitalize">{inv.invoiceType?.replace('_', ' ')}</span></div>
            </div>
          </div>
        </div>

        {/* Items */}
        <table className="w-full text-[10px] border border-gray-200 rounded">
          <thead className="bg-blue-50">
            <tr>{['#','Product','HSN','Shade','Qty','Boxes','Sqft','Rate','Disc','Tax','Total'].map(h => <th key={h} className="px-1.5 py-1 text-left font-semibold text-gray-600">{h}</th>)}</tr>
          </thead>
          <tbody>
            {inv.items?.map((item, i) => (
              <tr key={i} className="border-t border-gray-100">
                <td className="px-1.5 py-1 text-gray-400">{i+1}</td>
                <td className="px-1.5 py-1">
                  <div className="flex items-center gap-1">
                    {item.productImage && <img src={getImageUrl(item.productImage)} alt="" className="w-5 h-5 rounded object-cover border border-gray-100" />}
                    <div><div className="font-medium">{item.productName}</div><div className="text-[8px] text-gray-400">{item.productCode}</div></div>
                  </div>
                </td>
                <td className="px-1.5 py-1">{item.hsnCode || '—'}</td>
                <td className="px-1.5 py-1">{item.shade || '—'}</td>
                <td className="px-1.5 py-1">{item.quantity} {item.unit}</td>
                <td className="px-1.5 py-1">{item.boxes || item.quantity}</td>
                <td className="px-1.5 py-1">{item.sqft ? item.sqft.toFixed(1) : '—'}</td>
                <td className="px-1.5 py-1">₹{item.rate}</td>
                <td className="px-1.5 py-1">{item.discountAmount > 0 ? `₹${item.discountAmount}` : '—'}</td>
                <td className="px-1.5 py-1">{item.gstPercentage}%<br/><span className="text-[8px] text-gray-400">{inv?.isInterState ? `IGST ₹${item.igst}` : `C₹${item.cgst} S₹${item.sgst}`}</span></td>
                <td className="px-1.5 py-1 font-medium">₹{item.totalAmount?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-72 bg-blue-50 border border-blue-100 rounded-lg p-3 space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">Taxable Amount</span><span>₹{inv.taxableTotal?.toLocaleString()}</span></div>
            {inv.totalDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{inv.totalDiscount?.toLocaleString()}</span></div>}
            {inv.isInterState ? (
              <div className="flex justify-between"><span className="text-gray-500">IGST ({inv.gstType === 'output' ? 'Output' : 'Input'})</span><span>₹{inv.totalIgst?.toFixed(2)}</span></div>
            ) : (
              <>
                <div className="flex justify-between"><span className="text-gray-500">CGST ({inv.gstType === 'output' ? 'Output' : 'Input'})</span><span>₹{inv.totalCgst?.toFixed(2)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">SGST ({inv.gstType === 'output' ? 'Output' : 'Input'})</span><span>₹{inv.totalSgst?.toFixed(2)}</span></div>
              </>
            )}
            {inv.freightCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Freight</span><span>₹{inv.freightCharges}</span></div>}
            {inv.loadingCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Loading</span><span>₹{inv.loadingCharges}</span></div>}
            {inv.otherCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Other</span><span>₹{inv.otherCharges}</span></div>}
            {inv.roundOff !== 0 && <div className="flex justify-between"><span className="text-gray-500">Round Off</span><span>₹{inv.roundOff?.toFixed(2)}</span></div>}
            <div className="flex justify-between font-bold text-sm text-blue-700 border-t border-blue-200 pt-1 mt-1">
              <span>Grand Total</span><span>₹{inv.grandTotal?.toLocaleString()}</span>
            </div>
          </div>
        </div>
        {inv.amountInWords && <div className="text-[10px] italic text-gray-500 bg-gray-50 p-2 rounded">{inv.amountInWords}</div>}
      </div>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="inv-header">
            <div><div className="company">BDM TILES</div><div className="company-sub">BDM GRANIMARMO PRIVATE LIMITED · Tiles &amp; Building Materials</div></div>
            <div><div className="inv-title">Tax Invoice</div><div className="inv-meta"><div><strong>{inv.invoiceNumber}</strong></div><div>Date: {new Date(inv.invoiceDate).toLocaleDateString('en-IN')}</div><div>SO: {inv.orderNumber || '—'}</div></div></div>
          </div>
          <div className="info-grid">
            <div className="info-box"><div className="lbl">Bill To</div><div className="val">{inv.buyerName}</div><div className="sub">{inv.buyerAddress} {inv.buyerCity} {inv.buyerState}</div>{inv.buyerGstin && <div className="sub">GSTIN: {inv.buyerGstin}</div>}{inv.buyerPhone && <div className="sub">Ph: {inv.buyerPhone}</div>}</div>
            <div className="info-box"><div className="lbl">Ship To</div><div className="val">{inv.deliveryAddress || inv.buyerAddress || 'Same as billing'}</div></div>
          </div>
          <table>
            <thead><tr><th>#</th><th>Product</th><th>HSN</th><th>Qty</th><th>Boxes</th><th>Sqft</th><th>Rate</th><th>Disc</th><th>Taxable</th><th>GST</th><th style={{textAlign:'right'}}>Total</th></tr></thead>
            <tbody>{inv.items?.map((item, i) => (
              <tr key={i}>
                <td>{i+1}</td>
                <td><div className="prod-cell">{item.productImage && <img className="prod-img" src={getImageUrl(item.productImage)} />}<div><strong>{item.productName}</strong>{item.shade ? ` (${item.shade})` : ''}<br/><span style={{fontSize:'8px',color:'#999'}}>{item.productCode}</span></div></div></td>
                <td>{item.hsnCode || '—'}</td>
                <td>{item.quantity} {item.unit}</td>
                <td>{item.boxes || item.quantity}</td>
                <td>{item.sqft ? item.sqft.toFixed(1) : '—'}</td>
                <td>₹{item.rate}</td>
                <td>{item.discountAmount > 0 ? `₹${item.discountAmount}` : '—'}</td>
                <td>₹{item.taxableAmount?.toLocaleString()}</td>
                <td>{item.gstPercentage}%</td>
                <td style={{textAlign:'right'}}><strong>₹{item.totalAmount?.toLocaleString()}</strong></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="totals">
            <div className="row"><span>Taxable Amount</span><span>₹{inv.taxableTotal?.toLocaleString()}</span></div>
            {inv.totalDiscount > 0 && <div className="row"><span>Total Discount</span><span>-₹{inv.totalDiscount?.toLocaleString()}</span></div>}
            {inv.isInterState ? (
              <div className="row"><span>IGST ({inv.gstType === 'output' ? 'Output' : 'Input'})</span><span>₹{inv.totalIgst?.toFixed(2)}</span></div>
            ) : (
              <>
                <div className="row"><span>CGST ({inv.gstType === 'output' ? 'Output' : 'Input'})</span><span>₹{inv.totalCgst?.toFixed(2)}</span></div>
                <div className="row"><span>SGST ({inv.gstType === 'output' ? 'Output' : 'Input'})</span><span>₹{inv.totalSgst?.toFixed(2)}</span></div>
              </>
            )}
            {inv.freightCharges > 0 && <div className="row"><span>Freight</span><span>₹{inv.freightCharges}</span></div>}
            {inv.loadingCharges > 0 && <div className="row"><span>Loading</span><span>₹{inv.loadingCharges}</span></div>}
            {inv.roundOff !== 0 && <div className="row"><span>Round Off</span><span>₹{inv.roundOff?.toFixed(2)}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>₹{inv.grandTotal?.toLocaleString()}</span></div>
          </div>
          {inv.amountInWords && <div className="words"><strong>Amount in Words:</strong> {inv.amountInWords}</div>}
          {inv.termsAndConditions && <div className="terms"><strong>Terms &amp; Conditions:</strong> {inv.termsAndConditions}</div>}
          <div className="footer">
            <div className="sign">Receiver's Signature</div>
            <div className="sign">For BDM TILES<br/>Authorized Signatory</div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default InvoiceManager;
