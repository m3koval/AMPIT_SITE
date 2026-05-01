// POST /api/cal-book
// Body: { type, start, name, email, phone, address, note }
export default async function handler(req, res) {
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

  const payload = {
    eventTypeId: Number(eventId),
    start,
    responses: {
      name,
      email,
      ...(note ? { notes: note } : {}),
      location: isAudit && address
        ? { value: 'attendeeInPerson', optionValue: address }
        : { value: 'integrations:google:meet', optionValue: '' }
    },
    timeZone: 'America/New_York',
    language: 'en',
    metadata: {
      ...(phone   ? { phone }   : {}),
      ...(address ? { address } : {})
    }
  };

  try {
    const calRes = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await calRes.json();
    return res.status(calRes.status).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Booking request failed' });
  }
}
