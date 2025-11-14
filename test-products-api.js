const { PrismaClient } = require('./generated/prisma');

async function main() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL
      }
    }
  });

  try {
    // Get a tenant
    const tenant = await prisma.tenants.findFirst({
      select: { tenant_id: true, tenant_name: true }
    });

    if (!tenant) {
      console.log('❌ No tenants found in database');
      process.exit(1);
    }

    console.log('✅ Found tenant:', tenant);

    // Get a business for this tenant
    const business = await prisma.businesses.findFirst({
      where: { tenant_id: tenant.tenant_id },
      select: { business_id: true, business_name: true, tenant_id: true }
    });

    if (!business) {
      console.log('❌ No businesses found for this tenant');
      process.exit(1);
    }

    console.log('✅ Found business:', business);
    console.log('\n📋 Use these IDs for testing:');
    console.log('   tenant_id:', business.tenant_id);
    console.log('   business_id:', business.business_id);

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
