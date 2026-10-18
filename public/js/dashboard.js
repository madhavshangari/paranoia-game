// ── PARANOIA — God's Dashboard Logic ─────────────────────────────────────────

let allSubmissions = [];

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Check auth on load — redirect to login if not God
async function checkAuth() {
  try {
    const res = await fetch('/api/check-auth');
    const data = await res.json();
    if (!data.authenticated) {
      window.location.href = '/god';
      return false;
    }
    return true;
  } catch (e) {
    window.location.href = '/god';
    return false;
  }
}

// Load submissions from API
async function loadSubmissions() {
  try {
    const res = await fetch('/api/submissions');

    if (res.status === 401) {
      window.location.href = '/god';
      return;
    }

    const data = await res.json();
    allSubmissions = data.submissions;
    updateStats(data.total);
    renderTable(allSubmissions);
  } catch (err) {
    showToast('Failed to load submissions.', 'error');
  }
}

// Update stat cards
function updateStats(total) {
  const remaining = Math.max(0, 20 - total);

  document.getElementById('totalCount').textContent = total;
  document.getElementById('remainingCount').textContent = remaining;

  const statusEl = document.getElementById('gameStatus');
  if (total >= 20) {
    statusEl.innerHTML = '✅ <span style="color:#22c55e;">Ready to start!</span>';
  } else if (total >= 15) {
    statusEl.innerHTML = '🔥 <span style="color:#f59e0b;">Almost there</span>';
  } else if (total > 0) {
    statusEl.innerHTML = '⏳ Collecting chits...';
  } else {
    statusEl.innerHTML = '⏳ Waiting for players';
  }
}

// Render the table
function renderTable(submissions) {
  const tbody = document.getElementById('tableBody');
  const emptyState = document.getElementById('emptyState');
  const tableEl = document.getElementById('dataTable');

  if (submissions.length === 0) {
    tableEl.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  tableEl.style.display = 'table';
  emptyState.style.display = 'none';

  tbody.innerHTML = submissions.map((sub, i) => {
    const time = new Date(sub.submitted_at + 'Z').toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return `
      <tr>
        <td style="color: var(--text-muted); font-size: 0.8rem;">${submissions.length - i}</td>
        <td class="cell-name">${escapeHtml(sub.full_name)}</td>
        <td class="cell-room">${escapeHtml(sub.room_number)}</td>
        <td class="cell-object">${escapeHtml(sub.object)}</td>
        <td class="cell-place">${escapeHtml(sub.place)}</td>
        <td class="cell-time">${time}</td>
        <td>
          <button class="delete-btn" onclick="deleteSubmission(${sub.id})" title="Delete">
            🗑
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Filter table by search
function filterTable() {
  const query = document.getElementById('searchInput').value.toLowerCase();

  if (!query) {
    renderTable(allSubmissions);
    return;
  }

  const filtered = allSubmissions.filter(sub =>
    sub.full_name.toLowerCase().includes(query) ||
    sub.room_number.toLowerCase().includes(query) ||
    sub.object.toLowerCase().includes(query) ||
    sub.place.toLowerCase().includes(query)
  );

  renderTable(filtered);
}

// Delete a single submission
async function deleteSubmission(id) {
  if (!confirm('Delete this submission?')) return;

  try {
    const res = await fetch(`/api/submissions/${id}`, { method: 'DELETE' });
    const result = await res.json();

    if (res.ok) {
      showToast('Submission deleted.', 'success');
      loadSubmissions();
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast('Failed to delete.', 'error');
  }
}

// Clear all submissions
async function clearAll() {
  if (!confirm('⚠️ This will delete ALL submissions. Are you sure?')) return;
  if (!confirm('Seriously — this cannot be undone. Continue?')) return;

  try {
    const res = await fetch('/api/submissions', { method: 'DELETE' });
    const result = await res.json();

    if (res.ok) {
      showToast('All submissions cleared.', 'success');
      loadSubmissions();
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast('Failed to clear.', 'error');
  }
}

// Export as JSON
function exportData() {
  if (allSubmissions.length === 0) {
    showToast('No data to export.', 'info');
    return;
  }

  const exportObj = allSubmissions.map(({ full_name, room_number, object, place, submitted_at }) => ({
    name: full_name,
    room: room_number,
    object,
    place,
    submitted: submitted_at
  }));

  const blob = new Blob([JSON.stringify(exportObj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paranoia_chits_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Exported successfully!', 'success');
}

// Logout
async function logout() {
  try {
    await fetch('/api/logout', { method: 'POST' });
  } catch (e) {
    // Ignore
  }
  window.location.href = '/god';
}

// Escape HTML to prevent XSS
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── Init ────────────────────────────────────────────────────────────────────
(async () => {
  const authed = await checkAuth();
  if (authed) {
    loadSubmissions();
  }
})();
