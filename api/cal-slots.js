// GET /api/cal-slots?type=intro-call&from=YYYY-MM-DD&to=YYYY-MM-DD
const { rateLimit, setNoStore } = require('../lib/http-security');

const EVENT_TYPES = new Set(['intro-call', 'onsite-audit']);
const DATE_RX = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value) {
  if (!DATE_RX.test(String(value || ''))) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
}

module.exports = async function handler(req, res) {
  setNoStore(res);
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const throttle = await rateLimit(req, 'cal-slots', 60, 60);
  if (!throttle.allowed) {
    res.setHeader('Retry-After', String(throttle.retryAfter));
    return res.status(429).json({ error: 'Too many calendar requests. Please wait and try again.' });
  }

  const { type, from, to } = req.query;
  if (!EVENT_TYPES.has(type)) return res.status(400).json({ error: 'Invalid appointment type' });

  const fromDate = parseDate(from);
  const toDate = parseDate(to);
  const dayMs = 24 * 60 * 60 * 1000;
  const maxSlotMs = Date.now() + 62 * dayMs;
  if (!fromDate || !toDate || fromDate > toDate || (toDate - fromDate) / dayMs > 45 || fromDate.getTime() > maxSlotMs) {
    return res.status(400).json({ error: 'Use a valid date range of 45 days or less' });
  }

  const apiKey = process.env.CAL_API_KEY;
  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return res.status(500).json({ error: 'Cal.com not configured' });
  }

  const params = new URLSearchParams({
    eventTypeId: eventId,
    start: from,
    end: to,
    timeZone: 'America/New_York'
  });

  try {
    const calRes = await fetch(`https://api.cal.com/v2/slots?${params}`, {
      headers: {
        'cal-api-version': '2024-09-04',
        Authorization: `Bearer ${apiKey}`
      },
      signal: AbortSignal.timeout(10000)
    });
    const data = await calRes.json();
    if (!calRes.ok) {
      console.error('Cal.com slot request failed:', calRes.status);
      return res.status(502).json({ error: 'Calendar availability is temporarily unavailable' });
    }

    const slots = data.data || {};
    const normalized = {};
    for (const [date, times] of Object.entries(slots)) {
      if (Array.isArray(times)) {
        normalized[date] = times
          .map(time => typeof time === 'string' ? time : (time.time || time.start || ''))
          .filter(time => typeof time === 'string' && Number.isFinite(Date.parse(time)) && Date.parse(time) <= maxSlotMs)
          .map(time => new Date(time).toISOString());
      }
    }

    return res.status(200).json(normalized);
  } catch (error) {
    console.error('Failed to fetch slots:', error.message);
    return res.status(502).json({ error: 'Failed to fetch slots' });
  }
};
