#!/bin/sh
set -eu

CONFIG_PATH="/usr/share/nginx/html/supabase.local.js"
EXAMPLE_PATH="/usr/share/nginx/html/supabase.local.example.js"

escape_js_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [ -n "${SUPABASE_URL:-}" ] && [ -n "${SUPABASE_ANON_KEY:-}" ]; then
  ESCAPED_URL="$(escape_js_string "$SUPABASE_URL")"
  ESCAPED_KEY="$(escape_js_string "$SUPABASE_ANON_KEY")"

  cat > "$CONFIG_PATH" <<EOF
window.__BPAD_SUPABASE_CONFIG = {
  url: "$ESCAPED_URL",
  anonKey: "$ESCAPED_KEY"
};
EOF
else
  cp "$EXAMPLE_PATH" "$CONFIG_PATH"
  echo "WARNING: SUPABASE_URL or SUPABASE_ANON_KEY is empty. Using example Supabase config."
fi
