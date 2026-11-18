import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, Sparkles, X } from 'lucide-react';
import { WorkspaceProvider, useWorkspaceStore } from './state/useWorkspaceStore';
import { AuthGateView } from './components/auth/AuthGateView';
import { TopToolbar } from './components/layout/TopToolbar';
import { SidebarPanel, type SidebarTabId } from './components/layout/SidebarPanel';
import { DiagnosticsDrawer, type DrawerTabId } from './components/layout/DiagnosticsDrawer';
import { StatusBar } from './components/layout/StatusBar';
import { LaTeXCodeEditor } from './components/editor/LaTeXCodeEditor';
import { PDFPreviewPane } from './components/preview/PDFPreviewPane';
import { B2ProjectManagerModal } from './components/projects/B2ProjectManagerModal';
import { ProjectHistoryModal } from './components/projects/ProjectHistoryModal';
import { ConflictResolutionBanner } from './components/projects/ConflictResolutionBanner';
import { PaperWizardModal } from './components/academic/PaperWizardModal';
import { VisualToolsModal } from './components/academic/VisualToolsModal';
import { FigureAssistantModal } from './components/academic/FigureAssistantModal';
import { FontManagerModal } from './components/academic/FontManagerModal';

function StudioWorkspace(): React.ReactElement {
  const store = useWorkspaceStore();

  const [studioTheme, setStudioTheme] = useState<'light' | 'dark'>('dark');
  const [viewportWidth, setViewportWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    typeof window !== 'undefined' ? window.innerWidth >= 1200 : true
  );
  const [sidebarWidth, setSidebarWidth] = useState<number>(272);
  const [sidebarTab, setSidebarTab] = useState<SidebarTabId>('outline');

  const [splitRatio, setSplitRatio] = useState<number>(0.5);
  const [mobileView, setMobileView] = useState<'code' | 'pdf' | 'split'>('code');

  const [drawerOpen, setDrawerOpen] = useState<boolean>(true);
  const [drawerHeight, setDrawerHeight] = useState<number>(190);
  const [drawerTab, setDrawerTab] = useState<DrawerTabId>('diagnostics');

  // Modals & Popovers
  const [projectsModalState, setProjectsModalState] = useState<{
    open: boolean;
    mode: 'projects' | 'storage' | 'create';
  }>({ open: false, mode: 'projects' });
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [snapshotPopoverOpen, setSnapshotPopoverOpen] = useState(false);
  const [citationPopoverOpen, setCitationPopoverOpen] = useState(false);
  const [wizardState, setWizardState] = useState<{ open: boolean; templateId?: string }>({
    open: false,
  });
  const [visualToolsOpen, setVisualToolsOpen] = useState(false);
  const [figureModalState, setFigureModalState] = useState<{ open: boolean; file: File | null }>({
    open: false,
    file: null,
  });
  const [fontManagerOpen, setFontManagerOpen] = useState(false);
  const [showOnboardingBanner, setShowOnboardingBanner] = useState(true);
  const [liveAnnouncement, setLiveAnnouncement] = useState('');

  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  const captureFocusTrigger = () => {
    if (document.activeElement instanceof HTMLElement) {
      lastTriggerRef.current = document.activeElement;
    }
  };

  const restoreFocusTrigger = () => {
    requestAnimationFrame(() => {
      lastTriggerRef.current?.focus();
    });
  };

  useEffect(() => {
    document.documentElement.setAttribute('data-studio-theme', studioTheme);
  }, [studioTheme]);

  useEffect(() => {
    const onResize = () => {
      setViewportWidth(window.innerWidth);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Announce compile completion politely for screen readers
  useEffect(() => {
    if (store.compilationState.status === 'success') {
      setLiveAnnouncement(
        `PDF Ready in ${store.compilationState.durationMs} milliseconds, ${store.compilationState.pageCount} pages`
      );
    } else if (store.compilationState.status === 'failed') {
      setLiveAnnouncement(`Compilation failed with ${store.compilationState.errorCount} errors`);
    }
  }, [store.compilationState]);

  const handleQuickSave = useCallback(async () => {
    await store.saveProject();
    setLiveAnnouncement('Saved project to Backblaze B2');
  }, [store]);

  // Global Keyboard Shortcuts (docs/ux-spec.md §5.2)
  useEffect(() => {
    if (!store.currentUser) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const key = e.key.toLowerCase();

      if (key === 's' && e.altKey && !e.shiftKey) {
        e.preventDefault();
        setSnapshotPopoverOpen((prev) => !prev);
      } else if (key === 's' && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        void handleQuickSave();
      } else if (key === 'h' && e.altKey) {
        e.preventDefault();
        captureFocusTrigger();
        setHistoryModalOpen(true);
      } else if (key === 'b' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        void store.compileNow();
      } else if (key === 'j' && e.shiftKey) {
        e.preventDefault();
        store.triggerForwardSync();
      } else if (key === 'j' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setDrawerOpen((prev) => !prev);
      } else if (key === 'n' && e.shiftKey) {
        e.preventDefault();
        captureFocusTrigger();
        setWizardState({ open: true });
      } else if (key === 'k' && e.shiftKey) {
        e.preventDefault();
        setCitationPopoverOpen((prev) => !prev);
      } else if (key === 'f' && e.shiftKey) {
        e.preventDefault();
        captureFocusTrigger();
        setFontManagerOpen(true);
      } else if (e.key === '\\' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      } else if (key === ';' && e.altKey) {
        e.preventDefault();
        store.toggleProseSpellCheck(!store.proseSpellCheckEnabled);
      } else if (key === 'e' && e.shiftKey && e.altKey) {
        e.preventDefault();
        void store.exportSubmissionZip();
      } else if (key === 'e' && e.shiftKey && !e.altKey) {
        e.preventDefault();
        store.exportCompiledPDF();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleQuickSave, store]);

  // Splitter Drag Handlers
  const startSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidth;
    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(380, Math.max(240, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startSplitPaneResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const onMove = (moveEvent: MouseEvent) => {
      const ratio = (moveEvent.clientX - rect.left) / Math.max(1, rect.width);
      setSplitRatio(Math.min(0.75, Math.max(0.25, ratio)));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startDrawerResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = drawerHeight;
    const onMove = (moveEvent: MouseEvent) => {
      const next = Math.min(420, Math.max(140, startH - (moveEvent.clientY - startY)));
      setDrawerHeight(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (store.authLoading && !store.currentUser) {
    return (
      <main
        className="auth-gate"
        aria-label="Loading workspace"
        style={{ flexDirection: 'column', gap: 12 }}
      >
        <Loader2 size={28} className="spin-icon" color="var(--accent-text)" aria-hidden="true" />
        <div style={{ fontWeight: 600 }}>Loading your Backblaze B2 workspace...</div>
      </main>
    );
  }

  if (!store.currentUser) {
    return (
      <AuthGateView
        authConfig={store.authConfig}
        authLoading={store.authLoading}
        authError={store.authError}
        onGoogleToken={store.loginWithGoogleToken}
        onDevLogin={store.loginWithDevPersona}
      />
    );
  }

  const isCompactViewport = viewportWidth < 1200;
  const isMobileViewport = viewportWidth < 900;
  const showCodePane = !isMobileViewport || mobileView === 'code' || mobileView === 'split';
  const showPdfPane = !isMobileViewport || mobileView === 'pdf' || mobileView === 'split';
  const preflightWarningCount = store.preflightReport.items.filter((i) => i.severity !== 'pass').length;

  return (
    <div className="studio-shell">
      {/* WCAG 2.1 AA Skip Link */}
      <a href="#latex-code-editor-region" className="skip-link">
        Skip to LaTeX Editor
      </a>

      {/* Polite screen reader announcements */}
      <div className="sr-only" aria-live="polite">
        {liveAnnouncement}
      </div>

      {/* Non-blocking Session Expiry Warning (zero data loss) */}
      {store.authError && (
        <div className="studio-banner studio-banner--warning" role="alert" aria-live="assertive">
          <div className="studio-banner__content">
            <AlertTriangle size={15} aria-hidden="true" />
            <span>{store.authError}</span>
          </div>
          <div className="studio-banner__actions">
            {store.authConfig?.devAuthEnabled && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => void store.loginWithDevPersona(store.currentUser!.email, store.currentUser!.name)}
              >
                Re-authenticate Session
              </button>
            )}
          </div>
        </div>
      )}

      {/* Sync Conflict Recovery Banner */}
      {store.conflictInfo && (
        <ConflictResolutionBanner conflictInfo={store.conflictInfo} onResolve={store.resolveConflict} />
      )}

      {/* First-Time Onboarding Tip Banner */}
      {showOnboardingBanner && store.projects.length <= 1 && !store.activeProject?.lastSnapshotId && (
        <div className="studio-banner studio-banner--info" role="region" aria-label="Getting started tip">
          <div className="studio-banner__content">
            <Sparkles size={14} aria-hidden="true" />
            <span>
              Welcome to LaTeXaP-WeB! Start writing LaTeX3 right away or scaffold a formatted paper.
            </span>
          </div>
          <div className="studio-banner__actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                captureFocusTrigger();
                setWizardState({ open: true });
              }}
            >
              Launch Paper Setup Wizard →
            </button>
            <button
              type="button"
              className="btn btn-icon btn-ghost btn-sm"
              aria-label="Dismiss welcome banner"
              onClick={() => setShowOnboardingBanner(false)}
            >
              <X size={13} aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <TopToolbar
        user={store.currentUser}
        authConfig={store.authConfig}
        storageStatus={store.storageStatus}
        activeProject={store.activeProject}
        projectFiles={store.projectFiles}
        isDirty={store.isDirty}
        syncState={store.syncState}
        compilationState={store.compilationState}
        autoCompileEnabled={store.autoCompileEnabled}
        studioTheme={studioTheme}
        sidebarOpen={sidebarOpen}
        diagnosticsOpen={drawerOpen}
        mobileView={mobileView}
        bibEntries={store.bibEntries}
        bibSearchResults={store.bibSearchResults}
        isSearchingCitations={store.isSearchingCitations}
        selectedCitationStyle={store.selectedCitationStyle}
        preflightWarningCount={preflightWarningCount}
        pdfAvailable={Boolean(store.pdfBytes)}
        snapshotPopoverOpen={snapshotPopoverOpen}
        citationPopoverOpen={citationPopoverOpen}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        onToggleDiagnostics={() => setDrawerOpen((prev) => !prev)}
        onChangeMobileView={setMobileView}
        onOpenProjectsModal={(mode) => {
          captureFocusTrigger();
          setProjectsModalState({ open: true, mode });
        }}
        onQuickSave={handleQuickSave}
        onSetSnapshotPopoverOpen={setSnapshotPopoverOpen}
        onSaveWithMessage={async (msg) => {
          await store.saveProject(msg);
          setLiveAnnouncement(`Saved snapshot: ${msg}`);
        }}
        onToggleAutoCompile={() => store.setAutoCompileEnabled(!store.autoCompileEnabled)}
        onCompileNow={store.compileNow}
        onForwardSync={() => store.triggerForwardSync()}
        onOpenVisualTools={() => {
          captureFocusTrigger();
          setVisualToolsOpen(true);
        }}
        onSetCitationPopoverOpen={setCitationPopoverOpen}
        onSearchCitations={store.searchCitations}
        onLookupCitation={store.lookupCitationByIdentifier}
        onImportBibEntry={store.importBibEntry}
        onInsertCitation={store.insertFormattedCitation}
        onOpenFontManager={() => {
          captureFocusTrigger();
          setFontManagerOpen(true);
        }}
        onOpenFigureAssistant={() => {
          captureFocusTrigger();
          setFigureModalState({ open: true, file: null });
        }}
        onExportPDF={store.exportCompiledPDF}
        onExportZip={store.exportSubmissionZip}
        onOpenPreflight={() => {
          setDrawerOpen(true);
          setDrawerTab('preflight');
        }}
        onToggleStudioTheme={() => setStudioTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))}
        onSwitchDevUser={store.loginWithDevPersona}
        onLogout={store.logout}
      />

      <main aria-label="LaTeX Studio Workspace" className="workspace-body">
        {sidebarOpen && (
          <>
            <SidebarPanel
              width={sidebarWidth}
              isOverlay={isCompactViewport}
              activeTab={sidebarTab}
              projects={store.projects}
              activeProject={store.activeProject}
              storageStatus={store.storageStatus}
              isDirty={store.isDirty}
              sourceText={store.sourceText}
              outlineItems={store.outlineItems}
              customFonts={store.customFonts}
              bibEntries={store.bibEntries}
              bibSearchResults={store.bibSearchResults}
              isSearchingCitations={store.isSearchingCitations}
              selectedBibliographyStyle={store.selectedBibliographyStyle}
              studentModeHideExpl3={store.rubricTargets.studentModeHideExpl3}
              onSelectTab={setSidebarTab}
              onSwitchProject={store.switchProject}
              onOpenNewProject={() => {
                captureFocusTrigger();
                setProjectsModalState({ open: true, mode: 'create' });
              }}
              onOpenStorageModal={() => {
                captureFocusTrigger();
                setProjectsModalState({ open: true, mode: 'storage' });
              }}
              onOpenHistoryModal={() => {
                captureFocusTrigger();
                setHistoryModalOpen(true);
              }}
              onSelectOutlineItem={(line) => {
                store.jumpToSourceLine(line);
                store.triggerForwardSync(line);
              }}
              onInsertPackage={store.insertPackage}
              onUploadFont={store.uploadCustomFont}
              onApplyFontToDocument={store.applyFontToDocument}
              onOpenFontManager={() => {
                captureFocusTrigger();
                setFontManagerOpen(true);
              }}
              onChangeBibliographyStyle={store.applyBibliographyStyle}
              onSearchCitations={store.searchCitations}
              onLookupIdentifier={store.lookupCitationByIdentifier}
              onImportBibEntry={store.importBibEntry}
              onImportBibFile={store.importBibFile}
              onInsertCitation={store.insertFormattedCitation}
              onInsertText={store.insertTextAtCaret}
              onApplyTemplate={store.applyTemplate}
              onOpenWizard={(tplId) => {
                captureFocusTrigger();
                setWizardState({ open: true, templateId: tplId });
              }}
            />
            {!isCompactViewport && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize sidebar"
                className="splitter-vertical"
                onMouseDown={startSidebarResize}
              />
            )}
          </>
        )}

        <div className="studio-center">
          <div ref={splitContainerRef} className="split-panes">
            {/* Left Split Pane: LaTeX3 Code Editor */}
            <section
              aria-label="LaTeX3 Source Editor"
              className={`studio-pane ${!showCodePane ? 'is-hidden-mobile' : ''}`}
              style={{ width: showPdfPane ? `${splitRatio * 100}%` : '100%' }}
            >
              <LaTeXCodeEditor
                activeFilePath={store.activeFilePath}
                projectFiles={store.projectFiles}
                sourceText={store.sourceText}
                editorTheme={store.editorTheme}
                editorFontFamily={store.editorFontFamily}
                editorFontSize={store.editorFontSize}
                customFonts={store.customFonts}
                diagnostics={store.diagnostics}
                demystifiedDiagnostics={store.demystifiedDiagnostics}
                bibEntries={store.bibEntries}
                proseSpellCheckEnabled={store.proseSpellCheckEnabled}
                spellingIssues={store.spellingIssues}
                studentModeHideExpl3={store.rubricTargets.studentModeHideExpl3}
                pendingInsertion={store.pendingInsertion}
                pendingJumpToLine={store.pendingJumpToLine}
                onChangeSource={store.setSourceText}
                onChangeFile={store.setActiveFilePath}
                onCursorLineChange={store.setCursorLine}
                onConsumePendingInsertion={store.consumePendingInsertion}
                onChangeTheme={store.setEditorTheme}
                onChangeTypography={store.setEditorTypography}
                onToggleSpellCheck={store.toggleProseSpellCheck}
                onApplySpellingSuggestion={store.applySpellingSuggestion}
                onIgnoreSpellingWord={store.ignoreSpellingWord}
                onApplyFix={(diag) => {
                  if (diag.fixOperation) {
                    store.applyAcademicFix(diag.fixOperation);
                    setLiveAnnouncement(`Applied fix: ${diag.fixButtonTitle ?? diag.shortTitle}`);
                  }
                }}
                onDropFigure={(file) => {
                  captureFocusTrigger();
                  setFigureModalState({ open: true, file });
                }}
                onDropBib={(file) => void store.importBibFile(file)}
                onDropFont={(file) => void store.uploadCustomFont(file)}
              />
            </section>

            {showCodePane && showPdfPane && (
              <div
                role="separator"
                aria-orientation="vertical"
                aria-label="Resize editor and PDF preview split"
                className="splitter-vertical split-pane-divider"
                onMouseDown={startSplitPaneResize}
              />
            )}

            {/* Right Split Pane: Client-Side Live PDF Preview */}
            <section
              aria-label="Client-Side PDF Preview"
              className={`studio-pane ${!showPdfPane ? 'is-hidden-mobile' : ''}`}
              style={{ flex: 1 }}
            >
              <PDFPreviewPane
                pdfBytes={store.pdfBytes}
                compilationState={store.compilationState}
                autoCompileEnabled={store.autoCompileEnabled}
                forwardSyncBox={store.forwardSyncBox}
                onBackwardSync={store.triggerBackwardSync}
                onExportPDF={store.exportCompiledPDF}
                onCompileNow={store.compileNow}
              />
            </section>
          </div>

          {drawerOpen && (
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize diagnostics drawer"
              className="splitter-horizontal"
              onMouseDown={startDrawerResize}
            />
          )}

          <DiagnosticsDrawer
            open={drawerOpen}
            height={drawerHeight}
            activeTab={drawerTab}
            demystifiedDiagnostics={store.demystifiedDiagnostics}
            preflightReport={store.preflightReport}
            texLogText={store.texLogText}
            contextAdvice={store.contextAdvice}
            onSelectTab={setDrawerTab}
            onClose={() => setDrawerOpen(false)}
            onJumpToLine={store.jumpToSourceLine}
            onApplyFix={(op) => {
              store.applyAcademicFix(op);
              setLiveAnnouncement('Applied diagnostic fix');
            }}
            onOpenCitationsTab={() => {
              setSidebarOpen(true);
              setSidebarTab('bibtex');
            }}
            onInsertSnippet={(s) => store.insertTextAtCaret(s, 0)}
            onInsertPackage={store.insertPackage}
          />
        </div>
      </main>

      <StatusBar
        diagnostics={store.diagnostics}
        preflightReport={store.preflightReport}
        academicStats={store.academicStats}
        rubricTargets={store.rubricTargets}
        syncState={store.syncState}
        storageStatus={store.storageStatus}
        onToggleDiagnostics={() => setDrawerOpen((prev) => !prev)}
        onOpenPreflight={() => {
          setDrawerOpen(true);
          setDrawerTab('preflight');
        }}
        onOpenHistory={() => {
          captureFocusTrigger();
          setHistoryModalOpen(true);
        }}
        onUpdateRubricTargets={store.updateRubricTargets}
      />

      {/* Modals */}
      <B2ProjectManagerModal
        open={projectsModalState.open}
        initialMode={projectsModalState.mode}
        projects={store.projects}
        activeProject={store.activeProject}
        storageStatus={store.storageStatus}
        isDirty={store.isDirty}
        onClose={() => {
          setProjectsModalState((prev) => ({ ...prev, open: false }));
          restoreFocusTrigger();
        }}
        onCreateProject={store.createProject}
        onSwitchProject={store.switchProject}
        onSaveAndSwitchProject={async (slug) => {
          await store.saveProject();
          await store.switchProject(slug);
        }}
        onRenameProject={store.renameProject}
        onDuplicateProject={store.duplicateProject}
        onDeleteProject={store.deleteProject}
        onTestStorage={store.testStorageConnection}
        onSyncNow={() => store.saveProject()}
        onOpenWizardAfterCreate={() => setWizardState({ open: true })}
      />

      <ProjectHistoryModal
        open={historyModalOpen}
        projectName={store.activeProject?.displayName ?? 'Project'}
        snapshots={store.snapshots}
        onClose={() => {
          setHistoryModalOpen(false);
          restoreFocusTrigger();
        }}
        onPreviewSnapshot={store.previewSnapshot}
        onRestoreSnapshot={store.restoreSnapshot}
      />

      <PaperWizardModal
        open={wizardState.open}
        initialTemplateId={wizardState.templateId}
        isDirty={store.isDirty}
        onClose={() => {
          setWizardState({ open: false });
          restoreFocusTrigger();
        }}
        onApply={store.applyPaperSetupWizard}
      />

      <VisualToolsModal
        open={visualToolsOpen}
        onClose={() => {
          setVisualToolsOpen(false);
          restoreFocusTrigger();
        }}
        onInsertMath={(tex) => store.insertTextAtCaret(tex, 0)}
        onInsertTable={store.insertSpreadsheetTable}
        onInsertChart={store.insertPGFPlotChart}
      />

      <FigureAssistantModal
        open={figureModalState.open}
        initialFile={figureModalState.file}
        onClose={() => {
          setFigureModalState({ open: false, file: null });
          restoreFocusTrigger();
        }}
        onUploadAndInsert={store.uploadAndInsertFigure}
      />

      <FontManagerModal
        open={fontManagerOpen}
        customFonts={store.customFonts}
        onClose={() => {
          setFontManagerOpen(false);
          restoreFocusTrigger();
        }}
        onUploadFont={store.uploadCustomFont}
        onRenameFont={store.renameCustomFont}
        onDeleteFont={store.deleteCustomFont}
        onApplyFontToDocument={store.applyFontToDocument}
      />
    </div>
  );
}

export function App(): React.ReactElement {
  return (
    <WorkspaceProvider>
      <StudioWorkspace />
    </WorkspaceProvider>
  );
}

export default App;
