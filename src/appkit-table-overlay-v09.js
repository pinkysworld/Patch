import { NativeGuiError } from './native-gui-ir.js';

/** Apply the Native GUI IR 0.8 Table surface to backend-v0.8 AppKit output. */
export function applyAppKitTableOverlayV09(source, adapted, eventIndexes) {
  for (const table of adapted.tables) {
    source = removeShadowState(source, table);
    source = removeShadowRefresh(source, table);
    source = replaceRequired(source, legacyListBoxCreate(adapted, table), tableCreate(adapted, table), `AppKit Table '${table.id}' creation`);
    const eventIndex = eventIndexes.get(table.id);
    if (eventIndex !== undefined) {
      source = replaceRequired(source, `static void Event_${eventIndex}(NSString *eventValue) {`, `static void Event_${eventIndex}(NSArray<NSString *> *eventValue) {`, `AppKit Table '${table.id}' event signature`);
      source = replaceRequired(
        source,
        `  if (commandId == ${1000 + table.nativeIndex}) { NSInteger row = [(NSTableView *)sender selectedRow]; Event_${eventIndex}(row >= 0 ? PatchListOptionValue(commandId, row) : @""); return; }`,
        `  if (commandId == ${1000 + table.nativeIndex}) { NSInteger row = [(NSTableView *)sender selectedRow]; if (row >= 0) { ++gPatchTableSelectionCount; Event_${eventIndex}(PatchTableRow_${table.nativeIndex}(row)); } return; }`,
        `AppKit Table '${table.id}' selection dispatch`
      );
    }
  }

  source = replaceRequired(source, 'static NSInteger PatchListOptionCount(NSInteger commandId) {', `${tableHelpers(adapted)}\nstatic NSInteger PatchListOptionCount(NSInteger commandId) {`, 'AppKit Table helper insertion');
  source = replaceRequired(source, '- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView { return PatchListOptionCount(tableView.tag); }', '- (NSInteger)numberOfRowsInTableView:(NSTableView *)tableView { NSInteger count = PatchTableRowCount(tableView.tag); return count >= 0 ? count : PatchListOptionCount(tableView.tag); }', 'AppKit Table row-count datasource');
  source = replaceRequired(source, '  NSTextField *label = [NSTextField labelWithString:PatchListOptionValue(tableView.tag, row)];', '  NSInteger column = [tableColumn.identifier integerValue];\n  NSString *value = PatchTableCellValue(tableView.tag, row, column);\n  NSTextField *label = [NSTextField labelWithString:value ?: PatchListOptionValue(tableView.tag, row)];', 'AppKit Table cell datasource');
  source = injectSmoke(source, adapted);
  assertNoShadowState(source, adapted);
  return source;
}

function tableHelpers(adapted) {
  const countCases = adapted.tables.map(table => `    case ${1000 + table.nativeIndex}: return ${table.rows.length};`).join('\n');
  const cellCases = adapted.tables.map(table => {
    const rows = table.rows.map((row, rowIndex) => `      case ${rowIndex}: switch (column) { ${row.map((value, columnIndex) => `case ${columnIndex}: return ${objc(value)};`).join(' ')} default: return @""; }`).join('\n');
    return `    case ${1000 + table.nativeIndex}: switch (row) {\n${rows}\n      default: return @"";\n    }`;
  }).join('\n');
  const rowFunctions = adapted.tables.map(table => {
    const cases = table.rows.map((row, rowIndex) => `    case ${rowIndex}: return @[${row.map(objc).join(', ')}];`).join('\n');
    return `static NSArray<NSString *> *PatchTableRow_${table.nativeIndex}(NSInteger row) {\n  switch (row) {\n${cases}\n    default: return @[];\n  }\n}`;
  }).join('\n');
  return `static NSInteger gPatchTableSelectionCount = 0;\nstatic NSInteger PatchTableRowCount(NSInteger commandId) {\n  switch (commandId) {\n${countCases}\n    default: return -1;\n  }\n}\nstatic NSString *PatchTableCellValue(NSInteger commandId, NSInteger row, NSInteger column) {\n  switch (commandId) {\n${cellCases}\n    default: return nil;\n  }\n}\n${rowFunctions}`;
}

function tableCreate(adapted, table) {
  const control = adapted.controls[table.nativeIndex];
  const rect = appKitRect(control, adapted.ir.forms[control.formIndex], adapted.controls);
  const width = positiveInt(control.layout?.width, 400);
  const height = positiveInt(control.layout?.height, 180);
  const target = control.parentTabIndex >= 0 ? `(NSView *)[gTabPages[${control.parentTabIndex}] objectAtIndex:${control.pageIndex}]` : 'window.contentView';
  const columnWidth = Math.max(40, Math.floor(width / Math.max(1, table.columns.length)));
  const columns = table.columns.map((title, index) => `    { NSTableColumn *column = [[NSTableColumn alloc] initWithIdentifier:${objc(String(index))}]; column.title = ${objc(title)}; column.width = ${index + 1 === table.columns.length ? Math.max(40, width - columnWidth * index) : columnWidth}; [control addTableColumn:column]; }`).join('\n');
  return `  if (${control.formIndex} == index) {\n    NSScrollView *scroll = [[NSScrollView alloc] initWithFrame:${rect}]; scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.borderType = NSBezelBorder; NSTableView *control = [[NSTableView alloc] initWithFrame:NSMakeRect(0, 0, ${width}, ${height})];\n${columns}\n    control.allowsMultipleSelection = NO; control.allowsEmptySelection = YES; control.tag = ${1000 + table.nativeIndex}; control.dataSource = gEventTarget; control.delegate = gEventTarget; scroll.documentView = control; gControls[${table.nativeIndex}] = control; [${target} addSubview:scroll];\n  }`;
}

function legacyListBoxCreate(adapted, table) {
  const control = adapted.controls[table.nativeIndex];
  const rect = appKitRect(control, adapted.ir.forms[control.formIndex], adapted.controls);
  const width = positiveInt(control.layout?.width, 400);
  const height = positiveInt(control.layout?.height, 180);
  const target = control.parentTabIndex >= 0 ? `(NSView *)[gTabPages[${control.parentTabIndex}] objectAtIndex:${control.pageIndex}]` : 'window.contentView';
  return `  if (${control.formIndex} == index) {\n    NSScrollView *scroll = [[NSScrollView alloc] initWithFrame:${rect}]; scroll.hasVerticalScroller = YES; scroll.autohidesScrollers = YES; scroll.borderType = NSBezelBorder; NSTableView *control = [[NSTableView alloc] initWithFrame:NSMakeRect(0, 0, ${width}, ${height})]; NSTableColumn *column = [[NSTableColumn alloc] initWithIdentifier:@"value"]; column.width = ${width}; [control addTableColumn:column]; control.headerView = nil; control.allowsMultipleSelection = NO; control.allowsEmptySelection = YES; control.tag = ${1000 + table.nativeIndex}; control.dataSource = gEventTarget; control.delegate = gEventTarget; scroll.documentView = control; gControls[${table.nativeIndex}] = control; [${target} addSubview:scroll];\n  }`;
}

function removeShadowState(source, table) {
  return replaceRequired(source, `static NSString *patch_state_${identifier(table.shadowState)} = @"__patch_table_row_0";\n`, '', `AppKit Table '${table.id}' shadow state`);
}
function removeShadowRefresh(source, table) {
  const state = `patch_state_${identifier(table.shadowState)}`;
  const marker = `  if (gControls[${table.nativeIndex}]) { NSInteger selected = -1; if ([${state} isEqualToString:@"__patch_table_row_0"]) selected = 0; else if ([${state} isEqualToString:@"__patch_table_row_1"]) selected = 1; if (selected >= 0) [(NSTableView *)gControls[${table.nativeIndex}] selectRowIndexes:[NSIndexSet indexSetWithIndex:(NSUInteger)selected] byExtendingSelection:NO]; else [(NSTableView *)gControls[${table.nativeIndex}] deselectAll:nil]; }\n`;
  return replaceRequired(source, marker, '', `AppKit Table '${table.id}' shadow refresh`);
}

function injectSmoke(source, adapted) {
  const checks = [];
  let code = 150;
  for (const table of adapted.tables) {
    const last = Math.max(0, table.rows.length - 1);
    checks.push(`  if (!gControls[${table.nativeIndex}] || [(NSTableView *)gControls[${table.nativeIndex}] numberOfColumns] != ${table.columns.length} || [(NSTableView *)gControls[${table.nativeIndex}] numberOfRows] != ${table.rows.length}) return ${code++};`);
    checks.push(`  { NSInteger before = gPatchTableSelectionCount; [(NSTableView *)gControls[${table.nativeIndex}] selectRowIndexes:[NSIndexSet indexSetWithIndex:${last}] byExtendingSelection:NO]; [gEventTarget handleControl:gControls[${table.nativeIndex}]]; if (gPatchTableSelectionCount <= before) return ${code++}; }`);
  }
  const marker = '  [NSApp stop:nil];';
  const index = source.indexOf(marker, source.indexOf('static int RunPatchSmoke() {'));
  if (index < 0) throw new NativeGuiError('Generated AppKit source is missing Table smoke insertion point.');
  return source.slice(0, index) + checks.join('\n') + '\n' + source.slice(index);
}

function appKitRect(control, form, controls) {
  const width = positiveInt(control.layout?.width, 120), height = positiveInt(control.layout?.height, 36);
  const x = layoutInt(control.layout?.x, control.parentTabIndex >= 0 ? 12 : 24);
  const sourceY = layoutInt(control.layout?.y, control.parentTabIndex >= 0 ? 12 : 24);
  if (control.parentTabIndex < 0) return `NSMakeRect(${x}, ${Math.max(0, positiveInt(form.height, 420) - sourceY - height)}, ${width}, ${height})`;
  const tab = controls[control.parentTabIndex];
  if (!tab || tab.type !== 'tabs') throw new NativeGuiError(`AppKit Table '${control.id}' has an invalid Tabs parent.`);
  const pageHeight = Math.max(1, positiveInt(tab.layout?.height, 240) - 30);
  return `NSMakeRect(${x}, ${Math.max(0, pageHeight - sourceY - height)}, ${width}, ${height})`;
}
function assertNoShadowState(source, adapted) { for (const table of adapted.tables) if (source.includes(table.shadowState)) throw new NativeGuiError(`AppKit Table '${table.id}' leaked backend shadow state.`); }
function replaceRequired(source, marker, replacement, label) { if (!source.includes(marker)) throw new NativeGuiError(`${label} marker is missing from generated AppKit source.`); return source.replace(marker, replacement); }
function identifier(value) { return String(value).replace(/[^A-Za-z0-9_]/g, '_').replace(/^[0-9]/, '_$&'); }
function layoutInt(value, fallback) { return Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : fallback; }
function positiveInt(value, fallback) { return Number.isFinite(Number(value)) ? Math.max(1, Math.round(Number(value))) : fallback; }
function objc(value) { return `@${JSON.stringify(String(value ?? ''))}`; }
