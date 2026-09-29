import { Alert, Button } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';

/**
 * InlineError — a consistent, user-facing error banner.
 *
 * Purpose: surface failures where the user can actually see them (including
 * inside modals/drawers), instead of leaving the only signal in the browser
 * console. Drop this at the top of a page section or modal body.
 *
 * Props:
 *   error    — an Error, a string, or a { message, code } object (falsy hides it)
 *   onRetry  — optional; shows a "Retry" button
 *   onClose  — optional; makes the banner dismissible
 *   className
 */
const humanize = (error) => {
  if (!error) return '';
  if (typeof error === 'string') return error;
  const status = error.status || error.response?.status;
  const message = error.message || error.response?.data?.message;
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 403) return message || 'You do not have permission to do this.';
  if (status === 404) return message || 'The requested record could not be found.';
  if (status === 409) return message || 'This action conflicts with the current state. Refresh and try again.';
  if (status === 422) return message || 'Some details are invalid. Please review and try again.';
  if (status >= 500) return message || 'The server ran into a problem. Please try again shortly.';
  if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
    return 'Cannot reach the server. Check your connection and try again.';
  }
  return message || 'Something went wrong. Please try again.';
};

const InlineError = ({ error, onRetry, onClose, className = 'mb-4' }) => {
  if (!error) return null;
  const text = humanize(error);
  const code = typeof error === 'object' ? error.code : undefined;
  return (
    <Alert
      className={className}
      type="error"
      showIcon
      closable={Boolean(onClose)}
      onClose={onClose}
      message={text}
      description={code && typeof code === 'string' && !/^ERR_/.test(code)
        ? <span className="text-xs text-slate-500">Reference: {code}</span>
        : undefined}
      action={onRetry
        ? <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>Retry</Button>
        : undefined}
    />
  );
};

export default InlineError;
