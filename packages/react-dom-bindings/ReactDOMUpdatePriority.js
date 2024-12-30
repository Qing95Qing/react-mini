import {
    DefaultEventPriority,
    NoEventPriority,
} from '../react-reconciler/ReactEventPriorities';
import ReactDOMSharedInternals from '../shared/ReactDOMSharedInternals';

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
