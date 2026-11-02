#!/usr/bin/env bash
# ANIMUS Career installer for macOS and Linux.
#   • Python venv + `animus` command
#   • background service (launchd on macOS, systemd --user on Linux) so scans and alerts run on their own
#   • a launcher (ANIMUS Career.app on macOS, a .desktop entry on Linux)
# Your data lives in ~/.animus_career (override with ANIMUS_HOME), never inside this folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PY="$ROOT/.venv/bin/python"
PORT="${JOBAGENT_PORT:-8765}"
URL="http://127.0.0.1:$PORT"
OS="$(uname -s)"

command -v python3 >/dev/null || { echo "Python 3.10+ is required: https://www.python.org/downloads/"; exit 1; }
python3 -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)' || { echo "Python 3.10+ is required."; exit 1; }

echo "→ Python environment"
[ -x "$PY" ] || python3 -m venv "$ROOT/.venv"
"$ROOT/.venv/bin/pip" install -q --upgrade pip
"$ROOT/.venv/bin/pip" install -q -e "$ROOT"

echo "→ animus command"
mkdir -p "$HOME/.local/bin"
ln -sf "$ROOT/.venv/bin/animus" "$HOME/.local/bin/animus"
case ":$PATH:" in *":$HOME/.local/bin:"*) ;; *) echo "  (add ~/.local/bin to your PATH to use 'animus' everywhere)";; esac

SERVICE_PATH="$HOME/.local/bin:$HOME/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
if [ "$OS" = "Darwin" ]; then
  echo "→ Background service (launchd)"
  LABEL="com.animus_career.server"; PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
  LOGDIR="${ANIMUS_HOME:-$HOME/.animus_career}/logs"; mkdir -p "$HOME/Library/LaunchAgents" "$LOGDIR"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$PY</string><string>-m</string><string>animus_career.cli</string><string>serve</string><string>--port</string><string>$PORT</string></array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$SERVICE_PATH</string>${ANIMUS_HOME:+<key>ANIMUS_HOME</key><string>$ANIMUS_HOME</string>}</dict>
  <key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
  <key>StandardOutPath</key><string>$LOGDIR/server.log</string><key>StandardErrorPath</key><string>$LOGDIR/server.err</string>
</dict></plist>
EOF
  launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
  launchctl bootstrap "gui/$(id -u)" "$PLIST"

  echo "→ ANIMUS Career.app"
  APP="$HOME/Applications/ANIMUS Career.app"; mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
  cat > "$APP/Contents/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>CFBundleName</key><string>ANIMUS Career</string><key>CFBundleIdentifier</key><string>com.animus_career.app</string>
<key>CFBundleExecutable</key><string>ANIMUS Career</string><key>CFBundleIconFile</key><string>icon</string><key>CFBundlePackageType</key><string>APPL</string></dict></plist>
EOF
  cat > "$APP/Contents/MacOS/ANIMUS Career" <<EOF
#!/bin/bash
"$PY" -m animus_career.cli open --port $PORT
EOF
  chmod +x "$APP/Contents/MacOS/ANIMUS Career"
  "$PY" "$ROOT/scripts/make_icon.py" "$APP/Contents/Resources/icon.icns" 2>/dev/null || true
else
  echo "→ Background service (systemd --user)"
  UNIT_DIR="$HOME/.config/systemd/user"; mkdir -p "$UNIT_DIR"
  cat > "$UNIT_DIR/animus_career.service" <<EOF
[Unit]
Description=ANIMUS Career local server and scheduler
[Service]
ExecStart=$PY -m animus_career.cli serve --port $PORT
WorkingDirectory=$ROOT
Environment=PATH=$SERVICE_PATH
${ANIMUS_HOME:+Environment=ANIMUS_HOME=$ANIMUS_HOME}
Restart=on-failure
[Install]
WantedBy=default.target
EOF
  if command -v systemctl >/dev/null && systemctl --user daemon-reload 2>/dev/null; then
    systemctl --user enable --now animus_career.service
  else
    echo "  systemd --user not available: start it with 'animus serve' (e.g. from your session autostart)."
  fi
  echo "→ Launcher"
  mkdir -p "$HOME/.local/share/applications"
  cat > "$HOME/.local/share/applications/animus_career.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=ANIMUS Career
Exec=$PY -m animus_career.cli open --port $PORT
Terminal=false
Categories=Office;
EOF
fi

echo
echo "✅ Installed. Open $URL (or run: animus open) — the setup wizard starts on first launch."
echo "   Terminal setup instead: animus setup"
