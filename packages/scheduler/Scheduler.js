import {
    ImmediatePriority,
    NormalPriority,
    UserBlockingPriority,
} from './SchedulerPriorities';

export const userBlockingPriorityTimeout = 250;
export const normalPriorityTimeout = 5000;
export const lowPriorityTimeout = 10000;

var maxSigned31BitInt = 1073741823;

var taskIdCounter = 1;

// 存放schedule任务的小根堆
var taskQueue = [];
var timerQueue = [];

var isHostCallbackScheduled = false;
var isHostTimeoutScheduled = false;

var currentPriorityLevel = NormalPriority;

const getCurrentTime = () => performance.now();

export function unstable_getCurrentPriorityLevel() {
    return currentPriorityLevel;
}
export function unstable_cancelCallback(task) {
    task.callback = null;
}

function unstable_scheduleCallback(priorityLevel, callback, options) {
    var currentTime = getCurrentTime();

    var startTime;
    if (typeof options === 'object' && options !== null) {
        var delay = options.delay;
        if (typeof delay === 'number' && delay > 0) {
            startTime = currentTime + delay;
        } else {
            startTime = currentTime;
        }
    } else {
        startTime = currentTime;
    }

    var timeout;
    switch (priorityLevel) {
        case ImmediatePriority:
            timeout = -1;
            break;
        case UserBlockingPriority:
            timeout = userBlockingPriorityTimeout;
            break;
        case IdlePriority:
            // Never times out
            timeout = maxSigned31BitInt;
            break;
        case LowPriority:
            // Eventually times out
            timeout = lowPriorityTimeout;
            break;
        case NormalPriority:
        default:
            // Eventually times out
            timeout = normalPriorityTimeout;
            break;
    }

    var expirationTime = startTime + timeout;

    var newTask = {
        id: taskIdCounter++,
        callback,
        priorityLevel,
        startTime,
        expirationTime,
        sortIndex: -1,
    };

    if (startTime > currentTime) {
        // This is a delayed task.
        newTask.sortIndex = startTime;
        push(timerQueue, newTask);
        if (peek(taskQueue) === null && newTask === peek(timerQueue)) {
            // All tasks are delayed, and this is the task with the earliest delay.
            // 所有任务都
            if (isHostTimeoutScheduled) {
                // Cancel an existing timeout.
                cancelHostTimeout();
            } else {
                isHostTimeoutScheduled = true;
            }
            // Schedule a timeout.
            requestHostTimeout(handleTimeout, startTime - currentTime);
        }
    } else {
        newTask.sortIndex = expirationTime;
        push(taskQueue, newTask);
        if (enableProfiling) {
            markTaskStart(newTask, currentTime);
            newTask.isQueued = true;
        }
        // Schedule a host callback, if needed. If we're already performing work,
        // wait until the next time we yield.
        if (!isHostCallbackScheduled && !isPerformingWork) {
            isHostCallbackScheduled = true;
            requestHostCallback();
        }
    }

    return newTask;
}
