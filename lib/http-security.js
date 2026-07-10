const ALLOWED_ORIGIN = 'https://www.ampitsolutions.com';

function setNoStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

function setSameOriginCors(req, res, methods) {
  const origin = req.headers.origin;
  if (origin === ALLOWED_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function parseJsonBody(req) {
  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    return req.body;
  }
  if (typeof req.body !== 'string') return {};
  return JSON.parse(req.body || '{}');
}

function clientIp(req) {
  return String(
    req.headers['x-vercel-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  )
    .split(',')[0]
    .trim()
    .slice(0, 80);
}

async function rateLimit(req, scope, limit, windowSeconds) {
  const baseUrl = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!baseUrl || !token) return { allowed: true, configured: false };

  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `rate:${scope}:${bucket}:${clientIp(req)}`;
  const commands = [
    ['SET', key, '0', 'EX', String(windowSeconds + 30), 'NX'],
    ['INCR', key]
  ];

  try {
    const response = await fetch(`${baseUrl}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(commands),
      signal: AbortSignal.timeout(2500)
    });
    if (!response.ok) throw new Error(`rate limit store returned ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || data[0]?.error || data[1]?.error) {
      throw new Error(`rate limit pipeline failed: ${data?.[0]?.error || data?.[1]?.error || 'invalid response'}`);
    }
    const count = Number(data[1].result);
    if (!Number.isInteger(count) || count < 1) {
      throw new Error('rate limit pipeline returned an invalid count');
    }
    return {
      allowed: count <= limit,
      configured: true,
      retryAfter: windowSeconds - (Math.floor(Date.now() / 1000) % windowSeconds)
    };
  } catch (error) {
    console.error(`[rate-limit:${scope}]`, error.message);
    return { allowed: true, configured: false };
  }
}

function cleanString(value, maxLength) {
  return String(value == null ? '' : value).trim().slice(0, maxLength + 1);
}

module.exports = {
  cleanString,
  parseJsonBody,
  rateLimit,
  setNoStore,
  setSameOriginCors
};
