export const PATCH_STUDIO_FORM_MATERIALIZATION_VERSION = '0.1';
export const PATCH_STUDIO_FORM_MATERIALIZATION_MAX_FORMS = 1000;

export function createStudioFormMaterializationPlan(formCount, requestedIndex = 0) {
  if (!Number.isInteger(formCount) || formCount < 0) {
    throw new Error('Studio Form materialization requires a non-negative integer Form count.');
  }
  if (formCount > PATCH_STUDIO_FORM_MATERIALIZATION_MAX_FORMS) {
    throw new Error(`Studio Form materialization supports at most ${PATCH_STUDIO_FORM_MATERIALIZATION_MAX_FORMS} Forms.`);
  }

  if (formCount === 0) {
    return Object.freeze({
      version: PATCH_STUDIO_FORM_MATERIALIZATION_VERSION,
      activeIndex: -1,
      modes: Object.freeze([])
    });
  }

  const candidate = Number(requestedIndex);
  const activeIndex = Number.isInteger(candidate)
    ? Math.max(0, Math.min(candidate, formCount - 1))
    : 0;
  const modes = Object.freeze(Array.from({ length: formCount }, (_, index) => index === activeIndex ? 'full' : 'shell'));

  return Object.freeze({
    version: PATCH_STUDIO_FORM_MATERIALIZATION_VERSION,
    activeIndex,
    modes
  });
}
