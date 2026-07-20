import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';
import { Spin } from 'antd';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import AppLayout from './components/layout/AppLayout.jsx';

// Pages
import Login from './pages/auth/Login.jsx';
import UserManagement from './pages/system/UserManagement.jsx';
import CategorySetup from './pages/masters/CategorySetup.jsx';
import ProductMaster from './pages/masters/ProductMaster.jsx';
import DealerMaster from './pages/masters/DealerMaster.jsx';
import DealerTypePage from './pages/masters/DealerTypePage.jsx';
import DealerCategoryPage from './pages/masters/DealerCategoryPage.jsx';
import RegionPage from './pages/masters/RegionPage.jsx';
import RoutePage from './pages/masters/RoutePage.jsx';
import SupplierMaster from './pages/masters/SupplierMaster.jsx';
import WarehousePage from './pages/masters/WarehousePage.jsx';
import ExpenseCategoryPage from './pages/masters/ExpenseCategoryPage.jsx';
import SalesOrderDashboard from './pages/sales/SalesOrderDashboard.jsx';

// Placeholder page component for modules not yet built
const PlaceholderPage = ({ title }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
    <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
    <p className="mt-2 text-gray-500">This module is under development.</p>
    <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-dashed border-gray-300">
      <p className="text-sm text-gray-400">Module content will appear here once implemented.</p>
    </div>
  </div>
);

const App = () => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <Spin size="large" tip="Loading BDMTILES..." />
      </div>
    );
  }

  // Not authenticated — show login
  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Authenticated — show app with layout
  return (
    <AppLayout>
      <Routes>
        <Route path="/login" element={<Navigate to="/dashboard" replace />} />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredPermission="dashboard.view">
              <PlaceholderPage title="Dashboard" />
            </ProtectedRoute>
          }
        />

        {/* System Management */}
        <Route
          path="/system/users"
          element={
            <ProtectedRoute requiredPermission="users.manage">
              <UserManagement />
            </ProtectedRoute>
          }
        />

        {/* Master Management */}
        <Route
          path="/masters/products"
          element={
            <ProtectedRoute requiredPermission="product.master">
              <ProductMaster />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/price-list"
          element={
            <ProtectedRoute requiredPermission="product.master">
              <PlaceholderPage title="Price List" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/dealer-product-pricing"
          element={
            <ProtectedRoute requiredPermission="product.master">
              <PlaceholderPage title="Dealer Product Pricing" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/categories"
          element={
            <ProtectedRoute requiredPermission="category.setup">
              <CategorySetup />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/dealer-type"
          element={
            <ProtectedRoute requiredPermission="dealer.type">
              <DealerTypePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/dealer-category"
          element={
            <ProtectedRoute requiredPermission="dealer.category">
              <DealerCategoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/expense-category"
          element={
            <ProtectedRoute requiredPermission="expense.category">
              <ExpenseCategoryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/regions"
          element={
            <ProtectedRoute requiredPermission="region.master">
              <RegionPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/routes"
          element={
            <ProtectedRoute requiredPermission="route.master">
              <RoutePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/warehouse-master"
          element={
            <ProtectedRoute requiredPermission="warehouse.master">
              <WarehousePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/dealers"
          element={
            <ProtectedRoute requiredPermission="dealer.master">
              <DealerMaster />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/suppliers"
          element={
            <ProtectedRoute requiredPermission="supplier.master">
              <SupplierMaster />
            </ProtectedRoute>
          }
        />

        {/* Sales & Purchase */}
        <Route
          path="/sales-purchase/sales-order-dashboard"
          element={
            <ProtectedRoute requiredPermission="sales.order.dashboard">
              <SalesOrderDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/dealer-discounts"
          element={
            <ProtectedRoute requiredPermission="dealer.specific.discounts">
              <PlaceholderPage title="Dealer Discounts" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/po-management"
          element={
            <ProtectedRoute requiredPermission="po.management">
              <PlaceholderPage title="PO Management" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/grn-entry"
          element={
            <ProtectedRoute requiredPermission="grn.entry">
              <PlaceholderPage title="GRN Entry" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/dealer-invoice"
          element={
            <ProtectedRoute requiredPermission="invoice">
              <PlaceholderPage title="Dealer Invoice" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/supplier-invoice"
          element={
            <ProtectedRoute requiredPermission="invoice">
              <PlaceholderPage title="Supplier Invoice" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/supplier-payments"
          element={
            <ProtectedRoute requiredPermission="payment">
              <PlaceholderPage title="Supplier Payments" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/dealer-payments"
          element={
            <ProtectedRoute requiredPermission="payment">
              <PlaceholderPage title="Dealer Payments" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/debit-note"
          element={
            <ProtectedRoute requiredPermission="debit.note">
              <PlaceholderPage title="Debit Note" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/credit-note"
          element={
            <ProtectedRoute requiredPermission="credit.note">
              <PlaceholderPage title="Credit Note" />
            </ProtectedRoute>
          }
        />

        {/* Inventory & Warehouse */}
        <Route
          path="/inventory/stock"
          element={
            <ProtectedRoute requiredPermission="stock">
              <PlaceholderPage title="Stock" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-transfer"
          element={
            <ProtectedRoute requiredPermission="stock.transfer">
              <PlaceholderPage title="Stock Transfer" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-adjustment"
          element={
            <ProtectedRoute requiredPermission="stock.adjustment">
              <PlaceholderPage title="Stock Adjustment" />
            </ProtectedRoute>
          }
        />

        {/* HRMS */}
        <Route
          path="/hrms/employee-registration"
          element={
            <ProtectedRoute requiredPermission="employee.registration">
              <PlaceholderPage title="Employee Registration" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/geo-attendance"
          element={
            <ProtectedRoute requiredPermission="geo.attendance.monitoring">
              <PlaceholderPage title="Geo Attendance" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/attendance-master"
          element={
            <ProtectedRoute requiredPermission="attendance.master">
              <PlaceholderPage title="Attendance Master" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/shift-management"
          element={
            <ProtectedRoute requiredPermission="attendance.master">
              <PlaceholderPage title="Shift Management" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/leave-management"
          element={
            <ProtectedRoute requiredPermission="attendance.master">
              <PlaceholderPage title="Leave Management" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/salary-processing"
          element={
            <ProtectedRoute requiredPermission="salary.processing">
              <PlaceholderPage title="Salary Processing" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/generate-salary-slip"
          element={
            <ProtectedRoute requiredPermission="generate.salary.slip">
              <PlaceholderPage title="Generate Salary Slip" />
            </ProtectedRoute>
          }
        />

        {/* Finance & Accounts */}
        <Route
          path="/finance/bank-account-master"
          element={
            <ProtectedRoute requiredPermission="finance.management">
              <PlaceholderPage title="Bank Account Master" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/voucher-entry"
          element={
            <ProtectedRoute requiredPermission="finance.management">
              <PlaceholderPage title="Voucher Entry" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/account-master"
          element={
            <ProtectedRoute requiredPermission="finance.management">
              <PlaceholderPage title="Account Master" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/payment-allocation"
          element={
            <ProtectedRoute requiredPermission="finance.management">
              <PlaceholderPage title="Payment Allocation" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/cash-bank-book"
          element={
            <ProtectedRoute requiredPermission="finance.management">
              <PlaceholderPage title="Cash/Bank Book" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/dealer-ledger"
          element={
            <ProtectedRoute requiredPermission="dealer.ledger">
              <PlaceholderPage title="Dealer Ledger" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/supplier-ledger"
          element={
            <ProtectedRoute requiredPermission="supplier.ledger">
              <PlaceholderPage title="Supplier Ledger" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/cheque-management"
          element={
            <ProtectedRoute requiredPermission="cheque.management">
              <PlaceholderPage title="Cheque Management" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/finance/auto-reconciliation"
          element={
            <ProtectedRoute requiredPermission="auto.reconciliation">
              <PlaceholderPage title="Auto Reconciliation" />
            </ProtectedRoute>
          }
        />

        {/* Reports & Logs */}
        <Route
          path="/reports/profit-analysis/bill-wise-profit"
          element={
            <ProtectedRoute requiredPermission="bill.wise.profit">
              <PlaceholderPage title="Bill-wise Profit" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/profit-analysis/category-margin"
          element={
            <ProtectedRoute requiredPermission="category.product.gross.margin">
              <PlaceholderPage title="Category Margin" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/profit-analysis/deviation-report"
          element={
            <ProtectedRoute requiredPermission="sale.vs.purchase.price.deviation">
              <PlaceholderPage title="Deviation Report" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/activity-logs"
          element={
            <ProtectedRoute requiredPermission="activity.logs">
              <PlaceholderPage title="Activity Logs" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/download-logs"
          element={
            <ProtectedRoute requiredPermission="download.logs">
              <PlaceholderPage title="Download Logs" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/dealer-performance"
          element={
            <ProtectedRoute requiredPermission="dealer.performance">
              <PlaceholderPage title="Dealer Performance" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/balance-sheet"
          element={
            <ProtectedRoute requiredPermission="balance.sheet">
              <PlaceholderPage title="Balance Sheet" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/trial-balance"
          element={
            <ProtectedRoute requiredPermission="balance.sheet">
              <PlaceholderPage title="Trial Balance" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/profit-loss"
          element={
            <ProtectedRoute requiredPermission="balance.sheet">
              <PlaceholderPage title="Profit & Loss" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/gst-reports"
          element={
            <ProtectedRoute requiredPermission="balance.sheet">
              <PlaceholderPage title="GST Reports" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/aging-report"
          element={
            <ProtectedRoute requiredPermission="balance.sheet">
              <PlaceholderPage title="Aging Report" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports/audit-trail"
          element={
            <ProtectedRoute requiredPermission="balance.sheet">
              <PlaceholderPage title="Audit Trail" />
            </ProtectedRoute>
          }
        />

        {/* Supplier Incentive */}
        <Route
          path="/supplier-incentive/scheme-entry"
          element={
            <ProtectedRoute requiredPermission="scheme.entry">
              <PlaceholderPage title="Scheme Entry" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supplier-incentive/scheme-analysis"
          element={
            <ProtectedRoute requiredPermission="scheme.analysis">
              <PlaceholderPage title="Scheme Analysis" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supplier-incentive/claim-submission"
          element={
            <ProtectedRoute requiredPermission="claim.submission">
              <PlaceholderPage title="Claim Submission" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supplier-incentive/reconciliation"
          element={
            <ProtectedRoute requiredPermission="incentive.reconciliation">
              <PlaceholderPage title="Incentive Reconciliation" />
            </ProtectedRoute>
          }
        />

        {/* Dealer App */}
        <Route
          path="/dealer-app/support-chat"
          element={
            <ProtectedRoute requiredPermission="support.chat">
              <PlaceholderPage title="Support Chat" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dealer-app/order-requests"
          element={
            <ProtectedRoute requiredPermission="dealer.order.requests">
              <PlaceholderPage title="Dealer Order Requests" />
            </ProtectedRoute>
          }
        />

        {/* Sales Executive App */}
        <Route
          path="/se-app/attendance"
          element={
            <ProtectedRoute requiredPermission="se.attendance.view">
              <PlaceholderPage title="SE Attendance" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/dealer-visits"
          element={
            <ProtectedRoute requiredPermission="se.attendance.view">
              <PlaceholderPage title="Dealer Visits" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/dealer-assignment"
          element={
            <ProtectedRoute requiredPermission="se.attendance.view">
              <PlaceholderPage title="Dealer Assignment" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/route-plan"
          element={
            <ProtectedRoute requiredPermission="se.route.plan">
              <PlaceholderPage title="Route Plan" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/dealer-insights"
          element={
            <ProtectedRoute requiredPermission="se.dealer.insights">
              <PlaceholderPage title="Dealer Insights" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/collections"
          element={
            <ProtectedRoute requiredPermission="se.collections.view">
              <PlaceholderPage title="SE Collections" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/targets"
          element={
            <ProtectedRoute requiredPermission="se.targets.view">
              <PlaceholderPage title="Target Management" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/expenses"
          element={
            <ProtectedRoute requiredPermission="sales.executive.app">
              <PlaceholderPage title="SE Expenses" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/se-app/live-tracking"
          element={
            <ProtectedRoute requiredPermission="sales.executive.app">
              <PlaceholderPage title="SE Live Tracking" />
            </ProtectedRoute>
          }
        />

        {/* Delivery Executive App */}
        <Route
          path="/de-app/assignment"
          element={
            <ProtectedRoute requiredPermission="de.assignment.manage">
              <PlaceholderPage title="Delivery Assignment" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/de-app/monitoring"
          element={
            <ProtectedRoute requiredPermission="de.monitoring.view">
              <PlaceholderPage title="Delivery Monitoring" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/de-app/my-deliveries"
          element={
            <ProtectedRoute requiredPermission="de.deliveries.view">
              <PlaceholderPage title="My Deliveries" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/de-app/live-tracking"
          element={
            <ProtectedRoute requiredPermission="de.tracking.view">
              <PlaceholderPage title="DE Live Tracking" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/de-app/route-plan"
          element={
            <ProtectedRoute requiredPermission="de.route.view">
              <PlaceholderPage title="DE Route Plan" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/de-app/collections"
          element={
            <ProtectedRoute requiredPermission="de.collections.view">
              <PlaceholderPage title="DE Collections" />
            </ProtectedRoute>
          }
        />
        <Route
          path="/de-app/history"
          element={
            <ProtectedRoute requiredPermission="de.history.view">
              <PlaceholderPage title="Delivery History" />
            </ProtectedRoute>
          }
        />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </AppLayout>
  );
};

export default App;
