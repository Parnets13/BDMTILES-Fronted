import SimpleMaster from './SimpleMaster.jsx';
import masterService from '../../services/masterService.js';

const service = {
  get: masterService.getExpenseCategories,
  create: masterService.createExpenseCategory,
  update: masterService.updateExpenseCategory,
  delete: masterService.deleteExpenseCategory,
};

const ExpenseCategoryPage = () => (
  <SimpleMaster title="Expense Category" subtitle="Manage expense heads (Travel, Fuel, Office, etc.)" service={service} />
);

export default ExpenseCategoryPage;
