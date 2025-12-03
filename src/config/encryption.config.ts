import { registerAs } from '@nestjs/config';
import * as crypto from 'crypto';

export default registerAs('encryption', () => {
  // Get encryption key from environment or generate a temporary one for development
  let encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    // Generate a random key for development (NOT for production!)
    console.warn('⚠️  ENCRYPTION_KEY not set in environment variables. Generating temporary key for development.');
    console.warn('⚠️  DO NOT USE IN PRODUCTION! Add ENCRYPTION_KEY to your .env file.');
    encryptionKey = crypto.randomBytes(32).toString('hex');
  }

  // Validate the key is proper hex and correct length
  if (!/^[0-9a-fA-F]{64}$/.test(encryptionKey)) {
    throw new Error(
      'ENCRYPTION_KEY must be a 64-character hexadecimal string (32 bytes). ' +
      'Generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  return {
    key: encryptionKey,
    algorithm: 'aes-256-cbc',
  };
});
