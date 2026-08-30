import PatchFormal

namespace PatchFormal

/-- A singleton interval used when a concrete semantic Change determines one
    exact numeric magnitude. -/
def exactInterval (n : Int) : Interval :=
  { lo := n, hi := n, ordered := le_rfl }

/-- Extract the contract-level semantic effect from the deliberately small
    Change fragment shared by the current mutation machine and quantitative
    contract model. Multi-operation Changes and non-numeric collection/text
    operations remain outside this bridge and return `none`.

    `addInt`/`removeInt` preserve source-operation meaning while classifying a
    sign-determinate numeric delta as increase/decrease. `set` is represented
    as a non-quantitative set effect. -/
def effectOf (d : Change) : Option Effect :=
  match d.ops with
  | [.addInt n] =>
      if 0 ≤ n then
        some {
          target := d.target
          field := none
          kind := .increase
          amount := some (exactInterval n)
        }
      else
        some {
          target := d.target
          field := none
          kind := .decrease
          amount := some (exactInterval (-n))
        }
  | [.removeInt n] =>
      if 0 ≤ n then
        some {
          target := d.target
          field := none
          kind := .decrease
          amount := some (exactInterval n)
        }
      else
        some {
          target := d.target
          field := none
          kind := .increase
          amount := some (exactInterval (-n))
        }
  | [.set _] =>
      some {
        target := d.target
        field := none
        kind := .set
        amount := none
      }
  | _ => none

/-- Reconstruct the exact numeric magnitude from the committed before/after
    values for one directional contract kind. This is intentionally undefined
    for `set`/`clear` and non-integer state. -/
def actualAmountFor (d : Change) (kind : ChangeKind) : Option Interval :=
  match d.before, d.after, kind with
  | .int before, .int after, .increase =>
      some (exactInterval (after - before))
  | .int before, .int after, .decrease =>
      some (exactInterval (before - after))
  | _, _, _ => none

/-- The formal bridge between the mutation machine and the contract
    vocabulary. For a well-formed Change in the supported singleton numeric
    fragment, the amount carried by `effectOf` is exactly the amount obtained
    from the Change's committed before/after values.

    This theorem is deliberately scoped: it does not cover multi-operation
    Changes, fields, text/list operations, `clear`, or sign-indeterminate
    source ranges. -/
theorem effectOf_amount_matches_actual
    {d : Change} {e : Effect}
    (hWellFormed : WellFormed d)
    (hEffect : effectOf d = some e)
    (hQuantitative : e.kind = .increase ∨ e.kind = .decrease) :
    e.amount = actualAmountFor d e.kind := by
  rcases hWellFormed with ⟨hApply, _⟩
  cases hOps : d.ops with
  | nil =>
      simp [effectOf, hOps] at hEffect
  | cons op rest =>
      cases hRest : rest with
      | cons next tail =>
          simp [effectOf, hOps, hRest] at hEffect
      | nil =>
          cases op with
          | set value =>
              simp [effectOf, hOps, hRest] at hEffect
              subst e
              simp at hQuantitative
          | addInt n =>
              by_cases hNonneg : 0 ≤ n
              · cases hBefore : d.before <;> cases hAfter : d.after <;>
                  simp_all [effectOf, actualAmountFor, exactInterval,
                    applyOps, applyOp, hNonneg]
              · cases hBefore : d.before <;> cases hAfter : d.after <;>
                  simp_all [effectOf, actualAmountFor, exactInterval,
                    applyOps, applyOp, hNonneg]
          | removeInt n =>
              by_cases hNonneg : 0 ≤ n
              · cases hBefore : d.before <;> cases hAfter : d.after <;>
                  simp_all [effectOf, actualAmountFor, exactInterval,
                    applyOps, applyOp, hNonneg]
              · cases hBefore : d.before <;> cases hAfter : d.after <;>
                  simp_all [effectOf, actualAmountFor, exactInterval,
                    applyOps, applyOp, hNonneg]

/-- **Semantic Change Contract bridge.** If a well-formed semantic Change is
    translated by `effectOf`, the resulting directional effect is allowed by a
    bounded rule, and that rule carries bound `permitted`, then the *actual
    committed before/after magnitude* lies within `permitted`.

    Unlike the earlier list-composition corollaries, this theorem mentions the
    mutation-machine `Change`, the contract-level `Effect`, and the policy
    `Rule` in one statement. -/
theorem allowedEffectOf_respects_actual_bound
    {d : Change} {e : Effect} {r : Rule} {permitted : Interval}
    (hWellFormed : WellFormed d)
    (hEffect : effectOf d = some e)
    (hQuantitative : e.kind = .increase ∨ e.kind = .decrease)
    (hAllows : Allows r e)
    (hRuleAmount : r.amount = some permitted) :
    ∃ actual,
      actualAmountFor d e.kind = some actual ∧
      Within actual permitted := by
  have hAmountEq := effectOf_amount_matches_actual hWellFormed hEffect hQuantitative
  rcases hAllows with ⟨_, _, _, hAmountAllows⟩
  cases hActual : actualAmountFor d e.kind with
  | none =>
      rw [hActual] at hAmountEq
      cases e.amount <;> simp_all
  | some actual =>
      refine ⟨actual, hActual, ?_⟩
      have hEffectAmount : e.amount = some actual := by
        simpa [hActual] using hAmountEq
      simpa [hEffectAmount, hRuleAmount] using hAmountAllows

end PatchFormal
