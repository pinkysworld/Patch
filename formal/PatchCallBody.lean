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

/-- Deterministic static-repeat trace used by the executable beta.28 checker. -/
def repeatTrace (count : Nat) (trace : List Effect) : List Effect :=
  (List.replicate count trace).flatten

/-- Repeating one deterministically evaluated body trace produces a relational
    `BoundExec` witness for the same number of static iterations. -/
theorem boundExec_repeat_of_body
    {bindings : BindingList} {body : BoundStmt} {bodyTrace : List Effect}
    (hBody : BoundExec bindings body bodyTrace) :
    ∀ count, BoundExec bindings (.repeat count body) (repeatTrace count bodyTrace) := by
  intro count
  induction count with
  | zero =>
      simpa [repeatTrace] using
        (BoundExec.repeatZero (bindings := bindings) (body := body))
  | succ count ih =>
      have hStep :
          BoundExec bindings (.repeat (count + 1) body)
            (bodyTrace ++ repeatTrace count bodyTrace) :=
        BoundExec.repeatSucc hBody ih
      simpa [repeatTrace] using hStep

/-- Executable evaluator for the exact structured beta.28 callee-body fragment.
    It fails closed when an emitted quantitative effect cannot be instantiated. -/
def evalBoundStmt (bindings : BindingList) : BoundStmt → Option (List Effect)
  | .skip => some []
  | .emit expected amountExpr =>
      match evalBoundQuantitativeEffect expected amountExpr bindings with
      | none => none
      | some actual => some [actual]
  | .seq first second => do
      let firstTrace ← evalBoundStmt bindings first
      let secondTrace ← evalBoundStmt bindings second
      some (firstTrace ++ secondTrace)
  | .repeat count body => do
      let bodyTrace ← evalBoundStmt bindings body
      some (repeatTrace count bodyTrace)

/-- Successful executable body evaluation recovers the relational execution
    witness used by the semantic soundness theorem. -/
theorem evalBoundStmt_sound
    {bindings : BindingList} {stmt : BoundStmt} {trace : List Effect}
    (h : evalBoundStmt bindings stmt = some trace) :
    BoundExec bindings stmt trace := by
  induction stmt generalizing trace with
  | skip =>
      simp [evalBoundStmt] at h
      subst trace
      exact BoundExec.skip
  | emit expected amountExpr =>
      cases hEval : evalBoundQuantitativeEffect expected amountExpr bindings with
      | none =>
          simp [evalBoundStmt, hEval] at h
      | some actual =>
          simp [evalBoundStmt, hEval] at h
          subst trace
          exact BoundExec.emit hEval
  | seq first second ihFirst ihSecond =>
      cases hFirst : evalBoundStmt bindings first with
      | none =>
          simp [evalBoundStmt, hFirst] at h
      | some firstTrace =>
          cases hSecond : evalBoundStmt bindings second with
          | none =>
              simp [evalBoundStmt, hFirst, hSecond] at h
          | some secondTrace =>
              simp [evalBoundStmt, hFirst, hSecond] at h
              subst trace
              exact BoundExec.seq (ihFirst hFirst) (ihSecond hSecond)
  | «repeat» count body ih =>
      cases hBody : evalBoundStmt bindings body with
      | none =>
          simp [evalBoundStmt, hBody] at h
      | some bodyTrace =>
          simp [evalBoundStmt, hBody] at h
          subst trace
          exact boundExec_repeat_of_body (ih hBody) count

/-- Proof-free list equality for generated effect traces. `Effect` deliberately
    has no global `DecidableEq`, so equality is delegated to the verified
    beta.25 `effectEqBool` checker element by element. -/
def effectListEqBool : List Effect → List Effect → Bool
  | [], [] => true
  | left :: leftRest, right :: rightRest =>
      effectEqBool left right && effectListEqBool leftRest rightRest
  | _, _ => false

theorem effectListEqBool_sound
    {left right : List Effect}
    (h : effectListEqBool left right = true) :
    left = right := by
  induction left generalizing right with
  | nil =>
      cases right with
      | nil => rfl
      | cons head tail =>
          simp [effectListEqBool] at h
  | cons head tail ih =>
      cases right with
      | nil =>
          simp [effectListEqBool] at h
      | cons other rest =>
          have hBoth :
              effectEqBool head other = true ∧
              effectListEqBool tail rest = true := by
            simpa [effectListEqBool, Bool.and_eq_true] using h
          have hHead : head = other := effectEqBool_sound hBoth.1
          have hTail : tail = rest := ih hBoth.2
          simpa [hHead, hTail]

/-- Certificate-facing equality check: recompute the structured body trace in
    Lean, then compare it to the proof-free production claim. -/
def evalBoundStmtEqBool
    (bindings : BindingList) (stmt : BoundStmt) (claimed : List Effect) : Bool :=
  match evalBoundStmt bindings stmt with
  | none => false
  | some actual => effectListEqBool actual claimed

theorem evalBoundStmtEqBool_sound
    {bindings : BindingList} {stmt : BoundStmt} {claimed : List Effect}
    (h : evalBoundStmtEqBool bindings stmt claimed = true) :
    evalBoundStmt bindings stmt = some claimed := by
  unfold evalBoundStmtEqBool at h
  cases hEval : evalBoundStmt bindings stmt with
  | none =>
      simp [hEval] at h
  | some actual =>
      have hEq : effectListEqBool actual claimed = true := by
        simpa [hEval] using h
      have hSame : actual = claimed := effectListEqBool_sound hEq
      simpa [hSame] using hEval

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
  | «repeat» count body ih =>
      apply BoundBodyCovered.repeat
      apply ih
      simpa [boundBodyCoveredBool] using h

/-- Every concrete occurrence in a trace is represented by some effect in the
    enclosing semantic signature via the existing `EffectRefines` relation. -/
def TraceRefinesSignature (trace signature : List Effect) : Prop :=
  ∀ actual, actual ∈ trace → RefinesSignature actual signature

theorem traceRefinesSignature_append
    {left right signature : List Effect}
    (hLeft : TraceRefinesSignature left signature)
    (hRight : TraceRefinesSignature right signature) :
    TraceRefinesSignature (left ++ right) signature := by
  intro actual hMem
  rw [List.mem_append] at hMem
  cases hMem with
  | inl hInLeft => exact hLeft actual hInLeft
  | inr hInRight => exact hRight actual hInRight

/-- Structured exact-body soundness. This lifts beta.26's one-leaf effect theorem
    to a complete concrete trace for sequence/static-repeat bodies. -/
theorem boundExecRefinesSignature
    {bindings : BindingList} {stmt : BoundStmt} {trace : List Effect}
    (hExec : BoundExec bindings stmt trace) :
    ∀ {signature : List Effect},
      BoundBodyCovered signature stmt →
      TraceRefinesSignature trace signature := by
  induction hExec with
  | skip =>
      intro signature hCovered actual hMem
      simp at hMem
  | @emit expected amountExpr actual hEval =>
      intro signature hCovered
      cases hCovered with
      | emit hExpected =>
          intro effect hMem
          have hSame : effect = actual := by
            simpa using hMem
          subst effect
          exact ⟨expected, hExpected, evalBoundQuantitativeEffect_sound hEval⟩
  | @seq first second firstTrace secondTrace hFirst hSecond ihFirst ihSecond =>
      intro signature hCovered
      cases hCovered with
      | seq hFirstCovered hSecondCovered =>
          exact traceRefinesSignature_append
            (ihFirst hFirstCovered)
            (ihSecond hSecondCovered)
  | @repeatZero body =>
      intro signature hCovered actual hMem
      simp at hMem
  | @repeatSucc count body firstTrace restTrace hFirst hRest ihFirst ihRest =>
      intro signature hCovered
      cases hCovered with
      | «repeat» hBodyCovered =>
          have hRestCovered : BoundBodyCovered signature (.repeat count body) :=
            BoundBodyCovered.repeat hBodyCovered
          exact traceRefinesSignature_append
            (ihFirst hBodyCovered)
            (ihRest hRestCovered)

/-- Fully executable coverage premise for generated beta.28 evidence. -/
theorem checkedBoundBodyExecutionRefinesSignature
    {bindings : BindingList} {signature : List Effect}
    {stmt : BoundStmt} {trace : List Effect}
    (hExec : BoundExec bindings stmt trace)
    (hChecked : boundBodyCoveredBool signature stmt = true) :
    TraceRefinesSignature trace signature := by
  exact boundExecRefinesSignature hExec (boundBodyCoveredBool_sound hChecked)

/-- Generated evidence can use only executable premises: Lean independently
    evaluates the whole supported structured body, then checks signature coverage. -/
theorem checkedEvaluatedBoundBodyRefinesSignature
    {bindings : BindingList} {signature : List Effect}
    {stmt : BoundStmt} {trace : List Effect}
    (hEval : evalBoundStmt bindings stmt = some trace)
    (hChecked : boundBodyCoveredBool signature stmt = true) :
    TraceRefinesSignature trace signature := by
  exact checkedBoundBodyExecutionRefinesSignature (evalBoundStmt_sound hEval) hChecked

end PatchFormal
