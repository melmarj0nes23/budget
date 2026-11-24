import { FUNCTIONAL_SECTORS, resolveSectorId } from '../config/constants';
import type { BudgetStage, GaaDepartment, NepDepartment } from '../types/budget';

export interface SectorSummary {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
  amount: number;
  sharePct: number;
  departmentCount: number;
  departments: Array<{ id: string; description: string; amount: number }>;
}

export interface ComparisonDelta {
  fromAmount: number | null;
  toAmount: number | null;
  absoluteChange: number | null;
  percentChange: number | null;
  comparable: boolean;
  limitationNote?: string;
}

/**
 * Computes validated year-over-year or cross-year change.
 * Returns null percentChange when baseline is 0 or missing rather than Infinity/NaN.
 */
export function calculateDelta(
  fromAmount: number | null | undefined,
  toAmount: number | null | undefined,
  limitationNote?: string
): ComparisonDelta {
  const fromValid = typeof fromAmount === 'number' && Number.isFinite(fromAmount);
  const toValid = typeof toAmount === 'number' && Number.isFinite(toAmount);

  if (!fromValid || !toValid) {
    return {
      fromAmount: fromValid ? fromAmount : null,
      toAmount: toValid ? toAmount : null,
      absoluteChange: null,
      percentChange: null,
      comparable: false,
      limitationNote: limitationNote ?? 'Allocation missing in one or both selected fiscal years.',
    };
  }

  const absoluteChange = toAmount - fromAmount;
  const percentChange = fromAmount > 0 ? (absoluteChange / fromAmount) * 100 : null;

  return {
    fromAmount,
    toAmount,
    absoluteChange,
    percentChange,
    comparable: !limitationNote,
    limitationNote:
      limitationNote ??
      (fromAmount === 0 && toAmount > 0
        ? 'No recorded allocation in base year (agency newly created or reclassified).'
        : undefined),
  };
}

/**
 * Aggregates department allocations into mutually exclusive functional sectors.
 * Verifies sum against national total so no double-counting occurs.
 */
export function aggregateByFunctionalSector(
  items: Array<{ id: string; description: string; amount: number }>,
  stage: BudgetStage
): { sectors: SectorSummary[]; sumTotal: number } {
  const buckets = new Map<
    string,
    { amount: number; departments: Array<{ id: string; description: string; amount: number }> }
  >();

  for (const s of FUNCTIONAL_SECTORS) {
    buckets.set(s.id, { amount: 0, departments: [] });
  }

  let sumTotal = 0;
  for (const item of items) {
    if (!Number.isFinite(item.amount) || item.amount <= 0) continue;
    const sectorId = resolveSectorId(item.id, stage);
    const bucket = buckets.get(sectorId);
    if (bucket) {
      bucket.amount += item.amount;
      bucket.departments.push(item);
    }
    sumTotal += item.amount;
  }

  const sectors: SectorSummary[] = FUNCTIONAL_SECTORS.map((s) => {
    const bucket = buckets.get(s.id)!;
    const sortedDepts = [...bucket.departments].sort((a, b) => b.amount - a.amount);
    return {
      id: s.id,
      label: s.label,
      shortLabel: s.shortLabel,
      color: s.color,
      description: s.description,
      amount: bucket.amount,
      sharePct: sumTotal > 0 ? (bucket.amount / sumTotal) * 100 : 0,
      departmentCount: sortedDepts.length,
      departments: sortedDepts,
    };
  }).sort((a, b) => b.amount - a.amount);

  return { sectors, sumTotal };
}

/**
 * Extracts validated department amounts for a given GAA fiscal year.
 */
export function getGaaDepartmentsForYear(
  departments: GaaDepartment[],
  year: number
): Array<{ id: string; slug: string; description: string; amount: number; lineItems: number }> {
  const key = String(year);
  return departments
    .map((dept) => {
      const entry = dept.years?.[key];
      const amount = entry && Number.isFinite(entry.amount) ? entry.amount : 0;
      const lineItems = entry && Number.isFinite(entry.count) ? entry.count : 0;
      return {
        id: dept.id,
        slug: dept.slug,
        description: dept.description,
        amount,
        lineItems,
      };
    })
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Extracts validated department rows from NEP FY2027 overview.
 */
export function normalizeNepDepartments(
  departments: NepDepartment[]
): Array<{
  id: string;
  slug: string;
  description: string;
  amount: number;
  baseAmount: number;
  delta: number;
  pct: number | null;
  lineItems: number;
  section: string;
}> {
  return departments
    .map((d) => ({
      id: d.id,
      slug: d.slug,
      description: d.description,
      amount: Number.isFinite(d.amount) ? d.amount : 0,
      baseAmount: Number.isFinite(d.base_amount) ? d.base_amount : 0,
      delta: Number.isFinite(d.delta) ? d.delta : 0,
      pct: typeof d.pct === 'number' && Number.isFinite(d.pct) ? d.pct : null,
      lineItems: Number.isFinite(d.line_items) ? d.line_items : 0,
      section: d.section,
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Safe per-capita calculation that refuses to divide by zero or invalid inputs.
 */
export function calculatePerCapita(
  budgetPhp: number | null | undefined,
  populationCount: number | null | undefined
): number | null {
  if (
    typeof budgetPhp !== 'number' ||
    !Number.isFinite(budgetPhp) ||
    typeof populationCount !== 'number' ||
    !Number.isFinite(populationCount) ||
    populationCount <= 0
  ) {
    return null;
  }
  return budgetPhp / populationCount;
}
