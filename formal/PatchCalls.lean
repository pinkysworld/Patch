import PatchChecker

namespace PatchFormal

/-- Beta.25 call-aware effect core. Call arguments are represented by the
    statically established integer intervals from the production formal-range
    fragment; concrete value substitution remains a later refinement. -/
inductive CallStmt where
  | skip
  | emit (effect : Effect)
  | seq (first second : CallStmt)
  | branch (thenBranch elseBranch : CallStmt)
  | repeat (count : Nat) (body : CallStmt)
  | call (name : Name) (args : List Interval)
  deriving Repr

structure RecipeDef where
  params : List Interval
  rank : Nat
  signature : List Effect
  body : CallStmt
  deriving Repr

abbrev RecipeEnv := List (Name × RecipeDef)

/-- Lookup is intentionally simple and executable. The production artifact
    rejects duplicate recipe names before certification. -/
def lookupRecipe : RecipeEnv → Name → Option RecipeDef
  | [], _ => none
  | (name, recipe) :: rest, wanted =>
      if name = wanted then some recipe else lookupRecipe rest wanted

/-- Pairwise argument/parameter interval compatibility. -/
inductive ArgsFit : List Interval → List Interval → Prop where
  | nil : ArgsFit [] []
  | cons {actual expected : Interval} {actuals expecteds : List Interval} :
      Within actual expected →
      ArgsFit actuals expecteds →
      ArgsFit (actual :: actuals) (expected :: expecteds)

/-- Executable argument-range checker. -/
def argsFitBool : List Interval → List Interval → Bool
  | [], [] => true
  | actual :: actuals, expected :: expecteds =>
      withinBool actual expected && argsFitBool actuals expecteds
  | _, _ => false

theorem argsFitBool_sound :
    ∀ {actual expected : List Interval},
      argsFitBool actual expected = true → ArgsFit actual expected := by
  intro actual
  induction actual with
  | nil =>
      intro expected h
      cases expected with
      | nil => exact ArgsFit.nil
      | cons _ _ => simp [argsFitBool] at h
  | cons first rest ih =>
      intro expected h
      cases expected with
      | nil => simp [argsFitBool] at h
      | cons wanted tail =>
          have hBoth :
              withinBool first wanted = true ∧
              argsFitBool rest tail = true := by
            simpa [argsFitBool, Bool.and_eq_true] using h
          exact ArgsFit.cons (withinBool_sound hBoth.1) (ih hBoth.2)

/-- Equality check for intervals, avoiding any reliance on proof fields. -/
def intervalEqBool (left right : Interval) : Bool :=
  decide (left.lo = right.lo) && decide (left.hi = right.hi)

theorem intervalEqBool_sound {left right : Interval}
    (h : intervalEqBool left right = true) : left = right := by
  rcases left with ⟨leftLo, leftHi, leftOrdered⟩
  rcases right with ⟨rightLo, rightHi, rightOrdered⟩
  have hBoth :
      decide (leftLo = rightLo) = true ∧
      decide (leftHi = rightHi) = true := by
    simpa [intervalEqBool, Bool.and_eq_true] using h
  have hLo : leftLo = rightLo := of_decide_eq_true hBoth.1
  have hHi : leftHi = rightHi := of_decide_eq_true hBoth.2
  subst rightLo
  subst rightHi
  rfl

/-- Equality check for optional quantitative intervals. -/
def optionIntervalEqBool : Option Interval → Option Interval → Bool
  | none, none => true
  | some left, some right => intervalEqBool left right
  | _, _ => false

theorem optionIntervalEqBool_sound
    {left right : Option Interval}
    (h : optionIntervalEqBool left right = true) : left = right := by
  cases left with
  | none =>
      cases right with
      | none => rfl
      | some _ => simp [optionIntervalEqBool] at h
  | some leftInterval =>
      cases right with
      | none => simp [optionIntervalEqBool] at h
      | some rightInterval =>
          have hEq : leftInterval = rightInterval :=
            intervalEqBool_sound (by simpa [optionIntervalEqBool] using h)
          simp [hEq]

/-- Exact semantic-effect equality as an executable Bool. -/
def effectEqBool (left right : Effect) : Bool :=
  if left.target = right.target then
    if left.field = right.field then
      if left.kind = right.kind then
        optionIntervalEqBool left.amount right.amount
      else false
    else false
  else false

theorem effectEqBool_sound {left right : Effect}
    (h : effectEqBool left right = true) : left = right := by
  by_cases hTarget : left.target = right.target
  · by_cases hField : left.field = right.field
    · by_cases hKind : left.kind = right.kind
      · have hAmount : optionIntervalEqBool left.amount right.amount = true := by
          simpa [effectEqBool, hTarget, hField, hKind] using h
        have hAmountEq : left.amount = right.amount := optionIntervalEqBool_sound hAmount
        cases left
        cases right
        simp_all
      · simp [effectEqBool, hTarget, hField, hKind] at h
    · simp [effectEqBool, hTarget, hField] at h
  · simp [effectEqBool, hTarget] at h

/-- Search one signature for an exactly represented semantic effect. -/
def effectMemberBool (effect : Effect) : List Effect → Bool
  | [] => false
  | first :: rest => effectEqBool effect first || effectMemberBool effect rest

theorem effectMemberBool_sound :
    ∀ {signature : List Effect} {effect : Effect},
      effectMemberBool effect signature = true → effect ∈ signature := by
  intro signature
  induction signature with
  | nil =>
      intro effect h
      simp [effectMemberBool] at h
  | cons first rest ih =>
      intro effect h
      cases hEq : effectEqBool effect first with
      | true =>
          have hSame : effect = first := effectEqBool_sound hEq
          simp [hSame]
      | false =>
          have hRest : effectMemberBool effect rest = true := by
            simpa [effectMemberBool, hEq] using h
          exact List.mem_cons.mpr (Or.inr (ih hRest))

/-- Executable list containment for semantic signatures. -/
def signatureCoversBool : List Effect → List Effect → Bool
  | [], _ => true
  | effect :: rest, outer =>
      effectMemberBool effect outer && signatureCoversBool rest outer

theorem signatureCoversBool_sound :
    ∀ {inner outer : List Effect},
      signatureCoversBool inner outer = true → SignatureCovers inner outer := by
  intro inner
  induction inner with
  | nil =>
      intro outer h effect hMem
      simp at hMem
  | cons first rest ih =>
      intro outer h effect hMem
      have hBoth :
          effectMemberBool first outer = true ∧
          signatureCoversBool rest outer = true := by
        simpa [signatureCoversBool, Bool.and_eq_true] using h
      rcases List.mem_cons.mp hMem with hFirst | hRest
      · subst effect
        exact effectMemberBool_sound hBoth.1
      · exact ih hBoth.2 effect hRest

theorem signatureCoversTrans
    {first second third : List Effect}
    (hFirst : SignatureCovers first second)
    (hSecond : SignatureCovers second third) :
    SignatureCovers first third := by
  intro effect hMem
  exact hSecond effect (hFirst effect hMem)

/-- Local compositional obligations for one recipe body. A call imports the
    callee signature abstractly; execution of the callee body is justified by
    the environment-wide checker and rank-decreasing CallExec relation. -/
def BodyComposes (env : RecipeEnv) (rank : Nat)
    (signature : List Effect) : CallStmt → Prop
  | .skip => True
  | .emit effect => effect ∈ signature
  | .seq first second =>
      BodyComposes env rank signature first ∧
      BodyComposes env rank signature second
  | .branch thenBranch elseBranch =>
      BodyComposes env rank signature thenBranch ∧
      BodyComposes env rank signature elseBranch
  | .repeat _ body => BodyComposes env rank signature body
  | .call name args =>
      ∃ callee,
        lookupRecipe env name = some callee ∧
        callee.rank < rank ∧
        ArgsFit args callee.params ∧
        SignatureCovers callee.signature signature

/-- Executable shallow checker for one recipe body. -/
def checkCallStmt (env : RecipeEnv) (rank : Nat)
    (signature : List Effect) : CallStmt → Bool
  | .skip => true
  | .emit effect => effectMemberBool effect signature
  | .seq first second =>
      checkCallStmt env rank signature first &&
      checkCallStmt env rank signature second
  | .branch thenBranch elseBranch =>
      checkCallStmt env rank signature thenBranch &&
      checkCallStmt env rank signature elseBranch
  | .repeat _ body => checkCallStmt env rank signature body
  | .call name args =>
      match lookupRecipe env name with
      | none => false
      | some callee =>
          decide (callee.rank < rank) &&
          argsFitBool args callee.params &&
          signatureCoversBool callee.signature signature

theorem checkCallStmt_sound :
    ∀ {stmt : CallStmt} {env : RecipeEnv} {rank : Nat} {signature : List Effect},
      checkCallStmt env rank signature stmt = true →
      BodyComposes env rank signature stmt := by
  intro stmt
  induction stmt with
  | skip =>
      intro env rank signature h
      simp [BodyComposes]
  | emit effect =>
      intro env rank signature h
      exact effectMemberBool_sound (by simpa [checkCallStmt] using h)
  | seq first second ihFirst ihSecond =>
      intro env rank signature h
      have hBoth :
          checkCallStmt env rank signature first = true ∧
          checkCallStmt env rank signature second = true := by
        simpa [checkCallStmt, Bool.and_eq_true] using h
      exact ⟨ihFirst hBoth.1, ihSecond hBoth.2⟩
  | branch thenBranch elseBranch ihThen ihElse =>
      intro env rank signature h
      have hBoth :
          checkCallStmt env rank signature thenBranch = true ∧
          checkCallStmt env rank signature elseBranch = true := by
        simpa [checkCallStmt, Bool.and_eq_true] using h
      exact ⟨ihThen hBoth.1, ihElse hBoth.2⟩
  | «repeat» count body ih =>
      intro env rank signature h
      exact ih (by simpa [checkCallStmt] using h)
  | call name args =>
      intro env rank signature h
      cases hLookup : lookupRecipe env name with
      | none =>
          simp [checkCallStmt, hLookup] at h
      | some callee =>
          have hAll :
              decide (callee.rank < rank) = true ∧
              argsFitBool args callee.params = true ∧
              signatureCoversBool callee.signature signature = true := by
            simpa [checkCallStmt, hLookup, Bool.and_eq_true, and_assoc] using h
          exact ⟨callee, hLookup,
            of_decide_eq_true hAll.1,
            argsFitBool_sound hAll.2.1,
            signatureCoversBool_sound hAll.2.2⟩

/-- Environment-wide executable checker: every finite recipe definition must
    satisfy its local compositional obligations against the same environment. -/
def checkRecipeEntries (all : RecipeEnv) : RecipeEnv → Bool
  | [] => true
  | (_, recipe) :: rest =>
      checkCallStmt all recipe.rank recipe.signature recipe.body &&
      checkRecipeEntries all rest

def checkRecipeEnv (env : RecipeEnv) : Bool := checkRecipeEntries env env

theorem checkRecipeEntries_mem_sound :
    ∀ {all entries : RecipeEnv},
      checkRecipeEntries all entries = true →
      ∀ {name : Name} {recipe : RecipeDef},
        (name, recipe) ∈ entries →
        checkCallStmt all recipe.rank recipe.signature recipe.body = true := by
  intro all entries
  induction entries with
  | nil =>
      intro h name recipe hMem
      simp at hMem
  | cons head rest ih =>
      rcases head with ⟨headName, headRecipe⟩
      intro h name recipe hMem
      have hBoth :
          checkCallStmt all headRecipe.rank headRecipe.signature headRecipe.body = true ∧
          checkRecipeEntries all rest = true := by
        simpa [checkRecipeEntries, Bool.and_eq_true] using h
      rcases List.mem_cons.mp hMem with hHead | hRest
      · cases hHead
        exact hBoth.1
      · exact ih hBoth.2 hRest

theorem lookupRecipe_mem :
    ∀ {env : RecipeEnv} {name : Name} {recipe : RecipeDef},
      lookupRecipe env name = some recipe →
      (name, recipe) ∈ env := by
  intro env
  induction env with
  | nil =>
      intro name recipe h
      simp [lookupRecipe] at h
  | cons head rest ih =>
      rcases head with ⟨headName, headRecipe⟩
      intro name recipe h
      by_cases hName : headName = name
      · have hRecipe : headRecipe = recipe := by
          simpa [lookupRecipe, hName] using h
        subst headName
        subst recipe
        simp
      · have hRest : lookupRecipe rest name = some recipe := by
          simpa [lookupRecipe, hName] using h
        exact List.mem_cons.mpr (Or.inr (ih hRest))

/-- Relational environment invariant established by the executable checker. -/
def EnvironmentChecked (env : RecipeEnv) : Prop :=
  ∀ name recipe,
    lookupRecipe env name = some recipe →
    BodyComposes env recipe.rank recipe.signature recipe.body

theorem checkRecipeEnv_sound {env : RecipeEnv}
    (h : checkRecipeEnv env = true) : EnvironmentChecked env := by
  intro name recipe hLookup
  have hMem : (name, recipe) ∈ env := lookupRecipe_mem hLookup
  have hChecked :
      checkCallStmt env recipe.rank recipe.signature recipe.body = true :=
    checkRecipeEntries_mem_sound (by simpa [checkRecipeEnv] using h) hMem
  exact checkCallStmt_sound hChecked

/-- Big-step execution with calls. The rank premise makes recursive/cyclic
    executions unavailable in the certified fragment. -/
inductive CallExec (env : RecipeEnv) : Nat → CallStmt → List Effect → Prop where
  | skip {rank : Nat} : CallExec env rank .skip []
  | emit {rank : Nat} {effect : Effect} : CallExec env rank (.emit effect) [effect]
  | seq {rank : Nat} {first second : CallStmt} {left right : List Effect} :
      CallExec env rank first left →
      CallExec env rank second right →
      CallExec env rank (.seq first second) (left ++ right)
  | branchThen {rank : Nat} {thenBranch elseBranch : CallStmt} {trace : List Effect} :
      CallExec env rank thenBranch trace →
      CallExec env rank (.branch thenBranch elseBranch) trace
  | branchElse {rank : Nat} {thenBranch elseBranch : CallStmt} {trace : List Effect} :
      CallExec env rank elseBranch trace →
      CallExec env rank (.branch thenBranch elseBranch) trace
  | repeatZero {rank : Nat} {body : CallStmt} :
      CallExec env rank (.repeat 0 body) []
  | repeatSucc {rank n : Nat} {body : CallStmt} {first rest : List Effect} :
      CallExec env rank body first →
      CallExec env rank (.repeat n body) rest →
      CallExec env rank (.repeat (n + 1) body) (first ++ rest)
  | call {rank : Nat} {name : Name} {args : List Interval}
      {callee : RecipeDef} {trace : List Effect} :
      lookupRecipe env name = some callee →
      callee.rank < rank →
      ArgsFit args callee.params →
      CallExec env callee.rank callee.body trace →
      CallExec env rank (.call name args) trace

/-- **Call-aware Change Signature Soundness.** If the finite recipe environment
    passes the compositional obligations, every effect produced through an
    arbitrary finite rank-decreasing call execution remains inside the caller's
    declared/inferred semantic signature. -/
theorem callSignatureSoundness
    {env : RecipeEnv} (hEnv : EnvironmentChecked env) :
    ∀ {rank : Nat} {stmt : CallStmt} {trace signature : List Effect},
      CallExec env rank stmt trace →
      BodyComposes env rank signature stmt →
      SignatureCovers trace signature := by
  intro rank stmt trace signature hExec
  induction hExec generalizing signature with
  | skip =>
      intro hBody effect hMem
      simp at hMem
  | emit =>
      intro hBody effect hMem
      have hSame : effect = ‹Effect› := by simpa using hMem
      subst effect
      simpa [BodyComposes] using hBody
  | seq hFirst hSecond ihFirst ihSecond =>
      intro hBody effect hMem
      have hBodies :
          BodyComposes env _ signature _ ∧ BodyComposes env _ signature _ := by
        simpa [BodyComposes] using hBody
      rcases List.mem_append.mp hMem with hLeft | hRight
      · exact ihFirst hBodies.1 effect hLeft
      · exact ihSecond hBodies.2 effect hRight
  | branchThen hThen ihThen =>
      intro hBody
      have hThenBody : BodyComposes env _ signature _ := by
        exact (by simpa [BodyComposes] using hBody).1
      exact ihThen hThenBody
  | branchElse hElse ihElse =>
      intro hBody
      have hElseBody : BodyComposes env _ signature _ := by
        exact (by simpa [BodyComposes] using hBody).2
      exact ihElse hElseBody
  | repeatZero =>
      intro hBody effect hMem
      simp at hMem
  | repeatSucc hFirst hRest ihFirst ihRest =>
      intro hBody effect hMem
      have hLoop : BodyComposes env _ signature _ := by
        simpa [BodyComposes] using hBody
      rcases List.mem_append.mp hMem with hNow | hLater
      · exact ihFirst hLoop effect hNow
      · exact ihRest hBody effect hLater
  | @call rank name args callee trace hLookup hRank hArgs hCallee ih =>
      intro hBody
      obtain ⟨checkedCallee, hCheckedLookup, hCheckedRank, hCheckedArgs, hImported⟩ :=
        (by simpa [BodyComposes] using hBody)
      have hSame : checkedCallee = callee := by
        rw [hLookup] at hCheckedLookup
        exact Option.some.inj hCheckedLookup
      subst checkedCallee
      have hCalleeBody :
          BodyComposes env callee.rank callee.signature callee.body :=
        hEnv name callee hLookup
      have hRuntimeInCallee : SignatureCovers trace callee.signature :=
        ih hCalleeBody
      exact signatureCoversTrans hRuntimeInCallee hImported

/-- Generated certificates use this theorem: a checked finite environment plus
    a looked-up root recipe yields signature containment for every modeled call
    execution of that recipe. -/
theorem checkedRecipeExecutionCannotEscape
    {env : RecipeEnv} {name : Name} {recipe : RecipeDef} {trace : List Effect}
    (hCheck : checkRecipeEnv env = true)
    (hLookup : lookupRecipe env name = some recipe)
    (hExec : CallExec env recipe.rank recipe.body trace) :
    SignatureCovers trace recipe.signature := by
  have hEnv : EnvironmentChecked env := checkRecipeEnv_sound hCheck
  exact callSignatureSoundness hEnv hExec (hEnv name recipe hLookup)

end PatchFormal
