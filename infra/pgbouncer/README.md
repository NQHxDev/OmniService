# PgBouncer Connection Pooling Infrastructure

## 1. Overview & Two-Tier Architecture

To eliminate **Database Connection Sprawl** when scaling horizontally in Kubernetes, OmniServices employs a **Two-Tier Connection Pooling Architecture**:

1. **Client-Side Tier (Prisma Client + `@prisma/adapter-pg`)**:
   - `connection_limit = 5`: Each microservice Pod keeps at most 5 client connections.
   - `pool_timeout = 10`: Clients wait at most 10 seconds to acquire a connection before fail-fast.
   - `pgbouncer = true`: Query Engine prepared statement caching is disabled to guarantee compatibility with PgBouncer Transaction Mode.
   - Handled dynamically via `PrismaPoolConfigFactory` from `@common`.

2. **Server-Side Tier (PgBouncer Cluster)**:
   - `pool_mode = transaction`: Server connection is released and reused immediately after each transaction ends.
   - `max_client_conn = 1000`: Supports up to 1,000 incoming client connections.
   - `default_pool_size = 20`: Bounded to max 20 connections per database to PostgreSQL backend.
   - `reserve_pool_size = 5`: Spike buffer.
   - `max_db_connections = 50`: Upper ceiling to prevent PostgreSQL connection cliff.

3. **Prisma Migrations & DDL (`DIRECT_URL`)**:
   - Schema migrations, DDL statements, and advisory locks bypass PgBouncer and connect directly to PostgreSQL on dedicated service ports (543x).

---

## 2. Directory Structure

```
infra/pgbouncer/
├── pgbouncer.ini                  # Core PgBouncer configuration and database mapping
├── userlist.txt                   # Authentication user credentials
├── README.md                      # Architecture and operational guide
├── monitoring/
│   └── grafana-pgbouncer-dashboard.json # Grafana Golden Signals dashboard
└── k8s/
    └── pgbouncer-deployment.yaml  # Kubernetes Deployment, Service, and ConfigMap
```

---

## 3. Port & Service Mapping

| Service Name   | Database Name               | Direct Postgres Port (`DIRECT_URL`) | PgBouncer Port (`DATABASE_URL`) |
| :------------- | :-------------------------- | :---------------------------------- | :------------------------------ |
| `auth`         | `omni_service_auth`         | `5433`                              | `6432`                          |
| `user`         | `omni_service_user`         | `5439`                              | `6432`                          |
| `post`         | `omni_service_post`         | `5441`                              | `6432`                          |
| `notification` | `omni_service_notification` | `5436`                              | `6432`                          |
| `media`        | `omni_service_media`        | `5442`                              | `6432`                          |
| `commerce`     | `omni_service_commerce`     | `5443`                              | `6432`                          |
| `supplier`     | `omni_service_supplier`     | `5444`                              | `6432`                          |
| `order`        | `omni_service_order`        | `5445`                              | `6432`                          |
| `payment`      | `omni_service_payment`      | `5446`                              | `6432`                          |

---

## 4. Connection String Standards

### 4.1. Application Runtime (`DATABASE_URL`)

```bash
DATABASE_URL="postgresql://${USER}:${PASSWORD}@localhost:6432/${DB_NAME}?connection_limit=5&pool_timeout=10&pgbouncer=true"
```

### 4.2. Database Migrations (`DIRECT_URL`)

```bash
DIRECT_URL="postgresql://${USER}:${PASSWORD}@localhost:${POSTGRES_PORT}/${DB_NAME}"
```

---

## 5. Observability & Golden Signals

- **Exporter**: Prometheus PgBouncer Exporter runs on port `9127`.
- **Golden Metrics**:
   - `pgbouncer_pools_client_waiting_connections`: Target `0`. Spike indicates connection starvation.
   - `pgbouncer_pools_server_active_connections`: Actively executing database queries.
   - `pg_stat_activity`: PostgreSQL backend processes strictly $\le 30$.
