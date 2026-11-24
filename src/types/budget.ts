export type BudgetStage = 'gaa' | 'nep';

export interface YearAllocation {
  count: number;
  amount: number;
}

export interface GaaNationalYear {
  year: number;
  line_items: number;
  amount: number;
}

export interface GaaNationalResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    departments: number;
  };
  data: GaaNationalYear[];
}

export interface GaaDepartment {
  id: string;
  slug: string;
  description: string;
  years: Record<string, YearAllocation>;
}

export interface GaaDepartmentsResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    total_items: number;
  };
  data: GaaDepartment[];
}

export interface GaaAgency {
  id: string;
  slug: string;
  agency_code: string;
  description: string;
  department_id: string;
  years: Record<string, YearAllocation>;
}

export interface GaaDepartmentDetailResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    department_id: string;
  };
  data: {
    department: GaaDepartment;
    yearly_totals: GaaNationalYear[];
    agencies: GaaAgency[];
  };
}

export interface GaaExpenseClassItem {
  expense_code: string;
  label: string;
  years: Record<string, YearAllocation>;
}

export interface GaaExpenseClassesResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    department_id: string;
  };
  data: GaaExpenseClassItem[];
}

export interface GaaProgramItem {
  department_id: string;
  agency_id: string;
  fam_key: string;
  name: string;
  ids_count: number;
  department?: string;
  years: Record<string, YearAllocation>;
}

export interface GaaProgramsResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    department_id: string;
    year: number;
    query: string | null;
    agency_id: string | null;
    limit: number;
    matched: number;
    matched_amount: number;
  };
  data: GaaProgramItem[];
  next_cursor?: string | null;
}

export interface GaaObjectItem {
  id: string;
  slug: string;
  object_code: string;
  description: string;
  department_id: string;
  expense_id: string;
  fund_id: string;
  operating_unit_id: string;
  fpap_id: string;
  agency_id: string;
  years: Record<string, YearAllocation>;
}

export interface GaaObjectsResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    department_id: string;
    year: number;
    sort: string;
    dir: string;
    limit: number;
    matched: number;
    matched_amount: number;
  };
  data: GaaObjectItem[];
  next_cursor?: string | null;
}

export interface GaaSearchResponse {
  meta: {
    dataset: string;
    years: number[];
    currency: string;
    scale: string;
    query: string;
    year: number | null;
    department_id: string | null;
    limit: number;
    returned: number;
  };
  data: GaaProgramItem[];
}

export interface NepDepartment {
  id: string;
  slug: string;
  description: string;
  source_description: string;
  source_department_code: string;
  section: string;
  line_items: number;
  amount: number;
  base_amount: number;
  agencies: number;
  programs: number;
  activities: number;
  operating_units: number;
  objects: number;
  regions: number;
  delta: number;
  pct: number | null;
}

export interface NepOverviewResponse {
  meta: {
    dataset: string;
    fiscal_year: number;
    baseline_year: number;
    currency: string;
    scale: string;
    generated_at?: string;
    source_file?: string;
  };
  data: {
    national: {
      line_items: number;
      amount: number;
      base_amount: number;
      delta: number;
      pct: number;
    };
    departments: NepDepartment[];
  };
}

export interface NepRollupItem {
  code: string;
  description: string;
  extra: string | null;
  count: number;
  amount: number;
  base_amount: number;
  delta: number;
  pct: number | null;
}

export interface NepRollupResponse {
  meta: {
    dataset: string;
    fiscal_year: number;
    baseline_year: number;
    currency: string;
    scale: string;
    dimension: string;
    limit: number;
  };
  data: NepRollupItem[];
}

export interface NepDepartmentDetailResponse {
  meta: {
    dataset: string;
    fiscal_year: number;
    baseline_year: number;
    currency: string;
    scale: string;
    department_id: string;
  };
  data: {
    department: NepDepartment;
    agencies: NepRollupItem[];
    expense_classes?: NepRollupItem[];
    programs?: NepRollupItem[];
    regions?: NepRollupItem[];
  };
}

export interface BudgetCycleResponse {
  meta: {
    dataset: string;
    currency: string;
    scale: string;
    generated_at: string;
    source_filename: string;
    scope: string;
    units: string;
    years: number[];
    stages: string[];
    expense_classes: string[];
  };
  data: {
    note: string;
    subjects: Array<{
      subject_id: string;
      source_sheet: string;
      display_name: string;
      canonical_portal_department_id: string;
      canonical_portal_agency_id: string;
    }>;
  };
}

// Statistics API types (statistics.bettergov.ph)
export interface StatsCoverage {
  checked: string;
  dataUpdated: string;
  catalogChecked: string;
  datasets: number;
  mirrored: number;
  mirroredCells: number;
  topics: number;
  source: string;
  note: string;
}

export interface StatsDatasetSummary {
  id: string;
  path: string;
  title: string;
  domain: string;
  topics: string[];
  source: string;
  sourceUpdated: string | null;
  retrieved: string | null;
  release: string;
  ready: boolean;
  availability: string;
  cells: string;
  latestYear: number | null;
  unit: string;
  dimensions: Array<{ code: string; label: string; count: number }>;
  links: { page: string; api: string };
}

export interface StatsDatasetDetail extends StatsDatasetSummary {
  sampleQuery?: {
    release: string;
    selection: Record<string, string[]>;
  };
}

export interface StatsQueryRow {
  codes: string[];
  labels: string[];
  value: number | null;
  status: string;
}

export interface StatsQueryResponse {
  data: {
    dataset: { id: string; title: string };
    dimensions: Array<{ code: string; label: string }>;
    selection: Record<string, string[]>;
    rows: StatsQueryRow[];
    count: number;
    release: string;
    unit: string;
    source: string;
    sourceUpdated: string | null;
    retrieved: string | null;
  };
}

export interface PsgcRegion {
  code: string;
  area_name: string;
  geographic_level: string;
  reg: number;
  island_region: string;
  version: string;
  populations: Array<{
    id: number;
    population: string;
    year: number;
    psgc: string;
  }>;
}

export interface PsgcRegionsResponse {
  count: number;
  results: PsgcRegion[];
}

export interface PsgcAreaRaw {
  code: string;
  area_name: string;
  correspondence_code?: string;
  geographic_level: string;
  reg: number;
  prv: number;
  mun: number;
  bgy: number;
  old_name?: string;
  city_class?: string;
  income_classification?: string;
  urban_rural?: string;
  island_region?: string;
  status?: string;
  version: string;
  populations: Array<{
    id: number;
    population: string;
    year: number;
    psgc: string;
  }>;
}

export interface PsgcListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PsgcAreaRaw[];
}

export interface PsgcProvinceRecord {
  code: string;
  areaName: string;
  regCode: string;
  reg: number;
  prv: number;
  geoLevel: 'Prov' | 'City' | 'Other';
  incomeClass: string;
  islandGroup: string;
  pop2015: number | null;
  pop2020: number | null;
  pop2024: number | null;
}

export interface PsgcMunicipalityRecord {
  code: string;
  areaName: string;
  regCode: string;
  reg: number;
  prv: number;
  mun: number;
  geoLevel: string;
  cityClass: string;
  incomeClass: string;
  pop2015: number | null;
  pop2020: number | null;
  pop2024: number | null;
}

export interface ProvincialPovertyRecord {
  geoCode: string;
  rawLabel: string;
  cleanName: string;
  normalizedKey: string;
  povertyIncidence2018: number | null;
  povertyIncidence2021: number | null;
  povertyIncidence2023: number | null;
  povertyThreshold2023: number | null;
}

export type HgabDatasetKey = 'dpwh' | 'fmr' | 'hfep' | 'nia';

export interface HgabDistrictSummary {
  id: string;
  label: string;
  jurisdiction: string;
  district_label: string;
  region: string;
  region_key: string;
  attribution: {
    code: string;
    label: string;
    meaning: string;
  };
  representative?: {
    name: string;
    seat: string;
    profile_url?: string;
  } | null;
}

export interface HgabDistrictListResponse {
  meta: {
    dataset: string;
    fiscal_year: number;
    built_at?: string;
    notice?: string;
  };
  data: {
    total: number;
    districts: HgabDistrictSummary[];
  };
}

export interface HgabDistrictDetailResponse {
  meta: {
    dataset: string;
    fiscal_year: number;
    built_at?: string;
    notice?: string;
  };
  data: HgabDistrictSummary & {
    offices: Array<{
      id: string;
      name: string;
      kind: string;
      kind_label: string;
      region: string;
      tier: string;
      tier_text: string;
      co_served_districts?: Array<{ id: string; label: string }>;
    }>;
    headline?: {
      fy2026_gaa_php: number | null;
      fy2027_nep_php: number | null;
      fy2027_hgab3_php: number | null;
      shared_office_total?: boolean;
      note?: string;
    };
    co_served_districts?: Array<{ id: string; label: string }>;
    url?: string;
  };
}

export interface HgabProjectRow {
  id: string;
  dataset: HgabDatasetKey;
  title: string;
  program: string | null;
  pap: string | null;
  region: string | null;
  region_key: string | null;
  office: string | null;
  office_kind: string | null;
  status_label: string | null;
  nep_php: number | null;
  hgab2_php: number | null;
  hgab3_php: number | null;
  house_php: number | null;
  delta_php: number | null;
  nep_page?: number | null;
  hgab3_page?: number | null;
  pdf_url?: string | null;
  url?: string | null;
}

export interface HgabProjectsResponse {
  meta: {
    dataset: string;
    fiscal_year: number;
    built_at?: string;
    notice?: string;
  };
  data: {
    total: number;
    sums?: {
      nep_php: number | null;
      hgab2_php: number | null;
      hgab3_php: number | null;
      not_additive_across_versions?: boolean;
    };
    rows: HgabProjectRow[];
  };
}

export type DataOrigin = 'live' | 'cache' | 'stale-cache';

export interface FetchEnvelope<T> {
  data: T;
  fetchedAt: string;
  origin: DataOrigin;
  sourceUrl: string;
  warning?: string;
}

export interface SourceAttribution {
  sourceName: string;
  datasetName: string;
  period: string;
  fetchedAt?: string;
  sourceUpdated?: string | null;
  units: string;
  method?: string;
  sourceUrl: string;
  secondaryUrl?: string;
  secondaryLabel?: string;
}

export type PageRoute =
  | 'dashboard'
  | 'explorer'
  | 'compare'
  | 'locality'
  | 'socioeconomic'
  | 'methodology'
  | 'about';
