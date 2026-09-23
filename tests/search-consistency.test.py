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
            price_el = card.select_one('.amount')
            assert name_el is not None and price_el is not None
            name = name_el.get_text(strip=True)
            price = price_el.get_text(strip=True).lstrip('$')
            section = llms.split(f'- **{name}**')[1].split('\n- **')[0]
            for li in card.select('.plan-features li'):
                feature = li.get_text(' ', strip=True)
                self.assertIn(feature, offer['description'])
                self.assertIn(feature, pricing_offer['description'])
                self.assertIn(feature, section)
            for obj in (offer, pricing_offer):
                self.assertEqual(obj['price'], price)
                self.assertEqual(obj['priceSpecification']['billingDuration'], 'P1M')
                self.assertEqual(obj['priceSpecification']['unitText'], 'user')
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
