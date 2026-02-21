// Reports.js - Reports page functionality

// ========== V2 Data Helpers ==========

/**
 * Reads the V2 display.reports data from chrome.storage.local
 * @returns {Promise<Object>} The reports object keyed by URL
 */
async function getV2Reports() {
  const data = await chrome.storage.local.get(['v2']);
  const storage = data.v2 || { display: { reports: {} } };
  return (storage.display && storage.display.reports) || {};
}

/**
 * Computes total focus time (ms) across all URLs for blocks within the date range
 */
function computeFocusSum(reports, startTimestamp, endTimestamp) {
  let totalMs = 0;
  for (const url in reports) {
    for (const block of reports[url].blocks) {
      if (block.unix >= startTimestamp && block.unix <= endTimestamp) {
        const blockSeconds = block.hour_block.reduce((sum, s) => sum + s, 0);
        totalMs += blockSeconds * 1000;
      }
    }
  }
  return totalMs;
}

/**
 * Computes focus time (ms) per URL for blocks within the date range
 */
function computeFocusSumByURL(reports, startTimestamp, endTimestamp) {
  const focusByURL = {};
  for (const url in reports) {
    let urlTotal = 0;
    for (const block of reports[url].blocks) {
      if (block.unix >= startTimestamp && block.unix <= endTimestamp) {
        const blockSeconds = block.hour_block.reduce((sum, s) => sum + s, 0);
        urlTotal += blockSeconds * 1000;
      }
    }
    if (urlTotal > 0) {
      focusByURL[url] = urlTotal;
    }
  }
  return focusByURL;
}

/**
 * Gets the most visited URLs sorted by total focus time within the date range
 */
function computeMostVisited(reports, startTimestamp, endTimestamp, limit = 1) {
  const focusByURL = computeFocusSumByURL(reports, startTimestamp, endTimestamp);
  return Object.entries(focusByURL)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([url, time]) => ({ url, time }));
}

/**
 * Counts unique sites with activity within the date range
 */
function computeTotalSites(reports, startTimestamp, endTimestamp) {
  let count = 0;
  for (const url in reports) {
    for (const block of reports[url].blocks) {
      if (block.unix >= startTimestamp && block.unix <= endTimestamp) {
        const hasActivity = block.hour_block.some(s => s > 0);
        if (hasActivity) {
          count++;
          break;
        }
      }
    }
  }
  return count;
}

/**
 * Builds a 7x24 week grid from report blocks for a specific URL (current week)
 */
function computeBlockDayData(reports, url) {
  const [startOfWeek, endOfWeek] = Aux.currentStartAndEndWeek(new Date());
  const weekData = Array.from({ length: 7 }, () => Array(24).fill(0));

  if (reports[url]) {
    for (const block of reports[url].blocks) {
      if (block.unix >= startOfWeek && block.unix <= endOfWeek) {
        const dayOfWeek = new Date(block.unix).getDay();
        for (let h = 0; h < 24; h++) {
          weekData[dayOfWeek][h] += block.hour_block[h];
        }
      }
    }
  }
  return weekData;
}

// ========== Period Boundaries ==========

function getPeriodBoundaries(days) {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const endTimestamp = endDate.getTime();

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);
  startDate.setHours(0, 0, 0, 0);
  const startTimestamp = startDate.getTime();

  return [startTimestamp, endTimestamp];
}

// ========== Page Lifecycle ==========

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

  // Fetch reports once and pass to all display functions
  const reports = await getV2Reports();

  displayReportSummary(reports, startTimestamp, endTimestamp, days);
  displayTopWebsites(reports, startTimestamp, endTimestamp);
  displayDailyBreakdown(reports, startTimestamp, endTimestamp);
}

// ========== Display Functions ==========

function displayReportSummary(reports, startTimestamp, endTimestamp, days) {
  const avgDailyTimeEl = document.getElementById('avg-daily-time');
  const mostVisitedEl = document.getElementById('most-visited');
  const totalSitesEl = document.getElementById('total-sites');

  // Average daily time
  const totalFocusSeconds = computeFocusSum(reports, startTimestamp, endTimestamp) / 1000;
  const avgTime = days > 0 ? totalFocusSeconds / days : 0;
  avgDailyTimeEl.textContent = formatTime(avgTime);

  // Most visited site
  const mostVisited = computeMostVisited(reports, startTimestamp, endTimestamp, 1);
  mostVisitedEl.textContent = mostVisited.length > 0 ? mostVisited[0].url : '—';

  // Total sites
  totalSitesEl.textContent = computeTotalSites(reports, startTimestamp, endTimestamp);
}

function displayTopWebsites(reports, startTimestamp, endTimestamp) {
  const topWebsitesEl = document.getElementById('top-websites');

  const focusByURL = computeFocusSumByURL(reports, startTimestamp, endTimestamp);
  // Convert ms → seconds and sort
  const sortedSites = Object.entries(focusByURL)
    .map(([url, ms]) => [url, ms / 1000])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

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

function displayDailyBreakdown(reports, startTimestamp, endTimestamp) {
  const dailyBreakdownEl = document.getElementById('daily-breakdown');

  const focusByURL = computeFocusSumByURL(reports, startTimestamp, endTimestamp);
  const sortedSites = Object.entries(focusByURL).sort((a, b) => b[1] - a[1]);

  if (sortedSites.length === 0) {
    dailyBreakdownEl.innerHTML = `
      <div class="empty-state">
        <p>No data available for the selected period</p>
      </div>
    `;
    return;
  }

  // Create dropdown with all websites (time in seconds for display)
  const websiteOptions = sortedSites.map(([url, ms], index) => {
    return `<option value="${index}">${url} (${formatTime(ms / 1000)})</option>`;
  }).join('');

  // Preserve the currently selected website index if valid
  let selectedIndex = 0;
  const existingSelect = dailyBreakdownEl.querySelector('#website-selector');
  if (existingSelect) {
    selectedIndex = parseInt(existingSelect.value) || 0;
    if (selectedIndex >= sortedSites.length) selectedIndex = 0;
  }

  const selectedUrl = sortedSites[selectedIndex][0];
  const selectedFocusMs = sortedSites[selectedIndex][1];

  // Generate block day diagram data from reports
  const weekData = computeBlockDayData(reports, selectedUrl);

  const diagram = BlockDayDiagram.create(weekData, {
    width: '100%',
    blockHeight: '18px',
    baseColor: '#333333'
  });

  dailyBreakdownEl.innerHTML = `
    <div class="breakdown-header">
      <div class="breakdown-controls">
        <label for="website-selector">Select website:</label>
        <select id="website-selector">
          ${websiteOptions}
        </select>
      </div>
      <h4>Weekly Pattern: ${selectedUrl}</h4>
      <p class="breakdown-subtitle">Total focus time: ${formatTime(selectedFocusMs / 1000)}</p>
    </div>
    <div id="block-diagram-container"></div>
  `;

  const websiteSelector = dailyBreakdownEl.querySelector('#website-selector');
  websiteSelector.value = selectedIndex;

  // Re-render breakdown when a different website is selected
  websiteSelector.addEventListener('change', () => {
    displayDailyBreakdown(reports, startTimestamp, endTimestamp);
  });

  const diagramContainer = dailyBreakdownEl.querySelector('#block-diagram-container');
  diagramContainer.appendChild(diagram);
}