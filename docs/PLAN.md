# authentia — TOTP authenticator extension

Status: plan, not implemented. Repo is currently the untouched Extension.js
`typescript` template (sidebar + content script + background, no deps
installed).

## 1. Goal

A browser authenticator extension that behaves like Google Authenticator:

- toolbar **popup** shows every account with a live 6-digit TOTP code
- **options page** holds passcode protection, backup export/import, clock sync
  details and housekeeping
- optional 6-digit **passcode** that encrypts the vault at rest
- one-click **clock sync** so codes are correct on machines whose clock drifts
- **screen scan**: drag a frame around a QR code on the current page and the
  account is read from the box — no camera, no upload

Non-goals for v1: camera scanning and importing image files (the scanner reads
the visible page only), `otpauth-migration://` import,
cloud sync, folders/tags, autofill into sites, account icons fetched from the
network, password-manager integration, passkey/WebAuthn.

## 2. Decisions already made

| Question | Decision |
| --- | --- |
| Passcode strength model | Passcode **encrypts** the vault: AES-GCM-256, key derived with PBKDF2-SHA256. No passcode set = plaintext local vault with a visible warning. |
| Unlock lifetime | 15 minutes. Derived key kept in `chrome.storage.session`; dies on browser restart or explicit lock. |
| Backup format | **Encrypted** with its own user-chosen passphrase (defaults to the current passcode, but may differ). KDF params + salt + IV live in the file. Copy and download both offered. The backup passphrase must be independent, or a forgotten unlock PIN destroys the backup too. |
| Clock sync | HTTPS time source, multi-sample offset estimation, persisted, manual re-sync button, device clock fallback offline. |
| Add accounts | Manual base32 secret entry, `otpauth://` URI paste, or a dragged frame around a QR code on the current page. Decoding is local. |
| Browser targets | Chromium MV3 **and** Firefox MV2 (manifest keeps `chromium:` / firefox keys). |

Honest framing to carry into the UI copy: nothing can be "100% in sync". The
extension measures an offset and shows it; the code is only as good as that
measurement.

## 3. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Extension framework | Extension.js `4.1.37` (already installed via `extension` devDep) | Repo scaffold; builds entries from `src/manifest.json` |
| Bundler | Rspack, configured by Extension.js | Do not add a webpack/`@tailwindcss/webpack` plugin |
| UI | React 18.3.1 + TypeScript | Extension.js auto-configures React; its own example pins 18. Try 19 only after a green build |
| Styling | Tailwind CSS v4 (`tailwindcss` + `@tailwindcss/postcss` + `postcss`) | v4 is CSS-first; PostCSS is the documented path here |
| UI kit | hand-written primitives in `src/components/ui` (`button`, `dialog`) on the same tokens | Only two primitives are needed; `shadcn init` has no Rspack template and the CLI needs a registry |
| Design system | web-ui-commentator v0.4.1 tokens (Appendix A), Hallmark app-screen rules, web-interface-guidelines review | Warm paper + ink, one marker accent, light only, token-only values |
| Icons | `lucide-react` | Same source shadcn uses |
| Feedback | inline only — marker chip, status line, dialog error | Copy and save feedback land where the action is; no toast layer, no dependency |
| Tests | `vitest` + a DOM environment and React testing library | One seam: pages composed with an injected storage/clock environment; crypto and TOTP checked against RFC vectors |

Dependencies to add:

```bash
npm i react@18.3.1 react-dom@18.3.1 class-variance-authority clsx tailwind-merge tw-animate-css lucide-react
npm i -D @types/react@18 @types/react-dom@18 tailwindcss @tailwindcss/postcss postcss vitest jsdom @testing-library/react @testing-library/user-event
```

`cn` is `clsx` + `tailwind-merge` in `lib/utils.ts` rather than the `cn`
package: both are what the component code actually needs, and neither depends on
a registry that may not exist.

### 3.1 Build files

- `postcss.config.mjs` → `{ plugins: { '@tailwindcss/postcss': {} } }` (repo is
  `"type": "module"`, so use ESM).
- `src/styles/tokens.css` → the token block from **Appendix A**, verbatim:
  `@theme inline` mapping, `:root, :host` values, scoped `@custom-variant dark`.
  Single source of truth — no component hardcodes a colour, font, size, radius,
  spacing step or duration.
- `src/styles/globals.css` → all imports first, in this order:
  `@import "tailwindcss"; @import "tw-animate-css"; @import "./tokens.css";`
  then `@layer base`, then the four type utilities. Do **not** import
  `shadcn/tailwind.css`: it ships a second token set that fights ours. If a
  vendored component asks for a token we do not define (`--radius`,
  `--color-chart-*`, `--color-sidebar-*`), add it to `tokens.css` rather than
  importing the defaults.
- Type utilities (Tailwind's own scale is unused, because the tokens define
  their own): `@utility text-code` (mono, `--text-2xl`, tabular numerals),
  `text-title` (`--text-lg`, 600), `text-body` (`--text-base`), `text-label`
  (`--text-xs`, muted). Radius, colour and spacing use the mapped Tailwind
  classes — `rounded-md` is 8px, `rounded-xl` is 12px, `p-3` is 12px.
- `@utility shadow-raised` reading `--shadow-raised`; everything else is a
  1px `--border` hairline, no second shadow, no glow.
- Two primitives only: `ui/button.tsx` (cva variants) and `ui/dialog.tsx`
  (native `<dialog>` + `showModal`, skinned in `globals.css`). No dropdown,
  alert-dialog, toast or card primitive: the popup uses a panel, not cards, and
  confirmations are dialogs, and `--scrim` backs the dialog backdrop.
- `tsconfig.json` → add `"paths": { "@/*": ["./src/*"] }`. Extension.js reads
  `compilerOptions.paths`, no `resolve.alias` needed.
- Extension page font/size override outside Tailwind layers, because Chrome
  injects a page stylesheet that would otherwise win:
  `:root body { font-family: var(--font-ui); font-size: var(--text-md); background: var(--background); color: var(--foreground); }`

### 3.2 Layout after refactor

```
src/
  manifest.json
  action/index.html            popup entry
  action/main.tsx              mounts <PopupApp env={createChromeEnv()} />
  action/PopupApp.tsx          vault state, gate, add/edit, list
  options/index.html           options entry
  options/main.tsx
  options/OptionsApp.tsx       header, sections, locked recovery
  options/fields.tsx           Section / Field / Area / Well / buttons
  options/sections/            passcode.tsx  backup.tsx  danger.tsx
  components/
    ui/                        button.tsx  dialog.tsx
    account-list.tsx           panel, search, states
    account-row.tsx            copy target, countdown rule, pencil
    account-form.tsx           add/edit, preview, delete + dialog
    countdown-rule.tsx  code.ts
    passcode-gate.tsx  passcode-input.tsx       (OTP-style 6 boxes)
  hooks/
    use-vault.ts  use-now.ts
  background.ts              scan: capture the tab, crop, decode, hand the link over
  lib/
    base32.ts  totp.ts  otpauth.ts  crypto.ts  vault.ts  backup.ts
    scan.ts  scan-overlay.ts  settings.ts
    env.ts  chrome-env.ts  memory-env.ts  utils.ts
  styles/
    tokens.css                 Appendix A, verbatim — the only literal values
    globals.css                tailwind imports + @layer base + @layer components
```

Deleted: `src/sidebar/**`, `src/content/**`. No content script: the scan layer
is injected on demand with `activeTab`. `src/background.ts` exists for the scan
only — it captures the tab and decodes the frame, holds no state beyond the
pending link, and never touches the vault; popup and options still talk to
storage directly.

Popup pages are capped at 800×600 CSS px by both Chromium and Firefox. Body is
`width: 360px`; add/edit replace the panel inline, and only destructive
confirmations open a dialog (popup delete account, options destructive actions).

## 4. Data model

Storage areas (all `chrome.storage.*` via a tiny promise wrapper
`lib/api.ts`: `const api = globalThis.browser ?? globalThis.chrome`):

| Key | Area | Shape |
| --- | --- | --- |
| `settings` | local | `{ version: 1, autoLockMinutes: 15, clockEndpoint?: string, failedUnlocks: number, lockoutUntil: number }` |
| `vault` | local | plaintext: `{ version: 1, encrypted: false, items: Account[] }` or envelope (below) |
| `clock` | local | `{ offsetMs, rttMs, syncedAt, source, confidence: 'high' \| 'low', samples: number }` |
| `session` | session | `{ key: string /* base64 raw AES key */, unlockedAt, expiresAt }` |

`Account`:

```ts
type Account = {
  id: string            // crypto.randomUUID()
  issuer: string        // "GitHub"
  account: string       // "me@example.com"
  secret: string        // base32, uppercase, no padding
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'   // default SHA1
  digits: 6 | 8                             // default 6
  period: number                            // seconds, default 30
  createdAt: number
}
```

Envelope:

```ts
type Envelope = {
  version: 1
  encrypted: true
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: 600000; salt: string /* b64 */ }
  iv: string   // b64, 12 bytes, fresh per write
  ct: string   // b64 AES-GCM ciphertext of { items, settingsSubset }
}
```

The envelope ciphertext also covers the passcode-checked settings subset, so a
successful decrypt is the passcode proof — no separate verifier blob, no
"wrong passcode" ambiguity.

## 5. Crypto / passcode

- KDF: PBKDF2-SHA256, 600 000 iterations, 16-byte random salt per vault write?
  **No** — salt is stable per passcode lifetime (regenerate only on passcode
  change), so unlock stays cheap and deterministic.
- Cipher: AES-GCM-256, 12-byte random IV **per write**, `additionalData` =
  UTF-8 of `"authentia:v1"` to bind the format.
- Unlock: derive key → try decrypt → on success store raw key bytes +
  `expiresAt = now + autoLockMinutes` in `storage.session`.
- Any write re-encrypts with a fresh IV and slides `expiresAt` forward.
- Lock: delete the session entry. Auto-lock is evaluated on popup mount and on
  every storage read (expiry check), not by a timer that outlives the page.
- Passcode change: decrypt with old key → re-encrypt with new salt+key.
- Remove passcode: rewrite vault as plaintext, clear session, warn first.
- Lockout: 5 wrong attempts → 30 s, then 5 more → 5 min, tracked in `settings`.
  This is a UI speed bump only — an attacker with the profile directory can
  clear it. Say so in the UI, do not pretend otherwise.

### 5.1 Backup encryption is separate

Export uses its own envelope and its own passphrase prompt. Reusing the unlock
passcode silently would mean "forgot the PIN" ⇒ "lost the vault **and** the only
backup", which is unacceptable. So:

- Export dialog offers two choices: **use my current passcode** (default, one
  secret to remember) or **a separate backup passphrase** (recommended, and it
  may be long). The dialog states the consequence of the default in one line:
  forgetting the PIN then loses the vault and the backup.
- Import asks for the backup's passphrase, which may be entirely different from
  the current unlock passcode.
- Envelope carries its own `kdf` block, so the two never have to match.
- Forgetting the unlock passcode is recoverable when a separate passphrase was
  used: import the backup, set a new passcode.

Threat model, stated plainly in the plan and in the options copy:

- `storage.local` is readable by anyone with filesystem access to the browser
  profile. Encryption is the only thing standing between them and the seeds.
- A 6-digit passcode is 10^6 guesses. With 600k PBKDF2 iterations and a stolen
  envelope, offline guessing is hours on a decent GPU. The passcode protects
  against casual access, not a determined local attacker. A longer passphrase
  should be a follow-up, and the copy must not overpromise.
- Clipboard writes happen only on click (user gesture), so `clipboardWrite` is
  not required. No auto-clear timer — it cannot survive popup close.

## 6. Clock sync

TOTP requires `time = Date.now() + offset`. Offset comes from an HTTP time
source, not from trust in the OS clock.

`lib/clock.ts`:

```ts
async function measureOnce(url: string): Promise<{ offsetMs: number; rttMs: number }>
async function sync(endpoint = DEFAULT): Promise<ClockState>   // 5 samples
```

Algorithm per sample:

1. `t0 = performance.now()`; `fetch(url, { cache: 'no-store' })`
2. parse server epoch ms (primary: `ts=` line of `.../cdn-cgi/trace`, already
   fractional seconds; fallback: `Date` header, 1 s resolution)
3. `rtt = performance.now() - t0`; `offset = serverMs - (clientMs + rtt / 2)`
4. keep the sample with the **smallest** RTT (best asymmetric-error bound)
5. compute spread across samples; `confidence = spread < 500ms && rtt < 2000ms ? 'high' : 'low'`

Endpoints (both need host permissions; a host-permitted extension fetch is not
subject to CORS, so the `Date` header and body are readable):

- primary: `https://one.one.one.one/cdn-cgi/trace`
- fallback: `https://worldtimeapi.org/api/ip`
- optional override in settings; empty override = device clock only

Behaviour:

- Sync on first run, and automatically when the stored sync is older than 24 h.
- Header icon button (`RefreshCw`, spins while running) re-syncs on demand and
  shows the result: `+142 ms · 38 ms rtt · 2 min ago`.
- Stale (>24 h) or `low` confidence → the sync icon tints to a warning ink and
  the tooltip explains; no separate status dot.
- Offline / all endpoints failing → keep last known offset, icon tints to
  `--destructive` with the failure reason in the tooltip;
  codes still render off the last offset.
- Codes are recomputed from `Date.now() + offsetMs` on every tick, so a sync
  takes effect immediately.
- Every generated code is only valid when the offset error is far below the
  remaining time in the current 30 s step; the countdown rule already makes the
  boundary visible.

## 7. TOTP engine

`lib/base32.ts`: RFC 4648 decode accepting lowercase, spaces, missing padding;
reject invalid characters and lengths.

`lib/totp.ts`:

```ts
async function generate(secret: string, opts: TotpOptions, atMs: number): Promise<string>
```

- counter = `floor(atMs / 1000 / period)` as 8-byte big-endian
- `crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash }, false, ['sign'])`
- dynamic truncation → modulo `10^digits` → zero-padded
- codes are derived from the decrypted secret inside the popup page; the secret
  never leaves the page except as ciphertext

`lib/otpauth.ts`: parse `otpauth://totp/Issuer:account?secret=…&issuer=…&algorithm=…&digits=…&period=…`,
clamp/validate `digits ∈ {6,8}`, `period ∈ 15..120`, default SHA1/6/30, and
reject `otpauth-migration://` with a clear message instead of misparsing it.

Tests use the RFC 6238 vectors (SHA1/SHA256/SHA512 at T=59, 1111111109,
1111111111, 1234567890, 2000000000) plus base32 round-trips and one `otpauth`
parse/reject table.

## 8. UI / UX

### Design language

Adopted system: **web-ui-commentator v0.4.1 tokens** (Appendix A). Genre
`modern-minimal`, Hallmark **app-screen** scope — the popup and the options tab
are tools someone works in, not pages to read.

- Warm paper (`--background` 0.972 L) and ink (`--primary` 0.235 L). Hue enters
  only through `--destructive`, and only for real errors.
- `--marker` (highlighter yellow) is the **only** saturated colour and appears
  in exactly three places: the copied chip, the focused passcode box, and the
  part of the countdown rule inside the last 5 s. Never decoration, never behind
  text, never on the options page.
- **Light only.** The token block's `dark` variant is scoped and inert; no
  `.dark` class is ever applied, no `dark:` utilities are written. Dark mode is
  deferred, not half-built.
- Hairlines divide everything. `--shadow-raised` is used once, on a dialog.

Token usage:

| Token | Where |
| --- | --- |
| `--background` / `--foreground` | page, primary text |
| `--card` / `--card-foreground` | code panels, field wells |
| `--muted` / `--muted-foreground` | account line, hints, countdown track, disabled text |
| `--border` | every 1px separator and panel edge |
| `--input` | text-field borders (darker than `--border`, as given) |
| `--primary` / `--primary-foreground` | Add, Unlock, Create backup |
| `--secondary` | quiet button fill and hover |
| `--destructive` | wrong-passcode text, destructive buttons and confirmations |
| `--ring` | `:focus-visible`, 2px ink, no transition |
| `--paper-2` / `--paper-3` | hover row, wells, skeletons, nested surfaces |
| `--ink-2` | countdown fill, secondary emphasis |
| `--marker` / `--marker-ink` | the three places listed above |
| `--scrim` | dialog backdrop |

Radius, one step per nesting level and never derived: dialogs 12
(`--radius-card`), sections and the account panel 10 (`--radius-panel`),
fields / buttons / passcode boxes 8 (`--radius-control`), chips 4
(`--radius-mark`), anything circular `--radius-pin`. Rows inside the account
panel are square — the panel owns the corners and hairline rules do the
separating. Spacing is the 4px token scale only: popup padding 12, section gaps
16–40, row padding 12/8.

Type: codes `--text-2xl` (28px) mono tabular, grouped `742 918`; wordmark and
section titles 16/600; field labels 12; issuer 14/500; account and hints 12–13
muted; chips 11/500. Sentence case everywhere — never uppercase, never
letter-spaced. Mono is used only where digits or secrets are the material.

Segmented tabs are the only chooser on the options page: full width, one
selected chip on `--paper-2`, arrow keys move the selection. They replace radios
(merge / replace-all) and pick the backup mode and its source, never navigation.

Motion is state only: 120ms hover/press, 160ms dialog and panel reveal,
`--ease-out`, `transform`/`opacity`/colour only. The countdown animates
`transform: scaleX` from a left origin, never `width`. `prefers-reduced-motion`
stops the chip and dialog animations and drops the gate shake for the error
sentence alone.

Every data region ships four states: loading (skeleton rows in the shape of the
real row), empty (what belongs here plus the one action), error (what broke and
the restore path), full.

Accessibility floor, binding during review: real `<label>`s (no
placeholder-as-label), instant `:focus-visible` ink ring, 32px visible icon
buttons with a 44px hit area, `overflow-x: clip` on `html`/`body` (never
`hidden`, never `100vw`), no emoji icons. Contrast against the token values:
foreground 16.7:1, muted-foreground 6.7:1, marker-ink on marker 10.4:1,
destructive 5.9:1, input border on card 3.5:1 (3:1 non-text floor). Keyboard:
Enter submits the gate and every form, Escape closes a dialog or an inline form,
arrow keys move between passcode boxes, `/` jumps to search when it exists.

### Popup — list (default)

```
┌──────────────────────────────────┐
│ authentia                [+] [⚙] │
│ ┌──────────────────────────────┐ │
│ │ GitHub          742 918  ✎   │ │
│ │ me@example.com  ▔▔▔▔▔▔▔      │ │
│ ├──────────────────────────────┤ │
│ │ Cloudflare      033 641  ✎   │ │
│ │ work@example.com▔▔▔▔▔▔▔      │ │
│ └──────────────────────────────┘ │
│ Stored on this device.           │
└──────────────────────────────────┘
```

- Body fixed at 360 px so the popup never resizes under the cursor. Header:
  wordmark, scan, add, settings — nothing else until clock sync lands (M4).
- Scan: the header button injects the layer on the active page; dragging a box
  dims the page, the layer hides itself, the background captures and decodes,
  and the link lands in the add form next time the popup opens. A page that
  refuses injection (browser UI, web store) says so inline, and a frame without
  a working QR asks for a tighter box instead of failing silently.
- The list is **one** bordered panel; rows are hairline-separated, not cards.
  Identity left (issuer 14/500, account 12 muted), code right, in a column that
  does not shift as digits change.
- Countdown: a 2px rule under the digits only, `--border` track, `--ink-2` fill,
  `--marker` for the final 5 s. `transform: scaleX(remaining)` with
  `transform-origin: left`; one `useNow(1000)` timer drives every rule, and a
  code re-renders only when its step changes.
- The whole row is the copy target. Press fill for 120ms, then the hovered
  identity line is replaced by "Copied" in a marker chip for 1.4 s; a clipboard
  failure says so in the same place. No toast.
- Row management is **one pencil**: visible on `pointer: coarse`, revealed on
  hover/focus-within on pointer devices, 32px button in a reserved gutter so
  the code never moves.
- Search appears only past 5 accounts: `--paper-2`, 8px radius, `/` shortcut,
  clear button; filters issuer and account.
- Empty: one sentence plus "Add account". Reading error: what failed and
  "Reload". Loading: three skeleton rows at real row height. Locked: the gate
  replaces the panel entirely — no code flash before unlock.
- Add and edit swap the panel for a form, not a dialog: one field takes either
  an `otpauth://` link or a bare secret (detected on paste), then issuer
  (optional), then account; a live code previews before saving; validation sits
  under the field; Save / Cancel, Escape cancels.
- Delete lives at the bottom of the **edit** screen and opens a dialog. There is
  no row menu and no inline confirm.

### Dialogs

One primitive, `src/components/ui/dialog.tsx`, wrapping the native `<dialog>`
element with `showModal()` — focus trap, `Esc`, inert page and top layer come
from the platform; only the skin is ours.

- Backdrop `--scrim`; panel max 25rem, `width: calc(100% - var(--space-lg))`,
  centred with `margin: auto`, `max-height: calc(100vh - var(--space-lg))`,
  radius 12, `--shadow-raised`.
- Title 16/600, one sentence of consequence, then the action row with Cancel
  first and the destructive action last. Focus lands on Cancel after opening, so
  a stray Enter cannot destroy anything; Tab reaches the field. A form dialog
  opts into `initialFocus="field"` and lands on its first input instead.
- Closing: Esc, backdrop click, or Cancel. While a request is in flight the
  dialog stays open and the confirm button shows the progress word
  ("Deleting…"); failures render inside the dialog, never behind it.
- Five confirmations use it: delete account (popup), remove passcode, delete all
  data, erase the vault (locked options), replace all accounts (restore). The
  passcode set/change dialog is the only form dialog: six boxes, Cancel and the
  submit verb in the footer, failures inside the dialog and the section status
  line keeping the last success.

### Passcode gate — OTP-style

Six boxes, 52 high, equal width across the container (about 44 in the popup,
54 in a dialog), radius 8, `--paper-2` fill, 1px `--input` border, 28px mono
digit. `inputMode="numeric"`, auto-advance, backspace moves back, arrow keys
move, paste distributes across boxes, auto-submit at six digits. The focused box
takes a 2px `--marker` underline; error = one sentence in `--destructive` plus a
160ms shake, which `prefers-reduced-motion` drops for the sentence alone. The
error line is reserved so nothing jumps. While checking, the digits stay and the
button reads "Checking…". After five wrong attempts the boxes disable and a
countdown replaces the hint (30 s, then 5 min at ten). "Forgot passcode?" opens
the options tab, whose locked view carries the erase section.

### Options page (full tab)

Single column, 640–720 px, page background, no cards: hairline sections each
with a heading, a status chip on the right, one sentence, then the control. No
`--marker` anywhere. Primary action is a filled ink button; destructive actions
are outline buttons in `--destructive`.

1. **Passcode** — chip `On` / `Off`. "Set passcode" opens a dialog with six
   boxes and no confirm field; the first box takes focus, Cancel and "Set
   passcode" sit in the footer. The auto-lock row stays beneath the section's
   action. Once set: auto-lock select (5 / 15 / 30 / 60 minutes, saved on change,
   "applies the next time the passcode is entered"), "Change passcode" (same
   dialog, "Update passcode"), "Remove passcode" → dialog, and the throttle note.
   A status line under the actions reports the last outcome.
2. **Backup** — chip `Encrypted` / `Empty`. Two full-width tabs switch the
   flow: **Create backup** (passphrase + confirm, then the JSON read-only with
   `Copy` and `Download`) and **Restore backup**. Restore takes the backup
   passphrase, then a second tab pair picks the source — **Upload file** or
   **Paste text** — and a third picks **Merge** or **Replace all**, each with one
   sentence of consequence. Replace-all opens the dialog naming the count on each
   side. Merge matches issuer + account case-insensitively.
3. **Danger zone** — chip `Permanent`, one "Delete all data" button that opens
   the type-`delete` dialog.

Locked view: the gate above, then "Forgot your passcode?" — a section that
explains the vault cannot be read and offers "Erase the vault" through the same
dialog with that wording. No dead end, no backup link pretending to decrypt.

Clock sync has no UI yet: it is M4 (§6), and the header sync control,
offset readout and endpoint override land together with it.

## 9. Manifest changes

Keep both browser variants; strip sidebar/content wiring.

```jsonc
{
  "name": "authentia",
  "description": "TOTP authenticator with an encrypted vault.",
  "chromium:manifest_version": 3,
  "firefox:manifest_version": 2,
  "chromium:action":   { "default_popup": "action/index.html", "default_icon": { … } },
  "firefox:browser_action": { "default_popup": "action/index.html", "default_icon": { … } },
  "options_ui": { "page": "options/index.html", "open_in_tab": true },
  "chromium:permissions": ["storage", "activeTab", "scripting"],
  "chromium:host_permissions": ["https://one.one.one.one/*", "https://worldtimeapi.org/*"],
  "firefox:permissions": ["storage", "activeTab", "https://one.one.one.one/*", "https://worldtimeapi.org/*"],
  "chromium:background": {"service_worker": "background.ts", "type": "module"},
  "firefox:background": {"scripts": ["background.ts"]}
}
```

- `"tabs"` and `"sidePanel"` permissions are dropped: the extension reads no
  tab URLs and has no panel.
- `activeTab` is granted only by the click that starts a scan: `scripting`
  injects the selection layer into that one tab and `tabs.captureVisibleTab`
  reads what the user framed. Nothing is captured before the frame is drawn,
  and no image leaves the machine.
- No `content_scripts` and no `<all_urls>`: the scanner never runs until the
  user asks for it, on the page already in front of them.
- No `content_security_policy` entry: Tailwind and shadcn are compile-time CSS,
  React is bundled; MV3 already forbids inline/remote script.
- Icons: the **A** of the wordmark, cropped to its own bounding box so the
  glyph touches the top and bottom of the square, ink `--primary` on paper
  `--background`, the tile rounded at 22% so it reads on any toolbar. One 1024
  master downsampled to 16/32/48/64/128 plus a 512 `icon.png`; the source JPEG
  stays at the repo root for regenerating them.
- `browser_specific_settings.gecko.data_collection_permissions` stays
  `["none"]` — the only network call is the time probe, which sends no data.
- Verify the Firefox build loads: `storage.session` needs Firefox 115+.

## 10. Testing

`vitest`, one seam: each page is composed with a single injected environment
(storage, clock source, current time), so the tests drive the real UI against an
in-memory fake and never mock crypto or global timers. No page component imports
the extension API directly.

- `base32.test.ts` — vectors, case/space/padding tolerance, invalid input
- `totp.test.ts` — RFC 6238 vectors, 6 vs 8 digits, period 60, step boundaries
- `otpauth.test.ts` — full URI, missing issuer, bad digits, migration URI reject
- `crypto.test.ts` — encrypt→decrypt round-trip, wrong passcode fails, IV is
  fresh per write, tampered ciphertext throws
- `clock.test.ts` — offset math given synthetic `t0/rtt/serverTs`, min-RTT
  selection, confidence thresholds
- `vault.test.ts` — plaintext↔encrypted migration, backup envelope round-trip
- `scan.test.ts` — CSS-to-device-pixel crop math at 1×/2×, clamping and the
  no-zero-size guard; the decode itself is checked in a real browser against a
  generated QR (jsdom has no `createImageBitmap`)
- `account-form.test.tsx` — a seeded `otpauth://` link fills issuer and account
  after the same debounce a pasted link gets
- `popup.test.tsx` — empty state, add by secret, add by URI with preview, copy +
  confirmation, search filter, locked gate, wrong passcode, unlock expiry
- `backup.test.tsx` — export gating without a passcode, export → wipe → import,
  import with a different passphrase, merge de-duplication and its report
- `sync.test.tsx` — M4: running/fresh/stale/failed states through the injected clock

Good tests assert what a user observes (a rendered code for a known secret and
time, a visible error, a stored value after an action, an offset from given
samples) and never the shape of internal state or the order of private calls.

Manual checks per phase: load unpacked build, add an account from a known
secret, compare the code against `oathtool`/another authenticator, exercise lock
and expiry by editing the session entry.

## 11. Phases

Each phase ends green (`npm run build` + relevant tests) and is independently
reviewable.

1. **Scaffold** — install deps, Tailwind v4 + shadcn manual setup, `tokens.css`
   from Appendix A, tsconfig paths, delete sidebar/content/background, new
   manifest, popup and options pages rendering the Button primitive. AC: popup opens
   styled at 360 px on warm paper, options tab opens, Firefox build loads, zero
   literal colours or px font sizes outside `tokens.css`, focus ring visible on
   the first interactive element.
2. **Pure lib** — base32, otpauth, totp + tests. AC: `npx vitest run` green
   including RFC vectors.
3. **Vault (plaintext)** — storage wrapper, CRUD, ordering, schema version. AC:
   accounts survive browser restart.
4. **Popup list** — live codes, countdown rule, copy, search, loading/empty/error
   states. AC: code matches a reference authenticator for the same secret and
   step; marker appears only in the three allowed places.
5. **Add/edit/delete** — inline form taking a secret or an `otpauth://` link with
   a live preview; delete sits in the edit screen and confirms in a dialog. AC:
   bad secret rejected, valid one previews and saves, delete is unreachable from
   the list.
6. **Passcode + encryption** — KDF/envelope, session unlock, 15-min expiry,
   lockout, OTP gate. AC: set passcode → restart → vault unreadable without it;
   wrong passcode 5× locks; expiry re-prompts.
7. **Backup** — encrypted export (copy + download), import with merge/replace.
   AC: export → delete all → import → identical codes for every account.
8. **Clock** — measurement, persistence, sync button, stale/offline states,
   auto-sync on first run. AC: with a simulated +20 s offset, codes match the
   corrected time rather than the device clock.
9. **Options page** — passcode management, encrypted backup export/restore with
   dialogs, danger zone, and the forgot-passcode erase path on the locked view.
   Clock details are deferred to M4. No theme toggle: one warm-paper skin, dark
   deferred.
10. **Polish + design sweep** — a11y (labels, focus rings, keyboard on the gate),
    error boundaries, copy tweaks, `STORE.md` listing rewrite, README, package
    description, version `0.1.0`. Then the design gate: `sloplint` on the UI
    sources (`node ~/.agents/skills/hallmark/scripts/sloplint.mjs src/action
    src/options src/components src/styles --genre modern-minimal --scope app`),
    fix every FAIL, waive on the record
    anything the extension page cannot satisfy (no URL for `--render`, so popup
    screenshots are captured manually); then the web-interface-guidelines review
    over `src/components` and the two entry pages, fixing real findings.

11. **Screen scan** — `activeTab` + `scripting`, injected selection layer,
    background capture/crop/decode, link handoff into the add form. AC: a QR of
    a known `otpauth://` link on a normal page fills the form with the same
    fields; a frame without a code keeps the layer open with one sentence.

## 12. Risks

| Risk | Mitigation |
| --- | --- |
| 6-digit PIN is weak against offline brute force | 600k PBKDF2, honest copy, longer passphrase planned |
| Plaintext vault when no passcode is set | One-time warning banner + badge in popup header |
| Forgotten passcode = unrecoverable vault | Backup passphrase is independent by default-offered choice; explicit one-line warning at export and at passcode setup |
| Raw AES key in `storage.session` | Session scope only, cleared on browser restart, never written to `local` |
| Time endpoint unreachable / rate-limited | Two endpoints, cached offset, stale indicator, settings override |
| React 19 + Extension.js 4.1.37 unverified | Pin React 18.3.1; upgrade is a separate change |
| Native `<dialog>` behaviour differs across engines | Chromium + Firefox are the targets (Firefox 115+); focus and backdrop checked in both, and the dialog is skinned by us, not the UA |
| Popup 800×600 clamp clipping overlays | Add/edit swap the panel instead of overlaying; only confirm dialogs float, and they are one screen tall |
| Firefox `storage.session` availability | Requires Firefox 115+; document it in the README |
| Clipboard timers dying with the popup | No auto-clear; copy on click only |
| Token drift (a hex or px literal sneaks into a component) | All values via `tokens.css` + mapped utilities; phase 10 sweep greps for literals |
| Marker overused as accent colour | Three fixed uses, checked in phase 4 and the sweep |
| Dark mode half-implemented | Dark variant is scoped and inert; no `.dark`, no `dark:` utilities, deferral recorded |
| Clock "100% sync" expectation | Offset is measured and displayed with confidence, never claimed exact |
| Screen capture reads more than the user framed | Capture happens only after the frame is drawn, cropping happens before decoding, the image is never stored or sent, and `activeTab` is per-click |
| Scan decode fails on stylised or tiny codes | `attemptBoth` inversion, a tighter-box message instead of a silent failure, manual entry stays the fallback |

## 13. Open items (decide during implementation, not blocking)

- Whether to add a longer passphrase option alongside the 6-digit passcode.
- Account ordering: creation order for v1; drag-reorder only if asked.
- Whether to auto-copy the freshest code on popup open (currently: never).
- Icon/branding pass for the store listing.

## Appendix A — design tokens (`src/styles/tokens.css`)

Source: web-ui-commentator v0.4.1, adopted unchanged. Kept verbatim so the
system stays portable back to that project. Notes for our context:

- Extension pages are ordinary documents, not shadow roots, so `:root` matches
  and `:host` is simply inert; both stay for portability.
- `@custom-variant dark` is scoped with `:where(...)`; nothing applies `.dark`,
  so every `dark:` utility stays inert and unrendered.
- `--radius-pin` stays outside `@theme` (it is a value, not a mapped step).
- Tokens not yet used (`--paper-3`, `--space-*`, part of the type scale) are the
  system, not dead code — components consume them by name, never by literal.
- `--shadow-raised` reaches Tailwind through `@utility shadow-raised`.

```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-marker: var(--marker);
  --color-marker-ink: var(--marker-ink);

  --font-sans: var(--font-ui);
  --font-mono: var(--font-code);

  --radius-xs: var(--radius-mark);      /* 4px  */
  --radius-sm: var(--radius-inner);     /* 6px  */
  --radius-md: var(--radius-control);   /* 8px  */
  --radius-lg: var(--radius-panel);     /* 10px */
  --radius-xl: var(--radius-card);      /* 12px */
}

@custom-variant dark (&:where(.dark, .dark *));

:root,
:host {
  /* Typography — system stack, works offline */
  --font-ui: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
    "Helvetica Neue", Arial, sans-serif;
  --font-code: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas,
    "Liberation Mono", monospace;

  /* Color — warm neutrals */
  --background: oklch(0.972 0.009 82);
  --foreground: oklch(0.2 0.012 70);
  --card: oklch(0.988 0.005 82);
  --card-foreground: oklch(0.2 0.012 70);
  --popover: oklch(0.988 0.005 82);
  --popover-foreground: oklch(0.2 0.012 70);
  --primary: oklch(0.235 0.012 70);
  --primary-foreground: oklch(0.985 0.005 82);
  --secondary: oklch(0.938 0.01 82);
  --secondary-foreground: oklch(0.24 0.012 70);
  --muted: oklch(0.944 0.01 82);
  --muted-foreground: oklch(0.455 0.014 72);
  --accent: oklch(0.938 0.012 82);
  --accent-foreground: oklch(0.2 0.012 70);
  --destructive: oklch(0.505 0.17 27);
  --destructive-foreground: oklch(0.985 0.005 82);
  --border: oklch(0.885 0.01 82);
  --input: oklch(0.62 0.014 76);
  --ring: oklch(0.235 0.012 70);

  /* The single highlighter */
  --marker: oklch(0.845 0.165 92);
  --marker-ink: oklch(0.235 0.02 80);

  /* Depth — hairline + one low shadow, no glows */
  --paper-2: oklch(0.945 0.01 82);
  --paper-3: oklch(0.92 0.012 82);
  --ink-2: oklch(0.3 0.012 70);
  --shadow-raised: 0 8px 16px -8px oklch(0.2 0.02 70 / 0.28);

  /* Radius — one step per nesting level, never derived */
  --radius-mark: 4px;
  --radius-inner: 6px;
  --radius-control: 8px;
  --radius-panel: 10px;
  --radius-card: 12px;
  --radius-pin: 999px;

  /* Spacing — 4px scale (+ 2px hairline step) */
  --space-3xs: 2px;
  --space-2xs: 4px;
  --space-xs: 8px;
  --space-sm: 12px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 40px;

  /* Motion — state only, never decoration */
  --dur-micro: 120ms;
  --dur-short: 160ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);

  /* Type scale — app UI scale, ratio 1.125 */
  --text-2xs: 0.625rem;
  --text-xs: 0.6875rem;
  --text-sm: 0.75rem;
  --text-base: 0.8125rem;
  --text-md: 0.875rem;
  --text-lg: 1rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.75rem;
}
```
