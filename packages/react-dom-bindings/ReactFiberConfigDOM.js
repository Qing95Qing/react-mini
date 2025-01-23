import { COMMENT_NODE } from './HTMLNodeType';

const SUSPENSE_START_DATA = '$';
const SUSPENSE_END_DATA = '/$';
const SUSPENSE_PENDING_START_DATA = '$?';
const SUSPENSE_FALLBACK_START_DATA = '$!';
const FORM_STATE_IS_MATCHING = 'F!';
const FORM_STATE_IS_NOT_MATCHING = 'F';

const localPromise = typeof Promise === 'function' ? Promise : undefined;
export const scheduleTimeout =
    typeof setTimeout === 'function' ? setTimeout : undefined;
export const supportsMicrotasks = true;
export const scheduleMicrotask =
    typeof queueMicrotask === 'function'
        ? // window.queueMicrotask将微任务加入队列以在控制返回浏览器的事件循环之前的安全时间执行。
          queueMicrotask
        : typeof localPromise !== 'undefined'
          ? (callback) =>
                localPromise
                    .resolve(null)
                    .then(callback)
                    .catch(handleErrorInNextTick)
          : scheduleTimeout;

function handleErrorInNextTick(error) {
    setTimeout(() => {
        throw error;
    });
}

export function getParentSuspenseInstance(targetInstance) {
    let node = targetInstance.previousSibling;
    let depth = 0;
    while (node) {
        if (node.nodeType === COMMENT_NODE) {
            const data = node.data;
            if (
                data === SUSPENSE_START_DATA ||
                data === SUSPENSE_FALLBACK_START_DATA ||
                data === SUSPENSE_PENDING_START_DATA
            ) {
                if (depth === 0) {
                    return node;
                } else {
                    depth--;
                }
            } else if (data === SUSPENSE_END_DATA) {
                depth++;
            }
        }
        node = node.previousSibling;
    }
    return null;
}
