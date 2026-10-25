#!/usr/bin/env sh
set -e

# Check if target branch is staging or develop
is_protected_branch() {
   case "$1" in
      staging|develop) return 0 ;;
      *) return 1 ;;
   esac
}

should_verify=0
matched_branch=""

if [ -t 0 ]; then
   # Invoked interactively from terminal without stdin pipe
   current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current 2>/dev/null || true)
   if is_protected_branch "$current_branch"; then
      should_verify=1
      matched_branch="$current_branch"
   fi
else
   # Reading stdin lines passed by Git pre-push hook:
   # <local ref> <local sha> <remote ref> <remote sha>
   has_stdin=0
   while read -r local_ref local_sha remote_ref remote_sha; do
      [ -z "$local_ref" ] && continue
      has_stdin=1

      # Skip remote branch deletion (local_sha is all 0s or local_ref is (delete))
      if [ "$local_sha" = "0000000000000000000000000000000000000000" ] || [ "$local_ref" = "(delete)" ]; then
         continue
      fi

      local_branch="${local_ref#refs/heads/}"
      remote_branch="${remote_ref#refs/heads/}"

      if is_protected_branch "$remote_branch"; then
         should_verify=1
         matched_branch="$remote_branch"
         break
      elif is_protected_branch "$local_branch"; then
         should_verify=1
         matched_branch="$local_branch"
         break
      fi
  done

  # Fallback if stdin was empty
   if [ "$has_stdin" -eq 0 ]; then
      current_branch=$(git symbolic-ref --short HEAD 2>/dev/null || git branch --show-current 2>/dev/null || true)
      if is_protected_branch "$current_branch"; then
         should_verify=1
         matched_branch="$current_branch"
      fi
   fi
fi

if [ "$should_verify" -eq 0 ]; then
   echo "[pre-push] Skipping sequential build check (not pushing to 'staging' or 'develop')."
   exit 0
fi

echo "[pre-push] Push targeting protected branch '$matched_branch' detected."
echo "[pre-push] Verifying sequential build before allowing push..."

# Execute sequential build script
sh scripts/build-sequential.sh
