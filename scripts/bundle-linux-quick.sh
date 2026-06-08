#!/bin/bash
# Bundle Ourboros for Linux (assumes cargo and web are already built)
# Usage: ./bundle-linux-quick.sh [tarball|appimage|deb]
# Default: tarball

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "${ROOT}"

OUTPUT_TYPE="${1:-tarball}"

# ANSI colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${CYAN}===============================================${NC}"
echo -e "${CYAN}  Ourboros Linux Bundle - Quick${NC}"
echo -e "${CYAN}===============================================${NC}"

# Check if binary exists
if [ ! -f "target/release/ourboros" ]; then
    echo -e "${RED}[ERROR] Missing: target/release/ourboros${NC}"
    echo ""
    echo -e "${YELLOW}Build the Rust backend first:${NC}"
    echo -e "${YELLOW}  cargo build -p ourboros --release${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Found binary: target/release/ourboros${NC}"

# Check if web dist exists
if [ ! -f "web/dist/index.html" ]; then
    echo -e "${RED}[ERROR] Missing: web/dist/index.html${NC}"
    echo ""
    echo -e "${YELLOW}Build the frontend first:${NC}"
    echo -e "${YELLOW}  cd web && npm install && npm run build && cd ..${NC}"
    exit 1
fi
echo -e "${GREEN}[OK] Found web dist: web/dist${NC}"

echo ""
echo -e "${CYAN}Creating bundle...${NC}"

# Clean and create bundle directory
rm -rf target/bundle-output
mkdir -p target/bundle-output/Ourboros/{bin,resources,share/applications}

# Copy binary
cp target/release/ourboros target/bundle-output/Ourboros/bin/ourboros
chmod +x target/bundle-output/Ourboros/bin/ourboros
echo -e "  ${GREEN}[+]${NC} Copied executable"

# Copy web resources
cp -r web/dist target/bundle-output/Ourboros/resources/web
echo -e "  ${GREEN}[+]${NC} Copied web resources"

# Create launcher script
cat > target/bundle-output/Ourboros/Ourboros << 'EOF'
#!/bin/bash
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export OURBOROS_APP_BUNDLE=1
exec "${SCRIPT_DIR}/bin/ourboros" "$@"
EOF
chmod +x target/bundle-output/Ourboros/Ourboros
echo -e "  ${GREEN}[+]${NC} Created launcher script"

# Create desktop entry
cat > target/bundle-output/Ourboros/share/applications/dev.newma.ourboros.desktop << EOF
[Desktop Entry]
Version=1.0
Type=Application
Name=Ourboros
Comment=Ourboros - Asset Library Management
Exec=$(pwd)/target/bundle-output/Ourboros/Ourboros
Icon=application-x-executable
Terminal=false
Categories=Utility;Office;
EOF
echo -e "  ${GREEN}[+]${NC} Created desktop entry"

case "${OUTPUT_TYPE}" in
    tarball)
        cd target/bundle-output
        tar -czf "Ourboros-0.1.0-linux-x86_64.tar.gz" Ourboros
        cd - > /dev/null
        SIZE=$(du -h target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz | cut -f1)
        echo -e "  ${GREEN}✓${NC} Created tarball (${SIZE})"
        ARCHIVE="target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz"
        ;;
    appimage)
        if command -v appimagetool &> /dev/null; then
            mkdir -p target/bundle-output/Ourboros/AppDir/usr/{bin,share}
            cp target/bundle-output/Ourboros/bin/ourboros target/bundle-output/Ourboros/AppDir/usr/bin/
            cp -r target/bundle-output/Ourboros/resources/web target/bundle-output/Ourboros/AppDir/usr/share/
            cat > target/bundle-output/Ourboros/AppDir/AppRun << 'EOFRUN'
#!/bin/bash
SELF="$(readlink -f "$0")"
HERE="${SELF%/*}"
export PATH="${HERE}/usr/bin:${PATH}"
export OURBOROS_APP_BUNDLE=1
exec "${HERE}/usr/bin/ourboros" "$@"
EOFRUN
            chmod +x target/bundle-output/Ourboros/AppDir/AppRun
            cd target/bundle-output
            appimagetool Ourboros/AppDir Ourboros-0.1.0-x86_64.AppImage
            cd - > /dev/null
            chmod +x target/bundle-output/Ourboros-0.1.0-x86_64.AppImage
            SIZE=$(du -h target/bundle-output/Ourboros-0.1.0-x86_64.AppImage | cut -f1)
            echo -e "  ${GREEN}[+]${NC} Created AppImage (${SIZE})"
            ARCHIVE="target/bundle-output/Ourboros-0.1.0-x86_64.AppImage"
        else
            echo -e "  ${YELLOW}[!]${NC} appimagetool not found, skipping AppImage"
            cd target/bundle-output
            tar -czf "Ourboros-0.1.0-linux-x86_64.tar.gz" Ourboros
            cd - > /dev/null
            SIZE=$(du -h target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz | cut -f1)
            echo -e "  ${GREEN}[+]${NC} Created fallback tarball (${SIZE})"
            ARCHIVE="target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz"
        fi
        ;;
    deb)
        if command -v dpkg-deb &> /dev/null; then
            mkdir -p target/bundle-output/Ourboros/deb_build/usr/{bin,share}
            cp target/bundle-output/Ourboros/bin/ourboros target/bundle-output/Ourboros/deb_build/usr/bin/
            cp -r target/bundle-output/Ourboros/resources/web target/bundle-output/Ourboros/deb_build/usr/share/ourboros
            mkdir -p target/bundle-output/Ourboros/deb_build/DEBIAN
            cat > target/bundle-output/Ourboros/deb_build/DEBIAN/control << EOFDEB
Package: ourboros
Version: 0.1.0
Architecture: amd64
Maintainer: gsxhnd <support@newma.dev>
Description: Ourboros - Asset Library Management
 A desktop application for managing asset libraries.
EOFDEB
            dpkg-deb --build target/bundle-output/Ourboros/deb_build target/bundle-output/ourboros_0.1.0_amd64.deb
            SIZE=$(du -h target/bundle-output/ourboros_0.1.0_amd64.deb | cut -f1)
            echo -e "  ${GREEN}[+]${NC} Created DEB package (${SIZE})"
            ARCHIVE="target/bundle-output/ourboros_0.1.0_amd64.deb"
        else
            echo -e "  ${YELLOW}[!]${NC} dpkg-deb not found, skipping DEB"
            cd target/bundle-output
            tar -czf "Ourboros-0.1.0-linux-x86_64.tar.gz" Ourboros
            cd - > /dev/null
            SIZE=$(du -h target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz | cut -f1)
            echo -e "  ${GREEN}[+]${NC} Created fallback tarball (${SIZE})"
            ARCHIVE="target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz"
        fi
        ;;
    *)
        echo -e "${RED}[ERROR] Unknown format: ${OUTPUT_TYPE}${NC}"
        echo -e "${YELLOW}Usage: $0 [tarball|appimage|deb]${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${CYAN}===============================================${NC}"
echo -e "${GREEN}Bundle ready!${NC}"
echo -e "${CYAN}===============================================${NC}"

echo ""
echo -e "${CYAN}Location: ${ARCHIVE}${NC}"
echo ""

case "${OUTPUT_TYPE}" in
    tarball)
        echo -e "${YELLOW}Extract and run:${NC}"
        echo -e "  tar -xzf ${ARCHIVE}"
        echo -e "  ./Ourboros/Ourboros"
        ;;
    appimage)
        echo -e "${YELLOW}Run directly:${NC}"
        echo -e "  ${ARCHIVE}"
        ;;
    deb)
        echo -e "${YELLOW}Install:${NC}"
        echo -e "  sudo dpkg -i ${ARCHIVE}"
        echo -e "  ourboros"
        ;;
esac

echo ""
echo -e "${CYAN}Web UI: http://127.0.0.1:8080${NC}"
