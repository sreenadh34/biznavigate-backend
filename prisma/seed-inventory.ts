import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting inventory seed...');

  // Get or create a test tenant and business
  let tenant = await prisma.tenants.findFirst();
  if (!tenant) {
    tenant = await prisma.tenants.create({
      data: {
        tenant_id: '00000000-0000-0000-0000-000000000001',
        tenant_name: 'Test Tenant',
        email: 'test@example.com',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  let business = await prisma.businesses.findFirst({
    where: { tenant_id: tenant.tenant_id },
  });

  if (!business) {
    business = await prisma.businesses.create({
      data: {
        business_id: '00000000-0000-0000-0000-000000000002',
        tenant_id: tenant.tenant_id,
        business_name: 'Fashion Store',
        business_type: 'retail',
        created_at: new Date(),
        updated_at: new Date(),
      },
    });
  }

  console.log(`✅ Using tenant: ${tenant.tenant_name}`);
  console.log(`✅ Using business: ${business.business_name}`);

  // Create warehouses
  console.log('📦 Creating warehouses...');
  const mainWarehouse = await prisma.warehouses.upsert({
    where: {
      business_id_warehouse_code: {
        business_id: business.business_id,
        warehouse_code: 'WH-MAIN',
      },
    },
    update: {},
    create: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      warehouse_name: 'Main Warehouse',
      warehouse_code: 'WH-MAIN',
      city: 'Mumbai',
      state: 'Maharashtra',
      is_default: true,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  const secondaryWarehouse = await prisma.warehouses.upsert({
    where: {
      business_id_warehouse_code: {
        business_id: business.business_id,
        warehouse_code: 'WH-SEC',
      },
    },
    update: {},
    create: {
      business_id: business.business_id,
      tenant_id: tenant.tenant_id,
      warehouse_name: 'Secondary Warehouse',
      warehouse_code: 'WH-SEC',
      city: 'Delhi',
      state: 'Delhi',
      is_default: false,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    },
  });

  console.log(`✅ Created warehouses: Main & Secondary`);

  // Create product categories
  console.log('📂 Creating product categories...');
  const categories = [
    {
      name: 'Women\'s Clothing',
      slug: 'womens-clothing',
      description: 'Traditional and modern women\'s wear',
      children: [
        { name: 'Kurtis', slug: 'kurtis', description: 'Designer kurtis and kurtas' },
        { name: 'Sarees', slug: 'sarees', description: 'Silk and cotton sarees' },
        { name: 'Lehengas', slug: 'lehengas', description: 'Bridal and party lehengas' },
      ],
    },
    {
      name: 'Jewelry',
      slug: 'jewelry',
      description: 'Fashion and traditional jewelry',
      children: [
        { name: 'Necklaces', slug: 'necklaces', description: 'Gold and silver necklaces' },
        { name: 'Earrings', slug: 'earrings', description: 'Designer earrings' },
        { name: 'Bangles', slug: 'bangles', description: 'Traditional bangles' },
      ],
    },
    {
      name: 'Men\'s Clothing',
      slug: 'mens-clothing',
      description: 'Men\'s ethnic and casual wear',
      children: [
        { name: 'Kurtas', slug: 'mens-kurtas', description: 'Men\'s kurtas and sherwanis' },
        { name: 'Shirts', slug: 'mens-shirts', description: 'Casual and formal shirts' },
      ],
    },
  ];

  const createdCategories: any[] = [];

  for (const categoryData of categories) {
    const parentCategory = await prisma.product_categories.upsert({
      where: {
        business_id_slug: {
          business_id: business.business_id,
          slug: categoryData.slug,
        },
      },
      update: {},
      create: {
        business_id: business.business_id,
        tenant_id: tenant.tenant_id,
        name: categoryData.name,
        slug: categoryData.slug,
        description: categoryData.description,
        level: 0,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    createdCategories.push(parentCategory);

    // Create subcategories
    for (const childData of categoryData.children) {
      const childCategory = await prisma.product_categories.upsert({
        where: {
          business_id_slug: {
            business_id: business.business_id,
            slug: childData.slug,
          },
        },
        update: {},
        create: {
          business_id: business.business_id,
          tenant_id: tenant.tenant_id,
          name: childData.name,
          slug: childData.slug,
          description: childData.description,
          parent_category_id: parentCategory.category_id,
          level: 1,
          is_active: true,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      createdCategories.push(childCategory);
    }
  }

  console.log(`✅ Created ${createdCategories.length} categories`);

  // Create products
  console.log('🛍️  Creating products...');
  const kurtisCategory = createdCategories.find((c) => c.slug === 'kurtis');
  const sareesCategory = createdCategories.find((c) => c.slug === 'sarees');
  const lehengasCategory = createdCategories.find((c) => c.slug === 'lehengas');
  const jewelryCategory = createdCategories.find((c) => c.slug === 'jewelry');

  const products = [
    {
      name: 'Red Kurti - Designer Collection',
      description: 'Beautiful red designer kurti with intricate embroidery',
      product_type: 'physical_product',
      category_id: kurtisCategory?.category_id,
      base_price: 2499.0,
      cost_price: 1500.0,
      sku: 'KRT-RED-001',
      is_active: true,
      track_inventory: true,
      stock: 50,
      reorder_point: 10,
      max_stock_level: 100,
    },
    {
      name: 'Blue Silk Saree',
      description: 'Premium blue silk saree with golden border',
      product_type: 'physical_product',
      category_id: sareesCategory?.category_id,
      base_price: 4599.0,
      cost_price: 3000.0,
      sku: 'SAR-BLU-001',
      is_active: true,
      track_inventory: true,
      stock: 30,
      reorder_point: 8,
      max_stock_level: 50,
    },
    {
      name: 'Wedding Lehenga - Bridal',
      description: 'Exquisite bridal lehenga with heavy embroidery',
      product_type: 'physical_product',
      category_id: lehengasCategory?.category_id,
      base_price: 15999.0,
      cost_price: 10000.0,
      sku: 'LEH-WED-001',
      is_active: true,
      track_inventory: true,
      stock: 15,
      reorder_point: 5,
      max_stock_level: 25,
    },
    {
      name: 'Ethnic Jewelry Set',
      description: 'Complete jewelry set with necklace, earrings, and bangles',
      product_type: 'physical_product',
      category_id: jewelryCategory?.category_id,
      base_price: 3299.0,
      cost_price: 2000.0,
      sku: 'JWL-SET-001',
      is_active: true,
      track_inventory: true,
      stock: 25,
      reorder_point: 10,
      max_stock_level: 50,
    },
    {
      name: 'Cotton Kurti - Casual Wear',
      description: 'Comfortable cotton kurti for daily wear',
      product_type: 'physical_product',
      category_id: kurtisCategory?.category_id,
      base_price: 899.0,
      cost_price: 500.0,
      sku: 'KRT-COT-001',
      is_active: true,
      track_inventory: true,
      stock: 100,
      reorder_point: 20,
      max_stock_level: 200,
    },
    {
      name: 'Georgette Saree - Party Wear',
      description: 'Elegant georgette saree perfect for parties',
      product_type: 'physical_product',
      category_id: sareesCategory?.category_id,
      base_price: 2999.0,
      cost_price: 1800.0,
      sku: 'SAR-GEO-001',
      is_active: true,
      track_inventory: true,
      stock: 40,
      reorder_point: 12,
      max_stock_level: 80,
    },
    {
      name: 'Pink Lehenga - Festive',
      description: 'Vibrant pink lehenga for festive occasions',
      product_type: 'physical_product',
      category_id: lehengasCategory?.category_id,
      base_price: 8999.0,
      cost_price: 5500.0,
      sku: 'LEH-PNK-001',
      is_active: true,
      track_inventory: true,
      stock: 20,
      reorder_point: 6,
      max_stock_level: 35,
    },
    {
      name: 'Gold Plated Necklace',
      description: 'Elegant gold plated necklace',
      product_type: 'physical_product',
      category_id: jewelryCategory?.category_id,
      base_price: 1599.0,
      cost_price: 900.0,
      sku: 'JWL-NCK-001',
      is_active: true,
      track_inventory: true,
      stock: 60,
      reorder_point: 15,
      max_stock_level: 100,
    },
    {
      name: 'Designer Kurti Set',
      description: 'Premium designer kurti with dupatta',
      product_type: 'physical_product',
      category_id: kurtisCategory?.category_id,
      base_price: 3499.0,
      cost_price: 2200.0,
      sku: 'KRT-DES-001',
      is_active: true,
      track_inventory: true,
      stock: 35,
      reorder_point: 10,
      max_stock_level: 60,
    },
    {
      name: 'Banarasi Silk Saree',
      description: 'Authentic Banarasi silk saree',
      product_type: 'physical_product',
      category_id: sareesCategory?.category_id,
      base_price: 6999.0,
      cost_price: 4500.0,
      sku: 'SAR-BAN-001',
      is_active: true,
      track_inventory: true,
      stock: 8,
      reorder_point: 3,
      max_stock_level: 15,
    },
  ];

  const createdProducts = [];
  for (const productData of products) {
    const product = await prisma.products.create({
      data: {
        business_id: business.business_id,
        tenant_id: tenant.tenant_id,
        ...productData,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    createdProducts.push(product);

    // Create default variant for each product
    const variant = await prisma.product_variants.create({
      data: {
        product_id: product.product_id,
        name: 'Default',
        sku: productData.sku,
        price: productData.base_price,
        quantity: productData.stock,
        in_stock: productData.stock > 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create inventory level for main warehouse
    const inventoryLevel = await prisma.inventory_levels.create({
      data: {
        business_id: business.business_id,
        tenant_id: tenant.tenant_id,
        warehouse_id: mainWarehouse.warehouse_id,
        variant_id: variant.variant_id,
        available_quantity: productData.stock,
        reserved_quantity: 0,
        damaged_quantity: 0,
        in_transit_quantity: 0,
        reorder_point: productData.reorder_point,
        max_stock_level: productData.max_stock_level,
        average_cost: productData.cost_price,
        total_value: productData.stock * productData.cost_price,
        is_low_stock: productData.stock <= productData.reorder_point,
        is_out_of_stock: productData.stock === 0,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    // Create initial stock movement
    await prisma.stock_movements.create({
      data: {
        businesses: {
          connect: { business_id: business.business_id }
        },
        tenants: {
          connect: { tenant_id: tenant.tenant_id }
        },
        warehouses: {
          connect: { warehouse_id: mainWarehouse.warehouse_id }
        },
        product_variants: {
          connect: { variant_id: variant.variant_id }
        },
        inventory_levels: {
          connect: { inventory_level_id: inventoryLevel.inventory_level_id }
        },
        movement_type: 'add',
        quantity_change: productData.stock,
        quantity_before: 0,
        quantity_after: productData.stock,
        reference_type: 'initial_stock',
        notes: 'Initial stock entry',
        created_at: new Date(),
      },
    });

    // Create low stock alert if needed
    if (productData.stock <= productData.reorder_point) {
      await prisma.stock_alerts.create({
        data: {
          businesses: {
            connect: { business_id: business.business_id }
          },
          tenants: {
            connect: { tenant_id: tenant.tenant_id }
          },
          warehouses: {
            connect: { warehouse_id: mainWarehouse.warehouse_id }
          },
          product_variants: {
            connect: { variant_id: variant.variant_id }
          },
          inventory_levels: {
            connect: { inventory_level_id: inventoryLevel.inventory_level_id }
          },
          alert_type: 'low_stock',
          severity: productData.stock === 0 ? 'critical' : productData.stock < 5 ? 'high' : 'medium',
          current_quantity: productData.stock,
          reorder_point: productData.reorder_point,
          recommended_order_quantity: productData.max_stock_level - productData.stock,
          status: 'active',
          notification_sent: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });
    }

    console.log(`  ✅ Created product: ${product.name} (Stock: ${productData.stock})`);
  }

  console.log(`\n✅ Created ${createdProducts.length} products`);

  // Summary
  console.log('\n📊 Seed Summary:');
  console.log(`  - Tenant: ${tenant.tenant_name}`);
  console.log(`  - Business: ${business.business_name}`);
  console.log(`  - Warehouses: 2`);
  console.log(`  - Categories: ${createdCategories.length}`);
  console.log(`  - Products: ${createdProducts.length}`);
  console.log(`  - Stock value: ₹${createdProducts.reduce((sum, p) => sum + (p.cost_price * p.stock), 0).toLocaleString()}`);

  console.log('\n✨ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
