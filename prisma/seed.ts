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
  await prisma.product_categories.deleteMany({})
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

  // 6. Create Product Categories
  console.log('Creating product categories...')

  // Root categories
  const electronicsCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic devices and accessories',
      level: 0,
      path: '/electronics',
      display_order: 1,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Category created: ${electronicsCategory.name}`)

  const furnitureCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Furniture',
      slug: 'furniture',
      description: 'Office and home furniture',
      level: 0,
      path: '/furniture',
      display_order: 2,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Category created: ${furnitureCategory.name}`)

  const accessoriesCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Accessories',
      slug: 'accessories',
      description: 'Computer and office accessories',
      level: 0,
      path: '/accessories',
      display_order: 3,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Category created: ${accessoriesCategory.name}`)

  // Subcategories for Electronics
  const computersCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Computers',
      slug: 'computers',
      description: 'Desktop and laptop computers',
      parent_category_id: electronicsCategory.category_id,
      level: 1,
      path: '/electronics/computers',
      display_order: 1,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Subcategory created: ${computersCategory.name}`)

  const monitorsCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Monitors',
      slug: 'monitors',
      description: 'Computer monitors and displays',
      parent_category_id: electronicsCategory.category_id,
      level: 1,
      path: '/electronics/monitors',
      display_order: 2,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Subcategory created: ${monitorsCategory.name}`)

  // Subcategories for Furniture
  const officeChairsCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Office Chairs',
      slug: 'office-chairs',
      description: 'Ergonomic office chairs',
      parent_category_id: furnitureCategory.category_id,
      level: 1,
      path: '/furniture/office-chairs',
      display_order: 1,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Subcategory created: ${officeChairsCategory.name}`)

  const desksCategory = await prisma.product_categories.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      name: 'Desks',
      slug: 'desks',
      description: 'Office desks and workstations',
      parent_category_id: furnitureCategory.category_id,
      level: 1,
      path: '/furniture/desks',
      display_order: 2,
      is_active: true,
      product_count: 0,
    },
  })
  console.log(`Subcategory created: ${desksCategory.name}`)

  // 7. Create Products with variants and stock tracking
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
      category: 'Electronics',
      stock_quantity: 25,
      in_stock: true,
      is_active: true,
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
      category: 'Accessories',
      stock_quantity: 150,
      in_stock: true,
      is_active: true,
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
      category: 'Furniture',
      stock_quantity: 40,
      in_stock: true,
      is_active: true,
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
      category: 'Accessories',
      stock_quantity: 200,
      in_stock: true,
      is_active: true,
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
      category: 'Electronics',
      stock_quantity: 60,
      in_stock: true,
      is_active: true,
    },
    // Product 6 - Mechanical Keyboard
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Mechanical Gaming Keyboard RGB',
      description: 'Professional mechanical keyboard with RGB lighting',
      sku: 'KEYB-001',
      price: 5999,
      category: 'Accessories',
      stock_quantity: 80,
      in_stock: true,
      is_active: true,
    },
    // Product 7 - Monitor
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: '27" 4K Monitor',
      description: 'Ultra HD 4K display with HDR support',
      sku: 'MON-001',
      price: 28000,
      category: 'Electronics',
      stock_quantity: 35,
      in_stock: true,
      is_active: true,
    },
    // Product 8 - Desk Lamp
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'LED Desk Lamp',
      description: 'Adjustable LED desk lamp with touch controls',
      sku: 'LAMP-001',
      price: 1899,
      category: 'Furniture',
      stock_quantity: 120,
      in_stock: true,
      is_active: true,
    },
    // Product 9 - Webcam
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: '1080p HD Webcam',
      description: 'Full HD webcam for video conferencing',
      sku: 'CAM-001',
      price: 3499,
      category: 'Electronics',
      stock_quantity: 95,
      in_stock: true,
      is_active: true,
    },
    // Product 10 - Laptop Stand
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Aluminum Laptop Stand',
      description: 'Ergonomic laptop stand with cooling design',
      sku: 'STAND-001',
      price: 2299,
      category: 'Accessories',
      stock_quantity: 75,
      in_stock: true,
      is_active: true,
    },
    // Product 11 - Headphones
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Wireless Noise Cancelling Headphones',
      description: 'Premium wireless headphones with active noise cancellation',
      sku: 'HEAD-001',
      price: 12999,
      category: 'Electronics',
      stock_quantity: 55,
      in_stock: true,
      is_active: true,
    },
    // Product 12 - Standing Desk
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Electric Standing Desk',
      description: 'Height-adjustable electric standing desk',
      sku: 'DESK-001',
      price: 35000,
      category: 'Furniture',
      stock_quantity: 20,
      in_stock: true,
      is_active: true,
    },
    // Product 13 - Phone Charger
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: '65W Fast Phone Charger',
      description: 'Universal fast charger with multiple ports',
      sku: 'CHRG-001',
      price: 1499,
      category: 'Accessories',
      stock_quantity: 180,
      in_stock: true,
      is_active: true,
    },
    // Product 14 - Tablet
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: '10.5" Tablet',
      description: 'Lightweight tablet with stylus support',
      sku: 'TAB-001',
      price: 32000,
      category: 'Electronics',
      stock_quantity: 45,
      in_stock: true,
      is_active: true,
    },
    // Product 15 - Mouse Pad
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Extended Gaming Mouse Pad',
      description: 'Large RGB mouse pad for gaming setup',
      sku: 'PAD-001',
      price: 899,
      category: 'Accessories',
      stock_quantity: 200,
      in_stock: true,
      is_active: true,
    },
    // Product 16 - Printer
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Wireless Color Printer',
      description: 'All-in-one wireless printer with scanner',
      sku: 'PRNT-001',
      price: 18500,
      category: 'Electronics',
      stock_quantity: 30,
      in_stock: true,
      is_active: true,
    },
    // Product 17 - Bookshelf
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Wooden Bookshelf',
      description: '5-tier wooden bookshelf for home office',
      sku: 'SHELF-001',
      price: 8900,
      category: 'Furniture',
      stock_quantity: 25,
      in_stock: true,
      is_active: true,
    },
    // Product 18 - Power Bank
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: '20000mAh Power Bank',
      description: 'High capacity portable power bank',
      sku: 'PBNK-001',
      price: 2199,
      category: 'Accessories',
      stock_quantity: 140,
      in_stock: true,
      is_active: true,
    },
    // Product 19 - Microphone
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'USB Condenser Microphone',
      description: 'Professional USB microphone for streaming',
      sku: 'MIC-001',
      price: 6799,
      category: 'Electronics',
      stock_quantity: 65,
      in_stock: true,
      is_active: true,
    },
    // Product 20 - Office Chair Mat
    {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      product_type: 'physical',
      name: 'Office Chair Mat',
      description: 'Protective mat for office chair',
      sku: 'MAT-001',
      price: 3200,
      category: 'Furniture',
      stock_quantity: 50,
      in_stock: true,
      is_active: true,
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

  // Order 6 - Recent delivered order (VIP customer)
  const order6 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[10].customer_id, // Aisha Khan (VIP)
      order_type: 'product',
      order_number: `ORD-${Date.now()}-006`,
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 45000,
      tax_amount: 8100,
      discount_amount: 2000,
      total_amount: 51100,
      paid_at: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
      delivered_at: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '12 Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' }),
      billing_address: JSON.stringify({ street: '12 Bandra West', city: 'Mumbai', state: 'Maharashtra', pincode: '400050' }),
      tracking_number: 'TRACK001236',
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order6.order_id,
      product_id: createdProducts[2].product_id,
      product_name: 'Ergonomic Office Chair',
      sku: 'CHAIR-001',
      quantity: 3,
      unit_price: 12500,
      total_price: 44250,
    },
  })

  // Order 7 - Confirmed order (Regular customer)
  const order7 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[13].customer_id, // Rahul Khanna
      order_type: 'product',
      order_number: `ORD-${Date.now()}-007`,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 8500,
      tax_amount: 1530,
      discount_amount: 0,
      total_amount: 10030,
      paid_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '45 Sector 17', city: 'Chandigarh', state: 'Punjab', pincode: '160017' }),
      billing_address: JSON.stringify({ street: '45 Sector 17', city: 'Chandigarh', state: 'Punjab', pincode: '160017' }),
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order7.order_id,
        product_id: createdProducts[3].product_id,
        product_name: 'USB-C Cable (2m)',
        sku: 'CABLE-001',
        quantity: 4,
        unit_price: 499,
        total_price: 2356,
      },
      {
        order_id: order7.order_id,
        product_id: createdProducts[4].product_id,
        product_name: 'External Hard Drive 1TB',
        sku: 'HDD-001',
        quantity: 1,
        unit_price: 4500,
        total_price: 5310,
      },
    ],
  })

  // Order 8 - Processing order
  const order8 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[11].customer_id, // Karthik Rao (VIP)
      order_type: 'product',
      order_number: `ORD-${Date.now()}-008`,
      status: 'processing',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 95000,
      tax_amount: 17100,
      discount_amount: 5000,
      total_amount: 107100,
      paid_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '78 Whitefield', city: 'Bangalore', state: 'Karnataka', pincode: '560066' }),
      billing_address: JSON.stringify({ street: '78 Whitefield', city: 'Bangalore', state: 'Karnataka', pincode: '560066' }),
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order8.order_id,
      product_id: createdProducts[0].product_id,
      product_name: 'Premium Business Laptop - 16GB RAM / 512GB SSD',
      sku: 'LAPTOP-001-16-512',
      quantity: 1,
      unit_price: 95000,
      total_price: 112100,
    },
  })

  // Order 9 - Shipped order
  const order9 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[14].customer_id, // Deepa Nair
      order_type: 'product',
      order_number: `ORD-${Date.now()}-009`,
      status: 'shipped',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 13500,
      tax_amount: 2430,
      discount_amount: 500,
      total_amount: 15430,
      paid_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '90 Marine Drive', city: 'Kochi', state: 'Kerala', pincode: '682011' }),
      billing_address: JSON.stringify({ street: '90 Marine Drive', city: 'Kochi', state: 'Kerala', pincode: '682011' }),
      tracking_number: 'TRACK001237',
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order9.order_id,
        product_id: createdProducts[1].product_id,
        product_name: 'Wireless Mouse',
        sku: 'MOUSE-001',
        quantity: 3,
        unit_price: 899,
        total_price: 3179,
      },
      {
        order_id: order9.order_id,
        product_id: createdProducts[2].product_id,
        product_name: 'Ergonomic Office Chair',
        sku: 'CHAIR-001',
        quantity: 1,
        unit_price: 12500,
        total_price: 14750,
      },
    ],
  })

  // Order 10 - Pending order
  const order10 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[15].customer_id, // Sanjay Malhotra
      order_type: 'product',
      order_number: `ORD-${Date.now()}-010`,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'cod',
      subtotal: 2500,
      tax_amount: 450,
      discount_amount: 0,
      total_amount: 2950,
      shipping_address: JSON.stringify({ street: '23 Koramangala', city: 'Bangalore', state: 'Karnataka', pincode: '560034' }),
      billing_address: JSON.stringify({ street: '23 Koramangala', city: 'Bangalore', state: 'Karnataka', pincode: '560034' }),
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order10.order_id,
      product_id: createdProducts[3].product_id,
      product_name: 'USB-C Cable (2m)',
      sku: 'CABLE-001',
      quantity: 5,
      unit_price: 499,
      total_price: 2945,
    },
  })

  // Order 11 - Delivered order (Regular customer)
  const order11 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[16].customer_id, // Kavita Singh
      order_type: 'product',
      order_number: `ORD-${Date.now()}-011`,
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 35000,
      tax_amount: 6300,
      discount_amount: 1000,
      total_amount: 40300,
      paid_at: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 17 * 24 * 60 * 60 * 1000),
      delivered_at: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '56 Indiranagar', city: 'Bangalore', state: 'Karnataka', pincode: '560038' }),
      billing_address: JSON.stringify({ street: '56 Indiranagar', city: 'Bangalore', state: 'Karnataka', pincode: '560038' }),
      tracking_number: 'TRACK001238',
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order11.order_id,
        product_id: createdProducts[2].product_id,
        product_name: 'Ergonomic Office Chair',
        sku: 'CHAIR-001',
        quantity: 2,
        unit_price: 12500,
        total_price: 29500,
      },
      {
        order_id: order11.order_id,
        product_id: createdProducts[4].product_id,
        product_name: 'External Hard Drive 1TB',
        sku: 'HDD-001',
        quantity: 1,
        unit_price: 4500,
        total_price: 5310,
      },
    ],
  })

  // Order 12 - Confirmed order (New customer)
  const order12 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[17].customer_id, // Arjun Verma
      order_type: 'product',
      order_number: `ORD-${Date.now()}-012`,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 1798,
      tax_amount: 324,
      discount_amount: 0,
      total_amount: 2122,
      paid_at: new Date(),
      shipping_address: JSON.stringify({ street: '89 Salt Lake', city: 'Kolkata', state: 'West Bengal', pincode: '700091' }),
      billing_address: JSON.stringify({ street: '89 Salt Lake', city: 'Kolkata', state: 'West Bengal', pincode: '700091' }),
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order12.order_id,
      product_id: createdProducts[1].product_id,
      product_name: 'Wireless Mouse',
      sku: 'MOUSE-001',
      quantity: 2,
      unit_price: 899,
      total_price: 2122,
    },
  })

  // Order 13 - Processing order (VIP customer)
  const order13 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[12].customer_id, // Divya Menon (VIP)
      order_type: 'product',
      order_number: `ORD-${Date.now()}-013`,
      status: 'processing',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 55000,
      tax_amount: 9900,
      discount_amount: 3000,
      total_amount: 61900,
      paid_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '34 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' }),
      billing_address: JSON.stringify({ street: '34 Jubilee Hills', city: 'Hyderabad', state: 'Telangana', pincode: '500034' }),
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order13.order_id,
        product_id: createdProducts[2].product_id,
        product_name: 'Ergonomic Office Chair',
        sku: 'CHAIR-001',
        quantity: 4,
        unit_price: 12500,
        total_price: 59000,
      },
      {
        order_id: order13.order_id,
        product_id: createdProducts[1].product_id,
        product_name: 'Wireless Mouse',
        sku: 'MOUSE-001',
        quantity: 3,
        unit_price: 899,
        total_price: 3179,
      },
    ],
  })

  // Order 14 - Shipped order
  const order14 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[18].customer_id, // Neha Joshi
      order_type: 'product',
      order_number: `ORD-${Date.now()}-014`,
      status: 'shipped',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 6500,
      tax_amount: 1170,
      discount_amount: 200,
      total_amount: 7470,
      paid_at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '67 Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' }),
      billing_address: JSON.stringify({ street: '67 Anna Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600040' }),
      tracking_number: 'TRACK001239',
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order14.order_id,
        product_id: createdProducts[3].product_id,
        product_name: 'USB-C Cable (2m)',
        sku: 'CABLE-001',
        quantity: 2,
        unit_price: 499,
        total_price: 1177,
      },
      {
        order_id: order14.order_id,
        product_id: createdProducts[4].product_id,
        product_name: 'External Hard Drive 1TB',
        sku: 'HDD-001',
        quantity: 1,
        unit_price: 4500,
        total_price: 5310,
      },
    ],
  })

  // Order 15 - Pending order
  const order15 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[19].customer_id, // Manish Kumar
      order_type: 'product',
      order_number: `ORD-${Date.now()}-015`,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'cod',
      subtotal: 899,
      tax_amount: 162,
      discount_amount: 0,
      total_amount: 1061,
      shipping_address: JSON.stringify({ street: '12 Gomti Nagar', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226010' }),
      billing_address: JSON.stringify({ street: '12 Gomti Nagar', city: 'Lucknow', state: 'Uttar Pradesh', pincode: '226010' }),
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order15.order_id,
      product_id: createdProducts[1].product_id,
      product_name: 'Wireless Mouse',
      sku: 'MOUSE-001',
      quantity: 1,
      unit_price: 899,
      total_price: 1061,
    },
  })

  // Order 16 - Delivered order
  const order16 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[20].customer_id, // Pooja Agarwal
      order_type: 'product',
      order_number: `ORD-${Date.now()}-016`,
      status: 'delivered',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 18000,
      tax_amount: 3240,
      discount_amount: 500,
      total_amount: 20740,
      paid_at: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
      delivered_at: new Date(Date.now() - 19 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '45 Civil Lines', city: 'Jaipur', state: 'Rajasthan', pincode: '302006' }),
      billing_address: JSON.stringify({ street: '45 Civil Lines', city: 'Jaipur', state: 'Rajasthan', pincode: '302006' }),
      tracking_number: 'TRACK001240',
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order16.order_id,
        product_id: createdProducts[4].product_id,
        product_name: 'External Hard Drive 1TB',
        sku: 'HDD-001',
        quantity: 3,
        unit_price: 4500,
        total_price: 15930,
      },
      {
        order_id: order16.order_id,
        product_id: createdProducts[3].product_id,
        product_name: 'USB-C Cable (2m)',
        sku: 'CABLE-001',
        quantity: 2,
        unit_price: 499,
        total_price: 1177,
      },
    ],
  })

  // Order 17 - Confirmed order
  const order17 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[21].customer_id, // Sandeep Rao
      order_type: 'product',
      order_number: `ORD-${Date.now()}-017`,
      status: 'confirmed',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 25000,
      tax_amount: 4500,
      discount_amount: 1000,
      total_amount: 28500,
      paid_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '78 FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411004' }),
      billing_address: JSON.stringify({ street: '78 FC Road', city: 'Pune', state: 'Maharashtra', pincode: '411004' }),
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order17.order_id,
      product_id: createdProducts[2].product_id,
      product_name: 'Ergonomic Office Chair',
      sku: 'CHAIR-001',
      quantity: 2,
      unit_price: 12500,
      total_price: 29500,
    },
  })

  // Order 18 - Processing order
  const order18 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[22].customer_id, // Lakshmi Iyer
      order_type: 'product',
      order_number: `ORD-${Date.now()}-018`,
      status: 'processing',
      payment_status: 'paid',
      payment_method: 'upi',
      subtotal: 10000,
      tax_amount: 1800,
      discount_amount: 0,
      total_amount: 11800,
      paid_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '23 T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017' }),
      billing_address: JSON.stringify({ street: '23 T Nagar', city: 'Chennai', state: 'Tamil Nadu', pincode: '600017' }),
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order18.order_id,
        product_id: createdProducts[4].product_id,
        product_name: 'External Hard Drive 1TB',
        sku: 'HDD-001',
        quantity: 2,
        unit_price: 4500,
        total_price: 10620,
      },
      {
        order_id: order18.order_id,
        product_id: createdProducts[1].product_id,
        product_name: 'Wireless Mouse',
        sku: 'MOUSE-001',
        quantity: 1,
        unit_price: 899,
        total_price: 1061,
      },
    ],
  })

  // Order 19 - Shipped order
  const order19 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[23].customer_id, // Ravi Shankar
      order_type: 'product',
      order_number: `ORD-${Date.now()}-019`,
      status: 'shipped',
      payment_status: 'paid',
      payment_method: 'card',
      subtotal: 75000,
      tax_amount: 13500,
      discount_amount: 2500,
      total_amount: 86000,
      paid_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      shipped_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      shipping_address: JSON.stringify({ street: '90 Residency Road', city: 'Bangalore', state: 'Karnataka', pincode: '560025' }),
      billing_address: JSON.stringify({ street: '90 Residency Road', city: 'Bangalore', state: 'Karnataka', pincode: '560025' }),
      tracking_number: 'TRACK001241',
    },
  })
  await prisma.order_items.create({
    data: {
      order_id: order19.order_id,
      product_id: createdProducts[0].product_id,
      product_name: 'Premium Business Laptop - 8GB RAM / 256GB SSD',
      sku: 'LAPTOP-001-8-256',
      quantity: 1,
      unit_price: 75000,
      total_price: 88500,
    },
  })

  // Order 20 - Pending payment order
  const order20 = await prisma.orders.create({
    data: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      customer_id: createdCustomers[24].customer_id, // Anjali Deshmukh
      order_type: 'product',
      order_number: `ORD-${Date.now()}-020`,
      status: 'pending',
      payment_status: 'pending',
      payment_method: 'cod',
      subtotal: 3500,
      tax_amount: 630,
      discount_amount: 0,
      total_amount: 4130,
      shipping_address: JSON.stringify({ street: '56 Viman Nagar', city: 'Pune', state: 'Maharashtra', pincode: '411014' }),
      billing_address: JSON.stringify({ street: '56 Viman Nagar', city: 'Pune', state: 'Maharashtra', pincode: '411014' }),
    },
  })
  await prisma.order_items.createMany({
    data: [
      {
        order_id: order20.order_id,
        product_id: createdProducts[3].product_id,
        product_name: 'USB-C Cable (2m)',
        sku: 'CABLE-001',
        quantity: 3,
        unit_price: 499,
        total_price: 1767,
      },
      {
        order_id: order20.order_id,
        product_id: createdProducts[1].product_id,
        product_name: 'Wireless Mouse',
        sku: 'MOUSE-001',
        quantity: 2,
        unit_price: 899,
        total_price: 2122,
      },
    ],
  })

  console.log('\n=== Seed completed successfully! ===')
  console.log('\n📊 Summary:')
  console.log(`   Tenant ID: ${tenant.tenant_id}`)
  console.log(`   Business ID: ${business.business_id}`)
  console.log(`   Admin User: admin@demo.com`)
  console.log(`   Password: Password123!`)
  console.log(`   Total Customers: ${createdCustomers.length}`)
  console.log(`   Total Categories: 7 (3 root + 4 subcategories)`)
  console.log(`   Total Products: ${createdProducts.length} (20 base products + 3 laptop variants)`)
  console.log(`   Total Orders: 20`)
  console.log('\n📝 Next Steps:')
  console.log(`   1. Copy this Business ID: ${business.business_id}`)
  console.log(`   2. Copy this Tenant ID: ${tenant.tenant_id}`)
  console.log(`   3. Update frontend pages to use these IDs`)
  console.log(`   4. Navigate to http://localhost:3004/customers`)
  console.log(`   5. Navigate to http://localhost:3004/orders`)
  console.log(`   6. Navigate to http://localhost:3004/inventory/categories`)
  console.log('\n✅ Database seeded with customers, categories, products, and orders!')
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
