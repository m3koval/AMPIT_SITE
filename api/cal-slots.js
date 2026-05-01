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
    eventTypeId: eventId,
    start:       from,
    end:         to,
    timeZone:    'America/New_York'
  });

  try {
    const url = `https://api.cal.com/v2/slots?${params}`;
    const calRes = await fetch(url, {
      headers: {
        'cal-api-version': '2024-09-04',
        'Authorization':   `Bearer ${apiKey}`
      }
    });
    const data = await calRes.json();

    // Debug mode: return raw Cal.com response
    if (req.query.debug === '1') {
      return res.status(calRes.status).json({
        _debug: true, _status: calRes.status,
        _url: url.replace(apiKey, 'REDACTED'), _raw: data
      });
    }

    // v2 response: { status: "success", data: { "2026-05-01": ["ISO","ISO",...] } }
    const slots = (data.status === 'success' && data.data) ? data.data : {};

    const normalized = {};
    for (const [date, times] of Object.entries(slots)) {
      if (Array.isArray(times)) {
        normalized[date] = times.map(t =>
          typeof t === 'string' ? t : (t.time || t.start || '')
        );
      }
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(normalized);
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch slots', detail: err.message });
  }
};
