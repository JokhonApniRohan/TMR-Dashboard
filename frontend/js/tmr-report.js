/* ============================================================
   TMR Dashboard — tmr-report.js
   Drives tmr-report.html: populates the TMR performance table,
   summary metric cards, filters, and CSV export.
   ============================================================ */

(function () {

  /* ---- State ---- */
  let allSummary = [];
  let allDaily   = [];

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    allSummary = DB.getSummaryRows();
    allDaily   = DB.getDailyRows();

    // Populate filter dropdowns
    populateRegionSelect(document.getElementById('filterRegion'), [...allSummary, ...allDaily]);
    populateWalletSelect(allSummary);

    // Default date range → current month
    const now  = new Date();
    const fromEl = document.getElementById('filterFrom');
    const toEl   = document.getElementById('filterTo');
    if (fromEl && !fromEl.value) {
      fromEl.value = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
    }
    if (toEl && !toEl.value) {
      toEl.value = now.toISOString().slice(0, 10);
    }

    // Events
    document.getElementById('applyFilters')?.addEventListener('click', render);
    document.getElementById('resetFilters')?.addEventListener('click', () => {
      document.getElementById('filterFrom').value   = '';
      document.getElementById('filterTo').value     = '';
      document.getElementById('filterRegion').value = '';
      document.getElementById('filterWallet').value = '';
      render();
    });
    document.getElementById('exportTmrBtn')?.addEventListener('click', exportCsv);

    render();
  }

  /* ============================================================
     POPULATE WALLET DROPDOWN
     ============================================================ */
  function populateWalletSelect(rows) {
    const sel = document.getElementById('filterWallet');
    if (!sel) return;
    const wallets = [...new Set(rows.map(r => r.tmr_wallet).filter(Boolean))].sort();
    while (sel.options.length > 1) sel.remove(1);
    wallets.forEach(w => {
      const opt = document.createElement('option');
      opt.value = opt.textContent = w;
      sel.appendChild(opt);
    });
  }

  /* ============================================================
     MAIN RENDER
     ============================================================ */
  function render() {
    const from   = document.getElementById('filterFrom')?.value  || '';
    const to     = document.getElementById('filterTo')?.value    || '';
    const region = document.getElementById('filterRegion')?.value || '';
    const wallet = document.getElementById('filterWallet')?.value || '';

    // Filter summary rows
    let summary = allSummary;
    if (from || to) summary = filterByDateRange(summary, 'date_', from, to);
    if (region)     summary = summary.filter(r => r.region === region);
    if (wallet)     summary = summary.filter(r => r.tmr_wallet === wallet);

    // Build per-TMR aggregated data
    const tmrMap = {};
    summary.forEach(r => {
      const w = String(r.tmr_wallet || 'unknown');
      if (!tmrMap[w]) {
        tmrMap[w] = {
          wallet:   w,
          name:     r.tmr_name   || '—',
          region:   r.region     || '—',
          rows:     [],
          dateMap:  {}
        };
      }
      const item = tmrMap[w];
      item.rows.push(r);
      const date = String(r.date_).slice(0, 10);
      if (!item.dateMap[date]) item.dateMap[date] = { visits: 0, workTime: 0 };
      item.dateMap[date].visits   += Number(r.agent_visit_count)  || 0;
      item.dateMap[date].workTime += parseHours(r.working_time_h_m_s);
    });

    // Get DH master daily target per DH Code
    const dhList = JSON.parse(localStorage.getItem('tmr_dh_master') || '[]');
    const dhMap  = {};
    dhList.forEach(d => { dhMap[String(d.dh_code).toLowerCase()] = Number(d.daily_target) || 0; });

    const cfg    = DB.getConfig();
    const cfgMap = (cfg.tmrs || []).reduce((acc, t) => { if (t.wallet) acc[t.wallet] = t; return acc; }, {});

    const tmrList = Object.values(tmrMap).map(item => {
      // Daily visit target: config → fallback 30
      const cfgItem    = cfgMap[item.wallet] || {};
      const dailyTarget = Number(cfgItem.daily_visit_target) || 30;

      const totalDays   = item.rows.length;
      const presentDays = item.rows.filter(r => (Number(r.agent_visit_count) || 0) >= dailyTarget * ATTEND_TARGET).length;
      const fridayCount = Number(cfgItem.friday_count        || item.rows[0]?.friday_count        || 0);
      const govtHoliday = Number(cfgItem.govt_holiday_count  || item.rows[0]?.govt_holiday_count  || 0);
      const paidLeave   = Number(cfgItem.paid_leave           || item.rows[0]?.paid_leave          || 0);
      const payableDays = presentDays + fridayCount + govtHoliday + paidLeave;
      const attendancePct = totalDays ? (payableDays / totalDays) * 100 : 0;

      const avgVisit   = item.rows.reduce((s, r) => s + (Number(r.agent_visit_count) || 0), 0) / Math.max(totalDays, 1);
      const avgWorkHrs = item.rows.reduce((s, r) => s + parseHours(r.working_time_h_m_s), 0)   / Math.max(totalDays, 1);
      const kpi        = calcKPI(item.rows, item.region);

      return {
        wallet: item.wallet,
        name: item.name,
        region: item.region,
        presentDays,
        payableDays,
        attendancePct,
        avgVisit,
        avgWorkHrs,
        kpiScore: kpi.totalKPI * 100,
        dailyTarget
      };
    });

    // Sort by attendance desc
    tmrList.sort((a, b) => b.attendancePct - a.attendancePct);

    // ---- Metric cards ----
    const n = tmrList.length;
    document.getElementById('summaryTmrCount').textContent =
      n > 0 ? n : '—';
    document.getElementById('summaryAttendance').textContent =
      n > 0 ? pct(tmrList.reduce((s, t) => s + t.attendancePct, 0) / n, 0) : '—';
    document.getElementById('summaryStrike').textContent =
      n > 0 ? num(tmrList.reduce((s, t) => s + t.avgVisit, 0) / n, 1) : '—';
    document.getElementById('summaryKpi').textContent =
      n > 0 ? pct(tmrList.reduce((s, t) => s + t.kpiScore, 0) / n, 0) : '—';

    // ---- Table body ----
    const tbody = document.getElementById('tmrReportBody');
    if (!tbody) return;

    if (!tmrList.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state" style="padding:32px;text-align:center;color:var(--text-muted);">
        ${allSummary.length === 0
          ? 'No data loaded yet. <a href="upload.html">Upload Excel files</a> first.'
          : 'No records match the selected filters.'}
      </td></tr>`;
      return;
    }

    const esc = s => String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

    tbody.innerHTML = tmrList.map(t => {
      const attColor = t.attendancePct >= 80 ? 'green' : t.attendancePct >= 65 ? 'amber' : 'red';
      const kpiColor = t.kpiScore >= 80 ? 'green' : t.kpiScore >= 60 ? 'amber' : 'red';
      return `
        <tr>
          <td><strong>${esc(t.wallet)}</strong></td>
          <td>${esc(t.name)}</td>
          <td>${esc(t.region)}</td>
          <td>${t.presentDays}</td>
          <td>${t.payableDays}</td>
          <td>
            <span style="font-weight:600;color:var(--${attColor});">
              ${pct(t.attendancePct, 0)}
            </span>
          </td>
          <td>${fmtHours(t.avgWorkHrs)}</td>
          <td>
            ${num(t.avgVisit, 1)}
            <span style="font-size:10px;color:var(--text-muted);">/${t.dailyTarget}</span>
          </td>
          <td>
            <span style="font-weight:700;color:var(--${kpiColor});">
              ${pct(t.kpiScore, 0)}
            </span>
          </td>
        </tr>`;
    }).join('');
  }

  /* ============================================================
     CSV EXPORT
     ============================================================ */
  function exportCsv() {
    const rows = allSummary;
    if (!rows.length) { alert('No data to export.'); return; }
    const headers = ['tmr_wallet', 'tmr_name', 'region', 'date_', 'agent_visit_count', 'working_time_h_m_s'];
    exportCSV(headers, rows, 'tmr_report_export.csv');
  }

  /* ============================================================
     BOOT
     ============================================================ */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
