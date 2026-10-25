# Auth Service (`apps/auth`)

The Auth Service manages identity verification, authentication credentials, multi-factor authentication (MFA/OTP), session token issuance, and OAuth federations.

---

## Architecture & Responsibilities

- **Authentication & Tokens**: Issues, rotates, and invalidates JWT Access Tokens and Refresh Tokens.
- **Identity Lifecycle**: Manages credentials, password hashes (Argon2/Bcrypt), account activations, and password resets.
- **Enterprise Patterns**: Implements CQRS (Command Query Responsibility Segregation), Saga pattern for multi-step onboarding, and the Transactional Outbox pattern for reliable event publishing.
- **Protocol**: Serves synchronous remote procedure calls via **gRPC** (`auth.v1.AuthService`) and publishes audit events over **RabbitMQ**.

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC| Auth["Auth Service<br/>(CQRS / Saga)"]

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Auth)")]
        Redis[("Redis Token Blacklist")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Auth --- DB
    Auth --- Redis
    Auth -.->|Auth Events / Outbox| RabbitMQ

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Auth serviceClass;
    class RabbitMQ brokerClass;
    class DB,Redis dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated instance for `auth`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)
- **Cache**: Redis for token blacklisting, refresh token family rotation, and rate-limiting brute force attempts.

---

## Local Development

Start the Auth Service in development watch mode:

```bash
# From workspace root
make start-auth
# or
pnpm --filter @omni/auth run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/auth run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
