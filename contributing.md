# Contributing to OmniServices

Thank you for your interest in contributing to OmniServices! This document provides instructions for setting up your development environment, coding standards, and our pull request lifecycle.

---

## 1. Prerequisites

Ensure you have the following installed locally:

- **Node.js**: v20.x or later (LTS recommended)
- **pnpm**: v9.x or later (`corepack enable && corepack prepare pnpm@latest --activate`)
- **Docker & Docker Compose**: For local infrastructure (PostgreSQL, Redis, RabbitMQ, etc.)
- **Make**: (Optional, but recommended for running shortcut commands)

---

## 2. Getting Started

### 2.1. Clone Repository

```bash
git clone https://github.com/your-org/OmniServices.git
cd OmniServices
```

### 2.2. Install Dependencies

Use `pnpm` or the provided `Makefile`:

```bash
make install
# or
pnpm install
```

### 2.3. Environment Variables

Copy the example environment configuration:

```bash
cp .env.example .env
```

Review `.env` and adjust database credentials, ports, or secrets if necessary.

### 2.4. Start Infrastructure

Launch backing services via Docker Compose:

```bash
make docker-up
# or
docker compose up -d
```

### 2.5. Database Migration & Prisma Setup

Generate Prisma clients and push schemas to your local databases:

```bash
make prisma-generate
make prisma-push
```

---

## 3. Running Services Locally

You can run individual services in watch mode:

```bash
make start-gateway       # Starts API Gateway (apps/gateway)
make start-auth          # Starts Auth Service (apps/auth)
make start-user          # Starts User Service (apps/user)
make start-notification  # Starts Notification Service (apps/notification)
make start-post          # Starts Post Service (apps/post)
make start-search        # Starts Search Service (apps/search)
make start-media         # Starts Media Service (apps/media)
make start-commerce      # Starts Commerce Service (apps/commerce)
make start-supplier      # Starts Supplier Service (apps/supplier)
```

To run all services concurrently:

```bash
make start
```

---

## 4. Development & Coding Guidelines

### 4.1. TypeScript & Type Safety

- Avoid implicit or unsafe `any` types.
- Ensure strict typing across microservice boundaries, gRPC payloads, and event messages.

### 4.2. Import Paths & Base Path Aliases (`@`)

- All base paths and cross-module import paths **must** use the `@` prefix (e.g., `@auth/*`, `@gateway/*`, `@common`, `@common/*`, `@/*`).
- Do **not** use parent relative traversals (`../../` or `../../../`).
- Sibling relative imports (`./`) are allowed only for files in the exact same folder.

### 4.3. Swagger & OpenAPI Documentation

- All Swagger/OpenAPI documentation, annotations, and summaries must be written in **100% professional English**.
- Document all potential error responses with `@ApiErrorResponse` or `@ApiErrorResponses` from `@common`.

### 4.4. gRPC & Protobuf Versioning

- Place all `.proto` files in versioned directories (e.g., `proto/v1/auth.proto`).
- Keep packages explicit (`package auth.v1;`).

---

## 5. Quality Assurance & Testing

Before committing your changes, you must ensure that all linters and tests pass:

```bash
# 1. Format and lint checks (must have 0 errors and 0 warnings)
make lint
# or
pnpm run lint

# 2. Code formatting
make format

# 3. Unit & Integration Tests
make test
```

---

## 6. Git Workflow & Submitting Changes

### 6.1. Branch Naming Convention

Create a descriptive branch for your work:

- `feature/<short-description>` (e.g., `feature/user-profile-endpoint`)
- `fix/<short-description>` (e.g., `fix/jwt-expiration-bug`)
- `refactor/<short-description>`
- `chore/<short-description>`

### 6.2. Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat(auth): add google oauth2 login`
- `fix(gateway): resolve rate limiting bypass`
- `refactor(common): extract jwt verification guard`
- `docs: update setup steps in contributing guide`

### 6.3. Pull Request Guidelines

1. Push your branch to GitHub.
2. Open a Pull Request against the `staging` branch (or `main` branch depending on release flow).
3. Fill out the PR template completely:
   - Provide context and link related issues.
   - Select the affected services.
   - Detail the manual/automated testing performed.
4. Ensure all CI checks (linting, tests, build) pass.
5. Address any feedback from reviewers.
