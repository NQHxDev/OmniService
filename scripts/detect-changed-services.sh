#!/usr/bin/env sh
set -e

# Ensure wordsplitting if executed via zsh
[ -n "$ZSH_VERSION" ] && setopt shwordsplit 2>/dev/null || true

# Check color support
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

ALL_SERVICES="analyze auth commerce gateway media notification order payment post product search supplier user"

# If manual force list provided as $1 or FORCE_SERVICES env
OVERRIDE_SERVICES="${1:-$FORCE_SERVICES}"

if [ -n "$OVERRIDE_SERVICES" ]; then
   if [ "$OVERRIDE_SERVICES" = "all" ] || [ "$OVERRIDE_SERVICES" = "*" ]; then
      SELECTED_SERVICES="$ALL_SERVICES"
   else
      SELECTED_SERVICES=$(echo "$OVERRIDE_SERVICES" | tr ',' ' ')
   fi

   JSON_ARRAY="["
   FIRST=1
   for s in $SELECTED_SERVICES; do
      if [ $FIRST -eq 1 ]; then
         JSON_ARRAY="${JSON_ARRAY}\"${s}\""
         FIRST=0
      else
         JSON_ARRAY="${JSON_ARRAY},\"${s}\""
      fi
   done
   JSON_ARRAY="${JSON_ARRAY}]"

   printf "${CYAN}⚡ OmniServices • Manual CD Trigger Selected Services:${RESET} %s\n" "$SELECTED_SERVICES"
   echo "services_json=$JSON_ARRAY"
   echo "has_changes=true"
   if [ -n "$GITHUB_OUTPUT" ]; then
      echo "services_json=$JSON_ARRAY" >> "$GITHUB_OUTPUT"
      echo "has_changes=true" >> "$GITHUB_OUTPUT"
   fi
   exit 0
fi

# Detect changed files using git diff
BASE_REF="${GITHUB_BASE_REF:-}"
CHANGED_FILES=""

if [ -n "$BASE_REF" ]; then
   git fetch origin "$BASE_REF" --depth=10 2>/dev/null || true
   CHANGED_FILES=$(git diff --name-only "origin/$BASE_REF...HEAD" 2>/dev/null || true)
fi

if [ -z "$CHANGED_FILES" ]; then
   CHANGED_FILES=$(git diff --name-only HEAD~1 HEAD 2>/dev/null || true)
fi

if [ -z "$CHANGED_FILES" ]; then
   # Fallback to local uncommitted
   CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || true)
fi

if [ -z "$CHANGED_FILES" ]; then
   printf "${YELLOW}⚠ No file changes detected. Skipping service build & deploy.${RESET}\n"
   echo "services_json=[]"
   echo "has_changes=false"
   if [ -n "$GITHUB_OUTPUT" ]; then
      echo "services_json=[]" >> "$GITHUB_OUTPUT"
      echo "has_changes=false" >> "$GITHUB_OUTPUT"
   fi
   exit 0
fi

TARGETS=""

add_service() {
   _svc="$1"
   [ -z "$_svc" ] && return
   for t in $TARGETS; do
      if [ "$t" = "$_svc" ]; then
         return
      fi
   done
   TARGETS="$TARGETS $_svc"
}

TRIGGER_ALL=0

# Analyze changed files
for file in $CHANGED_FILES; do
   case "$file" in
      # Global configs or core libraries trigger rebuild of all services
      libs/common/*|package.json|pnpm-lock.yaml|pnpm-workspace.yaml|tsconfig*.json|nest-cli.json|Dockerfile)
         TRIGGER_ALL=1
         break
         ;;
      # Direct microservice changes
      apps/*)
         svc=$(echo "$file" | cut -d'/' -f2)
         if [ -d "apps/$svc" ]; then
            add_service "$svc"
         fi
         ;;
      # Contract changes affect corresponding service and the gateway
      libs/contracts/*)
         contract=$(echo "$file" | cut -d'/' -f3)
         if [ -d "apps/$contract" ]; then
            add_service "$contract"
         fi
         add_service "gateway"
         ;;
      # Ignore docs, test files, configs, and CI files that do not affect runtime
      docs/*|*.md|.github/*|.husky/*|.gitignore|.prettier*|eslint*|Makefile)
         ;;
      *)
         ;;
   esac
done

if [ $TRIGGER_ALL -eq 1 ]; then
   TARGETS="$ALL_SERVICES"
fi

TARGETS=$(echo "$TARGETS" | xargs)

if [ -z "$TARGETS" ]; then
   printf "${YELLOW}⚠ No microservice source code changes detected. Skipping deployment.${RESET}\n"
   echo "services_json=[]"
   echo "has_changes=false"
   if [ -n "$GITHUB_OUTPUT" ]; then
      echo "services_json=[]" >> "$GITHUB_OUTPUT"
      echo "has_changes=false" >> "$GITHUB_OUTPUT"
   fi
   exit 0
fi

JSON_ARRAY="["
FIRST=1
for s in $TARGETS; do
   if [ $FIRST -eq 1 ]; then
      JSON_ARRAY="${JSON_ARRAY}\"${s}\""
      FIRST=0
   else
      JSON_ARRAY="${JSON_ARRAY},\"${s}\""
   fi
done
JSON_ARRAY="${JSON_ARRAY}]"

printf "\n${CYAN}╭────────────────────────────────────────────────────────╮${RESET}\n"
printf "${CYAN}│${RESET}  ${BOLD}⚡ OmniServices • Selective CD Affected Services${RESET}      ${CYAN}│${RESET}\n"
printf "${CYAN}╰────────────────────────────────────────────────────────╯${RESET}\n"
printf "  ${DIM}Detected Services:${RESET} ${GREEN}%s${RESET}\n" "$TARGETS"
printf "  ${DIM}Matrix JSON:${RESET} %s\n\n" "$JSON_ARRAY"

echo "services_json=$JSON_ARRAY"
echo "has_changes=true"
if [ -n "$GITHUB_OUTPUT" ]; then
   echo "services_json=$JSON_ARRAY" >> "$GITHUB_OUTPUT"
   echo "has_changes=true" >> "$GITHUB_OUTPUT"
fi
exit 0
