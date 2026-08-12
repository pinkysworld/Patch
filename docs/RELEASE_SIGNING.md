# Native signing and notarization

Patch treats signing as a property of the **final project artifact**, not of a reusable runtime template. A final `.exe` or `.app` is built first and only then signed. This avoids claiming a valid platform signature after project-specific payload/build output has changed.

## Native Distribution workflow

`.github/workflows/native-distribution.yml` is a manually dispatched project distribution workflow for Windows, macOS and Linux. It uses the direct Win32/AppKit/GTK GUI backends for Window projects and the native Console builder for Console projects.

`signing_mode` has two values:

- `unsigned` — default. Build succeeds without certificate secrets and includes `PATCH-SIGNING.json` with `distributionStatus: "unsigned"`.
- `require` — fail closed. Windows/macOS output is produced only if the platform signature can be created **and verified**. Linux currently refuses this mode because Patch does not define a Linux code-signing claim yet.

The workflow does not silently downgrade `require` to unsigned.

Pull requests run an unsigned Windows/macOS/Linux distribution smoke on the direct native backends. Signing secrets are scoped only to the manually dispatched `require` signing steps, not to the normal build/smoke environment. Draft pull requests skip those native distribution jobs so iterative development does not repeatedly trigger the full platform matrix.

## Verification evidence

The final signing manifest is not inferred from `signing_mode=require` alone. Each signing script removes any stale internal marker before it begins and writes a platform-specific verification marker **only after** all required platform verification has succeeded:

- Windows: `windows-authenticode-v1`
- macOS: `macos-developer-id-notarized-v1`

The packaging step requires the exact marker before it may pass `verified=true` to the signing-status manifest builder. Missing or altered evidence stops the workflow. The internal marker is then removed and is not shipped as user-facing signing proof; `PATCH-SIGNING.json` is the normalized package status.

## Windows

Required repository secrets when `signing_mode=require`:

- `PATCH_WINDOWS_PFX_BASE64` — base64-encoded Authenticode PFX/PKCS#12 certificate.
- `PATCH_WINDOWS_PFX_PASSWORD` — password for the PFX.

`scripts/sign-windows.ps1` finds Windows SDK `signtool.exe`, signs every final `.exe` under the distribution directory with SHA-256 and an RFC3161 timestamp, then runs `signtool verify /pa /v /tw` for every executable. The temporary PFX is deleted in a `finally` block. The Windows verification marker is created only after every executable passes verification.

A Windows distribution is marked `signed` only after that verification evidence is present.

## macOS

Required repository secrets when `signing_mode=require`:

- `PATCH_MACOS_P12_BASE64` — base64-encoded Developer ID Application certificate + private key.
- `PATCH_MACOS_P12_PASSWORD` — PKCS#12 password.
- `PATCH_MACOS_SIGN_IDENTITY` — exact Developer ID Application identity used by `codesign`.
- `PATCH_APPLE_ID` — Apple account used by `notarytool`.
- `PATCH_APPLE_TEAM_ID` — Apple Developer Team ID.
- `PATCH_APPLE_APP_PASSWORD` — app-specific password for `notarytool`.

`scripts/sign-notarize-macos.sh` creates a temporary keychain, imports the certificate, signs the final `.app` with hardened runtime and secure timestamping, and verifies it with `codesign`. It submits the app to Apple notarization with `notarytool --wait --output-format json` and explicitly requires the returned status to be `Accepted`. The workflow then staples and validates the ticket, re-verifies the code signature, requires Gatekeeper `spctl` assessment to pass, and only then emits macOS verification evidence. The original user keychain search list is restored during cleanup.

A macOS distribution is marked `signed-and-notarized` only after all required verification evidence succeeds.

## Linux

Patch currently packages Linux distributions as explicitly unsigned artifacts. `PATCH-SIGNING.json` records that state. SHA-256/release provenance remains the integrity mechanism. `signing_mode=require` fails intentionally until Patch defines and documents a concrete Linux signing/distribution policy.

See `docs/LINUX_PACKAGING.md` for the current GTK3/Console ABI, archive, installation/removal and integrity boundaries.

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

The manifest builder refuses invalid signing modes, contradictory unsigned/signed claims, a required Windows/macOS signature without verified evidence, and required macOS distribution without notarization. Re-serializing an already normalized signed status preserves the signed state instead of rebuilding it as unsigned.

## Current boundary

The repository now contains the fail-closed signing/notarization machinery, but **no claim is made that the project's GitHub repository currently has the required certificate secrets configured**. Production-readiness checkboxes for Windows signing and macOS signing/notarization should stay open until a real final distribution artifact has passed the signing workflow with real credentials and the resulting package has been inspected.
