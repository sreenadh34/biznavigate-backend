/**
 * Notification System Test Script
 * Tests complete order + payment flow with notifications
 * Sends to: muhsirkhan123@gmail.com and 9605969842
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3006';

// Configuration
const TEST_CONFIG = {
  email: 'muhsirkhan123@gmail.com',
  phone: '9605969842',
  name: 'Muhsir Khan',
};

let authToken = '';
let tenantId = '';
let businessId = '';
let customerId = '';
let productId = '';
let variantId = '';
let orderId = '';
let paymentId = '';

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
  console.log('\n🚀 Starting Notification System Test\n');
  console.log('=' .repeat(60));

  try {
    // Step 1: Create Tenant
    console.log('\n📋 Step 1: Creating Tenant...');
    const tenantData = await apiCall('POST', '/tenants', {
      tenant_name: 'Test Tenant for Notifications',
      email: 'test@biznavigate.com',
      phone_number: '1234567890',
    }, false);
    tenantId = tenantData.data.tenant_id;
    console.log('✅ Tenant created:', tenantId);

    // Step 2: Create Business
    console.log('\n📋 Step 2: Creating Business...');
    const businessData = await apiCall('POST', '/businesses', {
      tenant_id: tenantId,
      business_name: 'Test Business',
      business_type: 'ecommerce',
    }, false);
    businessId = businessData.data.business_id;
    console.log('✅ Business created:', businessId);

    // Step 3: Register User & Login
    console.log('\n📋 Step 3: Registering User...');
    await apiCall('POST', '/auth/signup', {
      email: 'testuser@biznavigate.com',
      password: 'Test@123',
      name: 'Test User',
      business_id: businessId,
    }, false);

    const loginData = await apiCall('POST', '/auth/login', {
      email: 'testuser@biznavigate.com',
      password: 'Test@123',
    }, false);
    authToken = loginData.data.accessToken;
    console.log('✅ User logged in');

    // Step 4: Create Product
    console.log('\n📋 Step 4: Creating Product...');
    const productData = await apiCall('POST', '/products', {
      business_id: businessId,
      tenant_id: tenantId,
      name: 'Test Product - iPhone 15',
      description: 'Latest iPhone with amazing features',
      category: 'Electronics',
      base_price: 79900,
      currency: 'INR',
      product_type: 'physical',
      is_active: true,
      variants: [
        {
          sku: 'IPH15-128-BLK',
          variant_name: '128GB Black',
          price: 79900,
          stock_quantity: 100,
          attributes: { color: 'Black', storage: '128GB' },
        },
      ],
    });
    productId = productData.data.product_id;
    variantId = productData.data.variants[0].variant_id;
    console.log('✅ Product created:', productId);

    // Step 5: Create Customer (with your details)
    console.log('\n📋 Step 5: Creating Customer...');
    console.log(`   Email: ${TEST_CONFIG.email}`);
    console.log(`   Phone: ${TEST_CONFIG.phone}`);
    const customerData = await apiCall('POST', '/customers', {
      business_id: businessId,
      tenant_id: tenantId,
      name: TEST_CONFIG.name,
      phone: TEST_CONFIG.phone,
      email: TEST_CONFIG.email,
    });
    customerId = customerData.data.customer_id;
    console.log('✅ Customer created:', customerId);

    // Step 6: Create Order
    console.log('\n📋 Step 6: Creating Order...');
    const orderData = await apiCall('POST', '/orders', {
      business_id: businessId,
      tenant_id: tenantId,
      customer_id: customerId,
      order_type: 'product',
      items: [
        {
          variant_id: variantId,
          quantity: 2,
          price: 79900,
        },
      ],
      shipping_address: {
        street: 'Test Street',
        city: 'Mumbai',
        state: 'Maharashtra',
        postal_code: '400001',
        country: 'India',
      },
    });
    orderId = orderData.data.order_id;
    console.log('✅ Order created:', orderId);
    console.log('   Order Number:', orderData.data.order_number);
    console.log('   Total Amount: ₹', orderData.data.total_amount);

    // Step 7: Send Order Confirmation Notification (Email)
    console.log('\n📧 Step 7: Sending Order Confirmation EMAIL...');
    const emailNotif = await apiCall('POST', '/notifications/send', {
      business_id: businessId,
      tenant_id: tenantId,
      customer_id: customerId,
      recipient_email: TEST_CONFIG.email,
      recipient_name: TEST_CONFIG.name,
      template_key: 'order_confirmation',
      channel: 'email',
      context_data: {
        customer_name: TEST_CONFIG.name,
        order_number: orderData.data.order_number,
        total_amount: orderData.data.total_amount,
        item_count: 2,
        order_date: new Date().toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
      },
      related_entity_type: 'order',
      related_entity_id: orderId,
      priority: 1, // Send immediately
    });
    console.log('✅ Email notification sent!');
    console.log('   Notification ID:', emailNotif.data.notification_id);
    console.log('   📨 Check your email: muhsirkhan123@gmail.com');

    // Step 8: Send Order Confirmation SMS
    console.log('\n📱 Step 8: Sending Order Confirmation SMS...');
    const smsNotif = await apiCall('POST', '/notifications/send', {
      business_id: businessId,
      tenant_id: tenantId,
      customer_id: customerId,
      recipient_phone: TEST_CONFIG.phone,
      recipient_name: TEST_CONFIG.name,
      template_key: 'order_confirmation',
      channel: 'sms',
      context_data: {
        customer_name: TEST_CONFIG.name,
        order_number: orderData.data.order_number,
        total_amount: orderData.data.total_amount,
        item_count: 2,
        order_date: new Date().toLocaleDateString('en-IN'),
      },
      related_entity_type: 'order',
      related_entity_id: orderId,
      priority: 1,
    });
    console.log('✅ SMS notification sent!');
    console.log('   Notification ID:', smsNotif.data.notification_id);
    console.log('   📲 Check your phone: 9605969842');

    // Step 9: Send Order Confirmation WhatsApp
    console.log('\n💬 Step 9: Sending Order Confirmation WhatsApp...');
    const whatsappNotif = await apiCall('POST', '/notifications/send', {
      business_id: businessId,
      tenant_id: tenantId,
      customer_id: customerId,
      recipient_phone: TEST_CONFIG.phone,
      recipient_name: TEST_CONFIG.name,
      template_key: 'order_confirmation',
      channel: 'whatsapp',
      context_data: {
        customer_name: TEST_CONFIG.name,
        order_number: orderData.data.order_number,
        total_amount: orderData.data.total_amount,
        item_count: 2,
        order_date: new Date().toLocaleDateString('en-IN'),
      },
      related_entity_type: 'order',
      related_entity_id: orderId,
      priority: 1,
    });
    console.log('✅ WhatsApp notification sent!');
    console.log('   Notification ID:', whatsappNotif.data.notification_id);
    console.log('   💬 Check WhatsApp: 9605969842');

    // Step 10: Create Payment
    console.log('\n📋 Step 10: Creating Payment...');
    const paymentData = await apiCall('POST', '/payments', {
      business_id: businessId,
      tenant_id: tenantId,
      order_id: orderId,
      customer_id: customerId,
      amount: orderData.data.total_amount,
      currency: 'INR',
      receipt: `receipt_${orderId}`,
    });
    paymentId = paymentData.data.payment_id;
    console.log('✅ Payment created:', paymentId);
    console.log('   Razorpay Order ID:', paymentData.data.razorpay_order_id);

    // Simulate payment verification (normally done after Razorpay checkout)
    console.log('\n📋 Step 11: Simulating Payment Success...');
    console.log('   (In production, this happens after Razorpay checkout)');

    // Step 12: Send Payment Receipt Multi-Channel
    console.log('\n💰 Step 12: Sending Payment Receipt (Multi-Channel)...');
    const paymentNotif = await apiCall('POST', '/notifications/send/multi-channel', {
      business_id: businessId,
      tenant_id: tenantId,
      customer_id: customerId,
      recipient_email: TEST_CONFIG.email,
      recipient_phone: TEST_CONFIG.phone,
      recipient_name: TEST_CONFIG.name,
      template_key: 'payment_receipt',
      channels: ['email', 'sms', 'whatsapp'],
      context_data: {
        customer_name: TEST_CONFIG.name,
        order_number: orderData.data.order_number,
        amount: orderData.data.total_amount,
        payment_id: paymentData.data.razorpay_order_id,
        payment_method: 'UPI',
        payment_date: new Date().toLocaleDateString('en-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }),
      },
      related_entity_type: 'payment',
      related_entity_id: paymentId,
      priority: 1,
    });
    console.log('✅ Multi-channel payment receipt sent!');
    console.log('   📧 Email sent to: muhsirkhan123@gmail.com');
    console.log('   📱 SMS sent to: 9605969842');
    console.log('   💬 WhatsApp sent to: 9605969842');

    // Step 13: Check notification status
    console.log('\n📊 Step 13: Checking Notification Status...');
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds

    const emailStatus = await apiCall('GET', `/notifications/${emailNotif.data.notification_id}`);
    console.log(`   Email Status: ${emailStatus.data.status}`);

    const smsStatus = await apiCall('GET', `/notifications/${smsNotif.data.notification_id}`);
    console.log(`   SMS Status: ${smsStatus.data.status}`);

    // Final Summary
    console.log('\n' + '='.repeat(60));
    console.log('✅ TEST COMPLETED SUCCESSFULLY!');
    console.log('='.repeat(60));
    console.log('\n📋 Summary:');
    console.log(`   Tenant ID: ${tenantId}`);
    console.log(`   Business ID: ${businessId}`);
    console.log(`   Customer ID: ${customerId}`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Payment ID: ${paymentId}`);
    console.log(`\n📬 Notifications Sent:`);
    console.log(`   ✉️  Email: ${TEST_CONFIG.email}`);
    console.log(`   📱 SMS: ${TEST_CONFIG.phone}`);
    console.log(`   💬 WhatsApp: ${TEST_CONFIG.phone}`);
    console.log('\n🎉 Check your email and phone for notifications!\n');

  } catch (error) {
    console.error('\n❌ Test Failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runTest();
