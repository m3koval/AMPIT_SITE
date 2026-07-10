const dns = require('dns').promises;
const {
  cleanString,
  parseJsonBody,
  rateLimit,
  setNoStore,
  setSameOriginCors
} = require('../lib/http-security');

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzVSYcjWLFPz8P4HfusgA7obD2ikdRH7wCcRS91hFY-Vl7rko5P0EVGszSAzCzTocv45g/exec';
const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const DOMAIN_RX = /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
const COMMON_DKIM_SELECTORS = ['selector1', 'selector2', 'google', 'default', 'dkim', 'k1', 'mail', 's1', 's2', 'smtpapi', 'mandrill', 'sendgrid'];

function flattenTxt(records) {
  return (records || []).map(parts => parts.join('')).filter(Boolean);
}

function normalizeDomain(input) {
  let value = String(input || '').trim().toLowerCase();
  value = value.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].split(':')[0];
  return value;
}

async function resolveTxtSafe(name) {
  try {
    return flattenTxt(await Promise.race([
      dns.resolveTxt(name),
      new Promise((_, reject) => setTimeout(() => reject(new Error('DNS timeout')), 4000))
    ]));
  } catch (error) {
    return [];
  }
}

function score(results) {
  let value = 0;
  if (results.spf.present) value += results.spf.multiple ? 10 : 25;
  if (results.dmarc.present) {
    value += 20;
    if (/p\s*=\s*none/i.test(results.dmarc.record)) value += 4;
    if (/p\s*=\s*quarantine/i.test(results.dmarc.record)) value += 12;
    if (/p\s*=\s*reject/i.test(results.dmarc.record)) value += 18;
    if (/rua\s*=/i.test(results.dmarc.record)) value += 5;
  }
  if (results.dkim.found.length) value += 20;
  return Math.max(0, Math.min(100, value));
}

function recommendations(results) {
  const recs = [];
  if (!results.spf.present) recs.push('Add an SPF record so inboxes know which systems are allowed to send as this domain.');
  if (results.spf.multiple) recs.push('Clean up multiple SPF records. A domain should publish one SPF record, not several.');
  if (!results.dmarc.present) recs.push('Add a DMARC record at _dmarc.' + results.domain + ' to start monitoring spoofing and alignment.');
  if (results.dmarc.present && /p\s*=\s*none/i.test(results.dmarc.record)) recs.push('DMARC is present but monitor-only. Review reports before moving toward quarantine or reject.');
  if (!results.dkim.found.length) recs.push('No common DKIM selectors were found. DKIM may still exist under a custom selector, but this should be verified.');
  if (!recs.length) recs.push('The basics look present from this public DNS check. A deeper review should verify alignment, sending tools, and enforcement settings.');
  return recs;
}

async function submitLead(payload) {
  try {
    await fetch(SHEETS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(5000)
    });
  } catch (error) {
    // Do not fail the scan because lead capture had an issue.
  }
}

module.exports = async function handler(req, res) {
  setNoStore(res);
  setSameOriginCors(req, res, 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Use POST.' });
  }

  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  const throttle = await rateLimit(req, 'email-trust-check', 10, 600);
  if (!throttle.allowed) {
    res.setHeader('Retry-After', String(throttle.retryAfter));
    return res.status(429).json({ error: 'Too many scans. Please wait and try again.' });
  }

  let body;
  try {
    body = parseJsonBody(req);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }
  const domain = normalizeDomain(body.domain);
  const email = cleanString(body.email, 254).toLowerCase();
  const company = cleanString(body.company, 120);
  const phone = cleanString(body.phone, 32);

  if (!DOMAIN_RX.test(domain)) return res.status(400).json({ error: 'Enter a valid domain, like example.com.' });
  if (!EMAIL_RX.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (company.length > 120 || phone.length > 32) return res.status(400).json({ error: 'One or more fields are too long.' });

  const txt = await resolveTxtSafe(domain);
  const spfRecords = txt.filter(r => /^v=spf1\b/i.test(r));
  const dmarcRecords = await resolveTxtSafe(`_dmarc.${domain}`);
  const dmarc = dmarcRecords.find(r => /^v=dmarc1\b/i.test(r)) || '';

  const dkimFound = [];
  for (const selector of COMMON_DKIM_SELECTORS) {
    const records = await resolveTxtSafe(`${selector}._domainkey.${domain}`);
    const record = records.find(r => /^v=dkim1\b/i.test(r) || /\bp=/.test(r));
    if (record) dkimFound.push({ selector, record: record.slice(0, 180) + (record.length > 180 ? '…' : '') });
  }

  const results = {
    domain,
    checkedAt: new Date().toISOString(),
    spf: { present: spfRecords.length > 0, multiple: spfRecords.length > 1, count: spfRecords.length, records: spfRecords },
    dmarc: { present: Boolean(dmarc), record: dmarc },
    dkim: { selectorsChecked: COMMON_DKIM_SELECTORS, found: dkimFound },
    note: 'This free check reads public DNS records. It does not log into Microsoft 365, Google Workspace, or your DNS provider.'
  };
  results.score = score(results);
  results.recommendations = recommendations(results);

  await submitLead({
    origin: 'email-trust-check',
    path: 'email-trust-check',
    domain,
    email,
    company,
    phone,
    booked: 'no',
    concern: 'SPF DKIM DMARC scan request',
    platform: 'Public DNS check',
    scan_score: results.score,
    scan_spf: results.spf.present ? 'present' : 'missing',
    scan_dmarc: results.dmarc.present ? 'present' : 'missing',
    scan_dkim: results.dkim.found.length ? results.dkim.found.map(x => x.selector).join(',') : 'not found common selectors'
  });

  return res.status(200).json(results);
};
