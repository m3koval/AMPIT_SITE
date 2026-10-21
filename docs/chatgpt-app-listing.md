# AMP IT app in ChatGPT: listing and submission

Server: `https://www.ampitsolutions.com/api/mcp` (MCP, Streamable HTTP, no auth). Code: `api/mcp.js`, DNS check shared with the website in `lib/email-dns.js`.

## Listing

- **Name (30 max):** AMP IT Office IT Check
- **Short description (30 max):** Email security and IT help
- **Developer:** AMP IT LLC
- **Website:** https://www.ampitsolutions.com
- **Privacy policy:** https://www.ampitsolutions.com/privacy#chatgpt-app
- **Terms:** https://www.ampitsolutions.com/terms
- **Icon:** 64 × 64 PNG under 5 KB, from `favicon-48.png` / the AMP IT mark (needs exporting at 64 × 64).

**Long description:**

> Check whether your company email is set up so nobody can send email pretending to be you, and get plain-English next steps. AMP IT Office IT Check reads your domain's public SPF, DKIM and DMARC records, the settings that keep business email out of spam and stop spoofed invoices. No login needed.
>
> Want help? Ask about AMP IT's services, published pricing, or the free first automation offer: bring one task your team repeats, and if AMP IT can automate it in under an hour, they build it for free. When you're ready, the app shows open times and books a free 15-minute Google Meet with AMP IT's founders in Charlotte, NC.
>
> For small businesses, law firms and CPA firms in North and South Carolina.

## Tools

| Tool | What it does | Read-only |
|---|---|---|
| check_business_email_security | Public DNS check of SPF, DKIM, DMARC for a company domain; refuses free email providers | Yes |
| about_amp_it | Services, plans and published pricing, support hours, free first automation terms, contact | Yes |
| get_intro_call_times | Up to 8 open 15-minute intro-call times over the next two weeks (via /api/cal-slots) | Yes |
| book_intro_call | Books a chosen time (via /api/cal-book), then records the lead (source "ChatGPT App") and alerts Google Chat | No |

## Test prompts for OpenAI review

1. "Is the email for smithcpa.com set up safely?" → check_business_email_security
2. "What does AMP IT charge for managed IT?" → about_amp_it
3. "I'd like to talk to AMP IT this week." → get_intro_call_times, then book_intro_call after confirming time, name and email.
4. "Check gmail.com" → polite refusal (free email provider).

## Steps only Mikhail can do

1. Verify the organization at platform.openai.com (Settings → Organization → Verification).
2. In ChatGPT (Business/Plus), turn on Developer mode and add the server URL above to try it privately first.
3. Take 3 screenshots of it working (email check, about, booking) for the listing.
4. Submit in the OpenAI platform's app submission form with the listing text above.
