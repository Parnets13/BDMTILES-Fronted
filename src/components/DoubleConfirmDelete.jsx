import { useState } from 'react';
import { Modal, Input, Button, message } from 'antd';
import { ExclamationCircleOutlined, DeleteOutlined, WarningOutlined } from '@ant-design/icons';

/**
 * DoubleConfirmDelete — 2-step delete confirmation.
 * Step 1: "Are you sure?" modal
 * Step 2: "Type DELETE to confirm" modal
 *
 * Usage:
 *   <DoubleConfirmDelete
 *     title="Delete Product"
 *     recordName="Milano 600x600 Glossy"
 *     onConfirm={async () => { await deleteProduct(id); }}
 *     trigger={<Button danger icon={<DeleteOutlined />}>Delete</Button>}
 *   />
 */
const DoubleConfirmDelete = ({ title, recordName, onConfirm, trigger, loading: externalLoading }) => {
  const [step, setStep] = useState(0); // 0=closed, 1=first confirm, 2=type DELETE
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState('');

  const handleTriggerClick = () => setStep(1);

  const handleFirstConfirm = () => {
    setStep(2);
    setConfirmText('');
  };

  const handleFinalConfirm = async () => {
    if (confirmText !== 'DELETE') {
      message.error('Please type DELETE exactly to confirm');
      return;
    }
    setLoading(true);
    try {
      await onConfirm(reason);
      setStep(0);
      setConfirmText('');
      setReason('');
    } catch (err) {
      message.error(err.message || 'Delete failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setStep(0);
    setConfirmText('');
    setReason('');
  };

  return (
    <>
      {/* Trigger element */}
      <span onClick={handleTriggerClick} style={{ cursor: 'pointer' }}>
        {trigger}
      </span>

      {/* Step 1: First Confirmation */}
      <Modal
        title={<span className="flex items-center gap-2 text-orange-600"><ExclamationCircleOutlined /> {title || 'Confirm Delete'}</span>}
        open={step === 1}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>Cancel</Button>,
          <Button key="next" type="primary" danger onClick={handleFirstConfirm}>
            Yes, I want to delete
          </Button>,
        ]}
        width={480}
      >
        <div className="py-4">
          <div className="text-sm text-gray-600 mb-3">
            Are you sure you want to delete <strong className="text-red-600">{recordName || 'this record'}</strong>?
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs text-blue-700">
            The item will be moved to <strong>Recycle Bin</strong> and can be recovered within 30 days.
            After 30 days it will be permanently deleted.
          </div>
          <div className="mt-3">
            <label className="text-xs text-gray-500 block mb-1">Reason for deletion (optional)</label>
            <Input.TextArea
              rows={2}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="Why are you deleting this?"
            />
          </div>
        </div>
      </Modal>

      {/* Step 2: Type DELETE to confirm */}
      <Modal
        title={<span className="flex items-center gap-2 text-red-600"><WarningOutlined /> Final Confirmation</span>}
        open={step === 2}
        onCancel={handleCancel}
        footer={[
          <Button key="cancel" onClick={handleCancel}>Cancel</Button>,
          <Button key="delete" type="primary" danger
            loading={loading || externalLoading}
            disabled={confirmText !== 'DELETE'}
            icon={<DeleteOutlined />}
            onClick={handleFinalConfirm}>
            Permanently Confirm Delete
          </Button>,
        ]}
        width={480}
      >
        <div className="py-4">
          <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
            <div className="text-sm text-red-700 font-medium mb-1">You are about to delete:</div>
            <div className="text-base font-bold text-red-800">{recordName || 'this record'}</div>
          </div>
          <div className="text-sm text-gray-600 mb-3">
            Type <strong className="text-red-600 font-mono bg-red-50 px-2 py-0.5 rounded">DELETE</strong> below to confirm:
          </div>
          <Input
            size="large"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="Type DELETE here"
            className={confirmText === 'DELETE' ? 'border-green-500' : ''}
            autoFocus
          />
          {confirmText && confirmText !== 'DELETE' && (
            <div className="text-xs text-red-500 mt-1">Type exactly: DELETE (case sensitive)</div>
          )}
          {confirmText === 'DELETE' && (
            <div className="text-xs text-green-600 mt-1">Confirmed. Click the button to proceed.</div>
          )}
        </div>
      </Modal>
    </>
  );
};

export default DoubleConfirmDelete;
