import { useState, useEffect } from 'react';
import {
  Card, Input, Select, InputNumber, Button, message,
  Divider, Row, Col, Tag
} from 'antd';
import {
  SearchOutlined, SendOutlined, UndoOutlined, ArrowRightOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import purchaseService from '../../services/purchaseService.js';
import productService from '../../services/productService.js';
import masterService from '../../services/masterService.js';

const StockTransferPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [warehouses, setWarehouses] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);

  const [formData, setFormData] = useState({
    product: '',
    fromWarehouse: '',
    toWarehouse: '',
    shade: '',
    batch: '',
    quantity: 0,
    remarks: '',
  });

  useEffect(() => {
    masterService.getWarehouses({ limit: 100 }).then(r => {
      if (r.success) setWarehouses(r.data);
    }).catch(() => {});
  }, []);

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
    if (!formData.fromWarehouse) { message.error('Please select source warehouse'); return; }
    if (!formData.toWarehouse) { message.error('Please select destination warehouse'); return; }
    if (formData.fromWarehouse === formData.toWarehouse) {
      message.error('Source and destination warehouses must be different');
      return;
    }
    if (!formData.quantity || formData.quantity <= 0) { message.error('Enter a valid quantity'); return; }

    setLoading(true);
    try {
      const res = await purchaseService.transferStock(formData);
      if (res.success) {
        message.success(`${formData.quantity} units transferred successfully!`);
        handleReset();
      }
    } catch (err) {
      message.error(err.message || 'Stock transfer failed');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      product: '', fromWarehouse: '', toWarehouse: '',
      shade: '', batch: '', quantity: 0, remarks: '',
    });
    setSelectedProduct(null);
    setProductSearch('');
  };

  const fromWarehouseName = warehouses.find(w => w._id === formData.fromWarehouse)?.name;
  const toWarehouseName = warehouses.find(w => w._id === formData.toWarehouse)?.name;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Stock Transfer</h1>
        <p className="text-sm text-gray-500 mt-1">
          Transfer stock between warehouses — automatically updates inventory at both locations
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
                placeholder="Search product..."
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
                      <div className="flex justify-between items-start">
                        <div>
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
              <div className="mt-2 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm">
                <div className="font-medium text-blue-800">{selectedProduct.itemName}</div>
                <div className="text-xs text-blue-600 mt-0.5">
                  {selectedProduct.productCode} • Stock Unit: {selectedProduct.unit || 'Box'}
                </div>
              </div>
            )}
          </div>

          <Divider />

          {/* Warehouse Transfer Visual */}
          <div>
            <label className="text-sm font-semibold block mb-3 text-gray-700">Transfer Route *</label>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1.5">From Warehouse</label>
                <Select
                  size="large"
                  className="w-full"
                  placeholder="Select source..."
                  value={formData.fromWarehouse || undefined}
                  onChange={v => setFormData(f => ({ ...f, fromWarehouse: v }))}
                  options={warehouses.map(w => ({
                    value: w._id,
                    label: w.name,
                    disabled: w._id === formData.toWarehouse,
                  }))}
                />
              </div>

              <div className="flex flex-col items-center mt-5">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow">
                  <ArrowRightOutlined className="text-white text-base" />
                </div>
              </div>

              <div className="flex-1">
                <label className="text-xs text-gray-500 block mb-1.5">To Warehouse</label>
                <Select
                  size="large"
                  className="w-full"
                  placeholder="Select destination..."
                  value={formData.toWarehouse || undefined}
                  onChange={v => setFormData(f => ({ ...f, toWarehouse: v }))}
                  options={warehouses.map(w => ({
                    value: w._id,
                    label: w.name,
                    disabled: w._id === formData.fromWarehouse,
                  }))}
                />
              </div>
            </div>
          </div>

          {/* Shade, Batch, Quantity */}
          <Row gutter={16}>
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
            <Col span={12}>
              <label className="text-sm font-semibold block mb-2 text-gray-700">Quantity to Transfer *</label>
              <InputNumber
                size="large"
                className="w-full"
                min={1}
                placeholder="Enter quantity"
                value={formData.quantity || undefined}
                onChange={v => setFormData(f => ({ ...f, quantity: v || 0 }))}
              />
            </Col>
          </Row>

          {/* Remarks */}
          <div>
            <label className="text-sm font-semibold block mb-2 text-gray-700">Remarks</label>
            <Input.TextArea
              rows={2}
              placeholder="Optional — reason for transfer, job order reference, etc."
              value={formData.remarks}
              onChange={e => setFormData(f => ({ ...f, remarks: e.target.value }))}
              maxLength={300}
            />
          </div>

          {/* Preview */}
          {formData.product && formData.fromWarehouse && formData.toWarehouse && formData.quantity > 0 && (
            <div className="p-4 rounded-xl border-2 border-blue-300 bg-blue-50">
              <div className="font-semibold text-blue-800 mb-2">Transfer Summary</div>
              <div className="text-sm space-y-1">
                <div><span className="text-gray-500">Product:</span> <span className="font-medium">{selectedProduct?.itemName}</span></div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500">Route:</span>
                  <span className="font-medium text-orange-700">{fromWarehouseName}</span>
                  <ArrowRightOutlined className="text-blue-500" />
                  <span className="font-medium text-green-700">{toWarehouseName}</span>
                </div>
                {formData.shade && <div><span className="text-gray-500">Shade:</span> {formData.shade}</div>}
                {formData.batch && <div><span className="text-gray-500">Batch:</span> {formData.batch}</div>}
                <div>
                  <span className="text-gray-500">Quantity:</span>{' '}
                  <span className="font-bold text-blue-700">{formData.quantity} units</span>
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
                icon={<SendOutlined />}
                onClick={handleSubmit}
                loading={loading}
              >
                Execute Transfer
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default StockTransferPage;
