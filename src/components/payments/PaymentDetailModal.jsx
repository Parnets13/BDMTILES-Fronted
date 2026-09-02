import { Button, Divider, Modal, Tag } from 'antd';

const STATUS_COLORS = { pending: 'orange', confirmed: 'green', bounced: 'red', cancelled: 'default' };
const MODE_COLORS = { cash: 'green', cheque: 'blue', upi: 'purple', neft: 'cyan', rtgs: 'geekblue', card: 'magenta', adjustment: 'default' };
const money = value => Number(value || 0).toLocaleString('en-IN');
const dateTime = value => value ? new Date(value).toLocaleString('en-IN') : '—';

const PaymentDetailModal = ({ payment, onClose }) => (
  <Modal
    open={!!payment}
    title={`Payment ${payment?.paymentNumber || ''}`}
    onCancel={onClose}
    width={760}
    footer={<Button onClick={onClose}>Close</Button>}
  >
    {payment && (
      <div className="space-y-4 mt-3 text-sm">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div><div className="text-xs text-gray-400">Party</div><div className="font-semibold">{payment.partyName || payment.dealer?.businessName || payment.supplier?.companyName || '—'}</div></div>
          <div><div className="text-xs text-gray-400">Type</div><div className="font-semibold capitalize">{payment.paymentType?.replace(/_/g, ' ') || '—'}</div></div>
          <div><div className="text-xs text-gray-400">Amount</div><div className="font-bold text-base">₹{money(payment.amount)}</div></div>
          <div><div className="text-xs text-gray-400">Status</div><Tag color={STATUS_COLORS[payment.status]}>{payment.status}</Tag></div>
          <div><div className="text-xs text-gray-400">Mode</div><Tag color={MODE_COLORS[payment.paymentMode]}>{payment.paymentMode?.toUpperCase()}</Tag></div>
          <div><div className="text-xs text-gray-400">Payment Date</div><div>{dateTime(payment.paymentDate)}</div></div>
        </div>

        <div className="grid grid-cols-2 gap-3 text-xs">
          <div><span className="text-gray-400">Bank:</span> <b>{payment.bankName || '—'}</b></div>
          <div><span className="text-gray-400">Transaction Ref:</span> <b>{payment.transactionRef || '—'}</b></div>
          <div><span className="text-gray-400">Cheque:</span> <b>{payment.chequeNumber || '—'}</b></div>
          <div><span className="text-gray-400">Cheque Date:</span> <b>{payment.chequeDate ? new Date(payment.chequeDate).toLocaleDateString('en-IN') : '—'}</b></div>
          <div><span className="text-gray-400">Confirmed:</span> <b>{dateTime(payment.confirmedAt)}</b></div>
          <div><span className="text-gray-400">Bounced:</span> <b>{dateTime(payment.bouncedAt)}</b></div>
          <div><span className="text-gray-400">Cancelled:</span> <b>{dateTime(payment.cancelledAt)}</b></div>
          <div><span className="text-gray-400">Unallocated Advance:</span> <b>₹{money(payment.unallocatedAdvanceAmount)}</b></div>
        </div>

        <Divider className="my-2" />
        <div>
          <div className="font-semibold mb-2">Allocations ({payment.againstOrders?.length || 0})</div>
          <div className="border border-gray-200 rounded overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr><th className="px-3 py-2 text-left">Reference</th><th className="px-3 py-2 text-left">Document Type</th><th className="px-3 py-2 text-right">Allocated Amount</th></tr></thead>
              <tbody>{payment.againstOrders?.map((allocation, index) => (
                <tr key={allocation._id || index} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-mono">{allocation.orderNumber || '—'}</td>
                  <td className="px-3 py-2">{allocation.orderModel || '—'}</td>
                  <td className="px-3 py-2 text-right font-semibold">₹{money(allocation.allocatedAmount)}</td>
                </tr>
              ))}</tbody>
            </table>
            {!payment.againstOrders?.length && <div className="p-3 text-xs text-gray-400">No document allocations recorded.</div>}
          </div>
        </div>

        {payment.remarks && <div className="bg-yellow-50 border border-yellow-100 rounded p-3 text-xs"><b>Remarks:</b> {payment.remarks}</div>}
        {payment.bounceReason && <div className="bg-red-50 border border-red-100 rounded p-3 text-xs text-red-700"><b>Bounce reason:</b> {payment.bounceReason}</div>}
      </div>
    )}
  </Modal>
);

export default PaymentDetailModal;
