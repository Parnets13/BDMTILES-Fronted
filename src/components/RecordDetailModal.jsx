import { Descriptions, Modal, Tag, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

/**
 * Read-only detail view for a master record.
 *
 * Several master screens only offered Edit, which meant the only way to look at a
 * record was to open a form you could accidentally change. This gives them a
 * consistent read-only view without each page hand-rolling its own modal.
 *
 * `sections` is an array of { title, fields } where each field is
 * { label, value, span?, type? }. `type` handles the common renderings:
 *   'date' | 'datetime' | 'boolean' | 'tag' | 'money' | 'list' | 'code'
 * Anything else is printed as-is. A null/undefined/'' value renders as an em dash
 * rather than a blank cell, so a missing value is visibly missing.
 */

const EMPTY = <Text type="secondary">—</Text>;

const renderValue = (field) => {
  const { value, type, tagColor } = field;

  if (type === 'boolean') {
    return <Tag color={value ? 'green' : 'default'}>{value ? 'Yes' : 'No'}</Tag>;
  }
  if (value === null || value === undefined || value === '') return EMPTY;

  switch (type) {
    case 'date':
      return dayjs(value).isValid() ? dayjs(value).format('DD MMM YYYY') : String(value);
    case 'datetime':
      return dayjs(value).isValid() ? dayjs(value).format('DD MMM YYYY, HH:mm') : String(value);
    case 'money':
      return `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    case 'tag':
      return <Tag color={tagColor || 'blue'}>{String(value)}</Tag>;
    case 'list': {
      const items = Array.isArray(value) ? value.filter((item) => item !== null && item !== '') : [];
      if (!items.length) return EMPTY;
      return <>{items.map((item, index) => <Tag key={`${item}-${index}`}>{String(item)}</Tag>)}</>;
    }
    case 'code':
      return <Text code>{String(value)}</Text>;
    default:
      return String(value);
  }
};

const RecordDetailModal = ({
  open,
  onClose,
  title = 'Record Details',
  subtitle,
  sections = [],
  width = 820,
  footer,
}) => (
  <Modal
    title={
      <div>
        <div>{title}</div>
        {subtitle && <Text type="secondary" style={{ fontSize: 12, fontWeight: 400 }}>{subtitle}</Text>}
      </div>
    }
    open={open}
    onCancel={onClose}
    footer={footer === undefined ? null : footer}
    width={width}
    destroyOnHidden
  >
    {sections
      // A section whose every field is empty adds nothing but scroll.
      .filter((section) => (section.fields || []).some((field) => field.alwaysShow
        || (field.value !== null && field.value !== undefined && field.value !== ''
          && !(Array.isArray(field.value) && field.value.length === 0))))
      .map((section) => (
        <div key={section.title} style={{ marginBottom: 16 }}>
          <Descriptions
            title={section.title}
            bordered
            size="small"
            column={{ xs: 1, sm: 2, md: section.columns || 3 }}
          >
            {(section.fields || []).map((field) => (
              <Descriptions.Item key={field.label} label={field.label} span={field.span}>
                {renderValue(field)}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
      ))}
  </Modal>
);

export default RecordDetailModal;
