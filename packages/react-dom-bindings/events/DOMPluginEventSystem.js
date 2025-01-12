import { allNativeEvents } from './EventRegistry';

import * as SimpleEventPlugin from './plugins/SimpleEventPlugin';
import * as EnterLeaveEventPlugin from './plugins/EnterLeaveEventPlugin';
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin';
import * as SelectEventPlugin from './plugins/SelectEventPlugin';
import * as BeforeInputEventPlugin from './plugins/BeforeInputEventPlugin';
import { createEventListenerWrapperWithPriority } from './ReactDOMEventListener';
import { getClosestInstanceFromNode } from '../ReactDOMComponentTree';
import getEventTarget from './getEventTarget';
import { batchedUpdates } from './ReactDOMUpdateBatching';
import { SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS } from './EventSystemFlags';
import {
    HostComponent,
    HostHoistable,
    HostSingleton,
} from '../../react-reconciler/ReactWorkTags';
import getListener from './getListener';
import reportGlobalError from '../../shared/reportGlobalError';

// 将所有的事件的名称加到allNativeEvents的集合中，两阶段事件的会多加一个capture事件
// 如onClick会多再注册一个onClickCapture
SimpleEventPlugin.registerEvents();
EnterLeaveEventPlugin.registerEvents();
ChangeEventPlugin.registerEvents();
SelectEventPlugin.registerEvents();
BeforeInputEventPlugin.registerEvents();

function extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
) {
    SimpleEventPlugin.extractEvents(
        dispatchQueue,
        domEventName,
        targetInst,
        nativeEvent,
        nativeEventTarget,
        eventSystemFlags,
        targetContainer
    );

    // 捕获阶段的事件该值为true
    const shouldProcessPolyfillPlugins =
        (eventSystemFlags & SHOULD_NOT_PROCESS_POLYFILL_EVENT_PLUGINS) === 0;

    if (shouldProcessPolyfillPlugins) {
        // EnterLeaveEventPlugin.extractEvents(
        //     dispatchQueue,
        //     domEventName,
        //     targetInst,
        //     nativeEvent,
        //     nativeEventTarget,
        //     eventSystemFlags,
        //     targetContainer
        // );
        // ChangeEventPlugin.extractEvents(
        //     dispatchQueue,
        //     domEventName,
        //     targetInst,
        //     nativeEvent,
        //     nativeEventTarget,
        //     eventSystemFlags,
        //     targetContainer
        // );
        // SelectEventPlugin.extractEvents(
        //     dispatchQueue,
        //     domEventName,
        //     targetInst,
        //     nativeEvent,
        //     nativeEventTarget,
        //     eventSystemFlags,
        //     targetContainer
        // );
        // BeforeInputEventPlugin.extractEvents(
        //   dispatchQueue,
        //   domEventName,
        //   targetInst,
        //   nativeEvent,
        //   nativeEventTarget,
        //   eventSystemFlags,
        //   targetContainer,
        // );
        // FormActionEventPlugin.extractEvents(
        //   dispatchQueue,
        //   domEventName,
        //   targetInst,
        //   nativeEvent,
        //   nativeEventTarget,
        //   eventSystemFlags,
        //   targetContainer,
        // );
    }
}

const listeningMarker = '_reactListening' + Math.random().toString(36).slice(2);
export const IS_CAPTURE_PHASE = 1 << 2;

// 需要单独附加到媒体元素的事件列表。
export const mediaEventTypes = [
    'abort',
    'canplay',
    'canplaythrough',
    'durationchange',
    'emptied',
    'encrypted',
    'ended',
    'error',
    'loadeddata',
    'loadedmetadata',
    'loadstart',
    'pause',
    'play',
    'playing',
    'progress',
    'ratechange',
    'resize',
    'seeked',
    'seeking',
    'stalled',
    'suspend',
    'timeupdate',
    'volumechange',
    'waiting',
];

export const nonDelegatedEvents = new Set([
    'beforetoggle',
    'cancel',
    'close',
    'invalid',
    'load',
    'scroll',
    'scrollend',
    'toggle',
    ...mediaEventTypes,
]);

export function listenToAllSupportedEvents(rootContainerElement) {
    // 确保仅一次添加
    if (!rootContainerElement[listeningMarker]) {
        // 标记加锁
        rootContainerElement[listeningMarker] = true;

        // 在文件开头通过多个eventPlugin注册进去了
        allNativeEvents.forEach((domEventName) => {
            // 单独处理selectionchange，因为它不会冒泡，所以需要在document元素上监听
            if (domEventName !== 'selectionchange') {
                // 支持代理的事件会多注册一个捕获阶段的事件监听（与非捕获阶段的监听器的区别：多了一个IS_CAPTURE_PHASE）
                if (!nonDelegatedEvents.has(domEventName)) {
                    listenToNativeEvent(
                        domEventName,
                        false,
                        rootContainerElement
                    );
                }
                listenToNativeEvent(domEventName, true, rootContainerElement);
            }
        });
        const ownerDocument =
            rootContainerElement.nodeType === DOCUMENT_NODE
                ? rootContainerElement
                : rootContainerElement.ownerDocument;
        if (ownerDocument !== null) {
            // The selectionchange event also needs deduplication
            // but it is attached to the document.
            if (!ownerDocument[listeningMarker]) {
                ownerDocument[listeningMarker] = true;
                listenToNativeEvent('selectionchange', false, ownerDocument);
            }
        }
    }
}

export function listenToNativeEvent(
    domEventName,
    isCapturePhaseListener,
    target
) {
    let eventSystemFlags = 0;
    // 捕获阶段的监听器
    if (isCapturePhaseListener) {
        eventSystemFlags |= IS_CAPTURE_PHASE;
    }
    addTrappedEventListener(
        target,
        domEventName,
        eventSystemFlags,
        isCapturePhaseListener
    );
}

function addTrappedEventListener(
    targetContainer,
    domEventName,
    eventSystemFlags,
    isCapturePhaseListener
) {
    // 该部分逻辑：1）根据domEventName获取事件优先级；
    // 2）将事件优先级赋值给全局更新优先级【ReactDOMSharedInternals.p】，（意义？）
    // 3）最后都是返回dispatchEvent（通过bind函数，将targetContainer，domEventName绑定到了listener上）
    // 【重点】：最后事件触发的是dispatchEvent
    let listener = createEventListenerWrapperWithPriority(
        targetContainer,
        domEventName,
        eventSystemFlags
    );

    // 调用原生dom上的addEventHandler
    if (isCapturePhaseListener) {
        unsubscribeListener = addEventCaptureListener(
            targetContainer,
            domEventName,
            listener
        );
    } else {
        unsubscribeListener = addEventBubbleListener(
            targetContainer,
            domEventName,
            listener
        );
    }
}

export function dispatchEventForPluginEventSystem(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetInst, // 只有被阻塞的事件才有
    targetContainer
) {
    let ancestorInst = targetInst;
    if (
        (eventSystemFlags & IS_EVENT_HANDLE_NON_MANAGED_NODE) === 0 &&
        (eventSystemFlags & IS_NON_DELEGATED) === 0
    ) {
        const targetContainerNode = targetContainer;
        // 当targetInst不为null时，去找事件派发的正确的祖先实例
        // 从当前时间的target节点向上遍历fiber树找到匹配targetContainer（初始注册事件监听器时bind的container）的root边界
        // 可以先省略不看
        if (targetInst !== null) {
            let node = targetInst;

            mainLoop: while (true) {
                if (node === null) {
                    return;
                }
                const nodeTag = node.tag;
                if (nodeTag === HostRoot || nodeTag === HostPortal) {
                    let container = node.stateNode.containerInfo;
                    if (
                        isMatchingRootContainer(container, targetContainerNode)
                    ) {
                        break;
                    }
                    if (nodeTag === HostPortal) {
                        let grandNode = node.return;
                        while (grandNode !== null) {
                            const grandTag = grandNode.tag;
                            if (
                                grandTag === HostRoot ||
                                grandTag === HostPortal
                            ) {
                                const grandContainer =
                                    grandNode.stateNode.containerInfo;
                                if (
                                    isMatchingRootContainer(
                                        grandContainer,
                                        targetContainerNode
                                    )
                                ) {
                                    return;
                                }
                            }
                            grandNode = grandNode.return;
                        }
                    }

                    while (container !== null) {
                        const parentNode =
                            getClosestInstanceFromNode(container);
                        if (parentNode === null) {
                            return;
                        }
                        const parentTag = parentNode.tag;
                        if (
                            parentTag === HostComponent ||
                            parentTag === HostText ||
                            parentTag === HostHoistable ||
                            parentTag === HostSingleton
                        ) {
                            node = ancestorInst = parentNode;
                            continue mainLoop;
                        }
                        container = container.parentNode;
                    }
                }
                node = node.return;
            }
        }
    }

    batchedUpdates(() =>
        dispatchEventsForPlugins(
            domEventName,
            eventSystemFlags,
            nativeEvent,
            ancestorInst,
            targetContainer
        )
    );
}

function isMatchingRootContainer(grandContainer, targetContainer) {
    return (
        grandContainer === targetContainer ||
        (grandContainer.nodeType === COMMENT_NODE &&
            grandContainer.parentNode === targetContainer)
    );
}

export function addEventBubbleListener(target, eventType, listener) {
    target.addEventListener(eventType, listener, false);
    return listener;
}

export function addEventCaptureListener(target, eventType, listener) {
    target.addEventListener(eventType, listener, true);
    return listener;
}

function dispatchEventsForPlugins(
    domEventName,
    eventSystemFlags,
    nativeEvent,
    targetInst,
    targetContainer
) {
    const nativeEventTarget = getEventTarget(nativeEvent);
    const dispatchQueue = [];
    // 1）从target沿着return路径收集到root上所有tag为HostComponent节点的listeners数组
    // 注意对于两阶段模型：
    // 捕获阶段的listener如onClickCapture，通过unshift加到【listeners】数组
    // 冒泡阶段的listener如onClick，通过push加到【listeners】数组
    // 2）将【事件】与【listener数组】根据事件的类型封装为一个合成事件放入dispatchQueue中
    extractEvents(
        dispatchQueue,
        domEventName,
        targetInst,
        nativeEvent,
        nativeEventTarget,
        eventSystemFlags,
        targetContainer
    );
    processDispatchQueue(dispatchQueue, eventSystemFlags);
}

export function processDispatchQueue(dispatchQueue, eventSystemFlags) {
    const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
    for (let i = 0; i < dispatchQueue.length; i++) {
        const { event, listeners } = dispatchQueue[i];
        processDispatchQueueItemsInOrder(event, listeners, inCapturePhase);
        //  event system doesn't use pooling.
    }
}

function processDispatchQueueItemsInOrder(
    event,
    dispatchListeners,
    inCapturePhase
) {
    let previousInstance;
    if (inCapturePhase) {
        // 捕获阶段listener数组从后往前执行
        for (let i = dispatchListeners.length - 1; i >= 0; i--) {
            const { instance, currentTarget, listener } = dispatchListeners[i];
            if (instance !== previousInstance && event.isPropagationStopped()) {
                return;
            }
            // 将listener的执行包到try...catch...中
            executeDispatch(event, listener, currentTarget);
            previousInstance = instance;
        }
    } else {
        // 冒泡阶段listener数组从前往后执行
        for (let i = 0; i < dispatchListeners.length; i++) {
            const { instance, currentTarget, listener } = dispatchListeners[i];
            if (instance !== previousInstance && event.isPropagationStopped()) {
                return;
            }
            executeDispatch(event, listener, currentTarget);
            previousInstance = instance;
        }
    }
}

function executeDispatch(event, listener, currentTarget) {
    event.currentTarget = currentTarget;
    try {
        listener(event);
    } catch (error) {
        reportGlobalError(error);
    }
    event.currentTarget = null;
}

export function accumulateSinglePhaseListeners(
    targetFiber,
    reactName,
    nativeEventType,
    inCapturePhase,
    accumulateTargetOnly, // scroll或者scrollend事件在非捕获阶段为true
    nativeEvent
) {
    const captureName = reactName !== null ? reactName + 'Capture' : null;
    const reactEventName = inCapturePhase ? captureName : reactName;
    let listeners = [];

    let instance = targetFiber;
    let lastHostComponent = null;

    // 沿着 target => root路径（通过return指针）收集监听器listener
    while (instance !== null) {
        const { stateNode, tag } = instance;
        if (
            (tag === HostComponent ||
                tag === HostHoistable ||
                tag === HostSingleton) &&
            stateNode !== null
        ) {
            lastHostComponent = stateNode;

            if (reactEventName !== null) {
                const listener = getListener(instance, reactEventName);
                if (listener != null) {
                    listeners.push({
                        instance,
                        listener,
                        currentTarget: lastHostComponent,
                    });
                }
            }
        }

        if (accumulateTargetOnly) {
            break;
        }
        instance = instance.return;
    }
    return listeners;
}

export function accumulateTwoPhaseListeners(targetFiber, reactName) {
    const captureName = reactName + 'Capture';
    const listeners = [];
    let instance = targetFiber;

    while (instance !== null) {
        const { stateNode, tag } = instance;
        if (
            (tag === HostComponent ||
                tag === HostHoistable ||
                tag === HostSingleton) &&
            stateNode !== null
        ) {
            const currentTarget = stateNode;
            const captureListener = getListener(instance, captureName);
            if (captureListener != null) {
                listeners.unshift({
                    instance,
                    listener: captureListener,
                    currentTarget,
                });
            }
            const bubbleListener = getListener(instance, reactName);
            if (bubbleListener != null) {
                listeners.push({
                    instance,
                    listener: bubbleListener,
                    currentTarget,
                });
            }
        }
        instance = instance.return;
    }
    return listeners;
}
