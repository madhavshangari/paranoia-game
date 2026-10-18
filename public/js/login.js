// ── PARANOIA — God Login Logic ───────────────────────────────────────────────

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

// Check if already authenticated
(async () => {
  try {
    const res = await fetch('/api/check-auth');
    const data = await res.json();
    if (data.authenticated) {
      window.location.href = '/dashboard';
    }
  } catch (e) {
    // Not authenticated, stay on login
  }
})();

const form = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  loginBtn.disabled = true;
  btnText.textContent = 'Authenticating...';
  btnSpinner.style.display = 'block';

  const data = {
    login_id: document.getElementById('loginId').value.trim(),
    password: document.getElementById('password').value
  };

  try {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      showToast(result.message, 'success');
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } else {
      showToast(result.error, 'error');
      loginBtn.disabled = false;
      btnText.textContent = 'Enter as God';
      btnSpinner.style.display = 'none';
    }
  } catch (err) {
    showToast('Network error. Try again.', 'error');
    loginBtn.disabled = false;
    btnText.textContent = 'Enter as God';
    btnSpinner.style.display = 'none';
  }
});
