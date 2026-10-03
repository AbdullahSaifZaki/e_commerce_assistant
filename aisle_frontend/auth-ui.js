import { createAuth } from './auth.js';

export async function mountAuth({ config, Client, startChat }) {
  const page = document.querySelector('#login-page');
  const app = document.querySelector('#aisle-app');
  const login = document.querySelector('#login-button');
  const logout = document.querySelector('#logout-button');
  const status = document.querySelector('#auth-status');
  const error = document.querySelector('#auth-error');
  const loading = document.querySelector('#auth-loading');
  let auth;
  let stage = 'configuration';

  function diagnostic(cause) {
    const known = ['access_denied', 'login_required', 'consent_required', 'unauthorized', 'invalid_grant', 'invalid_request', 'timeout'];
    const code = known.includes(cause?.error) ? cause.error
      : cause?.message === 'Invalid state' ? 'invalid_state' : 'unknown_error';
    // Keep tokens, callback URLs and arbitrary provider messages out of logs.
    console.error('Aisle startup failed', { stage, code, type: cause?.name || 'Error' });
    if (import.meta.env?.DEV && cause?.error === 'invalid_request') {
      console.error('Auth0 rejected the request:', String(cause.error_description || cause.message || '')
        .replace(/([?&](?:code|state|access_token|id_token)=)[^&\s]+/g, '$1[redacted]')
        .slice(0, 500));
    }
    return code;
  }

  function showLogin(message = '') {
    app.hidden = true;
    loading.hidden = true;
    page.hidden = false;
    status.textContent = 'Log in to start your next conversation.';
    error.textContent = message;
    error.hidden = !message;
    login.disabled = !auth;
    login.textContent = 'Log in';
    document.title = 'Log in — aisle';
  }

  function showLoading(message) {
    app.hidden = true;
    page.hidden = true;
    loading.hidden = false;
    loading.textContent = message;
  }

  async function openLogin() {
    showLoading('Opening secure login…');
    login.disabled = true;
    login.textContent = 'Opening secure login…';
    error.hidden = true;
    try {
      await auth.login();
    } catch {
      showLogin('Login could not be opened. Check your connection and try again.');
      login.focus();
    }
  }

  login.addEventListener('click', openLogin);

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    // Hide conversations immediately while the SDK clears the local session.
    showLoading('Logging out…');
    login.disabled = true;
    try {
      await auth.logout();
    } catch {
      showLogin('Logout could not finish. Log in again to continue.');
    }
  });

  try {
    auth = createAuth(config.auth0, Client);
    stage = 'authentication';
    const user = await auth.initialize();
    if (!user?.sub) {
      await openLogin();
      return;
    }
    stage = 'chat startup';
    document.querySelector('#account-name').textContent = user.name || user.email || 'Your account';
    startChat({ config, auth, user, onAuthenticationRequired: openLogin });
    loading.hidden = true;
    page.hidden = true;
    app.hidden = false;
  } catch (cause) {
    const code = diagnostic(cause);
    showLogin(stage === 'chat startup'
      ? 'You are signed in, but chat could not start. Reload the page and try again.'
      : auth
      ? `We couldn’t complete your login (${code}). Please try again.`
      : 'Login is not configured. Set the Auth0 values in .env.local and restart the frontend.');
  }
}
