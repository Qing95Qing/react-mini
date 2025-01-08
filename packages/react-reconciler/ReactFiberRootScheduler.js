import { claimNextTransitionLane } from './ReactFiberLane';

let currentEventTransitionLane = NoLane;

let isFlushingWork = false;
let mightHavePendingSyncWork = false;
let firstScheduledRoot = null;

export function requestTransitionLane() {
    if (currentEventTransitionLane === NoLane) {
        // 同一事件中的所有transitions都被分配到相同的lane
        currentEventTransitionLane = claimNextTransitionLane();
    }
    return currentEventTransitionLane;
}

export function flushSyncWorkOnAllRoots() {
    // 允许同步调用，但调用者应先检查执行上下文。
    flushSyncWorkAcrossRoots_impl(NoLanes, false);
}

function flushSyncWorkAcrossRoots_impl(syncTransitionLanes, onlyLegacy) {
    if (isFlushingWork) {
        // 阻止充入（可能多余的检查）
        return;
    }

    if (!mightHavePendingSyncWork) {
        return;
    }

    let didPerformSomeWork;
    isFlushingWork = true;
    do {
        didPerformSomeWork = false;
        let root = firstScheduledRoot;
        while (root !== null) {
            // 只有legacy模型才走这里的逻辑，Concurrent模式不走
            if (onlyLegacy && (disableLegacyMode || root.tag !== LegacyRoot)) {
                // 非legacy模式跳过.
            } else {
                // concurrent模式先省略
            }
            root = root.next;
        }
    } while (didPerformSomeWork);
    isFlushingWork = false;
}
