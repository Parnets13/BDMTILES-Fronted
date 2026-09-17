import ContentManager, { statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getMarquee,
  create: webManagementService.createMarquee,
  update: webManagementService.updateMarquee,
  delete: webManagementService.deleteMarquee,
};

const fields = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Pay on Delivery' },
  { name: 'subtitle', label: 'Subtitle', type: 'text', placeholder: 'e.g. Pay after you receive & verify' },
  { name: 'icon', label: 'Icon', type: 'icon', help: 'Pick an icon to show next to this item' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first (left)' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  { title: 'Icon', dataIndex: 'icon', width: 70, render: (v) => (v ? <i className={`fa-solid ${v} text-orange-500 text-base`} /> : <span className="text-gray-300">—</span>) },
  { title: 'Text', dataIndex: 'title', render: (v, r) => (
    <div><div className="font-medium text-sm">{v}</div><div className="text-xs text-gray-400">{r.subtitle}</div></div>
  ) },
  orderColumn,
  statusColumn,
];

const MarqueePage = () => (
  <ContentManager
    title="Top Bar (Scrolling Strip)"
    subtitle="The right-to-left scrolling items shown at the very top of the website"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default MarqueePage;
