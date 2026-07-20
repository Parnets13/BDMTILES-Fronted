import SimpleMaster from './SimpleMaster.jsx';
import masterService from '../../services/masterService.js';

const service = {
  get: masterService.getDealerTypes,
  create: masterService.createDealerType,
  update: masterService.updateDealerType,
  delete: masterService.deleteDealerType,
};

const DealerTypePage = () => (
  <SimpleMaster title="Dealer Type" subtitle="Manage dealer types (Retailer, Distributor, Sub-dealer, etc.)" service={service} />
);

export default DealerTypePage;
