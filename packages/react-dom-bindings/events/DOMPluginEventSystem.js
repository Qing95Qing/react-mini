import { allNativeEvents } from './EventRegistry';

import * as SimpleEventPlugin from './plugins/SimpleEventPlugin';
import * as EnterLeaveEventPlugin from './plugins/EnterLeaveEventPlugin';
import * as ChangeEventPlugin from './plugins/ChangeEventPlugin';
import * as SelectEventPlugin from './plugins/SelectEventPlugin';
import * as BeforeInputEventPlugin from './plugins/BeforeInputEventPlugin';

// 将所有的事件的名称加到allNativeEvents的集合中，两阶段事件的会多加一个capture事件 
// 如onClick会多再注册一个onClickCapture
SimpleEventPlugin.registerEvents();
EnterLeaveEventPlugin.registerEvents();
ChangeEventPlugin.registerEvents();
SelectEventPlugin.registerEvents();
BeforeInputEventPlugin.registerEvents();

const listeningMarker = '_reactListening' + Math.random().toString(36).slice(2);
export const IS_CAPTURE_PHASE = 1 << 2;

// 需要单独附加到媒体元素的事件列表。
export const mediaEventTypes: Array<DOMEventName> = [
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

    allNativeEvents.forEach(domEventName => {
      // 单独处理selectionchange，因为它不会冒泡，所以需要在document元素上监听
      if (domEventName !== 'selectionchange') {
        if (!nonDelegatedEvents.has(domEventName)) {
          listenToNativeEvent(domEventName, false, rootContainerElement);
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
  target,
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
      isCapturePhaseListener,
    );
}

function addTrappedEventListener(
  targetContainer,
  domEventName,
  eventSystemFlags,
  isCapturePhaseListener,
  isDeferredListenerForLegacyFBSupport,
) {
  let listener = createEventListenerWrapperWithPriority(
      targetContainer,
      domEventName,
      eventSystemFlags,
  );

  if (isCapturePhaseListener) {
    unsubscribeListener = addEventCaptureListener(
      targetContainer,
      domEventName,
      listener,
    );
  } else {
    unsubscribeListener = addEventBubbleListener(
      targetContainer,
      domEventName,
      listener,
    );
  }
}