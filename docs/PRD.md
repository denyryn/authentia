# authentia — PRD

PRD for the TOTP authenticator extension. Source plan: `docs/PLAN.md` (architecture
and phasing). This document is the product contract: what the user gets, which
decisions are locked, and where the behavior is tested.

Status: ready for implementation. No implementation exists yet; the repo is still
the Extension.js scaffold.

## Problem Statement

Two-factor codes live on a phone. That is fine until you are working at a
computer and a login asks for a code:

- reaching for the phone, unlocking it, finding the right account and typing six
  digits costs more time than the login itself, and it happens many times a day;
- on a managed work machine the phone may be in another room, in a bag, or not
  allowed on the desk at all;
- an account list grows past the point where scrolling a phone screen for the
  right issuer is quick;
- codes fail for no visible reason when the machine's clock has drifted, and
  nothing in the current tools says so, so the user retries and eventually
  blames the service;
- seeds copied into a desktop tool are usually stored in plaintext, with no
  protection if the laptop is shared or stolen.

The user wants codes where the login is — in the browser — with the speed of a
click, protection for the seeds at rest, a backup that can actually be restored,
and a visible answer to "why is this code rejected".

## Solution

A browser extension that is an authenticator, not a website:

- the toolbar popup lists every account with a live code, each row copying on a
  click, each row showing how long the code stays valid;
- accounts are added by typing a base32 secret or pasting a standard
  `otpauth://` URI, with a live preview of the generated code before saving;
- an optional 6-digit passcode encrypts the vault at rest and gates the popup;
  unlocking is good for 15 minutes, so the passcode is not retyped on every
  click;
- once a passcode exists, the user can copy or download an encrypted backup and
  restore from it, including onto a different machine and with a passphrase that
  is independent of the unlock passcode;
- a one-click clock sync measures the machine's offset against an HTTPS time
  source, shows the measured offset, and makes codes use the corrected time;
  when the estimate is stale or unreachable the UI says so instead of pretending;
- everything is local: no account, no cloud, no telemetry, one host permission
  used only by the time probe.

The interface is deliberately dense, warm-paper and ink, with one highlighter
accent used only for the copy confirmation, the focused passcode box and the last
five seconds of a code.

## User Stories

### Getting started

1. As a browser user, I want an authenticator that opens from the toolbar, so that I do not have to pick up my phone for every login.
2. As a first-time user with no accounts, I want an empty state that explains what to do and offers one action, so that I am not staring at a blank panel.
3. As a first-time user, I want the extension to explain that data stays on this machine, so that I trust it with second-factor seeds.
4. As a first-time user, I want the clock measured automatically on first run, so that my very first code is already correct.
5. As a user, I want to open the options page from the popup, so that settings are one click away.

### Adding accounts

6. As a user, I want to add an account by typing issuer, account name and a base32 secret, so that any service can be set up manually.
7. As a user, I want the secret field to accept lowercase, spaces and missing padding, so that copying from a service's setup page does not fail.
8. As a user, I want an invalid secret rejected with a message under the field, so that I fix it before saving a broken account.
9. As a user, I want to paste an `otpauth://` URI and have issuer, account, secret, algorithm, digits and period filled in, so that I do not retype what the service already encoded.
10. As a user, I want to see the live code for the account I am about to save, so that I can confirm the secret is right before trusting it.
11. As a user, I want to save an account without a passcode set, so that the extension is usable immediately.
12. As a user, I want to see a single warning when the vault is unencrypted, so that I know the passcode is optional but recommended.
13. As a user with a non-standard service, I want to choose 6 or 8 digits, SHA1/SHA256/SHA512, and a period between 15 and 120 seconds, so that the odd provider still works.
14. As a user, I want a clear error when I paste a Google Authenticator migration URI, so that I know it is unsupported rather than broken.
15. As a user, I want the add form to close and the new account to appear at the end of the list, so that I see the result immediately.

### Viewing and copying codes

16. As a user, I want every account's current code visible in one list, so that I can read the code I need without navigating.
17. As a user, I want the code to update on the correct step boundary, so that I never read a stale code.
18. As a user, I want a countdown for each code, so that I know whether to wait or type now.
19. As a user, I want the countdown to change colour in its last five seconds, so that the urgency is visible before the code rolls.
20. As a user, I want to click a row to copy its digits, so that copying is one action.
21. As a user, I want a visible confirmation that the copy happened, so that I do not paste the previous clipboard content by mistake.
22. As a user, I want the confirmation mark to disappear on its own, so that the list returns to normal.
23. As a user, I want codes grouped in threes for readability, so that typing six digits is less error-prone.
24. As a user, I want 8-digit codes to render without breaking the row layout, so that non-standard accounts still look right.
25. As a user with many accounts, I want a search field that filters by issuer or account name, so that I reach an account without scrolling.
26. As a user with many accounts, I want the search field to appear only once the list is long, with a `/` shortcut, so that small lists stay uncluttered and typing still works immediately.
27. As a user, I want my accounts in a stable order between opens, so that muscle memory works.
28. As a user, I want the popup to keep one fixed width, so that nothing jumps under my cursor as codes change.

### Managing accounts

29. As a user, I want to rename an account's issuer or account name, so that I can fix a typo without re-entering the secret.
30. As a user, I want to replace an account's secret, so that I can recover from a service re-enrolment.
31. As a user, I want to delete an account behind a confirmation, so that a misclick does not destroy a seed I cannot re-obtain.
32. As a user, I want deletion to be immediate once confirmed, so that I am not asked twice.

### Passcode and locking

33. As a user, I want to set a 6-digit passcode, so that someone using my browser cannot read my seeds.
34. As a user, I want the passcode entry to look and behave like a one-time-code field, so that entry is fast and familiar.
35. As a user, I want the passcode field to accept a pasted 6-digit code, so that a password manager can fill it.
36. As a user, I want the gate to submit automatically at the sixth digit, so that I do not press a button.
37. As a user, I want arrow keys and backspace to move between the six boxes, so that correcting a typo is quick.
38. As a user, I want a wrong passcode to shake, clear, and explain, so that I know it failed rather than being ignored.
39. As a user, I want the popup to stay locked until the passcode is correct, so that no code or issuer is visible behind the gate.
40. As a user, I want my unlock to last 15 minutes across popup opens, so that clicking the toolbar repeatedly does not mean retyping digits.
41. As a user, I want the unlock to end when the browser restarts, so that a shared machine does not stay open to whoever logs in next.
42. As a user, I want a "lock now" action, so that I can end the session myself before handing the machine over.
43. As a user, I want repeated wrong attempts to impose a wait, so that guessing six digits is not a matter of persistence.
44. As a user, I want the lockout message to be honest that this is a UI guard, not a cryptographic one, so that I understand the real protection.
45. As a user who forgot the passcode, I want the settings page to offer erasing the vault and restoring a backup, so that a forgotten passcode is a recoverable dead end rather than a locked door.
46. As a user, I want to change the passcode without losing accounts, so that a shared or leaked code can be replaced.
47. As a user, I want removing the passcode to warn me first and decrypt the vault, so that I can opt out of encryption deliberately.

### Backup and restore

48. As a user, I want to create a backup only once a passcode exists, so that a download is never a plaintext seed dump.
49. As a user, I want the backup to take its own passphrase, so that backup and unlock credentials never have to match and one can be rotated without the other.
50. As a user, I want one line stating that the backup passphrase is the only way back into that file, so that I do not discover it after forgetting it.
51. As a user, I want to copy the backup text, so that I can paste it into a password manager note.
52. As a user, I want to download the backup as a dated file, so that I can keep it with my other recovery material.
53. As a user, I want the backup to be an encrypted envelope with its own parameters, so that it can be decrypted by a future version and on another machine.
54. As a user, I want to import a backup file or pasted text, so that a new browser or a reinstall does not mean re-enrolling every service.
55. As a user, I want import to ask for the backup's passphrase, so that a backup whose passphrase differs from my unlock passcode still works.
56. As a user, I want import to offer merge or replace, so that I can add a backup to existing accounts without destroying them.
57. As a user, I want merge to keep accounts with the same identity from duplicating, so that repeated imports do not grow the list.
58. As a user, I want import to report how many accounts were added, updated or skipped, so that I know what happened.

### Clock correctness

Deferred to M4 — none of these stories ship in v1; the section stays as the
agreed target for the next milestone.

59. As a user whose codes are rejected, I want a visible clock-sync control, so that I can fix the real cause in one action.
60. As a user, I want the sync to run several samples and keep the fastest, so that network asymmetry does not distort the result.
61. As a user, I want to see the measured offset, round-trip time and last sync time, so that I can judge whether the clock is trustworthy.
62. As a user, I want the sync control to show progress while it runs, so that I do not click it repeatedly.
63. As a user, I want a stale or low-confidence measurement marked in the header, so that I know the codes may be at risk before one fails.
64. As a user who is offline, I want the last known offset retained and the failure shown, so that codes still work and the reason is clear.
65. As a user, I want the offset applied to every code immediately after a sync, so that I do not wait for a reload.
66. As a user with an unusual network, I want to override the time endpoint, so that I am not stuck with a blocked host.
67. As a user, I want to reset the measured offset, so that a bad measurement can be discarded.
68. As a user, I want plain-language copy explaining that clock drift is the usual cause of rejected codes, so that I stop blaming the service.

### Options, privacy and housekeeping

69. As a user, I want the options page to group passcode, backup, clock and destructive actions in that order, so that the risky controls are last.
70. As a user, I want to choose the auto-lock duration, so that security and convenience match my environment.
71. As a user, I want to delete all extension data behind a type-to-confirm, so that wiping is deliberate and complete.
72. As a user, I want to know that data never leaves this machine except for a time probe that sends nothing about me, so that privacy is a stated fact, not a guess.
73. As a user, I want the extension to request no access to the pages I browse, so that installing it does not widen what the browser exposes.
74. As a user, I want a clear error state if the vault cannot be decrypted, with the restore path, so that corruption is not a silent blank screen.
75. As a keyboard user, I want every control reachable and visibly focused, so that the extension is usable without a mouse.
76. As a user who asks the system for reduced motion, I want the shake and the countdown transition reduced, so that the UI respects that setting.
77. As a Firefox user, I want the same features as in Chromium, so that the browser choice does not change the product.
78. As a user installing from a store, I want a listing that describes the encrypted vault and the single network call, so that the description matches the behavior.

## Implementation Decisions

### Surfaces and shell

- The product has exactly two surfaces: a toolbar popup and an options page
  opened in a tab. The template's sidebar, content script and background worker
  are removed; no background context is needed because the popup and options
  page talk to storage directly.
- The popup is a fixed 360px-wide document with no viewport units, because both
  Chromium and Firefox clamp popups to 800×600 and viewport units cause circular
  sizing. Long flows (backup, passcode management, clock detail) live in the
  options tab; the popup swaps its panel for an inline add/edit form and opens a
  dialog only to confirm deleting an account.
- Both browser targets ship: Chromium MV3 and Firefox MV2, using the manifest's
  `chromium:`/`firefox:` key prefixes. Permissions are `storage` plus host access
  to the two time endpoints; the template's `tabs` and `sidePanel` permissions are
  dropped, and no content script or `<all_urls>` access remains.
- No `content_security_policy` override: styling is compile-time CSS and all
  script is bundled, which MV3 already permits.

### Vault model

- A single vault holds an ordered list of accounts; there is no folder, tag or
  grouping concept in v1. Order is creation order and is stable across opens.
- An account is identified by a generated UUID and stores issuer, account name,
  base32 secret, algorithm (default SHA1), digits (6 or 8, default 6), period
  (default 30) and creation time.
- The vault is stored in local extension storage under two shapes: a plaintext
  shape used when no passcode is set, and an encrypted envelope. Both carry a
  schema version so a later release can migrate without guessing.
- Settings (auto-lock minutes, time endpoint override, failed-attempt count and
  lockout deadline) are a separate local record from the vault.
- The measured clock state (offset, round-trip time, timestamp, source,
  confidence, sample count) is its own local record, so the popup can show it
  without touching the vault.

### Crypto and passcode

- The passcode encrypts the vault: PBKDF2-SHA256 with 600,000 iterations and a
  16-byte salt, then AES-GCM-256 with a fresh 12-byte IV for every write. The
  ciphertext is bound to the format version through additional authenticated
  data, so a re-labelled or truncated envelope fails to open rather than
  decrypting into something else.
- The salt is stable for the life of a passcode and is regenerated only when the
  passcode changes, so unlock cost is predictable and repeated unlocks are not
  slower.
- The envelope also covers the passcode-checked settings subset; a successful
  decrypt is the only passcode proof, so there is no separate verifier value and
  no ambiguous "wrong or corrupt?" state.
- Unlocking derives the key and derives an expiry from the configured auto-lock
  minutes; both the raw key and the expiry are written to session storage only.
  Writes re-encrypt with a fresh IV and extend the expiry.
- Locking deletes the session record. Expiry is evaluated when the popup mounts
  and on storage reads, not by a timer that outlives the page.
- Five wrong attempts impose a 30-second wait, five more impose five minutes.
  The counter lives in settings and is described in the UI as a speed bump, not
  as a security boundary.
- Removing the passcode rewrites the vault as plaintext after an explicit
  warning; changing the passcode decrypts with the old key and re-encrypts with
  a new salt and key.

### Backup and restore

- Backup export requires a passcode and produces an encrypted envelope with its
  own KDF block, independent of the vault envelope, so backup and unlock
  credentials never have to match.
- Export takes a separate backup passphrase, entered twice, and states in one
  line that it is the only way back into that file.
- Both copy and download are offered, with a filename containing the date.
- Import accepts a file or pasted text, asks for the backup's passphrase, and
  offers merge or replace. Merge matches accounts by identity (issuer, account
  name, secret) rather than by id, so importing the same backup twice does not
  duplicate entries, and reports added, updated and skipped counts.

### Clock sync

- Codes are computed from the local clock plus a stored offset, never from a
  trusted device clock alone.
- A sync takes five HTTPS samples, computes a per-sample offset as server time
  minus the midpoint of the local send/receive window, keeps the sample with the
  smallest round-trip time, and marks confidence low when sample spread or
  round-trip time exceeds the thresholds.
- The primary source is a Cloudflare trace endpoint whose body carries fractional
  epoch seconds; the fallback is a JSON time API. Both are covered by host
  permissions, so response headers and bodies are readable without CORS.
- Sync runs automatically on first use and when the stored measurement is older
  than 24 hours; otherwise it is on demand from the popup header.
- Stale or low-confidence measurements tint the sync control and explain
  themselves in a tooltip; unreachable endpoints keep the last offset, tint the
  control as destructive, and still render codes. The word "exact" is never used
  anywhere in the UI or the listing.

### TOTP engine

- Base32 decoding follows RFC 4648 and tolerates lowercase, internal spaces and
  missing padding while rejecting invalid characters and impossible lengths.
- Code generation uses WebCrypto HMAC over an 8-byte big-endian time counter,
  dynamic truncation, modulo 10^digits and zero padding; the secret is decoded
  in the page that displays the code and never leaves it except as ciphertext.
- URI parsing accepts the standard `otpauth://totp/` form, defaults to
  SHA1/6/30, rejects out-of-range digits or periods, and gives a distinct message
  for `otpauth-migration://` URLs rather than misparsing them.

### Interface system

- All visual values come from one token file adopted from the web-ui-commentator
  v0.4.1 system: warm paper background, ink primary, a single highlighter accent.
  Components consume tokens by name; no literal colour, font size, radius,
  spacing step or duration appears in a component.
- The accent is reserved for exactly three uses: the copied chip, the focused
  passcode box, and the countdown rule under five seconds. The options page uses
  none.
- Light theme only. The token block's dark variant is scoped and inert; no dark
  class or dark utility is written.
- Mutually exclusive choices on the options page are segmented tabs, never
  radios: full width, one selected chip, arrow keys move the selection.
- Radius follows one step per nesting level (12 for dialogs, 10 for sections and
  the account panel, 8 for controls and passcode boxes, 4 for chips, circular for
  badges). Rows inside the panel are square. Spacing uses the 4px scale only.
- Motion is limited to state: 120ms for hover and press, 160ms for a panel
  reveal, transform/opacity/colour only. Width, height, top and left are never
  animated; the countdown is `transform: scaleX`. Reduced-motion users lose the
  chip and dialog animations and the gate's shake.
- Every data region ships four states (loading skeleton in the shape of the
  content, empty with the one action that fills it, error with the failure and
  the recovery path, and full), because a list that only draws its full state is
  a quarter of a screen.
- Accessibility is part of the contract: real labels, instant ink focus rings,
  icon buttons with a 44px hit area, no emoji icons, sentence-case labels with no
  letter-spacing, and verified contrast on the token pairs (foreground 16.7:1,
  muted 6.7:1, marker ink on marker 10.4:1, destructive 5.9:1, input border
  3.5:1).

### Build and configuration

- React 18.3.1 is pinned because Extension.js 4.1.37's own React example targets
  18; React 19 is only a separate, later change.
- Tailwind CSS v4 runs through PostCSS (`@tailwindcss/postcss`), not through a
  bundler plugin, because Extension.js drives its own Rspack pipeline.
- Two UI primitives are hand-written on the same tokens: `button` (cva variants)
  and `dialog` (native `<dialog>` + `showModal`, skinned centrally). No card,
  badge, dropdown, toast or alert-dialog dependency: the popup uses one panel and
  confirmations are dialogs.
- Path aliases come from the TypeScript `paths` map, which Extension.js reads
  directly.
- Type scale utilities are defined once from the token scale because Tailwind's
  own default scale is intentionally unused.

## Testing Decisions

A good test here asserts what a user can observe — a rendered code for a known
secret and time, a visible error, a stored value after an action, a computed
offset from given samples — and never the shape of internal state, the order of
private helper calls, or a mocked implementation detail. A test that would keep
passing after the code produced a wrong digit is worthless.

### The seam

One seam, at the app boundary: each page is composed with a single injected
environment (storage, clock source, current-time provider). Everything above it —
unlock, list rendering, copy, add/edit/delete, backup, clock display, error and
empty states — is exercised through the real UI against an in-memory fake
environment. Nothing else is mocked: crypto runs for real on the runtime's
WebCrypto, and time is passed in explicitly rather than faked globally.

This is the highest seam available without a browser and keeps the count at one.
It costs three dev dependencies (a DOM test environment and a React testing
library with its user-event companion) and one hard rule: no page component
imports the extension API directly. Confirmed with the product owner; the
alternative — pure-logic tests plus manual UI checks — was rejected as cheaper
now and weaker later.

### Modules under test

- Base32 decoding and URI parsing: tolerance table, rejection table, defaults,
  migration-URI rejection.
- TOTP generation: RFC 6238 published vectors for SHA1, SHA256 and SHA512, 6 and
  8 digits, 30- and 60-second periods, and behavior at a step boundary.
- Vault crypto: encrypt/decrypt round trip, wrong passcode failure, fresh IV per
  write, tampered ciphertext failure, passcode change and removal migrations.
- Backup: export envelope round trip, import with a passphrase different from the
  current one, merge de-duplication and the added/updated/skipped report.
- Clock: offset math from synthetic samples, min-RTT selection, confidence
  thresholds, stale detection, offline fallback retaining the previous offset.
- Pages, through the single seam: first run with an empty vault, add by secret,
  add by URI with preview, copy with confirmation, search filtering, lock gate
  and wrong-passcode path, unlocking and expiry, backup export gating, import
  merge/replace, and sync states (running, fresh, stale, failed).

### Prior art

The repo has no tests today, so there is no in-repo prior art to copy. The
reference oracle for correctness is external: the RFC 6238 vectors for codes and
the quoted contrast ratios for the token pairs. The first implemented test file
therefore sets the house pattern, and every later test follows it rather than
inventing a new style.

### Manual verification per phase

Build and load the extension unpacked in each target browser, add an account with
a known secret, and compare its code and step boundary against an independent
authenticator. Simulate drift by adding an offset and confirm the sync corrects
it. Verify lock expiry by editing the session record, and restore-from-backup by
deleting all data and importing. Visual checks (popup width, focus rings,
reduced-motion behavior) are performed against the built extension, not a
standalone dev page, because the popup's size constraints only exist there.

## Out of Scope

- Camera or image QR scanning, and Google Authenticator migration-protocol import.
- Sync of seeds across devices through the browser account, or any server-side
  account.
- Folders, tags, custom ordering, drag-reorder, or multi-vault support.
- Autofill of codes into websites, and any content-script or page access.
- Account icons or favicons fetched from the network.
- Passkeys/WebAuthn and HOTP.
- A longer passphrase as the primary unlock secret (noted as a follow-up risk,
  not built here).
- Dark mode; light only, deliberately.
- Localization, Safari/WebKit support, telemetry or crash reporting.
- Clipboard auto-clear after a timeout (cannot outlive the popup without a
  background document).
- Store submission itself; the listing text is updated, publishing is not.

## Further Notes

- The single largest product risk is that a 6-digit passcode is 10^6 guesses. At
  600k PBKDF2 iterations an attacker holding the profile can still brute force an
  envelope in hours on a decent GPU. The UI and the listing must describe the
  passcode as protection against casual access, and the longer-passphrase option
  is the natural next increment.
- The second risk is recovery: an encrypted-only backup plus a forgotten passcode
  is total loss. That is why the backup passphrase is offered as independent by
  default and why the export dialog states the consequence rather than hiding it.
- "100% in sync" is not achievable and must never be promised; the measured
  offset and its confidence are the honest substitute.
- Firefox support depends on session storage, available from Firefox 115; the
  README states that floor.
- The extension's release version starts at 0.1.0. The store metadata file still
  describes the template sidebar and is rewritten in the final phase.
- Deferred decisions, not blocking implementation: whether a longer passphrase is
  offered alongside the 6-digit passcode, and whether the freshest code is ever
  auto-copied on popup open (current answer: never).
