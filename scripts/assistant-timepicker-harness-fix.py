from pathlib import Path

path = Path('scripts/assistant-timepicker-showcase-polish.mjs')
text = path.read_text()

start = text.index("replaceOnce('src/window-input-presentation.js', `      } else if (date) {")
end = text.index("\n\n// Current Ready native remains intentionally fail-closed.", start)
replacement = '''replaceOnce('src/window-input-presentation.js', "      } else if (date) {\\n        clearMaskFromStudioInput(input);\\n        input.setAttribute('aria-label', `${id || 'Date'} date input`);\\n      } else if (mask && !password)", "      } else if (date) {\\n        clearMaskFromStudioInput(input);\\n        input.setAttribute('aria-label', `${id || 'Date'} date input`);\\n      } else if (time) {\\n        clearMaskFromStudioInput(input);\\n        input.setAttribute('aria-label', `${id || 'Time'} time input`);\\n      } else if (mask && !password)");'''
text = text[:start] + replacement + text[end:]

start = text.index("replaceOnce('src/native-current-contract.js', `      if (node.inputPresentation === 'date') {")
end = text.index("\n\n// Standalone Web contract and renderer.", start)
replacement = '''replaceOnce('src/native-current-contract.js', "      if (node.inputPresentation === 'date') {\\n        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\\n      }\\n      if (node.inputMask) {", "      if (node.inputPresentation === 'date') {\\n        throw new NativeGuiError(`DatePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no date-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\\n      }\\n      if (node.inputPresentation === 'time') {\\n        throw new NativeGuiError(`TimePicker Stage 1 Input${name} is Studio/Web only. Current Ready native ${PATCH_CURRENT_NATIVE_RUNTIME_VERSION} has no time-input presentation contract; validation fails closed rather than lowering it as a plain text Input.`);\\n      }\\n      if (node.inputMask) {");'''
text = text[:start] + replacement + text[end:]

path.write_text(text)
