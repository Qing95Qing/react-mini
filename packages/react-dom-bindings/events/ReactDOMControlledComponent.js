

let restoreTarget = null;
let restoreQueue = null;

export function needsStateRestore() {
  return restoreTarget !== null || restoreQueue !== null;
}