export function duplicateTableRow(data, rowIndex) {
  const table = cloneTableData(data);
  requireIndex(rowIndex, table.rows.length, 'Table row');
  table.rows.splice(rowIndex + 1, 0, [...table.rows[rowIndex]]);
  return { ...table, rowIndex: rowIndex + 1 };
}

export function moveTableRow(data, rowIndex, direction) {
  const table = cloneTableData(data);
  requireIndex(rowIndex, table.rows.length, 'Table row');
  const delta = directionDelta(direction, 'Table row');
  const target = rowIndex + delta;
  if (target < 0 || target >= table.rows.length) return { ...table, rowIndex };
  [table.rows[rowIndex], table.rows[target]] = [table.rows[target], table.rows[rowIndex]];
  return { ...table, rowIndex: target };
}

export function duplicateTableColumn(data, columnIndex) {
  const table = cloneTableData(data);
  requireIndex(columnIndex, table.columns.length, 'Table column');
  table.columns.splice(columnIndex + 1, 0, table.columns[columnIndex]);
  for (const row of table.rows) row.splice(columnIndex + 1, 0, row[columnIndex]);
  return { ...table, columnIndex: columnIndex + 1 };
}

export function moveTableColumn(data, columnIndex, direction) {
  const table = cloneTableData(data);
  requireIndex(columnIndex, table.columns.length, 'Table column');
  const delta = directionDelta(direction, 'Table column', 'left', 'right');
  const target = columnIndex + delta;
  if (target < 0 || target >= table.columns.length) return { ...table, columnIndex };
  [table.columns[columnIndex], table.columns[target]] = [table.columns[target], table.columns[columnIndex]];
  for (const row of table.rows) [row[columnIndex], row[target]] = [row[target], row[columnIndex]];
  return { ...table, columnIndex: target };
}

export function tableActionAvailability(data, rowIndex = 0, columnIndex = 0) {
  const table = cloneTableData(data);
  const rowValid = Number.isInteger(rowIndex) && rowIndex >= 0 && rowIndex < table.rows.length;
  const columnValid = Number.isInteger(columnIndex) && columnIndex >= 0 && columnIndex < table.columns.length;
  return {
    row: {
      duplicate: rowValid,
      up: rowValid && rowIndex > 0,
      down: rowValid && rowIndex < table.rows.length - 1
    },
    column: {
      duplicate: columnValid,
      left: columnValid && columnIndex > 0,
      right: columnValid && columnIndex < table.columns.length - 1
    }
  };
}

function cloneTableData(data) {
  if (!data || !Array.isArray(data.columns) || !Array.isArray(data.rows)) {
    throw new Error('Table action data must contain columns and rows.');
  }
  const columns = data.columns.map(value => String(value ?? '').trim());
  if (!columns.length) throw new Error('A Table needs at least one column.');
  if (columns.some(value => !value)) throw new Error('Table column expressions cannot be empty.');
  const rows = data.rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== columns.length) {
      throw new Error(`Table row ${index + 1} must contain exactly ${columns.length} cells.`);
    }
    const cells = row.map(value => String(value ?? '').trim());
    if (cells.some(value => !value)) throw new Error(`Table row ${index + 1} cells cannot be empty.`);
    return cells;
  });
  return { columns, rows };
}

function requireIndex(index, length, label) {
  if (!Number.isInteger(index) || index < 0 || index >= length) throw new Error(`${label} selection is invalid.`);
}

function directionDelta(direction, label, negative = 'up', positive = 'down') {
  if (direction === negative) return -1;
  if (direction === positive) return 1;
  throw new Error(`${label} direction must be '${negative}' or '${positive}'.`);
}
