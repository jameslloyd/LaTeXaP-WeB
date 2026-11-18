<h1 align="center">LaTeXaP-WeB — Multi-User Web LaTeX3 &amp; Academic Studio</h1>

<p align="center">
  <strong>Full-Stack TypeScript &amp; React Web Port of <a href="https://github.com/jameslloyd/LaTeXaP">LaTeXaP</a> for Authoring LaTeX3 (<code>expl3</code> + <code>xparse</code>) and Academic Papers with Client-Side Browser PDF Rendering, Google Auth, and Backblaze B2 Cloud Storage</strong>
</p>

---

## Key Features

1. **Client-Side Web PDF Compilation & Bidirectional SyncTeX**
   - **Zero Server TeX Bottleneck**: LaTeX compilation runs 100% in your browser inside a dedicated ES Module **Web Worker** (`latexCompiler.worker.ts`) with an in-memory Virtual Filesystem (`main.tex`, `references.bib`, `sections/`, `figures/`, and custom fonts).
   - **Dual-Mode Compiler Pipeline**: Ships with a built-in zero-dependency **Web LaTeX3 Typesetter (`webTypesetter.ts` + `pdf-lib`)** supporting `expl3`/`xparse` expansion, `booktabs` tables, `pgfplots` vector charts, embedded PNG/JPEG figures, custom `.ttf`/`.otf` fonts, and formatted bibliographies—plus a pluggable **WASM TeX Adapter** (`wasmTexAdapter.ts`) when WASM TeX assets are mounted under `/wasm/`.
   - **Live PDF.js Preview & SyncTeX**: Renders paginated high-DPI `<canvas>` output via `pdfjs-dist` with zoom/page controls, scroll preservation, stale-PDF error banners, **Forward SyncTeX** (`Mod+Shift+J` or Outline click), and **Backward SyncTeX** (`Mod+Click` or double-click on any PDF page).

2. **LaTeX3 (`expl3` + `xparse`) Studio Editor**
   - **CodeMirror 6 Editor**: Custom syntax highlighting for `expl3` namespaces (`\module_func:Npn`, `\l_tmpa_tl`, `\ExplSyntaxOn`/`\ExplSyntaxOff`), `xparse` definitions (`\NewDocumentCommand`), math blocks, macro parameters (`#1`, `##1`), and comments.
   - **Smart Autocompletion & Gutter Diagnostics**: Context-aware completions for `expl3`/`xparse`, `\begin{...}` environments, `\usepackage{...}` presets, `fontspec` fonts, and live-indexed document `\label`/`\cite`/macro keys.
   - **Independent Light & Dark Themes**: Toggle the editing pane between **Light** and **Dark** surfaces independently of the studio chrome, and customize editor monospace font family & size (`10–24 pt`).

3. **Academic Paper Authoring Suite**
   - **11 Starter Templates & Paper Setup Wizard (`Mod+Shift+N`)**: APA 7th Ed., IEEE Conference, ACM (`acmart`), MLA Essay, STEM Lab Report, University Thesis, Beamer Slides, LaTeX3 Showcase, Academic Research Article, Python Scientific Computing, and TikZ Graphics—with Title, Author, Institution, Paper Size, Double-Spacing (`setspace`), and **Anonymized Blind Review** (`lineno`).
   - **Smart Citations & `.bib` Manager (`Mod+Shift+K`)**: Server-proxied CrossRef search and DOI / arXiv / ISBN lookup (`/api/citations/*` with SSRF allowlist & 2 MB cap), drag-and-drop `.bib` import, `Uncited` badges, `\cite`/`\parencite`/`\textcite`/`\autocite`/`\footcite` + page locators, and 1-click BibLaTeX style switching (`APA`, `IEEE`, `ACM`, `MLA`, `Chicago`, `Nature`).
   - **Visual Tools & Figure Assistant**: Interactive 2D Spreadsheet Table Grid (`booktabs` + CSV import), CSV-to-`pgfplots` Chart Builder (`line`, `bar`, `scatter`), Math & Matrix Builders, and Relative Figure Assistant (`figures/` upload + `subcaption` side-by-side layouts).
   - **Plain-English Error Demystifier, Pre-Flight & Rubric Budgets**: Translates TeX/Linter errors into plain-English cards with **1-Click Auto-Fix**, verifies unresolved citations/references/figures prior to submission, tracks prose-only word & page budgets (**Student Mode** hides `expl3` noise), and supports LaTeX-aware prose spellcheck (`Mod+Alt+;`).
   - **Client-Side Export**: Download compiled `.pdf` (`Mod+Shift+E`) or package a self-contained submission `.zip` (`Mod+Shift+Alt+E` via `fflate`) containing `.tex`, `\input` subfiles, `.bib`, `figures/`, and custom fonts.

4. **Multi-User Google Authentication**
   - **Production Google OIDC**: Verifies Google Identity Services `idToken` credentials server-side (`google-auth-library`) and issues signed `HttpOnly`, `SameSite=Lax` HS256 JWT session cookies (`jose`).
   - **Seamless Local Dev/Test Mode**: Automatically enables 1-click **Dev Google Sign-In** personas and custom email login when `GOOGLE_CLIENT_ID` is unset (and fails closed in `NODE_ENV=production` unless `ALLOW_DEV_AUTH=true`).

5. **Backblaze B2 Multi-Project Cloud Storage & Version History**
   - **Strict Per-User Tenant Isolation**: Projects, assets, and custom fonts live under `users/<userId>/projects/<projectSlug>/` and `users/<userId>/fonts/` via backend proxy endpoints—B2 application keys never leave the server.
   - **Transparent Local Filesystem Fallback**: When Backblaze B2 env vars are omitted, `LocalFilesystemB2FallbackProvider` mirrors the exact B2 object hierarchy and snapshot semantics under `.data/b2-local-storage/`.
   - **Version Snapshots, Diffs & Conflict Recovery**: `Mod+S` quick snapshot, `Mod+Alt+S` custom snapshot message popover, `Mod+Alt+H` per-project Version History with file diffs and non-destructive forward restore, plus `409 Conflict` resolution (`Keep Both Copies`, `Keep My Local Version`, `Use Cloud Version`).

---

## Architecture Overview

For complete system diagrams, API contracts, data models, security controls, and UX accessibility details, see:
- **System Architecture & Module Ownership**: [docs/architecture.md](docs/architecture.md)
- **UX & WCAG 2.1 AA Accessibility Specification**: [docs/ux-spec.md](docs/ux-spec.md)

```text
LaTeXaP-WeB/
├── shared/types/              # Frozen TypeScript contracts shared by server, worker, and UI
├── server/
│   ├── app.ts                 # Express app, security headers, API mounting, prod SPA serving
│   ├── config.ts              # Environment parsing (Google Auth, JWT, B2 vs Local fallback)
│   ├── middleware/            # requireAuth JWT cookie verification & safe error serialization
│   ├── routes/                # /api/auth, /api/projects, /api/fonts, /api/citations
│   └── services/              # AuthService, ProjectService, FontStorageService, CitationProxyService
│       └── storage/           # StorageProvider (B2S3StorageProvider + LocalStorageProvider)
├── client/
│   ├── index.html             # SPA entry shell
│   └── src/
│       ├── engine/            # Web Worker compiler, webTypesetter (pdf-lib), wasmTexAdapter, SyncTeX
│       ├── services/          # Catalog, Expl3Linter, ContextSuggestions, Preflight, Export, API client
│       ├── state/             # useWorkspaceStore (React context ViewModel)
│       ├── styles/            # Design tokens, Light/Dark themes, responsive workspace CSS
│       └── components/        # Auth, Editor (CodeMirror 6), PDFPreview (PDF.js), Sidebar, Academic modals
├── tests/                     # Vitest unit & Supertest API integration suites
├── Dockerfile                 # Multi-stage production Node 22 Alpine build (non-root runner)
├── .dockerignore              # Excludes build artifacts, node_modules, local storage, and secrets
└── docker-compose.yml         # Production Compose service with persistent volume & healthcheck
```

---

## Configuration & Setup (`.env.example`)

Copy `.env.example` to `.env` (optional—the app runs out-of-the-box with zero configuration in Dev Auth + Local Fallback mode):

```bash
cp .env.example .env
```

| Variable | Default / Fallback | Description |
| :--- | :--- | :--- |
| `PORT` | `4000` | Express backend server port (Vite dev server proxies `/api` from `:5173` → `:4000`) |
| `NODE_ENV` | `development` | Set to `production` in deployed environments (`Secure` cookies, enforces `JWT_SECRET`, disables dev login unless `ALLOW_DEV_AUTH=true`) |
| `JWT_SECRET` | Ephemeral random (dev only) | 32+ byte secret for HS256 `latexap_session` cookies (required in production) |
| `GOOGLE_CLIENT_ID` | *(unset → Dev Mode)* | Google OAuth 2.0 Web Client ID for Google Identity Services sign-in |
| `ALLOW_DEV_AUTH` | `true` in non-prod | Set `false` in production; `true` allows `/api/auth/dev-login` when testing without Google OAuth |
| `B2_ENDPOINT` | *(unset → Local Fallback)* | Backblaze B2 S3-compatible endpoint (e.g. `https://s3.us-west-004.backblazeb2.com`) |
| `B2_REGION` | `us-west-004` | Backblaze B2 region matching `B2_ENDPOINT` |
| `B2_BUCKET_NAME` | *(unset → Local Fallback)* | Backblaze B2 bucket name |
| `B2_KEY_ID` | *(unset → Local Fallback)* | Backblaze B2 Application Key ID (server-only) |
| `B2_APPLICATION_KEY` | *(unset → Local Fallback)* | Backblaze B2 Application Key secret (server-only) |
| `LOCAL_STORAGE_ROOT` | `.local-b2-storage` | Primary local fallback directory when B2 credentials are absent (mounted at `/app/.local-b2-storage` in Docker) |
| `STORAGE_LOCAL_DIR` | `.data/b2-local-storage` | Legacy/fallback local storage path used if `LOCAL_STORAGE_ROOT` is unset |

### Enabling Production Google Auth & Backblaze B2
1. **Google OAuth**: Create a Web Application OAuth Client ID in Google Cloud Console, add your origin (e.g. `http://localhost:5173` or your production URL) to **Authorized JavaScript origins**, and set `GOOGLE_CLIENT_ID` in `.env`.
2. **Backblaze B2**: Create a private B2 bucket and a scoped Application Key (Read/Write to that bucket), then populate `B2_ENDPOINT`, `B2_REGION`, `B2_BUCKET_NAME`, `B2_KEY_ID`, and `B2_APPLICATION_KEY` in `.env`. Verify connectivity anytime from the toolbar **Sync Status Pill → Test B2 Connection**.

---

## Development, Build & Test Commands

Requires **Node.js 20+** (tested on Node `v26.8.1`) and **npm**.

```bash
# 1. Install dependencies
npm install

# 2. Run full-stack development server (Express API :4000 + Vite HMR :5173)
npm run dev

# 3. Type-check client and server TypeScript
npm run typecheck

# 4. Run automated unit & integration tests (Vitest + Supertest)
npm test

# 5. Build production client bundle (dist-client/) and server (dist-server/)
npm run build

# 6. Start production server (serves API + built SPA on PORT)
npm start
```

---

## Docker & Docker Compose Deployment

LaTeXaP-WeB includes a multi-stage `Dockerfile` (`node:22-alpine`, non-root `USER node`, built-in `/api/health` `HEALTHCHECK`) and `docker-compose.yml` with a persistent volume (`latexap_storage:/app/.local-b2-storage`) for local-fallback storage.

### 1. Configure Production Environment
Because `docker-compose.yml` runs with `NODE_ENV=production` and `ALLOW_DEV_AUTH=false` by default, set a strong `JWT_SECRET` (minimum 16 characters; recommended 32+ bytes) in `.env` or your shell environment:

```bash
# Generate a strong JWT secret and configure .env
cp .env.example .env
# Set JWT_SECRET=$(openssl rand -hex 32)
# Set GOOGLE_CLIENT_ID=... (or ALLOW_DEV_AUTH=true for local/demo container evaluation)
# Optionally set B2_ENDPOINT, B2_REGION, B2_BUCKET_NAME, B2_KEY_ID, B2_APPLICATION_KEY
```

### 2. Run with Docker Compose
```bash
# Build and start in detached mode (exposed on http://localhost:4000)
docker compose up -d --build

# Check container health and logs
docker compose ps
docker compose logs -f latexap-web

# Stop containers (preserves latexap_storage volume)
docker compose down
```

### 3. Build & Run Standalone Docker Image
```bash
docker build -t latexap-web:latest .

docker run -d \
  --name latexap-web \
  -p 4000:4000 \
  -e JWT_SECRET="$(openssl rand -hex 32)" \
  -e ALLOW_DEV_AUTH=true \
  -v latexap_storage:/app/.local-b2-storage \
  latexap-web:latest
```

Verify readiness anytime at `GET http://localhost:4000/api/health`.

---

## Keyboard Shortcuts (`Mod` = `⌘` on macOS, `Ctrl` on Windows/Linux)

| Shortcut | Action |
| :--- | :--- |
| `Mod+S` | Quick Save & Snapshot to Backblaze B2 / Local Storage |
| `Mod+Alt+S` | Save & Snapshot with Custom Message |
| `Mod+Alt+H` | Open Project Version History & Restore |
| `Mod+B` | Compile LaTeX3 Document Now (Browser Web Worker) |
| `Mod+Shift+J` | Forward SyncTeX (Jump Editor Line → PDF Highlight) |
| `Mod+Click` / `Double-Click` (PDF) | Backward SyncTeX (Jump PDF Location → Editor Line) |
| `Mod+Shift+N` | Open Academic Paper Setup Wizard |
| `Mod+Shift+K` | Open Quick Citation Picker (CrossRef / DOI / `.bib`) |
| `Mod+Shift+F` | Open Custom Font Manager |
| `Mod+J` | Toggle Diagnostics / Pre-Flight / Transcript Drawer |
| `Mod+\` | Toggle Left Workspace Sidebar |
| `Mod+Alt+;` | Toggle LaTeX-Aware Prose Spellcheck |
| `Mod+Shift+E` | Download Compiled PDF |
| `Mod+Shift+Alt+E` | Export Submission Bundle (`.zip`) |
| `Ctrl+Space` | Trigger Editor Autocompletion |
