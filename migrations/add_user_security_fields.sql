-- Migration: Add security fields to users table
-- Run this SQL on your database when accessible

-- Add is_active field (CRITICAL for authentication)
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Add email verification fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMPTZ;

-- Add password reset fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMPTZ;

-- Add two-factor authentication fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_factor_secret VARCHAR(255);

-- Add security audit fields
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_password_change TIMESTAMPTZ;

-- Update existing users to have default values
UPDATE users SET
    is_active = COALESCE(is_active, true),
    email_verified = COALESCE(email_verified, false),
    failed_login_attempts = COALESCE(failed_login_attempts, 0),
    two_factor_enabled = COALESCE(two_factor_enabled, false)
WHERE is_active IS NULL OR email_verified IS NULL OR failed_login_attempts IS NULL OR two_factor_enabled IS NULL;
