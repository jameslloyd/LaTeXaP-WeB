import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Info,
  Wand2,
  X,
} from 'lucide-react';
import type {
  AcademicFixOperation,
  AcademicPreflightReport,
  ContextAdviceItem,
  DemystifiedDiagnostic,
} from '@shared/types';
import { PreflightChecklistView } from '../academic/PreflightChecklistView';
import { ContextAdviceTab } from '../sidebar/ContextAdviceTab';

export type DrawerTabId = 'diagnostics' | 'preflight' | 'transcript' | 'suggestions';

export interface DiagnosticsDrawerProps {
  open: boolean;
  height: number;
  activeTab: DrawerTabId;
  demystifiedDiagnostics: DemystifiedDiagnostic[];
  preflightReport: AcademicPreflightReport;
  texLogText: string;
  contextAdvice: { contextBadge: string; items: ContextAdviceItem[] };
  onSelectTab: (tab: DrawerTabId) => void;
  onClose: () => void;
  onJumpToLine: (line: number) => void;
  onApplyFix: (op: AcademicFixOperation) => void;
  onOpenCitationsTab: () => void;
  onInsertSnippet: (snippet: string) => void;
  onInsertPackage: (pkg: string, opts?: string) => void;
}

export const DiagnosticsDrawer: React.FC<DiagnosticsDrawerProps> = ({
  open,
  height,
  activeTab,
  demystifiedDiagnostics,
  preflightReport,
  texLogText,
  contextAdvice,
  onSelectTab,
  onClose,
  onJumpToLine,
  onApplyFix,
  onOpenCitationsTab,
  onInsertSnippet,
  onInsertPackage,
}) => {
  const [expandedRawIds, setExpandedRawIds] = useState<Record<string, boolean>>({});
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (!open) return null;

  const preflightIssuesCount = preflightReport.items.filter((i) => i.severity !== 'pass').length;
  const tabList: Array<{ id: DrawerTabId; label: string }> = [
    { id: 'diagnostics', label: `Diagnostics (${demystifiedDiagnostics.length})` },
    { id: 'preflight', label: `Pre-Flight (${preflightIssuesCount})` },
    { id: 'transcript', label: 'TeX Transcript' },
    { id: 'suggestions', label: `Context Suggestions (${contextAdvice.items.length})` },
  ];

  const handleTabKeyDown = (idx: number, e: React.KeyboardEvent) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % tabList.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + tabList.length) % tabList.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = tabList.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      onSelectTab(tabList[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <section
      aria-label="Diagnostics and Pre-Flight Drawer"
      className="diagnostics-drawer"
      style={{ height }}
    >
      <div className="drawer-header">
        <div role="tablist" aria-label="Diagnostics Drawer Tabs" className="drawer-tabs">
          {tabList.map((tab, idx) => {
            const selected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                ref={(el) => {
                  tabRefs.current[idx] = el;
                }}
                id={`drawer-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={selected}
                aria-controls={`drawer-panel-${tab.id}`}
                tabIndex={selected ? 0 : -1}
                className="drawer-tab"
                onClick={() => onSelectTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(idx, e)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-icon btn-ghost btn-sm"
          aria-label="Collapse Diagnostics Drawer"
          onClick={onClose}
        >
          <X size={14} aria-hidden="true" />
        </button>
      </div>

      <div
        id={`drawer-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`drawer-tab-${activeTab}`}
        className="drawer-body"
      >
        {activeTab === 'diagnostics' && (
          <div>
            {demystifiedDiagnostics.length === 0 ? (
              <div
                role="status"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: 24,
                  color: 'var(--success-text)',
                  fontWeight: 600,
                }}
              >
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>No errors or warnings reported by Browser WASM TeX compiler.</span>
              </div>
            ) : (
              demystifiedDiagnostics.map((diag) => {
                const isRawOpen = Boolean(expandedRawIds[diag.id]);
                const sevColor =
                  diag.severity === 'Error'
                    ? 'var(--danger-text)'
                    : diag.severity === 'Warning'
                      ? 'var(--warning-text)'
                      : 'var(--info-text)';

                return (
                  <div key={diag.id} className="studio-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                        {diag.severity === 'Error' ? (
                          <AlertCircle size={15} color={sevColor} aria-hidden="true" />
                        ) : diag.severity === 'Warning' ? (
                          <AlertTriangle size={15} color={sevColor} aria-hidden="true" />
                        ) : (
                          <Info size={15} color={sevColor} aria-hidden="true" />
                        )}
                        {diag.line && (
                          <button
                            type="button"
                            className="badge badge-neutral"
                            style={{ cursor: 'pointer' }}
                            onClick={() => onJumpToLine(diag.line!)}
                          >
                            Line {diag.line}
                          </button>
                        )}
                        <strong style={{ fontSize: 12.5 }}>{diag.shortTitle}</strong>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {diag.fixOperation && (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => onApplyFix(diag.fixOperation!)}
                          >
                            <Wand2 size={12} aria-hidden="true" />
                            {diag.fixButtonTitle ?? 'Apply Fix'}
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          aria-expanded={isRawOpen}
                          onClick={() =>
                            setExpandedRawIds((prev) => ({ ...prev, [diag.id]: !prev[diag.id] }))
                          }
                        >
                          {isRawOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                          Raw TeX
                        </button>
                      </div>
                    </div>

                    <p style={{ margin: '5px 0 0 23px', fontSize: 12, color: 'var(--text-secondary)' }}>
                      {diag.explanation}
                    </p>

                    {isRawOpen && (
                      <pre className="code-preview" style={{ marginLeft: 23 }}>
                        {diag.rawMessage}
                      </pre>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'preflight' && (
          <PreflightChecklistView
            report={preflightReport}
            onJumpToLine={onJumpToLine}
            onApplyFix={onApplyFix}
            onOpenCitationsTab={onOpenCitationsTab}
          />
        )}

        {activeTab === 'transcript' && (
          <pre
            className="code-preview"
            style={{ margin: 0, minHeight: '100%', fontSize: 11.5 }}
          >
            {texLogText || 'No compiler transcript available yet. Run a compilation to inspect full TeX output.'}
          </pre>
        )}

        {activeTab === 'suggestions' && (
          <ContextAdviceTab
            contextBadge={contextAdvice.contextBadge}
            items={contextAdvice.items}
            onInsertSnippet={onInsertSnippet}
            onInsertPackage={onInsertPackage}
          />
        )}
      </div>
    </section>
  );
};
