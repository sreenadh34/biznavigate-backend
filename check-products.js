const { PrismaClient } = require('./generated/prisma');

async function checkProducts() {
  const prisma = new PrismaClient();

  try {
    const products = await prisma.products.findMany({
      where: { business_id: '08ba604c-128d-4716-a238-916fef8b2206' },
      select: {
        product_id: true,
        name: true,
        price: true,
        sku: true,
        is_active: true,
        stock_quantity: true,
        has_variants: true
      },
      orderBy: { created_at: 'desc' }
    });

    console.log(`\n📦 Products in database: ${products.length}\n`);

    products.forEach((p, index) => {
      console.log(`${index + 1}. ${p.name}`);
      console.log(`   SKU: ${p.sku}`);
      console.log(`   Price: ₹${p.price}`);
      console.log(`   Stock: ${p.stock_quantity} units`);
      console.log(`   Active: ${p.is_active}`);
      console.log(`   Has Variants: ${p.has_variants}`);
      console.log('');
    });

    // Check variants
    const variants = await prisma.product_variants.findMany({
      include: {
        product: {
          select: { name: true }
        }
      }
    });

    console.log(`\n🔀 Product Variants: ${variants.length}\n`);
    variants.forEach((v, index) => {
      console.log(`${index + 1}. ${v.product.name} - ${v.name}`);
      console.log(`   SKU: ${v.sku}`);
      console.log(`   Price: ₹${v.price}`);
      console.log(`   Quantity: ${v.quantity}`);
      console.log('');
    });

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkProducts();
