import PatchCallEffect

namespace PatchFormal

/-- Exact executable callee-body fragment for beta.28. The first slice is
    deliberately smaller than Patch source: direct quantitative semantic emits,
    sequence, and statically counted repetition. Branches and nested calls are
    left for later layers so this theorem does not silently assume guard/call
    choices. -/
inductive BoundStmt where
  | skip
  | emit (expected : Effect) (amountExpr : RangeExpr)
  | seq (first second : BoundStmt)
  | repeat (count : Nat) (body : BoundStmt)
  deriving Repr

/-- Concrete execution under one exact callee binding environment. Each emit
    reuses beta.26's checked quantitative-effect evaluator. -/
inductive BoundExec (bindings : BindingList) : BoundStmt → List Effect → Prop where
  | skip : BoundExec bindings .skip []
  | emit {expected : Effect} {amountExpr : RangeExpr} {actual : Effect} :
      evalBoundQuantitativeEffect expected amountExpr bindings = some actual →
      BoundExec bindings (.emit expected amountExpr) [actual]
  | seq {first second : BoundStmt} {firstTrace secondTrace : List Effect} :
      BoundExec bindings first firstTrace →
      BoundExec bindings second secondTrace →
      BoundExec bindings (.seq first second) (firstTrace ++ secondTrace)
  | repeatZero {body : BoundStmt} :
      BoundExec bindings (.repeat 0 body) []
  | repeatSucc {count : Nat} {body : BoundStmt}
      {firstTrace restTrace : List Effect} :
      BoundExec bindings body firstTrace →
      BoundExec bindings (.repeat count body) restTrace →
      BoundExec bindings (.repeat (count + 1) body) (firstTrace ++ restTrace)

/-- Static body coverage: every formal expected effect used by the structured
    concrete body is represented in the enclosing semantic signature. -/
inductive BoundBodyCovered (signature : List Effect) : BoundStmt → Prop where
  | skip : BoundBodyCovered signature .skip
  | emit {expected : Effect} {amountExpr : RangeExpr} :
      expected ∈ signature →
      BoundBodyCovered signature (.emit expected amountExpr)
  | seq {first second : BoundStmt} :
      BoundBodyCovered signature first →
      BoundBodyCovered signature second →
      BoundBodyCovered signature (.seq first second)
  | repeat {count : Nat} {body : BoundStmt} :
      BoundBodyCovered signature body →
      BoundBodyCovered signature (.repeat count body)

/-- Executable certificate-facing coverage checker. -/
def boundBodyCoveredBool (signature : List Effect) : BoundStmt → Bool
  | .skip => true
  | .emit expected _ => effectMemberBool expected signature
  | .seq first second =>
      boundBodyCoveredBool signature first && boundBodyCoveredBool signature second
  | .repeat _ body => boundBodyCoveredBool signature body

theorem boundBodyCoveredBool_sound
    {signature : List Effect} {stmt : BoundStmt}
    (h : boundBodyCoveredBool signature stmt = true) :
    BoundBodyCovered signature stmt := by
  induction stmt with
  | skip =>
      exact BoundBodyCovered.skip
  | emit expected amountExpr =>
      exact BoundBodyCovered.emit (effectMemberBool_sound h)
  | seq first second ihFirst ihSecond =>
      have hBoth :
          boundBodyCoveredBool signature first = true ∧
          boundBodyCoveredBool signature second = true := by
        simpa [boundBodyCoveredBool, Bool.and_eq_true] using h
      exact BoundBodyCovered.seq (ihFirst hBoth.1) (ihSecond hBoth.2)
  | repeat count body ih =>
      exact BoundBodyCovered.repeat (ih (by simpa [boundBodyCoveredBool] using h))

/-- Every concrete occurrence in a trace is represented by some effect in the
    enclosing semantic signature via the existing `EffectRefines` relation. -/
def TraceRefinesSignature (trace signature : List Effect) : Prop :=
  ∀ actual, actual ∈ trace → RefinesSignature actual signature

/-- Structured exact-body soundness. This lifts beta.26's one-leaf effect theorem
    to a complete concrete trace for sequence/static-repeat bodies. -/
theorem boundExecRefinesSignature
    {bindings : BindingList} {signature : List Effect}
    {stmt : BoundStmt} {trace : List Effect}
    (hExec : BoundExec bindings stmt trace)
    (hCovered : BoundBodyCovered signature stmt) :
    TraceRefinesSignature trace signature := by
  induction hExec with
  | skip =>
      intro actual hMem
      simp at hMem
  | @emit expected amountExpr actual hEval =>
      cases hCovered with
      | emit hExpected =>
          intro effect hMem
          have hSame : effect = actual := by
            simpa using hMem
          subst effect
          exact ⟨expected, hExpected, evalBoundQuantitativeEffect_sound hEval⟩
  | @seq first second firstTrace secondTrace hFirst hSecond ihFirst ihSecond =>
      cases hCovered with
      | seq hFirstCovered hSecondCovered =>
          intro actual hMem
          have hEither : actual ∈ firstTrace ∨ actual ∈ secondTrace := by
            simpa [List.mem_append] using hMem
          cases hEither with
          | inl hLeft => exact ihFirst hFirstCovered actual hLeft
          | inr hRight => exact ihSecond hSecondCovered actual hRight
  | @repeatZero body =>
      intro actual hMem
      simp at hMem
  | @repeatSucc count body firstTrace restTrace hFirst hRest ihFirst ihRest =>
      cases hCovered with
      | repeat hBodyCovered =>
          intro actual hMem
          have hEither : actual ∈ firstTrace ∨ actual ∈ restTrace := by
            simpa [List.mem_append] using hMem
          cases hEither with
          | inl hLeft => exact ihFirst hBodyCovered actual hLeft
          | inr hRight =>
              exact ihRest (BoundBodyCovered.repeat hBodyCovered) actual hRight

/-- Fully executable coverage premise for generated beta.28 evidence. -/
theorem checkedBoundBodyExecutionRefinesSignature
    {bindings : BindingList} {signature : List Effect}
    {stmt : BoundStmt} {trace : List Effect}
    (hExec : BoundExec bindings stmt trace)
    (hChecked : boundBodyCoveredBool signature stmt = true) :
    TraceRefinesSignature trace signature := by
  exact boundExecRefinesSignature hExec (boundBodyCoveredBool_sound hChecked)

end PatchFormal
