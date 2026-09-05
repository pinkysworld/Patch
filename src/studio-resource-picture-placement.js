import {
  addDesignerControl,
  listDesignerControls,
  listDesignerWindows,
  updateDesignerControl,
  updateDesignerWindow
} from './designer.js';
import { formControlDefaultSize } from './form-layout.js';
import { studioResourceSourceExpression } from './studio-resources.js';

const DEFAULT_FORM = Object.freeze({ width: 640, height: 420 });

/**
 * Convert a browser drop point into source-backed Form coordinates.
 * Designer Form geometry is expressed in CSS pixels, so no hidden scaling
 * model is introduced here. The placement is clamped to the current Form.
 */
export function resourcePictureDropLayout(point, rect, form, size = formControlDefaultSize('picture')) {
  const width = positiveDimension(form?.width, DEFAULT_FORM.width);
  const height = positiveDimension(form?.height, DEFAULT_FORM.height);
  const pictureWidth = positiveDimension(size?.width, formControlDefaultSize('picture').width);
  const pictureHeight = positiveDimension(size?.height, formControlDefaultSize('picture').height);
  const rawX = Math.round(Number(point?.clientX ?? 0) - Number(rect?.left ?? 0) + Number(point?.scrollLeft ?? 0));
  const rawY = Math.round(Number(point?.clientY ?? 0) - Number(rect?.top ?? 0) + Number(point?.scrollTop ?? 0));
  return Object.freeze({
    x: clamp(rawX, 0, Math.max(0, width - pictureWidth)),
    y: clamp(rawY, 0, Math.max(0, height - pictureHeight)),
    width: pictureWidth,
    height: pictureHeight
  });
}

/**
 * Create a Picture that visibly references an existing project-v4 resource.
 * The ordinary Designer source APIs remain authoritative. For an explicit
 * drop layout, undo any temporary auto-placement growth and grow only as much
 * as the requested final geometry actually requires.
 */
export function placeResourcePictureInSource(source, resourceId, options = {}) {
  const windowIndex = Number.isInteger(options.windowIndex) ? options.windowIndex : 0;
  const sourceExpr = studioResourceSourceExpression(resourceId);
  const beforeWindow = listDesignerWindows(source).find(item => item.windowIndex === windowIndex) ?? null;
  let next = addDesignerControl(source, 'picture', { windowIndex });
  let picture = listDesignerControls(next)
    .filter(control => control.windowIndex === windowIndex && control.type === 'picture')
    .at(-1) ?? null;
  if (!picture) throw new Error('Designer created a Picture but could not locate it in Patch source.');

  const changes = { sourceExpr };
  const layout = options.layout ?? null;
  if (layout) {
    Object.assign(changes, {
      x: layout.x,
      y: layout.y,
      width: layout.width,
      height: layout.height
    });
  }
  next = updateDesignerControl(next, picture, changes);
  picture = listDesignerControls(next).find(control =>
    control.windowIndex === windowIndex && control.controlIndex === picture.controlIndex
  ) ?? picture;

  if (layout) {
    const beforeWidth = positiveDimension(beforeWindow?.width, DEFAULT_FORM.width);
    const beforeHeight = positiveDimension(beforeWindow?.height, DEFAULT_FORM.height);
    const desiredWidth = Math.max(beforeWidth, Number(layout.x) + Number(layout.width));
    const desiredHeight = Math.max(beforeHeight, Number(layout.y) + Number(layout.height));
    const afterWindow = listDesignerWindows(next).find(item => item.windowIndex === windowIndex) ?? null;
    if (afterWindow && (afterWindow.width !== desiredWidth || afterWindow.height !== desiredHeight)) {
      next = updateDesignerWindow(next, windowIndex, { width: desiredWidth, height: desiredHeight });
      picture = listDesignerControls(next).find(control =>
        control.windowIndex === windowIndex && control.controlIndex === picture.controlIndex
      ) ?? picture;
    }
  }

  return Object.freeze({ source: next, picture });
}

function positiveDimension(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function clamp(value, minimum, maximum) {
  const number = Number.isFinite(value) ? value : minimum;
  return Math.min(maximum, Math.max(minimum, number));
}
