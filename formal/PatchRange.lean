import PatchSource

namespace PatchFormal

/-- Integer expression fragment for beta.9 range soundness. `scale n e` models
    multiplication by a non-negative integer constant. This deliberately covers
    common capability expressions such as `bonus * 2` without claiming that the
    production analyzer's full floating-point/division fragment is verified. -/
inductive RangeExpr where
  | lit (value : Int)
  | var (name : Name)
  | add (left right : RangeExpr)
  | sub (left right : RangeExpr)
  | neg (expr : RangeExpr)
  | scale (factor : Nat) (expr : RangeExpr)
  deriving Repr, DecidableEq

abbrev RangeEnv := Name → Option Interval
abbrev IntEnv := Name → Option Int

def InRange (value : Int) (range : Interval) : Prop :=
  range.lo ≤ value ∧ value ≤ range.hi

/-- Concrete environments respect the abstract ranges assigned to variables. -/
def EnvRespects (ranges : RangeEnv) (values : IntEnv) : Prop :=
  ∀ name range value,
    ranges name = some range →
    values name = some value →
    InRange value range

private def singletonRange (value : Int) : Interval :=
  { lo := value, hi := value, ordered := by omega }

private def addRange (left right : Interval) : Interval :=
  { lo := left.lo + right.lo
    hi := left.hi + right.hi
    ordered := by
      have hLeft := left.ordered
      have hRight := right.ordered
      omega }

private def subRange (left right : Interval) : Interval :=
  { lo := left.lo - right.hi
    hi := left.hi - right.lo
    ordered := by
      have hLeft := left.ordered
      have hRight := right.ordered
      omega }

private def negRange (range : Interval) : Interval :=
  { lo := -range.hi
    hi := -range.lo
    ordered := by
      have h := range.ordered
      omega }

private def scaleRange : Nat → Interval → Interval
  | 0, _ => singletonRange 0
  | n + 1, range => addRange range (scaleRange n range)

private def scaleValue : Nat → Int → Int
  | 0, _ => 0
  | n + 1, value => value + scaleValue n value

/-- Executable abstract interpreter for the machine-checked integer fragment. -/
def analyzeRange : RangeExpr → RangeEnv → Option Interval
  | .lit value, _ => some (singletonRange value)
  | .var name, ranges => ranges name
  | .add left right, ranges => do
      let leftRange ← analyzeRange left ranges
      let rightRange ← analyzeRange right ranges
      pure (addRange leftRange rightRange)
  | .sub left right, ranges => do
      let leftRange ← analyzeRange left ranges
      let rightRange ← analyzeRange right ranges
      pure (subRange leftRange rightRange)
  | .neg expr, ranges => do
      let range ← analyzeRange expr ranges
      pure (negRange range)
  | .scale factor expr, ranges => do
      let range ← analyzeRange expr ranges
      pure (scaleRange factor range)

/-- Concrete evaluator for the same fragment. -/
def evalRangeExpr : RangeExpr → IntEnv → Option Int
  | .lit value, _ => some value
  | .var name, values => values name
  | .add left right, values => do
      let leftValue ← evalRangeExpr left values
      let rightValue ← evalRangeExpr right values
      pure (leftValue + rightValue)
  | .sub left right, values => do
      let leftValue ← evalRangeExpr left values
      let rightValue ← evalRangeExpr right values
      pure (leftValue - rightValue)
  | .neg expr, values => do
      let value ← evalRangeExpr expr values
      pure (-value)
  | .scale factor expr, values => do
      let value ← evalRangeExpr expr values
      pure (scaleValue factor value)

private theorem inRange_add
    {leftValue rightValue : Int} {leftRange rightRange : Interval}
    (hLeft : InRange leftValue leftRange)
    (hRight : InRange rightValue rightRange) :
    InRange (leftValue + rightValue) (addRange leftRange rightRange) := by
  unfold InRange at hLeft hRight
  change leftRange.lo + rightRange.lo ≤ leftValue + rightValue ∧
    leftValue + rightValue ≤ leftRange.hi + rightRange.hi
  constructor <;> omega

private theorem inRange_sub
    {leftValue rightValue : Int} {leftRange rightRange : Interval}
    (hLeft : InRange leftValue leftRange)
    (hRight : InRange rightValue rightRange) :
    InRange (leftValue - rightValue) (subRange leftRange rightRange) := by
  unfold InRange at hLeft hRight
  change leftRange.lo - rightRange.hi ≤ leftValue - rightValue ∧
    leftValue - rightValue ≤ leftRange.hi - rightRange.lo
  constructor <;> omega

private theorem inRange_neg
    {value : Int} {range : Interval}
    (h : InRange value range) :
    InRange (-value) (negRange range) := by
  unfold InRange at h
  change -range.hi ≤ -value ∧ -value ≤ -range.lo
  constructor <;> omega

private theorem inRange_scale
    {value : Int} {range : Interval}
    (h : InRange value range) :
    ∀ factor, InRange (scaleValue factor value) (scaleRange factor range) := by
  intro factor
  induction factor with
  | zero =>
      simp [scaleValue, scaleRange, singletonRange, InRange]
  | succ n ih =>
      simpa [scaleValue, scaleRange] using inRange_add h ih

/-- Range-analysis soundness for the beta.9 formal expression fragment.

    If abstract analysis returns `range`, concrete evaluation returns `value`,
    and the concrete variable environment respects the declared abstract ranges,
    then the concrete result lies inside the inferred range. -/
theorem rangeAnalysisSound
    {expr : RangeExpr} {ranges : RangeEnv} {values : IntEnv}
    {range : Interval} {value : Int}
    (hEnv : EnvRespects ranges values)
    (hAnalyze : analyzeRange expr ranges = some range)
    (hEval : evalRangeExpr expr values = some value) :
    InRange value range := by
  induction expr generalizing range value with
  | lit literal =>
      have hRange : singletonRange literal = range := by
        simpa [analyzeRange] using hAnalyze
      have hValue : literal = value := by
        simpa [evalRangeExpr] using hEval
      subst range
      subst value
      simp [singletonRange, InRange]
  | var name =>
      exact hEnv name range value hAnalyze hEval
  | add left right ihLeft ihRight =>
      cases hLeftAnalyze : analyzeRange left ranges with
      | none =>
          simp [analyzeRange, hLeftAnalyze] at hAnalyze
      | some leftRange =>
          cases hRightAnalyze : analyzeRange right ranges with
          | none =>
              simp [analyzeRange, hLeftAnalyze, hRightAnalyze] at hAnalyze
          | some rightRange =>
              have hRange : addRange leftRange rightRange = range := by
                simpa [analyzeRange, hLeftAnalyze, hRightAnalyze] using hAnalyze
              cases hLeftEval : evalRangeExpr left values with
              | none =>
                  simp [evalRangeExpr, hLeftEval] at hEval
              | some leftValue =>
                  cases hRightEval : evalRangeExpr right values with
                  | none =>
                      simp [evalRangeExpr, hLeftEval, hRightEval] at hEval
                  | some rightValue =>
                      have hValue : leftValue + rightValue = value := by
                        simpa [evalRangeExpr, hLeftEval, hRightEval] using hEval
                      subst range
                      subst value
                      exact inRange_add
                        (ihLeft hLeftAnalyze hLeftEval)
                        (ihRight hRightAnalyze hRightEval)
  | sub left right ihLeft ihRight =>
      cases hLeftAnalyze : analyzeRange left ranges with
      | none =>
          simp [analyzeRange, hLeftAnalyze] at hAnalyze
      | some leftRange =>
          cases hRightAnalyze : analyzeRange right ranges with
          | none =>
              simp [analyzeRange, hLeftAnalyze, hRightAnalyze] at hAnalyze
          | some rightRange =>
              have hRange : subRange leftRange rightRange = range := by
                simpa [analyzeRange, hLeftAnalyze, hRightAnalyze] using hAnalyze
              cases hLeftEval : evalRangeExpr left values with
              | none =>
                  simp [evalRangeExpr, hLeftEval] at hEval
              | some leftValue =>
                  cases hRightEval : evalRangeExpr right values with
                  | none =>
                      simp [evalRangeExpr, hLeftEval, hRightEval] at hEval
                  | some rightValue =>
                      have hValue : leftValue - rightValue = value := by
                        simpa [evalRangeExpr, hLeftEval, hRightEval] using hEval
                      subst range
                      subst value
                      exact inRange_sub
                        (ihLeft hLeftAnalyze hLeftEval)
                        (ihRight hRightAnalyze hRightEval)
  | neg inner ih =>
      cases hInnerAnalyze : analyzeRange inner ranges with
      | none =>
          simp [analyzeRange, hInnerAnalyze] at hAnalyze
      | some innerRange =>
          have hRange : negRange innerRange = range := by
            simpa [analyzeRange, hInnerAnalyze] using hAnalyze
          cases hInnerEval : evalRangeExpr inner values with
          | none =>
              simp [evalRangeExpr, hInnerEval] at hEval
          | some innerValue =>
              have hValue : -innerValue = value := by
                simpa [evalRangeExpr, hInnerEval] using hEval
              subst range
              subst value
              exact inRange_neg (ih hInnerAnalyze hInnerEval)
  | scale factor inner ih =>
      cases hInnerAnalyze : analyzeRange inner ranges with
      | none =>
          simp [analyzeRange, hInnerAnalyze] at hAnalyze
      | some innerRange =>
          have hRange : scaleRange factor innerRange = range := by
            simpa [analyzeRange, hInnerAnalyze] using hAnalyze
          cases hInnerEval : evalRangeExpr inner values with
          | none =>
              simp [evalRangeExpr, hInnerEval] at hEval
          | some innerValue =>
              have hValue : scaleValue factor innerValue = value := by
                simpa [evalRangeExpr, hInnerEval] using hEval
              subst range
              subst value
              exact inRange_scale (ih hInnerAnalyze hInnerEval) factor

/-- Concrete beta.9 sanity theorem matching the motivating capability example. -/
theorem bonusTimesTwoWithinTen
    {bonus : Int}
    (hBonus : InRange bonus { lo := 0, hi := 5, ordered := by decide }) :
    InRange (scaleValue 2 bonus) { lo := 0, hi := 10, ordered := by decide } := by
  have hScaled := inRange_scale hBonus 2
  simpa [scaleValue, scaleRange, addRange, singletonRange, InRange] using hScaled

end PatchFormal
