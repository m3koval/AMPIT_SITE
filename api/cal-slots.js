// GET /api/cal-slots?type=intro-call&from=YYYY-MM-DD&to=YYYY-MM-DD
export default async function handler(req, res) {
  const { type, from, to } = req.query;

  const apiKey  = process.env.CAL_API_KEY;
  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return res.status(500).json({ error: 'Cal.com not configured' });
  }

  const url = new URL('https://api.cal.com/v1/slots');
  url.searchParams.set('apiKey',      apiKey);
  url.searchParams.set('eventTypeId', eventId);
  url.searchParams.set('startTime',   from + 'T00:00:00.000Z');
  url.searchParams.set('endTime',     to   + 'T23:59:59.000Z');
  url.searchParams.set('timeZone',    'America/New_York');

  try {
    const calRes = await fetch(url.toString());
    const data   = await calRes.json();
    const slots  = data.slots || {};

    // Normalize: slots may be { time: "ISO" } objects or plain strings
    const normalized = {};
    for (const [date, times] of Object.entries(slots)) {
      normalized[date] = times.map(t => (typeof t === 'string' ? t : t.time));
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(normalized);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch slots' });
  }
}
