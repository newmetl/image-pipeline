#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "═══════════════════════════════════════════"
echo "  Image Pipeline - Setup"
echo "═══════════════════════════════════════════"
echo ""

# Step 1: Install dependencies
echo "📦 Installing npm dependencies..."
npm install
echo ""

# Step 2: Create directories
echo "📁 Creating directories..."
mkdir -p fonts output
echo ""

# Step 3: Download Google Fonts
echo "🔤 Downloading fonts..."

# Open Sans Bold
if [ ! -f fonts/OpenSans-Bold.ttf ]; then
  echo "   Downloading Open Sans Bold..."
  curl -sL "https://github.com/google/fonts/raw/main/ofl/opensans/static/OpenSans-Bold.ttf" \
    -o fonts/OpenSans-Bold.ttf
  echo "   ✅ Open Sans Bold downloaded"
else
  echo "   ✅ Open Sans Bold already exists"
fi

# Sorts Mill Goudy Regular
if [ ! -f fonts/SortsMillGoudy-Regular.ttf ]; then
  echo "   Downloading Sorts Mill Goudy Regular..."
  curl -sL "https://github.com/google/fonts/raw/main/ofl/sortsmillgoudy/SortsMillGoudy-Regular.ttf" \
    -o fonts/SortsMillGoudy-Regular.ttf
  echo "   ✅ Sorts Mill Goudy Regular downloaded"
else
  echo "   ✅ Sorts Mill Goudy Regular already exists"
fi

echo ""

# Verify fonts
echo "🔍 Verifying fonts..."
for f in fonts/OpenSans-Bold.ttf fonts/SortsMillGoudy-Regular.ttf; do
  if [ -f "$f" ] && [ -s "$f" ]; then
    SIZE=$(wc -c < "$f")
    echo "   ✅ $f ($SIZE bytes)"
  else
    echo "   ❌ $f missing or empty!"
    exit 1
  fi
done

echo ""
echo "═══════════════════════════════════════════"
echo "  ✅ Setup complete!"
echo "═══════════════════════════════════════════"
