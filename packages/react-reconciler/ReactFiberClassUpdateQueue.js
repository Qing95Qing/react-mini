import {
    enqueueConcurrentClassUpdate,
    unsafe_markUpdateLaneFromFiberToRoot,
} from './ReactFiberConcurrentUpdates';
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
        // 只会发生在fiber未挂载时
        return null;
    }

    const sharedQueue = updateQueue.shared;

    // 类组件中为了componentWillReceive而做的检查，检查该更新是否是一个渲染阶段的更新
    if (isUnsafeClassRenderPhaseUpdate(fiber)) {
        // 这是一个render阶段的更新，直接将更新加到更新队列中，以便在本次渲染任务中立即处理
        const pending = sharedQueue.pending;
        if (pending === null) {
            update.next = update;
        } else {
            update.next = pending.next;
            pending.next = update;
        }
        sharedQueue.pending = update;

        // 1）从当前节点向上找root并最后返回
        // 2）从当前更新fiber向上将子fiber的lane合并到父fiber的childLanes
        return unsafe_markUpdateLaneFromFiberToRoot(fiber, lane);
    } else {
        return enqueueConcurrentClassUpdate(fiber, sharedQueue, update, lane);
    }
}
