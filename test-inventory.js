/**
 * Inventory System Test Script
 * Tests complete inventory flow: warehouses, stock operations, transfers, alerts
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3006';

// Test data IDs (will be populated during test)
let authToken = '';
let tenantId = '';
let businessId = '';
let warehouse1Id = '';
let warehouse2Id = '';
let productId = '';
let variantId = '';

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

// Test Steps
async function runTest() {
  console.log('\n🚀 Starting Inventory System Test\n');
  console.log('='.repeat(60));

  try {
    // Step 1: Create Tenant
    console.log('\n📋 Step 1: Creating Tenant...');
    const timestamp = Date.now();
    const tenantData = await apiCall('POST', '/tenants', {
      tenant_name: 'Inventory Test Tenant',
      email: `inventory-test-${timestamp}@biznavigate.com`,
      phone_number: '9999999999',
    }, false);
    tenantId = tenantData.data.tenant_id;
    console.log('✅ Tenant created:', tenantId);

    // Step 2: Create Business
    console.log('\n📋 Step 2: Creating Business...');
    const businessData = await apiCall('POST', '/businesses', {
      tenant_id: tenantId,
      business_name: 'Inventory Test Business',
      business_type: 'Retail',
    }, false);
    businessId = businessData.data.business_id;
    console.log('✅ Business created:', businessId);

    // Step 3: Register User & Login
    console.log('\n📋 Step 3: Registering User & Logging In...');
    const userEmail = `inventory-test-user-${timestamp}@biznavigate.com`;
    await apiCall('POST', '/auth/signup', {
      tenant_name: 'Inventory Test Tenant',
      email: userEmail,
      password: 'Test@123',
      name: 'Inventory Test User',
      phone_number: '9876543210',
    }, false);

    const loginData = await apiCall('POST', '/auth/login', {
      email: userEmail,
      password: 'Test@123',
    }, false);
    authToken = loginData.data.accessToken;
    console.log('✅ User logged in');

    // Step 4: Create Product
    console.log('\n📋 Step 4: Creating Product...');
    const productData = await apiCall('POST', '/products', {
      business_id: businessId,
      tenant_id: tenantId,
      name: 'Test Product - Laptop',
      description: 'Dell Laptop for inventory testing',
      category: 'Electronics',
      base_price: 50000,
      currency: 'INR',
      product_type: 'physical',
      is_active: true,
      variants: [
        {
          sku: 'LAPTOP-001',
          variant_name: 'Dell Inspiron 15',
          price: 50000,
          stock_quantity: 0, // Will be managed by inventory system
          attributes: { brand: 'Dell', model: 'Inspiron 15' },
        },
      ],
    });
    productId = productData.data.product_id;
    variantId = productData.data.variants[0].variant_id;
    console.log('✅ Product created:', productId);
    console.log('   Variant ID:', variantId);

    // Step 5: Create Warehouse 1 (Main Warehouse)
    console.log('\n📋 Step 5: Creating Main Warehouse...');
    const warehouse1Data = await apiCall('POST', '/warehouses', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseName: 'Main Warehouse',
      warehouseCode: 'WH-001',
      warehouseType: 'warehouse',
      address: {
        line1: '123 Main Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postalCode: '400001',
        country: 'India',
      },
      contact: {
        person: 'John Doe',
        email: 'warehouse1@test.com',
        phone: '9876543210',
      },
      totalCapacity: 10000,
      isDefault: true,
      isActive: true,
      priority: 1,
    });
    warehouse1Id = warehouse1Data.data.warehouse_id;
    console.log('✅ Main Warehouse created:', warehouse1Id);
    console.log('   Name:', warehouse1Data.data.warehouse_name);
    console.log('   Code:', warehouse1Data.data.warehouse_code);

    // Step 6: Create Warehouse 2 (Secondary Warehouse)
    console.log('\n📋 Step 6: Creating Secondary Warehouse...');
    const warehouse2Data = await apiCall('POST', '/warehouses', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseName: 'Secondary Warehouse',
      warehouseCode: 'WH-002',
      warehouseType: 'warehouse',
      address: {
        line1: '456 Side Street',
        city: 'Pune',
        state: 'Maharashtra',
        postalCode: '411001',
        country: 'India',
      },
      contact: {
        person: 'Jane Smith',
        email: 'warehouse2@test.com',
        phone: '9876543211',
      },
      totalCapacity: 5000,
      isDefault: false,
      isActive: true,
      priority: 2,
    });
    warehouse2Id = warehouse2Data.data.warehouse_id;
    console.log('✅ Secondary Warehouse created:', warehouse2Id);

    // Step 7: Get All Warehouses
    console.log('\n📋 Step 7: Fetching All Warehouses...');
    const warehousesData = await apiCall('GET', `/warehouses?businessId=${businessId}`);
    console.log(`✅ Found ${warehousesData.count} warehouses`);
    warehousesData.data.forEach(wh => {
      console.log(`   - ${wh.warehouse_name} (${wh.warehouse_code}) - ${wh.is_default ? 'DEFAULT' : 'Secondary'}`);
    });

    // Step 8: Add Initial Stock to Warehouse 1 (Purchase)
    console.log('\n📋 Step 8: Adding Initial Stock (Purchase)...');
    const addStockData = await apiCall('POST', '/inventory/stock/add', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseId: warehouse1Id,
      variantId: variantId,
      quantity: 100,
      unitCost: 45000,
      referenceType: 'purchase_order',
      referenceId: 'PO-001',
      notes: 'Initial stock purchase',
    });
    console.log('✅ Stock added successfully');
    console.log('   Available Quantity:', addStockData.data.inventoryLevel.available_quantity);
    console.log('   Average Cost:', addStockData.data.inventoryLevel.average_cost);
    console.log('   Total Value:', addStockData.data.inventoryLevel.total_value);

    // Step 9: Get Inventory Levels
    console.log('\n📋 Step 9: Fetching Inventory Levels...');
    const inventoryLevels = await apiCall('GET', `/inventory/levels?businessId=${businessId}`);
    console.log(`✅ Found ${inventoryLevels.count} inventory level(s)`);
    inventoryLevels.data.forEach(level => {
      console.log(`   - Warehouse: ${level.warehouse_id}`);
      console.log(`     Available: ${level.available_quantity}`);
      console.log(`     Reserved: ${level.reserved_quantity}`);
      console.log(`     Total Value: ₹${level.total_value}`);
    });

    // Step 10: Reserve Stock (Order Placed)
    console.log('\n📋 Step 10: Reserving Stock for Order...');
    const reserveData = await apiCall('POST', '/inventory/stock/reserve', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseId: warehouse1Id,
      variantId: variantId,
      quantity: 5,
      orderId: 'ORDER-001',
    });
    console.log('✅ Stock reserved successfully');
    console.log('   Available:', reserveData.data.inventoryLevel.available_quantity);
    console.log('   Reserved:', reserveData.data.inventoryLevel.reserved_quantity);

    // Step 11: Confirm Sale
    console.log('\n📋 Step 11: Confirming Sale...');
    const confirmSaleData = await apiCall('POST', '/inventory/stock/confirm-sale', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseId: warehouse1Id,
      variantId: variantId,
      quantity: 5,
      orderId: 'ORDER-001',
    });
    console.log('✅ Sale confirmed successfully');
    console.log('   Available:', confirmSaleData.data.inventoryLevel.available_quantity);
    console.log('   Reserved:', confirmSaleData.data.inventoryLevel.reserved_quantity);

    // Step 12: Add More Stock to Warehouse 2
    console.log('\n📋 Step 12: Adding Stock to Secondary Warehouse...');
    await apiCall('POST', '/inventory/stock/add', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseId: warehouse2Id,
      variantId: variantId,
      quantity: 50,
      unitCost: 46000,
      referenceType: 'purchase_order',
      referenceId: 'PO-002',
    });
    console.log('✅ Stock added to secondary warehouse');

    // Step 13: Transfer Stock Between Warehouses
    console.log('\n📋 Step 13: Transferring Stock Between Warehouses...');
    const transferData = await apiCall('POST', '/inventory/stock/transfer', {
      businessId: businessId,
      tenantId: tenantId,
      fromWarehouseId: warehouse1Id,
      toWarehouseId: warehouse2Id,
      variantId: variantId,
      quantity: 20,
      notes: 'Rebalancing inventory',
    });
    console.log('✅ Transfer completed successfully');
    console.log('   From Warehouse - Available:', transferData.data.fromInventoryLevel.available_quantity);
    console.log('   To Warehouse - Available:', transferData.data.toInventoryLevel.available_quantity);

    // Step 14: Adjust Stock (Physical Count)
    console.log('\n📋 Step 14: Adjusting Stock (Physical Count)...');
    const adjustData = await apiCall('POST', '/inventory/stock/adjust', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseId: warehouse1Id,
      variantId: variantId,
      quantityChange: -3, // Found 3 damaged items
      reason: 'physical_count',
      notes: 'Found 3 damaged units during physical inventory',
    });
    console.log('✅ Stock adjusted successfully');
    console.log('   New Available Quantity:', adjustData.data.inventoryLevel.available_quantity);

    // Step 15: Update Reorder Settings
    console.log('\n📋 Step 15: Updating Reorder Settings...');
    const reorderData = await apiCall('PUT', '/inventory/reorder-settings', {
      businessId: businessId,
      warehouseId: warehouse1Id,
      variantId: variantId,
      reorderPoint: 20,
      reorderQuantity: 50,
      maxStockLevel: 200,
    });
    console.log('✅ Reorder settings updated');
    console.log('   Reorder Point:', reorderData.data.reorder_point);
    console.log('   Reorder Quantity:', reorderData.data.reorder_quantity);

    // Step 16: Deduct Stock to Trigger Low Stock Alert
    console.log('\n📋 Step 16: Deducting Stock to Trigger Alert...');
    await apiCall('POST', '/inventory/stock/deduct', {
      businessId: businessId,
      tenantId: tenantId,
      warehouseId: warehouse1Id,
      variantId: variantId,
      quantity: 60, // This should bring it below reorder point
      referenceType: 'bulk_sale',
      referenceId: 'SALE-001',
      notes: 'Large bulk order',
    });
    console.log('✅ Stock deducted (should trigger low stock alert)');

    // Step 17: Check Low Stock Alerts
    console.log('\n📋 Step 17: Checking Low Stock Alerts...');
    const alertsData = await apiCall('GET', `/inventory/alerts/low-stock?businessId=${businessId}`);
    console.log(`✅ Found ${alertsData.count} active alert(s)`);
    if (alertsData.count > 0) {
      alertsData.data.forEach(alert => {
        console.log(`   - Alert Type: ${alert.alert_type}`);
        console.log(`     Severity: ${alert.severity}`);
        console.log(`     Current Quantity: ${alert.current_quantity}`);
        console.log(`     Reorder Point: ${alert.reorder_point}`);
        console.log(`     Recommended Order: ${alert.recommended_order_quantity}`);
      });
    }

    // Step 18: Get Stock Movements (Audit Trail)
    console.log('\n📋 Step 18: Fetching Stock Movements (Audit Trail)...');
    const movementsData = await apiCall('GET',
      `/inventory/movements?businessId=${businessId}&warehouseId=${warehouse1Id}&limit=10`
    );
    console.log(`✅ Found ${movementsData.count} stock movement(s)`);
    movementsData.data.forEach((movement, index) => {
      console.log(`   ${index + 1}. ${movement.movement_type} - ${movement.quantity_change > 0 ? '+' : ''}${movement.quantity_change} units`);
      console.log(`      Before: ${movement.quantity_before} → After: ${movement.quantity_after}`);
      console.log(`      Date: ${new Date(movement.movement_date).toLocaleString()}`);
    });

    // Step 19: Get Inventory Summary
    console.log('\n📋 Step 19: Fetching Inventory Summary...');
    const summaryData = await apiCall('GET', `/inventory/summary?businessId=${businessId}`);
    console.log('✅ Inventory Summary:');
    console.log(`   Total Products: ${summaryData.data.totalProducts}`);
    console.log(`   Total Stock Value: ₹${summaryData.data.totalStockValue.toLocaleString()}`);
    console.log(`   Low Stock Count: ${summaryData.data.lowStockCount}`);
    console.log(`   Out of Stock Count: ${summaryData.data.outOfStockCount}`);
    console.log(`   Total Available Units: ${summaryData.data.totalAvailableUnits}`);
    console.log(`   Total Reserved Units: ${summaryData.data.totalReservedUnits}`);
    console.log(`   Health Score: ${summaryData.data.healthScore}%`);

    // Step 20: Get Final Inventory Levels for Both Warehouses
    console.log('\n📋 Step 20: Final Inventory State...');
    const finalInventory = await apiCall('GET', `/inventory/levels?businessId=${businessId}`);
    console.log('✅ Final Inventory Levels:');
    finalInventory.data.forEach(level => {
      console.log(`   Warehouse: ${level.warehouse_id === warehouse1Id ? 'Main' : 'Secondary'}`);
      console.log(`     Available: ${level.available_quantity}`);
      console.log(`     Reserved: ${level.reserved_quantity}`);
      console.log(`     Damaged: ${level.damaged_quantity}`);
      console.log(`     In Transit: ${level.in_transit_quantity}`);
      console.log(`     Total Value: ₹${level.total_value.toLocaleString()}`);
      console.log(`     Low Stock: ${level.is_low_stock}`);
      console.log(`     Out of Stock: ${level.is_out_of_stock}`);
    });

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ ALL TESTS COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📋 Test Summary:');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Business ID: ${businessId}`);
    console.log(`   Product ID: ${productId}`);
    console.log(`   Variant ID: ${variantId}`);
    console.log(`   Warehouse 1 (Main): ${warehouse1Id}`);
    console.log(`   Warehouse 2 (Secondary): ${warehouse2Id}`);
    console.log('\n🎯 Operations Tested:');
    console.log('   ✅ Warehouse Creation (2 warehouses)');
    console.log('   ✅ Add Stock (Purchase)');
    console.log('   ✅ Reserve Stock (Order)');
    console.log('   ✅ Confirm Sale');
    console.log('   ✅ Transfer Stock (Inter-warehouse)');
    console.log('   ✅ Adjust Stock (Physical Count)');
    console.log('   ✅ Deduct Stock (Sale)');
    console.log('   ✅ Reorder Settings');
    console.log('   ✅ Low Stock Alerts');
    console.log('   ✅ Stock Movements (Audit Trail)');
    console.log('   ✅ Inventory Summary');
    console.log('\n🎉 All inventory data saved successfully in database!\n');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

// Run the test
console.log('⏳ Waiting for server to be ready...');
setTimeout(() => {
  runTest().catch(console.error);
}, 2000);
