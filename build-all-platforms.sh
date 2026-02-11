#!/bin/bash

# Build script for all platforms and architectures
# Usage: ./build-all-platforms.sh

set -e  # Exit on error

echo "🧹 Cleaning previous builds..."
rm -rf release
mkdir -p release

echo ""
echo "📦 Building all platforms..."
echo ""

echo "🍎 Building macOS versions..."
npm run build:mac:all

echo ""
echo "🪟 Building Windows version..."
npm run build:win:all

echo ""
echo "🐧 Building Linux versions..."
npm run build:linux:all

echo ""
echo "✅ All builds completed!"
echo ""
echo "📁 Output files in release/ directory:"
echo ""
echo "macOS:"
ls -lh release/*.dmg 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || echo "   (No DMG files found)"
echo ""
echo "Windows:"
ls -lh release/*.exe 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || echo "   (No EXE files found)"
echo ""
echo "Linux:"
ls -lh release/*.AppImage 2>/dev/null | awk '{print "  " $9 " (" $5 ")"}' || echo "   (No AppImage files found)"
