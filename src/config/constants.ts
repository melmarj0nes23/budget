export const API_CONFIG = {
  budgetBaseUrl: 'https://budget.bettergov.ph/api/v1',
  budgetDocsUrl: 'https://budget.bettergov.ph/docs',
  budgetOpenApiUrl: 'https://budget.bettergov.ph/api/v1/openapi.json',
  statsBaseUrl: 'https://statistics.bettergov.ph/api/v1',
  statsClassificationUrl: 'https://statistics.bettergov.ph/api/classification',
  statsDocsUrl: 'https://statistics.bettergov.ph/api',
  openDataPortalUrl: 'https://data.bettergov.ph/',
  psaOpenStatUrl: 'https://openstat.psa.gov.ph/',
} as const;

/**
 * Verified dataset IDs from statistics.bettergov.ph/api/v1/datasets.
 * Each dataset's dimensions, units, and coverage were inspected directly against live responses.
 */
export const VERIFIED_STATS_DATASETS = {
  // Single-year national population projections (2020–2030, based on 2020 CPH). Values reported in THOUSANDS.
  nationalProjectedPopulation: {
    id: '7721a9fbb98bc87084b2',
    unitMultiplier: 1000,
    unitLabel: 'Persons (reported in thousands by PSA OpenSTAT; multiplied by 1,000)',
    sexTotalCode: '0',
    ageTotalCode: '0',
    yearCodeMap: {
      2020: '0',
      2021: '1',
      2022: '2',
      2023: '3',
      2024: '4',
      2025: '5',
      2026: '6',
      2027: '7',
    } as Record<number, string>,
  },
  // Table 2. Annual Per Capita Poverty Threshold & Poverty Incidence Among Population (2018, 2021, 2023), 18 regions including NIR.
  povertyPopulationByRegion: {
    id: 'b4a71a27b4e4189c79a8',
    parameterThresholdCode: '0', // Annual Per Capita Poverty Threshold (in PhP)
    parameterIncidenceCode: '1', // Poverty Incidence among Population (%)
    yearCodes: {
      2018: '0',
      2021: '1',
      2023: '2',
    } as Record<number, string>,
    // Exact verified mapping from 2-digit PSGC/NEP region code to PSA table Geolocation code
    regionToGeoCode: {
      '13': '1', // NCR
      '14': '6', // CAR
      '01': '13', // Region I
      '02': '18', // Region II
      '03': '24', // Region III
      '04': '32', // Region IV-A CALABARZON
      '17': '38', // MIMAROPA
      '05': '44', // Region V Bicol
      '06': '51', // Region VI Western Visayas
      '18': '57', // Negros Island Region (NIR)
      '07': '61', // Region VII Central Visayas
      '08': '64', // Region VIII Eastern Visayas
      '09': '71', // Region IX Zamboanga Peninsula
      '10': '76', // Region X Northern Mindanao
      '11': '82', // Region XI Davao
      '12': '88', // Region XII SOCCSKSARGEN
      '16': '93', // Region XIII Caraga
      '19': '99', // BARMM
    } as Record<string, string>,
    nationalGeoCode: '0',
  },
  // SDG 8.5.2 Unemployment Rate by Region (15 years and above, both sexes, up to 2025, 17-region structure excluding NIR)
  unemploymentByRegion: {
    id: 'b30cbf499f6e55a9d9ea',
    ageAllCode: '0', // 15 years and above
    sexBothCode: '0', // Both sexes
    yearCode2025: '25',
    yearCode2024: '24',
    yearCode2023: '23',
    // Exact verified mapping from 2-digit PSGC/NEP region code to 10-digit PSGC geolocation code
    regionToGeoCode: {
      '13': '1300000000',
      '14': '1400000000',
      '01': '0100000000',
      '02': '0200000000',
      '03': '0300000000',
      '04': '0400000000',
      '17': '1700000000',
      '05': '0500000000',
      '06': '0600000000',
      '07': '0700000000',
      '08': '0800000000',
      '09': '0900000000',
      '10': '1000000000',
      '11': '1100000000',
      '12': '1200000000',
      '16': '1600000000',
      '19': '1900000000',
      // Note: Region 18 (NIR) is not disaggregated in this 17-region SDG table
    } as Record<string, string>,
    nationalGeoCode: '0000000000',
  },
} as const;

export interface FunctionalSectorDef {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  description: string;
  departmentIds: string[];
}

/**
 * Analytical functional grouping of official DBM department codes.
 * Every department code from the BetterGovPH GAA & NEP datasets maps to exactly one group
 * so totals reconcile 100% without double-counting. Documented transparently on the Methodology page.
 */
export const FUNCTIONAL_SECTORS: FunctionalSectorDef[] = [
  {
    id: 'social-services',
    label: 'Social Services & Human Development',
    shortLabel: 'Social Services',
    color: '#26489A',
    description:
      'Education (DepEd, SUCs), Health (DOH), Social Welfare (DSWD), Labor & Migrant Workers (DOLE, DMW), Housing (DHSUD), and Human Rights (CHR).',
    departmentIds: ['07', '08', '13', '20', '16', '40', '39', '34'],
  },
  {
    id: 'economic-services',
    label: 'Economic Services & Infrastructure',
    shortLabel: 'Economic Services',
    color: '#0F766E',
    description:
      'Public Works (DPWH), Transportation (DOTr), Agriculture (DA), Agrarian Reform (DAR), Environment (DENR), Science & Tech (DOST), Trade (DTI), Energy (DOE), Tourism (DOT), ICT (DICT), Economy & Planning (NEDA/DEPDev), and BSGC.',
    departmentIds: ['18', '38', '05', '04-dar', '10', '19', '22', '09', '21', '37', '24', '35'],
  },
  {
    id: 'defense-public-order',
    label: 'Defense, Public Order & Justice',
    shortLabel: 'Defense & Order',
    color: '#334155',
    description:
      'National Defense (DND), Interior & Local Government (DILG), Justice (DOJ), Judiciary (JUD), and Ombudsman (OMB).',
    departmentIds: ['17', '14', '15', '29', '33'],
  },
  {
    id: 'general-public-services',
    label: 'General Public Services & Governance',
    shortLabel: 'General Public Services',
    color: '#64748B',
    description:
      'Congress, Office of the President, OVP, Finance (DOF), Foreign Affairs (DFA), Budget (DBM), COMELEC, COA, CSC, PCO, Other Executive Offices, ALGU, and JLEC.',
    departmentIds: ['01', '02', '03', '06', '11', '12', '25', '26', '28', '30', '31', '32', '36'],
  },
  {
    id: 'automatic-special-funds',
    label: 'Automatic Appropriations & Special Purpose Funds',
    shortLabel: 'Automatic & SPF',
    color: '#B45309',
    description:
      'Automatic Appropriations (debt service interest, National Tax Allotment to LGUs, statutory funds) and Special Purpose Funds (SPF).',
    departmentIds: ['04', 'AUTO', 'SPF'],
  },
];

/**
 * Resolves a department ID into its functional sector ID.
 * Handles the verified structural difference where code "04" is Automatic Appropriations in GAA
 * while NEP FY2027 uses "AUTO" for Automatic Appropriations and "04" for Department of Agrarian Reform (DAR).
 */
export function resolveSectorId(deptId: string, stage: 'gaa' | 'nep'): string {
  if (stage === 'nep' && deptId === '04') {
    return 'economic-services'; // DAR in NEP FY2027
  }
  const found = FUNCTIONAL_SECTORS.find((s) => s.departmentIds.includes(deptId));
  return found ? found.id : 'general-public-services';
}

export const BUDGET_GLOSSARY: Record<string, { term: string; definition: string }> = {
  GAA: {
    term: 'General Appropriations Act (GAA)',
    definition:
      'The enacted annual national budget law approved by Congress and signed by the President. GAA figures represent legal spending ceilings (appropriations), not actual cash disbursed.',
  },
  NEP: {
    term: 'National Expenditure Program (NEP)',
    definition:
      'The executive branch budget proposal submitted by the President through the DBM to Congress. It is a proposal subject to legislative amendment and must not be conflated with an enacted GAA.',
  },
  'Automatic Appropriations': {
    term: 'Automatic Appropriations',
    definition:
      'Recurring expenditures authorized by standing laws rather than annual congressional enactments, including debt interest payments, the National Tax Allotment (NTA) for local governments, and retirement/life insurance premiums.',
  },
  SPF: {
    term: 'Special Purpose Funds (SPF)',
    definition:
      'Lump-sum funds reserved for cross-agency or contingent purposes (such as Calamity Fund, Contingent Fund, Pension and Gratuity Fund, and Budgetary Support to GOCCs) that are released during the year upon meeting statutory criteria.',
  },
  PS: {
    term: 'Personnel Services (PS)',
    definition:
      'Allocations for salaries, wages, allowances, and benefits of permanent and non-permanent government employees.',
  },
  MOOE: {
    term: 'Maintenance and Other Operating Expenses (MOOE)',
    definition:
      'Day-to-day operational costs of government agencies, including supplies, utilities, subsidies, financial assistance programs, and service contracts.',
  },
  CO: {
    term: 'Capital Outlays (CO)',
    definition:
      'Allocations for goods and services whose benefits extend beyond the fiscal year, such as roads, hospitals, school buildings, equipment, and land.',
  },
  FinEx: {
    term: 'Financial Expenses (FinEx)',
    definition:
      'Interest payments on domestic and foreign public debt, bank charges, and other debt-related financing costs.',
  },
  'Appropriation vs Disbursement': {
    term: 'Appropriation vs. Disbursement',
    definition:
      'An appropriation is the legal ceiling authorized in the budget. Actual spending follows subsequent steps: Allotment (DBM release), Obligation (contract commitment), and Disbursement (actual cash paid).',
  },
};

export const REGION_SHORT_NAMES: Record<string, string> = {
  '00': 'Central Office (Nationwide)',
  '13': 'NCR',
  '14': 'CAR',
  '01': 'Region I (Ilocos)',
  '02': 'Region II (Cagayan Valley)',
  '03': 'Region III (Central Luzon)',
  '04': 'Region IV-A (CALABARZON)',
  '17': 'MIMAROPA',
  '05': 'Region V (Bicol)',
  '06': 'Region VI (Western Visayas)',
  '18': 'NIR (Negros Island)',
  '07': 'Region VII (Central Visayas)',
  '08': 'Region VIII (Eastern Visayas)',
  '09': 'Region IX (Zamboanga Pen.)',
  '10': 'Region X (Northern Mindanao)',
  '11': 'Region XI (Davao)',
  '12': 'Region XII (SOCCSKSARGEN)',
  '16': 'Region XIII (Caraga)',
  '19': 'BARMM',
};

/** Exact verified mapping from 2-digit PSGC/NEP region code to HGAB 2027 API region_key */
export const REGION_TO_HGAB_KEY: Record<string, string> = {
  '01': 'I',
  '02': 'II',
  '03': 'III',
  '04': 'IV-A',
  '05': 'V',
  '06': 'VI',
  '07': 'VII',
  '08': 'VIII',
  '09': 'IX',
  '10': 'X',
  '11': 'XI',
  '12': 'XII',
  '13': 'NCR',
  '14': 'CAR',
  '16': 'XIII',
  '17': 'MIMAROPA',
  '18': 'NIR',
  '19': 'BARMM',
};

/** Official PSA NCR District groupings used in PSA Table 2 Poverty Statistics */
export const NCR_CITY_TO_PSA_DISTRICT: Record<string, string> = {
  manila: '1st district',
  mandaluyong: '2nd district',
  marikina: '2nd district',
  pasig: '2nd district',
  'quezon city': '2nd district',
  quezon: '2nd district',
  'san juan': '2nd district',
  caloocan: '3rd district',
  malabon: '3rd district',
  navotas: '3rd district',
  valenzuela: '3rd district',
  'las pinas': '4th district',
  makati: '4th district',
  muntinlupa: '4th district',
  paranaque: '4th district',
  pasay: '4th district',
  pateros: '4th district',
  taguig: '4th district',
};

/**
 * Parent province reference for Highly Urbanized Cities (HUCs) / Independent Cities
 * when PSA Table 2 poverty statistics report the HUC together with its geographic province.
 */
export const HUC_TO_PARENT_PROVINCE: Record<string, string> = {
  baguio: 'benguet',
  angeles: 'pampanga',
  olongapo: 'zambales',
  lucena: 'quezon',
  'puerto princesa': 'palawan',
  iloilo: 'iloilo',
  bacolod: 'negros occidental',
  cebu: 'cebu',
  'lapu lapu': 'cebu',
  mandaue: 'cebu',
  tacloban: 'leyte',
  zamboanga: 'zamboanga del sur',
  isabela: 'basilan',
  'cagayan de oro': 'misamis oriental',
  iligan: 'lanao del norte',
  davao: 'davao del sur',
  'general santos': 'south cotabato',
  butuan: 'agusan del norte',
};
