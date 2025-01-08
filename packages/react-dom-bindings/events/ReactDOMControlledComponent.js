import { restoreControlledState } from "../ReactDOMComponent";
import { getFiberCurrentPropsFromNode, getInstanceFromNode } from "../ReactDOMComponentTree";


let restoreTarget = null;
let restoreQueue = null;

export function enqueueStateRestore(target) {
  if (restoreTarget) {
    if (restoreQueue) {
      restoreQueue.push(target);
    } else {
      restoreQueue = [target];
    }
  } else {
    restoreTarget = target;
  }
}

export function needsStateRestore() {
  return restoreTarget !== null || restoreQueue !== null;
}

export function restoreStateIfNeeded() {
  if (!restoreTarget) {
    return;
  }
  const target = restoreTarget;
  const queuedTargets = restoreQueue;
  restoreTarget = null;
  restoreQueue = null;

  restoreStateOfTarget(target);
  if (queuedTargets) {
    for (let i = 0; i < queuedTargets.length; i++) {
      restoreStateOfTarget(queuedTargets[i]);
    }
  }
}


function restoreStateOfTarget(target) {
  // 获取DOM节点对应的fiber节点
  const internalInstance = getInstanceFromNode(target);
  if (!internalInstance) {
    // Unmounted
    return;
  }

  const stateNode = internalInstance.stateNode;
  // Guard against Fiber being unmounted.
  if (stateNode) {
    const props = getFiberCurrentPropsFromNode(stateNode);
    restoreControlledState(
      internalInstance.stateNode,
      internalInstance.type,
      props,
    );
  }
}