import PatchCallBodyImport

namespace PatchFormal

/-- Beta.30 call-tree layer. A `base` node embeds any already-proved beta.29
    `BoundStmt` subtree that contains no nested recipe call. Structural nodes
    allow nested calls to appear between effects, inside static repeats and on
    exact GuardExpr branches without weakening beta.29's regression semantics. -/
inductive CallTreeStmt where
  | base (body : BoundStmt)
  | seq (first second : CallTreeStmt)
  | repeat (count : Nat) (body : CallTreeStmt)
  | branch (guard : GuardExpr) (thenBranch elseBranch : CallTreeStmt)
  | call (argExprs : List RangeExpr) (params : List Name)
      (declared : List Interval) (calleeSignature : List Effect)
      (body : CallTreeStmt)
  deriving Repr

/-- Exact finite call-tree execution. Every nested call re-evaluates the formal
    argument expressions in the current exact environment and constructs the
    next positional `BindingList` through beta.26 `concreteCallBinding`. -/
inductive CallTreeExec (bindings : BindingList) : CallTreeStmt → List Effect → Prop where
  | base {body : BoundStmt} {trace : List Effect} :
      BoundExec bindings body trace →
      CallTreeExec bindings (.base body) trace
  | seq {first second : CallTreeStmt} {firstTrace secondTrace : List Effect} :
      CallTreeExec bindings first firstTrace →
      CallTreeExec bindings second secondTrace →
      CallTreeExec bindings (.seq first second) (firstTrace ++ secondTrace)
  | repeatZero {body : CallTreeStmt} :
      CallTreeExec bindings (.repeat 0 body) []
  | repeatSucc {count : Nat} {body : CallTreeStmt}
      {firstTrace restTrace : List Effect} :
      CallTreeExec bindings body firstTrace →
      CallTreeExec bindings (.repeat count body) restTrace →
      CallTreeExec bindings (.repeat (count + 1) body) (firstTrace ++ restTrace)
  | branchThen {guard : GuardExpr} {thenBranch elseBranch : CallTreeStmt}
      {trace : List Effect} :
      evalGuard guard (envOfBindings bindings) = some true →
      CallTreeExec bindings thenBranch trace →
      CallTreeExec bindings (.branch guard thenBranch elseBranch) trace
  | branchElse {guard : GuardExpr} {thenBranch elseBranch : CallTreeStmt}
      {trace : List Effect} :
      evalGuard guard (envOfBindings bindings) = some false →
      CallTreeExec bindings elseBranch trace →
      CallTreeExec bindings (.branch guard thenBranch elseBranch) trace
  | call {argExprs : List RangeExpr} {params : List Name}
      {declared : List Interval} {calleeSignature : List Effect}
      {body : CallTreeStmt} {calleeBindings : BindingList} {trace : List Effect} :
      concreteCallBinding argExprs (envOfBindings bindings) params declared =
        some calleeBindings →
      CallTreeExec calleeBindings body trace →
      CallTreeExec bindings
        (.call argExprs params declared calleeSignature body) trace

/-- Static-repeat trace shared with the beta.29 body evaluator. -/
def callTreeRepeatTrace (count : Nat) (trace : List Effect) : List Effect :=
  (List.replicate count trace).flatten

theorem callTreeExec_repeat_of_body
    {bindings : BindingList} {body : CallTreeStmt} {bodyTrace : List Effect}
    (hBody : CallTreeExec bindings body bodyTrace) :
    ∀ count,
      CallTreeExec bindings (.repeat count body)
        (callTreeRepeatTrace count bodyTrace) := by
  intro count
  induction count with
  | zero =>
      simpa [callTreeRepeatTrace] using
        (CallTreeExec.repeatZero (bindings := bindings) (body := body))
  | succ count ih =>
      have hStep :
          CallTreeExec bindings (.repeat (count + 1) body)
            (bodyTrace ++ callTreeRepeatTrace count bodyTrace) :=
        CallTreeExec.repeatSucc hBody ih
      simpa [callTreeRepeatTrace] using hStep

/-- Executable exact call-tree evaluator. Unsupported binding/guard/base-body
    cases fail closed with `none`. -/
def evalCallTreeStmt (bindings : BindingList) : CallTreeStmt → Option (List Effect)
  | .base body => evalBoundStmt bindings body
  | .seq first second => do
      let firstTrace ← evalCallTreeStmt bindings first
      let secondTrace ← evalCallTreeStmt bindings second
      some (firstTrace ++ secondTrace)
  | .repeat count body => do
      let bodyTrace ← evalCallTreeStmt bindings body
      some (callTreeRepeatTrace count bodyTrace)
  | .branch guard thenBranch elseBranch =>
      match evalGuard guard (envOfBindings bindings) with
      | none => none
      | some true => evalCallTreeStmt bindings thenBranch
      | some false => evalCallTreeStmt bindings elseBranch
  | .call argExprs params declared _ body =>
      match concreteCallBinding argExprs (envOfBindings bindings) params declared with
      | none => none
      | some calleeBindings => evalCallTreeStmt calleeBindings body

/-- Executable transitive evaluation recovers the relational call-tree witness. -/
theorem evalCallTreeStmt_sound
    {bindings : BindingList} {stmt : CallTreeStmt} {trace : List Effect}
    (h : evalCallTreeStmt bindings stmt = some trace) :
    CallTreeExec bindings stmt trace := by
  induction stmt generalizing bindings trace with
  | base body =>
      exact CallTreeExec.base (evalBoundStmt_sound h)
  | seq first second ihFirst ihSecond =>
      cases hFirst : evalCallTreeStmt bindings first with
      | none => simp [evalCallTreeStmt, hFirst] at h
      | some firstTrace =>
          cases hSecond : evalCallTreeStmt bindings second with
          | none => simp [evalCallTreeStmt, hFirst, hSecond] at h
          | some secondTrace =>
              simp [evalCallTreeStmt, hFirst, hSecond] at h
              subst trace
              exact CallTreeExec.seq
                (ihFirst hFirst)
                (ihSecond hSecond)
  | «repeat» count body ih =>
      cases hBody : evalCallTreeStmt bindings body with
      | none => simp [evalCallTreeStmt, hBody] at h
      | some bodyTrace =>
          simp [evalCallTreeStmt, hBody] at h
          subst trace
          exact callTreeExec_repeat_of_body (ih hBody) count
  | branch guard thenBranch elseBranch ihThen ihElse =>
      cases hGuard : evalGuard guard (envOfBindings bindings) with
      | none => simp [evalCallTreeStmt, hGuard] at h
      | some choice =>
          cases choice with
          | false =>
              have hElse : evalCallTreeStmt bindings elseBranch = some trace := by
                simpa [evalCallTreeStmt, hGuard] using h
              exact CallTreeExec.branchElse hGuard (ihElse hElse)
          | true =>
              have hThen : evalCallTreeStmt bindings thenBranch = some trace := by
                simpa [evalCallTreeStmt, hGuard] using h
              exact CallTreeExec.branchThen hGuard (ihThen hThen)
  | call argExprs params declared calleeSignature body ih =>
      cases hBinding :
          concreteCallBinding argExprs (envOfBindings bindings) params declared with
      | none => simp [evalCallTreeStmt, hBinding] at h
      | some calleeBindings =>
          have hBody : evalCallTreeStmt calleeBindings body = some trace := by
            simpa [evalCallTreeStmt, hBinding] using h
          exact CallTreeExec.call hBinding (ih hBody)

/-- Static transitive body coverage. A base subtree delegates to beta.29. A
    nested call must be covered by its own semantic signature, and that entire
    nested signature must be contained in the enclosing signature. -/
inductive CallTreeCovered (signature : List Effect) : CallTreeStmt → Prop where
  | base {body : BoundStmt} :
      BoundBodyCovered signature body →
      CallTreeCovered signature (.base body)
  | seq {first second : CallTreeStmt} :
      CallTreeCovered signature first →
      CallTreeCovered signature second →
      CallTreeCovered signature (.seq first second)
  | repeat {count : Nat} {body : CallTreeStmt} :
      CallTreeCovered signature body →
      CallTreeCovered signature (.repeat count body)
  | branch {guard : GuardExpr} {thenBranch elseBranch : CallTreeStmt} :
      CallTreeCovered signature thenBranch →
      CallTreeCovered signature elseBranch →
      CallTreeCovered signature (.branch guard thenBranch elseBranch)
  | call {argExprs : List RangeExpr} {params : List Name}
      {declared : List Interval} {calleeSignature : List Effect}
      {body : CallTreeStmt} :
      CallTreeCovered calleeSignature body →
      SignatureCovers calleeSignature signature →
      CallTreeCovered signature
        (.call argExprs params declared calleeSignature body)

/-- Executable certificate-facing transitive coverage checker. -/
def callTreeCoveredBool (signature : List Effect) : CallTreeStmt → Bool
  | .base body => boundBodyCoveredBool signature body
  | .seq first second =>
      callTreeCoveredBool signature first &&
      callTreeCoveredBool signature second
  | .repeat _ body => callTreeCoveredBool signature body
  | .branch _ thenBranch elseBranch =>
      callTreeCoveredBool signature thenBranch &&
      callTreeCoveredBool signature elseBranch
  | .call _ _ _ calleeSignature body =>
      callTreeCoveredBool calleeSignature body &&
      signatureCoversBool calleeSignature signature

theorem callTreeCoveredBool_sound
    {signature : List Effect} {stmt : CallTreeStmt}
    (h : callTreeCoveredBool signature stmt = true) :
    CallTreeCovered signature stmt := by
  induction stmt with
  | base body =>
      exact CallTreeCovered.base (boundBodyCoveredBool_sound h)
  | seq first second ihFirst ihSecond =>
      have hBoth :
          callTreeCoveredBool signature first = true ∧
          callTreeCoveredBool signature second = true := by
        simpa [callTreeCoveredBool, Bool.and_eq_true] using h
      exact CallTreeCovered.seq (ihFirst hBoth.1) (ihSecond hBoth.2)
  | «repeat» count body ih =>
      exact CallTreeCovered.repeat (ih (by simpa [callTreeCoveredBool] using h))
  | branch guard thenBranch elseBranch ihThen ihElse =>
      have hBoth :
          callTreeCoveredBool signature thenBranch = true ∧
          callTreeCoveredBool signature elseBranch = true := by
        simpa [callTreeCoveredBool, Bool.and_eq_true] using h
      exact CallTreeCovered.branch (ihThen hBoth.1) (ihElse hBoth.2)
  | call argExprs params declared calleeSignature body ih =>
      have hBoth :
          callTreeCoveredBool calleeSignature body = true ∧
          signatureCoversBool calleeSignature signature = true := by
        simpa [callTreeCoveredBool, Bool.and_eq_true] using h
      exact CallTreeCovered.call
        (ih hBoth.1)
        (signatureCoversBool_sound hBoth.2)

/-- Import exact trace refinement through one nested semantic-signature edge. -/
theorem traceRefinesSignature_coverTree
    {trace innerSignature outerSignature : List Effect}
    (hTrace : TraceRefinesSignature trace innerSignature)
    (hCovers : SignatureCovers innerSignature outerSignature) :
    TraceRefinesSignature trace outerSignature := by
  exact traceRefinesSignature_import hTrace hCovers

/-- Every concrete occurrence in a finite exact nested call-tree trace is
    represented by the enclosing semantic signature. -/
theorem callTreeExecRefinesSignature
    {bindings : BindingList} {stmt : CallTreeStmt} {trace : List Effect}
    (hExec : CallTreeExec bindings stmt trace) :
    ∀ {signature : List Effect},
      CallTreeCovered signature stmt →
      TraceRefinesSignature trace signature := by
  induction hExec with
  | @base body trace hBase =>
      intro signature hCovered
      cases hCovered with
      | base hBodyCovered =>
          exact boundExecRefinesSignature hBase hBodyCovered
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
          have hRestCovered : CallTreeCovered signature (.repeat count body) :=
            CallTreeCovered.repeat hBodyCovered
          exact traceRefinesSignature_append
            (ihFirst hBodyCovered)
            (ihRest hRestCovered)
  | @branchThen guard thenBranch elseBranch trace hGuard hThen ihThen =>
      intro signature hCovered
      cases hCovered with
      | branch hThenCovered hElseCovered => exact ihThen hThenCovered
  | @branchElse guard thenBranch elseBranch trace hGuard hElse ihElse =>
      intro signature hCovered
      cases hCovered with
      | branch hThenCovered hElseCovered => exact ihElse hElseCovered
  | @call argExprs params declared calleeSignature body calleeBindings trace
      hBinding hBody ihBody =>
      intro signature hCovered
      cases hCovered with
      | call hNestedCovered hCovers =>
          exact traceRefinesSignature_coverTree
            (ihBody hNestedCovered)
            hCovers

/-- Proof-free exact selected/transitive trace equality checker. -/
def evalCallTreeStmtEqBool
    (bindings : BindingList) (stmt : CallTreeStmt) (claimed : List Effect) : Bool :=
  match evalCallTreeStmt bindings stmt with
  | none => false
  | some actual => effectListEqBool actual claimed

theorem evalCallTreeStmtEqBool_sound
    {bindings : BindingList} {stmt : CallTreeStmt} {claimed : List Effect}
    (h : evalCallTreeStmtEqBool bindings stmt claimed = true) :
    evalCallTreeStmt bindings stmt = some claimed := by
  unfold evalCallTreeStmtEqBool at h
  cases hEval : evalCallTreeStmt bindings stmt with
  | none => simp [hEval] at h
  | some actual =>
      have hEq : effectListEqBool actual claimed = true := by
        simpa [hEval] using h
      have hSame : actual = claimed := effectListEqBool_sound hEq
      simpa [hSame] using hEval

/-- Fully executable transitive body refinement used by generated beta.30
    certificates. -/
theorem checkedEvaluatedCallTreeRefinesSignature
    {bindings : BindingList} {signature : List Effect}
    {stmt : CallTreeStmt} {trace : List Effect}
    (hEval : evalCallTreeStmt bindings stmt = some trace)
    (hCovered : callTreeCoveredBool signature stmt = true) :
    TraceRefinesSignature trace signature := by
  exact callTreeExecRefinesSignature
    (evalCallTreeStmt_sound hEval)
    (callTreeCoveredBool_sound hCovered)

/-- Exact outer call binding plus complete finite transitive callee trace import
    into the caller semantic signature. -/
theorem checkedConcreteTransitiveCallTreeRefinesCallerSignature
    {caller : IntEnv} {argExprs : List RangeExpr} {params : List Name}
    {declared : List Interval} {calleeBindings : BindingList}
    {calleeSignature callerSignature trace : List Effect}
    {body : CallTreeStmt}
    (hBinding :
      concreteCallBinding argExprs caller params declared = some calleeBindings)
    (hTrace : evalCallTreeStmt calleeBindings body = some trace)
    (hBodyCovered : callTreeCoveredBool calleeSignature body = true)
    (hSignatureImport :
      signatureCoversBool calleeSignature callerSignature = true) :
    ConcreteCallBindingSpec argExprs caller params declared calleeBindings ∧
    TraceRefinesSignature trace callerSignature := by
  constructor
  · exact concreteCallBinding_sound hBinding
  · have hCalleeTrace : TraceRefinesSignature trace calleeSignature :=
      checkedEvaluatedCallTreeRefinesSignature hTrace hBodyCovered
    exact traceRefinesSignature_import
      hCalleeTrace
      (signatureCoversBool_sound hSignatureImport)

end PatchFormal
