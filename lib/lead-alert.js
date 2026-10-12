// Posts a lead alert to the Google Chat "Leads" space. The webhook URL lives in the
// GOOGLE_CHAT_WEBHOOK_URL env var (Vercel), never in the repo. Alerts must never block
// or break lead capture, so every failure is logged and swallowed.
const SHEET_URL = 'https://docs.google.com/spreadsheets/d/16-mDn5oqQEX_pWonoyEgpJQJioy4wvwCXl8pB2sllfw/edit';

async function sendLeadAlert(lines) {
  const url = process.env.GOOGLE_CHAT_WEBHOOK_URL;
  if (!url || !/^https:\/\/chat\.googleapis\.com\//.test(url)) return false;
  const text = lines.filter(Boolean).join('\n') + `\n<${SHEET_URL}|Open the lead sheet>`;
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=UTF-8' },
      body: JSON.stringify({ text }),
      signal: AbortSignal.timeout(4000)
    });
    if (!response.ok) throw new Error(`Google Chat returned ${response.status}`);
    return true;
  } catch (error) {
    console.error('[lead-alert] Alert failed:', error.message);
    return false;
  }
}

module.exports = { sendLeadAlert };
