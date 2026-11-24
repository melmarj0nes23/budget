export type VerificationStatus = 'Verified' | 'Needs Review' | 'Outdated' | 'Unavailable';

export interface SourceCitation {
  sourceTitle: string;
  sourceUrl: string;
  issuingAgency: string;
  publicationDate: string;
  lastVerified: string;
  verificationStatus: VerificationStatus;
  notes?: string;
}

export interface OfficialRecord {
  id: string;
  name: string;
  title: string;
  branch: 'Executive' | 'Legislative' | 'Ex-Officio';
  term: string;
  committees?: string[];
  email?: string;
  phone?: string;
  officeHours?: string;
  citation: SourceCitation;
}

export interface MunicipalOffice {
  id: string;
  name: string;
  headName: string;
  headVerification: VerificationStatus;
  description: string;
  responsibilities: string[];
  address: string;
  phone: string[];
  email?: string;
  officeHours: string;
  citation: SourceCitation;
}

export interface BarangayRecord {
  name: string;
  psgcCode: string;
  population2020: number;
  population2024?: number;
  classification?: 'Urban' | 'Rural';
  punongBarangay?: string;
  contactNumber?: string;
  phones?: string[];
  phoneNote?: string;
  citation: SourceCitation;
}

export interface ServiceCategoryInfo {
  id: string;
  title: string;
  shortTitle: string;
  description: string;
  icon: string;
}

export interface ServiceProcessStep {
  step: number;
  title: string;
  description: string;
}

export interface ServiceRecord {
  id: string;
  title: string;
  category: string;
  categoryId: string;
  icon: string;
  description: string;
  keywords: string[];
  eligibility: string[];
  requirements: string[];
  steps: ServiceProcessStep[];
  processingTime: string;
  processingTimeStatus: VerificationStatus;
  fees: string;
  feesStatus: VerificationStatus;
  office: string;
  officeAddress: string;
  officePhones: string[];
  officeEmail?: string;
  officeHours: string;
  downloadableForms: {
    label: string;
    url?: string;
    status: VerificationStatus;
    note?: string;
  }[];
  citation: SourceCitation;
}

export interface OrdinanceRecord {
  ordinanceNo: string;
  title: string;
  sessionDate: string;
  spResolutionRef?: string;
  category: string;
  summary: string;
  documentUrl?: string;
  citation: SourceCitation;
}

export interface ResolutionRecord {
  resolutionNo: string;
  title: string;
  approvalDate: string;
  issuingBody: string;
  category: string;
  summary: string;
  documentUrl?: string;
  citation: SourceCitation;
}

export interface BudgetYearRecord {
  fiscalYear: number;
  appropriationOrdinance: string;
  spResolution: string;
  approvedDate: string;
  approvedBudget: number;
  obligations: number | null;
  disbursements: number | null;
  actualExpenditures: number | null;
  ntaShareNote: string;
  developmentFundNote: string;
  sreStatus: VerificationStatus;
  citation: SourceCitation;
}

export interface InfrastructureProject {
  id: string;
  name: string;
  location: string;
  barangay: string;
  category: string;
  implementingAgency: string;
  fundingSource: string;
  contractor: string;
  abcAmount?: number;
  contractCost?: number;
  statusLabel: string;
  progressPercent?: number;
  projectDate: string;
  documentUrl?: string;
  citation: SourceCitation;
}

export interface NewsItem {
  id: string;
  title: string;
  date: string;
  category: 'Government Announcement' | 'Public Advisory' | 'Community Program' | 'Public Consultation' | 'Deadline' | 'Emergency Notice';
  originType: 'Official Government Source' | 'Independently Compiled Civic Summary';
  summary: string;
  details: string;
  citation: SourceCitation;
}

export type EmergencyContactCategory =
  | 'Police'
  | 'Health & Medical'
  | 'Disaster & Rescue'
  | 'Fire Protection'
  | 'Social Welfare & Assistance'
  | 'Private / Public Utilities'
  | 'National / Provincial Escalation';

export interface EmergencyContact {
  id: string;
  office: string;
  category: EmergencyContactCategory;
  phones: string[];
  phoneNote?: string;
  email?: string;
  address: string;
  hours: string;
  citation: SourceCitation;
}

export interface FaqItem {
  id: string;
  category: 'General' | 'Services & Certificates' | 'Business & Taxes' | 'Transparency & Data' | 'Technical & Platform';
  question: string;
  answer: string;
}
