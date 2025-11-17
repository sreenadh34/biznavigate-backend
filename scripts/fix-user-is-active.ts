/**
 * Script to fix is_active field for all existing users
 * Run with: npx ts-node scripts/fix-user-is-active.ts
 */

import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function fixUserIsActive() {
  try {
    console.log('🔧 Fixing is_active field for all users...');

    // Update all users where is_active is null or false
    const result = await prisma.users.updateMany({
      where: {
        OR: [
          { is_active: null },
          { is_active: false },
        ],
      },
      data: {
        is_active: true,
      },
    });

    console.log(`✅ Updated ${result.count} users to is_active = true`);

    // Verify and display users
    const users = await prisma.users.findMany({
      select: {
        user_id: true,
        email: true,
        is_active: true,
        profile_completed: true,
      },
      take: 10,
    });

    console.log('\n📊 Sample of users (first 10):');
    console.table(users);

    console.log('\n✅ Fix completed successfully!');
  } catch (error) {
    console.error('❌ Error fixing users:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixUserIsActive()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
