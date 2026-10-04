import { createAuth } from './auth.js';

export async function mountAuth({ config, Client, startChat }) {
  const page = document.querySelector('#login-page');
  const app = document.querySelector('#aisle-app');
  const login = document.querySelector('#login-button');
  const logout = document.querySelector('#logout-button');
  const status = document.querySelector('#auth-status');
  const error = document.querySelector('#auth-error');
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
    page.hidden = false;
    status.textContent = 'Log in to start your next conversation.';
    error.textContent = message;
    error.hidden = !message;
    login.disabled = !auth;
    login.textContent = 'Log in';
    document.title = 'Log in — aisle';
  }

  // Signed-out visitors go straight to Auth0 Universal Login — the local
  // login page is only a fallback when the redirect itself fails (offline,
  // popup blocked, misconfigured tenant).
  async function beginUniversalLogin(fallbackMessage = 'Login could not be opened. Check your connection and try again.') {
    page.hidden = true;
    try {
      await auth.login();
    } catch {
      showLogin(fallbackMessage);
      login.focus();
    }
  }

  login.addEventListener('click', async () => {
    login.disabled = true;
    login.textContent = 'Opening secure login…';
    error.hidden = true;
    await beginUniversalLogin();
  });

  logout.addEventListener('click', async () => {
    logout.disabled = true;
    // Hide conversations immediately while the SDK clears the local session.
    showLogin();
    login.disabled = true;
    status.textContent = 'Logging out…';
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
      await beginUniversalLogin();
      return;
    }
    stage = 'chat startup';
    document.querySelector('#account-name').textContent = user.name || user.email || 'Your account';
    startChat({ config, auth, user, onAuthenticationRequired: message => {
      void beginUniversalLogin(message);
    } });
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
