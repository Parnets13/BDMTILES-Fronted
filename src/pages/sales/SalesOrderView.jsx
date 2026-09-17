import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Descriptions, Table, Tag, Button, Space, message, Modal, Input, Divider,
  Timeline, Spin, Card, Row, Col, Alert,
} from 'antd';
import {
  PrinterOutlined, CloseCircleOutlined, CheckCircleOutlined, ArrowLeftOutlined,
  FileTextOutlined, HistoryOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import salesService from '../../services/salesService.js';
import api, { createIdempotencyKey } from '../../config/api.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const STATUS_COLORS = {
  draft: 'default', confirmed: 'blue', approved: 'cyan', processing: 'orange',
  partial_dispatch: 'geekblue', partially_closed: 'gold', dispatched: 'purple', delivered: 'green', cancelled: 'red', expired: 'volcano',
};
const PAYMENT_COLORS = { pending: 'orange', partial: 'blue', paid: 'green', overdue: 'red' };
const APPROVAL_COLORS = { not_required: 'default', pending: 'orange', approved: 'green', rejected: 'red' };
const RESERVATION_COLORS = { none: 'default', reserving: 'processing', reserved: 'blue', partial: 'orange', released: 'default', consumed: 'green' };

const label = value => value ? String(value).replace(/_/g, ' ').replace(/\b\w/g, character => character.toUpperCase()) : '—';
const money = value => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
const fixedMoney = value => `₹${Number(value || 0).toFixed(2)}`;
const dateText = value => value ? new Date(value).toLocaleDateString('en-IN') : '—';
const calendarDateText = value => value
  ? new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' })
  : '—';
const dateTimeText = value => value ? new Date(value).toLocaleString('en-IN') : '—';
const personName = value => value?.name || value?.email || '—';
const displayValue = value => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'object') {
    if (value.name || value.businessName || value.itemName) return value.name || value.businessName || value.itemName;
    try { return JSON.stringify(value); } catch { return String(value); }
  }
  return String(value);
};

const DetailSection = ({ title, extra, children, className = '' }) => (
  <Card size="small" title={title} extra={extra} className={className}>{children}</Card>
);

const SalesOrderView = ({ orderId, branchId, readOnlyBranch = false, onClose, onStatusChange }) => {
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const printRef = useRef(null);
  const detailRequestSequence = useRef(0);
  const invoiceGenerationKey = useRef(createIdempotencyKey());
  const pickListGenerationKey = useRef(createIdempotencyKey());

  const fetchOrder = useCallback(async () => {
    if (!orderId) return;
    const requestId = ++detailRequestSequence.current;
    setLoading(true);
    try {
      const response = await salesService.getOrder(orderId, branchId ? { branch: branchId } : undefined);
      if (requestId !== detailRequestSequence.current) return;
      if (response.success) setOrder(response.data);
      else message.error('Failed to load order');
    } catch (error) {
      if (requestId === detailRequestSequence.current) message.error(error.message);
    } finally {
      if (requestId === detailRequestSequence.current) setLoading(false);
    }
  }, [orderId, branchId]);

  useEffect(() => {
    invoiceGenerationKey.current = createIdempotencyKey();
    pickListGenerationKey.current = createIdempotencyKey();
    setOrder(null);
    if (orderId) fetchOrder();
    return () => { detailRequestSequence.current += 1; };
  }, [orderId, fetchOrder]);

  const handleStatusUpdate = async (status, reason) => {
    setStatusUpdating(true);
    try {
      const response = await salesService.updateStatus(orderId, { status, cancellationReason: reason });
      if (response.success) {
        message.success(response.message);
        await fetchOrder();
        onStatusChange?.();
        return true;
      }
      return false;
    } catch (error) {
      message.error(error.message);
      return false;
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelReason.trim()) {
      message.warning('Please provide a cancellation reason');
      return;
    }
    const cancelled = await handleStatusUpdate('cancelled', cancelReason.trim());
    if (cancelled) {
      setCancelModal(false);
      setCancelReason('');
    }
  };

  const handleRemainingCancellation = (action = 'request') => {
    let reason = '';
    Modal.confirm({
      title: action === 'request' ? 'Cancel all remaining quantities?' : `${label(action)} remaining cancellation?`,
      content: <Input.TextArea className="mt-3" rows={3} placeholder="Mandatory reason" onChange={event => { reason = event.target.value; }} />,
      okText: action === 'request' ? 'Request Cancellation' : label(action),
      okType: action === 'reject' ? 'danger' : 'primary',
      onOk: async () => {
        if (!reason.trim()) { message.error('Enter a reason'); return Promise.reject(); }
        const response = action === 'request'
          ? await salesService.requestRemainingCancellation(orderId, { reason: reason.trim() })
          : await salesService.reviewRemainingCancellation(orderId, action, { reason: reason.trim() });
        if (response.success) { message.success(response.message); await fetchOrder(); onStatusChange?.(); }
      },
    });
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open('', '_blank');
    if (!win) {
      message.error('The print window was blocked. Allow popups and try again.');
      return;
    }
    win.document.write(`
      <html><head><title>Sales Order - ${order.orderNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; padding: 20px; color: #333; font-size: 12px; }
        .invoice-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #FF5F03; padding-bottom: 15px; margin-bottom: 20px; }
        .company-name { font-size: 24px; font-weight: bold; color: #FF5F03; }
        .company-sub { font-size: 11px; color: #666; margin-top: 4px; }
        .invoice-title { font-size: 18px; font-weight: bold; color: #333; text-align: right; }
        .invoice-meta { text-align: right; font-size: 11px; color: #666; margin-top: 5px; }
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
      </style></head><body>${printContent.innerHTML}</body></html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  if (loading && !order) return (
    <div className="fixed inset-0 z-50 bg-white flex items-center justify-center">
      <Spin size="large" tip="Loading order..."><span /></Spin>
    </div>
  );
  if (!order) return null;

  const finalInvoiceEligible = (order.items || []).length > 0 && (order.items || []).every(item => (
    Number(item.quantity || 0) - Number(item.dispatchedQuantity || 0) + Number(item.dispatchReversedQuantity || 0) - Number(item.cancelledRemainingQuantity || 0) <= 0.0001
  )) && (order.items || []).some(item => Number(item.dispatchedQuantity || 0) - Number(item.dispatchReversedQuantity || 0) > 0);
  const sourceQuotation = order.sourceQuotation && typeof order.sourceQuotation === 'object' ? order.sourceQuotation : null;
  const cancellationApproval = order.cancellationApprovalRequest && typeof order.cancellationApprovalRequest === 'object'
    ? order.cancellationApprovalRequest
    : null;

  const openStockHistory = (item) => {
    const productId = item.product?._id || item.product;
    const warehouseId = item.warehouse?._id || item.warehouse;
    if (!productId || !warehouseId || readOnlyBranch) return;
    const params = new URLSearchParams({
      product: String(productId), warehouse: String(warehouseId),
      shade: item.shade || '', batch: item.batch || '', tab: 'movements',
    });
    onClose?.();
    navigate(`/inventory/stock?${params.toString()}`);
  };

  const itemColumns = [
    { title: '#', width: 40, fixed: 'left', render: (_, __, index) => <span className="text-xs text-gray-400">{index + 1}</span> },
    {
      title: 'Product', key: 'product', width: 260, fixed: 'left', render: (_, item) => (
        <div className="flex items-start gap-2">
          {(item.productImage || item.product?.images?.[0]) && <ProductImage src={item.productImage || item.product?.images?.[0]} size="sm" />}
          <div className="min-w-0">
            <div className="text-sm font-medium">{item.productName || item.product?.itemName || '—'}</div>
            <div className="text-xs text-gray-400">{item.productCode || item.product?.productCode || 'No code'}</div>
            <div className="text-xs text-gray-400">{[item.product?.brand?.name, item.product?.category?.name, item.product?.subcategory?.name, item.product?.tileSize, item.product?.finish, item.product?.colour].filter(Boolean).join(' · ') || '—'}</div>
          </div>
        </div>
      ),
    },
    {
      title: 'UOM / Quantity', key: 'uom', width: 160, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div className="font-semibold text-sm">{Number(item.quantity || 0).toLocaleString('en-IN')} {item.unit || item.product?.unit || 'Box'}</div>
          <div className="text-gray-500">Boxes: {Number(item.boxes || 0).toLocaleString('en-IN')} · Pieces: {Number(item.pieces || 0).toLocaleString('en-IN')}</div>
          <div className="text-gray-500">Sq.ft: {Number(item.sqft || 0).toLocaleString('en-IN')} {item.product?.sqftPerBox ? `· ${item.product.sqftPerBox}/box` : ''}</div>
        </div>
      ),
    },
    {
      title: 'Warehouse / Batch', key: 'warehouse', width: 175, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div className="font-medium">{item.warehouse?.name || 'Not assigned'}</div>
          <div className="text-gray-400">{item.warehouse?.warehouseCode || '—'}</div>
          <div>Shade: {item.shade || '—'}</div><div>Batch: {item.batch || '—'}</div>
          {!readOnlyBranch && (item.product?._id || item.product) && (item.warehouse?._id || item.warehouse) && (
            <Button type="link" size="small" className="p-0 h-auto mt-1" icon={<HistoryOutlined />} onClick={() => openStockHistory(item)}>
              View stock history
            </Button>
          )}
        </div>
      ),
    },
    {
      title: 'Pricing', key: 'pricing', width: 150, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div>Rate: <strong>{money(item.rate)}</strong></div>
          <div>Base: {money(item.pricingSnapshot?.baseRate)}</div>
          <div className="text-gray-400">{label(item.pricingSnapshot?.source)}{item.pricingSnapshot?.rateField ? ` · ${item.pricingSnapshot.rateField}` : ''}</div>
          {item.pricingSnapshot?.belowMinimum && <Tag color="red" className="mt-1">Below minimum</Tag>}
        </div>
      ),
    },
    {
      title: 'Discounts', key: 'discounts', width: 140, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div>Regular: {Number(item.discount || 0) ? `${item.discount}${item.discountType === 'percentage' ? '%' : ' / unit'}` : '—'}</div>
          <div>Scheme: {money(item.schemeDiscount)}</div>
          <div className="text-gray-400">Resolved: {money(item.pricingSnapshot?.regularDiscountPerUnit)} / unit</div>
        </div>
      ),
    },
    {
      title: 'GST', key: 'gst', width: 140, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div>{Number(item.gstPercentage || 0)}% · {fixedMoney(item.gstAmount)}</div>
          <div>CGST: {fixedMoney(item.cgst)}</div><div>SGST: {fixedMoney(item.sgst)}</div><div>IGST: {fixedMoney(item.igst)}</div>
        </div>
      ),
    },
    {
      title: 'Reservation', key: 'reservation', width: 145, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div>Reserved: {Number(item.reservedQuantity || 0)}</div>
          <div>Allocated: {Number(item.allocatedQuantity || 0)}</div>
          <div>Picked: {Number(item.pickedQuantity || 0)}</div>
          <div>Short / damaged: {Number(item.shortQuantity || 0)} / {Number(item.damagedQuantity || 0)}</div>
        </div>
      ),
    },
    {
      title: 'Fulfillment', key: 'fulfillment', width: 150, render: (_, item) => (
        <div className="text-xs space-y-0.5">
          <div>Dispatched (gross): {Number(item.dispatchedQuantity || 0)}</div>
          <div>Cancelled remaining: {Number(item.cancelledRemainingQuantity || 0)}</div>
          <div>Open: {Number(item.remainingQuantity || 0)}</div>
          <div>Returned: {Number(item.returnedQuantity || 0)}</div>
          <div>Dispatch recovered: {Number(item.dispatchReversedQuantity || 0)}</div>
          <div>Net fulfilled: {Number(item.netFulfilledQuantity ?? item.fulfilledQuantity ?? 0)}</div>
          <div>Legacy fulfilled: {Number(item.fulfilledQuantity || 0)} · Backorder: {Number(item.backorderQuantity || 0)}</div>
        </div>
      ),
    },
    { title: 'Taxable', dataIndex: 'taxableAmount', width: 110, align: 'right', render: value => money(value) },
    { title: 'Total', dataIndex: 'totalAmount', width: 120, fixed: 'right', align: 'right', render: value => <span className="font-semibold">{money(value)}</span> },
  ];

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-1 sm:p-3">
        <div className="bg-white rounded-2xl shadow-2xl w-[96vw] max-w-[1776px] h-full sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden border border-slate-200">
          {/* Header */}
          <div className="shrink-0 border-b border-slate-200 px-4 sm:px-6 py-3.5 flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 bg-slate-50/90">
            <div className="flex items-center gap-3 min-w-0">
              <Button icon={<ArrowLeftOutlined />} type="text" onClick={onClose} className="hover:bg-slate-200/60 rounded-lg" />
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 font-bold border border-blue-100 shadow-2xs shrink-0">
                <FileTextOutlined className="text-lg" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 font-mono tracking-tight truncate m-0">{order.orderNumber}</h2>
                  <Tag color={STATUS_COLORS[order.status]} className="px-2.5 py-0.5 text-xs font-semibold uppercase rounded-md border-0 m-0">
                    {label(order.status)}
                  </Tag>
                  <Tag color={PAYMENT_COLORS[order.paymentStatus]} className="px-2 py-0.5 text-xs font-semibold rounded-md m-0">
                    {label(order.paymentStatus)}
                  </Tag>
                  <Tag color={APPROVAL_COLORS[order.approvalStatus]} className="px-2 py-0.5 text-xs font-semibold rounded-md m-0">
                    Approval: {label(order.approvalStatus)}
                  </Tag>
                  {order.creditLimitExceeded && <Tag color="red" className="px-2 py-0.5 text-xs font-semibold rounded-md m-0">Credit Exceeded</Tag>}
                </div>
                <div className="text-xs text-slate-400 font-normal mt-0.5">
                  Order Date: {dateText(order.orderDate)} • Executive: {personName(order.salesExecutive)}
                </div>
              </div>
            </div>

            <Space wrap size="small">
              <Button icon={<ReloadOutlined />} onClick={fetchOrder} loading={loading}>Refresh</Button>
              {!readOnlyBranch && order.status === 'draft' && (
                <Button type="primary" loading={statusUpdating} icon={<CheckCircleOutlined />} onClick={() => handleStatusUpdate('confirmed')}>
                  Confirm
                </Button>
              )}
              {!readOnlyBranch && !['cancelled', 'delivered', 'dispatched', 'partial_dispatch'].includes(order.status) && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => setCancelModal(true)}>
                  Cancel
                </Button>
              )}
              {!readOnlyBranch && order.status === 'partial_dispatch' && order.remainingCancellationStatus !== 'pending' && (
                <Button danger icon={<CloseCircleOutlined />} onClick={() => handleRemainingCancellation('request')}>
                  Cancel Remaining
                </Button>
              )}
              {!readOnlyBranch && order.remainingCancellationStatus === 'pending' && (
                <>
                  <Button onClick={() => handleRemainingCancellation('approve')}>Approve Remaining Closure</Button>
                  <Button danger onClick={() => handleRemainingCancellation('reject')}>Reject Closure</Button>
                </>
              )}
              <Button icon={<PrinterOutlined />} onClick={handlePrint}>Print Sales Order</Button>
              {!readOnlyBranch && finalInvoiceEligible && ['partial_dispatch', 'partially_closed', 'dispatched', 'delivered'].includes(order.status) && (
                <Button type="primary" icon={<FileTextOutlined />} onClick={async () => {
                  try {
                    const response = await salesService.generateInvoiceFromSalesOrder(order._id, invoiceGenerationKey.current);
                    if (response.success) {
                      invoiceGenerationKey.current = createIdempotencyKey();
                      message.success(`${response.data.invoiceNumber} generated!`);
                    }
                  } catch (error) { message.error(error.message); }
                }}>Generate GST Invoice</Button>
              )}
              {!readOnlyBranch && ['confirmed', 'approved'].includes(order.status) && (
                <Button icon={<FileTextOutlined />} onClick={async () => {
                  try {
                    const response = await api.post(`/pick-lists/generate/${order._id}`, undefined, { headers: { 'Idempotency-Key': pickListGenerationKey.current } });
                    if (response.success) {
                      pickListGenerationKey.current = createIdempotencyKey();
                      message.success(`${response.data.pickListNumber} generated!`);
                    }
                  } catch (error) { message.error(error.message); }
                }}>Generate Pick List</Button>
              )}
              <Button type="text" aria-label="Close sales order" onClick={onClose} className="hover:bg-slate-200/60 font-bold">✕</Button>
            </Space>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
            {loading && <div className="flex justify-center py-2"><Spin size="small" /></div>}
            {readOnlyBranch && (
              <Alert
                type="info"
                showIcon
                message="Viewing another branch in read-only mode"
                description="Switch the active branch before confirming, cancelling, generating a pick list, or generating an invoice for this Sales Order."
              />
            )}

            {/* Hero Top Metric Banner */}
            <div className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 via-white to-blue-50/40 p-4 shadow-2xs">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Grand Total</div>
                    <div className="text-2xl font-black text-blue-600">{money(order.grandTotal)}</div>
                  </div>
                  <div className="hidden h-10 w-px bg-slate-200 sm:block"></div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Balance Due</div>
                    <div className="text-xl font-bold text-red-600">{money(order.balanceAmount)}</div>
                  </div>
                  <div className="hidden h-10 w-px bg-slate-200 sm:block"></div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Customer / Dealer</div>
                    <div className="text-sm font-bold text-slate-800">{order.dealerName || order.dealer?.businessName || order.customerName || '—'}</div>
                    <div className="text-xs text-slate-500">{order.dealerCode || order.dealer?.dealerCode || order.customerPhone || '—'}</div>
                  </div>
                  <div className="hidden h-10 w-px bg-slate-200 sm:block"></div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Expected Delivery</div>
                    <div className="text-sm font-bold text-slate-800">{dateText(order.expectedDeliveryDate)}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Tag color={PAYMENT_COLORS[order.paymentStatus]} className="px-3 py-1 text-xs font-bold uppercase rounded-lg">
                    Payment: {label(order.paymentStatus)}
                  </Tag>
                  <Tag color={RESERVATION_COLORS[order.reservationStatus]} className="px-3 py-1 text-xs font-bold uppercase rounded-lg">
                    Reservation: {label(order.reservationStatus)}
                  </Tag>
                </div>
              </div>
            </div>

            {/* Context Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <DetailSection title={<span className="font-semibold text-slate-700">Branch</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" column={1} items={[
                  { key: 'branch', label: 'Branch', children: <span className="font-medium text-slate-800">{order.branch ? `${order.branch.branchCode || ''}${order.branch.branchCode ? ' — ' : ''}${order.branch.name || '—'}` : (order.legacyBranch || '—')}</span> },
                  { key: 'address', label: 'Address', children: [order.branch?.address, order.branch?.city, order.branch?.state].filter(Boolean).join(', ') || '—' },
                  { key: 'contact', label: 'Contact', children: [order.branch?.phone, order.branch?.email].filter(Boolean).join(' · ') || '—' },
                  { key: 'gstin', label: 'GSTIN', children: order.branch?.gstin ? <span className="font-mono text-slate-600">{order.branch.gstin}</span> : '—' },
                ]} />
              </DetailSection>

              <DetailSection title={<span className="font-semibold text-slate-700">Dealer / Customer</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" column={1} items={[
                  { key: 'name', label: 'Name', children: <span className="font-semibold text-slate-800">{order.dealerName || order.dealer?.businessName || order.customerName || '—'}</span> },
                  { key: 'code', label: 'Code / Type', children: `${order.dealerCode || order.dealer?.dealerCode || 'Walk-in'} · ${order.dealerType?.name || order.dealerTypeSnapshot?.name || label(order.orderType)}` },
                  { key: 'contact', label: 'Contact', children: [order.dealer?.mobile || order.customerPhone, order.dealer?.email].filter(Boolean).join(' · ') || '—' },
                  { key: 'address', label: 'Address', children: [order.dealer?.address, order.dealer?.city, order.dealer?.state].filter(Boolean).join(', ') || '—' },
                  { key: 'gstin', label: 'GSTIN', children: order.dealer?.gstin ? <span className="font-mono text-slate-600">{order.dealer.gstin}</span> : '—' },
                ]} />
              </DetailSection>

              <DetailSection title={<span className="font-semibold text-slate-700">Order & Source</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" column={1} items={[
                  { key: 'date', label: 'Order date', children: <strong>{dateText(order.orderDate)}</strong> },
                  { key: 'type', label: 'Order type', children: label(order.orderType) },
                  { key: 'sales', label: 'Sales executive', children: personName(order.salesExecutive) },
                  { key: 'creator', label: 'Created by', children: personName(order.createdBy) },
                  { key: 'source', label: 'Source', children: sourceQuotation ? <Tag color="blue" className="m-0">Quotation conversion</Tag> : <Tag className="m-0">Legacy direct</Tag> },
                  { key: 'quotation', label: 'Quotation', children: sourceQuotation ? `${sourceQuotation.quotationNumber || '—'} · ${label(sourceQuotation.status)}` : '—' },
                  { key: 'conversion', label: 'Conversion', children: sourceQuotation ? `${label(sourceQuotation.conversionState)} · ${dateTimeText(sourceQuotation.convertedAt)}` : '—' },
                  { key: 'validity', label: 'Validity', children: sourceQuotation ? `${calendarDateText(sourceQuotation.quotationDate)} to ${calendarDateText(sourceQuotation.validUntil)}` : '—' },
                ]} />
              </DetailSection>
            </div>

            {/* Order Items Table */}
            <DetailSection
              title={<span className="font-semibold text-slate-700">Order Items ({order.items?.length || 0})</span>}
              extra={<Tag color={RESERVATION_COLORS[order.reservationStatus]} className="font-medium">{label(order.reservationStatus)}</Tag>}
              className="shadow-2xs border-slate-200"
            >
              <div className="-mx-3 -mb-3 overflow-x-auto">
                <Table
                  columns={itemColumns}
                  dataSource={order.items || []}
                  rowKey={(item, index) => item._id || index}
                  size="small"
                  pagination={false}
                  scroll={{ x: 1600 }}
                  className="border-t border-slate-100"
                />
              </div>
            </DetailSection>

            {/* Payment & Delivery Summary Cards */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <DetailSection title={<span className="font-semibold text-slate-700">Payment & Financial Summary</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} items={[
                  { key: 'subtotal', label: 'Subtotal', children: money(order.subtotal) },
                  { key: 'discount', label: 'Regular discount', children: money(order.totalDiscount) },
                  { key: 'scheme', label: 'Scheme discount', children: money(order.totalSchemeDiscount) },
                  { key: 'tax', label: 'GST', children: money(order.totalTax) },
                  { key: 'freight', label: 'Freight', children: money(order.freightCharges) },
                  { key: 'loading', label: 'Loading', children: money(order.loadingCharges) },
                  { key: 'installation', label: 'Installation', children: money(order.installationCharges) },
                  { key: 'other', label: 'Other charges', children: money(order.otherCharges) },
                  { key: 'round', label: 'Round off', children: fixedMoney(order.roundOff) },
                  { key: 'grand', label: 'Grand total', children: <strong className="text-blue-700 text-sm">{money(order.grandTotal)}</strong> },
                  { key: 'advance', label: 'Advance', children: <span className="text-emerald-600 font-medium">{money(order.advanceAmount)}</span> },
                  { key: 'balance', label: 'Balance', children: <strong className="text-red-600 text-sm">{money(order.balanceAmount)}</strong> },
                  { key: 'payment', label: 'Payment status', children: <Tag color={PAYMENT_COLORS[order.paymentStatus]}>{label(order.paymentStatus)}</Tag> },
                  { key: 'credit', label: 'Dealer credit', children: order.dealer ? `${money(order.dealer.currentOutstanding)} outstanding · ${money(order.dealer.creditLimit)} limit` : '—' },
                ]} />
              </DetailSection>

              <DetailSection title={<span className="font-semibold text-slate-700">Delivery & Inventory Reservation</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" bordered column={{ xs: 1, sm: 2 }} items={[
                  { key: 'expected', label: 'Expected delivery', children: <strong>{dateText(order.expectedDeliveryDate)}</strong> },
                  { key: 'priority', label: 'Priority', children: <Tag color={order.deliveryPriority === 'urgent' ? 'red' : order.deliveryPriority === 'vip' ? 'gold' : 'default'}>{label(order.deliveryPriority)}</Tag> },
                  { key: 'address', label: 'Delivery address', span: 2, children: order.deliveryAddress || '—' },
                  { key: 'reservation', label: 'Reservation status', children: <Tag color={RESERVATION_COLORS[order.reservationStatus]}>{label(order.reservationStatus)}</Tag> },
                  { key: 'requested', label: 'Confirmation requested', children: order.confirmationRequested ? 'Yes' : 'No' },
                  { key: 'reserved', label: 'Reserved at', children: dateTimeText(order.reservedAt) },
                  { key: 'expires', label: 'Reservation expiry', children: <span>{dateTimeText(order.reservationExpiresAt)} {order.reservationExpiryState && <Tag className="ml-1 text-[10px]">{label(order.reservationExpiryState)}</Tag>}</span> },
                  { key: 'expiryReason', label: 'Expiry reason', children: order.reservationExpiryReason || '—' },
                  { key: 'released', label: 'Released at', children: dateTimeText(order.reservationReleasedAt) },
                  { key: 'consumed', label: 'Consumed at', children: dateTimeText(order.reservationConsumedAt) },
                ]} />
              </DetailSection>
            </div>

            {/* Approval Section */}
            <DetailSection title={<span className="font-semibold text-slate-700">Approval Details</span>} className="shadow-2xs border-slate-200">
              <Descriptions size="small" bordered column={{ xs: 1, sm: 2, lg: 4 }} items={[
                { key: 'status', label: 'Approval status', children: <Tag color={APPROVAL_COLORS[order.approvalStatus]}>{label(order.approvalStatus)}</Tag> },
                { key: 'actor', label: 'Approved by', children: personName(order.approvedBy) },
                { key: 'date', label: 'Approval date', children: dateTimeText(order.approvalDate) },
                { key: 'remarks', label: 'Approval remarks', children: order.approvalRemarks || '—' },
              ]} />
              {order.approvalReasons?.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-3">
                  {order.approvalReasons.map((reason, index) => (
                    <Alert key={`${reason.type}-${index}`} type={reason.status === 'rejected' ? 'error' : reason.status === 'approved' ? 'success' : 'warning'} showIcon message={<span>{label(reason.type)} <Tag color={APPROVAL_COLORS[reason.status]}>{label(reason.status)}</Tag></span>} description={reason.message || `${reason.subject || reason.product?.itemName || 'Order'}: ${reason.requestedValue ?? '—'} against ${reason.thresholdValue ?? '—'}`} />
                  ))}
                </div>
              ) : <div className="text-xs text-slate-400 mt-2">No approval exceptions recorded.</div>}
            </DetailSection>

            {/* Remaining Quantity Closure */}
            {(order.remainingCancellationStatus !== 'none' || order.remainingCancellationReason) && (
              <DetailSection title={<span className="font-semibold text-slate-700">Remaining Quantity Closure</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" bordered column={{ xs: 1, sm: 2, lg: 3 }} items={[
                  { key: 'status', label: 'State', children: <Tag color={APPROVAL_COLORS[order.remainingCancellationStatus]}>{label(order.remainingCancellationStatus)}</Tag> },
                  { key: 'reason', label: 'Reason', children: order.remainingCancellationReason || '—' },
                  { key: 'requestedAt', label: 'Requested', children: dateTimeText(order.remainingCancellationRequestedAt) },
                  { key: 'reviewedAt', label: 'Reviewed', children: dateTimeText(order.remainingCancellationReviewedAt) },
                  { key: 'credit', label: 'Closure credit', children: money(order.closureFinancialSummary?.totalCredit) },
                  { key: 'posted', label: 'Receivable credit posted', children: order.closureFinancialSummary?.receivableCreditPosted ? 'Yes' : 'No original receivable' },
                ]} />
              </DetailSection>
            )}

            {/* Cancellation Request */}
            {(order.cancellationRequestStatus !== 'none' || order.cancellationReason) && (
              <DetailSection title={<span className="font-semibold text-slate-700">Cancellation Request</span>} className="shadow-2xs border-slate-200">
                <Descriptions size="small" bordered column={{ xs: 1, sm: 2, lg: 3 }} items={[
                  { key: 'status', label: 'Request status', children: <Tag color={APPROVAL_COLORS[order.cancellationRequestStatus]}>{label(order.cancellationRequestStatus)}</Tag> },
                  { key: 'reason', label: 'Reason', children: order.cancellationReason || cancellationApproval?.reason || '—' },
                  { key: 'request', label: 'Request number', children: cancellationApproval?.requestNumber || '—' },
                  { key: 'requestedBy', label: 'Requested by', children: personName(order.cancellationRequestedBy || cancellationApproval?.requestedBy) },
                  { key: 'requestedAt', label: 'Requested at', children: dateTimeText(order.cancellationRequestedAt || cancellationApproval?.createdAt) },
                  { key: 'approvedBy', label: 'Reviewed by', children: personName(cancellationApproval?.approvedBy) },
                  { key: 'approvedAt', label: 'Reviewed at', children: dateTimeText(cancellationApproval?.approvedAt) },
                  { key: 'remarks', label: 'Review remarks', span: 2, children: cancellationApproval?.approvalRemarks || '—' },
                ]} />
              </DetailSection>
            )}

            {/* Audit & Tally Sync Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              <div className="lg:col-span-8">
                <DetailSection title={<span className="font-semibold text-slate-700">Modifications / Audit Trail</span>} className="shadow-2xs border-slate-200">
                  {order.modificationLogs?.length > 0 ? (
                    <div className="max-h-64 overflow-y-auto pr-2">
                      <Timeline items={order.modificationLogs.map((log, index) => ({
                        key: log._id || index,
                        children: (
                          <div className="text-xs">
                            <div><span className="font-semibold text-slate-700">{label(log.field)}</span>: <Tag className="text-[10px]">{displayValue(log.oldValue)}</Tag> → <Tag className="text-[10px]">{displayValue(log.newValue)}</Tag></div>
                            <div className="text-slate-400 mt-0.5">{dateTimeText(log.changedAt)} · {personName(log.changedBy)}{log.reason ? ` · ${log.reason}` : ''}</div>
                          </div>
                        ),
                      }))} />
                    </div>
                  ) : <div className="text-xs text-slate-400 py-2">No modifications recorded.</div>}
                </DetailSection>
              </div>

              <div className="lg:col-span-4">
                <DetailSection title={<span className="font-semibold text-slate-700">Tally Sync</span>} className="shadow-2xs border-slate-200">
                  <Descriptions size="small" column={1} items={[
                    { key: 'status', label: 'Status', children: <Tag color={order.tallySyncStatus === 'synced' ? 'green' : order.tallySyncStatus === 'failed' ? 'red' : order.tallySyncStatus === 'pending' ? 'orange' : 'default'}>{label(order.tallySyncStatus)}</Tag> },
                    { key: 'voucher', label: 'Voucher', children: order.tallyVoucherNumber || '—' },
                    { key: 'guid', label: 'GUID', children: order.tallyGUID || '—' },
                    { key: 'date', label: 'Last sync', children: dateTimeText(order.tallySyncDate) },
                    { key: 'error', label: 'Error', children: order.tallySyncError || '—' },
                  ]} />
                </DetailSection>
              </div>
            </div>

            {/* Remarks */}
            <DetailSection title={<span className="font-semibold text-slate-700">Remarks & Internal Notes</span>} className="shadow-2xs border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Customer / Order Remarks</div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{order.remarks || '—'}</div>
                </div>
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">Internal Notes</div>
                  <div className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{order.internalNotes || '—'}</div>
                </div>
              </div>
            </DetailSection>
          </div>
        </div>
      </div>


      <Modal title="Cancel Order" open={cancelModal} onOk={handleCancel} onCancel={() => !statusUpdating && setCancelModal(false)} okText="Cancel Order" confirmLoading={statusUpdating} okButtonProps={{ danger: true }}>
        <p className="text-sm text-gray-600 mb-3">Are you sure you want to cancel order <strong>{order.orderNumber}</strong>? This action cannot be undone.</p>
        <Input.TextArea rows={3} value={cancelReason} onChange={event => setCancelReason(event.target.value)} placeholder="Reason for cancellation (required)..." />
      </Modal>

      <div className="hidden">
        <div ref={printRef}>
          <div className="invoice-header">
            <div>
              <div className="company-name">BDM TILES</div>
              <div className="company-sub">Tiles & Sanitary Ware Distributors</div>
              <div className="company-sub">GSTIN: XXXXXXXXXXXX</div>
            </div>
            <div>
              <div className="invoice-title">SALES ORDER</div>
              <div className="invoice-meta">
                <div><strong>{order.orderNumber}</strong></div>
                <div>Date: {dateText(order.orderDate)}</div>
                <div style={{ marginTop: '5px' }}>
                  <span className="status-badge" style={{ background: order.status === 'delivered' ? '#d4edda' : order.status === 'cancelled' ? '#f8d7da' : '#fff3cd', color: order.status === 'delivered' ? '#155724' : order.status === 'cancelled' ? '#721c24' : '#856404' }}>
                    {label(order.status).toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="info-grid">
            <div className="info-box">
              <div className="label">Bill To</div>
              <div className="value">{order.dealerName || order.dealer?.businessName || order.customerName || '—'}</div>
              <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>{order.dealer?.city}</div>
              {order.dealer?.gstin && <div style={{ fontSize: '10px', color: '#888' }}>GSTIN: {order.dealer.gstin}</div>}
              {/* From origin/master: walk-in and storefront orders have no dealer
                  code, so fall back to the customer's phone number. */}
              <div style={{ fontSize: '10px', color: '#888' }}>
                {order.dealerCode || order.dealer?.dealerCode
                  ? `Code: ${order.dealerCode || order.dealer?.dealerCode}`
                  : order.customerPhone
                    ? `Phone: ${order.customerPhone}`
                    : '—'}
              </div>
            </div>
            <div className="info-box">
              <div className="label">Ship To</div>
              <div className="value">{order.deliveryAddress || order.dealer?.city || '—'}</div>
              {order.expectedDeliveryDate && <div style={{ fontSize: '11px', color: '#666', marginTop: '3px' }}>Expected: {dateText(order.expectedDeliveryDate)}</div>}
            </div>
          </div>

          <table>
            <thead><tr><th>#</th><th>Product</th><th>Shade</th><th>Qty</th><th>Rate</th><th>Disc</th><th>Taxable</th><th>CGST</th><th>SGST</th><th className="text-right">Total</th></tr></thead>
            <tbody>
              {order.items?.map((item, index) => (
                <tr key={item._id || index}>
                  <td>{index + 1}</td>
                  <td><strong>{item.productName || item.product?.itemName}</strong><br /><span style={{ fontSize: '9px', color: '#888' }}>{item.productCode || item.product?.productCode}</span></td>
                  <td>{item.shade || '—'}</td>
                  <td>{item.quantity} {item.unit}</td>
                  <td>{money(item.rate)}</td>
                  <td>{item.discount ? `${item.discount}${item.discountType === 'percentage' ? '%' : ''}` : '—'}</td>
                  <td>{money(item.taxableAmount)}</td>
                  <td>{fixedMoney(item.cgst)}</td>
                  <td>{fixedMoney(item.sgst)}</td>
                  <td className="text-right"><strong>{money(item.totalAmount)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="totals">
            <div className="row"><span>Subtotal</span><span>{money(order.subtotal)}</span></div>
            {Number(order.totalDiscount || 0) > 0 && <div className="row"><span>Discount</span><span>-{money(order.totalDiscount)}</span></div>}
            <div className="row"><span>GST</span><span>{money(order.totalTax)}</span></div>
            {Number(order.freightCharges || 0) > 0 && <div className="row"><span>Freight</span><span>{money(order.freightCharges)}</span></div>}
            {Number(order.loadingCharges || 0) > 0 && <div className="row"><span>Loading</span><span>{money(order.loadingCharges)}</span></div>}
            {Number(order.installationCharges || 0) > 0 && <div className="row"><span>Installation</span><span>{money(order.installationCharges)}</span></div>}
            {Number(order.otherCharges || 0) > 0 && <div className="row"><span>Other</span><span>{money(order.otherCharges)}</span></div>}
            {Number(order.roundOff || 0) !== 0 && <div className="row"><span>Round Off</span><span>{fixedMoney(order.roundOff)}</span></div>}
            <div className="row grand"><span>Grand Total</span><span>{money(order.grandTotal)}</span></div>
            <div className="row"><span>Advance Paid</span><span>{money(order.advanceAmount)}</span></div>
            <div className="row" style={{ fontWeight: 'bold' }}><span>Balance Due</span><span>{money(order.balanceAmount)}</span></div>
          </div>

          {order.remarks && <div style={{ marginTop: '20px', fontSize: '11px', color: '#666' }}><strong>Remarks:</strong> {order.remarks}</div>}
          <div className="footer">
            <div className="sign-box"><div className="sign-line">Prepared By</div></div>
            <div className="sign-box"><div className="sign-line">Authorized Signatory</div></div>
          </div>
          <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '9px', color: '#aaa' }}>This is a computer generated sales order. | Generated on {new Date().toLocaleString('en-IN')}</div>
        </div>
      </div>
    </>
  );
};

export default SalesOrderView;
