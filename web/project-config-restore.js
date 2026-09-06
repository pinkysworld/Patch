import { parseStoredStudioProject, parseStudioProjectBundle, studioStateFromBundle } from '../src/studio-project.js';
import {
  activateStudioProjectFile,
  getStudioProjectBundle,
  persistStudioProjectFromDom
} from './project-lifecycle.js';

const CURRENT_KEYS = ['patchStudio.project.v4', 'patchStudio.project.v3', 'patchStudio.project.v2', 'patchStudio.project.v1'];
const buildTarget = document.querySelector('#buildTarget');
const nativeBuildMode = document.querySelector('#nativeBuildMode');
const sample = document.querySelector('#sample');

// Canonical browser copy of examples/patch-studio-showcase.patchproject. The
// studio-showcase-loader regression keeps this byte-for-byte synchronized so the
// complete project remains available in both hosted and fully offline Studio.
const PATCH_STUDIO_SHOWCASE_PROJECT = String.raw`{
  "format": "patch-studio-project",
  "version": 4,
  "project": {
    "name": "Patch Studio Showcase",
    "kind": "window",
    "entry": "main.patch",
    "build": {
      "target": "web",
      "nativeMode": "prebuilt"
    }
  },
  "files": [
    {
      "path": "main.patch",
      "content": "create text user_name = \"Ada\"\ncreate text secret = \"\"\ncreate text phone = \"\"\ncreate text notes = \"Patch Studio Showcase keeps the complete current Studio/Web surface visible in one project.\"\ncreate boolean active = true\ncreate text access = \"User\"\ncreate text theme = \"Blue\"\ncreate list features = [\"Designer\", \"Web\"]\ncreate number level = 60\ncreate number completion = 35\ncreate text status = \"Patch Studio Showcase ready\"\ncreate boolean can_save = true\ncreate boolean pinned = false\ncreate text selected_path = \"No file selected\"\ncreate number ticks = 0\ncreate text nested_code = \"\"\ncreate text gallery_status = \"Component Gallery ready\"\ncreate text dialog_status = \"Dialogs ready\"\n\nwindow \"Patch Studio Showcase\" as main size 1180, 820 icon \"patch-resource:showcase.logo\":\n  menu \"File\":\n    item \"Open file...\" as menu_open shortcut \"Primary+O\"\n    item \"Save file...\" as menu_save enabled can_save shortcut \"Primary+S\"\n    separator\n    item \"Pinned\" as menu_pinned checked pinned shortcut \"Primary+P\"\n  menu \"View\":\n    item \"Component Gallery\" as menu_gallery\n    item \"Dialog Lab\" as menu_dialogs\n  menu \"Help\":\n    item \"About Showcase\" as menu_about shortcut \"F1\"\n\n  # @locked\n  shape rounded as hero_card fill #eef2ff stroke #c7d2fe stroke-width 1 radius 22 opacity 1 at 24, 18 size 1132, 92\n  # @locked\n  picture as showcase_logo from \"patch-resource:showcase.logo\" description \"Patch Studio Showcase logo\" at 44, 36 size 56, 56\n  text \"Patch Studio Showcase\" at 120, 34 size 430, 34\n  text \"A polished Project-v4 workspace for the complete Registry 0.10 Studio/Web surface.\" at 120, 68 size 660, 24\n  text \"{status}\" at 824, 42 size 300, 42\n\n  imagelist as showcase_images size 20, 20:\n    image mark from \"patch-resource:showcase.logo\"\n\n  # @locked\n  shape rounded as account_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 132 size 548, 280\n  text \"Account & input\" at 44, 150 size 260, 28\n  text \"Plain, password, masked and multiline input stay ordinary source-backed Patch controls.\" at 44, 180 size 492, 38\n\n  text \"Name\" at 44, 226 size 120, 20\n  # @taborder 0\n  input user_name at 44, 250 size 236, 38\n  text \"Password\" at 306, 226 size 120, 20\n  # @input-mode password\n  # @taborder 1\n  input secret at 306, 250 size 236, 38\n\n  text \"Phone\" at 44, 302 size 120, 20\n  # @input-mask \"(000) 000-0000\"\n  # @taborder 2\n  input phone at 44, 326 size 236, 38\n  text \"Notes\" at 306, 302 size 120, 20\n  # @taborder 3\n  memo notes at 306, 326 size 236, 66\n\n  # @locked\n  shape rounded as preference_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 596, 132 size 560, 280\n  text \"Preferences & state\" at 616, 150 size 280, 28\n  text \"Interactive controls emit transient values. Only explicit change blocks persist them.\" at 616, 180 size 504, 38\n\n  checkbox \"Account active\" as active at 616, 226 size 200, 34\n  radio \"User\", \"Admin\", \"Guest\" as access at 616, 268 size 218, 78\n\n  text \"Theme\" at 860, 226 size 100, 20\n  combo \"Blue\", \"Green\", \"Amber\", \"System\" as theme at 860, 250 size 260, 38\n  text \"Enabled surfaces\" at 860, 300 size 160, 20\n  # @listbox-mode checked\n  listbox \"Designer\", \"Web\", \"Native\", \"Offline\" as features at 860, 324 size 260, 68\n\n  text \"Experience level {level}\" at 616, 354 size 200, 20\n  slider 0..100 as level step 10 at 616, 378 size 218, 26\n  text \"Demo progress {completion}%\" at 860, 354 size 200, 20\n  # @slider-mode progress\n  slider 0..100 as completion step 1 at 860, 378 size 260, 26\n\n  # @locked\n  shape rounded as details_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 436 size 732, 318\n  text \"Details & semantics\" at 44, 454 size 280, 28\n  text \"Tabs keep secondary concepts available without crowding the primary dashboard.\" at 44, 484 size 660, 24\n  tabs as showcase_tabs at 44, 516 size 692, 218:\n    tab \"Nested controls\":\n      text \"Tabs Stage 1 keeps supported flow controls source-backed.\"\n      # @input-mask \"AA-000\"\n      input nested_code\n      button \"Apply nested code\" as nested_apply\n    tab \"Project v4\":\n      text \"Resources, multiple .patch files, recovery and build settings belong to the explicit project bundle.\"\n      picture as nested_picture from \"patch-resource:showcase.logo\" description \"Project resource preview\"\n    tab \"Semantics\":\n      text \"Persistent application state changes only through explicit change blocks.\"\n      text \"Layout, TabOrder, Locked, PasswordEdit, MaskedEdit, CheckedListBox and ProgressBar metadata stays source-backed.\"\n\n  # @layout anchor right bottom\n  panel as actions_panel at 780, 436 size 376, 318:\n    text \"Quick actions\" at 20, 18 size 220, 28\n    text \"Open focused Forms for components and dialogs, or exercise project-level actions.\" at 20, 50 size 336, 42\n    button \"Component Gallery\" as open_gallery image showcase_images.mark at 20, 106 size 160, 42\n    button \"Dialog Lab\" as open_dialogs at 196, 106 size 160, 42\n    button \"Confirm reset\" as confirm_reset at 20, 164 size 160, 42\n    button \"About\" as about_button at 196, 164 size 160, 42\n    text \"Selected file\" at 20, 224 size 160, 20\n    text \"{selected_path}\" at 20, 248 size 336, 48\n\n  timer as showcase_clock interval 4000\n  # @layout anchor left right bottom\n  statusbar \"{status} · timer {ticks}\" as showcase_status at 0, 792 size 1180, 28\n"
    },
    {
      "path": "forms.patch",
      "content": "window \"Component Gallery\" as components size 1080, 760:\n  # @locked\n  shape rounded as gallery_header fill #ecfeff stroke #bae6fd stroke-width 1 radius 20 opacity 1 at 24, 18 size 1032, 84\n  text \"Component Gallery\" at 44, 36 size 360, 32\n  text \"Registry 0.10 · source-backed controls, graphics and resources\" at 44, 68 size 560, 22\n  text \"{gallery_status}\" at 700, 42 size 324, 38\n\n  # @locked\n  shape rounded as data_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 122 size 660, 300\n  text \"Data & component contracts\" at 44, 140 size 300, 26\n  table \"Control\", \"Contract\", \"Surface\" as gallery_table at 44, 178 size 414, 222:\n    row \"Memo\", \"changed(value)\", \"Studio/Web\"\n    row \"PasswordEdit\", \"Input presentation\", \"Studio/Web\"\n    row \"MaskedEdit\", \"Input mask\", \"Studio/Web\"\n    row \"CheckedListBox\", \"List presentation\", \"Studio/Web\"\n    row \"ProgressBar\", \"Passive Slider\", \"Studio/Web\"\n    row \"TreeView\", \"changed(value)\", \"Ready\"\n\n  tree as gallery_tree at 476, 178 size 188, 222:\n    node \"Registry 0.10\"\n      node \"Basic\"\n        node \"Text\"\n        node \"Button\"\n        node \"Input\"\n        node \"Memo\"\n      node \"Choices\"\n        node \"Checkbox\"\n        node \"Radio\"\n        node \"ComboBox\"\n        node \"ListBox\"\n        node \"Slider\"\n      node \"Data\"\n        node \"Table\"\n        node \"TreeView\"\n      node \"Containers\"\n        node \"Tabs\"\n        node \"Panel\"\n      node \"Graphics\"\n        node \"Picture\"\n        node \"Shape\"\n        node \"PaintBox\"\n      node \"Chrome\"\n        node \"StatusBar\"\n      node \"Nonvisual\"\n        node \"Timer\"\n        node \"ImageList\"\n\n  # @locked\n  shape rounded as graphics_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 708, 122 size 348, 300\n  text \"Graphics\" at 728, 140 size 180, 26\n  text \"Shape\" at 728, 178 size 100, 20\n  # @locked\n  shape rounded as gallery_shape fill #dbeafe stroke #2563eb stroke-width 2 radius 18 opacity 1 at 728, 204 size 140, 84\n  text \"PaintBox\" at 888, 178 size 100, 20\n  paintbox as gallery_canvas at 888, 204 size 148, 116\n  text \"Both remain source-visible and deterministic.\" at 728, 342 size 288, 44\n\n  # @locked\n  shape rounded as resources_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 446 size 660, 220\n  text \"Project resources\" at 44, 464 size 260, 26\n  picture as gallery_picture from \"patch-resource:showcase.logo\" description \"Showcase project PNG resource\" at 44, 508 size 104, 104\n  imagelist as gallery_images size 24, 24:\n    image mark from \"patch-resource:showcase.logo\"\n  button \"Resource button\" as gallery_resource_button image gallery_images.mark at 172, 508 size 190, 42\n  text \"One project-v4 PNG is reused for the Window icon, Picture, ImageList/Button and PaintBox draw image.\" at 172, 564 size 472, 54\n\n  panel as gallery_panel at 708, 446 size 348, 220:\n    text \"Panel Stage 2\" at 18, 18 size 250, 26\n    text \"Positioned children keep their coordinates relative to this source-backed container.\" at 18, 52 size 312, 52\n    button \"Update gallery\" as gallery_update at 18, 124 size 150, 40\n    button \"Dialog Lab\" as gallery_dialogs at 182, 124 size 148, 40\n\n  button \"Close Gallery\" as close_gallery at 24, 690 size 180, 40\n  statusbar \"{gallery_status}\" as gallery_statusbar at 0, 732 size 1080, 28\n\nwindow \"Dialog Lab\" as dialogs size 820, 560:\n  # @locked\n  shape rounded as dialog_header fill #f5f3ff stroke #ddd6fe stroke-width 1 radius 20 opacity 1 at 24, 18 size 772, 84\n  text \"Dialog Lab\" at 44, 36 size 300, 32\n  text \"Transient dialog results become persistent only through explicit change.\" at 44, 68 size 520, 22\n  text \"{dialog_status}\" at 586, 42 size 190, 38\n\n  # @locked\n  shape rounded as dialog_actions_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 124 size 772, 142\n  text \"Result-bearing dialogs\" at 44, 142 size 260, 26\n  button \"Confirm\" as dialog_confirm at 44, 188 size 164, 42\n  button \"Open file\" as dialog_open at 224, 188 size 164, 42\n  button \"Save file\" as dialog_save at 404, 188 size 164, 42\n  button \"Information\" as dialog_info at 584, 188 size 172, 42\n\n  # @locked\n  shape rounded as dialog_path_card fill #ffffff stroke #dbe3ef stroke-width 1 radius 18 opacity 1 at 24, 288 size 772, 152\n  text \"Last selected path\" at 44, 306 size 220, 24\n  text \"{selected_path}\" at 44, 338 size 712, 40\n  text \"Open/Save results remain transient until their chosen handler performs change selected_path.\" at 44, 388 size 712, 30\n\n  button \"Back to Gallery\" as dialog_gallery at 44, 466 size 180, 40\n  button \"Close Dialog Lab\" as close_dialogs at 240, 466 size 180, 40\n  statusbar \"{dialog_status}\" as dialog_statusbar at 0, 532 size 820, 28\n"
    },
    {
      "path": "logic.patch",
      "content": "when user_name changed:\n  change user_name:\n    set = value\n  change status:\n    set = \"Account name updated\"\n\nwhen secret changed:\n  change secret:\n    set = value\n  change status:\n    set = \"PasswordEdit updated securely\"\n\nwhen phone changed:\n  change phone:\n    set = value\n  change status:\n    set = \"Masked phone input updated\"\n\nwhen notes changed:\n  change notes:\n    set = value\n  change status:\n    set = \"Notes updated\"\n\nwhen active changed:\n  change active:\n    set = value\n  change status:\n    set = \"Account activity changed\"\n\nwhen access changed:\n  change access:\n    set = value\n  change status:\n    set = \"Access role changed\"\n\nwhen theme changed:\n  change theme:\n    set = value\n  change status:\n    set = \"Theme preference changed\"\n\nwhen features changed:\n  change features:\n    set = value\n  change status:\n    set = \"Enabled surfaces changed\"\n\nwhen level changed:\n  change level:\n    set = value\n  change status:\n    set = \"Experience level changed\"\n\nwhen nested_code changed:\n  change nested_code:\n    set = value\n  change status:\n    set = \"Nested masked input updated\"\n\nwhen nested_apply clicked:\n  change status:\n    set = \"Nested code applied\"\n\nwhen showcase_logo clicked:\n  change status:\n    set = \"Project resource selected\"\n\nwhen showcase_clock ticked:\n  change ticks:\n    add 1\n  if completion >= 100:\n    change completion:\n      set = 0\n  else:\n    change completion:\n      add 5\n\nwhen open_gallery clicked:\n  open components\n  change gallery_status:\n    set = \"Component Gallery opened from dashboard\"\n\nwhen open_dialogs clicked:\n  open dialogs\n  change dialog_status:\n    set = \"Dialog Lab opened from dashboard\"\n\nwhen menu_gallery clicked:\n  open components\n  change gallery_status:\n    set = \"Component Gallery opened from menu\"\n\nwhen menu_dialogs clicked:\n  open dialogs\n  change dialog_status:\n    set = \"Dialog Lab opened from menu\"\n\nwhen menu_pinned clicked:\n  if pinned:\n    change pinned:\n      set = false\n  else:\n    change pinned:\n      set = true\n  change status:\n    set = \"Pinned menu state changed explicitly\"\n\nwhen menu_about clicked:\n  dialog \"Patch Studio Showcase\", \"A polished Project-v4 workspace for Component Registry 0.10 and current Studio/Web RAD features.\"\n\nwhen about_button clicked:\n  dialog \"About\", \"Patch Studio Showcase combines a dashboard, Component Gallery and Dialog Lab while keeping persistent state changes explicit.\"\n\nwhen menu_open clicked:\n  open file \"Choose a Patch file\" as menu_open_result\n\nwhen menu_open_result chosen:\n  change selected_path:\n    set = value\n  change status:\n    set = \"Selected file persisted explicitly\"\n\nwhen menu_open_result cancelled:\n  change status:\n    set = \"Open file cancelled\"\n\nwhen menu_save clicked:\n  save file \"Save Patch project data\" as menu_save_result\n\nwhen menu_save_result chosen:\n  change selected_path:\n    set = value\n  change status:\n    set = \"Save path persisted explicitly\"\n\nwhen menu_save_result cancelled:\n  change status:\n    set = \"Save file cancelled\"\n\nwhen confirm_reset clicked:\n  confirm \"Reset showcase?\", \"Restore the dashboard progress, level, selected path and status?\" as reset_confirm\n\nwhen reset_confirm confirmed:\n  change selected_path:\n    set = \"No file selected\"\n  change level:\n    set = 60\n  change completion:\n    set = 35\n  change status:\n    set = \"Showcase restored to its demo defaults\"\n\nwhen reset_confirm cancelled:\n  change status:\n    set = \"Reset cancelled\"\n\nwhen gallery_table changed:\n  change gallery_status:\n    set = \"Component contract selected\"\n\nwhen gallery_tree changed:\n  change gallery_status:\n    set = \"Registry tree selection changed\"\n\nwhen gallery_picture clicked:\n  change gallery_status:\n    set = \"Project Picture resource selected\"\n\nwhen gallery_resource_button clicked:\n  change gallery_status:\n    set = \"ImageList-backed Button clicked\"\n\nwhen gallery_update clicked:\n  change gallery_status:\n    set = \"Panel child action completed\"\n\nwhen gallery_canvas paint:\n  draw clear #f8fafc\n  draw rectangle 10, 10 size 58, 30 fill #dbeafe stroke #2563eb width 2\n  draw ellipse 82, 10 size 30, 30 fill #dcfce7 stroke #16a34a width 2\n  draw image \"patch-resource:showcase.logo\" at 102, 56 size 36, 36\n  draw line 10, 50 to 138, 50 stroke #64748b width 2\n  draw text \"Patch\" at 10, 76 color #111827 size 14\n\nwhen gallery_dialogs clicked:\n  open dialogs\n  change dialog_status:\n    set = \"Dialog Lab opened from Component Gallery\"\n\nwhen close_gallery clicked:\n  close components\n  change status:\n    set = \"Returned to Showcase dashboard\"\n\nwhen dialog_confirm clicked:\n  confirm \"Confirm showcase action\", \"Persist a confirmation status?\" as dialog_confirm_result\n\nwhen dialog_confirm_result confirmed:\n  change dialog_status:\n    set = \"Confirmation accepted and persisted\"\n\nwhen dialog_confirm_result cancelled:\n  change dialog_status:\n    set = \"Confirmation cancelled\"\n\nwhen dialog_open clicked:\n  open file \"Open any file\" as dialog_open_result\n\nwhen dialog_open_result chosen:\n  change selected_path:\n    set = value\n  change dialog_status:\n    set = \"Open-file result persisted explicitly\"\n\nwhen dialog_open_result cancelled:\n  change dialog_status:\n    set = \"Open file cancelled\"\n\nwhen dialog_save clicked:\n  save file \"Choose save path\" as dialog_save_result\n\nwhen dialog_save_result chosen:\n  change selected_path:\n    set = value\n  change dialog_status:\n    set = \"Save-file result persisted explicitly\"\n\nwhen dialog_save_result cancelled:\n  change dialog_status:\n    set = \"Save file cancelled\"\n\nwhen dialog_info clicked:\n  dialog \"Informational dialog\", \"Informational dialogs carry no hidden persistent result state.\"\n\nwhen dialog_gallery clicked:\n  open components\n  change gallery_status:\n    set = \"Returned from Dialog Lab\"\n\nwhen close_dialogs clicked:\n  close dialogs\n  change status:\n    set = \"Returned to Showcase dashboard\"\n"
    }
  ],
  "resources": [
    {
      "id": "showcase.logo",
      "path": "resources/showcase-logo.png",
      "mediaType": "image/png",
      "size": 220,
      "sha256": "3f7750ba9f6ff2f75739006ac9e0c140c49b5af6674adc23cc458ec261dd8fda",
      "data": "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAo0lEQVR42mP88evPf4YBBEwMAwxGHcCCT1I38z2cfXm6IFZxfABZDy7AiC0REmsBsQCfQ+gSBfg8xERr3xMyd3AnQnLjFZdvdTPfY+hjorblxKZ+sh1ArOHEqht6JSGxuYRYdUzUztf45LFFCwstCpdBWRnhSpRMA2k5RVFArazIQiuDR1tEow4YdQDZDqBmXT8kQoARX98QV7+Abg4YzQX0AAAIsD5sBwsk2AAAAABJRU5ErkJggg=="
    }
  ]
}
`;

installDesignerObserverCoordinator();
installStudioShowcaseSample();

// Example selection is an explicit load action, not project persistence. Keep the
// fast Counter example selected at startup so the large Workshop Desk or complete
// Studio Showcase is never injected automatically before the module graph settles.
// This also prevents a saved v4/v3/v2/v1 project from being overwritten at startup.
if (sample && hasOption(sample, 'counterWindow')) sample.value = 'counterWindow';

try {
  const raw = CURRENT_KEYS.map(key => localStorage.getItem(key)).find(Boolean);
  if (raw) {
    const state = studioStateFromBundle(parseStoredStudioProject(raw));
    if (buildTarget && hasOption(buildTarget, state.buildTarget)) buildTarget.value = state.buildTarget;
    if (nativeBuildMode && hasOption(nativeBuildMode, state.nativeBuildMode)) nativeBuildMode.value = state.nativeBuildMode;
    buildTarget?.dispatchEvent(new Event('change', { bubbles: true }));
    nativeBuildMode?.dispatchEvent(new Event('change', { bubbles: true }));
  }
} catch {
  // project-lifecycle owns corruption/quarantine reporting; startup restoration remains best-effort here.
}

function installStudioShowcaseSample() {
  if (!sample) return;
  let option = sample.querySelector('option[value="studioShowcase"]');
  if (!option) {
    option = document.createElement('option');
    option.value = 'studioShowcase';
    option.textContent = 'Patch Studio Showcase';
    const workshop = sample.querySelector('option[value="workshopDesk"]');
    sample.insertBefore(option, workshop ?? sample.firstElementChild);
  }

  sample.addEventListener('change', event => {
    if (sample.value !== 'studioShowcase') return;
    event.stopImmediatePropagation();
    try {
      loadStudioShowcaseProject();
    } catch (error) {
      const status = document.querySelector('#saveState');
      if (status) {
        status.textContent = 'Showcase load stopped';
        status.title = error?.message ?? String(error);
      }
    }
  }, { capture: true });
}

function loadStudioShowcaseProject() {
  const incoming = parseStudioProjectBundle(PATCH_STUDIO_SHOWCASE_PROJECT);
  const entry = incoming.files.find(file => file.path === incoming.project.entry);
  if (!entry) throw new Error(`Showcase entry '${incoming.project.entry}' is missing.`);

  // Flush the current editor state first. The final forced persist then records one
  // recovery snapshot for the previous project instead of a chain of intermediate
  // add-file/add-resource snapshots.
  persistStudioProjectFromDom({ snapshot: 'none' });
  const live = getStudioProjectBundle();
  if (!live) throw new Error('Patch Studio project state is unavailable.');

  live.format = incoming.format;
  live.version = incoming.version;
  live.project = {
    ...incoming.project,
    build: { ...incoming.project.build }
  };
  live.files = incoming.files.map(file => ({ ...file }));
  live.resources = incoming.resources.map(resource => ({ ...resource }));

  const projectName = document.querySelector('#projectName');
  const projectKind = document.querySelector('#projectKind');
  const code = document.querySelector('#code');
  if (projectName) projectName.value = incoming.project.name;
  if (projectKind) projectKind.value = incoming.project.kind;
  if (buildTarget && hasOption(buildTarget, incoming.project.build.target)) buildTarget.value = incoming.project.build.target;
  if (nativeBuildMode && hasOption(nativeBuildMode, incoming.project.build.nativeMode)) nativeBuildMode.value = incoming.project.build.nativeMode;
  if (code) code.value = entry.content;

  persistStudioProjectFromDom({ snapshot: 'force' });
  activateStudioProjectFile(incoming.project.entry);

  const detail = {
    entry: incoming.project.entry,
    activeFile: incoming.project.entry,
    files: incoming.files.map(file => file.path),
    resources: incoming.resources.map(resource => resource.id)
  };
  window.dispatchEvent(new CustomEvent('patch:studio-project-files-changed', { detail }));
  window.dispatchEvent(new CustomEvent('patch:studio-project-resources-changed', { detail }));

  buildTarget?.dispatchEvent(new Event('change', { bubbles: true }));
  nativeBuildMode?.dispatchEvent(new Event('change', { bubbles: true }));
  projectKind?.dispatchEvent(new Event('change', { bubbles: true }));
  code?.dispatchEvent(new Event('input', { bubbles: true }));
  code?.dispatchEvent(new Event('change', { bubbles: true }));
  document.querySelector('#tabDesigner')?.click();

  const status = document.querySelector('#saveState');
  if (status) {
    status.textContent = 'Patch Studio Showcase loaded';
    status.title = 'Complete current Project v4 Studio showcase loaded locally.';
  }
}

function installDesignerObserverCoordinator() {
  const BaseObserver = window.MutationObserver;
  if (typeof BaseObserver !== 'function' || window.__patchStudioDesignerObserverCoordinator === true) return;
  window.__patchStudioDesignerObserverCoordinator = true;

  const pendingObservers = new Set();
  const designerObservers = new Set();
  let flushQueued = false;
  let flushing = false;

  class CoordinatedDesignerObserver {
    constructor(callback) {
      if (typeof callback !== 'function') throw new TypeError('MutationObserver callback must be a function');
      this.callback = callback;
      this.observations = [];
      this.pending = [];
      this.active = true;
      this.designerBound = false;
      this.base = new BaseObserver(records => {
        if (!this.designerBound) {
          this.callback(records, this);
          return;
        }
        this.pending.push(...records);
        pendingObservers.add(this);
        scheduleFlush();
      });
    }

    observe(target, options) {
      this.active = true;
      const existing = this.observations.findIndex(item => item.target === target);
      const record = { target, options: { ...(options ?? {}) } };
      if (existing >= 0) this.observations[existing] = record;
      else this.observations.push(record);
      if (isDesignerTarget(target)) {
        this.designerBound = true;
        designerObservers.add(this);
      }
      this.base.observe(target, options);
    }

    disconnect() {
      this.active = false;
      this.pending = [];
      this.observations = [];
      pendingObservers.delete(this);
      designerObservers.delete(this);
      this.base.disconnect();
    }

    takeRecords() {
      return [...this.pending.splice(0), ...this.base.takeRecords()];
    }

    pause() {
      this.base.disconnect();
    }

    reconnect() {
      if (!this.active) return;
      for (const { target, options } of this.observations) this.base.observe(target, options);
    }
  }

  function scheduleFlush() {
    if (flushQueued) return;
    flushQueued = true;
    queueMicrotask(flushDesignerObservers);
  }

  function flushDesignerObservers() {
    flushQueued = false;
    if (flushing) return scheduleFlush();
    const batch = [...pendingObservers].filter(observer => observer.active && observer.pending.length);
    pendingObservers.clear();
    if (!batch.length) return;

    flushing = true;
    // Pause every live Designer observer, not only those already present in this
    // mutation batch. A callback commonly rewrites DOM that belongs to another
    // Designer module. Keeping the complete observer set paused prevents the
    // cross-module A -> B -> C -> A feedback chain that can otherwise monopolize
    // Chrome's microtask queue while a large Form project is reconciled.
    const paused = [...designerObservers].filter(observer => observer.active);
    for (const observer of paused) observer.pause();
    try {
      for (const observer of batch) {
        const records = observer.pending.splice(0);
        if (records.length && observer.active) observer.callback(records, observer);
      }
    } finally {
      // Keep the complete Designer observer set paused through callbacks' own
      // reconciliation microtasks. Reconnect once those writes have settled.
      queueMicrotask(() => {
        for (const observer of paused) observer.reconnect();
        flushing = false;
        if (pendingObservers.size) scheduleFlush();
      });
    }
  }

  function isDesignerTarget(target) {
    if (!target) return false;
    if (target.id === 'designer' || target.id === 'designerCanvas') return true;
    const element = target.nodeType === 1 ? target : target.parentElement;
    return Boolean(element?.closest?.('#designer'));
  }

  window.MutationObserver = CoordinatedDesignerObserver;
}

function hasOption(select, value) {
  return Array.from(select.options ?? []).some(option => option.value === value);
}