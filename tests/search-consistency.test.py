"""Search-content regression checks. Run: python tests/search-consistency.test.py"""
import json
import re
import unittest
from pathlib import Path
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = 'https://www.ampitsolutions.com'
IG = 'https://www.instagram.com/ampit.clt/'

def soup(path):
    return BeautifulSoup((ROOT / path).read_text(), 'html.parser')

def schemas(page):
    return [json.loads(x.get_text()) for x in page.select('script[type="application/ld+json"]')]

class SearchConsistency(unittest.TestCase):
    def test_no_published_service_amounts(self):
        # Preserve non-service figures (risk/salary context, legal terms and
        # third-party software comparisons), not AMP IT rates or plan totals.
        allowed = {
            'terms.html': {'$100'},
            'cybersecurity/index.html': {'$120,000', '$120k'},
            'industries/other-industries/index.html': {'$120,000'},
            'blog/your-team-is-already-using-ai.html': {'$20', '$20–$200'},
        }
        for path in list(ROOT.rglob('*.html')) + [ROOT / 'llms.txt', ROOT / 'api/mcp.js']:
            name = str(path.relative_to(ROOT))
            content = path.read_text()
            with self.subTest(page=name):
                amounts = {value.rstrip('.,') for value in re.findall(r'\$\d[\d,.]*(?:[–-]\$?\d[\d,.]*)?k?', content)}
                self.assertFalse(amounts - allowed.get(name, set()), amounts)
                self.assertNotRegex(content.lower(), r'published (?:per-user |monthly )*(?:prices|pricing|rates)|rates are published')
                if path.suffix == '.html':
                    for data in schemas(soup(path)):
                        def check_prices(obj):
                            if isinstance(obj, dict):
                                if 'price' in obj:
                                    self.assertEqual(str(obj['price']), '0', 'Only explicitly free offers retain numeric schema prices')
                                for value in obj.values():
                                    check_prices(value)
                            elif isinstance(obj, list):
                                for value in obj:
                                    check_prices(value)
                        check_prices(data)

    def test_quote_based_wording(self):
        paths = list(ROOT.rglob('*.html')) + list((ROOT / 'docs').glob('*.md'))
        paths += [ROOT / 'llms.txt', ROOT / 'api/mcp.js', ROOT / 'scripts/sync-search-plans.py']
        forbidden = re.compile(
            r'published (?:per-user |monthly |IT )*(?:prices|pricing|rates)|'
            r'context before you see the price|full pricing breakdown|real 2026 prices|'
            r'(?:see|view) (?:our |starting a business )?pricing|'
            r'no quote needed|price before (?:a |the )?call|no call needed', re.I)
        for path in paths:
            with self.subTest(page=str(path.relative_to(ROOT))):
                self.assertNotRegex(path.read_text(), forbidden)
        pricing = soup('pricing/managed-it/index.html')
        fit, quote = pricing.select_one('.value-section'), pricing.select_one('#quote')
        assert fit is not None and quote is not None
        self.assertIn('before committing', fit.get_text())
        self.assertIn('Request a tailored quote', quote.get_text())
        self.assertNotIn('$', fit.get_text())

    def test_all_jsonld_parses(self):
        for path in ROOT.rglob('*.html'):
            with self.subTest(page=str(path.relative_to(ROOT))):
                schemas(soup(path))

    def test_plan_features_match_visible_pricing(self):
        pricing = soup('pricing/managed-it/index.html')
        home = schemas(soup('index.html'))[0]
        service = schemas(pricing)[0]
        llms = (ROOT / 'llms.txt').read_text()
        cards = pricing.select('.plans-grid .plan')
        self.assertEqual(len(cards), 3)
        for card, offer, pricing_offer in zip(cards, home['hasOfferCatalog']['itemListElement'], service['hasOfferCatalog']['itemListElement']):
            name_el = card.select_one('.plan-name')
            assert name_el is not None
            name = name_el.get_text(strip=True)
            section = llms.split(f'- **{name}**')[1].split('\n- **')[0]
            for li in card.select('.plan-features li'):
                feature = li.get_text(' ', strip=True)
                self.assertIn(feature, offer['description'])
                self.assertIn(feature, pricing_offer['description'])
                self.assertIn(feature, section)
            for obj in (offer, pricing_offer):
                self.assertNotIn('price', obj)
                self.assertNotIn('priceSpecification', obj)
                self.assertEqual(obj['url'], ORIGIN + '/pricing/managed-it/')
        self.assertNotIn('Expanded helpdesk hours', llms)
        self.assertNotIn('Unlimited remote and on-site support', llms)

    def test_verified_profile_connected(self):
        for path in ROOT.rglob('*.html'):
            page = soup(path)
            if page.select_one('ul.footer-links'):
                with self.subTest(page=str(path.relative_to(ROOT))):
                    matches = page.select(f'.footer-links a[href="{IG}"]')
                    self.assertEqual(len(matches), 1)
                    self.assertIn('noopener', str(matches[0].get('rel', '')))
        home = schemas(soup('index.html'))[0]
        about = schemas(soup('about/index.html'))[0]['about']
        self.assertEqual(home['@id'], ORIGIN + '/#business')
        self.assertEqual(about['@id'], home['@id'])
        self.assertEqual(about['sameAs'], home['sameAs'])
        self.assertIn(IG, home['sameAs'])
        self.assertIn('https://www.facebook.com/people/Amp-It/61565270488911/', home['sameAs'])
        for path in ROOT.rglob('*.html'):
            page = soup(path)
            if page.select_one('ul.footer-links'):
                self.assertEqual(len(page.select('ul.footer-links a[href="https://www.facebook.com/people/Amp-It/61565270488911/"]')), 1)
        self.assertIn(IG, (ROOT / 'llms.txt').read_text())

    def test_public_proof_links_without_review_schema(self):
        page = soup('about/index.html')
        evidence = page.select_one('#work-and-references')
        self.assertIsNotNone(evidence)
        assert evidence is not None
        self.assertIsNotNone(evidence.select_one('a[href="https://clutch.co/profile/amp-it#reviews"]'))
        self.assertIsNotNone(evidence.select_one('a[href="https://cmdrift.com/partners.html"]'))
        for path in ['index.html', 'about/index.html']:
            self.assertNotIn('AggregateRating', json.dumps(schemas(soup(path))))

if __name__ == '__main__':
    unittest.main()
