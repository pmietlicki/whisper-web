#!/bin/sh
set -eu

config_file="/usr/share/nginx/html/runtime-config.js"

json_escape() {
    printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g'
}

live_ws_url="${LIVE_TRANSCRIPTION_WS_URL:-${VITE_LIVE_TRANSCRIPTION_WS_URL:-}}"
live_server="${LIVE_TRANSCRIPTION_SERVER:-${VITE_LIVE_TRANSCRIPTION_SERVER:-auto}}"
live_model="${LIVE_TRANSCRIPTION_MODEL:-${VITE_LIVE_TRANSCRIPTION_MODEL:-small}}"

cat > "$config_file" <<EOF
window.__WHISPER_WEB_CONFIG__ = {
    liveTranscriptionWsUrl: "$(json_escape "$live_ws_url")",
    liveTranscriptionServer: "$(json_escape "$live_server")",
    liveTranscriptionModel: "$(json_escape "$live_model")",
};
EOF
