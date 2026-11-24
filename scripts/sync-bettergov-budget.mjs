import fs from 'node:fs';
import path from 'node:path';

const API_BASE = 'https://budget.bettergov.ph/api/v1';
const OUT_PATH = path.resolve(
  import.meta.dirname,
  '../public/data/national-budget-alcala.json'
);

async function fetchJsonOptional(url) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function isAlcalaPangasinan(record) {
  const title = (record.title || record.name || '').toLowerCase();
  return /alcala,?\s*pangasinan/i.test(title);
}

async function main() {
  const nowYear = new Date().getFullYear();
  const candidateGaaYears = [];
  for (let y = 2024; y <= nowYear + 1; y += 1) {
    candidateGaaYears.push(y);
  }

  console.log(
    `Syncing BetterGov GAA (${candidateGaaYears.join(', ')}) & latest NEP/HGAB for Alcala, Pangasinan...`
  );

  // 1. Fetch Enacted GAA across all available years from 2024 onward
  const gaaResponses = await Promise.all(
    candidateGaaYears.map(async (yr) => ({
      yr,
      res: await fetchJsonOptional(`${API_BASE}/gaa/search?q=Alcala&year=${yr}&limit=100`),
    }))
  );

  const gaaByKey = new Map();
  const activeGaaYears = new Set();

  for (const { res } of gaaResponses) {
    for (const item of res?.data || []) {
      if (!isAlcalaPangasinan(item)) continue;
      const existing = gaaByKey.get(item.fam_key) || {
        famKey: item.fam_key,
        name: item.name,
        department: item.department,
        years: {},
        fy2024Php: 0,
        fy2025Php: 0,
        fy2026Php: 0,
      };

      const itemYears = item.years || {};
      for (const [yrStr, entry] of Object.entries(itemYears)) {
        const amt = Number(entry?.amount) || 0;
        if (amt > 0) {
          existing.years[yrStr] = amt;
          activeGaaYears.add(Number(yrStr));
        }
      }

      existing.fy2024Php = existing.years['2024'] || 0;
      existing.fy2025Php = existing.years['2025'] || 0;
      existing.fy2026Php = existing.years['2026'] || 0;

      if (Object.keys(existing.years).length > 0) {
        gaaByKey.set(item.fam_key, existing);
      }
    }
  }

  const gaaProjects = Array.from(gaaByKey.values());
  const gaaYears = Array.from(activeGaaYears).sort((a, b) => a - b);

  // 2. Fetch latest available Proposed NEP / House Bill (HGAB) year (tries next year down to 2027)
  const extractRows = (res) => Object.values(res?.data || {}).find(Array.isArray) || [];
  let proposedYear = 2027;
  let hgabProjects = [];
  let metaNotice = null;

  for (let yr = Math.max(nowYear + 1, 2027); yr >= 2027; yr -= 1) {
    const [dpwhRes, fmrRes, hfepRes, niaRes] = await Promise.all([
      fetchJsonOptional(`${API_BASE}/hgab/${yr}/datasets/dpwh/projects?q=Alcala&limit=50`),
      fetchJsonOptional(`${API_BASE}/hgab/${yr}/datasets/fmr/projects?q=Alcala&limit=50`),
      fetchJsonOptional(`${API_BASE}/hgab/${yr}/datasets/hfep/projects?q=Alcala&limit=50`),
      fetchJsonOptional(`${API_BASE}/hgab/${yr}/datasets/nia/projects?q=Alcala&limit=50`),
    ]);

    const rows = [
      ...extractRows(dpwhRes),
      ...extractRows(fmrRes),
      ...extractRows(hfepRes),
      ...extractRows(niaRes),
    ].filter(isAlcalaPangasinan);

    if (rows.length > 0) {
      proposedYear = yr;
      metaNotice = dpwhRes?.meta?.notice || null;
      hgabProjects = rows.map((p) => ({
        id: p.id,
        dataset: p.dataset,
        title: p.title,
        program: p.program || null,
        statusLabel: p.status_label || 'Listed',
        nepPhp: typeof p.nep_php === 'number' ? p.nep_php : null,
        housePhp:
          typeof p.house_php === 'number'
            ? p.house_php
            : typeof p.hgab3_php === 'number'
              ? p.hgab3_php
              : null,
        deltaPhp: typeof p.delta_php === 'number' ? p.delta_php : null,
        nepPdfUrl: p.pdf_url?.nep || null,
        housePdfUrl: p.pdf_url?.hgab3 || p.pdf_url?.hgab2 || null,
        detailUrl: p.url || null,
      }));
      break;
    }
  }

  const payload = {
    syncedAt: new Date().toISOString(),
    sourceApi: API_BASE,
    sourceDocs: 'https://budget.bettergov.ph/docs',
    gaaYears,
    proposedYear,
    notice:
      metaNotice ||
      'Independent and unofficial reading of published GAA/NEP/House bill documents. Figures are published allocations, not actual spending.',
    gaaProjects,
    hgab2027Projects: hgabProjects,
  };

  if (fs.existsSync(OUT_PATH)) {
    try {
      const existing = JSON.parse(fs.readFileSync(OUT_PATH, 'utf8'));
      if (
        JSON.stringify(existing.gaaYears) === JSON.stringify(gaaYears) &&
        existing.proposedYear === proposedYear &&
        JSON.stringify(existing.gaaProjects) === JSON.stringify(gaaProjects) &&
        JSON.stringify(existing.hgab2027Projects) === JSON.stringify(hgabProjects)
      ) {
        console.log('No new budget or project changes detected; keeping existing file untouched.');
        return;
      }
    } catch {
      // Proceed to overwrite if existing file cannot be parsed
    }
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');

  console.log(
    `Saved ${OUT_PATH}: GAA years [${gaaYears.join(', ')}] (${gaaProjects.length} projects), Proposed FY ${proposedYear} (${hgabProjects.length} projects).`
  );
}

main().catch((err) => {
  console.error('Failed to sync BetterGov budget data:', err);
  process.exit(1);
});
