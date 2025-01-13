let queuedFocus = null;
let queuedDrag = null;
let queuedMouse = null;
const queuedPointers = new Map();
const queuedPointerCaptures = new Map();

export function clearIfContinuousEvent(domEventName, nativeEvent) {
    switch (domEventName) {
        case 'focusin':
        case 'focusout':
            queuedFocus = null;
            break;
        case 'dragenter':
        case 'dragleave':
            queuedDrag = null;
            break;
        case 'mouseover':
        case 'mouseout':
            queuedMouse = null;
            break;
        case 'pointerover':
        case 'pointerout': {
            const pointerId = nativeEvent.pointerId;
            queuedPointers.delete(pointerId);
            break;
        }
        case 'gotpointercapture':
        case 'lostpointercapture': {
            const pointerId = nativeEvent.pointerId;
            queuedPointerCaptures.delete(pointerId);
            break;
        }
    }
}
