# Icon Files for Screentime Extension

## Current Status
The `icon.svg` file contains a scalable vector graphic that can be converted to PNG format.

## Required Icon Sizes
The Chrome extension requires the following icon sizes:
- 16x16 pixels (icon16.png)
- 48x48 pixels (icon48.png)
- 128x128 pixels (icon128.png)

## How to Generate PNG Icons

### Option 1: Using an online converter
1. Visit a website like https://cloudconvert.com/svg-to-png
2. Upload the `icon.svg` file
3. Convert to PNG at each required size (16px, 48px, 128px)
4. Save the files as `icon16.png`, `icon48.png`, and `icon128.png`

### Option 2: Using Inkscape (if installed)
```bash
inkscape icon.svg --export-filename=icon16.png --export-width=16 --export-height=16
inkscape icon.svg --export-filename=icon48.png --export-width=48 --export-height=48
inkscape icon.svg --export-filename=icon128.png --export-width=128 --export-height=128
```

### Option 3: Using ImageMagick (if installed)
```bash
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Option 4: Using Node.js with sharp (if installed)
Install sharp: `npm install sharp`

Create a script `convert-icons.js`:
```javascript
const sharp = require('sharp');
const fs = require('fs');

const sizes = [16, 48, 128];
const svgBuffer = fs.readFileSync('icon.svg');

sizes.forEach(size => {
  sharp(svgBuffer)
    .resize(size, size)
    .png()
    .toFile(`icon${size}.png`)
    .then(() => console.log(`Generated icon${size}.png`))
    .catch(err => console.error(err));
});
```

Then run: `node convert-icons.js`

## Temporary Solution
For development and testing purposes, you can temporarily rename any small PNG image you have to these filenames, or use the SVG version by updating the manifest.json to reference icon.svg instead of .png files (though this is not recommended for production).
