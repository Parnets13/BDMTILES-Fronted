import ContentManager, { imageColumn, statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getTestimonials,
  create: webManagementService.createTestimonial,
  update: webManagementService.updateTestimonial,
  delete: webManagementService.deleteTestimonial,
};

// Badge colour presets matching the website.
const BADGE_COLORS = ['#10B981', '#F59E0B', '#3B82F6', '#EF4444', '#8B5CF6', '#F97316'];

const fields = [
  { name: 'name', label: 'Customer Name', type: 'text', required: true, placeholder: 'e.g. Mr. Pawan' },
  { name: 'badge', label: 'Badge / Role', type: 'text', placeholder: 'e.g. Verified Site Contractor' },
  { name: 'badgeColor', label: 'Badge Color', type: 'color', presets: BADGE_COLORS, help: 'Background color of the badge pill' },
  { name: 'quote', label: 'Quote', type: 'textarea', required: true, placeholder: '"Delivered 40 bags of cement to Whitefield site in 52 mins flat."' },
  { name: 'caption', label: 'Caption', type: 'text', placeholder: 'e.g. Mr. Pawan shares his BDM TILES experience' },
  { name: 'image', label: 'Customer Photo', type: 'image', help: 'Portrait photo shown as the card background on the website' },
  { name: 'rating', label: 'Rating (0–5)', type: 'number' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

// Clean table columns — no card gallery, just data rows.
const columns = [
  imageColumn('image', 'Photo'),
  {
    title: 'Customer',
    key: 'customer',
    render: (_, r) => (
      <div>
        <div className="font-medium text-sm">{r.name}</div>
        {r.badge && (
          <span
            className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full text-white mt-0.5"
            style={{ backgroundColor: r.badgeColor || '#10B981' }}
          >
            {r.badge}
          </span>
        )}
      </div>
    ),
  },
  {
    title: 'Quote',
    dataIndex: 'quote',
    render: (v) => (
      <span className="text-xs text-gray-600 line-clamp-2 max-w-[340px] inline-block">{v}</span>
    ),
  },
  {
    title: 'Caption',
    dataIndex: 'caption',
    render: (v) => <span className="text-xs text-gray-400">{v || '—'}</span>,
  },
  orderColumn,
  statusColumn,
];

const TestimonialPage = () => (
  <ContentManager
    title="What our customers say"
    subtitle="Customer review cards shown in the 'What our customers say' section on the website"
    service={service}
    fields={fields}
    columns={columns}
    // No cardRender — shows a clean table list, not portrait cards.
    // preview prop gives a live preview inside the Add/Edit modal only.
  />
);

export default TestimonialPage;
