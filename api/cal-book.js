// POST /api/cal-book
// Body: { type, start, name, email, phone, address, note }
const crypto = require('crypto');
const {
  cleanString,
  parseJsonBody,
  rateLimit,
  setNoStore
} = require('../lib/http-security');

const EMAIL_RX = /^[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}$/;
const EVENT_TYPES = new Set(['intro-call', 'onsite-audit']);

function sha256(value) {
  const normalized = (value == null ? '' : String(value)).trim().toLowerCase();
  if (!normalized) return undefined;
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  const match = String(cookieHeader).match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  if (!match) return undefined;
  try {
    return decodeURIComponent(match[1]);
  } catch (error) {
    return undefined;
  }
}

// Server-side Meta CAPI Schedule event fired on confirmed bookings.
// Deduped with the browser pixel via event_id (cal.com booking uid).
async function fireMetaSchedule(req, { email, phone, name, eventId, eventSourceUrl }) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return;
  const datasetId = process.env.META_DATASET_ID || '2176447043191960';

  const fullName = (name || '').trim();
  const firstName = fullName.split(/\s+/)[0];
  const lastName = fullName.split(/\s+/).slice(1).join(' ');

  const userData = {
    em: sha256(email),
    ph: phone ? sha256(String(phone).replace(/[^0-9]/g, '')) : undefined,
    fn: sha256(firstName),
    ln: sha256(lastName),
    client_ip_address: (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || undefined,
    client_user_agent: req.headers['user-agent'] || undefined,
    fbp: readCookie(req.headers.cookie, '_fbp'),
    fbc: readCookie(req.headers.cookie, '_fbc')
  };
  Object.keys(userData).forEach(key => userData[key] === undefined && delete userData[key]);

  const event = {
    event_name: 'Schedule',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: eventSourceUrl || req.headers.referer || 'https://www.ampitsolutions.com/assessment',
    user_data: userData,
    ...(eventId ? { event_id: String(eventId) } : {})
  };

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${datasetId}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: token }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) console.error('Meta CAPI Schedule failed:', response.status, await response.text());
  } catch (error) {
    console.error('Meta CAPI Schedule error:', error.message);
  }
}

module.exports = async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }

  const throttle = await rateLimit(req, 'cal-book', 5, 600);
  if (!throttle.allowed) {
    res.setHeader('Retry-After', String(throttle.retryAfter));
    return res.status(429).json({ error: 'Too many booking attempts. Please wait and try again.' });
  }

  let body;
  try {
    body = parseJsonBody(req);
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const type = cleanString(body.type, 40);
  const start = cleanString(body.start, 40);
  const name = cleanString(body.name, 100);
  const email = cleanString(body.email, 254).toLowerCase();
  const phone = cleanString(body.phone, 32);
  const address = cleanString(body.address, 300);
  const note = cleanString(body.note, 1000);

  if (!EVENT_TYPES.has(type)) return res.status(400).json({ error: 'Invalid appointment type' });
  if (name.length < 2 || name.length > 100) return res.status(400).json({ error: 'Enter a valid name' });
  if (!EMAIL_RX.test(email) || email.length > 254) return res.status(400).json({ error: 'Enter a valid email address' });
  if (phone.length > 32 || address.length > 300 || note.length > 1000) {
    return res.status(400).json({ error: 'One or more fields are too long' });
  }

  const startMs = Date.parse(start);
  const now = Date.now();
  if (!Number.isFinite(startMs) || startMs < now + 2 * 60 * 1000 || startMs > now + 62 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ error: 'Choose a valid future appointment time' });
  }

  const isAudit = type === 'onsite-audit';
  if (isAudit && !address) {
    return res.status(400).json({ error: 'Enter an office address for an on-site audit' });
  }

  const apiKey = process.env.CAL_API_KEY;
  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return res.status(500).json({ error: 'Cal.com not configured' });
  }

  const location = isAudit
    ? { type: 'attendeeAddress', address }
    : { type: 'integration', integration: 'google-meet' };

  const payload = {
    eventTypeId: Number(eventId),
    start: new Date(startMs).toISOString(),
    attendee: {
      name,
      email,
      timeZone: 'America/New_York',
      language: 'en'
    },
    location,
    ...(note ? { bookingFieldsResponses: { notes: note } } : {}),
    metadata: {
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {})
    }
  };

  try {
    const calRes = await fetch('https://api.cal.com/v2/bookings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'cal-api-version': '2026-02-25',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10000)
    });
    const data = await calRes.json();

    if (calRes.ok && data && data.status === 'success') {
      const booking = data.data || {};
      await fireMetaSchedule(req, {
        email,
        phone,
        name,
        eventId: booking.uid || booking.id
      }).catch(error => console.error('Meta CAPI Schedule error:', error.message));
    }

    return res.status(calRes.status).json(data);
  } catch (error) {
    console.error('Booking request failed:', error.message);
    return res.status(502).json({ error: 'Booking request failed' });
  }
};
