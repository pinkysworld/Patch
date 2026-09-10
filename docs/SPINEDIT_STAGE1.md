# SpinEdit Stage 1

SpinEdit Stage 1 is a source-backed presentation of the existing Slider numeric contract.

```patch
create number quantity = 3

window "Example" as main:
  # @slider-mode spin
  slider 0..10 as quantity step 1

when quantity changed:
  change quantity:
    set = value
```

## Contract

- Slider presentation contract: **0.2**.
- Source directive: `# @slider-mode spin`.
- The underlying control remains Slider and retains its source-backed minimum, maximum and step.
- The control id must match an explicit `create number` declaration.
- Studio and Standalone Web present the Slider as a numeric editor.
- `changed(value)` remains the ordinary finite numeric Slider event value.
- Renderer state is transient. Persistent application state changes only when the handler performs explicit `change`.
- Duplicate and clipboard workflows create/carry an independent explicit backing number state for the copied SpinEdit.
- Change IR remains **0.10** and Component Registry remains **0.10**.
- Current Ready Native GUI IR **1.9** / payload **v19** / runtime **v1.10** fails closed rather than silently lowering SpinEdit as a Slider.

ProgressBar remains the passive `# @slider-mode progress` presentation under the same versioned Slider presentation contract 0.2.
