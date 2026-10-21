const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const calBook = require('../api/cal-book');
const calSlots = require('../api/cal-slots');
const emailTrustCheck = require('../api/email-trust-check');
const { rateLimit } = require('../lib/http-security');

function responseMock() {
  return {
    code: 200,
    headers: {},
    payload: undefined,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.code = code; return this; },
    json(payload) { this.payload = payload; return this; },
    end() { return this; }
  };
}

function request(overrides = {}) {
  return {
    method: 'GET',
    headers: {},
    query: {},
    body: {},
    socket: { remoteAddress: '127.0.0.1' },
    ...overrides
  };
}

test('booking rejects non-JSON requests before touching Cal.com', async () => {
  const res = responseMock();
  await calBook(request({ method: 'POST' }), res);
  assert.equal(res.code, 415);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('booking rejects unknown event types instead of defaulting', async () => {
  const res = responseMock();
  await calBook(request({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: { type: 'anything', start: new Date(Date.now() + 86400000).toISOString(), name: 'Test User', email: 'test@example.com' }
  }), res);
  assert.equal(res.code, 400);
  assert.match(res.payload.error, /appointment type/i);
});

test('on-site booking requires an office address', async () => {
  const res = responseMock();
  await calBook(request({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: {
      type: 'onsite-audit',
      start: new Date(Date.now() + 86400000).toISOString(),
      name: 'Test User',
      email: 'test@example.com'
    }
  }), res);
  assert.equal(res.code, 400);
  assert.match(res.payload.error, /office address/i);
});

test('slot endpoint rejects invalid methods and oversized ranges', async () => {
  const methodRes = responseMock();
  await calSlots(request({ method: 'POST' }), methodRes);
  assert.equal(methodRes.code, 405);
  assert.equal(methodRes.headers.Allow, 'GET');

  const rangeRes = responseMock();
  await calSlots(request({ method: 'GET', query: { type: 'intro-call', from: '2026-07-01', to: '2026-09-01' } }), rangeRes);
  assert.equal(rangeRes.code, 400);
});

test('slot endpoint normalizes valid upstream timestamps and drops malformed values', async () => {
  const oldFetch = global.fetch;
  const oldKey = process.env.CAL_API_KEY;
  const oldEvent = process.env.CAL_EVENT_INTRO;
  const oldRedisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldRedisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  process.env.CAL_API_KEY = 'test-key';
  process.env.CAL_EVENT_INTRO = '123';
  delete process.env.UPSTASH_REDIS_REST_URL;
  delete process.env.UPSTASH_REDIS_REST_TOKEN;
  const valid = new Date(Date.now() + 86400000).toISOString();
  global.fetch = async () => ({
    ok: true,
    json: async () => ({ data: { [valid.slice(0, 10)]: [valid, "bad' onclick='alert(1)"] } })
  });

  try {
    const day = valid.slice(0, 10);
    const res = responseMock();
    await calSlots(request({ method: 'GET', query: { type: 'intro-call', from: day, to: day } }), res);
    assert.equal(res.code, 200);
    assert.deepEqual(res.payload[day], [valid]);
  } finally {
    global.fetch = oldFetch;
    if (oldKey === undefined) delete process.env.CAL_API_KEY; else process.env.CAL_API_KEY = oldKey;
    if (oldEvent === undefined) delete process.env.CAL_EVENT_INTRO; else process.env.CAL_EVENT_INTRO = oldEvent;
    if (oldRedisUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL; else process.env.UPSTASH_REDIS_REST_URL = oldRedisUrl;
    if (oldRedisToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env['UPSTASH_REDIS_REST_' + 'TOKEN'] = oldRedisToken;
  }
});

test('email trust endpoint handles malformed JSON as a controlled 400', async () => {
  const res = responseMock();
  await emailTrustCheck(request({
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://evil.example' },
    body: '{bad json'
  }), res);
  assert.equal(res.code, 400);
  assert.equal(res.headers['Access-Control-Allow-Origin'], undefined);
  assert.equal(res.headers['Cache-Control'], 'no-store');
});

test('booking confirmation does not render user fields through innerHTML', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'assessment.html'), 'utf8');
  assert.doesNotMatch(html, /ccalConfirmWho['"]\)\.innerHTML/);
  assert.match(html, /confirmWho\.replaceChildren\(document\.createTextNode/);
  assert.doesNotMatch(html, /ccalSlots['"]\)\.innerHTML/);
});

test('Google Ads Contact conversion is reserved for completed bookings', () => {
  const root = path.join(__dirname, '..');
  const label = 'AW-18009085486/ZIP4CKuYzJscEK6ss4tD';
  const htmlFiles = [];

  function collectHtml(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) collectHtml(target);
      else if (entry.name.endsWith('.html')) htmlFiles.push(target);
    }
  }

  collectHtml(root);
  const occurrences = htmlFiles.flatMap(file => {
    const html = fs.readFileSync(file, 'utf8');
    return Array.from(html.matchAll(new RegExp(label, 'g')), () => path.relative(root, file));
  });

  const bookingPages = ['assessment.html', 'managed-it-charlotte/index.html'];
  assert.deepEqual(occurrences.sort(), bookingPages);

  for (const bookingPage of bookingPages) {
    const html = fs.readFileSync(path.join(root, bookingPage), 'utf8');
    assert.match(
      html,
      /res\.ok && data\.status === 'success' && \(booking\.uid \|\| booking\.id\)[\s\S]{0,300}gtag\('event', 'conversion', \{ send_to: 'AW-18009085486\/ZIP4CKuYzJscEK6ss4tD' \}\)/
    );
  }

  const phoneHandlers = htmlFiles.filter(file => {
    const html = fs.readFileSync(file, 'utf8');
    return /querySelectorAll\('a\[href\^="tel:"\]'\)/.test(html);
  });
  assert.ok(phoneHandlers.length > 0);
  for (const file of phoneHandlers) {
    const html = fs.readFileSync(file, 'utf8');
    assert.match(html, /gtag\('event',\s*'clicked_phone'/);
  }
});

test('every public HTML page loads one Google Ads base tag and privacy discloses its use', () => {
  const root = path.join(__dirname, '..');
  const tagId = 'AW-18009085486';
  const htmlFiles = [];

  function collectHtml(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const target = path.join(dir, entry.name);
      if (entry.isDirectory()) collectHtml(target);
      else if (entry.name.endsWith('.html')) htmlFiles.push(target);
    }
  }

  collectHtml(root);
  const missing = [];
  const duplicated = [];

  for (const file of htmlFiles) {
    const html = fs.readFileSync(file, 'utf8');
    const loaderCount = (html.match(new RegExp(`googletagmanager\\.com/gtag/js\\?id=${tagId}`, 'g')) || []).length;
    const configCount = (html.match(new RegExp(`gtag\\(\\s*['\"]config['\"]\\s*,\\s*['\"]${tagId}['\"]\\s*\\)`, 'g')) || []).length;
    const relative = path.relative(root, file);
    if (loaderCount === 0 || configCount === 0) missing.push(relative);
    if (loaderCount > 1 || configCount > 1) duplicated.push(relative);
  }

  assert.deepEqual(missing, [], `Missing Google Ads base tag: ${missing.join(', ')}`);
  assert.deepEqual(duplicated, [], `Duplicated Google Ads base tag: ${duplicated.join(', ')}`);

  const privacy = fs.readFileSync(path.join(root, 'privacy.html'), 'utf8');
  assert.match(privacy, /Google Ads/);
  assert.match(privacy, /conversion measurement and remarketing/i);
});

test('email trust lead payload matches the AMP IT Form Submissions contract', () => {
  const api = fs.readFileSync(path.join(__dirname, '..', 'api', 'email-trust-check.js'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'email-trust-check.html'), 'utf8');
  assert.match(api, /origin: 'https:\/\/www\.ampitsolutions\.com'/);
  assert.match(api, /name: 'Email Trust Check'/);
  assert.match(api, /company: company \|\| domain/);
  assert.match(api, /data\?\.success !== true/);
  assert.match(api, /results\.leadRecorded = leadRecorded/);
  assert.match(html, /submitted domain, email, and optional phone are saved by AMP IT/);
});

test('Vercel headers include a narrow CSP and omit obsolete X-XSS-Protection', () => {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'vercel.json'), 'utf8'));
  const headers = Object.fromEntries(config.headers[0].headers.map(item => [item.key, item.value]));
  assert.match(headers['Content-Security-Policy'], /base-uri 'self'/);
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
  assert.equal(headers['X-XSS-Protection'], undefined);
});

test('rate-limit keys ignore caller-supplied x-forwarded-for', async () => {
  const oldFetch = global.fetch;
  const oldUrl = process.env.UPSTASH_REDIS_REST_URL;
  const oldToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  let commands;
  process.env.UPSTASH_REDIS_REST_URL = 'https://rate-limit.invalid';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token';
  global.fetch = async (url, options) => {
    commands = JSON.parse(options.body);
    return { ok: true, json: async () => [{ result: 'OK' }, { result: 1 }] };
  };

  try {
    const result = await rateLimit(request({
      headers: {
        'x-forwarded-for': 'spoofed',
        'x-vercel-forwarded-for': '203.0.113.7'
      }
    }), 'test', 2, 60);
    assert.equal(result.allowed, true);
    assert.match(commands[0][1], /203\.0\.113\.7$/);
    assert.doesNotMatch(commands[0][1], /spoofed/);
  } finally {
    global.fetch = oldFetch;
    if (oldUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
    else process.env.UPSTASH_REDIS_REST_URL = oldUrl;
    if (oldToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
    else process.env.UPSTASH_REDIS_REST_TOKEN = oldToken;
  }
});

const mcp = require('../api/mcp');
function mcpCall(body) {
  const res = responseMock();
  return mcp(request({ method: 'POST', headers: { 'content-type': 'application/json', host: 'www.ampitsolutions.com' }, body }), res).then(() => res);
}

test('MCP server answers initialize with a supported protocol version', async () => {
  const res = await mcpCall({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(res.code, 200);
  assert.equal(res.payload.result.protocolVersion, '2025-06-18');
  assert.ok(res.payload.result.capabilities.tools);
});

test('MCP server lists its four tools with read-only hints set correctly', async () => {
  const res = await mcpCall({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const tools = Object.fromEntries(res.payload.result.tools.map(t => [t.name, t]));
  assert.deepEqual(Object.keys(tools).sort(), ['about_amp_it', 'book_intro_call', 'check_business_email_security', 'get_intro_call_times']);
  assert.equal(tools.book_intro_call.annotations.readOnlyHint, false);
  assert.equal(tools.check_business_email_security.annotations.readOnlyHint, true);
});

test('MCP notifications get 202 with no body', async () => {
  const res = await mcpCall({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(res.code, 202);
});

test('MCP email check refuses free email providers without DNS lookups', async () => {
  const res = await mcpCall({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'check_business_email_security', arguments: { domain: 'gmail.com' } } });
  assert.equal(res.payload.result.isError, true);
});

test('MCP booking validates email and start before calling the calendar', async () => {
  const res = await mcpCall({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'book_intro_call', arguments: { start: new Date(Date.now() + 2 * 86400000).toISOString(), name: 'Test User', email: 'not-an-email' } } });
  assert.equal(res.payload.result.isError, true);
  assert.match(res.payload.result.content[0].text, /valid email/);
});

test('MCP rejects unknown methods and GET requests', async () => {
  const res = await mcpCall({ jsonrpc: '2.0', id: 5, method: 'resources/list' });
  assert.equal(res.payload.error.code, -32601);
  const getRes = responseMock();
  await mcp(request({ method: 'GET' }), getRes);
  assert.equal(getRes.code, 405);
});
