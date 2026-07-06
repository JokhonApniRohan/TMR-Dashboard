document.addEventListener('DOMContentLoaded', () => {
  initKpiPage();
});

function initKpiPage() {
  const from = document.getElementById('filterFrom');
  const to = document.getElementById('filterTo');
  const region = document.getElementById('filterRegion');
  const wallet = document.getElementById('filterWallet');
  const tbody = document.getElementById('kpiBody');

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
      const regionName = list[0]?.region || '—';
      const kpi = calcKPI(list, regionName);
      return {
        wallet,
        name: list[0]?.tmr_name || '—',
        regionName,
        marketHrScore: kpi.marketHrScore * 100,
        strikeScore: kpi.strikeScore * 100,
        freqScore: kpi.freqScore * 100,
        totalKpi: kpi.totalKPI * 100
      };
    }).sort((a, b) => b.totalKpi - a.totalKpi);

    const avgMarketHr = data.reduce((sum, item) => sum + item.marketHrScore, 0) / Math.max(data.length, 1);
    const avgStrike = data.reduce((sum, item) => sum + item.strikeScore, 0) / Math.max(data.length, 1);
    const avgFreq = data.reduce((sum, item) => sum + item.freqScore, 0) / Math.max(data.length, 1);
    const avgTotal = data.reduce((sum, item) => sum + item.totalKpi, 0) / Math.max(data.length, 1);

    document.getElementById('avgMarketScore').textContent = pct(avgMarketHr, 1);
    document.getElementById('avgStrikeScore').textContent = pct(avgStrike, 1);
    document.getElementById('avgFreqScore').textContent = pct(avgFreq, 1);
    document.getElementById('avgTotalScore').textContent = pct(avgTotal, 1);

    if (!data.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No KPI data available.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => `
      <tr>
        <td><strong>${esc(r.wallet)}</strong></td>
        <td>${esc(r.name)}</td>
        <td>${esc(r.regionName)}</td>
        <td>${pct(r.marketHrScore, 1)}</td>
        <td>${pct(r.strikeScore, 1)}</td>
        <td>${pct(r.totalKpi, 1)}</td>
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
