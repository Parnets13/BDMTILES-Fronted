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
import PriceListPage from './pages/masters/PriceListPage.jsx';
import DealerProductPricingPage from './pages/masters/DealerProductPricingPage.jsx';
import DealerMaster from './pages/masters/DealerMaster.jsx';
import DealerTypePage from './pages/masters/DealerTypePage.jsx';
import DealerCategoryPage from './pages/masters/DealerCategoryPage.jsx';
import RegionPage from './pages/masters/RegionPage.jsx';
import RoutePage from './pages/masters/RoutePage.jsx';
import SupplierMaster from './pages/masters/SupplierMaster.jsx';
import WarehousePage from './pages/masters/WarehousePage.jsx';
import ExpenseCategoryPage from './pages/masters/ExpenseCategoryPage.jsx';
import SalesOrderDashboard from './pages/sales/SalesOrderDashboard.jsx';
import SalesReturnPage from './pages/sales/SalesReturnPage.jsx';
import DealerPaymentsPage from './pages/sales/DealerPaymentsPage.jsx';
import DealerInvoicePage from './pages/sales/DealerInvoicePage.jsx';
import PurchaseOrderPage from './pages/purchase/PurchaseOrderPage.jsx';
import GRNEntryPage from './pages/purchase/GRNEntryPage.jsx';
import DebitNotePage from './pages/purchase/DebitNotePage.jsx';
import SupplierPaymentsPage from './pages/purchase/SupplierPaymentsPage.jsx';
import SupplierInvoicePage from './pages/purchase/SupplierInvoicePage.jsx';
import StockPage from './pages/inventory/StockPage.jsx';
import StockAdjustmentPage from './pages/inventory/StockAdjustmentPage.jsx';
import StockTransferPage from './pages/inventory/StockTransferPage.jsx';
import PurchaseReturnPage from './pages/purchase/PurchaseReturnPage.jsx';
import QuotationManager from './pages/sales/QuotationManager.jsx';

// Finance Pages
import DealerLedger from './pages/finance/DealerLedger.jsx';
import SupplierLedger from './pages/finance/SupplierLedger.jsx';
import ChequeManagement from './pages/finance/ChequeManagement.jsx';
import VoucherEntry from './pages/finance/VoucherEntry.jsx';
import CashBankBook from './pages/finance/CashBankBook.jsx';
import PaymentAllocation from './pages/finance/PaymentAllocation.jsx';

// Week 8 — Dispatch, Warehouse, CRM, Complaints, Approvals
import DispatchPlanning from './pages/dispatch/DispatchPlanning.jsx';
import PickingList from './pages/warehouse/PickingList.jsx';
import SortingList from './pages/warehouse/SortingList.jsx';
import LoadingVerification from './pages/warehouse/LoadingVerification.jsx';
import LeadManagement from './pages/crm/LeadManagement.jsx';
import Customer360 from './pages/crm/Customer360.jsx';
import ComplaintDashboard from './pages/complaints/ComplaintDashboard.jsx';
import ApprovalWorkflow from './pages/approvals/ApprovalWorkflow.jsx';

// Week 9+10 — Dashboard, Reports, Tally, Schemes
import OwnerDashboard from './pages/dashboard/OwnerDashboard.jsx';
import SalesReports from './pages/reports/SalesReports.jsx';
import PurchaseReports from './pages/reports/PurchaseReports.jsx';
import InventoryReports from './pages/reports/InventoryReports.jsx';
import GSTReports from './pages/reports/GSTReports.jsx';
import AgingReport from './pages/reports/AgingReport.jsx';
import BillWiseProfit from './pages/reports/BillWiseProfit.jsx';
import DealerPerformance from './pages/reports/DealerPerformance.jsx';
import FinanceStatements from './pages/reports/FinanceStatements.jsx';
import HRReports from './pages/reports/HRReports.jsx';
import ActivityLogs from './pages/reports/ActivityLogs.jsx';
import TallyDashboard from './pages/tally/TallyDashboard.jsx';
import SupplierSchemeEntry from './pages/schemes/SupplierSchemeEntry.jsx';
import DealerSchemeSetup from './pages/schemes/DealerSchemeSetup.jsx';

// HRMS Pages
import EmployeeRegistration from './pages/hrms/EmployeeRegistration.jsx';
import AttendanceDashboard from './pages/hrms/AttendanceDashboard.jsx';
import LeaveManagement from './pages/hrms/LeaveManagement.jsx';
import SalaryProcessing from './pages/hrms/SalaryProcessing.jsx';
import LoansAdvances from './pages/hrms/LoansAdvances.jsx';
import HRMSSettings from './pages/hrms/HRMSSettings.jsx';

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
        <Route path="/dashboard"
          element={<ProtectedRoute requiredPermission="dashboard.view"><OwnerDashboard /></ProtectedRoute>} />

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
              <PriceListPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/masters/dealer-product-pricing"
          element={
            <ProtectedRoute requiredPermission="product.master">
              <DealerProductPricingPage />
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
              <PurchaseOrderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/grn-entry"
          element={
            <ProtectedRoute requiredPermission="grn.entry">
              <GRNEntryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/dealer-invoice"
          element={
            <ProtectedRoute requiredPermission="invoice">
              <DealerInvoicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/supplier-invoice"
          element={
            <ProtectedRoute requiredPermission="invoice">
              <SupplierInvoicePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/supplier-payments"
          element={
            <ProtectedRoute requiredPermission="payment">
              <SupplierPaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/dealer-payments"
          element={
            <ProtectedRoute requiredPermission="payment">
              <DealerPaymentsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/debit-note"
          element={
            <ProtectedRoute requiredPermission="debit.note">
              <DebitNotePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/purchase-return"
          element={
            <ProtectedRoute requiredPermission="debit.note">
              <PurchaseReturnPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sales-purchase/credit-note"
          element={
            <ProtectedRoute requiredPermission="credit.note">
              <SalesReturnPage />
            </ProtectedRoute>
          }
        />

        {/* Inventory & Warehouse */}
        <Route
          path="/inventory/stock"
          element={
            <ProtectedRoute requiredPermission="stock">
              <StockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-transfer"
          element={
            <ProtectedRoute requiredPermission="stock.transfer">
              <StockTransferPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/inventory/stock-adjustment"
          element={
            <ProtectedRoute requiredPermission="stock.adjustment">
              <StockAdjustmentPage />
            </ProtectedRoute>
          }
        />

        {/* HRMS */}
        <Route
          path="/hrms/employee-registration"
          element={
            <ProtectedRoute requiredPermission="employee.registration">
              <EmployeeRegistration />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/geo-attendance"
          element={
            <ProtectedRoute requiredPermission="geo.attendance.monitoring">
              <AttendanceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/attendance-master"
          element={
            <ProtectedRoute requiredPermission="attendance.master">
              <AttendanceDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/shift-management"
          element={
            <ProtectedRoute requiredPermission="attendance.master">
              <HRMSSettings />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/leave-management"
          element={
            <ProtectedRoute requiredPermission="attendance.master">
              <LeaveManagement />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/salary-processing"
          element={
            <ProtectedRoute requiredPermission="salary.processing">
              <SalaryProcessing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/generate-salary-slip"
          element={
            <ProtectedRoute requiredPermission="generate.salary.slip">
              <SalaryProcessing />
            </ProtectedRoute>
          }
        />
        <Route
          path="/hrms/loans-advances"
          element={
            <ProtectedRoute requiredPermission="salary.processing">
              <LoansAdvances />
            </ProtectedRoute>
          }
        />

        {/* Finance & Accounts */}
        <Route path="/finance/dealer-ledger"
          element={<ProtectedRoute requiredPermission="dealer.ledger"><DealerLedger /></ProtectedRoute>} />
        <Route path="/finance/supplier-ledger"
          element={<ProtectedRoute requiredPermission="supplier.ledger"><SupplierLedger /></ProtectedRoute>} />
        <Route path="/finance/cheque-management"
          element={<ProtectedRoute requiredPermission="cheque.management"><ChequeManagement /></ProtectedRoute>} />
        <Route path="/finance/voucher-entry"
          element={<ProtectedRoute requiredPermission="finance.management"><VoucherEntry /></ProtectedRoute>} />
        <Route path="/finance/bank-account-master"
          element={<ProtectedRoute requiredPermission="finance.management"><VoucherEntry /></ProtectedRoute>} />
        <Route path="/finance/cash-bank-book"
          element={<ProtectedRoute requiredPermission="finance.management"><CashBankBook /></ProtectedRoute>} />
        <Route path="/finance/payment-allocation"
          element={<ProtectedRoute requiredPermission="finance.management"><PaymentAllocation /></ProtectedRoute>} />
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
        {/* Supplier Incentive Schemes */}
        <Route path="/supplier-incentive/scheme-entry" element={<ProtectedRoute requiredPermission="scheme.entry"><SupplierSchemeEntry /></ProtectedRoute>} />
        <Route path="/supplier-incentive/scheme-analysis" element={<ProtectedRoute requiredPermission="scheme.analysis"><SupplierSchemeEntry /></ProtectedRoute>} />
        <Route path="/supplier-incentive/claim-submission" element={<ProtectedRoute requiredPermission="claim.submission"><SupplierSchemeEntry /></ProtectedRoute>} />
        <Route path="/supplier-incentive/reconciliation" element={<ProtectedRoute requiredPermission="incentive.reconciliation"><SupplierSchemeEntry /></ProtectedRoute>} />

        {/* Dealer Schemes */}
        <Route path="/dealer-app/scheme-setup" element={<ProtectedRoute requiredPermission="scheme.analysis"><DealerSchemeSetup /></ProtectedRoute>} />

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

        {/* Inventory — additional */}
        <Route path="/inventory/physical-audit" element={<ProtectedRoute requiredPermission="stock.adjustment"><PlaceholderPage title="Physical Stock Audit" /></ProtectedRoute>} />
        <Route path="/inventory/stock-alerts" element={<ProtectedRoute requiredPermission="stock"><PlaceholderPage title="Stock Alerts" /></ProtectedRoute>} />

        {/* Warehouse Operations */}
        <Route path="/warehouse/picking-list" element={<ProtectedRoute requiredPermission="warehouse.manager"><PickingList /></ProtectedRoute>} />
        <Route path="/warehouse/sorting-list" element={<ProtectedRoute requiredPermission="warehouse.manager"><SortingList /></ProtectedRoute>} />
        <Route path="/warehouse/loading-verification" element={<ProtectedRoute requiredPermission="warehouse.manager"><LoadingVerification /></ProtectedRoute>} />
        <Route path="/warehouse/dispatch-planning" element={<ProtectedRoute requiredPermission="warehouse.manager"><DispatchPlanning /></ProtectedRoute>} />

        {/* Dispatch & Delivery */}
        <Route path="/dispatch/delivery-assignment" element={<ProtectedRoute requiredPermission="dispatch.management"><DispatchPlanning /></ProtectedRoute>} />
        <Route path="/dispatch/delivery-monitoring" element={<ProtectedRoute requiredPermission="dispatch.management"><DispatchPlanning /></ProtectedRoute>} />
        <Route path="/dispatch/delivery-history" element={<ProtectedRoute requiredPermission="dispatch.management"><PlaceholderPage title="Delivery History" /></ProtectedRoute>} />
        <Route path="/dispatch/live-tracking" element={<ProtectedRoute requiredPermission="dispatch.management"><PlaceholderPage title="Live Tracking" /></ProtectedRoute>} />
        <Route path="/dispatch/route-optimization" element={<ProtectedRoute requiredPermission="dispatch.management"><PlaceholderPage title="Route Optimization" /></ProtectedRoute>} />

        {/* CRM */}
        <Route path="/crm/lead-management" element={<ProtectedRoute requiredPermission="lead.management"><LeadManagement /></ProtectedRoute>} />
        <Route path="/crm/followup-manager" element={<ProtectedRoute requiredPermission="lead.management"><LeadManagement /></ProtectedRoute>} />
        <Route path="/crm/customer-360" element={<ProtectedRoute requiredPermission="lead.management"><Customer360 /></ProtectedRoute>} />

        {/* Complaints & Returns */}
        <Route path="/complaints/dashboard" element={<ProtectedRoute requiredPermission="complaint.management"><ComplaintDashboard /></ProtectedRoute>} />
        <Route path="/complaints/return-request" element={<ProtectedRoute requiredPermission="complaint.management"><ComplaintDashboard /></ProtectedRoute>} />
        <Route path="/complaints/resolution" element={<ProtectedRoute requiredPermission="complaint.management"><ComplaintDashboard /></ProtectedRoute>} />

        {/* Assets */}
        <Route path="/assets/master" element={<ProtectedRoute requiredPermission="asset.management"><PlaceholderPage title="Asset Master" /></ProtectedRoute>} />
        <Route path="/assets/assignment" element={<ProtectedRoute requiredPermission="asset.management"><PlaceholderPage title="Asset Assignment" /></ProtectedRoute>} />
        <Route path="/assets/maintenance" element={<ProtectedRoute requiredPermission="asset.management"><PlaceholderPage title="Asset Maintenance" /></ProtectedRoute>} />

        {/* HRMS — additional */}
        <Route path="/hrms/overtime-calculation" element={<ProtectedRoute requiredPermission="attendance.master"><PlaceholderPage title="Overtime Calculation" /></ProtectedRoute>} />
        <Route path="/hrms/daily-wage-workers" element={<ProtectedRoute requiredPermission="attendance.master"><PlaceholderPage title="Daily Wage Workers" /></ProtectedRoute>} />
        <Route path="/hrms/settings" element={<ProtectedRoute requiredPermission="hrms.settings"><HRMSSettings /></ProtectedRoute>} />

        {/* Finance — additional */}
        <Route path="/finance/credit-days-monitor" element={<ProtectedRoute requiredPermission="finance.management"><PlaceholderPage title="Credit Days Monitor" /></ProtectedRoute>} />
        <Route path="/finance/expense-management" element={<ProtectedRoute requiredPermission="finance.management"><PlaceholderPage title="Expense Management" /></ProtectedRoute>} />

        {/* Sales & Purchase — additional */}
        <Route path="/sales-purchase/quotation-manager" element={<ProtectedRoute requiredPermission="sales.order.create"><QuotationManager /></ProtectedRoute>} />
        <Route path="/sales-purchase/purchase-requisition" element={<ProtectedRoute requiredPermission="po.management"><PlaceholderPage title="Purchase Requisition" /></ProtectedRoute>} />
        <Route path="/masters/vehicles" element={<ProtectedRoute requiredPermission="vehicle.master"><PlaceholderPage title="Vehicle Master" /></ProtectedRoute>} />

        {/* Reports — additional */}
        <Route path="/reports/sales-reports" element={<ProtectedRoute requiredPermission="reports.management"><SalesReports /></ProtectedRoute>} />
        <Route path="/reports/purchase-reports" element={<ProtectedRoute requiredPermission="reports.management"><PurchaseReports /></ProtectedRoute>} />
        <Route path="/reports/inventory-reports" element={<ProtectedRoute requiredPermission="reports.management"><InventoryReports /></ProtectedRoute>} />
        <Route path="/reports/hr-reports" element={<ProtectedRoute requiredPermission="reports.management"><HRReports /></ProtectedRoute>} />
        <Route path="/reports/se-performance" element={<ProtectedRoute requiredPermission="reports.management"><PlaceholderPage title="SE Performance" /></ProtectedRoute>} />
        <Route path="/reports/cash-flow" element={<ProtectedRoute requiredPermission="balance.sheet"><FinanceStatements /></ProtectedRoute>} />
        <Route path="/reports/bank-reconciliation" element={<ProtectedRoute requiredPermission="balance.sheet"><PlaceholderPage title="Bank Reconciliation" /></ProtectedRoute>} />
        <Route path="/reports/gst-reports" element={<ProtectedRoute requiredPermission="reports.management"><GSTReports /></ProtectedRoute>} />
        <Route path="/reports/aging-report" element={<ProtectedRoute requiredPermission="reports.management"><AgingReport /></ProtectedRoute>} />
        <Route path="/reports/audit-trail" element={<ProtectedRoute requiredPermission="balance.sheet"><ActivityLogs /></ProtectedRoute>} />
        <Route path="/reports/activity-logs" element={<ProtectedRoute requiredPermission="activity.logs"><ActivityLogs /></ProtectedRoute>} />
        <Route path="/reports/download-logs" element={<ProtectedRoute requiredPermission="download.logs"><ActivityLogs /></ProtectedRoute>} />
        <Route path="/reports/dealer-performance" element={<ProtectedRoute requiredPermission="dealer.performance"><DealerPerformance /></ProtectedRoute>} />
        <Route path="/reports/balance-sheet" element={<ProtectedRoute requiredPermission="balance.sheet"><FinanceStatements /></ProtectedRoute>} />
        <Route path="/reports/trial-balance" element={<ProtectedRoute requiredPermission="balance.sheet"><FinanceStatements /></ProtectedRoute>} />
        <Route path="/reports/profit-loss" element={<ProtectedRoute requiredPermission="balance.sheet"><FinanceStatements /></ProtectedRoute>} />
        <Route path="/reports/profit-analysis/bill-wise-profit" element={<ProtectedRoute requiredPermission="bill.wise.profit"><BillWiseProfit /></ProtectedRoute>} />
        <Route path="/reports/profit-analysis/category-margin" element={<ProtectedRoute requiredPermission="category.product.gross.margin"><BillWiseProfit /></ProtectedRoute>} />
        <Route path="/reports/profit-analysis/deviation-report" element={<ProtectedRoute requiredPermission="sale.vs.purchase.price.deviation"><BillWiseProfit /></ProtectedRoute>} />

        {/* Tally Integration */}
        <Route path="/tally/dashboard" element={<ProtectedRoute requiredPermission="tally.sync"><TallyDashboard /></ProtectedRoute>} />
        <Route path="/tally/sync-status" element={<ProtectedRoute requiredPermission="tally.sync"><TallyDashboard /></ProtectedRoute>} />
        <Route path="/tally/conflict-resolver" element={<ProtectedRoute requiredPermission="tally.sync"><TallyDashboard /></ProtectedRoute>} />

        {/* Approval Workflow */}
        <Route path="/approvals" element={<ProtectedRoute requiredPermission="dashboard.view"><ApprovalWorkflow /></ProtectedRoute>} />

        {/* Fallback */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />      </Routes>
    </AppLayout>
  );
};

export default App;
