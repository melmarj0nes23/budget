import fs from 'node:fs';
import path from 'node:path';

const DIST_DIR = path.resolve(import.meta.dirname, '../dist');
const BASE_HTML_PATH = path.join(DIST_DIR, 'index.html');
const SITE_ORIGIN = 'https://budget.betteralcala.org';

const ROUTE_META = [
  {
    route: '/tracker',
    title: 'Barangay Project Tracker | BetterAlcala Budget',
    description:
      'Filter funded roads, farm-to-market roads, flood control, and multi-purpose buildings across all 21 barangays in Alcala, Pangasinan.',
  },
  {
    route: '/budgetdocs',
    title: 'Municipal Budget & Docs | BetterAlcala Budget',
    description:
      'Approved municipal appropriations (FY 2022–2026), supplemental budgets, BLGF SRE, COA audit reports, and procurement disclosures for Alcala, Pangasinan.',
  },
  {
    route: '/contracts',
    title: 'DPWH Contracts | BetterAlcala Budget',
    description:
      'Searchable DPWH infrastructure contracts, project budgets, contractors, and completion status in Alcala, Pangasinan.',
  },
  {
    route: '/transparency',
    title: 'Project Transparency | BetterAlcala Budget',
    description:
      'Compare FY 2027 NEP vs. House Bill and 2020–2026 Enacted GAA allocations for Alcala, Pangasinan, and nationwide LGUs.',
  },
];

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function injectMeta(html, { route, title, description }) {
  const canonicalUrl = `${SITE_ORIGIN}${route}`;
  const safeTitle = escapeHtml(title);
  const safeDesc = escapeHtml(description);

  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${safeTitle}</title>`)
    .replace(
      /<meta\s+name="description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta name="description" content="${safeDesc}" />`
    )
    .replace(
      /<link\s+rel="canonical"\s+href="[\s\S]*?"\s*\/>/,
      `<link rel="canonical" href="${canonicalUrl}" />`
    )
    .replace(
      /<meta\s+property="og:url"\s+content="[\s\S]*?"\s*\/>/,
      `<meta property="og:url" content="${canonicalUrl}" />`
    )
    .replace(
      /<meta\s+property="og:title"\s+content="[\s\S]*?"\s*\/>/,
      `<meta property="og:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+property="og:description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta property="og:description" content="${safeDesc}" />`
    )
    .replace(
      /<meta\s+name="twitter:title"\s+content="[\s\S]*?"\s*\/>/,
      `<meta name="twitter:title" content="${safeTitle}" />`
    )
    .replace(
      /<meta\s+name="twitter:description"\s+content="[\s\S]*?"\s*\/>/,
      `<meta name="twitter:description" content="${safeDesc}" />`
    );
}

function main() {
  if (!fs.existsSync(BASE_HTML_PATH)) {
    throw new Error(`Missing ${BASE_HTML_PATH}. Run vite build first.`);
  }

  const baseHtml = fs.readFileSync(BASE_HTML_PATH, 'utf8');

  for (const item of ROUTE_META) {
    const outDir = path.join(DIST_DIR, item.route.replace(/^\//, ''));
    fs.mkdirSync(outDir, { recursive: true });
    const outPath = path.join(outDir, 'index.html');
    fs.writeFileSync(outPath, injectMeta(baseHtml, item), 'utf8');
  }

  console.log(`Prerendered SEO meta tags for ${ROUTE_META.length} routes in dist/.`);
}

main();
