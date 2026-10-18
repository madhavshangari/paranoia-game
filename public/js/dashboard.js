// ── PARANOIA — God's Dashboard Logic ─────────────────────────────────────────

let allSubmissions = [];
let activeGame = null;

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

// Tab navigation
function switchTab(tabName) {
  const tabs = ['submissions', 'game'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab${t.charAt(0).toUpperCase() + t.slice(1)}Btn`);
    const sec = document.getElementById(`section${t.charAt(0).toUpperCase() + t.slice(1)}`);
    if (t === tabName) {
      btn?.classList.add('active');
      sec?.classList.add('active');
    } else {
      btn?.classList.remove('active');
      sec?.classList.remove('active');
    }
  });
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
    document.getElementById('tabCount').textContent = data.total;
    updateStats(data.total);
    renderTable(allSubmissions);
  } catch (err) {
    showToast('Failed to load submissions.', 'error');
  }
}

// Load current game assignments
async function loadGame() {
  try {
    const res = await fetch('/api/game/assignments');
    if (res.status === 401) return;
    const data = await res.json();
    activeGame = data.game;

    const count = activeGame ? activeGame.assignments.length : 0;
    document.getElementById('tabLoopCount').textContent = count;
    renderAssignments(activeGame);
    updateStats(allSubmissions.length);
  } catch (err) {
    console.error('Failed to load game assignments:', err);
  }
}

async function refreshAll() {
  await loadSubmissions();
  await loadGame();
  showToast('Refreshed all data.', 'info');
}

// Update stat cards
function updateStats(total) {
  const remaining = Math.max(0, 20 - total);

  document.getElementById('totalCount').textContent = total;
  document.getElementById('remainingCount').textContent = remaining;

  const statusEl = document.getElementById('gameStatus');
  if (activeGame && activeGame.assignments && activeGame.assignments.length > 0) {
    statusEl.innerHTML = `🔥 <span style="color:#22c55e;">Loop Active (${activeGame.assignments.length} Assassins)</span>`;
  } else if (total >= 20) {
    statusEl.innerHTML = '✅ <span style="color:#22c55e;">20 Players Ready! Click Shuffle.</span>';
  } else if (total >= 15) {
    statusEl.innerHTML = '⚡ <span style="color:#f59e0b;">Almost Full</span>';
  } else if (total > 0) {
    statusEl.innerHTML = '⏳ Collecting chits...';
  } else {
    statusEl.innerHTML = '⏳ Waiting for players';
  }
}

// Render the submissions table
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
    const time = new Date(sub.submitted_at).toLocaleString('en-IN', {
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

// Filter submissions by search
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

// ── Game Shuffle & Loop Generation ──────────────────────────────────────────

async function shuffleGame() {
  if (allSubmissions.length < 3) {
    showToast(`You need at least 3 players to start (current: ${allSubmissions.length})`, 'error');
    return;
  }

  if (activeGame && !confirm('⚠️ A game loop is already active! Reshuffling will create a NEW target loop. Proceed?')) {
    return;
  }

  try {
    const res = await fetch('/api/game/shuffle', { method: 'POST' });
    const data = await res.json();

    if (res.ok) {
      activeGame = data.game;
      showToast(data.message, 'success');
      switchTab('game');
      renderAssignments(activeGame);
      document.getElementById('tabLoopCount').textContent = activeGame.assignments.length;
      updateStats(allSubmissions.length);
    } else {
      showToast(data.error || 'Failed to shuffle game.', 'error');
    }
  } catch (err) {
    showToast('Network error while shuffling.', 'error');
  }
}

// Render game assignments
function renderAssignments(game) {
  const container = document.getElementById('assignmentsGrid');
  const emptyState = document.getElementById('emptyGameState');
  const visualizerContainer = document.getElementById('loopVisualizerContainer');
  const visualizer = document.getElementById('loopVisualizer');

  if (!game || !game.assignments || game.assignments.length === 0) {
    container.innerHTML = '';
    visualizerContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';
  visualizerContainer.style.display = 'block';

  // Render loop visualizer
  const assignments = game.assignments;
  let chainHtml = assignments.map(a => `
    <span class="loop-node">
      👤 ${escapeHtml(a.hunter_name)}
    </span>
    <span class="loop-arrow">➔</span>
  `).join('');

  // Closing loop arrow back to first
  chainHtml += `
    <span class="loop-node" style="border-color: var(--border-accent); color: var(--accent);">
      👑 ${escapeHtml(assignments[0].hunter_name)} (Full Circle!)
    </span>
  `;
  visualizer.innerHTML = chainHtml;

  // Render assignment cards
  container.innerHTML = assignments.map((a, idx) => {
    return `
      <div class="assignment-card">
        <div>
          <div class="assignment-header">
            <div>
              <div class="assignment-hunter">${escapeHtml(a.hunter_name)}</div>
              <div class="assignment-room">Room: ${escapeHtml(a.hunter_room)}</div>
            </div>
            <div class="assignment-order">#${a.order} of ${assignments.length}</div>
          </div>

          <div class="assignment-target-box">
            <div class="assignment-target-label">🎯 Assigned Target:</div>
            <div class="assignment-target-name">${escapeHtml(a.target_name)}</div>
            <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
              Target Room: ${escapeHtml(a.target_room)}
            </div>
          </div>

          <div class="assignment-chits">
            <div class="assignment-chit-item">
              <span class="assignment-chit-label">Weapon:</span>
              <span class="assignment-chit-val">🗡️ ${escapeHtml(a.object)}</span>
            </div>
            <div class="assignment-chit-item">
              <span class="assignment-chit-label">Place:</span>
              <span class="assignment-chit-val">📍 ${escapeHtml(a.place)}</span>
            </div>
          </div>
        </div>

        <button class="copy-dm-btn" onclick="copyDM(${idx})">
          📋 Copy WhatsApp DM
        </button>
      </div>
    `;
  }).join('');
}

// Copy DM for single player
function copyDM(index) {
  if (!activeGame || !activeGame.assignments[index]) return;
  const a = activeGame.assignments[index];

  navigator.clipboard.writeText(a.dm_text).then(() => {
    showToast(`Copied secret DM for ${a.hunter_name}!`, 'success');
  }).catch(() => {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = a.dm_text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
    showToast(`Copied secret DM for ${a.hunter_name}!`, 'success');
  });
}

// Copy all DMs in one master batch
function copyAllDMs() {
  if (!activeGame || !activeGame.assignments) {
    showToast('No active game loop to copy.', 'info');
    return;
  }

  const allText = activeGame.assignments.map(a =>
    `========================================\n` +
    `SEND TO: ${a.hunter_name} (${a.hunter_room})\n` +
    `========================================\n` +
    `${a.dm_text}\n\n`
  ).join('\n');

  navigator.clipboard.writeText(allText).then(() => {
    showToast('Copied ALL player assignments to clipboard!', 'success');
  });
}

// Reset game loop
async function resetGame() {
  if (!confirm('Are you sure you want to reset the game loop? Submissions will NOT be deleted.')) return;

  try {
    const res = await fetch('/api/game/reset', { method: 'POST' });
    if (res.ok) {
      activeGame = null;
      document.getElementById('tabLoopCount').textContent = 0;
      renderAssignments(null);
      updateStats(allSubmissions.length);
      showToast('Game assignments cleared.', 'success');
    }
  } catch (err) {
    showToast('Failed to reset game.', 'error');
  }
}

// Export game assignments as JSON
function exportGame() {
  if (!activeGame || !activeGame.assignments) {
    showToast('No active game to export.', 'info');
    return;
  }

  const blob = new Blob([JSON.stringify(activeGame, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `paranoia_game_loop_${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  showToast('Game loop exported successfully!', 'success');
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
  if (!confirm('⚠️ This will delete ALL submissions and active loops. Are you sure?')) return;
  if (!confirm('Seriously — this cannot be undone. Continue?')) return;

  try {
    const res = await fetch('/api/submissions', { method: 'DELETE' });
    const result = await res.json();

    if (res.ok) {
      showToast('All submissions cleared.', 'success');
      activeGame = null;
      loadSubmissions();
      loadGame();
    } else {
      showToast(result.error, 'error');
    }
  } catch (err) {
    showToast('Failed to clear.', 'error');
  }
}

// Export submissions as JSON
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
  } catch (e) {}
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
    await loadSubmissions();
    await loadGame();
  }
})();
