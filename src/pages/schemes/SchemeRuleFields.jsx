import { Button, Input, InputNumber, Select } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

export const emptyRule = (partyType) => ({
  schemeName: '',
  basis: partyType === 'dealer' ? 'invoice_value' : 'purchase_value',
  calculationType: 'percentage',
  targetAmount: 0,
  targetQuantity: 0,
  rate: 0,
  fixedAmount: 0,
  paymentWithinDays: 0,
  startDate: '',
  endDate: '',
  termsAndConditions: '',
  slabs: [{ from: 0, to: null, rate: 0, fixedAmount: 0 }],
});

const CALCULATIONS = [
  { value: 'fixed', label: 'Fixed amount after target' },
  { value: 'percentage', label: 'Percentage of eligible value' },
  { value: 'per_unit', label: 'Amount per eligible unit' },
  { value: 'highest_slab', label: 'Highest achieved slab' },
  { value: 'progressive_slab', label: 'Progressive slabs' },
];

const SchemeRuleFields = ({ partyType, value, onChange }) => {
  const set = (field, next) => onChange({ ...value, [field]: next });
  const isQuantity = value.basis?.endsWith('quantity');
  const usesSlabs = ['highest_slab', 'progressive_slab'].includes(value.calculationType);
  const updateSlab = (index, field, next) => set('slabs', value.slabs.map((row, rowIndex) => (
    rowIndex === index ? { ...row, [field]: next } : row
  )));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Scheme name *</label>
          <Input value={value.schemeName} onChange={event => set('schemeName', event.target.value)} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">Authoritative basis *</label>
          <Select className="w-full" value={value.basis} onChange={basis => {
            const quantity = basis.endsWith('quantity');
            let calculationType = value.calculationType;
            if (quantity && calculationType === 'percentage') calculationType = 'per_unit';
            if (!quantity && calculationType === 'per_unit') calculationType = 'percentage';
            onChange({ ...value, basis, calculationType, products: basis === 'confirmed_payment' ? [] : value.products });
          }} options={partyType === 'dealer' ? [
            { value: 'invoice_value', label: 'Tax invoice taxable value − posted returns' },
            { value: 'invoice_quantity', label: 'Tax invoice quantity − posted returns' },
            { value: 'confirmed_payment', label: 'Confirmed allocated receipts − posted returns' },
          ] : [
            { value: 'purchase_value', label: 'Verified invoice taxable value − posted returns' },
            { value: 'purchase_quantity', label: 'Verified invoice quantity − posted returns' },
            { value: 'confirmed_payment', label: 'Confirmed allocated supplier payments − posted returns' },
          ]} /></div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Calculation *</label>
          <Select className="w-full" value={value.calculationType} onChange={calculationType => set('calculationType', calculationType)}
            options={CALCULATIONS.filter(row => isQuantity ? row.value !== 'percentage' : row.value !== 'per_unit')} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">{isQuantity ? 'Target quantity' : 'Target amount (₹)'}</label>
          <InputNumber className="w-full" min={0} value={isQuantity ? value.targetQuantity : value.targetAmount}
            onChange={next => set(isQuantity ? 'targetQuantity' : 'targetAmount', next || 0)} /></div>
        {value.basis === 'confirmed_payment' ? (
          <div><label className="text-xs text-gray-500 block mb-1">Payment within days (0 = scheme period)</label>
            <InputNumber className="w-full" min={0} max={365} precision={0} value={value.paymentWithinDays}
              onChange={next => set('paymentWithinDays', next || 0)} /></div>
        ) : <div />}
      </div>

      {!usesSlabs && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {value.calculationType === 'fixed' ? (
            <div><label className="text-xs text-gray-500 block mb-1">Fixed incentive amount (₹) *</label>
              <InputNumber className="w-full" min={0} value={value.fixedAmount} onChange={next => set('fixedAmount', next || 0)} /></div>
          ) : (
            <div><label className="text-xs text-gray-500 block mb-1">{isQuantity ? 'Rate per unit (₹)' : 'Incentive rate (%)'} *</label>
              <InputNumber className="w-full" min={0} max={isQuantity ? undefined : 100} value={value.rate}
                onChange={next => set('rate', next || 0)} /></div>
          )}
        </div>
      )}

      {usesSlabs && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="font-semibold text-sm">{value.calculationType === 'highest_slab' ? 'Achievement slabs' : 'Contiguous progressive slabs'}</div>
              <div className="text-xs text-gray-400">Thresholds use {isQuantity ? 'net quantity' : 'net eligible value'}.</div>
            </div>
            <Button size="small" icon={<PlusOutlined />} onClick={() => set('slabs', [...value.slabs, {
              from: value.slabs.at(-1)?.to || 0, to: null, rate: 0, fixedAmount: 0,
            }])}>Add slab</Button>
          </div>
          <div className="overflow-x-auto border rounded">
            <table className="w-full text-xs">
              <thead className="bg-gray-50"><tr><th className="p-2 text-left">From (inclusive)</th><th className="p-2 text-left">To (exclusive; blank = open)</th><th className="p-2 text-left">{isQuantity ? '₹ / unit' : 'Rate %'}</th>{value.calculationType === 'highest_slab' && <th className="p-2 text-left">Or fixed ₹</th>}<th /></tr></thead>
              <tbody>{value.slabs.map((slab, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2"><InputNumber min={0} value={slab.from} onChange={next => updateSlab(index, 'from', next || 0)} /></td>
                  <td className="p-2"><InputNumber min={0} value={slab.to} onChange={next => updateSlab(index, 'to', next ?? null)} /></td>
                  <td className="p-2"><InputNumber min={0} max={isQuantity ? undefined : 100} value={slab.rate} onChange={next => {
                    const rate = next || 0;
                    const rows = value.slabs.map((row, rowIndex) => rowIndex === index
                      ? { ...row, rate, fixedAmount: rate > 0 ? 0 : row.fixedAmount }
                      : row);
                    set('slabs', rows);
                  }} /></td>
                  {value.calculationType === 'highest_slab' && <td className="p-2"><InputNumber min={0} value={slab.fixedAmount} onChange={next => {
                    const fixedAmount = next || 0;
                    const rows = value.slabs.map((row, rowIndex) => rowIndex === index
                      ? { ...row, fixedAmount, rate: fixedAmount > 0 ? 0 : row.rate }
                      : row);
                    set('slabs', rows);
                  }} /></td>}
                  <td className="p-2">{value.slabs.length > 1 && <Button danger type="text" size="small" onClick={() => set('slabs', value.slabs.filter((_, rowIndex) => rowIndex !== index))}>Remove</Button>}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div><label className="text-xs text-gray-500 block mb-1">Start date *</label>
          <Input type="date" value={value.startDate} onChange={event => set('startDate', event.target.value)} /></div>
        <div><label className="text-xs text-gray-500 block mb-1">End date *</label>
          <Input type="date" value={value.endDate} onChange={event => set('endDate', event.target.value)} /></div>
      </div>
      <div><label className="text-xs text-gray-500 block mb-1">Terms and conditions</label>
        <Input.TextArea rows={2} value={value.termsAndConditions} onChange={event => set('termsAndConditions', event.target.value)} /></div>
      <div className="rounded border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
        Amounts are recalculated from branch-owned invoices, posted returns, and confirmed allocations at approval. Points and gifts are not offered because no redemption ledger exists.
      </div>
    </div>
  );
};

export default SchemeRuleFields;
