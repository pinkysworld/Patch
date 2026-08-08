import PatchSignature

namespace PatchFormal

/-- Executable interval containment. -/
def withinBool (inner outer : Interval) : Bool :=
  decide (outer.lo ≤ inner.lo) && decide (inner.hi ≤ outer.hi)

/-- Boolean interval containment is sound for the relational `Within` judgment. -/
theorem withinBool_sound
    {inner outer : Interval}
    (h : withinBool inner outer = true) :
    Within inner outer := by
  have hBoth :
      decide (outer.lo ≤ inner.lo) = true ∧
      decide (inner.hi ≤ outer.hi) = true := by
    simpa [withinBool, Bool.and_eq_true] using h
  exact ⟨of_decide_eq_true hBoth.1, of_decide_eq_true hBoth.2⟩

/-- Executable amount-policy check matching the amount clause of `Allows`. -/
def amountAllowsBool : Option Interval → Option Interval → Bool
  | none, _ => true
  | some _, none => true
  | some actual, some permitted => withinBool actual permitted

/-- Executable decision procedure for one semantic rule/effect pair. It uses
    ordinary decidable equality for names/fields/kinds and a dedicated interval
    checker for quantitative authority. -/
def allowsBool (rule : Rule) (effect : Effect) : Bool :=
  if rule.target = effect.target then
    if rule.field = effect.field then
      if rule.kind = effect.kind then
        amountAllowsBool effect.amount rule.amount
      else false
    else false
  else false

/-- A successful boolean rule check implies the relational semantic judgment. -/
theorem allowsBool_sound
    {rule : Rule} {effect : Effect}
    (h : allowsBool rule effect = true) :
    Allows rule effect := by
  by_cases hTarget : rule.target = effect.target
  · by_cases hField : rule.field = effect.field
    · by_cases hKind : rule.kind = effect.kind
      · refine ⟨hTarget, hField, hKind, ?_⟩
        cases hEffectAmount : effect.amount with
        | none =>
            simp [hEffectAmount]
        | some actual =>
            cases hRuleAmount : rule.amount with
            | none =>
                simp [hEffectAmount, hRuleAmount]
            | some permitted =>
                have hWithin : withinBool actual permitted = true := by
                  simpa [allowsBool, hTarget, hField, hKind, amountAllowsBool,
                    hEffectAmount, hRuleAmount] using h
                have hRel : Within actual permitted := withinBool_sound hWithin
                simpa [hEffectAmount, hRuleAmount] using hRel
      · simp [allowsBool, hTarget, hField, hKind] at h
    · simp [allowsBool, hTarget, hField] at h
  · simp [allowsBool, hTarget] at h

/-- Does at least one policy rule admit this effect? -/
def anyRuleAllows : List Rule → Effect → Bool
  | [], _ => false
  | rule :: rest, effect => allowsBool rule effect || anyRuleAllows rest effect

/-- If the executable rule search says yes, the relational `Allows` judgment
    has an actual witness in the policy. -/
theorem anyRuleAllows_sound :
    ∀ (policy : List Rule) (effect : Effect),
      anyRuleAllows policy effect = true →
      ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  intro policy
  induction policy with
  | nil =>
      intro effect h
      simp [anyRuleAllows] at h
  | cons rule rest ih =>
      intro effect h
      cases hRule : allowsBool rule effect with
      | false =>
          have hRest : anyRuleAllows rest effect = true := by
            simpa [anyRuleAllows, hRule] using h
          obtain ⟨witness, hMem, hAllows⟩ := ih effect hRest
          exact ⟨witness, by simp [hMem], hAllows⟩
      | true =>
          have hAllows : Allows rule effect := allowsBool_sound hRule
          exact ⟨rule, by simp, hAllows⟩

/-- Executable checker for a complete inferred Change Signature. -/
def policyAllowsBool : List Effect → List Rule → Bool
  | [], _ => true
  | effect :: rest, policy =>
      anyRuleAllows policy effect && policyAllowsBool rest policy

/-- **Verified checker soundness.** A `true` result from the executable checker
    implies the paper's relational `PolicyAllows` judgment. -/
theorem policyAllowsBool_sound :
    ∀ (signature : List Effect) (policy : List Rule),
      policyAllowsBool signature policy = true →
      PolicyAllows signature policy := by
  intro signature
  induction signature with
  | nil =>
      intro policy h effect hMem
      simp at hMem
  | cons first rest ih =>
      intro policy h effect hMem
      have hBoth :
          anyRuleAllows policy first = true ∧
          policyAllowsBool rest policy = true := by
        simpa [policyAllowsBool, Bool.and_eq_true] using h
      rcases List.mem_cons.mp hMem with hFirst | hRestMem
      · subst effect
        exact anyRuleAllows_sound policy first hBoth.1
      · exact ih policy hBoth.2 effect hRestMem

/-- A boolean protectedness test for the formal executable core. -/
def checkProtected (stmt : CoreStmt) (policy : List Rule) : Bool :=
  policyAllowsBool (inferSignature stmt) policy

/-- A successful checker result is enough to invoke the already mechanized
    end-to-end capability theorem for every execution of the checked core. -/
theorem checkedExecutionCannotEscape
    {stmt : CoreStmt} {runtime : List Effect} {policy : List Rule}
    (hExec : Executes stmt runtime)
    (hCheck : checkProtected stmt policy = true) :
    ∀ effect, effect ∈ runtime →
      ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  have hProtected : Protected stmt policy := by
    exact policyAllowsBool_sound (inferSignature stmt) policy hCheck
  exact endToEndCapabilitySoundness hExec hProtected

/-- Set-inclusion-shaped corollary used by generated Patch certificates. -/
theorem checkedProtectedExecutionCannotEscape
    {stmt : CoreStmt} {runtime : List Effect} {policy : List Rule}
    (hExec : Executes stmt runtime)
    (hCheck : checkProtected stmt policy = true)
    {effect : Effect} (hRuntime : effect ∈ runtime) :
    ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  exact checkedExecutionCannotEscape hExec hCheck effect hRuntime

end PatchFormal
