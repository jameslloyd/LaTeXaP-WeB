import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import type { LaTeXTemplate } from '@shared/types';

const TEMPLATE_META: Array<Omit<LaTeXTemplate, 'source'>> = [
  { id: 'apa7-student', title: 'APA 7th Student Paper', subtitle: 'Title page, double-spaced, APA citations', category: 'Academic Papers', badge: 'APA 7' },
  { id: 'ieee-conference', title: 'IEEE Conference', subtitle: 'Two-column IEEEtran-style layout', category: 'Academic Papers', badge: 'IEEE' },
  { id: 'acm-article', title: 'ACM acmart', subtitle: 'ACM proceedings two-column article', category: 'Academic Papers', badge: 'ACM' },
  { id: 'mla-essay', title: 'MLA Essay', subtitle: 'Humanities 1-in margins & Works Cited', category: 'Academic Papers', badge: 'MLA' },
  { id: 'stem-lab-report', title: 'STEM Lab Report', subtitle: 'siunitx units, booktabs data, error analysis', category: 'STEM & Theses', badge: 'STEM' },
  { id: 'university-thesis', title: 'University Thesis / Dissertation', subtitle: 'Chapters, TOC, abstract & bibliography', category: 'STEM & Theses', badge: 'Thesis' },
  { id: 'beamer-slides', title: 'Beamer Presentation', subtitle: 'Structured lecture & conference slides', category: 'STEM & Theses', badge: 'Slides' },
  { id: 'expl3-showcase', title: 'LaTeX3 (expl3 + xparse) Showcase', subtitle: 'Modern expl3 macros, l3int, l3fp & l3seq', category: 'LaTeX3 Core', badge: 'expl3' },
  { id: 'python-scientific', title: 'Python & Scientific Computing', subtitle: 'Listings code blocks + numerical algorithms', category: 'LaTeX3 Core', badge: 'SciPy' },
  { id: 'tikz-graphics', title: 'TikZ & PGFPlots Diagrams', subtitle: 'Vector graphics & plotted data charts', category: 'LaTeX3 Core', badge: 'TikZ' },
];

export interface TemplatesTabProps {
  isDirty: boolean;
  onApplyTemplate: (templateId: string) => void;
  onOpenWizard: (templateId?: string) => void;
}

export const TemplatesTab: React.FC<TemplatesTabProps> = ({
  isDirty,
  onApplyTemplate,
  onOpenWizard,
}) => {
  const [confirmTemplateId, setConfirmTemplateId] = useState<string | null>(null);
  const categories: Array<LaTeXTemplate['category']> = ['Academic Papers', 'STEM & Theses', 'LaTeX3 Core'];

  const handleLoad = (id: string) => {
    if (isDirty) {
      setConfirmTemplateId(id);
      return;
    }
    onApplyTemplate(id);
  };

  return (
    <div>
      <button
        type="button"
        className="btn btn-primary"
        style={{ width: '100%', marginBottom: 12 }}
        onClick={() => onOpenWizard()}
      >
        <Sparkles size={14} aria-hidden="true" />
        New with Setup Wizard...
      </button>

      {confirmTemplateId && (
        <div
          role="alertdialog"
          aria-label="Confirm replacing unsaved document"
          className="studio-card"
          style={{ borderColor: 'var(--warning-border)', background: 'var(--warning-bg)', marginBottom: 12 }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
            Replace current unsaved edits with starter template?
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                onApplyTemplate(confirmTemplateId);
                setConfirmTemplateId(null);
              }}
            >
              Replace Buffer
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmTemplateId(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {categories.map((cat) => (
        <div key={cat} style={{ marginBottom: 14 }}>
          <h2 className="sidebar-section-heading">{cat}</h2>
          {TEMPLATE_META.filter((t) => t.category === cat).map((tpl) => (
            <div key={tpl.id} className="studio-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <strong style={{ fontSize: 12 }}>{tpl.title}</strong>
                <span className="badge badge-info" style={{ fontSize: 10 }}>
                  {tpl.badge}
                </span>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-muted)', margin: '3px 0 8px 0' }}>
                {tpl.subtitle}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button" className="btn btn-sm" onClick={() => handleLoad(tpl.id)}>
                  Load Starter
                </button>
                <button type="button" className="btn btn-sm" onClick={() => onOpenWizard(tpl.id)}>
                  Customize...
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};
