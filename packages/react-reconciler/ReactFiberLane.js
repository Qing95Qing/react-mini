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

let nextTransitionLane = TransitionLane1;

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
    return 31 - clz32(lanes);
}
