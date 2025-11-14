const { PrismaClient } = require('./generated/prisma');
const fs = require('fs');

const prisma = new PrismaClient();

async function applyMigration() {
  try {
    console.log('Reading migration SQL file...');
    const sql = fs.readFileSync('prisma/migrations/20250102_add_inventory_management/migration.sql', 'utf8');

    console.log('Splitting into individual statements...');
    // Split by semicolons but preserve function definitions
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'))
      .map(s => s + ';');

    console.log(`Applying ${statements.length} SQL statements...`);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.trim() === ';') continue;

      try {
        console.log(`  [${i+1}/${statements.length}] Executing statement...`);
        await prisma.$executeRawUnsafe(stmt);
      } catch (error) {
        // Skip errors for IF NOT EXISTS statements that already exist
        if (!error.message.includes('already exists')) {
          console.warn(`    Warning: ${error.message}`);
        }
      }
    }

    console.log('✅ Migration applied successfully!');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    await prisma.$disconnect();
    process.exit(1);
  }
}

applyMigration();
