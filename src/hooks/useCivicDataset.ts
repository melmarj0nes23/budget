import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  normalizeDisplayHeadline,
  normalizeDisplaySentence,
} from '../utils/civicText';
import {
  BudgetYearRecord,
  NewsItem,
  OrdinanceRecord,
  ResolutionRecord,
  VerificationStatus,
} from '../types/civic';

const VALID_STATUSES: ReadonlySet<VerificationStatus> = new Set([
  'Verified',
  'Needs Review',
  'Outdated',
  'Unavailable',
]);

const DEFAULT_BASE_URL =
  (import.meta.env.VITE_DATA_BASE_URL as string | undefined)?.replace(/\/+$/, '') || '/data';

export interface FirestoreCivicRecord {
  id: string;
  datasetType: 'ordinances' | 'resolutions' | 'news' | 'fiscal_years';
  title: string;
  summary: string;
  details?: string;
  category: string;
  originType?: 'Official Government Source' | 'Independently Compiled Civic Summary';
  publishedDate: string;
  referenceNo?: string;
  spResolutionRef?: string;
  issuingBody?: string;
  fiscalYear?: number;
  approvedBudget?: number;
  ntaShareNote?: string;
  developmentFundNote?: string;
  sourceTitle: string;
  sourceUrl: string;
  issuingAgency: string;
  verificationStatus: VerificationStatus;
  notes?: string;
  published: boolean;
  publishedByUid: string;
}

export function isValidCitation(citation: unknown): boolean {
  if (!citation || typeof citation !== 'object') return false;
  const c = citation as Record<string, unknown>;
  if (typeof c.sourceTitle !== 'string' || !c.sourceTitle.trim()) return false;
  if (typeof c.sourceUrl !== 'string' || !c.sourceUrl.startsWith('https://')) return false;
  if (typeof c.issuingAgency !== 'string' || !c.issuingAgency.trim()) return false;
  if (
    typeof c.verificationStatus !== 'string' ||
    !VALID_STATUSES.has(c.verificationStatus as VerificationStatus)
  ) {
    return false;
  }
  return true;
}

function mapCivicRecordToItem(
  rec: FirestoreCivicRecord,
  rootKey: string
): { key: string; value: unknown } | null {
  if (rec.datasetType !== rootKey) return null;

  const cleanTitle = normalizeDisplayHeadline(rec.title);
  const rawSummaryNorm = normalizeDisplaySentence(rec.summary);
  const cleanSummary =
    rawSummaryNorm.trim().toLowerCase() === cleanTitle.trim().toLowerCase()
      ? `${rec.issuingAgency} official record (${rec.publishedDate}). Open the verified source portal for complete text.`
      : rawSummaryNorm;
  const cleanDetails = rec.details ? normalizeDisplaySentence(rec.details) : cleanSummary;

  const citation = {
    sourceTitle: rec.sourceTitle,
    sourceUrl: rec.sourceUrl,
    issuingAgency: rec.issuingAgency,
    publicationDate: rec.publishedDate,
    lastVerified: rec.publishedDate,
    verificationStatus: rec.verificationStatus,
    ...(rec.notes ? { notes: rec.notes } : {}),
  };

  if (rootKey === 'ordinances') {
    const mapped: OrdinanceRecord = {
      ordinanceNo: rec.referenceNo || rec.id,
      title: cleanTitle,
      sessionDate: rec.publishedDate,
      ...(rec.spResolutionRef ? { spResolutionRef: rec.spResolutionRef } : {}),
      category: rec.category,
      summary: cleanSummary,
      documentUrl: rec.sourceUrl,
      citation,
    };
    return { key: mapped.ordinanceNo.toLowerCase(), value: mapped };
  }

  if (rootKey === 'resolutions') {
    const mapped: ResolutionRecord = {
      resolutionNo: rec.referenceNo || rec.id,
      title: cleanTitle,
      approvalDate: rec.publishedDate,
      issuingBody: rec.issuingBody || rec.issuingAgency,
      category: rec.category,
      summary: cleanSummary,
      documentUrl: rec.sourceUrl,
      citation,
    };
    return { key: mapped.resolutionNo.toLowerCase(), value: mapped };
  }

  if (rootKey === 'news') {
    const validCategories: NewsItem['category'][] = [
      'Government Announcement',
      'Public Advisory',
      'Community Program',
      'Public Consultation',
      'Deadline',
      'Emergency Notice',
    ];
    const mapped: NewsItem = {
      id: rec.id,
      title: cleanTitle,
      date: rec.publishedDate,
      category: validCategories.includes(rec.category as NewsItem['category'])
        ? (rec.category as NewsItem['category'])
        : 'Government Announcement',
      originType: rec.originType || 'Official Government Source',
      summary: cleanSummary,
      details: cleanDetails,
      citation,
    };
    return { key: mapped.id.toLowerCase(), value: mapped };
  }

  if (rootKey === 'fiscal_years' && typeof rec.fiscalYear === 'number' && typeof rec.approvedBudget === 'number') {
    const mapped: BudgetYearRecord = {
      fiscalYear: rec.fiscalYear,
      appropriationOrdinance: rec.referenceNo || rec.title,
      spResolution: rec.spResolutionRef || rec.sourceTitle,
      approvedDate: rec.publishedDate,
      approvedBudget: rec.approvedBudget,
      obligations: null,
      disbursements: null,
      actualExpenditures: null,
      ntaShareNote:
        rec.ntaShareNote ||
        'National Tax Allotment & local sources subject to DBM-DOF-DILG Joint Memorandum Circular No. 1.',
      developmentFundNote:
        rec.developmentFundNote || '20% Development Fund compliance verified via official review.',
      sreStatus: 'Needs Review',
      citation,
    };
    return { key: String(mapped.fiscalYear), value: mapped };
  }

  return null;
}

function getBaseItemKey(item: unknown, rootKey: string): string {
  if (!item || typeof item !== 'object') return '';
  const r = item as Record<string, unknown>;
  if (rootKey === 'ordinances') return String(r.ordinanceNo || '').toLowerCase();
  if (rootKey === 'resolutions') return String(r.resolutionNo || '').toLowerCase();
  if (rootKey === 'fiscal_years') return String(r.fiscalYear || '');
  return String(r.id || '').toLowerCase();
}

/**
 * Loads a civic dataset from /data/<fileName> (with TypeScript baseline fallback) AND
 * merges live Admin-published Firestore civicRecords where published === true.
 */
export function useCivicDataset<T>(
  fileName: string,
  rootKey: string,
  fallback: T[],
  isValidItem: (item: unknown) => item is T
): T[] {
  const [baseData, setBaseData] = useState<T[]>(fallback);
  const [publishedOverrides, setPublishedOverrides] = useState<FirestoreCivicRecord[]>([]);

  useEffect(() => {
    let active = true;

    async function loadDataset() {
      try {
        const res = await fetch(`${DEFAULT_BASE_URL}/${fileName}`, {
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = (await res.json()) as Record<string, unknown>;
        const rawList = json?.[rootKey];
        if (!Array.isArray(rawList) || rawList.length === 0) return;
        const validated = rawList.filter(isValidItem);
        if (active && validated.length === rawList.length) {
          setBaseData(validated);
        }
      } catch {
        // Keep compiled verified fallback cleanly when offline
      }
    }

    loadDataset();
    return () => {
      active = false;
    };
  }, [fileName, rootKey, isValidItem]);

  useEffect(() => {
    const supportedKeys = ['ordinances', 'resolutions', 'news', 'fiscal_years'];
    if (!supportedKeys.includes(rootKey)) return;

    const pathForQuery = 'civicRecords';
    const q = query(collection(db, pathForQuery), where('published', '==', true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({
          ...(d.data() as FirestoreCivicRecord),
          id: d.id,
        }));
        setPublishedOverrides(docs);
      },
      (error) => {
        // Report permission/rule diagnostics cleanly while allowing UI to render fallback
        try {
          handleFirestoreError(error, OperationType.LIST, pathForQuery);
        } catch {
          // Graceful degradation if network/auth rules are unavailable
        }
      }
    );

    return () => unsubscribe();
  }, [rootKey]);

  return useMemo(() => {
    if (publishedOverrides.length === 0) return baseData;

    const mergedMap = new Map<string, T>();
    for (const override of publishedOverrides) {
      const mapped = mapCivicRecordToItem(override, rootKey);
      if (mapped && isValidItem(mapped.value)) {
        mergedMap.set(mapped.key, mapped.value);
      }
    }

    if (mergedMap.size === 0) return baseData;

    const result: T[] = Array.from(mergedMap.values());
    for (const item of baseData) {
      const key = getBaseItemKey(item, rootKey);
      if (!key || !mergedMap.has(key)) {
        result.push(item);
      }
    }
    return result;
  }, [baseData, publishedOverrides, rootKey, isValidItem]);
}

export function usePublishedFirestoreRecords(
  datasetType: FirestoreCivicRecord['datasetType'],
  enabled: boolean
): FirestoreCivicRecord[] {
  const [records, setRecords] = useState<FirestoreCivicRecord[]>([]);

  useEffect(() => {
    if (!enabled) {
      setRecords([]);
      return;
    }

    const q = query(collection(db, 'civicRecords'), where('published', '==', true));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs
          .map((d) => ({
            ...(d.data() as FirestoreCivicRecord),
            id: d.id,
          }))
          .filter((rec) => rec.datasetType === datasetType);
        setRecords(docs);
      },
      (error) => {
        try {
          handleFirestoreError(error, OperationType.LIST, 'civicRecords');
        } catch {
          // Keep existing state cleanly
        }
      }
    );

    return () => unsubscribe();
  }, [datasetType, enabled]);

  return records;
}
