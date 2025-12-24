-- Cleanup Script for Duplicate WhatsApp Messages
-- This script removes duplicate messages, keeping only the first occurrence

-- Step 1: Identify and delete duplicate messages (keep the oldest one)
WITH duplicates AS (
  SELECT
    message_id,
    platform_message_id,
    ROW_NUMBER() OVER (
      PARTITION BY platform_message_id
      ORDER BY created_at ASC
    ) as row_num
  FROM lead_messages
  WHERE platform_message_id IS NOT NULL
)
DELETE FROM lead_messages
WHERE message_id IN (
  SELECT message_id
  FROM duplicates
  WHERE row_num > 1
);

-- Step 2: Show statistics
SELECT
  'Total messages with platform_message_id' as description,
  COUNT(*) as count
FROM lead_messages
WHERE platform_message_id IS NOT NULL

UNION ALL

SELECT
  'Duplicate messages remaining' as description,
  COUNT(*) as count
FROM (
  SELECT
    platform_message_id,
    COUNT(*) as count
  FROM lead_messages
  WHERE platform_message_id IS NOT NULL
  GROUP BY platform_message_id
  HAVING COUNT(*) > 1
) as still_duplicates;
