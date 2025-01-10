import { getFiberCurrentPropsFromNode } from '../ReactDOMComponentTree';

function isInteractive(tag) {
    return (
        tag === 'button' ||
        tag === 'input' ||
        tag === 'select' ||
        tag === 'textarea'
    );
}

function shouldPreventMouseEvent(name, type, props) {
    switch (name) {
        case 'onClick':
        case 'onClickCapture':
        case 'onDoubleClick':
        case 'onDoubleClickCapture':
        case 'onMouseDown':
        case 'onMouseDownCapture':
        case 'onMouseMove':
        case 'onMouseMoveCapture':
        case 'onMouseUp':
        case 'onMouseUpCapture':
        case 'onMouseEnter':
            return !!(props.disabled && isInteractive(type));
        default:
            return false;
    }
}

export default function getListener(inst, registrationName) {
    const stateNode = inst.stateNode;
    if (stateNode === null) {
        return null;
    }
    const props = getFiberCurrentPropsFromNode(stateNode);
    if (props === null) {
        return null;
    }
    // 从组件的props上拿对应事件的listener （如onClick）
    const listener = props[registrationName];
    if (shouldPreventMouseEvent(registrationName, inst.type, props)) {
        return null;
    }

    if (listener && typeof listener !== 'function') {
        throw new Error(
            `Expected \`${registrationName}\` listener to be a function, instead got a value of \`${typeof listener}\` type.`
        );
    }

    return listener;
}
