import { markContainerAsRoot } from '../react-dom-bindings/ReactDOMComponentTree';
import { listenToAllSupportedEvents } from '../react-dom-bindings/events/DOMPluginEventSystem';
import {
    createContainer,
    updateContainer,
} from '../react-reconciler/ReactFiberReconciler';

export function createRoot(container) {
    // 创建一个FiberRootNode
    const root = createContainer(container, ConcurrentRoot);
    // 将root.current 记录到 给container的【__reactContainer$】
    markContainerAsRoot(root.current, container);
    const rootContainerElement =
        container.nodeType === COMMENT_NODE ? container.parentNode : container;
    // 1）初始化container时，注册listener。
    // 2）事件触发时
    //      1）【收集listener】：从target节点沿着return指针向root收集listener，对捕获或冒泡事件收集时加入数组的顺序不一致
    //      2）【封装成合成事件】：将event与listeners封装成合成事件。
    //      3）【顺序执行合成事件的listener】：捕获阶段listener数组从后往前，冒泡阶段listener数组从前往后。
    listenToAllSupportedEvents(rootContainerElement);
    return new ReactDOMRoot(root);
}

function ReactDOMRoot(internalRoot) {
    this._internalRoot = internalRoot;
}

ReactDOMRoot.prototype.render = function (children) {
    const root = this._internalRoot;
    updateContainer(children, root, null, null);
};

ReactDOMRoot.prototype.unmount = function () {
    const root = this._internalRoot;
    if (root !== null) {
        this._internalRoot = null;
        const container = root.containerInfo;
        updateContainerSync(null, root, null, null);
        flushSyncWork();
        unmarkContainerAsRoot(container);
    }
};
