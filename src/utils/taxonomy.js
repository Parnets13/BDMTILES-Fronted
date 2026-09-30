/**
 * Taxonomy cascade helpers.
 *
 * The taxonomy is Department → Category → Subcategory, and the backend normalises every
 * option's `category` field to mean "my parent id" — for categories that is the department,
 * for subcategories it is the category. So one pair of helpers drives every cascade in the app.
 *
 * These exist so the same filtering is not re-implemented in each screen. They previously
 * filtered categories by `brand`, which is why a category used to belong to exactly one brand.
 *
 * Brand is deliberately NOT part of this cascade. It is an independent axis: a cement bag may
 * have no brand at all, and one "Tiles" category serves Kajaria, Somany and AGL at once.
 */

/** An option's parent id, tolerating both a raw id and a populated `{ _id }` object. */
export const parentIdOf = (value) => {
  if (!value) return undefined;
  return typeof value === 'object' ? value._id : value;
};

/** Categories belonging to a department. No department selected → every category. */
export const categoriesFor = (filterOptions, departmentId) => {
  const all = filterOptions?.categories || [];
  if (!departmentId) return all;
  return all.filter((c) => String(parentIdOf(c.category)) === String(departmentId));
};

/** Subcategories belonging to a category. No category selected → every subcategory. */
export const subcategoriesFor = (filterOptions, categoryId) => {
  const all = filterOptions?.subcategories || [];
  if (!categoryId) return all;
  return all.filter((s) => String(parentIdOf(s.category)) === String(categoryId));
};

/** The level-1 departments, for the first step of a cascade. */
export const departmentsOf = (filterOptions) => filterOptions?.departments || [];

/** Brand options, unchanged — brands are their own axis. */
export const brandsOf = (filterOptions) => filterOptions?.brands || [];

/** An option's display name, by id. `-` when nothing is chosen or the id is unknown. */
const nameIn = (list, value) => {
  const id = parentIdOf(value);
  if (id === undefined || id === null || id === '') return '-';
  // Compared as strings: an id arrives as an ObjectId on one path and a string on another, and
  // `===` fails silently across the two.
  return (list || []).find((row) => String(row._id) === String(id))?.name || '-';
};

/**
 * Resolve a form value to the name the admin sees.
 *
 * The API names its arrays departments / categories / subcategories for levels 1 / 2 / 3, while
 * the FORM calls level 1 "Category" and level 2 "Subcategory". Three separate bugs came from
 * looking a value up in the array whose NAME matched the field instead of the one holding that
 * LEVEL — and that mismatch fails silently, showing a dash rather than raising an error, so it
 * is easy to ship.
 *
 * The mapping therefore lives here and nowhere else:
 *   form "Category"    -> departments  (level 1)
 *   form "Subcategory" -> categories   (level 2)
 */
export const displayName = {
  brand: (filterOptions, value) => nameIn(filterOptions?.brands, value),
  category: (filterOptions, value) => nameIn(filterOptions?.departments, value),
  subcategory: (filterOptions, value) => nameIn(filterOptions?.categories, value),
};

export default {
  parentIdOf, categoriesFor, subcategoriesFor, departmentsOf, brandsOf, displayName,
};
