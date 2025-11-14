/**
 * Apply Campaign Module Enhancements Migration - V2
 * Executes ALTER TABLE as single statement properly
 */

const { PrismaClient } = require('./generated/prisma');
const prisma = new PrismaClient();

async function applyMigration() {
  console.log('🚀 Applying Campaign Module Enhancements Migration V2...\\n');

  try {
    // First ALTER TABLE - Add columns to campaigns table
    console.log('1. Adding new columns to campaigns table...');
    await prisma.$executeRaw`
      ALTER TABLE campaigns
      ADD COLUMN IF NOT EXISTS template_id UUID REFERENCES notification_templates(template_id),
      ADD COLUMN IF NOT EXISTS whatsapp_template_name VARCHAR(100),
      ADD COLUMN IF NOT EXISTS whatsapp_template_language VARCHAR(10) DEFAULT 'en',
      ADD COLUMN IF NOT EXISTS template_parameters JSONB DEFAULT '[]',
      ADD COLUMN IF NOT EXISTS media_url VARCHAR(1000),
      ADD COLUMN IF NOT EXISTS media_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES products(product_id),
      ADD COLUMN IF NOT EXISTS audience_type VARCHAR(50) DEFAULT 'all',
      ADD COLUMN IF NOT EXISTS audience_filter JSONB DEFAULT '{}',
      ADD COLUMN IF NOT EXISTS total_recipients INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS sent_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS delivered_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS failed_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS clicked_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS converted_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `;
    console.log('✅ Campaigns table columns added\\n');

    // Create indexes
    console.log('2. Creating indexes on campaigns table...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_campaigns_template_id ON campaigns(template_id)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_campaigns_product_id ON campaigns(product_id)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_campaigns_audience_type ON campaigns(audience_type)`;
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_campaigns_created_at ON campaigns(created_at DESC)`;
    console.log('✅ Indexes created\\n');

    // Second ALTER TABLE - Add columns to campaign_recipients table
    console.log('3. Adding new columns to campaign_recipients table...');
    await prisma.$executeRaw`
      ALTER TABLE campaign_recipients
      ADD COLUMN IF NOT EXISTS error_message TEXT,
      ADD COLUMN IF NOT EXISTS whatsapp_message_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()
    `;
    console.log('✅ Campaign recipients table columns added\\n');

    // Create index for campaign_recipients
    console.log('4. Creating index on campaign_recipients table...');
    await prisma.$executeRaw`CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status_sent ON campaign_recipients(status, sent_at DESC)`;
    console.log('✅ Index created\\n');

    console.log('✅ Migration completed successfully!\\n');
    console.log('📊 Campaign Module Enhancements Applied:');
    console.log('   ✅ WhatsApp template support added');
    console.log('   ✅ Audience segmentation fields added');
    console.log('   ✅ Campaign analytics counters added');
    console.log('   ✅ Media URL support for images/videos');
    console.log('   ✅ Product integration support');
    console.log('   ✅ Delivery tracking enhancements');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
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
