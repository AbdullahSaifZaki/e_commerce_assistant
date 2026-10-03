import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { mountAuth } from '../auth-ui.js';
import { startChat } from '../app.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const config = {
  demoMode: false, apiUrl: '/api/chat', timeoutMs: 1000,
  auth0: { domain: 'tenant.us.auth0.com', clientId: 'spa', audience: 'https://api.aisle.app' },
};
const settle = () => new Promise(resolve => setImmediate(resolve));

test('authentication errors retain a diagnostic without exposing credentials', async t => {
  const { Client, find } = setup(t, { checkSession: async () => {
    throw Object.assign(new Error('private token must not be displayed'), { error: 'access_denied' });
  } });
  await mountAuth({ config, Client, startChat });
  assert.match(find('#auth-error').textContent, /access_denied/);
  assert.doesNotMatch(find('#auth-error').textContent, /private token/);
});

test('chat startup errors are not reported as failed login', async t => {
  const { Client, find } = setup(t, { isAuthenticated: async () => true });
  await mountAuth({ config, Client, startChat: () => { throw new Error('broken UI'); } });
  assert.match(find('#auth-error').textContent, /signed in.*chat could not start/i);
});

function setup(t, overrides = {}) {
  const dom = new JSDOM(html, { url: 'http://localhost:8770/' });
  const replacements = {
    window: dom.window, document: dom.window.document, Node: dom.window.Node,
    localStorage: dom.window.localStorage,
    matchMedia: query => ({ matches: query.includes('reduced-motion'), addEventListener() {} }),
    requestAnimationFrame: callback => callback(),
  };
  dom.window.matchMedia = replacements.matchMedia;
  for (const [name, value] of Object.entries(replacements)) {
    const previous = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { value, writable: true, configurable: true });
    t.after(() => previous ? Object.defineProperty(globalThis, name, previous) : delete globalThis[name]);
  }
  t.after(() => dom.window.close());
  const client = {
    checkSession: async () => {}, isAuthenticated: async () => false,
    getUser: async () => ({ sub: 'auth0|alice', name: '<b>Alice</b>' }),
    getTokenSilently: async () => 'test-access-token',
    loginWithRedirect: async () => {}, logout: async () => {}, ...overrides,
  };
  const Client = class { constructor() { return client; } };
  const find = selector => dom.window.document.querySelector(selector);
  return { Client, find, dom };
}

test('signed-out users go directly to Auth0 without displaying the welcome screen', async t => {
  let called = 0;
  let finishRedirect;
  const redirect = new Promise(resolve => { finishRedirect = resolve; });
  const { Client, find } = setup(t, {
    loginWithRedirect: async () => { called++; await redirect; },
  });
  assert.equal(find('#login-page').hidden, true);
  const mounted = mountAuth({ config, Client, startChat: () => assert.fail('must not initialize chat') });
  await settle();
  assert.equal(called, 1);
  assert.equal(find('#login-page').hidden, true);
  assert.equal(find('#aisle-app').hidden, true);
  assert.equal(find('#auth-loading').hidden, false);
  assert.match(find('#auth-loading').textContent, /opening.*login/i);
  finishRedirect();
  await mounted;
});

test('login button invokes redirect and recovers from failure', async t => {
  let called = 0;
  const { Client, find } = setup(t, { loginWithRedirect: async () => { called++; throw new Error('offline'); } });
  await mountAuth({ config, Client, startChat });
  assert.equal(called, 1);
  assert.equal(find('#login-page').hidden, false);
  assert.equal(find('#auth-loading').hidden, true);
  assert.match(find('#auth-error').textContent, /connection/i);
  find('#login-button').click();
  await settle();
  assert.equal(called, 2);
  assert.equal(find('#auth-error').hidden, false);
  assert.equal(find('#login-button').disabled, false);
});

test('signed-in chat sends a bearer token, renders reply and isolates saved history', async t => {
  const { Client, find, dom } = setup(t, {
    isAuthenticated: async () => true,
    loginWithRedirect: async () => assert.fail('signed-in users must not be redirected'),
  });
  localStorage.setItem('aisle.conversations.v1.live.auth0%7Cbob', JSON.stringify({
    conversations: [{ id: 'private', title: 'Bob private chat', updatedAt: Date.now(), messages: [] }],
  }));
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, ...options };
    return new Response(JSON.stringify({ response: 'What size?', thread_id: 'saved-thread', title: 'Find Great Shoes' }));
  };
  await mountAuth({ config, Client, startChat });
  assert.equal(find('#aisle-app').hidden, false);
  assert.equal(find('#login-page').hidden, true);
  assert.equal(find('#auth-loading').hidden, true);
  assert.equal(find('#account-name').textContent, '<b>Alice</b>');
  assert.equal(find('#account-name b'), null);
  assert.equal(find('.history-item'), null);
  find('textarea').value = 'Find shoes';
  find('.composer').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.equal(request.headers.Authorization, 'Bearer test-access-token');
  assert.equal(JSON.parse(request.body).generate_title, true);
  assert.equal(find('.message.assistant p').textContent, 'What size?');
  assert.equal(find('.top-title').textContent, 'Find Great Shoes');
  const saved = localStorage.getItem('aisle.conversations.v1.live.auth0%7Calice');
  assert.equal(JSON.parse(saved).conversations[0].threadId, 'saved-thread');
  assert.equal(saved.includes('test-access-token'), false);
});

test('logout immediately hides chats and invokes Auth0 logout', async t => {
  let called = 0;
  const { Client, find } = setup(t, {
    isAuthenticated: async () => true,
    logout: async () => { called++; },
  });
  await mountAuth({ config, Client, startChat });
  find('#logout-button').click();
  await settle();
  assert.equal(called, 1);
  assert.equal(find('#aisle-app').hidden, true);
  assert.equal(find('#login-page').hidden, true);
  assert.match(find('#auth-loading').textContent, /logging out/i);
});

test('expired session redirects to Auth0 and keeps the unanswered message', async t => {
  let called = 0;
  const { Client, find, dom } = setup(t, {
    isAuthenticated: async () => true,
    getTokenSilently: async () => { throw { error: 'login_required' }; },
    loginWithRedirect: async () => { called++; },
  });
  await mountAuth({ config, Client, startChat });
  find('textarea').value = 'Find shoes';
  find('.composer').dispatchEvent(new dom.window.Event('submit', { cancelable: true }));
  await settle();
  assert.equal(find('#aisle-app').hidden, true);
  assert.equal(called, 1);
  assert.equal(find('#login-page').hidden, true);
  assert.equal(find('#auth-loading').hidden, false);
  const saved = JSON.parse(localStorage.getItem('aisle.conversations.v1.live.auth0%7Calice'));
  assert.equal(saved.conversations[0].messages[0].content, 'Find shoes');
});

test('denied callbacks show a retry option instead of automatically redirecting again', async t => {
  let called = 0;
  const { Client, find, dom } = setup(t, {
    handleRedirectCallback: async () => { throw { error: 'access_denied' }; },
    loginWithRedirect: async () => { called++; },
  });
  dom.window.history.replaceState({}, '', '/?error=access_denied&state=test');
  await mountAuth({ config, Client, startChat: () => assert.fail('must not initialize chat') });
  assert.equal(called, 0);
  assert.equal(find('#login-page').hidden, false);
  assert.equal(find('#auth-loading').hidden, true);
  assert.equal(find('#login-button').disabled, false);
  assert.match(find('#auth-error').textContent, /access_denied/);
  assert.equal(dom.window.location.search, '');
});
