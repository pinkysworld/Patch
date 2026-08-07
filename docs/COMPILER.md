# Patch Compiler Architecture

## Status

Patch 0.1 was interpreter-only. The `studio/0.2` development line introduces the first real compiler front end:

```text
Patch source
   |
   v
parser
   |
   v
AST
   |
   v
Patch compiler
   |
   v
Change IR
   |
   +--> .patchapp portable bundle   [implemented in 0.2 dev]
   +--> WebAssembly                 [planned backend]
   +--> native host package         [planned backend]
   `--> portable C99 fallback       [planned backend]
```

`src/compiler.js` currently lowers valid Patch source to a normalized JSON Change IR. `src/bundle.js` packages source + IR + manifest into a portable `.patchapp` bundle.

## Why Change IR

In Patch, a state change is not instrumentation added after assignment. The change is the mutation primitive. The compiler therefore preserves `CHANGE` explicitly in its intermediate representation.

Example:

```patch
change score:
  add 1
```

becomes conceptually:

```json
{
  "code": "CHANGE",
  "target": "score",
  "operations": [
    { "op": "add", "expr": "1" }
  ]
}
```

Later compiler stages may specialize this into efficient machine operations, but the semantic Change IR remains available for history, debugging, preview, replay, and conflict analysis.

## Application kinds

Patch has one language and one compiler with multiple application profiles.

### Console application

Has console I/O and no graphical event loop by default.

Planned packages:

- Windows PE console executable (`.exe`);
- macOS Mach-O CLI, preferably Universal where practical;
- Linux ELF CLI;
- BSD/Unix native or portable-C build;
- WebAssembly/WASI component;
- portable `.patchapp`.

### Window application

Uses Patch UI and a graphical event loop.

Planned packages:

- Windows GUI-subsystem `.exe`;
- macOS `.app` bundle;
- Linux/BSD graphical executable;
- browser application;
- portable `.patchapp`.

## Portable `.patchapp`

The canonical portable bundle is designed to remain independent of one host OS.

Current beta representation is human-readable JSON:

```text
MyApp.patchapp
  manifest
  source files
  Change IR
  assets
```

A later binary/ZIP container may replace the transport encoding while preserving the logical format.

## Native packaging strategy

Patch should not implement x86-64, ARM64, RISC-V, PE, Mach-O and ELF backends itself in the early project.

The initial native strategy is:

```text
program.wasm + small Patch host/runtime = standalone native package
```

This allows one code generator to support multiple operating systems while native host shells provide windows, menus, file dialogs, clipboard integration, application lifecycle, and packaging.

A future AOT backend can be added without changing Patch source semantics.

## Unix portability escape hatch

For systems without a supported WebAssembly runtime or Patch native host, the compiler should eventually support:

```text
Patch -> Change IR -> portable C99
```

This is especially valuable for console programs on less common Unix variants and architectures.

## Compiler commands

Development syntax:

```text
patch run hello.patch
patch check hello.patch
patch build hello.patch --kind console --target portable
```

The 0.2 development compiler currently emits `.patchapp`. `--target windows`, `macos`, `linux`, `bsd`, `web`, and `wasm` become active as the corresponding packagers/backends land.

## Compiler design constraint

The sophistication of the backend must never leak into beginner Patch code. Target-specific APIs must be optional escape hatches, not prerequisites for ordinary applications.
