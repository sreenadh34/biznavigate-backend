-- Fix is_active field for all existing users
-- This ensures all users are marked as active

UPDATE users
SET is_active = true
WHERE is_active IS NULL OR is_active = false;

-- Verify the update
SELECT user_id, email, is_active, profile_completed
FROM users
LIMIT 10;
