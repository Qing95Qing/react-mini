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
