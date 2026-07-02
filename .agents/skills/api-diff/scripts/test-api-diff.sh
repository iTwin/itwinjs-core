#!/usr/bin/env bash
# test-api-diff.sh — unit tests for api-diff.sh logic.
# Run from anywhere: .agents/skills/api-diff/scripts/test-api-diff.sh
# No external test framework required.

set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Source the production script to test the real functions — not copies of them.
# The BASH_SOURCE guard in api-diff.sh prevents main() from executing on source.
# shellcheck source=api-diff.sh
source "$SCRIPT_DIR/api-diff.sh"

PASS=0; FAIL=0

assert_eq() {
  local desc="$1" expected="$2" actual="$3"
  if [[ "$expected" == "$actual" ]]; then
    echo "  ✅  $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $desc"
    echo "      expected: $(printf '%q' "$expected")"
    echo "      actual:   $(printf '%q' "$actual")"
    FAIL=$((FAIL + 1))
  fi
}

assert_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ✅  $desc"
    PASS=$((PASS + 1))
  else
    echo "  ❌  $desc (did not find: $needle)"
    FAIL=$((FAIL + 1))
  fi
}

assert_not_contains() {
  local desc="$1" needle="$2" haystack="$3"
  if echo "$haystack" | grep -qF "$needle"; then
    echo "  ❌  $desc (unexpectedly found: $needle)"
    FAIL=$((FAIL + 1))
  else
    echo "  ✅  $desc"
    PASS=$((PASS + 1))
  fi
}

# ── Test suite 1: ref_to_minor_ver (sourced from api-diff.sh) ─────────────
echo ""
echo "=== ref_to_minor_ver ==="
assert_eq "release/5.9.0  → 5.9"    "5.9"    "$(ref_to_minor_ver "release/5.9.0")"
assert_eq "release/5.10.0 → 5.10"   "5.10"   "$(ref_to_minor_ver "release/5.10.0")"
assert_eq "release/4.11.0 → 4.11"   "4.11"   "$(ref_to_minor_ver "release/4.11.0")"
assert_eq "release/5.9.x  → 5.9"    "5.9"    "$(ref_to_minor_ver "release/5.9.x")"
assert_eq "release/5.10.x → 5.10"   "5.10"   "$(ref_to_minor_ver "release/5.10.x")"
assert_eq "release/4.11.x → 4.11"   "4.11"   "$(ref_to_minor_ver "release/4.11.x")"
assert_eq "v5.9.5         → 5.9"    "5.9"    "$(ref_to_minor_ver "v5.9.5")"
assert_eq "v4.11.0        → 4.11"   "4.11"   "$(ref_to_minor_ver "v4.11.0")"
assert_eq "master         → master"  "master" "$(ref_to_minor_ver "master")"
assert_eq "main           → master"  "master" "$(ref_to_minor_ver "main")"
assert_eq "unknown-ref    → empty"   ""       "$(ref_to_minor_ver "some-feature-branch")"

# ── Test suite 2: Python changelog version filtering ──────────────────────
echo ""
echo "=== Python changelog version filtering ==="

TEST_TMPDIR=$(mktemp -d)
trap 'rm -rf "$TEST_TMPDIR"' EXIT

for v in 4.11 5.0 5.1 5.2 5.9 5.10; do
  printf "# %s Change Notes\n## Section A\n### Sub A\n" "$v" > "$TEST_TMPDIR/${v}.0.md"
done

# Run the same Python logic as show_changelogs uses, but returning just filenames
# so test assertions stay simple (no file content noise).
run_filter() {
  local base="$1" head="$2"
  shift 2
  local files=("$@")
  python3 - "$base" "$head" "${files[@]}" << 'PYEOF'
import sys, re

base_ver = sys.argv[1]
head_ver = sys.argv[2]
files    = sys.argv[3:]

def parse_ver(s):
    m = re.match(r'^(\d+)\.(\d+)$', s)
    return (int(m.group(1)), int(m.group(2))) if m else None

def ver_from_path(p):
    m = re.search(r'(\d+)\.(\d+)\.0\.md$', p)
    return (int(m.group(1)), int(m.group(2))) if m else None

base = parse_ver(base_ver)
head = parse_ver(head_ver)

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
    print("(none)")
else:
    for v, f in selected:
        print(f"{v[0]}.{v[1]}.0.md")
PYEOF
}

ALL_LOGS=(
  "$TEST_TMPDIR/4.11.0.md" "$TEST_TMPDIR/5.0.0.md" "$TEST_TMPDIR/5.1.0.md"
  "$TEST_TMPDIR/5.2.0.md"  "$TEST_TMPDIR/5.9.0.md" "$TEST_TMPDIR/5.10.0.md"
)

OUT=$(run_filter "4.11" "5.10" "${ALL_LOGS[@]}")
assert_contains     "4.11→5.10 includes 5.0"     "5.0.0.md"  "$OUT"
assert_contains     "4.11→5.10 includes 5.10"    "5.10.0.md" "$OUT"
assert_not_contains "4.11→5.10 excludes 4.11"    "4.11.0.md" "$OUT"

OUT=$(run_filter "5.9" "5.10" "${ALL_LOGS[@]}")
assert_contains     "5.9→5.10 includes 5.10"     "5.10.0.md" "$OUT"
assert_not_contains "5.9→5.10 excludes 5.9"      "5.9.0.md"  "$OUT"
assert_not_contains "5.9→5.10 excludes 5.0"      "5.0.0.md"  "$OUT"

OUT=$(run_filter "5.0" "5.2" "${ALL_LOGS[@]}")
assert_contains     "5.0→5.2 includes 5.1"       "5.1.0.md"  "$OUT"
assert_contains     "5.0→5.2 includes 5.2"       "5.2.0.md"  "$OUT"
assert_not_contains "5.0→5.2 excludes 5.0"       "5.0.0.md"  "$OUT"
assert_not_contains "5.0→5.2 excludes 5.9"       "5.9.0.md"  "$OUT"

OUT=$(run_filter "5.9" "master" "${ALL_LOGS[@]}")
assert_contains     "5.9→master includes 5.10"   "5.10.0.md" "$OUT"
assert_not_contains "5.9→master excludes 5.9"    "5.9.0.md"  "$OUT"

OUT=$(run_filter "5.10" "5.10" "${ALL_LOGS[@]}")
assert_contains     "equal base/head → (none)"   "(none)"     "$OUT"

# Numeric sort: 5.9 must precede 5.10 (lexicographic order would fail this)
OUT=$(run_filter "5.8" "5.10" "${ALL_LOGS[@]}")
FIRST=$(echo "$OUT" | grep -E '5\.(9|10)\.0\.md$' | head -1)
assert_eq           "5.9 sorts before 5.10"      "5.9.0.md"  "$FIRST"

# ── Test suite 3: smoke test — script accepts args and runs ───────────────
echo ""
echo "=== Smoke test (requires git) ==="
if command -v git &>/dev/null && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  OUT=$("$SCRIPT_DIR/api-diff.sh" "HEAD~1" "HEAD" 2>&1) || true
  assert_contains "script runs on HEAD~1..HEAD" "API diff:" "$OUT"
else
  echo "  ⚠️  Skipping (not in a git repo)"
fi

# ── Summary ───────────────────────────────────────────────────────────────
echo ""
echo "Results: $PASS passed, $FAIL failed"
[[ "$FAIL" -eq 0 ]] || exit 1
