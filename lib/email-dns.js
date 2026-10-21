// Public-DNS email trust check (SPF, DKIM, DMARC), shared by the website check and the ChatGPT app.
const dns = require('dns').promises;

const DOMAIN_RX = /^(?!-)(?:[a-zA-Z0-9-]{1,63}\.)+[a-zA-Z]{2,}$/;
const COMMON_DKIM_SELECTORS = ['selector1', 'selector2', 'google', 'default', 'dkim', 'k1', 'mail', 's1', 's2', 'smtpapi', 'mandrill', 'sendgrid'];
const PERSONAL_EMAIL_DOMAINS = new Set(['gmail.com','googlemail.com','yahoo.com','ymail.com','rocketmail.com','outlook.com','hotmail.com','live.com','msn.com','icloud.com','me.com','mac.com','aol.com','proton.me','protonmail.com','att.net','sbcglobal.net','bellsouth.net','comcast.net','verizon.net','charter.net','spectrum.net','rr.com','cox.net','earthlink.net','frontier.com','windstream.net','mail.com','gmx.com']);

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

async function checkDomain(domain) {
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
  return results;
}

module.exports = { DOMAIN_RX, PERSONAL_EMAIL_DOMAINS, normalizeDomain, checkDomain };
