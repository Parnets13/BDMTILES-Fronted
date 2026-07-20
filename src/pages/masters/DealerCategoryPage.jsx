import SimpleMaster from './SimpleMaster.jsx';
import masterService from '../../services/masterService.js';

const service = {
  get: masterService.getDealerCategories,
  create: masterService.createDealerCategory,
  update: masterService.updateDealerCategory,
  delete: masterService.deleteDealerCategory,
};

const DealerCategoryPage = () => (
  <SimpleMaster title="Dealer Category" subtitle="Manage dealer categories (A, B, C grade dealers)" service={service} />
);

export default DealerCategoryPage;
