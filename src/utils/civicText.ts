const LOWERCASE_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'by',
  'for',
  'from',
  'in',
  'into',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'under',
  'upon',
  'with',
  'among',
]);

const UPPERCASE_ACRONYMS = new Set([
  'ABC',
  'AIP',
  'BFP',
  'BLGF',
  'BOSS',
  'BPLO',
  'CCTV',
  'COA',
  'CSC',
  'CY',
  'DA',
  'DBM',
  'DILG',
  'DOH',
  'DPWH',
  'DRRM',
  'DSWD',
  'DTI',
  'FOI',
  'FY',
  'GAD',
  'II',
  'III',
  'IV',
  'IX',
  'JMC',
  'LGU',
  'MCR',
  'MDRRMO',
  'MOA',
  'MPS',
  'MSWDO',
  'NDRRMC',
  'NTA',
  'OMABE',
  'OSCA',
  'PAGASA',
  'PDAO',
  'PDRRMO',
  'PESO',
  'PHP',
  'PNP',
  'PRSD',
  'PSA',
  'PSGC',
  'PWD',
  'RA',
  'RHU',
  'SB',
  'SP',
  'SRE',
  'TESDA',
  'VI',
  'VII',
  'VIII',
  'XI',
  'XII',
]);

export function isMostlyUppercase(text: string): boolean {
  const letters = text.match(/[A-Za-z]/g);
  if (!letters || letters.length < 10) return false;
  const upperCount = letters.filter((ch) => ch >= 'A' && ch <= 'Z').length;
  return upperCount / letters.length >= 0.7;
}

function formatWord(rawWord: string, forceCapitalize: boolean): string {
  const match = rawWord.match(/^([^A-Za-z0-9]*)([A-Za-z0-9-]+)([^A-Za-z0-9]*)$/);
  if (!match) return rawWord;
  const [, prefix, core, suffix] = match;

  if (core.includes('-')) {
    const parts = core.split('-').map((p, idx) => formatWord(p, forceCapitalize && idx === 0));
    return `${prefix}${parts.join('-')}${suffix}`;
  }

  const upper = core.toUpperCase();
  if (UPPERCASE_ACRONYMS.has(upper)) {
    return `${prefix}${upper}${suffix}`;
  }
  if (/^\d+(st|nd|rd|th)$/i.test(core)) {
    return `${prefix}${core.toLowerCase()}${suffix}`;
  }

  const lower = core.toLowerCase();
  if (!forceCapitalize && LOWERCASE_WORDS.has(lower)) {
    return `${prefix}${lower}${suffix}`;
  }

  return `${prefix}${lower.charAt(0).toUpperCase()}${lower.slice(1)}${suffix}`;
}

export function smartTitleCase(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const tokens = cleaned.split(' ');
  return tokens
    .map((token, idx) => {
      const prev = idx > 0 ? tokens[idx - 1] : '';
      const forceCap =
        idx === 0 ||
        /[:—–\-(“"']$/.test(prev) ||
        /^[(“"']/.test(token);
      return formatWord(token, forceCap);
    })
    .join(' ');
}

export function smartSentenceCase(text: string): string {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';

  const lower = cleaned.toLowerCase();
  let result = '';
  let capitalizeNext = true;

  for (let i = 0; i < lower.length; i += 1) {
    const ch = lower[i];
    if (capitalizeNext && ch >= 'a' && ch <= 'z') {
      result += ch.toUpperCase();
      capitalizeNext = false;
    } else {
      result += ch;
      if (ch === '.' || ch === '!' || ch === '?') {
        capitalizeNext = true;
      } else if (!/\s/.test(ch)) {
        capitalizeNext = false;
      }
    }
  }

  // Restore civic acronyms & key proper nouns
  const properNouns = [
    'Alcala',
    'Pangasinan',
    'Lingayen',
    'Bayambang',
    'Bersamin',
    'Sangguniang Bayan',
    'Sangguniang Panlalawigan',
    'Province of Pangasinan',
    'Provincial Government of Pangasinan',
    'Provincial Veterinary Office',
    'Municipal Agriculture Office',
    'Ramon V. Guico',
    'Agno River',
    'Republic Act',
    'Joint Memorandum Circular',
    'Memorandum of Agreement',
  ];

  for (const acronym of UPPERCASE_ACRONYMS) {
    result = result.replace(new RegExp(`\\b${acronym.toLowerCase()}\\b`, 'g'), acronym);
  }
  for (const noun of properNouns) {
    result = result.replace(new RegExp(`\\b${noun.toLowerCase()}\\b`, 'g'), noun);
  }

  return result;
}

export function normalizeDisplayHeadline(text: string): string {
  return isMostlyUppercase(text) ? smartTitleCase(text) : text;
}

export function normalizeDisplaySentence(text: string): string {
  return isMostlyUppercase(text) ? smartSentenceCase(text) : text;
}
