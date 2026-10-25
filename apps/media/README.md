# Media Service (`apps/media`)

The Media Service handles binary file uploads, object storage operations, image resizing, and CDN asset management for OmniServices.

---

## Architecture & Responsibilities

- **File Management**: Ingests images, videos, and documents, validates MIME types and file signatures, and coordinates storage lifecycle.
- **Storage Abstraction**: Adapters for local filesystem storage, AWS S3, or MinIO object stores.
- **Protocol**: Serves metadata retrieval and upload authorization (pre-signed URLs) via **gRPC**, and emits media processing events over **RabbitMQ**.

```mermaid
flowchart LR
    Gateway["API Gateway"] -->|gRPC / File Streams| Media["Media Service<br/>(Storage Engine)"]

    subgraph Storage ["Service Data Layer"]
        DB[("PostgreSQL (Media)")]
        ObjectStore[("S3 / MinIO Object Storage")]
    end

    subgraph Messaging ["Message Broker"]
        RabbitMQ{{"RabbitMQ"}}
    end

    Media --- DB
    Media --- ObjectStore
    Media -.->|Media Uploaded Events| RabbitMQ

    classDef gatewayClass fill:#1a365d,stroke:#2b6cb0,stroke-width:2px,color:#fff;
    classDef serviceClass fill:#234e52,stroke:#319795,stroke-width:1.5px,color:#fff;
    classDef brokerClass fill:#744210,stroke:#d69e2e,stroke-width:2px,color:#fff;
    classDef dbClass fill:#1c4532,stroke:#38a169,stroke-width:1.5px,color:#fff;

    class Gateway gatewayClass;
    class Media serviceClass;
    class RabbitMQ brokerClass;
    class DB,ObjectStore dbClass;
```

---

## Database & Persistence

- **Database**: PostgreSQL (dedicated instance for `media` metadata)
- **ORM**: Prisma ORM (`prisma/schema.prisma`)
- **Object Storage**: S3-compatible cloud or local storage.

---

## Local Development

Start the Media Service in development watch mode:

```bash
# From workspace root
make start-media
# or
pnpm --filter @omni/media run start:dev
```

Run database migrations:

```bash
pnpm --filter @omni/media run prisma:push
```

---

## Relation to Root Architecture

For overall system architecture and cross-service orchestration, refer to the [Root README.md](../../README.md).
