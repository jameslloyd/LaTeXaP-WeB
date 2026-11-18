import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Archive,
  BookMarked,
  Camera,
  CheckCircle2,
  ChevronDown,
  Cloud,
  CloudOff,
  Download,
  FileCode2,
  ImagePlus,
  Loader2,
  Moon,
  PanelLeft,
  Play,
  Save,
  Sigma,
  Sun,
  Terminal,
  Type,
  Zap,
} from 'lucide-react';
import type {
  AcademicProjectDescriptor,
  AuthConfig,
  AuthUser,
  BibEntry,
  CitationCommandStyle,
  CompilationState,
  ProjectSyncState,
  StorageStatusInfo,
  SubmissionExportResult,
} from '@shared/types';
import { UserMenuPopover } from '../auth/UserMenuPopover';
import { SnapshotSavePopover } from '../projects/SnapshotSavePopover';
import { CitationPickerPopover } from '../academic/CitationPickerPopover';

export interface TopToolbarProps {
  user: AuthUser;
  authConfig: AuthConfig | null;
  storageStatus: StorageStatusInfo | null;
  activeProject: AcademicProjectDescriptor | null;
  projectFiles: Record<string, string>;
  isDirty: boolean;
  syncState: ProjectSyncState;
  compilationState: CompilationState;
  autoCompileEnabled: boolean;
  studioTheme: 'light' | 'dark';
  sidebarOpen: boolean;
  diagnosticsOpen: boolean;
  mobileView: 'code' | 'pdf' | 'split';
  bibEntries: BibEntry[];
  bibSearchResults: BibEntry[];
  isSearchingCitations: boolean;
  selectedCitationStyle: CitationCommandStyle;
  preflightWarningCount: number;
  pdfAvailable: boolean;
  snapshotPopoverOpen: boolean;
  citationPopoverOpen: boolean;
  onToggleSidebar: () => void;
  onToggleDiagnostics: () => void;
  onChangeMobileView: (view: 'code' | 'pdf' | 'split') => void;
  onOpenProjectsModal: (mode: 'projects' | 'storage' | 'create') => void;
  onQuickSave: () => Promise<void>;
  onSetSnapshotPopoverOpen: (open: boolean) => void;
  onSaveWithMessage: (message: string) => Promise<void>;
  onToggleAutoCompile: () => void;
  onCompileNow: () => Promise<void>;
  onForwardSync: () => void;
  onOpenVisualTools: () => void;
  onSetCitationPopoverOpen: (open: boolean) => void;
  onSearchCitations: (query: string) => Promise<void>;
  onLookupCitation: (id: string) => Promise<void>;
  onImportBibEntry: (entry: BibEntry) => void;
  onInsertCitation: (entry: BibEntry, style: CitationCommandStyle, locator?: string) => void;
  onOpenFontManager: () => void;
  onOpenFigureAssistant: () => void;
  onExportPDF: () => void;
  onExportZip: (opts?: { stripComments?: boolean; anonymize?: boolean }) => Promise<SubmissionExportResult>;
  onOpenPreflight: () => void;
  onToggleStudioTheme: () => void;
  onSwitchDevUser: (email: string, name?: string) => Promise<void>;
  onLogout: () => Promise<void>;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  user,
  authConfig,
  storageStatus,
  activeProject,
  projectFiles,
  isDirty,
  syncState,
  compilationState,
  autoCompileEnabled,
  studioTheme,
  sidebarOpen,
  diagnosticsOpen,
  mobileView,
  bibEntries,
  bibSearchResults,
  isSearchingCitations,
  selectedCitationStyle,
  preflightWarningCount,
  pdfAvailable,
  snapshotPopoverOpen,
  citationPopoverOpen,
  onToggleSidebar,
  onToggleDiagnostics,
  onChangeMobileView,
  onOpenProjectsModal,
  onQuickSave,
  onSetSnapshotPopoverOpen,
  onSaveWithMessage,
  onToggleAutoCompile,
  onCompileNow,
  onForwardSync,
  onOpenVisualTools,
  onSetCitationPopoverOpen,
  onSearchCitations,
  onLookupCitation,
  onImportBibEntry,
  onInsertCitation,
  onOpenFontManager,
  onOpenFigureAssistant,
  onExportPDF,
  onExportZip,
  onOpenPreflight,
  onToggleStudioTheme,
  onSwitchDevUser,
  onLogout,
}) => {
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [overflowOpen, setOverflowOpen] = useState(false);
  const [stripComments, setStripComments] = useState(false);
  const [anonymizeZip, setAnonymizeZip] = useState(false);
  const [zipExporting, setZipExporting] = useState(false);
  const exportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!exportMenuOpen && !overflowOpen) return;
    const onOutside = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setExportMenuOpen(false);
        setOverflowOpen(false);
      }
    };
    window.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onKey);
    };
  }, [exportMenuOpen, overflowOpen]);

  const renderSyncPill = () => {
    if (syncState === 'saving') {
      return (
        <span className="badge badge-info">
          <Loader2 size={11} className="spin-icon" aria-hidden="true" />
          Saving...
        </span>
      );
    }
    if (syncState === 'conflict') {
      return (
        <span className="badge badge-danger">
          <AlertTriangle size={11} aria-hidden="true" />
          Sync Conflict
        </span>
      );
    }
    if (syncState === 'error') {
      return (
        <span className="badge badge-danger">
          <AlertTriangle size={11} aria-hidden="true" />
          B2 Sync Error
        </span>
      );
    }
    if (isDirty) {
      return (
        <span className="badge badge-warning">
          <Save size={11} aria-hidden="true" />
          Unsaved
        </span>
      );
    }
    if (syncState === 'offline-fallback' || storageStatus?.storageDriver === 'local') {
      return (
        <span className="badge badge-neutral">
          <CloudOff size={11} aria-hidden="true" />
          Local Fallback
        </span>
      );
    }
    return (
      <span className="badge badge-success">
        <Cloud size={11} aria-hidden="true" />
        Synced to B2
      </span>
    );
  };

  const renderCompileBadge = () => {
    if (compilationState.status === 'compiling') {
      return (
        <span className="badge badge-info" role="status">
          <Loader2 size={11} className="spin-icon" aria-hidden="true" />
          Compiling in Browser (WASM)...
        </span>
      );
    }
    if (compilationState.status === 'failed') {
      return (
        <button
          type="button"
          className="badge badge-danger"
          style={{ cursor: 'pointer' }}
          onClick={onToggleDiagnostics}
        >
          <AlertTriangle size={11} aria-hidden="true" />
          {compilationState.errorCount} Error(s)
        </button>
      );
    }
    if (compilationState.status === 'success') {
      return (
        <button
          type="button"
          className="badge badge-success"
          style={{ cursor: 'pointer' }}
          onClick={onToggleDiagnostics}
          title="Client-side compilation succeeded"
        >
          <CheckCircle2 size={11} aria-hidden="true" />
          PDF Ready • {compilationState.durationMs} ms
        </button>
      );
    }
    return (
      <span className="badge badge-neutral">
        Ready
      </span>
    );
  };

  const handleDownloadZip = async () => {
    setZipExporting(true);
    try {
      const result = await onExportZip({ stripComments, anonymize: anonymizeZip });
      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      a.click();
      URL.revokeObjectURL(url);
      setExportMenuOpen(false);
    } finally {
      setZipExporting(false);
    }
  };

  return (
    <header role="banner" className="top-toolbar">
      {/* Left: Workspace & Cloud */}
      <div className="toolbar-group">
        <button
          type="button"
          className={`btn btn-icon ${sidebarOpen ? 'btn-primary' : ''}`}
          aria-pressed={sidebarOpen}
          aria-label="Toggle workspace sidebar"
          title="Toggle Sidebar (Mod+\)"
          onClick={onToggleSidebar}
        >
          <PanelLeft size={15} aria-hidden="true" />
        </button>

        <div className="toolbar-brand">
          <span className="toolbar-brand__mark" aria-hidden="true">
            TeX
          </span>
          <span>LaTeXaP-WeB</span>
        </div>

        <button
          type="button"
          className="btn"
          aria-label={`Active project: ${activeProject?.displayName ?? 'None'}. Click to switch or manage projects.`}
          onClick={() => onOpenProjectsModal('projects')}
        >
          <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {activeProject?.displayName ?? 'Select Project'}
          </span>
          <ChevronDown size={13} aria-hidden="true" />
        </button>

        <button
          type="button"
          className="btn btn-icon"
          aria-label="Quick Save and Snapshot"
          title="Quick Save & Snapshot (Mod+S)"
          disabled={!activeProject}
          onClick={() => void onQuickSave()}
        >
          <Save size={14} aria-hidden="true" />
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-icon"
            aria-label="Save and Snapshot with custom message"
            aria-expanded={snapshotPopoverOpen}
            title="Save with Custom Message (Mod+Alt+S)"
            disabled={!activeProject}
            onClick={() => onSetSnapshotPopoverOpen(!snapshotPopoverOpen)}
          >
            <Camera size={14} aria-hidden="true" />
          </button>
          <SnapshotSavePopover
            open={snapshotPopoverOpen}
            projectName={activeProject?.displayName ?? 'Project'}
            changedFiles={Object.keys(projectFiles)}
            onClose={() => onSetSnapshotPopoverOpen(false)}
            onSaveSnapshot={onSaveWithMessage}
          />
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '0 4px', height: 'auto' }}
          aria-label="Open Backblaze B2 storage status"
          onClick={() => onOpenProjectsModal('storage')}
        >
          {renderSyncPill()}
        </button>
      </div>

      {/* Center: Client-Side WASM Compile & SyncTeX */}
      <div className="toolbar-group">
        {renderCompileBadge()}

        <button
          type="button"
          className={`btn btn-sm ${autoCompileEnabled ? 'btn-primary' : ''}`}
          aria-pressed={autoCompileEnabled}
          onClick={onToggleAutoCompile}
          title="Toggle live debounced client-side auto-compilation"
        >
          <Zap size={12} aria-hidden="true" />
          <span>Auto-Compile: {autoCompileEnabled ? 'ON' : 'Paused'}</span>
        </button>

        <button
          type="button"
          className="btn btn-sm"
          title="Compile Now (Mod+B)"
          onClick={() => void onCompileNow()}
        >
          <Play size={12} aria-hidden="true" />
          <span>Compile</span>
        </button>

        <button
          type="button"
          className="btn btn-sm"
          title="Sync Editor Line to PDF (Mod+Shift+J)"
          onClick={onForwardSync}
        >
          <FileCode2 size={12} aria-hidden="true" />
          <span>Sync PDF</span>
        </button>
      </div>

      {/* Right: Authoring Suite, Export, Theme & Account */}
      <div className="toolbar-group">
        <div className="mobile-view-switcher segmented-control" role="group" aria-label="Pane view switcher">
          <button
            type="button"
            className="segmented-control__btn"
            aria-pressed={mobileView === 'code'}
            onClick={() => onChangeMobileView('code')}
          >
            Code
          </button>
          <button
            type="button"
            className="segmented-control__btn"
            aria-pressed={mobileView === 'pdf'}
            onClick={() => onChangeMobileView('pdf')}
          >
            PDF
          </button>
          <button
            type="button"
            className="segmented-control__btn"
            aria-pressed={mobileView === 'split'}
            onClick={() => onChangeMobileView('split')}
          >
            Split
          </button>
        </div>

        <div className="toolbar-group toolbar-authoring-inline">
          <button type="button" className="btn btn-sm" onClick={onOpenVisualTools} title="Math, Tables & Charts">
            <Sigma size={13} aria-hidden="true" />
            <span>Tools</span>
          </button>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              className="btn btn-sm"
              aria-expanded={citationPopoverOpen}
              onClick={() => onSetCitationPopoverOpen(!citationPopoverOpen)}
              title="Citation Quick-Picker (Mod+Shift+K)"
            >
              <BookMarked size={13} aria-hidden="true" />
              <span>Cite</span>
            </button>
            <CitationPickerPopover
              open={citationPopoverOpen}
              bibEntries={bibEntries}
              bibSearchResults={bibSearchResults}
              isSearching={isSearchingCitations}
              selectedStyle={selectedCitationStyle}
              onClose={() => onSetCitationPopoverOpen(false)}
              onSearch={onSearchCitations}
              onLookup={onLookupCitation}
              onImportEntry={onImportBibEntry}
              onInsertCitation={onInsertCitation}
            />
          </div>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            aria-label="Font Manager"
            title="Font Manager (Mod+Shift+F)"
            onClick={onOpenFontManager}
          >
            <Type size={13} aria-hidden="true" />
          </button>

          <button
            type="button"
            className="btn btn-icon btn-sm"
            aria-label="Insert Figure"
            title="Relative Figure Assistant"
            onClick={onOpenFigureAssistant}
          >
            <ImagePlus size={13} aria-hidden="true" />
          </button>

          <button
            type="button"
            className={`btn btn-icon btn-sm ${diagnosticsOpen ? 'btn-primary' : ''}`}
            aria-pressed={diagnosticsOpen}
            aria-label="Toggle Diagnostics Drawer"
            title="Diagnostics & Pre-Flight Drawer (Mod+J)"
            onClick={onToggleDiagnostics}
          >
            <Terminal size={13} aria-hidden="true" />
          </button>
        </div>

        {/* Compact Overflow Menu (<900px) */}
        <div className="toolbar-overflow-desktop-hide" style={{ position: 'relative' }}>
          <button
            type="button"
            className="btn btn-sm"
            aria-expanded={overflowOpen}
            onClick={() => setOverflowOpen((prev) => !prev)}
          >
            Authoring <ChevronDown size={12} aria-hidden="true" />
          </button>
          {overflowOpen && (
            <div className="popover-panel" style={{ width: 200, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button type="button" className="btn btn-sm" onClick={() => { setOverflowOpen(false); onOpenVisualTools(); }}>
                Math, Tables &amp; Charts
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setOverflowOpen(false); onSetCitationPopoverOpen(true); }}>
                Cite (CrossRef / .bib)
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setOverflowOpen(false); onOpenFontManager(); }}>
                Font Manager
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setOverflowOpen(false); onOpenFigureAssistant(); }}>
                Insert Figure
              </button>
              <button type="button" className="btn btn-sm" onClick={() => { setOverflowOpen(false); onToggleDiagnostics(); }}>
                Toggle Diagnostics
              </button>
            </div>
          )}
        </div>

        {/* Export Split Button */}
        <div ref={exportRef} style={{ position: 'relative', display: 'inline-flex' }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={!pdfAvailable}
            onClick={onExportPDF}
            title="Download Compiled PDF (Mod+Shift+E)"
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
          >
            <Download size={12} aria-hidden="true" />
            <span>Export</span>
          </button>
          <button
            type="button"
            className="btn btn-sm"
            aria-label="Submission export options"
            aria-expanded={exportMenuOpen}
            onClick={() => setExportMenuOpen((prev) => !prev)}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none', padding: '0 6px' }}
          >
            <ChevronDown size={12} aria-hidden="true" />
          </button>

          {exportMenuOpen && (
            <div role="dialog" aria-label="Submission export options" className="popover-panel" style={{ width: 290 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>Export PDF &amp; Submission Bundle</div>
              <button
                type="button"
                className="btn btn-sm"
                style={{ width: '100%', justifyContent: 'flex-start', marginBottom: 8 }}
                disabled={!pdfAvailable}
                onClick={() => {
                  onExportPDF();
                  setExportMenuOpen(false);
                }}
              >
                <Download size={13} aria-hidden="true" />
                Download Compiled PDF
              </button>

              <div className="studio-card" style={{ marginTop: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  Submission Bundle (.zip)
                </div>
                {preflightWarningCount > 0 && (
                  <div style={{ fontSize: 11.5, color: 'var(--warning-text)', marginBottom: 6 }}>
                    {preflightWarningCount} Pre-Flight item(s) flagged.{' '}
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ padding: 0, height: 'auto', textDecoration: 'underline' }}
                      onClick={() => {
                        setExportMenuOpen(false);
                        onOpenPreflight();
                      }}
                    >
                      Review Pre-Flight
                    </button>
                  </div>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={stripComments}
                    onChange={(e) => setStripComments(e.target.checked)}
                  />
                  <span>Strip % comments</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, marginBottom: 8 }}>
                  <input
                    type="checkbox"
                    checked={anonymizeZip}
                    onChange={(e) => setAnonymizeZip(e.target.checked)}
                  />
                  <span>Anonymize author metadata</span>
                </label>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%' }}
                  disabled={zipExporting}
                  onClick={() => void handleDownloadZip()}
                >
                  <Archive size={12} aria-hidden="true" />
                  {zipExporting ? 'Bundling .zip...' : 'Export Submission (.zip)'}
                </button>
              </div>
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-icon btn-sm"
          aria-label={`Switch studio theme to ${studioTheme === 'dark' ? 'light' : 'dark'}`}
          title={`Studio Theme: ${studioTheme === 'dark' ? 'Dark' : 'Light'}`}
          onClick={onToggleStudioTheme}
        >
          {studioTheme === 'dark' ? <Sun size={13} aria-hidden="true" /> : <Moon size={13} aria-hidden="true" />}
        </button>

        <UserMenuPopover
          user={user}
          authConfig={authConfig}
          storageStatus={storageStatus}
          syncState={syncState}
          isDirty={isDirty}
          onOpenStorageModal={() => onOpenProjectsModal('storage')}
          onSwitchDevUser={onSwitchDevUser}
          onSaveAndLogout={async () => {
            await onQuickSave();
            await onLogout();
          }}
          onLogout={onLogout}
        />
      </div>
    </header>
  );
};
