# Screentime Chrome Extension - Installation Guide

## For Developers: Loading the Extension Locally

### Step 1: Generate Icon Files
Before loading the extension, you need to generate the PNG icon files from the SVG source:

1. Navigate to the `icons` directory
2. Follow the instructions in `icons/README.md` to convert `icon.svg` to PNG format
3. You should have: `icon16.png`, `icon48.png`, and `icon128.png`

**Quick method using ImageMagick (if available):**
```bash
cd icons
convert -background none icon.svg -resize 16x16 icon16.png
convert -background none icon.svg -resize 48x48 icon48.png
convert -background none icon.svg -resize 128x128 icon128.png
```

### Step 2: Load Extension in Chrome

1. Open Google Chrome
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode" (toggle in the top-right corner)
4. Click "Load unpacked"
5. Select the `screentime` directory (the folder containing `manifest.json`)
6. The extension should now appear in your extensions list

### Step 3: Verify Installation

1. Click on the extension icon in the Chrome toolbar
2. The Screentime popup should open showing the Home page
3. Try navigating between Home, Settings, and Reports pages

## Using the Extension

### Setting Time Limits

1. Click the Screentime extension icon
2. Navigate to the **Settings** page
3. Enter a website domain (e.g., `youtube.com`, `facebook.com`)
4. Set the daily time limit in minutes
5. Select which days of the week the limit should apply
6. Click "Add Limit"

### Viewing Activity

1. The **Home** page shows today's browsing activity
2. You'll see:
   - Total time spent browsing today
   - Number of websites visited
   - A list of websites with time spent on each
   - Progress bars showing how close you are to your limits

### Viewing Reports

1. Navigate to the **Reports** page
2. Select a time period (Last 7, 14, or 30 days)
3. View:
   - Average daily browsing time
   - Most visited website
   - Top websites by time spent
   - Daily breakdown of activity

### Notifications

- You'll receive a notification when you reach 90% of your daily limit (customizable in Settings)
- Another notification appears when you exceed your limit
- Notifications appear as system notifications in Chrome

## Troubleshooting

### Extension Not Loading
- Make sure all files are in the correct directory
- Check that `manifest.json` is in the root folder
- Verify icon files exist in the `icons` folder

### No Activity Showing
- The extension needs to track your browsing first
- Browse some websites, then reopen the extension
- Activity is tracked while the tab is active and in focus

### Notifications Not Working
- Check that Chrome has notification permissions
- Go to Chrome Settings > Privacy and Security > Site Settings > Notifications
- Make sure Chrome is allowed to show notifications

### Data Not Persisting
- The extension uses Chrome's local storage
- Data is stored locally on your device
- Clearing Chrome's extension data will reset everything

## Privacy & Data

- All data is stored **locally** on your device using Chrome Storage API
- No data is sent to external servers
- Data includes:
  - Website domains you visit
  - Time spent on each domain
  - Your configured time limits
- To clear all data: Remove and reinstall the extension

## File Structure

```
screentime/
├── manifest.json           # Extension configuration
├── background.js          # Background service worker (time tracking)
├── popup.html            # Main popup interface
├── popup.js              # Home page logic
├── settings.js           # Settings page logic
├── reports.js            # Reports page logic
├── styles.css            # Styling
├── icons/
│   ├── icon.svg          # Source SVG icon
│   ├── icon16.png        # 16x16 icon (needs to be generated)
│   ├── icon48.png        # 48x48 icon (needs to be generated)
│   ├── icon128.png       # 128x128 icon (needs to be generated)
│   └── README.md         # Icon generation instructions
├── LICENSE               # MIT License
├── readme.md            # Project information
└── INSTALL.md           # This file
```

## Development

### Making Changes

1. Edit the relevant files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the Screentime extension card
4. Test your changes

### Debugging

- **Background Script**: Go to `chrome://extensions/`, click "service worker" under Screentime
- **Popup**: Right-click the extension popup and select "Inspect"
- **Storage**: In DevTools, go to Application > Storage > Local Storage

## Publishing (Optional)

To publish to the Chrome Web Store:

1. Create a ZIP file of the extension directory
2. Go to [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole/)
3. Pay the one-time developer registration fee ($5)
4. Upload your ZIP file
5. Fill in the required information
6. Submit for review

## Support

For issues or questions:
- Open an issue on GitHub: https://github.com/humamf/screentime/issues
- Check existing issues for solutions
- Contribute improvements via pull requests

## License

This project is licensed under the MIT License - see the LICENSE file for details.
