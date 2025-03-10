import {
    DefaultEventPriority,
    NoEventPriority,
} from '../react-reconciler/ReactEventPriorities';
import ReactDOMSharedInternals from '../shared/ReactDOMSharedInternals';
import { getEventPriority } from './ReactDOMEventListener';

export function resolveUpdatePriority() {
    const updatePriority =
        ReactDOMSharedInternals.p; /* currentUpdatePriority */
    if (updatePriority !== NoEventPriority) {
        return updatePriority;
    }
    const currentEvent = window.event;
    if (currentEvent === undefined) {
        return DefaultEventPriority;
    }
    return getEventPriority(currentEvent.type);
}

export function getCurrentUpdatePriority() {
    return ReactDOMSharedInternals.p; /* currentUpdatePriority */
}

export function setCurrentUpdatePriority(newPriority) {
    ReactDOMSharedInternals.p /* currentUpdatePriority */ = newPriority;
}
