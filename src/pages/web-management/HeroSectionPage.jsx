import ContentManager, { imageColumn, statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getHero,
  create: webManagementService.createHero,
  update: webManagementService.updateHero,
  delete: webManagementService.deleteHero,
};

const fields = [
  { name: 'title', label: 'Title', type: 'text', required: true, placeholder: 'e.g. Premium Tiles at Wholesale Prices' },
  { name: 'subtitle', label: 'Subtitle', type: 'textarea', placeholder: 'Short supporting line' },
  { name: 'image', label: 'Background Image', type: 'image' },
  { name: 'ctaLabel', label: 'Button Label', type: 'text', placeholder: 'e.g. Shop Now' },
  { name: 'ctaLink', label: 'Button Link', type: 'text', placeholder: 'e.g. /category/tiling' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  imageColumn(),
  { title: 'Title', dataIndex: 'title', render: (v, r) => (
    <div><div className="font-medium text-sm">{v}</div><div className="text-xs text-gray-400 truncate max-w-[260px]">{r.subtitle}</div></div>
  ) },
  orderColumn,
  statusColumn,
];

const HeroSectionPage = () => (
  <ContentManager
    title="Hero Section"
    subtitle="Home page hero / banner carousel slides shown on the website"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default HeroSectionPage;
