#!/bin/bash
# Build ourboros-app and package it as a macOS .app bundle
set -e

PROFILE="${1:-release}"
APP_NAME="Ourboros"
BINARY_NAME="ourboros-app"
BUNDLE_ID="xyz.gsxhnd.ourboros"

if [ "$PROFILE" = "release" ]; then
    cargo build -p ourboros-app --release
    BINARY_PATH="target/release/${BINARY_NAME}"
else
    cargo build -p ourboros-app
    BINARY_PATH="target/debug/${BINARY_NAME}"
fi

APP_DIR="target/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"

rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_DIR}"

cp "${BINARY_PATH}" "${MACOS_DIR}/${BINARY_NAME}"

# Create Info.plist
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
    <string>${BINARY_NAME}</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSUIElement</key>
    <true/>
    <key>LSMinimumSystemVersion</key>
    <string>10.13</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
EOF

echo "Built: ${APP_DIR}"
echo ""
echo "To run: open ${APP_DIR}"
echo "To install: cp -r ${APP_DIR} /Applications/"
