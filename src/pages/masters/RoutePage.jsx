import SimpleMaster from './SimpleMaster.jsx';
import masterService from '../../services/masterService.js';

const service = {
  get: masterService.getRoutes,
  create: masterService.createRoute,
  update: masterService.updateRoute,
  delete: masterService.deleteRoute,
};

const RoutePage = () => (
  <SimpleMaster title="Route Master" subtitle="Manage delivery and sales visit routes" service={service} />
);

export default RoutePage;
