// GET  /api/poll              → { human: N, ai: N }
// POST /api/poll { choice }   → { human: N, ai: N }
//
// Storage: Upstash Redis REST API (free tier — no SDK, just fetch)
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
      const { choice } = req.body;
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

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (err) {
    console.error('[poll]', err.message);
    return res.status(502).json({ error: 'Poll unavailable', detail: err.message });
  }
};
