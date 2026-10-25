#!/usr/bin/env sh
set -e

# Ensure wordsplitting if executed via zsh
[ -n "$ZSH_VERSION" ] && setopt shwordsplit 2>/dev/null || true

# Default services list if not provided via arguments
if [ "$#" -gt 0 ]; then
  SERVICES="$*"
else
  SERVICES="gateway auth user notification post search media commerce supplier"
fi

get_ms() {
  if command -v node >/dev/null 2>&1; then
    node -e "process.stdout.write(Date.now().toString())"
  else
    echo $(($(date +%s 2>/dev/null || echo 0) * 1000))
  fi
}

calc_duration_ms() {
  _start="$1"
  _end="$2"
  if [ -z "$_end" ] || [ "$_end" -le 0 ] 2>/dev/null; then
    _end=$(get_ms)
  fi
  if [ -z "$_start" ] || [ "$_start" -le 0 ] 2>/dev/null; then
    echo "0"
    return
  fi
  _diff=$((_end - _start))
  if [ "$_diff" -lt 0 ] 2>/dev/null; then
    _diff=0
  fi
  echo "$_diff"
}

format_ms() {
  _ms=$1
  [ -z "$_ms" ] && _ms=0
  if [ "$_ms" -lt 0 ] 2>/dev/null; then
    _ms=0
  fi

  _sec_int=$((_ms / 1000))
  _dec=$(( (_ms % 1000) / 100 ))

  if [ "$_sec_int" -ge 60 ]; then
    _min=$((_sec_int / 60))
    _sec_rem=$((_sec_int % 60))
    echo "${_min}m ${_sec_rem}.${_dec}s"
  else
    echo "${_sec_int}.${_dec}s"
  fi
}

TOTAL=$(echo "$SERVICES" | wc -w | tr -d ' ')
CURRENT=1
START_ALL=$(get_ms)

echo "Starting Sequential Microservice Build ($TOTAL services)"
echo "Services: $SERVICES"

for service in $SERVICES; do
  echo ""
  echo "--------------------------------------------------"
  echo "[$CURRENT/$TOTAL] Building: $service..."
  echo "--------------------------------------------------"

  START_SVC=$(get_ms)

  if ! pnpm exec nest build "$service"; then
    echo ""
    echo "Build FAILED for service: '$service'!"
    echo "Sequential build halted at [$CURRENT/$TOTAL]."
    exit 1
  fi

  END_SVC=$(get_ms)
  SVC_DIFF=$(calc_duration_ms "$START_SVC" "$END_SVC")
  echo "Service: $service built successfully ($(format_ms "$SVC_DIFF"))."

  CURRENT=$((CURRENT + 1))
done

END_ALL=$(get_ms)
TOTAL_DIFF=$(calc_duration_ms "$START_ALL" "$END_ALL")

echo ""
echo "All $TOTAL services built successfully in $(format_ms "$TOTAL_DIFF")!"
exit 0
