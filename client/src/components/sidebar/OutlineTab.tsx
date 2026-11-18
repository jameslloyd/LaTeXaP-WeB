import React from 'react';
import { ListTree } from 'lucide-react';
import type { DocumentOutlineItem } from '@shared/types';

export interface OutlineTabProps {
  items: DocumentOutlineItem[];
  studentModeHideExpl3: boolean;
  onSelectOutlineItem: (line: number) => void;
}

export const OutlineTab: React.FC<OutlineTabProps> = ({
  items,
  studentModeHideExpl3,
  onSelectOutlineItem,
}) => {
  const visibleItems = studentModeHideExpl3
    ? items.filter((item) => !['expl3', 'xparse'].includes(item.badge.toLowerCase()))
    : items;

  const badgeTone = (badge: string) => {
    const lower = badge.toLowerCase();
    if (lower === 'expl3') return 'badge-info';
    if (lower === 'xparse') return 'badge-warning';
    if (lower === 'env') return 'badge-success';
    return 'badge-neutral';
  };

  return (
    <div>
      <h2 className="sidebar-section-heading">Document &amp; expl3 Structure</h2>
      {visibleItems.length === 0 ? (
        <div className="studio-card" style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <ListTree size={14} aria-hidden="true" />
            <strong>No sections detected yet</strong>
          </div>
          Add <code>\section{'{...}'}</code>, <code>\ExplSyntaxOn</code>, or{' '}
          <code>\NewDocumentCommand</code> to populate the outline.
        </div>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          {visibleItems.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onSelectOutlineItem(item.line)}
                style={{
                  width: '100%',
                  justifyContent: 'space-between',
                  paddingLeft: `${8 + (item.level - 1) * 14}px`,
                  height: 28,
                }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    minWidth: 0,
                    overflow: 'hidden',
                  }}
                >
                  <span className={`badge ${badgeTone(item.badge)}`} style={{ fontSize: 9.5, padding: '1px 5px' }}>
                    {item.badge}
                  </span>
                  <span
                    style={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontSize: 12,
                    }}
                  >
                    {item.title}
                  </span>
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 10.5,
                    color: 'var(--text-muted)',
                    flexShrink: 0,
                  }}
                >
                  L{item.line}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
