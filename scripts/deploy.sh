#!/usr/bin/env bash
# Guarded deploy helper for THIS app (lumina-creators-app).
# It PRINTS the database target before every deploy and REFUSES to proceed if it
# detects Bill's database. See DEPLOYMENT.md.
#
#   scripts/deploy.sh frontend   # deploy lumina-creators-app.vercel.app
#   scripts/deploy.sh backend    # redeploy the Render backend (branch feat/social-verify-join-gate)
set -euo pipefail

# ── Canonical targets for THIS app — do not change without updating DEPLOYMENT.md ──
APP_NAME="lumina-creators-app"
EXPECTED_DB="lumina_creators"                 # dpg-d92v6amh2hms73cv40g0
FORBIDDEN_DB="lumina_creators_staging"        # dpg-d94t… = Bill's app — NEVER deploy here
BACKEND_SRV="srv-d97tf1rtqb8s73dl744g"
BACKEND_URL="https://lumina-creators-api-app.onrender.com"
BACKEND_BRANCH="feat/social-verify-join-gate"
FRONTEND_ALIAS="https://lumina-creators-app.vercel.app"
VERCEL_PROJECT="prj_kg9jnxuc0snWYGY5a4dTQiuNusOU"
VERCEL_ORG="team_UmVDqekun0ZzNTbMKAjWFc3X"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKSPACE_ENV="$REPO_ROOT/../.env"

banner() {
  echo "────────────────────────────────────────────────────────────"
  echo "  APP:      $APP_NAME"
  echo "  DATABASE: $EXPECTED_DB  (dpg-d92v6…)   ← deploying to THIS db"
  echo "  BACKEND:  $BACKEND_URL"
  echo "  FRONTEND: $FRONTEND_ALIAS"
  echo "────────────────────────────────────────────────────────────"
}

guard_db() {   # $1 = a DATABASE_URL string to validate
  local url="$1"
  if echo "$url" | grep -q "$FORBIDDEN_DB"; then
    echo "❌ ABORT: DATABASE_URL points at $FORBIDDEN_DB (Bill's app). Refusing to deploy." >&2
    exit 1
  fi
  if ! echo "$url" | grep -q "$EXPECTED_DB"; then
    echo "❌ ABORT: DATABASE_URL does not contain '$EXPECTED_DB'. Refusing to deploy." >&2
    echo "   got: $(echo "$url" | sed -E 's#://[^@]+@#://****@#')" >&2
    exit 1
  fi
  echo "✓ database target verified: $EXPECTED_DB"
}

render_key() {
  local line key
  line="$(grep '^LUMINA_CREATORS_RENDER_API_KEY=' "$WORKSPACE_ENV" 2>/dev/null || true)"
  key="${line#*=}"; key="${key%\"}"; key="${key#\"}"
  if [ -z "$key" ]; then
    echo "❌ LUMINA_CREATORS_RENDER_API_KEY not found in $WORKSPACE_ENV" >&2; exit 1
  fi
  echo "$key"
}

case "${1:-}" in
  backend)
    banner
    KEY="$(render_key)"
    DBURL="$(curl -s "https://api.render.com/v1/services/$BACKEND_SRV/env-vars?limit=50" \
      -H "Authorization: Bearer $KEY" | python3 -c \
      "import sys,json;print(next((e.get('envVar',e).get('value','') for e in json.load(sys.stdin) if e.get('envVar',e).get('key')=='DATABASE_URL'),''))")"
    guard_db "$DBURL"
    echo "→ triggering Render deploy of $BACKEND_SRV (branch $BACKEND_BRANCH)…"
    curl -s -X POST "https://api.render.com/v1/services/$BACKEND_SRV/deploys" \
      -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -d '{}' \
      | python3 -c "import sys,json;d=json.load(sys.stdin);x=d.get('deploy',d);print('  deploy:',x.get('id'),x.get('status'))"
    ;;
  frontend)
    banner
    # frontend talks to the backend via PROD_BACKEND_URL in src/lib/api.ts — sanity-check it
    if ! grep -q "lumina-creators-api-app.onrender.com" "$REPO_ROOT/frontend/src/lib/api.ts"; then
      echo "❌ ABORT: frontend/src/lib/api.ts PROD_BACKEND_URL is not this app's backend." >&2; exit 1
    fi
    echo "✓ frontend PROD_BACKEND_URL → $BACKEND_URL"
    DEP="/private/tmp/lumina-fe-deploy"
    rm -rf "$DEP"; cp -al "$REPO_ROOT/frontend" "$DEP"
    rm -rf "$DEP/.next" "$DEP/.vercel"; mkdir -p "$DEP/.vercel"
    printf '{"projectId":"%s","orgId":"%s"}\n' "$VERCEL_PROJECT" "$VERCEL_ORG" > "$DEP/.vercel/project.json"
    echo "→ vercel --prod (builds server-side)…"
    (cd "$DEP" && vercel --prod --yes)
    ;;
  *)
    echo "usage: scripts/deploy.sh [frontend|backend]" >&2; exit 1 ;;
esac
