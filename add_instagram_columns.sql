-- Add Instagram-specific columns to social_accounts table if they don't exist

-- Add username column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'username'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN username VARCHAR(255);
  END IF;
END $$;

-- Add profile_picture column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'profile_picture'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN profile_picture VARCHAR(500);
  END IF;
END $$;

-- Add follower_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'follower_count'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN follower_count INTEGER;
  END IF;
END $$;

-- Add following_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'following_count'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN following_count INTEGER;
  END IF;
END $$;

-- Add media_count column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'media_count'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN media_count INTEGER;
  END IF;
END $$;

-- Add instagram_business_account_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'instagram_business_account_id'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN instagram_business_account_id VARCHAR(255);
  END IF;
END $$;

-- Add facebook_page_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'facebook_page_id'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN facebook_page_id VARCHAR(255);
  END IF;
END $$;

-- Add account_type column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN account_type VARCHAR(50);
  END IF;
END $$;

-- Add biography column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'biography'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN biography TEXT;
  END IF;
END $$;

-- Add website column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'website'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN website VARCHAR(500);
  END IF;
END $$;

-- Add last_synced_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN last_synced_at TIMESTAMPTZ(6);
  END IF;
END $$;

-- Add updated_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'social_accounts' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE social_accounts ADD COLUMN updated_at TIMESTAMPTZ(6) DEFAULT NOW();
  END IF;
END $$;

SELECT 'Instagram columns added successfully' AS result;
