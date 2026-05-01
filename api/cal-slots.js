// GET /api/cal-slots?type=intro-call&from=YYYY-MM-DD&to=YYYY-MM-DD
module.exports = async function handler(req, res) {
  const { type, from, to } = req.query;

  const apiKey  = process.env.CAL_API_KEY;
  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return res.status(500).json({ error: 'Cal.com not configured', type, hasKey: !!apiKey, hasEvent: !!eventId });
  }

  const params = new URLSearchParams({
    apiKey,
    eventTypeId: eventId,
    startTime:   from + 'T00:00:00.000Z',
    endTime:     to   + 'T23:59:59.000Z',
    timeZone:    'America/New_York'
  });

  try {
    const url = `https://api.cal.com/v1/slots?${params}`;
    const calRes = await fetch(url);
    const data   = await calRes.json();

    // Debug mode: return raw Cal.com response
    if (req.query.debug === '1') {
      return res.status(calRes.status).json({ _debug: true, _status: calRes.status, _url: url.replace(apiKey, 'REDACTED'), _raw: data });
    }

    const slots  = data.slots || {};

    const normalized = {};
    for (const [date, times] of Object.entries(slots)) {
      normalized[date] = times.map(t => (typeof t === 'string' ? t : t.time));
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(normalized);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch slots', detail: err.message });
  }
};
