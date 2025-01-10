import { accumulateSinglePhaseListeners } from '../DOMPluginEventSystem';
import { registerTwoPhaseEvent } from '../EventRegistry';
import { IS_CAPTURE_PHASE } from '../EventSystemFlags';
import {
    SyntheticAnimationEvent,
    SyntheticClipboardEvent,
    SyntheticDragEvent,
    SyntheticEvent,
    SyntheticFocusEvent,
    SyntheticKeyboardEvent,
    SyntheticMouseEvent,
    SyntheticPointerEvent,
    SyntheticToggleEvent,
    SyntheticTouchEvent,
    SyntheticTransitionEvent,
    SyntheticUIEvent,
    SyntheticWheelEvent,
} from '../SyntheticEvent';

export const topLevelEventsToReactNames = new Map();

const simpleEventPluginEvents = [
    'abort',
    'auxClick',
    'beforeToggle',
    'cancel',
    'canPlay',
    'canPlayThrough',
    'click',
    'close',
    'contextMenu',
    'copy',
    'cut',
    'drag',
    'dragEnd',
    'dragEnter',
    'dragExit',
    'dragLeave',
    'dragOver',
    'dragStart',
    'drop',
    'durationChange',
    'emptied',
    'encrypted',
    'ended',
    'error',
    'gotPointerCapture',
    'input',
    'invalid',
    'keyDown',
    'keyPress',
    'keyUp',
    'load',
    'loadedData',
    'loadedMetadata',
    'loadStart',
    'lostPointerCapture',
    'mouseDown',
    'mouseMove',
    'mouseOut',
    'mouseOver',
    'mouseUp',
    'paste',
    'pause',
    'play',
    'playing',
    'pointerCancel',
    'pointerDown',
    'pointerMove',
    'pointerOut',
    'pointerOver',
    'pointerUp',
    'progress',
    'rateChange',
    'reset',
    'resize',
    'seeked',
    'seeking',
    'stalled',
    'submit',
    'suspend',
    'timeUpdate',
    'touchCancel',
    'touchEnd',
    'touchStart',
    'volumeChange',
    'scroll',
    'scrollEnd',
    'toggle',
    'touchMove',
    'waiting',
    'wheel',
];

export function registerSimpleEvents() {
    // 转换事件监听函数的格式，如：click => onClick，
    for (let i = 0; i < simpleEventPluginEvents.length; i++) {
        const eventName = simpleEventPluginEvents[i]; // click
        const domEventName = eventName.toLowerCase(); // click
        const capitalizedEvent =
            eventName[0].toUpperCase() + eventName.slice(1); // Click
        registerSimpleEvent(domEventName, 'on' + capitalizedEvent); // onClick
    }
    // 事件名称不匹配的特殊情况。
    registerSimpleEvent('focusin', 'onFocus');
    registerSimpleEvent('focusout', 'onBlur');
    registerSimpleEvent('dblclick', 'onDoubleClick');

    // 还有很多不常用的省略...
    // registerSimpleEvent(ANIMATION_END, 'onAnimationEnd');
}

function registerSimpleEvent(domEventName, reactName) {
    topLevelEventsToReactNames.set(domEventName, reactName);
    registerTwoPhaseEvent(reactName, [domEventName]);
}

function extractEvents(
    dispatchQueue,
    domEventName,
    targetInst,
    nativeEvent,
    nativeEventTarget,
    eventSystemFlags,
    targetContainer
) {
    // 将DOM事件名称转换为react事件名称
    const reactName = topLevelEventsToReactNames.get(domEventName);
    if (reactName === undefined) {
        return;
    }
    // 合成事件构造器，在原生事件上加一些兼容
    // 合成事件是浏览器原生事件系统的跨浏览器包装器。它们在 React 中用于确保事件在不同浏览器上的行为一致。
    let SyntheticEventCtor = SyntheticEvent;
    let reactEventType = domEventName;
    switch (domEventName) {
        case 'keypress':
            if (getEventCharCode(nativeEvent) === 0) {
                return;
            }
        case 'keydown':
        case 'keyup':
            SyntheticEventCtor = SyntheticKeyboardEvent;
            break;
        case 'focusin':
            reactEventType = 'focus';
            SyntheticEventCtor = SyntheticFocusEvent;
            break;
        case 'focusout':
            reactEventType = 'blur';
            SyntheticEventCtor = SyntheticFocusEvent;
            break;
        case 'beforeblur':
        case 'afterblur':
            SyntheticEventCtor = SyntheticFocusEvent;
            break;
        case 'click':
            if (nativeEvent.button === 2) {
                return;
            }
        case 'auxclick':
        case 'dblclick':
        case 'mousedown':
        case 'mousemove':
        case 'mouseup':
        case 'mouseout':
        case 'mouseover':
        case 'contextmenu':
            SyntheticEventCtor = SyntheticMouseEvent;
            break;
        case 'drag':
        case 'dragend':
        case 'dragenter':
        case 'dragexit':
        case 'dragleave':
        case 'dragover':
        case 'dragstart':
        case 'drop':
            SyntheticEventCtor = SyntheticDragEvent;
            break;
        case 'touchcancel':
        case 'touchend':
        case 'touchmove':
        case 'touchstart':
            SyntheticEventCtor = SyntheticTouchEvent;
            break;
        case ANIMATION_END:
        case ANIMATION_ITERATION:
        case ANIMATION_START:
            SyntheticEventCtor = SyntheticAnimationEvent;
            break;
        case TRANSITION_END:
            SyntheticEventCtor = SyntheticTransitionEvent;
            break;
        case 'scroll':
        case 'scrollend':
            SyntheticEventCtor = SyntheticUIEvent;
            break;
        case 'wheel':
            SyntheticEventCtor = SyntheticWheelEvent;
            break;
        case 'copy':
        case 'cut':
        case 'paste':
            SyntheticEventCtor = SyntheticClipboardEvent;
            break;
        case 'gotpointercapture':
        case 'lostpointercapture':
        case 'pointercancel':
        case 'pointerdown':
        case 'pointermove':
        case 'pointerout':
        case 'pointerover':
        case 'pointerup':
            SyntheticEventCtor = SyntheticPointerEvent;
            break;
        case 'toggle':
        case 'beforetoggle':
            SyntheticEventCtor = SyntheticToggleEvent;
            break;
        default:
            break;
    }

    const inCapturePhase = (eventSystemFlags & IS_CAPTURE_PHASE) !== 0;
    // scroll或者scrollend事件在非捕获阶段为true
    const accumulateTargetOnly =
        !inCapturePhase &&
        (domEventName === 'scroll' || domEventName === 'scrollend');

    // 从当前的target节点沿着return指针收集到root路径上所有的listener
    // ps: 只有fiber的tag为HostComponent、HostHoistable、HostSingleton才会收集其listener
    const listeners = accumulateSinglePhaseListeners(
        targetInst,
        reactName,
        nativeEvent.type,
        inCapturePhase,
        accumulateTargetOnly,
        nativeEvent
    );
    if (listeners.length > 0) {
        // 当收集到的listener大于0时通过event和listeners数组创建一个合成事件放到dispatchQueue队列中
        // 合成事件是对原生事件的封装：会保存一些react的属性值，并对preventDefault、stopPropagation等方法封装重写
        // 对preventDefault、stopPropagation封装重写：会调用事件原生的preventDefault、stopPropagation外还会设置内部属性
        // isDefaultPrevented、isPropagationStopped属性为true
        const event = new SyntheticEventCtor(
            reactName,
            reactEventType,
            null,
            nativeEvent,
            nativeEventTarget
        );
        dispatchQueue.push({ event, listeners });
    }
}

export { registerSimpleEvents as registerEvents, extractEvents };
