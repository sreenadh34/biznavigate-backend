import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding payment data...');

  // Use existing business ID from the user
  const businessId = 'dd8ae5a1-cab4-4041-849d-e108d74490d3';

  // Find or create a customer
  let customer = await prisma.customers.findFirst({
    where: { business_id: businessId },
  });

  if (!customer) {
    console.log('Creating test customer...');
    customer = await prisma.customers.create({
      data: {
        business_id: businessId,
        tenant_id: (await prisma.businesses.findUnique({ where: { business_id: businessId } }))!.tenant_id,
        name: 'Test Customer',
        phone: '+919876543210',
        email: 'test@customer.com',
        whatsapp_number: '+919876543210',
        total_orders: 0,
        total_spent: 0,
        engagement_score: 10,
      },
    });
    console.log(`✅ Created customer: ${customer.customer_id}`);
  } else {
    console.log(`✅ Using existing customer: ${customer.customer_id}`);
  }

  // Find or create orders
  const orders = await prisma.orders.findMany({
    where: { business_id: businessId },
    take: 3,
  });

  let orderIds: string[] = [];

  if (orders.length === 0) {
    console.log('Creating test orders...');
    for (let i = 0; i < 10; i++) {
      const order = await prisma.orders.create({
        data: {
          business_id: businessId,
          tenant_id: customer.tenant_id,
          customer_id: customer.customer_id,
          order_type: 'product',
          order_number: `ORD-${Date.now()}-${i}`,
          status: i < 5 ? 'completed' : 'pending',
          payment_status: i < 5 ? 'paid' : 'pending',
          subtotal: 1000 + (i * 500),
          tax_amount: (1000 + (i * 500)) * 0.18,
          shipping_fee: 100,
          total_amount: (1000 + (i * 500)) * 1.18 + 100,
          source: 'web',
          shipping_address: '123 Test Street',
          shipping_city: 'Mumbai',
          shipping_state: 'Maharashtra',
          shipping_pincode: '400001',
          shipping_phone: customer.phone,
        },
      });
      orderIds.push(order.order_id);
    }
    console.log(`✅ Created ${orderIds.length} orders`);
  } else {
    orderIds = orders.map((o) => o.order_id);
    console.log(`✅ Using ${orderIds.length} existing orders`);
  }

  // Payment data with various statuses
  const paymentData = [
    {
      order_id: orderIds[0],
      amount: 1280,
      status: 'captured',
      method: 'upi',
      razorpay_payment_id: `pay_${Date.now()}001`,
      captured_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
    },
    {
      order_id: orderIds[1],
      amount: 1780,
      status: 'captured',
      method: 'card',
      razorpay_payment_id: `pay_${Date.now()}002`,
      captured_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
    },
    {
      order_id: orderIds[2],
      amount: 2280,
      status: 'captured',
      method: 'netbanking',
      razorpay_payment_id: `pay_${Date.now()}003`,
      captured_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    },
    {
      order_id: orderIds[3],
      amount: 2780,
      status: 'refunded',
      method: 'upi',
      razorpay_payment_id: `pay_${Date.now()}004`,
      captured_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      refund_amount: 2780,
      refunded_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      refund_reason: 'Customer requested refund',
    },
    {
      order_id: orderIds[4],
      amount: 3280,
      status: 'partial_refund',
      method: 'card',
      razorpay_payment_id: `pay_${Date.now()}005`,
      captured_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      refund_amount: 1000,
      refunded_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      refund_reason: 'Partial refund for damaged item',
    },
    {
      order_id: orderIds[5] || orderIds[0],
      amount: 3780,
      status: 'failed',
      method: null,
      razorpay_payment_id: null,
      failed_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      failure_reason: 'Payment declined by bank',
    },
    {
      order_id: orderIds[6] || orderIds[1],
      amount: 5000,
      status: 'captured',
      method: 'wallet',
      razorpay_payment_id: `pay_${Date.now()}007`,
      captured_at: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
    },
    {
      order_id: orderIds[7] || orderIds[2],
      amount: 8500,
      status: 'captured',
      method: 'upi',
      razorpay_payment_id: `pay_${Date.now()}008`,
      captured_at: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    },
    {
      order_id: orderIds[8] || orderIds[3],
      amount: 12000,
      status: 'authorized',
      method: 'card',
      razorpay_payment_id: `pay_${Date.now()}009`,
      authorized_at: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    },
    {
      order_id: orderIds[9] || orderIds[4],
      amount: 1500,
      status: 'created',
      method: null,
      razorpay_payment_id: null,
    },
  ];

  console.log('Creating payment records...');

  for (const payment of paymentData) {
    try {
      await prisma.payments.create({
        data: {
          business_id: businessId,
          tenant_id: customer.tenant_id,
          customer_id: customer.customer_id,
          order_id: payment.order_id,
          razorpay_order_id: `order_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          razorpay_payment_id: payment.razorpay_payment_id,
          amount: payment.amount,
          currency: 'INR',
          status: payment.status,
          method: payment.method,
          refund_amount: payment.refund_amount || 0,
          refunded_at: payment.refunded_at,
          refund_reason: payment.refund_reason,
          authorized_at: payment.authorized_at,
          captured_at: payment.captured_at,
          failed_at: payment.failed_at,
          failure_reason: payment.failure_reason,
          receipt: `receipt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          notes: {
            source: 'seed',
            description: `Test payment - ${payment.status}`,
          },
        },
      });

      console.log(`✅ Created payment: ${payment.status} - ₹${payment.amount}`);
    } catch (error) {
      console.error(`❌ Failed to create payment: ${error.message}`);
    }
  }

  console.log('✅ Payment seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
