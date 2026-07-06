document.addEventListener('DOMContentLoaded', () => {
  const details = document.getElementById('report-details');
  if (!details) return;

  fetch('data/summary.json')
    .then((response) => {
      if (!response.ok) throw new Error('Report data not found');
      return response.json();
    })
    .then((data) => {
      details.innerHTML = `
        <h3>Report Summary</h3>
        <ul>
          <li>Total: ${data.total || 0}</li>
          <li>Completed: ${data.completed || 0}</li>
          <li>Pending: ${data.pending || 0}</li>
        </ul>
      `;
    })
    .catch(() => {
      details.innerHTML = '<p>No report data available.</p>';
    });
});
