import {
    checkIfRootIsPrerendering,
    getEntangledLanes,
    markRootUpdated,
    mergeLanes,
    pickArbitraryLane,
    removeLanes,
    markRootSuspended as _markRootSuspended,
    SyncLane,
} from './ReactFiberLane';
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
import { noTimeout, cancelTimeout } from './ReactFiberConfig';
import { resetContextDependencies } from './ReactFiberNewContext';
import { resetHooksOnUnwind } from './ReactFiberHooks';
import { resetChildReconcilerOnUnwind } from './ReactChildFiber';
import { createWorkInProgress } from './ReactFiber';
import { finishQueueingConcurrentUpdates } from './ReactFiberConcurrentUpdates';

export const NoContext = /*             */ 0b000;
const BatchedContext = /*               */ 0b001;
export const RenderContext = /*         */ 0b010;
export const CommitContext = /*         */ 0b100;

const RootInProgress = 0;
const RootFatalErrored = 1;
const RootErrored = 2;
const RootSuspended = 3;
const RootSuspendedWithDelay = 4;
const RootCompleted = 5;
const RootDidNotComplete = 6;

let executionContext = NoContext;
// 记录当前的工作root
let workInProgressRoot = null;
// 正在工作的fiber节点
let workInProgress = null;
// 当前渲染的lanes
let workInProgressRootRenderLanes = NoLanes;

const NotSuspended = 0;
const SuspendedOnError = 1;
const SuspendedOnData = 2;
const SuspendedOnImmediate = 3;
const SuspendedOnInstance = 4;
const SuspendedOnInstanceAndReadyToContinue = 5;
const SuspendedOnDeprecatedThrowPromise = 6;
const SuspendedAndReadyToContinue = 7;
const SuspendedOnHydration = 8;

const NESTED_UPDATE_LIMIT = 50;
let nestedUpdateCount = 0;
let workInProgressSuspendedReason = NotSuspended;
let workInProgressThrownValue = null;

let workInProgressRootDidSkipSuspendedSiblings = false;
let workInProgressRootIsPrerendering = false;
let workInProgressRootDidAttachPingListener = false;
export let entangledRenderLanes = NoLanes;

let workInProgressRootExitStatus = RootInProgress;
let workInProgressRootSkippedLanes = NoLanes;
let workInProgressRootInterleavedUpdatedLanes = NoLanes;
let workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
let workInProgressRootPingedLanes = NoLanes;
let workInProgressDeferredLane = NoLane;
let workInProgressSuspendedRetryLanes = NoLanes;
let workInProgressRootConcurrentErrors = null;
let workInProgressRootRecoverableErrors = null;

let workInProgressRootDidIncludeRecursiveRenderUpdate = false;
let didIncludeCommitPhaseUpdate = false;
let globalMostRecentFallbackTime = 0;
const FALLBACK_THROTTLE_MS = 300;
let workInProgressRootRenderTargetTime = Infinity;
const RENDER_TIMEOUT_MS = 500;

let workInProgressTransitions = null;
export function getWorkInProgressRoot() {
    return workInProgressRoot;
}

export function getWorkInProgressRootRenderLanes() {
    return workInProgressRootRenderLanes;
}

export function isWorkLoopSuspendedOnData() {
    return workInProgressSuspendedReason === SuspendedOnData;
}
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
    // 检查工作循环当前是否suspend或在等待数据加载
    if (
        // 在render或commit阶段被阻塞
        (root === workInProgressRoot &&
            workInProgressSuspendedReason === SuspendedOnData) ||
        root.cancelPendingCommit !== null
    ) {
        // 传入的更新可能会解除当前渲染的阻碍。中断当前尝试并从顶部重新开始。

        // 重置记录工作状态的全局变量，生成一个新的workInProgress
        prepareFreshStack(root, NoLanes);
        const didAttemptEntireTree = false;
        // 更新root的suspendedLanes、pingedLanes
        markRootSuspended(
            root,
            workInProgressRootRenderLanes,
            workInProgressDeferredLane,
            didAttemptEntireTree
        );
    }

    // 将当前更新对应lane添加到root.pendingLanes中
    markRootUpdated(root, lane);

    // 当前root指向的fiber树在render或commit阶段有pending的任务
    // 对全局变量标记 or 在root上标记
    if (root === workInProgressRoot) {
        if ((executionContext & RenderContext) === NoContext) {
            // 如果当前不处于渲染阶段，全局变量标记当前root有一个交错的更新
            workInProgressRootInterleavedUpdatedLanes = mergeLanes(
                workInProgressRootInterleavedUpdatedLanes,
                lane
            );
        }
        if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
            // root已经暂停了一个delay，意味着渲染工作确实没有结束。
            // 在标记即将镜像的update前，标记root当前处于suspense状态。
            // 产生的影响是：打断了当前的渲染转而去处理更新
            const didAttemptEntireTree = false;
            // 更新root的suspendedLanes、pingedLanes
            markRootSuspended(
                root,
                workInProgressRootRenderLanes,
                workInProgressDeferredLane,
                didAttemptEntireTree
            );
        }
    }

    ensureRootIsScheduled(root);
}

function prepareFreshStack(root, lanes) {
    root.finishedWork = null;
    root.finishedLanes = NoLanes;

    const timeoutHandle = root.timeoutHandle;
    if (timeoutHandle !== noTimeout) {
        root.timeoutHandle = noTimeout;
        cancelTimeout(timeoutHandle);
    }
    const cancelPendingCommit = root.cancelPendingCommit;
    if (cancelPendingCommit !== null) {
        root.cancelPendingCommit = null;
        cancelPendingCommit();
    }

    resetWorkInProgressStack();
    workInProgressRoot = root;
    const rootWorkInProgress = createWorkInProgress(root.current, null);
    workInProgress = rootWorkInProgress;
    workInProgressRootRenderLanes = lanes;
    workInProgressSuspendedReason = NotSuspended;
    workInProgressThrownValue = null;
    workInProgressRootDidSkipSuspendedSiblings = false;
    workInProgressRootIsPrerendering = checkIfRootIsPrerendering(root, lanes);
    workInProgressRootDidAttachPingListener = false;
    workInProgressRootExitStatus = RootInProgress;
    workInProgressRootSkippedLanes = NoLanes;
    workInProgressRootInterleavedUpdatedLanes = NoLanes;
    workInProgressRootRenderPhaseUpdatedLanes = NoLanes;
    workInProgressRootPingedLanes = NoLanes;
    workInProgressDeferredLane = NoLane;
    workInProgressSuspendedRetryLanes = NoLanes;
    workInProgressRootConcurrentErrors = null;
    workInProgressRootRecoverableErrors = null;
    workInProgressRootDidIncludeRecursiveRenderUpdate = false;
    entangledRenderLanes = getEntangledLanes(root, lanes);

    finishQueueingConcurrentUpdates();

    return rootWorkInProgress;
}

function resetWorkInProgressStack() {
    if (workInProgress === null) return;
    let interruptedWork;
    if (workInProgressSuspendedReason === NotSuspended) {
        interruptedWork = workInProgress.return;
    } else {
        resetSuspendedWorkLoopOnUnwind(workInProgress);
        interruptedWork = workInProgress;
    }
    while (interruptedWork !== null) {
        const current = interruptedWork.alternate;
        // TODO:先忽略细节
        //   unwindInterruptedWork(
        //     current,
        //     interruptedWork,
        //     workInProgressRootRenderLanes,
        //   );
        interruptedWork = interruptedWork.return;
    }
    workInProgress = null;
}

function resetSuspendedWorkLoopOnUnwind(fiber) {
    resetContextDependencies();
    resetHooksOnUnwind(fiber);
    resetChildReconcilerOnUnwind();
}

function markRootSuspended(
    root,
    suspendedLanes,
    spawnedLane,
    didAttemptEntireTree
) {
    suspendedLanes = removeLanes(suspendedLanes, workInProgressRootPingedLanes);
    suspendedLanes = removeLanes(
        suspendedLanes,
        workInProgressRootInterleavedUpdatedLanes
    );
    _markRootSuspended(root, suspendedLanes, spawnedLane, didAttemptEntireTree);
}

export function getExecutionContext() {
    return executionContext;
}
