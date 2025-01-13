import { pickArbitraryLane, SyncLane } from './ReactFiberLane';
import { ConcurrentMode, NoMode } from './ReactTypeOfMode';
import { requestCurrentTransition } from './ReactFiberTransition';
import { peekEntangledActionLane } from './ReactFiberAsyncAction';
import {
    flushSyncWorkOnAllRoots,
    requestTransitionLane,
} from './ReactFiberRootScheduler';
import { resolveUpdatePriority } from '../react-dom-bindings/ReactDOMUpdatePriority';
import { eventPriorityToLane } from './ReactEventPriorities';
import { disableLegacyMode } from '../shared/ReactFeatureFlags';

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
export const RenderContext = /*         */ 0b010;
export const CommitContext = /*         */ 0b100;

let executionContext = NoContext;

const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount = 0;
let rootWithNestedUpdates = null;
let isFlushingPassiveEffects = false;
let didScheduleUpdateDuringPassiveEffects = false;

const NESTED_PASSIVE_UPDATE_LIMIT = 50;
let nestedPassiveUpdateCount = 0;
let rootWithPassiveNestedUpdates = null;

let isRunningInsertionEffect = false;
export function requestUpdateLane(fiber) {
    // 获取当前fiber节点的lanes
    const { mode } = fiber;
    // 1）、模式检查：不是Concurrent模式，则返回 SyncLane，标识更新需要同步执行
    if ((mode & ConcurrentMode) === NoMode) {
        return SyncLane;
    } else if (
        (executionContext & RenderContext) !== NoContext &&
        workInProgressRootRenderLanes !== NoLanes
    ) {
        // 2） 渲染上下文检查
        // 如果当前处于渲染上下文中且有正在渲染的 Lanes，则返回当前渲染优先级中的任意一个优先级
        // 这种情况通常发生在渲染阶段调用 setState 时。
        return pickArbitraryLane(workInProgressRootRenderLanes);
    }

    // 3）Transition检查
    const transition = requestCurrentTransition();
    if (transition !== null) {
        // 获取当前的 Action Scope Lane
        const actionScopeLane = peekEntangledActionLane();
        return actionScopeLane !== NoLane
            ? // 如果在异步 Action Scope 中，则重用相同的 Lane
              actionScopeLane
            : // 否则，获取一个新的 Transition Lane
              requestTransitionLane(transition);
    }
    // 4）事件优先级：根据事件优先级返回相应的 Lane
    return eventPriorityToLane(resolveUpdatePriority());
}

export function isUnsafeClassRenderPhaseUpdate(fiber) {
    // 检查是否是一个渲染阶段的update，只会被类组件调用
    // 为了UNSAFE_componentWillReceive而设置的特殊行为
    // which special (deprecated) behavior for UNSAFE_componentWillReceive props.
    return (executionContext & RenderContext) !== NoContext;
}

export function batchedUpdates(fn, a) {
    // 批处理更新现在没有多余的操作，只是调用 fn(a)，为了兼容内部react-dom的调用
    if (disableLegacyMode) {
        return fn(a);
    } else {
        // 后面省略，不走这里
    }
}

export function flushSyncWork() {
    // 不在render和commit阶段
    if ((executionContext & (RenderContext | CommitContext)) === NoContext) {
        flushSyncWorkOnAllRoots();
        return false;
    }
    return true;
}

export function throwIfInfiniteUpdateLoopDetected() {
    if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
        nestedUpdateCount = 0;
        nestedPassiveUpdateCount = 0;
        rootWithNestedUpdates = null;
        rootWithPassiveNestedUpdates = null;

        throw new Error(
            'Maximum update depth exceeded. This can happen when a component ' +
                'repeatedly calls setState inside componentWillUpdate or ' +
                'componentDidUpdate. React limits the number of nested updates to ' +
                'prevent infinite loops.'
        );
    }
}

export function scheduleUpdateOnFiber(root, fiber, lane) {
    // Check if the work loop is currently suspended and waiting for data to
    // finish loading.
    // 检查工作循环当前是否suspend或在等待数据加载
    if (
        // Suspended render phase
        (root === workInProgressRoot &&
            workInProgressSuspendedReason === SuspendedOnData) ||
        // Suspended commit phase
        root.cancelPendingCommit !== null
    ) {
        // The incoming update might unblock the current render. Interrupt the
        // current attempt and restart from the top.
        prepareFreshStack(root, NoLanes);
        const didAttemptEntireTree = false;
        markRootSuspended(
            root,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            didAttemptEntireTree
        );
    }

    // Mark that the root has a pending update.
    markRootUpdated(root, lane);

    if (
        (executionContext & RenderContext) !== NoLanes &&
        root === workInProgressRoot
    ) {
        // This update was dispatched during the render phase. This is a mistake
        // if the update originates from user space (with the exception of local
        // hook updates, which are handled differently and don't reach this
        // function), but there are some internal React features that use this as
        // an implementation detail, like selective hydration.
        warnAboutRenderPhaseUpdatesInDEV(fiber);

        // Track lanes that were updated during the render phase
        workInProgressRootRenderPhaseUpdatedLanes = mergeLanes(
            workInProgressRootRenderPhaseUpdatedLanes,
            lane
        );
    } else {
        // This is a normal update, scheduled from outside the render phase. For
        // example, during an input event.
        if (enableUpdaterTracking) {
            if (isDevToolsPresent) {
                addFiberToLanesMap(root, fiber, lane);
            }
        }

        warnIfUpdatesNotWrappedWithActDEV(fiber);

        if (enableTransitionTracing) {
            const transition = ReactSharedInternals.T;
            if (transition !== null && transition.name != null) {
                if (transition.startTime === -1) {
                    transition.startTime = now();
                }

                // $FlowFixMe[prop-missing]: The BatchConfigTransition and Transition types are incompatible but was previously untyped and thus uncaught
                // $FlowFixMe[incompatible-call]: "
                addTransitionToLanesMap(root, transition, lane);
            }
        }

        if (root === workInProgressRoot) {
            // Received an update to a tree that's in the middle of rendering. Mark
            // that there was an interleaved update work on this root.
            if ((executionContext & RenderContext) === NoContext) {
                workInProgressRootInterleavedUpdatedLanes = mergeLanes(
                    workInProgressRootInterleavedUpdatedLanes,
                    lane
                );
            }
            if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
                // The root already suspended with a delay, which means this render
                // definitely won't finish. Since we have a new update, let's mark it as
                // suspended now, right before marking the incoming update. This has the
                // effect of interrupting the current render and switching to the update.
                // TODO: Make sure this doesn't override pings that happen while we've
                // already started rendering.
                const didAttemptEntireTree = false;
                markRootSuspended(
                    root,
                    workInProgressRootRenderLanes,
                    workInProgressDeferredLane,
                    didAttemptEntireTree
                );
            }
        }

        ensureRootIsScheduled(root);
        if (
            lane === SyncLane &&
            executionContext === NoContext &&
            !disableLegacyMode &&
            (fiber.mode & ConcurrentMode) === NoMode
        ) {
            if (__DEV__ && ReactSharedInternals.isBatchingLegacy) {
                // Treat `act` as if it's inside `batchedUpdates`, even in legacy mode.
            } else {
                // Flush the synchronous work now, unless we're already working or inside
                // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
                // scheduleCallbackForFiber to preserve the ability to schedule a callback
                // without immediately flushing it. We only do this for user-initiated
                // updates, to preserve historical behavior of legacy mode.
                resetRenderTimer();
                flushSyncWorkOnLegacyRootsOnly();
            }
        }
    }
}
