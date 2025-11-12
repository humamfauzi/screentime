// Popup.js - Home page functionality

document.addEventListener('DOMContentLoaded', async () => {
  await initNavigation();
  await loadHomePage();
});

// Navigation between pages
async function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(async item => {
    item.addEventListener('click', async () => {
      const pageName = item.dataset.page;

      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show corresponding page
      pages.forEach(page => page.classList.remove('active'));
      document.getElementById(`${pageName}-page`).classList.add('active');

      // Load page-specific data
      if (pageName === 'home') {
        await loadHomePage();
      } else if (pageName === 'reports') {
        loadReportsPage();
      }
    });
  });
}

// Load home page data
async function loadHomePage() {
  // Display current date
  const dateElement = document.getElementById('current-date');
  const dateObj = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateElement.textContent = dateObj.toLocaleDateString('en-US', options);
  
  const display = await StorageV2._getDisplay();

  // Load today's activity
  await displayTodayActivity(display.today);
}

async function displayTodayActivity(today) {
  const activityItems = document.getElementById('activity-items');
  const totalTimeElement = document.getElementById('total-time');
  const sitesCountElement = document.getElementById('sites-count');

  if (!today || !today.websites || today.websites.length === 0) {
    activityItems.innerHTML = `
      <div class="empty-state">
        <p>No activity recorded yet today</p>
        <p class="empty-hint">Start browsing to see your activity here</p>
      </div>
    `;
    totalTimeElement.textContent = '0h 0m';
    sitesCountElement.textContent = '0';
    return;
  }

  // Calculate total time
  const totalSeconds = (today.total_time || 0) / 1000;
  totalTimeElement.textContent = formatTime(totalSeconds);
  sitesCountElement.textContent = today.site_visited || 0;

  // Clear activity items
  activityItems.innerHTML = '';

  // Create activity items with block hour diagrams
  for (const website of today.websites) {
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    
    // Create domain name element
    const domainElement = document.createElement('div');
    domainElement.className = 'activity-domain';
    domainElement.textContent = website.url;
    domainElement.title = website.url; // Show full domain on hover
    
    // Create time element
    const timeElement = document.createElement('div');
    timeElement.className = 'activity-time';
    timeElement.textContent = formatTime(website.total_time / 1000);
    
    // Generate block hour diagram
    const hourData = website.hour_block.map(seconds => ({ strength: seconds }));
    const blockDiagram = BlockHourDiagram.create(hourData, {
      baseColor: '#4A90E2',
      textColor: '#fff',
      borderColor: '#e0e0e0'
    });
    
    // Append all elements to activity item (grid layout)
    activityItem.appendChild(domainElement);
    activityItem.appendChild(blockDiagram);
    activityItem.appendChild(timeElement);
    
    activityItems.appendChild(activityItem);
  }
}

function formatTime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

function getTodayString() {
  const now = new Date();
  return now.toISOString().split('T')[0]; // YYYY-MM-DD
}
