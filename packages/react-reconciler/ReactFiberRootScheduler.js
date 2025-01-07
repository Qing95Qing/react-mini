import { claimNextTransitionLane } from './ReactFiberLane';

let currentEventTransitionLane = NoLane;

let isFlushingWork = false;
let mightHavePendingSyncWork = false;

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

  // There may or may not be synchronous work scheduled. Let's check.
  let didPerformSomeWork;
  isFlushingWork = true;
  do {
    didPerformSomeWork = false;
    let root = firstScheduledRoot;
    while (root !== null) {
      if (onlyLegacy && (disableLegacyMode || root.tag !== LegacyRoot)) {
        // Skip non-legacy roots.
      } else {
        if (syncTransitionLanes !== NoLanes) {
          const nextLanes = getNextLanesToFlushSync(root, syncTransitionLanes);
          if (nextLanes !== NoLanes) {
            // This root has pending sync work. Flush it now.
            didPerformSomeWork = true;
            performSyncWorkOnRoot(root, nextLanes);
          }
        } else {
          const workInProgressRoot = getWorkInProgressRoot();
          const workInProgressRootRenderLanes =
            getWorkInProgressRootRenderLanes();
          const nextLanes = getNextLanes(
            root,
            root === workInProgressRoot
              ? workInProgressRootRenderLanes
              : NoLanes,
          );
          if (
            includesSyncLane(nextLanes) &&
            !checkIfRootIsPrerendering(root, nextLanes)
          ) {
            // This root has pending sync work. Flush it now.
            didPerformSomeWork = true;
            performSyncWorkOnRoot(root, nextLanes);
          }
        }
      }
      root = root.next;
    }
  } while (didPerformSomeWork);
  isFlushingWork = false;
}
