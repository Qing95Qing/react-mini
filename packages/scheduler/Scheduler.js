import { NormalPriority } from './SchedulerPriorities';

var currentPriorityLevel = NormalPriority;

export function unstable_getCurrentPriorityLevel() {
    return currentPriorityLevel;
}
