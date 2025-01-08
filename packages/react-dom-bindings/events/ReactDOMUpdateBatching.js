import {
    batchedUpdates as batchedUpdatesImpl,
    flushSyncWork,
} from '../../react-reconciler/ReactFiberWorkLoop';
let isInsideEventHandler = false;

export function batchedUpdates(fn, a, b) {
    if (isInsideEventHandler) {
        // If we are currently inside another batch, we need to wait until it
        // fully completes before restoring state.
        return fn(a, b);
    }
    isInsideEventHandler = true;
    try {
        return batchedUpdatesImpl(fn, a, b);
    } finally {
        isInsideEventHandler = false;
        finishEventHandler();
    }
}

function finishEventHandler() {
    const controlledComponentsHavePendingUpdates = needsStateRestore();
    if (controlledComponentsHavePendingUpdates) {
        //  如果触发了受控事件，我们可能需要恢复DOM节点返回受控值。
        // 当React在不接触DOM的情况下退出更新时，这是必要的。
        flushSyncWork();

        restoreStateIfNeeded();
    }
}
