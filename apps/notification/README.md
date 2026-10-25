# Notification Service (`apps/notification`)

The Notification Service is an asynchronous event consumer responsible for delivering transactional messages, emails, SMS, and in-app alerts to users.

---

## Architecture & Responsibilities

- **Omnichannel Dispatch**: Formats and delivers notifications via Email (SMTP/SES), SMS, push notifications, and in-app feeds.
- **Template & Localization**: Renders multi-language notification templates (`templates/`, `i18n/`).
- **Event-Driven Processing**: Subscribes to topics across the system on RabbitMQ (e.g. user welcome emails, order confirmations, password reset codes, comment notifications).
- **Protocol**: Consumes messages asynchronously from **RabbitMQ** and exposes gRPC endpoints for notification preferences and history queries.

```mermaid
flowchart LR
    RabbitMQ{{"RabbitMQ"}} -->|Consume Events| Notification["Notification Service<br/>(i18n / Dispatcher)"]
    Gateway["API Gateway"] -->|gRPC Queries| Notification

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Notification)")]
    end

    subgraph External ["External Delivery Providers"]
        Email["Email Provider"]
        SMS["SMS Gateway"]
        Push["Push Notifications"]
    end

    Notification --- DB
    Notification --> External

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;
    classDef extClass fill:#4a5568,stroke:#718096,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Notification serviceClass;
    class RabbitMQ brokerClass;
    class DB dbClass;
    class Email,SMS,Push extClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated instance for `notification`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)

---

## Local Development

Start the Notification Service in development watch mode:

```bash
# From workspace root
make start-notification
# or
pnpm --filter @omni/notification run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/notification run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
