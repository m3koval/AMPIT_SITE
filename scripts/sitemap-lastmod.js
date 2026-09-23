#!/usr/bin/env node
// Rewrite every <lastmod> in sitemap.xml from git history.
//
//   node scripts/sitemap-lastmod.js          # update sitemap.xml in place
//   node scripts/sitemap-lastmod.js --check  # exit 1 if any date is stale
//
// Each URL gets the date of the last commit that touched its source file.
// Files with uncommitted edits get today's date, so running this right before
// committing a content change stamps it correctly.

const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const SITEMAP = path.join(ROOT, 'sitemap.xml');
const ORIGIN = 'https://www.ampitsolutions.com';

// "/"                     -> index.html
// "/pricing/managed-it/"  -> pricing/managed-it/index.html
// "/blog/some-post"       -> blog/some-post.html
function sourceFor(url) {
  const p = url.replace(ORIGIN, '').replace(/^\//, '');
  const candidates = p === '' || p.endsWith('/')
    ? [path.join(p, 'index.html')]
    : [`${p}.html`, path.join(p, 'index.html')];
  return candidates.find(c => fs.existsSync(path.join(ROOT, c)));
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function lastModified(file) {
  if (git('status', '--porcelain', '--', file)) {
    return new Date().toISOString().slice(0, 10);
  }
  return git('log', '-1', '--format=%cs', '--', file);
}

const check = process.argv.includes('--check');
const xml = fs.readFileSync(SITEMAP, 'utf8');
const problems = [];

const updated = xml.replace(
  /<loc>([^<]+)<\/loc>(\s*)<lastmod>([^<]*)<\/lastmod>/g,
  (match, loc, gap, current) => {
    const file = sourceFor(loc);
    if (!file) {
      problems.push(`no source file for ${loc}`);
      return match;
    }
    const date = lastModified(file);
    if (date !== current) problems.push(`${loc}: ${current} -> ${date}`);
    return `<loc>${loc}</loc>${gap}<lastmod>${date}</lastmod>`;
  }
);

if (check) {
  problems.forEach(p => console.log(p));
  process.exit(problems.length ? 1 : 0);
}

fs.writeFileSync(SITEMAP, updated);
problems.forEach(p => console.log(p));
console.log(problems.length ? `updated ${problems.length} entr${problems.length === 1 ? 'y' : 'ies'}` : 'sitemap already current');
