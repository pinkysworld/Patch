const sample = document.querySelector('#sample');
const code = document.querySelector('#code');
const projectKind = document.querySelector('#projectKind');

// Canonical browser copy of examples/workshop-desk.patch. A regression test keeps
// this byte-for-byte synchronized (apart from the surrounding template literal)
// so the Studio Example menu cannot silently drift away from the repository demo.
const WORKSHOP_DESK_SAMPLE = `create thing ticket:
  customer = "Ada"
  item = "Keyboard"
  qty = 1
  total = 40
  bench = "Bench A"
  priority = "Normal"

create text customer = "Ada"
create text item = "Keyboard"
create number qty = 1
create boolean rush = false
create text priority = "Normal"
create text pay = "Card"
create text notes = ""
create list services = ["Diagnostics"]
create list selected_part = []
create list selected_job = []
create text status = "Ready for the next workshop ticket."
create boolean notifications = true
create text default_bench = "Bench A"
create list stations = ["Bench A", "Bench B"]
create text density = "Comfortable"
create number labor_limit = 50

allow quote:
  ticket.total may increase up to 500

make quote(ticket, extra number 0..50):
  change ticket:
    add extra to total

window "Workshop Desk" as main size 1080, 740:
  text "Workshop Desk" at 24, 16 size 260, 30
  text "{status}" at 300, 16 size 520, 30
  text "Quote {ticket.total}" at 840, 16 size 180, 30

  text "Customer" at 24, 58 size 100, 22
  combo "Ada", "Grace", "Linus", "Margaret" as customer at 24, 82 size 220, 36
  text "Item" at 260, 58 size 80, 22
  input item at 260, 82 size 250, 36
  text "Payment" at 528, 58 size 90, 22
  radio "Card", "Cash", "Account" as pay at 528, 82 size 200, 96
  text "Priority" at 744, 58 size 90, 22
  radio "Normal", "High", "Critical" as priority at 744, 82 size 180, 96
  checkbox "Rush bench" as rush at 936, 82 size 120, 36

  text "Quantity {qty}" at 24, 138 size 130, 22
  slider 1..8 as qty step 1 at 24, 162 size 260, 38
  text "Notes" at 304, 138 size 80, 22
  input notes at 304, 162 size 370, 38
  text "Services" at 694, 138 size 90, 22
  listbox "Diagnostics", "Warranty", "Install", "Pickup" as services at 694, 162 size 230, 110

  table "Ticket", "Customer", "Bench", "State" as board at 24, 300 size 540, 230:
    row "WD-104", "Ada", "Bench A", "Open"
    row "WD-105", "Grace", "Bench B", "Quoted"
    row "WD-106", "Linus", "Bench A", "Ready"
    row "WD-107", "Margaret", "Overflow", "Waiting"

  tree as parts at 584, 300 size 270, 230:
    node "Parts"
      node "Input"
        node "Keyboard"
        node "Trackpad"
      node "Displays"
        node "Panel"
        node "Cable"
    node "Tools"
      node "Driver"
      node "Solder"
      node "Meter"

  button "Create quote" as quote_button at 878, 300 size 150, 38
  button "Job details" as details_button at 878, 350 size 150, 38
  button "Settings" as settings_button at 878, 400 size 150, 38
  button "Reset ticket" as reset_button at 878, 450 size 150, 38

  text "Selected job: {selected_job}" at 24, 548 size 520, 26
  text "Selected part: {selected_part}" at 584, 548 size 420, 26
  # @layout anchor left right bottom
  text "All persistent edits are explicit semantic changes. Resize the Form to exercise source-backed layout policies." at 24, 680 size 980, 28

window "Workshop settings" as settings size 720, 520:
  tabs as prefs at 24, 24 size 672, 400:
    tab "Workflow":
      text "Default bench"
      combo "Bench A", "Bench B", "Overflow" as default_bench
      checkbox "Notify when a quote changes" as notifications
      text "Available stations"
      listbox "Bench A", "Bench B", "Overflow" as stations
    tab "Limits":
      text "Labor approval limit {labor_limit}"
      slider 0..100 as labor_limit step 10
      text "This tab demonstrates a nested Slider and shared persistent state."
    tab "Appearance":
      radio "Compact", "Comfortable", "Spacious" as density
      text "Density is source-backed application state, not hidden Designer metadata."
    tab "About":
      text "Workshop Desk is the Patch Studio showcase project."
      text "It uses Forms, Tabs, Table, TreeView, Slider and source-backed event handlers."
      button "Close" as close_about
  button "Close settings" as close_settings at 24, 448 size 170, 38

window "Job details" as details size 640, 430:
  text "Current workshop ticket" at 24, 24 size 300, 28
  text "Customer: {ticket.customer}" at 24, 70 size 280, 24
  text "Item: {ticket.item}" at 24, 104 size 280, 24
  text "Quantity: {ticket.qty}" at 24, 138 size 280, 24
  text "Bench: {ticket.bench}" at 24, 172 size 280, 24
  text "Priority: {ticket.priority}" at 24, 206 size 280, 24
  text "Current quote: {ticket.total}" at 24, 240 size 280, 24
  text "{status}" at 24, 278 size 560, 28
  button "Add inspection" as details_quote at 24, 330 size 160, 38
  button "Close details" as close_details at 202, 330 size 160, 38

when customer changed:
  change customer:
    set = value
  change ticket:
    set customer = value
  change status:
    set = "Customer changed"

when item changed:
  change item:
    set = value
  change ticket:
    set item = value
  change status:
    set = "Item description updated"

when pay changed:
  change pay:
    set = value
  change status:
    set = "Payment method changed"

when priority changed:
  change priority:
    set = value
  change ticket:
    set priority = value
  change status:
    set = "Priority changed"

when rush changed:
  change rush:
    set = value
  change status:
    set = "Rush bench preference changed"

when qty changed:
  change qty:
    set = value
  change ticket:
    set qty = value
  change status:
    set = "Quantity changed"

when notes changed:
  change notes:
    set = value
  change status:
    set = "Notes updated"

when services changed:
  change services:
    set = value
  change status:
    set = "Services updated"

when board changed:
  change selected_job:
    set = value
  change status:
    set = "Workshop board row selected"

when parts changed:
  change selected_part:
    set = value
  change status:
    set = "Inventory tree path selected"

when quote_button clicked:
  do quote(ticket, 25)
  change status:
    set = "Quote increased by 25"

when details_quote clicked:
  do quote(ticket, 10)
  change status:
    set = "Inspection added to quote"

when settings_button clicked:
  open settings

when details_button clicked:
  open details

when close_settings clicked:
  close settings

when close_about clicked:
  close settings

when close_details clicked:
  close details

when notifications changed:
  change notifications:
    set = value

when default_bench changed:
  change default_bench:
    set = value
  change ticket:
    set bench = value
  change status:
    set = "Default bench changed"

when stations changed:
  change stations:
    set = value

when labor_limit changed:
  change labor_limit:
    set = value

when density changed:
  change density:
    set = value

when reset_button clicked:
  change notes:
    set = ""
  change services:
    set = ["Diagnostics"]
  change selected_part:
    clear
  change selected_job:
    clear
  change qty:
    set = 1
  change rush:
    set = false
  change ticket:
    set qty = 1
    set total = 40
    set priority = "Normal"
    set bench = default_bench
  change priority:
    set = "Normal"
  change status:
    set = "Ticket reset"
`;

const MULTISELECT_SAMPLE = `create list fruits = ["Banana", "Mango"]

window "Fruit Picker" as main size 540, 360:
  text "Pick one or more fruits"
  listbox "Apple", "Banana", "Cherry", "Mango" as fruits at 24, 72 size 260, 140
  text "Selection is committed only by the changed handler"

when fruits changed:
  change fruits:
    set = value
  show value`;

if (sample && code && projectKind) {
  let option = sample.querySelector('option[value="listboxMultiWindow"]');
  if (!option) {
    option = document.createElement('option');
    option.value = 'listboxMultiWindow';
    option.textContent = 'Multi-select ListBox';
    const capabilities = sample.querySelector('option[value="capabilities"]');
    sample.insertBefore(option, capabilities ?? null);
  }

  const loadWindowSample = source => {
    code.value = source;
    projectKind.value = 'window';
    code.dispatchEvent(new Event('input', { bubbles: true }));
    code.dispatchEvent(new Event('change', { bubbles: true }));
    projectKind.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector('#tabDesigner')?.click();
  };

  sample.addEventListener('change', event => {
    if (sample.value === 'workshopDesk') {
      event.stopImmediatePropagation();
      loadWindowSample(WORKSHOP_DESK_SAMPLE);
      return;
    }
    if (sample.value !== 'listboxMultiWindow') return;

    // Intercept only Studio-owned samples, then use the same public DOM signals as
    // normal editing so persistence, Designer refresh and native-build state stay aligned.
    event.stopImmediatePropagation();
    loadWindowSample(MULTISELECT_SAMPLE);
  }, { capture: true });

  // A selected <option> does not emit change when the user selects the same item
  // again. Keep sample loading explicit and repeatable.
  const toolbar = sample.closest('.toolbar');
  let loadButton = document.querySelector('#loadSample');
  if (!loadButton && toolbar) {
    loadButton = document.createElement('button');
    loadButton.id = 'loadSample';
    loadButton.type = 'button';
    loadButton.className = 'secondary';
    loadButton.textContent = 'Load example';
    loadButton.title = 'Load or reload the selected example into main.patch';
    loadButton.setAttribute('aria-label', 'Load selected example');
    const field = sample.closest('.compact-field');
    field?.after(loadButton);
  }

  const loadSelectedSample = () => {
    if (!sample.value) return;
    sample.dispatchEvent(new Event('change', { bubbles: true }));
  };
  loadButton?.addEventListener('click', loadSelectedSample);

  // On a genuinely fresh Studio session the first visible example and the
  // editor must agree. Preserve an existing local project, but otherwise load
  // Workshop Desk immediately so Run and Designer show all showcase Forms.
  let hasSavedProject = false;
  try { hasSavedProject = Boolean(localStorage.getItem('patchStudio.project')); } catch { /* storage can be unavailable */ }
  if (!hasSavedProject && sample.value === 'workshopDesk') queueMicrotask(loadSelectedSample);
}
