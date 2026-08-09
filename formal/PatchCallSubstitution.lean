import PatchCalls
import PatchRange

namespace PatchFormal

/-- Evaluate a positional list of formal integer argument expressions in the
    caller environment. The explicit match form keeps the executable checker
    small and the soundness proof transparent. -/
def evalCallArgs : List RangeExpr → IntEnv → Option (List Int)
  | [], _ => some []
  | expr :: rest, caller =>
      match evalRangeExpr expr caller, evalCallArgs rest caller with
      | some value, some values => some (value :: values)
      | _, _ => none

/-- Relational counterpart to exact caller-side argument evaluation. -/
inductive ArgsEvaluate (caller : IntEnv) : List RangeExpr → List Int → Prop where
  | nil : ArgsEvaluate caller [] []
  | cons {expr : RangeExpr} {rest : List RangeExpr} {value : Int} {values : List Int} :
      evalRangeExpr expr caller = some value →
      ArgsEvaluate caller rest values →
      ArgsEvaluate caller (expr :: rest) (value :: values)

theorem evalCallArgs_sound :
    ∀ {exprs : List RangeExpr} {caller : IntEnv} {values : List Int},
      evalCallArgs exprs caller = some values → ArgsEvaluate caller exprs values := by
  intro exprs
  induction exprs with
  | nil =>
      intro caller values h
      simp [evalCallArgs] at h
      subst values
      exact ArgsEvaluate.nil
  | cons expr rest ih =>
      intro caller values h
      simp only [evalCallArgs] at h
      cases hExpr : evalRangeExpr expr caller with
      | none => simp [hExpr] at h
      | some value =>
          cases hRest : evalCallArgs rest caller with
          | none => simp [hExpr, hRest] at h
          | some restValues =>
              simp [hExpr, hRest] at h
              subst values
              exact ArgsEvaluate.cons hExpr (ih hRest)

/-- Serializable exact parameter bindings. The established formal `IntEnv`
    remains the lookup function `Name → Option Int`; certificates use this list
    representation only as decidable proof-free data. -/
abbrev BindingList := List (Name × Int)

/-- Turn serializable bindings into the existing functional integer environment.
    The first occurrence wins. Production-certified parameter lists are expected
    to use distinct names; duplicate-name handling is not a beta.26 claim. -/
def envOfBindings : BindingList → IntEnv
  | [] => fun _ => none
  | (name, value) :: rest => fun query =>
      if query = name then some value else envOfBindings rest query

@[simp] theorem envOfBindings_head
    (name : Name) (value : Int) (rest : BindingList) :
    envOfBindings ((name, value) :: rest) name = some value := by
  simp [envOfBindings]

/-- Exact positional binding of evaluated arguments to callee parameter names.
    This constructs only a decidable local binding list; no persistent Patch
    state is written here. -/
def bindCallParams : List Name → List Int → Option BindingList
  | [], [] => some []
  | name :: names, value :: values =>
      match bindCallParams names values with
      | some rest => some ((name, value) :: rest)
      | none => none
  | _, _ => none

inductive ParamsBind : List Name → List Int → BindingList → Prop where
  | nil : ParamsBind [] [] []
  | cons {name : Name} {names : List Name} {value : Int} {values : List Int}
      {rest : BindingList} :
      ParamsBind names values rest →
      ParamsBind (name :: names) (value :: values) ((name, value) :: rest)

theorem bindCallParams_sound :
    ∀ {params : List Name} {values : List Int} {bound : BindingList},
      bindCallParams params values = some bound → ParamsBind params values bound := by
  intro params
  induction params with
  | nil =>
      intro values bound h
      cases values with
      | nil =>
          simp [bindCallParams] at h
          subst bound
          exact ParamsBind.nil
      | cons _ _ => simp [bindCallParams] at h
  | cons name names ih =>
      intro values bound h
      cases values with
      | nil => simp [bindCallParams] at h
      | cons value restValues =>
          simp only [bindCallParams] at h
          cases hRest : bindCallParams names restValues with
          | none => simp [hRest] at h
          | some rest =>
              simp [hRest] at h
              subst bound
              exact ParamsBind.cons (ih hRest)

/-- Concrete value membership in one integer interval. -/
def ValueFits (value : Int) (interval : Interval) : Prop :=
  interval.lo ≤ value ∧ value ≤ interval.hi

def valueFitsBool (value : Int) (interval : Interval) : Bool :=
  decide (interval.lo ≤ value) && decide (value ≤ interval.hi)

theorem valueFitsBool_sound {value : Int} {interval : Interval}
    (h : valueFitsBool value interval = true) : ValueFits value interval := by
  have hBoth :
      decide (interval.lo ≤ value) = true ∧
      decide (value ≤ interval.hi) = true := by
    simpa [valueFitsBool, Bool.and_eq_true] using h
  exact ⟨of_decide_eq_true hBoth.1, of_decide_eq_true hBoth.2⟩

/-- Exact positional values fit the callee's declared parameter intervals. -/
inductive ConcreteArgsFit : List Int → List Interval → Prop where
  | nil : ConcreteArgsFit [] []
  | cons {value : Int} {interval : Interval} {values : List Int} {intervals : List Interval} :
      ValueFits value interval →
      ConcreteArgsFit values intervals →
      ConcreteArgsFit (value :: values) (interval :: intervals)

def concreteArgsFitBool : List Int → List Interval → Bool
  | [], [] => true
  | value :: values, interval :: intervals =>
      valueFitsBool value interval && concreteArgsFitBool values intervals
  | _, _ => false

theorem concreteArgsFitBool_sound :
    ∀ {values : List Int} {intervals : List Interval},
      concreteArgsFitBool values intervals = true → ConcreteArgsFit values intervals := by
  intro values
  induction values with
  | nil =>
      intro intervals h
      cases intervals with
      | nil => exact ConcreteArgsFit.nil
      | cons _ _ => simp [concreteArgsFitBool] at h
  | cons value values ih =>
      intro intervals h
      cases intervals with
      | nil => simp [concreteArgsFitBool] at h
      | cons interval rest =>
          have hBoth :
              valueFitsBool value interval = true ∧
              concreteArgsFitBool values rest = true := by
            simpa [concreteArgsFitBool, Bool.and_eq_true] using h
          exact ConcreteArgsFit.cons (valueFitsBool_sound hBoth.1) (ih hBoth.2)

/-- One executable concrete call-binding step: evaluate caller expressions,
    validate the exact values against callee declarations, then bind them to
    callee-local names. The result remains serializable `BindingList` evidence;
    use `envOfBindings` when evaluating the callee formal semantics. -/
def concreteCallBinding
    (exprs : List RangeExpr) (caller : IntEnv)
    (params : List Name) (declared : List Interval) : Option BindingList :=
  match evalCallArgs exprs caller with
  | none => none
  | some values =>
      if concreteArgsFitBool values declared then
        bindCallParams params values
      else
        none

/-- Relational specification of a successful concrete call-binding step. -/
def ConcreteCallBindingSpec
    (exprs : List RangeExpr) (caller : IntEnv)
    (params : List Name) (declared : List Interval) (bound : BindingList) : Prop :=
  ∃ values,
    ArgsEvaluate caller exprs values ∧
    ConcreteArgsFit values declared ∧
    ParamsBind params values bound

theorem concreteCallBinding_sound
    {exprs : List RangeExpr} {caller : IntEnv}
    {params : List Name} {declared : List Interval} {bound : BindingList}
    (h : concreteCallBinding exprs caller params declared = some bound) :
    ConcreteCallBindingSpec exprs caller params declared bound := by
  unfold concreteCallBinding at h
  cases hEval : evalCallArgs exprs caller with
  | none => simp [hEval] at h
  | some values =>
      cases hFit : concreteArgsFitBool values declared with
      | false => simp [hEval, hFit] at h
      | true =>
          have hBind : bindCallParams params values = some bound := by
            simpa [hEval, hFit] using h
          exact ⟨values,
            evalCallArgs_sound hEval,
            concreteArgsFitBool_sound hFit,
            bindCallParams_sound hBind⟩

end PatchFormal
