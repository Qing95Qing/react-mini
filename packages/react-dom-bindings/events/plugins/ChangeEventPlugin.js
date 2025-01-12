import { updateValueIfChanged } from "../../inputValueTracking";
import { getInstanceFromNode, getNodeFromInstance } from "../../ReactDOMComponentTree";
import { registerTwoPhaseEvent } from "../EventRegistry";
import isTextInputElement from "../isTextInputElement";

function registerEvents() {
  registerTwoPhaseEvent('onChange', [
    'change',
    'click',
    'focusin',
    'focusout',
    'input',
    'keydown',
    'keyup',
    'selectionchange',
  ]);
}

let isInputEventSupported = false;
if (canUseDOM) {
  isInputEventSupported =
    isEventSupported('input') &&
    (!document.documentMode || document.documentMode > 9);
}


function extractEvents(
  dispatchQueue,
  domEventName,
  targetInst,
  nativeEvent,
  nativeEventTarget,
  eventSystemFlags,
  targetContainer,
) {
  const targetNode = targetInst ? getNodeFromInstance(targetInst) : window;

  let getTargetInstFunc, handleEventFunc;
  if (shouldUseChangeEvent(targetNode)) {
    // 能直接使用onChange的事件： select、type为file类型的input
    getTargetInstFunc = getTargetInstForChangeEvent;
  } else if (isTextInputElement(targetNode)) {
    if (isInputEventSupported) {
      getTargetInstFunc = getTargetInstForInputOrChangeEvent;
    } else {
      getTargetInstFunc = getTargetInstForInputEventPolyfill;
      handleEventFunc = handleEventsForInputEventPolyfill;
    }
  } else if (shouldUseClickEvent(targetNode)) {
    getTargetInstFunc = getTargetInstForClickEvent;
  } else if (
    targetInst &&
    isCustomElement(targetInst.elementType, targetInst.memoizedProps)
  ) {
    getTargetInstFunc = getTargetInstForChangeEvent;
  }

  if (getTargetInstFunc) {
    const inst = getTargetInstFunc(domEventName, targetInst);
    if (inst) {
      createAndAccumulateChangeEvent(
        dispatchQueue,
        inst,
        nativeEvent,
        nativeEventTarget,
      );
      return;
    }
  }

  if (handleEventFunc) {
    handleEventFunc(domEventName, targetNode, targetInst);
  }

  // When blurring, set the value attribute for number inputs
  if (domEventName === 'focusout' && targetInst) {
    // These props aren't necessarily the most current but we warn for changing
    // between controlled and uncontrolled, so it doesn't matter and the previous
    // code was also broken for changes.
    const props = targetInst.memoizedProps;
    handleControlledInputBlur(((targetNode: any): HTMLInputElement), props);
  }
}

function shouldUseChangeEvent(elem) {
  const nodeName = elem.nodeName && elem.nodeName.toLowerCase();
  return (
    nodeName === 'select' ||
    (nodeName === 'input' && elem.type === 'file')
  );
}

function getTargetInstForChangeEvent(
  domEventName,
  targetInst,
) {
  if (domEventName === 'change') {
    return targetInst;
  }
}


function getTargetInstForInputOrChangeEvent(
  domEventName,
  targetInst,
) {
  if (domEventName === 'input' || domEventName === 'change') {
    return getInstIfValueChanged(targetInst);
  }
}

function getInstIfValueChanged(targetInst) {
  const targetNode = getNodeFromInstance(targetInst);
  if (updateValueIfChanged(targetNode)) {
    return targetInst;
  }
}
export { registerEvents, extractEvents }