/* ============================================================
   TMR Dashboard — dh-master.js
   DH (Distributor House) Master data management
   Columns: DH Code | Distributor House Name | Market type | Daily visit target
   Storage key: tmr_dh_master  (array of DH objects)
   ============================================================ */


/* ---------- API ---------- */

const API_BASE = "http://127.0.0.1:8000/api/dh-master";

async function apiGetAll() {

    const response = await fetch(API_BASE);

    if (!response.ok) {
        throw new Error("Failed to load DH data.");
    }

    return await response.json();
}


async function apiGetStatistics() {

    const response = await fetch(
        `${API_BASE}/statistics`
    );

    if (!response.ok) {
        throw new Error("Failed to load statistics.");
    }

    return await response.json();
}


async function apiCreate(record) {

    const response = await fetch(API_BASE, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        body: JSON.stringify(record)

    });

    if (!response.ok) {

        const err = await response.json();

        throw new Error(err.detail);
    }

    return await response.json();
}


async function apiUpdate(code, record) {

    const response = await fetch(
        `${API_BASE}/${encodeURIComponent(code)}`,
        {

            method: "PUT",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(record)

        }
    );

    if (!response.ok) {

        const err = await response.json();

        throw new Error(err.detail);
    }

    return await response.json();
}


async function apiDelete(code) {

    const response = await fetch(
    `http://127.0.0.1:8000/api/dh-master/${encodeURIComponent(deleteId)}`,
    {
        method: "DELETE"
    }
);

    if (!response.ok) {

        const err = await response.json();

        throw new Error(err.detail);
    }

    return await response.json();
}


async function apiImport(rows, mode) {

    const response = await fetch(
        `${API_BASE}/import`,
        {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({

                rows,

                mode

            })

        }
    );

    if (!response.ok) {

        const err = await response.json();

        throw new Error(err.detail);
    }

    return await response.json();
}




/* ---------- State ---------- */
let dhData        = [];   // full list (source of truth from localStorage)
let filteredData  = [];   // after search + market filter
let sortCol       = 'dh_code';
let sortDir       = 'asc';
let currentPage   = 1;
const PAGE_SIZE   = 25;
let editId        = null; // null = add mode, string = edit mode (dh_code of record)
let deleteId      = null;
let importRows    = [];   // parsed rows waiting for import confirmation

/* ---------- DOM refs ---------- */
const dhTableBody    = document.getElementById('dhTableBody');
const searchInput    = document.getElementById('searchInput');
const marketPills    = document.getElementById('marketPills');
const tableCount     = document.getElementById('tableCount');
const paginationBar  = document.getElementById('paginationBar');

// Summary
const statTotal      = document.getElementById('statTotal');
const statAvgTarget  = document.getElementById('statAvgTarget');
const statMaxTarget  = document.getElementById('statMaxTarget');
const statMaxDH      = document.getElementById('statMaxDH');
const statMktTypes   = document.getElementById('statMarketTypes');
const statTotalTgt   = document.getElementById('statTotalTarget');

// Add/Edit modal
const dhModal        = document.getElementById('dhModal');
const modalTitle     = document.getElementById('modalTitle');
const fDhCode        = document.getElementById('fDhCode');
const fDhName        = document.getElementById('fDhName');
const fMarketType    = document.getElementById('fMarketType');
const fDailyTarget   = document.getElementById('fDailyTarget');

// Delete modal
const deleteModal    = document.getElementById('deleteModal');
const deleteTargetName = document.getElementById('deleteTargetName');

// Import modal
const importModal    = document.getElementById('importModal');
const importDrop     = document.getElementById('importDrop');
const importFile     = document.getElementById('importFile');
const importPreviewWrap = document.getElementById('importPreviewWrap');
const importPreviewTable = document.getElementById('importPreviewTable');
const importRowCount = document.getElementById('importRowCount');
const importModeWrap = document.getElementById('importModeWrap');
const importConfirmBtn = document.getElementById('importConfirmBtn');

/* ============================================================
   INITIALIZATION
   ============================================================ */
async function init() {

    bindEvents();

    await reloadData();

}

async function reloadData() {

    try {

        dhData = await apiGetAll();

        refreshAll();

    }

    catch (err) {

        toast(err.message, "error");

    }

}

/* ============================================================
   MAIN RENDER
   ============================================================ */
function refreshAll() {
  applyFilter();
  renderSummaryCards();
  renderMarketPills();
}

function applyFilter() {
  const q     = searchInput.value.trim().toLowerCase();
  const mkt   = getActivePill();

  filteredData = dhData.filter(d => {
    const matchQ   = !q || d.dh_code.toLowerCase().includes(q) || d.dh_name.toLowerCase().includes(q);
    const matchMkt = !mkt || d.market_type.toLowerCase() === mkt.toLowerCase();
    return matchQ && matchMkt;
  });

  // Sort
  filteredData.sort((a, b) => {
    let va = a[sortCol], vb = b[sortCol];
    if (sortCol === 'daily_target') { va = Number(va); vb = Number(vb); }
    else { va = String(va || '').toLowerCase(); vb = String(vb || '').toLowerCase(); }
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  });

  currentPage = 1;
  renderTable();
  renderPagination();
}

function renderTable() {
  const maxTarget = dhData.length ? Math.max(...dhData.map(d => Number(d.daily_target) || 0)) : 1;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = filteredData.slice(start, start + PAGE_SIZE);

  tableCount.textContent = `${filteredData.length} record${filteredData.length !== 1 ? 's' : ''}`;

  if (!filteredData.length) {
    dhTableBody.innerHTML = `
      <tr><td colspan="5">
        <div class="table-empty">
          <i class="ti ti-building-store"></i>
          <p>${dhData.length === 0
            ? 'No DH records yet. Click <strong>Add DH</strong> or <strong>Import Excel</strong> to get started.'
            : 'No records match your search or filter.'}</p>
        </div>
      </td></tr>`;
    return;
  }

  dhTableBody.innerHTML = pageRows.map((d, idx) => {
    const tgt  = Number(d.daily_target) || 0;
    const pct  = maxTarget > 0 ? Math.round((tgt / maxTarget) * 100) : 0;
    const badge = marketTypeBadge(d.market_type);

    return `
      <tr data-code="${escHtml(d.dh_code)}">
        <td><strong>${escHtml(d.dh_code)}</strong></td>
        <td>${escHtml(d.dh_name)}</td>
        <td>${badge}</td>
        <td>
          <div class="target-cell">
            <div class="target-bar-wrap">
              <div class="target-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="target-num">${tgt}</span>
          </div>
        </td>
        <td style="text-align:center;">
          <div class="row-actions" style="justify-content:center;">
            <button class="btn-icon-sm edit" title="Edit" onclick="openEditModal('${escAttr(d.dh_code)}')">
              <i class="ti ti-pencil"></i>
            </button>
            <button class="btn-icon-sm del" title="Delete" onclick="openDeleteModal('${escAttr(d.dh_code)}')">
              <i class="ti ti-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderSummaryCards() {
  const list = dhData;
  if (!list.length) {
    statTotal.textContent    = '0';
    statAvgTarget.textContent = '—';
    statMaxTarget.textContent = '—';
    statMaxDH.textContent     = '—';
    statMktTypes.textContent  = '—';
    statTotalTgt.textContent  = '—';
    return;
  }

  const targets = list.map(d => Number(d.daily_target) || 0);
  const total   = targets.reduce((s, v) => s + v, 0);
  const avg     = total / list.length;
  const max     = Math.max(...targets);
  const maxRow  = list.find(d => Number(d.daily_target) === max);
  const types   = new Set(list.map(d => d.market_type).filter(Boolean));

  statTotal.textContent    = list.length;
  statAvgTarget.textContent = avg.toFixed(1);
  statMaxTarget.textContent = max;
  statMaxDH.textContent     = maxRow ? maxRow.dh_code : '—';
  statMktTypes.textContent  = types.size;
  statTotalTgt.textContent  = total;
}

function renderMarketPills() {
  const current = getActivePill();
  const types   = [...new Set(dhData.map(d => d.market_type).filter(Boolean))].sort();

  // Rebuild pills
  marketPills.innerHTML = `<button class="pill${current === '' ? ' active' : ''}" data-market="">All</button>`;
  types.forEach(t => {
    const active = current.toLowerCase() === t.toLowerCase() ? ' active' : '';
    marketPills.innerHTML += `<button class="pill${active}" data-market="${escAttr(t)}">${escHtml(t)}</button>`;
  });

  // Re-bind pill clicks
  marketPills.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
      marketPills.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      currentPage = 1;
      applyFilter();
    });
  });
}

function renderPagination() {
  const total  = filteredData.length;
  const pages  = Math.ceil(total / PAGE_SIZE);

  if (pages <= 1) { paginationBar.innerHTML = ''; return; }

  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);

  let html = `<span class="page-info">${start}–${end} of ${total}</span>`;

  html += `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
             <i class="ti ti-chevron-left" style="font-size:12px;"></i>
           </button>`;

  // Show window of pages
  const WINDOW = 5;
  let pStart = Math.max(1, currentPage - 2);
  let pEnd   = Math.min(pages, pStart + WINDOW - 1);
  if (pEnd - pStart < WINDOW - 1) pStart = Math.max(1, pEnd - WINDOW + 1);

  if (pStart > 1) html += `<button class="page-btn" onclick="goPage(1)">1</button><span style="padding:0 4px;color:var(--text-muted)">…</span>`;

  for (let p = pStart; p <= pEnd; p++) {
    html += `<button class="page-btn${p === currentPage ? ' active' : ''}" onclick="goPage(${p})">${p}</button>`;
  }

  if (pEnd < pages) html += `<span style="padding:0 4px;color:var(--text-muted)">…</span><button class="page-btn" onclick="goPage(${pages})">${pages}</button>`;

  html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>
             <i class="ti ti-chevron-right" style="font-size:12px;"></i>
           </button>`;

  paginationBar.innerHTML = html;
}

function goPage(p) {
  const pages = Math.ceil(filteredData.length / PAGE_SIZE);
  currentPage = Math.max(1, Math.min(p, pages));
  renderTable();
  renderPagination();
}

/* ============================================================
   ADD / EDIT MODAL
   ============================================================ */
function openAddModal() {
  editId = null;
  modalTitle.textContent = 'Add Distributor House';
  fDhCode.value = '';
  fDhName.value = '';
  fMarketType.value = '';
  fDailyTarget.value = '';
  fDhCode.disabled = false;
  clearFieldErrors();
  dhModal.classList.add('open');
  fDhCode.focus();
}

function openEditModal(code) {
  const row = dhData.find(d => d.dh_code === code);
  if (!row) return;
  editId = code;
  modalTitle.textContent = 'Edit Distributor House';
  fDhCode.value = row.dh_code;
  fDhName.value = row.dh_name;
  fMarketType.value = row.market_type;
  fDailyTarget.value = row.daily_target;
  fDhCode.disabled = false; // DH Code is the key, don't allow editing
  clearFieldErrors();
  dhModal.classList.add('open');
  fDhName.focus();
}

function closeModal() {
  dhModal.classList.remove('open');
  editId = null;
}

function clearFieldErrors() {
  document.querySelectorAll('.field-error').forEach(el => el.classList.remove('show'));
}

function validateForm() {
  let ok = true;
  clearFieldErrors();

  const code = fDhCode.value.trim();
  const name = fDhName.value.trim();
  const mkt  = fMarketType.value;
  const tgt  = parseInt(fDailyTarget.value, 10);

  if (!code) {
    document.getElementById('errDhCode').classList.add('show');
    ok = false;
  } else if (editId === null) {
    // Check uniqueness only on add
    if (dhData.some(d => d.dh_code.toLowerCase() === code.toLowerCase())) {
      document.getElementById('errDhCode').textContent = 'This DH Code already exists.';
      document.getElementById('errDhCode').classList.add('show');
      ok = false;
    }
  }

  if (!name) {
    document.getElementById('errDhName').classList.add('show');
    ok = false;
  }

  if (!mkt) {
    document.getElementById('errMarketType').classList.add('show');
    ok = false;
  }

  if (!fDailyTarget.value || isNaN(tgt) || tgt < 1 || tgt > 999) {
    document.getElementById('errDailyTarget').classList.add('show');
    ok = false;
  }

  return ok;
}

async function saveRecord() {

    if (!validateForm()) return;

    const record = {

        dh_code: fDhCode.value.trim(),

        dh_name: fDhName.value.trim(),

        market_type: fMarketType.value,

        daily_target: parseInt(fDailyTarget.value, 10)

    };

    try {

        if (editId === null) {

            await apiCreate(record);

            toast(`DH "${record.dh_code}" added.`, "success");

        }

        else {

            await apiUpdate(editId, record);

            toast(`DH "${editId}" updated.`, "success");

        }

        closeModal();

        await reloadData();

        setTimeout(() => {

            const row = dhTableBody.querySelector(
                `tr[data-code="${editId || record.dh_code}"]`
            );

            if (row) {
                row.classList.add("row-new");
            }

        }, 100);

    }

    catch (err) {

        toast(err.message, "error");

    }

}




/* ============================================================
   DELETE MODAL
   ============================================================ */
function openDeleteModal(code) {
  const row = dhData.find(d => d.dh_code === code);
  if (!row) return;
  deleteId = code;
  deleteTargetName.textContent = `${row.dh_code} — ${row.dh_name}`;
  deleteModal.classList.add('open');
}

function closeDeleteModal() {
  deleteModal.classList.remove('open');
  deleteId = null;
}

async function confirmDelete() {

    if (!deleteId) return;

    try {

        const response = await fetch(
           `http://127.0.0.1:8000/api/dh-master/${encodeURIComponent(deleteId)}`,
    {
        method: "DELETE"
    }
);

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || "Failed to delete DH.");
        }

        toast(result.message || "DH deleted successfully.", "warn");

        closeDeleteModal();

        await loadDHData();

    }
    catch (err) {

        toast(err.message, "error");

    }

}

/* ============================================================
   IMPORT EXCEL
   ============================================================ */
function openImportModal() {
  importRows = [];
  importFile.value = '';
  importPreviewWrap.style.display = 'none';
  importModeWrap.style.display   = 'none';
  importConfirmBtn.disabled       = true;
  importDrop.classList.remove('drag-over');
  importModal.classList.add('open');
}

function closeImportModal() {
  importModal.classList.remove('open');
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb   = XLSX.read(e.target.result, { type: 'binary' });
      const ws   = wb.Sheets[wb.SheetNames[0]];
      const raw  = XLSX.utils.sheet_to_json(ws, { defval: '' });
      importRows = parseImportRows(raw);
      renderImportPreview(importRows, raw.length);
    } catch (err) {
      toast('Could not read the file. Ensure it is a valid Excel/CSV.', 'error');
    }
  };
  reader.readAsBinaryString(file);
}

/** Normalize column names from the Excel sheet to our internal keys */
function parseImportRows(raw) {
  return raw.map(r => {
    // Flexible key matching (case-insensitive, strip spaces)
    const norm = {};
    Object.keys(r).forEach(k => {
      norm[k.toLowerCase().replace(/\s+/g, '_')] = r[k];
    });

    return {
      dh_code     : String(norm['dh_code']                   || norm['dhcode']          || '').trim(),
      dh_name     : String(norm['distributor_house_name']    || norm['dh_name']         || '').trim(),
      market_type : String(norm['market_type']               || norm['markettype']       || '').trim(),
      daily_target: parseInt(norm['daily_visit_target']      || norm['daily_target']     || 0, 10) || 0,
    };
  }).filter(r => r.dh_code); // skip rows without DH Code
}

function renderImportPreview(rows, totalRaw) {
  if (!rows.length) {
    toast('No valid rows found. Check that column names match the required format.', 'error');
    return;
  }

  const preview = rows.slice(0, 5);
  const headers = ['dh_code', 'dh_name', 'market_type', 'daily_target'];
  const headerLabels = ['DH Code', 'DH Name', 'Market Type', 'Daily Target'];

  importPreviewTable.innerHTML = `
    <thead><tr>${headerLabels.map(h => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>
      ${preview.map(r => `<tr>${headers.map(h => `<td>${escHtml(String(r[h]))}</td>`).join('')}</tr>`).join('')}
    </tbody>`;

  importRowCount.textContent = `${rows.length} valid row(s) parsed (${totalRaw} total in file).`;

  importPreviewWrap.style.display = 'block';
  importModeWrap.style.display    = 'block';
  importConfirmBtn.disabled       = false;
}

async function doImport() {

  if (!importRows.length) return;

  const mode = document.querySelector(
    'input[name="importMode"]:checked'
  ).value;

  try {

    const result = await apiImport(
      importRows,
      mode
    );

    await reloadData();

    closeImportModal();

    if (mode === "replace") {

      toast(
        `Replaced all data - ${result.records} DH record(s) imported.`,
        "success"
      );

    } else {

      toast(
        `Merged: ${result.added} new record(s) added, ${result.skipped} duplicate(s) skipped.`,
        "success"
      );

    }

  }

  catch (err) {

    toast(err.message, "error");

  }

}
/* ============================================================
   EXPORT CSV
   ============================================================ */
function exportDHCsv() {
  if (!dhData.length) { toast('No data to export.', 'warn'); return; }
  const headers = ['DH Code', 'Distributor House Name', 'Market type', 'Daily visit target'];
  const lines = [
    headers.join(','),
    ...dhData.map(d =>
      [d.dh_code, d.dh_name, d.market_type, d.daily_target]
        .map(v => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    )
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'dh_master.csv';
  a.click();
  toast(`Exported ${dhData.length} record(s) to CSV.`, 'success');
}

/* ============================================================
   SORTING
   ============================================================ */
function bindSortHeaders() {
  document.querySelectorAll('#dhTable thead th[data-col]').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc';
      } else {
        sortCol = col;
        sortDir = 'asc';
      }
      updateSortUI();
      applyFilter();
    });
  });
}

function updateSortUI() {
  document.querySelectorAll('#dhTable thead th[data-col]').forEach(th => {
    th.classList.remove('sort-asc', 'sort-desc');
    if (th.dataset.col === sortCol) {
      th.classList.add(sortDir === 'asc' ? 'sort-asc' : 'sort-desc');
    }
  });
}

/* ============================================================
   UTILITIES
   ============================================================ */
function getActivePill() {
  const active = marketPills.querySelector('.pill.active');
  return active ? active.dataset.market : '';
}

function marketTypeBadge(type) {
  if (!type) return `<span class="mtype-badge mtype-default">—</span>`;
  const t = type.toLowerCase();
  let cls = 'mtype-default';
  if (t === 'urban')      cls = 'mtype-urban';
  else if (t === 'rural') cls = 'mtype-rural';
  else if (t === 'metro') cls = 'mtype-metro';
  else if (t.includes('semi')) cls = 'mtype-semi';
  return `<span class="mtype-badge ${cls}">${escHtml(type)}</span>`;
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escAttr(s) {
  return String(s).replace(/'/g, "\\'");
}

function toast(msg, type = 'success') {
  const el = document.createElement('div');
  el.className = `toast${type === 'error' ? ' error' : type === 'warn' ? ' warn' : ''}`;
  const icon = type === 'error' ? 'ti-alert-circle' : type === 'warn' ? 'ti-alert-triangle' : 'ti-check';
  el.innerHTML = `<i class="ti ${icon}"></i> ${msg}`;
  document.getElementById('toastContainer').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

/* ============================================================
   EVENT BINDING
   ============================================================ */
function bindEvents() {
  // Toolbar buttons
  document.getElementById('addDhBtn').addEventListener('click', openAddModal);
  document.getElementById('exportCsvBtn').addEventListener('click', exportDHCsv);
  document.getElementById('importExcelBtn').addEventListener('click', openImportModal);

  // Search
  searchInput.addEventListener('input', () => { currentPage = 1; applyFilter(); });

  // Sort headers
  bindSortHeaders();

  // Add/Edit modal
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
  document.getElementById('modalSaveBtn').addEventListener('click', saveRecord);
  dhModal.addEventListener('click', e => { if (e.target === dhModal) closeModal(); });

  // Enter key saves
  [fDhCode, fDhName, fDailyTarget].forEach(el => {
    el.addEventListener('keydown', e => { if (e.key === 'Enter') saveRecord(); });
  });
  fMarketType.addEventListener('keydown', e => { if (e.key === 'Enter') saveRecord(); });

  // Delete modal
  document.getElementById('deleteModalClose').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteCancelBtn').addEventListener('click', closeDeleteModal);
  document.getElementById('deleteConfirmBtn').addEventListener('click', confirmDelete);
  deleteModal.addEventListener('click', e => { if (e.target === deleteModal) closeDeleteModal(); });

  // Import modal
  document.getElementById('importModalClose').addEventListener('click', closeImportModal);
  document.getElementById('importCancelBtn').addEventListener('click', closeImportModal);
  document.getElementById('importConfirmBtn').addEventListener('click', doImport);
  importModal.addEventListener('click', e => { if (e.target === importModal) closeImportModal(); });

  // Import file input
  importFile.addEventListener('change', e => { handleImportFile(e.target.files[0]); });

  // Import drag & drop
  importDrop.addEventListener('dragover', e => { e.preventDefault(); importDrop.classList.add('drag-over'); });
  importDrop.addEventListener('dragleave', () => importDrop.classList.remove('drag-over'));
  importDrop.addEventListener('drop', e => {
    e.preventDefault();
    importDrop.classList.remove('drag-over');
    handleImportFile(e.dataTransfer.files[0]);
  });

  // Escape key closes any open modal
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeModal();
      closeDeleteModal();
      closeImportModal();
    }
  });
}

/* ============================================================
   BOOT
   ============================================================ */
init();
