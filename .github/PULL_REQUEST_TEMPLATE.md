## Description

Please provide a brief summary of the changes introduced in this pull request and the motivation behind them.

- Resolves / Fixes: #<!-- Issue number here, e.g., #123 -->
- Related RFC / Discussion: <!-- Link or reference if any -->

---

## Type of Change

Please mark the options that are relevant:

- [ ] **Bug fix** (non-breaking change fixing an issue)
- [ ] **New feature** (non-breaking change adding new functionality)
- [ ] **Breaking change** (fix or feature causing existing functionality to not work as expected)
- [ ] **Refactor** (code reorganization, cleanup, performance improvement without functional changes)
- [ ] **Documentation** (updates to docs, README, or Swagger/OpenAPI specs)
- [ ] **Tests** (adding missing tests or updating existing tests)
- [ ] **Chore / DevOps** (tooling, dependencies, CI/CD pipelines, Docker, etc.)

---

## Affected Services & Libraries

Please select the components modified:

- [ ] `apps/gateway` (API Gateway)
- [ ] `apps/auth` (Authentication Service)
- [ ] `apps/user` (User Service)
- [ ] `apps/notification` (Notification Service)
- [ ] `apps/post` (Post Service)
- [ ] `apps/search` (Search Service)
- [ ] `apps/media` (Media Service)
- [ ] `apps/commerce` (Commerce Service)
- [ ] `apps/supplier` (Supplier Service)
- [ ] `apps/order` (Order Service)
- [ ] `apps/payment` (Payment Service)
- [ ] `libs/common` (Shared Common Library)
- [ ] `libs/contracts` (Proto & DTO Contracts)
- [ ] Other: <!-- specify here -->

---

## Key Changes & Implementation Details

- <!-- Bullet points of major code changes -->
- <!-- e.g., added auth guard on route X, updated gRPC client in service Y -->

---

## Testing Performed

Describe how you tested these changes:

- [ ] Unit tests added / updated and passed
- [ ] Integration / E2E tests added / updated and passed
- [ ] Manual testing via Postman / Swagger / gRPC CLI
- [ ] Tested locally with Docker Compose

**Test details & evidence (screenshots, curl commands, logs):**
<!-- Paste relevant outputs or attach screenshots if applicable -->

---

## Quality & Pre-Merge Checklist

Before submitting, please ensure you have checked the following:

- [ ] My code adheres to the project's coding standards and style guidelines.
- [ ] I have executed `make lint` (or `pnpm run lint`) and resolved all errors & warnings (0 errors, 0 warnings).
- [ ] All cross-module imports use the `@` base path alias (no relative `../../` paths).
- [ ] Swagger / OpenAPI annotations are updated and 100% written in professional English.
- [ ] Proto files / gRPC packages strictly follow versioning conventions (e.g., `v1`).
- [ ] New/updated environment variables are documented in `.env.example`.
- [ ] Database migrations are included and tested (if schema changes were made).
- [ ] Sensitive information (API keys, secrets, credentials) has NOT been committed.
