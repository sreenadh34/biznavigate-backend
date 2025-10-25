-- Add profile_completed column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false;

-- Set existing users to profile_completed = false
UPDATE users SET profile_completed = false WHERE profile_completed IS NULL;
