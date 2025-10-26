# Screentime Chrome Extension - Quick Start

## What You Have

A fully functional Chrome extension that tracks and limits time spent on websites!

## 📂 Project Structure

```
screentime/
├── manifest.json          - Extension configuration
├── background.js         - Time tracking logic
├── popup.html           - User interface
├── popup.js             - Home page functionality
├── settings.js          - Settings page functionality
├── reports.js           - Reports page functionality
├── styles.css           - Beautiful styling
├── icons/               - Extension icons
│   ├── icon.svg         - SVG source (ready)
│   └── *.png            - Need to generate these
├── LICENSE              - MIT License
├── readme.md            - Project overview
├── AGENTS.md            - Original requirements
├── INSTALL.md           - Detailed installation guide
├── DEV_NOTES.md         - Development documentation
└── generate-icons.sh    - Icon generation helper
```

## 🚀 Next Steps (in order)

### 1. Generate Icon Files
**You need to do this before loading the extension!**

Choose one method:

**Option A - Use the script (requires ImageMagick or Inkscape):**
```bash
cd /home/humam/workspace/screentime
./generate-icons.sh
```

**Option B - Online converter:**
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `icons/icon.svg`
3. Convert to 16x16, 48x48, and 128x128 pixels
4. Save as `icon16.png`, `icon48.png`, `icon128.png` in the `icons/` folder

### 2. Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the `/home/humam/workspace/screentime` folder
6. Done! 🎉

### 3. Start Using

1. Click the Screentime icon in your Chrome toolbar
2. Browse some websites to generate activity data
3. Go to Settings to add time limits
4. Check Reports to see your browsing patterns

## ✨ Features

### Home Page
- Shows today's browsing activity
- Total time spent online
- List of websites visited with time spent
- Progress bars showing limit usage

### Settings Page
- Add time limits for any website
- Set limits by day of week (e.g., more time on weekends)
- Customize notification threshold
- Remove or edit existing limits

### Reports Page
- View activity for last 7, 14, or 30 days
- See average daily usage
- Top websites by time spent
- Daily breakdown with details

### Notifications
- Get alerted at 90% of your limit (customizable)
- Get notified when you exceed limits
- Chrome desktop notifications

## 💾 Data Privacy

✅ All data stored **locally** on your device  
✅ No external servers or cloud storage  
✅ No tracking or analytics  
✅ Full privacy and control  

## 🛠️ Troubleshooting

**Extension won't load?**
- Make sure PNG icons are generated in `icons/` folder
- Check that all files are present

**No activity showing?**
- Browse some websites first
- Reopen the extension popup
- Activity only tracks when browser has focus

**Notifications not working?**
- Check Chrome notification permissions
- Settings > Privacy > Site Settings > Notifications

## 📖 Documentation

- `INSTALL.md` - Complete installation guide
- `DEV_NOTES.md` - Development notes and architecture
- `icons/README.md` - Icon generation instructions
- `readme.md` - Project overview

## 🎯 Requirements Met

✅ Local data storage (Chrome Storage API)  
✅ Notification system for time limits  
✅ User-friendly interface  
✅ Detailed activity reports  
✅ Day-of-week customization  
✅ Easy installation  
✅ Community contribution support  
✅ MIT License  
✅ Support channels (GitHub Issues)  

## 🤝 Contributing

This is an open-source project under the MIT License. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

- GitHub Issues: https://github.com/humamf/screentime/issues
- Read the docs in INSTALL.md for troubleshooting

---

**Ready to get started?** Generate the icons and load the extension! 🚀
