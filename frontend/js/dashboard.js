/* ============================================================
   TMR Dashboard — dashboard.js
   Drives index.html: metrics, charts, performance table
   ============================================================ */

/* ---- chart instances (kept so we can destroy on re-render) ---- */
let strikeChartInst  = null;
let attendChartInst  = null;
let trendChartInst   = null;

/* ============================================================
   MAIN RENDER — called on load and on every filter change
   ============================================================ */
function renderDashboard() {
  const from    = document.getElementById('filterFrom').value;
  const to      = document.getElementById('filterTo').value;
  const region  = document.getElementById('filterRegion').value;

  /* --- get raw data --- */
  let daily   = DB.getDailyRows();
  let summary = DB.getSummaryRows();

  /* --- show no-data alert --- */
  const noData = !summary.length && !daily.length;
  document.getElementById('noDataAlert').style.display = noData ? 'flex' : 'none';
  if (noData) { renderEmpty(); return; }

  /* --- apply date + region filters --- */
  if (from || to) {
    daily   = filterByDateRange(daily,   'created_at', from, to);
    summary = filterByDateRange(summary, 'date_',      from, to);
  }
  if (region) {
    daily   = daily.filter(r => r.region === region);
    summary = summary.filter(r => r.region === region);
  }

  /* --- date range label --- */
  const dates = summary.map(r => String(r.date_).slice(0, 10)).sort();
  const rangeStr = dates.length
    ? `${dates[0]} → ${dates[dates.length - 1]}`
    : 'No data in range';
  document.getElementById('dateRangeLabel').textContent = rangeStr;

  /* --- build TMR list from summary --- */
  const tmrMap = {}; // wallet → { name, region, rows[] }
  summary.forEach(r => {
    const w = r.tmr_wallet;
    if (!tmrMap[w]) tmrMap[w] = { name: r.tmr_name, region: r.region, rows: [] };
    tmrMap[w].rows.push(r);
  });
  const tmrList = Object.entries(tmrMap).map(([wallet, d]) => {
    const kpi = calcKPI(d.rows, d.region);
    /* Attendance: count days where visit count meets 75% of target */
    /* We use agent_visit_count from summary vs a default target of 30 */
    const cfg = DB.getConfig();
    const tmrCfg = (cfg.tmrs || []).find(t => t.wallet === wallet) || {};
    const dailyTarget = Number(tmrCfg.daily_visit_target) || 30;
    let presentDays = 0;
    let totalWorkDays = d.rows.length;
    d.rows.forEach(row => {
      const visits = Number(row.agent_visit_count) || 0;
      const hrs    = parseHours(row.working_time_h_m_s);
      /* Attendance valid: visits ≥ 75% target AND within business hours implied */
      if (visits >= dailyTarget * ATTEND_TARGET && hrs > 0) presentDays++;
    });
    const attendPct = totalWorkDays > 0 ? (presentDays / totalWorkDays) * 100 : 0;
    const avgVisit  = d.rows.reduce((s, r) => s + (Number(r.agent_visit_count) || 0), 0) / Math.max(d.rows.length, 1);
    const avgMktHr  = d.rows.reduce((s, r) => s + parseHours(r.working_time_h_m_s), 0) / Math.max(d.rows.length, 1);
    const sTgt = strikeTarget(d.region);
    const isAbove = attendPct >= 80 && avgVisit >= sTgt;
    const isBelow = attendPct < 65 || avgVisit < sTgt * 0.7;

    return {
      wallet, name: d.name, region: d.region,
      attendPct, avgVisit, avgMktHr,
      kpi, sTgt,
      status: isAbove ? 'above' : isBelow ? 'below' : 'avg'
    };
  });

  /* ============================================================
     METRIC CARDS
     ============================================================ */
  document.getElementById('totalTMR').textContent     = tmrList.length;
  const avgAtt = tmrList.reduce((s, t) => s + t.attendPct, 0) / Math.max(tmrList.length, 1);
  document.getElementById('avgAttendance').textContent = pct(avgAtt, 0);
  const avgStr = tmrList.reduce((s, t) => s + t.avgVisit, 0) / Math.max(tmrList.length, 1);
  document.getElementById('avgStrike').textContent = num(avgStr, 1);
  const avgMH = tmrList.reduce((s, t) => s + t.avgMktHr, 0) / Math.max(tmrList.length, 1);
  document.getElementById('avgMarketHour').textContent = fmtHours(avgMH);
  const mhCard = document.getElementById('marketHourCard');
  mhCard.className = 'metric-card ' + (avgMH >= 7 ? 'green' : 'red');
  document.getElementById('marketHourStatus').innerHTML = avgMH >= 7
    ? '<span class="up">✓ On target</span>'
    : '<span class="down">Below 7h target</span>';

  const totalVisits = summary.reduce((s, r) => s + (Number(r.agent_visit_count) || 0), 0);
  document.getElementById('totalVisits').textContent = totalVisits.toLocaleString();

  const below = tmrList.filter(t => t.attendPct < 75).length;
  document.getElementById('belowAttendTMR').textContent = below;

  /* ============================================================
     PERFORMANCE TABLE
     ============================================================ */
  const tbody = document.getElementById('performanceTbody');
  if (!tmrList.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted);">No data in selected range</td></tr>';
  } else {
    const sorted = [...tmrList].sort((a, b) => b.attendPct - a.attendPct);
    tbody.innerHTML = sorted.map(t => `
      <tr>
        <td><strong>${esc(t.name)}</strong></td>
        <td>${esc(t.region || '—')}</td>
        <td>${pct(t.attendPct, 0)}</td>
        <td>${num(t.avgVisit, 0)}<span style="font-size:10px;color:var(--text-muted);">/${t.sTgt}</span></td>
        <td>${fmtHours(t.avgMktHr)}</td>
        <td>
          <span class="badge badge-${t.status}">
            ${t.status === 'above' ? '▲ Above' : t.status === 'below' ? '▼ Below' : '● Avg'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  /* ============================================================
     KPI BREAKDOWN (team averages)
     ============================================================ */
  const avgKPI = {
    marketHrScore: avg(tmrList.map(t => t.kpi.marketHrScore)),
    strikeScore:   avg(tmrList.map(t => t.kpi.strikeScore)),
    freqScore:     avg(tmrList.map(t => t.kpi.freqScore)),
    totalKPI:      avg(tmrList.map(t => t.kpi.totalKPI))
  };

  setBar('kpiMarketHrScore', 'kpiMarketHrBar', avgKPI.marketHrScore);
  setBar('kpiStrikeScore',   'kpiStrikeBar',   avgKPI.strikeScore);
  setBar('kpiFreqScore',     'kpiFreqBar',      avgKPI.freqScore);
  document.getElementById('kpiTotal').textContent = pct(avgKPI.totalKPI * 100, 1);

  /* ============================================================
     TMR SUMMARY TABLE
     ============================================================ */
  renderTmrSummaryTable(summary, daily);

  /* ============================================================
     TOP / BOTTOM 5 PERFORMERS
     ============================================================ */
  const byStrike = [...tmrList].sort((a, b) => b.avgVisit - a.avgVisit);
  renderPerformerList('topPerformers',    byStrike.slice(0, 5),   'green');
  renderPerformerList('bottomPerformers', byStrike.slice(-5).reverse(), 'red');

  /* ============================================================
     CHARTS
     ============================================================ */
  renderStrikeChart(tmrList);
  renderAttendanceChart(tmrList);
  renderTrendChart(summary);
}

function buildTmrSummary(summary, daily) {
  const map = {};
  summary.forEach(r => {
    const wallet = String(r.tmr_wallet || 'unknown');
    if (!map[wallet]) {
      map[wallet] = {
        wallet,
        name: r.tmr_name || '—',
        region: r.region || '—',
        rows: [],
        dateMap: {},
        dailyTarget: Number(r.daily_visit_target) || 0,
        monthlyAgentCoverageTarget: Number(r.monthly_agent_coverage_target) || 0,
        fridayCount: Number(r.friday_count) || 0,
        govtHolidayCount: Number(r.govt_holiday_count) || 0,
        paidLeaveCount: Number(r.paid_leave || r.approved_leave || r.leave_count || 0)
      };
    }
    const item = map[wallet];
    item.rows.push(r);
    const date = String(r.date_).slice(0, 10);
    if (!item.dateMap[date]) {
      item.dateMap[date] = { visits: 0, workTime: 0, noActivity: false };
    }
    item.dateMap[date].visits += Number(r.agent_visit_count) || 0;
    item.dateMap[date].workTime += parseHours(r.working_time_h_m_s);
    if (Number(r.no_activity) || Number(r['no activity'])) item.dateMap[date].noActivity = true;
  });

  const cfg = DB.getConfig();
  const cfgMap = (cfg.tmrs || []).reduce((acc, item) => {
    if (item.wallet) acc[item.wallet] = item;
    return acc;
  }, {});

  return Object.values(map).map(item => {
    const cfgItem = cfgMap[item.wallet] || {};
    item.dailyTarget = item.dailyTarget || Number(cfgItem.daily_visit_target) || 30;
    item.monthlyAgentCoverageTarget = item.monthlyAgentCoverageTarget || Number(cfgItem.monthly_agent_coverage_target) || 0;
    const totalDays = item.rows.length;
    const presentDays = item.rows.reduce((sum, row) => {
      const visits = Number(row.agent_visit_count) || 0;
      return sum + (visits >= item.dailyTarget * ATTEND_TARGET ? 1 : 0);
    }, 0);
    const payableDays = presentDays + item.fridayCount + item.govtHolidayCount + item.paidLeaveCount;
    const avgVisit = item.rows.reduce((sum, row) => sum + (Number(row.agent_visit_count) || 0), 0) / Math.max(totalDays, 1);
    const avgWorkTime = item.rows.reduce((sum, row) => sum + parseHours(row.working_time_h_m_s), 0) / Math.max(totalDays, 1);
    const kpi = calcKPI(item.rows, item.region);
    item.totalDays = totalDays;
    item.presentDays = presentDays;
    item.payableDays = payableDays;
    item.attendancePct = totalDays ? (payableDays / totalDays) * 100 : 0;
    item.avgVisit = avgVisit;
    item.avgWorkTime = avgWorkTime;
    item.totalKPI = kpi.totalKPI * 100;
    item.status = item.attendancePct >= 80 && avgVisit >= strikeTarget(item.region)
      ? 'above'
      : item.attendancePct < 65
        ? 'below'
        : 'avg';
    item.kpi = kpi;
    return item;
  });
}

function getTmrSummaryDates(summary) {
  return [...new Set(summary.map(r => String(r.date_).slice(0, 10)).filter(Boolean))].sort();
}

function renderTmrSummaryTable(summary, daily) {
  const table = document.getElementById('tmrSummaryTable');
  const tbody = document.getElementById('tmrSummaryBody');
  if (!table || !tbody) return;

  const rows = buildTmrSummary(summary, daily);
  const dates = getTmrSummaryDates(summary);
  const staticHeaders = [
    { label: 'TMR Wallet', key: 'wallet' },
    { label: 'TMR Name', key: 'name' },
    { label: 'Daily Target', key: 'dailyTarget' },
    { label: 'Total Days', key: 'totalDays' },
    { label: 'Present Days', key: 'presentDays' },
    { label: 'Friday', key: 'fridayCount' },
    { label: 'Govt Holiday', key: 'govtHolidayCount' },
    { label: 'Paid Leave', key: 'paidLeaveCount' },
    { label: 'Payable Days', key: 'payableDays' },
    { label: 'Attendance %', key: 'attendancePct' },
    { label: 'Avg Work Time', key: 'avgWorkTime' },
    { label: 'Avg Strike', key: 'avgVisit' },
    { label: 'KPI %', key: 'totalKPI' },
    { label: 'Status', key: 'status' }
  ];

  const headerHtml = [
    ...staticHeaders.map(col => `<th>${col.label}</th>`),
    ...dates.map(date => `<th>${date}</th>`)
  ].join('');

  table.querySelector('thead').innerHTML = `<tr>${headerHtml}</tr>`;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="' + (staticHeaders.length + dates.length) + '" style="text-align:center;padding:24px;color:var(--text-muted);">No TMR summary available for the selected range.</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(item => {
    const dateCells = dates.map(date => {
      const entry = item.dateMap[date];
      if (!entry) return '<td>—</td>';
      if (entry.visits > 0) return `<td>${entry.visits}</td>`;
      if (entry.noActivity) return '<td>NA</td>';
      if (entry.workTime > 0) return '<td>P</td>';
      return '<td>—</td>';
    }).join('');

    return `
      <tr>
        <td>${esc(item.wallet)}</td>
        <td>${esc(item.name)}</td>
        <td>${item.dailyTarget || '—'}</td>
        <td>${item.totalDays}</td>
        <td>${item.presentDays}</td>
        <td>${item.fridayCount}</td>
        <td>${item.govtHolidayCount}</td>
        <td>${item.paidLeaveCount}</td>
        <td>${item.payableDays}</td>
        <td>${pct(item.attendancePct, 0)}</td>
        <td>${fmtHours(item.avgWorkTime)}</td>
        <td>${num(item.avgVisit, 1)}</td>
        <td>${pct(item.totalKPI, 0)}</td>
        <td><span class="badge badge-${item.status}">${item.status === 'above' ? 'Above' : item.status === 'below' ? 'Below' : 'Avg'}</span></td>
        ${dateCells}
      </tr>
    `;
  }).join('');
}

/* ---- helpers ---- */
function avg(arr) { return arr.reduce((s, v) => s + v, 0) / Math.max(arr.length, 1); }

function setBar(scoreId, barId, score) {
  const pctVal = Math.min(score * 100, 150);
  document.getElementById(scoreId).textContent = pct(Math.min(score * 100, 100), 1);
  const bar = document.getElementById(barId);
  bar.style.width = Math.min(pctVal, 100) + '%';
  bar.style.opacity = 1;
}

function renderEmpty() {
  ['totalTMR','avgAttendance','avgStrike','avgMarketHour','totalVisits','belowAttendTMR'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = '—';
  });
}

function renderPerformerList(containerId, tmrs, colorClass) {
  const el = document.getElementById(containerId);
  if (!tmrs.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);">No data</div>'; return; }
  const maxVal = Math.max(...tmrs.map(t => t.avgVisit), 1);
  el.innerHTML = tmrs.map(t => `
    <div class="progress-wrap">
      <span style="font-size:11px;color:var(--text-secondary);width:110px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.name)}</span>
      <div class="progress-track">
        <div class="progress-fill ${colorClass}" style="width:${(t.avgVisit/maxVal*100).toFixed(0)}%"></div>
      </div>
      <span style="font-size:11px;font-weight:600;min-width:30px;text-align:right;">${num(t.avgVisit,0)}</span>
    </div>
  `).join('');
}

function esc(str) {
  return String(str || '').replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* ============================================================
   CHARTS
   ============================================================ */

function renderStrikeChart(tmrList) {
  const ctx = document.getElementById('strikeChart');
  if (!ctx) return;
  const sorted = [...tmrList].sort((a, b) => b.avgVisit - a.avgVisit).slice(0, 15);
  const labels = sorted.map(t => t.name.split(' ')[0]);
  const values = sorted.map(t => parseFloat(t.avgVisit.toFixed(1)));
  const targets = sorted.map(t => t.sTgt);
  const colors  = sorted.map(t => t.avgVisit >= t.sTgt ? '#28a745' : t.avgVisit >= t.sTgt * 0.75 ? '#ffc107' : '#dc3545');

  if (strikeChartInst) strikeChartInst.destroy();
  strikeChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Avg Daily Visits',
          data: values,
          backgroundColor: colors,
          borderRadius: 4,
          barPercentage: 0.65
        },
        {
          label: 'Target',
          data: targets,
          type: 'line',
          borderColor: '#007bff',
          borderDash: [5, 4],
          pointRadius: 0,
          borderWidth: 1.5,
          fill: false
        }
      ]
    },
    options: {
      ...chartDefaults(),
      plugins: {
        ...chartDefaults().plugins,
        legend: { display: true, labels: { font: { size: 11 }, boxWidth: 12 } }
      }
    }
  });
}

function renderAttendanceChart(tmrList) {
  const ctx = document.getElementById('attendanceChart');
  if (!ctx) return;
  const sorted = [...tmrList].sort((a, b) => b.attendPct - a.attendPct).slice(0, 15);
  const labels = sorted.map(t => t.name.split(' ')[0]);
  const values = sorted.map(t => parseFloat(t.attendPct.toFixed(1)));
  const colors  = sorted.map(t => t.attendPct >= 80 ? '#28a745' : t.attendPct >= 65 ? '#ffc107' : '#dc3545');

  if (attendChartInst) attendChartInst.destroy();
  attendChartInst = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Attendance %',
        data: values,
        backgroundColor: colors,
        borderRadius: 4,
        barPercentage: 0.65
      }]
    },
    options: {
      ...chartDefaults(),
      scales: {
        ...chartDefaults().scales,
        y: { ...chartDefaults().scales.y, max: 100, ticks: { callback: v => v + '%', font: { size: 10 } } }
      }
    }
  });
}

function renderTrendChart(summary) {
  const ctx = document.getElementById('trendChart');
  if (!ctx) return;

  /* aggregate total visits per date */
  const dateMap = {};
  summary.forEach(r => {
    const d = String(r.date_).slice(0, 10);
    dateMap[d] = (dateMap[d] || 0) + (Number(r.agent_visit_count) || 0);
  });
  const dates  = Object.keys(dateMap).sort();
  const values = dates.map(d => dateMap[d]);

  if (trendChartInst) trendChartInst.destroy();
  trendChartInst = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => d.slice(5)), // show MM-DD
      datasets: [{
        label: 'Total visits',
        data: values,
        borderColor: '#007bff',
        backgroundColor: 'rgba(0,123,255,0.08)',
        fill: true,
        tension: 0.35,
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2
      }]
    },
    options: chartDefaults()
  });
}

/* ============================================================
   FILTER INIT & EVENTS
   ============================================================ */
(function initFilters() {
  const summary = DB.getSummaryRows();
  const daily   = DB.getDailyRows();
  const allRows = [...summary, ...daily];

  /* populate region dropdowns */
  ['filterRegion', 'strikeChartRegion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) populateRegionSelect(el, allRows);
  });

  /* set default date range to current month */
  const now  = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr   = now.toISOString().slice(0, 10);
  const fromEl  = document.getElementById('filterFrom');
  const toEl    = document.getElementById('filterTo');
  if (fromEl && !fromEl.value) fromEl.value = fromStr;
  if (toEl   && !toEl.value)   toEl.value   = toStr;

  /* events */
  document.getElementById('applyFilter')?.addEventListener('click', renderDashboard);
  document.getElementById('clearFilter')?.addEventListener('click', () => {
    document.getElementById('filterFrom').value   = fromStr;
    document.getElementById('filterTo').value     = toStr;
    document.getElementById('filterRegion').value = '';
    renderDashboard();
  });

  document.getElementById('refreshBtn')?.addEventListener('click', () => {
    renderDashboard();
  });

  document.getElementById('exportBtn')?.addEventListener('click', () => {
    const summary = DB.getSummaryRows();
    if (!summary.length) { alert('No data to export.'); return; }
    const headers = Object.keys(summary[0]);
    exportCSV(headers, summary, 'tmr_summary_export.csv');
  });

  /* initial render */
  renderDashboard();
})();