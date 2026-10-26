.PHONY: install
install:
	pnpm install
	npx -y @colbymchenry/codegraph install

.PHONY: prisma-push
prisma-push:
	pnpm run prisma:push

.PHONY: prisma-push-reset
prisma-push-reset:
	pnpm run prisma:push:reset

.PHONY: prisma-generate
prisma-generate:
	pnpm run prisma:generate

.PHONY: prisma-seed
prisma-seed:
ifdef service
	pnpm --filter @omni/$(subst @omni/,,$(service)) run prisma:seed
else ifdef app
	pnpm --filter @omni/$(subst @omni/,,$(app)) run prisma:seed
else
	pnpm run prisma:seed
endif

.PHONY: start
start:
	@echo "Starting all services..."
	pnpm run pc:start

.PHONY: start-gateway
start-gateway:
	docker compose --profile infra up -d --wait
	pnpm run start:gateway

.PHONY: start-auth
start-auth:
	docker compose --profile infra --profile auth up -d --wait
	pnpm --filter @omni/auth run prisma:push
	pnpm --filter @omni/auth run prisma:seed
	pnpm run start:auth

.PHONY: start-user
start-user:
	docker compose --profile infra --profile user up -d --wait
	pnpm --filter @omni/user run prisma:push
	pnpm run start:user

.PHONY: start-notification
start-notification:
	docker compose --profile infra --profile notification up -d --wait
	pnpm --filter @omni/notification run prisma:push
	pnpm run start:notification

.PHONY: start-post
start-post:
	docker compose --profile infra --profile post up -d --wait
	pnpm --filter @omni/post run prisma:push
	pnpm run start:post

.PHONY: start-search
start-search:
	docker compose --profile infra --profile search up -d --wait
	pnpm run start:search

.PHONY: start-media
start-media:
	docker compose --profile infra --profile media up -d --wait
	pnpm --filter @omni/media run prisma:push
	pnpm run start:media

.PHONY: start-commerce
start-commerce:
	docker compose --profile infra --profile commerce up -d --wait
	pnpm --filter @omni/commerce run prisma:push
	pnpm run start:commerce

.PHONY: start-product
start-product:
	docker compose --profile infra --profile product up -d --wait
	pnpm --filter @omni/product run prisma:push
	pnpm run start:product

.PHONY: start-supplier
start-supplier:
	docker compose --profile infra --profile supplier up -d --wait
	pnpm --filter @omni/supplier run prisma:push
	pnpm run start:supplier

.PHONY: start-order
start-order:
	docker compose --profile infra --profile order up -d --wait
	pnpm --filter @omni/order run prisma:push
	pnpm run start:order

.PHONY: start-payment
start-payment:
	docker compose --profile infra --profile payment up -d --wait
	pnpm --filter @omni/payment run prisma:push
	pnpm run start:payment

.PHONY: build
build:
	pnpm run build

.PHONY: lint
lint:
	pnpm run lint

.PHONY: format
format:
	pnpm run format

.PHONY: test
test:
	pnpm run test

.PHONY: test-e2e
test-e2e:
	pnpm run test:e2e

.PHONY: clean
clean:
	rm -rf dist build coverage .nyc_output logs
	rm -rf apps/*/dist apps/*/logs
	rm -rf apps/*/src/generated libs/*/src/generated
	rm -rf node_modules apps/*/node_modules libs/*/node_modules
	rm -rf .pnpm-store *.tsbuildinfo *.log

.PHONY: docker-up
docker-up:
	docker compose --profile infra up -d

.PHONY: docker-up-all
docker-up-all:
	docker compose --profile "*" up -d

.PHONY: docker-down
docker-down:
	docker compose --profile "*" down

.PHONY: docker-clean
docker-clean:
	docker compose --profile "*" down -v --remove-orphans

.PHONY: codegraph-sync
codegraph-sync:
	pnpm exec codegraph sync
