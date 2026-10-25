# Payment Service (`apps/payment`)

The Payment Service handles electronic payment gateways, multi-provider checkout routing, webhook IPN callbacks, and transactional refunds.

---

## Architecture & Responsibilities

- **Multi-Gateway Routing**: Extensible provider strategy supporting **COD**, **CREDIT_CARD** (Visa/Mastercard 3DS sandbox), **VNPAY** (HMAC-SHA512 checksum), and **MOMO** (HMAC-SHA256 signature).
- **IPN / Webhook Security**: Secure cryptographic verification of incoming IPN notifications from payment gateways before state transitions.
- **Transactional Choreography Saga**: Publishes `payment.succeeded`, `payment.failed`, `payment.cod_pending`, and `payment.refunded` to RabbitMQ with PostgreSQL outbox backup.
- **Protocols**: Unary RPC calls via **gRPC** (port `50058`) and asynchronous messaging via **RabbitMQ** (`payment_queue`).

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC| Payment["Payment Service<br/>(Provider Strategy)"]
    ExternalProviders["VNPay / MoMo / Cards"] -->|IPN Webhook| Gateway
    Gateway -->|Verify & Process| Payment

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Payment)")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Payment --- DB
    Payment -.->|Payment Succeeded / Failed| RabbitMQ
    RabbitMQ -.->|Saga Status Update| Order["Order Service"]

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Payment serviceClass;
    class RabbitMQ brokerClass;
    class DB dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated database `omni_service_payment` on port `5446`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)
- **Tables**: `payment_transactions`, `outbox_events`

---

## Local Development

Start the Payment Service in development watch mode:

```bash
# From workspace root
make start-payment
# or
pnpm --filter @omni/payment run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/payment run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
