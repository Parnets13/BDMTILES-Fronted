import SimpleMaster from './SimpleMaster.jsx';
import masterService from '../../services/masterService.js';

const service = {
  get: masterService.getRegions,
  create: masterService.createRegion,
  update: masterService.updateRegion,
  delete: masterService.deleteRegion,
};

const RegionPage = () => (
  <SimpleMaster title="Region Master" subtitle="Manage sales regions and territories" service={service} />
);

export default RegionPage;
