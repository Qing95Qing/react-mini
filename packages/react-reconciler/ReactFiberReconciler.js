import { createFiberRoot } from './ReactFiberRoot';
import { requestUpdateLane } from './ReactFiberWorkLoop';

// 创建fiber根容器
// tag可取两种值：1【ConcurrentRoot】 or 0【LegacyRoot】
export function createContainer(containerInfo, tag) {
    const hydrate = false; //表示不进行服务器端渲染的水合。
    const initialChildren = null; // 表示初始没有子节点。
    return createFiberRoot(containerInfo, tag, hydrate, initialChildren);
}

export function updateContainer(element, container, parentComponent, callback) {
    const current = container.current;
    //
    const lane = requestUpdateLane(current);
}
