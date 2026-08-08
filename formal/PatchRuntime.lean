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
            | none => simp [hActual, hExpected]
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
      List.Forall₂ EffectRefines actual expected := by
  intro actual
  induction actual with
  | nil =>
      intro expected h
      cases expected with
      | nil => exact List.Forall₂.nil
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
          exact List.Forall₂.cons (effectRefinesBool_sound hBoth.1) (ih hBoth.2)

/-- Decode only the linear formal evidence fragment to its exact formal trace.
    Branches and repeats are intentionally rejected in beta.20 rather than
    silently approximated; they can be added with explicit path witnesses later. -/
def decodeLinearEvidenceTrace : EvidenceStmt → Option (List Effect)
  | .skip => some []
  | .emit raw => do
      let effect ← decodeEvidenceEffect raw
      pure [effect]
  | .seq first second => do
      let left ← decodeLinearEvidenceTrace first
      let right ← decodeLinearEvidenceTrace second
      pure (left ++ right)
  | .branch _ _ => none
  | .repeat _ _ => none

/-- Successful linear evidence decoding constructs an actual execution of the
    existing mechanized `CoreStmt` semantics. -/
theorem decodeLinearEvidenceTrace_sound :
    ∀ {evidence : EvidenceStmt} {trace : List Effect},
      decodeLinearEvidenceTrace evidence = some trace →
      ∃ stmt,
        decodeEvidenceStmt evidence = some stmt ∧
        Executes stmt trace := by
  intro evidence
  induction evidence with
  | skip =>
      intro trace h
      have hTrace : trace = [] := by
        simpa [decodeLinearEvidenceTrace] using h.symm
      subst trace
      exact ⟨.skip, rfl, Executes.skip⟩
  | emit raw =>
      intro trace h
      cases hDecode : decodeEvidenceEffect raw with
      | none =>
          simp [decodeLinearEvidenceTrace, hDecode] at h
      | some effect =>
          have hTrace : trace = [effect] := by
            simpa [decodeLinearEvidenceTrace, hDecode] using h.symm
          subst trace
          refine ⟨.emit effect, ?_, Executes.emit⟩
          simp [decodeEvidenceStmt, hDecode]
  | seq first second ihFirst ihSecond =>
      intro trace h
      cases hLeft : decodeLinearEvidenceTrace first with
      | none =>
          simp [decodeLinearEvidenceTrace, hLeft] at h
      | some left =>
          cases hRight : decodeLinearEvidenceTrace second with
          | none =>
              simp [decodeLinearEvidenceTrace, hLeft, hRight] at h
          | some right =>
              have hTrace : trace = left ++ right := by
                simpa [decodeLinearEvidenceTrace, hLeft, hRight] using h.symm
              subst trace
              obtain ⟨leftStmt, hDecodeLeft, hExecLeft⟩ := ihFirst hLeft
              obtain ⟨rightStmt, hDecodeRight, hExecRight⟩ := ihSecond hRight
              refine ⟨.seq leftStmt rightStmt, ?_, Executes.seq hExecLeft hExecRight⟩
              simp [decodeEvidenceStmt, hDecodeLeft, hDecodeRight]
  | branch thenBranch elseBranch ihThen ihElse =>
      intro trace h
      simp [decodeLinearEvidenceTrace] at h
  | repeat count body ih =>
      intro trace h
      simp [decodeLinearEvidenceTrace] at h

/-- Runtime correspondence checker for the beta.20 linear certified source core.
    It independently decodes the observed proof-free occurrence list and checks
    that each occurrence refines the exact formal execution trace derived from
    Lean-normalized source evidence. -/
def checkSourceRuntimeEvidence
    (source : SourceStmt) (observed : List EvidenceEffect) : Bool :=
  match lowerSourceStmt source with
  | none => false
  | some evidence =>
      match decodeLinearEvidenceTrace evidence with
      | none => false
      | some formalTrace =>
          match decodeRuntimeTrace observed with
          | none => false
          | some actualTrace => traceRefinesBool actualTrace formalTrace

/-- **Runtime-to-formal correspondence for the checked linear source core.**
    A successful runtime-evidence check yields a formal `SourceExecutes` trace,
    a decoded observed trace, and pointwise semantic refinement between them. -/
theorem checkSourceRuntimeEvidence_sound
    {source : SourceStmt} {observed : List EvidenceEffect}
    (h : checkSourceRuntimeEvidence source observed = true) :
    ∃ formalTrace actualTrace,
      SourceExecutes source formalTrace ∧
      decodeRuntimeTrace observed = some actualTrace ∧
      List.Forall₂ EffectRefines actualTrace formalTrace := by
  cases hLower : lowerSourceStmt source with
  | none =>
      simp [checkSourceRuntimeEvidence, hLower] at h
  | some evidence =>
      cases hFormal : decodeLinearEvidenceTrace evidence with
      | none =>
          simp [checkSourceRuntimeEvidence, hLower, hFormal] at h
      | some formalTrace =>
          cases hActual : decodeRuntimeTrace observed with
          | none =>
              simp [checkSourceRuntimeEvidence, hLower, hFormal, hActual] at h
          | some actualTrace =>
              have hRefines : traceRefinesBool actualTrace formalTrace = true := by
                simpa [checkSourceRuntimeEvidence, hLower, hFormal, hActual] using h
              have hPointwise : List.Forall₂ EffectRefines actualTrace formalTrace :=
                traceRefinesBool_sound hRefines
              obtain ⟨stmt, hDecode, hExec⟩ := decodeLinearEvidenceTrace_sound hFormal
              refine ⟨formalTrace, actualTrace, ?_, hActual, hPointwise⟩
              exact ⟨evidence, stmt, hLower, hDecode, hExec⟩

end PatchFormal
