# Product Service (`apps/product`)

The **Product Service** is a dedicated culinary ingredient and raw material catalog microservice in OmniServices. It manages raw food supplies posted by suppliers, enforcing standard classification based on the 8 WHO standardized nutrition food groups, packaging variants, inventory management, moderation workflows, and instant search projection synchronization.

---

## Key Features

1. **WHO Standardized Nutritional Groups (8 Categories)**:
   - `STAPLES`: Lương thực chính (Tinh bột)
   - `LEGUMES_NUTS_SEEDS`: Các loại đậu và hạt
   - `DAIRY`: Sữa và các sản phẩm từ sữa
   - `MEAT_FISH_POULTRY`: Thịt, cá và gia cầm
   - `EGGS`: Trứng
   - `VITAMIN_A_FRUITS_VEG`: Rau củ và quả giàu Vitamin A
   - `OTHER_FRUITS_VEG`: Rau củ và quả khác
   - `FATS_OILS`: Chất béo và dầu mỡ

2. **Supplier Freedom with Moderation Control**:
   - Suppliers can freely create raw materials and ingredient offerings.
   - Initial moderation status is `PENDING_APPROVAL` with operational status `DRAFT`.
   - Admin moderation is required before a product can transition to `ACTIVE`.

3. **Immediate Search Sync**:
   - Immediately upon registration (even while pending approval), the product is published to RabbitMQ (`product.event.registered`) for indexing in Elasticsearch.
   - When approved, `product.event.approved` triggers search index updates.

4. **Product Packaging Variants**:
   - Supports multiple packaging variants per product (e.g. 500g, 1kg, 5kg bag, crate, carton).
   - Tracks SKU, units, prices, and low-stock alerts.

5. **Integrated Stock / Inventory Management**:
   - Atomic inventory adjustments (`adjustStock`).
   - Order reservation locks (`checkAndReserveStock`).
   - Order cancellation releases (`releaseStock`).
   - Immutable stock movement audit ledger (`StockMovement`).

6. **Architecture & Patterns**:
   - Clean Code & Hexagonal Architecture / DDD.
   - CQRS (CommandBus / QueryBus via `@common`).
   - Transactional Outbox pattern for reliable domain event dispatching.
   - Unit of Work pattern for multi-repository atomic transactions.
   - Dual interface: gRPC v1 contract + RabbitMQ event consumer.
   - Prometheus metrics endpoint (`/metrics`) on HTTP port `3011`.
   - Zod environment validation (`product-env.schema.ts`).
   - Uppercase i18n keys for responses and error codes.

---

## Ports & Configuration

| Component             | Port / Identifier                        |
| :-------------------- | :--------------------------------------- |
| HTTP Server / Metrics | `3011` (`/metrics`)                      |
| gRPC Server           | `50060` (`ProductService`, `product.v1`) |
| Postgres DB           | `5447` (`omni_service_product`)          |
| PgBouncer             | `6432`                                   |
| RabbitMQ Queue        | `product_queue`                          |

---

## Running the Service

```bash
# Start Product infrastructure & service
make start-product

# Run Prisma migrations / push
pnpm --filter @omni/product run prisma:push

# Seed WHO food categories
pnpm --filter @omni/product run prisma:seed
```
