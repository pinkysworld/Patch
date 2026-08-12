# Native signing and notarization

Patch treats signing as a property of the **final project artifact**, not of a reusable runtime template. A final `.exe` or `.app` is built first and only then signed. This avoids claiming a valid platform signature after project-specific payload/build output has changed.

## Native Distribution workflow

`.github/workflows/native-distribution.yml` is a manually dispatched project distribution workflow for Windows, macOS and Linux. It uses the direct Win32/AppKit/GTK GUI backends for Window projects and the native Console builder for Console projects.

`signing_mode` has two values:

- `unsigned` — default. Build succeeds without certificate secrets and includes `PATCH-SIGNING.json` with `distributionStatus: "unsigned"`.
- `require` — fail closed. Windows/macOS output is produced only if the platform signature can be created **and verified**. Linux currently refuses this mode because Patch does not define a Linux code-signing claim yet.

The workflow does not silently downgrade `require` to unsigned.

## Windows

Required repository secrets when `signing_mode=require`:

- `PATCH_WINDOWS_PFX_BASE64` — base64-encoded Authenticode PFX/PKCS#12 certificate.
- `PATCH_WINDOWS_PFX_PASSWORD` — password for the PFX.

`scripts/sign-windows.ps1` finds Windows SDK `signtool.exe`, signs every final `.exe` under the distribution directory with SHA-256 and an RFC3161 timestamp, then runs `signtool verify /pa /v` for every executable. The temporary PFX is deleted in a `finally` block.

A Windows distribution is marked `signed` only after that verification step succeeds.

## macOS

Required repository secrets when `signing_mode=require`:

- `PATCH_MACOS_P12_BASE64` — base64-encoded Developer ID Application certificate + private key.
- `PATCH_MACOS_P12_PASSWORD` — PKCS#12 password.
- `PATCH_MACOS_SIGN_IDENTITY` — exact Developer ID Application identity used by `codesign`.
- `PATCH_APPLE_ID` — Apple account used by `notarytool`.
- `PATCH_APPLE_TEAM_ID` — Apple Developer Team ID.
- `PATCH_APPLE_APP_PASSWORD` — app-specific password for `notarytool`.

`scripts/sign-notarize-macos.sh` creates a temporary keychain, imports the certificate, signs the final `.app` with hardened runtime and secure timestamping, verifies it with `codesign`, submits the app to Apple notarization with `notarytool --wait`, staples the ticket, validates the staple, re-verifies the code signature, and finally assesses the application with Gatekeeper `spctl`.

A macOS distribution is marked `signed-and-notarized` only after all required verification steps succeed.

## Linux

Patch currently packages Linux distributions as explicitly unsigned artifacts. `PATCH-SIGNING.json` records that state. SHA-256/release provenance remains the integrity mechanism. `signing_mode=require` fails intentionally until Patch defines and documents a concrete Linux signing/distribution policy.

## Signing status manifest

Every Native Distribution package includes `PATCH-SIGNING.json` using `patch-signing-status` version 1. The format records:

```json
{
  "format": "patch-signing-status",
  "version": 1,
  "platform": "windows",
  "requested": "require",
  "signed": true,
  "signatureVerified": true,
  "notarized": false,
  "distributionStatus": "signed"
}
```

The manifest builder refuses to serialize a required Windows/macOS signature unless verification was recorded, and refuses required macOS distribution unless notarization was also recorded.

## Current boundary

The repository now contains the fail-closed signing/notarization machinery, but **no claim is made that the project's GitHub repository currently has the required certificate secrets configured**. Production-readiness checkboxes for Windows signing and macOS signing/notarization should stay open until a real final distribution artifact has passed the signing workflow with real credentials and the resulting package has been inspected.
