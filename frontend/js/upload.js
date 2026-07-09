document.addEventListener('DOMContentLoaded', () => {
  initUploadPage();
});

function initUploadPage() {
  const dailyInput = document.getElementById('dailyFile');
  const summaryInput = document.getElementById('summaryFile');
  const dailyDrop = document.getElementById('dailyDrop');
  const summaryDrop = document.getElementById('summaryDrop');
  const processBtn = document.getElementById('processBtn');
  const resetFilesBtn = document.getElementById('resetFilesBtn');
  const clearDataBtn = document.getElementById('clearDataBtn');
  const clearLogBtn = document.getElementById('clearLogBtn');

  let dailyParsed = null;
  let summaryParsed = null;

  const state = {
    daily: null,
    summary: null
  };

  function log(message, type = 'info') {
    const box = document.getElementById('logBox');
    if (!box) return;
    const line = document.createElement('div');
    line.className = `log-${type}`;
    line.textContent = message;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
  }

  function clearLog() {
    const box = document.getElementById('logBox');
    if (box) box.innerHTML = '<span class="log-info">► Ready. Upload files above and click Process &amp; Save.</span>';
  }

  function refreshStats() {
    const dailyRows = DB.getDailyRows();
    const summaryRows = DB.getSummaryRows();
    const tmrs = new Set([...dailyRows.map(r => r.tmr_wallet), ...summaryRows.map(r => r.tmr_wallet)].filter(Boolean));
    const dates = [...new Set([...dailyRows.map(r => String(r.created_at || '').slice(0, 10)), ...summaryRows.map(r => String(r.date_ || '').slice(0, 10))].filter(Boolean))].sort();

    const statDaily = document.getElementById('statDailyRows');
    const statSummary = document.getElementById('statSummaryRows');
    const statTMRs = document.getElementById('statTMRs');
    const statDateRange = document.getElementById('statDateRange');

    if (statDaily) statDaily.textContent = dailyRows.length.toLocaleString();
    if (statSummary) statSummary.textContent = summaryRows.length.toLocaleString();
    if (statTMRs) statTMRs.textContent = tmrs.size.toLocaleString();
    if (statDateRange) statDateRange.textContent = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : 'No data';

    const lastUpload = document.getElementById('lastUpload');
    if (lastUpload) {
      const cfg = DB.getConfig();
      lastUpload.textContent = cfg.lastUpload || 'Never';
    }
  }

  function resetPreview(type) {
    const previewWrap = type === 'daily' ? document.getElementById('dailyPreviewWrap') : document.getElementById('summaryPreviewWrap');
    const preview = type === 'daily' ? document.getElementById('dailyPreview') : document.getElementById('summaryPreview');
    const rowCount = type === 'daily' ? document.getElementById('dailyRowCount') : document.getElementById('summaryRowCount');
    const chosen = type === 'daily' ? document.getElementById('dailyChosen') : document.getElementById('summaryChosen');
    if (previewWrap) previewWrap.style.display = 'none';
    if (preview) preview.innerHTML = '';
    if (rowCount) rowCount.textContent = '';
    if (chosen) chosen.textContent = '✓ File selected';
    if (type === 'daily') {
      dailyParsed = null;
      state.daily = null;
    } else {
      summaryParsed = null;
      state.summary = null;
    }
    updateProcessState();
  }

  function updateProcessState() {
    const enabled = Boolean(state.daily || state.summary);
    if (processBtn) processBtn.disabled = !enabled;
    const status = document.getElementById('processStatus');
    if (status) status.textContent = enabled ? 'Ready to process selected files.' : 'Select at least one Excel file to continue.';
  }

  function setDropState(dropEl, ready) {
    dropEl.classList.toggle('ready', ready);
  }

  function showPreview(type, rows) {
    const wrap = type === 'daily' ? document.getElementById('dailyPreviewWrap') : document.getElementById('summaryPreviewWrap');
    const table = type === 'daily' ? document.getElementById('dailyPreview') : document.getElementById('summaryPreview');
    const rowCount = type === 'daily' ? document.getElementById('dailyRowCount') : document.getElementById('summaryRowCount');
    const chosen = type === 'daily' ? document.getElementById('dailyChosen') : document.getElementById('summaryChosen');
    if (!wrap || !table) return;

    const previewRows = rows.slice(0, 5);
    const headers = Object.keys(previewRows[0] || {});
    table.innerHTML = '';
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    previewRows.forEach(row => {
      const tr = document.createElement('tr');
      headers.forEach(h => {
        const td = document.createElement('td');
        td.textContent = String(row[h] ?? '');
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    wrap.style.display = 'block';
    if (rowCount) rowCount.textContent = `${rows.length.toLocaleString()} rows detected`;
    if (chosen) chosen.textContent = '✓ File selected';
  }

  function normalizeHeader(key) {
    const raw = String(key || '').trim().toLowerCase();
    const aliases = {
      date: 'date_',
      'date_': 'date_',
      'created_at': 'created_at',
      'tmr_wallet': 'tmr_wallet',
      'tmr_name': 'tmr_name',
      'agent_wallet': 'agent_wallet',
      'agent_name': 'agent_name',
      'region': 'region',
      'dh_code': 'dh_code',
      'distributor_house_name': 'distributor_house_name',
      'checkin_time': 'checkin_time',
      'checkout_time': 'checkout_time',
      'visit_time_h_m_s': 'visit_time_h_m_s',
      'day_first_checkin': 'day_first_checkin',
      'day_last_checkout': 'day_last_checkout',
      'day_working_hour': 'day_working_hour',
      'document_title': 'document_title',
      'activity_distance_in_meter': 'activity_distance_in_meter',
      'under_distance_in_meter': 'under_distance_in_meter',
      'working_time_h_m_s': 'working_time_h_m_s',
      'agent_visit_count': 'agent_visit_count',
      'under_15_meter': 'under_15_meter',
      'under_15': 'under_15_meter',
      'under_15m': 'under_15_meter',
      '15_and_50': 'between_15_and_50_meter',
      '15_to_50': 'between_15_and_50_meter',
      'between_15_and_50': 'between_15_and_50_meter',
      'above_50_meter': 'above_50_meter',
      'above_50': 'above_50_meter',
      'no_activity': 'no_activity',
      'total_new_festoon': 'total_new_festoon',
      'total_new_poster': 'total_new_poster',
      'total_new_pan_sticker': 'total_new_pan_sticker',
      'total_new_running_sticker': 'total_new_running_sticker',
      'total_new_shop_screen': 'total_new_shop_screen',
      'total_new_table_sticker': 'total_new_table_sticker',
      'total_new_qr_sticker': 'total_new_qr_sticker'
    };
    const normalized = raw.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    return aliases[normalized] || normalized;
  }

  function normalizeValue(value) {
    if (value instanceof Date) {
      return value.toISOString().slice(0, 10);
    }
    if (typeof value === 'number' && !Number.isFinite(value)) {
      return '';
    }
    return value ?? '';
  }

  function normalizeRows(rows) {
    return rows.map(row => {
      const normalized = {};
      Object.entries(row).forEach(([key, value]) => {
        const cleanKey = normalizeHeader(key);
        normalized[cleanKey] = normalizeValue(value);
      });
      return normalized;
    });
  }

  function parseWorkbook(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = event.target.result;
          const workbook = file.name.toLowerCase().endsWith('.csv')
            ? XLSX.read(data, { type: 'string' })
            : XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false });
          resolve(normalizeRows(rows));
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('Unable to read the selected file.'));
      if (file.name.toLowerCase().endsWith('.csv')) {
        reader.readAsText(file);
      } else {
        reader.readAsArrayBuffer(file);
      }
    });
  }

  async function handleFileSelection(file, type) {
    if (!file) return;
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
      log(`Unsupported format: .${ext}`, 'err');
      return;
    }

    const dropEl = type === 'daily' ? dailyDrop : summaryDrop;
    const inputEl = type === 'daily' ? dailyInput : summaryInput;
    try {
      setDropState(dropEl, true);
      log(`Reading ${file.name}...`, 'info');
      const rows = await parseWorkbook(file);
      if (!rows.length) {
        log('The file did not contain any rows.', 'warn');
        return;
      }
      if (type === 'daily') {
        state.daily = rows;
        dailyParsed = rows;
      } else {
        state.summary = rows;
        summaryParsed = rows;
      }
      showPreview(type, rows);
      updateProcessState();
      log(`${rows.length.toLocaleString()} rows prepared from ${file.name}.`, 'ok');
      if (inputEl) inputEl.value = '';
    } catch (error) {
      log(`Failed to read ${file.name}: ${error.message}`, 'err');
    }
  }

  if (dailyInput) {
    dailyInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) handleFileSelection(file, 'daily');
    });
  }

  if (summaryInput) {
    summaryInput.addEventListener('change', (event) => {
      const file = event.target.files?.[0];
      if (file) handleFileSelection(file, 'summary');
    });
  }

  ['daily', 'summary'].forEach(type => {
    const dropEl = type === 'daily' ? dailyDrop : summaryDrop;
    const inputEl = type === 'daily' ? dailyInput : summaryInput;
    if (!dropEl || !inputEl) return;

    dropEl.addEventListener('dragover', (event) => {
      event.preventDefault();
      dropEl.classList.add('drag-over');
    });
    dropEl.addEventListener('dragleave', () => dropEl.classList.remove('drag-over'));
    dropEl.addEventListener('drop', (event) => {
      event.preventDefault();
      dropEl.classList.remove('drag-over');
      const file = event.dataTransfer?.files?.[0];
      if (file) handleFileSelection(file, type);
    });
    dropEl.addEventListener('click', () => inputEl.click());
  });

  if (processBtn) {
    processBtn.addEventListener('click', () => {
      const dailyRows = state.daily || [];
      const summaryRows = state.summary || [];
      if (!dailyRows.length && !summaryRows.length) {
        log('No rows were selected.', 'warn');
        return;
      }

      const addedDaily = DB.mergeDailyRows(dailyRows);
      const addedSummary = DB.mergeSummaryRows(summaryRows);
      const cfg = DB.getConfig();
      cfg.lastUpload = new Date().toLocaleString();
      DB.saveConfig(cfg);

      log(`Saved ${addedDaily} new daily rows and ${addedSummary} new summary rows.`, 'ok');
      refreshStats();
      updateProcessState();
      document.getElementById('processStatus').textContent = 'Data saved locally. You can open the dashboard now.';
    });
  }

  if (resetFilesBtn) {
    resetFilesBtn.addEventListener('click', () => {
      if (dailyInput) dailyInput.value = '';
      if (summaryInput) summaryInput.value = '';
      resetPreview('daily');
      resetPreview('summary');
      setDropState(dailyDrop, false);
      setDropState(summaryDrop, false);
      log('Upload inputs reset.', 'info');
    });
  }

  if (clearDataBtn) {
    clearDataBtn.addEventListener('click', () => {
      if (confirm('Remove all uploaded data from this browser?')) {
        DB.clearAll();
        refreshStats();
        resetPreview('daily');
        resetPreview('summary');
        setDropState(dailyDrop, false);
        setDropState(summaryDrop, false);
        log('All local data was cleared.', 'warn');
      }
    });
  }

  if (clearLogBtn) {
    clearLogBtn.addEventListener('click', clearLog);
  }

  refreshStats();
  updateProcessState();
}
