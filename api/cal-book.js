export const config = { runtime: 'edge' };

// POST /api/cal-book
// Body: { type, start, name, email, phone, address, note }
// Returns Cal.com booking response
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const apiKey = process.env.CAL_API_KEY;
  const { type, start, name, email, phone, address, note } = await req.json();

  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return new Response(JSON.stringify({ error: 'Cal.com not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
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
    const res  = await fetch(`https://api.cal.com/v1/bookings?apiKey=${apiKey}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload)
    });
    const data = await res.json();
    return new Response(JSON.stringify(data), {
      status:  res.status,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Booking request failed' }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    });
  }
}
