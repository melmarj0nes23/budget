export function formatPhpCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'N/A';
  }
  const sign = amount < 0 ? '-' : '';
  const abs = Math.abs(amount);

  if (abs >= 1_000_000_000_000) {
    return `${sign}₱${(abs / 1_000_000_000_000).toFixed(2)}T`;
  }
  if (abs >= 1_000_000_000) {
    return `${sign}₱${(abs / 1_000_000_000).toFixed(2)}B`;
  }
  if (abs >= 1_000_000) {
    return `${sign}₱${(abs / 1_000_000).toFixed(2)}M`;
  }
  if (abs >= 1_000) {
    return `${sign}₱${(abs / 1_000).toFixed(1)}K`;
  }
  return `${sign}₱${Math.round(abs).toLocaleString('en-PH')}`;
}

export function formatPhpExact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatPhpPerCapita(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return Math.round(value).toLocaleString('en-PH');
}

export function formatPopulationCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return Math.round(value).toLocaleString('en-PH');
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  return `${value.toFixed(digits)}%`;
}

export function formatSignedPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return 'N/A';
  }
  const prefix = value > 0 ? '+' : '';
  return `${prefix}${value.toFixed(digits)}%`;
}

export function formatSignedPhpCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) {
    return 'N/A';
  }
  const prefix = amount > 0 ? '+' : '';
  return `${prefix}${formatPhpCompact(amount)}`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not specified by source';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

export function formatDateOnly(iso: string | null | undefined): string {
  if (!iso) return 'Not specified by source';
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

export function parseCommaInt(raw: string | number | null | undefined): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (!raw) return null;
  const cleaned = raw.replace(/,/g, '').trim();
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Repairs double-encoded UTF-8 mojibake sometimes present in upstream PSGC names
 * (e.g., "City of Las PiÃ±as" -> "City of Las Piñas") and trims whitespace.
 */
export function fixMojibake(input: string | null | undefined): string {
  if (!input) return '';
  let out = input.trim();
  if (/Ã[\x80-\xBF]|Â[\x80-\xBF]/.test(out)) {
    try {
      const bytes = Uint8Array.from(out, (ch) => ch.charCodeAt(0) & 0xff);
      const decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
      if (decoded) out = decoded.trim();
    } catch {
      // Keep original if not valid UTF-8 byte sequence
    }
  }
  return out.replace(/\s+/g, ' ');
}

/**
 * Strips PSA table footnote markers (e.g., "1/, 2/, a/, b/, c/, r1"), leading hierarchy dots,
 * and prefixes like "City of " for reliable geographic matching across PSGC and PSA OpenSTAT.
 */
export function cleanPsaGeoLabel(raw: string): string {
  return fixMojibake(raw)
    .replace(/^\.+/, '')
    .replace(/\s+(?:r\d+|[a-z0-9]+\/)(?:,\s*(?:r\d+|[a-z0-9]+\/))*\s*$/gi, '')
    .replace(/\s*\(Not a Province\)\s*/gi, '')
    .trim();
}

export function normalizeGeoName(raw: string): string {
  const cleaned = cleanPsaGeoLabel(raw)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^city of\s+/i, '')
    .replace(/\s+city$/i, '')
    .replace(/\bmt\.\s*province\b/i, 'mountain province')
    .replace(/\bcompostela valley\b/i, 'davao de oro')
    .replace(/\bncr\b/i, 'national capital region')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
  return cleaned;
}

/**
 * Strips "City of " / "(Capital)" suffixes from a locality name for cleaner keyword searches
 * in HGAB project titles and GAA line items.
 */
export function toLocalitySearchTerm(areaName: string): string {
  return fixMojibake(areaName)
    .replace(/^City of\s+/i, '')
    .replace(/\s*\(Capital\)\s*/gi, '')
    .replace(/\s*\(Not a Province\)\s*/gi, '')
    .replace(/\s*City$/i, '')
    .trim();
}
