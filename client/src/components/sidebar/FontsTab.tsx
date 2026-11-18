import React, { useRef, useState } from 'react';
import { AlertCircle, Check, Plus, Settings2, Upload } from 'lucide-react';
import type { CTANFontPreset, CustomFontRecord, LaTeXFontRole } from '@shared/types';

const CTAN_FONT_PRESETS: CTANFontPreset[] = [
  {
    id: 'libertinus',
    name: 'Libertinus Serif & Sans',
    packageName: 'libertinus',
    options: '',
    classification: 'Serif + Math',
    description: 'High-legibility academic serif paired with matching math symbols.',
    usepackageStatement: '\\usepackage{libertinus}',
  },
  {
    id: 'ebgaramond',
    name: 'EB Garamond',
    packageName: 'ebgaramond',
    options: '',
    classification: 'Classical Serif',
    description: 'Humanist book typography ideal for humanities & monographs.',
    usepackageStatement: '\\usepackage{ebgaramond}',
  },
  {
    id: 'fira',
    name: 'Fira Sans & Mono',
    packageName: 'FiraSans',
    options: 'sfdefault',
    classification: 'Modern Sans',
    description: 'Crisp geometric sans-serif for slides, lab reports, and UI.',
    usepackageStatement: '\\usepackage[sfdefault]{FiraSans}',
  },
  {
    id: 'plex',
    name: 'IBM Plex',
    packageName: 'plex-serif',
    options: '',
    classification: 'Technical Family',
    description: 'Engineered serif, sans, and monospace family for STEM papers.',
    usepackageStatement: '\\usepackage{plex-serif}',
  },
  {
    id: 'lmodern',
    name: 'Latin Modern',
    packageName: 'lmodern',
    options: '',
    classification: 'TeX Classic',
    description: 'Enhanced vector Computer Modern outline fonts.',
    usepackageStatement: '\\usepackage{lmodern}',
  },
  {
    id: 'tgpagella',
    name: 'TeX Gyre Pagella',
    packageName: 'tgpagella',
    options: '',
    classification: 'Palatino-style',
    description: 'Wide, balanced Palatino-inspired academic body font.',
    usepackageStatement: '\\usepackage{tgpagella}',
  },
];

export interface FontsTabProps {
  customFonts: CustomFontRecord[];
  sourceText: string;
  onUploadFont: (file: File) => Promise<CustomFontRecord>;
  onApplyFontToDocument: (fontNameOrFile: string, role: LaTeXFontRole) => void;
  onInsertPackage: (packageName: string, options?: string) => void;
  onOpenFontManager: () => void;
}

export const FontsTab: React.FC<FontsTabProps> = ({
  customFonts,
  sourceText,
  onUploadFont,
  onApplyFontToDocument,
  onInsertPackage,
  onOpenFontManager,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = async (file: File | undefined) => {
    if (!file) return;
    const lower = file.name.toLowerCase();
    if (!lower.endsWith('.ttf') && !lower.endsWith('.otf') && !lower.endsWith('.ttc')) {
      setError('Unsupported font format. Please upload a .ttf, .otf, or .ttc file.');
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await onUploadFont(file);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Font upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <h2 className="sidebar-section-heading" style={{ margin: 0 }}>
          Custom &amp; CTAN Fonts
        </h2>
        <button type="button" className="btn btn-sm" onClick={onOpenFontManager}>
          <Settings2 size={12} aria-hidden="true" />
          Manager
        </button>
      </div>

      {/* Upload Dropzone */}
      <div
        className="studio-card"
        style={{
          borderStyle: 'dashed',
          textAlign: 'center',
          marginBottom: 12,
          cursor: 'pointer',
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          void handleFiles(e.dataTransfer.files?.[0]);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".ttf,.otf,.ttc"
          className="sr-only"
          aria-label="Upload custom font file"
          onChange={(e) => void handleFiles(e.target.files?.[0])}
        />
        <Upload size={16} style={{ color: 'var(--accent-text)', marginBottom: 4 }} aria-hidden="true" />
        <div style={{ fontSize: 12, fontWeight: 600 }}>
          {uploading ? 'Validating & uploading font...' : 'Drop .ttf / .otf / .ttc font'}
        </div>
        <button
          type="button"
          className="btn btn-sm"
          style={{ marginTop: 6 }}
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Browse Font File...
        </button>
      </div>

      {error && (
        <div
          role="alert"
          className="studio-card"
          style={{
            background: 'var(--danger-bg)',
            borderColor: 'var(--danger-border)',
            color: 'var(--danger-text)',
            fontSize: 11.5,
            marginBottom: 10,
            display: 'flex',
            gap: 6,
          }}
        >
          <AlertCircle size={14} style={{ flexShrink: 0 }} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {customFonts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="sidebar-section-heading">Your Uploaded Fonts ({customFonts.length})</div>
          {customFonts.map((font) => (
            <div key={font.id} className="studio-card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <strong style={{ fontSize: 12 }}>{font.displayName}</strong>
                <span className="badge badge-neutral" style={{ fontSize: 10 }}>
                  {font.format.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 6px 0' }}>
                {font.familyName} • {(font.fileSizeBytes / 1024).toFixed(0)} KB
              </div>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onApplyFontToDocument(font.familyName, 'main')}
                >
                  Set Main
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onApplyFontToDocument(font.familyName, 'sans')}
                >
                  Set Sans
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onApplyFontToDocument(font.familyName, 'mono')}
                >
                  Set Mono
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="sidebar-section-heading">CTAN Font Presets</div>
      {CTAN_FONT_PRESETS.map((preset) => {
        const added = sourceText.includes(`{${preset.packageName}}`);
        return (
          <div key={preset.id} className="studio-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              <strong style={{ fontSize: 12 }}>{preset.name}</strong>
              {added ? (
                <span className="badge badge-success" style={{ fontSize: 10 }}>
                  <Check size={10} aria-hidden="true" />
                  Added
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => onInsertPackage(preset.packageName, preset.options)}
                >
                  <Plus size={11} aria-hidden="true" />
                  Use
                </button>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
              {preset.description}
            </div>
          </div>
        );
      })}
    </div>
  );
};
