import PatchFormal

namespace PatchFormal

/-- A small executable control-flow core used to connect static Change
    Signatures to runtime changes. `emit` represents a normalized persistent
    semantic change after source lowering. -/
inductive CoreStmt where
  | skip
  | emit (effect : Effect)
  | seq (first second : CoreStmt)
  | branch (thenBranch elseBranch : CoreStmt)
  | repeat (count : Nat) (body : CoreStmt)
  deriving Repr

/-- The inferred Change Signature is an over-approximation: both branches are
    included, while repeating a body does not add new *kinds* of effects. -/
def inferSignature : CoreStmt → List Effect
  | .skip => []
  | .emit effect => [effect]
  | .seq first second => inferSignature first ++ inferSignature second
  | .branch thenBranch elseBranch =>
      inferSignature thenBranch ++ inferSignature elseBranch
  | .repeat _ body => inferSignature body

/-- Big-step trace semantics for the formal core. The trace contains exactly
    the semantic persistent effects committed by one execution. -/
inductive Executes : CoreStmt → List Effect → Prop where
  | skip : Executes .skip []
  | emit {effect : Effect} : Executes (.emit effect) [effect]
  | seq {first second : CoreStmt} {left right : List Effect} :
      Executes first left →
      Executes second right →
      Executes (.seq first second) (left ++ right)
  | branchThen {thenBranch elseBranch : CoreStmt} {trace : List Effect} :
      Executes thenBranch trace →
      Executes (.branch thenBranch elseBranch) trace
  | branchElse {thenBranch elseBranch : CoreStmt} {trace : List Effect} :
      Executes elseBranch trace →
      Executes (.branch thenBranch elseBranch) trace
  | repeatZero {body : CoreStmt} : Executes (.repeat 0 body) []
  | repeatSucc {n : Nat} {body : CoreStmt}
      {first rest : List Effect} :
      Executes body first →
      Executes (.repeat n body) rest →
      Executes (.repeat (n + 1) body) (first ++ rest)

/-- **Change Signature Soundness.** Every semantic change emitted by an
    execution of the formal core appears in the statically inferred Change
    Signature. The signature may contain effects from untaken branches, but it
    cannot miss a runtime effect. -/
theorem changeSignatureSoundness
    {stmt : CoreStmt} {runtime : List Effect}
    (hExec : Executes stmt runtime) :
    SignatureCovers runtime (inferSignature stmt) := by
  induction hExec with
  | skip =>
      intro effect hMem
      simp at hMem
  | emit =>
      intro effect hMem
      simpa [inferSignature] using hMem
  | seq hFirst hSecond ihFirst ihSecond =>
      intro effect hMem
      rcases List.mem_append.mp hMem with hLeft | hRight
      · exact List.mem_append.mpr (Or.inl (ihFirst effect hLeft))
      · exact List.mem_append.mpr (Or.inr (ihSecond effect hRight))
  | branchThen hThen ihThen =>
      intro effect hMem
      exact List.mem_append.mpr (Or.inl (ihThen effect hMem))
  | branchElse hElse ihElse =>
      intro effect hMem
      exact List.mem_append.mpr (Or.inr (ihElse effect hMem))
  | repeatZero =>
      intro effect hMem
      simp at hMem
  | repeatSucc hBody hRest ihBody ihRest =>
      intro effect hMem
      rcases List.mem_append.mp hMem with hFirst | hLater
      · exact ihBody effect hFirst
      · have hCovered := ihRest effect hLater
        simpa [inferSignature] using hCovered

/-- A protected core statement is one whose inferred signature is admitted by
    the declared semantic Change Capability policy. -/
def Protected (stmt : CoreStmt) (policy : List Rule) : Prop :=
  PolicyAllows (inferSignature stmt) policy

/-- **End-to-end Capability Soundness for the formal core.** Unlike the earlier
    composition theorem, this result does not take `SignatureCovers` as an
    assumption. It derives signature coverage from the execution semantics and
    the static inference function, then composes it with policy checking. -/
theorem endToEndCapabilitySoundness
    {stmt : CoreStmt} {runtime : List Effect} {policy : List Rule}
    (hExec : Executes stmt runtime)
    (hProtected : Protected stmt policy) :
    ∀ effect, effect ∈ runtime →
      ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  exact capabilitySoundness (changeSignatureSoundness hExec) hProtected

/-- Set-inclusion-shaped corollary matching the paper statement
    RuntimeChanges(stmt) ⊆ Signature(stmt) ⊆ Capability(stmt). -/
theorem protectedExecutionCannotEscape
    {stmt : CoreStmt} {runtime : List Effect} {policy : List Rule}
    (hExec : Executes stmt runtime)
    (hProtected : Protected stmt policy)
    {effect : Effect} (hRuntime : effect ∈ runtime) :
    ∃ rule, rule ∈ policy ∧ Allows rule effect := by
  exact endToEndCapabilitySoundness hExec hProtected effect hRuntime

end PatchFormal
