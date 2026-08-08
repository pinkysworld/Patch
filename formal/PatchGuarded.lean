import PatchRuntimeCapability
import PatchRange

namespace PatchFormal

/-- Boolean guard fragment for beta.23. Arithmetic operands reuse the existing
    machine-checked integer `RangeExpr` concrete evaluator. -/
inductive GuardExpr where
  | bool (value : Bool)
  | eq (left right : RangeExpr)
  | lt (left right : RangeExpr)
  | le (left right : RangeExpr)
  | and (left right : GuardExpr)
  | or (left right : GuardExpr)
  | not (expr : GuardExpr)
  deriving Repr, DecidableEq

/-- Concrete guard evaluator. Failure means an integer variable is absent from
    the invocation environment. -/
def evalGuard : GuardExpr → IntEnv → Option Bool
  | .bool value, _ => some value
  | .eq left right, values => do
      let leftValue ← evalRangeExpr left values
      let rightValue ← evalRangeExpr right values
      pure (decide (leftValue = rightValue))
  | .lt left right, values => do
      let leftValue ← evalRangeExpr left values
      let rightValue ← evalRangeExpr right values
      pure (decide (leftValue < rightValue))
  | .le left right, values => do
      let leftValue ← evalRangeExpr left values
      let rightValue ← evalRangeExpr right values
      pure (decide (leftValue ≤ rightValue))
  | .and left right, values => do
      let leftValue ← evalGuard left values
      let rightValue ← evalGuard right values
      pure (leftValue && rightValue)
  | .or left right, values => do
      let leftValue ← evalGuard left values
      let rightValue ← evalGuard right values
      pure (leftValue || rightValue)
  | .not expr, values => do
      let value ← evalGuard expr values
      pure (!value)

/-- A guard-aware tree parallel to SourceStmt. Leaves deliberately do not carry
    effects: existing SourceStmt/CoreStmt remains the authority for effect
    semantics, signatures and capabilities. -/
inductive GuardTree where
  | leaf
  | seq (first second : GuardTree)
  | branch (guard : GuardExpr) (thenBranch elseBranch : GuardTree)
  | repeat (count : Nat) (body : GuardTree)
  deriving Repr, DecidableEq

/-- Relational statement that a GuardTree has exactly the same control-flow
    skeleton as a SourceStmt. -/
inductive GuardShape : SourceStmt → GuardTree → Prop where
  | skip : GuardShape .skip .leaf
  | change {change : SourceChange} : GuardShape (.change change) .leaf
  | seq {sourceFirst sourceSecond : SourceStmt} {guardFirst guardSecond : GuardTree} :
      GuardShape sourceFirst guardFirst →
      GuardShape sourceSecond guardSecond →
      GuardShape (.seq sourceFirst sourceSecond) (.seq guardFirst guardSecond)
  | branch {sourceThen sourceElse : SourceStmt} {guard : GuardExpr} {guardThen guardElse : GuardTree} :
      GuardShape sourceThen guardThen →
      GuardShape sourceElse guardElse →
      GuardShape (.branch sourceThen sourceElse) (.branch guard guardThen guardElse)
  | repeat {count : Nat} {sourceBody : SourceStmt} {guardBody : GuardTree} :
      GuardShape sourceBody guardBody →
      GuardShape (.repeat count sourceBody) (.repeat count guardBody)

/-- Executable GuardShape checker. -/
def checkGuardShape : SourceStmt → GuardTree → Bool
  | .skip, .leaf => true
  | .change _, .leaf => true
  | .seq sourceFirst sourceSecond, .seq guardFirst guardSecond =>
      checkGuardShape sourceFirst guardFirst && checkGuardShape sourceSecond guardSecond
  | .branch sourceThen sourceElse, .branch _ guardThen guardElse =>
      checkGuardShape sourceThen guardThen && checkGuardShape sourceElse guardElse
  | .repeat sourceCount sourceBody, .repeat guardCount guardBody =>
      decide (sourceCount = guardCount) && checkGuardShape sourceBody guardBody
  | _, _ => false

/-- Successful executable shape checking implies the relational correspondence. -/
theorem checkGuardShape_sound :
    ∀ {source : SourceStmt} {tree : GuardTree},
      checkGuardShape source tree = true → GuardShape source tree := by
  intro source
  induction source with
  | skip =>
      intro tree h
      cases tree <;> simp [checkGuardShape] at h
      exact GuardShape.skip
  | change change =>
      intro tree h
      cases tree <;> simp [checkGuardShape] at h
      exact GuardShape.change
  | seq first second ihFirst ihSecond =>
      intro tree h
      cases tree with
      | leaf => simp [checkGuardShape] at h
      | seq guardFirst guardSecond =>
          have hBoth :
              checkGuardShape first guardFirst = true ∧
              checkGuardShape second guardSecond = true := by
            simpa [checkGuardShape, Bool.and_eq_true] using h
          exact GuardShape.seq (ihFirst hBoth.1) (ihSecond hBoth.2)
      | branch guard thenBranch elseBranch => simp [checkGuardShape] at h
      | repeat count body => simp [checkGuardShape] at h
  | branch thenBranch elseBranch ihThen ihElse =>
      intro tree h
      cases tree with
      | leaf => simp [checkGuardShape] at h
      | seq first second => simp [checkGuardShape] at h
      | branch guard guardThen guardElse =>
          have hBoth :
              checkGuardShape thenBranch guardThen = true ∧
              checkGuardShape elseBranch guardElse = true := by
            simpa [checkGuardShape, Bool.and_eq_true] using h
          exact GuardShape.branch (ihThen hBoth.1) (ihElse hBoth.2)
      | repeat count body => simp [checkGuardShape] at h
  | «repeat» count sourceBody ih =>
      intro tree h
      cases tree with
      | leaf => simp [checkGuardShape] at h
      | seq first second => simp [checkGuardShape] at h
      | branch guard thenBranch elseBranch => simp [checkGuardShape] at h
      | repeat guardCount guardBody =>
          have hBoth :
              decide (count = guardCount) = true ∧
              checkGuardShape sourceBody guardBody = true := by
            simpa [checkGuardShape, Bool.and_eq_true] using h
          have hCount : count = guardCount := of_decide_eq_true hBoth.1
          subst guardCount
          exact GuardShape.repeat (ih hBoth.2)

/-- Guard-aware validity of the same proof-free RuntimePath used by beta.21/22.
    Branch constructors carry the concrete guard-evaluation premise. -/
inductive GuardPathValid (values : IntEnv) : GuardTree → RuntimePath → Prop where
  | leaf : GuardPathValid values .leaf .leaf
  | seq {first second : GuardTree} {firstPath secondPath : RuntimePath} :
      GuardPathValid values first firstPath →
      GuardPathValid values second secondPath →
      GuardPathValid values (.seq first second) (.seq firstPath secondPath)
  | branchThen {guard : GuardExpr} {thenBranch elseBranch : GuardTree} {path : RuntimePath} :
      evalGuard guard values = some true →
      GuardPathValid values thenBranch path →
      GuardPathValid values (.branch guard thenBranch elseBranch) (.branchThen path)
  | branchElse {guard : GuardExpr} {thenBranch elseBranch : GuardTree} {path : RuntimePath} :
      evalGuard guard values = some false →
      GuardPathValid values elseBranch path →
      GuardPathValid values (.branch guard thenBranch elseBranch) (.branchElse path)
  | repeatZero {body : GuardTree} :
      GuardPathValid values (.repeat 0 body) .repeatZero
  | repeatSucc {count : Nat} {body : GuardTree} {bodyPath restPath : RuntimePath} :
      GuardPathValid values body bodyPath →
      GuardPathValid values (.repeat count body) restPath →
      GuardPathValid values (.repeat (count + 1) body) (.repeatSucc bodyPath restPath)

/-- Executable guard/path checker, structurally recursive on the proof-free path. -/
def checkGuardPath (values : IntEnv) : RuntimePath → GuardTree → Bool
  | .leaf, .leaf => true
  | .seq firstPath secondPath, .seq first second =>
      checkGuardPath values firstPath first && checkGuardPath values secondPath second
  | .branchThen path, .branch guard thenBranch _ =>
      decide (evalGuard guard values = some true) && checkGuardPath values path thenBranch
  | .branchElse path, .branch guard _ elseBranch =>
      decide (evalGuard guard values = some false) && checkGuardPath values path elseBranch
  | .repeatZero, .repeat 0 _ => true
  | .repeatSucc bodyPath restPath, .repeat (count + 1) body =>
      checkGuardPath values bodyPath body && checkGuardPath values restPath (.repeat count body)
  | _, _ => false

/-- Successful guard/path checking gives a relational witness that every selected
    branch agrees with concrete evaluation in the invocation environment. -/
theorem checkGuardPath_sound :
    ∀ {path : RuntimePath} {tree : GuardTree} {values : IntEnv},
      checkGuardPath values path tree = true → GuardPathValid values tree path := by
  intro path
  induction path with
  | leaf =>
      intro tree values h
      cases tree <;> simp [checkGuardPath] at h
      exact GuardPathValid.leaf
  | seq firstPath secondPath ihFirst ihSecond =>
      intro tree values h
      cases tree with
      | leaf => simp [checkGuardPath] at h
      | seq first second =>
          have hBoth :
              checkGuardPath values firstPath first = true ∧
              checkGuardPath values secondPath second = true := by
            simpa [checkGuardPath, Bool.and_eq_true] using h
          exact GuardPathValid.seq (ihFirst hBoth.1) (ihSecond hBoth.2)
      | branch guard thenBranch elseBranch => simp [checkGuardPath] at h
      | repeat count body => simp [checkGuardPath] at h
  | branchThen path ih =>
      intro tree values h
      cases tree with
      | leaf => simp [checkGuardPath] at h
      | seq first second => simp [checkGuardPath] at h
      | branch guard thenBranch elseBranch =>
          have hBoth :
              decide (evalGuard guard values = some true) = true ∧
              checkGuardPath values path thenBranch = true := by
            simpa [checkGuardPath, Bool.and_eq_true] using h
          exact GuardPathValid.branchThen (of_decide_eq_true hBoth.1) (ih hBoth.2)
      | repeat count body => simp [checkGuardPath] at h
  | branchElse path ih =>
      intro tree values h
      cases tree with
      | leaf => simp [checkGuardPath] at h
      | seq first second => simp [checkGuardPath] at h
      | branch guard thenBranch elseBranch =>
          have hBoth :
              decide (evalGuard guard values = some false) = true ∧
              checkGuardPath values path elseBranch = true := by
            simpa [checkGuardPath, Bool.and_eq_true] using h
          exact GuardPathValid.branchElse (of_decide_eq_true hBoth.1) (ih hBoth.2)
      | repeat count body => simp [checkGuardPath] at h
  | repeatZero =>
      intro tree values h
      cases tree with
      | leaf => simp [checkGuardPath] at h
      | seq first second => simp [checkGuardPath] at h
      | branch guard thenBranch elseBranch => simp [checkGuardPath] at h
      | repeat count body =>
          cases count with
          | zero => exact GuardPathValid.repeatZero
          | succ n => simp [checkGuardPath] at h
  | repeatSucc bodyPath restPath ihBody ihRest =>
      intro tree values h
      cases tree with
      | leaf => simp [checkGuardPath] at h
      | seq first second => simp [checkGuardPath] at h
      | branch guard thenBranch elseBranch => simp [checkGuardPath] at h
      | repeat count body =>
          cases count with
          | zero => simp [checkGuardPath] at h
          | succ n =>
              have hBoth :
                  checkGuardPath values bodyPath body = true ∧
                  checkGuardPath values restPath (.repeat n body) = true := by
                simpa [checkGuardPath, Bool.and_eq_true, Nat.succ_eq_add_one] using h
              exact GuardPathValid.repeatSucc (ihBody hBoth.1) (ihRest hBoth.2)

/-- Combined beta.23 checker: source/guard shape, concrete guard/path truth and
    the existing source/runtime effect correspondence must all pass. -/
def checkGuardedSourceRuntimeEvidence
    (source : SourceStmt) (tree : GuardTree) (values : IntEnv)
    (observed : List EvidenceEffect) (path : RuntimePath) : Bool :=
  checkGuardShape source tree &&
  checkGuardPath values path tree &&
  checkSourceRuntimeEvidence source observed path

/-- Guard-aware runtime correspondence. Besides the existing SourceExecutes and
    TraceRefines conclusions, a successful check proves that the GuardTree is
    structurally tied to SourceStmt and every selected branch agrees with guard
    evaluation in the supplied invocation environment. -/
theorem checkGuardedSourceRuntimeEvidence_sound
    {source : SourceStmt} {tree : GuardTree} {values : IntEnv}
    {observed : List EvidenceEffect} {path : RuntimePath}
    (h : checkGuardedSourceRuntimeEvidence source tree values observed path = true) :
    ∃ formalTrace actualTrace,
      SourceExecutes source formalTrace ∧
      decodeRuntimeTrace observed = some actualTrace ∧
      TraceRefines actualTrace formalTrace ∧
      GuardShape source tree ∧
      GuardPathValid values tree path := by
  have hAll :
      checkGuardShape source tree = true ∧
      checkGuardPath values path tree = true ∧
      checkSourceRuntimeEvidence source observed path = true := by
    simpa [checkGuardedSourceRuntimeEvidence, Bool.and_eq_true, and_assoc] using h
  obtain ⟨formalTrace, actualTrace, hExec, hDecode, hRefines⟩ :=
    checkSourceRuntimeEvidence_sound hAll.2.2
  exact ⟨formalTrace, actualTrace, hExec, hDecode, hRefines,
    checkGuardShape_sound hAll.1, checkGuardPath_sound hAll.2.1⟩

/-- Capability corollary with guard truth retained in the conclusion. -/
theorem checkedGuardedConcreteRuntimeCannotEscape
    {source : SourceStmt} {tree : GuardTree} {values : IntEnv}
    {observed : List EvidenceEffect} {path : RuntimePath} {policy : List Rule}
    (hRuntime : checkGuardedSourceRuntimeEvidence source tree values observed path = true)
    (hPolicy : checkSourceProtected source policy = true) :
    ∃ actualTrace,
      decodeRuntimeTrace observed = some actualTrace ∧
      (∀ effect, effect ∈ actualTrace →
        ∃ rule, rule ∈ policy ∧ Allows rule effect) ∧
      GuardShape source tree ∧
      GuardPathValid values tree path := by
  have hParts :
      checkGuardShape source tree = true ∧
      checkGuardPath values path tree = true ∧
      checkSourceRuntimeEvidence source observed path = true := by
    simpa [checkGuardedSourceRuntimeEvidence, Bool.and_eq_true, and_assoc] using hRuntime
  obtain ⟨actualTrace, hDecode, hAllowed⟩ :=
    checkedConcreteRuntimeCannotEscape hParts.2.2 hPolicy
  exact ⟨actualTrace, hDecode, hAllowed,
    checkGuardShape_sound hParts.1, checkGuardPath_sound hParts.2.1⟩

end PatchFormal
