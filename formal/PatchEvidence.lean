import PatchChecker

namespace PatchFormal

/-- Untrusted serialized interval evidence. Unlike `Interval`, this structure
    carries no proof that its bounds are ordered. The Lean decoder validates
    that property before admitting the interval into the semantic model. -/
structure EvidenceAmount where
  lo : Int
  hi : Int
  deriving Repr, DecidableEq

/-- Stable, proof-free effect evidence emitted by the production toolchain. -/
structure EvidenceEffect where
  target : Name
  field : Option Name
  kind : ChangeKind
  amount : Option EvidenceAmount
  deriving Repr, DecidableEq

/-- Stable control-flow evidence corresponding to the conservative production
    bridge subset. This is intentionally smaller than the full Patch AST. -/
inductive EvidenceStmt where
  | skip
  | emit (effect : EvidenceEffect)
  | seq (first second : EvidenceStmt)
  | branch (thenBranch elseBranch : EvidenceStmt)
  | repeat (count : Nat) (body : EvidenceStmt)
  deriving Repr, DecidableEq

/-- Validate an untrusted evidence interval before turning it into the semantic
    `Interval` type used by the formal model. -/
def decodeEvidenceAmount (raw : EvidenceAmount) : Option Interval :=
  if h : raw.lo ≤ raw.hi then
    some { lo := raw.lo, hi := raw.hi, ordered := h }
  else
    none

/-- Validate and decode one untrusted evidence effect. -/
def decodeEvidenceEffect (raw : EvidenceEffect) : Option Effect :=
  match raw.amount with
  | none =>
      some {
        target := raw.target
        field := raw.field
        kind := raw.kind
        amount := none
      }
  | some amount =>
      match decodeEvidenceAmount amount with
      | none => none
      | some interval =>
          some {
            target := raw.target
            field := raw.field
            kind := raw.kind
            amount := some interval
          }

/-- Validate and decode the production evidence tree into the mechanized
    `CoreStmt`. Invalid quantitative evidence makes decoding fail. -/
def decodeEvidenceStmt : EvidenceStmt → Option CoreStmt
  | .skip => some .skip
  | .emit effect =>
      match decodeEvidenceEffect effect with
      | none => none
      | some decoded => some (.emit decoded)
  | .seq first second =>
      match decodeEvidenceStmt first, decodeEvidenceStmt second with
      | some decodedFirst, some decodedSecond =>
          some (.seq decodedFirst decodedSecond)
      | _, _ => none
  | .branch thenBranch elseBranch =>
      match decodeEvidenceStmt thenBranch, decodeEvidenceStmt elseBranch with
      | some decodedThen, some decodedElse =>
          some (.branch decodedThen decodedElse)
      | _, _ => none
  | .repeat count body =>
      match decodeEvidenceStmt body with
      | none => none
      | some decodedBody => some (.repeat count decodedBody)

/-- Canonical proof-free encoding of a semantic effect. Proof fields in
    `Interval` are intentionally erased from the evidence representation. -/
def encodeEvidenceEffect (effect : Effect) : EvidenceEffect :=
  {
    target := effect.target
    field := effect.field
    kind := effect.kind
    amount :=
      match effect.amount with
      | none => none
      | some interval => some { lo := interval.lo, hi := interval.hi }
  }

/-- Canonical evidence view of a semantic Change Signature. -/
def encodeSignature (signature : List Effect) : List EvidenceEffect :=
  signature.map encodeEvidenceEffect

/-- Machine decision that a production signature claim agrees exactly with the
    signature inferred by Lean after decoding the evidence tree. -/
def checkEvidenceSignature
    (evidence : EvidenceStmt) (claim : List EvidenceEffect) : Bool :=
  match decodeEvidenceStmt evidence with
  | none => false
  | some stmt => decide (encodeSignature (inferSignature stmt) = claim)

/-- Soundness of the evidence/signature correspondence check. -/
theorem checkEvidenceSignature_sound
    {evidence : EvidenceStmt} {claim : List EvidenceEffect}
    (h : checkEvidenceSignature evidence claim = true) :
    ∃ stmt,
      decodeEvidenceStmt evidence = some stmt ∧
      encodeSignature (inferSignature stmt) = claim := by
  cases hDecode : decodeEvidenceStmt evidence with
  | none =>
      simp [checkEvidenceSignature, hDecode] at h
  | some stmt =>
      have hEq : encodeSignature (inferSignature stmt) = claim := by
        apply of_decide_eq_true
        simpa [checkEvidenceSignature, hDecode] using h
      exact ⟨stmt, hDecode, hEq⟩

/-- Once a particular decoded core is known, a successful evidence/signature
    check gives an exact machine-checked correspondence to that core. -/
theorem checkedEvidenceSignatureCorresponds
    {evidence : EvidenceStmt} {stmt : CoreStmt}
    {claim : List EvidenceEffect}
    (hDecode : decodeEvidenceStmt evidence = some stmt)
    (hCheck : checkEvidenceSignature evidence claim = true) :
    encodeSignature (inferSignature stmt) = claim := by
  have hDecision : decide (encodeSignature (inferSignature stmt) = claim) = true := by
    simpa [checkEvidenceSignature, hDecode] using hCheck
  exact of_decide_eq_true hDecision

/-- Policy checking directly over untrusted production evidence. Evidence that
    does not decode to the formal core is rejected rather than approximated. -/
def checkEvidenceProtected
    (evidence : EvidenceStmt) (policy : List Rule) : Bool :=
  match decodeEvidenceStmt evidence with
  | none => false
  | some stmt => checkProtected stmt policy

/-- A successful evidence-level policy check yields a decoded protected core. -/
theorem checkEvidenceProtected_sound
    {evidence : EvidenceStmt} {policy : List Rule}
    (h : checkEvidenceProtected evidence policy = true) :
    ∃ stmt,
      decodeEvidenceStmt evidence = some stmt ∧
      Protected stmt policy := by
  cases hDecode : decodeEvidenceStmt evidence with
  | none =>
      simp [checkEvidenceProtected, hDecode] at h
  | some stmt =>
      have hCheck : checkProtected stmt policy = true := by
        simpa [checkEvidenceProtected, hDecode] using h
      have hProtected : Protected stmt policy := by
        exact policyAllowsBool_sound (inferSignature stmt) policy hCheck
      exact ⟨stmt, hDecode, hProtected⟩

/-- **Verified evidence boundary.** If production evidence decodes to a core
    statement, the evidence-level checker accepts its policy, and that decoded
    core executes, no runtime semantic effect can escape the policy. -/
theorem checkedEvidenceExecutionCannotEscape
    {evidence : EvidenceStmt} {stmt : CoreStmt}
    {runtime : List Effect} {policy : List Rule}
    (hDecode : decodeEvidenceStmt evidence = some stmt)
    (hExec : Executes stmt runtime)
    (hCheck : checkEvidenceProtected evidence policy = true) :
    ∀ effect, effect ∈ runtime →
      ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  have hCoreCheck : checkProtected stmt policy = true := by
    simpa [checkEvidenceProtected, hDecode] using hCheck
  exact checkedExecutionCannotEscape hExec hCoreCheck

end PatchFormal
