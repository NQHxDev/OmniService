-- Ensure WAL logical replication is enabled (checked via SHOW wal_level)
DO $$
BEGIN
   IF current_setting('wal_level') <> 'logical' THEN
      RAISE WARNING 'wal_level is not set to logical! Logical replication will fail until restarted with wal_level=logical.';
   END IF;
END $$;

-- Configure publication for Transactional Outbox (Append-Only)
-- Debezium reads Write-Ahead Log (WAL) changes for tables included in this publication.
DO $$
BEGIN
   IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'outbox_events'
   ) THEN
      -- Set REPLICA IDENTITY FULL to guarantee full row context in WAL
      ALTER TABLE outbox_events REPLICA IDENTITY FULL;

      -- Create or alter publication for Debezium CDC
      IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'outbox_pub') THEN
         CREATE PUBLICATION outbox_pub FOR TABLE outbox_events;
         RAISE NOTICE 'Publication "outbox_pub" created for table outbox_events.';
      ELSE
         ALTER PUBLICATION outbox_pub ADD TABLE outbox_events;
         RAISE NOTICE 'Table outbox_events added to existing publication "outbox_pub".';
      END IF;
   END IF;
END $$;
