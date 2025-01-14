import {
    emptyContextObject,
    findCurrentUnmaskedContext,
    isContextProvider as isLegacyContextProvider,
    processChildContext,
} from './ReactFiberContext';
import { createFiberRoot } from './ReactFiberRoot';
import { requestUpdateLane, scheduleUpdateOnFiber } from './ReactFiberWorkLoop';
import { get as getInstance } from '../shared/ReactInstanceMap';
import { createUpdate, enqueueUpdate } from './ReactFiberClassUpdateQueue';

// 创建fiber根容器
// tag可取两种值：1【ConcurrentRoot】 or 0【LegacyRoot】
export function createContainer(containerInfo, tag) {
    const hydrate = false; //表示不进行服务器端渲染的水合。
    const initialChildren = null; // 表示初始没有子节点。
    return createFiberRoot(containerInfo, tag, hydrate, initialChildren);
}

// 初始组件树render：updateContainer(children, root, null, null)
export function updateContainer(element, container, parentComponent, callback) {
    const current = container.current; // hostRootFiber
    const lane = requestUpdateLane(current);

    // 初始化时，context为空
    // 当标志disableLegacyContext为true时返回的context为emptyContextObject({})
    const context = getContextForSubtree(parentComponent);

    if (container.context === null) {
        container.context = context;
    } else {
        container.pendingContext = context;
    }

    const update = createUpdate(lane);
    update.payload = { element };

    callback = callback === undefined ? null : callback;
    if (callback !== null) {
        update.callback = callback;
    }

    // 1）将更新信息加到concurrentQueues中，
    // 2）将更新lane合并到fiber的lanes
    // 3）返回当前fiber所在的root
    const root = enqueueUpdate(current, update, lane);
    if (root !== null) {
        // startUpdateTimerByLane(lane);    先忽略
        scheduleUpdateOnFiber(root, current, lane);
        entangleTransitions(root, current, lane);
    }
}

function getContextForSubtree(parentComponent) {
    if (!parentComponent) {
        return emptyContextObject;
    }

    const fiber = getInstance(parentComponent); // 返回的是parentComponent的_reactInternals
    // 返回tag为HostRoot的节点的【stateNode.context】
    // 或者ContextProvider节点的【stateNode.__reactInternalMemoizedMergedChildContext】
    const parentContext = findCurrentUnmaskedContext(fiber);

    if (fiber.tag === ClassComponent) {
        const Component = fiber.type;
        if (isLegacyContextProvider(Component)) {
            return processChildContext(fiber, Component, parentContext);
        }
    }

    return parentContext;
}
