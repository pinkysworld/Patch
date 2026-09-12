import fs from 'node:fs';

function update(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`No ScrollBar integration fix applied to ${path}`);
  fs.writeFileSync(path, after);
}

update('src/window-webapp.js', source => {
  const before = 'validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowProgressBar: true, allowMemo: true, allowPaintBox: true, allowImageList: true });';
  const after = 'validateWindowRuntimeSupport(compiled, { allowTree: true, allowSlider: true, allowProgressBar: true, allowScrollBar: true, allowMemo: true, allowPaintBox: true, allowImageList: true });';
  if (!source.includes(before)) throw new Error('Standalone Window Web runtime-support anchor is missing.');
  return source.replace(before, after);
});

update('web/slider-stage1.js', source => {
  let next = source;
  const oldHint = 'ProgressBar is passive; ScrollBar stays interactive with ordinary Slider changed(value). Both presentations are Studio/Web and fail closed on Current Ready native 1.10.';
  const newHint = 'ProgressBar is a passive source-backed number-state presentation. ScrollBar stays interactive with ordinary Slider changed(value). Both presentations are Studio/Web and fail closed on Current Ready native 1.10.';
  if (!next.includes(oldHint)) throw new Error('Combined Slider presentation hint anchor is missing.');
  next = next.replace(oldHint, newHint);

  const badSelector = '[data-window-index=\\"${added.windowIndex}\\"][data-control-index=\\"${added.controlIndex}\\"]';
  const goodSelector = '[data-window-index="${added.windowIndex}"][data-control-index="${added.controlIndex}"]';
  if (next.includes(badSelector)) next = next.replace(badSelector, goodSelector);
  return next;
});

console.log('ScrollBar Standalone Web allowance, Inspector compatibility and Studio selector fixed.');
