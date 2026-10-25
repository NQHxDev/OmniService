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
	pnpm run start:gateway

.PHONY: start-auth
start-auth:
	pnpm run start:auth

.PHONY: start-user
start-user:
	pnpm run start:user

.PHONY: start-notification
start-notification:
	pnpm run start:notification

.PHONY: start-post
start-post:
	pnpm run start:post

.PHONY: start-search
start-search:
	pnpm run start:search

.PHONY: start-media
start-media:
	pnpm run start:media

.PHONY: start-commerce
start-commerce:
	pnpm run start:commerce

.PHONY: start-supplier
start-supplier:
	pnpm run start:supplier

.PHONY: start-order
start-order:
	pnpm run start:order

.PHONY: start-payment
start-payment:
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
	docker compose up -d

.PHONY: docker-clean
docker-clean:
	docker compose down -v --remove-orphans

.PHONY: codegraph-sync
codegraph-sync:
	npx -y @colbymchenry/codegraph sync
