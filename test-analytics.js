/**
 * Analytics System Test Script
 * Tests all analytics endpoints: sales, inventory, customers, KPIs, dashboard
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:8000';

// Test data from inventory test (you can replace with actual IDs)
let authToken = '';
let businessId = '';
let tenantId = '';

// Helper function for API calls
async function apiCall(method, endpoint, data = null, useAuth = true) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: useAuth && authToken ? { Authorization: `Bearer ${authToken}` } : {},
    };

    if (data) {
      config.data = data;
      config.headers['Content-Type'] = 'application/json';
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error(`❌ Error calling ${endpoint}:`, error.response?.data || error.message);
    throw error;
  }
}

// Print formatted JSON
function printJSON(obj, indent = 2) {
  console.log(JSON.stringify(obj, null, indent));
}

// Test Steps
async function runTest() {
  console.log('\n🚀 Starting Analytics System Test\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Login (using existing user from inventory test)
    console.log('\n📋 Step 1: Logging In...');
    const loginEmail = 'inventory-test-user-1730568519969@biznavigate.com'; // Update with your test user

    try {
      const loginData = await apiCall('POST', '/auth/login', {
        email: loginEmail,
        password: 'Test@123',
      }, false);
      authToken = loginData.data.accessToken;
      console.log('✅ User logged in');
    } catch (error) {
      console.log('⚠️  Using existing test data - please ensure you have run test-inventory.js first');
      console.log('   Or manually set businessId and tenantId in this script');
      throw new Error('Please run inventory test first to create test data');
    }

    // Step 2: Get business and tenant info (from token or hardcode)
    console.log('\n📋 Step 2: Setting Test Data IDs...');
    // You can hardcode these from your previous inventory test run
    businessId = 'YOUR_BUSINESS_ID'; // Replace with actual ID
    tenantId = 'YOUR_TENANT_ID'; // Replace with actual ID

    // OR fetch from businesses endpoint
    try {
      const businessesData = await apiCall('GET', '/businesses');
      if (businessesData.data && businessesData.data.length > 0) {
        businessId = businessesData.data[0].business_id;
        tenantId = businessesData.data[0].tenant_id;
        console.log('✅ Using business:', businessId);
        console.log('   Tenant:', tenantId);
      }
    } catch (error) {
      console.log('⚠️  Could not fetch businesses, using hardcoded IDs');
    }

    // Step 3: Get Dashboard Summary
    console.log('\n📋 Step 3: Fetching Dashboard Summary...');
    const dashboardData = await apiCall(
      'GET',
      `/analytics/dashboard?businessId=${businessId}&tenantId=${tenantId}`
    );
    console.log('✅ Dashboard Summary:');
    console.log('\n  📊 SALES:');
    console.log(`     Today Revenue: ₹${dashboardData.sales.todayRevenue.toLocaleString()}`);
    console.log(`     Week Revenue: ₹${dashboardData.sales.weekRevenue.toLocaleString()}`);
    console.log(`     Month Revenue: ₹${dashboardData.sales.monthRevenue.toLocaleString()}`);
    console.log(`     Total Orders: ${dashboardData.sales.totalOrders}`);
    console.log(`     Pending Orders: ${dashboardData.sales.pendingOrders}`);
    console.log(`     Completed Orders: ${dashboardData.sales.completedOrders}`);

    console.log('\n  📦 INVENTORY:');
    console.log(`     Total Products: ${dashboardData.inventory.totalProducts}`);
    console.log(`     Low Stock: ${dashboardData.inventory.lowStockProducts}`);
    console.log(`     Out of Stock: ${dashboardData.inventory.outOfStockProducts}`);
    console.log(`     Total Value: ₹${dashboardData.inventory.totalInventoryValue.toLocaleString()}`);

    console.log('\n  👥 CUSTOMERS:');
    console.log(`     Total Customers: ${dashboardData.customers.totalCustomers}`);
    console.log(`     New This Month: ${dashboardData.customers.newThisMonth}`);
    console.log(`     Repeat Customers: ${dashboardData.customers.repeatCustomers}`);
    console.log(`     Top Customer Spend: ₹${dashboardData.customers.topCustomerSpend.toLocaleString()}`);

    console.log('\n  🏆 TOP PRODUCTS:');
    dashboardData.topProducts.slice(0, 3).forEach((p, i) => {
      console.log(`     ${i + 1}. ${p.productName}`);
      console.log(`        Sold: ${p.quantitySold} | Revenue: ₹${p.revenue.toLocaleString()}`);
    });

    // Step 4: Get Sales Analytics
    console.log('\n📋 Step 4: Fetching Sales Analytics (Last 30 Days)...');
    const salesData = await apiCall(
      'GET',
      `/analytics/sales?businessId=${businessId}&tenantId=${tenantId}&period=last30days`
    );
    console.log('✅ Sales Analytics:');
    console.log(`   Total Revenue: ₹${salesData.totalRevenue.toLocaleString()}`);
    console.log(`   Total Orders: ${salesData.totalOrders}`);
    console.log(`   Average Order Value: ₹${salesData.averageOrderValue.toLocaleString()}`);
    console.log(`   Total Items Sold: ${salesData.totalItemsSold}`);
    console.log(`   Revenue Growth: ${salesData.revenueGrowth.toFixed(2)}%`);
    console.log(`   Orders Growth: ${salesData.ordersGrowth.toFixed(2)}%`);
    console.log(`   Daily Revenue Data Points: ${salesData.dailyRevenue.length}`);
    console.log('\n   Orders by Status:');
    Object.entries(salesData.ordersByStatus).forEach(([status, count]) => {
      console.log(`     ${status}: ${count}`);
    });

    // Step 5: Get Top Products
    console.log('\n📋 Step 5: Fetching Top Selling Products...');
    const topProductsData = await apiCall(
      'GET',
      `/analytics/sales/top-products?businessId=${businessId}&tenantId=${tenantId}&period=last30days&limit=5`
    );
    console.log(`✅ Found ${topProductsData.length} top products:`);
    topProductsData.forEach((product, index) => {
      console.log(`   ${index + 1}. ${product.productName}`);
      console.log(`      Quantity Sold: ${product.quantitySold}`);
      console.log(`      Revenue: ₹${product.revenue.toLocaleString()}`);
      console.log(`      Orders: ${product.orderCount}`);
    });

    // Step 6: Get Revenue by Period
    console.log('\n📋 Step 6: Fetching Revenue by Day...');
    const revenueByPeriod = await apiCall(
      'GET',
      `/analytics/sales/revenue-by-period?businessId=${businessId}&tenantId=${tenantId}&period=last7days&period=day`
    );
    console.log(`✅ Daily Revenue (Last 7 Days):`);
    revenueByPeriod.slice(0, 7).forEach((day) => {
      console.log(`   ${day.period}: ₹${day.revenue.toLocaleString()} (${day.orders} orders)`);
    });

    // Step 7: Get Inventory Analytics
    console.log('\n📋 Step 7: Fetching Inventory Analytics...');
    const inventoryData = await apiCall(
      'GET',
      `/analytics/inventory?businessId=${businessId}&tenantId=${tenantId}`
    );
    console.log('✅ Inventory Analytics:');
    console.log(`   Total Inventory Value: ₹${inventoryData.totalInventoryValue.toLocaleString()}`);
    console.log(`   Total Stock Units: ${inventoryData.totalStockUnits}`);
    console.log(`   Low Stock Count: ${inventoryData.lowStockCount}`);
    console.log(`   Out of Stock Count: ${inventoryData.outOfStockCount}`);
    console.log(`   Average Turnover Rate: ${inventoryData.averageTurnoverRate.toFixed(2)}x per year`);

    console.log('\n   Top Products by Value:');
    inventoryData.topProductsByValue.slice(0, 3).forEach((p, i) => {
      console.log(`     ${i + 1}. ${p.productName}`);
      console.log(`        Stock Value: ₹${p.stockValue.toLocaleString()} | Quantity: ${p.quantity}`);
    });

    console.log('\n   Warehouse Inventory:');
    inventoryData.warehouseInventory.forEach((wh) => {
      console.log(`     ${wh.warehouseName}:`);
      console.log(`       Total Value: ₹${wh.totalValue.toLocaleString()}`);
      console.log(`       Total Units: ${wh.totalUnits}`);
    });

    // Step 8: Get Low Stock Alerts
    console.log('\n📋 Step 8: Fetching Low Stock Alerts...');
    const lowStockAlerts = await apiCall(
      'GET',
      `/analytics/inventory/low-stock-alerts?businessId=${businessId}&tenantId=${tenantId}`
    );
    console.log(`✅ Found ${lowStockAlerts.length} low stock alert(s)`);
    if (lowStockAlerts.length > 0) {
      lowStockAlerts.slice(0, 5).forEach((alert, index) => {
        console.log(`   ${index + 1}. ${alert.productName} (${alert.variantName})`);
        console.log(`      Warehouse: ${alert.warehouseName}`);
        console.log(`      Current Stock: ${alert.currentStock}`);
        console.log(`      Reorder Point: ${alert.reorderPoint}`);
        console.log(`      Severity: ${alert.severity}`);
      });
    }

    // Step 9: Get Inventory Turnover by Product
    console.log('\n📋 Step 9: Fetching Inventory Turnover by Product...');
    const turnoverData = await apiCall(
      'GET',
      `/analytics/inventory/turnover-by-product?businessId=${businessId}&tenantId=${tenantId}&period=last30days`
    );
    console.log(`✅ Found ${turnoverData.length} product(s) with turnover data`);
    if (turnoverData.length > 0) {
      turnoverData.slice(0, 5).forEach((product, index) => {
        console.log(`   ${index + 1}. ${product.productName}`);
        console.log(`      Total Sold: ${product.totalSold}`);
        console.log(`      Average Stock: ${product.averageStock.toFixed(2)}`);
        console.log(`      Turnover Rate: ${product.turnoverRate.toFixed(2)}x`);
      });
    }

    // Step 10: Get Customer Analytics
    console.log('\n📋 Step 10: Fetching Customer Analytics...');
    const customerData = await apiCall(
      'GET',
      `/analytics/customers?businessId=${businessId}&tenantId=${tenantId}&period=last30days`
    );
    console.log('✅ Customer Analytics:');
    console.log(`   Total Customers: ${customerData.totalCustomers}`);
    console.log(`   New Customers: ${customerData.newCustomers}`);
    console.log(`   Repeat Customers: ${customerData.repeatCustomers}`);
    console.log(`   Retention Rate: ${customerData.retentionRate.toFixed(2)}%`);
    console.log(`   Average Lifetime Value: ₹${customerData.averageLifetimeValue.toLocaleString()}`);

    console.log('\n   Top Customers:');
    customerData.topCustomers.slice(0, 5).forEach((customer, index) => {
      console.log(`     ${index + 1}. ${customer.customerName}`);
      console.log(`        Total Orders: ${customer.totalOrders}`);
      console.log(`        Total Spent: ₹${customer.totalSpent.toLocaleString()}`);
      console.log(`        Last Order: ${new Date(customer.lastOrderDate).toLocaleDateString()}`);
    });

    console.log('\n   RFM Segmentation:');
    console.log(`     Champions: ${customerData.rfmSegmentation.champions}`);
    console.log(`     Loyal Customers: ${customerData.rfmSegmentation.loyalCustomers}`);
    console.log(`     Potential Loyalists: ${customerData.rfmSegmentation.potentialLoyalists}`);
    console.log(`     Recent Customers: ${customerData.rfmSegmentation.recentCustomers}`);
    console.log(`     Promising: ${customerData.rfmSegmentation.promising}`);
    console.log(`     Needs Attention: ${customerData.rfmSegmentation.needsAttention}`);
    console.log(`     At Risk: ${customerData.rfmSegmentation.atRisk}`);
    console.log(`     Can't Lose: ${customerData.rfmSegmentation.cantLose}`);
    console.log(`     Hibernating: ${customerData.rfmSegmentation.hibernating}`);
    console.log(`     Lost: ${customerData.rfmSegmentation.lost}`);

    // Step 11: Get Customer Churn Analysis
    console.log('\n📋 Step 11: Fetching Customer Churn Analysis...');
    const churnData = await apiCall(
      'GET',
      `/analytics/customers/churn-analysis?businessId=${businessId}&tenantId=${tenantId}&inactiveDays=90`
    );
    console.log('✅ Churn Analysis:');
    console.log(`   Churned Customers: ${churnData.churnedCustomersCount}`);
    console.log(`   Total Churn Value: ₹${churnData.totalChurnValue.toLocaleString()}`);
    console.log(`   Avg Value per Churned Customer: ₹${churnData.averageValuePerChurnedCustomer.toLocaleString()}`);
    if (churnData.churnedCustomers.length > 0) {
      console.log('\n   Recently Churned (Top 3):');
      churnData.churnedCustomers.slice(0, 3).forEach((customer, index) => {
        console.log(`     ${index + 1}. ${customer.customerName}`);
        console.log(`        Days Since Last Order: ${customer.daysSinceLastOrder}`);
        console.log(`        Total Spent: ₹${customer.totalSpent.toLocaleString()}`);
      });
    }

    // Step 12: Get Business KPIs
    console.log('\n📋 Step 12: Fetching Business KPIs...');
    const kpisData = await apiCall(
      'GET',
      `/analytics/kpis?businessId=${businessId}&tenantId=${tenantId}&period=last30days`
    );
    console.log('✅ Business KPIs:');
    console.log(`   Average Order Value: ₹${kpisData.averageOrderValue.toLocaleString()}`);
    console.log(`   Order Fulfillment Rate: ${kpisData.orderFulfillmentRate.toFixed(2)}%`);
    console.log(`   Average Processing Time: ${kpisData.averageProcessingTime.toFixed(2)} hours`);
    console.log(`   Return Rate: ${kpisData.returnRate.toFixed(2)}%`);
    console.log(`   Revenue Per Customer: ₹${kpisData.revenuePerCustomer.toLocaleString()}`);
    console.log(`   Inventory Turnover Ratio: ${kpisData.inventoryTurnoverRatio.toFixed(2)}x`);
    console.log(`   Conversion Rate: ${kpisData.conversionRate.toFixed(2)}% (requires session tracking)`);
    console.log(`   Customer Acquisition Cost: ₹${kpisData.customerAcquisitionCost.toFixed(2)} (requires marketing data)`);
    console.log(`   Gross Profit Margin: ${kpisData.grossProfitMargin.toFixed(2)}% (requires cost data)`);

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL ANALYTICS TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📋 Endpoints Tested:');
    console.log('   ✅ GET /analytics/dashboard - Dashboard Summary');
    console.log('   ✅ GET /analytics/sales - Sales Analytics');
    console.log('   ✅ GET /analytics/sales/top-products - Top Products');
    console.log('   ✅ GET /analytics/sales/revenue-by-period - Revenue by Period');
    console.log('   ✅ GET /analytics/inventory - Inventory Analytics');
    console.log('   ✅ GET /analytics/inventory/low-stock-alerts - Low Stock Alerts');
    console.log('   ✅ GET /analytics/inventory/turnover-by-product - Turnover by Product');
    console.log('   ✅ GET /analytics/customers - Customer Analytics');
    console.log('   ✅ GET /analytics/customers/churn-analysis - Churn Analysis');
    console.log('   ✅ GET /analytics/kpis - Business KPIs');
    console.log('\n📊 Analytics Module Features:');
    console.log('   ✅ Sales Performance Tracking');
    console.log('   ✅ Revenue Trends & Growth Analysis');
    console.log('   ✅ Product Performance Insights');
    console.log('   ✅ Inventory Health Monitoring');
    console.log('   ✅ Stock Turnover Analysis');
    console.log('   ✅ Customer Segmentation (RFM)');
    console.log('   ✅ Customer Retention & Churn');
    console.log('   ✅ Business KPIs Dashboard');
    console.log('\n🎉 Analytics & Reporting Module is fully functional!\n');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('⏳ Make sure:');
console.log('   1. Server is running on port 8000');
console.log('   2. You have run test-inventory.js to create test data');
console.log('   3. Update businessId and tenantId in this script\n');

setTimeout(() => {
  runTest().catch(console.error);
}, 2000);
