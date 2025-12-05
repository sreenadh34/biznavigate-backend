import { PrismaClient } from '../generated/prisma';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding reviews data...');

  const businessId = 'dd8ae5a1-cab4-4041-849d-e108d74490d3';

  // Get business tenant
  const business = await prisma.businesses.findUnique({
    where: { business_id: businessId },
  });

  if (!business) {
    console.error('❌ Business not found');
    return;
  }

  // Get customers
  const customers = await prisma.customers.findMany({
    where: { business_id: businessId },
    take: 5,
  });

  if (customers.length === 0) {
    console.error('❌ No customers found');
    return;
  }

  // Get products
  const products = await prisma.products.findMany({
    where: { business_id: businessId },
    take: 5,
  });

  if (products.length === 0) {
    console.error('❌ No products found');
    return;
  }

  // Get completed orders
  const orders = await prisma.orders.findMany({
    where: {
      business_id: businessId,
      status: 'completed',
    },
    take: 10,
  });

  // Review data with photos
  const reviewsData = [
    {
      rating: 5,
      title: 'Excellent Product!',
      comment: 'This product exceeded my expectations. Great quality and fast delivery!',
      photo_urls: [
        'https://images.unsplash.com/photo-1523275335684-37898b6baf30',
        'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f',
      ],
    },
    {
      rating: 4,
      title: 'Very Good',
      comment: 'Good product overall. Packaging could be better but the product itself is great.',
      photo_urls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e'],
    },
    {
      rating: 5,
      title: 'Perfect!',
      comment: 'Absolutely love it! Will definitely buy again.',
      photo_urls: [
        'https://images.unsplash.com/photo-1542291026-7eec264c27ff',
        'https://images.unsplash.com/photo-1525966222134-fcfa99b8ae77',
        'https://images.unsplash.com/photo-1560343090-f0409e92791a',
      ],
    },
    {
      rating: 3,
      title: 'Average',
      comment: 'It\'s okay. Does the job but nothing special.',
      photo_urls: null,
    },
    {
      rating: 5,
      title: 'Amazing Quality',
      comment: 'Best purchase I\'ve made this year! Highly recommend to everyone.',
      photo_urls: ['https://images.unsplash.com/photo-1572635196237-14b3f281503f'],
    },
    {
      rating: 4,
      title: 'Good Value for Money',
      comment: 'Worth the price. Quality is good and delivery was quick.',
      photo_urls: ['https://images.unsplash.com/photo-1491553895911-0055eca6402d'],
    },
    {
      rating: 2,
      title: 'Disappointed',
      comment: 'Expected better quality for the price. Product looks different from photos.',
      photo_urls: null,
    },
    {
      rating: 5,
      title: 'Love It!',
      comment: 'Exactly what I was looking for. Perfect fit and excellent material.',
      photo_urls: [
        'https://images.unsplash.com/photo-1549298916-b41d501d3772',
        'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c',
      ],
    },
    {
      rating: 4,
      title: 'Recommended',
      comment: 'Good product. Slight delay in delivery but customer service was helpful.',
      photo_urls: null,
    },
    {
      rating: 5,
      title: 'Superb!',
      comment: 'Outstanding quality and finish. Photos don\'t do it justice!',
      photo_urls: ['https://images.unsplash.com/photo-1547949003-9792a18a2601'],
    },
  ];

  console.log('Creating reviews...');

  for (let i = 0; i < reviewsData.length; i++) {
    const review = reviewsData[i];
    const customer = customers[i % customers.length];
    const product = products[i % products.length];
    const order = orders[i % orders.length] || null;

    try {
      await prisma.product_reviews.create({
        data: {
          business_id: businessId,
          tenant_id: business.tenant_id,
          product_id: product.product_id,
          customer_id: customer.customer_id,
          order_id: order?.order_id,
          rating: review.rating,
          title: review.title,
          comment: review.comment,
          photo_urls: review.photo_urls,
          is_verified: order ? true : false,
          is_published: true,
          is_featured: review.rating === 5 && review.photo_urls && review.photo_urls.length > 0,
          created_at: new Date(Date.now() - (i * 24 * 60 * 60 * 1000)), // Spread over last 10 days
        },
      });

      console.log(`✅ Created ${review.rating}-star review: ${review.title}`);
    } catch (error) {
      console.error(`❌ Failed to create review: ${error.message}`);
    }
  }

  console.log('✅ Reviews seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
