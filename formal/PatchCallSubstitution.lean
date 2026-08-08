import PatchCalls
import PatchRange

namespace PatchFormal

/-- Concrete evaluation of a positional list of formal integer expressions in
    the caller environment. -/
def evalCallArgs (exprs : List RangeExpr) (caller : IntEnv) : Option (List Int) :=
  match exprs with
  | [] => some []
  | expr :: rest => do
      let value ← evalRangeExpr expr caller
      let values ← evalCallArgs rest caller
      pure (value :: values)

/-- Relational counterpart to `evalCallArgs`. -/
inductive ArgsEvaluate (caller : IntEnv) : List RangeExpr → List Int → Prop where
  | nil : ArgsEvaluate caller [] []
  | cons {expr : RangeExpr} {rest : List RangeExpr} {value : Int} {values : List Int} :
      evalRangeExpr expr caller = some value →
      ArgsEvaluate caller rest values →
      ArgsEvaluate caller (expr :: rest) (value :: values)

/-- Successful executable argument evaluation yields the relational witness. -/
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

/-- Exact positional parameter binding. No persistent state is involved: this
    constructs the local integer environment used by the callee semantics. -/
def bindCallParams : List Name → List Int → Option IntEnv
  | [], [] => some []
  | name :: names, value :: values => do
      let rest ← bindCallParams names values
      pure ((name, value) :: rest)
  | _, _ => none

/-- Relational witness for exact positional parameter binding. -/
inductive ParamsBind : List Name → List Int → IntEnv → Prop where
  | nil : ParamsBind [] [] []
  | cons {name : Name} {names : List Name} {value : Int} {values : List Int} {rest : IntEnv} :
      ParamsBind names values rest →
      ParamsBind (name :: names) (value :: values) ((name, value) :: rest)

theorem bindCallParams_sound :
    ∀ {params : List Name} {values : List Int} {bound : IntEnv},
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

/-- A concrete integer lies inside an interval. -/
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

/-- Pointwise concrete-value compatibility with declared parameter intervals. -/
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

/-- One executable concrete call-binding step. It evaluates caller expressions,
    checks the exact values against callee parameter intervals, then constructs
    the callee-local environment by positional binding. -/
def concreteCallBinding
    (exprs : List RangeExpr) (caller : IntEnv)
    (params : List Name) (declared : List Interval) : Option IntEnv := do
  let values ← evalCallArgs exprs caller
  if concreteArgsFitBool values declared then
    bindCallParams params values
  else
    none

/-- Relational specification for a successful concrete call binding. -/
def ConcreteCallBindingSpec
    (exprs : List RangeExpr) (caller : IntEnv)
    (params : List Name) (declared : List Interval) (bound : IntEnv) : Prop :=
  ∃ values,
    ArgsEvaluate caller exprs values ∧
    ConcreteArgsFit values declared ∧
    ParamsBind params values bound

/-- Successful concrete binding is sound with respect to expression evaluation,
    declared parameter intervals and exact positional parameter binding. -/
theorem concreteCallBinding_sound
    {exprs : List RangeExpr} {caller : IntEnv}
    {params : List Name} {declared : List Interval} {bound : IntEnv}
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
