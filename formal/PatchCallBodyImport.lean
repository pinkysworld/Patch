import PatchCallBody

namespace PatchFormal

/-- If every concrete effect in a trace refines the callee signature and the
    callee signature is contained in the caller signature, the same exact trace
    is represented by the caller signature. -/
theorem traceRefinesSignature_import
    {trace calleeSignature callerSignature : List Effect}
    (hTrace : TraceRefinesSignature trace calleeSignature)
    (hImport : SignatureCovers calleeSignature callerSignature) :
    TraceRefinesSignature trace callerSignature := by
  intro actual hMem
  rcases hTrace actual hMem with ⟨expected, hExpected, hRefines⟩
  exact ⟨expected, hImport expected hExpected, hRefines⟩

/-- beta.28 call-facing composition: exact caller argument evaluation/binding,
    executable exact structured callee-body evaluation, callee signature
    coverage, and beta.25 callee-to-caller signature containment together imply
    that the complete concrete callee trace is represented by the caller
    semantic signature. -/
theorem checkedConcreteCallBodyRefinesCallerSignature
    {exprs : List RangeExpr} {caller : IntEnv}
    {params : List Name} {declared : List Interval}
    {bindings : BindingList}
    {stmt : BoundStmt} {trace : List Effect}
    {calleeSignature callerSignature : List Effect}
    (hBinding : concreteCallBinding exprs caller params declared = some bindings)
    (hEval : evalBoundStmt bindings stmt = some trace)
    (hCovered : boundBodyCoveredBool calleeSignature stmt = true)
    (hImport : signatureCoversBool calleeSignature callerSignature = true) :
    ConcreteCallBindingSpec exprs caller params declared bindings ∧
    TraceRefinesSignature trace callerSignature := by
  constructor
  · exact concreteCallBinding_sound hBinding
  · exact traceRefinesSignature_import
      (checkedEvaluatedBoundBodyRefinesSignature hEval hCovered)
      (signatureCoversBool_sound hImport)

end PatchFormal
