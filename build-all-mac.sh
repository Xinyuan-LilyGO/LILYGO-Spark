#!/bin/bash

# Build script for all macOS architectures
# Usage: ./build-all-mac.sh

set -e  # Exit on error

echo "🧹 Cleaning previous builds..."
rm -rf release
mkdir -p release

echo ""
echo "📦 Building ARM64 version..."
npm run build:mac:arm64

echo ""
echo "📦 Building x64 version..."
npm run build:mac:x64

echo ""
echo "📦 Building Universal version..."
npm run build:mac:universal

echo ""
echo "✅ All builds completed!"
echo ""
echo "📁 Output files in release/ directory:"
ls -lh release/*.dmg 2>/dev/null || echo "   (DMG files will be created here)"
