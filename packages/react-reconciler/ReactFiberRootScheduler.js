import {
    claimNextTransitionLane,
    getHighestPriorityLane,
    getNextLanes,
    NoLane,
} from './ReactFiberLane';
import {
    CommitContext,
    getExecutionContext,
    getWorkInProgressRoot,
    getWorkInProgressRootRenderLanes,
    isWorkLoopSuspendedOnData,
    RenderContext,
} from './ReactFiberWorkLoop';

import { unstable_cancelCallback as Scheduler_cancelCallback } from '../scheduler/Scheduler';
import {
    UserBlockingPriority as UserBlockingSchedulerPriority,
    ImmediatePriority as ImmediateSchedulerPriority,
    NormalPriority as NormalSchedulerPriority,
    IdlePriority as IdleSchedulerPriority,
} from '../scheduler/SchedulerPriorities';
import {
    scheduleMicrotask,
    supportsMicrotasks,
} from '../react-dom-bindings/ReactFiberConfigDOM';

let currentEventTransitionLane = NoLane;

let isFlushingWork = false;
let mightHavePendingSyncWork = false;
let firstScheduledRoot = null;
let lastScheduledRoot = null;
let didScheduleMicrotask = false;

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

export function ensureRootIsScheduled(root) {
    // 当root接受到一个更新时都会执行该函数，该函数主要做两件事：
    // 1) 保证root在root schedule中，2) 保证有pending microtask来处理root schedule
    // 大多数实际的schedule逻辑只有当scheduleTaskForRootDuringMicrotask执行时才会执行

    // 将root添加到schedule的root环状链表中
    if (root === lastScheduledRoot || root.next !== null) {
        // root已经调度了，则跳过.
    } else {
        // 调度root的记录结构是一个环状链表
        if (lastScheduledRoot === null) {
            firstScheduledRoot = lastScheduledRoot = root;
        } else {
            lastScheduledRoot.next = root;
            lastScheduledRoot = root;
        }
    }

    // root接受到update时设置为true，当调度被处理时设置为false
    // 当为false时，可以快速地退出flushSync，而不需要与schedule协商
    mightHavePendingSyncWork = true;

    // 遍历每个root，确保每个root根据其优先级都有一个调度任务
    if (!didScheduleMicrotask) {
        didScheduleMicrotask = true;
        scheduleImmediateTask(processRootScheduleInMicrotask);
    }
}

function scheduleImmediateTask(cb) {
    if (supportsMicrotasks) {
        // 根据兼容性降级选择：window.queueMicrotask、Promise、setTimeout
        scheduleMicrotask(() => {
            const executionContext = getExecutionContext();
            if (
                (executionContext & (RenderContext | CommitContext)) !==
                NoContext
            ) {
                // 不在 【渲染】or【提交】阶段
                // 如果这发生在渲染和提交之外，仍然会过早刷新回调
                // 使用宏任务代替微任务。直觉上可能不对，但这组织了无限循环（safari的bug）
                Scheduler_scheduleCallback(ImmediateSchedulerPriority, cb);
                return;
            }
            cb();
        });
    } else {
        // If microtasks are not supported, use Scheduler.
        Scheduler_scheduleCallback(ImmediateSchedulerPriority, cb);
    }
}

function processRootScheduleInMicrotask() {
    // 该函数在微任务中被调用
    didScheduleMicrotask = false;
    mightHavePendingSyncWork = false;

    let syncTransitionLanes = NoLane;
    if (currentEventTransitionLane !== NoLane) {
        currentEventTransitionLane = NoLane;
    }

    const currentTime = now();

    let prev = null;
    let root = firstScheduledRoot;
    while (root !== null) {
        const next = root.next;
        const nextLanes = scheduleTaskForRootDuringMicrotask(root, currentTime);
        if (nextLanes === NoLane) {
            // This root has no more pending work. Remove it from the schedule. To
            // guard against subtle reentrancy bugs, this microtask is the only place
            // we do this — you can add roots to the schedule whenever, but you can
            // only remove them here.

            // Null this out so we know it's been removed from the schedule.
            root.next = null;
            if (prev === null) {
                // This is the new head of the list
                firstScheduledRoot = next;
            } else {
                prev.next = next;
            }
            if (next === null) {
                // This is the new tail of the list
                lastScheduledRoot = prev;
            }
        } else {
            // This root still has work. Keep it in the list.
            prev = root;

            // This is a fast-path optimization to early exit from
            // flushSyncWorkOnAllRoots if we can be certain that there is no remaining
            // synchronous work to perform. Set this to true if there might be sync
            // work left.
            if (
                // Skip the optimization if syncTransitionLanes is set
                syncTransitionLanes !== NoLanes ||
                // Common case: we're not treating any extra lanes as synchronous, so we
                // can just check if the next lanes are sync.
                includesSyncLane(nextLanes)
            ) {
                mightHavePendingSyncWork = true;
            }
        }
        root = next;
    }

    // At the end of the microtask, flush any pending synchronous work. This has
    // to come at the end, because it does actual rendering work that might throw.
    flushSyncWorkAcrossRoots_impl(syncTransitionLanes, false);
}

function scheduleTaskForRootDuringMicrotask(root, currentTime) {
    // 该函数在微任务中调用，或是在每个渲染任务结束、让出主线程前。不能被同步调用

    // 检查是否是否有lanes快被starved，如果有，则标记他们为过期，便于在下一次调度中执行
    // 遍历root.pendingLanes，
    // 1）根据中每个lane的类型，更新root.expirationTimes上对应lane的过期时间
    // 2）若过期时间小于当前时间将当前lane添加到root.expiredLanes中
    markStarvedLanesAsExpired(root, currentTime);

    // Determine the next lanes to work on, and their priority.
    const workInProgressRoot = getWorkInProgressRoot();
    const workInProgressRootRenderLanes = getWorkInProgressRootRenderLanes();
    const nextLanes = getNextLanes(
        root,
        root === workInProgressRoot ? workInProgressRootRenderLanes : NoLanes
    );

    const existingCallbackNode = root.callbackNode;
    // 没有要做的任务 or 当前循环被一些数据给暂停了 or  cancelPendingCommit不为空
    // 跳过后续处理
    if (
        nextLanes === NoLane ||
        (root === workInProgressRoot && isWorkLoopSuspendedOnData()) ||
        root.cancelPendingCommit !== null
    ) {
        if (existingCallbackNode !== null) {
            cancelCallback(existingCallbackNode);
        }
        root.callbackNode = null;
        root.callbackPriority = NoLane;
        return NoLane;
    }

    // 调度一个新的callback在宿主环境
    if (includesSyncLane(nextLanes)) {
        // 同步任务总是在微任务最后被全部清理完成，所以不需要调度额外的任务
        if (existingCallbackNode !== null) {
            cancelCallback(existingCallbackNode);
        }
        root.callbackPriority = SyncLane;
        root.callbackNode = null;
        return SyncLane;
    } else {
        // 使用lanes的最高优先级来代表回调的优先级
        const existingCallbackPriority = root.callbackPriority;
        const newCallbackPriority = getHighestPriorityLane(nextLanes);

        // 取消现存的回调，后面会调度一个新的
        cancelCallback(existingCallbackNode);

        // 将lanes转换为事件优先级
        let schedulerPriorityLevel;
        switch (lanesToEventPriority(nextLanes)) {
            case DiscreteEventPriority:
            case ContinuousEventPriority:
                schedulerPriorityLevel = UserBlockingSchedulerPriority;
                break;
            case DefaultEventPriority:
                schedulerPriorityLevel = NormalSchedulerPriority;
                break;
            case IdleEventPriority:
                schedulerPriorityLevel = IdleSchedulerPriority;
                break;
            default:
                schedulerPriorityLevel = NormalSchedulerPriority;
                break;
        }

        const newCallbackNode = scheduleCallback(
            schedulerPriorityLevel,
            performWorkOnRootViaSchedulerTask.bind(null, root)
        );

        root.callbackPriority = newCallbackPriority;
        root.callbackNode = newCallbackNode;
        return newCallbackPriority;
    }
}

function cancelCallback(callbackNode) {
    if (callbackNode !== null) {
        Scheduler_cancelCallback(callbackNode);
    }
}
