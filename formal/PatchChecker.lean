import PatchSignature

namespace PatchFormal

/-- Executable decision procedure for one semantic rule/effect pair. -/
def allowsBool (rule : Rule) (effect : Effect) : Bool :=
  decide (Allows rule effect)

/-- Does at least one policy rule admit this effect? -/
def anyRuleAllows : List Rule → Effect → Bool
  | [], _ => false
  | rule :: rest, effect => allowsBool rule effect || anyRuleAllows rest effect

/-- Executable checker for a complete inferred Change Signature. -/
def policyAllowsBool : List Effect → List Rule → Bool
  | [], _ => true
  | effect :: rest, policy =>
      anyRuleAllows policy effect && policyAllowsBool rest policy

/-- If the executable rule search says yes, the relational `Allows` judgment
    has an actual witness in the policy. -/
theorem anyRuleAllows_sound
    {policy : List Rule} {effect : Effect}
    (h : anyRuleAllows policy effect = true) :
    ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  induction policy with
  | nil =>
      simp [anyRuleAllows] at h
  | cons rule rest ih =>
      cases hRule : allowsBool rule effect with
      | false =>
          have hRest : anyRuleAllows rest effect = true := by
            simpa [anyRuleAllows, hRule] using h
          obtain ⟨witness, hMem, hAllows⟩ := ih hRest
          exact ⟨witness, by simp [hMem], hAllows⟩
      | true =>
          have hAllows : Allows rule effect := by
            exact of_decide_eq_true hRule
          exact ⟨rule, by simp, hAllows⟩

/-- **Verified checker soundness.** A `true` result from the executable checker
    implies the paper's relational `PolicyAllows` judgment. -/
theorem policyAllowsBool_sound
    {signature : List Effect} {policy : List Rule}
    (h : policyAllowsBool signature policy = true) :
    PolicyAllows signature policy := by
  intro effect hMem
  induction signature with
  | nil =>
      simp at hMem
  | cons head tail ih =>
      have hBoth :
          anyRuleAllows policy head = true ∧
          policyAllowsBool tail policy = true := by
        simpa [policyAllowsBool, Bool.and_eq_true] using h
      rcases List.mem_cons.mp hMem with rfl | hTail
      · exact anyRuleAllows_sound hBoth.1
      · exact ih hBoth.2 hTail

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
    exact policyAllowsBool_sound hCheck
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
