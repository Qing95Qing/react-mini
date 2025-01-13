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
    container['__reactContainer$randomKey'] = root.current;
    const rootContainerElement =
        container.nodeType === COMMENT_NODE ? container.parentNode : container;
    // 1）注册所有【DOM原生事件】与【React合成事件】的映射关系
    //     两种注册方式：registerTwoPhaseEvent、registerDirectEvent
    // 2）在container上为所有DOM事件注册listener【dispatchEvent，在定义时已经绑定了DOM事件名称、container、是否捕获阶段事件】
    // 3）事件触发时
    //      a) 触发container上对应的listener(dispatchEvent)
    //      a）【收集listener】：（extractEvent）从target节点沿着return指针向root收集listener，对捕获或冒泡事件收集时加入数组的顺序不一致
    //          注意：对应两种注册事件的方式有两种提取事件的方式
    //            对于一阶段事件(accumulateSinglePhaseListeners)：
    //              根据是否捕获阶段事件将onXXX或者onXXXCapture处理器push进listeners数组
    //            对于两阶段事件(accumulateTwoPhaseListeners)：
    //              【捕获阶段】的listener如onClickCapture，通过unshift加到【listeners】数组
    //              【冒泡阶段】的listener如onClick，通过push加到【listeners】数组
    //            合成事件如何实现stopDefault和stopPropagation
    //      b）【封装成合成事件】：将event与listeners封装成合成事件。
    //      c）【顺序执行合成事件的listener】：捕获阶段listener数组从后往前，冒泡阶段listener数组从前往后。
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
