#!/bin/bash

# Icon generation script for Screentime extension
# This script converts the SVG icon to PNG files in multiple sizes

echo "Screentime Icon Generator"
echo "========================="
echo ""

cd "$(dirname "$0")"

# Check if ImageMagick is installed
if command -v convert &> /dev/null; then
    echo "✓ ImageMagick found, generating PNG icons..."
    convert -background none icons/icon.svg -resize 16x16 icons/icon16.png
    convert -background none icons/icon.svg -resize 48x48 icons/icon48.png
    convert -background none icons/icon.svg -resize 128x128 icons/icon128.png
    echo "✓ Icons generated successfully!"
    echo "  - icons/icon16.png"
    echo "  - icons/icon48.png"
    echo "  - icons/icon128.png"
    exit 0
fi

# Check if Inkscape is installed
if command -v inkscape &> /dev/null; then
    echo "✓ Inkscape found, generating PNG icons..."
    inkscape icons/icon.svg --export-filename=icons/icon16.png --export-width=16 --export-height=16
    inkscape icons/icon.svg --export-filename=icons/icon48.png --export-width=48 --export-height=48
    inkscape icons/icon.svg --export-filename=icons/icon128.png --export-width=128 --export-height=128
    echo "✓ Icons generated successfully!"
    echo "  - icons/icon16.png"
    echo "  - icons/icon48.png"
    echo "  - icons/icon128.png"
    exit 0
fi

# Neither tool found
echo "✗ Neither ImageMagick nor Inkscape found."
echo ""
echo "Please install one of the following:"
echo ""
echo "ImageMagick:"
echo "  Ubuntu/Debian: sudo apt-get install imagemagick"
echo "  macOS:         brew install imagemagick"
echo "  Windows:       Download from https://imagemagick.org/script/download.php"
echo ""
echo "OR"
echo ""
echo "Inkscape:"
echo "  Ubuntu/Debian: sudo apt-get install inkscape"
echo "  macOS:         brew install inkscape"
echo "  Windows:       Download from https://inkscape.org/release/"
echo ""
echo "Alternatively, use an online converter:"
echo "  https://cloudconvert.com/svg-to-png"
echo ""
exit 1
