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
    const rootContainerElement = container.nodeType === COMMENT_NODE
        ? container.parentNode
        : container;
        // 对root注册所有支持的事件设置listener。
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
