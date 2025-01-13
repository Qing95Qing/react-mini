import {
    DiscreteEventPriority,
    ContinuousEventPriority,
    IdleEventPriority,
    DefaultEventPriority,
} from '../../react-reconciler/ReactEventPriorities';
import { getNearestMountedFiber } from '../../react-reconciler/ReactFiberTreeReflection';
import {
    HostRoot,
    SuspenseComponent,
} from '../../react-reconciler/ReactWorkTags';
import {
    ImmediatePriority,
    LowPriority,
} from '../../scheduler/SchedulerPriorities';
import ReactSharedInternals from '../../shared/ReactSharedInternals';
import {
    getCurrentUpdatePriority,
    setCurrentUpdatePriority,
} from '../ReactDOMUpdatePriority';
import { getParentSuspenseInstance } from '../ReactFiberConfigDOM';
import getEventTarget from './getEventTarget';
import {
    IdlePriority as IdleSchedulerPriority,
    ImmediatePriority as ImmediateSchedulerPriority,
    LowPriority as LowSchedulerPriority,
    NormalPriority as NormalSchedulerPriority,
    UserBlockingPriority as UserBlockingSchedulerPriority,
} from '../../scheduler/SchedulerPriorities';
import { getCurrentPriorityLevel as getCurrentSchedulerPriorityLevel } from '../../scheduler';
import { dispatchEventForPluginEventSystem } from './DOMPluginEventSystem';
import { clearIfContinuousEvent } from './ReactDOMEventReplaying';

export function createEventListenerWrapperWithPriority(
    targetContainer,
    domEventName,
    eventSystemFlags
) {
    const eventPriority = getEventPriority(domEventName);
    let listenerWrapper;
    switch (eventPriority) {
        case DiscreteEventPriority:
            // 相比dispatchEvent多了Discrete事件优先级的逻辑
            listenerWrapper = dispatchDiscreteEvent;
            break;
        case ContinuousEventPriority:
            // 相比dispatchEvent多了Continuous事件优先级的逻辑
            listenerWrapper = dispatchContinuousEvent;
            break;
        case DefaultEventPriority:
        default:
            listenerWrapper = dispatchEvent;
            break;
    }
    return listenerWrapper.bind(
        null,
        domEventName,
        eventSystemFlags,
        targetContainer
    );
}

export function getEventPriority(domEventName) {
    switch (domEventName) {
        // Used by SimpleEventPlugin:
        case 'beforetoggle':
        case 'cancel':
        case 'click':
        case 'close':
        case 'contextmenu':
        case 'copy':
        case 'cut':
        case 'auxclick':
        case 'dblclick':
        case 'dragend':
        case 'dragstart':
        case 'drop':
        case 'focusin':
        case 'focusout':
        case 'input':
        case 'invalid':
        case 'keydown':
        case 'keypress':
        case 'keyup':
        case 'mousedown':
        case 'mouseup':
        case 'paste':
        case 'pause':
        case 'play':
        case 'pointercancel':
        case 'pointerdown':
        case 'pointerup':
        case 'ratechange':
        case 'reset':
        case 'resize':
        case 'seeked':
        case 'submit':
        case 'toggle':
        case 'touchcancel':
        case 'touchend':
        case 'touchstart':
        case 'volumechange':
        // Used by polyfills: (fall through)
        case 'change':
        case 'selectionchange':
        case 'textInput':
        case 'compositionstart':
        case 'compositionend':
        case 'compositionupdate':
        // Only enableCreateEventHandleAPI: (fall through)
        case 'beforeblur':
        case 'afterblur':
        // Not used by React but could be by user code: (fall through)
        case 'beforeinput':
        case 'blur':
        case 'fullscreenchange':
        case 'focus':
        case 'hashchange':
        case 'popstate':
        case 'select':
        case 'selectstart':
            return DiscreteEventPriority;
        case 'drag':
        case 'dragenter':
        case 'dragexit':
        case 'dragleave':
        case 'dragover':
        case 'mousemove':
        case 'mouseout':
        case 'mouseover':
        case 'pointermove':
        case 'pointerout':
        case 'pointerover':
        case 'scroll':
        case 'touchmove':
        case 'wheel':
        // Not used by React but could be by user code: (fall through)
        case 'mouseenter':
        case 'mouseleave':
        case 'pointerenter':
        case 'pointerleave':
            return ContinuousEventPriority;
        case 'message': {
            // We might be in the Scheduler callback.
            // Eventually this mechanism will be replaced by a check
            // of the current priority on the native scheduler.
            const schedulerPriority = getCurrentSchedulerPriorityLevel();
            switch (schedulerPriority) {
                case ImmediatePriority:
                    return DiscreteEventPriority;
                case UserBlockingSchedulerPriority:
                    return ContinuousEventPriority;
                case NormalSchedulerPriority:
                case LowSchedulerPriority:
                    // TODO: Handle LowSchedulerPriority, somehow. Maybe the same lane as hydration.
                    return DefaultEventPriority;
                case IdleSchedulerPriority:
                    return IdleEventPriority;
                default:
                    return DefaultEventPriority;
            }
        }
        default:
            return DefaultEventPriority;
    }
}

function dispatchDiscreteEvent(
    domEventName,
    eventSystemFlags,
    container,
    nativeEvent
) {
    const prevTransition = ReactSharedInternals.T;
    ReactSharedInternals.T = null;
    // 读取全局变量【ReactDOMSharedInternals.p】
    const previousPriority = getCurrentUpdatePriority();
    try {
        // 修改全局变量【ReactDOMSharedInternals.p】
        setCurrentUpdatePriority(DiscreteEventPriority);
        dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
    } finally {
        setCurrentUpdatePriority(previousPriority);
        ReactSharedInternals.T = prevTransition;
    }
}

function dispatchContinuousEvent(
    domEventName,
    eventSystemFlags,
    container,
    nativeEvent
) {
    const prevTransition = ReactSharedInternals.T;
    ReactSharedInternals.T = null;
    const previousPriority = getCurrentUpdatePriority();
    try {
        setCurrentUpdatePriority(ContinuousEventPriority);
        dispatchEvent(domEventName, eventSystemFlags, container, nativeEvent);
    } finally {
        setCurrentUpdatePriority(previousPriority);
        ReactSharedInternals.T = prevTransition;
    }
}

export function dispatchEvent(
    domEventName,
    eventSystemFlags,
    targetContainer,
    nativeEvent
) {
    // 检查dom节点相关的react组件当前是否有阻塞的事件，是否已挂载
    // 同时获取事件target对应的fiber节点（return_targetInst）
    // 当元素为suspense组件时，blockedOn非空，为suspense组件的fiber节点
    let blockedOn = findInstanceBlockingEvent(nativeEvent);
    if (blockedOn === null) {
        // 没有阻塞的事件
        dispatchEventForPluginEventSystem(
            domEventName,
            eventSystemFlags,
            nativeEvent,
            return_targetInst,
            targetContainer
        );
        clearIfContinuousEvent(domEventName, nativeEvent);
        return;
    }
}

export function findInstanceBlockingEvent(nativeEvent) {
    // 获取event的target，只是在原生事件获取target的基础上添加了一些兼容
    const nativeEventTarget = getEventTarget(nativeEvent);
    // 检查dom节点相关的react组件当前是否有阻塞的事件（有的话事件需要排队）
    return findInstanceBlockingTarget(nativeEventTarget);
}

export let return_targetInst = null;
export function findInstanceBlockingTarget(targetNode) {
    return_targetInst = null;

    //获取真实节点的Fiber节点，读targetNode的【__reactFiber$】属性
    let targetInst = getClosestInstanceFromNode(targetNode);

    if (targetInst !== null) {
        const nearestMounted = getNearestMountedFiber(targetInst);
        // 该fiber树还未被挂载
        if (nearestMounted === null) {
            targetInst = null;
        } else {
            const tag = nearestMounted.tag;
            if (tag === SuspenseComponent) {
                const instance = getParentSuspenseInstance(nearestMounted);
                if (instance !== null) {
                    return instance;
                }
                targetInst = null;
            } else if (tag === HostRoot) {
                targetInst = null;
            } else if (nearestMounted !== targetInst) {
                targetInst = null;
            }
        }
    }
    return_targetInst = targetInst;

    return null;
}
