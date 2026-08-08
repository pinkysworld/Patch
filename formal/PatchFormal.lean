import Std

namespace PatchFormal

abbrev Name := String

inductive Value where
  | int : Int → Value
  | bool : Bool → Value
  | text : String → Value
  deriving Repr, DecidableEq

inductive Op where
  | set : Value → Op
  | addInt : Int → Op
  | removeInt : Int → Op
  deriving Repr, DecidableEq

def applyOp : Op → Value → Option Value
  | .set v, _ => some v
  | .addInt n, .int m => some (.int (m + n))
  | .removeInt n, .int m => some (.int (m - n))
  | _, _ => none

def applyOps : List Op → Value → Option Value
  | [], v => some v
  | op :: ops, v =>
      match applyOp op v with
      | some v' => applyOps ops v'
      | none => none

structure Change where
  target : Name
  baseVersion : Nat
  newVersion : Nat
  before : Value
  ops : List Op
  after : Value
  deriving Repr, DecidableEq

def WellFormed (d : Change) : Prop :=
  applyOps d.ops d.before = some d.after ∧
  d.newVersion = d.baseVersion + 1

abbrev Store := Name → Option Value
abbrev Versions := Name → Nat

structure Machine where
  store : Store
  versions : Versions
  history : List Change

def updateStore (s : Store) (name : Name) (value : Value) : Store :=
  fun x => if x = name then some value else s x

def updateVersion (v : Versions) (name : Name) (version : Nat) : Versions :=
  fun x => if x = name then version else v x

def commitUnchecked (d : Change) (m : Machine) : Machine :=
  { store := updateStore m.store d.target d.after
    versions := updateVersion m.versions d.target d.newVersion
    history := m.history ++ [d] }

inductive Step : Machine → Machine → Prop where
  | change {m : Machine} {d : Change}
      (beforeMatches : m.store d.target = some d.before)
      (versionMatches : m.versions d.target = d.baseVersion)
      (wellFormed : WellFormed d) :
      Step m (commitUnchecked d m)

/-- Every semantic machine step is witnessed by a well-formed Change and the
    target transition is produced by the single commit path. -/
theorem stateChangeFactorization {m m' : Machine} (h : Step m m') :
    ∃ d : Change,
      WellFormed d ∧
      m' = commitUnchecked d m ∧
      m'.store d.target = some d.after ∧
      m'.history = m.history ++ [d] := by
  cases h with
  | change beforeMatches versionMatches wellFormed =>
      refine ⟨_, wellFormed, rfl, ?_, ?_⟩
      · simp [commitUnchecked, updateStore]
      · simp [commitUnchecked]

/-- Mutation transparency follows immediately from factorization: a step that
    changes state appends the Change that describes the transition. -/
theorem mutationTransparency {m m' : Machine} (h : Step m m') :
    ∃ d : Change, WellFormed d ∧ d ∈ m'.history := by
  obtain ⟨d, hWF, hEq, _, hHist⟩ := stateChangeFactorization h
  refine ⟨d, hWF, ?_⟩
  rw [hHist]
  simp

structure Interval where
  lo : Int
  hi : Int
  ordered : lo ≤ hi
  deriving Repr, DecidableEq

def Within (inner outer : Interval) : Prop :=
  outer.lo ≤ inner.lo ∧ inner.hi ≤ outer.hi

/-- Interval containment composes. This is the small mathematical fact used by
    bounded-parameter reasoning: if an expression range is inside a parameter
    range and that parameter range is inside a capability bound, the expression
    is inside the capability bound. -/
theorem withinTrans {a b c : Interval}
    (hab : Within a b) (hbc : Within b c) : Within a c := by
  constructor
  · exact Int.le_trans hbc.1 hab.1
  · exact Int.le_trans hab.2 hbc.2

inductive ChangeKind where
  | increase
  | decrease
  | set
  | clear
  deriving Repr, DecidableEq

structure Effect where
  target : Name
  field : Option Name
  kind : ChangeKind
  amount : Option Interval
  deriving Repr

structure Rule where
  target : Name
  field : Option Name
  kind : ChangeKind
  amount : Option Interval
  deriving Repr

/-- Relational semantic authority judgment. The executable checker is defined
    separately in `PatchChecker.lean` and proved sound with respect to this
    relation. -/
def Allows (r : Rule) (e : Effect) : Prop :=
  r.target = e.target ∧
  r.field = e.field ∧
  r.kind = e.kind ∧
  match e.amount, r.amount with
  | none, _ => True
  | some _, none => True
  | some actual, some permitted => Within actual permitted

def SignatureCovers (runtime signature : List Effect) : Prop :=
  ∀ e, e ∈ runtime → e ∈ signature

def PolicyAllows (signature : List Effect) (policy : List Rule) : Prop :=
  ∀ e, e ∈ signature → ∃ r, r ∈ policy ∧ Allows r e

/-- Core Semantic Change Contract theorem. If inferred signatures cover all
    runtime changes, and every inferred signature effect is admitted by the
    capability policy, every runtime change is admitted by the policy. -/
theorem capabilitySoundness
    {runtime signature : List Effect} {policy : List Rule}
    (hSignature : SignatureCovers runtime signature)
    (hPolicy : PolicyAllows signature policy) :
    ∀ e, e ∈ runtime → ∃ r, r ∈ policy ∧ Allows r e := by
  intro e hRuntime
  exact hPolicy e (hSignature e hRuntime)

/-- A direct corollary phrased as set inclusion, matching the paper notation
    RuntimeChanges(f) ⊆ Sig(f) ⊆ Cap(f). -/
theorem semanticChangeContractComposition
    {runtime signature : List Effect} {policy : List Rule}
    (hSignature : SignatureCovers runtime signature)
    (hPolicy : PolicyAllows signature policy)
    {e : Effect} (hRuntime : e ∈ runtime) :
    ∃ r, r ∈ policy ∧ Allows r e := by
  exact capabilitySoundness hSignature hPolicy e hRuntime

end PatchFormal
