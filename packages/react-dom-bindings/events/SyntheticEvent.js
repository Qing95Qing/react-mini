const EventInterface = {
    eventPhase: 0,
    bubbles: 0,
    cancelable: 0,
    timeStamp: function (event) {
        return event.timeStamp || Date.now();
    },
    defaultPrevented: 0,
    isTrusted: 0,
};

export const SyntheticEvent = createSyntheticEvent(EventInterface);

const UIEventInterface = {
    ...EventInterface,
    view: 0,
    detail: 0,
};

export const SyntheticUIEvent = createSyntheticEvent(UIEventInterface);

const KeyboardEventInterface = {
    ...UIEventInterface,
    key: getEventKey,
    code: 0,
    location: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    repeat: 0,
    locale: 0,
    getModifierState: getEventModifierState,
    charCode: function (event) {
        if (event.type === 'keypress') {
            return getEventCharCode(event);
        }
        return 0;
    },
    keyCode: function (event) {
        if (event.type === 'keydown' || event.type === 'keyup') {
            return event.keyCode;
        }
        return 0;
    },
    which: function (event) {
        if (event.type === 'keypress') {
            return getEventCharCode(event);
        }
        if (event.type === 'keydown' || event.type === 'keyup') {
            return event.keyCode;
        }
        return 0;
    },
};
export const SyntheticKeyboardEvent = createSyntheticEvent(
    KeyboardEventInterface
);

const FocusEventInterface = {
    ...UIEventInterface,
    relatedTarget: 0,
};
export const SyntheticFocusEvent = createSyntheticEvent(FocusEventInterface);

let lastMovementX;
let lastMovementY;
let lastMouseEvent;

function updateMouseMovementPolyfillState(event) {
    if (event !== lastMouseEvent) {
        if (lastMouseEvent && event.type === 'mousemove') {
            lastMovementX = event.screenX - lastMouseEvent.screenX;
            lastMovementY = event.screenY - lastMouseEvent.screenY;
        } else {
            lastMovementX = 0;
            lastMovementY = 0;
        }
        lastMouseEvent = event;
    }
}

const MouseEventInterface = {
    ...UIEventInterface,
    screenX: 0,
    screenY: 0,
    clientX: 0,
    clientY: 0,
    pageX: 0,
    pageY: 0,
    ctrlKey: 0,
    shiftKey: 0,
    altKey: 0,
    metaKey: 0,
    getModifierState: getEventModifierState,
    button: 0,
    buttons: 0,
    relatedTarget: function (event) {
        if (event.relatedTarget === undefined)
            return event.fromElement === event.srcElement
                ? event.toElement
                : event.fromElement;

        return event.relatedTarget;
    },
    movementX: function (event) {
        if ('movementX' in event) {
            return event.movementX;
        }
        updateMouseMovementPolyfillState(event);
        return lastMovementX;
    },
    movementY: function (event) {
        if ('movementY' in event) {
            return event.movementY;
        }
        return lastMovementY;
    },
};
export const SyntheticMouseEvent = createSyntheticEvent(MouseEventInterface);

const DragEventInterface = {
    ...MouseEventInterface,
    dataTransfer: 0,
};
export const SyntheticDragEvent = createSyntheticEvent(DragEventInterface);

const TouchEventInterface = {
    ...UIEventInterface,
    touches: 0,
    targetTouches: 0,
    changedTouches: 0,
    altKey: 0,
    metaKey: 0,
    ctrlKey: 0,
    shiftKey: 0,
    getModifierState: getEventModifierState,
};
export const SyntheticTouchEvent = createSyntheticEvent(TouchEventInterface);

const AnimationEventInterface = {
    ...EventInterface,
    animationName: 0,
    elapsedTime: 0,
    pseudoElement: 0,
};
export const SyntheticAnimationEvent = createSyntheticEvent(
    AnimationEventInterface
);

const TransitionEventInterface = {
    ...EventInterface,
    propertyName: 0,
    elapsedTime: 0,
    pseudoElement: 0,
};
export const SyntheticTransitionEvent = createSyntheticEvent(
    TransitionEventInterface
);

const WheelEventInterface = {
    ...MouseEventInterface,
    deltaX(event) {
        return 'deltaX' in event
            ? event.deltaX
            : 'wheelDeltaX' in event
              ? -event.wheelDeltaX
              : 0;
    },
    deltaY(event) {
        return 'deltaY' in event
            ? event.deltaY
            : 'wheelDeltaY' in event
              ? -event.wheelDeltaY
              : 'wheelDelta' in event
                ? -event.wheelDelta
                : 0;
    },
    deltaZ: 0,
    deltaMode: 0,
};
export const SyntheticWheelEvent = createSyntheticEvent(WheelEventInterface);

const ClipboardEventInterface = {
    ...EventInterface,
    clipboardData: function (event) {
        return 'clipboardData' in event
            ? event.clipboardData
            : window.clipboardData;
    },
};
export const SyntheticClipboardEvent = createSyntheticEvent(
    ClipboardEventInterface
);

const PointerEventInterface = {
    ...MouseEventInterface,
    pointerId: 0,
    width: 0,
    height: 0,
    pressure: 0,
    tangentialPressure: 0,
    tiltX: 0,
    tiltY: 0,
    twist: 0,
    pointerType: 0,
    isPrimary: 0,
};
export const SyntheticPointerEvent = createSyntheticEvent(
    PointerEventInterface
);

const ToggleEventInterface = {
    ...EventInterface,
    newState: 0,
    oldState: 0,
};
export const SyntheticToggleEvent = createSyntheticEvent(ToggleEventInterface);

function functionThatReturnsTrue() {
    return true;
}

function functionThatReturnsFalse() {
    return false;
}

// 工厂函数，用来创建synthetic（合成）事件的构造器
function createSyntheticEvent(Interface) {
    // 合成事件由事件插件分派，通常是为了响应顶级事件委托处理程序。
    function SyntheticBaseEvent(
        reactName,
        reactEventType,
        targetInst,
        nativeEvent,
        nativeEventTarget
    ) {
        this._reactName = reactName;
        this._targetInst = targetInst;
        this.type = reactEventType;
        this.nativeEvent = nativeEvent;
        this.target = nativeEventTarget;
        this.currentTarget = null;

        for (const propName in Interface) {
            if (!Interface.hasOwnProperty(propName)) {
                continue;
            }
            const normalize = Interface[propName];
            if (normalize) {
                this[propName] = normalize(nativeEvent);
            } else {
                this[propName] = nativeEvent[propName];
            }
        }

        const defaultPrevented =
            nativeEvent.defaultPrevented != null
                ? nativeEvent.defaultPrevented
                : nativeEvent.returnValue === false;
        if (defaultPrevented) {
            this.isDefaultPrevented = functionThatReturnsTrue;
        } else {
            this.isDefaultPrevented = functionThatReturnsFalse;
        }
        this.isPropagationStopped = functionThatReturnsFalse;
        return this;
    }

    assign(SyntheticBaseEvent.prototype, {
        preventDefault: function () {
            this.defaultPrevented = true;
            const event = this.nativeEvent;
            if (!event) {
                return;
            }

            // 调用原生事件的preventDefault
            if (event.preventDefault) {
                event.preventDefault();
            } else if (typeof event.returnValue !== 'unknown') {
                event.returnValue = false;
            }
            this.isDefaultPrevented = functionThatReturnsTrue;
        },

        stopPropagation: function () {
            const event = this.nativeEvent;
            if (!event) {
                return;
            }

            // 调用原生事件的stopPropagation
            if (event.stopPropagation) {
                event.stopPropagation();
            } else if (typeof event.cancelBubble !== 'unknown') {
                event.cancelBubble = true;
            }

            this.isPropagationStopped = functionThatReturnsTrue;
        },
        persist: function () {},
        isPersistent: functionThatReturnsTrue,
    });
    return SyntheticBaseEvent;
}
