import { useState, useCallback, createContext, useContext } from 'react';
import { Modal, Button } from 'antd';
import { ExclamationCircleOutlined, CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';

/**
 * Custom Confirm Modal — works with React 19 + antd v5.
 * Uses a controlled Modal component instead of antd's static Modal.confirm().
 * 
 * Usage:
 *   const { confirm, alertModal } = useConfirm();
 *   
 *   // Confirm before action
 *   const proceed = await confirm('Delete this product?', { type: 'danger', okText: 'Delete' });
 *   if (proceed) { ... do the action ... }
 *   
 *   // Show error/success alert
 *   alertModal('Cannot delete', 'Product has dependencies', 'error');
 */

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [state, setState] = useState({ open: false, title: '', content: '', type: 'warning', okText: 'OK', cancelText: 'Cancel', resolve: null });
  const [alertState, setAlertState] = useState({ open: false, title: '', content: '', type: 'info' });

  const confirm = useCallback((title, options = {}) => {
    return new Promise((resolve) => {
      setState({
        open: true,
        title: title || 'Confirm',
        content: options.content || '',
        type: options.type || 'warning',
        okText: options.okText || 'OK',
        cancelText: options.cancelText || 'Cancel',
        resolve,
      });
    });
  }, []);

  const alertModal = useCallback((title, content, type = 'info') => {
    setAlertState({ open: true, title, content, type });
  }, []);

  const handleOk = () => { state.resolve?.(true); setState(s => ({ ...s, open: false })); };
  const handleCancel = () => { state.resolve?.(false); setState(s => ({ ...s, open: false })); };

  const typeIcons = {
    warning: <ExclamationCircleOutlined className="text-orange-500 text-xl" />,
    danger: <CloseCircleOutlined className="text-red-500 text-xl" />,
    success: <CheckCircleOutlined className="text-green-500 text-xl" />,
    info: <InfoCircleOutlined className="text-blue-500 text-xl" />,
    error: <CloseCircleOutlined className="text-red-500 text-xl" />,
  };

  return (
    <ConfirmContext.Provider value={{ confirm, alertModal }}>
      {children}

      {/* Confirm Modal */}
      <Modal
        open={state.open}
        onCancel={handleCancel}
        footer={null}
        closable={false}
        centered
        width={420}
      >
        <div className="flex gap-3 items-start pt-2">
          <div className="mt-0.5">{typeIcons[state.type]}</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-gray-800">{state.title}</div>
            {state.content && <div className="text-sm text-gray-500 mt-1 whitespace-pre-line">{state.content}</div>}
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button onClick={handleCancel}>{state.cancelText}</Button>
          <Button type="primary" danger={state.type === 'danger'} onClick={handleOk}>{state.okText}</Button>
        </div>
      </Modal>

      {/* Alert Modal (no cancel, just OK) */}
      <Modal
        open={alertState.open}
        onCancel={() => setAlertState(s => ({ ...s, open: false }))}
        footer={<Button type="primary" onClick={() => setAlertState(s => ({ ...s, open: false }))}>OK</Button>}
        closable={false}
        centered
        width={420}
      >
        <div className="flex gap-3 items-start pt-2">
          <div className="mt-0.5">{typeIcons[alertState.type]}</div>
          <div className="flex-1">
            <div className="text-base font-semibold text-gray-800">{alertState.title}</div>
            {alertState.content && <div className="text-sm text-gray-500 mt-2 whitespace-pre-line">{alertState.content}</div>}
          </div>
        </div>
      </Modal>
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
};

export default ConfirmProvider;
