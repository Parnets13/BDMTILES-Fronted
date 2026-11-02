/**
 * GSTIN helpers for the Company master.
 *
 * Mirrors BDMTILES-Backend/utils/gstin.js so the form can validate and preview
 * PAN/state as the user types instead of only finding out on save.
 */

export const GST_STATES = [
  { code: '01', name: 'Jammu & Kashmir' },
  { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' },
  { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' },
  { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' },
  { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' },
  { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' },
  { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' },
  { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' },
  { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' },
  { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' },
  { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' },
  { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' },
  { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' },
  { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' },
  { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' },
  { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' },
  { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' },
  { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' },
  { code: '38', name: 'Ladakh' },
  { code: '97', name: 'Other Territory' },
  { code: '99', name: 'Centre Jurisdiction' },
];

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export const GSTIN_HINT = '15 characters, e.g. 29ABCDE1234F1Z5';

export const normalizeGstin = (value) => String(value || '').toUpperCase().replace(/[\s-]/g, '');

export const gstStateName = (stateCode) => GST_STATES.find((state) => state.code === stateCode)?.name || '';

export const isValidGstin = (value) => {
  const gstin = normalizeGstin(value);
  if (!GSTIN_PATTERN.test(gstin)) return false;
  return GST_STATES.some((state) => state.code === gstin.slice(0, 2));
};

export const derivePan = (value) => {
  const gstin = normalizeGstin(value);
  return gstin.length === 15 ? gstin.slice(2, 12) : '';
};

/** Form.Item `normalize`: uppercase, strip separators, cap at 15 characters. */
export const normalizeGstinInput = (value) => normalizeGstin(value).slice(0, 15);

/**
 * Shared antd validation rule for every GSTIN field in the app, so Company,
 * Branch, Dealer, Supplier and Customer cannot drift apart again.
 * Blank is allowed unless `required` — a GSTIN is optional on most masters.
 */
export const gstinFormRule = ({ required = false } = {}) => ({
  validator: (_, value) => {
    if (!value) {
      return required
        ? Promise.reject(new Error('GST number is required'))
        : Promise.resolve();
    }
    return isValidGstin(value)
      ? Promise.resolve()
      : Promise.reject(new Error(`Enter a valid GST number — ${GSTIN_HINT}`));
  },
});
