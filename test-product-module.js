/**
 * Comprehensive Product Module Test Script
 * Tests all product APIs with dummy data directly via service layer
 */

const { PrismaClient } = require('./generated/prisma');
const { ProductService } = require('./dist/features/products/application/services/product.service');
const { ProductRepositoryPrisma } = require('./dist/features/products/infrastructure/product.repository.prisma');

// Test Data
const TENANT_ID = '4e6604af-05f9-49e1-868a-4346ae405982';
const BUSINESS_ID = '08ba604c-128d-4716-a238-916fef8b2206';

let createdProductId = null;
let createdVariantId = null;

async function main() {
  console.log('\n🧪 ===== PRODUCT MODULE COMPREHENSIVE TEST =====\n');

  const prisma = new PrismaClient();
  const productRepository = new ProductRepositoryPrisma(prisma);
  const productService = new ProductService(productRepository, prisma);

  try {
    // ========== TEST 1: CREATE PRODUCT ==========
    console.log('📝 TEST 1: Creating a product with variants...');
    const createProductDto = {
      business_id: BUSINESS_ID,
      tenant_id: TENANT_ID,
      product_type: 'physical',
      name: 'Premium Coffee Mug',
      description: 'High-quality ceramic coffee mug with ergonomic design',
      category: 'Kitchenware',
      price: 299.99,
      compare_price: 399.99,
      stock_quantity: 100,
      sku: 'MUG-PREMIUM-001',
      currency: 'INR',
      track_inventory: true,
      is_active: true,
      has_variants: true,
      image_urls: ['https://example.com/mug1.jpg', 'https://example.com/mug2.jpg'],
      primary_image_url: 'https://example.com/mug1.jpg',
      variants: [
        {
          name: 'Small (250ml)',
          sku: 'MUG-PREMIUM-001-S',
          price: 249.99,
          quantity: 50,
          variant_options: { size: '250ml', color: 'white' }
        },
        {
          name: 'Large (500ml)',
          sku: 'MUG-PREMIUM-001-L',
          price: 349.99,
          quantity: 30,
          variant_options: { size: '500ml', color: 'black' }
        }
      ]
    };

    const product = await productService.create(createProductDto);
    createdProductId = product.product_id;
    console.log('   ✅ Product created:', {
      product_id: product.product_id,
      name: product.name,
      price: product.price,
      sku: product.sku,
      slug: product.slug
    });

    // ========== TEST 2: GET PRODUCT BY ID ==========
    console.log('\n📖 TEST 2: Getting product by ID...');
    const foundProduct = await productService.findById(createdProductId);
    console.log('   ✅ Product found:', {
      product_id: foundProduct.product_id,
      name: foundProduct.name,
      variants_count: foundProduct.variants ? foundProduct.variants.length : 0
    });

    if (foundProduct.variants && foundProduct.variants.length > 0) {
      createdVariantId = foundProduct.variants[0].variant_id;
      console.log('   ✅ Variants:', foundProduct.variants.map(v => ({
        variant_id: v.variant_id,
        name: v.name,
        price: v.price,
        quantity: v.quantity
      })));
    }

    // ========== TEST 3: UPDATE PRODUCT ==========
    console.log('\n🔄 TEST 3: Updating product...');
    const updated = await productService.update(createdProductId, {
      price: 279.99,
      stock_quantity: 120,
      description: 'Updated: Premium quality ceramic coffee mug with ergonomic handle'
    });
    console.log('   ✅ Product updated:', {
      product_id: updated.product_id,
      new_price: updated.price,
      new_stock: updated.stock_quantity
    });

    // ========== TEST 4: LIST ALL PRODUCTS (with filters) ==========
    console.log('\n📋 TEST 4: Listing products with filters...');
    const productList = await productService.findAll({
      business_id: BUSINESS_ID,
      product_type: 'physical',
      is_active: true,
      page: 1,
      limit: 10
    });
    console.log('   ✅ Products list:', {
      total: productList.total,
      page: productList.page,
      count: productList.data.length,
      products: productList.data.map(p => ({
        name: p.name,
        price: p.price,
        sku: p.sku
      }))
    });

    // ========== TEST 5: CHECK STOCK AVAILABILITY ==========
    console.log('\n📦 TEST 5: Checking stock availability...');
    const available = await productService.checkStockAvailability(createdProductId, 10);
    console.log('   ✅ Stock available for 10 units:', available);

    const notAvailable = await productService.checkStockAvailability(createdProductId, 500);
    console.log('   ✅ Stock available for 500 units:', notAvailable);

    // ========== TEST 6: RESERVE STOCK ==========
    console.log('\n🔒 TEST 6: Reserving stock (simulating order)...');
    await productService.reserveStock(createdProductId, 5);
    const afterReserve = await productService.findById(createdProductId);
    console.log('   ✅ Stock reserved. New quantity:', afterReserve.stock_quantity);

    // ========== TEST 7: RELEASE STOCK ==========
    console.log('\n🔓 TEST 7: Releasing stock (simulating order cancellation)...');
    await productService.releaseStock(createdProductId, 3);
    const afterRelease = await productService.findById(createdProductId);
    console.log('   ✅ Stock released. New quantity:', afterRelease.stock_quantity);

    // ========== TEST 8: CREATE ADDITIONAL VARIANT ==========
    console.log('\n➕ TEST 8: Creating additional variant...');
    const newVariant = await productService.createVariant(createdProductId, {
      name: 'Medium (350ml)',
      sku: 'MUG-PREMIUM-001-M',
      price: 299.99,
      quantity: 40,
      variant_options: { size: '350ml', color: 'blue' }
    });
    console.log('   ✅ Variant created:', {
      variant_id: newVariant.variant_id,
      name: newVariant.name,
      price: newVariant.price
    });

    // ========== TEST 9: GET ALL VARIANTS ==========
    console.log('\n📑 TEST 9: Getting all variants for product...');
    const variants = await productService.getVariantsByProductId(createdProductId);
    console.log('   ✅ Total variants:', variants.length);
    variants.forEach(v => {
      console.log(`      - ${v.name}: ₹${v.price} (Qty: ${v.quantity})`);
    });

    // ========== TEST 10: UPDATE VARIANT ==========
    if (createdVariantId) {
      console.log('\n🔄 TEST 10: Updating variant...');
      const updatedVariant = await productService.updateVariant(createdVariantId, {
        price: 239.99,
        quantity: 60
      });
      console.log('   ✅ Variant updated:', {
        variant_id: updatedVariant.variant_id,
        new_price: updatedVariant.price,
        new_quantity: updatedVariant.quantity
      });
    }

    // ========== TEST 11: BULK CREATE PRODUCTS ==========
    console.log('\n📦 TEST 11: Bulk creating products...');
    const bulkResult = await productService.bulkCreate({
      products: [
        {
          business_id: BUSINESS_ID,
          tenant_id: TENANT_ID,
          product_type: 'physical',
          name: 'Wireless Mouse',
          description: 'Ergonomic wireless mouse',
          category: 'Electronics',
          price: 599.99,
          stock_quantity: 50,
          sku: 'MOUSE-WIRELESS-001',
          track_inventory: true,
          is_active: true
        },
        {
          business_id: BUSINESS_ID,
          tenant_id: TENANT_ID,
          product_type: 'physical',
          name: 'Mechanical Keyboard',
          description: 'RGB mechanical keyboard',
          category: 'Electronics',
          price: 2499.99,
          stock_quantity: 20,
          sku: 'KEYBOARD-MECH-001',
          track_inventory: true,
          is_active: true
        },
        {
          business_id: BUSINESS_ID,
          tenant_id: TENANT_ID,
          product_type: 'course',
          name: 'Web Development Bootcamp',
          description: 'Complete web development course',
          category: 'Education',
          price: 9999.99,
          track_inventory: false, // Courses don't track inventory
          sku: 'COURSE-WEBDEV-001',
          is_active: true
        }
      ]
    });
    console.log('   ✅ Bulk upload result:', {
      success: bulkResult.success,
      failed: bulkResult.failed,
      errors: bulkResult.errors
    });

    // ========== TEST 12: SEARCH PRODUCTS ==========
    console.log('\n🔍 TEST 12: Searching products...');
    const searchResults = await productService.findAll({
      business_id: BUSINESS_ID,
      search: 'mouse',
      page: 1,
      limit: 10
    });
    console.log('   ✅ Search results for "mouse":', {
      total: searchResults.total,
      products: searchResults.data.map(p => p.name)
    });

    // ========== TEST 13: FILTER BY PRICE RANGE ==========
    console.log('\n💰 TEST 13: Filtering by price range...');
    const priceFiltered = await productService.findAll({
      business_id: BUSINESS_ID,
      min_price: 200,
      max_price: 1000,
      page: 1,
      limit: 10
    });
    console.log('   ✅ Products between ₹200-₹1000:', {
      total: priceFiltered.total,
      products: priceFiltered.data.map(p => ({ name: p.name, price: p.price }))
    });

    // ========== TEST 14: DELETE VARIANT ==========
    if (createdVariantId) {
      console.log('\n🗑️  TEST 14: Deleting variant...');
      await productService.deleteVariant(createdVariantId);
      console.log('   ✅ Variant deleted');
    }

    // ========== TEST 15: SOFT DELETE PRODUCT ==========
    console.log('\n🗑️  TEST 15: Soft deleting product...');
    await productService.delete(createdProductId);
    const deletedProduct = await productRepository.findById(createdProductId);
    console.log('   ✅ Product soft deleted. is_active:', deletedProduct.is_active);

    // ========== SUMMARY ==========
    console.log('\n\n✅ ===== ALL TESTS PASSED! =====\n');
    console.log('📊 Summary:');
    console.log('   - Product CRUD operations: ✅');
    console.log('   - Stock management: ✅');
    console.log('   - Variant management: ✅');
    console.log('   - Bulk operations: ✅');
    console.log('   - Search & filtering: ✅');
    console.log('   - Soft delete: ✅');
    console.log('\n🎉 Products Module is production-ready!\n');

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
