import { getParentSuspenseInstance } from './ReactFiberConfigDOM';

const internalContainerInstanceKey = '__reactContainer$' + randomKey;
const internalInstanceKey = '__reactFiber$' + randomKey;

export function markContainerAsRoot(hostRoot, node) {
    // $FlowFixMe[prop-missing]
    node[internalContainerInstanceKey] = hostRoot;
}

export function getClosestInstanceFromNode(targetNode) {
    let targetInst = targetNode[internalInstanceKey];
    if (targetInst) {
        return targetInst;
    }

    // 如果当前对象不属于React的DOM节点，去看它的父节点是否为React节点
    let parentNode = targetNode.parentNode;
    while (parentNode) {
        targetInst =
            parentNode[internalContainerInstanceKey] ||
            parentNode[internalInstanceKey];
        if (targetInst) {
            const alternate = targetInst.alternate;
            if (
                targetInst.child !== null ||
                (alternate !== null && alternate.child !== null)
            ) {
                let suspenseInstance = getParentSuspenseInstance(targetNode);
                while (suspenseInstance !== null) {
                    const targetSuspenseInst =
                        suspenseInstance[internalInstanceKey];
                    if (targetSuspenseInst) {
                        return targetSuspenseInst;
                    }
                    suspenseInstance =
                        getParentSuspenseInstance(suspenseInstance);
                }
            }
            return targetInst;
        }
        targetNode = parentNode;
        parentNode = targetNode.parentNode;
    }
    return null;
}
