import { mergeLanes } from './ReactFiberLane';
import { throwIfInfiniteUpdateLoopDetected } from './ReactFiberWorkLoop';

const concurrentQueues = [];
let concurrentQueuesIndex = 0;

let concurrentlyUpdatedLanes = NoLanes;

export function unsafe_markUpdateLaneFromFiberToRoot(sourceFiber, lane) {
    // 从当前节点向上找root
    const root = getRootForUpdatedFiber(sourceFiber);
    // 从当前更新fiber向上将子fiber的lane合并到父fiber的childLanes
    markUpdateLaneFromFiberToRoot(sourceFiber, null, lane);
    return root;
}

function getRootForUpdatedFiber(sourceFiber) {
    // 发现循环渲染时丢弃更新，本地变量记录记录更新次数，连续更新50次认为循环渲染
    throwIfInfiniteUpdateLoopDetected();

    let node = sourceFiber;
    let parent = node.return;
    while (parent !== null) {
        node = parent;
        parent = node.return;
    }
    return node.tag === HostRoot ? node.stateNode : null;
}

function markUpdateLaneFromFiberToRoot(sourceFiber, update, lane) {
    // 更新源fiber的lane
    sourceFiber.lanes = mergeLanes(sourceFiber.lanes, lane);
    let alternate = sourceFiber.alternate;
    if (alternate !== null) {
        alternate.lanes = mergeLanes(alternate.lanes, lane);
    }
    // 从源fiber向上将各子fiber的lane合并到父fiber的childLanes上
    let parent = sourceFiber.return;
    let node = sourceFiber;
    while (parent !== null) {
        parent.childLanes = mergeLanes(parent.childLanes, lane);
        alternate = parent.alternate;
        if (alternate !== null) {
            alternate.childLanes = mergeLanes(alternate.childLanes, lane);
        }

        node = parent;
        parent = parent.return;
    }
}

export function enqueueConcurrentClassUpdate(fiber, queue, update, lane) {
    const concurrentQueue = queue;
    const concurrentUpdate = update;
    // 将更新信息加到concurrentQueues中，
    // 将更新lane添加到fiber的lanes
    enqueueUpdate(fiber, concurrentQueue, concurrentUpdate, lane);
    return getRootForUpdatedFiber(fiber);
}

function enqueueUpdate(fiber, queue, update, lane) {
    concurrentQueues[concurrentQueuesIndex++] = fiber;
    concurrentQueues[concurrentQueuesIndex++] = queue;
    concurrentQueues[concurrentQueuesIndex++] = update;
    concurrentQueues[concurrentQueuesIndex++] = lane;

    concurrentlyUpdatedLanes = mergeLanes(concurrentlyUpdatedLanes, lane);
    fiber.lanes = mergeLanes(fiber.lanes, lane);
    const alternate = fiber.alternate;
    if (alternate !== null) {
        alternate.lanes = mergeLanes(alternate.lanes, lane);
    }
}
