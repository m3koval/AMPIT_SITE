// POST /api/mcp
// MCP server (stateless Streamable HTTP, JSON responses) for the "AMP IT Office IT Check" app in ChatGPT.
// Tools: check a business email domain, describe AMP IT, list intro-call times, book an intro call.
const { cleanString, parseJsonBody, rateLimit, setNoStore } = require('../lib/http-security');
const { sendLeadAlert } = require('../lib/lead-alert');
const { DOMAIN_RX, PERSONAL_EMAIL_DOMAINS, normalizeDomain, checkDomain } = require('../lib/email-dns');

const SITE = 'https://www.ampitsolutions.com';
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;

const INSTRUCTIONS = 'AMP IT is a managed IT and cybersecurity company in Charlotte, NC serving businesses in North and South Carolina. ' +
  'Use check_business_email_security when someone asks whether their company email is set up safely (SPF, DKIM, DMARC, spoofing, emails going to spam). ' +
  'Use about_amp_it for questions about AMP IT services, plans, pricing or the free first automation offer. ' +
  'Use get_intro_call_times and book_intro_call when someone wants to talk with AMP IT. Always confirm the time, name and email with the person before booking.';

const ABOUT = {
  company: 'AMP IT LLC, Charlotte, NC. Founders Mike (Mikhail) Koval and Nik Kotov.',
  serves: 'Businesses in North Carolina and South Carolina, including law firms, CPA and tax firms, and other small offices.',
  services: ['Managed IT and help desk', 'Cybersecurity and email security', 'Microsoft 365 and Google Workspace setup and support', 'Backups', 'AI rules and setup for teams (ChatGPT, Microsoft Copilot, Gemini)', 'Working with your software vendors (practice, accounting and tax software) so you do not have to', 'One-time projects'],
  plans: [
    { name: 'Essential', price: '$319 per user per month', note: '5-user minimum' },
    { name: 'Better', price: '$445 per user per month', note: 'ideal for 10 to 40 users' },
    { name: 'Best', price: '$499 per user per month', note: 'ideal for 15 to 50 users; includes a 1-hour emergency response SLA for covered urgent issues' }
  ],
  included: ['Microsoft 365 or Google Workspace licensing is included in every plan', '24/7 automated monitoring of covered systems', 'Human support Monday to Friday, 7 AM to 6 PM ET', '12-month standard managed IT agreement'],
  freeFirstAutomation: 'Bring one task your team repeats. If AMP IT can automate it in under an hour, they build it for free. Microsoft 365 or Google Workspace only, one per business, 4 a month, built live on a screen share, no ongoing support included. The 15-minute call decides whether a task qualifies.',
  contact: { phone: '(980) 377-2733 (call or text)', website: SITE, book: SITE + '/assessment' }
};

const TOOLS = [
  {
    name: 'check_business_email_security',
    title: 'Check business email security',
    description: 'Checks the public DNS records (SPF, DKIM, DMARC) for a company email domain and explains in plain English whether others could send email pretending to be the business. Read-only, uses public records only.',
    inputSchema: { type: 'object', properties: { domain: { type: 'string', description: 'The company domain, like smithcpa.com. Not a free email provider like gmail.com.' } }, required: ['domain'], additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  {
    name: 'about_amp_it',
    title: 'About AMP IT',
    description: 'Returns facts about AMP IT: services, plans and published pricing, what is included, support hours, the free first automation offer, and how to reach the team.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
  },
  {
    name: 'get_intro_call_times',
    title: 'Find times for a free 15-minute call',
    description: 'Lists open times for a free 15-minute intro call with AMP IT over the next two weeks, in Eastern Time.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true }
  },
  {
    name: 'book_intro_call',
    title: 'Book a free 15-minute call',
    description: 'Books a free 15-minute Google Meet call with AMP IT at one of the times from get_intro_call_times. Confirm the time, name and email with the person first. A calendar invite is emailed to them.',
    inputSchema: {
      type: 'object',
      properties: {
        start: { type: 'string', description: 'Start time exactly as returned by get_intro_call_times (ISO 8601).' },
        name: { type: 'string', description: 'Full name of the person booking.' },
        email: { type: 'string', description: 'Email address for the calendar invite. A work email is preferred.' },
        company: { type: 'string', description: 'Company name (optional).' },
        topic: { type: 'string', description: 'What they want help with, in a sentence (optional).' }
      },
      required: ['start', 'name', 'email'],
      additionalProperties: false
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true }
  }
];

function text(value, structured) {
  return { content: [{ type: 'text', text: value }], ...(structured ? { structuredContent: structured } : {}) };
}
function toolError(message) {
  return { content: [{ type: 'text', text: message }], isError: true };
}
function etLabel(iso) {
  return new Date(iso).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' ET';
}
function ymd(date) {
  return date.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

async function emailCheck(args) {
  const domain = normalizeDomain(cleanString(args.domain, 253));
  if (!DOMAIN_RX.test(domain)) return toolError('Please give a company domain, like smithcpa.com.');
  if (PERSONAL_EMAIL_DOMAINS.has(domain)) return toolError(`${domain} is a free email provider, so its settings are not yours to change. This check is for a company's own domain, like yourfirm.com.`);
  const r = await checkDomain(domain);
  const lines = [
    `Email security check for ${domain}: ${r.score}/100.`,
    `SPF (who may send as this domain): ${r.spf.present ? (r.spf.multiple ? 'found, but more than one record' : 'found') : 'missing'}.`,
    `DKIM (signed email): ${r.dkim.found.length ? 'found' : 'not found on common settings'}.`,
    `DMARC (what inboxes do with fakes): ${r.dmarc.present ? (/p\s*=\s*none/i.test(r.dmarc.record) ? 'found, but set to monitor only' : 'found and enforcing') : 'missing'}.`,
    'What to fix:',
    ...r.recommendations.map(x => `- ${x}`),
    r.score >= 80
      ? 'The basics look solid from public records. AMP IT, a Charlotte IT team, can review the rest (alignment, sending tools, two-step login) on a free 15-minute call. Use get_intro_call_times to book.'
      : 'This reads public records only. AMP IT, a Charlotte IT team, can fix these for you. Use get_intro_call_times to book a free 15-minute call.'
  ];
  await sendLeadAlert([`🔎 *ChatGPT app: email check* for ${domain} (score ${r.score}/100)`, 'No contact info yet. They may book next.']).catch(() => {});
  return text(lines.join('\n'), { domain, score: r.score, spf: r.spf.present, dkim: r.dkim.found.length > 0, dmarc: r.dmarc.present, recommendations: r.recommendations });
}

async function introTimes(base) {
  const from = ymd(new Date());
  const to = ymd(new Date(Date.now() + 14 * 864e5));
  const response = await fetch(`${base}/api/cal-slots?type=intro-call&from=${from}&to=${to}`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) return toolError('The calendar is not reachable right now. Call or text (980) 377-2733, or book at ' + SITE + '/assessment.');
  const data = await response.json().catch(() => ({}));
  const soon = Date.now() + 2 * 36e5;
  const picks = [];
  for (const day of Object.keys(data || {}).sort()) {
    const times = (data[day] || []).filter(x => Date.parse(x) > soon);
    if (!times.length) continue;
    picks.push(times[0]);
    if (times.length > 2) picks.push(times[Math.floor(times.length / 2)]);
    if (picks.length >= 8) break;
  }
  if (!picks.length) return toolError('No open times in the next two weeks. Call or text (980) 377-2733.');
  const slots = picks.slice(0, 8).map(start => ({ start, label: etLabel(start) }));
  return text('Open times for a free 15-minute call with AMP IT:\n' + slots.map(s => `- ${s.label} (start: ${s.start})`).join('\n'), { slots });
}

async function bookCall(args, base, req) {
  const start = cleanString(args.start, 40);
  const name = cleanString(args.name, 100);
  const email = cleanString(args.email, 254).toLowerCase();
  const company = cleanString(args.company, 120);
  const topic = cleanString(args.topic, 300);
  const when = Date.parse(start);
  if (!Number.isFinite(when) || when < Date.now() + 36e5 || when > Date.now() + 21 * 864e5) return toolError('Pick a start time from get_intro_call_times.');
  if (name.length < 2 || name.length > 100) return toolError('Please include the person’s name.');
  if (!EMAIL_RX.test(email) || email.length > 254) return toolError('Please include a valid email for the calendar invite.');

  // Limits apply only to valid requests, so junk calls can't use up real bookings.
  // One invite per address per day stops anyone using our calendar to spam a third party.
  const perCaller = await rateLimit(req, 'mcp-book', 5, 3600);
  const perInvitee = await rateLimit(keyed(email), 'mcp-book-email', 1, 86400);
  const overall = await rateLimit(keyed('all'), 'mcp-book-all', 10, 86400);
  if (!(perCaller.allowed && perInvitee.allowed && overall.allowed)) return toolError('Bookings through this app are paused for today. Book at ' + SITE + '/assessment, or call or text (980) 377-2733.');

  const note = (`Booked through the AMP IT app in ChatGPT.${company ? ' Company: ' + company + '.' : ''}${topic ? ' Topic: ' + topic : ''}`).slice(0, 1000);
  const response = await fetch(`${base}/api/cal-book`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'intro-call', start: new Date(when).toISOString(), name, email, phone: '', address: '', note }),
    signal: AbortSignal.timeout(15000)
  });
  const data = await response.json().catch(() => ({}));
  const booking = (data && (data.data || data)) || {};
  if (!(response.ok && data.status === 'success' && (booking.uid || booking.id))) {
    return toolError('That time could not be booked. It may have just been taken. Ask for another time from get_intro_call_times.');
  }
  // Record the lead the same way the website does (sheet row + Google Chat alert).
  await fetch(`${base}/api/email-trust-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: SITE },
    body: JSON.stringify({ source: 'chatgpt-app', lead_source: 'chatgpt-app', email, company, domain: '', elapsed: 5000, hp: '', answers: { concern: topic || 'Booked a call from ChatGPT' } }),
    signal: AbortSignal.timeout(8000)
  }).catch(() => {});
  return text(`Booked: ${etLabel(start)}, 15 minutes on Google Meet with AMP IT. The invite is on its way to ${email}.`, { booked: true, start, email });
}

// Keys a rate limit on something other than the caller's IP (a whole tool, or one invite address).
function keyed(value) {
  return { headers: { 'x-real-ip': String(value).slice(0, 80) }, socket: {} };
}

async function limited(req, args, name) {
  if (name === 'check_business_email_security') {
    return !(await rateLimit(req, 'mcp-email', 30, 3600)).allowed;
  }
  return false;
}

async function handle(message, base, req) {
  const { id, method, params } = message || {};
  const isNotification = id === undefined || id === null;
  const reply = result => (isNotification ? null : { jsonrpc: '2.0', id, result });
  const fail = (code, msg) => (isNotification ? null : { jsonrpc: '2.0', id, error: { code, message: msg } });

  if (!message || message.jsonrpc !== '2.0' || typeof method !== 'string') return fail(-32600, 'Invalid request');
  if (method.startsWith('notifications/')) return null;
  if (method === 'initialize') {
    const asked = params && params.protocolVersion;
    return reply({
      protocolVersion: SUPPORTED_VERSIONS.includes(asked) ? asked : SUPPORTED_VERSIONS[0],
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: 'amp-it-office-it-check', title: 'AMP IT Office IT Check', version: '1.0.0' },
      instructions: INSTRUCTIONS
    });
  }
  if (method === 'ping') return reply({});
  if (method === 'tools/list') return reply({ tools: TOOLS });
  if (method === 'tools/call') {
    const name = params && params.name;
    const args = (params && typeof params.arguments === 'object' && params.arguments) || {};
    try {
      if (await limited(req, args, name)) return reply(toolError('That has been used a lot recently. Please try again later, or call or text (980) 377-2733.'));
      if (name === 'check_business_email_security') return reply(await emailCheck(args));
      if (name === 'about_amp_it') return reply(text(JSON.stringify(ABOUT, null, 2), ABOUT));
      if (name === 'get_intro_call_times') return reply(await introTimes(base));
      if (name === 'book_intro_call') return reply(await bookCall(args, base, req));
    } catch (error) {
      console.error('[mcp] tool failed:', name, error.message);
      return reply(toolError('Something went wrong. Call or text (980) 377-2733.'));
    }
    return fail(-32602, `Unknown tool: ${String(name).slice(0, 60)}`);
  }
  return fail(-32601, 'Method not found');
}

module.exports = async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'This is the AMP IT Office IT Check app server for ChatGPT, not a web page. Add this address in ChatGPT (Settings > Apps & Connectors > Developer mode). It only answers MCP POST requests.' } });
  }
  const throttle = await rateLimit(req, 'mcp', 60, 60);
  if (!throttle.allowed) {
    res.setHeader('Retry-After', String(throttle.retryAfter));
    return res.status(429).json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests.' } });
  }
  let body;
  try {
    body = parseJsonBody(req);
  } catch (error) {
    return res.status(400).json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  const batch = Array.isArray(body) ? body.slice(0, 20) : [body];
  const results = (await Promise.all(batch.map(m => handle(m, SITE, req)))).filter(Boolean);
  if (!results.length) return res.status(202).end();
  res.setHeader('Content-Type', 'application/json');
  return res.status(200).json(Array.isArray(body) ? results : results[0]);
};
