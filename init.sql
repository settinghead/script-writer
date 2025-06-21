-- Enable logical replication for Electric SQL
ALTER SYSTEM SET wal_level = logical;
ALTER SYSTEM SET max_replication_slots = 10;
ALTER SYSTEM SET max_wal_senders = 10;

-- Restart is required for these settings to take effect
-- Docker will handle the restart automatically