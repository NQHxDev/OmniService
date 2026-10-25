# Commerce Service (`apps/commerce`)

The Commerce Service is responsible for core business logic relating to products, pricing, inventories, shopping carts, orders, and payment checkout flows.

---

## Architecture & Responsibilities

- **Product & Catalog**: Manages categories, variants, pricing, and stock levels.
- **Order Processing**: Orchestrates multi-step order placement, status transitions, and inventory reservation.
- **Enterprise Patterns**: Implements CQRS (Command/Query separation), Unit of Work for transactional checkout safety, and publishes domain events upon state changes.
- **Protocol**: Serves synchronous requests via **gRPC** and coordinates event-driven interactions via **RabbitMQ**.

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC| Commerce["Commerce Service<br/>(CQRS / Unit of Work)"]

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Commerce)")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Commerce --- DB
    Commerce -.->|Order & Inventory Events| RabbitMQ

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Commerce serviceClass;
    class RabbitMQ brokerClass;
    class DB dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated instance for `commerce`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)

---

## Local Development

Start the Commerce Service in development watch mode:

```bash
# From workspace root
make start-commerce
# or
pnpm --filter @omni/commerce run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/commerce run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
