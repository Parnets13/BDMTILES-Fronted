import { useMemo, useState } from 'react';
import { Modal, Upload, Table, Alert, Button, Tag, Select, Checkbox, Input, Space, Tooltip, Result, message } from 'antd';
import { InboxOutlined, DownloadOutlined, DeleteOutlined, PlusOutlined, SearchOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import productService from '../services/productService.js';

// Columns offered in the "Download template" CSV. Header names match the server alias map.
const TEMPLATE_HEADERS = [
  'Product Name', 'Product Code', 'Category', 'Subcategory', 'Brand', 'Size', 'Thickness', 'Surface',
  'Finish', 'Uses', 'Pcs Per Box', 'Sqft Per Box', 'Dealer Rate', 'Retail Rate', 'MRP', 'GST %', 'HSN Code', 'Unit', 'Status',
];

const downloadTemplate = () => {
  const blob = new Blob([`\uFEFF${TEMPLATE_HEADERS.join(',')}\n`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const PAGE_SIZE = 50;
let keySeq = 0;
const withKey = (row) => ({ ...row, _key: `r${++keySeq}` });

/**
 * Steps: 'upload' -> 'preview' (editable) -> 'result'.
 * The server parses the file (step 1) and does the authoritative validation on save (step 2);
 * the red rows and counts here are only a convenience.
 */
export default function ProductImportModal({ open, mode, categories = [], onClose, onImported }) {
  const isPdf = mode === 'pdf';
  const accept = isPdf ? '.pdf' : '.xlsx,.csv';

  const [step, setStep] = useState('upload');
  const [parsing, setParsing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [fields, setFields] = useState([]);           // all importable fields from the server
  const [visible, setVisible] = useState([]);         // field keys shown as columns
  const [ignoredHeaders, setIgnoredHeaders] = useState([]);
  const [warning, setWarning] = useState('');
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [category, setCategory] = useState(undefined);
  const [createBrands, setCreateBrands] = useState(true);
  const [result, setResult] = useState(null);

  const reset = () => {
    setStep('upload'); setParsing(false); setSaving(false); setError(''); setFileName('');
    setFields([]); setVisible([]); setIgnoredHeaders([]); setWarning(''); setRows([]);
    setSearch(''); setPage(1); setCategory(undefined); setCreateBrands(true); setResult(null);
  };
  const close = () => { reset(); onClose(); };

  // ── Step 1: parse ──────────────────────────────────────────────────────────
  const handleFile = (file) => {
    (async () => {
      setError('');
      setParsing(true);
      try {
        const res = await productService.parseImportFile(file);
        const d = res.data;
        setFields(d.fields);
        setVisible(d.fields.filter(f => f.key === 'name' || d.matchedFields.includes(f.key)).map(f => f.key));
        setIgnoredHeaders(d.ignoredHeaders || []);
        setWarning(d.warning || '');
        setRows(d.rows.map(withKey));
        setFileName(d.fileName || file.name);
        setStep('preview');
      } catch (err) {
        setError(err.message || 'Could not read the file');
      } finally {
        setParsing(false);
      }
    })();
    return false; // stop antd from uploading on its own
  };

  // ── Step 2: edit ───────────────────────────────────────────────────────────
  const updateCell = (key, field, value) => setRows(prev => prev.map(r => (r._key === key ? { ...r, [field]: value } : r)));
  const removeRow = (key) => setRows(prev => prev.filter(r => r._key !== key));
  const addRow = () => {
    setSearch('');
    setRows(prev => [withKey({ _row: null }), ...prev]);
    setPage(1);
  };

  // Search keeps the original row objects, so edits always land on the right row.
  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => visible.some(k => String(r[k] ?? '').toLowerCase().includes(q)));
  }, [rows, search, visible]);

  const validRows = rows.filter(r => String(r.name ?? '').trim());
  const missingNameCount = rows.length - validRows.length;
  const needsCategory = !category && validRows.some(r => !String(r.category ?? '').trim());

  const fieldByKey = useMemo(() => Object.fromEntries(fields.map(f => [f.key, f])), [fields]);
  const hiddenFields = fields.filter(f => !visible.includes(f.key));

  const columns = [
    {
      title: 'Row', dataIndex: '_row', width: 64, fixed: 'left',
      render: v => (v ? v : <Tag color="blue">new</Tag>),
    },
    ...visible.map(k => {
      const f = fieldByKey[k];
      const isName = k === 'name';
      return {
        title: (
          <span className="whitespace-nowrap">
            {f?.label || k}{isName && <span className="text-red-500"> *</span>}
            {!isName && (
              <Tooltip title="Hide column (its values are not sent)">
                <Button
                  type="text"
                  size="small"
                  aria-label={`Hide ${f?.label || k} column`}
                  className="ml-1 !px-1 text-gray-400"
                  onClick={() => setVisible(v => v.filter(x => x !== k))}
                >×</Button>
              </Tooltip>
            )}
          </span>
        ),
        dataIndex: k,
        width: isName ? 240 : f?.type === 'number' ? 110 : 140,
        fixed: isName ? 'left' : undefined,
        render: (v, row) => (
          <Input
            size="small"
            aria-label={`${f?.label || k}, row ${row._row || 'new'}`}
            value={v ?? ''}
            status={isName && !String(v ?? '').trim() ? 'error' : undefined}
            inputMode={f?.type === 'number' ? 'decimal' : undefined}
            placeholder={k === 'code' ? 'auto' : k === 'category' && category ? 'default' : undefined}
            onChange={e => updateCell(row._key, k, e.target.value)}
          />
        ),
      };
    }),
    {
      title: '', key: 'actions', width: 48, fixed: 'right',
      render: (_, row) => (
        <Tooltip title="Remove row">
          <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label="Remove row" onClick={() => removeRow(row._key)} />
        </Tooltip>
      ),
    },
  ];

  // ── Step 3: save ───────────────────────────────────────────────────────────
  const handleSave = async () => {
    // Explain instead of a silently disabled button: the sheet has no Category column.
    if (needsCategory) {
      setError('Select a Category at the top of the preview before saving. Your file has no Category column, so every product needs one (for example Floor Tiles or Wall Tiles).');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // Only visible columns are sent, so a hidden column really is excluded.
      const payloadRows = validRows.map(r => {
        const out = { _row: r._row, _ref: r._key };
        visible.forEach(k => { out[k] = r[k] ?? ''; });
        return out;
      });
      const res = await productService.saveImportRows({ rows: payloadRows, defaultCategory: category, createBrands });
      const d = res.data;
      if (d.imported > 0) onImported?.();
      if (d.imported > 0 && !d.errors.length) {
        message.success(res.message);
        close();
        return;
      }
      // Drop rows that saved, so going back and saving again only re-sends the failed ones.
      const savedRefs = new Set(d.importedItems.map(it => it.ref));
      setRows(prev => prev.filter(r => !savedRefs.has(r._key)));
      setResult(d);
      setStep('result');
    } catch (err) {
      setError(err.message || 'Import failed');
    } finally {
      setSaving(false);
    }
  };

  const title = isPdf ? 'Add Products from PDF' : 'Add Products from Excel';

  const footer = step === 'upload'
    ? [<Button key="c" onClick={close}>Cancel</Button>]
    : step === 'preview'
      ? [
        <Button key="b" icon={<ArrowLeftOutlined />} onClick={reset} disabled={saving}>Choose another file</Button>,
        <Button key="c" onClick={close} disabled={saving}>Cancel</Button>,
        <Button key="s" type="primary" loading={saving} disabled={!validRows.length} onClick={handleSave}>
          Save {validRows.length} Product{validRows.length === 1 ? '' : 's'}
        </Button>,
      ]
      : [
        <Button key="back" disabled={!rows.length} onClick={() => setStep('preview')}>Back to fix rows</Button>,
        <Button key="done" type="primary" onClick={close}>Done</Button>,
      ];

  return (
    <Modal open={open} onCancel={close} title={title} width={step === 'preview' ? 1280 : 820} destroyOnHidden footer={footer} maskClosable={false}>
      {error && <Alert className="mb-3" type="error" showIcon message="Something went wrong" description={error} closable onClose={() => setError('')} />}

      {step === 'upload' && (
        <>
          <div className="mb-3 flex justify-between items-center gap-3">
            <span className="text-sm text-gray-500">
              {isPdf
                ? 'The PDF must contain a text table with a header row (Product Name, Code, Size, MRP...). Scanned image PDFs cannot be read.'
                : 'Row with "Product Name" is used as the header. Your BDM code sheet works as is.'}
            </span>
            {!isPdf && <Button size="small" icon={<DownloadOutlined />} onClick={downloadTemplate}>Download template</Button>}
          </div>
          <Upload.Dragger accept={accept} maxCount={1} showUploadList={false} beforeUpload={handleFile} disabled={parsing}>
            <p className="text-3xl text-blue-500"><InboxOutlined /></p>
            <p className="font-medium">{parsing ? 'Reading file...' : `Click or drag a ${isPdf ? 'PDF' : 'Excel / CSV'} file here`}</p>
            <p className="text-xs text-gray-400">{isPdf ? '.pdf' : '.xlsx or .csv'}, up to 20 MB, first sheet only</p>
          </Upload.Dragger>
        </>
      )}

      {step === 'preview' && (
        <>
          {warning && <Alert className="mb-3" type="warning" showIcon message={warning} />}
          {needsCategory && (
            <Alert
              className="mb-3"
              type="info"
              showIcon
              message="Step 1: choose the Category for these products"
              description="Your file has no Category column. Pick one below (e.g. Floor Tiles) and it is applied to every row with an empty Category."
            />
          )}
          <div className="mb-3 flex flex-wrap gap-3 items-center">
            <span className="text-sm font-medium">Category<span className="text-red-500"> *</span></span>
            <Select
              showSearch
              allowClear
              status={needsCategory ? 'error' : undefined}
              placeholder="Select category (e.g. Floor Tiles)"
              aria-label="Default category for rows with an empty Category"
              className="w-80"
              value={category}
              onChange={setCategory}
              optionFilterProp="label"
              options={categories.map(c => ({ value: c._id, label: c.name }))}
            />
            <Checkbox checked={createBrands} onChange={e => setCreateBrands(e.target.checked)}>Create missing brands</Checkbox>
            <Input
              allowClear
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="Search rows"
              className="w-56"
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
            <Select
              placeholder="Add column"
              className="w-44"
              value={null}
              disabled={!hiddenFields.length}
              onChange={k => setVisible(v => [...v, k])}
              options={hiddenFields.map(f => ({ value: f.key, label: f.label }))}
            />
            <Button icon={<PlusOutlined />} onClick={addRow}>Add row</Button>
          </div>

          <div className="mb-2 flex flex-wrap gap-2 items-center text-sm">
            <span className="text-gray-500">{fileName}</span>
            <Tag color="green">{validRows.length} will be saved</Tag>
            {missingNameCount > 0 && <Tag color="red">{missingNameCount} without a name (not sent)</Tag>}
            {ignoredHeaders.length > 0 && (
              <Tooltip title={ignoredHeaders.join(', ')}>
                <Tag>{ignoredHeaders.length} column{ignoredHeaders.length === 1 ? '' : 's'} ignored</Tag>
              </Tooltip>
            )}
            {needsCategory && <span className="text-red-500">Select a default category, or fill the Category column for every row.</span>}
          </div>

          <Table
            size="small"
            bordered
            rowKey="_key"
            columns={columns}
            dataSource={filteredRows}
            rowClassName={r => (String(r.name ?? '').trim() ? '' : 'bg-red-50')}
            scroll={{ x: 'max-content', y: 440 }}
            pagination={{ current: page, pageSize: PAGE_SIZE, onChange: setPage, showSizeChanger: false, showTotal: t => `${t} rows` }}
          />
        </>
      )}

      {step === 'result' && result && (
        <>
          <Result
            status={result.imported ? 'warning' : 'error'}
            title={`${result.imported} of ${result.total} product${result.total === 1 ? '' : 's'} imported`}
            subTitle={`${result.errors.length} row${result.errors.length === 1 ? ' was' : 's were'} skipped. Imported rows were removed from the preview. Go back, fix the remaining rows, and save again.`}
          />
          <Table
            size="small"
            rowKey={(r, i) => `${r.row}-${r.field}-${i}`}
            dataSource={result.errors}
            pagination={{ pageSize: 20, showSizeChanger: false }}
            columns={[
              { title: 'Row', dataIndex: 'row', width: 70 },
              { title: 'Field', dataIndex: 'field', width: 130, render: f => fieldByKey[f]?.label || f },
              { title: 'Reason', dataIndex: 'message' },
            ]}
          />
        </>
      )}
    </Modal>
  );
}
