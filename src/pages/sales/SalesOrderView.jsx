import { useState, useEffect, useRef } from 'react';
import { Descriptions, Table, Tag, Button, Space, message, Modal, Input, Divider, Timeline, Spin } from 'antd';
import { PrinterOutlined, EditOutlined, CloseCircleOutlined, CheckCircleOutlined, CarOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { FileText } from 'lucide-react';
import salesService from '../../services/salesService.js';

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', approved: 'cyan', processing: 'orange',
  partial_dispatch: 'geekblue', dispatched: 'purple', delivered: 'green', cancelled: 'red', expired: 'volcano',
};
const PAYMENT_COLORS = { pending: 'orange', partial: 'blue', paid: 'green', overdue: 'red' };

const SalesOrderView = ({ orderId, onClose, onStatusChange }) => {
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const printRef = useRef(null);

  useEffect(() => {
    if (orderId) fetchOrder();
  }, [orderId]);

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const res = await salesService.getOrder(orderId);
      if (res.success) setOrder(res.data);
      else message.error('Failed to load order');
    } catch (err) { message.error(err.message); }
    finally { setLoading(false); }
  };

  const handleStatusUpdate = async (status, reason) => {
    try {
      const res = await salesService.updateStatus(orderId, { status, cancellationReason: reason });
      if (res.success) {
        message.success(res.message);
        fetchOrder();
        onStatusChange?.();
      }
    } catch (err) { message.error(err.message); }
  };

  const handleCancel = () => {
    if (!cancelReason.trim()) { message.warning('Please provide a cancellation reason'); return; }
    handleStatusUpdate('cancelled', cancelReason);
    setCancelModal(false);
    setCancelReason('');
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    win.document.write(`
      <html><head><title>Invoice - ${order.orderNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #FF5F03; padding-bottom: 15px; margin-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #FF5F03; }
        .company-sub { font-size: 11px; color: #666; margin-top: 4px; }
        .invoice-title { font-size: 18px; font-weight: bold; color: #333; text-align: right; }
        .invoice-meta { text-align: right; font-size: 11px; color: #666; margin-top: 5px; }
        .section { margin-bottom: 15px; }
        .section-title { font-size: 11px; font-weight: bold; color: #888; text-transform: uppercase; margin-bottom: 8px; letter-spacing: 0.5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
        .info-box { padding: 12px; border: 1px solid #eee; border-radius: 6px; }
        .info-box .label { font-size: 10px; color: #888; text-transform: uppercase; }
        .info-box .value { font-size: 13px; font-weight: 600; margin-top: 2px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        th { background: #f8f8f8; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; color: #666; border-bottom: 2px solid #eee; }
        td { padding: 8px 10px; border-bottom: 1px solid #f0f0f0; font-size: 11px; }
        tr:nth-child(even) { background: #fafafa; }
        .text-right { text-align: right; }
        .totals { margin-top: 15px; margin-left: auto; width: 280px; }
        .totals .row { display: flex; justify-content: space-between; padding: 5px 0; font-size: 12px; }
        .totals .row.grand { font-size: 15px; font-weight: bold; color: #FF5F03; border-top: 2px solid #FF5F03; padding-top: 8px; margin-top: 5px; }
        .footer { margin-top: 40px; border-top: 1px solid #eee; padding-top: 15px; display: flex; justify-content: space-between; }
        .footer .sign-box { text-align: center; }
        .footer .sign-line { border-top: 1px solid #333; width: 150px; margin-top: 40px; padding-top: 5px; font-size: 10px; color: #666; }
        .status-badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 10px; font-weight: bold; text-transform: uppercase; }
        @media print { body { padding: 0; } }
      </style></head><body>
      ${printContent.innerHTML}
      </body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading) return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <Spin size="large" tip="Loading order..." />
    </div>
  );

  if (!order) return null;

  const itemColumns = [
    { title: '#', width: 35, render: (_, __, i) => <span className="text-xs text-gray-400">{i + 1}</span> },
    { title: 'Product', key: 'product', render: (_, r) => (
      <div>
        <div className="text-sm font-medium">{r.productName || r.product?.itemName}</div>
        <div className="text-xs text-gray-400">{r.productCode || r.product?.productCode} · {r.product?.tileSize} · {r.product?.finish}</div>
      </div>
    )},
    { title: 'Shade', dataIndex: 'shade', width: 80, render: v => v || '—' },
    { title: 'Batch', dataIndex: 'batch', width: 80, render: v => v || '—' },
    { title: 'Qty', dataIndex: 'quantity', width: 60, render: (v, r) => `${v} ${r.unit || 'Box'}` },
    { title: 'Rate', dataIndex: 'rate', width: 80, render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'Discount', key: 'disc', width: 80, render: (_, r) => r.discount ? `${r.discount}${r.discountType === 'percentage' ? '%' : '/unit'}` : '—' },
    { title: 'GST', key: 'gst', width: 60, render: (_, r) => `${r.gstPercentage || 18}%` },
    { title: 'Taxable', dataIndex: 'taxableAmount', width: 90, className: 'text-right', render: v => `₹${(v || 0).toLocaleString()}` },
    { title: 'GST Amt', dataIndex: 'gstAmount', width: 80, className: 'text-right', render: v => `₹${(v || 0).toFixed(2)}` },
    { title: 'Total', dataIndex: 'totalAmount', width: 100, className: 'text-right', render: v => <span className="font-semibold">₹{(v || 0).toLocaleString()}</span> },
  ];

  const statusFlow = ['draft', 'confirmed', 'processing', 'dispatched', 'delivered'];
  const currentIdx = statusFlow.indexOf(order.status);

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="shrink-0 border-b px-6 py-3 flex justify-between items-center bg-gray-50">
            <div className="flex items-center gap-3">
              <Button icon={<ArrowLeftOutlined />} type="text" onClick={onClose} />
              <div>
                <h2 className="text-xl font-bold text-gray-800">{order.orderNumber}</h2>
                <div className="flex items-center gap-2 mt-0.5">
                  <Tag color={STATUS_COLORS[order.status]}>{order.status?.replace('_', ' ').toUpperCase()}</Tag>
                  <Tag color={PAYMENT_COLORS[order.paymentStatus]}>{order.paymentStatus}</Tag>
                  {order.creditLimitExceeded && <Tag color="red">Credit Exceeded</Tag>}
                </div>
              </div>
            </div>
            <Space>
              {order.status === 'draft' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => handleStatusUpdate('confirmed')}>Confirm</Button>
              )}
              {order.status === 'confirmed' && (
                <Button icon={<CheckCircleOutlined />} onClick={() => handleStatusUpdate('processing')} style={{ borderColor: '#fa8c16', color: '#fa8c16' }}>Start Processing</Button>
              )}
              {order.status === 'processing' && (
                <Button icon={<CarOutlined />} onClick={() => handleStatusUpdate('dispatched')} style={{ borderColor: '#722ed1', color: '#722ed1' }}>Mark Dispatched</Button>
              )}
              {order.status === 'dispatched' && (
                <Button type="primary" style={{ background: '#52c41a' }} icon={<CheckCircleOutlined />} onClick={() => handleStatusUpdate('delivered')}>Mark Delivered</Button>
              )}
              {!['cancelled', 'delivered'].includes(order.status) && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModal(true)}>Cancel</Button>
              )}
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Invoice</Button>
              <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-1 ml-1" onClick={onClose}>✕</span>
            </Space>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Dealer & Order Info */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-gray-50 rounded-lg p-4 border">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Dealer / Customer</div>
                <div className="text-base font-bold">{order.dealerName || order.dealer?.businessName}</div>
                <div className="text-sm text-gray-500 mt-1">{order.dealerCode || order.dealer?.dealerCode}</div>
                <div className="text-sm text-gray-500">{order.dealer?.mobile}</div>
                <div className="text-sm text-gray-500">{order.dealer?.city}</div>
                {order.dealer?.gstin && <div className="text-xs text-gray-400 mt-1">GSTIN: {order.dealer.gstin}</div>}
              </div>
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Order Details</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Date:</span><span className="font-medium">{new Date(order.orderDate).toLocaleDateString('en-IN')}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Type:</span><span className="font-medium capitalize">{order.orderType}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Priority:</span><Tag color={order.deliveryPriority === 'urgent' ? 'red' : order.deliveryPriority === 'vip' ? 'gold' : 'default'}>{order.deliveryPriority}</Tag></div>
                  {order.expectedDeliveryDate && <div className="flex justify-between"><span className="text-gray-500">Expected:</span><span>{new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN')}</span></div>}
                  {order.salesExecutive && <div className="flex justify-between"><span className="text-gray-500">SE:</span><span>{order.salesExecutive.name}</span></div>}
                </div>
              </div>
              <div className="bg-orange-50 rounded-lg p-4 border border-orange-100">
                <div className="text-xs text-gray-400 uppercase font-semibold mb-2">Payment Summary</div>
                <div className="space-y-1.5 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Grand Total:</span><span className="text-lg font-bold text-[#FF5F03]">₹{(order.grandTotal || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Advance:</span><span className="font-medium text-green-600">₹{(order.advanceAmount || 0).toLocaleString()}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Balance:</span><span className="font-bold text-red-600">₹{(order.balanceAmount || 0).toLocaleString()}</span></div>
                  {order.dealer?.creditLimit > 0 && (
                    <div className="flex justify-between"><span className="text-gray-500">Credit Limit:</span><span>₹{order.dealer.creditLimit.toLocaleString()}</span></div>
                  )}
                </div>
              </div>
            </div>

            {/* Items Table */}
            <div>
              <div className="text-sm font-semibold text-gray-700 mb-2">Order Items ({order.items?.length || 0})</div>
              <div className="border rounded-lg overflow-hidden">
                <Table columns={itemColumns} dataSource={order.items || []} rowKey={(r, i) => r._id || i} size="small" pagination={false} scroll={{ x: 900 }} />
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-80 bg-gray-50 rounded-lg p-4 border space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>₹{(order.subtotal || 0).toLocaleString()}</span></div>
                {order.totalDiscount > 0 && <div className="flex justify-between"><span className="text-gray-500">Discount</span><span className="text-green-600">-₹{order.totalDiscount.toLocaleString()}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Tax (GST)</span><span>₹{(order.totalTax || 0).toLocaleString()}</span></div>
                {order.freightCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Freight</span><span>₹{order.freightCharges}</span></div>}
                {order.loadingCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Loading</span><span>₹{order.loadingCharges}</span></div>}
                {order.otherCharges > 0 && <div className="flex justify-between"><span className="text-gray-500">Other</span><span>₹{order.otherCharges}</span></div>}
                {order.roundOff !== 0 && <div className="flex justify-between"><span className="text-gray-500">Round Off</span><span>₹{order.roundOff?.toFixed(2)}</span></div>}
                <Divider className="my-1" />
                <div className="flex justify-between text-base font-bold"><span>Grand Total</span><span className="text-[#FF5F03]">₹{(order.grandTotal || 0).toLocaleString()}</span></div>
              </div>
            </div>

            {/* Remarks & Delivery */}
            {(order.remarks || order.deliveryAddress) && (
              <div className="grid grid-cols-2 gap-4">
                {order.deliveryAddress && (
                  <div className="bg-gray-50 p-3 rounded-lg border">
                    <div className="text-xs text-gray-400 uppercase mb-1">Delivery Address</div>
                    <div className="text-sm">{order.deliveryAddress}</div>
                  </div>
                )}
                {order.remarks && (
                  <div className="bg-gray-50 p-3 rounded-lg border">
                    <div className="text-xs text-gray-400 uppercase mb-1">Remarks</div>
                    <div className="text-sm">{order.remarks}</div>
                  </div>
                )}
              </div>
            )}

            {/* Modification Logs */}
            {order.modificationLogs?.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-gray-700 mb-2">Audit Trail</div>
                <div className="bg-gray-50 rounded-lg border p-4 max-h-40 overflow-y-auto">
                  <Timeline items={order.modificationLogs.map(log => ({
                    children: (
                      <div className="text-xs">
                        <span className="font-medium capitalize">{log.field}</span> changed from <Tag className="text-[10px]">{String(log.oldValue || '—')}</Tag> to <Tag className="text-[10px]">{String(log.newValue || '—')}</Tag>
                        <span className="text-gray-400 ml-2">{new Date(log.changedAt).toLocaleString('en-IN')}</span>
                        {log.reason && <span className="text-gray-400 ml-1">— {log.reason}</span>}
                      </div>
                    )
                  }))} />
                </div>
              </div>
            )}

            {/* Tally Sync */}
            <div className="flex items-center gap-3 text-sm">
              <span className="text-gray-500">Tally Sync:</span>
              <Tag color={order.tallySyncStatus === 'synced' ? 'green' : order.tallySyncStatus === 'failed' ? 'red' : order.tallySyncStatus === 'pending' ? 'orange' : 'default'}>
                {order.tallySyncStatus === 'not_synced' ? 'Not Synced' : order.tallySyncStatus}
              </Tag>
              {order.tallyVoucherNumber && <span className="text-gray-400">Voucher: {order.tallyVoucherNumber}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Cancel Modal */}
      <Modal title="Cancel Order" open={cancelModal} onOk={handleCancel} onCancel={() => setCancelModal(false)} okText="Cancel Order" okButtonProps={{ danger: true }}>
        <p className="text-sm text-gray-600 mb-3">Are you sure you want to cancel order <strong>{order.orderNumber}</strong>? This action cannot be undone.</p>
        <Input.TextArea rows={3} value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Reason for cancellation (required)..." />
      </Modal>

      {/* Hidden print content */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="invoice-header">
            <div>
              <div className="company-name">BDM TILES</div>
              <div className="company-sub">Tiles & Sanitary Ware Distributors</div>
              <div className="company-sub">GSTIN: XXXXXXXXXXXX</div>
            </div>
            <div>
              <div className="invoice-title">TAX INVOICE</div>
              <div className="invoice-meta">
                <div><strong>{order.orderNumber}</strong></div>
                <div>Date: {new Date(order.orderDate).toLocaleDateString('en-IN')}</div>
                <div style={{marginTop:'5px'}}>
                  <span className="status-badge" style={{background: order.status === 'delivered' ? '#d4edda' : order.status === 'cancelled' ? '#f8d7da' : '#fff3cd', color: order.status === 'delivered' ? '#155724' : order.status === 'cancelled' ? '#721c24' : '#856404'}}>
                    {order.status?.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-box">
              <div className="label">Bill To</div>
              <div className="value">{order.dealerName || order.dealer?.businessName}</div>
              <div style={{fontSize:'11px', color:'#666', marginTop:'3px'}}>{order.dealer?.city}</div>
              {order.dealer?.gstin && <div style={{fontSize:'10px', color:'#888'}}>GSTIN: {order.dealer.gstin}</div>}
              <div style={{fontSize:'10px', color:'#888'}}>Code: {order.dealerCode || order.dealer?.dealerCode}</div>
            </div>
            <div className="info-box">
              <div className="label">Ship To</div>
              <div className="value">{order.deliveryAddress || order.dealer?.city || '—'}</div>
              {order.expectedDeliveryDate && <div style={{fontSize:'11px', color:'#666', marginTop:'3px'}}>Expected: {new Date(order.expectedDeliveryDate).toLocaleDateString('en-IN')}</div>}
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Product</th>
                <th>Shade</th>
                <th>Qty</th>
                <th>Rate</th>
                <th>Disc</th>
                <th>Taxable</th>
                <th>CGST</th>
                <th>SGST</th>
                <th className="text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items?.map((item, idx) => (
                <tr key={idx}>
                  <td>{idx + 1}</td>
                  <td><strong>{item.productName || item.product?.itemName}</strong><br/><span style={{fontSize:'9px', color:'#888'}}>{item.productCode || item.product?.productCode}</span></td>
                  <td>{item.shade || '—'}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>₹{(item.rate || 0).toLocaleString()}</td>
                  <td>{item.discount ? `${item.discount}${item.discountType === 'percentage' ? '%' : ''}` : '—'}</td>
                  <td>₹{(item.taxableAmount || 0).toLocaleString()}</td>
                  <td>₹{(item.cgst || 0).toFixed(2)}</td>
                  <td>₹{(item.sgst || 0).toFixed(2)}</td>
                  <td className="text-right"><strong>₹{(item.totalAmount || 0).toLocaleString()}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals">
            <div className="row"><span>Subtotal</span><span>₹{(order.subtotal || 0).toLocaleString()}</span></div>
            {order.totalDiscount > 0 && <div className="row"><span>Discount</span><span>-₹{order.totalDiscount.toLocaleString()}</span></div>}
            <div className="row"><span>GST</span><span>₹{(order.totalTax || 0).toLocaleString()}</span></div>
            {order.freightCharges > 0 && <div className="row"><span>Freight</span><span>₹{order.freightCharges}</span></div>}
            {order.loadingCharges > 0 && <div className="row"><span>Loading</span><span>₹{order.loadingCharges}</span></div>}
            {order.roundOff !== 0 && <div className="row"><span>Round Off</span><span>₹{order.roundOff?.toFixed(2)}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>₹{(order.grandTotal || 0).toLocaleString()}</span></div>
            <div className="row"><span>Advance Paid</span><span>₹{(order.advanceAmount || 0).toLocaleString()}</span></div>
            <div className="row" style={{fontWeight:'bold'}}><span>Balance Due</span><span>₹{(order.balanceAmount || 0).toLocaleString()}</span></div>
          </div>

          {order.remarks && (
            <div style={{marginTop:'20px', fontSize:'11px', color:'#666'}}>
              <strong>Remarks:</strong> {order.remarks}
            </div>
          )}

          <div className="footer">
            <div className="sign-box">
              <div className="sign-line">Prepared By</div>
            </div>
            <div className="sign-box">
              <div className="sign-line">Authorized Signatory</div>
            </div>
          </div>

          <div style={{marginTop:'20px', textAlign:'center', fontSize:'9px', color:'#aaa'}}>
            This is a computer generated invoice. | Generated on {new Date().toLocaleString('en-IN')}
          </div>
        </div>
      </div>
    </>
  );
};

export default SalesOrderView;
