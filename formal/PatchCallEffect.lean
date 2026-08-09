import PatchCallRefinement
import PatchRuntime

namespace PatchFormal

/-- Exact singleton amount interval for one concretely evaluated integer. -/
def singletonEffectInterval (value : Int) : Interval :=
  { lo := value, hi := value, ordered := by omega }

/-- Instantiate the quantitative amount of a formal semantic effect with one
    exact value while preserving target, field and semantic operation. -/
def exactQuantitativeEffect (expected : Effect) (value : Int) : Effect :=
  { target := expected.target
    field := expected.field
    kind := expected.kind
    amount := some (singletonEffectInterval value) }

/-- Evaluate one quantitative callee amount expression in the exact environment
    produced by beta.26 parameter binding. The expected formal effect supplies
    the admitted amount interval. Unsupported/non-quantitative effects fail
    rather than being treated as certified. -/
def evalBoundQuantitativeEffect
    (expected : Effect) (amountExpr : RangeExpr) (bound : BindingList) :
    Option Effect :=
  match expected.amount with
  | none => none
  | some permitted =>
      match evalRangeExpr amountExpr (envOfBindings bound) with
      | none => none
      | some value =>
          if valueFitsBool value permitted then
            some (exactQuantitativeEffect expected value)
          else
            none

/-- A successfully instantiated exact quantitative effect refines the formal
    semantic effect whose amount interval admitted the concrete value. -/
theorem evalBoundQuantitativeEffect_sound
    {expected : Effect} {amountExpr : RangeExpr} {bound : BindingList}
    {actual : Effect}
    (h : evalBoundQuantitativeEffect expected amountExpr bound = some actual) :
    EffectRefines actual expected := by
  unfold evalBoundQuantitativeEffect at h
  cases hAmount : expected.amount with
  | none =>
      simp [hAmount] at h
  | some permitted =>
      cases hEval : evalRangeExpr amountExpr (envOfBindings bound) with
      | none =>
          simp [hAmount, hEval] at h
      | some value =>
          cases hFit : valueFitsBool value permitted with
          | false =>
              simp [hAmount, hEval, hFit] at h
          | true =>
              have hExact : exactQuantitativeEffect expected value = actual := by
                simpa [hAmount, hEval, hFit] using h
              subst actual
              have hValue : ValueFits value permitted := valueFitsBool_sound hFit
              unfold EffectRefines
              refine ⟨rfl, rfl, rfl, ?_⟩
              rw [hAmount]
              change Within (singletonEffectInterval value) permitted
              simpa [Within, singletonEffectInterval, ValueFits] using hValue

/-- A concrete exact effect is represented by a semantic signature when it
    refines one formal effect in that signature. -/
def RefinesSignature (actual : Effect) (signature : List Effect) : Prop :=
  ∃ expected, expected ∈ signature ∧ EffectRefines actual expected

/-- Compose beta.26 exact parameter binding and concrete amount evaluation with
    beta.25 callee-to-caller signature containment. This theorem deliberately
    certifies one direct quantitative callee effect; it is not yet a theorem
    about arbitrary callee bodies or production-Wasm call equivalence. -/
theorem concreteBoundEffectRefinesCallerSignature
    {exprs : List RangeExpr} {caller : IntEnv}
    {params : List Name} {declared : List Interval}
    {bindings : BindingList}
    {expected actual : Effect} {amountExpr : RangeExpr}
    {calleeSignature callerSignature : List Effect}
    (hBinding : concreteCallBinding exprs caller params declared = some bindings)
    (hEffect : evalBoundQuantitativeEffect expected amountExpr bindings = some actual)
    (hExpected : expected ∈ calleeSignature)
    (hImport : SignatureCovers calleeSignature callerSignature) :
    ConcreteCallBindingSpec exprs caller params declared bindings ∧
    RefinesSignature actual callerSignature := by
  constructor
  · exact concreteCallBinding_sound hBinding
  · refine ⟨expected, hImport expected hExpected, ?_⟩
    exact evalBoundQuantitativeEffect_sound hEffect

/-- Fully executable certificate-facing composition. Generated beta.26 evidence
    can use Bool checks for callee membership and beta.25 signature import; the
    existing soundness theorems lift them to the relational result above. -/
theorem checkedConcreteBoundEffectRefinesCallerSignature
    {exprs : List RangeExpr} {caller : IntEnv}
    {params : List Name} {declared : List Interval}
    {bindings : BindingList}
    {expected actual : Effect} {amountExpr : RangeExpr}
    {calleeSignature callerSignature : List Effect}
    (hBinding : concreteCallBinding exprs caller params declared = some bindings)
    (hEffect : evalBoundQuantitativeEffect expected amountExpr bindings = some actual)
    (hExpected : effectMemberBool expected calleeSignature = true)
    (hImport : signatureCoversBool calleeSignature callerSignature = true) :
    ConcreteCallBindingSpec exprs caller params declared bindings ∧
    RefinesSignature actual callerSignature := by
  exact concreteBoundEffectRefinesCallerSignature
    hBinding
    hEffect
    (effectMemberBool_sound hExpected)
    (signatureCoversBool_sound hImport)

end PatchFormal
