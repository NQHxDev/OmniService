# Supplier Service (`apps/supplier`)

The Supplier Service manages merchant onboarding, supplier contracts, catalog syndication, and fulfillment vendor inventories.

---

## Architecture & Responsibilities

- **Supplier Onboarding**: Handles business profiles, merchant verification, agreements, and vendor accounts.
- **Inventory & Supply Management**: Manages supplier product feeds, wholesale pricing tiers, and warehouse distribution points.
- **Enterprise Patterns**: Implements CQRS (Command/Query separation) and Unit of Work for transactional inventory consistency.
- **Protocol**: Serves synchronous calls via **gRPC** and coordinates vendor operations over **RabbitMQ**.

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC| Supplier["Supplier Service<br/>(CQRS / Unit of Work)"]

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Supplier)")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Supplier --- DB
    Supplier -.->|Supplier & Supply Events| RabbitMQ

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Supplier serviceClass;
    class RabbitMQ brokerClass;
    class DB dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated instance for `supplier`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)

---

## Local Development

Start the Supplier Service in development watch mode:

```bash
# From workspace root
make start-supplier
# or
pnpm --filter @omni/supplier run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/supplier run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
