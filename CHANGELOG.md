# Changelog

All notable changes to CloudStock are documented in this file.
Format follows [Conventional Commits](https://www.conventionalcommits.org/) and [Semantic Versioning](https://semver.org/).

---

## [Unreleased]

### UI/UX & Design System Modernization
- **SVG Icon System (`lucide-react`)**: Replaced all Unicode mockup characters (`▥`, `◈`, `♧`, etc.) with standardized SVG icons, optical alignment, and accessible `aria-hidden` attributes across Sidebar, Topbar, Modals, Tables, and Login (TASK-20261115-0003).
- **Bilingual Localization (`i18n`)**: Unified localization system with Vietnamese (default) and English parity dictionaries, `I18nProvider`, `LanguageSwitcher` widget, and standard number/currency formatting (TASK-20261115-0004).
- **Enterprise Data Visualization (`recharts`)**: Integrated Recharts for React 19, implementing `MovementTrendChart` (dual-bar Inbound/Outbound with auto Y-axis) and `StockDistributionChart` (interactive Donut chart with active sector highlight and center counts), replacing hand-rolled CSS bars (TASK-20261115-0005).
- **Shared Design Tokens**: Created `src/lib/theme/tokens.ts` establishing unified semantic colors, chart palettes, and icon sizing constants.

### Operations / Watchdog
- Consolidated First Stream telemetry into Telegram: Sentry P0 issue alert webhook (`/api/sentry-webhook`), BugSink SQLite anomaly spike detection (`/srv/.../bugsink/data/db.sqlite3` on HP node), and Supabase PostgreSQL database webhook (`/api/supabase-webhook`) with multi-cycle latency degradation guard (TASK-20261115-0011, TASK-20261115-0012, TASK-20261115-0013 / Issue #21)
- Decouple Telegram `/chart` command into distinct domain visualizations: `/chart` (or `/chart cloud`) for Cloud Edge vs Database latency (ms), `/chart node` (or `/chart hp`) for HP EliteDesk CPU Load vs RAM MB/%, and `/chart kuma` for 8-hour Uptime Kuma monitor series and failures (TASK-20261115-0006 / Issue #21)
- Full 8-hour time series extraction (~20 downsampled points across 4 monitors) and failed events telemetry reporting for `/chart kuma` (TASK-20261115-0005 / Issue #21)
- Uptime Kuma rich telemetry integration (monitor counts, 24h uptime, ping latency for Supabase DB/Vercel API/Internet Uplink) into Dead Man's Switch heartbeat and `/chart kuma` Telegram command (TASK-20261115-0004 / Issue #21)
- Sudo packaging suite (`scripts/ops/dms/pack-for-ikari.sh`, `scripts/pack-dms-to-ikari.sh`) and systemd user timer (10m) for service account ikari on HP Node (TASK-20261115-0003 / Issue #21)
- Dead Man's Switch (DMS) inverted heartbeat protocol for on-premise HP EliteDesk node monitoring behind NAT (TASK-20261115-0002 / Issue #21)
- Telemetry Ring Buffer (48 points / 8h sliding window) on Cloudflare KV with zero-cost write budgeting (288 writes/day) (TASK-20261115-0002)
- Telegram Slash Commands enhancement: unified 2-tier `/status` dashboard, `/chart` visualization (QuickChart dual-axis line chart), and Unicode sparklines (TASK-20261115-0002)
- On-premise systemd check-in script and local operations runbook (`RUNBOOK_DMS.local.md`) (TASK-20261115-0002)
- Cloudflare Worker Watchdog (`workers/cloud-watchdog`) with Edge Cron Trigger (10m) for $0 keep-alive & downtime monitoring (TASK-20261115-0001)
- Automatic transient cold-start absorption (2s retry) and Telegram HTML alert dispatcher (TASK-20261115-0001)
- Telegram Slash Commands (`/status`, `/ping`, `/help`) via Edge Webhook with chat ID whitelisting (TASK-20261115-0001)
- Relax GitHub Actions cron schedule (`.github/workflows/heartbeat-cron.yml`) to 6h tertiary fallback to prevent runner queue starvation (TASK-20261115-0001)
- Local operations runbook (`RUNBOOK.local.md`) for operator-driven deployment without credentials in repo (TASK-20261115-0001)

---

## [v0.2.0] - 2026-11-09

### Features
- Brand Splash Screen with animated cloud logo and server status bar (TASK-0006)
- OpenGraph image endpoint (`/api/opengraph-image`) for social sharing previews (TASK-0006)
- Server-side auth guard with redirect to login for unauthenticated requests (TASK-0006)
- WAF middleware with rate-limiting and SQLi/XSS probe detection (TASK-0003)
- Security HTTP headers: HSTS, CSP, X-Frame-Options, X-Content-Type-Options (TASK-0003)
- Sentry error monitoring with server-side tunnel route (`/monitoring-tunnel`) (TASK-0005)
- Bugsink self-hosted issue tracker integration (TASK-0005)
- Supabase health endpoint (`/api/health`) with database latency reporting (TASK-0007)

### CI / Tooling
- GitHub Actions CI pipeline: lint, typecheck, unit/integration tests, build (TASK-0004)
- CodeQL Advanced Security Analysis workflow (TASK-0004)
- Cloud Heartbeat watchdog cron (every 30 min) for Supabase keep-alive (TASK-0007)
- CD Release Pipeline: semver tag trigger, Vercel smoke tests, GitHub Release auto-generation

### Bug Fixes
- Fix `/api/health` returning 503 due to Supabase root endpoint requiring `service_role` key (not `anon`)
- Fix CodeQL workflow conflict with GitHub Default Setup; upgrade to `codeql-action@v4`

---

## [v0.1.0] - 2026-10-01

### Features
- Initial Next.js 16 App Router scaffold with Supabase PostgreSQL integration
- Basic authentication flow (login / logout via Supabase Auth)
- Product and category management UI (inventory list, detail pages)
- Prisma schema and initial migration set

---

> Releases from v0.2.0 onward are automatically generated by the CD Release Pipeline
> upon pushing a semver tag (`git tag v0.x.y && git push --tags`).
