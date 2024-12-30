export const NoEventPriority = NoLane;
export const DiscreteEventPriority = SyncLane;
export const ContinuousEventPriority = InputContinuousLane;
export const DefaultEventPriority = DefaultLane;
export const IdleEventPriority = IdleLane;

export function eventPriorityToLane(updatePriority) {
    return updatePriority;
}
