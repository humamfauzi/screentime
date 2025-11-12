# Screentime Chrome Extension - Comprehensive Guide

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Requirements & Architecture](#requirements--architecture)
4. [Installation](#installation)
5. [Usage Guide](#usage-guide)
6. [Technical Documentation](#technical-documentation)
7. [Testing](#testing)
8. [Contributing](#contributing)
9. [Support & License](#support--license)

---

## Overview

Screentime is a privacy-focused Chrome extension that helps you track and limit your time on distracting websites. All data is stored locally on your device using the Chrome Storage API, ensuring complete privacy and security.

### Project Status
✅ **Complete** - All core features implemented and ready to use!

---

## Features

### Core Functionality
1. **Local Data Storage** - All data stored locally using Chrome Storage API. No external servers or cloud storage.
2. **User-Friendly Interface** - Clean, modern design with gradient sidebar and two main sections:
   - **Home**: Real-time today's activity overview
   - **Reports**: Historical data and detailed insights
3. **Detailed Reporting** - View browsing activity with:
   - Selectable time periods (7, 14, or 30 days)
   - Average daily browsing time
   - Most visited websites
   - Top websites with visual progress bars
   - Daily breakdown with top sites per day
4. **Easy Installation** - Standard Chrome extension structure with clear documentation.
5. **Open Source** - MIT License encourages community contributions and collaboration.

### Interface Components

#### Home Page
- Today's date and summary
- Total time spent browsing today
- Number of websites visited
- List of websites with time spent on each
- Visual hourly activity blocks for each website

#### Reports Page
- Time period selector (7/14/30 days)
- Summary statistics:
  - Average daily browsing time
  - Most visited website
  - Total sites tracked
- Top 10 websites chart with progress bars
- Daily breakdown showing top sites per day

---

## Requirements & Architecture

### Design Principles
1. Store all data locally to ensure privacy and security
2. Create user-friendly interface for viewing activity
3. Provide detailed reporting and insights
4. Ensure easy installation and configuration
5. Encourage community contributions
6. Open-source under MIT License
7. Provide support channels (GitHub Issues)

### Technical Architecture

#### Manifest V3
- Uses latest Chrome extension standard (Manifest V3)
- Background service worker for time tracking
- Declarative permissions model

#### Core Scripts
- **`background.js`**: The background service worker that acts as the core of the extension. It listens for browser events such as tab creation, updates, activation, and window focus changes. It uses these events to accurately track which website the user is focused on and records the time spent.

- **`fn.js`**: A shared utility library containing helper classes and functions used across the extension.
  - **`StorageV2`**: Manages all interactions with `chrome.storage.local`. It provides methods for inserting, updating, and retrieving focus session data.
  - **`Aux`**: Contains auxiliary static methods for common tasks like parsing URLs to get the top-level domain (`getTLD`) and checking if a URL is eligible for tracking.
  - **`Debug`**: A class for logging browser events for debugging purposes.

- **`popup.js`**: Controls the functionality of the main "Home" page in the extension's popup. It is responsible for fetching today's activity data from `StorageV2` and rendering it for the user.

- **`reports.js`**: Powers the "Reports" page. It fetches historical data for various time periods (e.g., last 7, 14, or 30 days), calculates summary statistics, and visualizes the data.

#### Styling (`styles.css`)
- Modern gradient design (purple/blue theme)
- Clean, minimal interface
- Responsive components
- Smooth animations and transitions

### Data Structure

```javascript
{
    "version": "2.0",
    "settings": {},
    "focuses": [
        {
            "url": "subdomain.domain.com",
            "start": 1695984000000,
            "start_reason": "tab_created",
            "end": 1695987600000,
            "end_reason": "tab_closed",
            "total": 3600000
        }
    ],
    "display": {
        "today": {
            "total_time": 7200000,
            "site_visited": 5,
            "websites": [
                {
                    "url": "subdomain.domain.com",
                    "total_time": 3600000,
                    "hour_block": "[...24 items]"
                }
            ]
        },
        "reports": {
            "subdomain.domain.com": {
                "blocks": [
                    {
                        "unix": 1695984000000,
                        "hour_block": "[...24 items]"
                    }
                ]
            }
        }
    }
}
```

### Permissions Required
- `storage` - Save data locally
- `tabs` - Track active tabs
- `<all_urls>` - Track any website

### Browser Compatibility
- ✅ Chrome (Chromium-based)
- ✅ Edge (Chromium-based)
- ✅ Brave
- ✅ Opera
- ❌ Firefox (needs manifest adjustment)

### Known Limitations
1. **Icon Files**: PNG icons need to be generated from SVG
2. **Manifest V3**: Uses Chrome Manifest V3 (required for new extensions)
3. **Background Worker**: Service worker may suspend after 30 seconds; uses alarms for periodic checks
4. **Time Tracking**: Only tracks time when browser has focus and tab is active
5. **Domain Only**: Tracks by domain, not by full URL or page
6. **Storage Limit**: Chrome Storage API has ~5MB limit
7. **High-frequency Events**: May cause performance issues with 100+ tabs

---

## Installation

### Prerequisites
Before loading the extension, you need to generate PNG icon files from the SVG source.

### Step 1: Generate Icon Files

The extension requires three icon sizes:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

#### Option A: Use the provided script (requires ImageMagick or Inkscape)
```bash
cd /home/humam/workspace/screentime
chmod +x generate-icons.sh
./generate-icons.sh
```

#### Option B: Using ImageMagick (command line)
```bash
cd icons
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

#### Option C: Using Inkscape (command line)
```bash
cd icons
inkscape icon.svg --export-filename=icon16.png --export-width=16 --export-height=16
inkscape icon.svg --export-filename=icon48.png --export-width=48 --export-height=48
inkscape icon.svg --export-filename=icon128.png --export-width=128 --export-height=128
```

#### Option D: Online converter
1. Visit https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Convert to 16x16, 48x48, and 128x128 pixels
4. Save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder

### Step 2: Load Extension in Chrome

1. **Open Chrome Extensions Page**
   - Type `chrome://extensions/` in the address bar, OR
   - Navigate via: Chrome Menu (⋮) → Extensions → Manage Extensions

2. **Enable Developer Mode**
   - Find the "Developer mode" toggle in the top-right corner
   - Click it to turn it **ON** (it will turn blue)

3. **Load Your Extension**
   - Click the "Load unpacked" button
   - Navigate to: `/home/humam/workspace/screentime`
   - Click "Select Folder"

### Step 3: Verify Installation

1. You should see the Screentime extension card in your extensions list
2. A purple/blue clock icon should appear in your Chrome toolbar
3. Status should show "On" with no errors

### Troubleshooting Installation

#### Extension Not Loading
- ✅ Make sure all files are in the correct directory
- ✅ Check that `manifest.json` is in the root folder
- ✅ Verify icon PNG files exist in the `icons` folder
- ✅ Ensure Developer mode is ON

#### See Errors on Extension Card
- ✅ Check that all required files are present
- ✅ Verify icons exist in `/icons/` folder
- ✅ Look at the specific error message
- ✅ Click "service worker" to see background errors

#### Extension Loads but Shows Errors
- ✅ Click "service worker" link to see background script errors
- ✅ Right-click popup and select "Inspect" to see UI errors
- ✅ Check the Console tab for specific error messages

#### Don't See Extension Icon in Toolbar
- ✅ Refresh the extensions page (F5)
- ✅ Check the toolbar overflow menu (puzzle icon)
- ✅ Pin the extension for easy access

---

## Usage Guide

### First-Time Setup

1. **Install the extension** (see Installation section above)
2. **Click the Screentime icon** in Chrome toolbar
3. **Browse some websites** to generate initial data (YouTube, Twitter, GitHub, etc.)
4. **Return to Screentime** to see your activity
5. **Check Reports** for historical insights
