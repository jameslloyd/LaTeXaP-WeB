import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Cloud,
  CloudOff,
  Gauge,
  ShieldCheck,
} from 'lucide-react';
import type {
  AcademicDocumentStats,
  AcademicPreflightReport,
  LaTeXDiagnostic,
  ProjectSyncState,
  RubricTargetConfig,
  StorageStatusInfo,
} from '@shared/types';
import { RubricTargetsPopover } from '../academic/RubricTargetsPopover';

export interface StatusBarProps {
  diagnostics: LaTeXDiagnostic[];
  preflightReport: AcademicPreflightReport;
  academicStats: AcademicDocumentStats;
  rubricTargets: RubricTargetConfig;
  syncState: ProjectSyncState;
  storageStatus: StorageStatusInfo | null;
  onToggleDiagnostics: () => void;
  onOpenPreflight: () => void;
  onOpenHistory: () => void;
  onUpdateRubricTargets: (targets: RubricTargetConfig) => Promise<void>;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  diagnostics,
  preflightReport,
  academicStats,
  rubricTargets,
  syncState,
  storageStatus,
  onToggleDiagnostics,
  onOpenPreflight,
  onOpenHistory,
  onUpdateRubricTargets,
}) => {
  const [rubricOpen, setRubricOpen] = useState(false);
  const rubricContainerRef = useRef<HTMLDivElement | null>(null);

  const errorCount = diagnostics.filter((d) => d.severity === 'Error').length;
  const warningCount = diagnostics.filter((d) => d.severity === 'Warning').length;
  const preflightCount = preflightReport.items.filter((i) => i.severity !== 'pass').length;

  // Rubric budget threshold status (always paired with icon + text)
  const targetWords = rubricTargets.targetProseWords;
  const maxPages = rubricTargets.maxPageCount;
  let budgetTone: 'neutral' | 'success' | 'warning' | 'danger' = 'neutral';
  if (
    (targetWords && academicStats.proseWordCount > targetWords) ||
    (maxPages && academicStats.pageCount > maxPages)
  ) {
    budgetTone = 'danger';
  } else if (
    (targetWords && academicStats.proseWordCount >= targetWords * 0.9) ||
    (maxPages && academicStats.pageCount >= maxPages)
  ) {
    budgetTone = 'warning';
  } else if (targetWords || maxPages) {
    budgetTone = 'success';
  }

  const budgetLabel = targetWords
    ? `${academicStats.proseWordCount.toLocaleString()} / ${targetWords.toLocaleString()} words`
    : `${academicStats.proseWordCount.toLocaleString()} words`;
  const pageBudgetLabel = maxPages
    ? `${academicStats.pageCount}/${maxPages}p`
    : `${academicStats.pageCount}p`;

  return (
    <footer role="contentinfo" aria-label="Document status and word budgets" className="status-bar">
      <div className="status-bar__group">
        <button
          type="button"
          className="status-bar__btn"
          onClick={onToggleDiagnostics}
          aria-label={`${errorCount} errors and ${warningCount} warnings. Click to toggle diagnostics drawer.`}
        >
          <AlertCircle
            size={12}
            color={errorCount > 0 ? 'var(--danger-text)' : 'var(--text-muted)'}
            aria-hidden="true"
          />
          <span>{errorCount} Errors</span>
          <span>•</span>
          <AlertTriangle
            size={12}
            color={warningCount > 0 ? 'var(--warning-text)' : 'var(--text-muted)'}
            aria-hidden="true"
          />
          <span>{warningCount} Warnings</span>
        </button>

        <button
          type="button"
          className="status-bar__btn"
          onClick={onOpenPreflight}
        >
          {preflightCount === 0 ? (
            <>
              <ShieldCheck size={12} color="var(--success-text)" aria-hidden="true" />
              <span>Pre-Flight Ready</span>
            </>
          ) : (
            <>
              <AlertTriangle size={12} color="var(--warning-text)" aria-hidden="true" />
              <span>Pre-Flight: {preflightCount}</span>
            </>
          )}
        </button>
      </div>

      <div className="status-bar__group">
        <button type="button" className="status-bar__btn" onClick={onOpenHistory} title="Open Version History">
          {storageStatus?.storageDriver === 'b2' && syncState === 'saved' ? (
            <>
              <Cloud size={12} color="var(--success-text)" aria-hidden="true" />
              <span>B2 Synced</span>
            </>
          ) : (
            <>
              <CloudOff size={12} aria-hidden="true" />
              <span>{storageStatus?.storageDriver === 'b2' ? syncState : 'Local Fallback'}</span>
            </>
          )}
        </button>

        <div ref={rubricContainerRef} style={{ position: 'relative' }}>
          <button
            type="button"
            className="status-bar__btn"
            aria-expanded={rubricOpen}
            onClick={() => setRubricOpen((prev) => !prev)}
            style={{
              color:
                budgetTone === 'danger'
                  ? 'var(--danger-text)'
                  : budgetTone === 'warning'
                    ? 'var(--warning-text)'
                    : budgetTone === 'success'
                      ? 'var(--success-text)'
                      : 'inherit',
              fontWeight: 600,
            }}
          >
            {budgetTone === 'danger' ? (
              <AlertCircle size={12} aria-hidden="true" />
            ) : budgetTone === 'success' ? (
              <CheckCircle2 size={12} aria-hidden="true" />
            ) : (
              <Gauge size={12} aria-hidden="true" />
            )}
            <span>
              {budgetLabel} • {pageBudgetLabel}
            </span>
          </button>

          <RubricTargetsPopover
            open={rubricOpen}
            stats={academicStats}
            targets={rubricTargets}
            onClose={() => setRubricOpen(false)}
            onSaveTargets={onUpdateRubricTargets}
          />
        </div>

        <span>{academicStats.mathBlockCount} math</span>

        {!rubricTargets.studentModeHideExpl3 && <span>{academicStats.expl3SymbolCount} expl3</span>}

        <span style={{ color: 'var(--text-muted)' }}>Engine: Browser WASM (LaTeX3 + SyncTeX)</span>
      </div>
    </footer>
  );
};
