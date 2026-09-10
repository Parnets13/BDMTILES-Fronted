import ContentManager, { imageColumn, statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getTileSizes,
  create: webManagementService.createTileSize,
  update: webManagementService.updateTileSize,
  delete: webManagementService.deleteTileSize,
};

const fields = [
  { name: 'label', label: 'Size Label', type: 'text', required: true, placeholder: 'e.g. 600×600' },
  { name: 'sub', label: 'Sub-label', type: 'text', placeholder: 'e.g. mm or mm slab' },
  { name: 'image', label: 'Image', type: 'image' },
  { name: 'query', label: 'Search Query', type: 'text', placeholder: 'e.g. 600x600 tiles', help: 'Term used to search when this card is clicked' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  imageColumn(),
  { title: 'Size', key: 'size', render: (_, r) => (
    <div>
      <div className="font-bold text-sm font-mono">
        {r.label} <span className="text-xs text-gray-400 font-normal">{r.sub}</span>
      </div>
      {r.query && <div className="text-xs text-blue-400">→ {r.query}</div>}
    </div>
  ) },
  orderColumn,
  statusColumn,
];

const TileSizePage = () => (
  <ContentManager
    title="Shop by Size"
    subtitle="Tile size cards shown in the 'Shop Tiles by Size' section on the website"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default TileSizePage;
