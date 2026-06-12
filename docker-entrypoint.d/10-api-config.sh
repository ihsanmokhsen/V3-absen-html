#!/bin/sh
set -eu

CONFIG_PATH="/usr/share/nginx/html/api-config.js"
EXAMPLE_PATH="/usr/share/nginx/html/api-config.example.js"

escape_js_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

if [ -n "${API_USER:-}" ] && [ -n "${API_PASS:-}" ]; then
  ESCAPED_USER="$(escape_js_string "$API_USER")"
  ESCAPED_PASS="$(escape_js_string "$API_PASS")"

  cat > "$CONFIG_PATH" <<EOF
window.__BPAD_API_CONFIG = {
  url: "/api",
  user: "$ESCAPED_USER",
  pass: "$ESCAPED_PASS"
};
EOF
else
  cp "$EXAMPLE_PATH" "$CONFIG_PATH"
  echo "WARNING: API_USER or API_PASS is empty. Using example API config."
fi
