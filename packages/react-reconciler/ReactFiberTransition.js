import ReactSharedInternals from '../shared/ReactSharedInternals';

export function requestCurrentTransition() {
    return ReactSharedInternals.T;
}
