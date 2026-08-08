import PatchCallSubstitution

namespace PatchFormal

/-- A concrete value that lies in an actual argument interval also lies in a
    declared parameter interval when beta.25's `Within` relation holds. -/
theorem valueFitsWithin
    {value : Int} {actual declared : Interval}
    (hValue : ValueFits value actual)
    (hWithin : Within actual declared) :
    ValueFits value declared := by
  rcases hValue with ⟨hActualLo, hActualHi⟩
  rcases hWithin with ⟨hDeclaredLo, hDeclaredHi⟩
  exact ⟨le_trans hDeclaredLo hActualLo, le_trans hActualHi hDeclaredHi⟩

/-- Pointwise bridge from exact concrete values through beta.25 abstract
    argument intervals into the callee's declared parameter intervals. -/
theorem concreteArgsFitThroughAbstract :
    ∀ {values : List Int} {actual declared : List Interval},
      ConcreteArgsFit values actual →
      ArgsFit actual declared →
      ConcreteArgsFit values declared := by
  intro values actual declared hConcrete hAbstract
  induction hConcrete with
  | nil =>
      cases hAbstract
      exact ConcreteArgsFit.nil
  | @cons value interval values intervals hValue hRest ih =>
      cases hAbstract with
      | cons hWithin hTail =>
          exact ConcreteArgsFit.cons (valueFitsWithin hValue hWithin) (ih hTail)

/-- Executable beta.26 bridge: the exact values must fit the production-recorded
    abstract call intervals and beta.25's abstract intervals must fit the
    callee's declared parameter intervals. -/
def concreteThroughAbstractBool
    (values : List Int) (actual declared : List Interval) : Bool :=
  concreteArgsFitBool values actual && argsFitBool actual declared

theorem concreteThroughAbstractBool_sound
    {values : List Int} {actual declared : List Interval}
    (h : concreteThroughAbstractBool values actual declared = true) :
    ConcreteArgsFit values declared := by
  have hBoth :
      concreteArgsFitBool values actual = true ∧
      argsFitBool actual declared = true := by
    simpa [concreteThroughAbstractBool, Bool.and_eq_true] using h
  exact concreteArgsFitThroughAbstract
    (concreteArgsFitBool_sound hBoth.1)
    (argsFitBool_sound hBoth.2)

end PatchFormal
