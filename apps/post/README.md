# Post Service (`apps/post`)

The Post Service provides social publishing, feed generation, content tagging, comments, and engagement tracking for OmniServices.

---

## Architecture & Responsibilities

- **Content Management**: Manages post authoring, drafts, updates, deletion, and media attachment references.
- **Engagement & Interactions**: Tracks likes, reactions, shares, and comment threads.
- **Protocol**: Serves synchronous requests via **gRPC** and publishes content creation/interaction events to **RabbitMQ** for real-time feed fan-out, search indexing, and notifications.

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC| Post["Post Service"]

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Post)")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Post --- DB
    Post -.->|Post Published / Liked Events| RabbitMQ

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Post serviceClass;
    class RabbitMQ brokerClass;
    class DB dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated instance for `post`)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)

---

## Local Development

Start the Post Service in development watch mode:

```bash
# From workspace root
make start-post
# or
pnpm --filter @omni/post run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/post run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
