// ── PARANOIA — Player Form Logic ─────────────────────────────────────────────

// Toast notification system
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

// Form submission
const form = document.getElementById('submitForm');
const formCard = document.getElementById('formCard');
const successCard = document.getElementById('successCard');
const submitBtn = document.getElementById('submitBtn');
const btnText = document.getElementById('btnText');
const btnSpinner = document.getElementById('btnSpinner');

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  // Disable button, show spinner
  submitBtn.disabled = true;
  btnText.textContent = 'Submitting...';
  btnSpinner.style.display = 'block';

  const data = {
    full_name: document.getElementById('fullName').value.trim(),
    room_number: document.getElementById('roomNumber').value.trim(),
    object: document.getElementById('object').value.trim(),
    place: document.getElementById('place').value.trim()
  };

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (res.ok) {
      showToast(result.message, 'success');

      // Transition to success state
      formCard.style.animation = 'fade-in 0.4s ease reverse forwards';
      setTimeout(() => {
        formCard.style.display = 'none';
        successCard.style.display = 'block';
        successCard.style.animation = 'fade-in 0.5s ease forwards';
      }, 400);
    } else {
      showToast(result.error, 'error');
      submitBtn.disabled = false;
      btnText.textContent = 'Submit to God';
      btnSpinner.style.display = 'none';
    }
  } catch (err) {
    showToast('Network error. Try again.', 'error');
    submitBtn.disabled = false;
    btnText.textContent = 'Submit to God';
    btnSpinner.style.display = 'none';
  }
});
