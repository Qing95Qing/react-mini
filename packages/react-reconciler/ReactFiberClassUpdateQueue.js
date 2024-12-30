import { isUnsafeClassRenderPhaseUpdate } from './ReactFiberWorkLoop';

export const UpdateState = 0;
export const ReplaceState = 1;
export const ForceUpdate = 2;
export const CaptureUpdate = 3;

export function initializeUpdateQueue(fiber) {
    const queue = {
        baseState: fiber.memoizedState,
        firstBaseUpdate: null,
        lastBaseUpdate: null,
        shared: {
            pending: null,
            lanes: NoLanes,
            hiddenCallbacks: null,
        },
        callbacks: null,
    };
    fiber.updateQueue = queue;
}

export function createUpdate(lane) {
    const update = {
        lane,

        tag: UpdateState,
        payload: null,
        callback: null,

        next: null,
    };
    return update;
}

export function enqueueUpdate(fiber, update, lane) {
    const updateQueue = fiber.updateQueue;
    if (updateQueue === null) {
        // Only occurs if the fiber has been unmounted.
        return null;
    }

    const sharedQueue = updateQueue.shared;

    // 类组件中为了componentWillReceive而做的检查，检查该更新是否是一个渲染阶段的更新
    if (isUnsafeClassRenderPhaseUpdate(fiber)) {
        // This is an unsafe render phase update. Add directly to the update
        // queue so we can process it immediately during the current render.
        const pending = sharedQueue.pending;
        if (pending === null) {
            // This is the first update. Create a circular list.
            update.next = update;
        } else {
            update.next = pending.next;
            pending.next = update;
        }
        sharedQueue.pending = update;

        // Update the childLanes even though we're most likely already rendering
        // this fiber. This is for backwards compatibility in the case where you
        // update a different component during render phase than the one that is
        // currently renderings (a pattern that is accompanied by a warning).
        return unsafe_markUpdateLaneFromFiberToRoot(fiber, lane);
    } else {
        return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
    }
}
