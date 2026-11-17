#!/usr/bin/env python3
"""Editorial regression gate: copy, schema, index, URLs and incident cutoffs."""
import json,re,unittest
from pathlib import Path
from bs4 import BeautifulSoup
R=Path(__file__).resolve().parents[1]
SLUGS=['ai-phishing-business-verification-habits','bank-payment-delays-november-16-2026-business-checklist','charlotte-business-email-spf-dkim-dmarc','cyber-insurance-requirements-small-business','faa-ground-stop-november-2026-weekend-business-continuity','in-house-it-vs-managed-it','local-admin-rights-small-business-risk','managed-it-cost-charlotte','microsoft-365-outage-november-2026-business-recovery','microsoft-365-security-basics-charlotte-firms','predictable-managed-it-vs-break-fix','quickbooks-multi-user-office-setup','small-business-ai-start-safely','visa-vendor-incident-jpmorgan-claims-business-response','wisp-for-tax-and-accounting-firms','your-team-is-already-using-ai']
REQUIRED={
SLUGS[0]:['independent of the suspicious account','revoke sessions','MFA methods','does not detect every phishing'],
SLUGS[1]:['Only the authorized payment owner','6:10 p.m. EST','CNN'],
SLUGS[2]:['Either aligned pass','p=none','Authentication-Results','no common selector found'],
SLUGS[3]:['broker','exact question','only the insurer'],
SLUGS[4]:['stabilization observation window','6:10 p.m. EST'],
SLUGS[5]:['password manager','co-managed','departing person'],
SLUGS[6]:['verify it expires','elevation/revocation test','does not test endpoint'],
SLUGS[7]:['license edition','response clock','not a guaranteed resolution'],
SLUGS[8]:['message trace','6:10 p.m. EST','institutional reproduction'],
SLUGS[9]:['representative sign-in test','phishing-resistant','not tenant-wide'],
SLUGS[10]:['hourly relationship','responsibility matrix','exclusions'],
SLUGS[11]:['licensed user limits','Single-User versus Multi-User','authoritative ledger','wide-area','native MFA'],
SLUGS[12]:['low-sensitivity','factual errors','not a completed governance assessment'],
SLUGS[13]:['does not retrieve existing copies','retention/deletion','11:46 AM EST'],
SLUGS[14]:['unauthorized acquisition','after discovering','key was accessed','reliable evidence','314.4(b)(1)','regularly monitoring'],
SLUGS[15]:['February 10, 2026','February 17','off by default','required-by-law','covered entity or business associate','unauthorized staff']}
class Editorial(unittest.TestCase):
 def setUp(self):self.pages={k:BeautifulSoup((R/'blog'/(k+'.html')).read_text(),'html.parser') for k in SLUGS}
 def test_all_findings_have_required_controls(self):
  self.assertEqual(len(self.pages),16)
  for k,needles in REQUIRED.items():
   text=self.pages[k].get_text(' ',strip=True)
   for n in needles:self.assertIn(n,text,(k,n))
 def test_no_removed_claims_or_paid_prices(self):
  bad=['trusted Teams chat','The file never leaves','disclosure rights the Heppner court relied on do not apply','They are not.','last 30 days','without slowing your team down','most incidents still start','almost never the software','If a breach reaches 500','Without Leaking Client Data','Most AI rollouts stall','every major law firm','Morgan v. V2X','Jeffries v. Harcros','Warner v. Gilbarco']
  for k,s in self.pages.items():
   text=s.get_text(' ',strip=True)
   self.assertIsNone(re.search(r'\$\s*\d',text),k)
   for b in bad:self.assertNotIn(b,text,(k,b))
 def test_canonical_metadata_and_faq_sync(self):
  for k,s in self.pages.items():
   self.assertEqual(s.select_one('link[rel="canonical"]')['href'],'https://www.ampitsolutions.com/blog/'+k)
   title=s.h1.get_text(' ',strip=True);desc=s.select_one('meta[name="description"]')['content']
   for sc in s.select('script[type="application/ld+json"]'):
    d=json.loads(sc.get_text())
    if d.get('@type') in ['Article','BlogPosting']:
     self.assertEqual(d['headline'],title,k);self.assertEqual(d['description'],desc,k)
    if d.get('@type')=='FAQPage':
     visible=[(x.select_one('.faq-q').get_text(' ',strip=True),x.select_one('.faq-a').get_text(' ',strip=True)) for x in s.select('.faq-item')]
     self.assertEqual([(q['name'],q['acceptedAnswer']['text']) for q in d['mainEntity']],visible,k)
 def test_index_and_sitemap_membership_and_titles(self):
  s=BeautifulSoup((R/'blog/index.html').read_text(),'html.parser');xml=(R/'sitemap.xml').read_text();llms=(R/'llms.txt').read_text()
  for k,page in self.pages.items():
   a=s.select_one('h2 a[href="/blog/'+k+'"],h3 a[href="/blog/'+k+'"]')
   # Wisdom cards may be a wrapping anchor.
   if not a:
    a=s.select_one('a[href="/blog/'+k+'"] h2,a[href="/blog/'+k+'"] h3')
   self.assertIsNotNone(a,k);self.assertEqual(a.get_text(' ',strip=True),page.h1.get_text(' ',strip=True),k)
   self.assertIn('/blog/'+k,xml);self.assertIn('/blog/'+k,llms)
if __name__=='__main__':unittest.main()
