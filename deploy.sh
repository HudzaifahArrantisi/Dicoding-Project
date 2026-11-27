#!/usr/bin/env bash
#
# deploy.sh - gerbang lokal sebelum push.
#
# Menjalankan pemeriksaan yang sama dengan job "checks" di CI, lalu commit dan
# push ke branch yang sedang aktif. Jika satu pemeriksaan gagal, script berhenti
# dan tidak ada commit maupun push.
#
# Pemakaian:
#   bash ./deploy.sh                        # cek + commit "deploy update" + push
#   bash ./deploy.sh -m "feat: sesuatu"     # pesan commit kustom
#   bash ./deploy.sh --skip-tests           # lewati typecheck/lint/test:ci
#   bash ./deploy.sh --skip-build           # lewati build web (cepat, tapi tidak setara CI)
#   bash ./deploy.sh --no-install           # lewati bun install --frozen-lockfile
#   bash ./deploy.sh --no-push              # cek + commit, tanpa push
#   bash ./deploy.sh --dry-run              # tampilkan perintah tanpa menjalankannya
#
# Exit code: 0 sukses, 1 pemeriksaan gagal, 2 pemakaian salah atau kondisi repo tidak aman.

set -euo pipefail

MESSAGE="deploy update"
RUN_TESTS=1
RUN_BUILD=1
RUN_INSTALL=1
DO_PUSH=1
DRY_RUN=0

usage() {
  sed -n '2,20p' "$0" | sed 's/^# \{0,1\}//'
}

while [ $# -gt 0 ]; do
  case "$1" in
    -m|--message)
      [ $# -ge 2 ] || { echo "deploy: -m butuh argumen pesan" >&2; exit 2; }
      MESSAGE="$2"
      shift 2
      ;;
    --skip-tests)
      RUN_TESTS=0
      shift
      ;;
    --skip-build)
      RUN_BUILD=0
      shift
      ;;
    --no-install)
      RUN_INSTALL=0
      shift
      ;;
    --no-push)
      DO_PUSH=0
      shift
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "deploy: argumen tidak dikenal: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [ -t 1 ]; then
  BOLD=$(printf '\033[1m'); DIM=$(printf '\033[2m'); RED=$(printf '\033[31m')
  GREEN=$(printf '\033[32m'); YELLOW=$(printf '\033[33m'); RESET=$(printf '\033[0m')
else
  BOLD=""; DIM=""; RED=""; GREEN=""; YELLOW=""; RESET=""
fi

step() { printf '\n%s==> %s%s\n' "$BOLD" "$1" "$RESET"; }
ok() { printf '%s  ok  %s%s\n' "$GREEN" "$1" "$RESET"; }
warn() { printf '%s  --  %s%s\n' "$YELLOW" "$1" "$RESET"; }
fail() { printf '%s gagal %s %s\n' "$RED" "$1" "$RESET" >&2; }

run() {
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '%s  %s$ %s%s\n' "$DIM" "$(pwd)" "$*" "$RESET"
    return 0
  fi
  printf '%s  %s$ %s%s\n' "$DIM" "$(pwd)" "$*" "$RESET"
  "$@"
}

# 0. Pastikan dijalankan dari dalam repo git.
if ! ROOT=$(git rev-parse --show-toplevel 2>/dev/null); then
  fail "bukan repository git"
  exit 2
fi
cd "$ROOT"

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
if [ -z "$BRANCH" ] || [ "$BRANCH" = "HEAD" ]; then
  fail "HEAD detached; checkout branch dulu sebelum deploy"
  exit 2
fi

for marker in MERGE_HEAD REBASE_HEAD CHERRY_PICK_HEAD; do
  if [ -e "$(git rev-parse --git-path "$marker")" ]; then
    fail "operasi git masih berjalan ($marker); selesaikan dulu"
    exit 2
  fi
done

printf '%sDaisuki deploy%s\n' "$BOLD" "$RESET"
printf '  repo   : %s\n' "$ROOT"
printf '  branch : %s\n' "$BRANCH"
printf '  pesan  : %s\n' "$MESSAGE"
[ "$DRY_RUN" -eq 1 ] && printf '  mode   : dry-run (tidak dieksekusi)\n'

if ! command -v bun >/dev/null 2>&1; then
  fail "bun tidak ditemukan di PATH"
  exit 2
fi

# 1. Pemeriksaan kode (setara job "checks" di CI).
if [ "$RUN_INSTALL" -eq 1 ]; then
  step "Install dependensi (frozen lockfile)"
  run bun install --frozen-lockfile
  ok "dependensi sinkron"
else
  warn "install dilewati (--no-install)"
fi

if [ "$RUN_TESTS" -eq 1 ]; then
  step "Typecheck web + API"
  run bun run typecheck
  ok "typecheck"

  step "Lint web"
  run bun run --cwd apps/web lint
  ok "lint"

  step "Cek sintaks dashboard graph"
  run node --check apps/graph/public/app.js
  ok "graph syntax"

  PY=""
  for candidate in python3 python; do
    if command -v "$candidate" >/dev/null 2>&1; then PY="$candidate"; break; fi
  done
  if [ -n "$PY" ]; then
    step "Cek sintaks Python (ai + data-science)"
    run "$PY" -c "import pathlib, py_compile; files=[p for d in ('ai','data-science') for p in pathlib.Path(d).rglob('*.py') if '.venv' not in p.parts]; [py_compile.compile(str(f), doraise=True) for f in files]; print(f'py_compile OK: {len(files)} files')"
    ok "py_compile"
  else
    warn "python tidak ditemukan; cek sintaks Python dilewati"
  fi

  step "Unit test offline (test:ci)"
  run bun run test:ci
  ok "test:ci"
else
  warn "typecheck/lint/test dilewati (--skip-tests)"
fi

# 2. Build web (membuktikan bundel bisa dibuat sebelum CI membangunnya).
if [ "$RUN_BUILD" -eq 1 ]; then
  step "Build web"
  run bun run --cwd apps/web build
  ok "build web"
else
  warn "build web dilewati (--skip-build)"
fi

# 3. Commit.
step "Tahap perubahan"
if [ "$DRY_RUN" -eq 1 ]; then
  printf '%s  $ git add -A%s\n' "$DIM" "$RESET"
else
  git add -A
fi

if [ "$DRY_RUN" -eq 0 ] && git diff --cached --quiet; then
  warn "tidak ada perubahan untuk di-commit"
  if [ "$DO_PUSH" -eq 1 ]; then
    step "Push"
    if git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
      run git push origin "$BRANCH"
    else
      run git push -u origin "$BRANCH"
    fi
    ok "push selesai"
  fi
  exit 0
fi

step "Commit"
run git commit -m "$MESSAGE"
if [ "$DRY_RUN" -eq 0 ]; then
  ok "commit $(git rev-parse --short HEAD)"
fi

# 4. Push ke branch aktif.
if [ "$DO_PUSH" -eq 1 ]; then
  step "Push ke origin/$BRANCH"
  if [ "$DRY_RUN" -eq 1 ]; then
    printf '%s  $ git push (upstream otomatis bila belum ada)%s\n' "$DIM" "$RESET"
  elif git rev-parse --abbrev-ref --symbolic-full-name '@{u}' >/dev/null 2>&1; then
    run git push origin "$BRANCH"
    ok "push selesai"
  else
    run git push -u origin "$BRANCH"
    ok "push selesai (upstream diset ke origin/$BRANCH)"
  fi
else
  warn "push dilewati (--no-push)"
fi

printf '\n%sSelesai.%s Pipeline GitHub Actions akan menjalankan checks lalu deploy tiga Worker.\n' "$GREEN" "$RESET"
