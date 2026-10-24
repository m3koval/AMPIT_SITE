# AMP IT Canonical Claims Matrix

This file is the source of truth for pricing, monitoring, support-hours, SLA, and risk-language claims across the AMP IT website, `llms.txt`, ads, and off-site profiles.

## Brand and NAP

| Field | Canonical value |
|---|---|
| Public brand name | AMP IT |
| Legal name | AMP IT LLC — legal/copyright/schema only |
| Canonical domain | https://www.ampitsolutions.com |
| Phone | (980) 377-2733 |
| Email | hello@ampitsolutions.com |
| Address | 919 Berryhill Rd, Suite 100A, Charlotte, NC 28208 |
| Human support hours | Monday–Friday, 7 AM–6 PM ET |
| Monitoring | Automated monitoring runs 24/7 for covered systems |

## Partner status

Confirmed by Mikhail 2026-09-23: AMP IT is enrolled in the Microsoft and Google partner programs and is an official reseller for both.

Approved:

- Microsoft Partner
- Google Partner
- official Microsoft and Google reseller

## Pricing language

Approved language:

- all-inclusive per-user pricing
- published per-user rates
- one predictable monthly invoice
- no surprise support invoices
- no per-ticket billing for standard covered support

Avoid unless specifically referring to a fixed Starter Track fee:

- flat rate
- one flat rate
- flat monthly rate
- one price for everything

## Engagement model

Confirmed by Mikhail 2026-10-01: AMP IT takes on project-based engagements (one-time work, not just ongoing managed IT subscriptions).

Approved:

- project-based work welcome
- one-time projects
- not just subscriptions — project work too

Avoid: implying every engagement requires the standard 12-month managed IT agreement, or that AMP IT only works on a subscription basis.

## Search consistency and official profiles

The visible cards on `/pricing/managed-it/` are the canonical plan-feature lists. Do not independently maintain a different tier breakdown in homepage JSON-LD or `llms.txt`.

After a plan edit, run `python scripts/sync-search-plans.py`, then `python scripts/sync-search-plans.py --check` and `python tests/search-consistency.test.py` (Python dependency: `beautifulsoup4==4.13.4`). GitHub Actions also runs these checks and the existing API tests.

Official social profile URLs:

- Instagram: https://www.instagram.com/ampit.clt/ — supplied by Mikhail.
- Facebook: https://www.facebook.com/people/Amp-It/61565270488911/ — public page identifies AMP IT LLC and matches the website, email, phone, and owner-supplied screenshot.
- LinkedIn: https://www.linkedin.com/company/ampitsolutions

Public references are linked, not represented as new case studies or endorsements: Clutch's verified Microsoft migration review and CMD's partner listing. New client quotes, logos, detailed case studies, and outcome metrics still need appropriate permission and evidence.

## Managed IT plans

| Plan | Price | Fit | Agreement | Monitoring | Human support | Emergency/SLA language |
|---|---:|---|---|---|---|---|
| Essential | $319/user/month, 5-user minimum | Small firms that need managed IT, baseline security, and dependable support | 12-month standard managed IT agreement | 24/7 automated remote monitoring for covered systems | Mon–Fri 7 AM–6 PM ET | Standard support queue; no 1-hour emergency SLA claim |
| Better | $445/user/month, ideal 10–40 users | Firms that need stronger security, documentation, and planning cadence | 12-month standard managed IT agreement | 24/7 automated remote monitoring for covered systems | Mon–Fri 7 AM–6 PM ET | Priority support language allowed if included in plan copy; no 1-hour emergency SLA claim unless contract says it |
| Best | $499/user/month, ideal 15–50 users | Firms that need highest-touch support, strategic planning, and faster emergency response | 12-month standard managed IT agreement | 24/7 automated remote monitoring for covered systems | Mon–Fri 7 AM–6 PM ET | 1-hour emergency response SLA for covered urgent issues |

## Canonical support/monitoring copy

Use this short version anywhere space is tight:

> AMP IT monitors covered systems around the clock. Human support is available Monday–Friday, 7 AM–6 PM ET, with emergency response options on qualifying plans.

Use this longer version for pricing/FAQ/llms.txt:

> AMP IT provides 24/7 automated monitoring for covered systems. Human helpdesk and account support are available Monday–Friday, 7 AM–6 PM ET. Emergency response options and the 1-hour emergency response SLA apply to qualifying plans and covered urgent issues, with the 1-hour SLA reserved for Best.

## Incident proof point

Confirmed by Mikhail 2026-10-09: for a real AMP IT client, an attack trying to steal information was stopped by blocking known malicious sites and isolating the affected device within minutes, which prevented reputation damage. Other businesses (not AMP IT clients) have had sites hacked and gone unnoticed for weeks, with reputation damage and rebuild costs.

Approved (anonymized only):

- Stopped in minutes. Not weeks.
- Blocked the malicious sites. Isolated the device within minutes. Stopped the attack before it spread.

Avoid: naming or identifying the client without written permission, inventing numbers (dollars saved, records protected), or implying every attack can be stopped.

## Software vendor support

Confirmed by Mikhail 2026-10-14: AMP IT supports the business software clients already run (accounting such as QuickBooks and Sage, tax software, and law-firm software such as Clio, PCLaw, Time Matters, Tabs3, Worldox, Juris, SoftPro), learning what is needed and working directly with the software company's support team on the client's behalf.

Approved:

- Works with the software your firm already runs.
- We work with the software company's support team so you don't have to.
- We set up and support the computers, servers and remote access your software runs on.

Avoid: claiming certification, official partnership or authorized hosting with any software vendor unless confirmed, and using vendor brand names in ad text.

## Texting

Confirmed by Mikhail 2026-10-08: people can text (980) 377-2733 at any time, and AMP IT replies as soon as it can.

Approved:

- Text us anytime. We reply as soon as we can.
- Calls Mon to Fri, 7 AM to 6 PM ET. Texts anytime.

Avoid: implying a human answers 24/7 or promising a response time for texts.

## Salary anchor math

Approved anchor:

> For a 15-person firm, Best is about $7,500/month — often less than hiring, managing, and equipping an internal IT employee, while giving you access to a broader support and security function.

Avoid:

> Best costs less than one engineer's fully-loaded salary.

Reason: at 30 users × $499/user/month, Best is about $180K/year; at 50 users it is about $300K/year. The broad claim breaks at larger plan-fit sizes.

## Review/schema guardrail

- Do not add `AggregateRating` or self-serving review markup to AMP IT LocalBusiness schema.
- Real reviews may be displayed visually and linked to Google Business Profile/Clutch.
- Never fabricate testimonials, client logos, review counts, case studies, or years in business.

## Metadata guardrail

Never put competitor names in page titles, metadata, alt text, or structured data. The homepage title should be:

> AMP IT — Managed IT Services in Charlotte, NC

## Licensed-IP guardrail

Do not use named or recognizable movie/brand/game characters or assets in commercial sections. The homepage poll must use original AMP IT-owned art/icons only.

## Free first automation (approved 2026-10-19)

Approved copy: "Bring one task your team repeats. If we can automate it in under an hour, we'll build it for free." Short forms for ads: "We Automate One Task Free", "First Automation Free".

Terms that must stay true wherever the offer appears:
- One per business. AMP IT takes 4 a month.
- The business must already use Microsoft 365 or Google Workspace. Built with tools included in their plan (Power Automate standard connectors, Microsoft Forms, Outlook rules, Gmail filters, Google Forms). No premium connectors, AI Builder, custom code or new licenses.
- One trigger and no more than three steps, inside the client's own account.
- Built live on a screen share with the client's admin signed in. AMP IT does not hold their passwords.
- Done means it ran once in front of them. No ongoing support, changes or maintenance included; those are paid.
- If the task will not fit in an hour, AMP IT quotes it instead. Never say "guaranteed" or promise a specific time saving.
- The 15-minute call decides whether a task qualifies, so copy must keep the "if" ("If we can automate it in under an hour").

## Free AI review (approved 2026-10-24)

Mikhail chose a written review over a ready-made AI policy, because a policy is a legal document. Offered on /ai-check/ after three taps: where they are with AI, whether they have a written AI policy, and whether they know what staff upload to AI chats.

Approved copy: "We'll look at your business and email you where AI can save your team time, what to watch with client data, and how we'd set it up for you." Fine print: "Written by Mike or Nik, AMP IT's founders. One per business." Confirmation: "We'll email your review to {email} within 2 business days."

What the review is built from: their three answers, their website, and the public email-security check (SPF, DKIM, DMARC) the lead API runs on their domain. Each review closes by offering setup and integration, and asks about their current AI policy and how they track what staff upload to AI chats. It must not read as legal advice or a finished policy, and must not claim to know how their staff actually use AI.

Commitment: emailed within 2 business days of the request (the lead arrives in Google Chat with "Wants: AI review").

## Quote by email (approved 2026-10-24)

On /pricing/managed-it/ below the plans: "Get your monthly price by email. No call needed." Asks for the number of people (1–4, 5–10, 11–25, 26–50, 50+) and an email. Confirmation: "We'll email your quote within one business day." Quotes use the published per-user rates (5-user minimum on Essential; under 5 people points to the Starter Track). Leads arrive as "Pricing Quote" with "People: ...".
