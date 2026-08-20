import { useState, useEffect, useRef } from 'react';
import { Button, Input, Select, InputNumber, Space, message, Row, Col, Card, Tabs, Table, Tag } from 'antd';
import { PrinterOutlined, BarcodeOutlined, SearchOutlined, ReloadOutlined, QrcodeOutlined } from '@ant-design/icons';
import api from '../../config/api.js';

const BarcodeLabelPage = () => {
  const [activeTab, setActiveTab] = useState('product');
  const [products, setProducts] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [labelQty, setLabelQty] = useState(1);
  const [labelSize, setLabelSize] = useState('50x25');
  const printRef = useRef(null);

  // Search products
  useEffect(() => {
    if (productSearch.length >= 2) {
      const timer = setTimeout(() => {
        api.get('/products', { params: { search: productSearch, limit: 20, status: 'active' } }).then(r => {
          if (r.success) setProducts(r.data || []);
        }).catch(() => {});
      }, 300);
      return () => clearTimeout(timer);
    } else { setProducts([]); }
  }, [productSearch]);

  const addProduct = (p) => {
    if (selectedProducts.find(sp => sp._id === p._id)) return;
    setSelectedProducts(prev => [...prev, { ...p, qty: labelQty }]);
    setProductSearch(''); setProducts([]);
  };

  const generateBarcodeSVG = (value, width = 2, height = 40) => {
    // Simple Code128-like barcode using SVG (lightweight alternative to JsBarcode library)
    const chars = value.split('');
    let bars = '';
    let x = 0;
    const narrow = width;
    const wide = width * 2.5;
    
    // Start pattern
    chars.forEach((char, i) => {
      const code = char.charCodeAt(0);
      const barWidth = (code % 2 === 0) ? narrow : wide;
      const isBar = i % 2 === 0;
      if (isBar) {
        bars += `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`;
      }
      x += barWidth;
    });
    
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${x + 10}" height="${height + 20}" viewBox="0 0 ${x + 10} ${height + 20}">
      <g transform="translate(5,5)">${bars}</g>
      <text x="${(x + 10) / 2}" y="${height + 16}" text-anchor="middle" font-size="10" font-family="monospace">${value}</text>
    </svg>`;
  };

  const handlePrint = () => {
    if (!printRef.current) return;
    const win = window.open('', '_blank');
    win.document.write(`<html><head><title>Labels</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family: 'Courier New', monospace; }
      .label-grid { display: flex; flex-wrap: wrap; gap: 2mm; padding: 5mm; }
      .label { border: 1px dashed #ccc; padding: 2mm; text-align: center; page-break-inside: avoid; }
      .label-50x25 { width: 50mm; height: 25mm; }
      .label-70x40 { width: 70mm; height: 40mm; }
      .label-100x50 { width: 100mm; height: 50mm; }
      .label .code { font-size: 8px; font-weight: bold; margin-top: 1mm; }
      .label .name { font-size: 7px; margin-top: 1mm; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
      .label .size { font-size: 6px; color: #666; }
      .label .price { font-size: 9px; font-weight: bold; margin-top: 1mm; }
      .label .barcode { margin: 1mm auto; }
      .label img { max-width: 100%; height: auto; }
      @media print { 
        .label { border: none; } 
        body { padding: 0; }
      }
    </style></head><body>${printRef.current.innerHTML}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  const generateZPL = (product) => {
    // Zebra ZPL format for label printers
    return `^XA
^FO20,20^A0N,25,25^FD${product.productCode}^FS
^FO20,50^A0N,18,18^FD${(product.itemName || '').substring(0, 30)}^FS
^FO20,75^A0N,15,15^FD${product.tileSize || ''} ${product.finish || ''}^FS
^FO20,100^BY2^BCN,50,Y,N,N^FD${product.productCode}^FS
^FO20,165^A0N,20,20^FDMRP: Rs.${product.mrp || 0}^FS
^XZ`;
  };

  const copyZPL = () => {
    const zpl = selectedProducts.map(p => generateZPL(p)).join('\n\n');
    navigator.clipboard.writeText(zpl).then(() => message.success('ZPL copied to clipboard'));
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Barcode & Label Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Generate product barcodes, rack labels, dispatch labels for printing</p>
        </div>
        <Space>
          <Button icon={<PrinterOutlined />} type="primary" onClick={handlePrint} disabled={selectedProducts.length === 0}>Print Labels</Button>
          <Button icon={<QrcodeOutlined />} onClick={copyZPL} disabled={selectedProducts.length === 0}>Copy ZPL (Zebra)</Button>
        </Space>
      </div>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        { key: 'product', label: <span><BarcodeOutlined /> Product Labels</span> },
        { key: 'rack', label: 'Rack Labels' },
        { key: 'dispatch', label: 'Dispatch Labels' },
      ]} />

      {/* Settings */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[250px]">
            <label className="text-xs text-gray-500 block mb-1">Search Product</label>
            <div className="relative">
              <Input value={productSearch} onChange={e => setProductSearch(e.target.value)} placeholder="Type product name or code..."
                prefix={<SearchOutlined className="text-gray-400" />} />
              {products.length > 0 && (
                <div className="absolute z-50 left-0 top-full mt-1 w-full bg-white border rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {products.filter(p => !selectedProducts.some(sp => sp._id === p._id)).map(p => (
                    <div key={p._id} className="px-3 py-2 hover:bg-orange-50 cursor-pointer border-b border-gray-50 flex items-center gap-2" onClick={() => addProduct(p)}>
                      {p.images?.[0] && <img src={p.images[0]} className="w-7 h-7 rounded object-cover border" />}
                      <div className="flex-1"><div className="text-sm font-medium">{p.itemName}</div><div className="text-[10px] text-gray-400">{p.productCode} · {p.tileSize} · MRP ₹{p.mrp}</div></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Label Size</label>
            <Select value={labelSize} onChange={setLabelSize} className="w-32"
              options={[{ value: '50x25', label: '50×25mm' }, { value: '70x40', label: '70×40mm' }, { value: '100x50', label: '100×50mm' }]} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Qty per Product</label>
            <InputNumber min={1} max={100} value={labelQty} onChange={v => setLabelQty(v || 1)} className="w-20" />
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => setSelectedProducts([])}>Clear All</Button>
        </div>
      </div>

      {/* Selected Products */}
      {selectedProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
          <div className="font-semibold text-gray-700 mb-2">Selected Products ({selectedProducts.length})</div>
          <table className="w-full text-xs">
            <thead className="bg-gray-50"><tr>{['Image','Product','Code','Size','MRP','Labels',''].map(h => <th key={h} className="px-2 py-1.5 text-left font-semibold text-gray-600">{h}</th>)}</tr></thead>
            <tbody>{selectedProducts.map((p, i) => (
              <tr key={p._id} className="border-t border-gray-100">
                <td className="px-2 py-1.5">{p.images?.[0] && <img src={p.images[0]} className="w-8 h-8 rounded object-cover" />}</td>
                <td className="px-2 py-1.5 font-medium">{p.itemName}</td>
                <td className="px-2 py-1.5 font-mono">{p.productCode}</td>
                <td className="px-2 py-1.5">{p.tileSize || '—'}</td>
                <td className="px-2 py-1.5">₹{p.mrp || 0}</td>
                <td className="px-2 py-1.5"><InputNumber min={1} max={100} value={p.qty} size="small" className="w-14"
                  onChange={v => { const n = [...selectedProducts]; n[i].qty = v || 1; setSelectedProducts(n); }} /></td>
                <td className="px-2 py-1.5"><Button type="text" size="small" danger onClick={() => setSelectedProducts(prev => prev.filter(sp => sp._id !== p._id))}>✕</Button></td>
              </tr>
            ))}</tbody>
          </table>
          <div className="text-xs text-gray-400 mt-2">Total labels: {selectedProducts.reduce((s, p) => s + (p.qty || 1), 0)}</div>
        </div>
      )}

      {/* Print Preview (hidden) */}
      <div className="hidden">
        <div ref={printRef}>
          <div className="label-grid">
            {selectedProducts.flatMap(p => Array.from({ length: p.qty || 1 }).map((_, qi) => (
              <div key={`${p._id}-${qi}`} className={`label label-${labelSize}`}>
                <div className="code">{p.productCode}</div>
                <div className="name">{p.itemName}</div>
                <div className="size">{p.tileSize} {p.finish} {p.colour}</div>
                {activeTab === 'product' && <div className="price">MRP ₹{p.mrp || 0}</div>}
                {activeTab === 'rack' && <div className="price">Rack: ___</div>}
                {activeTab === 'dispatch' && <div className="price">SO: ___</div>}
                <div className="barcode" style={{fontFamily:'monospace',fontSize:'8px',letterSpacing:'2px'}}>||||| {p.productCode} |||||</div>
              </div>
            )))}
          </div>
        </div>
      </div>

      {/* Label Preview (on-screen) */}
      {selectedProducts.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="font-semibold text-gray-700 mb-3">Label Preview</div>
          <div className="flex flex-wrap gap-3">
            {selectedProducts.slice(0, 6).map(p => (
              <div key={p._id} className="border border-dashed border-gray-300 rounded p-3 text-center" style={{ width: labelSize === '50x25' ? '180px' : labelSize === '70x40' ? '240px' : '320px' }}>
                <div className="text-[10px] font-bold font-mono">{p.productCode}</div>
                <div className="text-[9px] truncate mt-0.5">{p.itemName}</div>
                <div className="text-[8px] text-gray-500">{p.tileSize} · {p.finish}</div>
                <div className="my-1 font-mono text-[8px] tracking-widest text-gray-600">|||||||||||||||||||||||||</div>
                <div className="text-[10px] font-bold">MRP ₹{p.mrp || 0}</div>
                <div className="text-[8px] text-gray-400 mt-0.5">×{p.qty} labels</div>
              </div>
            ))}
            {selectedProducts.length > 6 && <div className="flex items-center text-xs text-gray-400">+{selectedProducts.length - 6} more...</div>}
          </div>
        </div>
      )}

      {selectedProducts.length === 0 && (
        <div className="bg-white rounded-lg border border-dashed border-gray-300 p-12 text-center">
          <BarcodeOutlined className="text-4xl text-gray-300" />
          <div className="text-gray-400 mt-3">Search and add products above to generate labels</div>
        </div>
      )}
    </div>
  );
};

export default BarcodeLabelPage;
