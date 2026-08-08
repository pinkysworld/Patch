import PatchRuntime

namespace PatchFormal

/-- Semantic authority is downward closed under `EffectRefines`: if a policy
    rule allows an abstract/formal effect, it also allows a concrete effect that
    refines that formal effect. -/
theorem allowsRefinedEffect
    {actual expected : Effect} {rule : Rule}
    (hRefines : EffectRefines actual expected)
    (hAllows : Allows rule expected) :
    Allows rule actual := by
  rcases hRefines with ⟨hTarget, hField, hKind, hAmount⟩
  rcases hAllows with ⟨hRuleTarget, hRuleField, hRuleKind, hRuleAmount⟩
  refine ⟨hRuleTarget.trans hTarget.symm, hRuleField.trans hField.symm, hRuleKind.trans hKind.symm, ?_⟩
  cases hActual : actual.amount with
  | none =>
      simp [hActual]
  | some actualAmount =>
      cases hExpected : expected.amount with
      | none =>
          simp [hActual, hExpected] at hAmount
      | some expectedAmount =>
          cases hRule : rule.amount with
          | none =>
              simp [hActual, hRule]
          | some permitted =>
              have hActualExpected : Within actualAmount expectedAmount := by
                simpa [hActual, hExpected] using hAmount
              have hExpectedPermitted : Within expectedAmount permitted := by
                simpa [hExpected, hRule] using hRuleAmount
              exact withinTrans hActualExpected hExpectedPermitted

/-- If an abstract formal trace is admitted by a semantic policy, every
    pointwise-refining concrete trace is admitted by the same policy. -/
theorem traceRefinesPreservesPolicy
    {actual formal : List Effect} {policy : List Rule}
    (hRefines : TraceRefines actual formal)
    (hFormalAllowed :
      ∀ effect, effect ∈ formal →
        ∃ rule, rule ∈ policy ∧ Allows rule effect) :
    ∀ effect, effect ∈ actual →
      ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  induction hRefines with
  | nil =>
      intro effect hMem
      simp at hMem
  | @cons actualHead formalHead actualRest formalRest hHead hRest ih =>
      intro effect hMem
      simp only [List.mem_cons] at hMem
      rcases hMem with hEq | hTail
      · subst effect
        obtain ⟨rule, hRuleMem, hRuleAllows⟩ := hFormalAllowed formalHead (by simp)
        exact ⟨rule, hRuleMem, allowsRefinedEffect hHead hRuleAllows⟩
      · apply ih
        · intro formalEffect hFormalMem
          exact hFormalAllowed formalEffect (List.mem_cons_of_mem formalHead hFormalMem)
        · exact hTail

/-- **Concrete runtime capability containment.** Once the runtime occurrence
    list and RuntimePath pass `checkSourceRuntimeEvidence`, and the same formal
    source passes the verified semantic policy checker, every decoded concrete
    runtime effect is allowed by that policy.

    This composes runtime-to-formal refinement with the existing formal
    SourceExecutes capability theorem; it does not assume that a concrete
    occurrence is equal to the abstract formal interval. -/
theorem checkedConcreteRuntimeCannotEscape
    {source : SourceStmt} {observed : List EvidenceEffect}
    {path : RuntimePath} {policy : List Rule}
    (hRuntime : checkSourceRuntimeEvidence source observed path = true)
    (hPolicy : checkSourceProtected source policy = true) :
    ∃ actualTrace,
      decodeRuntimeTrace observed = some actualTrace ∧
      ∀ effect, effect ∈ actualTrace →
        ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  obtain ⟨formalTrace, actualTrace, hSourceExec, hDecode, hRefines⟩ :=
    checkSourceRuntimeEvidence_sound hRuntime
  have hFormalAllowed :
      ∀ effect, effect ∈ formalTrace →
        ∃ rule, rule ∈ policy ∧ Allows rule effect :=
    checkedSourceExecutionCannotEscape hSourceExec hPolicy
  refine ⟨actualTrace, hDecode, ?_⟩
  exact traceRefinesPreservesPolicy hRefines hFormalAllowed

end PatchFormal
