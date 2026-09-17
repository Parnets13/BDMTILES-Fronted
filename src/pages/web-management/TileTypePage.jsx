import { Tag } from 'antd';
import ContentManager, { imageColumn, statusColumn, orderColumn } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getTileTypes,
  create: webManagementService.createTileType,
  update: webManagementService.updateTileType,
  delete: webManagementService.deleteTileType,
};

const fields = [
  { name: 'name', label: 'Tile Type Name', type: 'text', required: true, placeholder: 'e.g. Vitrified Tiles' },
  { name: 'desc', label: 'Description', type: 'text', placeholder: 'e.g. GVT / PGVT floor tiles' },
  { name: 'image', label: 'Image', type: 'image' },
  { name: 'query', label: 'Search Query', type: 'text', placeholder: 'e.g. vitrified tiles' },
  { name: 'badge', label: 'Badge', type: 'text', placeholder: 'e.g. Popular or New (leave blank for none)' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  imageColumn(),
  { title: 'Type', key: 'type', render: (_, r) => (
    <div>
      <div className="flex items-center gap-2">
        <span className="font-medium text-sm">{r.name}</span>
        {r.badge && <Tag color="orange" className="text-[10px]">{r.badge}</Tag>}
      </div>
      {r.desc && <div className="text-xs text-gray-400">{r.desc}</div>}
      {r.query && <div className="text-xs text-blue-400">→ {r.query}</div>}
    </div>
  ) },
  orderColumn,
  statusColumn,
];

const TileTypePage = () => (
  <ContentManager
    title="Shop by Tile Type"
    subtitle="Tile type cards shown in the 'Shop by Tile Type' section on the website"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default TileTypePage;
