#!/usr/bin/env sh
set -e

# Ensure wordsplitting if executed via zsh
[ -n "$ZSH_VERSION" ] && setopt shwordsplit 2>/dev/null || true

# Check color support (terminal, GitHub Actions, CI, or FORCE_COLOR)
supports_color() {
  if [ -n "$NO_COLOR" ]; then
    return 1
  fi
  if [ -t 1 ] || [ -n "$GITHUB_ACTIONS" ] || [ -n "$CI" ] || [ "$FORCE_COLOR" = "1" ] || [ "$FORCE_COLOR" = "true" ]; then
    return 0
  fi
  return 1
}

if supports_color; then
  BOLD="\033[1m"
  DIM="\033[2m"
  CYAN="\033[36m"
  GREEN="\033[32m"
  YELLOW="\033[33m"
  RED="\033[31m"
  RESET="\033[0m"
else
  BOLD=""
  DIM=""
  CYAN=""
  GREEN=""
  YELLOW=""
  RED=""
  RESET=""
fi

# Default services list if not provided via arguments
if [ "$#" -gt 0 ]; then
  SERVICES="$*"
else
  SERVICES="gateway auth user notification post search media commerce supplier order payment product"
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
PAD_LEN=$(echo "$TOTAL" | awk '{print length}')
CURRENT=1
START_ALL=$(get_ms)

printf "\n"
printf "${CYAN}╭───────────────────────────────────────────────────╮${RESET}\n"
printf "${CYAN}│${RESET}  ${BOLD}⚡ OmniServices • Sequential Microservice Build${RESET}  ${CYAN}│${RESET}\n"
printf "${CYAN}╰───────────────────────────────────────────────────╯${RESET}\n"
printf "  ${DIM}Targets (%s):${RESET} %s\n\n" "$TOTAL" "$SERVICES"

for service in $SERVICES; do
  STEP=$(printf "[%0*d/%d]" "$PAD_LEN" "$CURRENT" "$TOTAL")

  printf "${DIM}⋯${RESET} ${CYAN}%s${RESET} Building ${BOLD}%s${RESET}…\n" "$STEP" "$service"

  START_SVC=$(get_ms)

  if ! pnpm exec nest build "$service"; then
    END_SVC=$(get_ms)
    SVC_DIFF=$(calc_duration_ms "$START_SVC" "$END_SVC")
    printf "\n${RED}✖${RESET} ${CYAN}%s${RESET} ${BOLD}%s${RESET} build ${RED}FAILED${RESET} ${DIM}(%s)${RESET}\n" "$STEP" "$service" "$(format_ms "$SVC_DIFF")"
    printf "${CYAN}─────────────────────────────────────────────────────────────────${RESET}\n"
    printf "${RED}✖${RESET} ${BOLD}Build aborted!${RESET} Sequential build halted at ${BOLD}%s${RESET}.\n\n" "$STEP"
    exit 1
  fi

  END_SVC=$(get_ms)
  SVC_DIFF=$(calc_duration_ms "$START_SVC" "$END_SVC")
  printf "${GREEN}✔${RESET} ${CYAN}%s${RESET} ${BOLD}%s${RESET} built successfully ${DIM}(%s)${RESET}\n\n" "$STEP" "$service" "$(format_ms "$SVC_DIFF")"

  CURRENT=$((CURRENT + 1))
done

END_ALL=$(get_ms)
TOTAL_DIFF=$(calc_duration_ms "$START_ALL" "$END_ALL")

printf "${CYAN}─────────────────────────────────────────────────────────────────${RESET}\n"
printf "${GREEN}✔${RESET} ${BOLD}Done!${RESET} Successfully built %s/%s services in ${BOLD}%s${RESET}\n\n" "$TOTAL" "$TOTAL" "$(format_ms "$TOTAL_DIFF")"
exit 0
