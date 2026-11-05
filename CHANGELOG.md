# Changelog

Notable changes to Authentia. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-11-06

### Fixed

- Passcode boxes render as password inputs, so entered digits are masked.
- The wordmark and the settings heading use the capitalized product name.

### Changed

- The README now covers installation, day-to-day use, the security model,
  architecture, development commands and known limits.

## [0.2.0] - 2026-10-31

### Added

- Screen scan. Drag a frame around a QR code on the current page and the
  `otpauth://` link lands in the add form. The tab is captured only after the
  selection is drawn, cropped, decoded locally, and the image is discarded.
- Background worker that captures the tab, maps the CSS-pixel selection onto the
  device-pixel frame, decodes with jsQR and hands the link to the popup.
- Crop geometry tests at 1x and 2x, including clamping and the zero-size guard.

## [0.1.0] - 2026-10-31

### Added

- TOTP accounts with live 6- and 8-digit codes, copy on click, search, add, edit
  and delete.
- Add by base32 secret or `otpauth://totp/` link, with a live preview before
  saving.
- Optional six-digit passcode. PBKDF2-SHA256 with 600,000 iterations derives an
  AES-GCM-256 key; the vault is encrypted at rest and unlocked for an auto-lock
  window.
- Encrypted backup export by copy or download, and restore by file or pasted
  text with merge or replace.
- Options page for passcode management, auto-lock, backup, restore and data
  deletion, including the locked-vault erase path.
- Chromium Manifest V3 and Firefox Manifest V2 builds, a responsive popup design
  system, and RFC 6238 test vectors for the TOTP engine.
