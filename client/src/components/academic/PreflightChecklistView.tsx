import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ShieldCheck, Wand2 } from 'lucide-react';
import type { AcademicFixOperation, AcademicPreflightReport } from '@shared/types';

export interface PreflightChecklistViewProps {
  report: AcademicPreflightReport;
  onJumpToLine: (line: number) => void;
  onApplyFix: (op: AcademicFixOperation) => void;
  onOpenCitationsTab: () => void;
}

export const PreflightChecklistView: React.FC<PreflightChecklistViewProps> = ({
  report,
  onJumpToLine,
  onApplyFix,
  onOpenCitationsTab,
}) => {
  const issues = report.items.filter((i) => i.severity !== 'pass');

  return (
    <div>
      {report.isSubmissionReady && issues.length === 0 ? (
        <div
          role="status"
          className="studio-card"
          style={{
            background: 'var(--success-bg)',
            borderColor: 'var(--success-border)',
            color: 'var(--success-text)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <ShieldCheck size={18} aria-hidden="true" />
          <div>
            <strong>All Pre-Flight Checks Passed</strong> — Ready to export PDF or submission bundle.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {report.items.map((item) => {
            const tone =
              item.severity === 'blocker'
                ? 'var(--danger-text)'
                : item.severity === 'warning'
                  ? 'var(--warning-text)'
                  : 'var(--success-text)';

            return (
              <div key={item.id} className="studio-card" style={{ marginTop: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.severity === 'blocker' ? (
                      <AlertCircle size={15} color={tone} aria-hidden="true" />
                    ) : item.severity === 'warning' ? (
                      <AlertTriangle size={15} color={tone} aria-hidden="true" />
                    ) : (
                      <CheckCircle2 size={15} color={tone} aria-hidden="true" />
                    )}
                    <strong style={{ fontSize: 12.5 }}>{item.title}</strong>
                    <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                      {item.category}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {item.line && (
                      <button type="button" className="btn btn-sm" onClick={() => onJumpToLine(item.line!)}>
                        Line {item.line}
                      </button>
                    )}
                    {item.fixOperation && (
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => onApplyFix(item.fixOperation!)}
                      >
                        <Wand2 size={12} aria-hidden="true" />
                        {item.fixButtonTitle ?? 'Apply Fix'}
                      </button>
                    )}
                  </div>
                </div>
                <p style={{ margin: '4px 0 0 23px', fontSize: 12, color: 'var(--text-muted)' }}>
                  {item.detail}
                </p>
              </div>
            );
          })}

          {report.unresolvedCitations.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <button type="button" className="btn btn-sm" onClick={onOpenCitationsTab}>
                Search CrossRef for missing citation keys ({report.unresolvedCitations.join(', ')})
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
