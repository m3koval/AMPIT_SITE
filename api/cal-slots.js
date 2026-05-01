export const config = { runtime: 'edge' };

// GET /api/cal-slots?type=intro-call&from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns available slots grouped by date: { "2026-05-04": ["ISO", ...], ... }
export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type'); // 'intro-call' | 'onsite-audit'
  const from = searchParams.get('from'); // YYYY-MM-DD
  const to   = searchParams.get('to');   // YYYY-MM-DD

  const apiKey  = process.env.CAL_API_KEY;
  const eventId = type === 'onsite-audit'
    ? process.env.CAL_EVENT_AUDIT
    : process.env.CAL_EVENT_INTRO;

  if (!apiKey || !eventId) {
    return new Response(JSON.stringify({ error: 'Cal.com not configured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL('https://api.cal.com/v1/slots');
  url.searchParams.set('apiKey',      apiKey);
  url.searchParams.set('eventTypeId', eventId);
  url.searchParams.set('startTime',   from + 'T00:00:00.000Z');
  url.searchParams.set('endTime',     to   + 'T23:59:59.000Z');
  url.searchParams.set('timeZone',    'America/New_York');

  try {
    const res  = await fetch(url.toString());
    const data = await res.json();

    // Normalize: each slot is either { time: "ISO" } or "ISO" — return just the ISO strings
    const slots = data.slots || {};
    const normalized = {};
    for (const [date, times] of Object.entries(slots)) {
      normalized[date] = times.map(t => (typeof t === 'string' ? t : t.time));
    }

    return new Response(JSON.stringify(normalized), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to fetch slots' }), {
      status: 502, headers: { 'Content-Type': 'application/json' }
    });
  }
}
