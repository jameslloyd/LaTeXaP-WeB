import React, { useMemo, useState } from 'react';
import { Check, Plus, Search } from 'lucide-react';
import type { LaTeXPackageInfo } from '@shared/types';

const CTAN_PACKAGES: LaTeXPackageInfo[] = [
  { name: 'expl3', category: 'LaTeX3 Core', description: 'LaTeX3 programming layer (l3kernel): token lists, integers, sequences, floating-point, and keys.', isExpl3: true },
  { name: 'xparse', category: 'LaTeX3 Core', description: 'High-level document command & environment declarations (\\NewDocumentCommand).', isExpl3: true },
  { name: 'l3keys2e', category: 'LaTeX3 Core', description: 'Process LaTeX2e package and class options using l3keys.', isExpl3: true },
  { name: 'amsmath', category: 'Mathematics', description: 'AMS mathematical environments (align, gather, cases, matrices).' },
  { name: 'mathtools', category: 'Mathematics', description: 'Enhancements to amsmath including paired delimiters and cramped styles.' },
  { name: 'amsthm', category: 'Mathematics', description: 'Theorem, lemma, definition, and proof environments.' },
  { name: 'siunitx', category: 'Mathematics', description: 'LaTeX3-powered SI units and numerical column formatting (\\qty, \\num).' },
  { name: 'booktabs', category: 'Tables & Figures', description: 'Publication-quality tables (\\toprule, \\midrule, \\bottomrule).' },
  { name: 'graphicx', category: 'Tables & Figures', description: 'Enhanced support for \\includegraphics images and scaling.' },
  { name: 'subcaption', category: 'Tables & Figures', description: 'Side-by-side subfigures and subcaptions.' },
  { name: 'tikz', category: 'Graphics & Plots', description: 'Programmable vector graphics in TeX.' },
  { name: 'pgfplots', category: 'Graphics & Plots', description: 'Publication-grade 2D/3D scientific plots from CSV/inline data.' },
  { name: 'geometry', category: 'Layout & Typography', description: 'Flexible page size and margin configuration.', defaultOptions: 'margin=1in' },
  { name: 'setspace', category: 'Layout & Typography', description: 'Single, 1.5x, and double line spacing controls.' },
  { name: 'lineno', category: 'Layout & Typography', description: 'Line numbering for peer-review and blind submission drafts.' },
  { name: 'microtype', category: 'Layout & Typography', description: 'Subliminal micro-typographic refinements and character protrusion.' },
  { name: 'fontspec', category: 'Layout & Typography', description: 'OpenType/TrueType custom font loading for XeTeX/LuaTeX.' },
  { name: 'hyperref', category: 'Cross-Ref & Citations', description: 'Clickable hyperlinks, bookmarks, and PDF metadata.', defaultOptions: 'colorlinks=true' },
  { name: 'cleveref', category: 'Cross-Ref & Citations', description: 'Intelligent automatic reference prefixes (Figure 1, Table 2).' },
  { name: 'biblatex', category: 'Cross-Ref & Citations', description: 'Modern BibTeX/Biber bibliography & citation styles.', defaultOptions: 'style=apa' },
];

export interface PackagesTabProps {
  sourceText: string;
  studentModeHideExpl3: boolean;
  onInsertPackage: (packageName: string, options?: string) => void;
}

export const PackagesTab: React.FC<PackagesTabProps> = ({
  sourceText,
  studentModeHideExpl3,
  onInsertPackage,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CTAN_PACKAGES.filter((pkg) => {
      if (studentModeHideExpl3 && pkg.isExpl3) return false;
      if (!q) return true;
      return (
        pkg.name.toLowerCase().includes(q) ||
        pkg.category.toLowerCase().includes(q) ||
        pkg.description.toLowerCase().includes(q)
      );
    });
  }, [query, studentModeHideExpl3]);

  const isPackageAdded = (pkgName: string) => {
    const re = new RegExp(`\\\\usepackage(?:\\[[^\\]]*\\])?\\{[^}]*\\b${pkgName}\\b[^}]*\\}`);
    return re.test(sourceText);
  };

  return (
    <div>
      <h2 className="sidebar-section-heading">CTAN Packages</h2>
      <div style={{ position: 'relative', marginBottom: 10 }}>
        <Search
          size={13}
          aria-hidden="true"
          style={{ position: 'absolute', left: 9, top: 9, color: 'var(--text-muted)' }}
        />
        <label htmlFor="package-search-input" className="sr-only">
          Filter CTAN packages
        </label>
        <input
          id="package-search-input"
          type="search"
          className="input"
          placeholder="Filter CTAN packages..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ paddingLeft: 28 }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {filtered.map((pkg) => {
          const added = isPackageAdded(pkg.name);
          return (
            <div key={pkg.name} className="studio-card" style={{ marginTop: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <strong style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{pkg.name}</strong>
                  <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                    {pkg.category}
                  </span>
                </div>
                {added ? (
                  <span className="badge badge-success" style={{ fontSize: 10.5 }}>
                    <Check size={11} aria-hidden="true" />
                    Added
                  </span>
                ) : (
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onInsertPackage(pkg.name, pkg.defaultOptions)}
                  >
                    <Plus size={11} aria-hidden="true" />
                    Insert
                  </button>
                )}
              </div>
              <p style={{ margin: '5px 0 0 0', fontSize: 11.5, color: 'var(--text-muted)' }}>
                {pkg.description}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
};
