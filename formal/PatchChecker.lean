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

/-- Relational interval containment is also accepted by the executable checker. -/
theorem withinBool_complete
    {inner outer : Interval}
    (h : Within inner outer) :
    withinBool inner outer = true := by
  rcases h with ⟨hLo, hHi⟩
  simp [withinBool, hLo, hHi]

/-- Executable amount-policy check matching the amount clause of `Allows`.
    Unknown effect magnitude is rejected by a bounded rule and admitted only by
    a matching unbounded rule. -/
def amountAllowsBool : Option Interval → Option Interval → Bool
  | none, none => true
  | none, some _ => false
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
            cases hRuleAmount : rule.amount with
            | none =>
                simp
            | some permitted =>
                simp [allowsBool, hTarget, hField, hKind, amountAllowsBool,
                  hEffectAmount, hRuleAmount] at h
        | some actual =>
            cases hRuleAmount : rule.amount with
            | none =>
                simp
            | some permitted =>
                have hWithin : withinBool actual permitted = true := by
                  simpa [allowsBool, hTarget, hField, hKind, amountAllowsBool,
                    hEffectAmount, hRuleAmount] using h
                have hRel : Within actual permitted := withinBool_sound hWithin
                simpa [hEffectAmount, hRuleAmount] using hRel
      · simp [allowsBool, hTarget, hField, hKind] at h
    · simp [allowsBool, hTarget, hField] at h
  · simp [allowsBool, hTarget] at h

/-- Every relationally allowed rule/effect pair is accepted by the executable
    checker. Together with `allowsBool_sound`, this rules out divergence between
    the relational and executable rule semantics for the modeled fragment. -/
theorem allowsBool_complete
    {rule : Rule} {effect : Effect}
    (h : Allows rule effect) :
    allowsBool rule effect = true := by
  rcases h with ⟨hTarget, hField, hKind, hAmount⟩
  subst rule.target
  subst rule.field
  subst rule.kind
  cases hEffectAmount : effect.amount with
  | none =>
      cases hRuleAmount : rule.amount with
      | none =>
          simp [allowsBool, amountAllowsBool, hEffectAmount, hRuleAmount]
      | some permitted =>
          simp [hEffectAmount, hRuleAmount] at hAmount
  | some actual =>
      cases hRuleAmount : rule.amount with
      | none =>
          simp [allowsBool, amountAllowsBool, hEffectAmount, hRuleAmount]
      | some permitted =>
          have hWithin : Within actual permitted := by
            simpa [hEffectAmount, hRuleAmount] using hAmount
          have hBool : withinBool actual permitted = true := withinBool_complete hWithin
          simp [allowsBool, amountAllowsBool, hEffectAmount, hRuleAmount, hBool]

/-- The executable one-rule checker exactly decides `Allows`. -/
theorem allowsBool_iff
    {rule : Rule} {effect : Effect} :
    allowsBool rule effect = true ↔ Allows rule effect := by
  constructor
  · exact allowsBool_sound
  · exact allowsBool_complete

/-- Does at least one policy rule allow this effect? -/
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

/-- A relational witness in the policy is sufficient for the executable rule
    search to accept the effect. -/
theorem anyRuleAllows_complete :
    ∀ (policy : List Rule) (effect : Effect),
      (∃ rule, rule ∈ policy ∧ Allows rule effect) →
      anyRuleAllows policy effect = true := by
  intro policy
  induction policy with
  | nil =>
      intro effect h
      rcases h with ⟨rule, hMem, _⟩
      simp at hMem
  | cons first rest ih =>
      intro effect h
      rcases h with ⟨rule, hMem, hAllows⟩
      rcases List.mem_cons.mp hMem with hEq | hRest
      · subst rule
        have hFirst : allowsBool first effect = true := allowsBool_complete hAllows
        simp [anyRuleAllows, hFirst]
      · have hTail : anyRuleAllows rest effect = true :=
          ih effect ⟨rule, hRest, hAllows⟩
        simp [anyRuleAllows, hTail]

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

/-- Every relationally allowed signature is accepted by the executable policy
    checker. -/
theorem policyAllowsBool_complete :
    ∀ (signature : List Effect) (policy : List Rule),
      PolicyAllows signature policy →
      policyAllowsBool signature policy = true := by
  intro signature
  induction signature with
  | nil =>
      intro policy hPolicy
      simp [policyAllowsBool]
  | cons first rest ih =>
      intro policy hPolicy
      have hFirstWitness : ∃ rule, rule ∈ policy ∧ Allows rule first :=
        hPolicy first (by simp)
      have hFirst : anyRuleAllows policy first = true :=
        anyRuleAllows_complete policy first hFirstWitness
      have hRestPolicy : PolicyAllows rest policy := by
        intro effect hMem
        exact hPolicy effect (by simp [hMem])
      have hRest : policyAllowsBool rest policy = true := ih policy hRestPolicy
      simp [policyAllowsBool, hFirst, hRest]

/-- The executable signature checker exactly decides the relational policy
    judgment for the modeled effect/rule fragment. -/
theorem policyAllowsBool_iff
    {signature : List Effect} {policy : List Rule} :
    policyAllowsBool signature policy = true ↔ PolicyAllows signature policy := by
  constructor
  · exact policyAllowsBool_sound signature policy
  · exact policyAllowsBool_complete signature policy

/-- A boolean protectedness test for the formal executable core. -/
def checkProtected (stmt : CoreStmt) (policy : List Rule) : Bool :=
  policyAllowsBool (inferSignature stmt) policy

/-- A successful checker result is enough to invoke the already mechanized
    capability theorem for every execution of the checked normalized core. -/
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
