import SimpleMaster from './SimpleMaster.jsx';
import masterService from '../../services/masterService.js';

const service = {
  get: masterService.getWarehouses,
  create: masterService.createWarehouse,
  update: masterService.updateWarehouse,
  delete: masterService.deleteWarehouse,
};

const WarehousePage = () => (
  <SimpleMaster title="Warehouse Master" subtitle="Manage warehouses and storage locations" service={service} />
);

export default WarehousePage;
