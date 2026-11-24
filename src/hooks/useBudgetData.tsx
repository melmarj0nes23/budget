import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { budgetApi } from '../services/budgetApi';
import { statisticsApi } from '../services/statisticsApi';
import type {
  DataOrigin,
  GaaDepartment,
  GaaNationalYear,
  NepDepartment,
  NepRollupItem,
} from '../types/budget';

export interface CoreBudgetState {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  warning: string | null;
  origin: DataOrigin | null;
  fetchedAt: string | null;
  gaaYears: number[];
  gaaNational: GaaNationalYear[];
  gaaDepartments: GaaDepartment[];
  nepOverview: {
    fiscalYear: number;
    baselineYear: number;
    generatedAt: string | null;
    national: {
      line_items: number;
      amount: number;
      base_amount: number;
      delta: number;
      pct: number;
    };
    departments: NepDepartment[];
  } | null;
  nepExpenseClasses: NepRollupItem[];
  nepRegions: NepRollupItem[];
  nepRegionsLoading: boolean;
  nepRegionsError: string | null;
  nepRegionsFetchedAt: string | null;
  refreshAll: () => Promise<void>;
  loadNepRegions: (force?: boolean) => Promise<void>;
}

const BudgetDataContext = createContext<CoreBudgetState | null>(null);

export function BudgetDataProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [origin, setOrigin] = useState<DataOrigin | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);

  const [gaaYears, setGaaYears] = useState<number[]>([]);
  const [gaaNational, setGaaNational] = useState<GaaNationalYear[]>([]);
  const [gaaDepartments, setGaaDepartments] = useState<GaaDepartment[]>([]);
  const [nepOverview, setNepOverview] = useState<CoreBudgetState['nepOverview']>(null);
  const [nepExpenseClasses, setNepExpenseClasses] = useState<NepRollupItem[]>([]);

  const [nepRegions, setNepRegions] = useState<NepRollupItem[]>([]);
  const [nepRegionsLoading, setNepRegionsLoading] = useState(false);
  const [nepRegionsError, setNepRegionsError] = useState<string | null>(null);
  const [nepRegionsFetchedAt, setNepRegionsFetchedAt] = useState<string | null>(null);

  const loadCore = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    setWarning(null);

    try {
      // Load primary GAA totals & departments first (only 2 lightweight calls cover 2020–2026)
      const [gaaNatRes, gaaDeptRes] = await Promise.all([
        budgetApi.getGaaNational(forceRefresh),
        budgetApi.getGaaDepartments(forceRefresh),
      ]);

      setGaaYears(gaaNatRes.data.meta.years || []);
      setGaaNational(gaaNatRes.data.data || []);
      setGaaDepartments(gaaDeptRes.data.data || []);
      setFetchedAt(gaaDeptRes.fetchedAt);
      setOrigin(gaaDeptRes.origin);

      const warnings: string[] = [];
      if (gaaNatRes.warning) warnings.push(gaaNatRes.warning);
      if (gaaDeptRes.warning) warnings.push(gaaDeptRes.warning);

      // Load NEP 2027 overview & expense classes gently afterward to stay well within D1 limits
      try {
        const nepRes = await budgetApi.getNep2027Overview(forceRefresh);
        setNepOverview({
          fiscalYear: nepRes.data.meta.fiscal_year,
          baselineYear: nepRes.data.meta.baseline_year,
          generatedAt: nepRes.data.meta.generated_at ?? null,
          national: nepRes.data.data.national,
          departments: nepRes.data.data.departments || [],
        });
        if (nepRes.warning) warnings.push(nepRes.warning);

        const expRes = await budgetApi.getNep2027Rollup('expense_class', forceRefresh);
        setNepExpenseClasses(expRes.data.data || []);
        if (expRes.warning) warnings.push(expRes.warning);
      } catch (nepErr) {
        warnings.push(
          nepErr instanceof Error
            ? `FY2027 NEP dataset temporarily unavailable (${nepErr.message}). Enacted GAA FY2020–2026 data remains available.`
            : 'FY2027 NEP dataset temporarily unavailable. Enacted GAA FY2020–2026 data remains available.'
        );
      }

      if (warnings.length > 0) {
        setWarning(warnings[0]);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Unable to load national budget data from BetterGovPH.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadNepRegions = useCallback(async (force = false) => {
    if (!force && nepRegions.length > 0) return;
    setNepRegionsLoading(true);
    setNepRegionsError(null);
    try {
      const res = await budgetApi.getNep2027Rollup('region', force);
      setNepRegions(res.data.data || []);
      setNepRegionsFetchedAt(res.fetchedAt);
    } catch (err) {
      setNepRegionsError(
        err instanceof Error ? err.message : 'Unable to load FY2027 NEP regional allocations.'
      );
    } finally {
      setNepRegionsLoading(false);
    }
  }, [nepRegions.length]);

  const refreshAll = useCallback(async () => {
    budgetApi.clearCache();
    statisticsApi.clearCache();
    await loadCore(true);
    if (nepRegions.length > 0) {
      await loadNepRegions(true);
    }
  }, [loadCore, loadNepRegions, nepRegions.length]);

  useEffect(() => {
    void loadCore(false);
  }, [loadCore]);

  return (
    <BudgetDataContext.Provider
      value={{
        loading,
        refreshing,
        error,
        warning,
        origin,
        fetchedAt,
        gaaYears,
        gaaNational,
        gaaDepartments,
        nepOverview,
        nepExpenseClasses,
        nepRegions,
        nepRegionsLoading,
        nepRegionsError,
        nepRegionsFetchedAt,
        refreshAll,
        loadNepRegions,
      }}
    >
      {children}
    </BudgetDataContext.Provider>
  );
}

export function useBudgetData(): CoreBudgetState {
  const ctx = useContext(BudgetDataContext);
  if (!ctx) {
    throw new Error('useBudgetData must be used inside BudgetDataProvider');
  }
  return ctx;
}
