import PatchEvidence

namespace PatchFormal

/-- Source-level mutation vocabulary for the certifiable Patch core. This keeps
    `add` and `remove` distinct until Lean normalizes them into semantic
    increase/decrease effects. -/
inductive SourceChangeKind where
  | add
  | remove
  | set
  | clear
  deriving Repr, DecidableEq

/-- Proof-free source-level change. Numeric amounts are range summaries produced
    by the current frontend. Their range-analysis soundness remains a separate
    proof obligation; this module validates ordering and semantic normalization. -/
structure SourceChange where
  target : Name
  field : Option Name
  kind : SourceChangeKind
  amount : Option EvidenceAmount
  deriving Repr, DecidableEq

/-- A small source-core preserving Patch control flow and source change verbs. -/
inductive SourceStmt where
  | skip
  | change (change : SourceChange)
  | seq (first second : SourceStmt)
  | branch (thenBranch elseBranch : SourceStmt)
  | repeat (count : Nat) (body : SourceStmt)
  deriving Repr, DecidableEq

private def negateInterval (interval : Interval) : Interval :=
  { lo := -interval.hi
    hi := -interval.lo
    ordered := neg_le_neg interval.ordered }

private def mkEffect
    (change : SourceChange)
    (kind : ChangeKind)
    (amount : Option Interval) : Effect :=
  { target := change.target
    field := change.field
    kind := kind
    amount := amount }

/-- Lean's executable source-change normalizer. It validates a raw interval,
    keeps non-negative `add` as increase and `remove` as decrease, and flips a
    strictly non-positive range into the opposite semantic direction. Mixed-sign
    numeric ranges remain outside the certifiable source core. -/
def normalizeSourceChange (change : SourceChange) : Option Effect :=
  match change.kind with
  | .set =>
      match change.amount with
      | none => some (mkEffect change .set none)
      | some _ => none
  | .clear =>
      match change.amount with
      | none => some (mkEffect change .clear none)
      | some _ => none
  | .add =>
      match change.amount with
      | none => none
      | some raw =>
          match decodeEvidenceAmount raw with
          | none => none
          | some interval =>
              if 0 ≤ interval.lo then
                some (mkEffect change .increase (some interval))
              else if interval.hi ≤ 0 then
                some (mkEffect change .decrease (some (negateInterval interval)))
              else
                none
  | .remove =>
      match change.amount with
      | none => none
      | some raw =>
          match decodeEvidenceAmount raw with
          | none => none
          | some interval =>
              if 0 ≤ interval.lo then
                some (mkEffect change .decrease (some interval))
              else if interval.hi ≤ 0 then
                some (mkEffect change .increase (some (negateInterval interval)))
              else
                none

/-- Lower one source change into proof-free semantic evidence. The normalization
    decision itself is performed inside Lean, not trusted from the producer. -/
def lowerSourceChange (change : SourceChange) : Option EvidenceEffect :=
  (normalizeSourceChange change).map encodeEvidenceEffect

/-- Lower the formal Patch source core to the beta.7 evidence vocabulary. -/
def lowerSourceStmt : SourceStmt → Option EvidenceStmt
  | .skip => some .skip
  | .change change => do
      let effect ← lowerSourceChange change
      pure (.emit effect)
  | .seq first second => do
      let loweredFirst ← lowerSourceStmt first
      let loweredSecond ← lowerSourceStmt second
      pure (.seq loweredFirst loweredSecond)
  | .branch thenBranch elseBranch => do
      let loweredThen ← lowerSourceStmt thenBranch
      let loweredElse ← lowerSourceStmt elseBranch
      pure (.branch loweredThen loweredElse)
  | .repeat count body => do
      let loweredBody ← lowerSourceStmt body
      pure (.repeat count loweredBody)

/-- Exact machine decision that source-core lowering produced the claimed
    evidence artifact. -/
def checkSourceEvidence (source : SourceStmt) (evidence : EvidenceStmt) : Bool :=
  decide (lowerSourceStmt source = some evidence)

/-- Successful source/evidence checking is an actual equality witness. -/
theorem checkSourceEvidence_sound
    {source : SourceStmt} {evidence : EvidenceStmt}
    (h : checkSourceEvidence source evidence = true) :
    lowerSourceStmt source = some evidence := by
  apply of_decide_eq_true
  simpa [checkSourceEvidence] using h

/-- Check a separately emitted production signature claim from the source core.
    This composes source normalization with beta.7's independent evidence
    decoding and formal signature inference. -/
def checkSourceSignature
    (source : SourceStmt) (claim : List EvidenceEffect) : Bool :=
  match lowerSourceStmt source with
  | none => false
  | some evidence => checkEvidenceSignature evidence claim

/-- A successful source/signature check yields an evidence artifact, decoded
    formal statement, and exact equality with Lean's inferred signature. -/
theorem checkSourceSignature_sound
    {source : SourceStmt} {claim : List EvidenceEffect}
    (h : checkSourceSignature source claim = true) :
    ∃ evidence stmt,
      lowerSourceStmt source = some evidence ∧
      decodeEvidenceStmt evidence = some stmt ∧
      encodeSignature (inferSignature stmt) = claim := by
  cases hLower : lowerSourceStmt source with
  | none =>
      simp [checkSourceSignature, hLower] at h
  | some evidence =>
      have hEvidence : checkEvidenceSignature evidence claim = true := by
        simpa [checkSourceSignature, hLower] using h
      obtain ⟨stmt, hDecode, hSignature⟩ := checkEvidenceSignature_sound hEvidence
      exact ⟨evidence, stmt, rfl, hDecode, hSignature⟩

/-- Semantic policy checking directly from source-core syntax. -/
def checkSourceProtected
    (source : SourceStmt) (policy : List Rule) : Bool :=
  match lowerSourceStmt source with
  | none => false
  | some evidence => checkEvidenceProtected evidence policy

/-- Formal execution semantics for the source core are defined by successful
    Lean normalization to evidence, evidence decoding, and the existing
    mechanized CoreStmt execution relation. This keeps the trust boundary
    explicit and executable. -/
def SourceExecutes (source : SourceStmt) (runtime : List Effect) : Prop :=
  ∃ evidence stmt,
    lowerSourceStmt source = some evidence ∧
    decodeEvidenceStmt evidence = some stmt ∧
    Executes stmt runtime

/-- A successful source-level policy check is sufficient for runtime containment
    for every execution admitted by the formal source-core semantics. -/
theorem checkedSourceExecutionCannotEscape
    {source : SourceStmt} {runtime : List Effect} {policy : List Rule}
    (hExec : SourceExecutes source runtime)
    (hCheck : checkSourceProtected source policy = true) :
    ∀ effect, effect ∈ runtime →
      ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  obtain ⟨evidence, stmt, hLower, hDecode, hCoreExec⟩ := hExec
  have hEvidenceCheck : checkEvidenceProtected evidence policy = true := by
    simpa [checkSourceProtected, hLower] using hCheck
  exact checkedEvidenceExecutionCannotEscape hDecode hCoreExec hEvidenceCheck

/-- Source-level signature and policy checks can be combined into one reusable
    artifact statement. -/
theorem checkedSourceSignatureAndPolicy
    {source : SourceStmt} {claim : List EvidenceEffect} {policy : List Rule}
    (hSignature : checkSourceSignature source claim = true)
    (hPolicy : checkSourceProtected source policy = true) :
    ∃ evidence stmt,
      lowerSourceStmt source = some evidence ∧
      decodeEvidenceStmt evidence = some stmt ∧
      encodeSignature (inferSignature stmt) = claim ∧
      Protected stmt policy := by
  obtain ⟨evidence, stmt, hLower, hDecode, hClaim⟩ := checkSourceSignature_sound hSignature
  have hEvidencePolicy : checkEvidenceProtected evidence policy = true := by
    simpa [checkSourceProtected, hLower] using hPolicy
  obtain ⟨decoded, hDecodedAgain, hProtected⟩ := checkEvidenceProtected_sound hEvidencePolicy
  have hSame : decoded = stmt := by
    rw [hDecode] at hDecodedAgain
    cases hDecodedAgain
    rfl
  subst decoded
  exact ⟨evidence, stmt, hLower, hDecode, hClaim, hProtected⟩

end PatchFormal
