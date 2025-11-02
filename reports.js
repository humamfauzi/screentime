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

function loadReportData() {
  const periodSelect = document.getElementById('report-period');
  const days = parseInt(periodSelect.value);
  displayReportSummary();
  displayTopWebsites();
  displayDailyBreakdown();
}

function getReportData(activity, days) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days + 1);

  const reportData = {
    dailyData: [],
    websiteTotals: {},
    totalTime: 0,
    daysWithActivity: 0
  };

  // Iterate through each day in the period
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dateString = d.toISOString().split('T')[0];
    const dayActivity = activity[dateString] || {};
    
    const dayTotal = Object.values(dayActivity).reduce((sum, time) => sum + time, 0);
    
    if (dayTotal > 0) {
      reportData.daysWithActivity++;
    }

    reportData.dailyData.push({
      date: dateString,
      activity: dayActivity,
      total: dayTotal
    });

    // Aggregate website totals
    for (const [domain, time] of Object.entries(dayActivity)) {
      if (!reportData.websiteTotals[domain]) {
        reportData.websiteTotals[domain] = 0;
      }
      reportData.websiteTotals[domain] += time;
      reportData.totalTime += time;
    }
  }

  return reportData;
}

function displayReportSummary(reportData) {
  const avgDailyTimeEl = document.getElementById('avg-daily-time');
  const mostVisitedEl = document.getElementById('most-visited');
  const totalSitesEl = document.getElementById('total-sites');

  // Average daily time
  const avgTime = reportData.daysWithActivity > 0 
    ? Math.floor(reportData.totalTime / reportData.daysWithActivity)
    : 0;
  avgDailyTimeEl.textContent = formatTime(avgTime);

  // Most visited site
  const sortedSites = Object.entries(reportData.websiteTotals)
    .sort((a, b) => b[1] - a[1]);
  
  if (sortedSites.length > 0) {
    mostVisitedEl.textContent = sortedSites[0][0];
  } else {
    mostVisitedEl.textContent = '—';
  }

  // Total sites
  totalSitesEl.textContent = Object.keys(reportData.websiteTotals).length;
}

function displayTopWebsites(reportData) {
  const topWebsitesEl = document.getElementById('top-websites');
  
  const sortedSites = Object.entries(reportData.websiteTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10); // Top 10

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

function displayDailyBreakdown(reportData) {
  const dailyBreakdownEl = document.getElementById('daily-breakdown');
  
  // Reverse to show most recent first
  const reversedData = [...reportData.dailyData].reverse();

  if (reportData.totalTime === 0) {
    dailyBreakdownEl.innerHTML = `
      <div class="empty-state">
        <p>No data available for the selected period</p>
      </div>
    `;
    return;
  }

  dailyBreakdownEl.innerHTML = reversedData.map(day => {
    if (day.total === 0) {
      return ''; // Skip days with no activity
    }

    const date = new Date(day.date);
    const dateOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const formattedDate = date.toLocaleDateString('en-US', dateOptions);

    const topSites = Object.entries(day.activity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    return `
      <div class="daily-item">
        <div class="daily-header">
          <span class="daily-date">${formattedDate}</span>
          <span class="daily-total">${formatTime(day.total)}</span>
        </div>
        <div class="daily-sites">
          ${topSites.map(([domain, time]) => `
            <div class="daily-site">
              <span class="daily-site-name">${domain}</span>
              <span class="daily-site-time">${formatTime(time)}</span>
            </div>
          `).join('')}
          ${Object.keys(day.activity).length > 3 ? `
            <div class="daily-site-more">
              +${Object.keys(day.activity).length - 3} more
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).filter(html => html !== '').join('');
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
