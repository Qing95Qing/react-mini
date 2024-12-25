
// tag可取两种值：1【ConcurrentRoot】 or 0【LegacyRoot】

import { initializeUpdateQueue } from "./ReactFiberClassUpdateQueue";

// 创建fiber根容器
export function createContainer(containerInfo, tag) {
    const hydrate = false;  //表示不进行服务器端渲染的水合。
    const initialChildren = null;  // 表示初始没有子节点。
    return createFiberRoot(
        containerInfo,
        tag,
        hydrate,
        initialChildren,
    );
}

export function createFiberRoot(containerInfo, tag, hydrate, initialChildren) {
    const root = new FiberRootNode(
        containerInfo,
        tag,
        hydrate
    );
    const uninitializedFiber = createFiberRoot(tag);
    root.current = uninitializedFiber;
    uninitializedFiber.stateNode = root;

    const initialState = {
        element: initialChildren,
        isDehydrated: hydrate,
        cache: null
    };
    uninitializedFiber.memoizedState = initialState;

    initializeUpdateQueue(uninitializedFiber);

    return root;
}
// 