import React from 'react';
import { Lightbulb } from 'lucide-react';
import type { ContextAdviceItem } from '@shared/types';

export interface ContextAdviceTabProps {
  contextBadge: string;
  items: ContextAdviceItem[];
  onInsertSnippet: (snippet: string) => void;
  onInsertPackage: (packageName: string, options?: string) => void;
}

export const ContextAdviceTab: React.FC<ContextAdviceTabProps> = ({
  contextBadge,
  items,
  onInsertSnippet,
  onInsertPackage,
}) => {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span className="badge badge-info">
          <Lightbulb size={12} aria-hidden="true" />
          {contextBadge}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="studio-card" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          Move your cursor into the preamble, math, table, or LaTeX3 blocks for region-aware authoring tips.
        </div>
      ) : (
        items.map((item) => (
          <div key={item.id} className="studio-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong style={{ fontSize: 12.5 }}>{item.title}</strong>
                {item.badge && (
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                    {item.badge}
                  </span>
                )}
              </div>
              {item.actionLabel && (item.snippet || item.packageName) && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    if (item.packageName) {
                      onInsertPackage(item.packageName, item.packageOptions);
                    }
                    if (item.snippet) {
                      onInsertSnippet(item.snippet);
                    }
                  }}
                >
                  {item.actionLabel}
                </button>
              )}
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{item.detail}</p>
          </div>
        ))
      )}
    </div>
  );
};
