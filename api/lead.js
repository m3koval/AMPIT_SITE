// Lead capture for the assessment / booking pages. The browser used to post straight
// to Apps Script with no-cors, so failures were invisible and nothing alerted us.
// Now the page posts here; we forward to the sheet server-side and send a Chat alert.
const {
  cleanString,
  parseJsonBody,
  rateLimit,
  setNoStore,
  setSameOriginCors
} = require('../lib/http-security');
const { sendLeadAlert } = require('../lib/lead-alert');

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzVSYcjWLFPz8P4HfusgA7obD2ikdRH7wCcRS91hFY-Vl7rko5P0EVGszSAzCzTocv45g/exec';
const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const PERSONAL_EMAIL_DOMAINS = new Set(['gmail.com','googlemail.com','yahoo.com','ymail.com','rocketmail.com','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','att.net','sbcglobal.net','bellsouth.net','comcast.net','verizon.net','charter.net','spectrum.net','rr.com','cox.net','earthlink.net','frontier.com','windstream.net','mail.com','gmx.com']);
const FIELDS = {
  path: 40, name: 100, company: 120, email: 254, phone: 32, address: 300,
  landing_page: 300, referrer: 300, utm_source: 100, utm_medium: 100, utm_campaign: 150,
  utm_content: 150, gclid: 200, booked: 5, industry: 80, size: 40, setup: 80,
  concern: 200, platform: 80, frustration: 300
};

function allowedOrigin(origin) {
  if (!origin) return true;
  return origin === 'https://www.ampitsolutions.com' || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin);
}

async function recordLead(payload) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await fetch(SHEETS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(5000)
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.success !== true) {
        throw new Error(data?.error || `lead sheet returned ${response.status}`);
      }
      return true;
    } catch (error) {
      console.error(`[lead] Lead capture failed (attempt ${attempt}):`, error.message);
    }
  }
  return false;
}

function sourceLabel(lead) {
  if (lead.utm_source) return lead.utm_source;
  if (lead.gclid) return 'google-ads';
  try {
    const host = lead.referrer ? new URL(lead.referrer).hostname.replace(/^www\./, '') : '';
    if (host && !host.includes('ampitsolutions.com')) return host;
  } catch (error) { /* bad referrer */ }
  return 'direct';
}

module.exports = async function handler(req, res) {
  setNoStore(res);
  setSameOriginCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }
  if (!allowedOrigin(req.headers.origin)) return res.status(403).json({ error: 'Forbidden' });
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  const throttle = await rateLimit(req, 'lead', 10, 600);
  if (!throttle.allowed) {
    res.setHeader('Retry-After', String(throttle.retryAfter));
    return res.status(429).json({ error: 'Too many submissions. Please wait and try again.' });
  }

  let body;
  try {
    body = parseJsonBody(req);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const lead = { origin: 'https://www.ampitsolutions.com' };
  for (const [key, max] of Object.entries(FIELDS)) lead[key] = cleanString(body[key], max);
  lead.email = lead.email.toLowerCase();
  lead.booked = lead.booked === 'yes' ? 'yes' : 'no';
  if (!EMAIL_RX.test(lead.email)) return res.status(400).json({ error: 'Enter a valid email address.' });

  const leadRecorded = await recordLead(lead);

  // Completed bookings already alert from /api/cal-book; this row only adds prep answers.
  if (lead.booked === 'no') {
    const personal = PERSONAL_EMAIL_DOMAINS.has(lead.email.split('@')[1] || '');
    await sendLeadAlert([
      `📝 *New lead: ${lead.path === 'onsite-audit' ? 'On-site audit request' : 'Assessment form'}*${body.left === true ? ' (left before booking)' : ' (not booked yet)'}`,
      [lead.name, lead.company].filter(Boolean).join(' · '),
      `Email: ${lead.email}${lead.phone ? ` · Phone: ${lead.phone}` : ''}`,
      lead.address ? `Address: ${lead.address}` : '',
      lead.concern ? `Concern: ${lead.concern}` : '',
      `Source: ${sourceLabel(lead)} · ${personal ? 'PERSONAL EMAIL' : 'Business email'}`,
      leadRecorded ? '' : '⚠️ Sheet write failed, this lead is only in this alert.'
    ]);
  }

  return res.status(200).json({ success: true, leadRecorded });
};
