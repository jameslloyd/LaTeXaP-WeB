import React, { useRef, useState } from 'react';
import {
  BookOpen,
  Braces,
  Cloud,
  CloudOff,
  FileStack,
  FolderPlus,
  History,
  ListTree,
  Package,
  Settings,
  Type,
} from 'lucide-react';
import type {
  AcademicProjectDescriptor,
  BibEntry,
  BibliographyStylePreset,
  CitationCommandStyle,
  CustomFontRecord,
  DocumentOutlineItem,
  LaTeXFontRole,
  StorageStatusInfo,
} from '@shared/types';
import { OutlineTab } from '../sidebar/OutlineTab';
import { PackagesTab } from '../sidebar/PackagesTab';
import { FontsTab } from '../sidebar/FontsTab';
import { BibliographyTab } from '../sidebar/BibliographyTab';
import { SnippetsTab } from '../sidebar/SnippetsTab';
import { TemplatesTab } from '../sidebar/TemplatesTab';

export type SidebarTabId = 'outline' | 'packages' | 'fonts' | 'bibtex' | 'latex3' | 'templates';

const TABS: Array<{ id: SidebarTabId; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { id: 'outline', label: 'Outline', icon: ListTree },
  { id: 'packages', label: 'Packages', icon: Package },
  { id: 'fonts', label: 'Fonts', icon: Type },
  { id: 'bibtex', label: 'BibTeX', icon: BookOpen },
  { id: 'latex3', label: 'LaTeX3', icon: Braces },
  { id: 'templates', label: 'Templates', icon: FileStack },
];

export interface SidebarPanelProps {
  width: number;
  isOverlay: boolean;
  activeTab: SidebarTabId;
  projects: AcademicProjectDescriptor[];
  activeProject: AcademicProjectDescriptor | null;
  storageStatus: StorageStatusInfo | null;
  isDirty: boolean;
  sourceText: string;
  outlineItems: DocumentOutlineItem[];
  customFonts: CustomFontRecord[];
  bibEntries: BibEntry[];
  bibSearchResults: BibEntry[];
  isSearchingCitations: boolean;
  selectedBibliographyStyle: BibliographyStylePreset;
  studentModeHideExpl3: boolean;
  onSelectTab: (tab: SidebarTabId) => void;
  onSwitchProject: (slug: string) => Promise<void>;
  onSaveAndSwitchProject: (slug: string) => Promise<void>;
  onOpenNewProject: () => void;
  onOpenStorageModal: () => void;
  onOpenHistoryModal: () => void;
  onSelectOutlineItem: (line: number) => void;
  onInsertPackage: (pkg: string, opts?: string) => void;
  onUploadFont: (file: File) => Promise<CustomFontRecord>;
  onApplyFontToDocument: (fontNameOrFile: string, role: LaTeXFontRole) => void;
  onOpenFontManager: () => void;
  onChangeBibliographyStyle: (style: BibliographyStylePreset) => void;
  onSearchCitations: (query: string) => Promise<void>;
  onLookupIdentifier: (id: string) => Promise<void>;
  onImportBibEntry: (entry: BibEntry) => void;
  onImportBibFile: (file: File) => Promise<void>;
  onInsertCitation: (entry: BibEntry, style: CitationCommandStyle, locator?: string) => void;
  onInsertText: (text: string, backtrackOffset?: number) => void;
  onApplyTemplate: (templateId: string) => void;
  onOpenWizard: (templateId?: string) => void;
}

export const SidebarPanel: React.FC<SidebarPanelProps> = ({
  width,
  isOverlay,
  activeTab,
  projects,
  activeProject,
  storageStatus,
  isDirty,
  sourceText,
  outlineItems,
  customFonts,
  bibEntries,
  bibSearchResults,
  isSearchingCitations,
  selectedBibliographyStyle,
  studentModeHideExpl3,
  onSelectTab,
  onSwitchProject,
  onSaveAndSwitchProject,
  onOpenNewProject,
  onOpenStorageModal,
  onOpenHistoryModal,
  onSelectOutlineItem,
  onInsertPackage,
  onUploadFont,
  onApplyFontToDocument,
  onOpenFontManager,
  onChangeBibliographyStyle,
  onSearchCitations,
  onLookupIdentifier,
  onImportBibEntry,
  onImportBibFile,
  onInsertCitation,
  onInsertText,
  onApplyTemplate,
  onOpenWizard,
}) => {
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pendingSwitchSlug, setPendingSwitchSlug] = useState<string | null>(null);
  const [switchingBusy, setSwitchingBusy] = useState(false);

  const handleTabKeyDown = (idx: number, e: React.KeyboardEvent) => {
    let nextIdx: number | null = null;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;
    if (nextIdx !== null) {
      e.preventDefault();
      onSelectTab(TABS[nextIdx].id);
      tabRefs.current[nextIdx]?.focus();
    }
  };

  return (
    <aside
      aria-label="Workspace navigation and authoring tools"
      className={`sidebar-panel ${isOverlay ? 'is-overlay-drawer' : ''}`}
      style={{ width }}
    >
      {/* Pinned Cloud Workspace & Project Switcher */}
      <nav aria-label="B2 Projects" className="sidebar-workspace-strip">
        <div className="sidebar-workspace-strip__row">
          <span
            className={`badge ${storageStatus?.storageDriver === 'b2' ? 'badge-success' : 'badge-neutral'}`}
            style={{ fontSize: 10.5 }}
          >
            {storageStatus?.storageDriver === 'b2' ? (
              <Cloud size={11} aria-hidden="true" />
            ) : (
              <CloudOff size={11} aria-hidden="true" />
            )}
            {storageStatus?.storageDriver === 'b2' ? 'B2 Cloud' : 'Local Fallback'}
          </span>
          <button
            type="button"
            className="btn btn-icon btn-sm btn-ghost"
            aria-label="Backblaze B2 Storage Settings"
            title="Backblaze B2 Storage Settings"
            onClick={onOpenStorageModal}
          >
            <Settings size={13} aria-hidden="true" />
          </button>
        </div>

        <div>
          <label htmlFor="sidebar-project-switcher" className="sr-only">
            Switch active B2 project
          </label>
          <select
            id="sidebar-project-switcher"
            className="select"
            value={pendingSwitchSlug ?? activeProject?.slug ?? ''}
            onChange={(e) => {
              const target = e.target.value;
              if (!target || target === activeProject?.slug) return;
              if (isDirty) {
                setPendingSwitchSlug(target);
              } else {
                void onSwitchProject(target);
              }
            }}
          >
            {projects.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.displayName} (v{p.version})
              </option>
            ))}
          </select>
        </div>

        {pendingSwitchSlug && (
          <div
            role="alertdialog"
            aria-label="Unsaved changes before switching project"
            className="studio-card"
            style={{
              marginTop: 0,
              padding: 8,
              borderColor: 'var(--warning-border)',
              background: 'var(--warning-bg)',
              color: 'var(--warning-text)',
            }}
          >
            <div style={{ fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>
              Save changes to &ldquo;{activeProject?.displayName}&rdquo; before switching?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={switchingBusy}
                onClick={async () => {
                  setSwitchingBusy(true);
                  try {
                    await onSaveAndSwitchProject(pendingSwitchSlug);
                    setPendingSwitchSlug(null);
                  } finally {
                    setSwitchingBusy(false);
                  }
                }}
              >
                Save &amp; Switch
              </button>
              <div style={{ display: 'flex', gap: 4 }}>
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ flex: 1 }}
                  disabled={switchingBusy}
                  onClick={async () => {
                    setSwitchingBusy(true);
                    try {
                      await onSwitchProject(pendingSwitchSlug);
                      setPendingSwitchSlug(null);
                    } finally {
                      setSwitchingBusy(false);
                    }
                  }}
                >
                  Discard
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  style={{ flex: 1 }}
                  disabled={switchingBusy}
                  onClick={() => setPendingSwitchSlug(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="sidebar-workspace-strip__row">
          <button type="button" className="btn btn-sm" style={{ flex: 1 }} onClick={onOpenNewProject}>
            <FolderPlus size={12} aria-hidden="true" />
            New Project
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ flex: 1 }}
            title="Version History (Mod+Alt+H)"
            onClick={onOpenHistoryModal}
          >
            <History size={12} aria-hidden="true" />
            History
          </button>
        </div>
      </nav>

      {/* 6-Tab Icon + Label Rail */}
      <div role="tablist" aria-label="Authoring tool panels" className="sidebar-tablist">
        {TABS.map((t, idx) => {
          const Icon = t.icon;
          const selected = activeTab === t.id;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`sidebar-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={`sidebar-panel-${t.id}`}
              tabIndex={selected ? 0 : -1}
              className="sidebar-tab"
              onClick={() => onSelectTab(t.id)}
              onKeyDown={(e) => handleTabKeyDown(idx, e)}
            >
              <Icon size={15} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Active Tabpanel */}
      <div
        id={`sidebar-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`sidebar-tab-${activeTab}`}
        className="sidebar-tabpanel"
      >
        {activeTab === 'outline' && (
          <OutlineTab
            items={outlineItems}
            studentModeHideExpl3={studentModeHideExpl3}
            onSelectOutlineItem={onSelectOutlineItem}
          />
        )}
        {activeTab === 'packages' && (
          <PackagesTab
            sourceText={sourceText}
            studentModeHideExpl3={studentModeHideExpl3}
            onInsertPackage={onInsertPackage}
          />
        )}
        {activeTab === 'fonts' && (
          <FontsTab
            customFonts={customFonts}
            sourceText={sourceText}
            onUploadFont={onUploadFont}
            onApplyFontToDocument={onApplyFontToDocument}
            onInsertPackage={onInsertPackage}
            onOpenFontManager={onOpenFontManager}
          />
        )}
        {activeTab === 'bibtex' && (
          <BibliographyTab
            sourceText={sourceText}
            bibEntries={bibEntries}
            bibSearchResults={bibSearchResults}
            isSearchingCitations={isSearchingCitations}
            selectedBibliographyStyle={selectedBibliographyStyle}
            onChangeBibliographyStyle={onChangeBibliographyStyle}
            onSearchCitations={onSearchCitations}
            onLookupIdentifier={onLookupIdentifier}
            onImportBibEntry={onImportBibEntry}
            onImportBibFile={onImportBibFile}
            onInsertCitation={onInsertCitation}
            onInsertText={onInsertText}
          />
        )}
        {activeTab === 'latex3' && <SnippetsTab onInsertSnippet={onInsertText} />}
        {activeTab === 'templates' && (
          <TemplatesTab
            isDirty={isDirty}
            onApplyTemplate={onApplyTemplate}
            onOpenWizard={onOpenWizard}
          />
        )}
      </div>
    </aside>
  );
};
