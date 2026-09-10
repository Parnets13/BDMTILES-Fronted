import ContentManager, { imageColumn, statusColumn, orderColumn, ICON_OPTIONS } from './ContentManager.jsx';
import webManagementService from '../../services/webManagementService.js';

const service = {
  get: webManagementService.getTileRooms,
  create: webManagementService.createTileRoom,
  update: webManagementService.updateTileRoom,
  delete: webManagementService.deleteTileRoom,
};

const fields = [
  { name: 'name', label: 'Room Name', type: 'text', required: true, placeholder: 'e.g. Living Room' },
  { name: 'icon', label: 'Icon', type: 'icon', help: 'Icon shown on the card' },
  { name: 'image', label: 'Image', type: 'image' },
  { name: 'query', label: 'Search Query', type: 'text', placeholder: 'e.g. floor tiles', help: 'Term used to search when this card is clicked' },
  { name: 'sortOrder', label: 'Sort Order', type: 'number', help: 'Lower shows first' },
  { name: 'status', label: 'Status', type: 'status' },
];

const columns = [
  imageColumn(),
  { title: 'Room', key: 'room', render: (_, r) => {
    const opt = ICON_OPTIONS.find((o) => o.value === r.icon);
    return (
      <div className="flex items-center gap-2">
        {r.icon && <i className={`fa-solid ${r.icon} text-orange-500 text-base w-4`} />}
        <div>
          <div className="font-medium text-sm">{r.name}</div>
          {r.query && <div className="text-xs text-gray-400">→ {r.query}</div>}
        </div>
      </div>
    );
  } },
  orderColumn,
  statusColumn,
];

const TileRoomPage = () => (
  <ContentManager
    title="Shop by Room"
    subtitle="Room cards shown in the 'Shop Tiles by Room' section on the website"
    service={service}
    fields={fields}
    columns={columns}
  />
);

export default TileRoomPage;
