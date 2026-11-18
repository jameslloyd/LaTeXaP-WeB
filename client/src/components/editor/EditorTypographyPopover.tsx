import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, Type } from 'lucide-react';
import type { CustomFontRecord } from '@shared/types';

export interface EditorTypographyPopoverProps {
  fontFamily: string;
  fontSize: number;
  customFonts: CustomFontRecord[];
  onChange: (family: string, size: number) => void;
}

const BUILTIN_MONO_FONTS = [
  { label: 'JetBrains Mono', value: '"JetBrains Mono", "SF Mono", Menlo, monospace' },
  { label: 'SF Mono', value: '"SF Mono", Menlo, Monaco, monospace' },
  { label: 'Fira Code', value: '"Fira Code", "JetBrains Mono", monospace' },
  { label: 'Menlo / Consolas', value: 'Menlo, Consolas, "Liberation Mono", monospace' },
];

export const EditorTypographyPopover: React.FC<EditorTypographyPopoverProps> = ({
  fontFamily,
  fontSize,
  customFonts,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('mousedown', onOutside);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('mousedown', onOutside);
    };
  }, [open]);

  const activeLabel =
    BUILTIN_MONO_FONTS.find((f) => f.value === fontFamily)?.label ??
    customFonts.find((f) => fontFamily.includes(f.familyName))?.displayName ??
    'Mono';

  const monospaceCustomFonts = customFonts.filter((f) => f.isMonospace);

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        ref={triggerRef}
        type="button"
        className="btn btn-sm"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Editor typography: ${activeLabel} ${fontSize}pt`}
        onClick={() => setOpen((prev) => !prev)}
      >
        <Type size={12} aria-hidden="true" />
        <span>
          {activeLabel} {fontSize}pt
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label="Editor typography settings"
          className="popover-panel"
          style={{ width: 260 }}
        >
          <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 10 }}>Editor Typography</div>

          <label
            htmlFor="editor-font-family-select"
            style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 4 }}
          >
            Monospace Font
          </label>
          <select
            id="editor-font-family-select"
            className="select"
            value={fontFamily}
            onChange={(e) => onChange(e.target.value, fontSize)}
            style={{ marginBottom: 12 }}
          >
            {BUILTIN_MONO_FONTS.map((f) => (
              <option key={f.label} value={f.value}>
                {f.label}
              </option>
            ))}
            {monospaceCustomFonts.map((f) => (
              <option key={f.id} value={`"${f.familyName}", monospace`}>
                {f.displayName} (Custom)
              </option>
            ))}
          </select>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>Font Size</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                aria-label="Decrease editor font size"
                disabled={fontSize <= 10}
                onClick={() => onChange(fontFamily, Math.max(10, fontSize - 1))}
              >
                <Minus size={12} aria-hidden="true" />
              </button>
              <span
                style={{
                  minWidth: 36,
                  textAlign: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                }}
              >
                {fontSize} pt
              </span>
              <button
                type="button"
                className="btn btn-icon btn-sm"
                aria-label="Increase editor font size"
                disabled={fontSize >= 24}
                onClick={() => onChange(fontFamily, Math.min(24, fontSize + 1))}
              >
                <Plus size={12} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
