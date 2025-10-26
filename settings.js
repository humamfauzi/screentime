// Settings.js - Settings page functionality

function loadSettingsPage() {
  loadCurrentLimits();
  loadNotificationSettings();
  attachSettingsEventListeners();
}

function attachSettingsEventListeners() {
  // Add limit button
  const addLimitBtn = document.getElementById('add-limit-btn');
  if (addLimitBtn && !addLimitBtn.hasListener) {
    addLimitBtn.addEventListener('click', addWebsiteLimit);
    addLimitBtn.hasListener = true;
  }

  // Save notification settings button
  const saveNotificationBtn = document.getElementById('save-notification-btn');
  if (saveNotificationBtn && !saveNotificationBtn.hasListener) {
    saveNotificationBtn.addEventListener('click', saveNotificationSettings);
    saveNotificationBtn.hasListener = true;
  }
}

function addWebsiteLimit() {
  const websiteInput = document.getElementById('website-input');
  const timeLimitInput = document.getElementById('time-limit-input');
  const dayCheckboxes = document.querySelectorAll('.day-checkbox input[type="checkbox"]:checked');

  const website = websiteInput.value.trim().toLowerCase();
  const timeLimit = parseInt(timeLimitInput.value);
  const selectedDays = Array.from(dayCheckboxes).map(cb => parseInt(cb.value));

  if (!website) {
    alert('Please enter a website domain');
    return;
  }

  if (!timeLimit || timeLimit < 1) {
    alert('Please enter a valid time limit (minimum 1 minute)');
    return;
  }

  if (selectedDays.length === 0) {
    alert('Please select at least one day');
    return;
  }

  // Remove protocol and path if user entered them
  let domain = website.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || { limits: {}, notificationThreshold: 0.9 };
    
    settings.limits[domain] = {
      limit: timeLimit * 60, // Convert to seconds
      days: selectedDays
    };

    chrome.storage.local.set({ settings }, () => {
      // Clear inputs
      websiteInput.value = '';
      timeLimitInput.value = '';
      
      // Reload limits list
      loadCurrentLimits();
      
      // Show success message
      showMessage('Limit added successfully!');
    });
  });
}

function loadCurrentLimits() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || { limits: {} };
    const limitsList = document.getElementById('limits-list');
    
    const limits = settings.limits;
    const domains = Object.keys(limits);

    if (domains.length === 0) {
      limitsList.innerHTML = `
        <div class="empty-state">
          <p>No limits set yet</p>
        </div>
      `;
      return;
    }

    limitsList.innerHTML = domains.map(domain => {
      const limitData = limits[domain];
      const limitMinutes = Math.floor(limitData.limit / 60);
      const days = limitData.days.map(d => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ');

      return `
        <div class="limit-item">
          <div class="limit-info">
            <div class="limit-domain">${domain}</div>
            <div class="limit-details">
              ${limitMinutes} minutes per day
              <span class="limit-days">• ${days}</span>
            </div>
          </div>
          <button class="btn btn-danger btn-small" onclick="removeLimit('${domain}')">Remove</button>
        </div>
      `;
    }).join('');
  });
}

function removeLimit(domain) {
  if (!confirm(`Remove time limit for ${domain}?`)) {
    return;
  }

  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || { limits: {} };
    
    delete settings.limits[domain];

    chrome.storage.local.set({ settings }, () => {
      loadCurrentLimits();
      showMessage('Limit removed successfully!');
    });
  });
}

function loadNotificationSettings() {
  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || { limits: {}, notificationThreshold: 0.9 };
    const thresholdInput = document.getElementById('notification-threshold');
    
    if (thresholdInput) {
      thresholdInput.value = Math.round(settings.notificationThreshold * 100);
    }
  });
}

function saveNotificationSettings() {
  const thresholdInput = document.getElementById('notification-threshold');
  const threshold = parseInt(thresholdInput.value);

  if (!threshold || threshold < 1 || threshold > 100) {
    alert('Please enter a valid threshold between 1 and 100');
    return;
  }

  chrome.storage.local.get(['settings'], (result) => {
    const settings = result.settings || { limits: {} };
    
    settings.notificationThreshold = threshold / 100;

    chrome.storage.local.set({ settings }, () => {
      showMessage('Notification settings saved!');
    });
  });
}

function showMessage(message) {
  // Create a temporary message element
  const messageEl = document.createElement('div');
  messageEl.className = 'success-message';
  messageEl.textContent = message;
  document.body.appendChild(messageEl);

  setTimeout(() => {
    messageEl.remove();
  }, 3000);
}

// Make removeLimit available globally
window.removeLimit = removeLimit;
