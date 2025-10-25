const { PrismaClient } = require('./generated/prisma');

async function main() {
  const prisma = new PrismaClient();

  try {
    const business = await prisma.businesses.findFirst();
    const role = await prisma.roles.findFirst();

    console.log(JSON.stringify({
      business_id: business?.business_id || null,
      tenant_id: business?.tenant_id || null,
      role_id: role?.role_id || null
    }));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
