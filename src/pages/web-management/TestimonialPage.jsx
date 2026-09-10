import ContentManager, { imageColumn, statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getTestimonials,
  create: webManagementService.createTestimonial,
  update: webManagementService.updateTestimonial,
  delete: webManagementService.deleteTestimonial,
};

const fields = [
  { name: 'name', label: 'Customer Name', type: 'text', required: true, placeholder: 'e.g. Mr. Pawan' },
  { name: 'badge', label: 'Badge / Role', type: 'text', placeholder: 'e.g. Verified Site Contractor' },
  { name: 'quote', label: 'Quote', type: 'textarea', required: true, placeholder: 'What the customer said' },
  { name: 'caption', label: 'Caption', type: 'text', placeholder: 'e.g. Mr. Pawan shares his BDM TILES experience' },
  { name: 'image', label: 'Photo', type: 'image' },
  { name: 'rating', label: 'Rating (0-5)', type: 'number' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  imageColumn('image', 'Photo'),
  { title: 'Name', dataIndex: 'name', render: (v, r) => (
    <div><div className="font-medium text-sm">{v}</div><div className="text-xs text-gray-400">{r.badge}</div></div>
  ) },
  { title: 'Quote', dataIndex: 'quote', render: (v) => <span className="text-xs text-gray-600 line-clamp-2 max-w-[320px] inline-block">{v}</span> },
  orderColumn,
  statusColumn,
];

const TestimonialPage = () => (
  <ContentManager
    title="Testimonials"
    subtitle="Customer testimonials shown on the website home page"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default TestimonialPage;
