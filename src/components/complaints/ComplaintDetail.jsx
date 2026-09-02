import { Alert, Descriptions, Divider, Image, Spin, Table, Tag } from 'antd';

const label = (value) => String(value || '—').replace(/_/g, ' ');
const date = (value) => value ? new Date(value).toLocaleString('en-IN') : '—';

const ComplaintDetail = ({ complaint, loading = false }) => {
  if (loading) return <div className="py-10 text-center"><Spin /></div>;
  if (!complaint) return <Alert type="info" message="Select a complaint to view its authoritative record." />;

  const verification = complaint.warehouseVerification;
  const review = complaint.accountantReview;
  const salesReturn = complaint.salesReturn;
  return (
    <div className="space-y-3 text-sm">
      <Descriptions size="small" bordered column={2}>
        <Descriptions.Item label="Complaint">{complaint.complaintNumber}</Descriptions.Item>
        <Descriptions.Item label="Status"><Tag>{label(complaint.status)}</Tag></Descriptions.Item>
        <Descriptions.Item label="Dealer">{complaint.dealerName || complaint.dealer?.businessName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Priority">{label(complaint.priority)}</Descriptions.Item>
        <Descriptions.Item label="Sales order">{complaint.orderNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Invoice">{complaint.invoiceNumber || '—'}</Descriptions.Item>
        <Descriptions.Item label="Creator">{complaint.createdByName || '—'}</Descriptions.Item>
        <Descriptions.Item label="Raised">{date(complaint.createdAt)}</Descriptions.Item>
      </Descriptions>
      <Alert type="info" message={complaint.description} />

      <Divider className="my-2">Authoritative invoice lines</Divider>
      <Table size="small" pagination={false} rowKey={item => item._id || item.invoiceItem}
        dataSource={complaint.products || []}
        columns={[
          { title: 'Product', render: (_, item) => <div><div>{item.productName || '—'}</div><div className="text-xs text-gray-400">{item.productCode || ''}</div></div> },
          { title: 'Invoice line', dataIndex: 'invoiceItem', render: value => value ? <span className="font-mono text-xs">{String(value)}</span> : <Tag color="red">Missing</Tag> },
          { title: 'Qty', dataIndex: 'quantity', width: 75 },
          { title: 'Shade / Batch', render: (_, item) => `${item.shade || '—'} / ${item.batch || '—'}` },
        ]} />

      {verification?.verifiedBy && <>
        <Divider className="my-2">Warehouse verification</Divider>
        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="Verified by">{verification.verifiedByName || String(verification.verifiedBy)}</Descriptions.Item>
          <Descriptions.Item label="Verified at">{date(verification.verifiedAt)}</Descriptions.Item>
          <Descriptions.Item label="Issue">{verification.problemDescription}</Descriptions.Item>
          <Descriptions.Item label="Recommendation">{label(verification.recommendation)}</Descriptions.Item>
          <Descriptions.Item label="Received / damaged">{verification.quantityReceived} / {verification.quantityDamaged}</Descriptions.Item>
          <Descriptions.Item label="Condition">{label(verification.productCondition)}</Descriptions.Item>
          <Descriptions.Item label="Remarks" span={2}>{verification.remarks}</Descriptions.Item>
        </Descriptions>
        <Table size="small" pagination={false} rowKey={item => item._id || item.invoiceItem}
          dataSource={verification.items || []}
          columns={[
            { title: 'Invoice line', dataIndex: 'invoiceItem', render: value => <span className="font-mono text-xs">{String(value || '—')}</span> },
            { title: 'Received', dataIndex: 'receivedQty' },
            { title: 'Damaged', dataIndex: 'damagedQty' },
            { title: 'Return', dataIndex: 'returnQty' },
            { title: 'Condition', dataIndex: 'condition', render: value => label(value) },
            { title: 'Warehouse', render: (_, item) => item.warehouse?.name || String(item.warehouse || '—') },
          ]} />
        <div className="flex flex-wrap gap-2">
          {(verification.photos || []).map((photo, index) => (
            <Image key={`${photo.url}-${index}`} width={88} height={72} className="object-cover" src={photo.url} alt={photo.caption || 'Warehouse evidence'} />
          ))}
        </div>
      </>}

      {review?.reviewedBy && <>
        <Divider className="my-2">Finance review</Divider>
        <Descriptions size="small" bordered column={2}>
          <Descriptions.Item label="Decision">{label(review.decision)}</Descriptions.Item>
          <Descriptions.Item label="Outcome">{label(review.adjustmentType)}</Descriptions.Item>
          <Descriptions.Item label="Derived amount">₹{Number(review.approvedAmount || 0).toLocaleString('en-IN')}</Descriptions.Item>
          <Descriptions.Item label="Reviewed at">{date(review.reviewedAt)}</Descriptions.Item>
          <Descriptions.Item label="Remarks" span={2}>{review.remarks || '—'}</Descriptions.Item>
        </Descriptions>
      </>}

      {salesReturn && <Alert type={salesReturn.status === 'reversed' ? 'warning' : 'success'} showIcon
        message={`${salesReturn.status === 'reversed' ? 'Reversed' : 'Posted'} Sales Return ${salesReturn.returnNumber}`}
        description={`${label(salesReturn.status)} · ${label(salesReturn.adjustmentType)} · ₹${Number(salesReturn.grandTotal || 0).toLocaleString('en-IN')}${salesReturn.creditNoteNumber ? ` · ${salesReturn.creditNoteNumber}${salesReturn.status === 'reversed' ? ' (historical, reversed)' : ''}` : ''}`} />}
      {complaint.purchaseLineage?.requested && !complaint.purchaseReturn && <Alert type="warning" showIcon
        message="Purchase Return not posted"
        description="Exact supplier invoice, GRN, and purchase-order line lineage is required before purchase accounting can be created." />}
    </div>
  );
};

export default ComplaintDetail;
