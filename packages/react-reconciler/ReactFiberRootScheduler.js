import { claimNextTransitionLane } from './ReactFiberLane';

let currentEventTransitionLane = NoLane;

export function requestTransitionLane() {
    if (currentEventTransitionLane === NoLane) {
        // 同一事件中的所有transitions都被分配到相同的lane
        currentEventTransitionLane = claimNextTransitionLane();
    }
    return currentEventTransitionLane;
}
