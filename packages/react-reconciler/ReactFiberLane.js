import {
    retryLaneExpirationMs,
    syncLaneExpirationMs,
    transitionLaneExpirationMs,
} from '../shared/ReactFeatureFlags';

export const TotalLanes = 31;

export const NoLanes = /*                        */ 0b0000000000000000000000000000000;
export const NoLane = /*                          */ 0b0000000000000000000000000000000;

export const SyncHydrationLane = /*               */ 0b0000000000000000000000000000001;
export const SyncLane = /*                        */ 0b0000000000000000000000000000010;
export const SyncLaneIndex = 1;

export const InputContinuousHydrationLane = /*    */ 0b0000000000000000000000000000100;
export const InputContinuousLane = /*             */ 0b0000000000000000000000000001000;

export const DefaultHydrationLane = /*            */ 0b0000000000000000000000000010000;
export const DefaultLane = /*                     */ 0b0000000000000000000000000100000;

export const SyncUpdateLanes = SyncLane | InputContinuousLane | DefaultLane;

const TransitionHydrationLane = /*                */ 0b0000000000000000000000001000000;
const TransitionLanes = /*                       */ 0b0000000001111111111111110000000;
const TransitionLane1 = /*                        */ 0b0000000000000000000000010000000;
const TransitionLane2 = /*                        */ 0b0000000000000000000000100000000;
const TransitionLane3 = /*                        */ 0b0000000000000000000001000000000;
const TransitionLane4 = /*                        */ 0b0000000000000000000010000000000;
const TransitionLane5 = /*                        */ 0b0000000000000000000100000000000;
const TransitionLane6 = /*                        */ 0b0000000000000000001000000000000;
const TransitionLane7 = /*                        */ 0b0000000000000000010000000000000;
const TransitionLane8 = /*                        */ 0b0000000000000000100000000000000;
const TransitionLane9 = /*                        */ 0b0000000000000001000000000000000;
const TransitionLane10 = /*                       */ 0b0000000000000010000000000000000;
const TransitionLane11 = /*                       */ 0b0000000000000100000000000000000;
const TransitionLane12 = /*                       */ 0b0000000000001000000000000000000;
const TransitionLane13 = /*                       */ 0b0000000000010000000000000000000;
const TransitionLane14 = /*                       */ 0b0000000000100000000000000000000;
const TransitionLane15 = /*                       */ 0b0000000001000000000000000000000;

const RetryLanes = /*                            */ 0b0000011110000000000000000000000;
const RetryLane1 = /*                             */ 0b0000000010000000000000000000000;
const RetryLane2 = /*                             */ 0b0000000100000000000000000000000;
const RetryLane3 = /*                             */ 0b0000001000000000000000000000000;
const RetryLane4 = /*                             */ 0b0000010000000000000000000000000;

const NonIdleLanes = /*                          */ 0b0000111111111111111111111111111;

export const DeferredLane = /*                    */ 0b1000000000000000000000000000000;
export const IdleLane = /*                        */ 0b0010000000000000000000000000000;
export const UpdateLanes =
    SyncLane | InputContinuousLane | DefaultLane | TransitionLanes;

export const NoTimestamp = -1;

let nextTransitionLane = TransitionLane1;
let nextRetryLane = RetryLane1;

export function getHighestPriorityLane(lanes) {
    return lanes & -lanes;
}

export function pickArbitraryLane(lanes) {
    // 可以获取任意优先级，这里取最高优先级是因为操作最少
    return getHighestPriorityLane(lanes);
}

export function claimNextTransitionLane() {
    // 循环所有的lanes，给下一个lane分配一个新的transition
    // 大多数场景中，这样意味着每个transition能获取到对应的lane，知道所有lane被用完循环回到了初始

    const lane = nextTransitionLane;
    nextTransitionLane <<= 1;
    if ((nextTransitionLane & TransitionLanes) === NoLanes) {
        nextTransitionLane = TransitionLane1;
    }
    return lane;
}

export function createLaneMap(initial) {
    const laneMap = [];
    for (let i = 0; i < TotalLanes; i++) {
        laneMap.push(initial);
    }
    return laneMap;
}

export function mergeLanes(a, b) {
    return a | b;
}

export function removeLanes(set, subset) {
    return set & ~subset;
}

export function checkIfRootIsPrerendering(root, renderLanes) {
    const pendingLanes = root.pendingLanes;
    const suspendedLanes = root.suspendedLanes;
    const pingedLanes = root.pingedLanes;
    const unblockedLanes = pendingLanes & ~(suspendedLanes & ~pingedLanes);

    return (unblockedLanes & renderLanes) === 0;
}

export function getEntangledLanes(root, renderLanes) {
    let entangledLanes = renderLanes;

    if ((entangledLanes & InputContinuousLane) !== NoLanes) {
        entangledLanes |= entangledLanes & DefaultLane;
    }

    const allEntangledLanes = root.entangledLanes;
    if (allEntangledLanes !== NoLanes) {
        const entanglements = root.entanglements;
        let lanes = entangledLanes & allEntangledLanes;
        while (lanes > 0) {
            const index = pickArbitraryLaneIndex(lanes);
            const lane = 1 << index;

            entangledLanes |= entanglements[index];

            lanes &= ~lane;
        }
    }

    return entangledLanes;
}

function pickArbitraryLaneIndex(lanes) {
    return 31 - Math.clz32(lanes);
}

export function markRootSuspended(
    root,
    suspendedLanes,
    spawnedLane,
    didAttemptEntireTree
) {
    root.suspendedLanes |= suspendedLanes;
    root.pingedLanes &= ~suspendedLanes;

    // 清除过期时间（expiration times）
    const expirationTimes = root.expirationTimes;
    let lanes = suspendedLanes;
    while (lanes > 0) {
        const index = pickArbitraryLaneIndex(lanes);
        const lane = 1 << index;

        expirationTimes[index] = NoTimestamp;

        lanes &= ~lane;
    }

    if (spawnedLane !== NoLane) {
        markSpawnedDeferredLane(root, spawnedLane, suspendedLanes);
    }
}

function markSpawnedDeferredLane(root, spawnedLane, entangledLanes) {
    root.pendingLanes |= spawnedLane;
    root.suspendedLanes &= ~spawnedLane;

    const spawnedLaneIndex = pickArbitraryLaneIndex(spawnedLane);
    root.entangledLanes |= spawnedLane;
    root.entanglements[spawnedLaneIndex] |=
        DeferredLane | (entangledLanes & UpdateLanes);
}

export function markRootUpdated(root, updateLane) {
    root.pendingLanes |= updateLane;

    if (updateLane !== IdleLane) {
        root.suspendedLanes = NoLanes;
        root.pingedLanes = NoLanes;
        root.warmLanes = NoLanes;
    }
}

export function markStarvedLanesAsExpired(root, currentTime) {
    const pendingLanes = root.pendingLanes;
    const suspendedLanes = root.suspendedLanes;
    const pingedLanes = root.pingedLanes;
    const expirationTimes = root.expirationTimes;

    let lanes = pendingLanes & ~RetryLanes;
    while (lanes > 0) {
        const index = pickArbitraryLaneIndex(lanes);
        const lane = 1 << index;

        const expirationTime = expirationTimes[index];
        if (expirationTime === NoTimestamp) {
            if (
                (lane & suspendedLanes) === NoLanes ||
                (lane & pingedLanes) !== NoLanes
            ) {
                expirationTimes[index] = computeExpirationTime(
                    lane,
                    currentTime
                );
            }
        } else if (expirationTime <= currentTime) {
            // This lane expired
            root.expiredLanes |= lane;
        }

        lanes &= ~lane;
    }
}

function computeExpirationTime(lane, currentTime) {
    switch (lane) {
        case SyncHydrationLane:
        case SyncLane:
        case InputContinuousHydrationLane:
        case InputContinuousLane:
            return currentTime + syncLaneExpirationMs;
        case DefaultHydrationLane:
        case DefaultLane:
        case TransitionHydrationLane:
        case TransitionLane1:
        case TransitionLane2:
        case TransitionLane3:
        case TransitionLane4:
        case TransitionLane5:
        case TransitionLane6:
        case TransitionLane7:
        case TransitionLane8:
        case TransitionLane9:
        case TransitionLane10:
        case TransitionLane11:
        case TransitionLane12:
        case TransitionLane13:
        case TransitionLane14:
        case TransitionLane15:
            return currentTime + transitionLaneExpirationMs;
        case RetryLane1:
        case RetryLane2:
        case RetryLane3:
        case RetryLane4:
            return NoTimestamp;
        case SelectiveHydrationLane:
        case IdleHydrationLane:
        case IdleLane:
        case OffscreenLane:
        case DeferredLane:
            return NoTimestamp;
        default:
            return NoTimestamp;
    }
}

function getHighestPriorityLanes(lanes) {
    const pendingSyncLanes = lanes & SyncUpdateLanes;
    if (pendingSyncLanes !== 0) {
        return pendingSyncLanes;
    }
    switch (getHighestPriorityLane(lanes)) {
        case SyncHydrationLane:
            return SyncHydrationLane;
        case SyncLane:
            return SyncLane;
        case InputContinuousHydrationLane:
            return InputContinuousHydrationLane;
        case InputContinuousLane:
            return InputContinuousLane;
        case DefaultHydrationLane:
            return DefaultHydrationLane;
        case DefaultLane:
            return DefaultLane;
        case TransitionHydrationLane:
            return TransitionHydrationLane;
        case TransitionLane1:
        case TransitionLane2:
        case TransitionLane3:
        case TransitionLane4:
        case TransitionLane5:
        case TransitionLane6:
        case TransitionLane7:
        case TransitionLane8:
        case TransitionLane9:
        case TransitionLane10:
        case TransitionLane11:
        case TransitionLane12:
        case TransitionLane13:
        case TransitionLane14:
        case TransitionLane15:
            return lanes & TransitionLanes;
        case RetryLane1:
        case RetryLane2:
        case RetryLane3:
        case RetryLane4:
            return lanes & RetryLanes;
        case SelectiveHydrationLane:
            return SelectiveHydrationLane;
        case IdleHydrationLane:
            return IdleHydrationLane;
        case IdleLane:
            return IdleLane;
        case OffscreenLane:
            return OffscreenLane;
        case DeferredLane:
            return NoLanes;
        default:
            return lanes;
    }
}

export function getNextLanes(root, wipLanes) {
    // 没有pending的work了
    const pendingLanes = root.pendingLanes;
    if (pendingLanes === NoLanes) {
        return NoLanes;
    }

    let nextLanes = NoLanes;

    const suspendedLanes = root.suspendedLanes;
    const pingedLanes = root.pingedLanes;
    const warmLanes = root.warmLanes;

    const rootHasPendingCommit = root.finishedLanes !== NoLanes;

    // pendingLanes中还有非Idle的lanes
    const nonIdlePendingLanes = pendingLanes & NonIdleLanes;
    if (nonIdlePendingLanes !== NoLanes) {
        // 获取较新的更新，非阻塞的更新
        const nonIdleUnblockedLanes = nonIdlePendingLanes & ~suspendedLanes;
        if (nonIdleUnblockedLanes !== NoLanes) {
            nextLanes = getHighestPriorityLanes(nonIdleUnblockedLanes);
        } else {
            const nonIdlePingedLanes = nonIdlePendingLanes & pingedLanes;
            if (nonIdlePingedLanes !== NoLanes) {
                nextLanes = getHighestPriorityLanes(nonIdlePingedLanes);
            }
        }
    } else {
        // 剩下的Idle工作

        const unblockedLanes = pendingLanes & ~suspendedLanes;
        if (unblockedLanes !== NoLanes) {
            nextLanes = getHighestPriorityLanes(unblockedLanes);
        } else {
            // No fresh updates. Check if suspended work has been pinged.
            if (pingedLanes !== NoLanes) {
                nextLanes = getHighestPriorityLanes(pingedLanes);
            }
        }
    }

    if (nextLanes === NoLanes) {
        return NoLanes;
    }

    // 如果已经在一个render任务中，切换lanes会打断这个render任务导致丢失工作进度，所以只会当新的lanes优先级更高的时候执行
    if (
        wipLanes !== NoLanes &&
        wipLanes !== nextLanes &&
        (wipLanes & suspendedLanes) === NoLanes
    ) {
        const nextLane = getHighestPriorityLane(nextLanes);
        const wipLane = getHighestPriorityLane(wipLanes);
        if (
            nextLane >= wipLane ||
            (nextLane === DefaultLane &&
                (wipLane & TransitionLanes) !== NoLanes)
        ) {
            return wipLanes;
        }
    }

    return nextLanes;
}

export function includesSyncLane(lanes) {
    return (lanes & (SyncLane | SyncHydrationLane)) !== NoLanes;
}
