// GET  /api/poll              → { human: N, ai: N }
// POST /api/poll { choice }   → { human: N, ai: N }
//
// Storage: Upstash Redis REST API (free tier — no SDK, just fetch)
// Env vars needed in Vercel dashboard:
//   UPSTASH_REDIS_REST_URL    (e.g. https://usw1-<id>.upstash.io)
//   UPSTASH_REDIS_REST_TOKEN  (your token from Upstash console)
//
// To see raw counts: GET https://www.ampitsolutions.com/api/poll

const { parseJsonBody, rateLimit, setNoStore, setSameOriginCors } = require('../lib/http-security');

module.exports = async function handler(req, res) {
  setNoStore(res);
  setSameOriginCors(req, res, 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token   = process.env.UPSTASH_REDIS_REST_TOKEN;

  // If env vars aren't set yet, return zeroed counts so the poll still renders
  if (!baseUrl || !token) {
    return res.status(200).json({ human: 0, ai: 0, configured: false });
  }

  const redisCmd = async (commands) => {
    const r = await fetch(`${baseUrl}/pipeline`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands)
    });
    if (!r.ok) throw new Error(`Upstash error ${r.status}`);
    const data = await r.json();
    // Pipeline response: [{ result: value }, ...]
    return data.map(d => parseInt(d.result) || 0);
  };

  try {
    if (req.method === 'GET') {
      const [human, ai] = await redisCmd([
        ['GET', 'poll:human'],
        ['GET', 'poll:ai']
      ]);
      return res.status(200).json({ human, ai });
    }

    if (req.method === 'POST') {
      if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) {
        return res.status(415).json({ error: 'Content-Type must be application/json' });
      }
      const throttle = await rateLimit(req, 'poll-vote', 5, 3600);
      if (!throttle.allowed) {
        res.setHeader('Retry-After', String(throttle.retryAfter));
        return res.status(429).json({ error: 'Vote limit reached. Please try again later.' });
      }
      let body;
      try {
        body = parseJsonBody(req);
      } catch (error) {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
      const { choice } = body;
      if (choice !== 'human' && choice !== 'ai') {
        return res.status(400).json({ error: 'Invalid choice. Must be "human" or "ai".' });
      }

      const other = choice === 'human' ? 'ai' : 'human';
      const [newCount, otherCount] = await redisCmd([
        ['INCR', `poll:${choice}`],
        ['GET',  `poll:${other}`]
      ]);

      return res.status(200).json({
        [choice]: newCount,
        [other]:  otherCount
      });
    }

    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[poll]', err.message);
    return res.status(502).json({ error: 'Poll unavailable' });
  }
};
