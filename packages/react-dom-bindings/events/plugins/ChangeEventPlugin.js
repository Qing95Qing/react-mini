import { updateValueIfChanged } from "../../inputValueTracking";
import { getInstanceFromNode, getNodeFromInstance } from "../../ReactDOMComponentTree";
import { accumulateTwoPhaseListeners } from "../DOMPluginEventSystem";
import { registerTwoPhaseEvent } from "../EventRegistry";
import isTextInputElement from "../isTextInputElement";
import { enqueueStateRestore } from "../ReactDOMControlledComponent";
import { SyntheticEvent } from "../SyntheticEvent";

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

function shouldUseClickEvent(elem) {
  const nodeName = elem.nodeName;
  return (
    nodeName &&
    nodeName.toLowerCase() === 'input' &&
    (elem.type === 'checkbox' || elem.type === 'radio')
  );
}

function getTargetInstForClickEvent(
  domEventName,
  targetInst,
) {
  if (domEventName === 'click') {
    return getInstIfValueChanged(targetInst);
  }
}

function isCustomElement(tagName) {
  if (tagName.indexOf('-') === -1) {
    return false;
  }
  switch (tagName) {
    case 'annotation-xml':
    case 'color-profile':
    case 'font-face':
    case 'font-face-src':
    case 'font-face-uri':
    case 'font-face-format':
    case 'font-face-name':
    case 'missing-glyph':
      return false;
    default:
      return true;
  }
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
      getTargetInstFunc = getTargetInstForInputOrChangeEvent;
  } else if (shouldUseClickEvent(targetNode)) {
    getTargetInstFunc = getTargetInstForClickEvent;
  } else if (
    targetInst &&
    isCustomElement(targetInst.elementType, targetInst.memoizedProps)
  ) {
    getTargetInstFunc = getTargetInstForChangeEvent;
  }

  if (getTargetInstFunc) {
    // target对应的fiber节点
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
function createAndAccumulateChangeEvent(
  dispatchQueue,
  inst,
  nativeEvent,
  target,
) {
  enqueueStateRestore(target);
  const listeners = accumulateTwoPhaseListeners(inst, 'onChange');
  if (listeners.length > 0) {
    const event = new SyntheticEvent(
      'onChange',
      'change',
      null,
      nativeEvent,
      target,
    );
    dispatchQueue.push({event, listeners});
  }
}

export { registerEvents, extractEvents }