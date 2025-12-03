import { PrismaClient } from '../generated/prisma'
import * as bcrypt from 'bcrypt'

const prisma = new PrismaClient()

async function main() {
  console.log('Starting database seed...')

  // Clear existing data (optional - comment out if you want to keep existing data)
  console.log('Clearing existing data...')

  // Delete in order of dependencies (child tables first)
  await prisma.order_items.deleteMany({})
  await prisma.orders.deleteMany({})
  await prisma.product_variants.deleteMany({})
  await prisma.products.deleteMany({})
  await prisma.customers.deleteMany({})

  // Delete lead-related tables before leads (in correct dependency order)
  await prisma.lead_messages.deleteMany({})
  await prisma.lead_activities.deleteMany({})
  await prisma.lead_conversations.deleteMany({})
  await prisma.leads.deleteMany({})

  await prisma.users.deleteMany({})
  await prisma.roles.deleteMany({})
  await prisma.businesses.deleteMany({})
  await prisma.tenants.deleteMany({})

  // 1. Create Tenant
  console.log('Creating tenant...')
  const tenant = await prisma.tenants.create({
    data: {
      tenant_name: 'Demo Company',
      email: 'demo@biznavigate.com',
      phone_number: '+919876543210',
      address: '123 Demo Street, Mumbai',
      gst_number: 'GST123456789',
    },
  })
  console.log(`Tenant created: ${tenant.tenant_id}`)

  // 2. Create Business
  console.log('Creating business...')
  const business = await prisma.businesses.create({
    data: {
      tenant_id: tenant.tenant_id,
      business_name: 'Demo Store',
      business_type: 'retail',
      whatsapp_number: '+919876543210',
      brand_colors: {
        primary: '#f97316',
        secondary: '#1e293b',
      },
      working_hours: {
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '10:00', close: '16:00', closed: false },
        sunday: { open: '00:00', close: '00:00', closed: true },
      },
    },
  })
  console.log(`Business created: ${business.business_id}`)

  // 3. Create Roles
  console.log('Creating roles...')
  const adminRole = await prisma.roles.create({
    data: {
      role_name: 'Administrator',
      permissions: {
        view: true,
        create: true,
        edit: true,
        delete: true,
      },
    },
  })

  const managerRole = await prisma.roles.create({
    data: {
      role_name: 'Manager',
      permissions: {
        view: true,
        create: true,
        edit: true,
        delete: false,
      },
    },
  })

  const viewerRole = await prisma.roles.create({
    data: {
      role_name: 'Viewer',
      permissions: {
        view: true,
        create: false,
        edit: false,
        delete: false,
      },
    },
  })
  console.log(`Roles created: ${adminRole.role_id}, ${managerRole.role_id}, ${viewerRole.role_id}`)

  // 4. Create Users
  console.log('Creating users...')

  // Hash password: "Password123!"
  const hashedPassword = await bcrypt.hash('Password123!', 10)

  const adminUser = await prisma.users.create({
    data: {
      business_id: business.business_id,
      role_id: adminRole.role_id,
      email: 'admin@demo.com',
      name: 'Admin User',
      phone_number: '+919876543210',
      password: hashedPassword,
      is_active: true,
      profile_completed: true,
    },
  })
  console.log(`Admin user created: ${adminUser.user_id}`)

  // 5. Create Customers with varying profiles
  console.log('Creating customers...')

  const customers = [
    // VIP Customer - High spending
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Rajesh Kumar',
      phone: '+919876543201',
      email: 'rajesh.kumar@example.com',
      whatsapp_number: '+919876543201',
      total_orders: 25,
      total_spent: 125000,
      last_order_date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      engagement_score: 95,
    },
    // VIP Customer - Frequent orders
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Priya Sharma',
      phone: '+919876543202',
      email: 'priya.sharma@example.com',
      whatsapp_number: '+919876543202',
      total_orders: 18,
      total_spent: 75000,
      last_order_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      engagement_score: 88,
    },
    // Regular Customer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Amit Patel',
      phone: '+919876543203',
      email: 'amit.patel@example.com',
      total_orders: 8,
      total_spent: 35000,
      last_order_date: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000), // 15 days ago
      engagement_score: 72,
    },
    // Regular Customer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Sneha Reddy',
      phone: '+919876543204',
      email: 'sneha.reddy@example.com',
      whatsapp_number: '+919876543204',
      total_orders: 6,
      total_spent: 28000,
      last_order_date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago
      engagement_score: 65,
    },
    // New Customer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Vikram Singh',
      phone: '+919876543205',
      email: 'vikram.singh@example.com',
      total_orders: 2,
      total_spent: 8500,
      last_order_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      engagement_score: 55,
    },
    // New Customer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Anita Desai',
      phone: '+919876543206',
      email: 'anita.desai@example.com',
      whatsapp_number: '+919876543206',
      total_orders: 1,
      total_spent: 4500,
      last_order_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      engagement_score: 45,
    },
    // Dormant Customer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Suresh Iyer',
      phone: '+919876543207',
      email: 'suresh.iyer@example.com',
      total_orders: 5,
      total_spent: 22000,
      last_order_date: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000), // 120 days ago
      engagement_score: 25,
    },
    // Dormant Customer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Meena Gupta',
      phone: '+919876543208',
      email: 'meena.gupta@example.com',
      total_orders: 4,
      total_spent: 18000,
      last_order_date: new Date(Date.now() - 150 * 24 * 60 * 60 * 1000), // 150 days ago
      engagement_score: 20,
    },
    // Customer without email
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Ravi Verma',
      phone: '+919876543209',
      whatsapp_number: '+919876543209',
      total_orders: 3,
      total_spent: 12000,
      last_order_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      engagement_score: 50,
    },
    // Customer with phone only
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      phone: '+919876543210',
      total_orders: 1,
      total_spent: 3500,
      last_order_date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      engagement_score: 40,
    },
    // Additional VIP Customers
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Aisha Khan',
      phone: '+919876543211',
      email: 'aisha.khan@example.com',
      whatsapp_number: '+919876543211',
      total_orders: 32,
      total_spent: 185000,
      last_order_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
      engagement_score: 98,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Karthik Rao',
      phone: '+919876543212',
      email: 'karthik.rao@example.com',
      whatsapp_number: '+919876543212',
      total_orders: 28,
      total_spent: 142000,
      last_order_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      engagement_score: 92,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Divya Menon',
      phone: '+919876543213',
      email: 'divya.menon@example.com',
      whatsapp_number: '+919876543213',
      total_orders: 22,
      total_spent: 98000,
      last_order_date: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
      engagement_score: 90,
    },
    // Regular Customers
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Rahul Khanna',
      phone: '+919876543214',
      email: 'rahul.khanna@example.com',
      whatsapp_number: '+919876543214',
      total_orders: 9,
      total_spent: 42000,
      last_order_date: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000), // 12 days ago
      engagement_score: 75,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Neha Kapoor',
      phone: '+919876543215',
      email: 'neha.kapoor@example.com',
      whatsapp_number: '+919876543215',
      total_orders: 7,
      total_spent: 31500,
      last_order_date: new Date(Date.now() - 18 * 24 * 60 * 60 * 1000), // 18 days ago
      engagement_score: 68,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Sanjay Bose',
      phone: '+919876543216',
      email: 'sanjay.bose@example.com',
      total_orders: 5,
      total_spent: 24000,
      last_order_date: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000), // 25 days ago
      engagement_score: 60,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Pooja Nambiar',
      phone: '+919876543217',
      email: 'pooja.nambiar@example.com',
      whatsapp_number: '+919876543217',
      total_orders: 6,
      total_spent: 27500,
      last_order_date: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000), // 22 days ago
      engagement_score: 63,
    },
    // New Customers
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Aryan Malhotra',
      phone: '+919876543218',
      email: 'aryan.malhotra@example.com',
      whatsapp_number: '+919876543218',
      total_orders: 2,
      total_spent: 9800,
      last_order_date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      engagement_score: 52,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Shruti Agarwal',
      phone: '+919876543219',
      email: 'shruti.agarwal@example.com',
      total_orders: 1,
      total_spent: 5200,
      last_order_date: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      engagement_score: 48,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Abhishek Joshi',
      phone: '+919876543220',
      email: 'abhishek.joshi@example.com',
      whatsapp_number: '+919876543220',
      total_orders: 3,
      total_spent: 11400,
      last_order_date: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
      engagement_score: 58,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Kavita Sinha',
      phone: '+919876543221',
      email: 'kavita.sinha@example.com',
      total_orders: 1,
      total_spent: 4800,
      last_order_date: new Date(Date.now() - 11 * 24 * 60 * 60 * 1000), // 11 days ago
      engagement_score: 42,
    },
    // Dormant Customers
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Ramesh Pillai',
      phone: '+919876543222',
      email: 'ramesh.pillai@example.com',
      total_orders: 8,
      total_spent: 36000,
      last_order_date: new Date(Date.now() - 95 * 24 * 60 * 60 * 1000), // 95 days ago
      engagement_score: 32,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Lakshmi Krishnan',
      phone: '+919876543223',
      email: 'lakshmi.krishnan@example.com',
      whatsapp_number: '+919876543223',
      total_orders: 6,
      total_spent: 28500,
      last_order_date: new Date(Date.now() - 110 * 24 * 60 * 60 * 1000), // 110 days ago
      engagement_score: 28,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Harish Chandra',
      phone: '+919876543224',
      email: 'harish.chandra@example.com',
      total_orders: 4,
      total_spent: 19000,
      last_order_date: new Date(Date.now() - 135 * 24 * 60 * 60 * 1000), // 135 days ago
      engagement_score: 22,
    },
    // Customers without email
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Gopal Krishna',
      phone: '+919876543225',
      whatsapp_number: '+919876543225',
      total_orders: 4,
      total_spent: 16200,
      last_order_date: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
      engagement_score: 55,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Sunita Yadav',
      phone: '+919876543226',
      whatsapp_number: '+919876543226',
      total_orders: 5,
      total_spent: 21000,
      last_order_date: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000), // 28 days ago
      engagement_score: 62,
    },
    // More phone-only customers
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      phone: '+919876543227',
      whatsapp_number: '+919876543227',
      total_orders: 2,
      total_spent: 7800,
      last_order_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      engagement_score: 45,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      phone: '+919876543228',
      total_orders: 1,
      total_spent: 3200,
      last_order_date: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000), // 9 days ago
      engagement_score: 38,
    },
    // High-value recent customers
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Akash Mehta',
      phone: '+919876543229',
      email: 'akash.mehta@example.com',
      whatsapp_number: '+919876543229',
      total_orders: 15,
      total_spent: 82000,
      last_order_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      engagement_score: 85,
    },
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Ritu Bansal',
      phone: '+919876543230',
      email: 'ritu.bansal@example.com',
      whatsapp_number: '+919876543230',
      total_orders: 19,
      total_spent: 94000,
      last_order_date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      engagement_score: 89,
    },
  ]

  const createdCustomers = []
  for (const customerData of customers) {
    const customer = await prisma.customers.create({
      data: customerData,
    })
    createdCustomers.push(customer)
    console.log(`Customer created: ${customer.name || customer.phone}`)
  }

  // 6. Create Products with variants and stock tracking
  console.log('Creating products...')

  const products = [
    // Product 1 - Premium Laptop (with variants)
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Premium Business Laptop',
      description: 'High-performance laptop for business professionals',
      sku: 'LAPTOP-001',
      price: 75000,
      cost_price: 60000,
      category: 'Electronics',
      track_inventory: true,
      stock_quantity: 25,
      reserved_stock: 0,
      in_stock: true,
      low_stock_threshold: 5,
      is_active: true,
      tax_rate: 18,
      weight: 1.5,
      dimensions: { length: 35, width: 25, height: 2 },
    },
    // Product 2 - Wireless Mouse (simple product)
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse with USB receiver',
      sku: 'MOUSE-001',
      price: 899,
      cost_price: 500,
      category: 'Accessories',
      track_inventory: true,
      stock_quantity: 150,
      reserved_stock: 0,
      in_stock: true,
      low_stock_threshold: 20,
      is_active: true,
      tax_rate: 18,
      weight: 0.15,
    },
    // Product 3 - Office Chair (with variants for color)
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Ergonomic Office Chair',
      description: 'Comfortable office chair with lumbar support',
      sku: 'CHAIR-001',
      price: 12500,
      cost_price: 8000,
      category: 'Furniture',
      track_inventory: true,
      stock_quantity: 40,
      reserved_stock: 0,
      in_stock: true,
      low_stock_threshold: 10,
      is_active: true,
      tax_rate: 18,
      weight: 18,
      dimensions: { length: 60, width: 60, height: 120 },
    },
    // Product 4 - USB-C Cable
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'USB-C Cable (2m)',
      description: 'Fast charging USB-C cable',
      sku: 'CABLE-001',
      price: 499,
      cost_price: 200,
      category: 'Accessories',
      track_inventory: true,
      stock_quantity: 200,
      reserved_stock: 0,
      in_stock: true,
      low_stock_threshold: 50,
      is_active: true,
      tax_rate: 18,
      weight: 0.05,
    },
    // Product 5 - External Hard Drive
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'External Hard Drive 1TB',
      description: 'Portable external storage device',
      sku: 'HDD-001',
      price: 4500,
      cost_price: 3200,
      category: 'Electronics',
      track_inventory: true,
      stock_quantity: 60,
      reserved_stock: 0,
      in_stock: true,
      low_stock_threshold: 15,
      is_active: true,
      tax_rate: 18,
      weight: 0.25,
    },
  ]

  const createdProducts = []
  for (const productData of products) {
    const product = await prisma.products.create({
      data: productData,
    })
    createdProducts.push(product)
    console.log(`Product created: ${product.name}`)
  }

  // Add product variants for laptop (RAM/Storage combinations)
  console.log('Creating product variants...')
  const laptopVariants = [
    { name: '8GB RAM / 256GB SSD', sku: 'LAPTOP-001-8-256', price: 75000, quantity: 10 },
    { name: '16GB RAM / 512GB SSD', sku: 'LAPTOP-001-16-512', price: 95000, quantity: 10 },
    { name: '32GB RAM / 1TB SSD', sku: 'LAPTOP-001-32-1TB', price: 125000, quantity: 5 },
  ]

  for (const variantData of laptopVariants) {
    await prisma.product_variants.create({
      data: {
        product_id: createdProducts[0].product_id,
        ...variantData,
        in_stock: true,
      },
    })
    console.log(`Variant created: ${variantData.name}`)
  }

  // 7. Create Orders with different statuses
  console.log('Creating orders...')

  // Order 1 - Recent delivered order (VIP customer)
  const order1 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[0].customer_id, // Rajesh Kumar (VIP)
      order_type: 'product',
      order_number: `ORD-${Date.now()}-001`,
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 95000,
      tax_amount: 17100,
      discount_amount: 0,
      total_amount: 112100,
      paid_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
      shipped_at: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
      delivered_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
      shipping_address: JSON.stringify({ street: '123 MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }),
      billing_address: JSON.stringify({ street: '123 MG Road', city: 'Mumbai', state: 'Maharashtra', pincode: '400001' }),
      tracking_number: 'TRACK001234',
    },
  })

  await prisma.order_items.create({
    data: {
      order_id: order1.order_id,
      product_id: createdProducts[0].product_id,
      product_name: 'Premium Business Laptop - 16GB RAM / 512GB SSD',
      sku: 'LAPTOP-001-16-512',
      quantity: 1,
      unit_price: 95000,
      total_price: 112100,
    },
  })
  console.log(`Order created: Delivered order for ${createdCustomers[0].name}`)

  // Order 2 - Processing order (VIP customer)
  const order2 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[1].customer_id, // Priya Sharma
      order_type: 'product',
      order_number: `ORD-${Date.now()}-002`,
      status: 'processing',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 26500,
      tax_amount: 4770,
      discount_amount: 500,
      total_amount: 30870,
      paid_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      shipping_address: JSON.stringify({ street: '456 Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016' }),
      billing_address: JSON.stringify({ street: '456 Park Street', city: 'Kolkata', state: 'West Bengal', pincode: '700016' }),
    },
  })

  await prisma.order_items.createMany({
    data: [
      {
        order_id: order2.order_id,
        product_id: createdProducts[2].product_id,
        product_name: 'Ergonomic Office Chair',
        sku: 'CHAIR-001',
        quantity: 2,
        unit_price: 12500,
        total_price: 29500,
      },
      {
        order_id: order2.order_id,
        product_id: createdProducts[1].product_id,
        product_name: 'Wireless Mouse',
        sku: 'MOUSE-001',
        quantity: 1,
        unit_price: 899,
        total_price: 1061,
      },
    ],
  })
  console.log(`Order created: Processing order for ${createdCustomers[1].name}`)

  // Order 3 - Pending payment order
  const order3 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[2].customer_id, // Amit Patel
      order_type: 'product',
      order_number: `ORD-${Date.now()}-003`,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'cod',
      subtotal: 5000,
      tax_amount: 900,
      discount_amount: 0,
      total_amount: 5950,
      shipping_address: JSON.stringify({ street: '789 Link Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' }),
      billing_address: JSON.stringify({ street: '789 Link Road', city: 'Ahmedabad', state: 'Gujarat', pincode: '380001' }),
    },
  })

  await prisma.order_items.createMany({
    data: [
      {
        order_id: order3.order_id,
        product_id: createdProducts[4].product_id,
        product_name: 'External Hard Drive 1TB',
        sku: 'HDD-001',
        quantity: 1,
        unit_price: 4500,
        total_price: 5310,
      },
      {
        order_id: order3.order_id,
        product_id: createdProducts[3].product_id,
        product_name: 'USB-C Cable (2m)',
        sku: 'CABLE-001',
        quantity: 1,
        unit_price: 499,
        total_price: 589,
      },
    ],
  })
  console.log(`Order created: Pending order for ${createdCustomers[2].name}`)

  // Order 4 - Shipped order
  const order4 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[3].customer_id, // Sneha Reddy
      order_type: 'product',
      order_number: `ORD-${Date.now()}-004`,
      status: 'shipped',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 75000,
      tax_amount: 13500,
      discount_amount: 1500,
      total_amount: 87000,
      paid_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '321 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033' }),
      billing_address: JSON.stringify({ street: '321 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500033' }),
      tracking_number: 'TRACK001235',
    },
  })

  await prisma.order_items.create({
    data: {
      order_id: order4.order_id,
      product_id: createdProducts[0].product_id,
      product_name: 'Premium Business Laptop - 8GB RAM / 256GB SSD',
      sku: 'LAPTOP-001-8-256',
      quantity: 1,
      unit_price: 75000,
      total_price: 88500,
    },
  })
  console.log(`Order created: Shipped order for ${createdCustomers[3].name}`)

  // Order 5 - Cancelled order
  const order5 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[4].customer_id, // Vikram Singh
      order_type: 'product',
      order_number: `ORD-${Date.now()}-005`,
      status: 'cancelled',
      payment_status: 'refunded',
      payment_method: 'card',
      subtotal: 1798,
      tax_amount: 324,
      discount_amount: 0,
      total_amount: 2172,
      cancelled_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      cancellation_reason: 'Customer requested cancellation',
      shipping_address: JSON.stringify({ street: '654 Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001' }),
      billing_address: JSON.stringify({ street: '654 Connaught Place', city: 'Delhi', state: 'Delhi', pincode: '110001' }),
    },
  })

  await prisma.order_items.create({
    data: {
      order_id: order5.order_id,
      product_id: createdProducts[1].product_id,
      product_name: 'Wireless Mouse',
      sku: 'MOUSE-001',
      quantity: 2,
      unit_price: 899,
      total_price: 2122,
    },
  })
  console.log(`Order created: Cancelled order for ${createdCustomers[4].name}`)

  console.log('\n=== Seed completed successfully! ===')
  console.log('\n📊 Summary:')
  console.log(`   Tenant ID: ${tenant.tenant_id}`)
  console.log(`   Business ID: ${business.business_id}`)
  console.log(`   Admin User: admin@demo.com`)
  console.log(`   Password: Password123!`)
  console.log(`   Total Customers: ${createdCustomers.length}`)
  console.log(`   Total Products: ${createdProducts.length}`)
  console.log(`   Total Orders: 5`)
  console.log('\n📝 Next Steps:')
  console.log(`   1. Copy this Business ID: ${business.business_id}`)
  console.log(`   2. Copy this Tenant ID: ${tenant.tenant_id}`)
  console.log(`   3. Update frontend pages to use these IDs`)
  console.log(`   4. Navigate to http://localhost:3004/customers`)
  console.log(`   5. Navigate to http://localhost:3004/orders`)
  console.log('\n✅ Database seeded with customers, products, and orders!')
}

main()
  .catch((e) => {
    console.error('Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
// Force recompile
