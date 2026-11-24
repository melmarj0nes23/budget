import { FaqItem, NewsItem } from '../types/civic';
import { LAST_VERIFIED_DATE } from './municipalInfo';

export const NEWS_ITEMS: NewsItem[] = [
  {
    id: 'sp-budget-2026-approval',
    title: 'Sangguniang Panlalawigan Declares Alcala CY 2026 Annual Budget (₱260.23M) Operative',
    date: '2026-05-11',
    category: 'Government Announcement',
    originType: 'Official Government Source',
    summary:
      'Provincial Resolution No. 580-2026 declared Alcala’s CY 2026 Annual Budget of ₱260,232,497.00 (Municipal Appropriation Ordinance No. 2025-03) operative in its entirety.',
    details:
      'Approved during the Sangguniang Panlalawigan session on May 11, 2026, the CY 2026 budget includes a ₱234,783,497.00 National Tax Allotment (NTA) share and reiterates compliance with DBM-DOF-DILG Joint Memorandum Circular No. 1 for the 20% Development Fund.',
    citation: {
      sourceTitle: 'Provincial Resolution No. 580-2026 — Sangguniang Panlalawigan of Pangasinan',
      sourceUrl: 'https://www.pangasinan.gov.ph/',
      issuingAgency: 'Province of Pangasinan',
      publicationDate: '2026-05-11',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Verified',
    },
  },
  {
    id: 'sp-budget-2025-approval',
    title: 'Sangguniang Panlalawigan Declares Alcala FY 2025 Annual Budget (₱230.31M) Operative',
    date: '2025-03-03',
    category: 'Government Announcement',
    originType: 'Official Government Source',
    summary:
      'Provincial Resolution No. 319-2025 declared Alcala’s FY 2025 Annual Budget of ₱230,306,279.00 (Municipal Appropriation Ordinance No. 2024-04) operative in its entirety.',
    details:
      'The Sangguniang Panlalawigan of Pangasinan reviewed and affirmed Appropriation Ordinance No. 2024-04 enacted on December 2, 2024, noting that the 20% Development Fund from the National Tax Allotment must adhere to DBM-DOF-DILG Joint Memorandum Circular No. 1.',
    citation: {
      sourceTitle: 'Provincial Resolution No. 319-2025 — Sangguniang Panlalawigan of Pangasinan',
      sourceUrl: 'https://www.pangasinan.gov.ph/',
      issuingAgency: 'Province of Pangasinan',
      publicationDate: '2025-03-03',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Verified',
    },
  },
  {
    id: 'alcala-cctv-ordinance-advisory',
    title: 'Public Advisory: Mandatory CCTV Installation Ordinance for Barangays & Businesses',
    date: '2025-05-01',
    category: 'Public Advisory',
    originType: 'Official Government Source',
    summary:
      'Municipal Ordinance No. 2025-04 requires all 21 barangays and commercial establishments in Alcala to install operational CCTV systems as part of public safety and business compliance.',
    details:
      'Business owners renewing or applying for Mayor’s Permits at the Alcala Business Permits and Licensing Office (BPLO) should verify CCTV camera placement requirements under Municipal Ordinance No. 2025-04.',
    citation: {
      sourceTitle: 'Municipal Ordinance No. 2025-04 (SP Pangasinan Legislative Review)',
      sourceUrl: 'https://www.pangasinan.gov.ph/',
      issuingAgency: 'Sangguniang Bayan of Alcala / SP Pangasinan',
      publicationDate: '2025-05-01',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Verified',
    },
  },
  {
    id: 'local-employment-priority-ord',
    title: 'Community Program Notice: Local Resident Employment Priority in Alcala Projects',
    date: '2025-06-01',
    category: 'Community Program',
    originType: 'Official Government Source',
    summary:
      'Municipal Ordinance No. 2025-06 mandates contractors and private projects operating in Alcala to prioritize qualified local residents.',
    details:
      'Jobseekers residing in any of Alcala’s 21 barangays are encouraged to register with the Public Employment Service Office (PESO) and secure a Barangay Residency Certificate for project hiring referrals.',
    citation: {
      sourceTitle: 'Municipal Ordinance No. 2025-06 (SP Pangasinan Legislative Review)',
      sourceUrl: 'https://www.pangasinan.gov.ph/',
      issuingAgency: 'Sangguniang Bayan of Alcala / SP Pangasinan',
      publicationDate: '2025-06-01',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Verified',
    },
  },
  {
    id: 'psa-2024-popcen-release',
    title: '2024 Census Update: Alcala Population Reaches 49,479 Residents',
    date: '2025-07-01',
    category: 'Public Consultation',
    originType: 'Independently Compiled Civic Summary',
    summary:
      'PSA 2024 Census of Population (POPCEN) places Alcala, Pangasinan at 49,479 residents across 21 barangays, up from 48,908 in 2020.',
    details:
      'While municipal-level 2024 POPCEN totals are confirmed, individual 2024 barangay breakdowns remain partially released; BetterAlcala continues to display the verified 2020 PSA Census baseline for all 21 barangays alongside updated 2024 figures where published.',
    citation: {
      sourceTitle: 'Philippine Statistics Authority (PSA) 2024 POPCEN',
      sourceUrl: 'https://psa.gov.ph/',
      issuingAgency: 'Philippine Statistics Authority',
      publicationDate: '2025-07-01',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Verified',
    },
  },
  {
    id: 'business-renewal-statutory-deadline',
    title: 'Annual Statutory Reminder: Business Permit Renewal & Q1 Real Property Tax Deadlines',
    date: '2026-01-05',
    category: 'Deadline',
    originType: 'Independently Compiled Civic Summary',
    summary:
      'Under the Local Government Code (RA 7160), annual business permit renewals and first-quarter Real Property Tax payments fall due every January 20 and March 31 respectively.',
    details:
      'Residents and business owners in Alcala should confirm exact local BOSS schedule extensions directly with the Municipal Treasurer or BPLO at (075) 632-5938.',
    citation: {
      sourceTitle: 'Republic Act No. 7160 (Local Government Code of 1991)',
      sourceUrl: 'https://blgf.gov.ph/',
      issuingAgency: 'BLGF / DILG Statutory Schedule',
      publicationDate: '2026-01-05',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Needs Review',
      notes: 'Statutory national deadline shown; confirm any LGU Alcala Sangguniang Bayan grace period resolutions.',
    },
  },
  {
    id: 'agno-river-flood-preparedness',
    title: 'Emergency Preparedness Notice: Agno River Monitoring & Ambulance Guidelines',
    date: '2026-02-15',
    category: 'Emergency Notice',
    originType: 'Independently Compiled Civic Summary',
    summary:
      'Keep verified Alcala MPS ((075) 593-2829), Alcala RHU ((075) 593-4992), and National 911 saved for monsoon or Agno River flood advisories.',
    details:
      'Municipal Ordinance No. 2026-05 also establishes formal policies and guidelines for ambulance and patient transport use across Alcala’s 21 barangays.',
    citation: {
      sourceTitle: 'Alcala Emergency Contact Directory & Municipal Ordinance No. 2026-05',
      sourceUrl: 'https://ndrrmc.gov.ph/',
      issuingAgency: 'PNP / DOH / SP Pangasinan',
      publicationDate: '2026-02-15',
      lastVerified: LAST_VERIFIED_DATE,
      verificationStatus: 'Verified',
    },
  },
];

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: 'faq-official',
    category: 'General',
    question: 'Is BetterAlcala the official website of the Municipality of Alcala?',
    answer:
      'No. BetterAlcala is an independent, community-driven civic technology project developed under the BetterGov.ph BetterLGU initiative. It compiles public records from authoritative government agencies to make municipal services and transparency data easier for residents of Alcala, Pangasinan to find.',
  },
  {
    id: 'faq-verification',
    category: 'Transparency & Data',
    question: 'What do the "Verified", "Needs Review", and "Unavailable" labels mean?',
    answer:
      'Accuracy is prioritized over completeness. "Verified" indicates information confirmed from official government records (PSA, PSGC, Sangguniang Panlalawigan of Pangasinan, DPWH, PNP, DOH, DTI). "Needs Review" flags items where statutory frameworks are known but local municipal documents (such as Alcala’s updated Citizen’s Charter fee schedule or BLGF quarterly SRE) have not yet been published online. "Unavailable" marks documents not currently downloadable online.',
  },
  {
    id: 'faq-hours',
    category: 'General',
    question: 'Where is Alcala Municipal Hall located and what are its office hours?',
    answer:
      'Alcala Municipal Hall is located along the Santo Tomas–Alcala Highway (National Road), Poblacion East, Alcala, 2425 Pangasinan. Standard municipal office hours are Monday to Friday, 8:00 AM to 5:00 PM. You can reach the Municipal Hall trunklines at (075) 632-5938, (075) 593-3012, or (075) 593-3803.',
  },
  {
    id: 'faq-civil-registry',
    category: 'Services & Certificates',
    question: 'How do I request a Birth, Marriage, or Death Certificate in Alcala?',
    answer:
      'Visit the Office of the Municipal Civil Registrar (MCR) at the Municipal Hall Compound in Poblacion East with a valid government ID and details of the record. If you are not the registrant or parent, bring a signed authorization letter. Exact municipal copy fees should be confirmed at the MCR/Treasury window.',
  },
  {
    id: 'faq-senior-pwd',
    category: 'Services & Certificates',
    question: 'Are there fees for Senior Citizen, PWD, or Solo Parent IDs?',
    answer:
      'No. Under Republic Acts 9994 (Senior Citizens), 10754 (PWDs), and 11861 (Solo Parents), issuance of these identification cards through MSWDO/OSCA/PDAO is free of charge (₱0.00).',
  },
  {
    id: 'faq-business',
    category: 'Business & Taxes',
    question: 'What new local compliance rule applies to business permits in Alcala?',
    answer:
      'Under Municipal Ordinance No. 2025-04 (reviewed by the Sangguniang Panlalawigan of Pangasinan), commercial and business establishments and all 21 barangays in Alcala are required to install Closed-Circuit Television (CCTV) systems.',
  },
  {
    id: 'faq-budget',
    category: 'Transparency & Data',
    question: 'Why are Obligations and Disbursements marked "Needs Review" on the Budget page?',
    answer:
      'While Alcala’s Approved Annual Budgets (₱260,232,497.00 for FY 2026, ₱230,306,279.00 for FY 2025, and ₱193,594,983.00 for FY 2024) are verified via Sangguniang Panlalawigan resolutions, the municipal-level Statement of Receipts and Expenditures (SRE) breakdown of obligations and actual disbursements is not fabricated when not publicly downloadable; it remains labeled Needs Review until official BLGF eSRE / Budget Office files are verified.',
  },
  {
    id: 'faq-offline',
    category: 'Technical & Platform',
    question: 'Can I use BetterAlcala offline on my phone?',
    answer:
      'Yes. BetterAlcala is a Progressive Web App (PWA). Once visited, core pages, service guides, and verified emergency hotline numbers remain accessible offline, and you can install the app directly to your phone’s home screen.',
  },
];

export const ALCALA_QUIZ_QUESTIONS = [
  {
    question: 'What was the original name of Alcala before it separated from Bayambang in 1875?',
    options: ['Barrio Dangla', 'San Pedro Ili', 'Pindangan', 'Villa Alcala'],
    correctIndex: 0,
    explanation: 'Alcala was originally Barrio Dangla of Bayambang, named after a native medicinal shrub.',
  },
  {
    question: 'On what date was Alcala formally established as an independent municipality via Royal Decree No. 682?',
    options: ['May 1, 1881', 'September 20, 1875', 'April 1, 1873', 'June 12, 1898'],
    correctIndex: 1,
    explanation: 'Royal Decree No. 682 granted Alcala’s separation from Bayambang on September 20, 1875.',
  },
  {
    question: 'How many official barangays compose the Municipality of Alcala according to PSGC?',
    options: ['18 barangays', '21 barangays', '22 barangays', '25 barangays'],
    correctIndex: 1,
    explanation: 'Alcala, Pangasinan consists of 21 official barangays under PSGC code 0105504000.',
  },
  {
    question: 'Which major river system shapes Alcala’s geography and flood control infrastructure?',
    options: ['Cagayan River', 'Agno River', 'Pampanga River', 'Bued River'],
    correctIndex: 1,
    explanation: 'The Agno River basin passes through Alcala and underpins both agricultural irrigation and DPWH flood control works.',
  },
  {
    question: 'What annual cultural festival celebrates Alcala’s founding anniversary every September?',
    options: ['Bangus Festival', 'Turak Festival', 'Panagbenga Festival', 'Binungey Festival'],
    correctIndex: 1,
    explanation: 'Alcala celebrates its founding anniversary on September 20 alongside the Turak Festival.',
  },
];
