function getCookie(name) {
  return document.cookie
    .split(';')
    .map(v => v.trim())
    .find(v => v.startsWith(name + '='))
    ?.slice(name.length + 1) || '';
}

function iconsReady() {
  return new Promise((resolve) => {
    if (window.lucide?.createIcons) return resolve();
    const timer = setInterval(() => {
      if (window.lucide?.createIcons) {
        clearInterval(timer);
        resolve();
      }
    }, 30);
  });
}

function showError(message) {
  document.getElementById('auth-loader').style.display = 'none';
  document.getElementById('auth-error-text').textContent = message;
  document.getElementById('auth-error').style.display = 'flex';
  lucide.createIcons();
}

async function hasValidSession() {
  if (!getCookie('session_id')) return false;
  try {
    const res = await fetch('/api/me', { credentials: 'same-origin' });
    return res.ok;
  } catch (_) {
    return false;
  }
}

async function begin() {
  await iconsReady();
  lucide.createIcons();

  const params = new URLSearchParams(window.location.search);
  const next = params.get('next') || '/';

  if (await hasValidSession()) {
    window.location.href = next;
    return;
  }

  const token = params.get('token');
  if (!token) {
    redirectToRotur();
    return;
  }

  try {
    const key = window.AUTH_KEY || 'rotur-gate';
    const validatorRes = await fetch(`https://api.rotur.dev/generate_validator?key=${encodeURIComponent(key)}&auth=${encodeURIComponent(token)}`);
    const validatorData = await validatorRes.json();
    if (!validatorData.validator) throw new Error('Could not generate validator');

    const authRes = await fetch(`/api/auth?v=${encodeURIComponent(validatorData.validator)}`);
    if (!authRes.ok) throw new Error('Could not validate rotur login');

    window.location.href = next;
  } catch (err) {
    showError(err.message || 'Authentication failed. Redirecting...');
    setTimeout(redirectToRotur, 1800);
  }
}

function redirectToRotur() {
  const returnTo = window.location.origin + '/auth';
  window.location.href = `https://rotur.dev/auth?return_to=${encodeURIComponent(returnTo)}`;
}

document.addEventListener('DOMContentLoaded', begin);
