# Ourboros Build Scripts

This directory contains build and bundling scripts for packaging the Ourboros desktop application.

## Quick Start

### 🚀 Quick Package (if cargo and web are already built)

#### Windows

```powershell
# Fast bundle (checks for existing artifacts only)
.\bundle-windows-quick.ps1
```

#### Linux

```bash
# Fast bundle - create tarball (default)
./bundle-linux-quick.sh tarball

# Or other formats
./bundle-linux-quick.sh appimage
./bundle-linux-quick.sh deb
```

### Full Build & Package

#### Windows

```powershell
# One-command build and package
.\build-and-bundle.ps1

# Or specific steps
.\build-and-bundle.ps1 backend
.\build-and-bundle.ps1 frontend
.\build-and-bundle.ps1 bundle-windows
```

#### macOS/Linux

```bash
# One-command build and package
bash build-and-bundle.sh

# Or specific steps
bash build-and-bundle.sh backend
bash build-and-bundle.sh frontend
bash build-and-bundle.sh bundle-macos    # macOS only
bash build-and-bundle.sh bundle-linux    # Linux only
```

## Scripts Overview

### Quick Scripts (check only, no build)

#### 1. `bundle-windows-quick.ps1`

Windows quick bundler. Assumes `target/release/ourboros.exe` and `web/dist` are already built.

**Usage:**

```powershell
.\scripts\bundle-windows-quick.ps1
```

**What it does:**

- ✓ Checks for compiled binary
- ✓ Checks for built web resources
- ✓ Copies to bundle directory
- ✓ Creates launcher script

**Output:** `target/bundle-output/Ourboros/` (ready to run)

#### 2. `bundle-linux-quick.sh`

Linux quick bundler. Assumes `target/release/ourboros` and `web/dist` are already built.

**Usage:**

```bash
./scripts/bundle-linux-quick.sh [tarball|appimage|deb]
```

**What it does:**

- ✓ Checks for compiled binary
- ✓ Checks for built web resources
- ✓ Creates appropriate package format
- ✓ Falls back to tarball if optional tools unavailable

**Output:**

- Tarball: `target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz`
- AppImage: `target/bundle-output/Ourboros-0.1.0-x86_64.AppImage` (if appimagetool available)
- DEB: `target/bundle-output/ourboros_0.1.0_amd64.deb` (if dpkg available)

---

### Full Build Scripts

#### 1. `build-and-bundle.ps1` (Windows PowerShell)

Cross-platform build orchestrator for Windows.

**Usage:**

```powershell
.\build-and-bundle.ps1 [target]
```

**Targets:**

- `all` (default) - Build backend, frontend, and create Windows bundle
- `backend` - Compile Rust code only
- `frontend` - Build React/TypeScript UI only
- `bundle-windows` - Package as Windows executable
- `clean` - Remove all build artifacts

### 2. `build-and-bundle.sh` (Bash)

Cross-platform build orchestrator for macOS/Linux.

**Usage:**

```bash
bash build-and-bundle.sh [target]
```

**Targets:**

- `all` (default) - Build backend, frontend, and create platform-specific bundle
- `backend` - Compile Rust code only
- `frontend` - Build React/TypeScript UI only
- `bundle-macos` - Package as macOS .app (macOS only)
- `bundle-linux` - Package as Linux tarball (Linux only)
- `clean` - Remove all build artifacts

### 3. `bundle-windows.ps1` (Windows PowerShell)

Windows-specific bundler. Creates a portable application directory with all dependencies.

**Usage:**

```powershell
.\scripts\bundle-windows.ps1 [-OutputType exe|portable|msi]
```

**Output:**

- `target/bundle-output/Ourboros/` - Portable bundle with .exe, launcher, and web resources
- Supports `.exe`, portable, or MSI output types

**Requirements:**

- Compiled `target/release/ourboros.exe`
- Built `web/dist/` directory
- For MSI: [WiX Toolset](https://wixtoolset.org/releases/)

### 4. `bundle-linux.sh` (Bash)

Linux-specific bundler. Creates tarball, AppImage, or DEB package.

**Usage:**

```bash
./scripts/bundle-linux.sh [appimage|tarball|deb]
```

**Output:**

- `target/bundle-output/Ourboros/` - Base bundle directory
- `Ourboros-0.1.0-linux-x86_64.tar.gz` - Compressed tarball
- `Ourboros-0.1.0-x86_64.AppImage` - Standalone AppImage (if appimagetool available)
- `ourboros_0.1.0_amd64.deb` - Debian package (if dpkg available)

**Requirements:**

- Compiled `target/release/ourboros`
- Built `web/dist/` directory
- For AppImage: [AppImageKit](https://github.com/AppImage/AppImageKit)
- For DEB: `dpkg` package manager

### 5. `bundle-macos.sh` (Bash)

macOS-specific bundler. Creates a standard .app bundle.

**Usage:**

```bash
./scripts/bundle-macos.sh
```

**Output:**

- `target/Ourboros.app/` - macOS application bundle

**Requirements:**

- Compiled `target/release/ourboros`
- Built `web/dist/` directory
- `codesign` (for ad-hoc signing, optional)

## Prerequisites

### All Platforms

- **Rust Toolchain**: [Install Rust](https://rustup.rs/)

  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```

- **Node.js & npm**: Version 18+ recommended

  ```bash
  # macOS
  brew install node
  
  # Ubuntu/Debian
  sudo apt-get install nodejs npm
  
  # Windows
  # Download from https://nodejs.org/
  ```

### macOS Additional

- Command Line Tools

  ```bash
  xcode-select --install
  ```

### Linux Additional

For additional bundle formats:

```bash
# For AppImage support
sudo apt-get install fuse libfuse2

# For DEB support (usually pre-installed)
sudo apt-get install dpkg
```

### Windows Additional

- PowerShell 5.1+
- For MSI creation: [WiX Toolset](https://wixtoolset.org/releases/)

## Complete Build Workflow

### Option 1: Quick Package (if artifacts already built)

Fastest option if you've already compiled Rust and built the frontend.

#### Windows

```powershell
# Just bundle
.\bundle-windows-quick.ps1

# Test
.\target\bundle-output\Ourboros\Ourboros.exe
```

#### Linux

```bash
# Just bundle
./bundle-linux-quick.sh tarball

# Extract and test
tar -xzf target/bundle-output/Ourboros-0.1.0-linux-x86_64.tar.gz
./Ourboros/Ourboros
```

### Option 2: Full Build Workflow

Complete workflow including compilation.

#### Windows

```powershell
# 1. One-command build
.\build-and-bundle.ps1

# 2. Find output
.\target\bundle-output\Ourboros\

# 3. Test
.\target\bundle-output\Ourboros\Ourboros.exe

# 4. Create shortcut (optional)
# Right-click Ourboros.exe → Send to → Desktop (create shortcut)
```

#### macOS

```bash
# 1. One-command build
bash build-and-bundle.sh

# 2. Find output
target/Ourboros.app/

# 3. Test
open target/Ourboros.app

# 4. Install (optional)
cp -r target/Ourboros.app /Applications/
```

#### Linux

```bash
# 1. One-command build (creates tarball + AppImage + DEB if available)
bash build-and-bundle.sh all

# 2. Extract and test
tar -xzf target/bundle-output/Ourboros-*.tar.gz
./Ourboros/Ourboros

# 3. Install system-wide (DEB)
sudo dpkg -i target/bundle-output/ourboros_*.deb
ourboros
```

---

## Environment Variables

When applications are bundled and executed, the following environment variable is set:

- `OURBOROS_APP_BUNDLE=1` - Indicates the application is running as a bundle

This can be used in the application code to detect bundle execution mode:

```rust
let is_bundle = std::env::var("OURBOROS_APP_BUNDLE").is_ok();
```

## Troubleshooting

### Build Failures

**Issue:** `cargo not found`

- **Solution:** Install Rust: <https://rustup.rs/>

**Issue:** `npm not found`

- **Solution:** Install Node.js: <https://nodejs.org/>

**Issue:** `web/dist not found`

- **Solution:** Build frontend first

  ```bash
  cd web && npm install && npm run build && cd ..
  ```

### Windows-Specific

**Issue:** PowerShell execution policy prevents script running

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

**Issue:** `bundle-windows.ps1` not found

```powershell
# Ensure you're in the project root
cd path\to\ourboros
.\scripts\bundle-windows.ps1
```

### Linux-Specific

**Issue:** Script permission denied

```bash
chmod +x scripts/bundle-linux.sh
chmod +x scripts/build-and-bundle.sh
```

**Issue:** AppImage or DEB creation fails

- Install required tools as shown in Prerequisites
- Script will fall back to tarball format if unavailable

## Output Structure

After bundling, the output directory structure is:

```
target/
├── bundle-output/          # Bundled applications
│   └── Ourboros/
│       ├── bin/            # Linux/macOS binaries
│       ├── resources/
│       │   └── web/        # Frontend assets
│       ├── share/          # Desktop integration files
│       └── run.bat         # Windows launcher
├── Ourboros.app/           # macOS bundle (if on macOS)
└── release/                # Compiled binaries
    ├── ourboros            # Linux/macOS executable
    └── ourboros.exe        # Windows executable
```

## Development Tips

### Fast Development Builds

For testing without full bundling:

```bash
# Development build (faster compilation)
cargo build -p ourboros

# Run directly
./target/debug/ourboros

# Or with frontend served from Vite dev server
# Terminal 1:
cd web && npm run dev

# Terminal 2:
OURBOROS_WEB_DEV=http://localhost:5173 cargo run -p ourboros
```

### Incremental Building

```bash
# Only rebuild changed Rust code
cargo build -p ourboros --release

# Only rebuild frontend
cd web && npm run build && cd ..

# Then re-bundle
.\scripts\bundle-windows.ps1
```

## Version Management

Version numbers are centrally managed in `Cargo.toml`:

```toml
[workspace.package]
version = "0.1.0"
```

Update this single location to change the version for all packages and bundles.

## Distribution

### GitHub Releases

```bash
# Create release artifacts
./build-and-bundle.ps1  # or .sh

# Package for distribution
# Windows
zip -r Ourboros-0.1.0-windows.zip target/bundle-output/Ourboros/

# macOS
ditto -c -k --sequesterRsrc target/Ourboros.app Ourboros-0.1.0-macos.zip

# Linux
tar -czf Ourboros-0.1.0-linux.tar.gz target/bundle-output/Ourboros/
```

## License

Ourboros is licensed under the MIT License. See [LICENSE](../LICENSE) for details.
