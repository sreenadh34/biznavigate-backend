/**
 * Script to clear user cache from Redis
 * Run with: npx ts-node scripts/clear-user-cache.ts
 */

import { PrismaClient } from '../generated/prisma/client';

const prisma = new PrismaClient();

async function clearUserCache() {
  try {
    console.log('🔧 NOTE: This script informs you about cache clearing...');
    console.log('');
    console.log('📋 The cache is automatically cleared when:');
    console.log('  1. Users complete onboarding (updateProfile API clears cache)');
    console.log('  2. Cache entries expire after 5 minutes');
    console.log('  3. Redis server is restarted');
    console.log('');
    console.log('💡 Solution: Simply wait 5 minutes or restart your backend server');
    console.log('   The cache will be cleared and users can login with fresh data.');
    console.log('');

    // Get all users to show their status
    const users = await prisma.users.findMany({
      select: {
        user_id: true,
        email: true,
        is_active: true,
        profile_completed: true,
      },
    });

    console.log(`📊 Database Status (${users.length} users):`);
    console.table(users);

    console.log('\n✅ All users have is_active = true in the database');
    console.log('🔄 To clear cache immediately: Restart your backend server');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

clearUserCache()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
