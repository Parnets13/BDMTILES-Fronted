import { useState, useEffect } from 'react';
import {
  Card, Form, Input, Select, InputNumber, Button, message,
  Divider, Row, Col, Tag
} from 'antd';
import { PlusCircleOutlined, SearchOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import purchaseService from '../../services/purchaseService.js';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';
import { ProductImage } from '../../components/ImageLightbox.jsx';

const ADJUSTMENT_TYPES = [
  { value: 'add', label: '+ Add (Increase Stock)', color: 'green' },
  { value: 'subtract', label: '− Subtract (Decrease Stock)', color: 'red' },
];

const StockAdjustmentPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [formData, setFormData] = useState({
    product: '',
    warehouse: '',
    shade: '',
    batch: '',
    adjustmentType: 'add',
    quantity: 0,
    reason: '',
  });

  useEffect(() => {
    masterService.getWarehouses({ limit: 100 }).then(r => {
      if (r.success) setWarehouses(r.data);
    }).catch(() => {});
  }, []);

  // Product search debounce
  useEffect(() => {
    if (productSearch.length < 2) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(() => {
      productService.getProducts({ search: productSearch, limit: 15 }).then(r => {
        if (r.success) setProductResults(r.data);
      }).catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const selectProduct = (prod) => {
    setSelectedProduct(prod);
    setProductSearch(prod.itemName);
    setFormData(f => ({ ...f, product: prod._id }));
    setShowDropdown(false);
  };

  const handleSubmit = async () => {
    if (!formData.product) { message.error('Please select a product'); return; }
    if (!formData.warehouse) { message.error('Please select a warehouse'); return; }
    if (!formData.quantity || formData.quantity <= 0) { message.error('Enter a valid quantity'); return; }
    if (!formData.reason || formData.reason.trim().length < 5) { message.error('Enter a detailed reason (min 5 chars)'); return; }

    setLoading(true);
    try {
      const payload = {
        ...formData,
        adjustmentQty: formData.adjustmentType === 'add' ? formData.quantity : -formData.quantity,
      };
      const res = await purchaseService.adjustStock(payload);
      if (res.success) {
        message.success(`Stock ${formData.adjustmentType === 'add' ? 'increased' : 'decreased'} by ${formData.quantity} units!`);
        handleReset();
      }
    } catch (err) {
      message.error(err.message || 'Stock adjustment failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      product: '', warehouse: '', shade: '', batch: '',
      adjustmentType: 'add', quantity: 0, reason: '',
    });
    setSelectedProduct(null);
    setProductSearch('');
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Stock Adjustment</h1>
        <p className="text-sm text-gray-500 mt-1">
          Manually adjust stock quantities for physical audits, damages, or corrections
        </p>
      </div>

      <Card className="shadow-sm">
        <div className="space-y-6">
          {/* Product Search */}
          <div>
            <label className="text-sm font-semibold block mb-2 text-gray-700">
              Product * <span className="text-xs text-gray-400 font-normal">(Search by name or code)</span>
            </label>
            <div className="relative">
              <Input
                size="large"
                prefix={<SearchOutlined className="text-gray-400" />}
                placeholder="Search product by name or code..."
                value={productSearch}
                onChange={e => { setProductSearch(e.target.value); setShowDropdown(true); }}
                onFocus={() => setShowDropdown(true)}
              />
              {showDropdown && productResults.length > 0 && (
                <div className="absolute z-20 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-2xl max-h-64 overflow-y-auto">
                  {productResults.map(p => (
                    <div
                      key={p._id}
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 transition"
                      onClick={() => selectProduct(p)}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <ProductImage src={p.images?.[0]} size="md" />
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-gray-800">{p.itemName}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            {p.productCode} • {p.brand?.name || 'No Brand'}
                          </div>
                        </div>
                        <Tag color="blue" className="text-xs">{p.tileSize || 'N/A'}</Tag>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedProduct && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm flex items-center gap-3">
                <ProductImage src={selectedProduct.images?.[0]} size="lg" />
                <div><div className="font-medium text-blue-800">{selectedProduct.itemName}</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  {selectedProduct.productCode} • Stock Unit: {selectedProduct.unit || 'Box'}
                </div></div>
              </div>
            )}
          </div>

          <Divider className="my-6" />

          {/* Warehouse & Shade/Batch */}
          <Row gutter={16}>
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2 text-gray-700">Warehouse *</label>
              <Select
                size="large"
                className="w-full"
                placeholder="Select warehouse"
                value={formData.warehouse || undefined}
                onChange={v => setFormData(f => ({ ...f, warehouse: v }))}
                options={warehouses.map(w => ({ value: w._id, label: w.name }))}
              />
            </Col>
            <Col span={6}>
              <label className="text-sm font-semibold block mb-2 text-gray-700">Shade</label>
              <Input
                size="large"
                placeholder="Optional"
                value={formData.shade}
                onChange={e => setFormData(f => ({ ...f, shade: e.target.value }))}
              />
            </Col>
            <Col span={6}>
              <label className="text-sm font-semibold block mb-2 text-gray-700">Batch</label>
              <Input
                size="large"
                placeholder="Optional"
                value={formData.batch}
                onChange={e => setFormData(f => ({ ...f, batch: e.target.value }))}
              />
            </Col>
          </Row>

          {/* Adjustment Type & Quantity */}
          <Row gutter={16}>
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2 text-gray-700">Adjustment Type *</label>
              <div className="flex gap-3">
                {ADJUSTMENT_TYPES.map(t => (
                  <div
                    key={t.value}
                    className={`flex-1 border-2 rounded-xl p-4 cursor-pointer transition select-none text-center
                      ${formData.adjustmentType === t.value
                        ? t.value === 'add'
                          ? 'border-green-500 bg-green-50 text-green-700'
                          : 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-500 hover:border-gray-300'
                      }`}
                    onClick={() => setFormData(f => ({ ...f, adjustmentType: t.value }))}
                  >
                    <div className="text-xl font-bold">{t.value === 'add' ? '+' : '−'}</div>
                    <div className="text-xs font-medium mt-1">
                      {t.value === 'add' ? 'Add Stock' : 'Remove Stock'}
                    </div>
                  </div>
                ))}
              </div>
            </Col>
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2 text-gray-700">Quantity *</label>
              <InputNumber
                size="large"
                className="w-full"
                min={1}
                placeholder="Enter quantity"
                value={formData.quantity || undefined}
                onChange={v => setFormData(f => ({ ...f, quantity: v || 0 }))}
              />
              {formData.quantity > 0 && formData.adjustmentType && (
                <div className={`mt-2 text-sm font-medium ${formData.adjustmentType === 'add' ? 'text-green-600' : 'text-red-600'}`}>
                  Stock will {formData.adjustmentType === 'add' ? 'increase' : 'decrease'} by <strong>{formData.quantity}</strong> units
                </div>
              )}
            </Col>
          </Row>

          {/* Reason */}
          <div>
            <label className="text-sm font-semibold block mb-2 text-gray-700">
              Reason for Adjustment *
              <span className="text-xs text-gray-400 font-normal ml-1">(required for audit trail)</span>
            </label>
            <Input.TextArea
              rows={3}
              placeholder="e.g. Physical audit revealed 12 damaged boxes, correcting count. Or: 5 boxes found in transfer crate, adding to Warehouse B."
              value={formData.reason}
              onChange={e => setFormData(f => ({ ...f, reason: e.target.value }))}
              maxLength={500}
              showCount
            />
          </div>

          {/* Preview Banner */}
          {formData.product && formData.warehouse && formData.quantity > 0 && formData.reason && (
            <div className={`p-4 rounded-xl border-2 ${formData.adjustmentType === 'add' ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
              <div className={`font-semibold text-base ${formData.adjustmentType === 'add' ? 'text-green-800' : 'text-red-800'}`}>
                Adjustment Summary
              </div>
              <div className="mt-2 text-sm space-y-1">
                <div><span className="text-gray-500">Product:</span> <span className="font-medium">{selectedProduct?.itemName}</span></div>
                <div><span className="text-gray-500">Warehouse:</span> <span className="font-medium">{warehouses.find(w => w._id === formData.warehouse)?.name}</span></div>
                {formData.shade && <div><span className="text-gray-500">Shade:</span> {formData.shade}</div>}
                {formData.batch && <div><span className="text-gray-500">Batch:</span> {formData.batch}</div>}
                <div><span className="text-gray-500">Action:</span>{' '}
                  <span className={`font-bold ${formData.adjustmentType === 'add' ? 'text-green-700' : 'text-red-700'}`}>
                    {formData.adjustmentType === 'add' ? `+${formData.quantity}` : `-${formData.quantity}`} units
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-between items-center pt-4 border-t">
            <Button icon={<UndoOutlined />} onClick={handleReset} size="large">
              Reset Form
            </Button>
            <div className="flex gap-3">
              <Button size="large" onClick={() => navigate('/inventory/stock')}>
                Back to Stock
              </Button>
              <Button
                type="primary"
                size="large"
                icon={<SaveOutlined />}
                onClick={handleSubmit}
                loading={loading}
                className={formData.adjustmentType === 'subtract' ? 'bg-red-600 hover:bg-red-700 border-red-600' : ''}
              >
                Save Adjustment
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StockAdjustmentPage;
