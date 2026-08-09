import PatchCallTree

namespace PatchFormal

/-- Beta.31 bridge from a proof-free observed semantic-effect list to the
    beta.30 finite exact call-tree theorem. The observed list is not trusted as
    a call-tree result: `evalCallTreeStmtEqBool` independently re-evaluates the
    nested call tree under the exact callee binding and compares every concrete
    effect occurrence before caller-signature refinement is derived. -/
theorem checkedObservedTransitiveRuntimeRefinesCallerSignature
    {caller : IntEnv} {argExprs : List RangeExpr} {params : List Name}
    {declared : List Interval} {calleeBindings : BindingList}
    {calleeSignature callerSignature observed : List Effect}
    {body : CallTreeStmt}
    (hBinding :
      concreteCallBinding argExprs caller params declared = some calleeBindings)
    (hObservedTree :
      evalCallTreeStmtEqBool calleeBindings body observed = true)
    (hBodyCovered : callTreeCoveredBool calleeSignature body = true)
    (hSignatureImport :
      signatureCoversBool calleeSignature callerSignature = true) :
    ConcreteCallBindingSpec argExprs caller params declared calleeBindings ∧
    TraceRefinesSignature observed callerSignature := by
  exact checkedConcreteTransitiveCallTreeRefinesCallerSignature
    hBinding
    (evalCallTreeStmtEqBool_sound hObservedTree)
    hBodyCovered
    hSignatureImport

end PatchFormal
