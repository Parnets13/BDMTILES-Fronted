import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Empty, Input, List, Modal, Spin, Typography } from 'antd';

const { Text } = Typography;

/**
 * Pick an existing record and link it.
 *
 * Used from both directions — attaching a login to an HRMS employee, and an employee to
 * a login — because the two screens must behave identically or operators learn two
 * different flows for the same idea.
 *
 * `loadCandidates` returns `[{ value, label, hint }]`; the caller supplies the filter
 * (only unlinked records are useful here) and the actual link call, so this stays
 * presentational. `linkRecord(value, row)` receives the whole row so the caller can show
 * the label without a second lookup.
 */
export default function LinkRecordModal({
  open,
  onClose,
  onLinked,
  title,
  description,
  emptyText = 'Nothing available to link.',
  searchPlaceholder = 'Search…',
  loadCandidates,
  linkRecord,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const next = await loadCandidates();
      setRows(Array.isArray(next) ? next : []);
    } catch (err) {
      setError(err?.message || 'Could not load the list.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [loadCandidates]);

  useEffect(() => {
    if (!open) return;
    setSearch('');
    load();
  }, [open, load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      `${row.label} ${row.hint || ''}`.toLowerCase().includes(needle));
  }, [rows, search]);

  const handleLink = async (row) => {
    setLinking(true);
    setError('');
    try {
      // The whole row, not just the id — callers need the label for the confirmation and
      // for holding a pending choice on a record that does not exist yet.
      await linkRecord(row.value, row);
      onLinked?.();
      onClose?.();
    } catch (err) {
      // Shown in place rather than as a toast: the reason (mobile mismatch, already
      // linked, wrong branch) usually means picking a DIFFERENT record, and the list
      // needs to stay on screen for that.
      setError(err?.message || 'Could not link. Please try again.');
    } finally {
      setLinking(false);
    }
  };

  return (
    <Modal open={open} onCancel={onClose} footer={null} title={title} width={620} destroyOnHidden>
      {description ? (
        <Text type="secondary" className="block mb-3 text-sm">{description}</Text>
      ) : null}

      {error ? <Alert type="error" showIcon message={error} className="mb-3" /> : null}

      <Input.Search
        allowClear
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder={searchPlaceholder}
        className="mb-2"
      />

      {loading ? (
        <div className="py-10 text-center"><Spin /></div>
      ) : filtered.length ? (
        <List
          size="small"
          dataSource={filtered}
          className="max-h-80 overflow-auto"
          renderItem={(row) => (
            <List.Item
              actions={[
                <a
                  key="link"
                  onClick={() => (linking ? undefined : handleLink(row))}
                  className={linking ? 'pointer-events-none opacity-50' : ''}
                >
                  Link
                </a>,
              ]}
            >
              <List.Item.Meta
                title={<span className="text-sm">{row.label}</span>}
                description={row.hint ? <span className="text-xs">{row.hint}</span> : null}
              />
            </List.Item>
          )}
        />
      ) : (
        <Empty description={search ? 'No match.' : emptyText} />
      )}
    </Modal>
  );
}
