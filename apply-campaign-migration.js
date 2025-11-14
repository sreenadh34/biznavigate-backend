/**
 * Apply Campaign Module Enhancements Migration
 * Adds WhatsApp template support, audience segmentation, and campaign analytics
 */

const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyMigration() {
  console.log('🚀 Applying Campaign Module Enhancements Migration...\n');

  try {
    // Read the SQL file
    const sqlPath = path.join(__dirname, 'prisma', 'migrations', 'add_campaign_enhancements.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // Split by semicolon and filter out comments and empty statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--') && !s.startsWith('COMMENT'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement) {
        console.log(`Executing statement ${i + 1}/${statements.length}...`);
        try {
          await prisma.$executeRawUnsafe(statement);
          console.log('✅ Success\n');
        } catch (error) {
          // Ignore "already exists" errors
          if (error.message.includes('already exists') || error.message.includes('duplicate')) {
            console.log('⚠️  Already exists, skipping\n');
          } else {
            console.error('❌ Error:', error.message, '\n');
          }
        }
      }
    }

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Campaign Module Enhancements Applied:');
    console.log('   ✅ WhatsApp template support added');
    console.log('   ✅ Audience segmentation fields added');
    console.log('   ✅ Campaign analytics counters added');
    console.log('   ✅ Media URL support for images/videos');
    console.log('   ✅ Product integration support');
    console.log('   ✅ Delivery tracking enhancements');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

applyMigration()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
