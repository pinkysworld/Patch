import PatchSource

namespace PatchFormal

/-- A concrete observed runtime effect refines a formal effect when it addresses
    the same semantic operation and its concrete/smaller amount interval lies
    inside the formal interval. This lets a runtime occurrence such as
    `increase [8,8]` correspond to a formal effect `increase [0,10]`. -/
def EffectRefines (actual expected : Effect) : Prop :=
  actual.target = expected.target ∧
  actual.field = expected.field ∧
  actual.kind = expected.kind ∧
  match actual.amount, expected.amount with
  | none, none => True
  | some actualAmount, some expectedAmount => Within actualAmount expectedAmount
  | _, _ => False

/-- Executable refinement check for one observed/formal effect pair. -/
def effectRefinesBool (actual expected : Effect) : Bool :=
  if actual.target = expected.target then
    if actual.field = expected.field then
      if actual.kind = expected.kind then
        match actual.amount, expected.amount with
        | none, none => true
        | some actualAmount, some expectedAmount => withinBool actualAmount expectedAmount
        | _, _ => false
      else false
    else false
  else false

/-- Successful executable effect refinement implies the relational judgment. -/
theorem effectRefinesBool_sound
    {actual expected : Effect}
    (h : effectRefinesBool actual expected = true) :
    EffectRefines actual expected := by
  by_cases hTarget : actual.target = expected.target
  · by_cases hField : actual.field = expected.field
    · by_cases hKind : actual.kind = expected.kind
      · refine ⟨hTarget, hField, hKind, ?_⟩
        cases hActual : actual.amount with
        | none =>
            cases hExpected : expected.amount with
            | none => simp
            | some expectedAmount =>
                simp [effectRefinesBool, hTarget, hField, hKind, hActual, hExpected] at h
        | some actualAmount =>
            cases hExpected : expected.amount with
            | none =>
                simp [effectRefinesBool, hTarget, hField, hKind, hActual, hExpected] at h
            | some expectedAmount =>
                have hWithin : withinBool actualAmount expectedAmount = true := by
                  simpa [effectRefinesBool, hTarget, hField, hKind, hActual, hExpected] using h
                have hRel : Within actualAmount expectedAmount := withinBool_sound hWithin
                simpa [hActual, hExpected] using hRel
      · simp [effectRefinesBool, hTarget, hField, hKind] at h
    · simp [effectRefinesBool, hTarget, hField] at h
  · simp [effectRefinesBool, hTarget] at h

/-- Decode a proof-free list of runtime effect occurrences. -/
def decodeRuntimeTrace : List EvidenceEffect → Option (List Effect)
  | [] => some []
  | first :: rest => do
      let decodedFirst ← decodeEvidenceEffect first
      let decodedRest ← decodeRuntimeTrace rest
      pure (decodedFirst :: decodedRest)

/-- A deliberately small pointwise trace-refinement relation. -/
inductive TraceRefines : List Effect → List Effect → Prop where
  | nil : TraceRefines [] []
  | cons {actual expected : Effect} {actualRest expectedRest : List Effect} :
      EffectRefines actual expected →
      TraceRefines actualRest expectedRest →
      TraceRefines (actual :: actualRest) (expected :: expectedRest)

/-- Pointwise executable refinement for complete runtime traces. -/
def traceRefinesBool : List Effect → List Effect → Bool
  | [], [] => true
  | actual :: actualRest, expected :: expectedRest =>
      effectRefinesBool actual expected && traceRefinesBool actualRest expectedRest
  | _, _ => false

/-- The trace checker is sound with respect to pointwise `EffectRefines`. -/
theorem traceRefinesBool_sound :
    ∀ {actual expected : List Effect},
      traceRefinesBool actual expected = true →
      TraceRefines actual expected := by
  intro actual
  induction actual with
  | nil =>
      intro expected h
      cases expected with
      | nil => exact TraceRefines.nil
      | cons first rest => simp [traceRefinesBool] at h
  | cons first rest ih =>
      intro expected h
      cases expected with
      | nil => simp [traceRefinesBool] at h
      | cons expectedFirst expectedRest =>
          have hBoth :
              effectRefinesBool first expectedFirst = true ∧
              traceRefinesBool rest expectedRest = true := by
            simpa [traceRefinesBool, Bool.and_eq_true] using h
          exact TraceRefines.cons (effectRefinesBool_sound hBoth.1) (ih hBoth.2)

/-- Proof-free execution-path witness. It mirrors the constructors of the
    mechanized `Executes` relation. `repeatSucc` contains one witness for the
    current body execution and another witness for the remaining iterations,
    so different branch choices may be represented on different iterations. -/
inductive RuntimePath where
  | leaf
  | seq (first second : RuntimePath)
  | branchThen (path : RuntimePath)
  | branchElse (path : RuntimePath)
  | repeatZero
  | repeatSucc (body rest : RuntimePath)
  deriving Repr, DecidableEq

/-- Execute a formal CoreStmt according to an explicit untrusted path witness.
    Shape mismatches, impossible branch witnesses, and repeat-count mismatches
    are rejected instead of approximated. -/
def decodeCorePath : RuntimePath → CoreStmt → Option (List Effect)
  | .leaf, .skip => some []
  | .leaf, .emit effect => some [effect]
  | .seq firstPath secondPath, .seq first second => do
      let left ← decodeCorePath firstPath first
      let right ← decodeCorePath secondPath second
      pure (left ++ right)
  | .branchThen path, .branch thenBranch _ =>
      decodeCorePath path thenBranch
  | .branchElse path, .branch _ elseBranch =>
      decodeCorePath path elseBranch
  | .repeatZero, .repeat 0 _ => some []
  | .repeatSucc bodyPath restPath, .repeat (Nat.succ n) body => do
      let first ← decodeCorePath bodyPath body
      let rest ← decodeCorePath restPath (.repeat n body)
      pure (first ++ rest)
  | _, _ => none

/-- **Path-witness soundness.** If Lean accepts an execution-path witness for a
    formal core statement, the reconstructed trace is an actual execution of
    that statement under the existing mechanized semantics. -/
theorem decodeCorePath_sound :
    ∀ {path : RuntimePath} {stmt : CoreStmt} {trace : List Effect},
      decodeCorePath path stmt = some trace →
      Executes stmt trace := by
  intro path
  induction path with
  | leaf =>
      intro stmt trace h
      cases stmt with
      | skip =>
          simp [decodeCorePath] at h
          subst trace
          exact Executes.skip
      | emit effect =>
          simp [decodeCorePath] at h
          subst trace
          exact Executes.emit
      | seq first second => simp [decodeCorePath] at h
      | branch thenBranch elseBranch => simp [decodeCorePath] at h
      | «repeat» count body => simp [decodeCorePath] at h
  | seq firstPath secondPath ihFirst ihSecond =>
      intro stmt trace h
      cases stmt with
      | skip => simp [decodeCorePath] at h
      | emit effect => simp [decodeCorePath] at h
      | seq first second =>
          cases hLeft : decodeCorePath firstPath first with
          | none =>
              simp [decodeCorePath, hLeft] at h
          | some left =>
              cases hRight : decodeCorePath secondPath second with
              | none =>
                  simp [decodeCorePath, hLeft, hRight] at h
              | some right =>
                  have hTrace : trace = left ++ right := by
                    simpa [decodeCorePath, hLeft, hRight] using h.symm
                  subst trace
                  exact Executes.seq (ihFirst hLeft) (ihSecond hRight)
      | branch thenBranch elseBranch => simp [decodeCorePath] at h
      | «repeat» count body => simp [decodeCorePath] at h
  | branchThen path ih =>
      intro stmt trace h
      cases stmt with
      | skip => simp [decodeCorePath] at h
      | emit effect => simp [decodeCorePath] at h
      | seq first second => simp [decodeCorePath] at h
      | branch thenBranch elseBranch =>
          have hThen : decodeCorePath path thenBranch = some trace := by
            simpa [decodeCorePath] using h
          exact Executes.branchThen (ih hThen)
      | «repeat» count body => simp [decodeCorePath] at h
  | branchElse path ih =>
      intro stmt trace h
      cases stmt with
      | skip => simp [decodeCorePath] at h
      | emit effect => simp [decodeCorePath] at h
      | seq first second => simp [decodeCorePath] at h
      | branch thenBranch elseBranch =>
          have hElse : decodeCorePath path elseBranch = some trace := by
            simpa [decodeCorePath] using h
          exact Executes.branchElse (ih hElse)
      | «repeat» count body => simp [decodeCorePath] at h
  | repeatZero =>
      intro stmt trace h
      cases stmt with
      | skip => simp [decodeCorePath] at h
      | emit effect => simp [decodeCorePath] at h
      | seq first second => simp [decodeCorePath] at h
      | branch thenBranch elseBranch => simp [decodeCorePath] at h
      | «repeat» count body =>
          cases count with
          | zero =>
              simp [decodeCorePath] at h
              subst trace
              exact Executes.repeatZero
          | succ n => simp [decodeCorePath] at h
  | repeatSucc bodyPath restPath ihBody ihRest =>
      intro stmt trace h
      cases stmt with
      | skip => simp [decodeCorePath] at h
      | emit effect => simp [decodeCorePath] at h
      | seq first second => simp [decodeCorePath] at h
      | branch thenBranch elseBranch => simp [decodeCorePath] at h
      | «repeat» count body =>
          cases count with
          | zero => simp [decodeCorePath] at h
          | succ n =>
              cases hFirst : decodeCorePath bodyPath body with
              | none =>
                  simp [decodeCorePath, hFirst] at h
              | some first =>
                  cases hRest : decodeCorePath restPath (.repeat n body) with
                  | none =>
                      simp [decodeCorePath, hFirst, hRest] at h
                  | some rest =>
                      have hTrace : trace = first ++ rest := by
                        simpa [decodeCorePath, hFirst, hRest] using h.symm
                      subst trace
                      have hBodyExec : Executes body first := ihBody hFirst
                      have hRestExec : Executes (.repeat n body) rest := ihRest hRest
                      simpa [Nat.succ_eq_add_one] using Executes.repeatSucc hBodyExec hRestExec

/-- Runtime correspondence checker for the beta.21 path-witnessed source core.
    The observed occurrence list and the proposed control-flow witness are both
    untrusted inputs. Lean validates the source lowering, evidence decoding,
    path execution and pointwise concrete-to-formal effect refinement. -/
def checkSourceRuntimeEvidence
    (source : SourceStmt) (observed : List EvidenceEffect) (path : RuntimePath) : Bool :=
  match lowerSourceStmt source with
  | none => false
  | some evidence =>
      match decodeEvidenceStmt evidence with
      | none => false
      | some stmt =>
          match decodeCorePath path stmt with
          | none => false
          | some formalTrace =>
              match decodeRuntimeTrace observed with
              | none => false
              | some actualTrace => traceRefinesBool actualTrace formalTrace

/-- **Runtime-to-formal correspondence with explicit control-flow witnesses.**
    A successful check yields an actual formal SourceExecutes trace and an
    ordered pointwise refinement from the decoded concrete runtime occurrences. -/
theorem checkSourceRuntimeEvidence_sound
    {source : SourceStmt} {observed : List EvidenceEffect} {path : RuntimePath}
    (h : checkSourceRuntimeEvidence source observed path = true) :
    ∃ formalTrace actualTrace,
      SourceExecutes source formalTrace ∧
      decodeRuntimeTrace observed = some actualTrace ∧
      TraceRefines actualTrace formalTrace := by
  cases hLower : lowerSourceStmt source with
  | none =>
      simp [checkSourceRuntimeEvidence, hLower] at h
  | some evidence =>
      cases hDecode : decodeEvidenceStmt evidence with
      | none =>
          simp [checkSourceRuntimeEvidence, hLower, hDecode] at h
      | some stmt =>
          cases hFormal : decodeCorePath path stmt with
          | none =>
              simp [checkSourceRuntimeEvidence, hLower, hDecode, hFormal] at h
          | some formalTrace =>
              cases hActual : decodeRuntimeTrace observed with
              | none =>
                  simp [checkSourceRuntimeEvidence, hLower, hDecode, hFormal, hActual] at h
              | some actualTrace =>
                  have hRefines : traceRefinesBool actualTrace formalTrace = true := by
                    simpa [checkSourceRuntimeEvidence, hLower, hDecode, hFormal, hActual] using h
                  have hPointwise : TraceRefines actualTrace formalTrace :=
                    traceRefinesBool_sound hRefines
                  have hExec : Executes stmt formalTrace := decodeCorePath_sound hFormal
                  refine ⟨formalTrace, actualTrace, ?_, rfl, hPointwise⟩
                  exact ⟨evidence, stmt, hLower, hDecode, hExec⟩

end PatchFormal
