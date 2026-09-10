import ContentManager, { imageColumn, statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getCategories,
  create: webManagementService.createCategory,
  update: webManagementService.updateCategory,
  delete: webManagementService.deleteCategory,
};

const fields = [
  { name: 'name', label: 'Category Name', type: 'text', required: true, placeholder: 'e.g. Tiling' },
  { name: 'slug', label: 'Slug', type: 'text', placeholder: 'Auto-generated if blank (e.g. tiling)', help: 'Links to /category/<slug> on the website' },
  { name: 'image', label: 'Category Image', type: 'image' },
  { name: 'badge', label: 'Badge', type: 'text', placeholder: 'e.g. Bulk Prices' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  imageColumn(),
  { title: 'Name', dataIndex: 'name', render: (v, r) => (
    <div><div className="font-medium text-sm">{v}</div><div className="text-xs text-gray-400">/{r.slug}</div></div>
  ) },
  { title: 'Badge', dataIndex: 'badge', width: 120, render: (v) => v || <span className="text-gray-300">—</span> },
  orderColumn,
  statusColumn,
];

const WebCategoryPage = () => (
  <ContentManager
    title="Category Management"
    subtitle="Shop-by-category cards shown on the website home page"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default WebCategoryPage;
