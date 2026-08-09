import PatchCallTree

namespace PatchFormal

/-- Bridge from a proof-free observed semantic-effect list to the beta.30 finite
    exact call-tree theorem. Beta.32 uses this theorem after an independent
    Change-IR validator has reconstructed a concrete invocation frame and the
    generated certificate has checked that frame's BindingList equals the exact
    beta.30 callee BindingList. The observed list itself is still not trusted as
    a call-tree result: `evalCallTreeStmtEqBool` independently re-evaluates the
    nested call tree under the exact callee binding before caller-signature
    refinement is derived. Runtime capture and validator/frame reconstruction
    correctness remain outside Lean. -/
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
