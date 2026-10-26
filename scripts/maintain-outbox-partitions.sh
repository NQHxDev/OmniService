#!/usr/bin/env bash
# Enterprise Maintenance: Automated Outbox Partition Creator and Dropper
# Runs across all microservice databases in OmniServices.

set -euo pipefail

POSTGRES_USER="${POSTGRES_USER:-postgres}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
WEEKS_AHEAD="${WEEKS_AHEAD:-2}"

SERVICES=(
   "auth:5433:omni_service_auth"
   "user:5439:omni_service_user"
   "commerce:5443:omni_service_commerce"
   "supplier:5444:omni_service_supplier"
)

echo "[OmniServices] Starting Outbox Partition Maintenance!"
echo "Retention Days: ${RETENTION_DAYS} | Weeks Ahead: ${WEEKS_AHEAD}"

for svc in "${SERVICES[@]}"; do
   IFS=":" read -r name port dbname <<< "${svc}"
   echo "[${name}] Executing partition maintenance on 127.0.0.1:${port}/${dbname}..."

   PGPASSWORD="${POSTGRES_PASSWORD}" psql -h 127.0.0.1 -p "${port}" -U "${POSTGRES_USER}" -d "${dbname}" -v ON_ERROR_STOP=0 <<SQL
      SELECT maintain_outbox_partitions(${WEEKS_AHEAD}, ${RETENTION_DAYS});
SQL
done

echo "[OmniServices] Outbox Partition Maintenance Completed Successfully!"
