const {
  cleanString,
  parseJsonBody,
  rateLimit,
  setNoStore,
  setSameOriginCors
} = require('../lib/http-security');
const { sendLeadAlert } = require('../lib/lead-alert');
const { DOMAIN_RX, PERSONAL_EMAIL_DOMAINS, normalizeDomain, checkDomain } = require('../lib/email-dns');

const SHEETS_URL = 'https://script.google.com/macros/s/AKfycbzVSYcjWLFPz8P4HfusgA7obD2ikdRH7wCcRS91hFY-Vl7rko5P0EVGszSAzCzTocv45g/exec';
const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const FUNNEL_NAMES = { 'email-quiz': 'Email Quiz', 'security-check': 'Security Check', 'law-firm-check': 'Law Firm Check', 'cpa-check': 'CPA Check', 'accounting-software': 'Accounting Software Check', 'ai-check': 'AI Check', 'handoff': 'IT Hand-off', 'chatgpt-app': 'ChatGPT App' };
const FUNNEL_INDUSTRY = { 'law-firm-check': 'Law firm / legal services' };

async function submitLead(payload) {
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
      console.error(`[email-trust-check] Lead capture failed (attempt ${attempt}):`, error.message);
    }
  }
  return false;
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
  const fromQuiz = Object.prototype.hasOwnProperty.call(FUNNEL_NAMES, body.source);
  const funnelName = fromQuiz ? FUNNEL_NAMES[body.source] : '';
  const leadSource = cleanString(body.lead_source, 60).replace(/[^\w.\- ]/g, '') || 'direct';
  const answers = fromQuiz && body.answers && typeof body.answers === 'object' ? body.answers : {};
  const quizConcern = cleanString(answers.concern, 120) || 'No answer';
  const quizPlatform = cleanString(answers.platform, 60);
  const quizSize = cleanString(answers.size, 30);
  const quizMfa = cleanString(answers.mfa, 40);
  const quizIndustry = FUNNEL_INDUSTRY[body.source] || cleanString(answers.firm, 60);
  const quizRisk = cleanString(answers.risk, 10);
  const searchTerm = cleanString(body.keyword, 80);
  const quizDetails = [
    quizRisk && `Priority: ${quizRisk}`,
    answers.account && `Account: ${cleanString(answers.account, 40)}`,
    answers.when && `Noticed: ${cleanString(answers.when, 40)}`,
    answers.payment && `Payment change asked: ${cleanString(answers.payment, 20)}`,
    answers.plan && `Response plan: ${cleanString(answers.plan, 40)}`,
    answers.wires && `Wires: ${cleanString(answers.wires, 40)}`,
    answers.records && `Records held: ${cleanString(answers.records, 20)}`,
    answers.irplan && `Breach plan: ${cleanString(answers.irplan, 30)}`,
    answers.where && `Runs on: ${cleanString(answers.where, 40)}`,
    searchTerm && `Search: ${searchTerm}`
  ].filter(Boolean).map(x => ` | ${x}`).join('');

  if (!EMAIL_RX.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address.' });
  if (fromQuiz && (cleanString(body.hp, 200) || Number(body.elapsed) < 2000)) {
    console.warn('[email-trust-check] Dropped likely bot submission for', body.source);
    return res.status(200).json({ skipped: true, leadRecorded: false });
  }
  if (company.length > 120 || phone.length > 32) return res.status(400).json({ error: 'One or more fields are too long.' });

  if (fromQuiz && !domain) {
    const personalEmail = PERSONAL_EMAIL_DOMAINS.has(email.split('@')[1] || '');
    const recorded = await submitLead({
      origin: 'https://www.ampitsolutions.com',
      path: body.source,
      name: funnelName,
      domain: '',
      email,
      company: 'Not provided',
      phone,
      booked: 'no',
      concern: quizConcern,
      frustration: `${personalEmail ? 'PERSONAL EMAIL | ' : ''}${quizConcern}${quizDetails} | No domain given${phone ? ', call back' : ', follow up to run the check'} | Source: ${leadSource}`,
      platform: quizPlatform || 'Not provided',
      size: quizSize,
      industry: quizIndustry || (personalEmail ? 'Personal email' : ''),
      setup: quizMfa ? `MFA: ${quizMfa}` : '',
      scan_score: '',
      scan_spf: 'not scanned',
      scan_dmarc: 'not scanned',
      scan_dkim: 'not scanned'
    });
    await sendLeadAlert([
      `🔔 *New lead: ${funnelName}*${quizRisk === 'Urgent' ? ' (URGENT)' : ''}`,
      `${quizConcern}${quizDetails}`,
      `Email: ${email}${phone ? ` · Phone: ${phone} (wants a call back)` : ''}`,
      `Source: ${leadSource} · ${personalEmail ? 'PERSONAL EMAIL' : 'Business email'}`,
      recorded ? '' : '⚠️ Sheet write failed, this lead is only in this alert.'
    ]);
    return res.status(200).json({ skipped: true, leadRecorded: recorded });
  }

  if (!DOMAIN_RX.test(domain)) return res.status(400).json({ error: 'Enter a valid domain, like example.com.' });

  const results = await checkDomain(domain);

  const leadRecorded = await submitLead({
    origin: 'https://www.ampitsolutions.com',
    path: fromQuiz ? body.source : 'email-trust-check',
    name: 'Email Trust Check',
    domain,
    email,
    company: company || domain,
    phone,
    booked: 'no',
    concern: 'SPF DKIM DMARC scan request',
    frustration: 'SPF DKIM DMARC scan request',
    platform: 'Public DNS check',
    scan_score: results.score,
    scan_spf: results.spf.present ? 'present' : 'missing',
    scan_dmarc: results.dmarc.present ? 'present' : 'missing',
    scan_dkim: results.dkim.found.length ? results.dkim.found.map(x => x.selector).join(',') : 'not found common selectors',
    ...(fromQuiz ? {
      name: funnelName,
      concern: quizConcern,
      platform: quizPlatform || 'Public DNS check',
      size: quizSize,
      industry: quizIndustry,
      setup: quizMfa ? `MFA: ${quizMfa}` : '',
      frustration: `${quizConcern}${quizDetails} | Score ${results.score}/100 | SPF ${results.spf.present ? 'found' : 'missing'}, DKIM ${results.dkim.found.length ? 'found' : 'not found'}, DMARC ${results.dmarc.present ? 'found' : 'missing'} | Source: ${leadSource}`
    } : {})
  });

  results.leadRecorded = leadRecorded;
  await sendLeadAlert([
    `🔔 *New lead: ${fromQuiz ? funnelName : 'Email Trust Check'}*${quizRisk === 'Urgent' ? ' (URGENT)' : ''}`,
    fromQuiz ? `${quizConcern}${quizDetails}` : 'Ran the email trust check',
    `Email: ${email}${phone ? ` · Phone: ${phone}` : ''} · Domain: ${domain} (score ${results.score}/100)`,
    `Source: ${fromQuiz ? leadSource : 'email-trust-check page'}`,
    leadRecorded ? '' : '⚠️ Sheet write failed, this lead is only in this alert.'
  ]);
  return res.status(200).json(results);
};
