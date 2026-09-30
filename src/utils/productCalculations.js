/**
 * Auto-calculations for the product form, keyed by a category's stable `systemKey`.
 *
 * Why this exists: tiles have always auto-calculated Sq.Ft per box from the tile size and the
 * pieces per box. Marble and granite need the same idea — a slab is rated per square foot but
 * sold whole — and so do sheets and door units. Copying the tile block five more times would
 * have been five more places to get the arithmetic wrong.
 *
 * So each category declares its inputs and a formula here, and the form renders the result.
 * Adding a seventh is one entry, not another hardcoded block.
 *
 * Tiles is deliberately NOT in this table: its calculation predates this file and writes to a
 * legacy product column the storefront reads. It still works and is left alone. Anything new
 * belongs here.
 *
 * Keyed by `systemKey` rather than by name, so renaming a category cannot silently switch its
 * calculation off.
 *
 * Every rule writes to the SAME output key, `areaPerUnit` — "the area of one selling unit".
 * Only the label differs per category ("Sq.Ft per slab", "Sq.Ft per sheet"). That is deliberate:
 * the pricing and order code reads one field instead of learning a new attribute name for every
 * vertical, and tiles fit the same shape via their legacy `sqftPerBox` column.
 */

/** Square feet in one square metre. */
const SQFT_PER_SQM = 10.7639;

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Pull two dimensions out of free text.
 * Handles "600x600 mm", "8 x 4 ft", "1200x1800", "600 x 1200 MM".
 * Returns null when it cannot read two numbers, so a caller can leave the field blank
 * rather than write a wrong number.
 */
export function parseDimensions(text) {
  if (!text) return null;
  const s = String(text).toLowerCase();
  const numbers = s.match(/\d+(\.\d+)?/g);
  if (!numbers || numbers.length < 2) return null;

  const unit = s.includes('ft') || s.includes('feet') || s.includes('foot') ? 'ft'
    : s.includes('inch') || s.includes('"') ? 'inch'
      : s.includes('cm') ? 'cm'
        : 'mm';

  return { w: Number(numbers[0]), h: Number(numbers[1]), unit };
}

/** Convert a parsed dimension pair to square feet. */
function toSqft({ w, h, unit }) {
  if (unit === 'ft') return w * h;
  if (unit === 'inch') return (w / 12) * (h / 12);
  if (unit === 'cm') return (w / 100) * (h / 100) * SQFT_PER_SQM;
  return (w / 1000) * (h / 1000) * SQFT_PER_SQM;   // mm
}

/**
 * The rules.
 *
 * `inputs` are the attribute keys the formula reads — they are normal Specification fields,
 * so the admin sees and fills them as usual. `output` is written into `Product.attributes`
 * and rendered read-only.
 */
export const CALCULATION_RULES = {
  'stone-slabs': {
    title: 'Slab coverage',
    note: 'A slab is rated per square foot but sold whole, so the area is what the customer is billed for.',
    inputs: ['slabLength', 'slabWidth'],
    output: { key: 'areaPerUnit', label: 'Sq.Ft per slab', unit: 'sqft' },
    compute: (v) => {
      const l = Number(v.slabLength);
      const w = Number(v.slabWidth);
      if (!Number.isFinite(l) || !Number.isFinite(w) || l <= 0 || w <= 0) return null;
      return round2(l * w);
    },
  },

  'doors-windows': {
    title: 'Unit area',
    note: 'Doors and windows are priced per square foot of the finished unit.',
    inputs: ['width', 'height'],
    output: { key: 'areaPerUnit', label: 'Sq.Ft per unit', unit: 'sqft' },
    compute: (v) => {
      const w = Number(v.width);
      const h = Number(v.height);
      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
      return round2(toSqft({ w, h, unit: 'mm' }));
    },
  },

  'plywood-boards': {
    title: 'Sheet coverage',
    note: 'Derived from the sheet size — a 8 x 4 ft sheet is 32 sq.ft.',
    inputs: ['sheetSize'],
    output: { key: 'areaPerUnit', label: 'Sq.Ft per sheet', unit: 'sqft' },
    compute: (v) => {
      const d = parseDimensions(v.sheetSize);
      return d ? round2(toSqft(d)) : null;
    },
  },

  'laminates-veneers': {
    title: 'Sheet coverage',
    note: 'Derived from the sheet size — a 8 x 4 ft sheet is 32 sq.ft.',
    inputs: ['sheetSize'],
    output: { key: 'areaPerUnit', label: 'Sq.Ft per sheet', unit: 'sqft' },
    compute: (v) => {
      const d = parseDimensions(v.sheetSize);
      return d ? round2(toSqft(d)) : null;
    },
  },
};

/** The rule for a category, or null when it has none. */
export const ruleForCategory = (category) =>
  (category?.systemKey ? CALCULATION_RULES[category.systemKey] : null) || null;

/**
 * Run a rule against current form values.
 *
 * Returns `{ value, missing }` — `missing` lists the inputs that are still blank, so the form
 * can say "enter the slab length and width" rather than showing an unexplained empty box.
 */
export function computeFor(rule, attributes = {}) {
  if (!rule) return { value: null, missing: [] };

  const values = {};
  const missing = [];
  for (const key of rule.inputs) {
    const raw = attributes[key];
    if (raw === undefined || raw === null || raw === '') missing.push(key);
    values[key] = raw;
  }
  if (missing.length) return { value: null, missing };

  try {
    const value = rule.compute(values);
    return { value: Number.isFinite(value) ? value : null, missing: [] };
  } catch {
    // A malformed input must never break the form — just leave the result blank.
    return { value: null, missing: [] };
  }
}

export default { CALCULATION_RULES, ruleForCategory, computeFor, parseDimensions };
