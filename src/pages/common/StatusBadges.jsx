import React from 'react';
import { Tag, Badge } from 'antd';

const STATUS_MAP = {
  draft:       { color: 'default',  text: 'Draft',        dot: '#8c8c8c' },
  confirmed:   { color: 'blue',     text: 'Confirmed',    dot: '#1677ff' },
  approved:    { color: 'cyan',     text: 'Approved',     dot: '#13c2c2' },
  processing:  { color: 'orange',   text: 'Processing',   dot: '#fa8c16' },
  partial_dispatch: { color: 'geekblue', text: 'Partial Dispatch', dot: '#2b5876' },
  dispatched:  { color: 'purple',   text: 'Dispatched',   dot: '#722ed1' },
  delivered:   { color: 'green',    text: 'Delivered',    dot: '#52c41a' },
  cancelled:   { color: 'red',      text: 'Cancelled',    dot: '#f5222d' },
  expired:     { color: 'volcano',  text: 'Expired',      dot: '#fa541c' },
};

const PAYMENT_MAP = {
  pending:  { color: 'orange',  text: 'Pending (COD)' },
  partial:  { color: 'blue',    text: 'Partial' },
  paid:     { color: 'green',   text: 'Paid' },
  failed:   { color: 'red',     text: 'Failed' },
  overdue:  { color: 'red',     text: 'Overdue' },
};

export const StatusBadge = ({ status, style }) => {
  const cfg = STATUS_MAP[status] || STATUS_MAP.draft;
  return (
    <Tag color={cfg.color} style={{ borderRadius: 12, fontWeight: 600, ...style }}>
      <Badge color={cfg.dot} style={{ marginRight: 6 }} />
      {cfg.text}
    </Tag>
  );
};

export const PaymentStatusBadge = ({ status, style }) => {
  const cfg = PAYMENT_MAP[status] || PAYMENT_MAP.pending;
  return (
    <Tag color={cfg.color} style={{ borderRadius: 12, fontWeight: 500, ...style }}>
      {cfg.text}
    </Tag>
  );
};

export const STATUS_OPTIONS = Object.entries(STATUS_MAP).map(([value, cfg]) => ({
  value,
  label: cfg.text,
}));

export const PAYMENT_OPTIONS = Object.entries(PAYMENT_MAP).map(([value, cfg]) => ({
  value,
  label: cfg.text,
}));

export default { StatusBadge, PaymentStatusBadge };
