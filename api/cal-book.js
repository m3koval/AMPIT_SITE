// POST /api/cal-book
// Body: { type, start, name, email, phone, address, note }
const crypto = require('crypto');

function sha256(value) {
  const v = (value == null ? '' : String(value)).trim().toLowerCase();
  if (!v) return undefined;
  return crypto.createHash('sha256').update(v).digest('hex');
}

function readCookie(cookieHeader, name) {
  if (!cookieHeader) return undefined;
  const m = String(cookieHeader).match(new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : undefined;
}

// Server-side Meta CAPI Schedule event fired on confirmed bookings.
// Deduped with the browser pixel via event_id (cal.com booking uid).
// Silently no-ops until META_CAPI_ACCESS_TOKEN is set in Vercel — safe to ship as-is.
async function fireMetaSchedule(req, { email, phone, name, eventId, eventSourceUrl }) {
  const token = process.env.META_CAPI_ACCESS_TOKEN;
  if (!token) return;
  const datasetId = process.env.META_DATASET_ID || '2176447043191960';

  const fullName  = (name || '').trim();
  const firstName = fullName.split(/\s+/)[0];
  const lastName  = fullName.split(/\s+/).slice(1).join(' ');

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
  Object.keys(userData).forEach(k => userData[k] === undefined && delete userData[k]);

  const event = {
    event_name: 'Schedule',
    event_time: Math.floor(Date.now() / 1000),
    action_source: 'website',
    event_source_url: eventSourceUrl || req.headers.referer || 'https://www.ampitsolutions.com/assessment',
    user_data: userData,
    ...(eventId ? { event_id: String(eventId) } : {})
  };

  try {
    const r = await fetch(`https://graph.facebook.com/v21.0/${datasetId}/events`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: [event], access_token: token })
    });
    if (!r.ok) console.error('Meta CAPI Schedule failed:', r.status, await r.text());
  } catch (err) {
    console.error('Meta CAPI Schedule error:', err.message);
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CAL_API_KEY;
  const { type, start, name, email, phone, address, note } = req.body;

  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return res.status(500).json({ error: 'Cal.com not configured' });
  }

  const isAudit = type === 'onsite-audit';

  const location = isAudit && address
    ? { type: 'attendeeAddress', address }
    : { type: 'integration', integration: 'google-meet' };

  const payload = {
    eventTypeId: Number(eventId),
    start,
    attendee: {
      name,
      email,
      timeZone: 'America/New_York',
      language: 'en'
    },
    location,
    ...(note ? { bookingFieldsResponses: { notes: note } } : {}),
    metadata: {
      ...(phone   ? { phone }   : {}),
      ...(address ? { address } : {})
    }
  };

  try {
    const calRes = await fetch('https://api.cal.com/v2/bookings', {
      method:  'POST',
      headers: {
        'Content-Type':    'application/json',
        'cal-api-version': '2026-02-25',
        'Authorization':   `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });
    const data = await calRes.json();

    // Fire server-side Schedule on confirmed bookings, deduped with browser pixel via event_id.
    if (calRes.ok && data && data.status === 'success') {
      const booking = data.data || {};
      await fireMetaSchedule(req, {
        email,
        phone,
        name,
        eventId: booking.uid || booking.id
      });
    }

    return res.status(calRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Booking request failed', detail: err.message });
  }
};
