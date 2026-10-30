import { useState, useEffect, useCallback } from 'react';
import { Table, Button, Input, Select, Tag, Space, Form, InputNumber, Switch, message, Popconfirm, Tooltip, Row, Col, Divider, Card, Statistic, Modal, Spin, Alert } from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, ReloadOutlined, ShopOutlined } from '@ant-design/icons';
import productService from '../../services/productService.js';
import attributeService from '../../services/attributeService.js';
import { categoriesFor, displayName } from '../../utils/taxonomy.js';
import { ruleForCategory, computeFor } from '../../utils/productCalculations.js';
import ModuleRecycleBin from '../../components/ModuleRecycleBin.jsx';
import getImageUrl from '../../utils/imageUrl.js';
import { useConfirm } from '../../components/ConfirmModal.jsx';
import { ProductImage } from '../../components/ImageLightbox.jsx';
import { API_ORIGIN } from '../../config/api.js';

const TILE_SIZES = [
  // Mosaic / small
  '50x50','75x75','100x100','100x200','100x300','150x150','150x300',
  // Standard small
  '200x200','200x300','200x400','200x600',
  '250x375','250x500',
  '300x300','300x450','300x600','300x900',
  '400x400','400x600','400x800',
  // Mid-size
  '600x600','600x900','600x1200',
  '800x800','800x1200','800x1600',
  // Large format
  '1000x1000',
  '1200x1200','1200x1800','1200x2400',
  '1600x1600','1600x3200',
  '800x2400',
];

/**
 * Area of one tile in sqft, keyed by "WxH" (mm).
 * Formula: (W/1000) * (H/1000) * 10.7639
 * Values rounded to 4 decimal places.
 */
export const SQFT_PER_TILE = {
  '50x50':     0.0269, '75x75':     0.0605, '100x100':   0.1076, '100x200':   0.2153,
  '100x300':   0.3229, '150x150':   0.2422, '150x300':   0.4844,
  '200x200':   0.4306, '200x300':   0.6458, '200x400':   0.8611, '200x600':   1.2917,
  '250x375':   1.0073, '250x500':   1.3444,
  '300x300':   0.9688, '300x450':   1.4532, '300x600':   1.9375, '300x900':   2.9063,
  '400x400':   1.7222, '400x600':   2.5833, '400x800':   3.4444,
  '600x600':   3.8750, '600x900':   5.8125, '600x1200':  7.7500,
  '800x800':   6.8889, '800x1200': 10.3333, '800x1600': 13.7778, '800x2400': 20.6667,
  '1000x1000':10.7639,
  '1200x1200':15.5000, '1200x1800':23.2500, '1200x2400':31.0000,
  '1600x1600':27.6000, '1600x3200':55.2000,
};

/**
 * Square feet of one tile, from its "WxH" size in millimetres.
 *
 * Computed rather than read from SQFT_PER_TILE below, because the admin can now add a tile size
 * at runtime and the table cannot cover a size that did not exist when it was written. Two of
 * the table's entries were also hand-rounded away from the correct value (1600x1600 is 27.5556,
 * not 27.6), so computing is both more general and more accurate.
 */
export const sqftPerTile = (size) => {
  const match = /^\s*(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)\s*$/.exec(String(size || ''));
  if (!match) return null;
  const metres = (Number(match[1]) / 1000) * (Number(match[2]) / 1000);
  return Math.round(metres * 10.7639 * 10000) / 10000;
};

/** Auto-compute sqftPerBox = sqftPerTile × pcsPerBox. Returns null if either is unknown. */
export const calcSqftPerBox = (tileSize, pcsPerBox) => {
  const perTile = sqftPerTile(tileSize) ?? SQFT_PER_TILE[tileSize];
  if (!perTile || !pcsPerBox || pcsPerBox <= 0) return null;
  return Math.round(perTile * pcsPerBox * 100) / 100; // 2 decimal places
};

/**
 * Application is a MULTI-SELECT in the form but a single string in the database.
 *
 * The customer website and the dealer app both filter it with a regex against a string
 * (`new RegExp(applicationArea, 'i')`) and list distinct values for their facet, so changing the
 * field to an array would break both. Comma-joining keeps every existing consumer working while
 * letting one tile declare several areas, which is the common case — a 600x600 vitrified tile is
 * a floor tile, a wall tile and a bathroom tile at once.
 *
 * LIMITATION: the website's "By Application" facet lists the joined string as one value, so
 * "Floor, Wall" shows as a single filter option rather than two. Fixing that properly means an
 * array field plus a facet that unions both — a change to the shop API, so it is left alone here.
 */
export const splitApplications = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
};

export const joinApplications = (value) => {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value || '').trim();
};

/**
 * The format each addable field expects, mirrored from the server's config/productOptions.js.
 *
 * Mirrored rather than fetched so the form can state the expected format BEFORE the admin
 * submits, instead of bouncing them off the API. The server re-validates and normalises — it is
 * the authority; this only saves a round trip on the common mistake.
 *
 * Only fields where a free-text value would actually break something have a rule. Tile Size is
 * the one that matters: SqFt/Box is computed by parsing "WxH", so a size stored as "1010"
 * silently produces no calculation at all.
 */
const OPTION_HINTS = {
  tileSize: 'Width x height in mm — for example 600x600 or 10x10.',
  thickness: 'A measurement in mm — for example 10mm.',
  antiSkid: 'R followed by a number — for example R10.',
  grade: 'A short code of up to 3 letters or digits — for example A or AA1.',
};

/** Client-side pre-check. Returns an error message, or null when the value looks right. */
const optionValueError = (field, rawValue) => {
  const value = String(rawValue || '').trim().replace(/\s+/g, ' ');
  if (!value) return 'Enter a value to add.';
  if (field === 'tileSize') {
    return /^\d+(?:\.\d+)?\s*[xX×*]\s*\d+(?:\.\d+)?$/.test(value) ? null : OPTION_HINTS.tileSize;
  }
  if (field === 'thickness') {
    return /^\d+(?:\.\d+)?\s*(mm|cm)?$/i.test(value) ? null : OPTION_HINTS.thickness;
  }
  if (field === 'antiSkid') {
    return /^r\s*\d{1,2}$/i.test(value) ? null : OPTION_HINTS.antiSkid;
  }
  if (field === 'grade') {
    return /^[A-Za-z0-9]{1,3}$/.test(value) ? null : OPTION_HINTS.grade;
  }
  return null;
};

/**
 * A specification dropdown with a "+" beside it.
 *
 * The "+" sits outside the dropdown rather than as a footer row inside it: these lists run to
 * 30+ entries, and an add action that only appears at the bottom of a scrolled list is easy to
 * miss. It is a plain Button so it also works with the keyboard.
 */
const SpecSelect = ({ name, label, options, mode, placeholder, tooltip, rules, onChange, onAdd }) => (
  <Form.Item label={label} tooltip={tooltip} required={Boolean(rules?.length)}>
    <Space.Compact style={{ width: '100%' }}>
      <Form.Item name={name} noStyle rules={rules}>
        <Select
          mode={mode}
          placeholder={placeholder}
          allowClear
          showSearch
          optionFilterProp="label"
          options={(options || []).map((value) => ({ value, label: value }))}
          style={{ width: '100%' }}
          onChange={onChange}
        />
      </Form.Item>
      <Tooltip title={`Add a new ${label.toLowerCase()}`}>
        <Button icon={<PlusOutlined />} onClick={() => onAdd(name, label)} />
      </Tooltip>
    </Space.Compact>
  </Form.Item>
);
const FINISHES = ['Glossy','Matt','Sugar','Carving','Satin','Rustic','Polished','Lapato','High Gloss','Anti-Skid','Rocker','Book Match'];
// Fallbacks for the dropdowns that used to be free-text inputs. The server list
// (/products/options) supersedes these; they exist so the form still works if that call fails.
const SURFACES = ['Smooth','Rough','Textured','Structured','Matt','Polished'];
const COLOURS = ['White','Ivory','Beige','Grey','Charcoal','Black','Brown','Blue','Green','Pink','Yellow','Multi Colour'];
const THICKNESSES = ['6mm','7mm','8mm','9mm','10mm','12mm','15mm','20mm'];
const GRADES = ['A','B','C'];
const UNITS = ['Box','Piece','SqFt','Kg','Meter','Litre','Set','Nos'];
const GST_RATES = [0, 5, 12, 18, 28];
const TILE_TYPES = ['Ceramic','Vitrified','GVT','PGVT','Double Charge','Full Body','Porcelain','Slab','Natural Stone','Granite','Marble'];
const APPLICATION_AREAS = ['Floor','Wall','Bathroom','Kitchen','Parking','Elevation','Outdoor','Swimming Pool','Commercial','Industrial'];
const ANTI_SKID = ['','R9','R10','R11','R12','R13'];
const ORIGINS = ['India','Spain','Italy','China','Vietnam','Indonesia','Turkey'];

const ProductMaster = () => {
  const { confirm, alertModal } = useConfirm();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ department: undefined, brand: undefined, category: undefined, subcategory: undefined, status: undefined, tileSize: undefined, finish: undefined, tileType: undefined, applicationArea: undefined });
  const [filterOptions, setFilterOptions] = useState({ brands: [], departments: [], categories: [], subcategories: [] });
  const [stats, setStats] = useState({ total: 0, active: 0, inactive: 0, draft: 0 });

  // Attribute definitions for the currently selected category, inherited from its ancestors.
  // This is what makes one product form serve every vertical: tiles get size/finish/surface,
  // cement gets grade/pack size, and neither sees the other's fields.
  const [categoryAttributes, setCategoryAttributes] = useState([]);
  const [loadingAttributes, setLoadingAttributes] = useState(false);
  // How many attribute definitions each category declares, keyed by category id.
  // Lets the Specifications card distinguish "this category has no fields" from
  // "its fields are on its subcategories — pick one", which are very different messages.
  const [attributeIndex, setAttributeIndex] = useState({});

  // Drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [form] = Form.useForm();

  // Specification dropdown lists, served by the API as `{ tileSize: [...], finish: [...], ... }`.
  // Empty until the fetch lands, and each field falls back to the constant above in the
  // meantime, so the form is usable even if this request fails.
  const [specOptions, setSpecOptions] = useState({});
  // The values this branch ADDED, as `{ _id, field, value }`. Only these can be removed — the
  // built-in ones live in the backend's config and are not rows at all.
  const [customOptions, setCustomOptions] = useState([]);
  // The "+" flow: which list is being added to, the value typed so far, and any format error.
  const [addOptionTarget, setAddOptionTarget] = useState(null);
  const [newOptionValue, setNewOptionValue] = useState('');
  // Tile size is entered as two numbers rather than one string, so "1010" cannot be typed at all.
  const [newSizeWidth, setNewSizeWidth] = useState('');
  const [newSizeHeight, setNewSizeHeight] = useState('');
  const [newOptionError, setNewOptionError] = useState('');
  const [savingOption, setSavingOption] = useState(false);

  const optionsFor = useCallback(
    (field, fallback) => specOptions[field] || fallback || [],
    [specOptions],
  );

  const openAddOption = useCallback((field, label) => {
    setNewOptionValue('');
    setNewSizeWidth('');
    setNewSizeHeight('');
    setNewOptionError('');
    setAddOptionTarget({ field, label });
  }, []);

  /** Save a new dropdown value, then put it straight on the form — they added it to use it. */
  const submitNewOption = async () => {
    if (!addOptionTarget) return;
    const field = addOptionTarget.field;

    // Tile size is two numbers, so the malformed "1010" cannot be produced in the first place.
    let raw;
    if (field === 'tileSize') {
      if (!newSizeWidth || !newSizeHeight) {
        setNewOptionError('Enter both width and height.');
        return;
      }
      raw = `${newSizeWidth}x${newSizeHeight}`;
    } else {
      raw = newOptionValue;
    }

    // Check the format here first: the server would reject it anyway, and the admin should see
    // why without waiting for a round trip.
    const invalid = optionValueError(field, raw);
    if (invalid) { setNewOptionError(invalid); return; }

    setNewOptionError('');
    setSavingOption(true);
    try {
      const res = await productService.addSpecOption(field, raw);
      if (!res.success) throw new Error(res.message);
      // The API returns every list, so one response refreshes all ten dropdowns.
      setSpecOptions(res.data || {});
      setCustomOptions(res.custom || []);
      message.success(res.message || 'Added.');

      // Use the value the SERVER normalised, not what was typed — "600 x 600" is stored and
      // selected as "600x600", and the form must match or the selection would look empty.
      const added = res.added || raw;
      if (field === 'applicationArea') {
        const current = splitApplications(form.getFieldValue(field));
        if (!current.includes(added)) form.setFieldsValue({ [field]: [...current, added] });
      } else {
        form.setFieldsValue({ [field]: added });
      }
      setAddOptionTarget(null);
    } catch (error) {
      setNewOptionError(error.message || 'Could not add that value.');
    } finally {
      setSavingOption(false);
    }
  };

  /**
   * Remove an option this branch added.
   *
   * The server refuses while products still use it and says how many, so that message is passed
   * straight through — "used by 3 products" tells the admin what to do; "could not remove" does not.
   */
  const removeOption = async (id) => {
    try {
      const res = await productService.deleteSpecOption(id);
      if (!res.success) throw new Error(res.message);
      setSpecOptions(res.data || {});
      setCustomOptions(res.custom || []);
      message.success(res.message || 'Removed.');
    } catch (error) {
      message.error(error.message || 'Could not remove that value.');
    }
  };

  // Load filter options
  useEffect(() => {
    productService.getFilterOptions().then(res => {
      if (res.success) setFilterOptions(res.data);
    }).catch(() => {});
    productService.getStats().then(res => {
      if (res.success) setStats(res.data);
    }).catch(() => {});
    productService.getSpecOptions().then(res => {
      if (res.success) {
        setSpecOptions(res.data || {});
        setCustomOptions(res.custom || []);
      }
    }).catch(() => { /* the constants above remain as the fallback */ });
  }, []);

  // Fetch products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current, limit: pagination.pageSize, search,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v)),
      };
      const res = await productService.getProducts(params);
      if (res.success) {
        setProducts(res.data);
        setPagination(prev => ({ ...prev, total: res.pagination.totalItems }));
      }
    } catch (err) {
      message.error(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, search, filters]);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  // Preview state
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [imageFiles, setImageFiles] = useState([]);
  const [imagePreviews, setImagePreviews] = useState([]);

  // Open drawer
  const openDrawer = (product = null) => {
    setEditingProduct(product);
    setShowPreview(false);
    setImageFiles([]);
    setImagePreviews((product?.images || []).map(img => getImageUrl(img)));
    if (product) {
      const catId = product.category?._id || product.category;
      form.setFieldsValue({
        ...product,
        inventoryBaseUom: product.inventoryBaseUom || product.unit || 'Box',
        inventoryUomVersion: product.inventoryUomVersion || 1,
        uomConversions: product.uomConversions?.length ? product.uomConversions : [{ uom: product.unit || 'Box', toBaseFactor: 1, precision: 6, allowFraction: true, version: 1 }],
        brand: product.brand?._id || product.brand || undefined,
        category: catId || undefined,
        subcategory: product.subcategory?._id || product.subcategory || undefined,
        // Category-defined specs. A plain object maps straight onto Product.attributes.
        attributes: product.attributes || {},
        // Application is a multi-select here but a single string in the database, so split it
        // for the control. The reverse happens in handleSave.
        applicationArea: splitApplications(product.applicationArea),
        // Convert arrays to editable string format for the textarea fields
        videos: Array.isArray(product.videos) ? product.videos.join('\n') : (product.videos || ''),
      });
      // Render the fields of the deepest node this product sits on, so a product filed
      // under Cement shows Cement's fields rather than its parent's (which has none).
      loadCategoryAttributes(product.subcategory?._id || product.subcategory || catId);
      // Bring the stored calculation up to date with the values just loaded.
      applyCalculation(form.getFieldsValue());
    } else {
      form.resetFields();
      form.setFieldsValue({ gst: 18, unit: 'Box', inventoryBaseUom: 'Box', inventoryUomVersion: 1, uomConversions: [{ uom: 'Box', toBaseFactor: 1, precision: 6, allowFraction: true, version: 1 }], status: 'active', salesType: 'Regular Sale', productType: 'Regular Product', onlineVisible: true, dealerVisible: true });
      setCategoryAttributes([]);
    }
    setDrawerOpen(true);
  };

  // Handle image selection
  const handleImageChange = (e) => {
    const files = Array.from(e.target.files);
    setImageFiles(prev => [...prev, ...files]);
    const previews = files.map(f => URL.createObjectURL(f));
    setImagePreviews(prev => [...prev, ...previews]);
  };

  const removeImage = (index) => {
    const preview = imagePreviews[index];
    // Free blob URL memory if it was a newly selected file
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);

    // For newly added files: find which file index corresponds to this preview index.
    // Existing images come first in imagePreviews, so new files start at offset = (existing count).
    const existingCount = imagePreviews.filter(p => !p.startsWith('blob:')).length;
    if (index >= existingCount) {
      const fileIndex = index - existingCount;
      setImageFiles(prev => prev.filter((_, i) => i !== fileIndex));
    }
    setImagePreviews(prev => prev.filter((_, i) => i !== index));
  };

  // Show preview before saving
  const handleShowPreview = async () => {
    try {
      const values = await form.validateFields();

      // Resolve names for the preview. The mapping lives in utils/taxonomy.js because the API's
      // array names (departments/categories/subcategories) do NOT match the form's field names
      // (Category/Subcategory) — a mismatch that fails silently as a dash, and has caused three
      // separate bugs now.
      const brandName = displayName.brand(filterOptions, values.brand);
      const categoryName = displayName.category(filterOptions, values.category);
      const subcategoryName = displayName.subcategory(filterOptions, values.subcategory);

      setPreviewData({ ...values, brandName, categoryName, subcategoryName });
      setShowPreview(true);
    } catch (err) {
      // validation errors shown by form
    }
  };

  // Confirm save after preview
  const handleConfirmSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();

      // Upload any newly selected files first
      let newImageUrls = [];
      if (imageFiles.length > 0) {
        const uploadRes = await productService.uploadImages(imageFiles);
        if (uploadRes.success) {
          newImageUrls = uploadRes.data;
        }
      }

      // Build the final image list from imagePreviews (reflects user's removals)
      // Split into:
      //   - existing URLs (already on the server — not blob: objects)
      //   - newly uploaded URLs (just returned from upload)
      const existingUrls = imagePreviews
        .filter(src => !src.startsWith('blob:'))            // kept existing images
        .map(src => {
          // Strip the API origin prefix so we store relative paths in the DB.
          // Uses the resolved origin rather than re-deriving it from the base URL:
          // the base URL is now relative (/api/v1), so the old derivation produced
          // an empty prefix and leaked absolute onrender.com URLs into the database.
          return API_ORIGIN && src.startsWith(API_ORIGIN)
            ? src.slice(API_ORIGIN.length)
            : src;
        });
      const imageUrls = [...existingUrls, ...newImageUrls];

      const productData = {
        ...values,
        images: imageUrls,
        // The multi-select holds an array; the database, the shop filter and the dealer app all
        // expect one comma-joined string. See splitApplications for why.
        applicationArea: joinApplications(values.applicationArea),
        // Convert textarea newline-separated strings back to arrays for the backend
        videos: typeof values.videos === 'string'
          ? values.videos.split('\n').map(v => v.trim()).filter(Boolean)
          : (values.videos || []),
      };

      let res;
      if (editingProduct) {
        res = await productService.updateProduct(editingProduct._id, productData);
      } else {
        res = await productService.createProduct(productData);
      }
      if (res.success) {
        message.success(res.message);
        setDrawerOpen(false);
        setShowPreview(false);
        form.resetFields();
        setEditingProduct(null);
        setImageFiles([]);
        setImagePreviews([]);
        fetchProducts();
        productService.getStats().then(r => { if (r.success) setStats(r.data); });
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  // Old handleSave now goes through preview
  const handleSave = handleShowPreview;

  // Delete
  const handleDelete = async (id) => {
    const proceed = await confirm('Delete this product?', { type: 'danger', okText: 'Delete', content: 'Product will be moved to Recycle Bin. You can restore it within 30 days.' });
    if (!proceed) return;
    try {
      const res = await productService.deleteProduct(id);
      if (res.success) { message.success(res.message || 'Moved to Recycle Bin'); fetchProducts(); }
      else { alertModal('Cannot Delete', res.message, 'error'); }
    } catch (err) {
      alertModal('Cannot Delete', err.message, 'error');
    }
  };

  // View product detail
  const [viewProduct, setViewProduct] = useState(null);
  const handleViewProduct = async (product) => {
    try {
      const res = await productService.getProduct(product._id);
      if (res.success) setViewProduct(res.data);
    } catch (err) {
      message.error(err.message || 'Unable to load product details');
    }
  };

  // ── Cascade: Brand → Category → Subcategory ──────────────────────────────
  //
  // "Category" here is the level-1 node (Tiles, Building Materials, Sanitaryware …) — the
  // same thing Category Management lists and Brand & Category Setup links a brand to. So
  // picking a brand offers exactly the categories that brand sells, not all of them.
  // Its children (Floor Tiles, Wall Tiles …) are the subcategories.
  //
  // The API names these arrays `departments` / `categories` / `subcategories` for levels
  // 1 / 2 / 3. The UI only ever says "Category" and "Subcategory", so the mapping lives
  // here and nowhere else.
  const categoryOptionsFor = useCallback((brandId) => {
    const all = filterOptions.departments || [];
    const list = brandId
      ? all.filter((c) => (c.brands || []).map(String).includes(String(brandId)))
      : all;
    return list.map((c) => ({ value: c._id, label: c.name }));
  }, [filterOptions]);

  const getFilteredSubcategories = (categoryId) => {
    const cid = categoryId === undefined ? form.getFieldValue('category') : categoryId;
    if (!cid) return [];
    // Level-2 nodes carry their parent id in `category`.
    return (filterOptions.categories || []).filter((s) => String(s.category) === String(cid));
  };

  // Pull the attribute definitions for a node — its own plus everything it inherits.
  //
  // ALWAYS pass the MOST SPECIFIC node the admin has chosen. Attributes are declared at
  // whichever level actually varies: Tiles declares `finish` once for all its subcategories,
  // but Cement declares `grade` / `packSize` on itself. Loading from the Category alone gave
  // Cement 0 fields, because none of its attributes live on Building Materials.
  const loadCategoryAttributes = useCallback(async (nodeId) => {
    if (!nodeId) { setCategoryAttributes([]); return; }
    setLoadingAttributes(true);
    try {
      const res = await attributeService.getEffective(nodeId);
      const all = res.success ? (res.data || []) : [];
      // Calculated outputs are rendered by the calculation block below, read-only. Showing
      // them here too would ask the admin to type a value the form is about to overwrite.
      setCategoryAttributes(all.filter((a) => !a.calculated));
    } catch {
      setCategoryAttributes([]);
    } finally { setLoadingAttributes(false); }
  }, []);

  const loadAttributeIndex = useCallback(async () => {
    try {
      const res = await attributeService.list();
      if (!res.success) return;
      const index = {};
      for (const def of res.data || []) {
        const key = String(def.category);
        index[key] = (index[key] || 0) + 1;
      }
      setAttributeIndex(index);
    } catch { /* only powers a hint — the form works without it */ }
  }, []);

  useEffect(() => { loadAttributeIndex(); }, [loadAttributeIndex]);

  /** The deepest node chosen so far — what the Specifications fields come from. */
  const deepestSelectedNode = () =>
    form.getFieldValue('subcategory') || form.getFieldValue('category') || null;

  // Changing the brand narrows the category list, so a category that no longer belongs
  // to the chosen brand must be cleared rather than left dangling.
  const handleBrandChange = () => {
    form.setFieldsValue({ category: undefined, subcategory: undefined });
    setCategoryAttributes([]);
  };

  /**
   * Recompute this category's auto-calculation, if it has one, and store the result.
   *
   * Called whenever ANY field changes, so the result always reflects the current inputs.
   * The guard (`value !== current`) matters: writing an identical value would re-trigger
   * the change handler and loop forever.
   */
  const applyCalculation = useCallback((allValues) => {
    const category = (filterOptions.departments || []).find((d) => d._id === allValues?.category);
    const rule = ruleForCategory(category);
    if (!rule) return;
    const attributes = allValues?.attributes || {};
    const { value } = computeFor(rule, attributes);
    if (value !== attributes[rule.output.key]) {
      form.setFieldsValue({ attributes: { ...attributes, [rule.output.key]: value } });
    }
  }, [filterOptions, form]);

  // A new category invalidates the subcategory, so fall back to the category's own fields.
  const handleCategoryChange = (categoryId) => {
    form.setFieldsValue({ subcategory: undefined });
    loadCategoryAttributes(categoryId);
  };

  // A subcategory is more specific than its parent, so its fields replace the parent's.
  // Clearing it falls back to the category again.
  const handleSubcategoryChange = (subcategoryId) => {
    loadCategoryAttributes(subcategoryId || form.getFieldValue('category'));
  };

  // Auto-calculate SqFt/Box whenever tileSize or pcsPerBox changes
  const handleTileSizeChange = (tileSize) => {
    const pcs = form.getFieldValue('piecesPerBox');
    const computed = calcSqftPerBox(tileSize, pcs);
    if (computed !== null) form.setFieldsValue({ sqftPerBox: computed });
  };

  const handlePcsPerBoxChange = (pcs) => {
    const tileSize = form.getFieldValue('tileSize');
    const computed = calcSqftPerBox(tileSize, pcs);
    if (computed !== null) form.setFieldsValue({ sqftPerBox: computed });
  };

  /**
   * Render the right control for an attribute's declared type.
   *
   * A select must be a select — letting someone type a free value into a field the storefront
   * filters on would produce an option nobody can find. Values are stored on
   * `form.attributes[key]`, which maps straight onto `Product.attributes`.
   */
  const renderAttributeInput = (a) => {
    if (a.type === 'select') {
      return (
        <Select
          allowClear showSearch optionFilterProp="label"
          placeholder={`Select ${String(a.label || '').toLowerCase()}`}
          options={(a.options || []).map((o) => ({ value: o, label: o }))}
        />
      );
    }
    if (a.type === 'multiselect') {
      return (
        <Select
          mode="multiple" allowClear optionFilterProp="label"
          placeholder={`Select ${String(a.label || '').toLowerCase()}`}
          options={(a.options || []).map((o) => ({ value: o, label: o }))}
        />
      );
    }
    if (a.type === 'number') return <InputNumber className="w-full" />;
    if (a.type === 'boolean') return <Switch />;
    return <Input placeholder={a.help || ''} />;
  };

  const columns = [
    {
      title: 'Code', dataIndex: 'productCode', key: 'code', width: 100,
      render: (code) => <span className="text-xs font-mono text-blue-600">{code}</span>,
    },
    {
      title: 'Product Name', key: 'name', width: 200,
      render: (_, r) => (
        <div>
          <div className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{r.itemName}</div>
          {r.tileSize && <span className="text-xs text-gray-400">{r.tileSize}{r.finish ? ` | ${r.finish}` : ''}{r.sqftPerBox ? ` | ${r.sqftPerBox} sqft/box` : ''}</span>}
        </div>
      ),
    },
    {
      title: 'Brand', key: 'brand', width: 100,
      render: (_, r) => <span className="text-sm">{r.brand?.name || '-'}</span>,
    },
    {
      title: 'Category', key: 'category', width: 110,
      render: (_, r) => <span className="text-xs text-gray-600">{r.category?.name}</span>,
    },
    {
      title: 'Subcategory', key: 'subcategory', width: 110,
      render: (_, r) => <span className="text-xs text-gray-600">{r.subcategory?.name}</span>,
    },
    {
      title: 'MRP', dataIndex: 'mrp', key: 'mrp', width: 80,
      render: (v) => <span className="text-sm font-medium">₹{v || 0}</span>,
    },
    {
      title: 'Min Stock', dataIndex: 'minStockLevel', key: 'minStock', width: 80,
      render: (v, r) => <span className="text-xs">{v} {r.unit}</span>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 80,
      render: (s) => <Tag color={s === 'active' ? 'green' : s === 'draft' ? 'orange' : 'red'}>{s}</Tag>,
    },
    {
      title: (
        <Tooltip title="Visual search index — whether this product's image has been embedded for image-based search">
          <span>AI Index <span className="text-gray-400 font-normal text-[10px]">(?)</span></span>
        </Tooltip>
      ),
      key: 'imageIndex', width: 90,
      render: (_, r) => {
        if (!r.images || r.images.length === 0) {
          return <span className="text-[10px] text-gray-300">No image</span>;
        }
        if (r.imageEmbeddingUpdatedAt) {
          return (
            <Tooltip title={`Indexed: ${new Date(r.imageEmbeddingUpdatedAt).toLocaleString()}`}>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 cursor-default">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Indexed
              </span>
            </Tooltip>
          );
        }
        return (
          <Tooltip title="Not yet indexed for visual search. Will index automatically on next save.">
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 cursor-default">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
              Pending
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Actions', key: 'actions', width: 110, fixed: 'right',
      render: (_, r) => (
        <Space size="small">
          <Tooltip title="View"><Button type="text" size="small" icon={<EyeOutlined />} onClick={() => handleViewProduct(r)} className="text-blue-600" /></Tooltip>
          <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} onClick={() => openDrawer(r)} /></Tooltip>
          <Popconfirm title="Delete this product?" onConfirm={() => handleDelete(r._id)}>
            <Tooltip title="Delete"><Button type="text" size="small" danger icon={<DeleteOutlined />} /></Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex justify-between items-center mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Product Master</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage tiles, granite, marble & building material products</p>
        </div>
        <Space>
          <ModuleRecycleBin module="product" title="Deleted Products" onRestore={fetchProducts} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => openDrawer()} size="large">
            Add New Product
          </Button>
        </Space>
      </div>

      {/* Stats */}
      <Row gutter={16} className="mb-4">
        <Col span={6}><Card size="small"><Statistic title="Total Products" value={stats.total} prefix={<ShopOutlined />} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Active" value={stats.active} valueStyle={{ color: '#22c55e' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Inactive" value={stats.inactive} valueStyle={{ color: '#ef4444' }} /></Card></Col>
        <Col span={6}><Card size="small"><Statistic title="Draft" value={stats.draft} valueStyle={{ color: '#f59e0b' }} /></Card></Col>
      </Row>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
        <div className="flex flex-wrap gap-3">
          <Input placeholder="Search by name, code, HSN, colour..." prefix={<SearchOutlined className="text-gray-400" />}
            value={search} onChange={e => { setSearch(e.target.value); setPagination(p => ({...p, current:1})); }}
            className="w-72" allowClear />
          {/* Filters follow the taxonomy: Department → Category → Subcategory, with Brand as
              a separate optional axis rather than the entry point. */}
          <Select placeholder="Department" options={filterOptions.departments.map(d => ({ value: d._id, label: d.name }))}
            value={filters.department} onChange={v => setFilters(f => ({...f, department: v, category: undefined, subcategory: undefined}))}
            allowClear className="w-40" />
          <Select placeholder="Category" options={categoriesFor(filterOptions, filters.department).map(c => ({ value: c._id, label: c.name }))}
            value={filters.category} onChange={v => setFilters(f => ({...f, category: v, subcategory: undefined}))}
            allowClear className="w-40" />
          <Select placeholder="Subcategory" options={getFilteredSubcategories(filters.category).map(s => ({ value: s._id, label: s.name }))}
            value={filters.subcategory} onChange={v => setFilters(f => ({...f, subcategory: v}))}
            allowClear className="w-40" />
          <Select placeholder="Brand" options={filterOptions.brands.map(b => ({ value: b._id, label: b.name }))}
            value={filters.brand} onChange={v => setFilters(f => ({...f, brand: v}))}
            allowClear className="w-36" />
          <Select placeholder="Status" options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'draft',label:'Draft'}]}
            value={filters.status} onChange={v => setFilters(f => ({...f, status: v}))} allowClear className="w-28" />
        </div>
        <div className="flex flex-wrap gap-3 mt-3">
          <Select placeholder="Tile Size" options={TILE_SIZES.map(s => ({value:s,label:s}))}
            value={filters.tileSize} onChange={v => setFilters(f => ({...f, tileSize: v}))} allowClear className="w-32" showSearch />
          <Select placeholder="Finish" options={FINISHES.map(f => ({value:f,label:f}))}
            value={filters.finish} onChange={v => setFilters(f2 => ({...f2, finish: v}))} allowClear className="w-32" showSearch />
          <Select placeholder="Tile Type" options={TILE_TYPES.map(t => ({value:t,label:t}))}
            value={filters.tileType} onChange={v => setFilters(f => ({...f, tileType: v}))} allowClear className="w-36" showSearch />
          <Select placeholder="Application" options={APPLICATION_AREAS.map(a => ({value:a,label:a}))}
            value={filters.applicationArea} onChange={v => setFilters(f => ({...f, applicationArea: v}))} allowClear className="w-36" showSearch />
          <Button onClick={() => { setSearch(''); setFilters({brand:undefined,category:undefined,subcategory:undefined,status:undefined,tileSize:undefined,finish:undefined,tileType:undefined,applicationArea:undefined}); }}>Clear Filters</Button>
          {/* Re-fetches the current view. Distinct from Clear Filters, which only resets the inputs. */}
          <Button
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={() => {
              fetchProducts();
              productService.getStats().then(r => { if (r.success) setStats(r.data); }).catch(() => {});
            }}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-gray-200">
        <Table columns={columns} dataSource={products} rowKey="_id" loading={loading} size="middle" scroll={{ x: 1100 }}
          pagination={{ ...pagination, showSizeChanger: true, pageSizeOptions: ['10','20','50','100'],
            showTotal: (t, r) => `${r[0]}-${r[1]} of ${t} products` }}
          onChange={(pag) => setPagination(prev => ({...prev, current: pag.current, pageSize: pag.pageSize}))} />
      </div>

      {/* View Product Modal */}
      <ViewProductModal product={viewProduct} onClose={() => setViewProduct(null)} />

      {/* Add/Edit Product — Modal Overlay (like Jain Impex) */}
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingProduct(null); }} />
          <div className="fixed inset-4 z-50 bg-white rounded-xl shadow-2xl overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between rounded-t-xl">
              <div className="flex items-center gap-2">
                <span className="text-[#FF5F03] text-xl">+</span>
                <h2 className="text-lg font-bold text-gray-800">
                  {editingProduct ? 'Edit Product' : 'Add New Product'}
                </h2>
              </div>
              <div className="flex items-center gap-3">
                <Button type="primary" onClick={handleSave} loading={loading}>
                  {editingProduct ? 'Update Product' : '+ New Product'}
                </Button>
                <Button onClick={() => form.resetFields()} className="text-green-600 border-green-400">Clear Form</Button>
                <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingProduct(null); }}>✕</span>
              </div>
            </div>

            {/* Form */}
            <div className="px-8 py-6">
              <Form
                form={form}
                layout="vertical"
                onValuesChange={(_changed, all) => applyCalculation(all)}
              >
              {/* Row 1: Brand → Category → Subcategory.
                  Pick a brand and only the categories that brand sells are offered; pick a
                  category and only its own subcategories are offered. Each step narrows the
                  next, so nobody scrolls a list of 99 categories to find one. */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="brand" label="Brand" extra="Optional — leave blank for unbranded goods">
                    <Select placeholder="Select brand..." showSearch optionFilterProp="label" allowClear
                      options={filterOptions.brands.map(b => ({ value: b._id, label: b.name }))}
                      onChange={handleBrandChange} />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.brand !== curr.brand}>
                    {() => {
                      const brandId = form.getFieldValue('brand');
                      const options = categoryOptionsFor(brandId);
                      return (
                        <Form.Item name="category" label="Category" rules={[{ required: true, message: 'Select category' }]}>
                          <Select
                            placeholder={brandId ? 'Select category...' : 'Select category (or pick a brand first)'}
                            showSearch optionFilterProp="label"
                            options={options}
                            onChange={handleCategoryChange}
                            notFoundContent={brandId
                              ? 'This brand has no categories yet — set them up in Brand & Category Setup'
                              : 'No categories yet — add them in Category Management'} />
                        </Form.Item>
                      );
                    }}
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                    {() => (
                      <Form.Item name="subcategory" label="Subcategory">
                        <Select
                          placeholder={form.getFieldValue('category') ? 'Select subcategory...' : 'Select category first'}
                          showSearch optionFilterProp="label" allowClear
                          disabled={!form.getFieldValue('category')}
                          options={getFilteredSubcategories().map(s => ({ value: s._id, label: s.name }))}
                          onChange={handleSubcategoryChange}
                          notFoundContent={form.getFieldValue('category') ? 'No subcategories under this category' : 'Select a category first'} />
                      </Form.Item>
                    )}
                  </Form.Item>
                </Col>
              </Row>

              {/* Category-defined specifications.
                  Rendered from the selected category's own definitions, so a tile shows
                  size / finish / surface and a cement bag shows grade / pack size / setting
                  time — one form serving every vertical instead of a column per vertical. */}
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category || prev.subcategory !== curr.subcategory}>
                {() => {
                  const nodeId = deepestSelectedNode();
                  if (!nodeId) return null;

                  // Where the fields actually are, so the empty state can say so rather than
                  // just "none here". Three genuinely different situations:
                  //   Tiles              -> its fields are the tile block further down the form
                  //   a parent category  -> its fields are on its subcategories, pick one
                  //   anything else      -> nothing defined yet, add them in Brand & Category Setup
                  const categoryId = form.getFieldValue('category');
                  const subcategoryId = form.getFieldValue('subcategory');
                  const selectedCategory = (filterOptions.departments || []).find((d) => d._id === categoryId);
                  // Matched on the STABLE key, never the name. Renaming the category is safe;
                  // a hand-made "Tiles" is a different category and correctly gets no tile block.
                  const isTiles = selectedCategory?.systemKey === 'tiles';
                  const subcategoriesWithFields = (!subcategoryId && categoryId)
                    ? (filterOptions.categories || [])
                      .filter((c) => String(c.category) === String(categoryId) && attributeIndex[String(c._id)] > 0)
                      .map((c) => c.name)
                    : [];

                  return (
                    <Card
                      size="small"
                      className="mb-4"
                      title={<span className="text-sm">Specifications</span>}
                      extra={<span className="text-xs text-gray-400">{categoryAttributes.length} field{categoryAttributes.length === 1 ? '' : 's'}</span>}
                    >
                      {loadingAttributes ? (
                        <div className="py-6 text-center"><Spin /></div>
                      ) : categoryAttributes.length === 0 ? (
                        isTiles ? (
                          <Alert
                            type="success"
                            showIcon
                            message="Tiles has its own fields"
                            description="Scroll down to Tile Specifications — size, finish, surface, pcs/box and the auto-calculated sqft/box."
                          />
                        ) : subcategoriesWithFields.length > 0 ? (
                          <Alert
                            type="info"
                            showIcon
                            message="Pick a subcategory to fill in its details"
                            description={`${subcategoriesWithFields.length} of this category's subcategories have their own fields — ${subcategoriesWithFields.slice(0, 6).join(', ')}${subcategoriesWithFields.length > 6 ? ' and more' : ''}. Choose one above and its fields appear here.`}
                          />
                        ) : (
                          <Alert
                            type="info"
                            showIcon
                            message="No specifications for this category yet"
                            description="Add them in Brand & Category Setup — on the category itself, or on one of its subcategories."
                          />
                        )
                      ) : (
                        <Row gutter={16}>
                          {categoryAttributes.map((a) => (
                            <Col xs={24} md={12} lg={8} key={a.key}>
                              <Form.Item
                                name={['attributes', a.key]}
                                label={a.unit ? `${a.label} (${a.unit})` : a.label}
                                rules={a.required ? [{ required: true, message: `${a.label} is required` }] : []}
                                extra={a.help || undefined}
                              >
                                {renderAttributeInput(a)}
                              </Form.Item>
                            </Col>
                          ))}
                        </Row>
                      )}
                    </Card>
                  );
                }}
              </Form.Item>

              {/* Auto-calculation, when this category has one.
                  Reads the fields above and writes a read-only result — e.g. a granite slab's
                  square feet, which is what the customer is actually billed for. Driven by
                  src/utils/productCalculations.js, so a new category needs one entry there,
                  not another hardcoded block here. */}
              <Form.Item
                noStyle
                shouldUpdate={(prev, curr) => prev.attributes !== curr.attributes || prev.category !== curr.category}
              >
                {() => {
                  const category = (filterOptions.departments || []).find((d) => d._id === form.getFieldValue('category'));
                  const rule = ruleForCategory(category);
                  if (!rule) return null;
                  const attributes = form.getFieldValue('attributes') || {};
                  const { value, missing } = computeFor(rule, attributes);
                  return (
                    <Card size="small" className="mb-4" title={<span className="text-sm">{rule.title}</span>}>
                      <Alert type="info" showIcon className="mb-3" message={rule.note} />
                      <Row gutter={16} align="middle">
                        <Col xs={24} md={12}>
                          <Form.Item
                            name={['attributes', rule.output.key]}
                            label={(
                              <span>
                                {rule.output.label}
                                {rule.output.unit ? ` (${rule.output.unit})` : ''}
                                <span className="text-[10px] font-normal text-green-600 ml-1">auto-calculated</span>
                              </span>
                            )}
                            extra={missing.length ? `Waiting for: ${missing.join(', ')}` : undefined}
                          >
                            <InputNumber className="w-full bg-green-50" readOnly />
                          </Form.Item>
                        </Col>
                        <Col xs={24} md={12}>
                          <span className="text-sm text-gray-600">
                            {value === null
                              ? (missing.length
                                ? 'Fill the fields above and this calculates itself.'
                                : 'Enter the values above to calculate.')
                              : `= ${value} ${rule.output.unit || ''}`}
                          </span>
                        </Col>
                      </Row>
                    </Card>
                  );
                }}
              </Form.Item>

              {/* Row 2: Product Code, Item Name, HSN */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="productCode" label="Product Code">
                    <Input placeholder="Will be auto-generated if left empty" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="itemName" label="Item Name" rules={[{ required: true, message: 'Required' }]}>
                    <Input placeholder="Enter item name" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item name="hsnCode" label="HSN Code">
                    <Input placeholder="Enter HSN code (optional)" />
                  </Form.Item>
                </Col>
              </Row>

              {/* Row 3: Alias, Description, Unit */}
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item name="aliasName" label="Alias Name (optional)">
                    <Input placeholder="Enter alias / alternate name" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="unit" label="Unit" rules={[{ required: true }]}>
                    <Select options={UNITS.map(u => ({ value: u, label: u }))} placeholder="Select Unit" />
                  </Form.Item>
                </Col>
                <Col span={4}>
                  <Form.Item name="gst" label="GST %" rules={[{ required: true }]}>
                    <Select options={GST_RATES.map(r => ({ value: r, label: `${r}%` }))} />
                  </Form.Item>
                </Col>
              </Row>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-blue-800 mb-2">Inventory Base UOM</div>
                <Row gutter={16}>
                  <Col span={8}><Form.Item name="inventoryBaseUom" label="Base UOM" rules={[{ required: true }]}><Select options={UNITS.map(u => ({ value: u, label: u }))} /></Form.Item></Col>
                  <Col span={8}><Form.Item name="inventoryUomVersion" label="UOM Version"><InputNumber min={1} precision={0} className="w-full" disabled={Boolean(editingProduct)} /></Form.Item></Col>
                </Row>
                <Form.List name="uomConversions">
                  {(fields, { add, remove }) => <div className="space-y-2">{fields.map(({ key, name }) => <Row key={key} gutter={8} align="middle">
                    <Col span={6}><Form.Item name={[name, 'uom']} rules={[{ required: true }]} className="mb-0"><Select placeholder="Entered UOM" options={UNITS.map(u => ({ value: u, label: u }))} /></Form.Item></Col>
                    <Col span={6}><Form.Item name={[name, 'toBaseFactor']} rules={[{ required: true }]} className="mb-0"><InputNumber min={0.000001} step={0.000001} className="w-full" placeholder="To-base factor" /></Form.Item></Col>
                    <Col span={4}><Form.Item name={[name, 'precision']} className="mb-0"><InputNumber min={0} max={6} precision={0} className="w-full" placeholder="Precision" /></Form.Item></Col>
                    <Col span={4}><Form.Item name={[name, 'allowFraction']} valuePropName="checked" className="mb-0"><Switch checkedChildren="Fraction" unCheckedChildren="Whole" /></Form.Item></Col>
                    <Col span={4}><Button danger disabled={fields.length === 1} onClick={() => remove(name)}>Remove</Button></Col>
                  </Row>)}<Button type="dashed" onClick={() => add({ precision: 6, allowFraction: true, version: form.getFieldValue('inventoryUomVersion') || 1 })}>Add conversion</Button></div>}
                </Form.List>
                <div className="text-xs text-blue-700 mt-2">Base UOM and factors become immutable after stock history exists. Packaging/display fields remain editable.</div>
              </div>
              {/* Product Details — the four tabs shown on the website product page */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                <div className="text-sm font-semibold text-blue-800 mb-1">📄 Product Details <span className="font-normal text-blue-600">(shown as tabs on the website product page)</span></div>
                <div className="text-xs text-blue-500 mb-3">Each field maps to a tab: Description / Applications / Maintenance / Disclaimer. Leave blank to use the default text.</div>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="description" label="Description" tooltip="Short paragraph shown in the Description tab on the product page">
                      <Input.TextArea rows={3} placeholder="e.g. Premium white 600×600 mm vitrified floor tile with a smooth matt finish. Low water absorption, stain resistant and consistent shade — ideal for living rooms, bedrooms and halls." />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="applications" label="Applications" tooltip="One application area per line — shown as a bullet list in the Applications tab">
                      <Input.TextArea rows={4} placeholder={`Living Room\nBedroom\nHall & Balcony\nBathroom & Kitchen\nElevation & Facade\nOffice / Commercial\nParking & Passage`} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="maintenance" label="Maintenance" tooltip="One tip per line — shown as a bullet list in the Maintenance tab">
                      <Input.TextArea rows={4} placeholder={`Clean regularly with a soft mop and mild detergent.\nAvoid harsh acids or abrasive scrubbers on the surface.\nWipe spills promptly to prevent staining.\nUse recommended grout and sealant during installation.`} />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={24}>
                    <Form.Item name="disclaimer" label="Disclaimer" tooltip="Shown in the Disclaimer tab on the product page">
                      <Input.TextArea rows={2} placeholder="e.g. Product colours and images shown are indicative and may vary slightly from the actual item due to screen settings and manufacturing batches." />
                    </Form.Item>
                  </Col>
                </Row>
              </div>

              {/* Tile-only fields.
                  The Pcs/Box → SqFt/Box auto-calculation is genuinely tile-specific, so Tiles
                  keeps its own block. EVERY other vertical gets its fields from its own
                  attribute definitions, shown in the Specifications card above — which is why
                  this block must not render for Cement, Sanitaryware and the rest. */}
              <Form.Item noStyle shouldUpdate={(prev, curr) => prev.category !== curr.category}>
                {() => {
                  const categoryId = form.getFieldValue('category');
                  const category = (filterOptions.departments || []).find((d) => d._id === categoryId);
                  const isTiles = category?.systemKey === 'tiles';
                  if (!isTiles) return null;
                  return (
                    <>
              <Divider className="my-4" />

              {/* Five per row. 24 does not divide by 5, so these use `flex="0 0 20%"` rather
                  than a Col span — antd's span grid only divides the row into whole 24ths, and
                  span={4.8} silently produces no width class at all. */}

              {/* Row 1 — the main specification */}
              <Row gutter={16}>
                <Col flex="0 0 20%"><SpecSelect name="tileSize" label="Tile Size" placeholder="Size" options={optionsFor('tileSize', TILE_SIZES)} onChange={handleTileSizeChange} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="tileType" label="Tile Type" placeholder="Type" options={optionsFor('tileType', TILE_TYPES)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="finish" label="Finish" placeholder="Finish" options={optionsFor('finish', FINISHES)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="surface" label="Surface" placeholder="Surface" options={optionsFor('surface', SURFACES)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="antiSkidRating" label="Anti-Skid" placeholder="Rating" options={optionsFor('antiSkid', ANTI_SKID.filter(Boolean))} onAdd={openAddOption} /></Col>
              </Row>

              {/* Row 2 */}
              <Row gutter={16}>
                <Col flex="0 0 20%"><SpecSelect name="grade" label="Grade" placeholder="Grade" options={optionsFor('grade', GRADES)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="colour" label="Colour" placeholder="Colour" options={optionsFor('colour', COLOURS)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="thickness" label="Thickness" placeholder="e.g. 10mm" options={optionsFor('thickness', THICKNESSES)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><SpecSelect name="countryOfOrigin" label="Origin" placeholder="Origin" options={optionsFor('origin', ORIGINS)} onAdd={openAddOption} /></Col>
                <Col flex="0 0 20%"><Form.Item name="waterAbsorption" label="Water Absorption" tooltip="e.g. <0.5% — shown on product spec table"><Input placeholder="e.g. <0.5%" /></Form.Item></Col>
              </Row>

              {/* Row 3 — packing, plus the remaining measured specs */}
              <Row gutter={16}>
                <Col flex="0 0 20%"><Form.Item name="piecesPerBox" label="Pcs/Box"><InputNumber min={0} className="w-full" onChange={handlePcsPerBoxChange} /></Form.Item></Col>
                <Col flex="0 0 20%">
                  <Form.Item name="sqftPerBox" label={<span>SqFt/Box <span className="text-[10px] font-normal text-green-600 ml-1">auto-calculated</span></span>}>
                    <InputNumber min={0} step={0.01} className="w-full bg-green-50" readOnly />
                  </Form.Item>
                </Col>
                <Col flex="0 0 20%"><Form.Item name="weightPerBox" label="Weight/Box (Kg)"><InputNumber min={0} step={0.1} className="w-full" /></Form.Item></Col>
                <Col flex="0 0 20%"><Form.Item name="breakingStrength" label="Breaking Strength" tooltip="e.g. 2000N — structural strength rating"><Input placeholder="e.g. 2000N" /></Form.Item></Col>
                <Col flex="0 0 20%"><Form.Item name="manufacturer" label="Manufacturer"><Input placeholder="If different from brand" /></Form.Item></Col>
              </Row>

              {/* Row 4 — Application takes FOUR slots (80%) because it is the only multi-select
                  here and has to show several chips side by side. */}
              <Row gutter={16}>
                <Col flex="0 0 20%"><Form.Item name="barcode" label="Barcode"><Input placeholder="Barcode/EAN" /></Form.Item></Col>
                <Col flex="0 0 80%">
                  <SpecSelect
                    name="applicationArea"
                    label="Application"
                    mode="multiple"
                    placeholder="Select one or more areas"
                    options={optionsFor('application', APPLICATION_AREAS)}
                    onAdd={openAddOption}
                    tooltip="A tile usually serves several areas — pick all that apply"
                  />
                </Col>
              </Row>
                    </>
                  );
                }}
              </Form.Item>

              <Divider className="my-4" />

              {/* Pricing — Basic Price & Purchase Control */}
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <div className="text-sm font-semibold text-orange-800 mb-2">Purchase Price Control</div>
                <Row gutter={16}>
                  <Col span={6}><Form.Item name="basicPrice" label="Basic Price (₹)" tooltip="Base purchase price of this product"><InputNumber min={0} className="w-full" prefix="₹" placeholder="e.g. 100" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="excessPrice" label="Excess Price (₹)" tooltip="Max excess allowed above basic. Purchase rate cannot exceed Basic + Excess"><InputNumber min={0} className="w-full" prefix="₹" placeholder="e.g. 15" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="purchaseRate" label="Purchase Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                  <Col span={6}><Form.Item name="landingCost" label="Landing Cost"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                </Row>
                <div className="text-xs text-orange-600 -mt-2">⚠ Max Purchase Rate = Basic Price + Excess Price. PO rate above this will be blocked.</div>
              </div>

              {/* Selling Prices */}
              <Row gutter={16}>
                <Col span={4}><Form.Item name="mrp" label="MRP"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="retailRate" label="Retail Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="dealerRate" label="Dealer Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="wholesaleRate" label="Wholesale Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="distributorRate" label="Distributor Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="builderRate" label="Builder Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={4}><Form.Item name="projectRate" label="Project Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="minimumSellingRate" label="Min Selling Rate"><InputNumber min={0} className="w-full" prefix="₹" /></Form.Item></Col>
                <Col span={4}><Form.Item name="minStockLevel" label="Min Stock Level"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                <Col span={4}><Form.Item name="reorderLevel" label="Reorder Level"><InputNumber min={0} className="w-full" /></Form.Item></Col>
                <Col span={4}><Form.Item name="status" label="Status"><Select options={[{value:'active',label:'Active'},{value:'inactive',label:'Inactive'},{value:'draft',label:'Draft'}]} /></Form.Item></Col>
                <Col span={4}><Form.Item name="salesType" label="Sales Type"><Select options={[{value:'Regular Sale',label:'Regular Sale'},{value:'CD Sales',label:'CD Sales'}]} /></Form.Item></Col>
              </Row>

              <Divider className="my-4" />

              {/* Toggles + Product Type */}
              <Row gutter={16}>
                <Col span={4}><Form.Item name="productType" label="Product Type"><Select options={[{value:'Regular Product',label:'Regular Product'},{value:'AO Product',label:'AO Product'}]} /></Form.Item></Col>
                <Col span={4}><Form.Item name="isNewArrival" label="New Arrival" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={4}><Form.Item name="isFeatured" label="Featured" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={4}><Form.Item name="isDealOfWeek" label="Deal of the Week" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={4}><Form.Item name="onlineVisible" label="Online Visible" valuePropName="checked"><Switch /></Form.Item></Col>
                <Col span={4}><Form.Item name="dealerVisible" label="Dealer Visible" valuePropName="checked"><Switch /></Form.Item></Col>
              </Row>
              <Row gutter={16}>
                <Col span={4}><Form.Item name="rating" label="Rating (0-5)" tooltip="Average customer rating shown on the website"><InputNumber min={0} max={5} step={0.1} className="w-full" placeholder="e.g. 4.5" /></Form.Item></Col>
                <Col span={4}><Form.Item name="reviewCount" label="Review Count" tooltip="Number of reviews shown on the website"><InputNumber min={0} className="w-full" placeholder="e.g. 128" /></Form.Item></Col>
              </Row>

              <Divider className="my-3" />

              {/* Image Upload */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-2">
                  <label className="block text-sm font-medium text-gray-700">Product Images</label>
                  {/* Image embedding index status badge */}
                  {editingProduct && (
                    editingProduct.imageEmbeddingUpdatedAt
                      ? (
                        <span
                          title={`Visual search index updated: ${new Date(editingProduct.imageEmbeddingUpdatedAt).toLocaleString()}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-50 text-green-700 border border-green-200 cursor-default select-none"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                          Indexed for visual search
                        </span>
                      ) : (
                        <span
                          title="Image not yet indexed for visual search. Embedding will be generated automatically after save."
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 cursor-default select-none"
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block" />
                          Not indexed yet
                        </span>
                      )
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {imagePreviews.map((src, i) => (
                    <div key={i} className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden group">
                      <img src={src} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer" onClick={() => removeImage(i)}>
                        <span className="text-white text-lg font-bold">✕</span>
                      </div>
                    </div>
                  ))}
                  <label className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-[#FF5F03] hover:bg-orange-50 transition-colors">
                    <span className="text-2xl text-gray-400 leading-none">+</span>
                    <span className="text-[9px] text-gray-400 mt-1">Add</span>
                    <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImageChange} />
                  </label>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Upload product images (JPG, PNG, WEBP). Max 5MB each, up to 10 images.
                  {imageFiles.length > 0 && (
                    <span className="ml-2 text-[#FF5F03] font-medium">
                      Visual search index will update automatically after save.
                    </span>
                  )}
                </p>
              </div>

              {/* Videos & Catalogue */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Videos <span className="text-gray-400 font-normal">(optional)</span></label>
                <Form.Item name="videos" noStyle>
                  <Input.TextArea
                    rows={2}
                    placeholder="Paste video URLs, one per line (YouTube, Vimeo, direct MP4, etc.)"
                    className="font-mono text-xs"
                  />
                </Form.Item>
                <p className="text-xs text-gray-400 mt-1">One URL per line. These show on the product page on the website.</p>
              </div>

              <Row gutter={16} className="mb-4">
                <Col span={16}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Catalogue PDF URL <span className="text-gray-400 font-normal">(optional)</span></label>
                  <Form.Item name="cataloguePdf" noStyle>
                    <Input placeholder="https://... or /uploads/..." />
                  </Form.Item>
                  <p className="text-xs text-gray-400 mt-1">Direct link to a PDF brochure or catalogue for this product.</p>
                </Col>
              </Row>

              {/* Action Buttons */}
              <div className="mt-6 flex justify-end gap-3 pb-6">
                <Button size="large" onClick={() => { setDrawerOpen(false); form.resetFields(); setEditingProduct(null); setImageFiles([]); setImagePreviews([]); }}>
                  Cancel
                </Button>
                <Button type="primary" size="large" onClick={handleSave} loading={loading} className="px-8">
                  {editingProduct ? 'Update Product' : 'Preview & Save'}
                </Button>
              </div>
            </Form>
          </div>
        </div>

        {/* Add / remove specification options — opened by the "+" beside each dropdown */}
        <Modal
          title={addOptionTarget ? `${addOptionTarget.label} options` : 'Options'}
          open={Boolean(addOptionTarget)}
          onOk={submitNewOption}
          onCancel={() => setAddOptionTarget(null)}
          okText="Add"
          confirmLoading={savingOption}
          width={460}
          destroyOnHidden
        >
          {(() => {
            if (!addOptionTarget) return null;
            const isTileSize = addOptionTarget.field === 'tileSize';
            const hint = OPTION_HINTS[addOptionTarget.field];
            const addedHere = customOptions.filter(row => row.field === addOptionTarget.field);
            return (
              <>
                <p className="text-sm text-gray-500 mb-3">
                  Saved for this branch, and it appears in the dropdown from next time.
                </p>

                {/* Tile size is two numbers, so a malformed value like "1010" cannot be typed. */}
                {isTileSize ? (
                  <div className="flex items-center gap-2">
                    <InputNumber
                      autoFocus
                      min={1}
                      className="flex-1"
                      placeholder="Width (mm)"
                      value={newSizeWidth}
                      onChange={(v) => { setNewSizeWidth(v); if (newOptionError) setNewOptionError(''); }}
                      onPressEnter={submitNewOption}
                    />
                    <span className="text-gray-400 font-bold">×</span>
                    <InputNumber
                      min={1}
                      className="flex-1"
                      placeholder="Height (mm)"
                      value={newSizeHeight}
                      onChange={(v) => { setNewSizeHeight(v); if (newOptionError) setNewOptionError(''); }}
                      onPressEnter={submitNewOption}
                    />
                  </div>
                ) : (
                  <Input
                    autoFocus
                    status={newOptionError ? 'error' : undefined}
                    value={newOptionValue}
                    onChange={(event) => {
                      setNewOptionValue(event.target.value);
                      if (newOptionError) setNewOptionError('');
                    }}
                    onPressEnter={submitNewOption}
                    placeholder={`New ${addOptionTarget.label.toLowerCase()}`}
                    maxLength={60}
                    showCount
                  />
                )}

                {/* The expected format, stated up front so a mistake is caught before submitting.
                    Replaced by the specific error once there is one. */}
                {newOptionError || hint ? (
                  <p className={`text-xs mt-2 ${newOptionError ? 'text-red-500' : 'text-gray-400'}`}>
                    {newOptionError || hint}
                  </p>
                ) : null}

                {/* Only what this branch added. A built-in option is not a database row, so
                    there is nothing to delete — saying that beats an empty section. */}
                <div className="mt-5 pt-4 border-t border-gray-100">
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-2">
                    Added by you{addedHere.length ? ` (${addedHere.length})` : ''}
                  </div>
                  {addedHere.length === 0 ? (
                    <p className="text-xs text-gray-400">
                      Nothing added yet. Built-in options cannot be removed.
                    </p>
                  ) : (
                    <Space direction="vertical" size={4} className="w-full">
                      {addedHere.map(row => (
                        <div key={row._id} className="flex items-center justify-between border border-gray-200 rounded px-2 py-1">
                          <span className="text-sm text-gray-800">{row.value}</span>
                          <Popconfirm
                            title={`Remove "${row.value}"?`}
                            description="Only possible while no product uses it."
                            onConfirm={() => removeOption(row._id)}
                            okButtonProps={{ danger: true }}
                            okText="Remove"
                          >
                            <Tooltip title="Remove">
                              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
                            </Tooltip>
                          </Popconfirm>
                        </div>
                      ))}
                    </Space>
                  )}
                </div>
              </>
            );
          })()}
        </Modal>

        {/* Preview Modal */}
        {showPreview && previewData && (
          <>
            <div className="fixed inset-0 z-[60] bg-black/40" onClick={() => setShowPreview(false)} />
            <div className="fixed inset-x-8 top-8 bottom-8 z-[70] bg-white rounded-xl shadow-2xl overflow-y-auto max-w-3xl mx-auto">
              <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl">
                <h3 className="text-lg font-bold text-gray-800">Product Preview</h3>
                <div className="flex gap-3">
                  <Button onClick={() => setShowPreview(false)}>Back to Edit</Button>
                  <Button type="primary" onClick={handleConfirmSave} loading={loading}>Confirm & Save</Button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                {/* Images */}
                {imagePreviews.length > 0 && (
                  <div className="flex gap-3 mb-4">
                    {imagePreviews.map((src, i) => (
                      <img key={i} src={src} alt="" className="w-24 h-24 rounded-lg object-cover border" />
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-4 text-sm">
                  <PreviewItem label="Brand" value={previewData.brandName} />
                  <PreviewItem label="Category" value={previewData.categoryName} />
                  <PreviewItem label="Subcategory" value={previewData.subcategoryName} />
                  <PreviewItem label="Product Code" value={previewData.productCode || 'Auto-generated'} />
                  <PreviewItem label="Item Name" value={previewData.itemName} highlight />
                  <PreviewItem label="HSN Code" value={previewData.hsnCode} />
                  <PreviewItem label="GST" value={`${previewData.gst}%`} />
                  <PreviewItem label="Unit" value={previewData.unit} />
                  <PreviewItem label="Inventory Base UOM" value={`${previewData.inventoryBaseUom || previewData.unit} · v${previewData.inventoryUomVersion || 1}`} />
                  <PreviewItem label="Status" value={previewData.status} />
                </div>

                {/* Only for products that actually carry tile data. A cement bag has none,
                    so an empty "Tile Specifications" table would just be noise. */}
                {previewData.tileSize && (
                  <>
                <Divider className="my-3" />
                <h4 className="font-semibold text-gray-700 text-sm">Tile Specifications</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  {/* Same order as the form: size/type/finish, surface/anti-skid/grade, then the rest.
                      Design and Collection were removed — the business has no use for them. */}
                  <PreviewItem label="Tile Size" value={previewData.tileSize} />
                  <PreviewItem label="Tile Type" value={previewData.tileType} />
                  <PreviewItem label="Finish" value={previewData.finish} />
                  <PreviewItem label="Surface" value={previewData.surface} />
                  <PreviewItem label="Anti-Skid" value={previewData.antiSkidRating} />
                  <PreviewItem label="Grade" value={previewData.grade} />
                  <PreviewItem label="Colour" value={previewData.colour} />
                  <PreviewItem label="Thickness" value={previewData.thickness} />
                  <PreviewItem label="Application" value={previewData.applicationArea} />
                  <PreviewItem label="Origin" value={previewData.countryOfOrigin} />
                  <PreviewItem label="Water Absorption" value={previewData.waterAbsorption} />
                  <PreviewItem label="Breaking Strength" value={previewData.breakingStrength} />
                  <PreviewItem label="Manufacturer" value={previewData.manufacturer} />
                  <PreviewItem label="Barcode" value={previewData.barcode} />
                  <PreviewItem label="Pcs/Box" value={previewData.piecesPerBox} />
                  <PreviewItem label="SqFt/Box" value={previewData.sqftPerBox} />
                  <PreviewItem label="Weight/Box" value={previewData.weightPerBox} />
                </div>
                  </>
                )}

                <Divider className="my-3" />
                <h4 className="font-semibold text-gray-700 text-sm">Pricing (₹)</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <PreviewItem label="Purchase Rate" value={previewData.purchaseRate ? `₹${previewData.purchaseRate}` : '-'} />
                  <PreviewItem label="Landing Cost" value={previewData.landingCost ? `₹${previewData.landingCost}` : '-'} />
                  <PreviewItem label="MRP" value={previewData.mrp ? `₹${previewData.mrp}` : '-'} highlight />
                  <PreviewItem label="Retail Rate" value={previewData.retailRate ? `₹${previewData.retailRate}` : '-'} />
                  <PreviewItem label="Dealer Rate" value={previewData.dealerRate ? `₹${previewData.dealerRate}` : '-'} />
                  <PreviewItem label="Wholesale Rate" value={previewData.wholesaleRate ? `₹${previewData.wholesaleRate}` : '-'} />
                  <PreviewItem label="Project Rate" value={previewData.projectRate ? `₹${previewData.projectRate}` : '-'} />
                  <PreviewItem label="Min Selling" value={previewData.minimumSellingRate ? `₹${previewData.minimumSellingRate}` : '-'} />
                </div>

                <Divider className="my-3" />
                <h4 className="font-semibold text-gray-700 text-sm">Stock & Visibility</h4>
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <PreviewItem label="Min Stock" value={previewData.minStockLevel} />
                  <PreviewItem label="Reorder Level" value={previewData.reorderLevel} />
                  <PreviewItem label="Sales Type" value={previewData.salesType} />
                  <PreviewItem label="Product Type" value={previewData.productType} />
                  <PreviewItem label="New Arrival" value={previewData.isNewArrival ? 'Yes' : 'No'} />
                  <PreviewItem label="Featured" value={previewData.isFeatured ? 'Yes' : 'No'} />
                  <PreviewItem label="Deal of the Week" value={previewData.isDealOfWeek ? '🔥 Yes' : 'No'} />
                  <PreviewItem label="Online Visible" value={previewData.onlineVisible ? 'Yes' : 'No'} />
                  <PreviewItem label="Dealer Visible" value={previewData.dealerVisible ? 'Yes' : 'No'} />
                </div>
                {(previewData.description || previewData.applications || previewData.maintenance || previewData.disclaimer) && (
                  <>
                    <Divider className="my-3" />
                    <h4 className="font-semibold text-gray-700 text-sm mb-2">📄 Product Details (Website Tabs)</h4>
                    {previewData.description && <div className="mb-2"><span className="text-xs font-bold text-gray-500">Description:</span><p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{previewData.description}</p></div>}
                    {previewData.applications && <div className="mb-2"><span className="text-xs font-bold text-gray-500">Applications:</span><p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{previewData.applications}</p></div>}
                    {previewData.maintenance && <div className="mb-2"><span className="text-xs font-bold text-gray-500">Maintenance:</span><p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{previewData.maintenance}</p></div>}
                    {previewData.disclaimer && <div className="mb-2"><span className="text-xs font-bold text-gray-500">Disclaimer:</span><p className="text-xs text-gray-700 mt-0.5 whitespace-pre-wrap">{previewData.disclaimer}</p></div>}
                  </>
                )}
              </div>
            </div>
          </>
        )}
        </>
      )}
    </div>
  );
};

// Small preview item component
const PreviewItem = ({ label, value, highlight }) => (
  <div>
    <span className="text-xs text-gray-400 block">{label}</span>
    <span className={`${highlight ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value || '-'}</span>
  </div>
);

// View Product Detail Modal
const ViewProductModal = ({ product, onClose }) => {
  if (!product) return null;
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/40" onClick={onClose} />
      <div className="fixed inset-x-8 top-8 bottom-8 z-[70] bg-white rounded-xl shadow-2xl overflow-y-auto max-w-3xl mx-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center rounded-t-xl">
          <h3 className="text-lg font-bold text-gray-800">Product Details</h3>
          <span className="cursor-pointer text-gray-400 hover:text-gray-700 text-xl px-2" onClick={onClose}>✕</span>
        </div>
        <div className="p-6 space-y-4">
          {product.images?.length > 0 && (
            <div className="flex gap-3 mb-4">
              {product.images.map((src, i) => (
                <ProductImage key={i} src={src} size="xl" />
              ))}
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <PreviewItem label="Product Code" value={product.productCode} highlight />
            <PreviewItem label="Item Name" value={product.itemName} highlight />
            <PreviewItem label="Alias" value={product.aliasName} />
            <PreviewItem label="Brand" value={product.brand?.name} />
            <PreviewItem label="Category" value={product.category?.name} />
            <PreviewItem label="Subcategory" value={product.subcategory?.name} />
            <PreviewItem label="HSN Code" value={product.hsnCode} />
            <PreviewItem label="GST" value={`${product.gst}%`} />
            <PreviewItem label="Unit" value={product.unit} />
            <PreviewItem label="Inventory Base UOM" value={`${product.inventoryBaseUom || product.unit} · v${product.inventoryUomVersion || 1}`} />
            <PreviewItem label="Conversions" value={(product.uomConversions || []).map(row => `${row.uom} × ${row.toBaseFactor}`).join(', ') || `${product.unit} × 1`} />
            <PreviewItem label="Status" value={product.status} />
            <PreviewItem label="Sales Type" value={product.salesType} />
            <PreviewItem label="Product Type" value={product.productType} />
          </div>
          {/* Only shown when this product actually has tile data. */}
          {product.tileSize && (
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Tile Specifications</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <PreviewItem label="Tile Size" value={product.tileSize} />
              <PreviewItem label="Tile Type" value={product.tileType} />
              <PreviewItem label="Finish" value={product.finish} />
              <PreviewItem label="Surface" value={product.surface} />
              <PreviewItem label="Anti-Skid" value={product.antiSkidRating} />
              <PreviewItem label="Grade" value={product.grade} />
              <PreviewItem label="Colour" value={product.colour} />
              <PreviewItem label="Thickness" value={product.thickness} />
              <PreviewItem label="Application" value={product.applicationArea} />
              <PreviewItem label="Origin" value={product.countryOfOrigin} />
              <PreviewItem label="Water Absorption" value={product.waterAbsorption} />
              <PreviewItem label="Breaking Strength" value={product.breakingStrength} />
              <PreviewItem label="Manufacturer" value={product.manufacturer} />
              <PreviewItem label="Barcode" value={product.barcode} />
              <PreviewItem label="Pcs/Box" value={product.piecesPerBox} />
              <PreviewItem label="SqFt/Box" value={product.sqftPerBox} />
              <PreviewItem label="Weight/Box" value={product.weightPerBox} />
            </div>
          </div>
          )}
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Pricing (₹)</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <PreviewItem label="Purchase Rate" value={product.purchaseRate ? `₹${product.purchaseRate}` : '-'} />
              <PreviewItem label="Landing Cost" value={product.landingCost ? `₹${product.landingCost}` : '-'} />
              <PreviewItem label="MRP" value={product.mrp ? `₹${product.mrp}` : '-'} highlight />
              <PreviewItem label="Retail Rate" value={product.retailRate ? `₹${product.retailRate}` : '-'} />
              <PreviewItem label="Dealer Rate" value={product.dealerRate ? `₹${product.dealerRate}` : '-'} />
              <PreviewItem label="Wholesale Rate" value={product.wholesaleRate ? `₹${product.wholesaleRate}` : '-'} />
              <PreviewItem label="Project Rate" value={product.projectRate ? `₹${product.projectRate}` : '-'} />
              <PreviewItem label="Min Selling" value={product.minimumSellingRate ? `₹${product.minimumSellingRate}` : '-'} />
            </div>
          </div>
          <div className="border-t pt-4 mt-4">
            <h4 className="font-semibold text-gray-700 text-sm mb-3">Stock & Visibility</h4>
            <div className="grid grid-cols-4 gap-4 text-sm">
              <PreviewItem label="Min Stock" value={product.minStockLevel} />
              <PreviewItem label="Reorder Level" value={product.reorderLevel} />
              <PreviewItem label="New Arrival" value={product.isNewArrival ? 'Yes' : 'No'} />
              <PreviewItem label="Featured" value={product.isFeatured ? 'Yes' : 'No'} />
              <PreviewItem label="Deal of the Week" value={product.isDealOfWeek ? '🔥 Yes' : 'No'} />
              <PreviewItem label="Online Visible" value={product.onlineVisible ? 'Yes' : 'No'} />
              <PreviewItem label="Dealer Visible" value={product.dealerVisible ? 'Yes' : 'No'} />
            </div>
          </div>
          {(product.videos?.length > 0 || product.cataloguePdf) && (
            <div className="border-t pt-4 mt-4">
              <h4 className="font-semibold text-gray-700 text-sm mb-3">Media</h4>
              {product.cataloguePdf && (
                <div className="mb-2 text-sm">
                  <span className="text-gray-500">Catalogue PDF: </span>
                  <a href={product.cataloguePdf} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">
                    {product.cataloguePdf}
                  </a>
                </div>
              )}
              {product.videos?.length > 0 && (
                <div className="text-sm">
                  <span className="text-gray-500">Videos:</span>
                  <ul className="mt-1 space-y-1">
                    {product.videos.map((v, i) => (
                      <li key={i}><a href={v} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline break-all">{v}</a></li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default ProductMaster;
