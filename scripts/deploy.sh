#!/usr/bin/env bash
# ==============================================================================
# OmniServices — Full Docker Deploy Script
# Usage: ./scripts/deploy.sh [up|down|restart|logs|status|migrate|seed]
# ==============================================================================

set -euo pipefail

COMPOSE_FILE="docker-compose.deploy.yml"
ENV_FILE=".env.deploy"
COMPOSE="docker compose -f $COMPOSE_FILE --env-file $ENV_FILE"

# ── Màu sắc ───────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*"; exit 1; }

# ── Helpers ───────────────────────────────────────────────────────────────────
check_deps() {
  command -v docker >/dev/null 2>&1   || log_error "Docker chưa được cài đặt!"
  docker info >/dev/null 2>&1         || log_error "Docker daemon chưa chạy!"
  [ -f "$ENV_FILE" ]                  || log_error "Không tìm thấy $ENV_FILE"
}

build_images() {
  local force="${REBUILD:-0}"
  log_info "Kiểm tra Docker images cho tất cả microservices..."
  SERVICES=(gateway auth user notification post search media commerce supplier order payment product analyze)
  for svc in "${SERVICES[@]}"; do
    if [ "$force" != "1" ] && docker image inspect "omni-${svc}:latest" >/dev/null 2>&1; then
      log_success "  → omni-${svc}:latest đã có sẵn (bỏ qua build, dùng image cũ)"
      continue
    fi
    log_info "  → Building omni-${svc}:latest ..."
    docker build --build-arg SERVICE_NAME="$svc" -t "omni-${svc}:latest" . \
      && log_success "    omni-${svc}:latest OK" \
      || log_error "    Build thất bại cho service: $svc"
  done

  if [ "$force" != "1" ] && docker image inspect "omni-web:latest" >/dev/null 2>&1; then
    log_success "  → omni-web:latest đã có sẵn (bỏ qua build, dùng image cũ)"
  else
    log_info "  → Building omni-web:latest (Web Admin Temp)..."
    docker build -t "omni-web:latest" ./temp \
      && log_success "    omni-web:latest OK" \
      || log_error "    Build thất bại cho web"
  fi
}

wait_for_service() {
  local service="$1"
  local max_wait="${2:-120}"
  log_info "  Đợi $service healthy (tối đa ${max_wait}s)..."
  local elapsed=0
  while [ $elapsed -lt $max_wait ]; do
    status=$($COMPOSE ps --format json "$service" 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Health','') if isinstance(d,dict) else [x.get('Health','') for x in d][0])" 2>/dev/null || echo "")
    if [ "$status" = "healthy" ]; then
      log_success "    $service healthy!"
      return 0
    fi
    sleep 5
    elapsed=$((elapsed + 5))
  done
  log_warn "    $service chưa healthy sau ${max_wait}s — tiếp tục..."
}

run_migrations() {
  log_info "Chạy Prisma sync DB schema cho tất cả microservices..."
  pnpm run prisma:push && log_success "  Prisma schema đã đồng bộ 100%!" || log_warn "  Một số migration có cảnh báo, kiểm tra lại nếu cần."
}

run_seeds() {
  log_info "Chạy Prisma seed data..."
  pnpm --filter @omni/auth run prisma:seed 2>&1 && log_success "  Seed auth OK!" || log_warn "  Seed auth bỏ qua."
  pnpm --filter @omni/product run prisma:seed 2>&1 && log_success "  Seed product OK!" || log_warn "  Seed product bỏ qua."
}

cmd_up() {
  check_deps
  log_info "======================================================"
  log_info "  OmniServices Full Deploy"
  log_info "======================================================"

  # ── Bước 1: Build images ──────────────────────────────────────────────────
  build_images

  # ── Bước 2: Khởi động song song toàn bộ Infrastructure ───────────────────
  log_info "Khởi động song song toàn bộ Infrastructure (DBs x11, Redis, RabbitMQ, Jaeger, ES, Nebula)..."
  $COMPOSE up -d \
    auth-postgres user-postgres notification-postgres post-postgres \
    media-postgres commerce-postgres supplier-postgres order-postgres \
    payment-postgres product-postgres analyze-postgres \
    redis rabbitmq jaeger elasticsearch \
    nebula-metad nebula-storaged nebula-graphd

  # ── Bước 3: Đợi PgBouncer (chỉ đợi kết nối DB để migrate) ────────────────
  log_info "Khởi động PgBouncer..."
  $COMPOSE up -d --wait pgbouncer

  # ── Bước 4: Khởi động tất cả microservices ────────────────────────────────
  log_info "Khởi động tất cả microservices..."
  $COMPOSE up -d auth user notification post search media commerce supplier order payment product analyze
  log_info "  Đợi 15s cho các service kết nối ban đầu..."
  sleep 15

  # ── Bước 5: Migrations ────────────────────────────────────────────────────
  run_migrations

  # ── Bước 6: Seed data ─────────────────────────────────────────────────────
  run_seeds

  # ── Bước 7: Khởi động Gateway, Web Temp & Cloudflare Tunnel ───────────────
  log_info "Khởi động Gateway, Web Temp & Cloudflare Tunnel..."
  $COMPOSE up -d gateway web cloudflared

  # ── Done ───────────────────────────────────────────────────────────────────
  log_success "======================================================"
  log_success "  Deploy hoàn tất!"
  log_success "======================================================"
  echo ""
  echo "  💻 Web Admin (Temp):  http://localhost:3000"
  echo "  🌐 Gateway API:       http://localhost:8080/api/v1"
  echo "  📚 Swagger Docs:      http://localhost:8080/api/v1/docs"
  echo "  🐰 RabbitMQ UI:       http://localhost:15672  (guest/guest)"
  echo "  🔍 Jaeger Tracing:    http://localhost:16686"
  echo "  🔎 Elasticsearch:     http://localhost:9200"
  echo "  ☁️  Cloudflare Tunnel: Check Cloudflare Zero Trust dashboard"
  echo ""
  log_info "Xem trạng thái: ./scripts/deploy.sh status"
  log_info "Xem logs:        ./scripts/deploy.sh logs [service]"
}

cmd_down() {
  check_deps
  log_warn "Dừng và xoá toàn bộ containers (giữ nguyên volumes/data)..."
  $COMPOSE down --remove-orphans
  log_success "Đã dừng tất cả containers."
}

cmd_down_clean() {
  check_deps
  log_warn "⚠️  XOÁ TOÀN BỘ containers + volumes (mất hết data DB)!"
  read -r -p "Xác nhận? (yes/no): " confirm
  [ "$confirm" = "yes" ] || { log_info "Huỷ."; exit 0; }
  $COMPOSE down -v --remove-orphans
  log_success "Đã xoá toàn bộ containers và volumes."
}

cmd_restart() {
  cmd_down
  cmd_up
}

cmd_logs() {
  check_deps
  local svc="${2:-}"
  if [ -n "$svc" ]; then
    $COMPOSE logs -f "$svc"
  else
    $COMPOSE logs -f gateway cloudflared
  fi
}

cmd_status() {
  check_deps
  $COMPOSE ps
}

cmd_migrate() {
  check_deps
  run_migrations
}

cmd_seed() {
  check_deps
  run_seeds
}

# ── Entry point ───────────────────────────────────────────────────────────────
ACTION="${1:-up}"
case "$ACTION" in
  up)          cmd_up ;;
  down)        cmd_down ;;
  down:clean)  cmd_down_clean ;;
  restart)     cmd_restart ;;
  logs)        cmd_logs "$@" ;;
  status)      cmd_status ;;
  migrate)     cmd_migrate ;;
  seed)        cmd_seed ;;
  *)
    echo "Usage: $0 [up|down|down:clean|restart|logs [service]|status|migrate|seed]"
    exit 1
    ;;
esac
