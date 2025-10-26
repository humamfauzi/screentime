// Popup.js - Home page functionality

document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  loadHomePage();
});

// Navigation between pages
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const pages = document.querySelectorAll('.page');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const pageName = item.dataset.page;

      // Update active nav item
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Show corresponding page
      pages.forEach(page => page.classList.remove('active'));
      document.getElementById(`${pageName}-page`).classList.add('active');

      // Load page-specific data
      if (pageName === 'home') {
        loadHomePage();
      } else if (pageName === 'settings') {
        loadSettingsPage();
      } else if (pageName === 'reports') {
        loadReportsPage();
      }
    });
  });
}

// Load home page data
function loadHomePage() {
  const today = getTodayString();
  
  // Display current date
  const dateElement = document.getElementById('current-date');
  const dateObj = new Date();
  const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
  dateElement.textContent = dateObj.toLocaleDateString('en-US', options);

  // Load today's activity
  chrome.storage.local.get(['activity', 'settings'], (result) => {
    const activity = result.activity || {};
    const settings = result.settings || { limits: {} };
    const todayActivity = activity[today] || {};

    displayTodayActivity(todayActivity, settings.limits);
  });
}

function displayTodayActivity(todayActivity, limits) {
  const activityItems = document.getElementById('activity-items');
  const totalTimeElement = document.getElementById('total-time');
  const sitesCountElement = document.getElementById('sites-count');

  const domains = Object.keys(todayActivity);
  
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
  const totalSeconds = domains.reduce((sum, domain) => sum + todayActivity[domain], 0);
  totalTimeElement.textContent = formatTime(totalSeconds);
  sitesCountElement.textContent = domains.length;

  // Sort domains by time spent (descending)
  const sortedDomains = domains.sort((a, b) => todayActivity[b] - todayActivity[a]);

  // Create activity items
  activityItems.innerHTML = sortedDomains.map(domain => {
    const timeSpent = todayActivity[domain];
    const limit = limits[domain] ? limits[domain].limit : null;
    const percentage = limit ? Math.min((timeSpent / limit) * 100, 100) : 0;
    
    return `
      <div class="activity-item">
        <div class="activity-header">
          <div class="activity-domain">${domain}</div>
          <div class="activity-time">${formatTime(timeSpent)}</div>
        </div>
        ${limit ? `
          <div class="activity-progress">
            <div class="progress-bar">
              <div class="progress-fill ${percentage >= 100 ? 'exceeded' : ''}" style="width: ${percentage}%"></div>
            </div>
            <div class="progress-label">
              ${formatTime(timeSpent)} / ${formatTime(limit)}
              ${percentage >= 100 ? '<span class="limit-exceeded">Limit Exceeded</span>' : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
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
