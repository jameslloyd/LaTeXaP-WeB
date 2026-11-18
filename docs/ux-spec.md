# LaTeXaP-WeB — Comprehensive UX & Accessibility Specification

> **Scope:** End-to-end user journeys, responsive layout hierarchy, interaction states, microcopy, and WCAG 2.1 AA accessibility specification for **LaTeXaP-WeB** — the multi-user web IDE port of macOS **LaTeXaP** (`v0.3.2`).  
> **Source Baseline:** Translated from `/Users/james/code/LaTeXaP/README.md`, `docs/academic-suite-ux.md`, `docs/custom-fonts-ux.md`, `docs/github-repo-storage-ux.md`, and `Sources/LaTeXaP/`.  
> **Non-goals:** Backend implementation details, API schemas, and source code edits (owned by `@architect`, `@developer`, and `@ui-specialist`).

---

## 1. UX Design Principles & Web Translation Strategy

1. **Desktop-Class Studio Ergonomics in the Browser**: Preserve LaTeXaP's calm 3-zone spatial layout (Left Navigation/Tool Sidebar, Split LaTeX3 Editor + Client-Side PDF Preview, Collapsible Bottom Diagnostics Drawer) with zero modal clutter during active writing.
2. **Client-Side Speed & Transparency**: Every compilation runs in the browser via WebAssembly (WASM) Web Workers, surfaced through clear, honest telemetry (`Compiling in Browser (WASM)...`, `PDF Ready • 142 ms`) so users know their document compiles locally without waiting on remote build queues.
3. **Zero Cloud/Storage Jargon**: Users think in terms of **Projects** (e.g., *"CS229 Final Paper"*), **Cloud Sync (`Synced to B2`)**, and **Saved Versions (Snapshots)** — never S3 bucket keys, object prefixes, or raw HTTP retries.
4. **Hide Boilerplate, Keep Source Transparent**: Every Academic Suite builder (Paper Wizard, Citation Picker, Table Grid, `pgfplots` Chart, Figure Assistant, Font Manager) previews the exact LaTeX3/XeTeX code it inserts into the editor.
5. **Safe by Default for Deadlines & Multi-User Sessions**: Never lose typed LaTeX source on network dropouts, B2 unavailability, or expired Google sessions. Stage unsaved edits locally in IndexedDB/localStorage and recover seamlessly.
6. **Universal Web Accessibility**: Translate macOS VoiceOver/NSAccessibility patterns into semantic HTML5 landmarks, WAI-ARIA 1.2 widgets, cross-platform `Ctrl`/`⌘` keyboard shortcuts that avoid browser-reserved tab/window chords, and high-contrast Light & Dark studio themes.

---

## 2. Global Workspace Architecture & Responsive Shell

### 2.1 Top Application Toolbar (`52 px` height, `role="banner"`)
Organized into three balanced horizontal groups (`Left: Workspace & Cloud`, `Center: WASM Compile & SyncTeX`, `Right: Authoring Suite & Account`):

| Group | Controls (Left → Right) | Behavior / Notes |
|---|---|---|
| **Workspace & Cloud** | **Sidebar Toggle** (`Ctrl/Cmd+\`) • **App Brand** (`LaTeXaP-WeB`) • **Active Project Pill** (`CS229 Final Paper ▾`) • **Save & Snapshot** (`Ctrl/Cmd+S`) • **Save with Message...** (`Ctrl/Cmd+Alt+S`) • **Cloud Sync Status Pill** (`Synced to B2` / `Saving...` / `Offline / Local Fallback`) | Clicking the Project Pill opens the Project Switcher menu; clicking the Sync Status Pill opens the **Backblaze B2 Storage & Connection Modal**. |
| **WASM Compile & SyncTeX** | **Compile Status Badge** (`Compiling in Browser (WASM)...` / `PDF Ready • 142 ms` / `N Errors`) • **Auto-Compile Toggle Pill** (`Auto-Compile: ON` / `Paused`) • **Compile Now** (`Ctrl/Cmd+B`) • **Sync PDF** (`Ctrl/Cmd+Shift+J`) | Compile Status Badge opens Diagnostics Drawer on click when errors/warnings exist. |
| **Authoring & Account** | **Math & Tables** • **Cite** (`Ctrl/Cmd+Shift+K`) • **Fonts** (`Ctrl/Cmd+Shift+F`) • **Insert Figure** • **Diagnostics** (`Ctrl/Cmd+J`) • **Export Menu** (`Export PDF` / `Export Submission (.zip)`) • **Theme Toggle** (`Light` / `Dark`) • **Google User Profile Badge** (`Avatar + Name ▾`) | Export Menu uses a split button (primary click downloads PDF; chevron opens Submission `.zip` with Pre-Flight check). |

### 2.2 Three-Zone Studio Layout
- **Left Sidebar (`240–340 px`, resizable, collapsible)**:
  - **Pinned Top Strip — Cloud Workspace & Project Switcher**: Displays current user's active B2 workspace status (`B2 Cloud` or `Local Fallback`), active project selector dropdown, **`+ New Project`**, and **`Version History`** (`Ctrl/Cmd+Alt+H`).
  - **6-Tab Icon + Label Rail (`role="tablist"`)**:
    1. `Outline` — Hierarchical document sections (`\section`, `\subsection`, `\ExplSyntaxOn` blocks, `\NewDocumentCommand` macros) with 1-click Editor + Forward SyncTeX jump.
    2. `Packages` — Searchable CTAN package catalog (`amsmath`, `mathtools`, `booktabs`, `siunitx`, `tikz`, `pgfplots`, `cleveref`, `fontspec`, `expl3`, `xparse`, etc.) with `Added` / `+ Insert` badges.
    3. `Fonts` — Custom `.ttf`/`.otf`/`.ttc` upload dropzone, CTAN font presets, Document `fontspec` roles (`Main`, `Sans`, `Mono`), and Editor monospace font selector.
    4. `BibTeX` — Bibliography style selector, `.bib` upload/dropzone, CrossRef/DOI/arXiv/ISBN search, saved entries with `Uncited` badges, and `\label` cross-references.
    5. `LaTeX3` — Curated `expl3` + `xparse` snippet library (`\NewDocumentCommand`, `l3seq`, `l3clist`, `l3keys`, `l3int`) with 3-line code preview and 1-click insert.
    6. `Templates` — Categorized starter gallery (`Academic Papers`, `STEM & Theses`, `LaTeX3 Core`) + **`New with Setup Wizard...`** primary CTA.
- **Center Split-Pane Studio (`flex: 1`)**:
  - **Left Pane — LaTeX3 Code Editor** (`min-width: 360 px` on desktop, draggable splitter):
    - **Editor Header Bar (`36 px`)**: File name (`main.tex`) + `• LaTeX3` indicator (hidden when Student Mode is enabled) | **Spellcheck Toggle** (`Ctrl/Cmd+Alt+;` with issue count badge) | **Editor Font Pill** (`JetBrains Mono 14pt`) | **Editor Surface Toggle** (`Light` / `Dark`) | **Cursor Position** (`Ln 42, Col 18`).
    - **Code Surface**: Line numbers gutter, diagnostic markers (red error octagon / amber warning triangle with hover popover), active line highlight, `expl3`/`xparse` syntax highlighting, inline ghost completions, floating autocomplete popup, and drag-and-drop overlay for images (`.png`/`.jpg`/`.pdf`/`.svg`), `.bib`, and font files (`.ttf`/`.otf`/`.ttc`).
  - **Right Pane — Client-Side Live PDF Preview** (`min-width: 360 px` on desktop):
    - **Preview Header Bar (`36 px`)**: `Live PDF Preview` | `Auto-Compile Active` pill | SyncTeX hint (`Ctrl/Cmd+Click PDF to jump to line`) | **Page Navigation** (`‹ Page 2 / 6 ›`) | **Zoom Controls** (`−`, `100% ▾` with Fit Width / Fit Page, `+`) | **Download PDF** quick icon.
    - **Canvas Surface**: Continuous scrollable PDF pages rendered client-side, preserving scroll position across live rebuilds, with animated yellow SyncTeX highlight rectangle (`1.8 s` fade) on Forward Sync.
- **Bottom Collapsible Drawer (`160–340 px`, resizable)**:
  - **4 Tabs (`role="tablist"`)**: `Diagnostics (N)` | `Pre-Flight (M)` | `TeX Transcript` | `Context Suggestions (K)`.
- **Bottom Status Bar (`28 px`, `role="contentinfo"`)**:
  - Left: `0 Errors • 1 Warning` (toggles drawer) • `Pre-Flight Ready` / `Pre-Flight: 2` (opens Pre-Flight tab) • Active diagnostic summary or B2 sync toast.
  - Right: `B2 Synced • 2m ago` (opens Version History) • **Clickable Word/Page Budget Pill** (`2,140 / 2,500 words • 6/8p`) • `14 math` • `28 expl3` (hidden in Student Mode) • `Engine: Browser WASM (XeTeX + LaTeX3 + SyncTeX)`.

### 2.3 Responsive Breakpoints
| Viewport Width | Layout Behavior |
|---|---|
| **`>= 1200 px` (Desktop Studio)** | Full 3-zone layout: Sidebar (`260 px` default) + 50/50 Split Editor & PDF Preview + Bottom Drawer. |
| **`900 px – 1199 px` (Compact Laptop)** | Sidebar collapses by default into a slide-over drawer (`Overlay` with backdrop) to keep split Editor + PDF Preview comfortable (`>= 420 px` each). |
| **`< 900 px` (Tablet / Mobile)** | Single-pane focus with top segmented view switcher (**`Code`** \| **`PDF`** \| **`Split`** on tablet) and slide-over Sidebar + full-width bottom sheet for Diagnostics. Toolbar collapses secondary authoring tools into an **`Authoring Tools ▾`** overflow menu. |

---

## 3. End-to-End User Journeys

### 3.1 Google Authentication & Multi-User Onboarding

#### Flow A: First-Time / Unauthenticated Entry
1. **Landing / Sign-In Gate**:
   - Presents a focused, centered **Studio Welcome Card** over a subtle blurred preview of the LaTeXaP-WeB IDE so users immediately understand the product context.
   - **Card Hierarchy**:
     1. LaTeXaP-WeB emblem + headline: *"Modern LaTeX3 & Academic Paper Studio"*.
     2. Concise value props (3 bullets): *"Client-side Browser WASM PDF rendering"*, *"Multi-project cloud storage in Backblaze B2"*, *"Citation, Table, Chart & Pre-Flight Academic Suite"*.
     3. **Primary Auth Action**: Official **`Sign in with Google`** button (when `GOOGLE_CLIENT_ID` is configured via Google Identity Services).
     4. **Dev / Demo Mode Action** (shown automatically when `GOOGLE_CLIENT_ID` is unconfigured, or via expandable `"Developer / Evaluation Login"`):
        - Clear info banner: *"Google OAuth is running in Local Dev Mode (`GOOGLE_CLIENT_ID` not configured)."*
        - **1-Click Primary CTA**: **`Continue with Demo Google Account`** (signs in as `Ada Lovelace <ada@latexap.dev>`).
        - **Multi-User Switcher Link**: **`Sign in as Another Demo User...`** offering preset personas (`Ada Lovelace <ada@latexap.dev>`, `Carl Gauss <gauss@latexap.dev>`) or custom Name + Email input so multi-user isolation in B2 can be tested in 1 click.
2. **Post-Auth Hydration**:
   - Shows lightweight skeleton/progress state (`"Loading your Backblaze B2 workspace..."`).
   - If the user has existing projects in `users/<userId>/projects/`, loads the most recently active project and triggers initial WASM compilation.
   - If the user is brand new (0 projects), loads the default **Welcome / LaTeX3 Showcase** starter project and offers an optional dismissible banner: **`New here? Launch the Academic Paper Setup Wizard →`**.

#### Flow B: User Profile Badge, Session Status & Sign-Out
- **Profile Badge (Top-Right Toolbar)**:
  - Displays circular user avatar (Google photo or initials fallback), display name (truncated cleanly on compact screens), and subtle auth mode indicator (`Google` or `Demo`).
  - Clicking opens the **Account & Session Popover**:
    - Avatar, Full Name, Email, User ID (`sub`), and Auth Provider (`Google OAuth 2.0` or `Dev Demo Google Session`).
    - **Session Status**: Green dot + `"Session Active"` (or amber `"Session expiring soon — Re-authenticate"`).
    - **Workspace Storage Quick Link**: `"Backblaze B2 Status: Synced"` → opens B2 Connection Modal.
    - **Switch Demo Account** (Dev mode only) to test multi-user project isolation.
    - **Sign Out** button.
- **Session Expiry While Editing (Zero Data Loss)**:
  - If an API call returns `401 Unauthorized` while the user is typing:
    - Do **not** kick the user out to the login screen or clear the editor.
    - Show a non-blocking top warning banner: **`"Your Google session expired. Typing & local WASM preview continue working. Sign in again to resume Backblaze B2 sync."`** with a **`Re-authenticate with Google`** button.
- **Sign-Out Guard**:
  - If the active project has unsaved edits (`isDirty == true`), show a confirmation dialog: **`"Save project to Backblaze B2 before signing out?"`** with **`Save & Sign Out`**, **`Sign Out Without Saving`** (destructive), and **`Cancel`**.

---

### 3.2 Backblaze B2 Cloud Workspace & Project Switcher

#### Flow A: Cloud Sync Status Indicators (Always Visible, Never Ambiguous)
Every sync state pairs an explicit icon, color, and human-readable label in both the **Top Toolbar Sync Pill** and the **Sidebar Workspace Strip**:

| State | Icon & Visual | Toolbar Label | Tooltip / Popover Detail |
|---|---|---|---|
| **Synced to B2** | Green cloud-check (`cloud-check`) | `Synced to B2` | `"All files saved to Backblaze B2 • Last synced 14:22"` |
| **Saving...** | Animated spinner (`loader`) | `Saving...` | `"Uploading main.tex & references.bib to Backblaze B2..."` |
| **Unsaved Changes** | Amber dot + pencil | `Unsaved` | `"Local edits pending — Press Ctrl/Cmd+S to save & snapshot"` |
| **Sync Error** | Red alert triangle | `B2 Sync Error` | `"Upload failed (503). Edits preserved locally."` + **`Retry Sync`** button |
| **Offline / Local Fallback** | Slate/Amber cloud-off (`cloud-off`) | `Offline / Local Fallback` | `"Using local filesystem storage fallback (B2 credentials not configured or offline)."` |

#### Flow B: B2 Connection Settings & Status Modal
Triggered by clicking the **Cloud Sync Status Pill**, Sidebar **B2 Settings (`⚙`)**, or Profile Popover **Storage Status**.
- **Header**: `Backblaze B2 Cloud Storage` + close button (`Esc`).
- **Connection Summary Card**:
  - **Storage Mode Badge**: `Connected to Backblaze B2` (green) or `Local Filesystem Fallback` (amber, with note: *"B2 environment variables are not set on the server; projects are persisted safely on the server filesystem under your user namespace."*).
  - **Read-Only Configuration Diagnostics** (keys never exposed to client):
    - **Bucket Name**: e.g., `latexap-web-workspaces` (or `local-fallback-store`)
    - **User Namespace Prefix**: `users/<userId>/projects/`
    - **Endpoint Region**: e.g., `s3.us-west-004.backblazeb2.com`
    - **Active Project Storage**: File count & total size (e.g., `7 files • 1.4 MB`)
    - **Last Sync Timestamp** & **Last Snapshot ID**
- **Actions**:
  - **`Test B2 Connection`**: Runs server-side health check and shows latency (`"Connected • 84 ms"`) or actionable error.
  - **`Sync Now`**: Forces immediate upload/reconciliation of current project files.
  - **Auto-Save Preference Toggle**: `"Auto-save edits to B2 every 30 seconds"` (on by default; manual `Ctrl/Cmd+S` creates an explicit named/timestamped version snapshot).

#### Flow C: Creating, Switching, Renaming & Deleting Projects
- **Project Switcher Dropdown (Toolbar & Sidebar Top Strip)**:
  - Lists all projects belonging to the signed-in user (`users/<userId>/projects/<slug>/`), displaying:
    - Project Display Name (e.g., `CS229 Final Paper`)
    - Template / Format tag (`IEEE`, `APA 7`, `LaTeX3`)
    - Relative last-modified timestamp (`12m ago`) + sync indicator
    - Overflow `•••` menu per non-active project: **Rename**, **Duplicate**, **Delete**.
  - Sticky footer actions: **`+ New Project...`** and **`Version History...` (`Ctrl/Cmd+Alt+H`)**.
- **Create New Project Modal (`480 px` wide)**:
  - **Project Name** input (e.g., `"NeurIPS Workshop Paper"`).
  - **Live Slug Preview**: `users/.../projects/neurips-workshop-paper/` (editable, validated lowercase `[a-z0-9-]`, checks uniqueness against existing projects).
  - **Starting Point** radio group:
    1. `Academic Paper Setup Wizard...` (opens Paper Wizard after creation)
    2. `Blank LaTeX3 Document`
    3. `Duplicate / Import Current Editor Document`
  - **Primary CTA**: **`Create Project in B2`** (creates `main.tex`, `references.bib`, `figures/`, `project.json`, initial snapshot, and opens it immediately).
- **Switching Projects with Unsaved Edits**:
  - If active project has unsaved edits, prompt: **`"Save changes to '<Current Project>' before switching?"`** → **`Save & Switch`** | **`Discard & Switch`** | **`Cancel`**.
- **Deleting a Project**:
  - Requires explicit confirmation modal naming the project (`"Delete 'Physics Lab 3'? This removes all files and snapshots from your B2 workspace."`).

#### Flow D: Saving, Snapshotting & Version Restore
1. **Quick Save & Snapshot (`Ctrl/Cmd+S`)**:
   - Writes dirty project files (`main.tex`, `references.bib`, `project.json`, `figures/`) to B2 (or Local Fallback) and creates an automatic timestamped snapshot: `Save <Project Name> — YYYY-MM-DD HH:mm`.
   - Never blocks typing or WASM compilation.
2. **Save & Snapshot with Custom Message (`Ctrl/Cmd+Alt+S`)**:
   - Opens compact popover (`360 px` wide) anchored to toolbar:
     - **Changed Files List**: `M main.tex`, `A figures/loss_curve.png`, `M references.bib`.
     - **Snapshot Label Input**: Pre-filled & auto-selected with `Save <Project Name> — YYYY-MM-DD HH:mm` + 1-click prefix chips (`Draft:`, `Revisions:`, `Citations:`, `Submission:`).
     - **Primary CTA**: **`Save & Snapshot`** (`Ctrl/Cmd+Enter`).
3. **Version History & Restore Modal (`Ctrl/Cmd+Alt+H`, `720 × 520 px`)**:
   - **Left Pane (`260 px`)**: Chronological list of B2 snapshots for the active project (label, relative time, short snapshot ID, file count).
   - **Right Pane**: Read-only syntax-highlighted preview of `main.tex` (with file selector tabs if `references.bib` or `project.json` also changed) + line delta summary (`+42 / -11 lines`).
   - **Restore Flow**: **`Restore This Version`** → confirmation prompt → creates a **new forward snapshot** (`"Restored to snapshot from <timestamp>"`), loads restored files into the editor, and triggers WASM recompile. Full history remains intact.
4. **Optimistic Concurrency / Sync Conflict Recovery**:
   - If another browser tab or device updated the same project in B2 since the current session loaded (`409 Conflict`), show a non-destructive **Sync Conflict Banner & Modal** offering **`Keep My Local Version`** (overwrite with new snapshot), **`Use B2 Cloud Version`** (pull latest), or **`Save Copy as New Project`**, while pausing auto-save until resolved.

---

### 3.3 Client-Side Web PDF Rendering & Split-Pane Studio

#### Flow A: Live Client-Side WASM Compilation Lifecycle
- **Debounced Live Compilation**:
  - When `Auto-Compile` is ON, edits trigger a `450 ms` debounce timer, then dispatch project files (`main.tex`, `.bib`, `figures/`, custom `.ttf`/`.otf` fonts) to the browser's WASM TeX Web Worker.
  - Typing never stutters; stale in-flight builds are superseded cleanly when newer edits arrive.
- **Compilation Status Indicators (Toolbar Badge + PDF Canvas Overlay)**:
  - `Compiling in Browser (WASM)...` (animated spinner pill; if no PDF has rendered yet, PDF pane shows centered translucent card: *"Compiling LaTeX3 document in Browser (WASM)..."* with step hint).
  - `PDF Ready • 142 ms` (green check pill showing exact client-side compile duration).
  - `N Errors • 185 ms` (red pill; keeps last valid PDF visible at subtle `92%` opacity with a top non-blocking banner *"Showing previous PDF — fix N error(s) in editor to update"* so authors can still read their paper while fixing a typo!).
  - `Auto-Compile: Paused` (user toggled off; manual **`Compile` (`Ctrl/Cmd+B`)** button remains active).

#### Flow B: LaTeX3 (`expl3` + `xparse`) Editor Ergonomics
- **Syntax Highlighting**: Distinct high-contrast token classes for `expl3` namespaces/signatures (`\module_func:Npn`, `\l_tmpa_tl`, `\ExplSyntaxOn`/`\ExplSyntaxOff`), `xparse` definitions (`\NewDocumentCommand`, `\DeclareDocumentCommand`), standard LaTeX commands, `\begin{...}`/`\end{...}` environments, `$...$` / `\[...\]` math, macro parameters (`#1`, `##1`), and `% comments`.
- **Line Numbers & Diagnostics Gutter**:
  - Displays line numbers, active line highlight, and inline red/amber gutter badges. Hovering or clicking a gutter icon shows a floating tooltip with the plain-English summary and **`Apply Fix`** button (if available), or focuses that row in the Diagnostics Drawer.
- **Context-Aware Autocompletion & Ghost Text**:
  - Triggered automatically on `\`, `\begin{`, `\usepackage{`, `\cite{`, `\ref{`, or manually via `Ctrl+Space`.
  - Suggests: `expl3`/`xparse` functions with argument signatures, environment expansions (`\begin{...}...\end{...}`), CTAN packages, saved `.bib` citation keys (showing author/year preview), document `\label{...}` keys, and user-defined macros parsed live from the buffer.
  - `Tab` or `Enter` accepts; `Esc` dismisses.
- **Structure Outline (Sidebar Tab 1)**:
  - Parses `\part`, `\chapter`, `\section`, `\subsection`, `\subsubsection`, `\ExplSyntaxOn` blocks, and `\NewDocumentCommand` definitions into an indented tree with color-coded badges (`sec`, `expl3`, `xparse`, `env`).
  - Clicking an item jumps the editor caret to that line **and** triggers Forward SyncTeX in the PDF preview.
- **Context Suggestions (Diagnostics Drawer Tab 4)**:
  - Inspects cursor region (`Empty Document`, `Preamble`, `LaTeX3 Block`, `Math Environment`, `Table / Figure`, `Body Prose`) and surfaces relevant 1-click code & package insertion cards.

#### Flow C: Interactive Client-Side PDF Preview & Bidirectional SyncTeX
- **Toolbar Controls**:
  - **Page Navigation**: `‹` Prev, editable current page input (`2` of `6`), `›` Next. Updating scroll position updates the current page readout live.
  - **Zoom Controls**: `−` (`-15%`), Zoom Dropdown (`50%`, `75%`, `100%`, `125%`, `150%`, `200%`, `Fit Width`, `Fit Page`), `+` (`+15%`), plus `Ctrl/Cmd + Scroll` pinch/wheel zoom.
- **Forward SyncTeX (Editor → PDF)**:
  - Triggered by toolbar **`Sync PDF`** (`Ctrl/Cmd+Shift+J`) or clicking an Outline item.
  - Smoothly scrolls PDF canvas to the target page/rect and paints a semi-transparent amber-yellow highlight box that fades out cleanly after `1.8 s`.
- **Backward SyncTeX (PDF → Editor)**:
  - Triggered by **`Ctrl/Cmd + Click`** or **Double-Click** anywhere on a rendered PDF page.
  - Scrolls the editor to the mapped `.tex` line, places the caret there, and flashes a subtle `1.2 s` line highlight.
- **Export Actions**:
  - **Download PDF (`Ctrl/Cmd+Shift+E`)**: Downloads `<project-slug>.pdf` directly from the client-side WASM compiled PDF blob.
  - **Export Submission Bundle (`.zip`) (`Ctrl/Cmd+Shift+Alt+E`)**: Runs Pre-Flight check first; if blockers/warnings exist, offers **`Review Pre-Flight`** vs **`Export Anyway`**. Shows compact export options (**Strip `%` comments**, **Anonymize author metadata for blind review**) and packages `main.tex`, `\input` subfiles, `.bib`, `figures/`, custom fonts, and optionally compiled `.pdf` into `<project-slug>-submission.zip` in-browser.

---

### 3.4 Academic Paper Authoring Suite

#### Flow A: Paper Setup Wizard (`Ctrl/Cmd+Shift+N`) & Templates
- **Templates Sidebar Tab**: Groups templates into **Academic Papers** (`APA 7th Student Paper`, `IEEE Conference`, `ACM acmart`, `MLA Essay`), **STEM & Theses** (`STEM Lab Report`, `University Thesis / Dissertation`, `Beamer Presentation`), and **LaTeX3 Core** (`LaTeX3 (expl3 + xparse) Showcase`, `Python & Scientific Computing`, `TikZ Diagrams`). Each card offers **`Load Starter`** and **`Customize...`**.
- **Paper Setup Wizard Modal (`640 × 520 px`)**:
  - Left column (`210 px`): Template selector list with preview badges.
  - Right column: Metadata (`Document Title` required, `Author(s)`, `Institution`, `Course / Venue`, `Date`), Formatting (`US Letter` | `A4`, `Single` | `1.5×` | `Double` spacing, Citation Style `APA`/`IEEE`/`ACM`/`MLA`/`Chicago`), Review & Budgets (`Anonymized Blind Review` toggle adding `lineno` & hiding author, optional `Target Word Count` and `Max Pages`).
  - Unsaved changes guard before replacing the active editor buffer.

#### Flow B: Citation & `.bib` Manager (`Ctrl/Cmd+Shift+K` & BibTeX Tab)
- **Bibliography Style Bar**: `APA`, `IEEE`, `ACM`, `MLA`, `Chicago`, `Nature` + **`Import .bib`** button (plus drag-and-drop `.bib` anywhere on the BibTeX pane or editor).
- **Smart Lookup**: Unified search input (`"DOI, arXiv ID, ISBN, or Paper Title..."`) querying CrossRef/arXiv/OpenLibrary:
  - Direct DOI/arXiv/ISBN adds entry immediately with confirmation toast.
  - Title/author search renders up to 5 inline match cards with 1-click **`+ Add`**.
  - Duplicate key collision prompts **`Replace`**, **`Keep Both`**, or **`Cancel`**.
- **Saved Library & Cross-References**:
  - Filter input (`"Filter citations & labels..."`).
  - Each `.bib` entry shows cite key, year, title, authors, amber **`Uncited`** pill if unused, optional page locator input (`p. 12`), and 1-click insert buttons (**`\cite`**, **`\parencite`**, **`\textcite`**, **`\autocite`**, **`\footcite`**).
  - Below citations: **Cross-Reference Labels (`M`)** listing `\label{...}` with line number and 1-click **`\ref`** / **`\cref`** insertion.

#### Flow C: Visual Builders (Math, Matrix, Spreadsheet Table, `pgfplots` Chart, Figure Assistant)
- **Visual Tools Modal (`760 × 540 px`, 4 tabs)**:
  1. **Math Palette**: Quick Academic Equations row (`Fraction`, `Piecewise cases`, `Summation`, `Integral`, `siunitx \qty`), Greek letters, operators, and relations — inserts at exact caret/selection.
  2. **Matrix Builder**: Rows × Cols stepper (`1–8`), bracket style (`pmatrix`, `bmatrix`, `vmatrix`, `Bmatrix`), interactive cell inputs, live TeX preview.
  3. **Table Editor (`booktabs`)**: Toggle between **`Visual Grid`** (2D editable spreadsheet `role="grid"`, `+ Row`/`- Row`, `+ Col`/`- Col` up to `12×30`, per-column `L`/`C`/`R` alignment, Bold Header toggle) and **`Paste CSV / TSV`**; Caption & `tab:` Label validation; auto-inserts `\usepackage{booktabs}`.
  4. **Chart Builder (`pgfplots`)**: Chart Type (`Line`, `Bar`, `Scatter`), Title, X/Y labels, CSV `x, y` data table with starter sample, and live generated `\begin{tikzpicture}...\end{tikzpicture}` preview; auto-adds `\usepackage{pgfplots}`.
- **Figure Assistant Modal (`580 × 480 px`, triggered by toolbar `Insert Figure` or dropping an image onto the editor)**:
  - Upload/drop `.png`, `.jpg`, `.jpeg`, `.pdf`, `.svg` into project `figures/<sanitized-filename>` (stored in B2 project workspace).
  - Thumbnail preview + dimensions; Layout Mode (`Single Figure` | `Side-by-Side (2 Subfigures)`); Width slider (`25%–100%` of `\textwidth`); Placement (`Here [htbp]` | `Top [t]` | `Page [p]`); Caption & sanitized `fig:` label; auto-adds `graphicx` / `subcaption`.

#### Flow D: Plain-English Error Demystifier, Pre-Flight Checklist & Rubric Budgets
- **Diagnostics Tab (`Diagnostics (N)`)**:
  - Pairs line badge (`Line 42`) and severity icon with: (1) **Plain-English Headline** (e.g., *"Unescaped `&` character in body text"*), (2) **1-sentence explanation**, (3) **1-Click Auto-Fix Button** (e.g., `Escape & → \&`, `Add \usepackage{amsmath}`, `Wrap in $...$`) when deterministic, and (4) expandable **Raw TeX Log** line.
- **Pre-Flight Tab (`Pre-Flight (M)`)**:
  - Live checks for: Unresolved `\cite{...}` keys (click to search CrossRef), Broken `\ref{...}` targets (jump to line), Uncited `.bib` entries, Missing/Absolute figure paths (1-click **`Relocate to figures/`**), and `Overfull \hbox` warnings. Clean state displays green seal: **`"All Pre-Flight Checks Passed — Ready to export PDF or submission bundle."`**
- **Rubric Word & Page Budgets (Status Bar Pill + `300 px` Popover)**:
  - Shows **Body Prose Words** (excluding TeX commands/preamble/math/bib), **Abstract Words**, **Math Blocks**, **Citations**, **PDF Pages**, and **Est. Reading Time**.
  - Editable **Target Words** & **Max Pages** inputs + **`Student Mode`** toggle (hides `expl3` symbols/badges to reduce intimidation for non-macro writers).
  - Status thresholds: Green (`On track: 360 words remaining`), Amber (`Near limit: 94%`), Red (`Over limit by 140 words`), always paired with distinct icon + text.

---

## 4. Interaction States & Edge-Case Matrix

| Surface / Flow | Loading / Busy | Empty State | Validation / Error | Success / Confirmation |
|---|---|---|---|---|
| **Google Sign-In** | Spinner inside button (`"Signing in..."`) | Clean centered Welcome card | Dismissible inline red alert (`"Google sign-in cancelled or failed. Retry or use Demo Mode."`) | Hydrates workspace + announces `"Signed in as <Name>"` |
| **B2 Cloud Sync** | Spinning cloud icon (`Saving...`) | `"No projects yet — Create your first paper"` | Non-blocking error pill (`B2 Sync Error`) + `Retry`; local edits kept in IndexedDB | Green `Synced to B2` pill + subtle timestamp |
| **WASM Compiler** | `Compiling in Browser (WASM)...` pill; non-blocking | Initial compile runs automatically on load | Keeps last good PDF visible + shows Diagnostics count badge | `PDF Ready • <N> ms` pill; preserves PDF scroll offset |
| **CrossRef / DOI Search** | Spinner inside search box; list stays interactive | Dropzone card (`"Drop a .bib file or search by DOI, arXiv, or title"`) | Inline red alert (`"DOI not found"` / `"Could not parse BibTeX on line N"`); duplicate key choice modal | `"Added '<key>' to references.bib"` toast + live recompile |
| **Custom Font Import** | `"Validating font..."` spinner | Dropzone card above CTAN presets | Rejects `.woff2`/corrupt files before upload with explicit `.ttf/.otf/.ttc` guidance | Selects new font, shows live specimen, ready to apply |
| **Table / Figure / Wizard** | N/A (instant client-side preview) | Sample row/placeholder hints | Inline red validation under invalid `fig:`/`tab:` label or blank required title (`aria-invalid="true"`) | Inserts snippet at caret, closes modal, restores trigger focus |

---

## 5. Accessibility Requirements (WCAG 2.1 AA & WAI-ARIA 1.2)

### 5.1 Semantic HTML Landmarks & ARIA Structure
- **Page Landmarks**:
  - `<header role="banner">`: Top application toolbar.
  - `<aside aria-label="Workspace navigation and authoring tools">`: Left sidebar (contains `<nav aria-label="B2 Projects">` + `role="tablist"` for the 6 tool tabs).
  - `<main aria-label="LaTeX Studio Workspace">`: Split-pane container housing `<section aria-label="LaTeX3 Source Editor">` and `<section aria-label="Client-Side PDF Preview">`, plus collapsible `<section aria-label="Diagnostics and Pre-Flight Drawer">`.
  - `<footer role="contentinfo" aria-label="Document status and word budgets">`: Bottom status bar.
  - **Skip Link**: First focusable element in DOM (visually hidden until focused): **`Skip to LaTeX Editor`**.
- **Modals & Popovers (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`)**:
  - Applies to: Paper Setup Wizard, Visual Tools, Figure Assistant, Font Manager, B2 Connection Modal, New Project Modal, Version History, Commit Message Popover, Citation Quick-Picker, Account Popover, and Budget Popover.
  - All modals trap `Tab` focus inside the dialog, close on `Esc` (unless a confirmation sub-alert is open), and restore focus to the exact triggering button on close.
- **Tablists (`Outline`/`Packages`/`Fonts`/`BibTeX`/`LaTeX3`/`Templates` & `Diagnostics`/`Pre-Flight`/`Transcript`/`Suggestions`)**:
  - Implement `role="tablist"`, `role="tab"` with `aria-selected="true|false"` and `aria-controls`, and `role="tabpanel"` with `aria-labelledby`. Support `ArrowLeft`/`ArrowRight` (and `Home`/`End`) roving tabindex across tabs.
- **Spreadsheet Table Grid (`role="grid"`)**:
  - Every cell exposes `aria-label="Row <R>, Column <C>, Header"` (or `"Row <R>, Column <C>"`), supports `Tab` / `Shift+Tab` cell traversal and arrow-key navigation when not actively editing text.
- **Live Regions (`aria-live`)**:
  - `aria-live="polite"`: WASM compile completion (`"PDF Ready in 142 milliseconds, 6 pages"`), B2 save confirmation (`"Saved project to Backblaze B2"`), CrossRef results count (`"5 citation results found"`), Auto-Fix applied (`"Applied fix: escaped ampersand on line 42"`).
  - `aria-live="assertive"`: Compile errors summary, auth expiration warning, B2 sync failure, and inline form validation errors (`aria-invalid="true"` + `aria-describedby`).
- **Icon-Only Buttons**: Every icon button (`Zoom In`, `Zoom Out`, `Prev Page`, `Next Page`, `Close`, `+ Row`, `- Col`, `Auto-Fix`, `Remove Font`) must carry a descriptive `aria-label` and `title` tooltip.

### 5.2 Web-Adapted Keyboard Shortcuts
Web browsers reserve `Ctrl/Cmd+T`, `Ctrl/Cmd+W`, `Ctrl/Cmd+N`, and `Ctrl/Cmd+R`. Shortcuts below map macOS LaTeXaP ergonomics safely to the web (`Mod` = `⌘` on macOS, `Ctrl` on Windows/Linux):

| Action | Web Shortcut | Notes |
|---|---|---|
| **Quick Save & Snapshot to B2** | `Mod+S` | Overrides browser save-page dialog cleanly via `preventDefault()` |
| **Save & Snapshot with Custom Message** | `Mod+Alt+S` | Opens custom snapshot message popover |
| **Project Version History** | `Mod+Alt+H` | Opens B2 Version History & Restore modal |
| **Compile Now (WASM)** | `Mod+B` | Triggers immediate client-side compilation |
| **Forward SyncTeX (Editor → PDF)** | `Mod+Shift+J` | Scrolls & highlights PDF location for active editor line |
| **Backward SyncTeX (PDF → Editor)** | `Mod+Click` or `Double-Click` on PDF | Jumps editor caret to source `.tex` line |
| **Paper Setup Wizard** | `Mod+Shift+N` *(or `Alt+Shift+N` fallback if browser intercepts)* | Opens Academic Paper Setup Wizard |
| **Citation Quick-Picker** | `Mod+Shift+K` | Opens Citation Quick-Picker popover |
| **Font Manager** | `Mod+Shift+F` | Opens Font Manager modal |
| **Toggle Diagnostics Drawer** | `Mod+J` | Expands/collapses bottom Diagnostics & Pre-Flight drawer |
| **Toggle Left Sidebar** | `Mod+\` | Collapses/expands left workspace sidebar |
| **Toggle Prose Spellcheck** | `Mod+Alt+;` | Toggles LaTeX-aware prose spellcheck |
| **Download Compiled PDF** | `Mod+Shift+E` | Downloads `.pdf` blob |
| **Export Submission Bundle (`.zip`)** | `Mod+Shift+Alt+E` | Runs Pre-Flight & exports submission `.zip` |
| **Editor Autocomplete** | `Ctrl+Space` | Opens context completion popup manually |
| **Dismiss Active Popover / Modal** | `Esc` | Closes top-most popup/modal and restores trigger focus |

### 5.3 Focus Management Rules
1. **Modal Open**: Move focus immediately to the primary input (Wizard Title, Citation Search, Snapshot Message input with text selected, or Project Name) or modal close button if read-only.
2. **Validation Error**: Keep focus on the invalid field, set `aria-invalid="true"`, and link error message via `aria-describedby`.
3. **Auto-Fix Applied**: Move focus cleanly to the next remaining diagnostic item, or to the `"All Clear"` banner / Editor when 0 diagnostics remain.
4. **SyncTeX Backward Jump**: Announce `"Jumped to line <N>"` politely and move focus into the editor at line `N`.

### 5.4 Color Contrast, High-Contrast Studio Themes & Non-Color Signifiers
- **Contrast Minimums (Both Light & Dark Themes)**:
  - Body text, editor code tokens, diagnostic explanations, timestamps, and badge text: **`>= 4.5:1`** (target `>= 7.0:1` for primary editor text and high-contrast mode).
  - UI borders, splitters, dropzone dashed outlines, progress bar tracks, and `:focus-visible` outlines (`2 px` solid ring with `2 px` offset): **`>= 3.0:1`**.
- **Independent Editor Surface Theme**: Users can keep the studio shell in Dark mode while switching the LaTeX Editor pane to Light mode (or vice versa), matching macOS LaTeXaP's `Light | Dark` editor toggle. Both combinations must preserve `>= 4.5:1` syntax token contrast (`expl3` purple/indigo, `xparse` blue, commands teal/cyan, strings/math emerald, comments muted slate `#5A6577` on light / `#94A3B8` on dark).
- **Never Color-Alone**: Every semantic state combines color + distinct SVG icon + explicit text label (`Synced to B2`, `Offline / Local Fallback`, `Error`, `Warning`, `Pre-Flight Ready`, `Over limit`).
- **Motion Sensitivity (`prefers-reduced-motion: reduce`)**: Disable drawer slide animations, SyncTeX highlight pulse transitions, and spinner rotation flourishes (use static progress indicator text) when reduced motion is enabled.

---

## 6. Interactive Implementation Checklist (for `@ui-specialist` & `@developer`)

- [ ] **Auth & Onboarding**: Google Sign-In button + 1-click Dev/Demo Google account login + Demo user switcher + profile badge + session-expiry non-blocking recovery banner + dirty-state sign-out guard.
- [ ] **Backblaze B2 Workspace**: Project switcher (create, switch, rename, duplicate, delete) + `Synced to B2` / `Saving...` / `Unsaved` / `B2 Sync Error` / `Offline / Local Fallback` pills + B2 Connection Settings & Test modal + `Mod+S` quick snapshot + `Mod+Alt+S` custom snapshot popover + `Mod+Alt+H` Version History & forward restore.
- [ ] **Client-Side WASM Studio**: Live `Compiling in Browser (WASM)...` / `PDF Ready • <N> ms` badge + `Auto-Compile: ON/Paused` toggle + stale-PDF-preserved error state + resizable split pane + line numbers + diagnostic gutter + `expl3`/`xparse` highlighting & autocomplete + Zoom/Page nav + bidirectional SyncTeX (`Mod+Shift+J` & `Mod+Click`/double-click) + Download PDF & Submission `.zip`.
- [ ] **Academic Suite**: 6-tab sidebar (`Outline`, `Packages`, `Fonts`, `BibTeX`, `LaTeX3`, `Templates`) + Paper Setup Wizard + CrossRef/DOI/arXiv/ISBN citation search & `.bib` dropzone + Visual Math/Matrix/Spreadsheet Table/`pgfplots` Chart modals + Figure Assistant (`figures/` upload + `subcaption` side-by-side) + Plain-English Diagnostics with 1-click Auto-Fix + Pre-Flight tab + Rubric Word/Page Budget pill & popover + Student Mode + Prose Spellcheck toggle.
- [ ] **Accessibility & Themes**: Semantic landmarks, skip link, `role="dialog"` focus traps, `role="tablist"` keyboard nav, `role="grid"` table coordinates, `aria-live` announcements, Light/Dark studio & editor themes meeting WCAG 2.1 AA (`>= 4.5:1` text, `>= 3.0:1` UI/focus rings), and `prefers-reduced-motion` support.
