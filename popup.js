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
  const today = getTodayString();
  
  // Display current date
  const dateElement = document.getElementById('current-date');
  const dateObj = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateElement.textContent = dateObj.toLocaleDateString('en-US', options);
  const startDayUnix = new Date(dateObj.getFullYear(), dateObj.getMonth(), dateObj.getDate()).getTime();
  const endDayUnix = startDayUnix + 86400000 - 1; // End of the day
  const totalFocus = await Storage.getFocusSum(startDayUnix, endDayUnix);
  const totalFocusByURL = await Storage.getFocusSumByURL(startDayUnix, endDayUnix);

  // Load today's activity
  await displayTodayActivity(totalFocus, totalFocusByURL);
}

async function displayTodayActivity(totalFocus, totalFocusByURL) {
  const activityItems = document.getElementById('activity-items');
  const totalTimeElement = document.getElementById('total-time');
  const sitesCountElement = document.getElementById('sites-count');

  const domains = Object.keys(totalFocusByURL);
  
  if (domains.length === 0) {
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
  const seconds = totalFocus / 1000
  totalTimeElement.textContent = formatTime(seconds);
  sitesCountElement.textContent = domains.length;

  const zip = Object.entries(totalFocusByURL).map(([domain, ms]) => [domain, ms / 1000]);
  const sorted = zip.sort((a, b) => b[1] - a[1]);

  // Clear activity items
  activityItems.innerHTML = '';

  // Create activity items with block hour diagrams
  for (const [domain, timeSpent] of sorted) {
    const activityItem = document.createElement('div');
    activityItem.className = 'activity-item';
    
    // Create header with domain and time
    const activityHeader = document.createElement('div');
    activityHeader.className = 'activity-header';
    activityHeader.innerHTML = `
      <div class="activity-domain">${domain}</div>
      <div class="activity-time">${formatTime(timeSpent)}</div>
    `;
    
    activityItem.appendChild(activityHeader);
    
    // Generate and add block hour diagram
    const hourData = await Storage.generateBlockHourData(domain);
    const blockDiagram = BlockHourDiagram.create(hourData, {
      height: '40px',
      baseColor: '#4A90E2',
      textColor: '#fff',
      borderColor: '#e0e0e0'
    });
    
    // Add some spacing
    blockDiagram.style.marginTop = '8px';
    activityItem.appendChild(blockDiagram);
    
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
