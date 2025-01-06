export function getNearestMountedFiber(fiber) {
    let node = fiber;
    let nearestMounted = fiber;
    if (!fiber.alternate) {
        //如果该节点没有alternate指向，说明这是一棵新树还没有插入，这种情况下该节点会有一个pending的插入effect
        let nextNode = node;
        do {
            node = nextNode;
            if ((node.flags & (Placement | Hydrating)) !== NoFlags) {
                // 这是一个插入或在进行中的hydration.
                // 最近已挂在的fiber可能是它的父节点，但仍然需要继续找出该节点还处于挂载状态
                nearestMounted = node.return;
            }
            nextNode = node.return;
        } while (nextNode);
    } else {
        while (node.return) {
            node = node.return;
        }
    }
    if (node.tag === HostRoot) {
        return nearestMounted;
    }
    return null;
}
