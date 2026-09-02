import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Divider, Input, InputNumber, Modal, Select, Space, Table, Tag, Upload, message } from 'antd';
import { CheckCircleOutlined, EyeOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import ComplaintDetail from '../../components/complaints/ComplaintDetail.jsx';
import crmService from '../../services/crmService.js';
import masterService from '../../services/masterService.js';
import { useAuth } from '../../context/AuthContext.jsx';

const emptyWarehouseForm = {
  problemConfirmed: true,
  problemDescription: '',
  severity: 'moderate',
  productCondition: 'minor_damage',
  isResaleable: false,
  recommendation: 'credit_note',
  evidenceFiles: [],
  remarks: '',
  items: [],
};
const emptyFinanceForm = { decision: '', adjustmentType: '', remarks: '', items: [] };
const actorId = (user) => String(user?._id || user?.id || '');
const recordId = (value) => String(value?._id || value || '');

const ComplaintWorkflowQueue = ({ mode }) => {
  const warehouseMode = mode === 'warehouse';
  const requiredPermission = warehouseMode ? 'warehouse.verification' : 'finance.management';
  const { user, hasPermission } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [warehouseForm, setWarehouseForm] = useState(emptyWarehouseForm);
  const [financeForm, setFinanceForm] = useState(emptyFinanceForm);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = warehouseMode
        ? await crmService.getWarehouseComplaintQueue()
        : await crmService.getFinanceComplaintQueue();
      if (response.success) setRecords(response.data || []);
    } catch (error) {
      message.error(error.message || 'Unable to load complaint queue.');
    } finally {
      setLoading(false);
    }
  }, [warehouseMode]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (!warehouseMode) return;
    masterService.getWarehouses({ limit: 200 }).then((response) => {
      if (response.success) setWarehouses(response.data || []);
    }).catch(() => setWarehouses([]));
  }, [warehouseMode]);

  const openDetail = async (id) => {
    setDetail({ _id: id });
    setDetailLoading(true);
    try {
      const response = await crmService.getComplaint(id);
      if (!response.success) return;
      setDetail(response.data);
      setWarehouseForm({
        ...emptyWarehouseForm,
        items: (response.data.products || []).map((item) => ({
          invoiceItem: item.invoiceItem,
          selected: true,
          receivedQty: Number(item.quantity || 0),
          damagedQty: 0,
          returnQty: Number(item.quantity || 0),
          condition: 'damaged',
          warehouse: '',
          remarks: '',
        })),
      });
      setFinanceForm({
        ...emptyFinanceForm,
        items: (response.data.warehouseVerification?.items || []).map((item) => ({
          invoiceItem: item.invoiceItem,
          approvedQty: Number(item.returnQty || 0),
        })),
      });
    } catch (error) {
      message.error(error.message || 'Unable to load complaint detail.');
    } finally {
      setDetailLoading(false);
    }
  };

  const updateWarehouseItem = (index, field, value) => setWarehouseForm((form) => ({
    ...form,
    items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
  }));
  const updateFinanceItem = (index, value) => setFinanceForm((form) => ({
    ...form,
    items: form.items.map((item, itemIndex) => itemIndex === index ? { ...item, approvedQty: value || 0 } : item),
  }));

  const makerCheckerBlocked = useMemo(() => {
    if (!detail) return false;
    const currentActor = actorId(user);
    return currentActor && (
      recordId(detail.createdBy) === currentActor
      || (warehouseMode && recordId(detail.sentToWarehouseBy) === currentActor)
      || (!warehouseMode && recordId(detail.warehouseVerification?.verifiedBy) === currentActor)
    );
  }, [detail, user, warehouseMode]);

  const submitWarehouse = async () => {
    const problemDescription = warehouseForm.problemDescription.trim();
    const remarks = warehouseForm.remarks.trim();
    if (!problemDescription || !remarks || warehouseForm.evidenceFiles.length === 0) {
      message.error('Issue description, remarks, and at least one evidence photo are required.');
      return;
    }
    const selectedItems = warehouseForm.items.filter((item) => item.selected);
    if (selectedItems.length === 0 || selectedItems.some((item) => !item.invoiceItem || !item.warehouse
      || Number(item.receivedQty) <= 0 || Number(item.returnQty) <= 0
      || Number(item.returnQty) > Number(item.receivedQty)
      || Number(item.damagedQty) < 0 || Number(item.damagedQty) > Number(item.receivedQty))) {
      message.error('Select at least one line and provide valid receipt, damage, return, condition, and warehouse values.');
      return;
    }
    const quantityReceived = selectedItems.reduce((sum, item) => sum + Number(item.receivedQty || 0), 0);
    const quantityDamaged = selectedItems.reduce((sum, item) => sum + Number(item.damagedQty || 0), 0);
    setSaving(true);
    try {
      const uploaded = await crmService.uploadComplaintEvidence(warehouseForm.evidenceFiles);
      if (!uploaded.success || !uploaded.data?.length) throw new Error('Warehouse evidence upload failed.');
      const photos = uploaded.data.map((evidence) => ({ evidence: evidence.id, caption: 'Warehouse evidence' }));
      const { evidenceFiles, ...verificationData } = warehouseForm;
      const response = await crmService.verifyComplaintWarehouse(detail._id, {
        ...verificationData,
        items: selectedItems.map(({ selected, ...item }) => item),
        problemDescription,
        remarks,
        photos,
        quantityReceived,
        quantityDamaged,
      });
      if (response.success) {
        message.success(response.message || 'Warehouse verification submitted.');
        setDetail(null);
        load();
      }
    } catch (error) {
      message.error(error.message || 'Warehouse verification failed.');
    } finally {
      setSaving(false);
    }
  };

  const submitFinance = async () => {
    if (!financeForm.decision || !financeForm.remarks.trim()) {
      message.error('An explicit decision and finance remarks are required.');
      return;
    }
    if (['approved', 'partial_approved'].includes(financeForm.decision) && !financeForm.adjustmentType) {
      message.error('Select an approved outcome.');
      return;
    }
    if (financeForm.decision === 'partial_approved'
      && financeForm.items.some((item, index) => Number(item.approvedQty) <= 0
        || Number(item.approvedQty) > Number(detail.warehouseVerification?.items?.[index]?.returnQty || 0))) {
      message.error('Partial approved quantities must be positive and within warehouse-verified return quantities.');
      return;
    }
    setSaving(true);
    try {
      const response = await crmService.reviewComplaintFinance(detail._id, {
        decision: financeForm.decision,
        adjustmentType: ['approved', 'partial_approved'].includes(financeForm.decision) ? financeForm.adjustmentType : undefined,
        remarks: financeForm.remarks.trim(),
        items: financeForm.decision === 'partial_approved' ? financeForm.items : undefined,
      });
      if (response.success) {
        message.success(response.message || 'Finance decision recorded.');
        setDetail(null);
        load();
      }
    } catch (error) {
      message.error(error.message || 'Finance review failed.');
    } finally {
      setSaving(false);
    }
  };

  const canAct = hasPermission(requiredPermission) && !makerCheckerBlocked;
  const columns = [
    { title: 'Complaint', dataIndex: 'complaintNumber', render: (value) => <span className="font-mono font-medium">{value}</span> },
    { title: 'Dealer', render: (_, item) => item.dealerName || item.dealer?.businessName || '—' },
    { title: 'Invoice', dataIndex: 'invoiceNumber', render: value => value || <Tag color="red">Missing source</Tag> },
    { title: 'Priority', dataIndex: 'priority', render: value => <Tag color={value === 'critical' ? 'red' : value === 'high' ? 'orange' : 'blue'}>{value}</Tag> },
    { title: 'Status', dataIndex: 'status', render: value => <Tag>{String(value).replace(/_/g, ' ')}</Tag> },
    { title: 'Raised', dataIndex: 'createdAt', render: value => value ? new Date(value).toLocaleDateString('en-IN') : '—' },
    { title: 'Action', width: 100, render: (_, item) => <Button size="small" icon={<EyeOutlined />} onClick={() => openDetail(item._id)}>Review</Button> },
  ];

  return <div>
    <div className="flex justify-between items-center mb-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">{warehouseMode ? 'Warehouse Complaint Verification' : 'Finance Complaint Review'}</h1>
        <p className="text-sm text-gray-500">{warehouseMode ? 'Verify physical returns with mandatory evidence.' : 'Post approved outcomes through invoice-linked Sales Returns.'}</p>
      </div>
      <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
    </div>
    <Alert className="mb-4" showIcon type="info"
      message={warehouseMode
        ? 'Verification records exact invoice lines and receiving warehouses. At least one uploaded evidence photo is mandatory.'
        : 'Amounts are derived from the source invoice. Finance cannot enter an arbitrary credit amount.'} />
    <div className="bg-white border rounded-lg overflow-hidden">
      <Table rowKey="_id" loading={loading} dataSource={records} columns={columns} pagination={false} />
    </div>

    <Modal open={!!detail} title={`${warehouseMode ? 'Warehouse verification' : 'Finance review'} — ${detail?.complaintNumber || ''}`}
      onCancel={() => setDetail(null)} width={1050} destroyOnHidden
      footer={<Space><Button onClick={() => setDetail(null)}>Cancel</Button><Button type="primary" icon={<CheckCircleOutlined />}
        disabled={!canAct || detailLoading} loading={saving} onClick={warehouseMode ? submitWarehouse : submitFinance}>
        {warehouseMode ? 'Submit verification' : 'Record finance decision'}
      </Button></Space>}>
      <ComplaintDetail complaint={detail} loading={detailLoading} />
      {!detailLoading && makerCheckerBlocked && <Alert className="mt-3" type="error" showIcon message="Maker-checker separation blocks this action for your user." />}
      {!detailLoading && warehouseMode && <>
        <Divider>Mandatory warehouse evidence</Divider>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><label className="text-xs text-gray-500">Trimmed issue description *</label><Input.TextArea rows={2} value={warehouseForm.problemDescription} onChange={event => setWarehouseForm(form => ({ ...form, problemDescription: event.target.value }))} /></div>
          <div><label className="text-xs text-gray-500">Severity *</label><Select className="w-full" value={warehouseForm.severity} onChange={value => setWarehouseForm(form => ({ ...form, severity: value }))} options={['minor','moderate','major','critical'].map(value => ({ value, label: value }))} /></div>
          <div><label className="text-xs text-gray-500">Observed product condition *</label><Select className="w-full" value={warehouseForm.productCondition} onChange={value => setWarehouseForm(form => ({ ...form, productCondition: value }))} options={['intact','minor_damage','major_damage','broken','wrong_item','missing'].map(value => ({ value, label: value.replace(/_/g, ' ') }))} /></div>
          <div><label className="text-xs text-gray-500">Recommendation *</label><Select className="w-full" value={warehouseForm.recommendation} onChange={value => setWarehouseForm(form => ({ ...form, recommendation: value }))} options={['replace','credit_note','repair','reject_claim','partial_credit'].map(value => ({ value, label: value.replace(/_/g, ' ') }))} /></div>
          <div className="flex items-end gap-4 pb-1"><Checkbox checked={warehouseForm.problemConfirmed} onChange={event => setWarehouseForm(form => ({ ...form, problemConfirmed: event.target.checked }))}>Problem confirmed</Checkbox><Checkbox checked={warehouseForm.isResaleable} onChange={event => setWarehouseForm(form => ({ ...form, isResaleable: event.target.checked }))}>Resaleable</Checkbox></div>
          <div className="col-span-2"><label className="text-xs text-gray-500 block mb-1">Warehouse evidence photos *</label>
            <Upload multiple accept="image/jpeg,image/png,image/webp,image/gif" maxCount={10}
              fileList={warehouseForm.evidenceFiles}
              beforeUpload={(file) => { setWarehouseForm(form => ({ ...form, evidenceFiles: [...form.evidenceFiles, file].slice(0, 10) })); return false; }}
              onRemove={(file) => setWarehouseForm(form => ({ ...form, evidenceFiles: form.evidenceFiles.filter(item => item.uid !== file.uid) }))}>
              <Button icon={<UploadOutlined />}>Select evidence photos</Button>
            </Upload>
          </div>
        </div>
        <Table className="mt-3" size="small" pagination={false} rowKey={(item) => item.invoiceItem} dataSource={warehouseForm.items}
          columns={[
            { title: 'Include', render: (_, item, index) => <Checkbox checked={item.selected} onChange={event => updateWarehouseItem(index, 'selected', event.target.checked)} /> },
            { title: 'Invoice line', dataIndex: 'invoiceItem', render: value => <span className="font-mono text-xs">{String(value || 'Missing')}</span> },
            { title: 'Received *', render: (_, item, index) => <InputNumber min={0.0001} value={item.receivedQty} onChange={value => updateWarehouseItem(index, 'receivedQty', value || 0)} /> },
            { title: 'Damaged *', render: (_, item, index) => <InputNumber min={0} max={item.receivedQty} value={item.damagedQty} onChange={value => updateWarehouseItem(index, 'damagedQty', value || 0)} /> },
            { title: 'Return *', render: (_, item, index) => <InputNumber min={0.0001} max={item.receivedQty} value={item.returnQty} onChange={value => updateWarehouseItem(index, 'returnQty', value || 0)} /> },
            { title: 'Stock condition *', render: (_, item, index) => <Select className="w-28" value={item.condition} onChange={value => updateWarehouseItem(index, 'condition', value)} options={['resaleable','damaged','scrap'].map(value => ({ value, label: value }))} /> },
            { title: 'Receiving warehouse *', render: (_, item, index) => <Select className="w-40" value={item.warehouse || undefined} onChange={value => updateWarehouseItem(index, 'warehouse', value)} options={warehouses.map(warehouse => ({ value: warehouse._id, label: warehouse.name || warehouse.warehouseName }))} /> },
          ]} />
        <div className="mt-3"><label className="text-xs text-gray-500">Warehouse remarks *</label><Input.TextArea rows={2} value={warehouseForm.remarks} onChange={event => setWarehouseForm(form => ({ ...form, remarks: event.target.value }))} /></div>
      </>}
      {!detailLoading && !warehouseMode && <>
        <Divider>Finance command</Divider>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs text-gray-500">Decision *</label><Select className="w-full" value={financeForm.decision || undefined} onChange={value => setFinanceForm(form => ({ ...form, decision: value, adjustmentType: ['rejected','hold'].includes(value) ? '' : form.adjustmentType }))} options={['approved','partial_approved','rejected','hold'].map(value => ({ value, label: value.replace(/_/g, ' ') }))} /></div>
          {['approved','partial_approved'].includes(financeForm.decision) && <div><label className="text-xs text-gray-500">Posted outcome *</label><Select className="w-full" value={financeForm.adjustmentType || undefined} onChange={value => setFinanceForm(form => ({ ...form, adjustmentType: value }))} options={['credit_note','refund','replacement'].map(value => ({ value, label: value.replace(/_/g, ' ') }))} /></div>}
          <div className="col-span-2"><label className="text-xs text-gray-500">Finance remarks *</label><Input.TextArea rows={3} value={financeForm.remarks} onChange={event => setFinanceForm(form => ({ ...form, remarks: event.target.value }))} /></div>
        </div>
        {financeForm.decision === 'partial_approved' && <Table className="mt-3" size="small" pagination={false} rowKey={item => item.invoiceItem} dataSource={financeForm.items}
          columns={[
            { title: 'Invoice line', dataIndex: 'invoiceItem', render: value => <span className="font-mono text-xs">{String(value)}</span> },
            { title: 'Verified return qty', render: (_, item, index) => detail.warehouseVerification?.items?.[index]?.returnQty || 0 },
            { title: 'Approved qty *', render: (_, item, index) => <InputNumber min={0.0001} max={detail.warehouseVerification?.items?.[index]?.returnQty || 0} value={item.approvedQty} onChange={value => updateFinanceItem(index, value)} /> },
          ]} />}
      </>}
    </Modal>
  </div>;
};

export default ComplaintWorkflowQueue;
