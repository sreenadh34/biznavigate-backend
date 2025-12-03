import { PrismaClient } from '../generated/prisma/client';
import * as crypto from 'crypto';
import * as readline from 'readline';

const prisma = new PrismaClient();

interface EncryptedAccount {
  account_id: string;
  platform: string;
  username: string | null;
  access_token: string;
}

// Old encryption key (if you know it)
const OLD_ENCRYPTION_KEY = process.env.OLD_ENCRYPTION_KEY;
// New encryption key from .env
const NEW_ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

function decryptToken(encryptedToken: string, encryptionKey: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');
    const parts = encryptedToken.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    throw new Error(`Failed to decrypt: ${error.message}`);
  }
}

function encryptToken(token: string, encryptionKey: string): string {
  try {
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(encryptionKey, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    throw new Error(`Failed to encrypt: ${error.message}`);
  }
}

async function askQuestion(query: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('🔐 WhatsApp Token Migration Script\n');

  if (!NEW_ENCRYPTION_KEY) {
    console.error('❌ ENCRYPTION_KEY not found in environment variables!');
    process.exit(1);
  }

  // Find all WhatsApp accounts
  const accounts = await prisma.social_accounts.findMany({
    where: {
      platform: 'whatsapp',
    },
    select: {
      account_id: true,
      platform: true,
      username: true,
      access_token: true,
      is_active: true,
    },
  });

  if (accounts.length === 0) {
    console.log('✅ No WhatsApp accounts found in database.');
    return;
  }

  console.log(`Found ${accounts.length} WhatsApp account(s):\n`);
  accounts.forEach((acc, idx) => {
    console.log(`${idx + 1}. Account ID: ${acc.account_id}`);
    console.log(`   Username: ${acc.username || 'N/A'}`);
    console.log(`   Active: ${acc.is_active ? 'Yes' : 'No'}`);
    console.log(`   Token Length: ${acc.access_token?.length || 0}\n`);
  });

  console.log('\nChoose an option:');
  console.log('1. Clear all tokens (recommended - requires reconnecting accounts)');
  console.log('2. Re-encrypt tokens (requires OLD_ENCRYPTION_KEY)');
  console.log('3. Cancel');

  const choice = await askQuestion('\nEnter your choice (1-3): ');

  switch (choice.trim()) {
    case '1':
      // Clear all tokens
      console.log('\n⚠️  This will clear all encrypted tokens. You will need to reconnect your WhatsApp accounts.');
      const confirm = await askQuestion('Are you sure? (yes/no): ');

      if (confirm.toLowerCase() === 'yes') {
        await prisma.social_accounts.updateMany({
          where: {
            platform: 'whatsapp',
          },
          data: {
            access_token: '',
            is_active: false,
          },
        });
        console.log('✅ Tokens cleared. Please reconnect your WhatsApp accounts.');
      } else {
        console.log('❌ Operation cancelled.');
      }
      break;

    case '2':
      // Re-encrypt tokens
      if (!OLD_ENCRYPTION_KEY) {
        console.error('\n❌ OLD_ENCRYPTION_KEY not found in environment variables!');
        console.log('Set it with: export OLD_ENCRYPTION_KEY=your_old_key');
        process.exit(1);
      }

      console.log('\n🔄 Re-encrypting tokens...');
      let successCount = 0;
      let failCount = 0;

      for (const account of accounts) {
        try {
          // Decrypt with old key
          const decryptedToken = decryptToken(account.access_token, OLD_ENCRYPTION_KEY);
          // Re-encrypt with new key
          const reEncryptedToken = encryptToken(decryptedToken, NEW_ENCRYPTION_KEY);

          // Update in database
          await prisma.social_accounts.update({
            where: { account_id: account.account_id },
            data: { access_token: reEncryptedToken },
          });

          console.log(`✅ Re-encrypted token for account ${account.account_id}`);
          successCount++;
        } catch (error) {
          console.error(`❌ Failed to re-encrypt account ${account.account_id}: ${error.message}`);
          failCount++;
        }
      }

      console.log(`\n✅ Success: ${successCount}, ❌ Failed: ${failCount}`);
      if (failCount > 0) {
        console.log('⚠️  Failed accounts need to be reconnected manually.');
      }
      break;

    case '3':
      console.log('❌ Operation cancelled.');
      break;

    default:
      console.log('❌ Invalid choice.');
  }

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
