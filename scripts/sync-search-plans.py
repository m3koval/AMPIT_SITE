#!/usr/bin/env python3
"""Project visible pricing cards into JSON-LD and llms.txt; never change plan terms.
Requires beautifulsoup4. Run after editing pricing: python scripts/sync-search-plans.py
Use --check in verification to detect drift without writing.
"""
import json
import re
import sys
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
URL = 'https://www.ampitsolutions.com/pricing/managed-it/'
HOURS = ('Human support is available Monday–Friday, 7 AM–6 PM ET. Automated monitoring runs '
         '24/7 for covered systems. Emergency coverage and response commitments depend on the selected plan and covered issue.')
pricing = BeautifulSoup((ROOT / 'pricing/managed-it/index.html').read_text(), 'html.parser')
plans = []
for card in pricing.select('.plans-grid .plan'):
    def text(selector):
        element = card.select_one(selector)
        if element is None:
            raise ValueError(f'Missing pricing element: {selector}')
        return element.get_text(' ', strip=True)
    plans.append(dict(name=text('.plan-name'), price=text('.amount').lstrip('$'),
                      fit=text('.per').split('·', 1)[1].strip(),
                      features=[li.get_text(' ', strip=True) for li in card.select('.plan-features li')]))
assert len(plans) == 3, 'Expected the existing three plans'

def offers():
    return [{
        '@type': 'Offer', 'name': p['name'], 'url': URL,
        'price': p['price'], 'priceCurrency': 'USD',
        'description': '; '.join(p['features']) + '. ' + HOURS,
        'priceSpecification': {'@type': 'UnitPriceSpecification', 'price': p['price'],
                               'priceCurrency': 'USD', 'billingDuration': 'P1M', 'unitText': 'user'},
        'itemOffered': {'@type': 'Service', 'name': p['name'] + ' Managed IT',
                        'serviceType': 'Managed IT Services', 'areaServed': ['Charlotte, NC', 'United States']}
    } for p in plans]

changes = {}
for name in ['index.html', 'pricing/managed-it/index.html']:
    original = (ROOT / name).read_text()
    count = [0]
    def replace(match):
        data = json.loads(match.group(1))
        if 'hasOfferCatalog' not in data:
            return match.group(0)
        data['hasOfferCatalog']['itemListElement'] = offers()
        count[0] += 1
        return '<script type="application/ld+json">\n' + json.dumps(data, indent=2, ensure_ascii=False) + '\n</script>'
    updated = re.sub(r'<script type="application/ld\+json">(.*?)</script>', replace, original, flags=re.S)
    assert count[0] == 1, f'Expected one offer catalog in {name}'
    if updated != original:
        changes[name] = updated

name = 'llms.txt'
original = (ROOT / name).read_text()
lines = ['## Pricing', '', 'Published per-user monthly rates for standard covered services. Essential has a 5-user minimum. Standard managed IT agreements are 12 months.', '', HOURS, '', f'Current plan details: {URL}', '']
for p in plans:
    lines += [f'- **{p["name"]}** — ${p["price"]}/user/month ({p["fit"]})']
    lines += ['  - ' + f for f in p['features']]
    lines += ['']
updated = re.sub(r'## Pricing\n.*?(?=## Resources)', lambda _: '\n'.join(lines) + '\n', original, flags=re.S)
if updated != original:
    changes[name] = updated
if '--check' in sys.argv:
    for name in changes:
        print('OUT OF SYNC:', name)
    if changes:
        sys.exit(1)
    print('Pricing projections match visible cards.')
else:
    for name, content in changes.items():
        (ROOT / name).write_text(content)
        print('Updated', name)
