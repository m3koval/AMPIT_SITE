// GET  /api/poll              → { human: N, ai: N }
// POST /api/poll { choice }   → { human: N, ai: N }
//
// Storage: Upstash Redis REST API (free tier — no SDK, just fetch)
// One-vote-per-IP: stores poll:ip:<ip> with a 1-year TTL so the same
// IP address can only increment the counters once, regardless of browser
// or whether localStorage was cleared.
//
// Env vars needed in Vercel dashboard:
//   UPSTASH_REDIS_REST_URL    (e.g. https://usw1-<id>.upstash.io)
//   UPSTASH_REDIS_REST_TOKEN  (your token from Upstash console)
//
// To see raw counts: GET https://www.ampitsolutions.com/api/poll

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If env vars aren't set yet, return zeroed counts so the poll still renders
  if (!baseUrl || !token) {
    return res.status(200).json({ human: 0, ai: 0, configured: false });
  }

  // Execute a Redis pipeline; returns raw result values (strings, numbers, or null)
  const redis = async (commands) => {
    const r = await fetch(`${baseUrl}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error(`Upstash error ${r.status}`);
    return (await r.json()).map(d => d.result);
  };

  const int = v => parseInt(v) || 0;

  try {
    if (req.method === 'GET') {
      const [human, ai] = await redis([
        ['GET', 'poll:human'],
        ['GET', 'poll:ai']
      ]);
      return res.status(200).json({ human: int(human), ai: int(ai) });
    }

    if (req.method === 'POST') {
      const { choice } = req.body;
      if (choice !== 'human' && choice !== 'ai') {
        return res.status(400).json({ error: 'Invalid choice. Must be "human" or "ai".' });
      }

      // Resolve client IP from Vercel's forwarded header
      const ip    = (req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim();
      const ipKey = 'poll:ip:' + ip;

      // Check for prior vote AND load current counts in one round-trip
      const [ipVote, humanCount, aiCount] = await redis([
        ['GET', ipKey],
        ['GET', 'poll:human'],
        ['GET', 'poll:ai']
      ]);

      // Already voted from this IP — return current counts, don't increment
      if (ipVote !== null) {
        return res.status(200).json({
          human: int(humanCount),
          ai:    int(aiCount),
          alreadyVoted: true
        });
      }

      // First vote from this IP: record it and increment the chosen counter
      const ONE_YEAR = 365 * 24 * 60 * 60;
      const other    = choice === 'human' ? 'ai' : 'human';
      const results  = await redis([
        ['SET',  ipKey, choice, 'EX', ONE_YEAR],  // lock this IP for 1 year
        ['INCR', `poll:${choice}`],                // increment chosen counter
        ['GET',  `poll:${other}`]                  // read the other counter
      ]);
      // results: ['OK', newCount, otherCount]
      return res.status(200).json({
        [choice]: int(results[1]),
        [other]:  int(results[2])
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[poll]', err.message);
    return res.status(502).json({ error: 'Poll unavailable', detail: err.message });
  }
};
