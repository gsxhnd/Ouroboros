#!/bin/bash
# Package release artifacts as a macOS .app bundle (does not compile).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

APP_NAME="Ourboros"
EXECUTABLE_NAME="Ourboros"
RELEASE_BINARY_NAME="ourboros"
BUNDLE_ID="dev.newma.ourboros"
BINARY_PATH="target/release/${RELEASE_BINARY_NAME}"
WEB_DIST="web/dist"

if [ ! -f "${BINARY_PATH}" ]; then
    echo "error: missing release binary: ${BINARY_PATH}" >&2
    echo "Run: cargo build -p ourboros --release" >&2
    exit 1
fi

if [ ! -f "${WEB_DIST}/index.html" ]; then
    echo "error: missing web dist: ${WEB_DIST}/index.html" >&2
    echo "Run: npm run build (in web/)" >&2
    exit 1
fi

APP_DIR="target/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"

cp "${BINARY_PATH}" "${MACOS_DIR}/${EXECUTABLE_NAME}"
chmod +x "${MACOS_DIR}/${EXECUTABLE_NAME}"

cp -R "${WEB_DIST}" "${RESOURCES_DIR}/web"
echo "Bundled web UI from ${WEB_DIST}"

# LSUIElement=true tells macOS this is an agent app (no Dock icon, no terminal)
cat > "${CONTENTS_DIR}/Info.plist" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleDisplayName</key>
    <string>${APP_NAME}</string>
    <key>CFBundleIdentifier</key>
    <string>${BUNDLE_ID}</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleExecutable</key>
    <string>${EXECUTABLE_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>LSEnvironment</key>
    <dict>
        <key>OURBOROS_APP_BUNDLE</key>
        <string>1</string>
    </dict>
</dict>
</plist>
EOF

# Ad-hoc sign so Finder/Gatekeeper allows launching the unsigned dev bundle.
if command -v codesign >/dev/null 2>&1; then
    codesign --force --deep -s - "${APP_DIR}"
    echo "Signed: ${APP_DIR} (ad-hoc)"
else
    echo "warning: codesign not found; Finder may block the unsigned bundle" >&2
fi

echo "Built: ${APP_DIR}"
echo ""
echo "To run: open ${APP_DIR}"
echo "To install: cp -r ${APP_DIR} /Applications/"
echo "Note: LSUIElement hides the Dock icon; use the menu bar tray icon or visit http://127.0.0.1:8080"
