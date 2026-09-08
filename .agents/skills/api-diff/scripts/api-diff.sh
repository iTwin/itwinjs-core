#!/usr/bin/env bash
# api-diff.sh — compare common/api/*.api.md between two git refs, and show the relevant changelogs.
# Run from the repo root.
# Usage: ./api-diff.sh <base-ref> <head-ref> [api-dir]
#
# Branch naming convention: release/MAJOR.MINOR.0  (e.g. release/5.9.0, release/5.10.0)
#
# Examples:
#   # Between two releases:
#   .agents/skills/api-diff/scripts/api-diff.sh release/5.9.0 release/5.10.0
#
#   # Multi-minor span (shows all changelogs in range):
#   .agents/skills/api-diff/scripts/api-diff.sh release/4.11.0 release/5.10.0
#
#   # Last release → master (check NextVersion.md coverage):
#   LAST=$(git tag --sort=-version:refname | head -1)
#   .agents/skills/api-diff/scripts/api-diff.sh "$LAST" master

set -euo pipefail

CHANGELOG_DIR="docs/changehistory"

# Exit-0 wrapper for grep — prevents pipefail from aborting on zero matches.
safe_grep() { grep "$@" || true; }

# Extract {major}.{minor} from a git ref string.
ref_to_minor_ver() {
  local ref="$1"
  case "$ref" in
    master|main)    echo "master" ;;
    release/*.x)    echo "$ref" | sed 's|release/||; s|\.x$||' ;;     # 5.9.x  → 5.9
    release/[0-9]*) echo "$ref" | sed 's|release/||; s|\.[0-9]*$||' ;; # 5.9.0 → 5.9
    v[0-9]*)        echo "$ref" | sed 's|^v||; s|\.[0-9]*$||' ;;       # v5.9.5 → 5.9
    *)              echo "" ;;
  esac
}

# Print headings from all changelog files that fall strictly after BASE and up to HEAD.
# Uses Python for reliable numeric version sorting.
show_changelogs() {
  local base="$1" head="$2"
  local base_ver head_ver
  base_ver=$(ref_to_minor_ver "$base")
  head_ver=$(ref_to_minor_ver "$head")

  local all_logs
  all_logs=$(ls "${CHANGELOG_DIR}"/*.md 2>/dev/null \
    | safe_grep -E '/[0-9]+\.[0-9]+\.0\.md$')

  python3 - "$base_ver" "$head_ver" $all_logs << 'PYEOF'
import sys, re

base_ver = sys.argv[1]   # e.g. "4.11" or "master"
head_ver = sys.argv[2]   # e.g. "5.10" or "master"
files    = sys.argv[3:]  # list of changelog file paths

def parse_ver(s):
    m = re.match(r'^(\d+)\.(\d+)$', s)
    return (int(m.group(1)), int(m.group(2))) if m else None

def ver_from_path(p):
    m = re.search(r'(\d+)\.(\d+)\.0\.md$', p)
    return (int(m.group(1)), int(m.group(2))) if m else None

base = parse_ver(base_ver)  # None → no lower bound (e.g. base is master)
head = parse_ver(head_ver)  # None → no upper bound (e.g. head is master)

selected = []
for f in files:
    v = ver_from_path(f)
    if v is None:
        continue
    if base is not None and v <= base:
        continue
    if head is not None and v > head:
        continue
    selected.append((v, f))

selected.sort()

if not selected:
    print("  (no changelog files found for this range)")
else:
    for v, f in selected:
        label = f"{v[0]}.{v[1]}.0.md"
        print(f"\n--- {label} ---")
        try:
            for line in open(f):
                if line.startswith('#'):
                    print(line.rstrip())
        except Exception as e:
            print(f"  (could not read: {e})")

# Also show NextVersion.md when HEAD is master
if head_ver == "master":
    nv = "docs/changehistory/NextVersion.md"
    import os
    if os.path.exists(nv):
        print(f"\n--- NextVersion.md ---")
        for line in open(nv):
            if line.startswith('#'):
                print(line.rstrip())
PYEOF
}

print_section() {
  local tmp="$1"
  if [[ ! -s "$tmp" ]]; then
    echo "  (none)"
    return
  fi
  sed 's/^/  /' "$tmp"
}

main() {
  local BASE="${1:?Usage: api-diff.sh <base-ref> <head-ref> [api-dir]}"
  local HEAD="${2:?Usage: api-diff.sh <base-ref> <head-ref> [api-dir]}"
  local API_DIR="${3:-common/api}"

  # Validate refs before doing any work — avoids silent empty-diff on bad refs.
  if ! git rev-parse --verify "$BASE" >/dev/null 2>&1; then
    echo "Error: '$BASE' is not a valid git ref (not fetched locally?)" >&2; exit 1
  fi
  if ! git rev-parse --verify "$HEAD" >/dev/null 2>&1; then
    echo "Error: '$HEAD' is not a valid git ref (not fetched locally?)" >&2; exit 1
  fi

  local DIFF_TMP SECTION_TMP
  DIFF_TMP=$(mktemp)
  SECTION_TMP=$(mktemp)
  trap 'rm -f "$DIFF_TMP" "$SECTION_TMP"' EXIT

  echo "=== API diff: $BASE → $HEAD ==="
  echo ""

  # ── Changelogs in range ───────────────────────────────────────────────────
  echo "========================================="
  echo "Changelogs (headings)"
  echo "========================================="
  show_changelogs "$BASE" "$HEAD"
  echo ""

  # ── Collect changed .api.md files (pathspec limits the diff to API_DIR) ──
  local changed_files=()
  while IFS= read -r f; do
    [[ -n "$f" ]] && changed_files+=("$f")
  done < <(git --no-pager diff "$BASE" "$HEAD" --name-only -- "$API_DIR" \
    | safe_grep '\.api\.md$')

  if [[ ${#changed_files[@]} -eq 0 ]]; then
    echo "No API files changed between $BASE and $HEAD."
    echo "Tip: branch names follow the pattern release/MAJOR.MINOR.0 (e.g. release/5.9.0)."
    return 0
  fi

  echo "========================================="
  echo "Changed API files"
  echo "========================================="
  printf '%s\n' "${changed_files[@]}"
  echo ""

  # ── Per-package diff ──────────────────────────────────────────────────────
  for f in "${changed_files[@]}"; do
    local PKG
    PKG=$(basename "$f" .api.md)
    echo "========================================="
    echo "Package: $PKG"
    echo "========================================="

    # Run git diff once per file; reuse the cached output for counts and display.
    git --no-pager diff "$BASE" "$HEAD" -- "$f" > "$DIFF_TMP"

    local RAW_ADDED RAW_REMOVED
    RAW_ADDED=$(safe_grep "^+" "$DIFF_TMP" | safe_grep -v "^+++" \
      | safe_grep -v "^+import " | safe_grep -v "^+[[:space:]]*//" | wc -l | tr -d ' ')
    RAW_REMOVED=$(safe_grep "^-" "$DIFF_TMP" | safe_grep -v "^---" \
      | safe_grep -v "^-import " | safe_grep -v "^-[[:space:]]*//" | wc -l | tr -d ' ')

    if [[ "$RAW_ADDED" -gt 300 || "$RAW_REMOVED" -gt 300 ]]; then
      echo "  ⚠️  Large diff ($RAW_ADDED additions, $RAW_REMOVED removals) — may include"
      echo "  reformatted/reordered content, not all changes are necessarily new APIs."
    fi

    echo ""
    echo "-- ADDITIONS ($RAW_ADDED raw lines) --"
    safe_grep "^+" "$DIFF_TMP" | safe_grep -v "^+++" \
      | safe_grep -v "^+import " | safe_grep -v "^+[[:space:]]*//" \
      | sed 's/^+//' > "$SECTION_TMP"
    print_section "$SECTION_TMP"

    echo ""
    echo "-- REMOVALS ($RAW_REMOVED raw lines) --"
    safe_grep "^-" "$DIFF_TMP" | safe_grep -v "^---" \
      | safe_grep -v "^-import " | safe_grep -v "^-[[:space:]]*//" \
      | sed 's/^-//' > "$SECTION_TMP"
    print_section "$SECTION_TMP"

    echo ""
  done
}

# Allow sourcing for unit tests without executing main.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  main "$@"
fi
