export function clone(value) { return value === undefined ? undefined : structuredClone(value); }

export function formatValue(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.join(', ');
  if (value && typeof value === 'object') return Object.entries(value).map(([k,v]) => `${k}=${formatValue(v)}`).join(', ');
  return String(value);
}

export function touchedPaths(change) { return new Set(change.operations.map(op => op.field ? `${change.target}.${op.field}` : change.target)); }

export function invertChange(change) {
  return {
    id:`${change.id}:inverse`, target:change.target, name:change.name?`undo_${change.name}`:null,
    baseVersion:change.newVersion, newVersion:change.baseVersion,
    operations:clone(change.inverseOperations), inverseOperations:clone(change.operations),
    before:clone(change.after), after:clone(change.before)
  };
}

export function composeChanges(a,b) {
  if(a.target!==b.target) throw new Error('Only changes to the same target can be composed.');
  if(a.newVersion!==b.baseVersion) throw new Error('Changes must be consecutive to compose safely.');
  return {
    id:`${a.id}+${b.id}`, target:a.target, name:null,
    baseVersion:a.baseVersion, newVersion:b.newVersion,
    operations:[...clone(a.operations),...clone(b.operations)],
    inverseOperations:[...clone(b.inverseOperations),...clone(a.inverseOperations)],
    before:clone(a.before), after:clone(b.after)
  };
}

function isCommutingPair(a,b){ if(a.field!==b.field) return true; return a.op==='addNumber'&&b.op==='addNumber'; }

export function changesConflict(a,b) {
  if(a.target!==b.target) return false;
  if(a.baseVersion!==b.baseVersion) return true;
  for(const opA of a.operations) for(const opB of b.operations){
    const pathA=opA.field??'$'; const pathB=opB.field??'$';
    if(pathA===pathB&&!isCommutingPair(opA,opB)) return true;
  }
  return false;
}

export function applySemanticOperations(value,operations) {
  let current=clone(value);
  for(const op of operations){
    if(op.op==='restore'){current=clone(op.value);continue;}
    const hasField=Boolean(op.field); const old=hasField?current[op.field]:current; let next;
    if(op.op==='set') next=clone(op.value);
    else if(op.op==='addNumber') next=Number(old)+Number(op.value);
    else if(op.op==='append') next=[...old,clone(op.value)];
    else if(op.op==='appendText') next=String(old)+String(op.value);
    else if(op.op==='removeNumber') next=Number(old)-Number(op.value);
    else if(op.op==='removeAt'){next=[...old];next.splice(op.index,1);}
    else if(op.op==='insertAt'){next=[...old];next.splice(op.index,0,clone(op.value));}
    else if(op.op==='clear'){
      if(Array.isArray(old))next=[]; else if(typeof old==='string')next=''; else if(typeof old==='number')next=0; else if(typeof old==='boolean')next=false; else if(old&&typeof old==='object')next={}; else next=null;
    } else throw new Error(`Unknown semantic operation ${op.op}`);
    if(hasField) current={...current,[op.field]:next}; else current=next;
  }
  return current;
}
