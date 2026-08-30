from pathlib import Path

path = Path('web/forms-designer.js')
text = path.read_text()

old = """    if (designer) {
      for (const handle of body.querySelectorAll(':scope > .patch-form-resize-handle')) handle.remove();
    }

    const sourceHasLayout = Boolean("""
new = """    let selectedLayoutControl = false;

    const sourceHasLayout = Boolean("""
if text.count(old) != 1:
    raise SystemExit(f'expected one eager resize-handle removal block, found {text.count(old)}')
text = text.replace(old, new, 1)

old = """      if (designer && el.classList.contains('designer-selected')) {
        selectedForm = windowIndex;
        addResizeHandle(body, el, { windowIndex, controlIndex: control.controlIndex });
      }
    });
  });"""
new = """      if (designer && el.classList.contains('designer-selected')) {
        selectedLayoutControl = true;
        selectedForm = windowIndex;
        addResizeHandle(body, el, { windowIndex, controlIndex: control.controlIndex });
      }
    });
    if (designer && !selectedLayoutControl) {
      for (const handle of body.querySelectorAll(':scope > .patch-form-resize-handle')) handle.remove();
    }
  });"""
if text.count(old) != 1:
    raise SystemExit(f'expected one selected resize-handle block, found {text.count(old)}')
text = text.replace(old, new, 1)
path.write_text(text)
