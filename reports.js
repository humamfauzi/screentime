// Reports.js - Reports page functionality

class Read {
  static async readRaw() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['raw'], (result) => {
        resolve(result.raw || {});
      });
    });
  }

}

function getPeriodBoundaries(days) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999); // End of today
  const endTimestamp = endDate.getTime();
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0); // Start of the first day
  const startTimestamp = startDate.getTime();
  
  return [startTimestamp, endTimestamp];
}

function loadReportsPage() {
  const reportPeriod = document.getElementById('report-period');
  
  if (reportPeriod && !reportPeriod.hasListener) {
    reportPeriod.addEventListener('change', () => {
      loadReportData();
    });
    reportPeriod.hasListener = true;
  }

  loadReportData();
}

async function loadReportData() {
  const periodSelect = document.getElementById('report-period');
  const days = parseInt(periodSelect.value);
  const [startTimestamp, endTimestamp] = getPeriodBoundaries(days);
  
  await displayReportSummary(startTimestamp, endTimestamp, days);
  await displayTopWebsites(startTimestamp, endTimestamp);
  await displayDailyBreakdown(startTimestamp, endTimestamp);
}

async function displayReportSummary(startTimestamp, endTimestamp, days) {
  const avgDailyTimeEl = document.getElementById('avg-daily-time');
  const mostVisitedEl = document.getElementById('most-visited');
  const totalSitesEl = document.getElementById('total-sites');

  // Average daily time
  let totalFocusTime = await Storage.getFocusSum(startTimestamp, endTimestamp);
  totalFocusTime = totalFocusTime / 1000;
  const avgTime = days > 0 ? totalFocusTime / days : 0;
  avgDailyTimeEl.textContent = formatTime(avgTime);

  // Most visited site
  const mostVisited = await Storage.getMostVisitedURLs(startTimestamp, endTimestamp, 1);
  if (mostVisited.length > 0) {
    mostVisitedEl.textContent = mostVisited[0].url;
  } else {
    mostVisitedEl.textContent = '—';
  }

  // Total sites
  const totalSites = await Storage.totalSitesVisited(startTimestamp, endTimestamp);
  totalSitesEl.textContent = totalSites;
}

async function displayTopWebsites(startTimestamp, endTimestamp) {
  const topWebsitesEl = document.getElementById('top-websites');
  
  // Get focus time by URL and sort by focus time
  let focusByURL = await Storage.getFocusSumByURL(startTimestamp, endTimestamp);
  for (const [url, item] of Object.entries(focusByURL)) {
    focusByURL[url] = item / 1000; // convert to seconds
  }
  const sortedSites = Object.entries(focusByURL)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Top 10

  if (sortedSites.length === 0) {
    topWebsitesEl.innerHTML = `
      <div class="empty-state">
        <p>No data available for the selected period</p>
      </div>
    `;
    return;
  }

  const maxTime = sortedSites[0][1];

  topWebsitesEl.innerHTML = sortedSites.map(([domain, time], index) => {
    const percentage = (time / maxTime) * 100;
    
    return `
      <div class="report-item">
        <div class="report-rank">${index + 1}</div>
        <div class="report-content">
          <div class="report-header">
            <span class="report-domain">${domain}</span>
            <span class="report-time">${formatTime(time)}</span>
          </div>
          <div class="report-bar">
            <div class="report-bar-fill" style="width: ${percentage}%"></div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

async function displayDailyBreakdown(startTimestamp, endTimestamp) {
  const dailyBreakdownEl = document.getElementById('daily-breakdown');
  
  // Get the most focused website for the period
  const focusByURL = await Storage.getFocusSumByURL(startTimestamp, endTimestamp);
  const sortedSites = Object.entries(focusByURL).sort((a, b) => b[1] - a[1]);
  
  if (sortedSites.length === 0) {
    dailyBreakdownEl.innerHTML = `
      <div class="empty-state">
        <p>No data available for the selected period</p>
      </div>
    `;
    return;
  }

  // Create dropdown with all websites
  const websiteOptions = sortedSites.map(([url, time], index) => {
    return `<option value="${index}">${url} (${formatTime(time / 1000)})</option>`;
  }).join('');

  // Get the currently selected website index (default to first)
  let selectedIndex = 0;
  const existingSelect = dailyBreakdownEl.querySelector('#website-selector');
  if (existingSelect) {
    selectedIndex = parseInt(existingSelect.value) || 0;
    // Make sure the index is still valid
    if (selectedIndex >= sortedSites.length) {
      selectedIndex = 0;
    }
  }

  const selectedUrl = sortedSites[selectedIndex][0];
  const selectedFocusTime = sortedSites[selectedIndex][1];
  
  // Generate block day diagram data for the selected website
  const weekData = await Storage.generateBlockDayData(selectedUrl);
  
  // Create the block day diagram
  const diagram = BlockDayDiagram.create(weekData, {
    width: '100%',
    blockHeight: '50px',
    baseColor: '#4A90E2'
  });
  
  // Build the HTML
  dailyBreakdownEl.innerHTML = `
    <div class="breakdown-header">
      <div class="breakdown-controls">
        <label for="website-selector">Select website:</label>
        <select id="website-selector">
          ${websiteOptions}
        </select>
      </div>
      <h4>Weekly Pattern: ${selectedUrl}</h4>
      <p class="breakdown-subtitle">Total focus time: ${formatTime(selectedFocusTime / 1000)}</p>
    </div>
    <div id="block-diagram-container"></div>
  `;
  
  // Set the selected value
  const websiteSelector = dailyBreakdownEl.querySelector('#website-selector');
  websiteSelector.value = selectedIndex;
  
  // Add change event listener
  websiteSelector.addEventListener('change', async () => {
    const periodSelect = document.getElementById('report-period');
    const days = parseInt(periodSelect.value);
    const [startTimestamp, endTimestamp] = getPeriodBoundaries(days);
    await displayDailyBreakdown(startTimestamp, endTimestamp);
  });
  
  // Append the diagram
  const diagramContainer = dailyBreakdownEl.querySelector('#block-diagram-container');
  diagramContainer.appendChild(diagram);
}