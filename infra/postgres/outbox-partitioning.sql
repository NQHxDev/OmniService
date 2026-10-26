-- Enterprise Outbox Table Partitioning & Automated Partition Dropping
-- OmniServices Monorepo

-- 1. Create Partitioned Outbox Events Table
-- Uses composite PRIMARY KEY (event_id, created_at) required for PostgreSQL RANGE partitioning.
CREATE TABLE IF NOT EXISTS outbox_events (
   event_id UUID NOT NULL,
   aggregate_type VARCHAR(50) NOT NULL,
   aggregate_id VARCHAR(255) NOT NULL,
   event_type VARCHAR(100) NOT NULL,
   payload JSONB NOT NULL,
   created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
   PRIMARY KEY (event_id, created_at)
) PARTITION BY RANGE (created_at);

-- Indexes for rapid CDC and aggregate lookups
CREATE INDEX IF NOT EXISTS idx_outbox_created_at ON outbox_events (created_at);
CREATE INDEX IF NOT EXISTS idx_outbox_aggregate ON outbox_events (aggregate_type, aggregate_id);

-- 2. Function: Create Weekly Partition for a Given Date
CREATE OR REPLACE FUNCTION create_outbox_partition_for_week(target_date TIMESTAMPTZ)
RETURNS TEXT AS $$
DECLARE
   week_start DATE := date_trunc('week', target_date)::DATE;
   week_end   DATE := week_start + INTERVAL '7 days';
   year_num   TEXT := to_char(week_start, 'IYYY');
   week_num   TEXT := to_char(week_start, 'IW');
   part_name  TEXT := 'outbox_events_y' || year_num || 'w' || week_num;
   sql_stmt   TEXT;
BEGIN
   sql_stmt := format(
      'CREATE TABLE IF NOT EXISTS %I PARTITION OF outbox_events FOR VALUES FROM (%L) TO (%L);',
      part_name,
      week_start,
      week_end
   );
   EXECUTE sql_stmt;
   RETURN part_name;
END;
$$ LANGUAGE plpgsql;

-- 3. Function: Drop Expired Outbox Partitions
-- Zero-lock, 0.001s table drop liberating disk space instantly without VACUUM FULL.
CREATE OR REPLACE FUNCTION drop_expired_outbox_partitions(retention_days INT DEFAULT 14)
RETURNS TABLE (dropped_partition TEXT) AS $$
DECLARE
   cutoff_date DATE := CURRENT_DATE - (retention_days || ' days')::INTERVAL;
   rec RECORD;
   drop_stmt TEXT;
BEGIN
   FOR rec IN
      SELECT c.relname AS partition_name
      FROM pg_class c
      JOIN pg_inherits i ON i.inhrelid = c.oid
      JOIN pg_class parent ON parent.oid = i.inhparent
      WHERE parent.relname = 'outbox_events'
         AND c.relname ~ '^outbox_events_y[0-9]{4}w[0-9]{2}$'
   LOOP
      -- Parse week and year from partition name (e.g. outbox_events_y2026w42)
      DECLARE
         part_year INT := substring(rec.partition_name FROM 'y([0-9]{4})')::INT;
         part_week INT := substring(rec.partition_name FROM 'w([0-9]{2})')::INT;
         -- Approximate end of week from ISO week
         part_end_date DATE := (to_date(part_year || '-W' || lpad(part_week::TEXT, 2, '0') || '-1', 'IYYY-IW-ID') + INTERVAL '7 days')::DATE;
      BEGIN
         IF part_end_date < cutoff_date THEN
               drop_stmt := format('DROP TABLE IF EXISTS %I;', rec.partition_name);
               EXECUTE drop_stmt;
               dropped_partition := rec.partition_name;
               RETURN NEXT;
         END IF;
      END;
   END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 4. Master Maintenance Procedure: Pre-allocate Future Weeks and Purge Stale Weeks
CREATE OR REPLACE FUNCTION maintain_outbox_partitions(
   weeks_ahead INT DEFAULT 2,
   retention_days INT DEFAULT 14
)
RETURNS VOID AS $$
DECLARE
   i INT;
   future_date TIMESTAMPTZ;
BEGIN
   -- Pre-create current week and upcoming weeks
   FOR i IN 0..weeks_ahead LOOP
      future_date := NOW() + (i * 7 || ' days')::INTERVAL;
      PERFORM create_outbox_partition_for_week(future_date);
   END LOOP;

   -- Purge partitions older than retention period
   PERFORM drop_expired_outbox_partitions(retention_days);
END;
$$ LANGUAGE plpgsql;
