document.addEventListener('DOMContentLoaded', () => {
  initAttendancePage();
});

function initAttendancePage() {
  const from = document.getElementById('filterFrom');
  const to = document.getElementById('filterTo');
  const region = document.getElementById('filterRegion');
  const wallet = document.getElementById('filterWallet');
  const tbody = document.getElementById('attendanceBody');

  function populateWallets(rows) {
    const wallets = [...new Set(rows.map(r => String(r.tmr_wallet || '').trim()).filter(Boolean))].sort();
    const current = wallet.value;
    wallet.innerHTML = '<option value="">All wallets</option>' + wallets.map(w => `<option value="${w}">${w}</option>`).join('');
    if (current) wallet.value = current;
  }

  function getRows() {
    let summaryRows = DB.getSummaryRows();
    if (from.value) summaryRows = summaryRows.filter(r => String(r.date_ || '').slice(0, 10) >= from.value);
    if (to.value) summaryRows = summaryRows.filter(r => String(r.date_ || '').slice(0, 10) <= to.value);
    if (region.value) summaryRows = summaryRows.filter(r => String(r.region || '') === region.value);
    if (wallet.value) summaryRows = summaryRows.filter(r => String(r.tmr_wallet || '') === wallet.value);
    return summaryRows;
  }

  function render() {
    const rows = getRows();
    const grouped = new Map();
    rows.forEach(row => {
      const key = String(row.tmr_wallet || '').trim();
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });

    const data = [...grouped.entries()].map(([wallet, list]) => {
      const payableDays = list.length;
      const presentDays = list.filter(r => (Number(r.agent_visit_count) || 0) >= 30 * 0.75).length;
      const attendancePct = payableDays ? (presentDays / payableDays) * 100 : 0;
      const avgMarketHours = list.reduce((sum, r) => sum + parseHours(r.working_time_h_m_s), 0) / Math.max(payableDays, 1);
      const avgStrike = list.reduce((sum, r) => sum + (Number(r.agent_visit_count) || 0), 0) / Math.max(payableDays, 1);
      return {
        wallet,
        name: list[0]?.tmr_name || '—',
        region: list[0]?.region || '—',
        presentDays,
        payableDays,
        attendancePct,
        avgMarketHours,
        avgStrike
      };
    }).sort((a, b) => b.attendancePct - a.attendancePct);

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="8" class="empty-state">No attendance data available.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong>${esc(r.wallet)}</strong></td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.region)}</td>
        <td>${r.presentDays}</td>
        <td>${r.payableDays}</td>
        <td>${pct(r.attendancePct, 1)}</td>
        <td>${fmtHours(r.avgMarketHours)}</td>
        <td>${num(r.avgStrike, 1)}</td>
      </tr>
    `).join('');
  }

  const summaryRows = DB.getSummaryRows();
  populateWallets(summaryRows);
  populateRegionSelect(region, summaryRows);

  document.getElementById('applyFilters').addEventListener('click', render);
  document.getElementById('resetFilters').addEventListener('click', () => {
    from.value = '';
    to.value = '';
    region.value = '';
    wallet.value = '';
    render();
  });

  render();
}
