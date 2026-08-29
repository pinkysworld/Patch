from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected one guarded match, found {count}: {old!r}")
    p.write_text(text.replace(old, new, 1))


replace_once(
    'web/playground.js',
    "function runProject() {\n  if (runInProgress) return;\n  runInProgress = true;\n  runButton?.setAttribute('aria-busy', 'true');\n  if (runButton) runButton.disabled = true;\n  try {\n    const compiled = compile(code.value, projectOptions());\n    const nextRuntime = new PatchInterpreter();\n    const result = nextRuntime.runAst(compiled.ast);\n    runtime = nextRuntime;\n    pendingRunIr = compiled.ir;\n    output.textContent = result.output.length ? result.output.join('\\n') : '(program finished with no console output)';\n    changesView.textContent = formatChangeAnalysis(compiled.ir);\n    renderWindows(appView, result.ui, true);\n    showTab(result.ui.length ? 'app' : 'output');\n  } catch (err) {\n    runtime = null;\n    pendingRunIr = null;\n    output.textContent = `Patch stopped:\\n${formatStudioStop(err, 'run')}`;\n    appView.innerHTML = '<p class=\"empty-preview\">The app could not start.</p>';\n    changesView.textContent = `Change contract unavailable:\\n${err.message}`;\n    showTab('output');\n  } finally {\n    runInProgress = false;\n    runButton?.removeAttribute('aria-busy');\n    if (runButton) runButton.disabled = false;\n  }\n}",
    "function runProject() {\n  if (runInProgress) return;\n  runInProgress = true;\n  runButton?.setAttribute('aria-busy', 'true');\n  if (runButton) runButton.disabled = true;\n  // A Run command must acknowledge immediately even for a large RAD project.\n  // Compile, execute and render in the next browser task so command handling,\n  // accessibility state and automation remain responsive while semantics stay\n  // exactly the same as the synchronous compiler/runtime pipeline.\n  setTimeout(executeRunProject, 0);\n}\n\nfunction executeRunProject() {\n  try {\n    const compiled = compile(code.value, projectOptions());\n    const nextRuntime = new PatchInterpreter();\n    const result = nextRuntime.runAst(compiled.ast);\n    runtime = nextRuntime;\n    pendingRunIr = compiled.ir;\n    output.textContent = result.output.length ? result.output.join('\\n') : '(program finished with no console output)';\n    changesView.textContent = formatChangeAnalysis(compiled.ir);\n    renderWindows(appView, result.ui, true);\n    showTab(result.ui.length ? 'app' : 'output');\n  } catch (err) {\n    runtime = null;\n    pendingRunIr = null;\n    output.textContent = `Patch stopped:\\n${formatStudioStop(err, 'run')}`;\n    appView.innerHTML = '<p class=\"empty-preview\">The app could not start.</p>';\n    changesView.textContent = `Change contract unavailable:\\n${err.message}`;\n    showTab('output');\n  } finally {\n    runInProgress = false;\n    runButton?.removeAttribute('aria-busy');\n    if (runButton) runButton.disabled = false;\n  }\n}"
)

branding = Path('tests/studio-branding.test.js')
text = branding.read_text()
needle = "  assert.match(forms, /patch-designer-active-form-change/);\n});\n"
replacement = "  assert.match(forms, /patch-designer-active-form-change/);\n});\n\ntest('Run command yields before the large compile, execute and render pipeline', () => {\n  const playground = fs.readFileSync('web/playground.js', 'utf8');\n  assert.match(playground, /setTimeout\(executeRunProject, 0\)/);\n  assert.match(playground, /function executeRunProject\(\)/);\n  assert.match(playground, /runInProgress = true/);\n  assert.match(playground, /runInProgress = false/);\n});\n"
if needle not in text:
    raise SystemExit('tests/studio-branding.test.js: expected async-run insertion point not found')
branding.write_text(text.replace(needle, replacement, 1))

Path('.github/scripts/r0_async_run_once.py').unlink(missing_ok=True)
