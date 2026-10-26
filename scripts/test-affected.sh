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

# Determine base and target commit for git diff
remote_sha="$1"
local_sha="$2"
CHANGED_FILES=""

is_zero_sha() {
  case "$1" in
    ""|"0000000000000000000000000000000000000000") return 0 ;;
    *) return 1 ;;
  esac
}

if [ -n "$remote_sha" ] && [ -n "$local_sha" ]; then
  if ! is_zero_sha "$remote_sha" && git rev-parse --quiet --verify "$remote_sha" >/dev/null 2>&1; then
    CHANGED_FILES=$(git diff --name-only "$remote_sha" "$local_sha" 2>/dev/null || true)
  else
    # New remote branch, compare against base with develop or staging
    BASE_SHA=$(git merge-base "$local_sha" origin/develop 2>/dev/null || git merge-base "$local_sha" origin/staging 2>/dev/null || git merge-base "$local_sha" origin/main 2>/dev/null || echo "")
    if [ -n "$BASE_SHA" ]; then
      CHANGED_FILES=$(git diff --name-only "$BASE_SHA" "$local_sha" 2>/dev/null || true)
    else
      CHANGED_FILES=$(git diff --name-only "$local_sha~1" "$local_sha" 2>/dev/null || true)
    fi
  fi
fi

# Fallback: if CHANGED_FILES is still empty, detect from working tree or latest commit
if [ -z "$CHANGED_FILES" ]; then
  # 1. Uncommitted changes (staged or unstaged)
  CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || true)
  # 2. If nothing uncommitted, check against tracking upstream or develop
  if [ -z "$CHANGED_FILES" ]; then
    UPSTREAM=$(git rev-parse --abbrev-ref --symbolic-full-name @{u} 2>/dev/null || echo "")
    if [ -n "$UPSTREAM" ]; then
      CHANGED_FILES=$(git diff --name-only "$UPSTREAM...HEAD" 2>/dev/null || true)
    else
      CHANGED_FILES=$(git diff --name-only origin/develop...HEAD 2>/dev/null || git diff --name-only HEAD~1 HEAD 2>/dev/null || true)
    fi
  fi
fi

if [ -z "$CHANGED_FILES" ]; then
  echo "${DIM}[test-affected] No file changes detected. Skipping unit tests.${RESET}"
  exit 0
fi

# Map changed files to test targets (apps/<name>, libs/common, libs/contracts/<name>)
TARGETS=""

add_target() {
  _tgt="$1"
  [ -z "$_tgt" ] && return
  # Check if already in TARGETS
  for t in $TARGETS; do
    if [ "$t" = "$_tgt" ]; then
      return
    fi
  done
  TARGETS="$TARGETS $_tgt"
}

# Parse changed files
for file in $CHANGED_FILES; do
  case "$file" in
    apps/*)
      # Extract apps/<app-name>
      app_name=$(echo "$file" | cut -d'/' -f1,2)
      if [ -d "$app_name" ]; then
        add_target "$app_name"
      fi
      ;;
    libs/common/*)
      if [ -d "libs/common" ]; then
        add_target "libs/common"
      fi
      ;;
    libs/contracts/*)
      # Extract libs/contracts/<contract-name>
      contract_name=$(echo "$file" | cut -d'/' -f1,2,3)
      if [ -d "$contract_name" ]; then
        add_target "$contract_name"
      fi
      ;;
  esac
done

# Trim leading whitespace
TARGETS=$(echo "$TARGETS" | xargs)

if [ -z "$TARGETS" ]; then
  echo "${DIM}[test-affected] No microservice or shared library changes detected. Skipping unit tests.${RESET}"
  exit 0
fi

TOTAL=$(echo "$TARGETS" | wc -w | tr -d ' ')
PAD_LEN=$(echo "$TOTAL" | awk '{print length}')
CURRENT=1
START_ALL=$(get_ms)

printf "\n"
printf "${CYAN}╭───────────────────────────────────────────────╮${RESET}\n"
printf "${CYAN}│${RESET}  ${BOLD}⚡ OmniServices • Targeted Unit Tests Check${RESET}  ${CYAN}│${RESET}\n"
printf "${CYAN}╰───────────────────────────────────────────────╯${RESET}\n"
printf "  ${DIM}Affected Targets (%s):${RESET} %s\n\n" "$TOTAL" "$TARGETS"

for target in $TARGETS; do
  STEP=$(printf "[%0*d/%d]" "$PAD_LEN" "$CURRENT" "$TOTAL")
  target_name=$(basename "$target")

  printf "${YELLOW}⋯${RESET} ${DIM}%s Testing %s…${RESET}\n" "$STEP" "$target"

  START_ONE=$(get_ms)

  # Run Jest on the specific target with passWithNoTests and in-band execution
  if pnpm exec jest "$target" --passWithNoTests --runInBand >/dev/null 2>&1; then
    END_ONE=$(get_ms)
    DUR=$(calc_duration_ms "$START_ONE" "$END_ONE")
    DUR_FMT=$(format_ms "$DUR")
    printf "${GREEN}✔${RESET} ${BOLD}%s %s tests passed${RESET} ${DIM}(%s)${RESET}\n\n" "$STEP" "$target" "$DUR_FMT"
  else
    END_ONE=$(get_ms)
    DUR=$(calc_duration_ms "$START_ONE" "$END_ONE")
    DUR_FMT=$(format_ms "$DUR")
    printf "${RED}✖${RESET} ${RED}${BOLD}%s %s tests FAILED${RESET} ${DIM}(%s)${RESET}\n" "$STEP" "$target" "$DUR_FMT"
    printf "\n${RED}[Error] Running full test output for debugging:${RESET}\n"
    pnpm exec jest "$target" --runInBand
    exit 1
  fi

  CURRENT=$((CURRENT + 1))
done

END_ALL=$(get_ms)
TOTAL_DUR=$(calc_duration_ms "$START_ALL" "$END_ALL")
TOTAL_FMT=$(format_ms "$TOTAL_DUR")

printf "${CYAN}─────────────────────────────────────────────────────────────────${RESET}\n"
printf "${GREEN}✔ Done! All affected tests passed (%d targets) in %s${RESET}\n\n" "$TOTAL" "$TOTAL_FMT"
