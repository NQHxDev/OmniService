# Product Contract Library (`@contracts/product`)

This library provides shared TypeScript types, DTOs, gRPC v1 Protobuf contracts, domain events, and error codes for the OmniServices Product domain.

## Contents

- **`proto/v1/`**: Protocol Buffers definition adhering to versioning standards (`product.v1`).
- **`grpc/v1/`**: Strongly-typed TypeScript interfaces generated for NestJS microservice controllers and clients.
- **`dto/`**: Request and response Data Transfer Objects decorated with `class-validator` and `@nestjs/swagger`.
- **`constants/`**:
   - `WHO_FOOD_GROUPS`: The 8 standardized WHO culinary nutritional categories.
   - `PRODUCT_ERROR_CODES`: Type-safe i18n error code constants.
   - `PRODUCT_RESPONSE_MESSAGES`: Standardized i18n response messages.
   - `PRODUCT_EVENTS`: RabbitMQ event names and payload interfaces.
