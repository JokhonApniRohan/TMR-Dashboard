/* ============================================================
   TMR Dashboard — main.js
   Shared utilities, data access, and sidebar toggle
   ============================================================ */

/* ---------- Sidebar toggle (mobile) ---------- */
(function () {
  const toggleBtn = document.getElementById('menuToggle');
  const sidebar   = document.getElementById('sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          e.target !== toggleBtn) {
        sidebar.classList.remove('open');
      }
    });
  }
})();

/* ============================================================
   DATA LAYER
   All data is stored in localStorage as JSON.
   Keys:
     tmr_daily_rows   → array of daily activity rows
     tmr_summary_rows → array of date-wise summary rows
     tmr_config       → { tmrs: [...], lastUpload: "date" }
   When the backend is ready, swap getLocal/setLocal with
   fetch('/api/...') calls.
   ============================================================ */

const DB = {
  _loaded: false,

  bootstrap() {
    if (this._loaded) return;
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'http://127.0.0.1:8000/api/data', false);
    xhr.send();
    if (xhr.status === 200) {
      try {
        const data = JSON.parse(xhr.responseText || '{}');
        this.saveDailyRows(Array.isArray(data.daily_rows) ? data.daily_rows : []);
        this.saveSummaryRows(Array.isArray(data.summary_rows) ? data.summary_rows : []);
        this.saveConfig(data.config || {});
      } catch (error) {
        console.warn('Unable to hydrate data from backend', error);
      }
    }
    this._loaded = true;
  },

  /* ---- read ---- */
  getDailyRows()   { return JSON.parse(localStorage.getItem('tmr_daily_rows')   || '[]'); },
  getSummaryRows() { return JSON.parse(localStorage.getItem('tmr_summary_rows') || '[]'); },
  getConfig()      { return JSON.parse(localStorage.getItem('tmr_config')       || '{}'); },

  /* ---- write ---- */
  saveDailyRows(rows)   { localStorage.setItem('tmr_daily_rows',   JSON.stringify(rows)); },
  saveSummaryRows(rows) { localStorage.setItem('tmr_summary_rows', JSON.stringify(rows)); },
  saveConfig(cfg)       { localStorage.setItem('tmr_config',       JSON.stringify(cfg));  },

  async saveUploadedData(dailyRows, summaryRows, config = {}) {
    const payload = {
      daily_rows: dailyRows || [],
      summary_rows: summaryRows || [],
      config: {
        ...this.getConfig(),
        ...config,
        lastUpload: config.lastUpload || new Date().toLocaleString()
      }
    };

    const response = await fetch('http://127.0.0.1:8000/api/upload/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || 'Upload failed');
    }

    const data = await response.json();
    this.saveDailyRows(Array.isArray(data.daily_rows) ? data.daily_rows : []);
    this.saveSummaryRows(Array.isArray(data.summary_rows) ? data.summary_rows : []);
    this.saveConfig(data.config || {});
    return data;
  },

  async clearAll() {
    const response = await fetch('http://127.0.0.1:8000/api/data', { method: 'DELETE' });
    if (!response.ok) throw new Error('Unable to clear backend data');
    localStorage.removeItem('tmr_daily_rows');
    localStorage.removeItem('tmr_summary_rows');
    localStorage.removeItem('tmr_config');
  }
};

DB.bootstrap();

/* ============================================================
   FILTER HELPERS
   ============================================================ */

/**
 * Parse "HH:MM:SS" or "H:MM:SS" string → decimal hours
 */
function parseHours(str) {
  if (!str) return 0;
  const parts = String(str).split(':').map(Number);
  if (parts.length < 2) return 0;
  return parts[0] + parts[1] / 60 + (parts[2] || 0) / 3600;
}

/**
 * Format decimal hours → "H:MM"
 */
function fmtHours(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  return `${hh}:${String(mm).padStart(2, '0')}`;
}

/**
 * Return only rows within [from, to] date strings (yyyy-mm-dd)
 */
function filterByDateRange(rows, dateField, from, to) {
  return rows.filter(r => {
    const d = String(r[dateField] || '').slice(0, 10);
    if (from && d < from) return false;
    if (to   && d > to)   return false;
    return true;
  });
}

/**
 * Return unique sorted list of regions from rows
 */
function getRegions(rows) {
  return [...new Set(rows.map(r => r.region).filter(Boolean))].sort();
}

/**
 * Populate a <select> with region options (keeps existing first option)
 */
function populateRegionSelect(selectEl, rows) {
  const current = selectEl.value;
  while (selectEl.options.length > 1) selectEl.remove(1);
  getRegions(rows).forEach(reg => {
    const opt = document.createElement('option');
    opt.value = opt.textContent = reg;
    selectEl.appendChild(opt);
  });
  selectEl.value = current;
}

/* ============================================================
   ATTENDANCE CALCULATION
   ============================================================ */

const BUSINESS_START = 10; // 10:00 AM
const BUSINESS_END   = 19; // 07:00 PM
const MIN_VISIT_MIN  = 3;
const MAX_VISIT_MIN  = 10;
const ATTEND_TARGET  = 0.75; // 75% of daily visit target

/**
 * Parse "HH:MM:SS" time string → decimal hours from midnight
 */
function parseTimeToHours(timeStr) {
  if (!timeStr) return null;
  const [h, m, s] = String(timeStr).split(':').map(Number);
  return h + m / 60 + (s || 0) / 3600;
}

/**
 * For a set of daily rows for ONE TMR on ONE day,
 * decide if attendance is valid.
 *
 * Rules:
 *   1. visit_time (duration) must be 3–10 minutes
 *   2. check-in must be within 10:00–19:00
 *   3. Valid visit count ÷ daily_visit_target ≥ 0.75
 *
 * @param {Array}  dayRows  - all rows for this TMR on this day
 * @param {number} target   - daily visit target for this TMR
 * @returns {{ present: boolean, validVisits: number, totalVisits: number }}
 */
function calcDayAttendance(dayRows, target) {
  let validVisits = 0;

  dayRows.forEach(row => {
    const dur = parseHours(row.visit_time_h_m_s) * 60; // minutes
    const checkin = parseTimeToHours(row.checkin_time);
    if (checkin === null) return;
    if (checkin < BUSINESS_START || checkin >= BUSINESS_END) return;
    if (dur < MIN_VISIT_MIN || dur > MAX_VISIT_MIN) return;
    validVisits++;
  });

  const present = target > 0
    ? (validVisits / target) >= ATTEND_TARGET
    : validVisits > 0;

  return { present, validVisits, totalVisits: dayRows.length };
}

/* ============================================================
   KPI CALCULATION
   ============================================================ */

/**
 * Strike Rate target by region type
 */
function strikeTarget(region) {
  if (!region) return 30;
  const r = String(region).toUpperCase();
  if (r.includes('DN') || r.includes('DS') || r.includes('CTG') || r.includes('METRO')) {
    if (r.includes('DN') || r.includes('DS') || r.includes('CTG')) return 35;
    return 40;
  }
  return 30;
}

/**
 * Frequency target by region type
 */
function freqTarget(region) {
  if (!region) return 180;
  const r = String(region).toUpperCase();
  if (r.includes('DN') || r.includes('DS') || r.includes('CTG')) return 210;
  if (r.includes('METRO')) return 240;
  return 180;
}

/**
 * Calculate KPI for one TMR over a date range.
 *
 * @param {Array}  summaryRows - filtered summary rows for this TMR
 * @param {string} region
 * @returns {{ marketHrScore, strikeScore, freqScore, totalKPI }}
 *          all scores are 0–1 (multiply × 100 for %)
 */
function calcKPI(summaryRows, region) {
  if (!summaryRows.length) return { marketHrScore: 0, strikeScore: 0, freqScore: 0, totalKPI: 0 };

  /* Market Hours — monthly average */
  const mktHrTarget = 7;
  const avgMktHr = summaryRows.reduce((s, r) => s + parseHours(r.working_time_h_m_s), 0) / summaryRows.length;
  const marketHrScore = avgMktHr >= mktHrTarget ? Math.min(avgMktHr / mktHrTarget, 1.5) : 0;

  /* Strike Rate — daily average */
  const avgVisit = summaryRows.reduce((s, r) => s + (Number(r.agent_visit_count) || 0), 0) / summaryRows.length;
  const sTgt = strikeTarget(region);
  const strikeScore = Math.min(avgVisit / sTgt, 1.5);

  /* Frequency — weekly average (sum over weeks, divide by week count) */
  // Group by ISO week
  const weekMap = {};
  summaryRows.forEach(r => {
    const d = new Date(String(r.date_).slice(0, 10));
    const wk = isoWeek(d);
    weekMap[wk] = (weekMap[wk] || 0) + (Number(r.agent_visit_count) || 0);
  });
  const weeks = Object.values(weekMap);
  const avgWeekly = weeks.reduce((s, v) => s + v, 0) / Math.max(weeks.length, 1);
  const fTgt = freqTarget(region);
  const freqScore = Math.min(avgWeekly / fTgt, 1.5);

  /* Weighted total */
  const totalKPI = marketHrScore * 0.25 + strikeScore * 0.35 + freqScore * 0.40;

  return { marketHrScore, strikeScore, freqScore, totalKPI };
}

/** ISO week number helper */
function isoWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/* ============================================================
   NUMBER FORMATTING
   ============================================================ */
function pct(val, decimals = 1) {
  return isNaN(val) ? '—' : val.toFixed(decimals) + '%';
}

function num(val, decimals = 1) {
  return isNaN(val) ? '—' : Number(val).toFixed(decimals);
}

/* ============================================================
   CHART DEFAULTS
   ============================================================ */
function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        labels: { font: { size: 11 }, boxWidth: 12 }
      },
      tooltip: { bodyFont: { size: 11 }, titleFont: { size: 11 } }
    },
    scales: {
      x: { ticks: { font: { size: 10 }, maxRotation: 40 }, grid: { display: false } },
      y: { ticks: { font: { size: 10 } }, grid: { color: '#f0f0f0' } }
    }
  };
}

/* ============================================================
   EXPORT TO CSV
   ============================================================ */
function exportCSV(headers, rows, filename) {
  const lines = [headers.join(','), ...rows.map(r => headers.map(h => `"${(r[h] ?? '').toString().replace(/"/g, '""')}"`).join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename || 'export.csv';
  a.click();
}

/* ---------- Show last upload time in sidebar ---------- */
(function () {
  const el = document.getElementById('lastUpload');
  if (!el) return;
  const cfg = DB.getConfig();
  el.textContent = cfg.lastUpload || 'Never';
})();