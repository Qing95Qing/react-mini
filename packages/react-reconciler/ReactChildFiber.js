let thenableState = null;
let thenableIndexCounter = 0;

export function resetChildReconcilerOnUnwind() {
    thenableState = null;
    thenableIndexCounter = 0;
}
