let renderLanes = NoLanes;

let currentlyRenderingFiber = null;

let currentHook = null;
let workInProgressHook = null;
let didScheduleRenderPhaseUpdate = false;
let didScheduleRenderPhaseUpdateDuringThisPass = false;

export function resetHooksOnUnwind(workInProgress) {
    if (didScheduleRenderPhaseUpdate) {
        let hook = workInProgress.memoizedState;
        while (hook !== null) {
            const queue = hook.queue;
            if (queue !== null) {
                queue.pending = null;
            }
            hook = hook.next;
        }
        didScheduleRenderPhaseUpdate = false;
    }

    renderLanes = NoLanes;
    currentlyRenderingFiber = null;

    currentHook = null;
    workInProgressHook = null;

    didScheduleRenderPhaseUpdateDuringThisPass = false;
    localIdCounter = 0;
    thenableIndexCounter = 0;
    thenableState = null;
}
