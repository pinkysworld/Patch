import PatchCallSubstitution

namespace PatchFormal

/-- If an exact value lies inside beta.26's actual argument interval and that
    interval lies inside beta.25's declared parameter interval, then the exact
    value is admitted by the declared interval. -/
theorem valueFitsWithin
    {value : Int} {actual declared : Interval}
    (hValue : ValueFits value actual)
    (hWithin : Within actual declared) :
    ValueFits value declared := by
  rcases hValue with ⟨hActualLo, hActualHi⟩
  rcases hWithin with ⟨hDeclaredLo, hDeclaredHi⟩
  constructor <;> omega

/-- Pointwise bridge from exact concrete values through beta.25 abstract call
    intervals into the callee's declared parameter intervals. -/
theorem concreteArgsFitThroughAbstract :
    ∀ {values : List Int} {actual declared : List Interval},
      ConcreteArgsFit values actual →
      ArgsFit actual declared →
      ConcreteArgsFit values declared := by
  intro values actual declared hConcrete
  induction hConcrete generalizing declared with
  | nil =>
      intro hAbstract
      cases hAbstract
      exact ConcreteArgsFit.nil
  | @cons value interval values intervals hValue hRest ih =>
      intro hAbstract
      cases hAbstract with
      | cons hWithin hTail =>
          exact ConcreteArgsFit.cons (valueFitsWithin hValue hWithin) (ih hTail)

/-- Executable bridge used by production-generated beta.26 certificates. -/
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
