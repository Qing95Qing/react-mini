import { getHighestPriorityLane } from './ReactFiberLane';

export const NoEventPriority = NoLane;
export const DiscreteEventPriority = SyncLane;
export const ContinuousEventPriority = InputContinuousLane;
export const DefaultEventPriority = DefaultLane;
export const IdleEventPriority = IdleLane;

export function isHigherEventPriority(a, b) {
    return a !== 0 && a < b;
}

export function eventPriorityToLane(updatePriority) {
    return updatePriority;
}

export function lanesToEventPriority(lanes) {
    const lane = getHighestPriorityLane(lanes);
    if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
        return DiscreteEventPriority;
    }
    if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
        return ContinuousEventPriority;
    }
    if (includesNonIdleWork(lane)) {
        return DefaultEventPriority;
    }
    return IdleEventPriority;
}
