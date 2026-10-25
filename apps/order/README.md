# Order Service (`apps/order`)

The Order Service manages the complete lifecycle of customer orders in OmniServices, decoupling order processing from shopping carts and catalog browsing.

---

## Architecture & Responsibilities

- **Order Lifecycle Management**: Handles order placement, status state machine transitions (`AWAITING_PAYMENT`, `CONFIRMED`, `PROCESSING`, `SHIPPING`, `DELIVERED`, `COMPLETED`, `CANCELLED`, `REFUNDED`).
- **CQRS & Unit of Work**: Segregates write operations (commands) from read projections (queries) with atomic transaction boundaries via `PrismaOrderUnitOfWork`.
- **Transactional Outbox & Choreography Saga**: Persists domain events into `outbox_events` within the database transaction, published to RabbitMQ to coordinate asynchronously with Payment and Notification services.
- **Protocols**: Exposes high-performance unary RPCs via **gRPC** (port `50057`) and consumes saga reply events over **RabbitMQ** (`order_queue`).

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC| Order["Order Service<br/>(CQRS / Unit of Work)"]

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Order)")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Order --- DB
    Order -.->|Order Created / Cancelled| RabbitMQ
    RabbitMQ -.->|Payment Succeeded / Failed| Order

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Order serviceClass;
    class RabbitMQ brokerClass;
    class DB dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated database `omni_service_order` on port `5445`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)
- **Tables**: `orders`, `order_items`, `outbox_events`

---

## Local Development

Start the Order Service in development watch mode:

```bash
# From workspace root
make start-order
# or
pnpm --filter @omni/order run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/order run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
